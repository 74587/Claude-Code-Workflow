"""Embedding Manager - Manage semantic embeddings for code indexes."""

import gc
import logging
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from itertools import islice
from pathlib import Path
from typing import Dict, Generator, List, Optional, Tuple

try:
    from codexlens.semantic import SEMANTIC_AVAILABLE
    if SEMANTIC_AVAILABLE:
        from codexlens.semantic.embedder import Embedder, get_embedder, clear_embedder_cache
        from codexlens.semantic.vector_store import VectorStore
        from codexlens.semantic.chunker import Chunker, ChunkConfig
except ImportError:
    SEMANTIC_AVAILABLE = False

logger = logging.getLogger(__name__)

# Embedding batch size - larger values improve throughput on modern hardware
# Benchmark: 256 gives ~2.35x speedup over 64 with DirectML GPU acceleration
EMBEDDING_BATCH_SIZE = 256


def _generate_chunks_from_cursor(
    cursor,
    chunker,
    path_column: str,
    file_batch_size: int,
    failed_files: List[Tuple[str, str]],
) -> Generator[Tuple, None, Tuple[int, int]]:
    """Generator that yields chunks from database cursor in a streaming fashion.

    This avoids loading all chunks into memory at once, significantly reducing
    peak memory usage for large codebases.

    Args:
        cursor: SQLite cursor with file data
        chunker: Chunker instance for splitting files
        path_column: Column name for file path
        file_batch_size: Number of files to fetch at a time
        failed_files: List to append failed files to

    Yields:
        (chunk, file_path) tuples

    Returns:
        (total_files_processed, batch_count) after iteration completes
    """
    total_files = 0
    batch_count = 0

    while True:
        file_batch = cursor.fetchmany(file_batch_size)
        if not file_batch:
            break

        batch_count += 1

        for file_row in file_batch:
            file_path = file_row[path_column]
            content = file_row["content"]
            language = file_row["language"] or "python"

            try:
                chunks = chunker.chunk_sliding_window(
                    content,
                    file_path=file_path,
                    language=language
                )
                if chunks:
                    total_files += 1
                    for chunk in chunks:
                        yield (chunk, file_path)
            except Exception as e:
                logger.error(f"Failed to chunk {file_path}: {e}")
                failed_files.append((file_path, str(e)))


def _create_token_aware_batches(
    chunk_generator: Generator,
    max_tokens_per_batch: int = 8000,
) -> Generator[List[Tuple], None, None]:
    """Group chunks by total token count instead of fixed count.

    Uses fast token estimation (len(content) // 4) for efficiency.
    Yields batches when approaching the token limit.

    Args:
        chunk_generator: Generator yielding (chunk, file_path) tuples
        max_tokens_per_batch: Maximum tokens per batch (default: 8000)

    Yields:
        List of (chunk, file_path) tuples representing a batch
    """
    current_batch = []
    current_tokens = 0

    for chunk, file_path in chunk_generator:
        # Fast token estimation: len(content) // 4
        chunk_tokens = len(chunk.content) // 4

        # If adding this chunk would exceed limit and we have items, yield current batch
        if current_tokens + chunk_tokens > max_tokens_per_batch and current_batch:
            yield current_batch
            current_batch = []
            current_tokens = 0

        # Add chunk to current batch
        current_batch.append((chunk, file_path))
        current_tokens += chunk_tokens

    # Yield final batch if not empty
    if current_batch:
        yield current_batch


def _get_path_column(conn: sqlite3.Connection) -> str:
    """Detect whether files table uses 'path' or 'full_path' column.

    Args:
        conn: SQLite connection to the index database

    Returns:
        Column name ('path' or 'full_path')

    Raises:
        ValueError: If neither column exists in files table
    """
    cursor = conn.execute("PRAGMA table_info(files)")
    columns = {row[1] for row in cursor.fetchall()}
    if 'full_path' in columns:
        return 'full_path'
    elif 'path' in columns:
        return 'path'
    raise ValueError("files table has neither 'path' nor 'full_path' column")


