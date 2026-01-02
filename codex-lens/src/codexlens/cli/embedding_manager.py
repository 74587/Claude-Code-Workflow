"""Embedding Manager - Manage semantic embeddings for code indexes."""

import gc
import json
import logging
import sqlite3
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from itertools import islice
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

try:
    from codexlens.semantic import SEMANTIC_AVAILABLE, is_embedding_backend_available
except ImportError:
    SEMANTIC_AVAILABLE = False
    def is_embedding_backend_available(_backend: str):  # type: ignore[no-redef]
        return False, "codexlens.semantic not available"

try:
    from codexlens.config import VECTORS_META_DB_NAME
except ImportError:
    VECTORS_META_DB_NAME = "_vectors_meta.db"

try:
    from codexlens.search.ranking import get_file_category
except ImportError:
    def get_file_category(path: str):  # type: ignore[no-redef]
        """Fallback: map common extensions to category."""
        ext = Path(path).suffix.lower()
        code_exts = {".py", ".js", ".jsx", ".ts", ".tsx", ".java", ".go", ".c", ".cpp", ".rs"}
        doc_exts = {".md", ".mdx", ".txt", ".rst"}
        if ext in code_exts:
            return "code"
        elif ext in doc_exts:
            return "doc"
        return None

logger = logging.getLogger(__name__)

# Embedding batch size - larger values improve throughput on modern hardware
# Benchmark: 256 gives ~2.35x speedup over 64 with DirectML GPU acceleration
EMBEDDING_BATCH_SIZE = 256


def _build_categories_from_batch(chunk_batch: List[Tuple[Any, str]]) -> List[str]:
    """Build categories list from chunk batch for index-level category filtering.

    Args:
        chunk_batch: List of (chunk, file_path) tuples

    Returns:
        List of category strings ('code' or 'doc'), defaulting to 'code' for unknown
    """
    categories = []
    for _, file_path in chunk_batch:
        cat = get_file_category(file_path)
        categories.append(cat if cat else "code")  # Default to 'code' for unknown extensions
    return categories


def _cleanup_fastembed_resources() -> None:
    """Best-effort cleanup for fastembed/ONNX resources (no-op for other backends)."""
    try:
        from codexlens.semantic.embedder import clear_embedder_cache
        clear_embedder_cache()
    except Exception:
        pass


def _cleanup_splade_resources() -> None:
    """Release SPLADE encoder ONNX resources."""
    try:
        from codexlens.semantic.splade_encoder import clear_splade_cache
        clear_splade_cache()
    except Exception:
        pass


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


