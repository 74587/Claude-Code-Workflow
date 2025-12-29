import sqlite3
import sys
import tempfile
import threading
import time
from pathlib import Path

import numpy as np
import pytest

from codexlens.entities import SemanticChunk
import codexlens.semantic.vector_store as vector_store_module
from codexlens.semantic.vector_store import VectorStore


@pytest.fixture()
def temp_db():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        yield Path(tmpdir) / "semantic.db"


def test_concurrent_bulk_insert(monkeypatch: pytest.MonkeyPatch, temp_db: Path) -> None:
    """Concurrent batch inserts in bulk mode should not corrupt accumulation state."""
    store = VectorStore(temp_db)
    monkeypatch.setattr(store, "_ensure_ann_index", lambda dim: True)

    store.begin_bulk_insert()

    errors: list[Exception] = []
    lock = threading.Lock()
    threads: list[threading.Thread] = []

    def make_chunks(count: int, dim: int) -> list[SemanticChunk]:
        chunks: list[SemanticChunk] = []
        for i in range(count):
            chunk = SemanticChunk(content=f"chunk {i}", metadata={})
            chunk.embedding = np.random.randn(dim).astype(np.float32)
            chunks.append(chunk)
        return chunks

    def worker(idx: int) -> None:
        try:
            dim = 8
            if idx % 2 == 0:
                chunks = make_chunks(5, dim)
                store.add_chunks_batch([(c, f"file_{idx}.py") for c in chunks], auto_save_ann=False)
            else:
                chunks = [SemanticChunk(content=f"chunk {i}") for i in range(5)]
                embeddings = np.random.randn(5, dim).astype(np.float32)
                store.add_chunks_batch_numpy(
                    [(c, f"file_{idx}.py") for c in chunks],
                    embeddings_matrix=embeddings,
                    auto_save_ann=False,
                )
        except Exception as exc:
            with lock:
                errors.append(exc)

    for i in range(10):
        threads.append(threading.Thread(target=worker, args=(i,)))

    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert not errors
    assert len(store._bulk_insert_ids) == 50
    assert len(store._bulk_insert_embeddings) == 50
    assert store.count_chunks() == 50


def test_bulk_insert_mode_transitions(monkeypatch: pytest.MonkeyPatch, temp_db: Path) -> None:
    """begin/end bulk insert should be thread-safe with concurrent add operations."""
    store = VectorStore(temp_db)

    class DummyAnn:
        def __init__(self) -> None:
            self.total_added = 0
            self.save_calls = 0

        def add_vectors(self, ids, embeddings) -> None:
            self.total_added += len(ids)

        def save(self) -> None:
            self.save_calls += 1

    dummy_ann = DummyAnn()
    store._ann_index = dummy_ann
    monkeypatch.setattr(store, "_ensure_ann_index", lambda dim: True)

    errors: list[Exception] = []
    lock = threading.Lock()
    stop_event = threading.Event()

    def adder(worker_id: int) -> None:
        try:
            while not stop_event.is_set():
                chunk = SemanticChunk(content=f"chunk {worker_id}", metadata={})
                chunk.embedding = np.random.randn(8).astype(np.float32)
                store.add_chunks_batch([(chunk, f"file_{worker_id}.py")], auto_save_ann=False)
        except Exception as exc:
            with lock:
                errors.append(exc)

    def toggler() -> None:
        try:
            for _ in range(5):
                store.begin_bulk_insert()
                time.sleep(0.05)
                store.end_bulk_insert()
                time.sleep(0.05)
        except Exception as exc:
            with lock:
                errors.append(exc)

    threads = [threading.Thread(target=adder, args=(i,)) for i in range(3)]
    toggle_thread = threading.Thread(target=toggler)

    for t in threads:
        t.start()
    toggle_thread.start()

    toggle_thread.join(timeout=10)
    stop_event.set()
    for t in threads:
        t.join(timeout=10)

    assert not errors
    assert toggle_thread.is_alive() is False
    assert store._bulk_insert_mode is False
    assert store._bulk_insert_ids == []
    assert store._bulk_insert_embeddings == []
    assert dummy_ann.total_added == store.count_chunks()


def test_search_similar_min_score_validation(monkeypatch: pytest.MonkeyPatch, temp_db: Path) -> None:
    """search_similar should validate min_score is within [0.0, 1.0]."""
    monkeypatch.setattr(vector_store_module, "HNSWLIB_AVAILABLE", False)
    store = VectorStore(temp_db)

    chunk_a = SemanticChunk(content="chunk A", metadata={})
    chunk_a.embedding = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    chunk_b = SemanticChunk(content="chunk B", metadata={})
    chunk_b.embedding = np.array([0.0, 1.0, 0.0], dtype=np.float32)
    store.add_chunks_batch([(chunk_a, "a.py"), (chunk_b, "b.py")])

    query = [1.0, 0.0, 0.0]

    with pytest.raises(ValueError, match=r"min_score.*\[0\.0, 1\.0\].*cosine"):
        store.search_similar(query, min_score=-0.5)

    with pytest.raises(ValueError, match=r"min_score.*\[0\.0, 1\.0\].*cosine"):
        store.search_similar(query, min_score=1.5)

    store.search_similar(query, min_score=0.0)
    store.search_similar(query, min_score=1.0)

    results = store.search_similar(query, min_score=0.5, return_full_content=False)
    assert [r.path for r in results] == ["a.py"]


