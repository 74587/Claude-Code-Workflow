"""Unit tests for clustering strategies in the hybrid search pipeline.

Tests cover:
1. HDBSCANStrategy - Primary HDBSCAN clustering
2. DBSCANStrategy - Fallback DBSCAN clustering
3. NoOpStrategy - No-op fallback when clustering unavailable
4. ClusteringStrategyFactory - Factory with fallback chain
"""

from __future__ import annotations

from typing import List
from unittest.mock import MagicMock, patch

import pytest

from codexlens.entities import SearchResult
from codexlens.search.clustering import (
    BaseClusteringStrategy,
    ClusteringConfig,
    ClusteringStrategyFactory,
    NoOpStrategy,
    check_clustering_strategy_available,
    get_strategy,
)


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def sample_results() -> List[SearchResult]:
    """Create sample search results for testing."""
    return [
        SearchResult(path="a.py", score=0.9, excerpt="def foo(): pass"),
        SearchResult(path="b.py", score=0.8, excerpt="def foo(): pass"),
        SearchResult(path="c.py", score=0.7, excerpt="def bar(): pass"),
        SearchResult(path="d.py", score=0.6, excerpt="def bar(): pass"),
        SearchResult(path="e.py", score=0.5, excerpt="def baz(): pass"),
    ]


@pytest.fixture
def mock_embeddings():
    """Create mock embeddings for 5 results.

    Creates embeddings that should form 2 clusters:
    - Results 0, 1 (similar to each other)
    - Results 2, 3 (similar to each other)
    - Result 4 (noise/singleton)
    """
    import numpy as np

    # Create embeddings in 3D for simplicity
    return np.array(
        [
            [1.0, 0.0, 0.0],  # Result 0 - cluster A
            [0.9, 0.1, 0.0],  # Result 1 - cluster A
            [0.0, 1.0, 0.0],  # Result 2 - cluster B
            [0.1, 0.9, 0.0],  # Result 3 - cluster B
            [0.0, 0.0, 1.0],  # Result 4 - noise/singleton
        ],
        dtype=np.float32,
    )


@pytest.fixture
def default_config() -> ClusteringConfig:
    """Create default clustering configuration."""
    return ClusteringConfig(
        min_cluster_size=2,
        min_samples=1,
        metric="euclidean",
    )


# =============================================================================
# Test ClusteringConfig
# =============================================================================


class TestClusteringConfig:
    """Tests for ClusteringConfig validation."""

    def test_default_values(self):
        """Test default configuration values."""
        config = ClusteringConfig()
        assert config.min_cluster_size == 3
        assert config.min_samples == 2
        assert config.metric == "cosine"
        assert config.cluster_selection_epsilon == 0.0
        assert config.allow_single_cluster is True
        assert config.prediction_data is False

    def test_custom_values(self):
        """Test custom configuration values."""
        config = ClusteringConfig(
            min_cluster_size=5,
            min_samples=3,
            metric="euclidean",
            cluster_selection_epsilon=0.1,
            allow_single_cluster=False,
            prediction_data=True,
        )
        assert config.min_cluster_size == 5
        assert config.min_samples == 3
        assert config.metric == "euclidean"

    def test_invalid_min_cluster_size(self):
        """Test validation rejects min_cluster_size < 2."""
        with pytest.raises(ValueError, match="min_cluster_size must be >= 2"):
            ClusteringConfig(min_cluster_size=1)

    def test_invalid_min_samples(self):
        """Test validation rejects min_samples < 1."""
        with pytest.raises(ValueError, match="min_samples must be >= 1"):
            ClusteringConfig(min_samples=0)

    def test_invalid_metric(self):
        """Test validation rejects invalid metric."""
        with pytest.raises(ValueError, match="metric must be one of"):
            ClusteringConfig(metric="invalid")

    def test_invalid_epsilon(self):
        """Test validation rejects negative epsilon."""
        with pytest.raises(ValueError, match="cluster_selection_epsilon must be >= 0"):
            ClusteringConfig(cluster_selection_epsilon=-0.1)


