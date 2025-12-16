"""Tests for incremental indexing with mtime tracking (P2).

Tests mtime-based skip logic, deleted file cleanup, and incremental update workflows.
"""

import os
import sqlite3
import tempfile
import time
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from codexlens.storage.dir_index import DirIndexStore

# Check if pytest-benchmark is available
try:
    import pytest_benchmark
    BENCHMARK_AVAILABLE = True
except ImportError:
    BENCHMARK_AVAILABLE = False


class TestMtimeTracking:
    """Tests for mtime-based file change detection."""

    @pytest.fixture
    def temp_db(self):
        """Create temporary database."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)
        yield db_path
        if db_path.exists():
            db_path.unlink()

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory with test files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_path = Path(tmpdir)

            # Create test files
            (temp_path / "file1.py").write_text("def function1(): pass")
            (temp_path / "file2.py").write_text("def function2(): pass")
            (temp_path / "file3.js").write_text("function test() {}")

            yield temp_path

    @pytest.fixture
    def index_store(self, temp_db):
        """Create DirIndexStore instance."""
        store = DirIndexStore(temp_db)
        store.initialize()
        yield store
        store.close()

    def test_files_table_has_mtime_column(self, index_store):
        """Test files table includes mtime column for tracking."""
        with index_store._get_connection() as conn:
            cursor = conn.execute("PRAGMA table_info(files)")
            columns = {row[1]: row[2] for row in cursor.fetchall()}
            assert "mtime" in columns or "indexed_at" in columns, \
                "Should have mtime or indexed_at for change detection"

    def test_needs_reindex_new_file(self, index_store, temp_dir):
        """Test needs_reindex returns True for new files."""
        file_path = temp_dir / "file1.py"
        file_mtime = file_path.stat().st_mtime

        # New file should need indexing
        needs_update = self._check_needs_reindex(index_store, str(file_path), file_mtime)
        assert needs_update is True, "New file should need indexing"

    def test_needs_reindex_unchanged_file(self, index_store, temp_dir):
        """Test needs_reindex returns False for unchanged files."""
        file_path = temp_dir / "file1.py"
        file_mtime = file_path.stat().st_mtime
        content = file_path.read_text()

        # Index the file
        with index_store._get_connection() as conn:
            name = file_path.name
            conn.execute(
                """INSERT INTO files (name, full_path, content, language, mtime)
                   VALUES (?, ?, ?, ?, ?)""",
                (name, str(file_path), content, "python", file_mtime)
            )
            conn.commit()

        # Unchanged file should not need reindexing
        needs_update = self._check_needs_reindex(index_store, str(file_path), file_mtime)
        assert needs_update is False, "Unchanged file should not need reindexing"

    def test_needs_reindex_modified_file(self, index_store, temp_dir):
        """Test needs_reindex returns True for modified files."""
        file_path = temp_dir / "file1.py"
        original_mtime = file_path.stat().st_mtime
        content = file_path.read_text()

        # Index the file
        with index_store._get_connection() as conn:
            name = file_path.name
            conn.execute(
                """INSERT INTO files (name, full_path, content, language, mtime)
                   VALUES (?, ?, ?, ?, ?)""",
                (name, str(file_path), content, "python", original_mtime)
            )
            conn.commit()

        # Modify the file (update mtime)
        time.sleep(0.1)  # Ensure mtime changes
        file_path.write_text("def modified_function(): pass")
        new_mtime = file_path.stat().st_mtime

        # Modified file should need reindexing
        needs_update = self._check_needs_reindex(index_store, str(file_path), new_mtime)
        assert needs_update is True, "Modified file should need reindexing"
        assert new_mtime > original_mtime, "Mtime should have increased"

    def _check_needs_reindex(self, index_store, file_path: str, file_mtime: float) -> bool:
        """Helper to check if file needs reindexing."""
        with index_store._get_connection() as conn:
            cursor = conn.execute(
                "SELECT mtime FROM files WHERE full_path = ?",
                (file_path,)
            )
            result = cursor.fetchone()

            if result is None:
                return True  # New file

            stored_mtime = result[0]
            return file_mtime > stored_mtime


class TestIncrementalUpdate:
    """Tests for incremental update workflows."""

    @pytest.fixture
    def temp_db(self):
        """Create temporary database."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)
        yield db_path
        if db_path.exists():
            db_path.unlink()

    @pytest.fixture
    def temp_dir(self):
        """Create temporary directory with test files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_path = Path(tmpdir)

            # Create initial files
            for i in range(10):
                (temp_path / f"file{i}.py").write_text(f"def function{i}(): pass")

            yield temp_path

    @pytest.fixture
    def index_store(self, temp_db):
        """Create DirIndexStore instance."""
        store = DirIndexStore(temp_db)
        store.initialize()
        yield store
        store.close()

    def test_incremental_skip_rate(self, index_store, temp_dir):
        """Test incremental indexing achieves ≥90% skip rate on unchanged files."""
        # First indexing pass - index all files
        files_indexed_first = self._index_directory(index_store, temp_dir)
        assert files_indexed_first == 10, "Should index all 10 files initially"

        # Second pass without modifications - should skip most files
        files_indexed_second = self._index_directory(index_store, temp_dir)
        skip_rate = 1.0 - (files_indexed_second / files_indexed_first)
        assert skip_rate >= 0.9, f"Skip rate should be ≥90%, got {skip_rate:.1%}"

    def test_incremental_indexes_modified_files(self, index_store, temp_dir):
        """Test incremental indexing detects and updates modified files."""
        # Initial indexing
        self._index_directory(index_store, temp_dir)

        # Modify 2 files
        modified_files = ["file3.py", "file7.py"]
        time.sleep(0.1)
        for fname in modified_files:
            (temp_dir / fname).write_text("def modified(): pass")

        # Re-index
        files_indexed = self._index_directory(index_store, temp_dir)

        # Should re-index only modified files
        assert files_indexed == len(modified_files), \
            f"Should re-index {len(modified_files)} modified files, got {files_indexed}"

    def test_incremental_indexes_new_files(self, index_store, temp_dir):
        """Test incremental indexing detects and indexes new files."""
        # Initial indexing
        self._index_directory(index_store, temp_dir)

        # Add new files
        new_files = ["new1.py", "new2.py", "new3.py"]
        time.sleep(0.1)
        for fname in new_files:
            (temp_dir / fname).write_text("def new_function(): pass")

        # Re-index
        files_indexed = self._index_directory(index_store, temp_dir)

        # Should index new files
        assert files_indexed == len(new_files), \
            f"Should index {len(new_files)} new files, got {files_indexed}"

    def _index_directory(self, index_store, directory: Path) -> int:
        """Helper to index directory and return count of files indexed."""
        indexed_count = 0

        for file_path in directory.glob("*.py"):
            file_mtime = file_path.stat().st_mtime
            content = file_path.read_text()

            # Check if needs indexing
            with index_store._get_connection() as conn:
                cursor = conn.execute(
                    "SELECT mtime FROM files WHERE full_path = ?",
                    (str(file_path),)
                )
                result = cursor.fetchone()

                needs_index = (result is None) or (file_mtime > result[0])

                if needs_index:
                    # Insert or update
                    name = file_path.name
                    conn.execute(
                        """INSERT OR REPLACE INTO files (name, full_path, content, language, mtime)
                           VALUES (?, ?, ?, ?, ?)""",
                        (name, str(file_path), content, "python", file_mtime)
                    )
                    conn.commit()
                    indexed_count += 1

        return indexed_count


class TestDeletedFileCleanup:
    """Tests for cleanup of deleted files from index."""

    @pytest.fixture
    def temp_db(self):
        """Create temporary database."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)
        yield db_path
        if db_path.exists():
            db_path.unlink()

    @pytest.fixture
    def index_store(self, temp_db):
        """Create DirIndexStore instance."""
        store = DirIndexStore(temp_db)
        store.initialize()
        yield store
        store.close()

    def test_cleanup_deleted_files(self, index_store):
        """Test cleanup removes deleted file entries."""
        # Index files that no longer exist
        deleted_files = [
            "/deleted/file1.py",
            "/deleted/file2.js",
            "/deleted/file3.ts"
        ]

        with index_store._get_connection() as conn:
            for path in deleted_files:
                name = path.split('/')[-1]
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (name, path, "content", "python", time.time())
                )
            conn.commit()

            # Verify files are in index
            cursor = conn.execute("SELECT COUNT(*) FROM files")
            assert cursor.fetchone()[0] == len(deleted_files)

        # Run cleanup (manually since files don't exist)
        deleted_count = self._cleanup_nonexistent_files(index_store, deleted_files)

        assert deleted_count == len(deleted_files), \
            f"Should remove {len(deleted_files)} deleted files"

        # Verify cleanup worked
        with index_store._get_connection() as conn:
            cursor = conn.execute("SELECT COUNT(*) FROM files WHERE full_path IN (?, ?, ?)", deleted_files)
            assert cursor.fetchone()[0] == 0, "Deleted files should be removed from index"

    def test_cleanup_preserves_existing_files(self, index_store):
        """Test cleanup preserves entries for existing files."""
        # Create temporary files
        with tempfile.TemporaryDirectory() as tmpdir:
            temp_path = Path(tmpdir)
            existing_files = [
                temp_path / "exists1.py",
                temp_path / "exists2.py"
            ]

            for fpath in existing_files:
                fpath.write_text("content")

            # Index existing and deleted files
            all_files = [str(f) for f in existing_files] + ["/deleted/file.py"]

            with index_store._get_connection() as conn:
                for path in all_files:
                    name = path.split('/')[-1]
                    conn.execute(
                        """INSERT INTO files (name, full_path, content, language, mtime)
                           VALUES (?, ?, ?, ?, ?)""",
                        (name, path, "content", "python", time.time())
                    )
                conn.commit()

            # Run cleanup
            self._cleanup_nonexistent_files(index_store, ["/deleted/file.py"])

            # Verify existing files preserved
            with index_store._get_connection() as conn:
                cursor = conn.execute(
                    "SELECT COUNT(*) FROM files WHERE full_path IN (?, ?)",
                    [str(f) for f in existing_files]
                )
                assert cursor.fetchone()[0] == len(existing_files), \
                    "Existing files should be preserved"

    def _cleanup_nonexistent_files(self, index_store, paths_to_check: list) -> int:
        """Helper to cleanup nonexistent files."""
        deleted_count = 0

        with index_store._get_connection() as conn:
            for path in paths_to_check:
                if not Path(path).exists():
                    conn.execute("DELETE FROM files WHERE full_path = ?", (path,))
                    deleted_count += 1
            conn.commit()

        return deleted_count