def check_index_embeddings(index_path: Path) -> Dict[str, any]:
    """Check if an index has embeddings and return statistics.

    Args:
        index_path: Path to _index.db file

    Returns:
        Dictionary with embedding statistics and status
    """
    if not index_path.exists():
        return {
            "success": False,
            "error": f"Index not found: {index_path}",
        }

    try:
        with sqlite3.connect(index_path) as conn:
            # Check if semantic_chunks table exists
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='semantic_chunks'"
            )
            table_exists = cursor.fetchone() is not None

            if not table_exists:
                # Count total indexed files even without embeddings
                cursor = conn.execute("SELECT COUNT(*) FROM files")
                total_files = cursor.fetchone()[0]

                return {
                    "success": True,
                    "result": {
                        "has_embeddings": False,
                        "total_chunks": 0,
                        "total_files": total_files,
                        "files_with_chunks": 0,
                        "files_without_chunks": total_files,
                        "coverage_percent": 0.0,
                        "missing_files_sample": [],
                        "index_path": str(index_path),
                    },
                }

            # Count total chunks
            cursor = conn.execute("SELECT COUNT(*) FROM semantic_chunks")
            total_chunks = cursor.fetchone()[0]

            # Count total indexed files
            cursor = conn.execute("SELECT COUNT(*) FROM files")
            total_files = cursor.fetchone()[0]

            # Count files with embeddings
            cursor = conn.execute(
                "SELECT COUNT(DISTINCT file_path) FROM semantic_chunks"
            )
            files_with_chunks = cursor.fetchone()[0]

            # Get a sample of files without embeddings
            path_column = _get_path_column(conn)
            cursor = conn.execute(f"""
                SELECT {path_column}
                FROM files
                WHERE {path_column} NOT IN (
                    SELECT DISTINCT file_path FROM semantic_chunks
                )
                LIMIT 5
            """)
            missing_files = [row[0] for row in cursor.fetchall()]

            return {
                "success": True,
                "result": {
                    "has_embeddings": total_chunks > 0,
                    "total_chunks": total_chunks,
                    "total_files": total_files,
                    "files_with_chunks": files_with_chunks,
                    "files_without_chunks": total_files - files_with_chunks,
                    "coverage_percent": round((files_with_chunks / total_files * 100) if total_files > 0 else 0, 1),
                    "missing_files_sample": missing_files,
                    "index_path": str(index_path),
                },
            }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to check embeddings: {str(e)}",
        }


def _get_embedding_defaults() -> tuple[str, str, bool]:
    """Get default embedding settings from config.

    Returns:
        Tuple of (backend, model, use_gpu)
    """
    try:
        from codexlens.config import Config
        config = Config.load()
        return config.embedding_backend, config.embedding_model, config.embedding_use_gpu
    except Exception:
        return "fastembed", "code", True