def _get_embedding_defaults() -> tuple[str, str, bool, List, str, float]:
    """Get default embedding settings from config.

    Returns:
        Tuple of (backend, model, use_gpu, endpoints, strategy, cooldown)
    """
    try:
        from codexlens.config import Config
        config = Config.load()
        return (
            config.embedding_backend,
            config.embedding_model,
            config.embedding_use_gpu,
            config.embedding_endpoints,
            config.embedding_strategy,
            config.embedding_cooldown,
        )
    except Exception:
        return "fastembed", "code", True, [], "latency_aware", 60.0


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
    max_workers: Optional[int] = None,
    endpoints: Optional[List] = None,
    strategy: Optional[str] = None,
    cooldown: Optional[float] = None,
    splade_db_path: Optional[Path] = None,
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
        max_workers: Maximum number of concurrent API calls.
                    If None, uses dynamic defaults based on backend and endpoint count.
        endpoints: Optional list of endpoint configurations for multi-API load balancing.
                  Each dict has keys: model, api_key, api_base, weight.
        strategy: Selection strategy for multi-endpoint mode (round_robin, latency_aware).
        cooldown: Default cooldown seconds for rate-limited endpoints.
        splade_db_path: Optional path to centralized SPLADE database. If None, SPLADE
                       is written to index_path (legacy behavior). Use index_root / SPLADE_DB_NAME
                       for centralized storage.

    Returns:
        Result dictionary with generation statistics
    """
    # Get defaults from config if not specified
    (default_backend, default_model, default_gpu,
     default_endpoints, default_strategy, default_cooldown) = _get_embedding_defaults()

    if embedding_backend is None:
        embedding_backend = default_backend
    if model_profile is None:
        model_profile = default_model
    if use_gpu is None:
        use_gpu = default_gpu
    if endpoints is None:
        endpoints = default_endpoints
    if strategy is None:
        strategy = default_strategy
    if cooldown is None:
        cooldown = default_cooldown

    # Calculate endpoint count for worker scaling
    endpoint_count = len(endpoints) if endpoints else 1

    # Set dynamic max_workers default based on backend type and endpoint count
    # - FastEmbed: CPU-bound, sequential is optimal (1 worker)
    # - LiteLLM single endpoint: 4 workers default
    # - LiteLLM multi-endpoint: workers = endpoint_count * 2 (to saturate all APIs)
    if max_workers is None:
        if embedding_backend == "litellm":
            if endpoint_count > 1:
                max_workers = endpoint_count * 2  # No cap, scale with endpoints
            else:
                max_workers = 4
        else:
            max_workers = 1

    backend_available, backend_error = is_embedding_backend_available(embedding_backend)
    if not backend_available:
        return {"success": False, "error": backend_error or "Embedding backend not available"}

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
        from codexlens.semantic.vector_store import VectorStore
        from codexlens.semantic.chunker import Chunker, ChunkConfig

        # Initialize embedder using factory (supports fastembed, litellm, and rotational)
        # For fastembed: model_profile is a profile name (fast/code/multilingual/balanced)
        # For litellm: model_profile is a model name (e.g., qwen3-embedding)
        # For multi-endpoint: endpoints list enables load balancing
        if embedding_backend == "fastembed":
            embedder = get_embedder_factory(backend="fastembed", profile=model_profile, use_gpu=use_gpu)
        elif embedding_backend == "litellm":
            embedder = get_embedder_factory(
                backend="litellm",
                model=model_profile,
                endpoints=endpoints if endpoints else None,
                strategy=strategy,
                cooldown=cooldown,
            )
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

        # Log embedder info with endpoint count for multi-endpoint mode
        if progress_callback:
            if endpoint_count > 1:
                progress_callback(f"Using {endpoint_count} API endpoints with {strategy} strategy")
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
                        """Compute embeddings for a batch (no DB write) with retry logic.

                        Args:
                            batch_data: Tuple of (batch_number, chunk_batch)

                        Returns:
                            Tuple of (batch_num, chunk_batch, embeddings_numpy, batch_files, error)
                        """
                        import random

                        batch_num, chunk_batch = batch_data
                        batch_files = set()
                        for _, file_path in chunk_batch:
                            batch_files.add(file_path)

                        max_retries = 5
                        base_delay = 2.0

                        for attempt in range(max_retries + 1):
                            try:
                                batch_contents = [chunk.content for chunk, _ in chunk_batch]
                                embeddings_numpy = embedder.embed_to_numpy(batch_contents, batch_size=EMBEDDING_BATCH_SIZE)
                                return batch_num, chunk_batch, embeddings_numpy, batch_files, None

                            except Exception as e:
                                error_str = str(e).lower()
                                # Check for retryable errors (rate limit, connection, backend issues)
                                # Note: Some backends (e.g., ModelScope) return 400 with nested 500 errors
                                is_retryable = any(x in error_str for x in [
                                    "429", "rate limit", "connection", "timeout",
                                    "502", "503", "504", "service unavailable",
                                    "500", "400", "badrequesterror", "internal server error",
                                    "11434"  # Ollama port - indicates backend routing issue
                                ])

                                if attempt < max_retries and is_retryable:
                                    sleep_time = base_delay * (2 ** attempt) + random.uniform(0, 0.5)
                                    logger.warning(f"Batch {batch_num} failed (attempt {attempt+1}/{max_retries+1}). "
                                                   f"Retrying in {sleep_time:.1f}s. Error: {e}")
                                    time.sleep(sleep_time)
                                    continue

                                error_msg = f"Batch {batch_num}: {str(e)}"
                                logger.error(f"Failed to compute embeddings for batch {batch_num}: {str(e)}")
                                return batch_num, chunk_batch, None, batch_files, error_msg

                        # Should not reach here, but just in case
                        return batch_num, chunk_batch, None, batch_files, f"Batch {batch_num}: Max retries exceeded"

                    # Process batches based on max_workers setting
                    if max_workers <= 1:
                        # Sequential processing - stream directly from generator (no pre-materialization)
                        for chunk_batch in batch_generator:
                            batch_number += 1

                            # Track files in this batch
                            batch_files = set()
                            for _, file_path in chunk_batch:
                                batch_files.add(file_path)

                            # Retry logic for transient backend errors
                            max_retries = 5
                            base_delay = 2.0
                            success = False

                            for attempt in range(max_retries + 1):
                                try:
                                    # Generate embeddings
                                    batch_contents = [chunk.content for chunk, _ in chunk_batch]
                                    embeddings_numpy = embedder.embed_to_numpy(batch_contents, batch_size=EMBEDDING_BATCH_SIZE)

                                    # Store embeddings with category
                                    categories = _build_categories_from_batch(chunk_batch)
                                    vector_store.add_chunks_batch_numpy(chunk_batch, embeddings_numpy, categories=categories)

                                    files_seen.update(batch_files)
                                    total_chunks_created += len(chunk_batch)
                                    total_files_processed = len(files_seen)
                                    success = True
                                    break

                                except Exception as e:
                                    error_str = str(e).lower()
                                    # Check for retryable errors (rate limit, connection, backend issues)
                                    is_retryable = any(x in error_str for x in [
                                        "429", "rate limit", "connection", "timeout",
                                        "502", "503", "504", "service unavailable",
                                        "500", "400", "badrequesterror", "internal server error",
                                        "11434"  # Ollama port - indicates backend routing issue
                                    ])

                                    if attempt < max_retries and is_retryable:
                                        import random
                                        sleep_time = base_delay * (2 ** attempt) + random.uniform(0, 0.5)
                                        logger.warning(f"Batch {batch_number} failed (attempt {attempt+1}/{max_retries+1}). "
                                                       f"Retrying in {sleep_time:.1f}s. Error: {e}")
                                        time.sleep(sleep_time)
                                        continue

                                    logger.error(f"Failed to process batch {batch_number}: {str(e)}")
                                    files_seen.update(batch_files)
                                    break

                            if success and progress_callback and batch_number % 10 == 0:
                                progress_callback(f"  Batch {batch_number}: {total_chunks_created} chunks, {total_files_processed} files")
                    else:
                        # Concurrent processing - main thread iterates batches (SQLite safe),
                        # workers compute embeddings (parallel), main thread writes to DB (serial)
                        if progress_callback:
                            progress_callback(f"Processing with {max_workers} concurrent embedding workers...")

                        with ThreadPoolExecutor(max_workers=max_workers) as executor:
                            pending_futures = {}  # future -> (batch_num, chunk_batch)
                            completed_batches = 0
                            last_reported_batch = 0

                            def process_completed_futures():
                                """Process any completed futures and write to DB."""
                                nonlocal total_chunks_created, total_files_processed, completed_batches, last_reported_batch
                                done_futures = [f for f in pending_futures if f.done()]
                                for f in done_futures:
                                    try:
                                        batch_num, chunk_batch, embeddings_numpy, batch_files, error = f.result()
                                        if embeddings_numpy is not None and error is None:
                                            # Write to DB in main thread (no contention)
                                            categories = _build_categories_from_batch(chunk_batch)
                                            vector_store.add_chunks_batch_numpy(chunk_batch, embeddings_numpy, categories=categories)
                                            total_chunks_created += len(chunk_batch)
                                        files_seen.update(batch_files)
                                        total_files_processed = len(files_seen)
                                        completed_batches += 1
                                    except Exception as e:
                                        logger.error(f"Future raised exception: {e}")
                                        completed_batches += 1
                                    del pending_futures[f]

                                # Report progress based on completed batches (every 5 batches)
                                if progress_callback and completed_batches >= last_reported_batch + 5:
                                    progress_callback(f"  Batch {completed_batches}: {total_chunks_created} chunks, {total_files_processed} files")
                                    last_reported_batch = completed_batches

                            # Iterate batches in main thread (SQLite cursor is main-thread bound)
                            for chunk_batch in batch_generator:
                                batch_number += 1

                                # Submit compute task to worker pool
                                future = executor.submit(compute_embeddings_only, (batch_number, chunk_batch))
                                pending_futures[future] = batch_number

                                # Process any completed futures to free memory and write to DB
                                process_completed_futures()

                                # Backpressure: wait if too many pending
                                while len(pending_futures) >= max_workers * 2:
                                    process_completed_futures()
                                    if len(pending_futures) >= max_workers * 2:
                                        time.sleep(0.1)  # time is imported at module level

                            # Wait for remaining futures
                            for future in as_completed(list(pending_futures.keys())):
                                try:
                                    batch_num, chunk_batch, embeddings_numpy, batch_files, error = future.result()
                                    if embeddings_numpy is not None and error is None:
                                        categories = _build_categories_from_batch(chunk_batch)
                                        vector_store.add_chunks_batch_numpy(chunk_batch, embeddings_numpy, categories=categories)
                                        total_chunks_created += len(chunk_batch)
                                    files_seen.update(batch_files)
                                    total_files_processed = len(files_seen)
                                    completed_batches += 1

                                    # Report progress for remaining batches
                                    if progress_callback and completed_batches >= last_reported_batch + 5:
                                        progress_callback(f"  Batch {completed_batches}: {total_chunks_created} chunks, {total_files_processed} files")
                                        last_reported_batch = completed_batches
                                except Exception as e:
                                    logger.error(f"Future raised exception: {e}")

                # Notify before ANN index finalization (happens when bulk_insert context exits)
                if progress_callback:
                    progress_callback(f"Finalizing index... Building ANN index for {total_chunks_created} chunks")

            # --- SPLADE SPARSE ENCODING (after dense embeddings) ---
            # Add SPLADE encoding if enabled in config
            splade_success = False
            splade_error = None

            try:
                from codexlens.config import Config, SPLADE_DB_NAME
                config = Config.load()

                if config.enable_splade:
                    from codexlens.semantic.splade_encoder import check_splade_available, get_splade_encoder
                    from codexlens.storage.splade_index import SpladeIndex

                    ok, err = check_splade_available()
                    if ok:
                        if progress_callback:
                            progress_callback(f"Generating SPLADE sparse vectors for {total_chunks_created} chunks...")

                        # Initialize SPLADE encoder and index
                        splade_encoder = get_splade_encoder(use_gpu=use_gpu)
                        # Use centralized SPLADE database if provided, otherwise fallback to index_path
                        effective_splade_path = splade_db_path if splade_db_path else index_path
                        splade_index = SpladeIndex(effective_splade_path)
                        splade_index.create_tables()

                        # Retrieve all chunks from database for SPLADE encoding
                        with sqlite3.connect(index_path) as conn:
                            conn.row_factory = sqlite3.Row
                            cursor = conn.execute("SELECT id, content FROM semantic_chunks ORDER BY id")

                            # Batch encode for efficiency
                            SPLADE_BATCH_SIZE = 32
                            batch_postings = []
                            chunk_batch = []
                            chunk_ids = []

                            for row in cursor:
                                chunk_id = row["id"]
                                content = row["content"]

                                chunk_ids.append(chunk_id)
                                chunk_batch.append(content)

                                # Process batch when full
                                if len(chunk_batch) >= SPLADE_BATCH_SIZE:
                                    sparse_vecs = splade_encoder.encode_batch(chunk_batch, batch_size=SPLADE_BATCH_SIZE)
                                    for cid, sparse_vec in zip(chunk_ids, sparse_vecs):
                                        batch_postings.append((cid, sparse_vec))

                                    chunk_batch = []
                                    chunk_ids = []

                            # Process remaining chunks
                            if chunk_batch:
                                sparse_vecs = splade_encoder.encode_batch(chunk_batch, batch_size=SPLADE_BATCH_SIZE)
                                for cid, sparse_vec in zip(chunk_ids, sparse_vecs):
                                    batch_postings.append((cid, sparse_vec))

                            # Batch insert all postings
                            if batch_postings:
                                splade_index.add_postings_batch(batch_postings)

                                # Set metadata
                                splade_index.set_metadata(
                                    model_name=splade_encoder.model_name,
                                    vocab_size=splade_encoder.vocab_size
                                )

                                splade_success = True
                                if progress_callback:
                                    stats = splade_index.get_stats()
                                    progress_callback(
                                        f"SPLADE index created: {stats['total_postings']} postings, "
                                        f"{stats['unique_tokens']} unique tokens"
                                    )
                    else:
                        logger.debug("SPLADE not available: %s", err)
                        splade_error = f"SPLADE not available: {err}"
            except Exception as e:
                splade_error = str(e)
                logger.warning("SPLADE encoding failed: %s", e)

            # Report SPLADE status after processing
            if progress_callback and not splade_success and splade_error:
                progress_callback(f"SPLADE index: FAILED - {splade_error}")

    except Exception as e:
        # Cleanup on error to prevent process hanging
        try:
            _cleanup_fastembed_resources()
            _cleanup_splade_resources()
            gc.collect()
        except Exception:
            pass
        return {"success": False, "error": f"Failed to read or process files: {str(e)}"}

    elapsed_time = time.time() - start_time

    # Final cleanup: release ONNX resources to allow process exit
    # This is critical - without it, ONNX Runtime threads prevent Python from exiting
    try:
        _cleanup_fastembed_resources()
        _cleanup_splade_resources()
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
    max_workers: Optional[int] = None,
    endpoints: Optional[List] = None,
    strategy: Optional[str] = None,
    cooldown: Optional[float] = None,
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
        max_workers: Maximum number of concurrent API calls.
                    If None, uses dynamic defaults based on backend and endpoint count.
        endpoints: Optional list of endpoint configurations for multi-API load balancing.
        strategy: Selection strategy for multi-endpoint mode.
        cooldown: Default cooldown seconds for rate-limited endpoints.

    Returns:
        Aggregated result dictionary with generation statistics
    """
    # Get defaults from config if not specified
    (default_backend, default_model, default_gpu,
     default_endpoints, default_strategy, default_cooldown) = _get_embedding_defaults()

    if embedding_backend is None:
        embedding_backend = default_backend
    if model_profile is None:
        model_profile = default_model
    if use_gpu is None:
        use_gpu = default_gpu
    if endpoints is None:
        endpoints = default_endpoints
    if strategy is None:
        strategy = default_strategy
    if cooldown is None:
        cooldown = default_cooldown

    # Calculate endpoint count for worker scaling
    endpoint_count = len(endpoints) if endpoints else 1

    # Set dynamic max_workers default based on backend type and endpoint count
    if max_workers is None:
        if embedding_backend == "litellm":
            if endpoint_count > 1:
                max_workers = endpoint_count * 2  # No cap, scale with endpoints
            else:
                max_workers = 4
        else:
            max_workers = 1

    # Discover all _index.db files
    index_files = discover_all_index_dbs(index_root)

    if not index_files:
        return {
            "success": False,
            "error": f"No index databases found in {index_root}",
        }

    if progress_callback:
        progress_callback(f"Found {len(index_files)} index databases to process")

    # Calculate centralized SPLADE database path
    from codexlens.config import SPLADE_DB_NAME
    splade_db_path = index_root / SPLADE_DB_NAME

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
            endpoints=endpoints,
            strategy=strategy,
            cooldown=cooldown,
            splade_db_path=splade_db_path,  # Use centralized SPLADE storage
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
        _cleanup_fastembed_resources()
        _cleanup_splade_resources()
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


