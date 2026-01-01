"""Tests for watcher event types."""

from __future__ import annotations

import time
from pathlib import Path

import pytest

from codexlens.watcher import ChangeType, FileEvent, WatcherConfig, IndexResult, WatcherStats


class TestChangeType:
    """Tests for ChangeType enum."""
    
    def test_change_types_exist(self):
        """Verify all change types are defined."""
        assert ChangeType.CREATED.value == "created"
        assert ChangeType.MODIFIED.value == "modified"
        assert ChangeType.DELETED.value == "deleted"
        assert ChangeType.MOVED.value == "moved"
    
    def test_change_type_count(self):
        """Verify we have exactly 4 change types."""
        assert len(ChangeType) == 4


class TestFileEvent:
    """Tests for FileEvent dataclass."""
    
    def test_create_event(self):
        """Test creating a file event."""
        event = FileEvent(
            path=Path("/test/file.py"),
            change_type=ChangeType.CREATED,
            timestamp=time.time(),
        )
        assert event.path == Path("/test/file.py")
        assert event.change_type == ChangeType.CREATED
        assert event.old_path is None
    
    def test_moved_event(self):
        """Test creating a moved event with old_path."""
        event = FileEvent(
            path=Path("/test/new.py"),
            change_type=ChangeType.MOVED,
            timestamp=time.time(),
            old_path=Path("/test/old.py"),
        )
        assert event.old_path == Path("/test/old.py")


class TestWatcherConfig:
    """Tests for WatcherConfig dataclass."""
    
    def test_default_config(self):
        """Test default configuration values."""
        config = WatcherConfig()
        assert config.debounce_ms == 1000
        assert ".git" in config.ignored_patterns
        assert "node_modules" in config.ignored_patterns
        assert "__pycache__" in config.ignored_patterns
        assert config.languages is None
    
    def test_custom_debounce(self):
        """Test custom debounce setting."""
        config = WatcherConfig(debounce_ms=500)
        assert config.debounce_ms == 500


class TestIndexResult:
    """Tests for IndexResult dataclass."""
    
    def test_default_result(self):
        """Test default result values."""
        result = IndexResult()
        assert result.files_indexed == 0
        assert result.files_removed == 0
        assert result.symbols_added == 0
        assert result.errors == []
    
    def test_custom_result(self):
        """Test creating result with values."""
        result = IndexResult(
            files_indexed=5,
            files_removed=2,
            symbols_added=50,
            errors=["error1"],
        )
        assert result.files_indexed == 5
        assert result.files_removed == 2


class TestWatcherStats:
    """Tests for WatcherStats dataclass."""
    
    def test_default_stats(self):
        """Test default stats values."""
        stats = WatcherStats()
        assert stats.files_watched == 0
        assert stats.events_processed == 0
        assert stats.last_event_time is None
        assert stats.is_running is False