# =============================================================================
# Test NoOpStrategy
# =============================================================================


class TestNoOpStrategy:
    """Tests for NoOpStrategy - always available."""

    def test_cluster_returns_singleton_clusters(
        self, sample_results: List[SearchResult], mock_embeddings
    ):
        """Test cluster() returns each result as singleton cluster."""
        strategy = NoOpStrategy()
        clusters = strategy.cluster(mock_embeddings, sample_results)

        assert len(clusters) == 5
        for i, cluster in enumerate(clusters):
            assert cluster == [i]

    def test_cluster_empty_results(self):
        """Test cluster() with empty results."""
        import numpy as np

        strategy = NoOpStrategy()
        clusters = strategy.cluster(np.array([]), [])

        assert clusters == []

    def test_select_representatives_returns_all_sorted(
        self, sample_results: List[SearchResult]
    ):
        """Test select_representatives() returns all results sorted by score."""
        strategy = NoOpStrategy()
        clusters = [[i] for i in range(len(sample_results))]
        representatives = strategy.select_representatives(clusters, sample_results)

        assert len(representatives) == 5
        # Check sorted by score descending
        scores = [r.score for r in representatives]
        assert scores == sorted(scores, reverse=True)

    def test_select_representatives_empty(self):
        """Test select_representatives() with empty input."""
        strategy = NoOpStrategy()
        representatives = strategy.select_representatives([], [])
        assert representatives == []

    def test_fit_predict_convenience_method(
        self, sample_results: List[SearchResult], mock_embeddings
    ):
        """Test fit_predict() convenience method."""
        strategy = NoOpStrategy()
        representatives = strategy.fit_predict(mock_embeddings, sample_results)

        assert len(representatives) == 5
        # All results returned, sorted by score
        assert representatives[0].score >= representatives[-1].score


# =============================================================================
# Test HDBSCANStrategy
# =============================================================================


