"""Path mapping utilities for source paths and index paths.

This module provides bidirectional mapping between source code directories
and their corresponding index storage locations.

Storage Structure:
    ~/.codexlens/
    ├── registry.db                    # Global mapping table
    └── indexes/
        └── D/
            └── Claude_dms3/
                ├── _index.db          # Root directory index
                └── src/
                    └── _index.db      # src/ directory index
"""

import json
import os
import platform
from pathlib import Path
from typing import Optional


def _get_configured_index_root() -> Path:
    """Get the index root from environment or config file.

    Priority order:
    1. CODEXLENS_INDEX_DIR environment variable
    2. index_dir from ~/.codexlens/config.json
    3. Default: ~/.codexlens/indexes
    """
    env_override = os.getenv("CODEXLENS_INDEX_DIR")
    if env_override:
        return Path(env_override).expanduser().resolve()

    config_file = Path.home() / ".codexlens" / "config.json"
    if config_file.exists():
        try:
            cfg = json.loads(config_file.read_text(encoding="utf-8"))
            if "index_dir" in cfg:
                return Path(cfg["index_dir"]).expanduser().resolve()
        except (json.JSONDecodeError, OSError):
            pass

    return Path.home() / ".codexlens" / "indexes"


class PathMapper:
    """Bidirectional mapping tool for source paths ↔ index paths.

    Handles cross-platform path normalization and conversion between
    source code directories and their index storage locations.

    Attributes:
        DEFAULT_INDEX_ROOT: Default root directory for all indexes
        INDEX_DB_NAME: Standard name for index database files
        index_root: Configured index root directory
    """

    DEFAULT_INDEX_ROOT = _get_configured_index_root()
    INDEX_DB_NAME = "_index.db"

    def __init__(self, index_root: Optional[Path] = None):
        """Initialize PathMapper with optional custom index root.

        Args:
            index_root: Custom index root directory. If None, uses DEFAULT_INDEX_ROOT.
        """
        self.index_root = (index_root or self.DEFAULT_INDEX_ROOT).resolve()

    def source_to_index_dir(self, source_path: Path) -> Path:
        """Convert source directory to its index directory path.

        Maps a source code directory to where its index data should be stored.
        The mapping preserves the directory structure but normalizes paths
        for cross-platform compatibility.

        Args:
            source_path: Source directory path to map

        Returns:
            Index directory path under index_root

        Examples:
            >>> mapper = PathMapper()
            >>> mapper.source_to_index_dir(Path("D:/Claude_dms3/src"))
            PosixPath('/home/user/.codexlens/indexes/D/Claude_dms3/src')

            >>> mapper.source_to_index_dir(Path("/home/user/project"))
            PosixPath('/home/user/.codexlens/indexes/home/user/project')
        """
        source_path = source_path.resolve()
        normalized = self.normalize_path(source_path)
        return self.index_root / normalized

    def source_to_index_db(self, source_path: Path) -> Path:
        """Convert source directory to its index database file path.

        Maps a source directory to the full path of its index database file,
        including the standard INDEX_DB_NAME.

        Args:
            source_path: Source directory path to map

        Returns:
            Full path to the index database file

        Examples:
            >>> mapper = PathMapper()
            >>> mapper.source_to_index_db(Path("D:/Claude_dms3/src"))
            PosixPath('/home/user/.codexlens/indexes/D/Claude_dms3/src/_index.db')
        """
        index_dir = self.source_to_index_dir(source_path)
        return index_dir / self.INDEX_DB_NAME

    def index_to_source(self, index_path: Path) -> Path:
        """Convert index path back to original source path.

        Performs reverse mapping from an index storage location to the
        original source directory. Handles both directory paths and
        database file paths.

        Args:
            index_path: Index directory or database file path

        Returns:
            Original source directory path

        Raises:
            ValueError: If index_path is not under index_root

        Examples:
            >>> mapper = PathMapper()
            >>> mapper.index_to_source(
            ...     Path("~/.codexlens/indexes/D/Claude_dms3/src/_index.db")
            ... )
            WindowsPath('D:/Claude_dms3/src')

            >>> mapper.index_to_source(
            ...     Path("~/.codexlens/indexes/D/Claude_dms3/src")
            ... )
            WindowsPath('D:/Claude_dms3/src')
        """
        index_path = index_path.resolve()

        # Remove _index.db if present
        if index_path.name == self.INDEX_DB_NAME:
            index_path = index_path.parent

        # Verify path is under index_root
        try:
            relative = index_path.relative_to(self.index_root)
        except ValueError:
            raise ValueError(
                f"Index path {index_path} is not under index root {self.index_root}"
            )

        # Convert normalized path back to source path
        normalized_str = str(relative).replace("\\", "/")
        return self.denormalize_path(normalized_str)

    def get_project_root(self, source_path: Path) -> Path:
        """Find the project root directory (topmost indexed directory).

        Walks up the directory tree to find the highest-level directory
        that has an index database.

        Args:
            source_path: Source directory to start from

        Returns:
            Project root directory path. Returns source_path itself if
            no parent index is found.

        Examples:
            >>> mapper = PathMapper()
            >>> mapper.get_project_root(Path("D:/Claude_dms3/src/codexlens"))
            WindowsPath('D:/Claude_dms3')
        """
        source_path = source_path.resolve()
        current = source_path
        project_root = source_path

        # Walk up the tree
        while current.parent != current:  # Stop at filesystem root
            parent_index_db = self.source_to_index_db(current.parent)
            if parent_index_db.exists():
                project_root = current.parent
                current = current.parent
            else:
                break

        return project_root

    def get_relative_depth(self, source_path: Path, project_root: Path) -> int:
        """Calculate directory depth relative to project root.

        Args:
            source_path: Target directory path
            project_root: Project root directory path

        Returns:
            Number of directory levels from project_root to source_path

        Raises:
            ValueError: If source_path is not under project_root

        Examples:
            >>> mapper = PathMapper()
            >>> mapper.get_relative_depth(
            ...     Path("D:/Claude_dms3/src/codexlens"),
            ...     Path("D:/Claude_dms3")
            ... )
            2
        """
        source_path = source_path.resolve()
        project_root = project_root.resolve()

        try:
            relative = source_path.relative_to(project_root)
            # Count path components
            return len(relative.parts)
        except ValueError:
            raise ValueError(
                f"Source path {source_path} is not under project root {project_root}"
            )

    def normalize_path(self, path: Path) -> str:
        """Normalize path to cross-platform storage format.

        Converts OS-specific paths to a standardized format for storage:
        - Windows: Removes drive colons (D: → D)
        - Unix: Removes leading slash
        - Uses forward slashes throughout

        Args:
            path: Path to normalize

        Returns:
            Normalized path string

        Examples:
            >>> mapper = PathMapper()
            >>> mapper.normalize_path(Path("D:/path/to/dir"))
            'D/path/to/dir'

            >>> mapper.normalize_path(Path("/home/user/path"))
            'home/user/path'
        """
        path = path.resolve()
        path_str = str(path)

        # Handle Windows paths with drive letters
        if platform.system() == "Windows" and len(path.parts) > 0:
            # Convert D:\path\to\dir → D/path/to/dir
            drive = path.parts[0].replace(":", "")  # D: → D
            rest = Path(*path.parts[1:]) if len(path.parts) > 1 else Path()
            normalized = f"{drive}/{rest}".replace("\\", "/")
            return normalized.rstrip("/")

        # Handle Unix paths
        # /home/user/path → home/user/path
        return path_str.lstrip("/").replace("\\", "/")

    def denormalize_path(self, normalized: str) -> Path:
        """Convert normalized path back to OS-specific path.

        Reverses the normalization process to restore OS-native path format:
        - Windows: Adds drive colons (D → D:)
        - Unix: Adds leading slash

        Args:
            normalized: Normalized path string

        Returns:
            OS-specific Path object

        Examples:
            >>> mapper = PathMapper()
            >>> mapper.denormalize_path("D/path/to/dir")  # On Windows
            WindowsPath('D:/path/to/dir')

            >>> mapper.denormalize_path("home/user/path")  # On Unix
            PosixPath('/home/user/path')
        """
        parts = normalized.split("/")

        # Handle Windows paths
        if platform.system() == "Windows" and len(parts) > 0:
            # Check if first part is a drive letter
            if len(parts[0]) == 1 and parts[0].isalpha():
                # D/path/to/dir → D:/path/to/dir
                drive = f"{parts[0]}:"
                if len(parts) > 1:
                    return Path(drive) / Path(*parts[1:])
                return Path(drive)

        # Handle Unix paths or relative paths
        # home/user/path → /home/user/path
        return Path("/") / Path(*parts)
