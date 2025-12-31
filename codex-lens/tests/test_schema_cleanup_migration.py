"""
Test migration 005: Schema cleanup for unused/redundant fields.

Tests that migration 005 successfully removes:
1. semantic_metadata.keywords (replaced by file_keywords)
2. symbols.token_count (unused)
3. symbols.symbol_type (redundant with kind)
4. subdirs.direct_files (unused)
"""

import sqlite3
import tempfile
from pathlib import Path

import pytest

from codexlens.storage.dir_index import DirIndexStore
from codexlens.entities import Symbol


class TestSchemaCleanupMigration:
    """Test schema cleanup migration (v4 -> latest)."""

    def test_migration_from_v4_to_v5(self):
        """Test that migration successfully removes deprecated fields."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            store = DirIndexStore(db_path)

            # Create v4 schema manually (with deprecated fields)
            conn = sqlite3.connect(db_path)
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # Set schema version to 4
            cursor.execute("PRAGMA user_version = 4")

            # Create v4 schema with deprecated fields
            cursor.execute("""
                CREATE TABLE files (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    full_path TEXT UNIQUE NOT NULL,
                    language TEXT,
                    content TEXT,
                    mtime REAL,
                    line_count INTEGER
                )
            """)

            cursor.execute("""
                CREATE TABLE subdirs (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    index_path TEXT NOT NULL,
                    files_count INTEGER DEFAULT 0,
                    direct_files INTEGER DEFAULT 0,
                    last_updated REAL
                )
            """)

            cursor.execute("""
                CREATE TABLE symbols (
                    id INTEGER PRIMARY KEY,
                    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    start_line INTEGER,
                    end_line INTEGER,
                    token_count INTEGER,
                    symbol_type TEXT
                )
            """)

            cursor.execute("""
                CREATE TABLE semantic_metadata (
                    id INTEGER PRIMARY KEY,
                    file_id INTEGER UNIQUE REFERENCES files(id) ON DELETE CASCADE,
                    summary TEXT,
                    keywords TEXT,
                    purpose TEXT,
                    llm_tool TEXT,
                    generated_at REAL
                )
            """)

            cursor.execute("""
                CREATE TABLE keywords (
                    id INTEGER PRIMARY KEY,
                    keyword TEXT NOT NULL UNIQUE
                )
            """)

            cursor.execute("""
                CREATE TABLE file_keywords (
                    file_id INTEGER NOT NULL,
                    keyword_id INTEGER NOT NULL,
                    PRIMARY KEY (file_id, keyword_id),
                    FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
                    FOREIGN KEY (keyword_id) REFERENCES keywords (id) ON DELETE CASCADE
                )
            """)

            # Insert test data
            cursor.execute(
                "INSERT INTO files (name, full_path, language, content, mtime, line_count) VALUES (?, ?, ?, ?, ?, ?)",
                ("test.py", "/test/test.py", "python", "def test(): pass", 1234567890.0, 1)
            )
            file_id = cursor.lastrowid

            cursor.execute(
                "INSERT INTO symbols (file_id, name, kind, start_line, end_line, token_count, symbol_type) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (file_id, "test", "function", 1, 1, 10, "function")
            )

            cursor.execute(
                "INSERT INTO semantic_metadata (file_id, summary, keywords, purpose, llm_tool, generated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (file_id, "Test function", '["test", "example"]', "Testing", "gemini", 1234567890.0)
            )

            cursor.execute(
                "INSERT INTO subdirs (name, index_path, files_count, direct_files, last_updated) VALUES (?, ?, ?, ?, ?)",
                ("subdir", "/test/subdir/_index.db", 5, 2, 1234567890.0)
            )

            conn.commit()
            conn.close()

            # Now initialize store - this should trigger migration
            store.initialize()

            # Verify schema version is now the latest
            conn = store._get_connection()
            version_row = conn.execute("PRAGMA user_version").fetchone()
            assert version_row[0] == DirIndexStore.SCHEMA_VERSION, (
                f"Expected schema version {DirIndexStore.SCHEMA_VERSION}, got {version_row[0]}"
            )

            # Check that deprecated columns are removed
            # 1. Check semantic_metadata doesn't have keywords column
            cursor = conn.execute("PRAGMA table_info(semantic_metadata)")
            columns = {row[1] for row in cursor.fetchall()}
            assert "keywords" not in columns, "semantic_metadata.keywords should be removed"
            assert "summary" in columns, "semantic_metadata.summary should exist"
            assert "purpose" in columns, "semantic_metadata.purpose should exist"

            # 2. Check symbols doesn't have token_count or symbol_type
            cursor = conn.execute("PRAGMA table_info(symbols)")
            columns = {row[1] for row in cursor.fetchall()}
            assert "token_count" not in columns, "symbols.token_count should be removed"
            assert "symbol_type" not in columns, "symbols.symbol_type should be removed"
            assert "kind" in columns, "symbols.kind should exist"

            # 3. Check subdirs doesn't have direct_files
            cursor = conn.execute("PRAGMA table_info(subdirs)")
            columns = {row[1] for row in cursor.fetchall()}
            assert "direct_files" not in columns, "subdirs.direct_files should be removed"
            assert "files_count" in columns, "subdirs.files_count should exist"

            # 4. Verify data integrity - data should be preserved
            semantic = store.get_semantic_metadata(file_id)
            assert semantic is not None, "Semantic metadata should be preserved"
            assert semantic["summary"] == "Test function"
            assert semantic["purpose"] == "Testing"
            # Keywords should now come from file_keywords table (empty after migration since we didn't populate it)
            assert isinstance(semantic["keywords"], list)

            store.close()

    def test_new_database_has_clean_schema(self):
        """Test that new databases are created with clean schema (latest)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            store = DirIndexStore(db_path)
            store.initialize()

            conn = store._get_connection()

            # Verify schema version is the latest
            version_row = conn.execute("PRAGMA user_version").fetchone()
            assert version_row[0] == DirIndexStore.SCHEMA_VERSION

            # Check that new schema doesn't have deprecated columns
            cursor = conn.execute("PRAGMA table_info(semantic_metadata)")
            columns = {row[1] for row in cursor.fetchall()}
            assert "keywords" not in columns

            cursor = conn.execute("PRAGMA table_info(symbols)")
            columns = {row[1] for row in cursor.fetchall()}
            assert "token_count" not in columns
            assert "symbol_type" not in columns

            cursor = conn.execute("PRAGMA table_info(subdirs)")
            columns = {row[1] for row in cursor.fetchall()}
            assert "direct_files" not in columns

            store.close()

    def test_semantic_metadata_keywords_from_normalized_table(self):
        """Test that keywords are read from file_keywords table, not JSON column."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            store = DirIndexStore(db_path)
            store.initialize()

            # Add a file
            file_id = store.add_file(
                name="test.py",
                full_path="/test/test.py",
                content="def test(): pass",
                language="python",
                symbols=[]
            )

            # Add semantic metadata with keywords
            store.add_semantic_metadata(
                file_id=file_id,
                summary="Test function",
                keywords=["test", "example", "function"],
                purpose="Testing",
                llm_tool="gemini"
            )

            # Retrieve and verify keywords come from normalized table
            semantic = store.get_semantic_metadata(file_id)
            assert semantic is not None
            assert sorted(semantic["keywords"]) == ["example", "function", "test"]

            # Verify keywords are in normalized tables
            conn = store._get_connection()
            keyword_count = conn.execute(
                """SELECT COUNT(*) FROM file_keywords WHERE file_id = ?""",
                (file_id,)
            ).fetchone()[0]
            assert keyword_count == 3

            store.close()

    def test_symbols_insert_without_deprecated_fields(self):
        """Test that symbols can be inserted without token_count and symbol_type."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            store = DirIndexStore(db_path)
            store.initialize()

            # Add file with symbols
            symbols = [
                Symbol(name="test_func", kind="function", range=(1, 5)),
                Symbol(name="TestClass", kind="class", range=(7, 20)),
            ]

            file_id = store.add_file(
                name="test.py",
                full_path="/test/test.py",
                content="def test_func(): pass\n\nclass TestClass:\n    pass",
                language="python",
                symbols=symbols
            )

            # Verify symbols were inserted
            conn = store._get_connection()
            symbol_rows = conn.execute(
                "SELECT name, kind, start_line, end_line FROM symbols WHERE file_id = ?",
                (file_id,)
            ).fetchall()

            assert len(symbol_rows) == 2
            assert symbol_rows[0]["name"] == "test_func"
            assert symbol_rows[0]["kind"] == "function"
            assert symbol_rows[1]["name"] == "TestClass"
            assert symbol_rows[1]["kind"] == "class"

            store.close()

    def test_subdir_operations_without_direct_files(self):
        """Test that subdir operations work without direct_files field."""
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            store = DirIndexStore(db_path)
            store.initialize()

            # Register subdir (direct_files parameter is ignored)
            store.register_subdir(
                name="subdir",
                index_path="/test/subdir/_index.db",
                files_count=10,
                direct_files=5  # This should be ignored
            )

            # Retrieve and verify
            subdir = store.get_subdir("subdir")
            assert subdir is not None
            assert subdir.name == "subdir"
            assert subdir.files_count == 10
            assert not hasattr(subdir, "direct_files")  # Should not have this attribute

            # Update stats (direct_files parameter is ignored)
            store.update_subdir_stats("subdir", files_count=15, direct_files=7)

            # Verify update
            subdir = store.get_subdir("subdir")
            assert subdir.files_count == 15

            store.close()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