def generate_dense_embeddings_centralized(
    index_root: Path,
    embedding_backend: Optional[str] = None,
    model_profile: Optional[str] = None,
    force: bool = False,
    chunk_size: int = 2000,
    overlap: int = 200,
    progress_callback: Optional[callable] = None,
    use_gpu: Optional[bool] = None,
    max_tokens_per_batch: Optional[int] = None,
    max_workers: Optional[int] = None,
    endpoints: Optional[List] = None,
    strategy: Optional[str] = None,
    cooldown: Optional[float] = None,
) -> Dict[str, any]:
    """Generate dense embeddings with centralized vector storage.

    This function creates a single HNSW index at the project root instead of
    per-directory indexes. All chunks from all _index.db files are combined
    into one central _vectors.hnsw file.

    Target architecture:
        <index_root>/
        |-- _vectors.hnsw         # Centralized dense vector ANN index
        |-- _splade.db            # Centralized sparse vector index
        |-- src/
            |-- _index.db         # No longer contains .hnsw file

    Args:
        index_root: Root index directory containing _index.db files
        embedding_backend: Embedding backend (fastembed or litellm)
        model_profile: Model profile or name
        force: If True, regenerate even if embeddings exist
        chunk_size: Maximum chunk size in characters
        overlap: Overlap size in characters
        progress_callback: Optional callback for progress updates
        use_gpu: Whether to use GPU acceleration
        max_tokens_per_batch: Maximum tokens per batch
        max_workers: Maximum concurrent workers
        endpoints: Multi-endpoint configurations
        strategy: Endpoint selection strategy
        cooldown: Rate-limit cooldown seconds

    Returns:
        Result dictionary with generation statistics
    """
    from codexlens.config import VECTORS_HNSW_NAME, SPLADE_DB_NAME

    # Get defaults from config if not specified
    (default_backend, default_model, default_gpu,
     default_endpoints, default_strategy, default_cooldown) = _get_embedding_defaults()

    if embedding_backend is None:
        embedding_backend = default_backend
    if model_profile is None:
        model_profile = default_model
    if use_gpu is None:
        use_gpu = default_gpu
    if endpoints is None:
        endpoints = default_endpoints
    if strategy is None:
        strategy = default_strategy
    if cooldown is None:
        cooldown = default_cooldown

    # Calculate endpoint count for worker scaling
    endpoint_count = len(endpoints) if endpoints else 1

    if max_workers is None:
        if embedding_backend == "litellm":
            if endpoint_count > 1:
                max_workers = endpoint_count * 2
            else:
                max_workers = 4
        else:
            max_workers = 1

    backend_available, backend_error = is_embedding_backend_available(embedding_backend)
    if not backend_available:
        return {"success": False, "error": backend_error or "Embedding backend not available"}

    # Discover all _index.db files
    index_files = discover_all_index_dbs(index_root)

    if not index_files:
        return {
            "success": False,
            "error": f"No index databases found in {index_root}",
        }

    if progress_callback:
        progress_callback(f"Found {len(index_files)} index databases for centralized embedding")

    # Check for existing centralized index
    central_hnsw_path = index_root / VECTORS_HNSW_NAME
    if central_hnsw_path.exists() and not force:
        return {
            "success": False,
            "error": f"Centralized vector index already exists at {central_hnsw_path}. Use --force to regenerate.",
        }

    # Initialize embedder
    try:
        from codexlens.semantic.factory import get_embedder as get_embedder_factory
        from codexlens.semantic.chunker import Chunker, ChunkConfig
        from codexlens.semantic.ann_index import ANNIndex

        if embedding_backend == "fastembed":
            embedder = get_embedder_factory(backend="fastembed", profile=model_profile, use_gpu=use_gpu)
        elif embedding_backend == "litellm":
            embedder = get_embedder_factory(
                backend="litellm",
                model=model_profile,
                endpoints=endpoints if endpoints else None,
                strategy=strategy,
                cooldown=cooldown,
            )
        else:
            return {
                "success": False,
                "error": f"Invalid embedding backend: {embedding_backend}",
            }

        chunker = Chunker(config=ChunkConfig(
            max_chunk_size=chunk_size,
            overlap=overlap,
            skip_token_count=True
        ))

        if progress_callback:
            if endpoint_count > 1:
                progress_callback(f"Using {endpoint_count} API endpoints with {strategy} strategy")
            progress_callback(f"Using model: {embedder.model_name} ({embedder.embedding_dim} dimensions)")

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to initialize components: {str(e)}",
        }

    # Create centralized ANN index
    central_ann_index = ANNIndex.create_central(
        index_root=index_root,
        dim=embedder.embedding_dim,
        initial_capacity=100000,  # Larger capacity for centralized index
        auto_save=False,
    )

    # Process all index databases
    start_time = time.time()
    failed_files = []
    total_chunks_created = 0
    total_files_processed = 0
    all_chunk_ids = []
    all_embeddings = []

    # Track chunk ID to file_path mapping for metadata
    chunk_id_to_info: Dict[int, Dict[str, Any]] = {}
    next_chunk_id = 1

    for idx, index_path in enumerate(index_files, 1):
        if progress_callback:
            try:
                rel_path = index_path.relative_to(index_root)
            except ValueError:
                rel_path = index_path
            progress_callback(f"Processing {idx}/{len(index_files)}: {rel_path}")

        try:
            with sqlite3.connect(index_path) as conn:
                conn.row_factory = sqlite3.Row
                path_column = _get_path_column(conn)

                # Get files from this index
                cursor = conn.execute(f"SELECT {path_column}, content, language FROM files")
                file_rows = cursor.fetchall()

                for file_row in file_rows:
                    file_path = file_row[path_column]
                    content = file_row["content"]
                    language = file_row["language"] or "python"

                    try:
                        chunks = chunker.chunk_sliding_window(
                            content,
                            file_path=file_path,
                            language=language
                        )

                        if not chunks:
                            continue

                        total_files_processed += 1

                        # Generate embeddings for this file's chunks
                        batch_contents = [chunk.content for chunk in chunks]
                        embeddings_numpy = embedder.embed_to_numpy(batch_contents, batch_size=EMBEDDING_BATCH_SIZE)

                        # Assign chunk IDs and store embeddings
                        for i, chunk in enumerate(chunks):
                            chunk_id = next_chunk_id
                            next_chunk_id += 1

                            all_chunk_ids.append(chunk_id)
                            all_embeddings.append(embeddings_numpy[i])

                            # Store metadata for later retrieval
                            chunk_id_to_info[chunk_id] = {
                                "file_path": file_path,
                                "content": chunk.content,
                                "metadata": chunk.metadata,
                                "category": get_file_category(file_path) or "code",
                            }
                            total_chunks_created += 1

                    except Exception as e:
                        logger.error(f"Failed to process {file_path}: {e}")
                        failed_files.append((file_path, str(e)))

        except Exception as e:
            logger.error(f"Failed to read index {index_path}: {e}")
            failed_files.append((str(index_path), str(e)))

    # Add all embeddings to centralized ANN index
    if all_embeddings:
        if progress_callback:
            progress_callback(f"Building centralized ANN index with {len(all_embeddings)} vectors...")

        try:
            import numpy as np
            embeddings_matrix = np.vstack(all_embeddings)
            central_ann_index.add_vectors(all_chunk_ids, embeddings_matrix)
            central_ann_index.save()

            if progress_callback:
                progress_callback(f"Saved centralized index to {central_hnsw_path}")

        except Exception as e:
            return {
                "success": False,
                "error": f"Failed to build centralized ANN index: {str(e)}",
            }

    # Store chunk metadata in a centralized metadata database
    vectors_meta_path = index_root / VECTORS_META_DB_NAME
    if chunk_id_to_info:
        if progress_callback:
            progress_callback(f"Storing {len(chunk_id_to_info)} chunk metadata records...")

        try:
            from codexlens.storage.vector_meta_store import VectorMetadataStore

            with VectorMetadataStore(vectors_meta_path) as meta_store:
                # Convert chunk_id_to_info dict to list of dicts for batch insert
                chunks_to_store = []
                for cid, info in chunk_id_to_info.items():
                    metadata = info.get("metadata", {})
                    chunks_to_store.append({
                        "chunk_id": cid,
                        "file_path": info["file_path"],
                        "content": info["content"],
                        "start_line": metadata.get("start_line"),
                        "end_line": metadata.get("end_line"),
                        "category": info.get("category"),
                        "metadata": metadata,
                        "source_index_db": None,  # Not tracked per-chunk currently
                    })

                meta_store.add_chunks(chunks_to_store)

            if progress_callback:
                progress_callback(f"Saved metadata to {vectors_meta_path}")

        except Exception as e:
            logger.warning("Failed to store vector metadata: %s", e)
            # Non-fatal: continue without centralized metadata

    elapsed_time = time.time() - start_time

    # Cleanup
    try:
        _cleanup_fastembed_resources()
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
            "central_index_path": str(central_hnsw_path),
            "failed_files": failed_files[:5],
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


