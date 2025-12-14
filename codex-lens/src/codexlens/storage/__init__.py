"""Storage backends for CodexLens."""

from __future__ import annotations

from .sqlite_store import SQLiteStore
from .path_mapper import PathMapper
from .registry import RegistryStore, ProjectInfo, DirMapping
from .dir_index import DirIndexStore, SubdirLink, FileEntry
from .index_tree import IndexTreeBuilder, BuildResult, DirBuildResult

__all__ = [
    # Legacy (workspace-local)
    "SQLiteStore",
    # Path mapping
    "PathMapper",
    # Global registry
    "RegistryStore",
    "ProjectInfo",
    "DirMapping",
    # Directory index
    "DirIndexStore",
    "SubdirLink",
    "FileEntry",
    # Tree builder
    "IndexTreeBuilder",
    "BuildResult",
    "DirBuildResult",
]

