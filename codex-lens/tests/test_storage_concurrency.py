"""Concurrency tests for CodexLens storage managers."""

from __future__ import annotations

import threading
import time
import tempfile
from pathlib import Path

import pytest

from codexlens.entities import IndexedFile, Symbol
from codexlens.storage.dir_index import DirIndexStore
from codexlens.storage.registry import RegistryStore
from codexlens.storage.sqlite_store import SQLiteStore


@pytest.fixture(scope="module")
def populated_store():
    """Create a SQLiteStore populated with 1000+ files across multiple directories."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "concurrency.db"
        store = SQLiteStore(db_path)
        store.initialize()

        files = []
        for i in range(1000):
            path = f"/test/dir_{i % 25}/file_{i}.py"
            content = f"# token_{i}\n\ndef func_{i}():\n    return {i}\n"
            symbols = [Symbol(name=f"func_{i}", kind="function", range=(1, 1))]
            files.append((IndexedFile(path=path, language="python", symbols=symbols), content))

        store.add_files(files)
        yield store
        store.close()


@pytest.fixture()
def registry_store(tmp_path):
    """Create a RegistryStore in a temporary database with a single registered project."""
    db_path = tmp_path / "registry.db"
    store = RegistryStore(db_path)
    store.initialize()
    store.register_project(source_root=tmp_path / "src", index_root=tmp_path / "idx")
    yield store
    store.close()


@pytest.fixture()
def dir_index_store(tmp_path):
    """Create a DirIndexStore for concurrency tests."""
    db_path = tmp_path / "_index.db"
    store = DirIndexStore(db_path)
    store.initialize()

    # Seed a few entries for read tests
    for i in range(10):
        store.add_file(
            name=f"file_{i}.py",
            full_path=tmp_path / f"file_{i}.py",
            content=f"# dir-index token_{i}\nprint({i})\n",
            language="python",
            symbols=[Symbol(name=f"sym_{i}", kind="function", range=(1, 1))],
        )

    yield store
    store.close()


@pytest.fixture()
def writable_store(tmp_path):
    """Create a fresh SQLiteStore for concurrent write tests."""
    db_path = tmp_path / "writes.db"
    store = SQLiteStore(db_path)
    store.initialize()
    yield store
    store.close()


class TestConcurrentReads:
    """Concurrent read tests for storage managers."""

    def test_concurrent_stats_same_query_consistent(self, populated_store):
        """Concurrent reads from 10 threads accessing the same stats query."""
        results = []
        errors = []
        lock = threading.Lock()

        def worker():
            try:
                stats = populated_store.stats()
                with lock:
                    results.append(stats)
            except Exception as exc:
                with lock:
                    errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        assert len(results) == 10
        assert all(r["files"] == 1000 for r in results)
        assert all(r["symbols"] == 1000 for r in results)

    def test_concurrent_file_exists_same_file(self, populated_store):
        """Concurrent reads from 10 threads checking the same file path."""
        target = "/test/dir_0/file_0.py"
        results = []
        errors = []
        lock = threading.Lock()

        def worker():
            try:
                ok = populated_store.file_exists(target)
                with lock:
                    results.append(ok)
            except Exception as exc:
                with lock:
                    errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        assert results == [True] * 10

    def test_concurrent_search_fts_same_token_consistent(self, populated_store):
        """Concurrent reads from 10 threads searching the same FTS token."""
        results = []
        errors = []
        lock = threading.Lock()

        def worker():
            try:
                matches = populated_store.search_fts("token_42")
                with lock:
                    results.append(len(matches))
            except Exception as exc:
                with lock:
                    errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        assert results == [1] * 10

    def test_concurrent_search_fts_different_tokens(self, populated_store):
        """Concurrent reads from 20 threads searching different tokens."""
        results = {}
        errors = []
        lock = threading.Lock()

        def worker(i: int):
            try:
                matches = populated_store.search_fts(f"token_{i}")
                with lock:
                    results[i] = len(matches)
            except Exception as exc:
                with lock:
                    errors.append(exc)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(20)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        assert len(results) == 20
        assert all(results[i] == 1 for i in range(20))

    def test_connection_pool_thread_local_isolation(self, populated_store):
        """Each thread should get a dedicated connection object."""
        conn_ids = []
        errors = []
        lock = threading.Lock()

        def worker():
            try:
                conn = populated_store._get_connection()
                with lock:
                    conn_ids.append(id(conn))
            except Exception as exc:
                with lock:
                    errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        assert len(set(conn_ids)) == len(conn_ids)

    def test_connection_reuse_within_thread(self, populated_store):
        """Connections should be reused within the same thread."""
        errors = []

        def worker():
            try:
                c1 = populated_store._get_connection()
                c2 = populated_store._get_connection()
                assert c1 is c2
            except Exception as exc:
                errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors

    def test_pool_cleanup_removes_dead_thread_connections(self, populated_store):
        """cleanup_stale_connections should remove connections for terminated threads."""
        created = []
        lock = threading.Lock()
        current_tid = threading.get_ident()

        def worker():
            conn = populated_store._get_connection()
            with lock:
                created.append(threading.get_ident())
            # allow the thread to end quickly

        threads = [threading.Thread(target=worker) for _ in range(15)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        # Ensure pool has entries for the threads we created
        assert len(populated_store._pool) >= 10

        populated_store._cleanup_stale_connections()
        # Main thread connection may remain active; all terminated thread connections must be removed.
        assert all(tid not in populated_store._pool for tid in created)
        assert set(populated_store._pool.keys()).issubset({current_tid})

    def test_pool_size_respects_max_after_sequential_load(self, populated_store):
        """Pool should stay within MAX_POOL_SIZE once stale threads are cleaned up."""
        max_pool_size = populated_store.MAX_POOL_SIZE

        def make_thread():
            def worker():
                populated_store._get_connection()

            t = threading.Thread(target=worker)
            t.start()
            t.join()

        # Create more than MAX_POOL_SIZE thread connections sequentially.
        for _ in range(max_pool_size + 8):
            make_thread()

        populated_store._cleanup_stale_connections()
        assert len(populated_store._pool) <= max_pool_size

    def test_read_throughput_measurement(self, populated_store):
        """Measure simple read throughput scaling by thread count."""
        target_paths = [f"/test/dir_{i % 25}/file_{i}.py" for i in range(200)]

        def run(thread_count: int) -> float:
            per_thread = 200
            errors = []

            def worker(offset: int):
                try:
                    for j in range(per_thread):
                        populated_store.file_exists(target_paths[(offset + j) % len(target_paths)])
                except Exception as exc:
                    errors.append(exc)

            threads = [threading.Thread(target=worker, args=(i,)) for i in range(thread_count)]
            start = time.time()
            for t in threads:
                t.start()
            for t in threads:
                t.join()
            duration = max(time.time() - start, 1e-6)

            assert not errors
            total_ops = thread_count * per_thread
            return total_ops / duration

        qps_1 = run(1)
        qps_5 = run(5)
        qps_10 = run(10)
        qps_20 = run(20)

        # Sanity: throughput is measurable (no zeros). Do not assert strict scaling
        # due to platform/GIL variability.
        assert qps_1 > 0
        assert qps_5 > 0
        assert qps_10 > 0
        assert qps_20 > 0

    def test_registry_store_concurrent_list_projects(self, registry_store):
        """RegistryStore should support concurrent read access across threads."""
        results = []
        errors = []
        lock = threading.Lock()

        def worker():
            try:
                projects = registry_store.list_projects()
                with lock:
                    results.append(len(projects))
            except Exception as exc:
                with lock:
                    errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        assert results == [1] * 10

    def test_dir_index_store_concurrent_list_files(self, dir_index_store):
        """DirIndexStore should support concurrent read listing via its internal lock."""
        results = []
        errors = []
        lock = threading.Lock()

        def worker():
            try:
                files = dir_index_store.list_files()
                with lock:
                    results.append(len(files))
            except Exception as exc:
                with lock:
                    errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        assert results == [10] * 10


class TestConcurrentWrites:
    """Concurrent write tests for SQLiteStore."""

    def test_concurrent_inserts_commit_all_rows(self, writable_store):
        """Concurrent inserts from 10 threads should commit all rows."""
        thread_count = 10
        files_per_thread = 10
        errors = []
        lock = threading.Lock()

        def worker(thread_index: int):
            try:
                for i in range(files_per_thread):
                    path = f"/write/thread_{thread_index}/file_{i}.py"
                    indexed_file = IndexedFile(
                        path=path,
                        language="python",
                        symbols=[Symbol(name=f"sym_{thread_index}_{i}", kind="function", range=(1, 1))],
                    )
                    content = f"# write_token_{thread_index}_{i}\nprint({i})\n"
                    writable_store.add_file(indexed_file, content)
            except Exception as exc:
                with lock:
                    errors.append(exc)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(thread_count)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        stats = writable_store.stats()
        assert stats["files"] == thread_count * files_per_thread
        assert stats["symbols"] == thread_count * files_per_thread

    def test_concurrent_updates_same_file_serializes(self, writable_store):
        """Concurrent updates to the same file should serialize and not lose writes."""
        target_path = "/write/shared.py"
        base = IndexedFile(
            path=target_path,
            language="python",
            symbols=[Symbol(name="base", kind="function", range=(1, 1))],
        )
        writable_store.add_file(base, "print('base')\n")

        update_contents = []
        errors = []
        lock = threading.Lock()

        def worker(version: int):
            try:
                content = f"print('v{version}')\n"
                indexed_file = IndexedFile(
                    path=target_path,
                    language="python",
                    symbols=[Symbol(name=f"v{version}", kind="function", range=(1, 1))],
                )
                writable_store.add_file(indexed_file, content)
                with lock:
                    update_contents.append(content)
            except Exception as exc:
                with lock:
                    errors.append(exc)

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(5)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors

        resolved = str(Path(target_path).resolve())
        rows = writable_store.execute_query("SELECT content FROM files WHERE path=?", (resolved,))
        assert len(rows) == 1
        assert rows[0]["content"] in set(update_contents)

    def test_wal_mode_is_active_for_thread_connections(self, writable_store):
        """PRAGMA journal_mode should be WAL for all thread-local connections."""
        modes = []
        errors = []
        lock = threading.Lock()

        def worker():
            try:
                conn = writable_store._get_connection()
                mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
                with lock:
                    modes.append(str(mode).lower())
            except Exception as exc:
                with lock:
                    errors.append(exc)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        assert modes
        assert all(mode == "wal" for mode in modes)

    def test_transaction_isolation_reader_sees_committed_state(self, writable_store):
        """Readers should not see uncommitted writer updates and should not block."""
        target_path = "/write/isolation.py"
        indexed_file = IndexedFile(path=target_path, language="python", symbols=[])
        writable_store.add_file(indexed_file, "print('original')\n")
        resolved = str(Path(target_path).resolve())

        writer_started = threading.Event()
        reader_done = threading.Event()
        errors = []
        lock = threading.Lock()
        observed = {"reader": None}
        updated_content = "print('updated')\n"

        def writer():
            try:
                conn = writable_store._get_connection()
                conn.execute("BEGIN IMMEDIATE")
                conn.execute(
                    "UPDATE files SET content=? WHERE path=?",
                    (updated_content, resolved),
                )
                writer_started.set()
                reader_done.wait(timeout=5)
                conn.commit()
            except Exception as exc:
                with lock:
                    errors.append(exc)

        def reader():
            try:
                writer_started.wait(timeout=5)
                conn = writable_store._get_connection()
                row = conn.execute("SELECT content FROM files WHERE path=?", (resolved,)).fetchone()
                observed["reader"] = row[0] if row else None
                reader_done.set()
            except Exception as exc:
                with lock:
                    errors.append(exc)

        threads = [threading.Thread(target=writer), threading.Thread(target=reader)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        assert observed["reader"] == "print('original')\n"

        rows = writable_store.execute_query("SELECT content FROM files WHERE path=?", (resolved,))
        assert rows[0]["content"] == updated_content

    def test_batch_insert_performance_and_counts(self, writable_store):
        """Batch inserts across threads should not lose rows."""
        thread_count = 10
        files_per_thread = 100
        errors = []
        lock = threading.Lock()

        def worker(thread_index: int):
            try:
                files = []
                for i in range(files_per_thread):
                    path = f"/write/batch_{thread_index}/file_{i}.py"
                    indexed_file = IndexedFile(
                        path=path,
                        language="python",
                        symbols=[
                            Symbol(name=f"sym_{thread_index}_{i}", kind="function", range=(1, 1))
                        ],
                    )
                    content = f"# batch_token_{thread_index}_{i}\nprint({i})\n"
                    files.append((indexed_file, content))

                writable_store.add_files(files)
            except Exception as exc:
                with lock:
                    errors.append(exc)

        start = time.time()
        threads = [threading.Thread(target=worker, args=(i,)) for i in range(thread_count)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        duration = max(time.time() - start, 1e-6)

        assert not errors
        stats = writable_store.stats()
        assert stats["files"] == thread_count * files_per_thread
        assert stats["symbols"] == thread_count * files_per_thread
        assert (thread_count * files_per_thread) / duration > 0

    def test_mixed_read_write_operations_no_errors(self, writable_store):
        """Mixed reader and writer threads should complete without exceptions."""
        writer_threads = 5
        reader_threads = 10
        writes_per_writer = 20
        reads_per_reader = 50

        errors = []
        lock = threading.Lock()
        target_paths = [
            f"/write/mixed_{w}/file_{i}.py"
            for w in range(writer_threads)
            for i in range(writes_per_writer)
        ]

        def writer(worker_index: int):
            try:
                for i in range(writes_per_writer):
                    path = f"/write/mixed_{worker_index}/file_{i}.py"
                    indexed_file = IndexedFile(path=path, language="python", symbols=[])
                    writable_store.add_file(indexed_file, f"# mixed\nprint({i})\n")
            except Exception as exc:
                with lock:
                    errors.append(exc)

        def reader(worker_index: int):
            try:
                for i in range(reads_per_reader):
                    path = target_paths[(worker_index + i) % len(target_paths)]
                    writable_store.file_exists(path)
            except Exception as exc:
                with lock:
                    errors.append(exc)

        threads = [
            *[threading.Thread(target=writer, args=(i,)) for i in range(writer_threads)],
            *[threading.Thread(target=reader, args=(i,)) for i in range(reader_threads)],
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors
        stats = writable_store.stats()
        assert stats["files"] == writer_threads * writes_per_writer
