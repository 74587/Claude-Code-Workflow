"""Multi-level tests for search result grouping functionality.

Tests cover:
1. Unit tests for group_similar_results function
2. Boundary condition tests
3. Integration tests with SearchOptions
4. Performance/stress tests
"""

import pytest
from typing import List

from codexlens.entities import SearchResult, AdditionalLocation
from codexlens.search.ranking import group_similar_results
from codexlens.search.chain_search import SearchOptions


# =============================================================================
# Test Fixtures
# =============================================================================

@pytest.fixture
def sample_results() -> List[SearchResult]:
    """Create sample search results for testing."""
    return [
        SearchResult(path="a.py", score=0.5, excerpt="def foo(): pass", start_line=10, symbol_name="foo"),
        SearchResult(path="b.py", score=0.5, excerpt="def foo(): pass", start_line=20, symbol_name="foo"),
        SearchResult(path="c.py", score=0.49, excerpt="def foo(): pass", start_line=30, symbol_name="foo"),
        SearchResult(path="d.py", score=0.3, excerpt="def bar(): pass", start_line=40, symbol_name="bar"),
    ]


@pytest.fixture
def results_with_different_excerpts() -> List[SearchResult]:
    """Results with same scores but different content."""
    return [
        SearchResult(path="a.py", score=0.5, excerpt="def foo(): pass"),
        SearchResult(path="b.py", score=0.5, excerpt="def bar(): pass"),
        SearchResult(path="c.py", score=0.5, excerpt="def baz(): pass"),
    ]


@pytest.fixture
def results_with_same_excerpt_different_scores() -> List[SearchResult]:
    """Results with same content but very different scores."""
    return [
        SearchResult(path="a.py", score=0.9, excerpt="def foo(): pass"),
        SearchResult(path="b.py", score=0.5, excerpt="def foo(): pass"),
        SearchResult(path="c.py", score=0.1, excerpt="def foo(): pass"),
    ]


# =============================================================================
# Level 1: Unit Tests - Basic Functionality
# =============================================================================

class TestGroupSimilarResultsBasic:
    """Basic unit tests for group_similar_results function."""

    def test_empty_results_returns_empty(self):
        """Empty input should return empty output."""
        result = group_similar_results([])
        assert result == []

    def test_single_result_returns_unchanged(self):
        """Single result should be returned as-is."""
        single = SearchResult(path="test.py", score=0.5, excerpt="code")
        result = group_similar_results([single])

        assert len(result) == 1
        assert result[0].path == "test.py"
        assert result[0].additional_locations == []

    def test_groups_identical_excerpt_similar_score(self, sample_results):
        """Results with same excerpt and similar scores should be grouped."""
        grouped = group_similar_results(sample_results, score_threshold_abs=0.02)

        # Should have 2 groups: foo group (a, b, c) and bar (d)
        assert len(grouped) == 2

        # First group should have additional locations
        foo_group = next(r for r in grouped if r.excerpt == "def foo(): pass")
        assert len(foo_group.additional_locations) == 2

        # Second group (bar) should have no additional locations
        bar_group = next(r for r in grouped if r.excerpt == "def bar(): pass")
        assert len(bar_group.additional_locations) == 0

    def test_preserves_highest_score_as_representative(self, sample_results):
        """Representative result should have the highest score in group."""
        grouped = group_similar_results(sample_results, score_threshold_abs=0.02)

        foo_group = next(r for r in grouped if r.excerpt == "def foo(): pass")
        # a.py has score 0.5, which is highest
        assert foo_group.path == "a.py"
        assert foo_group.score == 0.5

    def test_additional_locations_contain_correct_info(self, sample_results):
        """Additional locations should contain correct path, score, line info."""
        grouped = group_similar_results(sample_results, score_threshold_abs=0.02)

        foo_group = next(r for r in grouped if r.excerpt == "def foo(): pass")
        locations = foo_group.additional_locations

        paths = {loc.path for loc in locations}
        assert "b.py" in paths
        assert "c.py" in paths

        # Check that start_line is preserved
        for loc in locations:
            if loc.path == "b.py":
                assert loc.start_line == 20
            elif loc.path == "c.py":
                assert loc.start_line == 30


