#!/usr/bin/env python3
"""Generate vector embeddings for existing CodexLens indexes.

This script processes all files in a CodexLens index database and generates
semantic vector embeddings for code chunks. The embeddings are stored in the
same SQLite database in the 'semantic_chunks' table.

Performance optimizations:
- Parallel file processing using ProcessPoolExecutor
- Batch embedding generation for efficient GPU/CPU utilization
- Batch database writes to minimize I/O overhead
- HNSW index auto-generation for fast similarity search

Requirements:
    pip install codexlens[semantic]
    # or
    pip install fastembed numpy hnswlib

Usage:
    # Generate embeddings for a single index
    python generate_embeddings.py /path/to/_index.db

    # Generate embeddings with parallel processing
    python generate_embeddings.py /path/to/_index.db --workers 4

    # Use specific embedding model and batch size
    python generate_embeddings.py /path/to/_index.db --model code --batch-size 256

    # Generate embeddings for all indexes in a directory
    python generate_embeddings.py --scan ~/.codexlens/indexes
"""

import argparse
import logging
import multiprocessing
import os
import sqlite3
import sys
import time
from concurrent.futures import ProcessPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


@dataclass
class FileData:
    """Data for a single file to process."""
    full_path: str
    content: str
    language: str


@dataclass
class ChunkData:
    """Processed chunk data ready for embedding."""
    file_path: str
    content: str
    metadata: dict


def check_dependencies():
    """Check if semantic search dependencies are available."""
    try:
        from codexlens.semantic import SEMANTIC_AVAILABLE
        if not SEMANTIC_AVAILABLE:
            logger.error("Semantic search dependencies not available")
            logger.error("Install with: pip install codexlens[semantic]")
            logger.error("Or: pip install fastembed numpy hnswlib")
            return False
        return True
    except ImportError as exc:
        logger.error(f"Failed to import codexlens: {exc}")
        logger.error("Make sure codexlens is installed: pip install codexlens")
        return False


def count_files(index_db_path: Path) -> int:
    """Count total files in index."""
    try:
        with sqlite3.connect(index_db_path) as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM files")
            return cursor.fetchone()[0]
    except Exception as exc:
        logger.error(f"Failed to count files: {exc}")
        return 0


def check_existing_chunks(index_db_path: Path) -> int:
    """Check if semantic chunks already exist."""
    try:
        with sqlite3.connect(index_db_path) as conn:
            # Check if table exists
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='semantic_chunks'"
            )
            if not cursor.fetchone():
                return 0

            # Count existing chunks
            cursor = conn.execute("SELECT COUNT(*) FROM semantic_chunks")
            return cursor.fetchone()[0]
    except Exception:
        return 0


def process_file_worker(args: Tuple[str, str, str, int]) -> List[ChunkData]:
    """Worker function to process a single file (runs in separate process).

    Args:
        args: Tuple of (file_path, content, language, chunk_size)

    Returns:
        List of ChunkData objects
    """
    file_path, content, language, chunk_size = args

    try:
        from codexlens.semantic.chunker import Chunker, ChunkConfig

        chunker = Chunker(config=ChunkConfig(max_chunk_size=chunk_size))
        chunks = chunker.chunk_sliding_window(
            content,
            file_path=file_path,
            language=language
        )

        return [
            ChunkData(
                file_path=file_path,
                content=chunk.content,
                metadata=chunk.metadata or {}
            )
            for chunk in chunks
        ]
    except Exception as exc:
        logger.debug(f"Error processing {file_path}: {exc}")
        return []


