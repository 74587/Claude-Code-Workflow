#!/usr/bin/env python3
"""Generate vector embeddings for existing CodexLens indexes.

This script processes all files in a CodexLens index database and generates
semantic vector embeddings for code chunks. The embeddings are stored in the
same SQLite database in the 'semantic_chunks' table.

Requirements:
    pip install codexlens[semantic]
    # or
    pip install fastembed numpy

Usage:
    # Generate embeddings for a single index
    python generate_embeddings.py /path/to/_index.db

    # Generate embeddings for all indexes in a directory
    python generate_embeddings.py --scan ~/.codexlens/indexes

    # Use specific embedding model
    python generate_embeddings.py /path/to/_index.db --model code

    # Batch processing with progress
    find ~/.codexlens/indexes -name "_index.db" | xargs -I {} python generate_embeddings.py {}
"""

import argparse
import logging
import sqlite3
import sys
import time
from pathlib import Path
from typing import List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)


def check_dependencies():
    """Check if semantic search dependencies are available."""
    try:
        from codexlens.semantic import SEMANTIC_AVAILABLE
        if not SEMANTIC_AVAILABLE:
            logger.error("Semantic search dependencies not available")
            logger.error("Install with: pip install codexlens[semantic]")
            logger.error("Or: pip install fastembed numpy")
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


def generate_embeddings_for_index(
    index_db_path: Path,
    model_profile: str = "code",
    force: bool = False,
    chunk_size: int = 2000,
) -> dict:
    """Generate embeddings for all files in an index.

    Args:
        index_db_path: Path to _index.db file
        model_profile: Model profile to use (fast, code, multilingual, balanced)
        force: If True, regenerate even if embeddings exist
        chunk_size: Maximum chunk size in characters

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
        except Exception as exc:
            logger.error(f"Failed to clear existing chunks: {exc}")

    # Import dependencies
    try:
        from codexlens.semantic.embedder import Embedder
        from codexlens.semantic.vector_store import VectorStore
        from codexlens.semantic.chunker import Chunker, ChunkConfig
    except ImportError as exc:
        return {
            "success": False,
            "error": f"Import failed: {exc}",
        }

    # Initialize components
    try:
        embedder = Embedder(profile=model_profile)
        vector_store = VectorStore(index_db_path)
        chunker = Chunker(config=ChunkConfig(max_chunk_size=chunk_size))

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
            files = cursor.fetchall()
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

    # Process each file
    total_chunks = 0
    failed_files = []
    start_time = time.time()

    for idx, file_row in enumerate(files, 1):
        file_path = file_row["full_path"]
        content = file_row["content"]
        language = file_row["language"] or "python"

        try:
            # Create chunks using sliding window
            chunks = chunker.chunk_sliding_window(
                content,
                file_path=file_path,
                language=language
            )

            if not chunks:
                logger.debug(f"[{idx}/{len(files)}] {file_path}: No chunks created")
                continue

            # Generate embeddings
            for chunk in chunks:
                embedding = embedder.embed_single(chunk.content)
                chunk.embedding = embedding

            # Store chunks
            vector_store.add_chunks(chunks, file_path)
            total_chunks += len(chunks)

            logger.info(f"[{idx}/{len(files)}] {file_path}: {len(chunks)} chunks")

        except Exception as exc:
            logger.error(f"[{idx}/{len(files)}] {file_path}: ERROR - {exc}")
            failed_files.append((file_path, str(exc)))

    elapsed_time = time.time() - start_time

    # Generate summary
    logger.info("=" * 60)
    logger.info(f"Completed in {elapsed_time:.1f}s")
    logger.info(f"Total chunks created: {total_chunks}")
    logger.info(f"Files processed: {len(files) - len(failed_files)}/{len(files)}")
    if failed_files:
        logger.warning(f"Failed files: {len(failed_files)}")
        for file_path, error in failed_files[:5]:  # Show first 5 failures
            logger.warning(f"  {file_path}: {error}")

    return {
        "success": True,
        "chunks_created": total_chunks,
        "files_processed": len(files) - len(failed_files),
        "files_failed": len(failed_files),
        "elapsed_time": elapsed_time,
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
        )

        if not result["success"]:
            logger.error(f"Failed: {result.get('error', 'Unknown error')}")
            sys.exit(1)

    logger.info("\n✓ Embeddings generation complete!")
    logger.info("\nYou can now use vector search:")
    logger.info("  codexlens search 'your query' --mode pure-vector")


if __name__ == "__main__":
    main()