# =============================================================================
# Level 2: Boundary Condition Tests
# =============================================================================

class TestGroupSimilarResultsBoundary:
    """Boundary condition tests for edge cases."""

    def test_threshold_zero_no_grouping(self):
        """With threshold=0, only exactly equal scores should group."""
        results = [
            SearchResult(path="a.py", score=0.5, excerpt="def foo()"),
            SearchResult(path="b.py", score=0.5, excerpt="def foo()"),
            SearchResult(path="c.py", score=0.50001, excerpt="def foo()"),  # Slightly different
        ]

        grouped = group_similar_results(results, score_threshold_abs=0.0)

        # a and b should group (exact same score), c should be separate
        assert len(grouped) == 2

        main_group = next(r for r in grouped if len(r.additional_locations) > 0)
        assert len(main_group.additional_locations) == 1

    def test_threshold_exact_boundary(self):
        """Test behavior at exact threshold boundary.

        Note: Due to floating-point precision, 0.5 - 0.49 = 0.010000000000000009
        which is slightly > 0.01, so they won't group with threshold=0.01.
        Use a slightly larger threshold to account for floating-point precision.
        """
        results = [
            SearchResult(path="a.py", score=0.5, excerpt="def foo()"),
            SearchResult(path="b.py", score=0.49, excerpt="def foo()"),  # 0.01 diff (floating-point)
            SearchResult(path="c.py", score=0.48, excerpt="def foo()"),  # 0.02 diff from a
        ]

        # With threshold 0.011 (slightly above floating-point 0.01), a and b should group
        grouped = group_similar_results(results, score_threshold_abs=0.011)

        # a groups with b, c is separate (0.02 from a, 0.01 from b)
        # After a+b group, c is compared with remaining and forms its own group
        assert len(grouped) == 2

        # Verify a is representative (highest score)
        main_group = next(r for r in grouped if r.score == 0.5)
        assert main_group.path == "a.py"
        assert len(main_group.additional_locations) == 1
        assert main_group.additional_locations[0].path == "b.py"

    def test_large_threshold_groups_all(self):
        """Very large threshold should group all same-content results."""
        results = [
            SearchResult(path="a.py", score=0.9, excerpt="def foo()"),
            SearchResult(path="b.py", score=0.1, excerpt="def foo()"),
        ]

        grouped = group_similar_results(results, score_threshold_abs=1.0)

        assert len(grouped) == 1
        assert len(grouped[0].additional_locations) == 1

    def test_none_excerpt_not_grouped(self):
        """Results with None excerpt should not be grouped."""
        results = [
            SearchResult(path="a.py", score=0.5, excerpt=None),
            SearchResult(path="b.py", score=0.5, excerpt=None),
        ]

        grouped = group_similar_results(results)

        # None excerpts can't be grouped by content
        assert len(grouped) == 2
        for r in grouped:
            assert len(r.additional_locations) == 0

    def test_empty_excerpt_not_grouped(self):
        """Results with empty string excerpt should not be grouped."""
        results = [
            SearchResult(path="a.py", score=0.5, excerpt=""),
            SearchResult(path="b.py", score=0.5, excerpt=""),
            SearchResult(path="c.py", score=0.5, excerpt="   "),  # Whitespace only
        ]

        grouped = group_similar_results(results)

        # Empty/whitespace excerpts can't be grouped
        assert len(grouped) == 3

    def test_different_excerpts_not_grouped(self, results_with_different_excerpts):
        """Results with different excerpts should not be grouped even with same score."""
        grouped = group_similar_results(results_with_different_excerpts, score_threshold_abs=1.0)

        # Different content = no grouping
        assert len(grouped) == 3
        for r in grouped:
            assert len(r.additional_locations) == 0

    def test_same_excerpt_different_scores_creates_subgroups(self, results_with_same_excerpt_different_scores):
        """Same content but very different scores should create separate subgroups."""
        grouped = group_similar_results(
            results_with_same_excerpt_different_scores,
            score_threshold_abs=0.1
        )

        # Scores 0.9, 0.5, 0.1 with threshold 0.1
        # 0.9 and 0.5 differ by 0.4 > 0.1, so separate
        # 0.5 and 0.1 differ by 0.4 > 0.1, so separate
        assert len(grouped) == 3


