"""Tests for SQLiteStore connection pool behavior."""

from __future__ import annotations

import logging
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


def test_cleanup_robustness(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture, tmp_path: Path
) -> None:
    """Cleanup should handle dead threads, idle timeouts, and invalid connections."""
    monkeypatch.setattr(SQLiteStore, "CLEANUP_INTERVAL", 0)
    caplog.set_level(logging.DEBUG, logger="codexlens.storage.sqlite_store")

    store = SQLiteStore(tmp_path / "cleanup_robustness.db")
    store.initialize()

    try:
        # Invalid connection: active thread but pooled connection is already closed.
        conn = store._get_connection()
        conn.close()
        with store._pool_lock:
            store._pool[threading.get_ident()] = (conn, time.time())
            store._cleanup_stale_connections()

        assert "invalid_connection" in caplog.text
        assert threading.get_ident() not in store._pool

        # Ensure next access recreates a working connection after cleanup.
        fresh_conn = store._get_connection()
        assert fresh_conn is not conn

        # Idle timeout cleanup should be logged distinctly.
        with store._pool_lock:
            store._pool[threading.get_ident()] = (fresh_conn, time.time() - store.IDLE_TIMEOUT - 1)
            store._cleanup_stale_connections()

        assert "idle_timeout" in caplog.text
        assert threading.get_ident() not in store._pool

        # Dead thread cleanup should be logged distinctly.
        created: list[int] = []

        def worker() -> None:
            store._get_connection()
            created.append(threading.get_ident())

        t = threading.Thread(target=worker)
        t.start()
        t.join()

        dead_tid = created[0]
        assert dead_tid in store._pool
        with store._pool_lock:
            store._cleanup_stale_connections()

        assert "dead_thread" in caplog.text
        assert dead_tid not in store._pool
    finally:
        store.close()

