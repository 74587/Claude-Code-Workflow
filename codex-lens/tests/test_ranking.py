"""Unit tests for ranking.py - RRF weights, intent detection, score fusion, and filtering.

Tests cover:
- detect_query_intent: CamelCase/underscore -> KEYWORD, natural language -> SEMANTIC, mixed
- adjust_weights_by_intent: Weight adjustments per intent type
- get_rrf_weights: Composite of detect + adjust
- reciprocal_rank_fusion: Single/multi source, empty, weight normalization
- simple_weighted_fusion: Basic fusion and empty input
- apply_symbol_boost: Symbol match boost and no-match scenario
- filter_results_by_category: KEYWORD -> code only, SEMANTIC -> docs priority
- group_similar_results: Group results by score proximity
- normalize_weights: All-zero weights edge case
"""

from __future__ import annotations

import math
from typing import Dict, List
from unittest.mock import MagicMock

import pytest

from codexlens.entities import SearchResult
from codexlens.search.ranking import (
    DEFAULT_WEIGHTS,
    QueryIntent,
    adjust_weights_by_intent,
    apply_symbol_boost,
    detect_query_intent,
    filter_results_by_category,
    get_rrf_weights,
    group_similar_results,
    normalize_weights,
    reciprocal_rank_fusion,
    simple_weighted_fusion,
)


# =============================================================================
# Helpers
# =============================================================================


def _make_result(
    path: str = "a.py",
    score: float = 0.5,
    excerpt: str = "def foo():",
    symbol_name: str | None = None,
    symbol_kind: str | None = None,
    start_line: int | None = None,
    end_line: int | None = None,
) -> SearchResult:
    """Create a SearchResult with sensible defaults."""
    return SearchResult(
        path=path,
        score=score,
        excerpt=excerpt,
        symbol_name=symbol_name,
        symbol_kind=symbol_kind,
        start_line=start_line,
        end_line=end_line,
    )


# =============================================================================
# Tests: detect_query_intent
# =============================================================================


class TestDetectQueryIntent:
    """Tests for detect_query_intent()."""

    def test_detect_keyword_intent(self):
        """CamelCase/underscore queries should be detected as KEYWORD."""
        assert detect_query_intent("MyClassName") == QueryIntent.KEYWORD
        assert detect_query_intent("my_function_name") == QueryIntent.KEYWORD
        assert detect_query_intent("foo::bar") == QueryIntent.KEYWORD

    def test_detect_semantic_intent(self):
        """Natural language queries should be detected as SEMANTIC."""
        assert detect_query_intent("how to authenticate users safely?") == QueryIntent.SEMANTIC
        assert detect_query_intent("explain the login process") == QueryIntent.SEMANTIC

    def test_detect_mixed_intent(self):
        """Queries with both code and NL signals should be MIXED."""
        # Has code signal (underscore identifier) and NL signal ("how")
        assert detect_query_intent("how does my_function work") == QueryIntent.MIXED

    def test_detect_empty_query(self):
        """Empty string should return MIXED (safe default)."""
        assert detect_query_intent("") == QueryIntent.MIXED
        assert detect_query_intent("   ") == QueryIntent.MIXED


# =============================================================================
# Tests: adjust_weights_by_intent
# =============================================================================