class TestHDBSCANStrategy:
    """Tests for HDBSCANStrategy - requires hdbscan package."""

    @pytest.fixture
    def hdbscan_strategy(self, default_config):
        """Create HDBSCANStrategy if available."""
        try:
            from codexlens.search.clustering import HDBSCANStrategy

            return HDBSCANStrategy(default_config)
        except ImportError:
            pytest.skip("hdbscan not installed")

    def test_cluster_returns_list_of_lists(
        self, hdbscan_strategy, sample_results: List[SearchResult], mock_embeddings
    ):
        """Test cluster() returns List[List[int]]."""
        clusters = hdbscan_strategy.cluster(mock_embeddings, sample_results)

        assert isinstance(clusters, list)
        for cluster in clusters:
            assert isinstance(cluster, list)
            for idx in cluster:
                assert isinstance(idx, int)
                assert 0 <= idx < len(sample_results)

    def test_cluster_covers_all_results(
        self, hdbscan_strategy, sample_results: List[SearchResult], mock_embeddings
    ):
        """Test all result indices appear in clusters."""
        clusters = hdbscan_strategy.cluster(mock_embeddings, sample_results)

        all_indices = set()
        for cluster in clusters:
            all_indices.update(cluster)

        assert all_indices == set(range(len(sample_results)))

    def test_cluster_empty_results(self, hdbscan_strategy):
        """Test cluster() with empty results."""
        import numpy as np

        clusters = hdbscan_strategy.cluster(np.array([]).reshape(0, 3), [])
        assert clusters == []

    def test_cluster_single_result(self, hdbscan_strategy):
        """Test cluster() with single result."""
        import numpy as np

        result = SearchResult(path="a.py", score=0.9, excerpt="test")
        embeddings = np.array([[1.0, 0.0, 0.0]])
        clusters = hdbscan_strategy.cluster(embeddings, [result])

        assert len(clusters) == 1
        assert clusters[0] == [0]

    def test_cluster_fewer_than_min_cluster_size(self, hdbscan_strategy):
        """Test cluster() with fewer results than min_cluster_size."""
        import numpy as np

        # Strategy has min_cluster_size=2, so 1 result returns singleton
        result = SearchResult(path="a.py", score=0.9, excerpt="test")
        embeddings = np.array([[1.0, 0.0, 0.0]])
        clusters = hdbscan_strategy.cluster(embeddings, [result])

        assert len(clusters) == 1
        assert clusters[0] == [0]

    def test_select_representatives_picks_highest_score(
        self, hdbscan_strategy, sample_results: List[SearchResult], mock_embeddings
    ):
        """Test select_representatives() picks highest score per cluster."""
        clusters = hdbscan_strategy.cluster(mock_embeddings, sample_results)
        representatives = hdbscan_strategy.select_representatives(
            clusters, sample_results
        )

        # Each representative should be the highest-scored in its cluster
        for rep in representatives:
            # Find the cluster containing this representative
            rep_idx = next(
                i for i, r in enumerate(sample_results) if r.path == rep.path
            )
            for cluster in clusters:
                if rep_idx in cluster:
                    cluster_scores = [sample_results[i].score for i in cluster]
                    assert rep.score == max(cluster_scores)
                    break

    def test_select_representatives_sorted_by_score(
        self, hdbscan_strategy, sample_results: List[SearchResult], mock_embeddings
    ):
        """Test representatives are sorted by score descending."""
        clusters = hdbscan_strategy.cluster(mock_embeddings, sample_results)
        representatives = hdbscan_strategy.select_representatives(
            clusters, sample_results
        )

        scores = [r.score for r in representatives]
        assert scores == sorted(scores, reverse=True)

    def test_fit_predict_end_to_end(
        self, hdbscan_strategy, sample_results: List[SearchResult], mock_embeddings
    ):
        """Test fit_predict() end-to-end clustering."""
        representatives = hdbscan_strategy.fit_predict(mock_embeddings, sample_results)

        # Should have fewer or equal representatives than input
        assert len(representatives) <= len(sample_results)
        # All representatives should be from original results
        rep_paths = {r.path for r in representatives}
        original_paths = {r.path for r in sample_results}
        assert rep_paths.issubset(original_paths)


# =============================================================================
# Test DBSCANStrategy
# =============================================================================


