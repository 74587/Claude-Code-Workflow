"""File watcher module for real-time index updates."""

from .events import ChangeType, FileEvent, IndexResult, WatcherConfig, WatcherStats
from .file_watcher import FileWatcher
from .incremental_indexer import IncrementalIndexer
from .manager import WatcherManager

__all__ = [
    "ChangeType",
    "FileEvent",
    "IndexResult",
    "WatcherConfig",
    "WatcherStats",
    "FileWatcher",
    "IncrementalIndexer",
    "WatcherManager",
]