def scan_for_model_conflicts(
    index_root: Path,
    target_backend: str,
    target_model: str,
) -> Dict[str, any]:
    """Scan for model conflicts across all indexes in a directory.

    Checks if any existing embeddings were generated with a different
    backend or model than the target configuration.

    Args:
        index_root: Root index directory to scan
        target_backend: Target embedding backend (fastembed or litellm)
        target_model: Target model profile/name

    Returns:
        Dictionary with:
        - has_conflict: True if any index has different model config
        - existing_config: Config from first index with embeddings (if any)
        - target_config: The requested configuration
        - conflicts: List of conflicting index paths with their configs
        - indexes_with_embeddings: Count of indexes that have embeddings
    """
    index_files = discover_all_index_dbs(index_root)

    if not index_files:
        return {
            "has_conflict": False,
            "existing_config": None,
            "target_config": {"backend": target_backend, "model": target_model},
            "conflicts": [],
            "indexes_with_embeddings": 0,
        }

    conflicts = []
    existing_config = None
    indexes_with_embeddings = 0

    for index_path in index_files:
        try:
            from codexlens.semantic.vector_store import VectorStore

            with VectorStore(index_path) as vs:
                config = vs.get_model_config()
                if config and config.get("model_profile"):
                    indexes_with_embeddings += 1

                    # Store first existing config as reference
                    if existing_config is None:
                        existing_config = {
                            "backend": config.get("backend"),
                            "model": config.get("model_profile"),
                            "model_name": config.get("model_name"),
                            "embedding_dim": config.get("embedding_dim"),
                        }

                    # Check for conflict: different backend OR different model
                    existing_backend = config.get("backend", "")
                    existing_model = config.get("model_profile", "")

                    if existing_backend != target_backend or existing_model != target_model:
                        conflicts.append({
                            "path": str(index_path),
                            "existing": {
                                "backend": existing_backend,
                                "model": existing_model,
                                "model_name": config.get("model_name"),
                            },
                        })
        except Exception as e:
            logger.debug(f"Failed to check model config for {index_path}: {e}")
            continue

    return {
        "has_conflict": len(conflicts) > 0,
        "existing_config": existing_config,
        "target_config": {"backend": target_backend, "model": target_model},
        "conflicts": conflicts,
        "indexes_with_embeddings": indexes_with_embeddings,
    }


