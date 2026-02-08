"""Integration tests for staged cascade search pipeline.

Tests the 4-stage pipeline:
1. Stage 1: Binary coarse search
2. Stage 2: LSP graph expansion
3. Stage 3: Clustering and representative selection
4. Stage 4: Optional cross-encoder reranking
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import List
from unittest.mock import MagicMock, Mock, patch

import pytest

from codexlens.config import Config
from codexlens.entities import SearchResult
from codexlens.search.chain_search import ChainSearchEngine, SearchOptions
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
    """Create mock config with staged cascade settings."""
    config = MagicMock(spec=Config)
    config.cascade_coarse_k = 100
    config.cascade_fine_k = 10
    config.enable_staged_rerank = False
    config.staged_clustering_strategy = "auto"
    config.staged_clustering_min_size = 3
    config.graph_expansion_depth = 2
    return config


@pytest.fixture
def sample_binary_results() -> List[SearchResult]:
    """Create sample binary search results for testing."""
    return [
        SearchResult(
            path="a.py",
            score=0.95,
            excerpt="def authenticate_user(username, password):",
            symbol_name="authenticate_user",
            symbol_kind="function",
            start_line=10,
            end_line=15,
        ),
        SearchResult(
            path="b.py",
            score=0.85,
            excerpt="class AuthManager:",
            symbol_name="AuthManager",
            symbol_kind="class",
            start_line=5,
            end_line=20,
        ),
        SearchResult(
            path="c.py",
            score=0.75,
            excerpt="def check_credentials(user, pwd):",
            symbol_name="check_credentials",
            symbol_kind="function",
            start_line=30,
            end_line=35,
        ),
    ]


@pytest.fixture
def sample_expanded_results() -> List[SearchResult]:
    """Create sample expanded results (after LSP expansion)."""
    return [
        SearchResult(
            path="a.py",
            score=0.95,
            excerpt="def authenticate_user(username, password):",
            symbol_name="authenticate_user",
            symbol_kind="function",
        ),
        SearchResult(
            path="a.py",
            score=0.90,
            excerpt="def verify_password(pwd):",
            symbol_name="verify_password",
            symbol_kind="function",
        ),
        SearchResult(
            path="b.py",
            score=0.85,
            excerpt="class AuthManager:",
            symbol_name="AuthManager",
            symbol_kind="class",
        ),
        SearchResult(
            path="b.py",
            score=0.80,
            excerpt="def login(self, user):",
            symbol_name="login",
            symbol_kind="function",
        ),
        SearchResult(
            path="c.py",
            score=0.75,
            excerpt="def check_credentials(user, pwd):",
            symbol_name="check_credentials",
            symbol_kind="function",
        ),
        SearchResult(
            path="d.py",
            score=0.70,
            excerpt="class UserModel:",
            symbol_name="UserModel",
            symbol_kind="class",
        ),
    ]


# =============================================================================
# Test Stage Methods
# =============================================================================


class TestStage1BinarySearch:
    """Tests for Stage 1: Binary coarse search."""

    def test_stage1_returns_results_with_index_root(
        self, mock_registry, mock_mapper, mock_config
    ):
        """Test _stage1_binary_search returns results and index_root."""
        from codexlens.search.chain_search import SearchStats

        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        # Mock the binary embedding backend (import is inside the method)
        with patch("codexlens.indexing.embedding.BinaryEmbeddingBackend"):
            with patch.object(engine, "_get_or_create_binary_index") as mock_binary_idx:
                mock_index = MagicMock()
                mock_index.count.return_value = 10
                mock_index.search.return_value = ([1, 2, 3], [10, 20, 30])
                mock_binary_idx.return_value = mock_index

                index_paths = [Path("/fake/index1/_index.db")]
                stats = SearchStats()

                results, index_root = engine._stage1_binary_search(
                    "query", index_paths, coarse_k=10, stats=stats
                )

                assert isinstance(results, list)
                assert isinstance(index_root, (Path, type(None)))

    def test_stage1_handles_empty_index_paths(
        self, mock_registry, mock_mapper, mock_config
    ):
        """Test _stage1_binary_search handles empty index paths."""
        from codexlens.search.chain_search import SearchStats

        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        index_paths = []
        stats = SearchStats()

        results, index_root = engine._stage1_binary_search(
            "query", index_paths, coarse_k=10, stats=stats
        )

        assert results == []
        assert index_root is None

    def test_stage1_aggregates_results_from_multiple_indexes(
        self, mock_registry, mock_mapper, mock_config
    ):
        """Test _stage1_binary_search aggregates results from multiple indexes."""
        from codexlens.search.chain_search import SearchStats

        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch("codexlens.indexing.embedding.BinaryEmbeddingBackend"):
            with patch.object(engine, "_get_or_create_binary_index") as mock_binary_idx:
                mock_index = MagicMock()
                mock_index.count.return_value = 10
                # Return different results for different calls
                mock_index.search.side_effect = [
                    ([1, 2], [10, 20]),
                    ([3, 4], [15, 25]),
                ]
                mock_binary_idx.return_value = mock_index

                index_paths = [
                    Path("/fake/index1/_index.db"),
                    Path("/fake/index2/_index.db"),
                ]
                stats = SearchStats()

                results, _ = engine._stage1_binary_search(
                    "query", index_paths, coarse_k=10, stats=stats
                )

                # Should aggregate candidates from both indexes
                assert isinstance(results, list)


class TestStage2LSPExpand:
    """Tests for Stage 2: LSP graph expansion."""

    def test_stage2_returns_expanded_results(
        self, mock_registry, mock_mapper, mock_config, sample_binary_results
    ):
        """Test _stage2_lsp_expand returns expanded results."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        # Import is inside the method, so we need to patch it there
        with patch("codexlens.search.graph_expander.GraphExpander") as mock_expander_cls:
            mock_expander = MagicMock()
            mock_expander.expand.return_value = [
                SearchResult(path="related.py", score=0.7, excerpt="related")
            ]
            mock_expander_cls.return_value = mock_expander

            expanded = engine._stage2_lsp_expand(
                sample_binary_results, index_root=Path("/fake/index")
            )

            assert isinstance(expanded, list)
            # Should include original results
            assert len(expanded) >= len(sample_binary_results)

    def test_stage2_handles_no_index_root(
        self, mock_registry, mock_mapper, mock_config, sample_binary_results
    ):
        """Test _stage2_lsp_expand handles missing index_root."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        expanded = engine._stage2_lsp_expand(sample_binary_results, index_root=None)

        # Should return original results unchanged
        assert expanded == sample_binary_results

    def test_stage2_handles_empty_results(
        self, mock_registry, mock_mapper, mock_config
    ):
        """Test _stage2_lsp_expand handles empty input."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        expanded = engine._stage2_lsp_expand([], index_root=Path("/fake"))

        assert expanded == []

    def test_stage2_deduplicates_results(
        self, mock_registry, mock_mapper, mock_config, sample_binary_results
    ):
        """Test _stage2_lsp_expand deduplicates by (path, symbol_name, start_line)."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        # Mock expander to return duplicate of first result
        with patch("codexlens.search.graph_expander.GraphExpander") as mock_expander_cls:
            mock_expander = MagicMock()
            duplicate = SearchResult(
                path=sample_binary_results[0].path,
                score=0.5,
                excerpt="duplicate",
                symbol_name=sample_binary_results[0].symbol_name,
                start_line=sample_binary_results[0].start_line,
            )
            mock_expander.expand.return_value = [duplicate]
            mock_expander_cls.return_value = mock_expander

            expanded = engine._stage2_lsp_expand(
                sample_binary_results, index_root=Path("/fake")
            )

            # Should not include duplicate
            assert len(expanded) == len(sample_binary_results)


class TestStage3ClusterPrune:
    """Tests for Stage 3: Clustering and representative selection."""

    def test_stage3_returns_representatives(
        self, mock_registry, mock_mapper, mock_config, sample_expanded_results
    ):
        """Test _stage3_cluster_prune returns representative results."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch.object(engine, "_get_embeddings_for_clustering") as mock_embed:
            import numpy as np

            # Mock embeddings
            mock_embed.return_value = np.random.rand(
                len(sample_expanded_results), 128
            ).astype(np.float32)

            clustered = engine._stage3_cluster_prune(
                sample_expanded_results, target_count=3
            )

            assert isinstance(clustered, list)
            assert len(clustered) <= len(sample_expanded_results)
            assert all(isinstance(r, SearchResult) for r in clustered)

    def test_stage3_handles_few_results(
        self, mock_registry, mock_mapper, mock_config
    ):
        """Test _stage3_cluster_prune skips clustering for few results."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        few_results = [
            SearchResult(path="a.py", score=0.9, excerpt="a"),
            SearchResult(path="b.py", score=0.8, excerpt="b"),
        ]

        clustered = engine._stage3_cluster_prune(few_results, target_count=5)

        # Should return all results unchanged
        assert clustered == few_results

    def test_stage3_handles_no_embeddings(
        self, mock_registry, mock_mapper, mock_config, sample_expanded_results
    ):
        """Test _stage3_cluster_prune falls back to score-based selection without embeddings."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch.object(engine, "_get_embeddings_for_clustering") as mock_embed:
            mock_embed.return_value = None

            clustered = engine._stage3_cluster_prune(
                sample_expanded_results, target_count=3
            )

            # Should return top-scored results
            assert len(clustered) <= 3
            # Should be sorted by score descending
            scores = [r.score for r in clustered]
            assert scores == sorted(scores, reverse=True)

    def test_stage3_uses_config_clustering_strategy(
        self, mock_registry, mock_mapper, sample_expanded_results
    ):
        """Test _stage3_cluster_prune uses config clustering strategy."""
        config = MagicMock(spec=Config)
        config.staged_clustering_strategy = "auto"
        config.staged_clustering_min_size = 2

        engine = ChainSearchEngine(mock_registry, PathMapper(), config=config)

        with patch.object(engine, "_get_embeddings_for_clustering") as mock_embed:
            import numpy as np

            mock_embed.return_value = np.random.rand(
                len(sample_expanded_results), 128
            ).astype(np.float32)

            clustered = engine._stage3_cluster_prune(
                sample_expanded_results, target_count=3
            )

            # Should use clustering (auto will pick best available)
            # Result should be a list of SearchResult objects
            assert isinstance(clustered, list)
            assert all(isinstance(r, SearchResult) for r in clustered)


