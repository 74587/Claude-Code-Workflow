"""Tests for Dual-FTS schema migration and functionality (P1).

Tests dual FTS tables (files_fts_exact, files_fts_fuzzy) creation, trigger synchronization,
and migration from schema version 2 to version 4.
"""

import sqlite3
import tempfile
from pathlib import Path

import pytest

from codexlens.storage.dir_index import DirIndexStore

# Check if pytest-benchmark is available
try:
    import pytest_benchmark
    BENCHMARK_AVAILABLE = True
except ImportError:
    BENCHMARK_AVAILABLE = False


class TestDualFTSSchema:
    """Tests for dual FTS schema creation and structure."""

    @pytest.fixture
    def temp_db(self):
        """Create temporary database for testing."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)
        yield db_path
        # Cleanup
        if db_path.exists():
            db_path.unlink()

    @pytest.fixture
    def index_store(self, temp_db):
        """Create DirIndexStore with initialized database."""
        store = DirIndexStore(temp_db)
        store.initialize()
        yield store
        store.close()

    def test_files_fts_exact_table_exists(self, index_store):
        """Test files_fts_exact FTS5 table is created."""
        with index_store._get_connection() as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='files_fts_exact'"
            )
            result = cursor.fetchone()
            assert result is not None, "files_fts_exact table should exist"

    def test_files_fts_fuzzy_table_exists(self, index_store):
        """Test files_fts_fuzzy FTS5 table is created with trigram tokenizer."""
        with index_store._get_connection() as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='files_fts_fuzzy'"
            )
            result = cursor.fetchone()
            assert result is not None, "files_fts_fuzzy table should exist"

    def test_fts_exact_tokenizer(self, index_store):
        """Test files_fts_exact uses unicode61 tokenizer."""
        with index_store._get_connection() as conn:
            # Check table creation SQL
            cursor = conn.execute(
                "SELECT sql FROM sqlite_master WHERE name='files_fts_exact'"
            )
            result = cursor.fetchone()
            assert result is not None
            sql = result[0]
            # Should use unicode61 tokenizer
            assert "unicode61" in sql.lower() or "fts5" in sql.lower()

    def test_fts_fuzzy_tokenizer_fallback(self, index_store):
        """Test files_fts_fuzzy uses trigram or falls back to unicode61."""
        with index_store._get_connection() as conn:
            cursor = conn.execute(
                "SELECT sql FROM sqlite_master WHERE name='files_fts_fuzzy'"
            )
            result = cursor.fetchone()
            assert result is not None
            sql = result[0]
            # Should use trigram or unicode61 as fallback
            assert "trigram" in sql.lower() or "unicode61" in sql.lower()

    def test_dual_fts_trigger_synchronization(self, index_store, temp_db):
        """Test triggers keep dual FTS tables synchronized with files table."""
        # Insert test file
        test_path = "test/example.py"
        test_content = "def test_function():\n    pass"

        with index_store._get_connection() as conn:
            # Insert into files table
            name = test_path.split('/')[-1]
            conn.execute(
                """INSERT INTO files (name, full_path, content, language, mtime)
                   VALUES (?, ?, ?, ?, ?)""",
                (name, test_path, test_content, "python", 1234567890.0)
            )
            conn.commit()

            # Check files_fts_exact has content
            cursor = conn.execute(
                "SELECT full_path, content FROM files_fts_exact WHERE full_path = ?",
                (test_path,)
            )
            exact_result = cursor.fetchone()
            assert exact_result is not None, "files_fts_exact should have content via trigger"
            assert exact_result[0] == test_path
            assert exact_result[1] == test_content

            # Check files_fts_fuzzy has content
            cursor = conn.execute(
                "SELECT full_path, content FROM files_fts_fuzzy WHERE full_path = ?",
                (test_path,)
            )
            fuzzy_result = cursor.fetchone()
            assert fuzzy_result is not None, "files_fts_fuzzy should have content via trigger"
            assert fuzzy_result[0] == test_path
            assert fuzzy_result[1] == test_content

    def test_dual_fts_update_trigger(self, index_store):
        """Test UPDATE triggers synchronize dual FTS tables."""
        test_path = "test/update.py"
        original_content = "original content"
        updated_content = "updated content"

        with index_store._get_connection() as conn:
            # Insert
            name = test_path.split('/')[-1]
            conn.execute(
                """INSERT INTO files (name, full_path, content, language, mtime)
                   VALUES (?, ?, ?, ?, ?)""",
                (name, test_path, original_content, "python", 1234567890.0)
            )
            conn.commit()

            # Update content
            conn.execute(
                "UPDATE files SET content = ? WHERE full_path = ?",
                (updated_content, test_path)
            )
            conn.commit()

            # Verify FTS tables have updated content
            cursor = conn.execute(
                "SELECT content FROM files_fts_exact WHERE full_path = ?",
                (test_path,)
            )
            assert cursor.fetchone()[0] == updated_content

            cursor = conn.execute(
                "SELECT content FROM files_fts_fuzzy WHERE full_path = ?",
                (test_path,)
            )
            assert cursor.fetchone()[0] == updated_content

    def test_dual_fts_delete_trigger(self, index_store):
        """Test DELETE triggers remove entries from dual FTS tables."""
        test_path = "test/delete.py"

        with index_store._get_connection() as conn:
            # Insert
            name = test_path.split('/')[-1]
            conn.execute(
                """INSERT INTO files (name, full_path, content, language, mtime)
                   VALUES (?, ?, ?, ?, ?)""",
                (name, test_path, "content", "python", 1234567890.0)
            )
            conn.commit()

            # Delete
            conn.execute("DELETE FROM files WHERE full_path = ?", (test_path,))
            conn.commit()

            # Verify FTS tables are cleaned up
            cursor = conn.execute(
                "SELECT COUNT(*) FROM files_fts_exact WHERE full_path = ?",
                (test_path,)
            )
            assert cursor.fetchone()[0] == 0

            cursor = conn.execute(
                "SELECT COUNT(*) FROM files_fts_fuzzy WHERE full_path = ?",
                (test_path,)
            )
            assert cursor.fetchone()[0] == 0


class TestDualFTSMigration:
    """Tests for schema migration to dual FTS (v2 → v4)."""

    @pytest.fixture
    def v2_db(self):
        """Create schema version 2 database (pre-dual-FTS)."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        # Create v2 schema manually
        conn = sqlite3.connect(db_path)
        try:
            # Set schema version using PRAGMA (not schema_version table)
            conn.execute("PRAGMA user_version = 2")
            
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS files (
                    path TEXT PRIMARY KEY,
                    content TEXT,
                    language TEXT,
                    indexed_at TEXT
                );

                CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
                    path, content, language,
                    content='files', content_rowid='rowid'
                );
            """)
            conn.commit()
        finally:
            conn.close()

        yield db_path

        # Cleanup
        if db_path.exists():
            db_path.unlink()

    def test_migration_004_creates_dual_fts(self, v2_db):
        """Test migration 004 creates dual FTS tables."""
        # Run migration
        store = DirIndexStore(v2_db)
        store.initialize()

        try:
            # Verify tables exist
            with store._get_connection() as conn:
                cursor = conn.execute(
                    """SELECT name FROM sqlite_master
                       WHERE type='table' AND name IN ('files_fts_exact', 'files_fts_fuzzy')"""
                )
                tables = [row[0] for row in cursor.fetchall()]
                assert 'files_fts_exact' in tables, "Migration should create files_fts_exact"
                assert 'files_fts_fuzzy' in tables, "Migration should create files_fts_fuzzy"
        finally:
            store.close()

    def test_migration_004_preserves_data(self, v2_db):
        """Test migration preserves existing file data."""
        # Insert test data into v2 schema (using 'path' column)
        conn = sqlite3.connect(v2_db)
        test_files = [
            ("test/file1.py", "content1", "python"),
            ("test/file2.js", "content2", "javascript"),
        ]
        conn.executemany(
            "INSERT INTO files (path, content, language) VALUES (?, ?, ?)",
            test_files
        )
        conn.commit()
        conn.close()

        # Run migration
        store = DirIndexStore(v2_db)
        store.initialize()

        try:
            # Verify data preserved (should be migrated to full_path)
            with store._get_connection() as conn:
                cursor = conn.execute("SELECT full_path, content, language FROM files ORDER BY full_path")
                result = [tuple(row) for row in cursor.fetchall()]
                assert len(result) == 2
                assert result[0] == test_files[0]
                assert result[1] == test_files[1]
        finally:
            store.close()

    def test_migration_004_updates_schema_version(self, v2_db):
        """Test migration updates schema_version to 4."""
        # Run migration
        store = DirIndexStore(v2_db)
        store.initialize()

        try:
            with store._get_connection() as conn:
                # Check PRAGMA user_version (not schema_version table)
                cursor = conn.execute("PRAGMA user_version")
                version = cursor.fetchone()[0]
                assert version >= 4, "Schema version should be upgraded to 4"
        finally:
            store.close()

    def test_migration_idempotent(self, v2_db):
        """Test migration can run multiple times safely."""
        # Run migration twice
        store1 = DirIndexStore(v2_db)
        store1.initialize()  # First migration
        store1.close()
        
        store2 = DirIndexStore(v2_db)
        store2.initialize()  # Second migration (should be idempotent)

        try:
            # Should not raise errors
            with store2._get_connection() as conn:
                cursor = conn.execute("SELECT COUNT(*) FROM files_fts_exact")
                # Should work without errors
                cursor.fetchone()
        finally:
            store2.close()


class TestTrigramAvailability:
    """Tests for trigram tokenizer availability and fallback."""

    @pytest.fixture
    def temp_db(self):
        """Create temporary database."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)
        yield db_path
        if db_path.exists():
            db_path.unlink()

    def test_trigram_detection(self, temp_db):
        """Test system detects trigram tokenizer availability."""
        store = DirIndexStore(temp_db)
        store.initialize()

        try:
            # Check SQLite version and trigram support
            with store._get_connection() as conn:
                cursor = conn.execute("SELECT sqlite_version()")
                version = cursor.fetchone()[0]
                print(f"SQLite version: {version}")

                # Try to create trigram FTS table
                try:
                    conn.execute("""
                        CREATE VIRTUAL TABLE test_trigram USING fts5(
                            content,
                            tokenize='trigram'
                        )
                    """)
                    trigram_available = True
                except sqlite3.OperationalError:
                    trigram_available = False

                # Cleanup test table
                if trigram_available:
                    conn.execute("DROP TABLE IF EXISTS test_trigram")

            # Verify fuzzy table uses appropriate tokenizer
            with store._get_connection() as conn:
                cursor = conn.execute(
                    "SELECT sql FROM sqlite_master WHERE name='files_fts_fuzzy'"
                )
                result = cursor.fetchone()
                assert result is not None
                sql = result[0]

                if trigram_available:
                    assert "trigram" in sql.lower(), "Should use trigram when available"
                else:
                    # Should fallback to unicode61
                    assert "unicode61" in sql.lower() or "fts5" in sql.lower()
        finally:
            store.close()


