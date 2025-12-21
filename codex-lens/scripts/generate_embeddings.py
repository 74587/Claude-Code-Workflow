#!/usr/bin/env python3
"""Generate vector embeddings for existing CodexLens indexes.

This script is a CLI wrapper around the memory-efficient streaming implementation
in codexlens.cli.embedding_manager. It uses batch processing to keep memory usage
under 2GB regardless of project size.

Requirements:
    pip install codexlens[semantic]
    # or
    pip install fastembed numpy hnswlib

Usage:
    # Generate embeddings for a single index
    python generate_embeddings.py /path/to/_index.db

    # Use specific embedding model
    python generate_embeddings.py /path/to/_index.db --model code

    # Generate embeddings for all indexes in a directory
    python generate_embeddings.py --scan ~/.codexlens/indexes

    # Force regeneration
    python generate_embeddings.py /path/to/_index.db --force
"""

import argparse
import logging
import sys
from pathlib import Path
from typing import List

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%H:%M:%S'
)
logger = logging.getLogger(__name__)

# Import the memory-efficient implementation
try:
    from codexlens.cli.embedding_manager import (
        generate_embeddings,
        generate_embeddings_recursive,
    )
    from codexlens.semantic import SEMANTIC_AVAILABLE
except ImportError as exc:
    logger.error(f"Failed to import codexlens: {exc}")
    logger.error("Make sure codexlens is installed: pip install codexlens")
    SEMANTIC_AVAILABLE = False


def check_dependencies():
    """Check if semantic search dependencies are available."""
    if not SEMANTIC_AVAILABLE:
        logger.error("Semantic search dependencies not available")
        logger.error("Install with: pip install codexlens[semantic]")
        logger.error("Or: pip install fastembed numpy hnswlib")
        return False
    return True


def progress_callback(message: str):
    """Callback function for progress updates."""
    logger.info(message)


def generate_embeddings_for_index(
    index_db_path: Path,
    model_profile: str = "code",
    force: bool = False,
    chunk_size: int = 2000,
    **kwargs  # Ignore unused parameters (workers, batch_size) for backward compatibility
) -> dict:
    """Generate embeddings for an index using memory-efficient streaming.

    This function wraps the streaming implementation from embedding_manager
    to maintain CLI compatibility while using the memory-optimized approach.

    Args:
        index_db_path: Path to _index.db file
        model_profile: Model profile to use (fast, code, multilingual, balanced)
        force: If True, regenerate even if embeddings exist
        chunk_size: Maximum chunk size in characters
        **kwargs: Additional parameters (ignored for compatibility)

    Returns:
        Dictionary with generation statistics
    """
    logger.info(f"Processing index: {index_db_path}")

    # Call the memory-efficient streaming implementation
    result = generate_embeddings(
        index_path=index_db_path,
        model_profile=model_profile,
        force=force,
        chunk_size=chunk_size,
        progress_callback=progress_callback,
    )

    if not result["success"]:
        if "error" in result:
            logger.error(result["error"])
        return result

    # Extract result data and log summary
    data = result["result"]
    logger.info("=" * 60)
    logger.info(f"Completed in {data['elapsed_time']:.1f}s")
    logger.info(f"Total chunks created: {data['chunks_created']}")
    logger.info(f"Files processed: {data['files_processed']}")
    if data['files_failed'] > 0:
        logger.warning(f"Failed files: {data['files_failed']}")
        if data.get('failed_files'):
            for file_path, error in data['failed_files']:
                logger.warning(f"  {file_path}: {error}")

    return {
        "success": True,
        "chunks_created": data["chunks_created"],
        "files_processed": data["files_processed"],
        "files_failed": data["files_failed"],
        "elapsed_time": data["elapsed_time"],
    }


def main():
    parser = argparse.ArgumentParser(
        description="Generate vector embeddings for CodexLens indexes (memory-efficient streaming)",
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
        help="(Deprecated) Kept for backward compatibility, ignored"
    )

    parser.add_argument(
        "--batch-size",
        type=int,
        default=256,
        help="(Deprecated) Kept for backward compatibility, ignored"
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
        # Scan mode - use recursive implementation
        if index_path.is_file():
            logger.error("--scan requires a directory path")
            sys.exit(1)

        result = generate_embeddings_recursive(
            index_root=index_path,
            model_profile=args.model,
            force=args.force,
            chunk_size=args.chunk_size,
            progress_callback=progress_callback,
        )

        if not result["success"]:
            logger.error(f"Failed: {result.get('error', 'Unknown error')}")
            sys.exit(1)

        # Log summary
        data = result["result"]
        logger.info(f"\n{'='*60}")
        logger.info("BATCH PROCESSING COMPLETE")
        logger.info(f"{'='*60}")
        logger.info(f"Indexes processed: {data['indexes_successful']}/{data['indexes_processed']}")
        logger.info(f"Total chunks created: {data['total_chunks_created']}")
        logger.info(f"Total files processed: {data['total_files_processed']}")
        if data['total_files_failed'] > 0:
            logger.warning(f"Total files failed: {data['total_files_failed']}")

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
