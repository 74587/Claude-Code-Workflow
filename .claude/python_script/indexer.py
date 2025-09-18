#!/usr/bin/env python3
"""
File Structure Indexer
Builds and maintains file indices for intelligent analysis.
"""

import sys
import argparse
import logging
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from core.config import get_config
from core.file_indexer import FileIndexer, IndexStats
from core.embedding_manager import EmbeddingManager
from utils.colors import Colors


class ProjectIndexer:
    """Manages file indexing and project statistics."""

    def __init__(self, config_path: Optional[str] = None, root_path: str = "."):
        self.root_path = Path(root_path).resolve()
        self.config = get_config(config_path)

        # Setup logging
        logging.basicConfig(
            level=getattr(logging, self.config.get('logging.level', 'INFO')),
            format=self.config.get('logging.format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        )
        self.logger = logging.getLogger(__name__)

        # Initialize core components
        self.indexer = FileIndexer(self.config, str(self.root_path))

        # Initialize embedding manager if enabled
        self.embedding_manager = None
        if self.config.is_embedding_enabled():
            try:
                self.embedding_manager = EmbeddingManager(self.config)
            except ImportError:
                self.logger.warning("Embedding dependencies not available. Install sentence-transformers for enhanced functionality.")

    def build_index(self) -> IndexStats:
        """Build or update the file index."""
        print(Colors.yellow("Building file index..."))
        start_time = time.time()

        self.indexer.build_index()
        stats = self.indexer.get_stats()

        elapsed = time.time() - start_time
        if stats:
            print(Colors.green(f"Index built: {stats.total_files} files, ~{stats.total_tokens:,} tokens ({elapsed:.2f}s)"))
        else:
            print(Colors.green(f"Index built successfully ({elapsed:.2f}s)"))

        return stats

    def update_embeddings(self) -> bool:
        """Update embeddings for semantic similarity."""
        if not self.embedding_manager:
            print(Colors.error("Embedding functionality not available"))
            return False

        print(Colors.yellow("Updating embeddings..."))
        start_time = time.time()

        # Load file index
        index = self.indexer.load_index()
        if not index:
            print(Colors.warning("No file index found. Building index first..."))
            self.build_index()
            index = self.indexer.load_index()

        try:
            count = self.embedding_manager.update_embeddings(index)
            elapsed = time.time() - start_time
            print(Colors.green(f"Updated {count} embeddings ({elapsed:.2f}s)"))
            return True
        except Exception as e:
            print(Colors.error(f"Failed to update embeddings: {e}"))
            return False

    def get_project_stats(self) -> Dict[str, Any]:
        """Get comprehensive project statistics."""
        stats = self.indexer.get_stats()
        embedding_stats = {}

        if self.embedding_manager:
            embedding_stats = {
                'embeddings_exist': self.embedding_manager.embeddings_exist(),
                'embedding_count': len(self.embedding_manager._load_embedding_cache()) if self.embedding_manager.embeddings_exist() else 0
            }

        project_size = self._classify_project_size(stats.total_tokens if stats else 0)

        return {
            'files': stats.total_files if stats else 0,
            'tokens': stats.total_tokens if stats else 0,
            'size_bytes': stats.total_size if stats else 0,
            'categories': stats.categories if stats else {},
            'project_size': project_size,
            'last_updated': stats.last_updated if stats else 0,
            'embeddings': embedding_stats,
            'config': {
                'cache_dir': self.config.get_cache_dir(),
                'embedding_enabled': self.config.is_embedding_enabled(),
                'exclude_patterns_count': len(self.config.get_exclude_patterns())
            }
        }

    def _classify_project_size(self, tokens: int) -> str:
        """Classify project size based on token count."""
        small_limit = self.config.get('token_limits.small_project', 500000)
        medium_limit = self.config.get('token_limits.medium_project', 2000000)

        if tokens < small_limit:
            return "small"
        elif tokens < medium_limit:
            return "medium"
        else:
            return "large"

    def cleanup_cache(self):
        """Clean up old cache files."""
        cache_dir = Path(self.config.get_cache_dir())
        if cache_dir.exists():
            print(Colors.yellow("Cleaning up cache..."))
            for file in cache_dir.glob("*"):
                if file.is_file():
                    file.unlink()
                    print(f"Removed: {file}")
            print(Colors.green("Cache cleaned"))


def main():
    """CLI entry point for indexer."""
    parser = argparse.ArgumentParser(
        description="Project File Indexer - Build and manage file indices",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python indexer.py --build           # Build file index
  python indexer.py --stats           # Show project statistics
  python indexer.py --embeddings      # Update embeddings
  python indexer.py --cleanup         # Clean cache
        """
    )

    parser.add_argument('--build', action='store_true', help='Build file index')
    parser.add_argument('--stats', action='store_true', help='Show project statistics')
    parser.add_argument('--embeddings', action='store_true', help='Update embeddings')
    parser.add_argument('--cleanup', action='store_true', help='Clean up cache files')
    parser.add_argument('--output', choices=['json', 'text'], default='text', help='Output format')
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--root', default='.', help='Root directory to analyze')

    args = parser.parse_args()

    # Require at least one action
    if not any([args.build, args.stats, args.embeddings, args.cleanup]):
        parser.error("At least one action is required: --build, --stats, --embeddings, or --cleanup")

    # Create indexer
    indexer = ProjectIndexer(args.config, args.root)

    try:
        if args.cleanup:
            indexer.cleanup_cache()

        if args.build:
            indexer.build_index()

        if args.embeddings:
            indexer.update_embeddings()

        if args.stats:
            stats = indexer.get_project_stats()
            if args.output == 'json':
                print(json.dumps(stats, indent=2, default=str))
            else:
                print(f"Total files: {stats['files']}")
                print(f"Total tokens: {stats['tokens']:,}")
                print(f"Project size: {stats['project_size']}")
                print(f"Categories: {stats['categories']}")
                if 'embeddings' in stats:
                    print(f"Embeddings: {stats['embeddings']['embedding_count']}")

    except KeyboardInterrupt:
        print(Colors.warning("\nOperation interrupted by user"))
        sys.exit(1)
    except Exception as e:
        print(Colors.error(f"Operation failed: {e}"))
        sys.exit(1)


if __name__ == "__main__":
    main()