def test_search_similar(monkeypatch: pytest.MonkeyPatch, temp_db: Path) -> None:
    """search_similar returns results ordered by descending similarity."""
    monkeypatch.setattr(vector_store_module, "HNSWLIB_AVAILABLE", False)
    store = VectorStore(temp_db)

    chunk_a = SemanticChunk(content="chunk A", metadata={})
    chunk_a.embedding = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    chunk_b = SemanticChunk(content="chunk B", metadata={})
    chunk_b.embedding = np.array([0.0, 1.0, 0.0], dtype=np.float32)
    store.add_chunks_batch([(chunk_a, "a.py"), (chunk_b, "b.py")])

    results = store.search_similar([1.0, 0.0, 0.0], top_k=10, min_score=0.0, return_full_content=False)

    assert [r.path for r in results] == ["a.py", "b.py"]
    assert results[0].score == pytest.approx(1.0)
    assert results[1].score == pytest.approx(0.0)


def test_search_with_ann_null_results(monkeypatch: pytest.MonkeyPatch, temp_db: Path) -> None:
    """_search_with_ann should return [] when ANN search returns null results."""
    monkeypatch.setattr(vector_store_module, "HNSWLIB_AVAILABLE", False)
    store = VectorStore(temp_db)

    class DummyAnn:
        def count(self) -> int:
            return 1

        def search(self, query_vec: np.ndarray, top_k: int):
            return None, None

    store._ann_index = DummyAnn()

    results = store._search_with_ann(np.array([1.0, 0.0, 0.0], dtype=np.float32), top_k=10, min_score=0.0, return_full_content=False)
    assert results == []


def test_search_with_ann_empty_results(monkeypatch: pytest.MonkeyPatch, temp_db: Path) -> None:
    """_search_with_ann should return [] when ANN search returns empty results."""
    monkeypatch.setattr(vector_store_module, "HNSWLIB_AVAILABLE", False)
    store = VectorStore(temp_db)

    class DummyAnn:
        def count(self) -> int:
            return 1

        def search(self, query_vec: np.ndarray, top_k: int):
            return [], []

    store._ann_index = DummyAnn()

    results = store._search_with_ann(np.array([1.0, 0.0, 0.0], dtype=np.float32), top_k=10, min_score=0.0, return_full_content=False)
    assert results == []


def test_search_with_ann_mismatched_results(monkeypatch: pytest.MonkeyPatch, temp_db: Path) -> None:
    """_search_with_ann should return [] when ANN search returns mismatched results."""
    monkeypatch.setattr(vector_store_module, "HNSWLIB_AVAILABLE", False)
    store = VectorStore(temp_db)

    class DummyAnn:
        def count(self) -> int:
            return 2

        def search(self, query_vec: np.ndarray, top_k: int):
            return [1, 2], [0.5]

    store._ann_index = DummyAnn()

    results = store._search_with_ann(np.array([1.0, 0.0, 0.0], dtype=np.float32), top_k=10, min_score=0.0, return_full_content=False)
    assert results == []


def test_search_with_ann_valid_results(monkeypatch: pytest.MonkeyPatch, temp_db: Path) -> None:
    """_search_with_ann should return results for valid ANN outputs."""
    monkeypatch.setattr(vector_store_module, "HNSWLIB_AVAILABLE", False)
    store = VectorStore(temp_db)

    chunk = SemanticChunk(content="chunk A", metadata={})
    chunk.embedding = np.array([1.0, 0.0, 0.0], dtype=np.float32)
    chunk_id = store.add_chunk(chunk, "a.py")

    class DummyAnn:
        def count(self) -> int:
            return 1

        def search(self, query_vec: np.ndarray, top_k: int):
            return [chunk_id], [0.0]

    store._ann_index = DummyAnn()

    results = store._search_with_ann(np.array([1.0, 0.0, 0.0], dtype=np.float32), top_k=10, min_score=0.0, return_full_content=False)
    assert [r.path for r in results] == ["a.py"]
    assert results[0].score == pytest.approx(1.0)