def generate_embeddings(
    index_path: Path,
    embedding_backend: Optional[str] = None,
    model_profile: Optional[str] = None,
    force: bool = False,
    chunk_size: int = 2000,
    overlap: int = 200,
    progress_callback: Optional[callable] = None,
    use_gpu: Optional[bool] = None,
    max_tokens_per_batch: Optional[int] = None,
    max_workers: int = 1,
) -> Dict[str, any]:
    """Generate embeddings for an index using memory-efficient batch processing.

    This function processes files in small batches to keep memory usage under 2GB,
    regardless of the total project size. Supports concurrent API calls for
    LiteLLM backend to improve throughput.

    Args:
        index_path: Path to _index.db file
        embedding_backend: Embedding backend to use (fastembed or litellm).
                          Defaults to config setting.
        model_profile: Model profile for fastembed (fast, code, multilingual, balanced)
                      or model name for litellm (e.g., qwen3-embedding).
                      Defaults to config setting.
        force: If True, regenerate even if embeddings exist
        chunk_size: Maximum chunk size in characters
        overlap: Overlap size in characters for sliding window chunking (default: 200)
        progress_callback: Optional callback for progress updates
        use_gpu: Whether to use GPU acceleration (fastembed only).
                Defaults to config setting.
        max_tokens_per_batch: Maximum tokens per batch for token-aware batching.
                             If None, attempts to get from embedder.max_tokens,
                             then falls back to 8000. If set, overrides automatic detection.
        max_workers: Maximum number of concurrent API calls (default: 1 for sequential).
                    Recommended: 2-4 for LiteLLM API backends.

    Returns:
        Result dictionary with generation statistics
    """
    # Get defaults from config if not specified
    default_backend, default_model, default_gpu = _get_embedding_defaults()

    if embedding_backend is None:
        embedding_backend = default_backend
    if model_profile is None:
        model_profile = default_model
    if use_gpu is None:
        use_gpu = default_gpu
    if not SEMANTIC_AVAILABLE:
        return {
            "success": False,
            "error": "Semantic search not available. Install with: pip install codexlens[semantic]",
        }

    if not index_path.exists():
        return {
            "success": False,
            "error": f"Index not found: {index_path}",
        }

    # Check existing chunks
    status = check_index_embeddings(index_path)
    if not status["success"]:
        return status

    existing_chunks = status["result"]["total_chunks"]

    if existing_chunks > 0 and not force:
        return {
            "success": False,
            "error": f"Index already has {existing_chunks} chunks. Use --force to regenerate.",
            "existing_chunks": existing_chunks,
        }

    if force and existing_chunks > 0:
        if progress_callback:
            progress_callback(f"Clearing {existing_chunks} existing chunks...")

        try:
            with sqlite3.connect(index_path) as conn:
                conn.execute("DELETE FROM semantic_chunks")
                conn.commit()
        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to clear existing chunks: {str(e)}",
            }

    # Initialize components
    try:
        # Import factory function to support both backends
        from codexlens.semantic.factory import get_embedder as get_embedder_factory

        # Initialize embedder using factory (supports both fastembed and litellm)
        # For fastembed: model_profile is a profile name (fast/code/multilingual/balanced)
        # For litellm: model_profile is a model name (e.g., qwen3-embedding)
        if embedding_backend == "fastembed":
            embedder = get_embedder_factory(backend="fastembed", profile=model_profile, use_gpu=use_gpu)
        elif embedding_backend == "litellm":
            embedder = get_embedder_factory(backend="litellm", model=model_profile)
        else:
            return {
                "success": False,
                "error": f"Invalid embedding backend: {embedding_backend}. Must be 'fastembed' or 'litellm'.",
            }

        # skip_token_count=True: Use fast estimation (len/4) instead of expensive tiktoken
        # This significantly reduces CPU usage with minimal impact on metadata accuracy
        chunker = Chunker(config=ChunkConfig(
            max_chunk_size=chunk_size,
            overlap=overlap,
            skip_token_count=True
        ))

        if progress_callback:
            progress_callback(f"Using model: {embedder.model_name} ({embedder.embedding_dim} dimensions)")

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to initialize components: {str(e)}",
        }

    # --- STREAMING PROCESSING ---
    # Process files in batches to control memory usage
    start_time = time.time()
    failed_files = []
    total_chunks_created = 0
    total_files_processed = 0
    FILE_BATCH_SIZE = 100  # Process 100 files at a time
    # EMBEDDING_BATCH_SIZE is defined at module level (default: 256)

    try:
        with VectorStore(index_path) as vector_store:
            # Check model compatibility with existing embeddings
            if not force:
                is_compatible, warning = vector_store.check_model_compatibility(
                    model_profile, embedder.model_name, embedder.embedding_dim
                )
                if not is_compatible:
                    return {
                        "success": False,
                        "error": warning,
                    }

            # Set/update model configuration for this index
            vector_store.set_model_config(
                model_profile, embedder.model_name, embedder.embedding_dim, backend=embedding_backend
            )
            # Use bulk insert mode for efficient batch ANN index building
            # This defers ANN updates until end_bulk_insert() is called
            with vector_store.bulk_insert():
                with sqlite3.connect(index_path) as conn:
                    conn.row_factory = sqlite3.Row
                    path_column = _get_path_column(conn)

                    # Get total file count for progress reporting
                    total_files = conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]
                    if total_files == 0:
                        return {"success": False, "error": "No files found in index"}

                    if progress_callback:
                        # Format must match Node.js parseProgressLine: "Processing N files" with 'embed' keyword
                        progress_callback(f"Processing {total_files} files for embeddings in batches of {FILE_BATCH_SIZE}...")

                    cursor = conn.execute(f"SELECT {path_column}, content, language FROM files")

                    # --- STREAMING GENERATOR APPROACH ---
                    # Instead of accumulating all chunks from 100 files, we use a generator
                    # that yields chunks on-demand, keeping memory usage low and constant.
                    chunk_generator = _generate_chunks_from_cursor(
                        cursor, chunker, path_column, FILE_BATCH_SIZE, failed_files
                    )

                    # Determine max tokens per batch
                    # Priority: explicit parameter > embedder.max_tokens > default 8000
                    if max_tokens_per_batch is None:
                        max_tokens_per_batch = getattr(embedder, 'max_tokens', 8000)

                    # Create token-aware batches or fall back to fixed-size batching
                    if max_tokens_per_batch:
                        batch_generator = _create_token_aware_batches(
                            chunk_generator, max_tokens_per_batch
                        )
                    else:
                        # Fallback to fixed-size batching for backward compatibility
                        def fixed_size_batches():
                            while True:
                                batch = list(islice(chunk_generator, EMBEDDING_BATCH_SIZE))
                                if not batch:
                                    break
                                yield batch
                        batch_generator = fixed_size_batches()

                    batch_number = 0
                    files_seen = set()

                    def compute_embeddings_only(batch_data: Tuple[int, List[Tuple]]):
                        """Compute embeddings for a batch (no DB write).

                        Args:
                            batch_data: Tuple of (batch_number, chunk_batch)

                        Returns:
                            Tuple of (batch_num, chunk_batch, embeddings_numpy, batch_files, error)
                        """
                        batch_num, chunk_batch = batch_data
                        batch_files = set()

                        try:
                            for _, file_path in chunk_batch:
                                batch_files.add(file_path)

                            batch_contents = [chunk.content for chunk, _ in chunk_batch]
                            embeddings_numpy = embedder.embed_to_numpy(batch_contents, batch_size=EMBEDDING_BATCH_SIZE)

                            return batch_num, chunk_batch, embeddings_numpy, batch_files, None

                        except Exception as e:
                            error_msg = f"Batch {batch_num}: {str(e)}"
                            logger.error(f"Failed to compute embeddings for batch {batch_num}: {str(e)}")
                            return batch_num, chunk_batch, None, batch_files, error_msg

                    # Process batches based on max_workers setting
                    if max_workers <= 1:
                        # Sequential processing - stream directly from generator (no pre-materialization)
                        for chunk_batch in batch_generator:
                            batch_number += 1

                            # Track files in this batch
                            batch_files = set()
                            for _, file_path in chunk_batch:
                                batch_files.add(file_path)

                            try:
                                # Generate embeddings
                                batch_contents = [chunk.content for chunk, _ in chunk_batch]
                                embeddings_numpy = embedder.embed_to_numpy(batch_contents, batch_size=EMBEDDING_BATCH_SIZE)

                                # Store embeddings
                                vector_store.add_chunks_batch_numpy(chunk_batch, embeddings_numpy)

                                files_seen.update(batch_files)
                                total_chunks_created += len(chunk_batch)
                                total_files_processed = len(files_seen)

                                if progress_callback and batch_number % 10 == 0:
                                    progress_callback(f"  Batch {batch_number}: {total_chunks_created} chunks, {total_files_processed} files")

                            except Exception as e:
                                logger.error(f"Failed to process batch {batch_number}: {str(e)}")
                                files_seen.update(batch_files)
                    else:
                        # Concurrent processing with producer-consumer pattern
                        # Workers compute embeddings (parallel), main thread writes to DB (serial)
                        from queue import Queue
                        from threading import Thread

                        result_queue = Queue(maxsize=max_workers * 2)  # Bounded queue to limit memory
                        batch_counter = [0]  # Mutable counter for producer thread
                        producer_done = [False]

                        def producer():
                            """Submit batches to executor, put results in queue."""
                            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                                pending_futures = []

                                for chunk_batch in batch_generator:
                                    batch_counter[0] += 1
                                    batch_num = batch_counter[0]

                                    # Submit compute task
                                    future = executor.submit(compute_embeddings_only, (batch_num, chunk_batch))
                                    pending_futures.append(future)

                                    # Check for completed futures and add to queue
                                    for f in list(pending_futures):
                                        if f.done():
                                            try:
                                                result_queue.put(f.result())
                                            except Exception as e:
                                                logger.error(f"Future raised exception: {e}")
                                            pending_futures.remove(f)

                                # Wait for remaining futures
                                for future in as_completed(pending_futures):
                                    try:
                                        result_queue.put(future.result())
                                    except Exception as e:
                                        logger.error(f"Future raised exception: {e}")

                            producer_done[0] = True
                            result_queue.put(None)  # Sentinel to signal completion

                        # Start producer thread
                        producer_thread = Thread(target=producer, daemon=True)
                        producer_thread.start()

                        if progress_callback:
                            progress_callback(f"Processing with {max_workers} concurrent embedding workers...")

                        # Consumer: main thread writes to DB (serial, no contention)
                        completed = 0
                        while True:
                            result = result_queue.get()
                            if result is None:  # Sentinel
                                break

                            batch_num, chunk_batch, embeddings_numpy, batch_files, error = result

                            if embeddings_numpy is not None and error is None:
                                # Write to DB in main thread (no contention)
                                vector_store.add_chunks_batch_numpy(chunk_batch, embeddings_numpy)
                                total_chunks_created += len(chunk_batch)

                            files_seen.update(batch_files)
                            total_files_processed = len(files_seen)
                            completed += 1

                            if progress_callback and completed % 10 == 0:
                                progress_callback(f"  Completed {completed} batches: {total_chunks_created} chunks")

                        producer_thread.join()
                        batch_number = batch_counter[0]

                # Notify before ANN index finalization (happens when bulk_insert context exits)
                if progress_callback:
                    progress_callback(f"Finalizing index... Building ANN index for {total_chunks_created} chunks")

    except Exception as e:
        # Cleanup on error to prevent process hanging
        try:
            clear_embedder_cache()
            gc.collect()
        except Exception:
            pass
        return {"success": False, "error": f"Failed to read or process files: {str(e)}"}

    elapsed_time = time.time() - start_time

    # Final cleanup: release ONNX resources to allow process exit
    # This is critical - without it, ONNX Runtime threads prevent Python from exiting
    try:
        clear_embedder_cache()
        gc.collect()
    except Exception:
        pass

    return {
        "success": True,
        "result": {
            "chunks_created": total_chunks_created,
            "files_processed": total_files_processed,
            "files_failed": len(failed_files),
            "elapsed_time": elapsed_time,
            "model_profile": model_profile,
            "model_name": embedder.model_name,
            "failed_files": failed_files[:5],  # First 5 failures
            "index_path": str(index_path),
        },
    }