class TestAdjustWeightsByIntent:
    """Tests for adjust_weights_by_intent()."""

    def test_adjust_keyword_weights(self):
        """KEYWORD intent should boost exact and reduce vector."""
        base = {"exact": 0.3, "fuzzy": 0.1, "vector": 0.6}
        adjusted = adjust_weights_by_intent(QueryIntent.KEYWORD, base)
        # Expected target: exact:0.5, fuzzy:0.1, vector:0.4
        assert adjusted["exact"] == pytest.approx(0.5, abs=0.01)
        assert adjusted["fuzzy"] == pytest.approx(0.1, abs=0.01)
        assert adjusted["vector"] == pytest.approx(0.4, abs=0.01)

    def test_adjust_semantic_weights(self):
        """SEMANTIC intent should boost vector and reduce exact."""
        base = {"exact": 0.3, "fuzzy": 0.1, "vector": 0.6}
        adjusted = adjust_weights_by_intent(QueryIntent.SEMANTIC, base)
        # Expected target: exact:0.2, fuzzy:0.1, vector:0.7
        assert adjusted["exact"] == pytest.approx(0.2, abs=0.01)
        assert adjusted["fuzzy"] == pytest.approx(0.1, abs=0.01)
        assert adjusted["vector"] == pytest.approx(0.7, abs=0.01)

    def test_adjust_mixed_weights(self):
        """MIXED intent should return normalized base_weights."""
        base = {"exact": 0.3, "fuzzy": 0.1, "vector": 0.6}
        adjusted = adjust_weights_by_intent(QueryIntent.MIXED, base)
        # MIXED returns normalized base_weights
        total = sum(adjusted.values())
        assert total == pytest.approx(1.0, abs=0.01)
        # Proportions should be preserved
        assert adjusted["exact"] == pytest.approx(0.3, abs=0.01)


# =============================================================================
# Tests: get_rrf_weights
# =============================================================================


class TestGetRrfWeights:
    """Tests for get_rrf_weights() composite function."""

    def test_get_rrf_weights_composite(self):
        """get_rrf_weights should compose detect_query_intent + adjust_weights_by_intent."""
        base = {"exact": 0.3, "fuzzy": 0.1, "vector": 0.6}
        # Keyword-like query
        weights = get_rrf_weights("MyClassName", base)
        # MyClassName -> KEYWORD -> exact boosted
        assert weights["exact"] > weights["fuzzy"]


# =============================================================================
# Tests: reciprocal_rank_fusion
# =============================================================================


class TestReciprocalRankFusion:
    """Tests for reciprocal_rank_fusion()."""

    def test_rrf_single_source(self):
        """Single source RRF should produce ranked results."""
        results = {
            "exact": [
                _make_result(path="a.py", score=10.0),
                _make_result(path="b.py", score=5.0),
            ]
        }
        fused = reciprocal_rank_fusion(results)
        assert len(fused) == 2
        # a.py should rank higher (rank 1)
        assert fused[0].path == "a.py"
        assert fused[0].score > fused[1].score

    def test_rrf_multi_source(self):
        """Multi-source RRF should combine rankings from multiple sources."""
        results = {
            "exact": [
                _make_result(path="a.py", score=10.0),
                _make_result(path="b.py", score=5.0),
            ],
            "vector": [
                _make_result(path="b.py", score=0.9),
                _make_result(path="c.py", score=0.8),
            ],
        }
        weights = {"exact": 0.5, "vector": 0.5}
        fused = reciprocal_rank_fusion(results, weights=weights)
        # b.py appears in both sources - should have highest fusion score
        assert len(fused) == 3
        assert fused[0].path == "b.py"
        assert fused[0].metadata["fusion_method"] == "rrf"

    def test_rrf_empty_results(self):
        """Empty results map should return empty list."""
        assert reciprocal_rank_fusion({}) == []

    def test_rrf_weight_normalization(self):
        """Weights not summing to 1.0 should be auto-normalized."""
        results = {
            "exact": [_make_result(path="a.py", score=10.0)],
        }
        weights = {"exact": 2.0}  # Does not sum to 1.0
        fused = reciprocal_rank_fusion(results, weights=weights)
        assert len(fused) == 1
        # Result should still be valid after weight normalization
        assert fused[0].score > 0


# =============================================================================
# Tests: simple_weighted_fusion
# =============================================================================


