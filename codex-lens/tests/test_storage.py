"""Tests for CodexLens storage."""

import sqlite3
import threading
import pytest
import tempfile
from pathlib import Path

from codexlens.storage.sqlite_store import SQLiteStore
from codexlens.entities import IndexedFile, Symbol
from codexlens.errors import StorageError


@pytest.fixture
def temp_db():
    """Create a temporary database for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        store = SQLiteStore(db_path)
        store.initialize()
        yield store
        store.close()


@pytest.fixture
def temp_db_path():
    """Create a temporary directory and return db path."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir) / "test.db"


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


class TestSQLiteStoreAddFiles:
    """Tests for add_files batch operation."""

    def test_add_files_batch(self, temp_db):
        """Test adding multiple files in a batch."""
        files_data = [
            (IndexedFile(
                path="/test/a.py",
                language="python",
                symbols=[Symbol(name="func_a", kind="function", range=(1, 1))],
            ), "def func_a(): pass"),
            (IndexedFile(
                path="/test/b.py",
                language="python",
                symbols=[Symbol(name="func_b", kind="function", range=(1, 1))],
            ), "def func_b(): pass"),
            (IndexedFile(
                path="/test/c.py",
                language="python",
                symbols=[Symbol(name="func_c", kind="function", range=(1, 1))],
            ), "def func_c(): pass"),
        ]

        temp_db.add_files(files_data)

        stats = temp_db.stats()
        assert stats["files"] == 3
        assert stats["symbols"] == 3

    def test_add_files_empty_list(self, temp_db):
        """Test adding empty list of files."""
        temp_db.add_files([])
        stats = temp_db.stats()
        assert stats["files"] == 0


class TestSQLiteStoreSearch:
    """Tests for search operations."""

    def test_search_fts_with_limit(self, temp_db):
        """Test FTS search with limit."""
        for i in range(10):
            indexed_file = IndexedFile(
                path=f"/test/file{i}.py",
                language="python",
                symbols=[],
            )
            temp_db.add_file(indexed_file, f"def test{i}(): pass")

        results = temp_db.search_fts("test", limit=3)
        assert len(results) <= 3

    def test_search_fts_with_offset(self, temp_db):
        """Test FTS search with offset."""
        for i in range(10):
            indexed_file = IndexedFile(
                path=f"/test/file{i}.py",
                language="python",
                symbols=[],
            )
            temp_db.add_file(indexed_file, f"searchterm content {i}")

        results_page1 = temp_db.search_fts("searchterm", limit=3, offset=0)
        results_page2 = temp_db.search_fts("searchterm", limit=3, offset=3)

        # Pages should be different
        paths1 = {r.path for r in results_page1}
        paths2 = {r.path for r in results_page2}
        assert paths1.isdisjoint(paths2)

    def test_search_fts_no_results(self, temp_db):
        """Test FTS search with no results."""
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[],
        )
        temp_db.add_file(indexed_file, "def hello(): pass")

        results = temp_db.search_fts("nonexistent")
        assert len(results) == 0

    def test_search_symbols_by_kind(self, temp_db):
        """Test symbol search filtered by kind."""
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[
                Symbol(name="MyClass", kind="class", range=(1, 5)),
                Symbol(name="my_func", kind="function", range=(7, 10)),
                Symbol(name="my_method", kind="method", range=(2, 4)),
            ],
        )
        temp_db.add_file(indexed_file, "class MyClass:\n    def my_method(): pass\ndef my_func(): pass")

        # Search for functions only
        results = temp_db.search_symbols("my", kind="function")
        assert len(results) == 1
        assert results[0].name == "my_func"

    def test_search_symbols_with_limit(self, temp_db):
        """Test symbol search with limit."""
        # Range starts from 1, not 0
        symbols = [Symbol(name=f"func{i}", kind="function", range=(i+1, i+1)) for i in range(20)]
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=symbols,
        )
        temp_db.add_file(indexed_file, "# lots of functions")

        results = temp_db.search_symbols("func", limit=5)
        assert len(results) == 5

    def test_search_files_only(self, temp_db):
        """Test search_files_only returns only paths."""
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[],
        )
        temp_db.add_file(indexed_file, "def hello(): pass")

        results = temp_db.search_files_only("hello")
        assert len(results) == 1
        assert isinstance(results[0], str)