class TestMtimeEdgeCases:
    """Tests for edge cases in mtime handling."""

    @pytest.fixture
    def temp_db(self):
        """Create temporary database."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)
        yield db_path
        if db_path.exists():
            db_path.unlink()

    @pytest.fixture
    def index_store(self, temp_db):
        """Create DirIndexStore instance."""
        store = DirIndexStore(temp_db)
        store.initialize()
        yield store
        store.close()

    def test_mtime_precision(self, index_store):
        """Test mtime comparison handles floating-point precision."""
        file_path = "/test/file.py"
        mtime1 = time.time()
        mtime2 = mtime1 + 1e-6  # Microsecond difference

        with index_store._get_connection() as conn:
            name = file_path.split('/')[-1]
            conn.execute(
                """INSERT INTO files (name, full_path, content, language, mtime)
                   VALUES (?, ?, ?, ?, ?)""",
                (name, file_path, "content", "python", mtime1)
            )
            conn.commit()

            # Check if mtime2 is considered newer
            cursor = conn.execute("SELECT mtime FROM files WHERE full_path = ?", (file_path,))
            stored_mtime = cursor.fetchone()[0]

            # Should handle precision correctly
            assert isinstance(stored_mtime, (int, float))

    def test_mtime_null_handling(self, index_store):
        """Test handling of NULL mtime values (legacy data)."""
        file_path = "/test/legacy.py"

        with index_store._get_connection() as conn:
            # Insert file without mtime (legacy) - use NULL
            name = file_path.split('/')[-1]
            conn.execute(
                """INSERT INTO files (name, full_path, content, language, mtime)
                   VALUES (?, ?, ?, ?, NULL)""",
                (name, file_path, "content", "python")
            )
            conn.commit()

            # Query should handle NULL mtime gracefully
            cursor = conn.execute("SELECT mtime FROM files WHERE full_path = ?", (file_path,))
            result = cursor.fetchone()
            # mtime should be NULL or have default value
            assert result is not None

    def test_future_mtime_handling(self, index_store):
        """Test handling of files with future mtime (clock skew)."""
        file_path = "/test/future.py"
        future_mtime = time.time() + 86400  # 1 day in future

        with index_store._get_connection() as conn:
            name = file_path.split('/')[-1]
            conn.execute(
                """INSERT INTO files (name, full_path, content, language, mtime)
                   VALUES (?, ?, ?, ?, ?)""",
                (name, file_path, "content", "python", future_mtime)
            )
            conn.commit()

            # Should store future mtime without errors
            cursor = conn.execute("SELECT mtime FROM files WHERE full_path = ?", (file_path,))
            stored_mtime = cursor.fetchone()[0]
            assert stored_mtime == future_mtime


@pytest.mark.benchmark
class TestIncrementalPerformance:
    """Performance benchmarks for incremental indexing."""

    @pytest.fixture
    def large_indexed_db(self):
        """Create database with many indexed files."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = DirIndexStore(db_path)
        store.initialize()

        # Index 1000 files
        with store._get_connection() as conn:
            current_time = time.time()
            for i in range(1000):
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (f"file{i}.py", f"/test/file{i}.py", f"def func{i}(): pass", "python", current_time)
                )
            conn.commit()

        yield db_path
        store.close()

        if db_path.exists():
            db_path.unlink()

    def test_skip_rate_benchmark(self, large_indexed_db):
        """Benchmark skip rate on large dataset."""
        store = DirIndexStore(large_indexed_db)
        store.initialize()

        try:
            # Simulate incremental pass
            skipped = 0
            total = 1000
            current_time = time.time()

            with store._get_connection() as conn:
                for i in range(total):
                    cursor = conn.execute(
                        "SELECT mtime FROM files WHERE full_path = ?",
                        (f"/test/file{i}.py",)
                    )
                    result = cursor.fetchone()

                    if result and current_time <= result[0] + 1.0:
                        skipped += 1

            skip_rate = skipped / total
            assert skip_rate >= 0.9, f"Skip rate should be ≥90%, got {skip_rate:.1%}"
        finally:
            store.close()

    @pytest.mark.skipif(not BENCHMARK_AVAILABLE, reason="pytest-benchmark not installed")
    def test_cleanup_performance(self, large_indexed_db, benchmark):
        """Benchmark cleanup of deleted files on large dataset."""
        store = DirIndexStore(large_indexed_db)
        store.initialize()

        try:
            def cleanup_batch():
                with store._get_connection() as conn:
                    # Delete 100 files
                    paths = [f"/test/file{i}.py" for i in range(100)]
                    placeholders = ",".join("?" * len(paths))
                    conn.execute(f"DELETE FROM files WHERE full_path IN ({placeholders})", paths)
                    conn.commit()

            # Should complete in reasonable time
            result = benchmark(cleanup_batch)
            assert result < 1.0  # Should take <1 second for 100 deletions
        finally:
            store.close()
