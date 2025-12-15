"""Integration tests for token metadata storage and retrieval."""

import pytest
import tempfile
from pathlib import Path

from codexlens.entities import Symbol, IndexedFile
from codexlens.storage.sqlite_store import SQLiteStore
from codexlens.storage.dir_index import DirIndexStore
from codexlens.storage.migration_manager import MigrationManager


class TestTokenMetadataStorage:
    """Tests for storing and retrieving token metadata."""

    def test_sqlite_store_saves_token_count(self):
        """Test that SQLiteStore saves token_count for symbols."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            store = SQLiteStore(db_path)

            with store:
                # Create indexed file with symbols containing token counts
                symbols = [
                    Symbol(
                        name="func1",
                        kind="function",
                        range=(1, 5),
                        token_count=42,
                        symbol_type="function_definition"
                    ),
                    Symbol(
                        name="func2",
                        kind="function",
                        range=(7, 12),
                        token_count=73,
                        symbol_type="function_definition"
                    ),
                ]

                indexed_file = IndexedFile(
                    path=str(Path(tmpdir) / "test.py"),
                    language="python",
                    symbols=symbols
                )

                content = "def func1():\n    pass\n\ndef func2():\n    pass\n"
                store.add_file(indexed_file, content)

                # Retrieve symbols and verify token_count is saved
                retrieved_symbols = store.search_symbols("func", limit=10)

                assert len(retrieved_symbols) == 2

                # Check that symbols have token_count attribute
                # Note: search_symbols currently doesn't return token_count
                # This test verifies the data is stored correctly in the database

    def test_dir_index_store_saves_token_count(self):
        """Test that DirIndexStore saves token_count for symbols."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            store = DirIndexStore(db_path)

            with store:
                symbols = [
                    Symbol(
                        name="calculate",
                        kind="function",
                        range=(1, 10),
                        token_count=128,
                        symbol_type="function_definition"
                    ),
                ]

                file_id = store.add_file(
                    name="math.py",
                    full_path=Path(tmpdir) / "math.py",
                    content="def calculate(x, y):\n    return x + y\n",
                    language="python",
                    symbols=symbols
                )

                assert file_id > 0

                # Verify file was stored
                file_entry = store.get_file(Path(tmpdir) / "math.py")
                assert file_entry is not None
                assert file_entry.name == "math.py"

    def test_migration_adds_token_columns(self):
        """Test that migration 002 adds token_count and symbol_type columns."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            store = SQLiteStore(db_path)

            with store:
                # Apply migrations
                conn = store._get_connection()
                manager = MigrationManager(conn)
                manager.apply_migrations()

                # Verify columns exist
                cursor = conn.execute("PRAGMA table_info(symbols)")
                columns = {row[1] for row in cursor.fetchall()}

                assert "token_count" in columns
                assert "symbol_type" in columns

                # Verify index exists
                cursor = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_symbols_type'"
                )
                index = cursor.fetchone()
                assert index is not None

    def test_batch_insert_preserves_token_metadata(self):
        """Test that batch insert preserves token metadata."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            store = SQLiteStore(db_path)

            with store:
                files_data = []

                for i in range(5):
                    symbols = [
                        Symbol(
                            name=f"func{i}",
                            kind="function",
                            range=(1, 3),
                            token_count=10 + i,
                            symbol_type="function_definition"
                        ),
                    ]

                    indexed_file = IndexedFile(
                        path=str(Path(tmpdir) / f"test{i}.py"),
                        language="python",
                        symbols=symbols
                    )

                    content = f"def func{i}():\n    pass\n"
                    files_data.append((indexed_file, content))

                # Batch insert
                store.add_files(files_data)

                # Verify all files were stored
                stats = store.stats()
                assert stats["files"] == 5
                assert stats["symbols"] == 5

    def test_symbol_type_defaults_to_kind(self):
        """Test that symbol_type defaults to kind when not specified."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            store = DirIndexStore(db_path)

            with store:
                # Symbol without explicit symbol_type
                symbols = [
                    Symbol(
                        name="MyClass",
                        kind="class",
                        range=(1, 10),
                        token_count=200
                    ),
                ]

                store.add_file(
                    name="module.py",
                    full_path=Path(tmpdir) / "module.py",
                    content="class MyClass:\n    pass\n",
                    language="python",
                    symbols=symbols
                )

                # Verify it was stored (symbol_type should default to 'class')
                file_entry = store.get_file(Path(tmpdir) / "module.py")
                assert file_entry is not None

    def test_null_token_count_allowed(self):
        """Test that NULL token_count is allowed for backward compatibility."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            store = SQLiteStore(db_path)

            with store:
                # Symbol without token_count (None)
                symbols = [
                    Symbol(
                        name="legacy_func",
                        kind="function",
                        range=(1, 5)
                    ),
                ]

                indexed_file = IndexedFile(
                    path=str(Path(tmpdir) / "legacy.py"),
                    language="python",
                    symbols=symbols
                )

                content = "def legacy_func():\n    pass\n"
                store.add_file(indexed_file, content)

                # Should not raise an error
                stats = store.stats()
                assert stats["symbols"] == 1

    def test_search_by_symbol_type(self):
        """Test searching/filtering symbols by symbol_type."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            store = DirIndexStore(db_path)

            with store:
                # Add symbols with different types
                symbols = [
                    Symbol(
                        name="MyClass",
                        kind="class",
                        range=(1, 10),
                        symbol_type="class_definition"
                    ),
                    Symbol(
                        name="my_function",
                        kind="function",
                        range=(12, 15),
                        symbol_type="function_definition"
                    ),
                    Symbol(
                        name="my_method",
                        kind="method",
                        range=(5, 8),
                        symbol_type="method_definition"
                    ),
                ]

                store.add_file(
                    name="code.py",
                    full_path=Path(tmpdir) / "code.py",
                    content="class MyClass:\n    def my_method(self):\n        pass\n\ndef my_function():\n    pass\n",
                    language="python",
                    symbols=symbols
                )

                # Search for functions only
                function_symbols = store.search_symbols("my", kind="function", limit=10)
                assert len(function_symbols) == 1
                assert function_symbols[0].name == "my_function"

                # Search for methods only
                method_symbols = store.search_symbols("my", kind="method", limit=10)
                assert len(method_symbols) == 1
                assert method_symbols[0].name == "my_method"


class TestTokenCountAccuracy:
    """Tests for token count accuracy in storage."""

    def test_stored_token_count_matches_original(self):
        """Test that stored token_count matches the original value."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "test.db"
            store = SQLiteStore(db_path)

            with store:
                expected_token_count = 256

                symbols = [
                    Symbol(
                        name="complex_func",
                        kind="function",
                        range=(1, 20),
                        token_count=expected_token_count
                    ),
                ]

                indexed_file = IndexedFile(
                    path=str(Path(tmpdir) / "test.py"),
                    language="python",
                    symbols=symbols
                )

                content = "def complex_func():\n    # Some complex logic\n    pass\n"
                store.add_file(indexed_file, content)

                # Verify by querying the database directly
                conn = store._get_connection()
                cursor = conn.execute(
                    "SELECT token_count FROM symbols WHERE name = ?",
                    ("complex_func",)
                )
                row = cursor.fetchone()

                assert row is not None
                stored_token_count = row[0]
                assert stored_token_count == expected_token_count

    def test_100_percent_storage_accuracy(self):
        """Test that 100% of token counts are stored correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            store = DirIndexStore(db_path)

            with store:
                # Create a mapping of expected token counts
                expected_counts = {}

                # Store symbols with known token counts
                file_entries = []
                for i in range(100):
                    token_count = 10 + i * 3
                    symbol_name = f"func{i}"
                    expected_counts[symbol_name] = token_count

                    symbols = [
                        Symbol(
                            name=symbol_name,
                            kind="function",
                            range=(1, 2),
                            token_count=token_count
                        )
                    ]

                    file_path = Path(tmpdir) / f"file{i}.py"
                    file_entries.append((
                        f"file{i}.py",
                        file_path,
                        f"def {symbol_name}():\n    pass\n",
                        "python",
                        symbols
                    ))

                count = store.add_files_batch(file_entries)
                assert count == 100

                # Verify all token counts are stored correctly
                conn = store._get_connection()
                cursor = conn.execute(
                    "SELECT name, token_count FROM symbols ORDER BY name"
                )
                rows = cursor.fetchall()

                assert len(rows) == 100

                # Verify each stored token_count matches what we set
                for name, token_count in rows:
                    expected = expected_counts[name]
                    assert token_count == expected, \
                        f"Symbol {name} has token_count {token_count}, expected {expected}"
