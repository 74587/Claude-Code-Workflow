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
