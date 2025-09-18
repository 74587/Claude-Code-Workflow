#!/usr/bin/env python3
"""
File Indexer Module for UltraThink Path-Aware Analyzer
Builds and maintains an index of repository files with metadata.
Enhanced with gitignore support and unified configuration.
"""

import os
import hashlib
import json
import time
import logging
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Union
from dataclasses import dataclass, asdict
from datetime import datetime
import fnmatch

from .gitignore_parser import GitignoreParser

@dataclass
class FileInfo:
    """Information about a single file in the repository."""
    path: str
    relative_path: str
    size: int
    modified_time: float
    extension: str
    category: str  # code, docs, config, web
    estimated_tokens: int
    content_hash: str

    def to_dict(self) -> Dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: Dict) -> 'FileInfo':
        return cls(**data)

@dataclass
class IndexStats:
    """Statistics about the file index."""
    total_files: int
    total_tokens: int
    total_size: int
    categories: Dict[str, int]
    last_updated: float

    def to_dict(self) -> Dict:
        return asdict(self)

class FileIndexer:
    """Builds and maintains an efficient index of repository files."""

    def __init__(self, config: Union['Config', Dict], root_path: str = "."):
        # Support both Config object and Dict for backward compatibility
        if hasattr(config, 'to_dict'):
            self.config_obj = config
            self.config = config.to_dict()
        else:
            self.config_obj = None
            self.config = config

        self.root_path = Path(root_path).resolve()
        self.cache_dir = Path(self.config.get('embedding', {}).get('cache_dir', '.claude/cache'))
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.cache_dir / "file_index.json"

        # Setup logging
        self.logger = logging.getLogger(__name__)

        # File extension mappings
        self.extension_categories = self._build_extension_map()

        # Exclude patterns from config
        self.exclude_patterns = list(self.config.get('exclude_patterns', []))

        # Initialize gitignore parser and add patterns
        self.gitignore_parser = GitignoreParser(str(self.root_path))
        self._load_gitignore_patterns()

        # Performance settings
        self.max_file_size = self.config.get('performance', {}).get('max_file_size', 10485760)

    def _build_extension_map(self) -> Dict[str, str]:
        """Build mapping from file extensions to categories."""
        ext_map = {}
        for category, extensions in self.config.get('file_extensions', {}).items():
            for ext in extensions:
                ext_map[ext.lower()] = category
        return ext_map

    def _load_gitignore_patterns(self):
        """Load patterns from .gitignore files and add to exclude_patterns."""
        try:
            gitignore_patterns = self.gitignore_parser.parse_all_gitignores()

            if gitignore_patterns:
                # Avoid duplicates
                existing_patterns = set(self.exclude_patterns)
                new_patterns = [p for p in gitignore_patterns if p not in existing_patterns]

                self.exclude_patterns.extend(new_patterns)
                self.logger.info(f"Added {len(new_patterns)} patterns from .gitignore files")

        except Exception as e:
            self.logger.warning(f"Failed to load .gitignore patterns: {e}")

    def _should_exclude_file(self, file_path: Path) -> bool:
        """Check if file should be excluded based on patterns and gitignore rules."""
        relative_path = str(file_path.relative_to(self.root_path))

        # Check against exclude patterns from config
        for pattern in self.exclude_patterns:
            # Convert pattern to work with fnmatch
            if fnmatch.fnmatch(relative_path, pattern) or fnmatch.fnmatch(str(file_path), pattern):
                return True

            # Check if any parent directory matches
            parts = relative_path.split(os.sep)
            for i in range(len(parts)):
                partial_path = "/".join(parts[:i+1])
                if fnmatch.fnmatch(partial_path, pattern):
                    return True

        # Also check gitignore rules using dedicated parser
        # Note: gitignore patterns are already included in self.exclude_patterns
        # but we can add additional gitignore-specific checking here if needed
        try:
            # The gitignore patterns are already loaded into exclude_patterns,
            # but we can do additional gitignore-specific checks if needed
            pass
        except Exception as e:
            self.logger.debug(f"Error in gitignore checking for {file_path}: {e}")

        return False

    def _estimate_tokens(self, file_path: Path) -> int:
        """Estimate token count for a file (chars/4 approximation)."""
        try:
            if file_path.stat().st_size > self.max_file_size:
                return file_path.stat().st_size // 8  # Penalty for large files

            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                return len(content) // 4  # Rough approximation
        except (UnicodeDecodeError, OSError):
            # Binary files or unreadable files
            return file_path.stat().st_size // 8

    def _get_file_hash(self, file_path: Path) -> str:
        """Get a hash of file metadata for change detection."""
        stat = file_path.stat()
        return hashlib.md5(f"{file_path}:{stat.st_size}:{stat.st_mtime}".encode()).hexdigest()

    def _categorize_file(self, file_path: Path) -> str:
        """Categorize file based on extension."""
        extension = file_path.suffix.lower()
        return self.extension_categories.get(extension, 'other')

    def _scan_file(self, file_path: Path) -> Optional[FileInfo]:
        """Scan a single file and create FileInfo."""
        try:
            if not file_path.is_file() or self._should_exclude_file(file_path):
                return None

            stat = file_path.stat()
            relative_path = str(file_path.relative_to(self.root_path))

            file_info = FileInfo(
                path=str(file_path),
                relative_path=relative_path,
                size=stat.st_size,
                modified_time=stat.st_mtime,
                extension=file_path.suffix.lower(),
                category=self._categorize_file(file_path),
                estimated_tokens=self._estimate_tokens(file_path),
                content_hash=self._get_file_hash(file_path)
            )

            return file_info

        except (OSError, PermissionError) as e:
            self.logger.warning(f"Could not scan file {file_path}: {e}")
            return None

    def build_index(self, force_rebuild: bool = False) -> Dict[str, FileInfo]:
        """Build or update the file index."""
        self.logger.info(f"Building file index for {self.root_path}")

        # Load existing index if available
        existing_index = {}
        if not force_rebuild and self.index_file.exists():
            existing_index = self.load_index()

        new_index = {}
        changed_files = 0

        # Walk through all files
        for file_path in self.root_path.rglob('*'):
            if not file_path.is_file():
                continue

            file_info = self._scan_file(file_path)
            if file_info is None:
                continue

            # Check if file has changed
            relative_path = file_info.relative_path
            if relative_path in existing_index:
                old_info = existing_index[relative_path]
                if old_info.content_hash == file_info.content_hash:
                    # File unchanged, keep old info
                    new_index[relative_path] = old_info
                    continue

            # File is new or changed
            new_index[relative_path] = file_info
            changed_files += 1

        self.logger.info(f"Indexed {len(new_index)} files ({changed_files} new/changed)")

        # Save index
        self.save_index(new_index)

        return new_index

    def load_index(self) -> Dict[str, FileInfo]:
        """Load file index from cache."""
        if not self.index_file.exists():
            return {}

        try:
            with open(self.index_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                index = {}
                for path, info_dict in data.get('files', {}).items():
                    index[path] = FileInfo.from_dict(info_dict)
                return index
        except (json.JSONDecodeError, KeyError) as e:
            self.logger.warning(f"Could not load index: {e}")
            return {}

    def save_index(self, index: Dict[str, FileInfo]) -> None:
        """Save file index to cache."""
        try:
            # Calculate stats
            stats = self._calculate_stats(index)

            data = {
                'stats': stats.to_dict(),
                'files': {path: info.to_dict() for path, info in index.items()}
            }

            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)

        except OSError as e:
            self.logger.error(f"Could not save index: {e}")

    def _calculate_stats(self, index: Dict[str, FileInfo]) -> IndexStats:
        """Calculate statistics for the index."""
        total_files = len(index)
        total_tokens = sum(info.estimated_tokens for info in index.values())
        total_size = sum(info.size for info in index.values())

        categories = {}
        for info in index.values():
            categories[info.category] = categories.get(info.category, 0) + 1

        return IndexStats(
            total_files=total_files,
            total_tokens=total_tokens,
            total_size=total_size,
            categories=categories,
            last_updated=time.time()
        )

    def get_stats(self) -> Optional[IndexStats]:
        """Get statistics about the current index."""
        if not self.index_file.exists():
            return None

        try:
            with open(self.index_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return IndexStats(**data.get('stats', {}))
        except (json.JSONDecodeError, KeyError):
            return None

    def find_files_by_pattern(self, pattern: str, index: Optional[Dict[str, FileInfo]] = None) -> List[FileInfo]:
        """Find files matching a glob pattern."""
        if index is None:
            index = self.load_index()

        matching_files = []
        for path, info in index.items():
            if fnmatch.fnmatch(path, pattern) or fnmatch.fnmatch(info.path, pattern):
                matching_files.append(info)

        return matching_files

    def find_files_by_category(self, category: str, index: Optional[Dict[str, FileInfo]] = None) -> List[FileInfo]:
        """Find files by category (code, docs, config, etc.)."""
        if index is None:
            index = self.load_index()

        return [info for info in index.values() if info.category == category]

    def find_files_by_keywords(self, keywords: List[str], index: Optional[Dict[str, FileInfo]] = None) -> List[FileInfo]:
        """Find files whose paths contain any of the specified keywords."""
        if index is None:
            index = self.load_index()

        matching_files = []
        keywords_lower = [kw.lower() for kw in keywords]

        for info in index.values():
            path_lower = info.relative_path.lower()
            if any(keyword in path_lower for keyword in keywords_lower):
                matching_files.append(info)

        return matching_files

    def get_recent_files(self, limit: int = 20, index: Optional[Dict[str, FileInfo]] = None) -> List[FileInfo]:
        """Get most recently modified files."""
        if index is None:
            index = self.load_index()

        files = list(index.values())
        files.sort(key=lambda f: f.modified_time, reverse=True)
        return files[:limit]

def main():
    """Command-line interface for file indexer."""
    import yaml
    import argparse

    parser = argparse.ArgumentParser(description="File Indexer for UltraThink")
    parser.add_argument("--config", default="config.yaml", help="Configuration file path")
    parser.add_argument("--rebuild", action="store_true", help="Force rebuild index")
    parser.add_argument("--stats", action="store_true", help="Show index statistics")
    parser.add_argument("--pattern", help="Find files matching pattern")

    args = parser.parse_args()

    # Load configuration
    config_path = Path(__file__).parent / args.config
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)

    # Setup logging
    logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

    # Create indexer
    indexer = FileIndexer(config)

    if args.stats:
        stats = indexer.get_stats()
        if stats:
            print(f"Total files: {stats.total_files}")
            print(f"Total tokens: {stats.total_tokens:,}")
            print(f"Total size: {stats.total_size:,} bytes")
            print(f"Categories: {stats.categories}")
            print(f"Last updated: {datetime.fromtimestamp(stats.last_updated)}")
        else:
            print("No index found. Run without --stats to build index.")
        return

    # Build index
    index = indexer.build_index(force_rebuild=args.rebuild)

    if args.pattern:
        files = indexer.find_files_by_pattern(args.pattern, index)
        print(f"Found {len(files)} files matching pattern '{args.pattern}':")
        for file_info in files[:20]:  # Limit output
            print(f"  {file_info.relative_path}")
    else:
        stats = indexer._calculate_stats(index)
        print(f"Index built: {stats.total_files} files, ~{stats.total_tokens:,} tokens")

if __name__ == "__main__":
    main()