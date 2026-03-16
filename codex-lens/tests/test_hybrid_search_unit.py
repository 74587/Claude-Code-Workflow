"""Unit tests for HybridSearchEngine - parallel search and RRF fusion.

Tests cover:
- search: exact only, fuzzy enabled, vector enabled, pure vector mode
- search: RRF fusion, empty query, no results, reranking, category filtering
- _search_parallel: parallel backend execution
- _search_lsp_graph: LSP graph expansion with seeds, vector-to-FTS fallback
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Dict, List
from unittest.mock import MagicMock, Mock, patch, PropertyMock

import pytest

from codexlens.config import Config
from codexlens.entities import SearchResult
from codexlens.search.hybrid_search import HybridSearchEngine


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def temp_paths():
    """Create temporary directory structure with a mock index."""
    tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    root = Path(tmpdir.name)
    # Create a non-empty index file to pass the empty-file guard
    index_path = root / "_index.db"
    index_path.write_bytes(b"\x00" * 100)
    yield root
    try:
        tmpdir.cleanup()
    except (PermissionError, OSError):
        pass


@pytest.fixture
def mock_config():
    """Create mock config for hybrid search."""
    config = MagicMock(spec=Config)
    config.embedding_use_gpu = False
    config.enable_reranking = False
    config.enable_cross_encoder_rerank = False
    config.symbol_boost_factor = 1.5
    config.fusion_method = "rrf"
    config.rrf_k = 60
    config.enable_category_filter = True
    return config


@pytest.fixture
def sample_results() -> List[SearchResult]:
    """Create sample search results."""
    return [
        SearchResult(
            path="auth.py",
            score=0.9,
            excerpt="def authenticate(user):",
            symbol_name="authenticate",
            symbol_kind="function",
        ),
        SearchResult(
            path="login.py",
            score=0.7,
            excerpt="class LoginHandler:",
            symbol_name="LoginHandler",
            symbol_kind="class",
        ),
    ]


# =============================================================================
# Tests: search with different backends
# =============================================================================


class TestHybridSearchBackends:
    """Tests for HybridSearchEngine.search() backend configurations."""

    def test_search_exact_only(self, temp_paths, mock_config):
        """Search with only exact FTS backend."""
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        with patch.object(engine, "_search_parallel") as mock_parallel:
            mock_parallel.return_value = {
                "exact": [
                    SearchResult(path="a.py", score=10.0, excerpt="result"),
                ]
            }

            results = engine.search(
                index_path, "test query",
                enable_fuzzy=False, enable_vector=False,
            )

            assert len(results) == 1
            # Verify only exact backend was requested
            call_args = mock_parallel.call_args
            backends = call_args[0][2]  # 3rd positional arg
            assert "exact" in backends
            assert "fuzzy" not in backends
            assert "vector" not in backends

    def test_search_fuzzy_enabled(self, temp_paths, mock_config):
        """Search with exact + fuzzy backends."""
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        with patch.object(engine, "_search_parallel") as mock_parallel:
            mock_parallel.return_value = {
                "exact": [SearchResult(path="a.py", score=10.0, excerpt="exact")],
                "fuzzy": [SearchResult(path="b.py", score=8.0, excerpt="fuzzy")],
            }

            results = engine.search(
                index_path, "test_query",
                enable_fuzzy=True, enable_vector=False,
            )

            assert len(results) >= 1
            backends = mock_parallel.call_args[0][2]
            assert "exact" in backends
            assert "fuzzy" in backends

    def test_search_vector_enabled(self, temp_paths, mock_config):
        """Search with exact + fuzzy + vector backends."""
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        with patch.object(engine, "_search_parallel") as mock_parallel:
            mock_parallel.return_value = {
                "exact": [SearchResult(path="a.py", score=10.0, excerpt="exact")],
                "vector": [SearchResult(path="c.py", score=0.85, excerpt="vector")],
            }

            results = engine.search(
                index_path, "test_query",
                enable_fuzzy=False, enable_vector=True,
            )

            backends = mock_parallel.call_args[0][2]
            assert "exact" in backends
            assert "vector" in backends

    def test_search_lexical_priority_query_skips_vector_backend(self, temp_paths, mock_config):
        """Config/env/factory queries should stay lexical-first in hybrid mode."""
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        with patch.object(engine, "_search_parallel") as mock_parallel:
            mock_parallel.return_value = {
                "exact": [SearchResult(path="config.py", score=10.0, excerpt="exact")],
                "fuzzy": [SearchResult(path="env_config.py", score=8.0, excerpt="fuzzy")],
            }

            results = engine.search(
                index_path,
                "embedding backend fastembed local litellm api config",
                enable_fuzzy=True,
                enable_vector=True,
            )

            assert len(results) >= 1
            backends = mock_parallel.call_args[0][2]
            assert "exact" in backends
            assert "fuzzy" in backends
            assert "vector" not in backends

    def test_search_pure_vector(self, temp_paths, mock_config):
        """Pure vector mode should only use vector backend."""
        engine = HybridSearchEngine(config=mock_config)
        mock_config.enable_category_filter = False
        index_path = temp_paths / "_index.db"

        with patch.object(engine, "_search_parallel") as mock_parallel:
            mock_parallel.return_value = {
                "vector": [SearchResult(path="a.py", score=0.9, excerpt="vec")],
            }

            results = engine.search(
                index_path, "semantic query",
                enable_vector=True, pure_vector=True,
            )

            backends = mock_parallel.call_args[0][2]
            assert "vector" in backends
            assert "exact" not in backends


# =============================================================================
# Tests: search fusion and post-processing
# =============================================================================


class TestHybridSearchFusion:
    """Tests for RRF fusion, empty query, no results, reranking, filtering."""

    def test_search_rrf_fusion(self, temp_paths, mock_config):
        """Results from multiple backends should be fused via RRF."""
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        with patch.object(engine, "_search_parallel") as mock_parallel:
            mock_parallel.return_value = {
                "exact": [
                    SearchResult(path="a.py", score=10.0, excerpt="exact a"),
                    SearchResult(path="b.py", score=5.0, excerpt="exact b"),
                ],
                "vector": [
                    SearchResult(path="b.py", score=0.9, excerpt="vector b"),
                    SearchResult(path="c.py", score=0.8, excerpt="vector c"),
                ],
            }

            results = engine.search(
                index_path, "test",
                enable_fuzzy=False, enable_vector=True,
            )

            # b.py appears in both sources - should have high fusion score
            assert any(r.path == "b.py" for r in results)

    def test_search_empty_query(self, temp_paths, mock_config):
        """Empty query should still execute (handled gracefully)."""
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        with patch.object(engine, "_search_parallel") as mock_parallel:
            mock_parallel.return_value = {"exact": []}

            results = engine.search(index_path, "", enable_fuzzy=False)

            assert results == []

    def test_search_no_results(self, temp_paths, mock_config):
        """All backends returning empty should produce empty results."""
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        with patch.object(engine, "_search_parallel") as mock_parallel:
            mock_parallel.return_value = {
                "exact": [],
                "fuzzy": [],
            }

            results = engine.search(index_path, "nonexistent")

            assert results == []

    def test_search_reranking(self, temp_paths, mock_config):
        """Reranking should be applied when config enables it."""
        mock_config.enable_reranking = True
        mock_config.enable_cross_encoder_rerank = False
        mock_config.reranking_top_k = 50
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        mock_embedder = MagicMock()
        mock_embedder.embed_single.return_value = [0.1] * 128
        mock_embedder.embed.return_value = [[0.1] * 128]
        engine.embedder = mock_embedder

        with patch.object(engine, "_search_parallel") as mock_parallel:
            mock_parallel.return_value = {
                "exact": [SearchResult(path="a.py", score=10.0, excerpt="code")],
            }

            with patch("codexlens.search.hybrid_search.rerank_results") as mock_rerank:
                mock_rerank.return_value = [
                    SearchResult(path="a.py", score=0.85, excerpt="code"),
                ]
                results = engine.search(index_path, "query", enable_fuzzy=False)

                mock_rerank.assert_called_once()

    def test_search_lexical_priority_query_skips_expensive_reranking(self, temp_paths, mock_config):
        """Lexical-priority queries should bypass embedder and cross-encoder reranking."""
        mock_config.enable_reranking = True
        mock_config.enable_cross_encoder_rerank = True
        mock_config.reranking_top_k = 50
        mock_config.reranker_top_k = 20
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        with patch.object(engine, "_search_parallel") as mock_parallel:
            mock_parallel.return_value = {
                "exact": [SearchResult(path="config.py", score=10.0, excerpt="code")],
                "fuzzy": [SearchResult(path="env_config.py", score=9.0, excerpt="env vars")],
            }

            with patch("codexlens.search.hybrid_search.rerank_results") as mock_rerank, patch(
                "codexlens.search.hybrid_search.cross_encoder_rerank"
            ) as mock_cross_encoder, patch.object(
                engine,
                "_get_cross_encoder_reranker",
            ) as mock_get_reranker:
                results = engine.search(
                    index_path,
                    "get_reranker factory onnx backend selection",
                    enable_fuzzy=True,
                    enable_vector=True,
                )

                assert len(results) >= 1
                mock_rerank.assert_not_called()
                mock_cross_encoder.assert_not_called()
                mock_get_reranker.assert_not_called()

    def test_search_category_filtering(self, temp_paths, mock_config):
        """Category filtering should separate code/doc results by intent."""
        mock_config.enable_category_filter = True
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        with patch.object(engine, "_search_parallel") as mock_parallel:
            mock_parallel.return_value = {
                "exact": [
                    SearchResult(path="auth.py", score=10.0, excerpt="def auth"),
                    SearchResult(path="README.md", score=8.0, excerpt="docs"),
                ],
            }

            # Keyword-like query should filter to code
            results = engine.search(
                index_path, "AuthManager",
                enable_fuzzy=False,
            )

            paths = [r.path for r in results]
            # Code files should remain, doc files filtered for KEYWORD intent
            assert "auth.py" in paths


# =============================================================================
# Tests: _search_parallel
# =============================================================================


class TestSearchParallel:
    """Tests for _search_parallel() parallel backend execution."""

    def test_search_parallel_backends(self, temp_paths, mock_config):
        """Parallel execution should run all requested backends."""
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        with patch.object(engine, "_search_exact") as mock_exact, \
             patch.object(engine, "_search_fuzzy") as mock_fuzzy:
            mock_exact.return_value = [
                SearchResult(path="a.py", score=10.0, excerpt="exact"),
            ]
            mock_fuzzy.return_value = [
                SearchResult(path="b.py", score=8.0, excerpt="fuzzy"),
            ]

            results_map = engine._search_parallel(
                index_path, "query",
                backends={"exact": True, "fuzzy": True},
                limit=10,
            )

            assert "exact" in results_map
            assert "fuzzy" in results_map
            mock_exact.assert_called_once()
            mock_fuzzy.assert_called_once()


class TestCentralizedMetadataFetch:
    """Tests for centralized metadata retrieval helpers."""

    def test_fetch_from_vector_meta_store_clamps_negative_scores(self, temp_paths, mock_config, monkeypatch):
        engine = HybridSearchEngine(config=mock_config)

        class FakeMetaStore:
            def __init__(self, _path):
                pass

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def get_chunks_by_ids(self, _chunk_ids, category=None):
                assert category is None
                return [
                    {
                        "chunk_id": 7,
                        "file_path": "src/app.py",
                        "content": "def app(): pass",
                        "metadata": {},
                        "start_line": 1,
                        "end_line": 1,
                    }
                ]

        import codexlens.storage.vector_meta_store as vector_meta_store

        monkeypatch.setattr(vector_meta_store, "VectorMetadataStore", FakeMetaStore)

        results = engine._fetch_from_vector_meta_store(
            temp_paths / "_vectors_meta.db",
            [7],
            {7: -0.01},
        )

        assert len(results) == 1
        assert results[0].path == "src/app.py"
        assert results[0].score == 0.0


class TestCentralizedVectorCaching:
    """Tests for centralized vector search runtime caches."""

    def test_search_vector_centralized_reuses_cached_resources(
        self,
        temp_paths,
        mock_config,
    ):
        engine = HybridSearchEngine(config=mock_config)
        hnsw_path = temp_paths / "_vectors.hnsw"
        hnsw_path.write_bytes(b"hnsw")

        vector_store_opened: List[Path] = []

        class FakeVectorStore:
            def __init__(self, path):
                vector_store_opened.append(Path(path))

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def get_model_config(self):
                return {
                    "backend": "fastembed",
                    "model_name": "BAAI/bge-small-en-v1.5",
                    "model_profile": "fast",
                    "embedding_dim": 384,
                }

        class FakeEmbedder:
            embedding_dim = 384

            def __init__(self):
                self.embed_calls: List[str] = []

            def embed_single(self, query):
                self.embed_calls.append(query)
                return [0.1, 0.2, 0.3]

        class FakeAnnIndex:
            def __init__(self):
                self.load_calls = 0
                self.search_calls = 0

            def load(self):
                self.load_calls += 1
                return True

            def count(self):
                return 3

            def search(self, _query_vec, top_k):
                self.search_calls += 1
                assert top_k == 10
                return [7], [0.2]

        fake_embedder = FakeEmbedder()
        fake_ann_index = FakeAnnIndex()

        with patch("codexlens.semantic.vector_store.VectorStore", FakeVectorStore), patch(
            "codexlens.semantic.factory.get_embedder",
            return_value=fake_embedder,
        ) as mock_get_embedder, patch(
            "codexlens.semantic.ann_index.ANNIndex.create_central",
            return_value=fake_ann_index,
        ) as mock_create_central, patch.object(
            engine,
            "_fetch_chunks_by_ids_centralized",
            return_value=[SearchResult(path="src/app.py", score=0.8, excerpt="hit")],
        ) as mock_fetch:
            first = engine._search_vector_centralized(
                temp_paths / "child-a" / "_index.db",
                hnsw_path,
                "smart search routing",
                limit=5,
            )
            second = engine._search_vector_centralized(
                temp_paths / "child-b" / "_index.db",
                hnsw_path,
                "smart search routing",
                limit=5,
            )

        assert [result.path for result in first] == ["src/app.py"]
        assert [result.path for result in second] == ["src/app.py"]
        assert vector_store_opened == [temp_paths / "_index.db"]
        assert mock_get_embedder.call_count == 1
        assert mock_create_central.call_count == 1
        assert fake_ann_index.load_calls == 1
        assert fake_embedder.embed_calls == ["smart search routing"]
        assert fake_ann_index.search_calls == 2
        assert mock_fetch.call_count == 2

    def test_search_vector_centralized_respects_embedding_use_gpu(
        self,
        temp_paths,
        mock_config,
    ):
        engine = HybridSearchEngine(config=mock_config)
        hnsw_path = temp_paths / "_vectors.hnsw"
        hnsw_path.write_bytes(b"hnsw")

        class FakeVectorStore:
            def __init__(self, _path):
                pass

            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc, tb):
                return False

            def get_model_config(self):
                return {
                    "backend": "fastembed",
                    "model_name": "BAAI/bge-small-en-v1.5",
                    "model_profile": "code",
                    "embedding_dim": 384,
                }

        class FakeEmbedder:
            embedding_dim = 384

            def embed_single(self, _query):
                return [0.1, 0.2]

        class FakeAnnIndex:
            def load(self):
                return True

            def count(self):
                return 1

            def search(self, _query_vec, top_k):
                assert top_k == 6
                return [9], [0.1]

        with patch("codexlens.semantic.vector_store.VectorStore", FakeVectorStore), patch(
            "codexlens.semantic.factory.get_embedder",
            return_value=FakeEmbedder(),
        ) as mock_get_embedder, patch(
            "codexlens.semantic.ann_index.ANNIndex.create_central",
            return_value=FakeAnnIndex(),
        ), patch.object(
            engine,
            "_fetch_chunks_by_ids_centralized",
            return_value=[SearchResult(path="src/app.py", score=0.9, excerpt="hit")],
        ):
            results = engine._search_vector_centralized(
                temp_paths / "_index.db",
                hnsw_path,
                "semantic query",
                limit=3,
            )

        assert len(results) == 1
        assert mock_get_embedder.call_count == 1
        assert mock_get_embedder.call_args.kwargs == {
            "backend": "fastembed",
            "profile": "code",
            "use_gpu": False,
        }


# =============================================================================
# Tests: _search_lsp_graph
# =============================================================================


class TestSearchLspGraph:
    """Tests for _search_lsp_graph() LSP graph expansion."""

    def test_search_lsp_graph(self, temp_paths, mock_config):
        """LSP graph search should use seed results for expansion."""
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        # When HAS_LSP is False, _search_lsp_graph returns []
        with patch("codexlens.search.hybrid_search.HAS_LSP", False):
            results = engine._search_lsp_graph(
                index_path, "auth function", limit=5,
            )
            assert results == []

    def test_lsp_fallback_vector_to_fts(self, temp_paths, mock_config):
        """When vector seeds fail, should fall back to FTS seeds."""
        engine = HybridSearchEngine(config=mock_config)
        index_path = temp_paths / "_index.db"

        with patch("codexlens.search.hybrid_search.HAS_LSP", True):
            # Mock _search_vector to return empty (no seeds from vector)
            with patch.object(engine, "_search_vector", return_value=[]):
                # Mock _search_exact to return seeds
                with patch.object(engine, "_search_exact") as mock_exact:
                    mock_exact.return_value = [
                        SearchResult(
                            path="auth.py", score=10.0,
                            excerpt="def auth():", symbol_name="auth",
                            start_line=1, end_line=5,
                        ),
                    ]

                    # Mock the LSP bridge (will fail on import or async)
                    # The function should attempt FTS fallback before LSP expansion
                    try:
                        results = engine._search_lsp_graph(
                            index_path, "auth", limit=5,
                        )
                    except Exception:
                        pass  # LSP deps may not be available, but FTS fallback was attempted

                    # Verify FTS was called as fallback
                    mock_exact.assert_called_once()