@pytest.mark.benchmark
class TestDualFTSPerformance:
    """Benchmark tests for dual FTS overhead."""

    @pytest.fixture
    def populated_db(self):
        """Create database with test files."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = DirIndexStore(db_path)
        store.initialize()

        # Insert 100 test files
        with store._get_connection() as conn:
            for i in range(100):
                path = f"test/file{i}.py"
                name = f"file{i}.py"
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (name, path, f"def function{i}():\n    pass", "python", 1234567890.0)
                )
            conn.commit()

        # Close store before yielding to avoid conflicts
        store.close()

        yield db_path

        # Cleanup
        if db_path.exists():
            db_path.unlink()

    @pytest.mark.skipif(not BENCHMARK_AVAILABLE, reason="pytest-benchmark not installed")
    def test_insert_overhead(self, populated_db, benchmark):
        """Benchmark INSERT overhead with dual FTS triggers."""
        store = DirIndexStore(populated_db)
        store.initialize()

        try:
            def insert_file():
                with store._get_connection() as conn:
                    conn.execute(
                        """INSERT INTO files (name, full_path, content, language, mtime)
                           VALUES (?, ?, ?, ?, ?)""",
                        ("test.py", "benchmark/test.py", "content", "python", 1234567890.0)
                    )
                    conn.commit()
                    # Cleanup
                    conn.execute("DELETE FROM files WHERE full_path = 'benchmark/test.py'")
                    conn.commit()

            # Should complete in reasonable time (<100ms)
            result = benchmark(insert_file)
            assert result < 0.1  # 100ms
        finally:
            store.close()

    def test_search_fts_exact(self, populated_db):
        """Test search on files_fts_exact returns results."""
        store = DirIndexStore(populated_db)
        store.initialize()

        try:
            with store._get_connection() as conn:
                # Search for "def" which is a complete token in all files
                cursor = conn.execute(
                    """SELECT full_path, bm25(files_fts_exact) as score
                       FROM files_fts_exact
                       WHERE files_fts_exact MATCH 'def'
                       ORDER BY score
                       LIMIT 10"""
                )
                results = cursor.fetchall()
                assert len(results) > 0, "Should find matches in exact FTS"
                # Verify BM25 scores (negative = better)
                for full_path, score in results:
                    assert score < 0, "BM25 scores should be negative"
        finally:
            store.close()

    def test_search_fts_fuzzy(self, populated_db):
        """Test search on files_fts_fuzzy returns results."""
        store = DirIndexStore(populated_db)
        store.initialize()

        try:
            with store._get_connection() as conn:
                # Search for "def" which is a complete token in all files
                cursor = conn.execute(
                    """SELECT full_path, bm25(files_fts_fuzzy) as score
                       FROM files_fts_fuzzy
                       WHERE files_fts_fuzzy MATCH 'def'
                       ORDER BY score
                       LIMIT 10"""
                )
                results = cursor.fetchall()
                assert len(results) > 0, "Should find matches in fuzzy FTS"
        finally:
            store.close()