def _get_global_settings_path() -> Path:
    """Get the path to global embedding settings file."""
    return Path.home() / ".codexlens" / "embedding_lock.json"


def get_locked_model_config() -> Optional[Dict[str, Any]]:
    """Get the globally locked embedding model configuration.

    Returns:
        Dictionary with backend and model if locked, None otherwise.
    """
    settings_path = _get_global_settings_path()
    if not settings_path.exists():
        return None

    try:
        with open(settings_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            if data.get("locked"):
                return {
                    "backend": data.get("backend"),
                    "model": data.get("model"),
                    "locked_at": data.get("locked_at"),
                }
    except (json.JSONDecodeError, OSError):
        pass

    return None


def set_locked_model_config(backend: str, model: str) -> None:
    """Set the globally locked embedding model configuration.

    This is called after the first successful embedding generation
    to lock the model for all future operations.

    Args:
        backend: Embedding backend (fastembed or litellm)
        model: Model profile/name
    """
    import datetime

    settings_path = _get_global_settings_path()
    settings_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "locked": True,
        "backend": backend,
        "model": model,
        "locked_at": datetime.datetime.now().isoformat(),
    }

    with open(settings_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def clear_locked_model_config() -> bool:
    """Clear the globally locked embedding model configuration.

    Returns:
        True if lock was cleared, False if no lock existed.
    """
    settings_path = _get_global_settings_path()
    if settings_path.exists():
        settings_path.unlink()
        return True
    return False


def check_global_model_lock(
    target_backend: str,
    target_model: str,
) -> Dict[str, Any]:
    """Check if the target model conflicts with the global lock.

    Args:
        target_backend: Requested embedding backend
        target_model: Requested model profile/name

    Returns:
        Dictionary with:
        - is_locked: True if a global lock exists
        - has_conflict: True if target differs from locked config
        - locked_config: The locked configuration (if any)
        - target_config: The requested configuration
    """
    locked_config = get_locked_model_config()

    if locked_config is None:
        return {
            "is_locked": False,
            "has_conflict": False,
            "locked_config": None,
            "target_config": {"backend": target_backend, "model": target_model},
        }

    has_conflict = (
        locked_config["backend"] != target_backend or
        locked_config["model"] != target_model
    )

    return {
        "is_locked": True,
        "has_conflict": has_conflict,
        "locked_config": locked_config,
        "target_config": {"backend": target_backend, "model": target_model},
    }