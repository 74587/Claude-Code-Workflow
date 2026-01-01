"""Tests for FileWatcher class."""

from __future__ import annotations

import time
from pathlib import Path
from typing import List

import pytest

from codexlens.watcher import FileWatcher, WatcherConfig, FileEvent, ChangeType


class TestFileWatcherInit:
    """Tests for FileWatcher initialization."""
    
    def test_init_with_valid_path(self, temp_project: Path, watcher_config: WatcherConfig):
        """Test initializing with valid path."""
        events: List[FileEvent] = []
        watcher = FileWatcher(temp_project, watcher_config, lambda e: events.extend(e))
        
        assert watcher.root_path == temp_project.resolve()
        assert watcher.config == watcher_config
        assert not watcher.is_running
    
    def test_start_with_invalid_path(self, watcher_config: WatcherConfig):
        """Test starting watcher with non-existent path."""
        events: List[FileEvent] = []
        watcher = FileWatcher(Path("/nonexistent/path"), watcher_config, lambda e: events.extend(e))
        
        with pytest.raises(ValueError, match="does not exist"):
            watcher.start()


class TestFileWatcherLifecycle:
    """Tests for FileWatcher start/stop lifecycle."""
    
    def test_start_stop(self, temp_project: Path, watcher_config: WatcherConfig):
        """Test basic start and stop."""
        events: List[FileEvent] = []
        watcher = FileWatcher(temp_project, watcher_config, lambda e: events.extend(e))
        
        watcher.start()
        assert watcher.is_running
        
        watcher.stop()
        assert not watcher.is_running
    
    def test_double_start(self, temp_project: Path, watcher_config: WatcherConfig):
        """Test calling start twice."""
        events: List[FileEvent] = []
        watcher = FileWatcher(temp_project, watcher_config, lambda e: events.extend(e))
        
        watcher.start()
        watcher.start()  # Should not raise
        assert watcher.is_running
        
        watcher.stop()
    
    def test_double_stop(self, temp_project: Path, watcher_config: WatcherConfig):
        """Test calling stop twice."""
        events: List[FileEvent] = []
        watcher = FileWatcher(temp_project, watcher_config, lambda e: events.extend(e))
        
        watcher.start()
        watcher.stop()
        watcher.stop()  # Should not raise
        assert not watcher.is_running


class TestFileWatcherEvents:
    """Tests for FileWatcher event detection."""
    
    def test_detect_file_creation(self, temp_project: Path, watcher_config: WatcherConfig):
        """Test detecting new file creation."""
        events: List[FileEvent] = []
        watcher = FileWatcher(temp_project, watcher_config, lambda e: events.extend(e))

        try:
            watcher.start()
            time.sleep(0.3)  # Let watcher start (longer for Windows)

            # Create new file
            new_file = temp_project / "new_file.py"
            new_file.write_text("# New file\n")

            # Wait for event with retries (watchdog timing varies by platform)
            max_wait = 2.0
            waited = 0.0
            while waited < max_wait:
                time.sleep(0.2)
                waited += 0.2
                # Windows may report MODIFIED instead of CREATED
                file_events = [e for e in events if e.change_type in (ChangeType.CREATED, ChangeType.MODIFIED)]
                if any(e.path.name == "new_file.py" for e in file_events):
                    break

            # Check event was detected (Windows may report MODIFIED instead of CREATED)
            relevant_events = [e for e in events if e.change_type in (ChangeType.CREATED, ChangeType.MODIFIED)]
            assert len(relevant_events) >= 1, f"Expected file event, got: {events}"
            assert any(e.path.name == "new_file.py" for e in relevant_events)
        finally:
            watcher.stop()
    
    def test_filter_ignored_directories(self, temp_project: Path, watcher_config: WatcherConfig):
        """Test that files in ignored directories are filtered."""
        events: List[FileEvent] = []
        watcher = FileWatcher(temp_project, watcher_config, lambda e: events.extend(e))
        
        try:
            watcher.start()
            time.sleep(0.1)
            
            # Create file in .git (should be ignored)
            git_file = temp_project / ".git" / "test.py"
            git_file.write_text("# In git\n")
            
            time.sleep(watcher_config.debounce_ms / 1000.0 + 0.2)
            
            # No events should be detected for .git files
            git_events = [e for e in events if ".git" in str(e.path)]
            assert len(git_events) == 0
        finally:
            watcher.stop()