def discover_all_index_dbs(index_root: Path) -> List[Path]:
    """Recursively find all _index.db files in an index tree.

    Args:
        index_root: Root directory to scan for _index.db files

    Returns:
        Sorted list of paths to _index.db files
    """
    if not index_root.exists():
        return []

    return sorted(index_root.rglob("_index.db"))


def find_all_indexes(scan_dir: Path) -> List[Path]:
    """Find all _index.db files in directory tree.

    Args:
        scan_dir: Directory to scan

    Returns:
        List of paths to _index.db files
    """
    if not scan_dir.exists():
        return []

    return list(scan_dir.rglob("_index.db"))



def generate_embeddings_recursive(
    index_root: Path,
    embedding_backend: Optional[str] = None,
    model_profile: Optional[str] = None,
    force: bool = False,
    chunk_size: int = 2000,
    overlap: int = 200,
    progress_callback: Optional[callable] = None,
    use_gpu: Optional[bool] = None,
    max_tokens_per_batch: Optional[int] = None,
    max_workers: int = 1,
) -> Dict[str, any]:
    """Generate embeddings for all index databases in a project recursively.

    Args:
        index_root: Root index directory containing _index.db files
        embedding_backend: Embedding backend to use (fastembed or litellm).
                          Defaults to config setting.
        model_profile: Model profile for fastembed (fast, code, multilingual, balanced)
                      or model name for litellm (e.g., qwen3-embedding).
                      Defaults to config setting.
        force: If True, regenerate even if embeddings exist
        chunk_size: Maximum chunk size in characters
        overlap: Overlap size in characters for sliding window chunking (default: 200)
        progress_callback: Optional callback for progress updates
        use_gpu: Whether to use GPU acceleration (fastembed only).
                Defaults to config setting.
        max_tokens_per_batch: Maximum tokens per batch for token-aware batching.
                             If None, attempts to get from embedder.max_tokens,
                             then falls back to 8000. If set, overrides automatic detection.
        max_workers: Maximum number of concurrent API calls (default: 1 for sequential).
                    Recommended: 2-4 for LiteLLM API backends.

    Returns:
        Aggregated result dictionary with generation statistics
    """
    # Get defaults from config if not specified
    default_backend, default_model, default_gpu = _get_embedding_defaults()

    if embedding_backend is None:
        embedding_backend = default_backend
    if model_profile is None:
        model_profile = default_model
    if use_gpu is None:
        use_gpu = default_gpu
    # Discover all _index.db files
    index_files = discover_all_index_dbs(index_root)

    if not index_files:
        return {
            "success": False,
            "error": f"No index databases found in {index_root}",
        }

    if progress_callback:
        progress_callback(f"Found {len(index_files)} index databases to process")

    # Process each index database
    all_results = []
    total_chunks = 0
    total_files_processed = 0
    total_files_failed = 0

    for idx, index_path in enumerate(index_files, 1):
        if progress_callback:
            try:
                rel_path = index_path.relative_to(index_root)
            except ValueError:
                rel_path = index_path
            # Format: "Processing file X/Y: path" to match Node.js parseProgressLine
            progress_callback(f"Processing file {idx}/{len(index_files)}: {rel_path}")

        result = generate_embeddings(
            index_path,
            embedding_backend=embedding_backend,
            model_profile=model_profile,
            force=force,
            chunk_size=chunk_size,
            overlap=overlap,
            progress_callback=None,  # Don't cascade callbacks
            use_gpu=use_gpu,
            max_tokens_per_batch=max_tokens_per_batch,
            max_workers=max_workers,
        )

        all_results.append({
            "path": str(index_path),
            "success": result["success"],
            "result": result.get("result"),
            "error": result.get("error"),
        })

        if result["success"]:
            data = result["result"]
            total_chunks += data["chunks_created"]
            total_files_processed += data["files_processed"]
            total_files_failed += data["files_failed"]

    successful = sum(1 for r in all_results if r["success"])

    # Final cleanup after processing all indexes
    # Each generate_embeddings() call does its own cleanup, but do a final one to be safe
    try:
        if SEMANTIC_AVAILABLE:
            clear_embedder_cache()
            gc.collect()
    except Exception:
        pass

    return {
        "success": successful > 0,
        "result": {
            "indexes_processed": len(index_files),
            "indexes_successful": successful,
            "indexes_failed": len(index_files) - successful,
            "total_chunks_created": total_chunks,
            "total_files_processed": total_files_processed,
            "total_files_failed": total_files_failed,
            "model_profile": model_profile,
            "details": all_results,
        },
    }


