"""Ranking algorithms for hybrid search result fusion.

Implements Reciprocal Rank Fusion (RRF) and score normalization utilities
for combining results from heterogeneous search backends (exact FTS, fuzzy FTS, vector search).
"""

from __future__ import annotations

import math
from typing import Dict, List

from codexlens.entities import SearchResult, AdditionalLocation


def reciprocal_rank_fusion(
    results_map: Dict[str, List[SearchResult]],
    weights: Dict[str, float] = None,
    k: int = 60,
) -> List[SearchResult]:
    """Combine search results from multiple sources using Reciprocal Rank Fusion.

    RRF formula: score(d) = Σ weight_source / (k + rank_source(d))

    Args:
        results_map: Dictionary mapping source name to list of SearchResult objects
                     Sources: 'exact', 'fuzzy', 'vector'
        weights: Dictionary mapping source name to weight (default: equal weights)
                 Example: {'exact': 0.3, 'fuzzy': 0.1, 'vector': 0.6}
        k: Constant to avoid division by zero and control rank influence (default 60)

    Returns:
        List of SearchResult objects sorted by fused score (descending)

    Examples:
        >>> exact_results = [SearchResult(path="a.py", score=10.0, excerpt="...")]
        >>> fuzzy_results = [SearchResult(path="b.py", score=8.0, excerpt="...")]
        >>> results_map = {'exact': exact_results, 'fuzzy': fuzzy_results}
        >>> fused = reciprocal_rank_fusion(results_map)
    """
    if not results_map:
        return []

    # Default equal weights if not provided
    if weights is None:
        num_sources = len(results_map)
        weights = {source: 1.0 / num_sources for source in results_map}

    # Validate weights sum to 1.0
    weight_sum = sum(weights.values())
    if not math.isclose(weight_sum, 1.0, abs_tol=0.01):
        # Normalize weights to sum to 1.0
        weights = {source: w / weight_sum for source, w in weights.items()}

    # Build unified result set with RRF scores
    path_to_result: Dict[str, SearchResult] = {}
    path_to_fusion_score: Dict[str, float] = {}

    for source_name, results in results_map.items():
        weight = weights.get(source_name, 0.0)
        if weight == 0:
            continue

        for rank, result in enumerate(results, start=1):
            path = result.path
            rrf_contribution = weight / (k + rank)

            # Initialize or accumulate fusion score
            if path not in path_to_fusion_score:
                path_to_fusion_score[path] = 0.0
                path_to_result[path] = result

            path_to_fusion_score[path] += rrf_contribution

    # Create final results with fusion scores
    fused_results = []
    for path, base_result in path_to_result.items():
        fusion_score = path_to_fusion_score[path]

        # Create new SearchResult with fusion_score in metadata
        fused_result = SearchResult(
            path=base_result.path,
            score=fusion_score,
            excerpt=base_result.excerpt,
            content=base_result.content,
            symbol=base_result.symbol,
            chunk=base_result.chunk,
            metadata={
                **base_result.metadata,
                "fusion_score": fusion_score,
                "original_score": base_result.score,
            },
            start_line=base_result.start_line,
            end_line=base_result.end_line,
            symbol_name=base_result.symbol_name,
            symbol_kind=base_result.symbol_kind,
        )
        fused_results.append(fused_result)

    # Sort by fusion score descending
    fused_results.sort(key=lambda r: r.score, reverse=True)

    return fused_results


def normalize_bm25_score(score: float) -> float:
    """Normalize BM25 scores from SQLite FTS5 to 0-1 range.

    SQLite FTS5 returns negative BM25 scores (more negative = better match).
    Uses sigmoid transformation for normalization.

    Args:
        score: Raw BM25 score from SQLite (typically negative)

    Returns:
        Normalized score in range [0, 1]

    Examples:
        >>> normalize_bm25_score(-10.5)  # Good match
        0.85
        >>> normalize_bm25_score(-1.2)   # Weak match
        0.62
    """
    # Take absolute value (BM25 is negative in SQLite)
    abs_score = abs(score)

    # Sigmoid transformation: 1 / (1 + e^(-x))
    # Scale factor of 0.1 maps typical BM25 range (-20 to 0) to (0, 1)
    normalized = 1.0 / (1.0 + math.exp(-abs_score * 0.1))

    return normalized