def test_add_chunks_batch_overflow(monkeypatch: pytest.MonkeyPatch, temp_db: Path) -> None:
    """add_chunks_batch should fail fast when generated IDs would exceed SQLite/sys bounds."""
    monkeypatch.setattr(vector_store_module, "HNSWLIB_AVAILABLE", False)
    store = VectorStore(temp_db)

    seed_embedding = np.array([1.0, 0.0, 0.0], dtype=np.float32).tobytes()
    with sqlite3.connect(store.db_path) as conn:
        conn.execute(
            "INSERT INTO semantic_chunks (id, file_path, content, embedding, metadata) VALUES (?, ?, ?, ?, ?)",
            (sys.maxsize - 5, "seed.py", "seed", seed_embedding, None),
        )
        conn.commit()

    chunks_with_paths: list[tuple[SemanticChunk, str]] = []
    for i in range(10):
        chunks_with_paths.append(
            (
                SemanticChunk(content=f"chunk {i}", metadata={}, embedding=[1.0, 0.0, 0.0]),
                f"file_{i}.py",
            )
        )

    with pytest.raises(ValueError, match=r"Chunk ID range overflow"):
        store.add_chunks_batch(chunks_with_paths)


def test_add_chunks_batch_generates_sequential_ids(monkeypatch: pytest.MonkeyPatch, temp_db: Path) -> None:
    """add_chunks_batch should return sequential IDs for a fresh store."""
    monkeypatch.setattr(vector_store_module, "HNSWLIB_AVAILABLE", False)
    store = VectorStore(temp_db)

    chunks_with_paths = [
        (SemanticChunk(content="chunk A", metadata={}, embedding=[1.0, 0.0, 0.0]), "a.py"),
        (SemanticChunk(content="chunk B", metadata={}, embedding=[0.0, 1.0, 0.0]), "b.py"),
    ]

    ids = store.add_chunks_batch(chunks_with_paths, update_ann=False)
    assert ids == [1, 2]
    assert store.count_chunks() == 2


def test_add_chunks_batch_numpy_overflow(monkeypatch: pytest.MonkeyPatch, temp_db: Path) -> None:
    """add_chunks_batch_numpy should fail fast when generated IDs would exceed SQLite/sys bounds."""
    monkeypatch.setattr(vector_store_module, "HNSWLIB_AVAILABLE", False)
    store = VectorStore(temp_db)

    seed_embedding = np.array([1.0, 0.0, 0.0], dtype=np.float32).tobytes()
    with sqlite3.connect(store.db_path) as conn:
        conn.execute(
            "INSERT INTO semantic_chunks (id, file_path, content, embedding, metadata) VALUES (?, ?, ?, ?, ?)",
            (sys.maxsize - 5, "seed.py", "seed", seed_embedding, None),
        )
        conn.commit()

    chunks_with_paths = [
        (SemanticChunk(content=f"chunk {i}", metadata={}), f"file_{i}.py")
        for i in range(10)
    ]
    embeddings = np.random.randn(10, 3).astype(np.float32)

    with pytest.raises(ValueError, match=r"Chunk ID range overflow"):
        store.add_chunks_batch_numpy(chunks_with_paths, embeddings)


def test_fetch_results_by_ids(monkeypatch: pytest.MonkeyPatch, temp_db: Path) -> None:
    """_fetch_results_by_ids should use parameterized IN queries and return ordered results."""
    store = VectorStore(temp_db)

    calls: list[tuple[str, str, object]] = []
    rows = [
        (1, "a.py", "content A", None),
        (2, "b.py", "content B", None),
    ]

    class DummyCursor:
        def __init__(self, result_rows):
            self._rows = result_rows

        def fetchall(self):
            return self._rows

    class DummyConn:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, query, params=None):
            if isinstance(query, str) and query.strip().upper().startswith("PRAGMA"):
                calls.append(("pragma", query, params))
                return DummyCursor([])
            calls.append(("query", query, params))
            return DummyCursor(rows)

    monkeypatch.setattr(vector_store_module.sqlite3, "connect", lambda _: DummyConn())

    chunk_ids = [1, 2]
    scores = [0.9, 0.8]
    results = store._fetch_results_by_ids(chunk_ids, scores, return_full_content=False)

    assert [r.path for r in results] == ["a.py", "b.py"]
    assert [r.score for r in results] == scores
    assert all(r.content is None for r in results)

    assert any(kind == "pragma" for kind, _, _ in calls)
    _, query, params = next((c for c in calls if c[0] == "query"), ("", "", None))
    expected_query = """
            SELECT id, file_path, content, metadata
            FROM semantic_chunks
            WHERE id IN ({placeholders})
        """.format(placeholders=",".join("?" * len(chunk_ids)))
    assert query == expected_query
    assert params == chunk_ids

    assert store._fetch_results_by_ids([], [], return_full_content=False) == []


def test_fetch_results_sql_safety() -> None:
    """Placeholder generation and validation should prevent unsafe SQL interpolation."""
    for count in (0, 1, 10, 100):
        placeholders = ",".join("?" * count)
        vector_store_module._validate_sql_placeholders(placeholders, count)

    with pytest.raises(ValueError):
        vector_store_module._validate_sql_placeholders("?,?); DROP TABLE semantic_chunks;--", 2)

    with pytest.raises(ValueError):
        vector_store_module._validate_sql_placeholders("?,?", 3)