class TestSQLiteStoreFileOperations:
    """Tests for file operations."""

    def test_file_exists_true(self, temp_db):
        """Test file_exists returns True for existing file."""
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[],
        )
        temp_db.add_file(indexed_file, "content")

        assert temp_db.file_exists("/test/file.py")

    def test_file_exists_false(self, temp_db):
        """Test file_exists returns False for non-existing file."""
        assert not temp_db.file_exists("/nonexistent/file.py")

    def test_remove_nonexistent_file(self, temp_db):
        """Test removing non-existent file returns False."""
        result = temp_db.remove_file("/nonexistent/file.py")
        assert result is False

    def test_get_file_mtime(self, temp_db):
        """Test getting file mtime."""
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[],
        )
        temp_db.add_file(indexed_file, "content")

        # Note: mtime is only set if the file actually exists on disk
        mtime = temp_db.get_file_mtime("/test/file.py")
        # May be None if file doesn't exist on disk
        assert mtime is None or isinstance(mtime, float)

    def test_get_file_mtime_nonexistent(self, temp_db):
        """Test getting mtime for non-indexed file."""
        mtime = temp_db.get_file_mtime("/nonexistent/file.py")
        assert mtime is None

    def test_update_existing_file(self, temp_db):
        """Test updating an existing file."""
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[Symbol(name="old_func", kind="function", range=(1, 1))],
        )
        temp_db.add_file(indexed_file, "def old_func(): pass")

        # Update with new content and symbols
        updated_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[Symbol(name="new_func", kind="function", range=(1, 1))],
        )
        temp_db.add_file(updated_file, "def new_func(): pass")

        stats = temp_db.stats()
        assert stats["files"] == 1  # Still one file
        assert stats["symbols"] == 1  # Old symbols replaced

        symbols = temp_db.search_symbols("new_func")
        assert len(symbols) == 1


class TestSQLiteStoreStats:
    """Tests for stats operation."""

    def test_stats_empty_db(self, temp_db):
        """Test stats on empty database."""
        stats = temp_db.stats()
        assert stats["files"] == 0
        assert stats["symbols"] == 0
        assert stats["languages"] == {}

    def test_stats_with_data(self, temp_db):
        """Test stats with data."""
        files = [
            (IndexedFile(path="/test/a.py", language="python", symbols=[
                Symbol(name="func1", kind="function", range=(1, 1)),
                Symbol(name="func2", kind="function", range=(2, 2)),
            ]), "content"),
            (IndexedFile(path="/test/b.js", language="javascript", symbols=[
                Symbol(name="func3", kind="function", range=(1, 1)),
            ]), "content"),
        ]
        temp_db.add_files(files)

        stats = temp_db.stats()
        assert stats["files"] == 2
        assert stats["symbols"] == 3
        assert stats["languages"]["python"] == 1
        assert stats["languages"]["javascript"] == 1
        assert "db_path" in stats


class TestSQLiteStoreContextManager:
    """Tests for context manager usage."""

    def test_context_manager(self, temp_db_path):
        """Test using SQLiteStore as context manager."""
        with SQLiteStore(temp_db_path) as store:
            indexed_file = IndexedFile(
                path="/test/file.py",
                language="python",
                symbols=[],
            )
            store.add_file(indexed_file, "content")
            stats = store.stats()
            assert stats["files"] == 1


class TestSQLiteStoreThreadSafety:
    """Tests for thread safety."""

    def test_multiple_threads_read(self, temp_db):
        """Test reading from multiple threads."""
        # Add some data first
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[Symbol(name="test", kind="function", range=(1, 1))],
        )
        temp_db.add_file(indexed_file, "def test(): pass")

        results = []
        errors = []

        def read_data():
            try:
                stats = temp_db.stats()
                results.append(stats)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=read_data) for _ in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        assert len(results) == 5
        for stats in results:
            assert stats["files"] == 1


class TestSQLiteStoreEdgeCases:
    """Edge case tests for SQLiteStore."""

    def test_special_characters_in_path(self, temp_db):
        """Test file path with special characters."""
        indexed_file = IndexedFile(
            path="/test/file with spaces.py",
            language="python",
            symbols=[],
        )
        temp_db.add_file(indexed_file, "content")

        assert temp_db.file_exists("/test/file with spaces.py")

    def test_unicode_content(self, temp_db):
        """Test file with unicode content."""
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[Symbol(name="你好", kind="function", range=(1, 1))],
        )
        temp_db.add_file(indexed_file, "def 你好(): print('世界')")

        symbols = temp_db.search_symbols("你好")
        assert len(symbols) == 1

    def test_very_long_content(self, temp_db):
        """Test file with very long content."""
        long_content = "x = 1\n" * 10000
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[],
        )
        temp_db.add_file(indexed_file, long_content)

        stats = temp_db.stats()
        assert stats["files"] == 1

    def test_file_with_no_symbols(self, temp_db):
        """Test file with no symbols."""
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[],
        )
        temp_db.add_file(indexed_file, "# just a comment")

        stats = temp_db.stats()
        assert stats["files"] == 1
        assert stats["symbols"] == 0

    def test_file_with_many_symbols(self, temp_db):
        """Test file with many symbols."""
        # Range starts from 1, not 0
        symbols = [Symbol(name=f"func_{i}", kind="function", range=(i+1, i+1)) for i in range(100)]
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=symbols,
        )
        temp_db.add_file(indexed_file, "# lots of functions")

        stats = temp_db.stats()
        assert stats["symbols"] == 100

    def test_close_and_reopen(self, temp_db_path):
        """Test closing and reopening database."""
        # First session
        store1 = SQLiteStore(temp_db_path)
        store1.initialize()
        indexed_file = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=[Symbol(name="test", kind="function", range=(1, 1))],
        )
        store1.add_file(indexed_file, "def test(): pass")
        store1.close()

        # Second session
        store2 = SQLiteStore(temp_db_path)
        store2.initialize()
        stats = store2.stats()
        assert stats["files"] == 1
        assert stats["symbols"] == 1
        store2.close()