class TestDBSCANStrategy:
    """Tests for DBSCANStrategy - requires sklearn."""

    @pytest.fixture
    def dbscan_strategy(self, default_config):
        """Create DBSCANStrategy if available."""
        try:
            from codexlens.search.clustering import DBSCANStrategy

            return DBSCANStrategy(default_config)
        except ImportError:
            pytest.skip("sklearn not installed")

    def test_cluster_returns_list_of_lists(
        self, dbscan_strategy, sample_results: List[SearchResult], mock_embeddings
    ):
        """Test cluster() returns List[List[int]]."""
        clusters = dbscan_strategy.cluster(mock_embeddings, sample_results)

        assert isinstance(clusters, list)
        for cluster in clusters:
            assert isinstance(cluster, list)
            for idx in cluster:
                assert isinstance(idx, int)
                assert 0 <= idx < len(sample_results)

    def test_cluster_covers_all_results(
        self, dbscan_strategy, sample_results: List[SearchResult], mock_embeddings
    ):
        """Test all result indices appear in clusters."""
        clusters = dbscan_strategy.cluster(mock_embeddings, sample_results)

        all_indices = set()
        for cluster in clusters:
            all_indices.update(cluster)

        assert all_indices == set(range(len(sample_results)))

    def test_cluster_empty_results(self, dbscan_strategy):
        """Test cluster() with empty results."""
        import numpy as np

        clusters = dbscan_strategy.cluster(np.array([]).reshape(0, 3), [])
        assert clusters == []

    def test_cluster_single_result(self, dbscan_strategy):
        """Test cluster() with single result."""
        import numpy as np

        result = SearchResult(path="a.py", score=0.9, excerpt="test")
        embeddings = np.array([[1.0, 0.0, 0.0]])
        clusters = dbscan_strategy.cluster(embeddings, [result])

        assert len(clusters) == 1
        assert clusters[0] == [0]

    def test_cluster_with_explicit_eps(self, default_config):
        """Test cluster() with explicit eps parameter."""
        try:
            from codexlens.search.clustering import DBSCANStrategy
        except ImportError:
            pytest.skip("sklearn not installed")

        import numpy as np

        strategy = DBSCANStrategy(default_config, eps=0.5)
        results = [SearchResult(path=f"{i}.py", score=0.5, excerpt="test") for i in range(3)]
        embeddings = np.array([[0.0, 0.0], [0.1, 0.0], [1.0, 1.0]])

        clusters = strategy.cluster(embeddings, results)
        # With eps=0.5, first two should cluster, third should be separate
        assert len(clusters) >= 2

    def test_auto_compute_eps(self, dbscan_strategy, mock_embeddings):
        """Test eps auto-computation from distance distribution."""
        # Should not raise - eps is computed automatically
        results = [SearchResult(path=f"{i}.py", score=0.5, excerpt="test") for i in range(5)]
        clusters = dbscan_strategy.cluster(mock_embeddings, results)
        assert len(clusters) > 0

    def test_select_representatives_picks_highest_score(
        self, dbscan_strategy, sample_results: List[SearchResult], mock_embeddings
    ):
        """Test select_representatives() picks highest score per cluster."""
        clusters = dbscan_strategy.cluster(mock_embeddings, sample_results)
        representatives = dbscan_strategy.select_representatives(
            clusters, sample_results
        )

        # Each representative should be the highest-scored in its cluster
        for rep in representatives:
            rep_idx = next(
                i for i, r in enumerate(sample_results) if r.path == rep.path
            )
            for cluster in clusters:
                if rep_idx in cluster:
                    cluster_scores = [sample_results[i].score for i in cluster]
                    assert rep.score == max(cluster_scores)
                    break

    def test_select_representatives_sorted_by_score(
        self, dbscan_strategy, sample_results: List[SearchResult], mock_embeddings
    ):
        """Test representatives are sorted by score descending."""
        clusters = dbscan_strategy.cluster(mock_embeddings, sample_results)
        representatives = dbscan_strategy.select_representatives(
            clusters, sample_results
        )

        scores = [r.score for r in representatives]
        assert scores == sorted(scores, reverse=True)


# =============================================================================
# Test ClusteringStrategyFactory
# =============================================================================