def tag_search_source(results: List[SearchResult], source: str) -> List[SearchResult]:
    """Tag search results with their source for RRF tracking.

    Args:
        results: List of SearchResult objects
        source: Source identifier ('exact', 'fuzzy', 'vector')

    Returns:
        List of SearchResult objects with 'search_source' in metadata
    """
    tagged_results = []
    for result in results:
        tagged_result = SearchResult(
            path=result.path,
            score=result.score,
            excerpt=result.excerpt,
            content=result.content,
            symbol=result.symbol,
            chunk=result.chunk,
            metadata={**result.metadata, "search_source": source},
            start_line=result.start_line,
            end_line=result.end_line,
            symbol_name=result.symbol_name,
            symbol_kind=result.symbol_kind,
        )
        tagged_results.append(tagged_result)

    return tagged_results


def group_similar_results(
    results: List[SearchResult],
    score_threshold_abs: float = 0.01,
    content_field: str = "excerpt"
) -> List[SearchResult]:
    """Group search results by content and score similarity.

    Groups results that have similar content and similar scores into a single
    representative result, with other locations stored in additional_locations.

    Algorithm:
    1. Group results by content (using excerpt or content field)
    2. Within each content group, create subgroups based on score similarity
    3. Select highest-scoring result as representative for each subgroup
    4. Store other results in subgroup as additional_locations

    Args:
        results: A list of SearchResult objects (typically sorted by score)
        score_threshold_abs: Absolute score difference to consider results similar.
                            Results with |score_a - score_b| <= threshold are grouped.
                            Default 0.01 is suitable for RRF fusion scores.
        content_field: The field to use for content grouping ('excerpt' or 'content')

    Returns:
        A new list of SearchResult objects where similar items are grouped.
        The list is sorted by score descending.

    Examples:
        >>> results = [SearchResult(path="a.py", score=0.5, excerpt="def foo()"),
        ...            SearchResult(path="b.py", score=0.5, excerpt="def foo()")]
        >>> grouped = group_similar_results(results)
        >>> len(grouped)  # Two results merged into one
        1
        >>> len(grouped[0].additional_locations)  # One additional location
        1
    """
    if not results:
        return []

    # Group results by content
    content_map: Dict[str, List[SearchResult]] = {}
    unidentifiable_results: List[SearchResult] = []

    for r in results:
        key = getattr(r, content_field, None)
        if key and key.strip():
            content_map.setdefault(key, []).append(r)
        else:
            # Results without content can't be grouped by content
            unidentifiable_results.append(r)

    final_results: List[SearchResult] = []

    # Process each content group
    for content_group in content_map.values():
        # Sort by score descending within group
        content_group.sort(key=lambda r: r.score, reverse=True)

        while content_group:
            # Take highest scoring as representative
            representative = content_group.pop(0)
            others_in_group = []
            remaining_for_next_pass = []

            # Find results with similar scores
            for item in content_group:
                if abs(representative.score - item.score) <= score_threshold_abs:
                    others_in_group.append(item)
                else:
                    remaining_for_next_pass.append(item)

            # Create grouped result with additional locations
            if others_in_group:
                # Build new result with additional_locations populated
                grouped_result = SearchResult(
                    path=representative.path,
                    score=representative.score,
                    excerpt=representative.excerpt,
                    content=representative.content,
                    symbol=representative.symbol,
                    chunk=representative.chunk,
                    metadata={
                        **representative.metadata,
                        "grouped_count": len(others_in_group) + 1,
                    },
                    start_line=representative.start_line,
                    end_line=representative.end_line,
                    symbol_name=representative.symbol_name,
                    symbol_kind=representative.symbol_kind,
                    additional_locations=[
                        AdditionalLocation(
                            path=other.path,
                            score=other.score,
                            start_line=other.start_line,
                            end_line=other.end_line,
                            symbol_name=other.symbol_name,
                        ) for other in others_in_group
                    ],
                )
                final_results.append(grouped_result)
            else:
                final_results.append(representative)

            content_group = remaining_for_next_pass

    # Add ungroupable results
    final_results.extend(unidentifiable_results)

    # Sort final results by score descending
    final_results.sort(key=lambda r: r.score, reverse=True)

    return final_results