def generate_embeddings_for_index(
    index_db_path: Path,
    model_profile: str = "code",
    force: bool = False,
    chunk_size: int = 2000,
    workers: int = 0,
    batch_size: int = 256,
) -> dict:
    """Generate embeddings for all files in an index.

    Performance optimizations:
    - Parallel file processing (chunking)
    - Batch embedding generation
    - Batch database writes
    - HNSW index auto-generation

    Args:
        index_db_path: Path to _index.db file
        model_profile: Model profile to use (fast, code, multilingual, balanced)
        force: If True, regenerate even if embeddings exist
        chunk_size: Maximum chunk size in characters
        workers: Number of parallel workers (0 = auto-detect CPU count)
        batch_size: Batch size for embedding generation

    Returns:
        Dictionary with generation statistics
    """
    logger.info(f"Processing index: {index_db_path}")

    # Check existing chunks
    existing_chunks = check_existing_chunks(index_db_path)
    if existing_chunks > 0 and not force:
        logger.warning(f"Index already has {existing_chunks} chunks")
        logger.warning("Use --force to regenerate")
        return {
            "success": False,
            "error": "Embeddings already exist",
            "existing_chunks": existing_chunks,
        }

    if force and existing_chunks > 0:
        logger.info(f"Force mode: clearing {existing_chunks} existing chunks")
        try:
            with sqlite3.connect(index_db_path) as conn:
                conn.execute("DELETE FROM semantic_chunks")
                conn.commit()
            # Also remove HNSW index file
            hnsw_path = index_db_path.parent / "_vectors.hnsw"
            if hnsw_path.exists():
                hnsw_path.unlink()
                logger.info("Removed existing HNSW index")
        except Exception as exc:
            logger.error(f"Failed to clear existing data: {exc}")

    # Import dependencies
    try:
        from codexlens.semantic.embedder import Embedder
        from codexlens.semantic.vector_store import VectorStore
        from codexlens.entities import SemanticChunk
    except ImportError as exc:
        return {
            "success": False,
            "error": f"Import failed: {exc}",
        }

    # Initialize components
    try:
        embedder = Embedder(profile=model_profile)
        vector_store = VectorStore(index_db_path)

        logger.info(f"Using model: {embedder.model_name}")
        logger.info(f"Embedding dimension: {embedder.embedding_dim}")
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed to initialize components: {exc}",
        }

    # Read files from index
    try:
        with sqlite3.connect(index_db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute("SELECT full_path, content, language FROM files")
            files = [
                FileData(
                    full_path=row["full_path"],
                    content=row["content"],
                    language=row["language"] or "python"
                )
                for row in cursor.fetchall()
            ]
    except Exception as exc:
        return {
            "success": False,
            "error": f"Failed to read files: {exc}",
        }

    logger.info(f"Found {len(files)} files to process")
    if len(files) == 0:
        return {
            "success": False,
            "error": "No files found in index",
        }

    # Determine worker count
    if workers <= 0:
        workers = min(multiprocessing.cpu_count(), len(files), 8)
    logger.info(f"Using {workers} worker(s) for parallel processing")
    logger.info(f"Batch size for embeddings: {batch_size}")

    start_time = time.time()

    # Phase 1: Parallel chunking
    logger.info("Phase 1: Chunking files...")
    chunk_start = time.time()

    all_chunks: List[ChunkData] = []
    failed_files = []

    # Prepare work items
    work_items = [
        (f.full_path, f.content, f.language, chunk_size)
        for f in files
    ]

    if workers == 1:
        # Single-threaded for debugging
        for i, item in enumerate(work_items, 1):
            try:
                chunks = process_file_worker(item)
                all_chunks.extend(chunks)
                if i % 100 == 0:
                    logger.info(f"Chunked {i}/{len(files)} files ({len(all_chunks)} chunks)")
            except Exception as exc:
                failed_files.append((item[0], str(exc)))
    else:
        # Parallel processing
        with ProcessPoolExecutor(max_workers=workers) as executor:
            futures = {
                executor.submit(process_file_worker, item): item[0]
                for item in work_items
            }

            completed = 0
            for future in as_completed(futures):
                file_path = futures[future]
                completed += 1
                try:
                    chunks = future.result()
                    all_chunks.extend(chunks)
                    if completed % 100 == 0:
                        logger.info(
                            f"Chunked {completed}/{len(files)} files "
                            f"({len(all_chunks)} chunks)"
                        )
                except Exception as exc:
                    failed_files.append((file_path, str(exc)))

    chunk_time = time.time() - chunk_start
    logger.info(f"Chunking completed in {chunk_time:.1f}s: {len(all_chunks)} chunks")

    if not all_chunks:
        return {
            "success": False,
            "error": "No chunks created from files",
            "files_processed": len(files) - len(failed_files),
            "files_failed": len(failed_files),
        }

    # Phase 2: Batch embedding generation
    logger.info("Phase 2: Generating embeddings...")
    embed_start = time.time()

    # Extract all content for batch embedding
    all_contents = [c.content for c in all_chunks]

    # Generate embeddings in batches
    all_embeddings = []
    for i in range(0, len(all_contents), batch_size):
        batch_contents = all_contents[i:i + batch_size]
        batch_embeddings = embedder.embed(batch_contents)
        all_embeddings.extend(batch_embeddings)

        progress = min(i + batch_size, len(all_contents))
        if progress % (batch_size * 4) == 0 or progress == len(all_contents):
            logger.info(f"Generated embeddings: {progress}/{len(all_contents)}")

    embed_time = time.time() - embed_start
    logger.info(f"Embedding completed in {embed_time:.1f}s")

    # Phase 3: Batch database write
    logger.info("Phase 3: Storing chunks...")
    store_start = time.time()

    # Create SemanticChunk objects with embeddings
    semantic_chunks_with_paths = []
    for chunk_data, embedding in zip(all_chunks, all_embeddings):
        semantic_chunk = SemanticChunk(
            content=chunk_data.content,
            metadata=chunk_data.metadata,
        )
        semantic_chunk.embedding = embedding
        semantic_chunks_with_paths.append((semantic_chunk, chunk_data.file_path))

    # Batch write (handles both SQLite and HNSW)
    write_batch_size = 1000
    total_stored = 0
    for i in range(0, len(semantic_chunks_with_paths), write_batch_size):
        batch = semantic_chunks_with_paths[i:i + write_batch_size]
        vector_store.add_chunks_batch(batch)
        total_stored += len(batch)
        if total_stored % 5000 == 0 or total_stored == len(semantic_chunks_with_paths):
            logger.info(f"Stored: {total_stored}/{len(semantic_chunks_with_paths)} chunks")

    store_time = time.time() - store_start
    logger.info(f"Storage completed in {store_time:.1f}s")

    elapsed_time = time.time() - start_time

    # Generate summary
    logger.info("=" * 60)
    logger.info(f"Completed in {elapsed_time:.1f}s")
    logger.info(f"  Chunking: {chunk_time:.1f}s")
    logger.info(f"  Embedding: {embed_time:.1f}s")
    logger.info(f"  Storage: {store_time:.1f}s")
    logger.info(f"Total chunks created: {len(all_chunks)}")
    logger.info(f"Files processed: {len(files) - len(failed_files)}/{len(files)}")
    if vector_store.ann_available:
        logger.info(f"HNSW index vectors: {vector_store.ann_count}")
    if failed_files:
        logger.warning(f"Failed files: {len(failed_files)}")
        for file_path, error in failed_files[:5]:  # Show first 5 failures
            logger.warning(f"  {file_path}: {error}")

    return {
        "success": True,
        "chunks_created": len(all_chunks),
        "files_processed": len(files) - len(failed_files),
        "files_failed": len(failed_files),
        "elapsed_time": elapsed_time,
        "chunk_time": chunk_time,
        "embed_time": embed_time,
        "store_time": store_time,
        "ann_vectors": vector_store.ann_count if vector_store.ann_available else 0,
    }


def find_index_databases(scan_dir: Path) -> List[Path]:
    """Find all _index.db files in directory tree."""
    logger.info(f"Scanning for indexes in: {scan_dir}")
    index_files = list(scan_dir.rglob("_index.db"))
    logger.info(f"Found {len(index_files)} index databases")
    return index_files


def main():
    parser = argparse.ArgumentParser(
        description="Generate vector embeddings for CodexLens indexes",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    parser.add_argument(
        "index_path",
        type=Path,
        help="Path to _index.db file or directory to scan"
    )

    parser.add_argument(
        "--scan",
        action="store_true",
        help="Scan directory tree for all _index.db files"
    )

    parser.add_argument(
        "--model",
        type=str,
        default="code",
        choices=["fast", "code", "multilingual", "balanced"],
        help="Embedding model profile (default: code)"
    )

    parser.add_argument(
        "--chunk-size",
        type=int,
        default=2000,
        help="Maximum chunk size in characters (default: 2000)"
    )

    parser.add_argument(
        "--workers",
        type=int,
        default=0,
        help="Number of parallel workers for chunking (default: auto-detect CPU count)"
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=256,
        help="Batch size for embedding generation (default: 256)"
    )

    parser.add_argument(
        "--force",
        action="store_true",
        help="Regenerate embeddings even if they exist"
    )

    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose logging"
    )

    args = parser.parse_args()

    # Configure logging level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # Check dependencies
    if not check_dependencies():
        sys.exit(1)

    # Resolve path
    index_path = args.index_path.expanduser().resolve()

    if not index_path.exists():
        logger.error(f"Path not found: {index_path}")
        sys.exit(1)

    # Determine if scanning or single file
    if args.scan or index_path.is_dir():
        # Scan mode
        if index_path.is_file():
            logger.error("--scan requires a directory path")
            sys.exit(1)

        index_files = find_index_databases(index_path)
        if not index_files:
            logger.error(f"No index databases found in: {index_path}")
            sys.exit(1)

        # Process each index
        total_chunks = 0
        successful = 0
        for idx, index_file in enumerate(index_files, 1):
            logger.info(f"\n{'='*60}")
            logger.info(f"Processing index {idx}/{len(index_files)}")
            logger.info(f"{'='*60}")

            result = generate_embeddings_for_index(
                index_file,
                model_profile=args.model,
                force=args.force,
                chunk_size=args.chunk_size,
                workers=args.workers,
                batch_size=args.batch_size,
            )

            if result["success"]:
                total_chunks += result["chunks_created"]
                successful += 1

        # Final summary
        logger.info(f"\n{'='*60}")
        logger.info("BATCH PROCESSING COMPLETE")
        logger.info(f"{'='*60}")
        logger.info(f"Indexes processed: {successful}/{len(index_files)}")
        logger.info(f"Total chunks created: {total_chunks}")

    else:
        # Single index mode
        if not index_path.name.endswith("_index.db"):
            logger.error("File must be named '_index.db'")
            sys.exit(1)

        result = generate_embeddings_for_index(
            index_path,
            model_profile=args.model,
            force=args.force,
            chunk_size=args.chunk_size,
            workers=args.workers,
            batch_size=args.batch_size,
        )

        if not result["success"]:
            logger.error(f"Failed: {result.get('error', 'Unknown error')}")
            sys.exit(1)

    logger.info("\n✓ Embeddings generation complete!")
    logger.info("\nYou can now use vector search:")
    logger.info("  codexlens search 'your query' --mode pure-vector")


if __name__ == "__main__":
    main()
