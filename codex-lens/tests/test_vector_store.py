import tempfile
import threading
from pathlib import Path

import numpy as np
import pytest

from codexlens.entities import SemanticChunk
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

