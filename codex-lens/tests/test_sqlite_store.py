"""Tests for SQLiteStore connection pool behavior."""

from __future__ import annotations

import logging
import sqlite3
import threading
import time
from pathlib import Path

import pytest

from codexlens.entities import IndexedFile
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


def test_add_files_rollback_preserves_original_exception(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """add_files should re-raise the transaction error when rollback succeeds."""
    monkeypatch.setattr(SQLiteStore, "CLEANUP_INTERVAL", 0)
    store = SQLiteStore(tmp_path / "add_files_ok.db")
    store.initialize()

    real_conn = store._get_connection()

    class FailingConnection:
        def __init__(self, conn: sqlite3.Connection) -> None:
            self._conn = conn
            self.rollback_calls = 0

        def execute(self, sql: str, params: tuple = ()):
            if "INSERT INTO files" in sql:
                raise sqlite3.OperationalError("boom")
            return self._conn.execute(sql, params)

        def executemany(self, sql: str, seq):
            return self._conn.executemany(sql, seq)

        def commit(self) -> None:
            self._conn.commit()

        def rollback(self) -> None:
            self.rollback_calls += 1
            self._conn.rollback()

    wrapped = FailingConnection(real_conn)
    monkeypatch.setattr(store, "_get_connection", lambda: wrapped)

    indexed_file = IndexedFile(path=str(tmp_path / "a.py"), language="python", symbols=[])

    try:
        with pytest.raises(sqlite3.OperationalError, match="boom"):
            store.add_files([(indexed_file, "# content")])
        assert wrapped.rollback_calls == 1
    finally:
        store.close()


def test_add_files_rollback_failure_is_chained(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """Rollback failures should be logged and chained as the cause."""
    monkeypatch.setattr(SQLiteStore, "CLEANUP_INTERVAL", 0)
    caplog.set_level(logging.ERROR, logger="codexlens.storage.sqlite_store")

    store = SQLiteStore(tmp_path / "add_files_rollback_fail.db")
    store.initialize()
    real_conn = store._get_connection()

    class FailingRollbackConnection:
        def __init__(self, conn: sqlite3.Connection) -> None:
            self._conn = conn

        def execute(self, sql: str, params: tuple = ()):
            if "INSERT INTO files" in sql:
                raise sqlite3.OperationalError("boom")
            return self._conn.execute(sql, params)

        def executemany(self, sql: str, seq):
            return self._conn.executemany(sql, seq)

        def commit(self) -> None:
            self._conn.commit()

        def rollback(self) -> None:
            raise sqlite3.OperationalError("rollback boom")

    monkeypatch.setattr(store, "_get_connection", lambda: FailingRollbackConnection(real_conn))
    indexed_file = IndexedFile(path=str(tmp_path / "b.py"), language="python", symbols=[])

    try:
        with pytest.raises(sqlite3.OperationalError) as exc:
            store.add_files([(indexed_file, "# content")])

        assert exc.value.__cause__ is not None
        assert isinstance(exc.value.__cause__, sqlite3.OperationalError)
        assert "rollback boom" in str(exc.value.__cause__)
        assert "Rollback failed after add_files() error" in caplog.text
        assert "boom" in caplog.text
    finally:
        store.close()


class TestMultiVectorChunks:
    """Tests for multi-vector chunk storage operations."""

    def test_add_chunks_basic(self, tmp_path: Path) -> None:
        """Basic chunk insertion without embeddings."""
        store = SQLiteStore(tmp_path / "chunks_basic.db")
        store.initialize()

        try:
            chunks_data = [
                {"content": "def hello(): pass", "metadata": {"type": "function"}},
                {"content": "class World: pass", "metadata": {"type": "class"}},
            ]

            ids = store.add_chunks("test.py", chunks_data)

            assert len(ids) == 2
            assert ids == [1, 2]
            assert store.count_chunks() == 2
        finally:
            store.close()

    def test_add_chunks_with_binary_embeddings(self, tmp_path: Path) -> None:
        """Chunk insertion with binary embeddings for coarse ranking."""
        store = SQLiteStore(tmp_path / "chunks_binary.db")
        store.initialize()

        try:
            chunks_data = [
                {"content": "content1"},
                {"content": "content2"},
            ]
            # 256-bit binary = 32 bytes
            binary_embs = [b"\x00" * 32, b"\xff" * 32]

            ids = store.add_chunks(
                "test.py", chunks_data, embedding_binary=binary_embs
            )

            assert len(ids) == 2

            retrieved = store.get_binary_embeddings(ids)
            assert len(retrieved) == 2
            assert retrieved[ids[0]] == b"\x00" * 32
            assert retrieved[ids[1]] == b"\xff" * 32
        finally:
            store.close()

    def test_add_chunks_with_dense_embeddings(self, tmp_path: Path) -> None:
        """Chunk insertion with dense embeddings for fine ranking."""
        store = SQLiteStore(tmp_path / "chunks_dense.db")
        store.initialize()

        try:
            chunks_data = [{"content": "content1"}, {"content": "content2"}]
            # 2048 floats = 8192 bytes
            dense_embs = [b"\x00" * 8192, b"\xff" * 8192]

            ids = store.add_chunks(
                "test.py", chunks_data, embedding_dense=dense_embs
            )

            assert len(ids) == 2

            retrieved = store.get_dense_embeddings(ids)
            assert len(retrieved) == 2
            assert retrieved[ids[0]] == b"\x00" * 8192
            assert retrieved[ids[1]] == b"\xff" * 8192
        finally:
            store.close()

    def test_add_chunks_with_all_embeddings(self, tmp_path: Path) -> None:
        """Chunk insertion with all embedding types."""
        store = SQLiteStore(tmp_path / "chunks_all.db")
        store.initialize()

        try:
            chunks_data = [{"content": "full test"}]
            embedding = [[0.1, 0.2, 0.3]]
            binary_embs = [b"\xab" * 32]
            dense_embs = [b"\xcd" * 8192]

            ids = store.add_chunks(
                "test.py",
                chunks_data,
                embedding=embedding,
                embedding_binary=binary_embs,
                embedding_dense=dense_embs,
            )

            assert len(ids) == 1

            binary = store.get_binary_embeddings(ids)
            dense = store.get_dense_embeddings(ids)

            assert binary[ids[0]] == b"\xab" * 32
            assert dense[ids[0]] == b"\xcd" * 8192
        finally:
            store.close()

    def test_add_chunks_length_mismatch_raises(self, tmp_path: Path) -> None:
        """Mismatched embedding length should raise ValueError."""
        store = SQLiteStore(tmp_path / "chunks_mismatch.db")
        store.initialize()

        try:
            chunks_data = [{"content": "a"}, {"content": "b"}]

            with pytest.raises(ValueError, match="embedding_binary length"):
                store.add_chunks(
                    "test.py", chunks_data, embedding_binary=[b"\x00" * 32]
                )

            with pytest.raises(ValueError, match="embedding_dense length"):
                store.add_chunks(
                    "test.py", chunks_data, embedding_dense=[b"\x00" * 8192]
                )

            with pytest.raises(ValueError, match="embedding length"):
                store.add_chunks(
                    "test.py", chunks_data, embedding=[[0.1]]
                )
        finally:
            store.close()

    def test_get_chunks_by_ids(self, tmp_path: Path) -> None:
        """Retrieve chunk data by IDs."""
        store = SQLiteStore(tmp_path / "chunks_get.db")
        store.initialize()

        try:
            chunks_data = [
                {"content": "def foo(): pass", "metadata": {"line": 1}},
                {"content": "def bar(): pass", "metadata": {"line": 5}},
            ]

            ids = store.add_chunks("test.py", chunks_data)
            retrieved = store.get_chunks_by_ids(ids)

            assert len(retrieved) == 2
            assert retrieved[0]["content"] == "def foo(): pass"
            assert retrieved[0]["metadata"]["line"] == 1
            assert retrieved[1]["content"] == "def bar(): pass"
            assert retrieved[1]["file_path"] == "test.py"
        finally:
            store.close()

    def test_delete_chunks_by_file(self, tmp_path: Path) -> None:
        """Delete all chunks for a file."""
        store = SQLiteStore(tmp_path / "chunks_delete.db")
        store.initialize()

        try:
            store.add_chunks("a.py", [{"content": "a1"}, {"content": "a2"}])
            store.add_chunks("b.py", [{"content": "b1"}])

            assert store.count_chunks() == 3

            deleted = store.delete_chunks_by_file("a.py")
            assert deleted == 2
            assert store.count_chunks() == 1

            deleted = store.delete_chunks_by_file("nonexistent.py")
            assert deleted == 0
        finally:
            store.close()

    def test_get_embeddings_empty_list(self, tmp_path: Path) -> None:
        """Empty chunk ID list returns empty dict."""
        store = SQLiteStore(tmp_path / "chunks_empty.db")
        store.initialize()

        try:
            assert store.get_binary_embeddings([]) == {}
            assert store.get_dense_embeddings([]) == {}
            assert store.get_chunks_by_ids([]) == []
        finally:
            store.close()

    def test_add_chunks_empty_list(self, tmp_path: Path) -> None:
        """Empty chunks list returns empty IDs."""
        store = SQLiteStore(tmp_path / "chunks_empty_add.db")
        store.initialize()

        try:
            ids = store.add_chunks("test.py", [])
            assert ids == []
            assert store.count_chunks() == 0
        finally:
            store.close()

    def test_chunks_table_migration(self, tmp_path: Path) -> None:
        """Existing chunks table gets new columns via migration."""
        db_path = tmp_path / "chunks_migration.db"

        # Create old schema without multi-vector columns
        conn = sqlite3.connect(db_path)
        conn.execute(
            """
            CREATE TABLE chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute("CREATE INDEX idx_chunks_file_path ON chunks(file_path)")
        conn.execute(
            "INSERT INTO chunks (file_path, content) VALUES ('old.py', 'old content')"
        )
        conn.commit()
        conn.close()

        # Open with SQLiteStore - should migrate
        store = SQLiteStore(db_path)
        store.initialize()

        try:
            # Verify new columns exist by using them
            ids = store.add_chunks(
                "new.py",
                [{"content": "new content"}],
                embedding_binary=[b"\x00" * 32],
                embedding_dense=[b"\x00" * 8192],
            )

            assert len(ids) == 1

            # Old data should still be accessible
            assert store.count_chunks() == 2

            # New embeddings should work
            binary = store.get_binary_embeddings(ids)
            assert binary[ids[0]] == b"\x00" * 32
        finally:
            store.close()