def get_embeddings_status(index_root: Path) -> Dict[str, any]:
    """Get comprehensive embeddings coverage status for all indexes.

    Args:
        index_root: Root index directory

    Returns:
        Aggregated status with coverage statistics, model info, and timestamps
    """
    index_files = discover_all_index_dbs(index_root)

    if not index_files:
        return {
            "success": True,
            "result": {
                "total_indexes": 0,
                "total_files": 0,
                "files_with_embeddings": 0,
                "files_without_embeddings": 0,
                "total_chunks": 0,
                "coverage_percent": 0.0,
                "indexes_with_embeddings": 0,
                "indexes_without_embeddings": 0,
                "model_info": None,
            },
        }

    total_files = 0
    files_with_embeddings = 0
    total_chunks = 0
    indexes_with_embeddings = 0
    model_info = None
    latest_updated_at = None

    for index_path in index_files:
        status = check_index_embeddings(index_path)
        if status["success"]:
            result = status["result"]
            total_files += result["total_files"]
            files_with_embeddings += result["files_with_chunks"]
            total_chunks += result["total_chunks"]
            if result["has_embeddings"]:
                indexes_with_embeddings += 1

                # Get model config from first index with embeddings (they should all match)
                if model_info is None:
                    try:
                        from codexlens.semantic.vector_store import VectorStore
                        with VectorStore(index_path) as vs:
                            config = vs.get_model_config()
                            if config:
                                model_info = {
                                    "model_profile": config.get("model_profile"),
                                    "model_name": config.get("model_name"),
                                    "embedding_dim": config.get("embedding_dim"),
                                    "backend": config.get("backend"),
                                    "created_at": config.get("created_at"),
                                    "updated_at": config.get("updated_at"),
                                }
                                latest_updated_at = config.get("updated_at")
                    except Exception:
                        pass
                else:
                    # Track the latest updated_at across all indexes
                    try:
                        from codexlens.semantic.vector_store import VectorStore
                        with VectorStore(index_path) as vs:
                            config = vs.get_model_config()
                            if config and config.get("updated_at"):
                                if latest_updated_at is None or config["updated_at"] > latest_updated_at:
                                    latest_updated_at = config["updated_at"]
                    except Exception:
                        pass

    # Update model_info with latest timestamp
    if model_info and latest_updated_at:
        model_info["updated_at"] = latest_updated_at

    return {
        "success": True,
        "result": {
            "total_indexes": len(index_files),
            "total_files": total_files,
            "files_with_embeddings": files_with_embeddings,
            "files_without_embeddings": total_files - files_with_embeddings,
            "total_chunks": total_chunks,
            "coverage_percent": round((files_with_embeddings / total_files * 100) if total_files > 0 else 0, 1),
            "indexes_with_embeddings": indexes_with_embeddings,
            "indexes_without_embeddings": len(index_files) - indexes_with_embeddings,
            "model_info": model_info,
        },
    }