# =============================================================================
# Level 3: Content Field Tests
# =============================================================================

class TestGroupSimilarResultsContentField:
    """Tests for different content_field options."""

    def test_group_by_content_field(self):
        """Should be able to group by 'content' field instead of 'excerpt'."""
        results = [
            SearchResult(path="a.py", score=0.5, excerpt="short", content="full content here"),
            SearchResult(path="b.py", score=0.5, excerpt="different", content="full content here"),
        ]

        # Group by excerpt - different excerpts, no grouping
        grouped_by_excerpt = group_similar_results(results, content_field="excerpt")
        assert len(grouped_by_excerpt) == 2

        # Group by content - same content, should group
        grouped_by_content = group_similar_results(results, content_field="content")
        assert len(grouped_by_content) == 1
        assert len(grouped_by_content[0].additional_locations) == 1

    def test_fallback_when_content_field_missing(self):
        """Results without the specified content field should not be grouped."""
        results = [
            SearchResult(path="a.py", score=0.5, content=None),
            SearchResult(path="b.py", score=0.5, content=None),
        ]

        grouped = group_similar_results(results, content_field="content")

        # None content = ungroupable
        assert len(grouped) == 2


# =============================================================================
# Level 4: Metadata and Ordering Tests
# =============================================================================

class TestGroupSimilarResultsMetadata:
    """Tests for metadata handling and result ordering."""

    def test_grouped_count_in_metadata(self, sample_results):
        """Grouped results should have grouped_count in metadata."""
        grouped = group_similar_results(sample_results, score_threshold_abs=0.02)

        foo_group = next(r for r in grouped if r.excerpt == "def foo(): pass")

        assert "grouped_count" in foo_group.metadata
        assert foo_group.metadata["grouped_count"] == 3  # a, b, c

    def test_preserves_original_metadata(self):
        """Original metadata should be preserved in grouped result."""
        results = [
            SearchResult(
                path="a.py",
                score=0.5,
                excerpt="def foo()",
                metadata={"original_key": "original_value", "fusion_score": 0.5}
            ),
            SearchResult(path="b.py", score=0.5, excerpt="def foo()"),
        ]

        grouped = group_similar_results(results, score_threshold_abs=0.1)

        assert grouped[0].metadata["original_key"] == "original_value"
        assert grouped[0].metadata["fusion_score"] == 0.5

    def test_results_sorted_by_score_descending(self):
        """Final results should be sorted by score descending."""
        results = [
            SearchResult(path="low.py", score=0.1, excerpt="low"),
            SearchResult(path="high.py", score=0.9, excerpt="high"),
            SearchResult(path="mid.py", score=0.5, excerpt="mid"),
        ]

        grouped = group_similar_results(results)

        scores = [r.score for r in grouped]
        assert scores == sorted(scores, reverse=True)
        assert scores == [0.9, 0.5, 0.1]


# =============================================================================
# Level 5: Integration Tests with SearchOptions
# =============================================================================

class TestSearchOptionsGrouping:
    """Integration tests for SearchOptions grouping configuration."""

    def test_search_options_default_grouping_disabled(self):
        """Default SearchOptions should have grouping disabled."""
        options = SearchOptions()

        assert options.group_results is False
        assert options.grouping_threshold == 0.01

    def test_search_options_enable_grouping(self):
        """SearchOptions should allow enabling grouping."""
        options = SearchOptions(group_results=True)

        assert options.group_results is True

    def test_search_options_custom_threshold(self):
        """SearchOptions should allow custom grouping threshold."""
        options = SearchOptions(group_results=True, grouping_threshold=0.05)

        assert options.grouping_threshold == 0.05

    def test_search_options_all_parameters(self):
        """SearchOptions should work with all parameters combined."""
        options = SearchOptions(
            depth=3,
            max_workers=4,
            limit_per_dir=20,
            total_limit=200,
            include_symbols=True,
            hybrid_mode=True,
            group_results=True,
            grouping_threshold=0.02,
        )

        assert options.depth == 3
        assert options.group_results is True
        assert options.grouping_threshold == 0.02


