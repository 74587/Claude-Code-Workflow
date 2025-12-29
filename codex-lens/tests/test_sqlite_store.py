"""Tests for SQLiteStore connection pool behavior."""

from __future__ import annotations

import threading
import time
from pathlib import Path

import pytest

from codexlens.storage.sqlite_store import SQLiteStore


def test_periodic_cleanup(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Periodic timer should proactively clean up stale thread connections."""
    monkeypatch.setattr(SQLiteStore, "CLEANUP_INTERVAL", 0.2)

    store = SQLiteStore(tmp_path / "periodic_cleanup.db")
    store.initialize()

    cleanup_called = threading.Event()
    original_cleanup = store._cleanup_stale_connections

    def wrapped_cleanup() -> None:
        cleanup_called.set()
        original_cleanup()

    monkeypatch.setattr(store, "_cleanup_stale_connections", wrapped_cleanup)

    created: list[int] = []
    lock = threading.Lock()
    main_tid = threading.get_ident()

    def worker() -> None:
        store._get_connection()
        with lock:
            created.append(threading.get_ident())

    try:
        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Ensure we created thread-local connections without reaching MAX_POOL_SIZE.
        assert len(store._pool) >= 2
        assert all(tid in store._pool for tid in created)

        # Wait for periodic cleanup to run and prune dead thread connections.
        assert cleanup_called.wait(timeout=3)
        deadline = time.time() + 3
        while time.time() < deadline and any(tid in store._pool for tid in created):
            time.sleep(0.05)

        assert all(tid not in store._pool for tid in created)
        assert set(store._pool.keys()).issubset({main_tid})
    finally:
        store.close()