def get_embedding_stats_summary(index_root: Path) -> Dict[str, any]:
    """Get summary statistics for all indexes in root directory.

    Args:
        index_root: Root directory containing indexes

    Returns:
        Summary statistics for all indexes
    """
    indexes = find_all_indexes(index_root)

    if not indexes:
        return {
            "success": True,
            "result": {
                "total_indexes": 0,
                "indexes_with_embeddings": 0,
                "total_chunks": 0,
                "indexes": [],
            },
        }

    total_chunks = 0
    indexes_with_embeddings = 0
    index_stats = []

    for index_path in indexes:
        status = check_index_embeddings(index_path)

        if status["success"]:
            result = status["result"]
            has_emb = result["has_embeddings"]
            chunks = result["total_chunks"]

            if has_emb:
                indexes_with_embeddings += 1
                total_chunks += chunks

            # Extract project name from path
            project_name = index_path.parent.name

            index_stats.append({
                "project": project_name,
                "path": str(index_path),
                "has_embeddings": has_emb,
                "total_chunks": chunks,
                "total_files": result["total_files"],
                "coverage_percent": result.get("coverage_percent", 0),
            })

    return {
        "success": True,
        "result": {
            "total_indexes": len(indexes),
            "indexes_with_embeddings": indexes_with_embeddings,
            "total_chunks": total_chunks,
            "indexes": index_stats,
        },
    }