# =============================================================================
# Level 6: AdditionalLocation Entity Tests
# =============================================================================

class TestAdditionalLocationEntity:
    """Tests for AdditionalLocation entity model."""

    def test_create_minimal_additional_location(self):
        """Create AdditionalLocation with minimal required fields."""
        loc = AdditionalLocation(path="test.py", score=0.5)

        assert loc.path == "test.py"
        assert loc.score == 0.5
        assert loc.start_line is None
        assert loc.end_line is None
        assert loc.symbol_name is None

    def test_create_full_additional_location(self):
        """Create AdditionalLocation with all fields."""
        loc = AdditionalLocation(
            path="test.py",
            score=0.75,
            start_line=10,
            end_line=20,
            symbol_name="my_function"
        )

        assert loc.path == "test.py"
        assert loc.score == 0.75
        assert loc.start_line == 10
        assert loc.end_line == 20
        assert loc.symbol_name == "my_function"

    def test_additional_location_path_required(self):
        """Path should be required for AdditionalLocation."""
        with pytest.raises(Exception):  # ValidationError
            AdditionalLocation(score=0.5)

    def test_additional_location_score_required(self):
        """Score should be required for AdditionalLocation."""
        with pytest.raises(Exception):  # ValidationError
            AdditionalLocation(path="test.py")

    def test_additional_location_score_non_negative(self):
        """Score should be non-negative."""
        with pytest.raises(Exception):  # ValidationError
            AdditionalLocation(path="test.py", score=-0.1)

    def test_additional_location_serialization(self):
        """AdditionalLocation should serialize correctly."""
        loc = AdditionalLocation(
            path="test.py",
            score=0.5,
            start_line=10,
            symbol_name="func"
        )

        data = loc.model_dump()

        assert data["path"] == "test.py"
        assert data["score"] == 0.5
        assert data["start_line"] == 10
        assert data["symbol_name"] == "func"


# =============================================================================
# Level 7: SearchResult with AdditionalLocations Tests
# =============================================================================

class TestSearchResultWithAdditionalLocations:
    """Tests for SearchResult entity with additional_locations field."""

    def test_search_result_default_empty_locations(self):
        """SearchResult should have empty additional_locations by default."""
        result = SearchResult(path="test.py", score=0.5)

        assert result.additional_locations == []

    def test_search_result_with_additional_locations(self):
        """SearchResult should accept additional_locations."""
        locations = [
            AdditionalLocation(path="other.py", score=0.4, start_line=5),
        ]

        result = SearchResult(
            path="main.py",
            score=0.5,
            additional_locations=locations
        )

        assert len(result.additional_locations) == 1
        assert result.additional_locations[0].path == "other.py"

    def test_search_result_serialization_with_locations(self):
        """SearchResult with additional_locations should serialize correctly."""
        locations = [
            AdditionalLocation(path="loc1.py", score=0.4),
            AdditionalLocation(path="loc2.py", score=0.3),
        ]

        result = SearchResult(
            path="main.py",
            score=0.5,
            excerpt="code",
            additional_locations=locations
        )

        data = result.model_dump()

        assert len(data["additional_locations"]) == 2
        assert data["additional_locations"][0]["path"] == "loc1.py"
        assert data["additional_locations"][1]["path"] == "loc2.py"


# =============================================================================
# Level 8: Stress/Performance Tests
# =============================================================================