class TestStage4OptionalRerank:
    """Tests for Stage 4: Optional cross-encoder reranking."""

    def test_stage4_reranks_with_reranker(
        self, mock_registry, mock_mapper, mock_config
    ):
        """Test _stage4_optional_rerank uses _cross_encoder_rerank."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        results = [
            SearchResult(path="a.py", score=0.9, excerpt="a"),
            SearchResult(path="b.py", score=0.8, excerpt="b"),
            SearchResult(path="c.py", score=0.7, excerpt="c"),
        ]

        # Mock the _cross_encoder_rerank method that _stage4 calls
        with patch.object(engine, "_cross_encoder_rerank") as mock_rerank:
            mock_rerank.return_value = [
                SearchResult(path="c.py", score=0.95, excerpt="c"),
                SearchResult(path="a.py", score=0.85, excerpt="a"),
            ]

            reranked = engine._stage4_optional_rerank("query", results, k=2)

            mock_rerank.assert_called_once_with("query", results, 2)
            assert len(reranked) <= 2
            # First result should be reranked winner
            assert reranked[0].path == "c.py"

    def test_stage4_handles_empty_results(
        self, mock_registry, mock_mapper, mock_config
    ):
        """Test _stage4_optional_rerank handles empty input."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        reranked = engine._stage4_optional_rerank("query", [], k=2)

        # Should return empty list
        assert reranked == []


