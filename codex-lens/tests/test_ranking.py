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
    apply_path_penalties,
    extract_explicit_path_hints,
    cross_encoder_rerank,
    adjust_weights_by_intent,
    apply_symbol_boost,
    detect_query_intent,
    filter_results_by_category,
    get_rrf_weights,
    group_similar_results,
    is_auxiliary_reference_path,
    is_generated_artifact_path,
    is_test_file,
    normalize_weights,
    query_prefers_lexical_search,
    query_targets_auxiliary_files,
    query_targets_generated_files,
    query_targets_test_files,
    rebalance_noisy_results,
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
        assert detect_query_intent("windowsHide") == QueryIntent.KEYWORD
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

    def test_query_targets_test_files(self):
        """Queries explicitly mentioning tests should skip test penalties."""
        assert query_targets_test_files("how do tests cover auth flow?")
        assert query_targets_test_files("spec fixtures for parser")
        assert not query_targets_test_files("windowsHide")

    def test_query_targets_generated_files(self):
        """Queries explicitly mentioning build artifacts should skip that penalty."""
        assert query_targets_generated_files("inspect dist bundle output")
        assert query_targets_generated_files("generated artifacts under build")
        assert not query_targets_generated_files("cache invalidation strategy")

    def test_query_prefers_lexical_search(self):
        """Config/env/factory queries should prefer lexical-first routing."""
        assert query_prefers_lexical_search("embedding backend fastembed local litellm api config")
        assert query_prefers_lexical_search("get_reranker factory onnx backend selection")
        assert query_prefers_lexical_search("EMBEDDING_BACKEND and RERANKER_BACKEND environment variables")
        assert not query_prefers_lexical_search("how does smart search route keyword queries")


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