class TestGroupSimilarResultsPerformance:
    """Performance and stress tests."""

    def test_handles_large_result_set(self):
        """Should handle large number of results efficiently."""
        # Create 1000 results with 100 different excerpts
        results = []
        for i in range(1000):
            excerpt_id = i % 100
            results.append(SearchResult(
                path=f"file_{i}.py",
                score=0.5 + (i % 10) * 0.01,  # Scores vary slightly
                excerpt=f"def func_{excerpt_id}(): pass",
                start_line=i,
            ))

        grouped = group_similar_results(results, score_threshold_abs=0.05)

        # Should reduce to approximately 100 groups (one per excerpt)
        # with some variation due to score subgrouping
        assert len(grouped) <= 200
        assert len(grouped) >= 50  # At least some grouping happened

    def test_handles_all_identical_results(self):
        """Should handle case where all results are identical."""
        results = [
            SearchResult(path=f"file_{i}.py", score=0.5, excerpt="same code")
            for i in range(100)
        ]

        grouped = group_similar_results(results, score_threshold_abs=0.01)

        # All should be grouped into one
        assert len(grouped) == 1
        assert len(grouped[0].additional_locations) == 99

    def test_handles_all_unique_results(self):
        """Should handle case where all results are unique."""
        results = [
            SearchResult(path=f"file_{i}.py", score=0.5, excerpt=f"unique_{i}")
            for i in range(100)
        ]

        grouped = group_similar_results(results, score_threshold_abs=0.01)

        # None should be grouped
        assert len(grouped) == 100
        for r in grouped:
            assert len(r.additional_locations) == 0


# =============================================================================
# Level 9: Real-world Scenario Tests
# =============================================================================

class TestGroupSimilarResultsRealWorld:
    """Tests simulating real-world usage scenarios."""

    def test_rrf_fusion_scores_grouping(self):
        """Test with typical RRF fusion score ranges (0.001 - 0.02)."""
        results = [
            SearchResult(path="auth/login.py", score=0.0164, excerpt="def authenticate():"),
            SearchResult(path="auth/oauth.py", score=0.0163, excerpt="def authenticate():"),
            SearchResult(path="auth/basic.py", score=0.0162, excerpt="def authenticate():"),
            SearchResult(path="utils/helper.py", score=0.0082, excerpt="def helper():"),
        ]

        # RRF scores are typically very small, use appropriate threshold
        grouped = group_similar_results(results, score_threshold_abs=0.001)

        assert len(grouped) == 2

        auth_group = next(r for r in grouped if "auth" in r.path)
        assert len(auth_group.additional_locations) == 2

    def test_duplicate_code_detection(self):
        """Simulate detecting duplicate code across files."""
        duplicate_code = """
def calculate_total(items):
    return sum(item.price for item in items)
"""
        results = [
            SearchResult(path="orders/service.py", score=0.5, excerpt=duplicate_code, start_line=45),
            SearchResult(path="cart/calculator.py", score=0.5, excerpt=duplicate_code, start_line=12),
            SearchResult(path="invoices/generator.py", score=0.5, excerpt=duplicate_code, start_line=78),
        ]

        grouped = group_similar_results(results, score_threshold_abs=0.01)

        # All duplicates should be grouped
        assert len(grouped) == 1
        assert len(grouped[0].additional_locations) == 2

        # Can identify all locations
        all_paths = {grouped[0].path} | {loc.path for loc in grouped[0].additional_locations}
        assert all_paths == {"orders/service.py", "cart/calculator.py", "invoices/generator.py"}

    def test_mixed_relevance_results(self):
        """Test with mixed relevance results typical of code search."""
        results = [
            # High relevance group - exact match
            SearchResult(path="core.py", score=0.9, excerpt="def process():"),
            SearchResult(path="core_v2.py", score=0.89, excerpt="def process():"),
            # Medium relevance - partial match
            SearchResult(path="utils.py", score=0.5, excerpt="def process_data():"),
            # Low relevance - tangential
            SearchResult(path="test.py", score=0.2, excerpt="def test_process():"),
        ]

        grouped = group_similar_results(results, score_threshold_abs=0.02)

        # core.py and core_v2.py should group (same excerpt, similar score)
        # Others should remain separate (different excerpts)
        assert len(grouped) == 3

        high_rel = next(r for r in grouped if r.score >= 0.89)
        assert len(high_rel.additional_locations) == 1