class TestSimpleWeightedFusion:
    """Tests for simple_weighted_fusion()."""

    def test_weighted_fusion_basic(self):
        """Basic weighted fusion should combine scores."""
        results = {
            "exact": [_make_result(path="a.py", score=10.0)],
            "vector": [_make_result(path="a.py", score=0.8)],
        }
        weights = {"exact": 0.5, "vector": 0.5}
        fused = simple_weighted_fusion(results, weights=weights)
        assert len(fused) == 1
        assert fused[0].path == "a.py"
        assert fused[0].metadata["fusion_method"] == "simple_weighted"
        assert fused[0].score > 0

    def test_weighted_fusion_empty(self):
        """Empty input should return empty list."""
        assert simple_weighted_fusion({}) == []


# =============================================================================
# Tests: apply_symbol_boost
# =============================================================================


class TestApplySymbolBoost:
    """Tests for apply_symbol_boost()."""

    def test_symbol_boost_applied(self):
        """Results with symbol_name should get boosted by factor."""
        results = [
            _make_result(path="a.py", score=0.5, symbol_name="authenticate"),
            _make_result(path="b.py", score=0.6),
        ]
        boosted = apply_symbol_boost(results, boost_factor=1.5)
        # a.py has symbol -> gets 1.5x boost -> 0.75
        a_result = next(r for r in boosted if r.path == "a.py")
        assert a_result.score == pytest.approx(0.75, abs=0.01)
        assert a_result.metadata.get("boosted") is True

    def test_symbol_boost_no_match(self):
        """Results without symbol_name should not be boosted."""
        results = [
            _make_result(path="a.py", score=0.5),
        ]
        boosted = apply_symbol_boost(results, boost_factor=1.5)
        assert boosted[0].score == pytest.approx(0.5, abs=0.01)
        assert boosted[0].metadata.get("boosted") is not True


# =============================================================================
# Tests: filter_results_by_category
# =============================================================================


class TestFilterResultsByCategory:
    """Tests for filter_results_by_category()."""

    def test_filter_keyword_code_only(self):
        """KEYWORD intent should return only code files."""
        results = [
            _make_result(path="main.py", score=0.9),
            _make_result(path="README.md", score=0.8),
            _make_result(path="utils.ts", score=0.7),
        ]
        filtered = filter_results_by_category(results, QueryIntent.KEYWORD)
        paths = [r.path for r in filtered]
        assert "README.md" not in paths
        assert "main.py" in paths
        assert "utils.ts" in paths

    def test_filter_semantic_docs_first(self):
        """SEMANTIC intent should put docs before code."""
        results = [
            _make_result(path="main.py", score=0.9),
            _make_result(path="README.md", score=0.8),
        ]
        filtered = filter_results_by_category(results, QueryIntent.SEMANTIC, allow_mixed=True)
        # Docs should come first
        assert filtered[0].path == "README.md"


# =============================================================================
# Tests: group_similar_results
# =============================================================================


class TestGroupSimilarResults:
    """Tests for group_similar_results()."""

    def test_group_similar_results(self):
        """Results with same excerpt and close scores should be grouped."""
        results = [
            _make_result(path="a.py", score=0.50, excerpt="def foo():"),
            _make_result(path="b.py", score=0.50, excerpt="def foo():"),
            _make_result(path="c.py", score=0.30, excerpt="def bar():"),
        ]
        grouped = group_similar_results(results, score_threshold_abs=0.01)
        # a.py and b.py should be grouped (same excerpt, same score)
        assert len(grouped) == 2
        # Find the grouped result
        grouped_result = next(r for r in grouped if r.path == "a.py")
        assert len(grouped_result.additional_locations) == 1
        assert grouped_result.additional_locations[0].path == "b.py"


# =============================================================================
# Tests: normalize_weights
# =============================================================================


class TestNormalizeWeights:
    """Tests for normalize_weights()."""

    def test_normalize_weights_zero_total(self):
        """All-zero weights should be returned as-is (no division by zero)."""
        weights = {"exact": 0.0, "fuzzy": 0.0, "vector": 0.0}
        result = normalize_weights(weights)
        assert result == {"exact": 0.0, "fuzzy": 0.0, "vector": 0.0}