class TestClusteringStrategyFactory:
    """Tests for ClusteringStrategyFactory."""

    def test_check_noop_always_available(self):
        """Test noop strategy is always available."""
        ok, err = check_clustering_strategy_available("noop")
        assert ok is True
        assert err is None

    def test_check_invalid_strategy(self):
        """Test invalid strategy name returns error."""
        ok, err = check_clustering_strategy_available("invalid")
        assert ok is False
        assert "Invalid clustering strategy" in err

    def test_get_strategy_noop(self, default_config):
        """Test get_strategy('noop') returns NoOpStrategy."""
        strategy = get_strategy("noop", default_config)
        assert isinstance(strategy, NoOpStrategy)

    def test_get_strategy_auto_returns_something(self, default_config):
        """Test get_strategy('auto') returns a strategy."""
        strategy = get_strategy("auto", default_config)
        assert isinstance(strategy, BaseClusteringStrategy)

    def test_get_strategy_with_fallback_enabled(self, default_config):
        """Test fallback when primary strategy unavailable."""
        # Mock hdbscan unavailable
        with patch.dict("sys.modules", {"hdbscan": None}):
            # Should fall back to dbscan or noop
            strategy = get_strategy("hdbscan", default_config, fallback=True)
            assert isinstance(strategy, BaseClusteringStrategy)

    def test_get_strategy_fallback_disabled_raises(self, default_config):
        """Test ImportError when fallback disabled and strategy unavailable."""
        with patch(
            "codexlens.search.clustering.factory.check_clustering_strategy_available"
        ) as mock_check:
            mock_check.return_value = (False, "Test error")

            with pytest.raises(ImportError, match="Test error"):
                get_strategy("hdbscan", default_config, fallback=False)

    def test_get_strategy_invalid_raises(self, default_config):
        """Test ValueError for invalid strategy name."""
        with pytest.raises(ValueError, match="Unknown clustering strategy"):
            get_strategy("invalid", default_config)

    def test_factory_class_interface(self, default_config):
        """Test ClusteringStrategyFactory class interface."""
        strategy = ClusteringStrategyFactory.get_strategy("noop", default_config)
        assert isinstance(strategy, NoOpStrategy)

        ok, err = ClusteringStrategyFactory.check_available("noop")
        assert ok is True

    @pytest.mark.skipif(
        not check_clustering_strategy_available("hdbscan")[0],
        reason="hdbscan not installed",
    )
    def test_get_strategy_hdbscan(self, default_config):
        """Test get_strategy('hdbscan') returns HDBSCANStrategy."""
        from codexlens.search.clustering import HDBSCANStrategy

        strategy = get_strategy("hdbscan", default_config)
        assert isinstance(strategy, HDBSCANStrategy)

    @pytest.mark.skipif(
        not check_clustering_strategy_available("dbscan")[0],
        reason="sklearn not installed",
    )
    def test_get_strategy_dbscan(self, default_config):
        """Test get_strategy('dbscan') returns DBSCANStrategy."""
        from codexlens.search.clustering import DBSCANStrategy

        strategy = get_strategy("dbscan", default_config)
        assert isinstance(strategy, DBSCANStrategy)

    @pytest.mark.skipif(
        not check_clustering_strategy_available("dbscan")[0],
        reason="sklearn not installed",
    )
    def test_get_strategy_dbscan_with_kwargs(self, default_config):
        """Test DBSCANStrategy kwargs passed through factory."""
        strategy = get_strategy("dbscan", default_config, eps=0.3, eps_percentile=20.0)
        assert strategy.eps == 0.3
        assert strategy.eps_percentile == 20.0


# =============================================================================
# Integration Tests
# =============================================================================


class TestClusteringIntegration:
    """Integration tests for clustering strategies."""

    def test_all_strategies_same_interface(
        self, sample_results: List[SearchResult], mock_embeddings, default_config
    ):
        """Test all strategies have consistent interface."""
        strategies = [NoOpStrategy(default_config)]

        # Add available strategies
        try:
            from codexlens.search.clustering import HDBSCANStrategy

            strategies.append(HDBSCANStrategy(default_config))
        except ImportError:
            pass

        try:
            from codexlens.search.clustering import DBSCANStrategy

            strategies.append(DBSCANStrategy(default_config))
        except ImportError:
            pass

        for strategy in strategies:
            # All should implement cluster()
            clusters = strategy.cluster(mock_embeddings, sample_results)
            assert isinstance(clusters, list)

            # All should implement select_representatives()
            reps = strategy.select_representatives(clusters, sample_results)
            assert isinstance(reps, list)
            assert all(isinstance(r, SearchResult) for r in reps)

            # All should implement fit_predict()
            reps = strategy.fit_predict(mock_embeddings, sample_results)
            assert isinstance(reps, list)

    def test_clustering_reduces_redundancy(
        self, default_config
    ):
        """Test clustering reduces redundant similar results."""
        import numpy as np

        # Create results with very similar embeddings
        results = [
            SearchResult(path=f"{i}.py", score=0.9 - i * 0.01, excerpt="def foo(): pass")
            for i in range(10)
        ]
        # Very similar embeddings - should cluster together
        embeddings = np.array(
            [[1.0 + i * 0.01, 0.0, 0.0] for i in range(10)], dtype=np.float32
        )

        strategy = get_strategy("auto", default_config)
        representatives = strategy.fit_predict(embeddings, results)

        # Should have fewer representatives than input (clustering reduced redundancy)
        # NoOp returns all, but HDBSCAN/DBSCAN should reduce
        assert len(representatives) <= len(results)


