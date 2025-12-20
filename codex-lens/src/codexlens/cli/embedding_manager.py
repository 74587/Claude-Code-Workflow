"""Embedding Manager - Manage semantic embeddings for code indexes."""

import logging
import sqlite3
import time
from pathlib import Path
from typing import Dict, List, Optional

try:
    from codexlens.semantic import SEMANTIC_AVAILABLE
    if SEMANTIC_AVAILABLE:
        from codexlens.semantic.embedder import Embedder, get_embedder
        from codexlens.semantic.vector_store import VectorStore
        from codexlens.semantic.chunker import Chunker, ChunkConfig
except ImportError:
    SEMANTIC_AVAILABLE = False

logger = logging.getLogger(__name__)


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
            cursor = conn.execute("""
                SELECT full_path
                FROM files
                WHERE full_path NOT IN (
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
    """Generate embeddings for an index.

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
        # Use cached embedder (singleton) for performance
        embedder = get_embedder(profile=model_profile)
        vector_store = VectorStore(index_path)
        chunker = Chunker(config=ChunkConfig(max_chunk_size=chunk_size))

        if progress_callback:
            progress_callback(f"Using model: {embedder.model_name} ({embedder.embedding_dim} dimensions)")

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to initialize components: {str(e)}",
        }

    # Read files from index
    try:
        with sqlite3.connect(index_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT full_path, content, language FROM files")
            files = cursor.fetchall()
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to read files: {str(e)}",
        }

    if len(files) == 0:
        return {
            "success": False,
            "error": "No files found in index",
        }

    if progress_callback:
        progress_callback(f"Processing {len(files)} files...")

    # Process all files using batch operations for optimal performance
    start_time = time.time()
    failed_files = []

    # --- OPTIMIZATION Step 1: Collect all chunks from all files ---
    if progress_callback:
        progress_callback(f"Step 1/4: Chunking {len(files)} files...")

    all_chunks_with_paths = []  # List of (chunk, file_path) tuples
    files_with_chunks = set()

    for idx, file_row in enumerate(files, 1):
        file_path = file_row["full_path"]
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
                    all_chunks_with_paths.append((chunk, file_path))
                files_with_chunks.add(file_path)
        except Exception as e:
            logger.error(f"Failed to chunk {file_path}: {e}")
            failed_files.append((file_path, str(e)))

    if not all_chunks_with_paths:
        elapsed_time = time.time() - start_time
        return {
            "success": True,
            "result": {
                "chunks_created": 0,
                "files_processed": len(files) - len(failed_files),
                "files_failed": len(failed_files),
                "elapsed_time": elapsed_time,
                "model_profile": model_profile,
                "model_name": embedder.model_name,
                "failed_files": failed_files[:5],
                "index_path": str(index_path),
            },
        }

    total_chunks = len(all_chunks_with_paths)

    # --- OPTIMIZATION Step 2: Batch generate embeddings with memory-safe batching ---
    # Use smaller batches to avoid OOM errors while still benefiting from batch processing
    # jina-embeddings-v2-base-code with long chunks needs small batches
    BATCH_SIZE = 8  # Conservative batch size for memory efficiency

    if progress_callback:
        num_batches = (total_chunks + BATCH_SIZE - 1) // BATCH_SIZE
        progress_callback(f"Step 2/4: Generating embeddings for {total_chunks} chunks ({num_batches} batches)...")

    try:
        all_embeddings = []
        for batch_start in range(0, total_chunks, BATCH_SIZE):
            batch_end = min(batch_start + BATCH_SIZE, total_chunks)
            batch_contents = [chunk.content for chunk, _ in all_chunks_with_paths[batch_start:batch_end]]
            batch_embeddings = embedder.embed(batch_contents)
            all_embeddings.extend(batch_embeddings)

            if progress_callback and total_chunks > BATCH_SIZE:
                progress_callback(f"  Batch {batch_start // BATCH_SIZE + 1}/{(total_chunks + BATCH_SIZE - 1) // BATCH_SIZE}: {len(batch_embeddings)} embeddings")
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to generate embeddings: {str(e)}",
        }

    # --- OPTIMIZATION Step 3: Assign embeddings back to chunks ---
    if progress_callback:
        progress_callback(f"Step 3/4: Assigning {len(all_embeddings)} embeddings...")

    for (chunk, _), embedding in zip(all_chunks_with_paths, all_embeddings):
        chunk.embedding = embedding

    # --- OPTIMIZATION Step 4: Batch store all chunks in single transaction ---
    if progress_callback:
        progress_callback(f"Step 4/4: Storing {total_chunks} chunks to database...")

    try:
        vector_store.add_chunks_batch(all_chunks_with_paths)
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to store chunks: {str(e)}",
        }

    elapsed_time = time.time() - start_time

    return {
        "success": True,
        "result": {
            "chunks_created": total_chunks,
            "files_processed": len(files_with_chunks),
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
