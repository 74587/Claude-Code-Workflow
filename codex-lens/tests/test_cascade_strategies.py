"""Integration tests for chain_search.py cascade strategies.

Tests cover:
- binary_cascade_search: Full pipeline and numpy-unavailable fallback
- binary_rerank_cascade_search: Pipeline and fallback
- dense_rerank_cascade_search: Pipeline and fallback
- cascade_search: Router dispatching to correct strategy methods
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import List
from unittest.mock import MagicMock, Mock, patch

import pytest

from codexlens.config import Config
from codexlens.entities import SearchResult
from codexlens.search.chain_search import (
    ChainSearchEngine,
    ChainSearchResult,
    SearchOptions,
    SearchStats,
)
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def temp_paths():
    """Create temporary directory structure."""
    tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    root = Path(tmpdir.name)
    yield root
    try:
        tmpdir.cleanup()
    except (PermissionError, OSError):
        pass


@pytest.fixture
def mock_registry(temp_paths: Path):
    """Create mock registry store."""
    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    return registry


@pytest.fixture
def mock_mapper(temp_paths: Path):
    """Create path mapper."""
    return PathMapper(index_root=temp_paths / "indexes")


@pytest.fixture
def mock_config():
    """Create mock config for cascade search."""
    config = MagicMock(spec=Config)
    config.cascade_coarse_k = 100
    config.cascade_fine_k = 10
    config.cascade_strategy = "binary"
    config.enable_staged_rerank = False
    config.staged_clustering_strategy = "auto"
    config.staged_clustering_min_size = 3
    config.graph_expansion_depth = 2
    return config


@pytest.fixture
def sample_search_results() -> List[SearchResult]:
    """Create sample search results for testing."""
    return [
        SearchResult(path="a.py", score=0.9, excerpt="def auth():"),
        SearchResult(path="b.py", score=0.8, excerpt="class User:"),
        SearchResult(path="c.py", score=0.7, excerpt="def login():"),
    ]


# =============================================================================
# Tests: binary_cascade_search
# =============================================================================


class TestBinaryCascadeSearch:
    """Tests for binary_cascade_search()."""

    def test_binary_cascade_full_pipeline(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """binary_cascade_search should execute full binary+dense pipeline."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch.object(engine, "_find_start_index") as mock_find:
            mock_find.return_value = temp_paths / "index" / "_index.db"

            with patch.object(engine, "_collect_index_paths") as mock_collect:
                mock_collect.return_value = [temp_paths / "index" / "_index.db"]

                # Mock the embedding backend imports
                with patch("codexlens.search.chain_search.NUMPY_AVAILABLE", True):
                    with patch.dict("sys.modules", {
                        "codexlens.indexing.embedding": MagicMock(),
                        "codexlens.semantic.ann_index": MagicMock(),
                    }):
                        # Mock _get_or_create_binary_index
                        with patch.object(
                            engine, "_get_or_create_binary_index"
                        ) as mock_bin:
                            mock_index = MagicMock()
                            mock_index.count.return_value = 10
                            mock_index.search.return_value = ([1, 2], [10, 20])
                            mock_bin.return_value = mock_index

                            # The search should fall back to standard on import issues
                            with patch.object(engine, "search") as mock_search:
                                mock_search.return_value = ChainSearchResult(
                                    query="test",
                                    results=[SearchResult(path="a.py", score=0.9, excerpt="a")],
                                    symbols=[],
                                    stats=SearchStats(),
                                )

                                result = engine.binary_cascade_search(
                                    "test query", temp_paths / "src",
                                    k=10, coarse_k=100,
                                )

                                assert isinstance(result, ChainSearchResult)

    def test_binary_cascade_numpy_unavailable(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """binary_cascade_search should fall back to standard search when numpy unavailable."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch("codexlens.search.chain_search.NUMPY_AVAILABLE", False):
            with patch.object(engine, "search") as mock_search:
                mock_search.return_value = ChainSearchResult(
                    query="test",
                    results=[],
                    symbols=[],
                    stats=SearchStats(),
                )

                result = engine.binary_cascade_search(
                    "query", temp_paths / "src",
                )

                mock_search.assert_called_once()
                assert isinstance(result, ChainSearchResult)


# =============================================================================
# Tests: binary_rerank_cascade_search
# =============================================================================


class TestBinaryRerankCascadeSearch:
    """Tests for binary_rerank_cascade_search()."""

    def test_binary_rerank_cascade_pipeline(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """binary_rerank_cascade_search should execute binary+cross-encoder pipeline."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch("codexlens.search.chain_search.NUMPY_AVAILABLE", True):
            with patch.object(engine, "_find_start_index") as mock_find:
                mock_find.return_value = temp_paths / "index" / "_index.db"

                with patch.object(engine, "_collect_index_paths") as mock_collect:
                    mock_collect.return_value = [temp_paths / "index" / "_index.db"]

                    # Mock BinaryEmbeddingBackend import
                    with patch.dict("sys.modules", {
                        "codexlens.indexing.embedding": MagicMock(),
                    }):
                        with patch.object(engine, "search") as mock_search:
                            mock_search.return_value = ChainSearchResult(
                                query="test",
                                results=[SearchResult(path="a.py", score=0.9, excerpt="a")],
                                symbols=[],
                                stats=SearchStats(),
                            )

                            result = engine.binary_rerank_cascade_search(
                                "test query", temp_paths / "src",
                                k=10, coarse_k=100,
                            )

                            assert isinstance(result, ChainSearchResult)

    def test_binary_rerank_fallback(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """binary_rerank_cascade_search should fall back when numpy unavailable."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch("codexlens.search.chain_search.NUMPY_AVAILABLE", False):
            with patch.object(engine, "search") as mock_search:
                mock_search.return_value = ChainSearchResult(
                    query="test",
                    results=[],
                    symbols=[],
                    stats=SearchStats(),
                )

                result = engine.binary_rerank_cascade_search(
                    "query", temp_paths / "src",
                )

                mock_search.assert_called_once()


# =============================================================================
# Tests: dense_rerank_cascade_search
# =============================================================================


class TestDenseRerankCascadeSearch:
    """Tests for dense_rerank_cascade_search()."""

    def test_dense_rerank_cascade_pipeline(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """dense_rerank_cascade_search should execute dense+cross-encoder pipeline."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch("codexlens.search.chain_search.NUMPY_AVAILABLE", True):
            with patch.object(engine, "_find_start_index") as mock_find:
                mock_find.return_value = temp_paths / "index" / "_index.db"

                with patch.object(engine, "_collect_index_paths") as mock_collect:
                    mock_collect.return_value = [temp_paths / "index" / "_index.db"]

                    with patch.object(engine, "search") as mock_search:
                        mock_search.return_value = ChainSearchResult(
                            query="test",
                            results=[SearchResult(path="a.py", score=0.9, excerpt="a")],
                            symbols=[],
                            stats=SearchStats(),
                        )

                        result = engine.dense_rerank_cascade_search(
                            "test query", temp_paths / "src",
                            k=10, coarse_k=100,
                        )

                        assert isinstance(result, ChainSearchResult)

    def test_dense_rerank_fallback(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """dense_rerank_cascade_search should fall back when numpy unavailable."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch("codexlens.search.chain_search.NUMPY_AVAILABLE", False):
            with patch.object(engine, "search") as mock_search:
                mock_search.return_value = ChainSearchResult(
                    query="test",
                    results=[],
                    symbols=[],
                    stats=SearchStats(),
                )

                result = engine.dense_rerank_cascade_search(
                    "query", temp_paths / "src",
                )

                mock_search.assert_called_once()


# =============================================================================
# Tests: cascade_search (unified router)
# =============================================================================


class TestCascadeRouter:
    """Tests for cascade_search() strategy routing."""

    def test_cascade_router_binary(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """cascade_search with strategy='binary' should route to binary_cascade_search."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch.object(engine, "binary_cascade_search") as mock_binary:
            mock_binary.return_value = ChainSearchResult(
                query="test", results=[], symbols=[], stats=SearchStats()
            )

            engine.cascade_search(
                "query", temp_paths / "src", strategy="binary"
            )

            mock_binary.assert_called_once()

    def test_cascade_router_binary_rerank(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """cascade_search with strategy='binary_rerank' should route correctly."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch.object(engine, "binary_rerank_cascade_search") as mock_rerank:
            mock_rerank.return_value = ChainSearchResult(
                query="test", results=[], symbols=[], stats=SearchStats()
            )

            engine.cascade_search(
                "query", temp_paths / "src", strategy="binary_rerank"
            )

            mock_rerank.assert_called_once()

    def test_cascade_router_dense_rerank(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """cascade_search with strategy='dense_rerank' should route correctly."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch.object(engine, "dense_rerank_cascade_search") as mock_dense:
            mock_dense.return_value = ChainSearchResult(
                query="test", results=[], symbols=[], stats=SearchStats()
            )

            engine.cascade_search(
                "query", temp_paths / "src", strategy="dense_rerank"
            )

            mock_dense.assert_called_once()

    def test_cascade_router_staged(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """cascade_search with strategy='staged' should route to staged_cascade_search."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch.object(engine, "staged_cascade_search") as mock_staged:
            mock_staged.return_value = ChainSearchResult(
                query="test", results=[], symbols=[], stats=SearchStats()
            )

            engine.cascade_search(
                "query", temp_paths / "src", strategy="staged"
            )

            mock_staged.assert_called_once()

    def test_cascade_router_config_default(
        self, mock_registry, mock_mapper, temp_paths
    ):
        """cascade_search with no strategy param should use config cascade_strategy."""
        config = MagicMock(spec=Config)
        config.cascade_strategy = "binary_rerank"
        config.cascade_coarse_k = 100
        config.cascade_fine_k = 10

        engine = ChainSearchEngine(mock_registry, mock_mapper, config=config)

        with patch.object(engine, "binary_rerank_cascade_search") as mock_rerank:
            mock_rerank.return_value = ChainSearchResult(
                query="test", results=[], symbols=[], stats=SearchStats()
            )

            # No strategy param -> reads from config
            engine.cascade_search("query", temp_paths / "src")

            mock_rerank.assert_called_once()

    def test_cascade_router_invalid_fallback(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """cascade_search with invalid strategy should default to 'binary'."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch.object(engine, "binary_cascade_search") as mock_binary:
            mock_binary.return_value = ChainSearchResult(
                query="test", results=[], symbols=[], stats=SearchStats()
            )

            engine.cascade_search(
                "query", temp_paths / "src", strategy="nonexistent"
            )

            mock_binary.assert_called_once()
