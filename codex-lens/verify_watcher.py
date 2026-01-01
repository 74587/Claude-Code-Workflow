#!/usr/bin/env python3
"""Verification script for FileWatcher event filtering and debouncing."""

import time
from pathlib import Path
from codexlens.watcher.file_watcher import FileWatcher
from codexlens.watcher.events import WatcherConfig, FileEvent

def test_should_index_file():
    """Test _should_index_file filtering logic."""
    print("Testing _should_index_file filtering...")

    # Create watcher instance
    config = WatcherConfig()
    watcher = FileWatcher(
        root_path=Path("."),
        config=config,
        on_changes=lambda events: None,
    )

    # Test cases
    test_cases = [
        # (path, expected_result, description)
        (Path("test.py"), True, "Python file should be indexed"),
        (Path("test.txt"), True, "Text file should be indexed"),
        (Path("test.js"), True, "JavaScript file should be indexed"),
        (Path("test.ts"), True, "TypeScript file should be indexed"),
        (Path("src/test.py"), True, "Python file in subdirectory should be indexed"),
        (Path(".git/config"), False, ".git files should be filtered"),
        (Path("node_modules/pkg/index.js"), False, "node_modules should be filtered"),
        (Path("__pycache__/test.pyc"), False, "__pycache__ should be filtered"),
        (Path(".venv/lib/test.py"), False, ".venv should be filtered"),
        (Path("test.unknown"), False, "Unknown extension should be filtered"),
        (Path("README.md"), True, "Markdown file should be indexed"),
    ]

    passed = 0
    failed = 0

    for path, expected, description in test_cases:
        result = watcher._should_index_file(path)
        status = "✓" if result == expected else "✗"

        if result == expected:
            passed += 1
        else:
            failed += 1

        print(f"  {status} {description}")
        print(f"    Path: {path}, Expected: {expected}, Got: {result}")

    print(f"\nResults: {passed} passed, {failed} failed")
    return failed == 0

def test_debounce_and_dedup():
    """Test event debouncing and deduplication."""
    print("\nTesting event debouncing and deduplication...")

    received_events = []

    def on_changes(events):
        received_events.append(events)
        print(f"  Received batch: {len(events)} events")

    # Create watcher with short debounce time for testing
    config = WatcherConfig(debounce_ms=500)
    watcher = FileWatcher(
        root_path=Path("."),
        config=config,
        on_changes=on_changes,
    )

    # Simulate rapid events to same file (should be deduplicated)
    from codexlens.watcher.events import ChangeType

    test_path = Path("test_file.py")
    for i in range(5):
        event = FileEvent(
            path=test_path,
            change_type=ChangeType.MODIFIED,
            timestamp=time.time(),
        )
        watcher._on_raw_event(event)

    # Wait for debounce
    time.sleep(0.6)

    # Force flush to ensure we get the events
    watcher._flush_events()

    if received_events:
        batch = received_events[0]
        # Should deduplicate 5 events to 1
        if len(batch) == 1:
            print("  ✓ Deduplication working: 5 events reduced to 1")
            return True
        else:
            print(f"  ✗ Deduplication failed: expected 1 event, got {len(batch)}")
            return False
    else:
        print("  ✗ No events received")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("FileWatcher Verification")
    print("=" * 60)

    test1 = test_should_index_file()
    test2 = test_debounce_and_dedup()

    print("\n" + "=" * 60)
    if test1 and test2:
        print("✓ All tests passed!")
    else:
        print("✗ Some tests failed")
    print("=" * 60)
