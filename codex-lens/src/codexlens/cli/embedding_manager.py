"""Embedding Manager - Manage semantic embeddings for code indexes."""

import gc
import logging
import sqlite3
import time
from pathlib import Path
from typing import Dict, List, Optional

try:
    from codexlens.semantic import SEMANTIC_AVAILABLE
    if SEMANTIC_AVAILABLE:
        from codexlens.semantic.embedder import Embedder, get_embedder, clear_embedder_cache
        from codexlens.semantic.vector_store import VectorStore
        from codexlens.semantic.chunker import Chunker, ChunkConfig
except ImportError:
    SEMANTIC_AVAILABLE = False

logger = logging.getLogger(__name__)

# Periodic embedder recreation interval to prevent memory accumulation
EMBEDDER_RECREATION_INTERVAL = 10  # Recreate embedder every N batches


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


def generate_embeddings(
    index_path: Path,
    model_profile: str = "code",
    force: bool = False,
    chunk_size: int = 2000,
    progress_callback: Optional[callable] = None,
) -> Dict[str, any]:
    """Generate embeddings for an index using memory-efficient batch processing.

    This function processes files in small batches to keep memory usage under 2GB,
    regardless of the total project size.

    Args:
        index_path: Path to _index.db file
        model_profile: Model profile (fast, code, multilingual, balanced)
        force: If True, regenerate even if embeddings exist
        chunk_size: Maximum chunk size in characters
        progress_callback: Optional callback for progress updates

    Returns:
        Result dictionary with generation statistics
    """
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
        # Initialize embedder (will be periodically recreated to prevent memory leaks)
        embedder = get_embedder(profile=model_profile)
        chunker = Chunker(config=ChunkConfig(max_chunk_size=chunk_size))

        if progress_callback:
            progress_callback(f"Using model: {embedder.model_name} ({embedder.embedding_dim} dimensions)")
            progress_callback(f"Memory optimization: Embedder will be recreated every {EMBEDDER_RECREATION_INTERVAL} batches")

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to initialize components: {str(e)}",
        }

    # --- MEMORY-OPTIMIZED STREAMING PROCESSING ---
    # Process files in small batches to control memory usage
    # This keeps peak memory under 2GB regardless of project size
    start_time = time.time()
    failed_files = []
    total_chunks_created = 0
    total_files_processed = 0
    FILE_BATCH_SIZE = 100  # Process 100 files at a time
    EMBEDDING_BATCH_SIZE = 8  # jina-embeddings-v2-base-code needs small batches

    try:
        with VectorStore(index_path) as vector_store:
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
                        progress_callback(f"Processing {total_files} files in batches of {FILE_BATCH_SIZE}...")

                    cursor = conn.execute(f"SELECT {path_column}, content, language FROM files")
                    batch_number = 0

                    while True:
                        # Fetch a batch of files (streaming, not fetchall)
                        file_batch = cursor.fetchmany(FILE_BATCH_SIZE)
                        if not file_batch:
                            break

                        batch_number += 1
                        batch_chunks_with_paths = []
                        files_in_batch_with_chunks = set()

                        # Periodic embedder recreation to prevent memory accumulation
                        if batch_number % EMBEDDER_RECREATION_INTERVAL == 0:
                            if progress_callback:
                                progress_callback(f"  [Memory optimization] Recreating embedder at batch {batch_number}")
                            clear_embedder_cache()
                            embedder = get_embedder(profile=model_profile)
                            gc.collect()

                        # Step 1: Chunking for the current file batch
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
                                    for chunk in chunks:
                                        batch_chunks_with_paths.append((chunk, file_path))
                                    files_in_batch_with_chunks.add(file_path)
                            except Exception as e:
                                logger.error(f"Failed to chunk {file_path}: {e}")
                                failed_files.append((file_path, str(e)))

                        if not batch_chunks_with_paths:
                            continue

                        batch_chunk_count = len(batch_chunks_with_paths)
                        if progress_callback:
                            progress_callback(f"  Batch {batch_number}: {len(file_batch)} files, {batch_chunk_count} chunks")

                        # Step 2: Generate embeddings for this batch (use memory-efficient numpy method)
                        batch_embeddings = []
                        try:
                            for i in range(0, batch_chunk_count, EMBEDDING_BATCH_SIZE):
                                batch_end = min(i + EMBEDDING_BATCH_SIZE, batch_chunk_count)
                                batch_contents = [chunk.content for chunk, _ in batch_chunks_with_paths[i:batch_end]]
                                # Use embed_to_numpy() to avoid unnecessary list conversion
                                embeddings_numpy = embedder.embed_to_numpy(batch_contents)
                                # Convert to list only for storage (VectorStore expects list format)
                                embeddings = [emb.tolist() for emb in embeddings_numpy]
                                batch_embeddings.extend(embeddings)
                                # Explicit cleanup of intermediate data
                                del batch_contents, embeddings_numpy
                        except Exception as e:
                            logger.error(f"Failed to generate embeddings for batch {batch_number}: {str(e)}")
                            failed_files.extend([(file_row[path_column], str(e)) for file_row in file_batch])
                            continue

                        # Step 3: Assign embeddings to chunks
                        for (chunk, _), embedding in zip(batch_chunks_with_paths, batch_embeddings):
                            chunk.embedding = embedding

                        # Step 4: Store this batch to database (ANN update deferred in bulk_insert mode)
                        try:
                            vector_store.add_chunks_batch(batch_chunks_with_paths)
                            total_chunks_created += batch_chunk_count
                            total_files_processed += len(files_in_batch_with_chunks)
                        except Exception as e:
                            logger.error(f"Failed to store batch {batch_number}: {str(e)}")
                            failed_files.extend([(file_row[path_column], str(e)) for file_row in file_batch])

                        # Explicit memory cleanup after each batch
                        del batch_chunks_with_paths, batch_embeddings
                        gc.collect()

                # Notify before ANN index finalization (happens when bulk_insert context exits)
                if progress_callback:
                    progress_callback(f"Finalizing index... Building ANN index for {total_chunks_created} chunks")

    except Exception as e:
        return {"success": False, "error": f"Failed to read or process files: {str(e)}"}

    elapsed_time = time.time() - start_time

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
    model_profile: str = "code",
    force: bool = False,
    chunk_size: int = 2000,
    progress_callback: Optional[callable] = None,
) -> Dict[str, any]:
    """Generate embeddings for all index databases in a project recursively.

    Args:
        index_root: Root index directory containing _index.db files
        model_profile: Model profile (fast, code, multilingual, balanced)
        force: If True, regenerate even if embeddings exist
        chunk_size: Maximum chunk size in characters
        progress_callback: Optional callback for progress updates

    Returns:
        Aggregated result dictionary with generation statistics
    """
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
            progress_callback(f"[{idx}/{len(index_files)}] Processing {rel_path}")

        result = generate_embeddings(
            index_path,
            model_profile=model_profile,
            force=force,
            chunk_size=chunk_size,
            progress_callback=None,  # Don't cascade callbacks
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
        Aggregated status with coverage statistics
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
            },
        }

    total_files = 0
    files_with_embeddings = 0
    total_chunks = 0
    indexes_with_embeddings = 0

    for index_path in index_files:
        status = check_index_embeddings(index_path)
        if status["success"]:
            result = status["result"]
            total_files += result["total_files"]
            files_with_embeddings += result["files_with_chunks"]
            total_chunks += result["total_chunks"]
            if result["has_embeddings"]:
                indexes_with_embeddings += 1

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
