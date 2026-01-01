"""File system watcher using watchdog library."""

from __future__ import annotations

import logging
import threading
import time
from pathlib import Path
from typing import Callable, Dict, List, Optional

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from .events import ChangeType, FileEvent, WatcherConfig
from ..config import Config

logger = logging.getLogger(__name__)


class _CodexLensHandler(FileSystemEventHandler):
    """Internal handler for watchdog events."""

    def __init__(
        self,
        watcher: "FileWatcher",
        on_event: Callable[[FileEvent], None],
    ) -> None:
        super().__init__()
        self._watcher = watcher
        self._on_event = on_event

    def on_created(self, event) -> None:
        if event.is_directory:
            return
        self._emit(event.src_path, ChangeType.CREATED)

    def on_modified(self, event) -> None:
        if event.is_directory:
            return
        self._emit(event.src_path, ChangeType.MODIFIED)

    def on_deleted(self, event) -> None:
        if event.is_directory:
            return
        self._emit(event.src_path, ChangeType.DELETED)

    def on_moved(self, event) -> None:
        if event.is_directory:
            return
        self._emit(event.dest_path, ChangeType.MOVED, old_path=event.src_path)

    def _emit(
        self,
        path: str,
        change_type: ChangeType,
        old_path: Optional[str] = None,
    ) -> None:
        path_obj = Path(path)

        # Filter out files that should not be indexed
        if not self._watcher._should_index_file(path_obj):
            return

        event = FileEvent(
            path=path_obj,
            change_type=change_type,
            timestamp=time.time(),
            old_path=Path(old_path) if old_path else None,
        )
        self._on_event(event)


class FileWatcher:
    """File system watcher for monitoring directory changes.

    Uses watchdog library for cross-platform file system monitoring.
    Events are forwarded to the on_changes callback.

    Example:
        def handle_changes(events: List[FileEvent]) -> None:
            for event in events:
                print(f"{event.change_type}: {event.path}")

        watcher = FileWatcher(Path("."), WatcherConfig(), handle_changes)
        watcher.start()
        watcher.wait()  # Block until stopped
    """

    def __init__(
        self,
        root_path: Path,
        config: WatcherConfig,
        on_changes: Callable[[List[FileEvent]], None],
    ) -> None:
        """Initialize file watcher.

        Args:
            root_path: Directory to watch recursively
            config: Watcher configuration
            on_changes: Callback invoked with batched events
        """
        self.root_path = Path(root_path).resolve()
        self.config = config
        self.on_changes = on_changes

        self._observer: Optional[Observer] = None
        self._running = False
        self._stop_event = threading.Event()
        self._lock = threading.RLock()

        # Event queue for batching
        self._event_queue: List[FileEvent] = []
        self._queue_lock = threading.Lock()

        # Debounce thread
        self._debounce_thread: Optional[threading.Thread] = None

        # Config instance for language checking
        self._codexlens_config = Config()

    def _should_index_file(self, path: Path) -> bool:
        """Check if file should be indexed based on extension and ignore patterns.

        Args:
            path: File path to check

        Returns:
            True if file should be indexed, False otherwise
        """
        # Check against ignore patterns
        parts = path.parts
        for pattern in self.config.ignored_patterns:
            if pattern in parts:
                return False

        # Check extension against supported languages
        language = self._codexlens_config.language_for_path(path)
        return language is not None

    def _on_raw_event(self, event: FileEvent) -> None:
        """Handle raw event from watchdog handler."""
        with self._queue_lock:
            self._event_queue.append(event)
        # Debouncing is handled by background thread

    def _debounce_loop(self) -> None:
        """Background thread for debounced event batching."""
        while self._running:
            time.sleep(self.config.debounce_ms / 1000.0)
            self._flush_events()

    def _flush_events(self) -> None:
        """Flush queued events with deduplication."""
        with self._queue_lock:
            if not self._event_queue:
                return

            # Deduplicate: keep latest event per path
            deduped: Dict[Path, FileEvent] = {}
            for event in self._event_queue:
                deduped[event.path] = event

            events = list(deduped.values())
            self._event_queue.clear()

        if events:
            try:
                self.on_changes(events)
            except Exception as exc:
                logger.error("Error in on_changes callback: %s", exc)

    def start(self) -> None:
        """Start watching the directory.

        Non-blocking. Use wait() to block until stopped.
        """
        with self._lock:
            if self._running:
                logger.warning("Watcher already running")
                return

            if not self.root_path.exists():
                raise ValueError(f"Root path does not exist: {self.root_path}")

            self._observer = Observer()
            handler = _CodexLensHandler(self, self._on_raw_event)
            self._observer.schedule(handler, str(self.root_path), recursive=True)

            self._running = True
            self._stop_event.clear()
            self._observer.start()

            # Start debounce thread
            self._debounce_thread = threading.Thread(
                target=self._debounce_loop,
                daemon=True,
                name="FileWatcher-Debounce",
            )
            self._debounce_thread.start()

            logger.info("Started watching: %s", self.root_path)

    def stop(self) -> None:
        """Stop watching the directory.

        Gracefully stops the observer and flushes remaining events.
        """
        with self._lock:
            if not self._running:
                return

            self._running = False
            self._stop_event.set()

            if self._observer:
                self._observer.stop()
                self._observer.join(timeout=5.0)
                self._observer = None

            # Wait for debounce thread to finish
            if self._debounce_thread and self._debounce_thread.is_alive():
                self._debounce_thread.join(timeout=2.0)
                self._debounce_thread = None

            # Flush any remaining events
            self._flush_events()

            logger.info("Stopped watching: %s", self.root_path)

    def wait(self) -> None:
        """Block until watcher is stopped.

        Use Ctrl+C or call stop() from another thread to unblock.
        """
        try:
            while self._running:
                self._stop_event.wait(timeout=1.0)
        except KeyboardInterrupt:
            logger.info("Received interrupt, stopping watcher...")
            self.stop()

    @property
    def is_running(self) -> bool:
        """Check if watcher is currently running."""
        return self._running