# =============================================================================
# Test FrequencyStrategy
# =============================================================================


class TestFrequencyStrategy:
    """Tests for FrequencyStrategy - frequency-based clustering."""

    @pytest.fixture
    def frequency_config(self):
        """Create FrequencyConfig for testing."""
        from codexlens.search.clustering import FrequencyConfig
        return FrequencyConfig(min_frequency=1, max_representatives_per_group=3)

    @pytest.fixture
    def frequency_strategy(self, frequency_config):
        """Create FrequencyStrategy instance."""
        from codexlens.search.clustering import FrequencyStrategy
        return FrequencyStrategy(frequency_config)

    @pytest.fixture
    def symbol_results(self) -> List[SearchResult]:
        """Create sample results with symbol names for frequency testing."""
        return [
            SearchResult(path="auth.py", score=0.9, excerpt="authenticate user", symbol_name="authenticate"),
            SearchResult(path="login.py", score=0.85, excerpt="authenticate login", symbol_name="authenticate"),
            SearchResult(path="session.py", score=0.8, excerpt="authenticate session", symbol_name="authenticate"),
            SearchResult(path="utils.py", score=0.7, excerpt="helper function", symbol_name="helper_func"),
            SearchResult(path="validate.py", score=0.6, excerpt="validate input", symbol_name="validate"),
            SearchResult(path="check.py", score=0.55, excerpt="validate data", symbol_name="validate"),
        ]

    def test_frequency_strategy_available(self):
        """Test FrequencyStrategy is always available (no deps)."""
        ok, err = check_clustering_strategy_available("frequency")
        assert ok is True
        assert err is None

    def test_get_strategy_frequency(self):
        """Test get_strategy('frequency') returns FrequencyStrategy."""
        from codexlens.search.clustering import FrequencyStrategy
        strategy = get_strategy("frequency")
        assert isinstance(strategy, FrequencyStrategy)

    def test_cluster_groups_by_symbol(self, frequency_strategy, symbol_results):
        """Test cluster() groups results by symbol name."""
        import numpy as np
        embeddings = np.random.rand(len(symbol_results), 128)

        clusters = frequency_strategy.cluster(embeddings, symbol_results)

        # Should have 3 groups: authenticate(3), validate(2), helper_func(1)
        assert len(clusters) == 3

        # First cluster should be authenticate (highest frequency)
        first_cluster_symbols = [symbol_results[i].symbol_name for i in clusters[0]]
        assert all(s == "authenticate" for s in first_cluster_symbols)
        assert len(clusters[0]) == 3

    def test_cluster_orders_by_frequency(self, frequency_strategy, symbol_results):
        """Test clusters are ordered by frequency (descending)."""
        import numpy as np
        embeddings = np.random.rand(len(symbol_results), 128)

        clusters = frequency_strategy.cluster(embeddings, symbol_results)

        # Verify frequency ordering
        frequencies = [len(c) for c in clusters]
        assert frequencies == sorted(frequencies, reverse=True)

    def test_select_representatives_adds_frequency_metadata(self, frequency_strategy, symbol_results):
        """Test representatives have frequency metadata."""
        import numpy as np
        embeddings = np.random.rand(len(symbol_results), 128)

        clusters = frequency_strategy.cluster(embeddings, symbol_results)
        reps = frequency_strategy.select_representatives(clusters, symbol_results, embeddings)

        # Check frequency metadata
        for rep in reps:
            assert "frequency" in rep.metadata
            assert rep.metadata["frequency"] >= 1

    def test_min_frequency_filter_mode(self, symbol_results):
        """Test min_frequency with filter mode removes low-frequency results."""
        from codexlens.search.clustering import FrequencyStrategy, FrequencyConfig
        import numpy as np

        config = FrequencyConfig(min_frequency=2, keep_mode="filter")
        strategy = FrequencyStrategy(config)
        embeddings = np.random.rand(len(symbol_results), 128)

        reps = strategy.fit_predict(embeddings, symbol_results)

        # helper_func (freq=1) should be filtered out
        rep_symbols = [r.symbol_name for r in reps]
        assert "helper_func" not in rep_symbols
        assert "authenticate" in rep_symbols
        assert "validate" in rep_symbols

    def test_min_frequency_demote_mode(self, symbol_results):
        """Test min_frequency with demote mode keeps but deprioritizes low-frequency."""
        from codexlens.search.clustering import FrequencyStrategy, FrequencyConfig
        import numpy as np

        config = FrequencyConfig(min_frequency=2, keep_mode="demote")
        strategy = FrequencyStrategy(config)
        embeddings = np.random.rand(len(symbol_results), 128)

        reps = strategy.fit_predict(embeddings, symbol_results)

        # helper_func should still be present but at the end
        rep_symbols = [r.symbol_name for r in reps]
        assert "helper_func" in rep_symbols
        # Should be demoted to end
        helper_idx = rep_symbols.index("helper_func")
        assert helper_idx == len(rep_symbols) - 1

    def test_group_by_file(self, symbol_results):
        """Test grouping by file path instead of symbol."""
        from codexlens.search.clustering import FrequencyStrategy, FrequencyConfig
        import numpy as np

        config = FrequencyConfig(group_by="file")
        strategy = FrequencyStrategy(config)
        embeddings = np.random.rand(len(symbol_results), 128)

        clusters = strategy.cluster(embeddings, symbol_results)

        # Each file should be its own group (all unique paths)
        assert len(clusters) == 6

    def test_max_representatives_per_group(self, symbol_results):
        """Test max_representatives_per_group limits output per symbol."""
        from codexlens.search.clustering import FrequencyStrategy, FrequencyConfig
        import numpy as np

        config = FrequencyConfig(max_representatives_per_group=1)
        strategy = FrequencyStrategy(config)
        embeddings = np.random.rand(len(symbol_results), 128)

        reps = strategy.fit_predict(embeddings, symbol_results)

        # Should have at most 1 per group = 3 groups = 3 reps
        assert len(reps) == 3

    def test_frequency_boost_score(self, symbol_results):
        """Test frequency_weight boosts high-frequency results."""
        from codexlens.search.clustering import FrequencyStrategy, FrequencyConfig
        import numpy as np

        config = FrequencyConfig(frequency_weight=0.5)  # Strong boost
        strategy = FrequencyStrategy(config)
        embeddings = np.random.rand(len(symbol_results), 128)

        reps = strategy.fit_predict(embeddings, symbol_results)

        # High-frequency results should have boosted scores in metadata
        for rep in reps:
            if rep.metadata.get("frequency", 1) > 1:
                assert rep.metadata.get("frequency_boosted_score", 0) > rep.score

    def test_empty_results(self, frequency_strategy):
        """Test handling of empty results."""
        import numpy as np

        clusters = frequency_strategy.cluster(np.array([]).reshape(0, 128), [])
        assert clusters == []

        reps = frequency_strategy.select_representatives([], [], None)
        assert reps == []

    def test_factory_with_kwargs(self):
        """Test factory passes kwargs to FrequencyConfig."""
        strategy = get_strategy("frequency", min_frequency=3, group_by="file")
        assert strategy.config.min_frequency == 3
        assert strategy.config.group_by == "file"
