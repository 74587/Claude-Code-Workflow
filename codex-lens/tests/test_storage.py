"""Tests for CodexLens storage."""

import sqlite3
import pytest
import tempfile
from pathlib import Path

from codexlens.storage.sqlite_store import SQLiteStore
from codexlens.entities import IndexedFile, Symbol


@pytest.fixture
def temp_db():
    """Create a temporary database for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        store = SQLiteStore(db_path)
        store.initialize()
        yield store
        store.close()


class TestSQLiteStore:
    """Tests for SQLiteStore."""

    def test_initialize(self, temp_db):
        """Test database initialization."""
        stats = temp_db.stats()
        assert stats["files"] == 0
        assert stats["symbols"] == 0

    def test_fts_uses_external_content(self, temp_db):
        """FTS should be configured as external-content to avoid duplication."""
        conn = temp_db._get_connection()
        row = conn.execute(
            "SELECT sql FROM sqlite_master WHERE type='table' AND name='files_fts'"
        ).fetchone()
        assert row is not None
        assert "content='files'" in row["sql"] or "content=files" in row["sql"]

    def test_add_file(self, temp_db):
        """Test adding a file to the index."""
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[
                Symbol(name="hello", kind="function", range=(1, 1)),
            ],
            chunks=[],
        )
        temp_db.add_file(indexed_file, "def hello():\n    pass")
        
        stats = temp_db.stats()
        assert stats["files"] == 1
        assert stats["symbols"] == 1

    def test_remove_file(self, temp_db):
        """Test removing a file from the index."""
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[],
            chunks=[],
        )
        temp_db.add_file(indexed_file, "# test")
        
        assert temp_db.file_exists("/test/file.py")
        assert temp_db.remove_file("/test/file.py")
        assert not temp_db.file_exists("/test/file.py")

    def test_search_fts(self, temp_db):
        """Test FTS search."""
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[],
            chunks=[],
        )
        temp_db.add_file(indexed_file, "def hello_world():\n    print('hello')")
        
        results = temp_db.search_fts("hello")
        assert len(results) == 1
        assert str(Path("/test/file.py").resolve()) == results[0].path

    def test_search_symbols(self, temp_db):
        """Test symbol search."""
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[
                Symbol(name="hello_world", kind="function", range=(1, 1)),
                Symbol(name="goodbye", kind="function", range=(3, 3)),
            ],
            chunks=[],
        )
        temp_db.add_file(indexed_file, "def hello_world():\n    pass\ndef goodbye():\n    pass")
        
        results = temp_db.search_symbols("hello")
        assert len(results) == 1
        assert results[0].name == "hello_world"

    def test_connection_reuse(self, temp_db):
        """Test that connections are reused within the same thread."""
        conn1 = temp_db._get_connection()
        conn2 = temp_db._get_connection()
        assert conn1 is conn2

    def test_migrate_legacy_fts_to_external(self, tmp_path):
        """Existing databases should be migrated to external-content FTS."""
        db_path = tmp_path / "legacy.db"
        with sqlite3.connect(db_path) as conn:
            conn.execute(
                """
                CREATE TABLE files (
                    id INTEGER PRIMARY KEY,
                    path TEXT UNIQUE NOT NULL,
                    language TEXT NOT NULL,
                    content TEXT NOT NULL,
                    mtime REAL,
                    line_count INTEGER
                )
                """
            )
            conn.execute(
                """
                CREATE VIRTUAL TABLE files_fts USING fts5(
                    path UNINDEXED,
                    language UNINDEXED,
                    content
                )
                """
            )
            conn.execute(
                """
                INSERT INTO files(path, language, content, mtime, line_count)
                VALUES(?, ?, ?, ?, ?)
                """,
                (str(Path("/test/file.py").resolve()), "python", "def hello():\n  pass", None, 2),
            )
            file_id = conn.execute("SELECT id FROM files").fetchone()[0]
            conn.execute(
                "INSERT INTO files_fts(rowid, path, language, content) VALUES(?, ?, ?, ?)",
                (file_id, str(Path("/test/file.py").resolve()), "python", "def hello():\n  pass"),
            )
            conn.commit()

        store = SQLiteStore(db_path)
        store.initialize()
        try:
            results = store.search_fts("hello")
            assert len(results) == 1

            conn = store._get_connection()
            row = conn.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='files_fts'"
            ).fetchone()
            assert row is not None
            assert "content='files'" in row["sql"] or "content=files" in row["sql"]
        finally:
            store.close()