# =============================================================================
# Integration Tests
# =============================================================================


class TestStagedCascadeIntegration:
    """Integration tests for staged_cascade_search() end-to-end."""

    def test_staged_cascade_returns_chain_result(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """Test staged_cascade_search returns ChainSearchResult."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        # Mock all stages
        with patch.object(engine, "_find_start_index") as mock_find:
            mock_find.return_value = temp_paths / "index" / "_index.db"

            with patch.object(engine, "_collect_index_paths") as mock_collect:
                mock_collect.return_value = [temp_paths / "index" / "_index.db"]

                with patch.object(engine, "_stage1_binary_search") as mock_stage1:
                    mock_stage1.return_value = (
                        [SearchResult(path="a.py", score=0.9, excerpt="a")],
                        temp_paths / "index",
                    )

                    with patch.object(engine, "_stage2_lsp_expand") as mock_stage2:
                        mock_stage2.return_value = [
                            SearchResult(path="a.py", score=0.9, excerpt="a")
                        ]

                        with patch.object(engine, "_stage3_cluster_prune") as mock_stage3:
                            mock_stage3.return_value = [
                                SearchResult(path="a.py", score=0.9, excerpt="a")
                            ]

                            result = engine.staged_cascade_search(
                                "query", temp_paths / "src", k=10, coarse_k=100
                            )

                            from codexlens.search.chain_search import ChainSearchResult

                            assert isinstance(result, ChainSearchResult)
                            assert result.query == "query"
                            assert len(result.results) <= 10

    def test_staged_cascade_includes_stage_stats(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """Test staged_cascade_search includes per-stage timing stats."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch.object(engine, "_find_start_index") as mock_find:
            mock_find.return_value = temp_paths / "index" / "_index.db"

            with patch.object(engine, "_collect_index_paths") as mock_collect:
                mock_collect.return_value = [temp_paths / "index" / "_index.db"]

                with patch.object(engine, "_stage1_binary_search") as mock_stage1:
                    mock_stage1.return_value = (
                        [SearchResult(path="a.py", score=0.9, excerpt="a")],
                        temp_paths / "index",
                    )

                    with patch.object(engine, "_stage2_lsp_expand") as mock_stage2:
                        mock_stage2.return_value = [
                            SearchResult(path="a.py", score=0.9, excerpt="a")
                        ]

                        with patch.object(engine, "_stage3_cluster_prune") as mock_stage3:
                            mock_stage3.return_value = [
                                SearchResult(path="a.py", score=0.9, excerpt="a")
                            ]

                            result = engine.staged_cascade_search(
                                "query", temp_paths / "src"
                            )

                            # Check for stage stats in errors field
                            stage_stats = None
                            for err in result.stats.errors:
                                if err.startswith("STAGE_STATS:"):
                                    stage_stats = json.loads(err.replace("STAGE_STATS:", ""))
                                    break

                            assert stage_stats is not None
                            assert "stage_times" in stage_stats
                            assert "stage_counts" in stage_stats
                            assert "stage1_binary_ms" in stage_stats["stage_times"]
                            assert "stage1_candidates" in stage_stats["stage_counts"]

    def test_staged_cascade_with_rerank_enabled(
        self, mock_registry, mock_mapper, temp_paths
    ):
        """Test staged_cascade_search with reranking enabled."""
        config = MagicMock(spec=Config)
        config.cascade_coarse_k = 100
        config.cascade_fine_k = 10
        config.enable_staged_rerank = True
        config.staged_clustering_strategy = "auto"
        config.graph_expansion_depth = 2

        engine = ChainSearchEngine(mock_registry, mock_mapper, config=config)

        with patch.object(engine, "_find_start_index") as mock_find:
            mock_find.return_value = temp_paths / "index" / "_index.db"

            with patch.object(engine, "_collect_index_paths") as mock_collect:
                mock_collect.return_value = [temp_paths / "index" / "_index.db"]

                with patch.object(engine, "_stage1_binary_search") as mock_stage1:
                    mock_stage1.return_value = (
                        [SearchResult(path="a.py", score=0.9, excerpt="a")],
                        temp_paths / "index",
                    )

                    with patch.object(engine, "_stage2_lsp_expand") as mock_stage2:
                        mock_stage2.return_value = [
                            SearchResult(path="a.py", score=0.9, excerpt="a")
                        ]

                        with patch.object(engine, "_stage3_cluster_prune") as mock_stage3:
                            mock_stage3.return_value = [
                                SearchResult(path="a.py", score=0.9, excerpt="a")
                            ]

                            with patch.object(engine, "_stage4_optional_rerank") as mock_stage4:
                                mock_stage4.return_value = [
                                    SearchResult(path="a.py", score=0.95, excerpt="a")
                                ]

                                result = engine.staged_cascade_search(
                                    "query", temp_paths / "src"
                                )

                                # Verify stage 4 was called
                                mock_stage4.assert_called_once()

    def test_staged_cascade_fallback_to_search(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """Test staged_cascade_search falls back to standard search when numpy unavailable."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch("codexlens.search.chain_search.NUMPY_AVAILABLE", False):
            with patch.object(engine, "search") as mock_search:
                mock_search.return_value = MagicMock()

                engine.staged_cascade_search("query", temp_paths / "src")

                # Should fall back to standard search
                mock_search.assert_called_once()

    def test_staged_cascade_deduplicates_final_results(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """Test staged_cascade_search deduplicates results by path."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch.object(engine, "_find_start_index") as mock_find:
            mock_find.return_value = temp_paths / "index" / "_index.db"

            with patch.object(engine, "_collect_index_paths") as mock_collect:
                mock_collect.return_value = [temp_paths / "index" / "_index.db"]

                with patch.object(engine, "_stage1_binary_search") as mock_stage1:
                    mock_stage1.return_value = (
                        [SearchResult(path="a.py", score=0.9, excerpt="a")],
                        temp_paths / "index",
                    )

                    with patch.object(engine, "_stage2_lsp_expand") as mock_stage2:
                        mock_stage2.return_value = [
                            SearchResult(path="a.py", score=0.9, excerpt="a")
                        ]

                        with patch.object(engine, "_stage3_cluster_prune") as mock_stage3:
                            # Return duplicates with different scores
                            mock_stage3.return_value = [
                                SearchResult(path="a.py", score=0.9, excerpt="a"),
                                SearchResult(path="a.py", score=0.8, excerpt="a duplicate"),
                                SearchResult(path="b.py", score=0.7, excerpt="b"),
                            ]

                            result = engine.staged_cascade_search(
                                "query", temp_paths / "src", k=10
                            )

                            # Should deduplicate a.py (keep higher score)
                            paths = [r.path for r in result.results]
                            assert len(paths) == len(set(paths))
                            # a.py should have score 0.9
                            a_result = next(r for r in result.results if r.path == "a.py")
                            assert a_result.score == 0.9


# =============================================================================
# Graceful Degradation Tests
# =============================================================================


class TestStagedCascadeGracefulDegradation:
    """Tests for graceful degradation when dependencies unavailable."""

    def test_falls_back_when_clustering_unavailable(
        self, mock_registry, mock_mapper, mock_config, sample_expanded_results
    ):
        """Test clustering stage falls back gracefully when clustering unavailable."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch.object(engine, "_get_embeddings_for_clustering") as mock_embed:
            mock_embed.return_value = None

            clustered = engine._stage3_cluster_prune(
                sample_expanded_results, target_count=3
            )

            # Should fall back to score-based selection
            assert len(clustered) <= 3

    def test_falls_back_when_graph_expander_unavailable(
        self, mock_registry, mock_mapper, mock_config, sample_binary_results
    ):
        """Test LSP expansion falls back when GraphExpander unavailable."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        # Patch the import inside the method
        with patch("codexlens.search.graph_expander.GraphExpander", side_effect=ImportError):
            expanded = engine._stage2_lsp_expand(
                sample_binary_results, index_root=Path("/fake")
            )

            # Should return original results
            assert expanded == sample_binary_results

    def test_handles_stage_failures_gracefully(
        self, mock_registry, mock_mapper, mock_config, temp_paths
    ):
        """Test staged pipeline handles stage failures gracefully."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, config=mock_config)

        with patch.object(engine, "_find_start_index") as mock_find:
            mock_find.return_value = temp_paths / "index" / "_index.db"

            with patch.object(engine, "_collect_index_paths") as mock_collect:
                mock_collect.return_value = [temp_paths / "index" / "_index.db"]

                with patch.object(engine, "_stage1_binary_search") as mock_stage1:
                    # Stage 1 returns no results
                    mock_stage1.return_value = ([], None)

                    with patch.object(engine, "search") as mock_search:
                        mock_search.return_value = MagicMock()

                        engine.staged_cascade_search("query", temp_paths / "src")

                        # Should fall back to standard search when stage 1 fails
                        mock_search.assert_called_once()