class TestPathPenalties:
    """Tests for lightweight path-based ranking penalties."""

    def test_is_test_file(self):
        assert is_test_file("/repo/tests/test_auth.py")
        assert is_test_file("D:\\repo\\src\\auth.spec.ts")
        assert is_test_file("/repo/frontend/src/pages/discoverypage.test.tsx")
        assert is_test_file("/repo/frontend/src/pages/discoverypage.spec.jsx")
        assert not is_test_file("/repo/src/auth.py")

    def test_is_generated_artifact_path(self):
        assert is_generated_artifact_path("/repo/dist/app.js")
        assert is_generated_artifact_path("/repo/src/generated/client.ts")
        assert is_generated_artifact_path("D:\\repo\\frontend\\.next\\server.js")
        assert not is_generated_artifact_path("/repo/src/auth.py")

    def test_is_auxiliary_reference_path(self):
        assert is_auxiliary_reference_path("/repo/examples/auth_demo.py")
        assert is_auxiliary_reference_path("/repo/benchmarks/search_eval.py")
        assert is_auxiliary_reference_path("/repo/tools/debug_search.py")
        assert not is_auxiliary_reference_path("/repo/src/auth.py")

    def test_query_targets_auxiliary_files(self):
        assert query_targets_auxiliary_files("show smart search examples")
        assert query_targets_auxiliary_files("benchmark smart search")
        assert not query_targets_auxiliary_files("smart search routing")

    def test_apply_path_penalties_demotes_test_files(self):
        results = [
            _make_result(path="/repo/tests/test_auth.py", score=10.0),
            _make_result(path="/repo/src/auth.py", score=9.0),
        ]

        penalized = apply_path_penalties(
            results,
            "authenticate user",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/src/auth.py"
        assert penalized[1].metadata["path_penalty_reasons"] == ["test_file"]

    def test_apply_path_penalties_more_aggressively_demotes_tests_for_keyword_queries(self):
        results = [
            _make_result(path="/repo/tests/test_auth.py", score=5.0),
            _make_result(path="/repo/src/auth.py", score=4.0),
        ]

        penalized = apply_path_penalties(
            results,
            "find_descendant_project_roots",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/src/auth.py"
        assert penalized[1].metadata["path_penalty_reasons"] == ["test_file"]
        assert penalized[1].metadata["path_penalty_multiplier"] == pytest.approx(0.55)
        assert penalized[1].metadata["path_rank_multiplier"] == pytest.approx(0.55)

    def test_apply_path_penalties_more_aggressively_demotes_tests_for_semantic_queries(self):
        results = [
            _make_result(path="/repo/tests/test_auth.py", score=5.0),
            _make_result(path="/repo/src/auth.py", score=4.1),
        ]

        penalized = apply_path_penalties(
            results,
            "how does auth routing work",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/src/auth.py"
        assert penalized[1].metadata["path_penalty_reasons"] == ["test_file"]
        assert penalized[1].metadata["path_penalty_multiplier"] == pytest.approx(0.75)

    def test_apply_path_penalties_boosts_source_definitions_for_identifier_queries(self):
        results = [
            _make_result(
                path="/repo/tests/test_registry.py",
                score=4.2,
                excerpt='query="find_descendant_project_roots"',
            ),
            _make_result(
                path="/repo/src/registry.py",
                score=3.0,
                excerpt="def find_descendant_project_roots(self, source_root: Path) -> list[str]:",
            ),
        ]

        penalized = apply_path_penalties(
            results,
            "find_descendant_project_roots",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/src/registry.py"
        assert penalized[0].metadata["path_boost_reasons"] == ["source_definition"]
        assert penalized[0].metadata["path_boost_multiplier"] == pytest.approx(2.0)
        assert penalized[0].metadata["path_rank_multiplier"] == pytest.approx(2.0)
        assert penalized[1].metadata["path_penalty_reasons"] == ["test_file"]

    def test_apply_path_penalties_boosts_source_paths_for_semantic_feature_queries(self):
        results = [
            _make_result(
                path="/repo/tests/smart-search-intent.test.js",
                score=0.832,
                excerpt="describes how smart search routes keyword queries",
            ),
            _make_result(
                path="/repo/src/tools/smart-search.ts",
                score=0.555,
                excerpt="smart search keyword routing logic",
            ),
        ]

        penalized = apply_path_penalties(
            results,
            "how does smart search route keyword queries",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/src/tools/smart-search.ts"
        assert penalized[0].metadata["path_boost_reasons"] == ["source_path_topic_overlap"]
        assert penalized[0].metadata["path_boost_multiplier"] == pytest.approx(1.35)
        assert penalized[0].metadata["path_boost_overlap_tokens"] == ["smart", "search"]
        assert penalized[1].metadata["path_penalty_reasons"] == ["test_file"]

    def test_apply_path_penalties_strongly_boosts_keyword_basename_overlap(self):
        results = [
            _make_result(
                path="/repo/src/tools/core-memory.ts",
                score=0.04032417772512223,
                excerpt="memory listing helpers",
            ),
            _make_result(
                path="/repo/src/tools/smart-search.ts",
                score=0.009836065573770493,
                excerpt="smart search keyword routing logic",
            ),
        ]

        penalized = apply_path_penalties(
            results,
            "executeHybridMode dense_rerank semantic smart_search",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/src/tools/smart-search.ts"
        assert penalized[0].metadata["path_boost_reasons"] == ["source_path_topic_overlap"]
        assert penalized[0].metadata["path_boost_multiplier"] == pytest.approx(4.5)
        assert penalized[0].metadata["path_boost_overlap_tokens"] == ["smart", "search"]

    def test_extract_explicit_path_hints_ignores_generic_platform_terms(self):
        assert extract_explicit_path_hints(
            "parse CodexLens JSON output strip ANSI smart_search",
        ) == [["smart", "search"]]

    def test_apply_path_penalties_prefers_explicit_feature_hint_over_platform_terms(self):
        results = [
            _make_result(
                path="/repo/src/tools/codex-lens-lsp.ts",
                score=0.045,
                excerpt="CodexLens LSP bridge",
            ),
            _make_result(
                path="/repo/src/tools/smart-search.ts",
                score=0.03,
                excerpt="parse JSON output and strip ANSI for plain-text fallback",
            ),
        ]

        penalized = apply_path_penalties(
            results,
            "parse CodexLens JSON output strip ANSI smart_search",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/src/tools/smart-search.ts"
        assert penalized[0].metadata["path_boost_reasons"] == ["source_path_topic_overlap"]
        assert penalized[0].metadata["path_boost_overlap_tokens"] == ["smart", "search"]

    def test_apply_path_penalties_strongly_boosts_lexical_config_modules(self):
        results = [
            _make_result(
                path="/repo/src/tools/smart-search.ts",
                score=22.07,
                excerpt="embedding backend local api config routing",
            ),
            _make_result(
                path="/repo/src/codexlens/config.py",
                score=4.88,
                excerpt="embedding_backend = 'fastembed'",
            ),
        ]

        penalized = apply_path_penalties(
            results,
            "embedding backend fastembed local litellm api config",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/src/codexlens/config.py"
        assert penalized[0].metadata["path_boost_reasons"] == ["source_path_topic_overlap"]
        assert penalized[0].metadata["path_boost_multiplier"] == pytest.approx(5.0)
        assert penalized[0].metadata["path_boost_overlap_tokens"] == ["config"]

    def test_apply_path_penalties_more_aggressively_demotes_tests_for_explicit_feature_queries(self):
        results = [
            _make_result(
                path="/repo/tests/smart-search-intent.test.js",
                score=1.0,
                excerpt="smart search intent coverage",
            ),
            _make_result(
                path="/repo/src/tools/smart-search.ts",
                score=0.58,
                excerpt="plain-text JSON fallback for smart search",
            ),
        ]

        penalized = apply_path_penalties(
            results,
            "parse CodexLens JSON output strip ANSI smart_search",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/src/tools/smart-search.ts"
        assert penalized[1].metadata["path_penalty_reasons"] == ["test_file"]
        assert penalized[1].metadata["path_penalty_multiplier"] == pytest.approx(0.55)

    def test_apply_path_penalties_demotes_generated_artifacts(self):
        results = [
            _make_result(path="/repo/dist/auth.js", score=10.0),
            _make_result(path="/repo/src/auth.ts", score=9.0),
        ]

        penalized = apply_path_penalties(
            results,
            "authenticate user",
            generated_file_penalty=0.35,
        )

        assert penalized[0].path == "/repo/src/auth.ts"
        assert penalized[1].metadata["path_penalty_reasons"] == ["generated_artifact"]

    def test_apply_path_penalties_more_aggressively_demotes_generated_artifacts_for_explicit_feature_queries(self):
        results = [
            _make_result(
                path="/repo/dist/tools/smart-search.js",
                score=1.0,
                excerpt="built smart search output",
            ),
            _make_result(
                path="/repo/src/tools/smart-search.ts",
                score=0.45,
                excerpt="plain-text JSON fallback for smart search",
            ),
        ]

        penalized = apply_path_penalties(
            results,
            "parse CodexLens JSON output strip ANSI smart_search",
            generated_file_penalty=0.35,
        )

        assert penalized[0].path == "/repo/src/tools/smart-search.ts"
        assert penalized[1].metadata["path_penalty_reasons"] == ["generated_artifact"]
        assert penalized[1].metadata["path_penalty_multiplier"] == pytest.approx(0.4)

    def test_apply_path_penalties_demotes_auxiliary_reference_files(self):
        results = [
            _make_result(path="/repo/examples/simple_search_comparison.py", score=10.0),
            _make_result(path="/repo/src/search/router.py", score=9.0),
        ]

        penalized = apply_path_penalties(
            results,
            "how does smart search route keyword queries",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/src/search/router.py"
        assert penalized[1].metadata["path_penalty_reasons"] == ["auxiliary_file"]

    def test_apply_path_penalties_more_aggressively_demotes_auxiliary_files_for_explicit_feature_queries(self):
        results = [
            _make_result(
                path="/repo/benchmarks/smart_search_demo.py",
                score=1.0,
                excerpt="demo for smart search fallback",
            ),
            _make_result(
                path="/repo/src/tools/smart-search.ts",
                score=0.52,
                excerpt="plain-text JSON fallback for smart search",
            ),
        ]

        penalized = apply_path_penalties(
            results,
            "parse CodexLens JSON output strip ANSI smart_search",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/src/tools/smart-search.ts"
        assert penalized[1].metadata["path_penalty_reasons"] == ["auxiliary_file"]
        assert penalized[1].metadata["path_penalty_multiplier"] == pytest.approx(0.5)

    def test_apply_path_penalties_skips_when_query_targets_tests(self):
        results = [
            _make_result(path="/repo/tests/test_auth.py", score=10.0),
            _make_result(path="/repo/src/auth.py", score=9.0),
        ]

        penalized = apply_path_penalties(
            results,
            "auth tests",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/tests/test_auth.py"

    def test_apply_path_penalties_skips_generated_penalty_when_query_targets_artifacts(self):
        results = [
            _make_result(path="/repo/dist/auth.js", score=10.0),
            _make_result(path="/repo/src/auth.ts", score=9.0),
        ]

        penalized = apply_path_penalties(
            results,
            "dist auth bundle",
            generated_file_penalty=0.35,
        )

        assert penalized[0].path == "/repo/dist/auth.js"

    def test_rebalance_noisy_results_pushes_explicit_feature_query_noise_behind_source_files(self):
        results = [
            _make_result(path="/repo/src/tools/smart-search.ts", score=0.9),
            _make_result(path="/repo/tests/smart-search-intent.test.tsx", score=0.8),
            _make_result(path="/repo/src/core/cli-routes.ts", score=0.7),
            _make_result(path="/repo/dist/tools/smart-search.js", score=0.6),
            _make_result(path="/repo/benchmarks/smart_search_demo.py", score=0.5),
        ]

        rebalanced = rebalance_noisy_results(
            results,
            "parse CodexLens JSON output strip ANSI smart_search",
        )

        assert [item.path for item in rebalanced[:2]] == [
            "/repo/src/tools/smart-search.ts",
            "/repo/src/core/cli-routes.ts",
        ]

    def test_rebalance_noisy_results_preserves_tests_when_query_targets_them(self):
        results = [
            _make_result(path="/repo/tests/smart-search-intent.test.tsx", score=0.9),
            _make_result(path="/repo/src/tools/smart-search.ts", score=0.8),
        ]

        rebalanced = rebalance_noisy_results(results, "smart search tests")

        assert [item.path for item in rebalanced] == [
            "/repo/tests/smart-search-intent.test.tsx",
            "/repo/src/tools/smart-search.ts",
        ]

    def test_apply_path_penalties_skips_auxiliary_penalty_when_query_targets_examples(self):
        results = [
            _make_result(path="/repo/examples/simple_search_comparison.py", score=10.0),
            _make_result(path="/repo/src/search/router.py", score=9.0),
        ]

        penalized = apply_path_penalties(
            results,
            "smart search examples",
            test_file_penalty=0.15,
        )

        assert penalized[0].path == "/repo/examples/simple_search_comparison.py"


class TestCrossEncoderRerank:
    """Tests for cross-encoder reranking edge cases."""

    def test_cross_encoder_rerank_preserves_strong_source_candidates_for_semantic_feature_queries(self):
        class DummyReranker:
            def score_pairs(self, pairs, batch_size=32):
                _ = (pairs, batch_size)
                return [0.8323705792427063, 1.2463066923373844e-05]

        reranked = cross_encoder_rerank(
            "how does smart search route keyword queries",
            [
                _make_result(
                    path="/repo/tests/smart-search-intent.test.js",
                    score=0.5989155769348145,
                    excerpt="describes how smart search routes keyword queries",
                ),
                _make_result(
                    path="/repo/src/tools/smart-search.ts",
                    score=0.554444432258606,
                    excerpt="smart search keyword routing logic",
                ),
            ],
            DummyReranker(),
            top_k=2,
        )
        reranked = apply_path_penalties(
            reranked,
            "how does smart search route keyword queries",
            test_file_penalty=0.15,
        )

        assert reranked[0].path == "/repo/src/tools/smart-search.ts"
        assert reranked[0].metadata["cross_encoder_floor_reason"] == "semantic_source_path_overlap"
        assert reranked[0].metadata["cross_encoder_floor_overlap_tokens"] == ["smart", "search"]
        assert reranked[0].metadata["path_boost_reasons"] == ["source_path_topic_overlap"]
        assert reranked[1].metadata["path_penalty_reasons"] == ["test_file"]

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
