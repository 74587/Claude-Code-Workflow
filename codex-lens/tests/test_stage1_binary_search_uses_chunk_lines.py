from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

from codexlens.config import VECTORS_META_DB_NAME, Config
from codexlens.search.chain_search import ChainSearchEngine, SearchStats
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore


def test_stage1_binary_search_prefers_chunk_start_line(tmp_path: Path) -> None:
    registry = RegistryStore(db_path=tmp_path / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=tmp_path / "indexes")
    engine = ChainSearchEngine(registry, mapper, config=Config(data_dir=tmp_path / "data"))

    try:
        index_root = tmp_path / "fake_index_root"
        index_root.mkdir(parents=True, exist_ok=True)
        index_db = index_root / "_index.db"
        index_db.write_text("", encoding="utf-8")
        (index_root / VECTORS_META_DB_NAME).write_text("", encoding="utf-8")

        class _DummyBinarySearcher:
            def search(self, query_dense, top_k: int):
                _ = query_dense
                _ = top_k
                return [(123, 10)]

        class _DummyEmbedder:
            def embed_to_numpy(self, texts):
                _ = texts
                return [[0.0]]

        dummy_meta_store = MagicMock()
        dummy_meta_store.get_chunks_by_ids.return_value = [
            {
                "chunk_id": 123,
                "file_path": str(tmp_path / "a.py"),
                "content": "def a():\n    return 1\n",
                "start_line": 12,
                "end_line": 14,
                "metadata": {},
                "category": "code",
            }
        ]

        with patch.object(engine, "_get_centralized_binary_searcher", return_value=_DummyBinarySearcher()):
            with patch("codexlens.search.chain_search.VectorMetadataStore", return_value=dummy_meta_store):
                with patch("codexlens.semantic.embedder.Embedder", return_value=_DummyEmbedder()):
                    coarse_results, returned_root = engine._stage1_binary_search(
                        "a",
                        [index_db],
                        coarse_k=1,
                        stats=SearchStats(),
                    )

        assert returned_root == index_root
        assert len(coarse_results) == 1
        assert coarse_results[0].start_line == 12
        assert coarse_results[0].end_line == 14
    finally:
        engine.close()


def test_stage1_binary_search_dense_fallback(tmp_path: Path) -> None:
    registry = RegistryStore(db_path=tmp_path / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=tmp_path / "indexes")
    engine = ChainSearchEngine(registry, mapper, config=Config(data_dir=tmp_path / "data"))

    try:
        index_root = tmp_path / "fake_index_root"
        index_root.mkdir(parents=True, exist_ok=True)
        index_db = index_root / "_index.db"
        index_db.write_text("", encoding="utf-8")
        (index_root / VECTORS_META_DB_NAME).write_text("", encoding="utf-8")

        class _DummyEmbedder:
            def embed_to_numpy(self, texts):
                _ = texts
                # Only dim matters for ANNIndex initialization
                return [[0.0, 1.0, 2.0]]

        class _DummyANNIndex:
            def __init__(self, *args, **kwargs) -> None:
                pass

            def load(self) -> bool:
                return True

            def count(self) -> int:
                return 1

            def search(self, query_vec, top_k: int = 10):
                _ = query_vec
                _ = top_k
                return [123], [0.2]

        dummy_meta_store = MagicMock()
        dummy_meta_store.get_chunks_by_ids.return_value = [
            {
                "chunk_id": 123,
                "file_path": str(tmp_path / "b.py"),
                "content": "def b():\n    return 2\n",
                "start_line": 20,
                "end_line": 22,
                "metadata": {},
                "category": "code",
            }
        ]

        with patch.object(engine, "_get_centralized_binary_searcher", return_value=None):
            with patch("codexlens.search.chain_search.VectorMetadataStore", return_value=dummy_meta_store):
                with patch("codexlens.semantic.embedder.Embedder", return_value=_DummyEmbedder()):
                    with patch("codexlens.semantic.ann_index.ANNIndex", _DummyANNIndex):
                        coarse_results, returned_root = engine._stage1_binary_search(
                            "b",
                            [index_db],
                            coarse_k=1,
                            stats=SearchStats(),
                        )

        assert returned_root == index_root
        assert len(coarse_results) == 1
        assert coarse_results[0].start_line == 20
        assert coarse_results[0].end_line == 22
        assert coarse_results[0].score == 0.8
    finally:
        engine.close()
