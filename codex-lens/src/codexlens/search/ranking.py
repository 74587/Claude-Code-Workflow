"""Ranking algorithms for hybrid search result fusion.

Implements Reciprocal Rank Fusion (RRF) and score normalization utilities
for combining results from heterogeneous search backends (SPLADE, exact FTS, fuzzy FTS, vector search).
"""

from __future__ import annotations

import re
import math
from enum import Enum
from typing import Any, Dict, List

from codexlens.entities import SearchResult, AdditionalLocation


# Default RRF weights for SPLADE-based hybrid search
DEFAULT_WEIGHTS = {
    "splade": 0.4,  # Replaces exact(0.3) + fuzzy(0.1)
    "vector": 0.6,
}

# Legacy weights for FTS fallback mode (when SPLADE unavailable)
FTS_FALLBACK_WEIGHTS = {
    "exact": 0.3,
    "fuzzy": 0.1,
    "vector": 0.6,
}


class QueryIntent(str, Enum):
    """Query intent for adaptive RRF weights (Python/TypeScript parity)."""

    KEYWORD = "keyword"
    SEMANTIC = "semantic"
    MIXED = "mixed"


def normalize_weights(weights: Dict[str, float | None]) -> Dict[str, float | None]:
    """Normalize weights to sum to 1.0 (best-effort)."""
    total = sum(float(v) for v in weights.values() if v is not None)

    # NaN total: do not attempt to normalize (division would propagate NaNs).
    if math.isnan(total):
        return dict(weights)

    # Infinite total: do not attempt to normalize (division yields 0 or NaN).
    if not math.isfinite(total):
        return dict(weights)

    # Zero/negative total: do not attempt to normalize (invalid denominator).
    if total <= 0:
        return dict(weights)

    return {k: (float(v) / total if v is not None else None) for k, v in weights.items()}


def detect_query_intent(query: str) -> QueryIntent:
    """Detect whether a query is code-like, natural-language, or mixed.

    Heuristic signals kept aligned with `ccw/src/tools/smart-search.ts`.
    """
    trimmed = (query or "").strip()
    if not trimmed:
        return QueryIntent.MIXED

    lower = trimmed.lower()
    word_count = len([w for w in re.split(r"\s+", trimmed) if w])

    has_code_signals = bool(
        re.search(r"(::|->|\.)", trimmed)
        or re.search(r"[A-Z][a-z]+[A-Z]", trimmed)
        or re.search(r"\b\w+_\w+\b", trimmed)
        or re.search(
            r"\b(def|class|function|const|let|var|import|from|return|async|await|interface|type)\b",
            lower,
            flags=re.IGNORECASE,
        )
    )
    has_natural_signals = bool(
        word_count > 5
        or "?" in trimmed
        or re.search(r"\b(how|what|why|when|where)\b", trimmed, flags=re.IGNORECASE)
        or re.search(
            r"\b(handle|explain|fix|implement|create|build|use|find|search|convert|parse|generate|support)\b",
            trimmed,
            flags=re.IGNORECASE,
        )
    )

    if has_code_signals and has_natural_signals:
        return QueryIntent.MIXED
    if has_code_signals:
        return QueryIntent.KEYWORD
    if has_natural_signals:
        return QueryIntent.SEMANTIC
    return QueryIntent.MIXED


def adjust_weights_by_intent(
    intent: QueryIntent,
    base_weights: Dict[str, float],
) -> Dict[str, float]:
    """Adjust RRF weights based on query intent."""
    # Check if using SPLADE or FTS mode
    use_splade = "splade" in base_weights
    
    if intent == QueryIntent.KEYWORD:
        if use_splade:
            target = {"splade": 0.6, "vector": 0.4}
        else:
            target = {"exact": 0.5, "fuzzy": 0.1, "vector": 0.4}
    elif intent == QueryIntent.SEMANTIC:
        if use_splade:
            target = {"splade": 0.3, "vector": 0.7}
        else:
            target = {"exact": 0.2, "fuzzy": 0.1, "vector": 0.7}
    else:
        target = dict(base_weights)
    
    # Filter to active backends
    keys = list(base_weights.keys())
    filtered = {k: float(target.get(k, 0.0)) for k in keys}
    return normalize_weights(filtered)


def get_rrf_weights(
    query: str,
    base_weights: Dict[str, float],
) -> Dict[str, float]:
    """Compute adaptive RRF weights from query intent."""
    return adjust_weights_by_intent(detect_query_intent(query), base_weights)


def simple_weighted_fusion(
    results_map: Dict[str, List[SearchResult]],
    weights: Dict[str, float] = None,
) -> List[SearchResult]:
    """Combine search results using simple weighted sum of normalized scores.

    This is an alternative to RRF that preserves score magnitude information.
    Scores are min-max normalized per source before weighted combination.

    Formula: score(d) = Σ weight_source * normalized_score_source(d)

    Args:
        results_map: Dictionary mapping source name to list of SearchResult objects
                     Sources: 'exact', 'fuzzy', 'vector', 'splade'
        weights: Dictionary mapping source name to weight (default: equal weights)
                 Example: {'exact': 0.3, 'fuzzy': 0.1, 'vector': 0.6}

    Returns:
        List of SearchResult objects sorted by fused score (descending)

    Examples:
        >>> fts_results = [SearchResult(path="a.py", score=10.0, excerpt="...")]
        >>> vector_results = [SearchResult(path="b.py", score=0.85, excerpt="...")]
        >>> results_map = {'exact': fts_results, 'vector': vector_results}
        >>> fused = simple_weighted_fusion(results_map)
    """
    if not results_map:
        return []

    # Default equal weights if not provided
    if weights is None:
        num_sources = len(results_map)
        weights = {source: 1.0 / num_sources for source in results_map}

    # Normalize weights to sum to 1.0
    weight_sum = sum(weights.values())
    if not math.isclose(weight_sum, 1.0, abs_tol=0.01) and weight_sum > 0:
        weights = {source: w / weight_sum for source, w in weights.items()}

    # Compute min-max normalization parameters per source
    source_stats: Dict[str, tuple] = {}
    for source_name, results in results_map.items():
        if not results:
            continue
        scores = [r.score for r in results]
        min_s, max_s = min(scores), max(scores)
        source_stats[source_name] = (min_s, max_s)

    def normalize_score(score: float, source: str) -> float:
        """Normalize score to [0, 1] range using min-max scaling."""
        if source not in source_stats:
            return 0.0
        min_s, max_s = source_stats[source]
        if max_s == min_s:
            return 1.0 if score >= min_s else 0.0
        return (score - min_s) / (max_s - min_s)

    # Build unified result set with weighted scores
    path_to_result: Dict[str, SearchResult] = {}
    path_to_fusion_score: Dict[str, float] = {}
    path_to_source_scores: Dict[str, Dict[str, float]] = {}

    for source_name, results in results_map.items():
        weight = weights.get(source_name, 0.0)
        if weight == 0:
            continue

        for result in results:
            path = result.path
            normalized = normalize_score(result.score, source_name)
            contribution = weight * normalized

            if path not in path_to_fusion_score:
                path_to_fusion_score[path] = 0.0
                path_to_result[path] = result
                path_to_source_scores[path] = {}

            path_to_fusion_score[path] += contribution
            path_to_source_scores[path][source_name] = normalized

    # Create final results with fusion scores
    fused_results = []
    for path, base_result in path_to_result.items():
        fusion_score = path_to_fusion_score[path]

        fused_result = SearchResult(
            path=base_result.path,
            score=fusion_score,
            excerpt=base_result.excerpt,
            content=base_result.content,
            symbol=base_result.symbol,
            chunk=base_result.chunk,
            metadata={
                **base_result.metadata,
                "fusion_method": "simple_weighted",
                "fusion_score": fusion_score,
                "original_score": base_result.score,
                "source_scores": path_to_source_scores[path],
            },
            start_line=base_result.start_line,
            end_line=base_result.end_line,
            symbol_name=base_result.symbol_name,
            symbol_kind=base_result.symbol_kind,
        )
        fused_results.append(fused_result)

    fused_results.sort(key=lambda r: r.score, reverse=True)
    return fused_results


def reciprocal_rank_fusion(
    results_map: Dict[str, List[SearchResult]],
    weights: Dict[str, float] = None,
    k: int = 60,
) -> List[SearchResult]:
    """Combine search results from multiple sources using Reciprocal Rank Fusion.

    RRF formula: score(d) = Σ weight_source / (k + rank_source(d))

    Supports three-way fusion with FTS, Vector, and SPLADE sources.

    Args:
        results_map: Dictionary mapping source name to list of SearchResult objects
                     Sources: 'exact', 'fuzzy', 'vector', 'splade'
        weights: Dictionary mapping source name to weight (default: equal weights)
                 Example: {'exact': 0.3, 'fuzzy': 0.1, 'vector': 0.6}
                 Or: {'splade': 0.4, 'vector': 0.6}
        k: Constant to avoid division by zero and control rank influence (default 60)

    Returns:
        List of SearchResult objects sorted by fused score (descending)

    Examples:
        >>> exact_results = [SearchResult(path="a.py", score=10.0, excerpt="...")]
        >>> fuzzy_results = [SearchResult(path="b.py", score=8.0, excerpt="...")]
        >>> results_map = {'exact': exact_results, 'fuzzy': fuzzy_results}
        >>> fused = reciprocal_rank_fusion(results_map)

        # Three-way fusion with SPLADE
        >>> results_map = {
        ...     'exact': exact_results,
        ...     'vector': vector_results,
        ...     'splade': splade_results
        ... }
        >>> fused = reciprocal_rank_fusion(results_map, k=60)
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
    path_to_source_ranks: Dict[str, Dict[str, int]] = {}

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
                path_to_source_ranks[path] = {}

            path_to_fusion_score[path] += rrf_contribution
            path_to_source_ranks[path][source_name] = rank

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
                "fusion_method": "rrf",
                "fusion_score": fusion_score,
                "original_score": base_result.score,
                "rrf_k": k,
                "source_ranks": path_to_source_ranks[path],
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


def apply_symbol_boost(
    results: List[SearchResult],
    boost_factor: float = 1.5,
) -> List[SearchResult]:
    """Boost fused scores for results that include an explicit symbol match.

    The boost is multiplicative on the current result.score (typically the RRF fusion score).
    When boosted, the original score is preserved in metadata["original_fusion_score"] and
    metadata["boosted"] is set to True.
    """
    if not results:
        return []

    if boost_factor <= 1.0:
        # Still return new objects to follow immutable transformation pattern.
        return [
            SearchResult(
                path=r.path,
                score=r.score,
                excerpt=r.excerpt,
                content=r.content,
                symbol=r.symbol,
                chunk=r.chunk,
                metadata={**r.metadata},
                start_line=r.start_line,
                end_line=r.end_line,
                symbol_name=r.symbol_name,
                symbol_kind=r.symbol_kind,
                additional_locations=list(r.additional_locations),
            )
            for r in results
        ]

    boosted_results: List[SearchResult] = []
    for result in results:
        has_symbol = bool(result.symbol_name)
        original_score = float(result.score)
        boosted_score = original_score * boost_factor if has_symbol else original_score

        metadata = {**result.metadata}
        if has_symbol:
            metadata.setdefault("original_fusion_score", metadata.get("fusion_score", original_score))
            metadata["boosted"] = True
            metadata["symbol_boost_factor"] = boost_factor

        boosted_results.append(
            SearchResult(
                path=result.path,
                score=boosted_score,
                excerpt=result.excerpt,
                content=result.content,
                symbol=result.symbol,
                chunk=result.chunk,
                metadata=metadata,
                start_line=result.start_line,
                end_line=result.end_line,
                symbol_name=result.symbol_name,
                symbol_kind=result.symbol_kind,
                additional_locations=list(result.additional_locations),
            )
        )

    boosted_results.sort(key=lambda r: r.score, reverse=True)
    return boosted_results


def rerank_results(
    query: str,
    results: List[SearchResult],
    embedder: Any,
    top_k: int = 50,
) -> List[SearchResult]:
    """Re-rank results with embedding cosine similarity, combined with current score.

    Combined score formula:
        0.5 * rrf_score + 0.5 * cosine_similarity

    If embedder is None or embedding fails, returns results as-is.
    """
    if not results:
        return []

    if embedder is None or top_k <= 0:
        return results

    rerank_count = min(int(top_k), len(results))

    def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
        # Defensive: handle mismatched lengths and zero vectors.
        n = min(len(vec_a), len(vec_b))
        if n == 0:
            return 0.0
        dot = 0.0
        norm_a = 0.0
        norm_b = 0.0
        for i in range(n):
            a = float(vec_a[i])
            b = float(vec_b[i])
            dot += a * b
            norm_a += a * a
            norm_b += b * b
        if norm_a <= 0.0 or norm_b <= 0.0:
            return 0.0
        sim = dot / (math.sqrt(norm_a) * math.sqrt(norm_b))
        # SearchResult.score requires non-negative scores; clamp cosine similarity to [0, 1].
        return max(0.0, min(1.0, sim))

    def text_for_embedding(r: SearchResult) -> str:
        if r.excerpt and r.excerpt.strip():
            return r.excerpt
        if r.content and r.content.strip():
            return r.content
        if r.chunk and r.chunk.content and r.chunk.content.strip():
            return r.chunk.content
        # Fallback: stable, non-empty text.
        return r.symbol_name or r.path

    try:
        if hasattr(embedder, "embed_single"):
            query_vec = embedder.embed_single(query)
        else:
            query_vec = embedder.embed(query)[0]

        doc_texts = [text_for_embedding(r) for r in results[:rerank_count]]
        doc_vecs = embedder.embed(doc_texts)
    except Exception:
        return results

    reranked_results: List[SearchResult] = []

    for idx, result in enumerate(results):
        if idx < rerank_count:
            rrf_score = float(result.score)
            sim = cosine_similarity(query_vec, doc_vecs[idx])
            combined_score = 0.5 * rrf_score + 0.5 * sim

            reranked_results.append(
                SearchResult(
                    path=result.path,
                    score=combined_score,
                    excerpt=result.excerpt,
                    content=result.content,
                    symbol=result.symbol,
                    chunk=result.chunk,
                    metadata={
                        **result.metadata,
                        "rrf_score": rrf_score,
                        "cosine_similarity": sim,
                        "reranked": True,
                    },
                    start_line=result.start_line,
                    end_line=result.end_line,
                    symbol_name=result.symbol_name,
                    symbol_kind=result.symbol_kind,
                    additional_locations=list(result.additional_locations),
                )
            )
        else:
            # Preserve remaining results without re-ranking, but keep immutability.
            reranked_results.append(
                SearchResult(
                    path=result.path,
                    score=result.score,
                    excerpt=result.excerpt,
                    content=result.content,
                    symbol=result.symbol,
                    chunk=result.chunk,
                    metadata={**result.metadata},
                    start_line=result.start_line,
                    end_line=result.end_line,
                    symbol_name=result.symbol_name,
                    symbol_kind=result.symbol_kind,
                    additional_locations=list(result.additional_locations),
                )
            )

    reranked_results.sort(key=lambda r: r.score, reverse=True)
    return reranked_results


def cross_encoder_rerank(
    query: str,
    results: List[SearchResult],
    reranker: Any,
    top_k: int = 50,
    batch_size: int = 32,
) -> List[SearchResult]:
    """Second-stage reranking using a cross-encoder model.

    This function is dependency-agnostic: callers can pass any object that exposes
    a compatible `score_pairs(pairs, batch_size=...)` method.
    """
    if not results:
        return []

    if reranker is None or top_k <= 0:
        return results

    rerank_count = min(int(top_k), len(results))

    def text_for_pair(r: SearchResult) -> str:
        if r.excerpt and r.excerpt.strip():
            return r.excerpt
        if r.content and r.content.strip():
            return r.content
        if r.chunk and r.chunk.content and r.chunk.content.strip():
            return r.chunk.content
        return r.symbol_name or r.path

    pairs = [(query, text_for_pair(r)) for r in results[:rerank_count]]

    try:
        if hasattr(reranker, "score_pairs"):
            raw_scores = reranker.score_pairs(pairs, batch_size=int(batch_size))
        elif hasattr(reranker, "predict"):
            raw_scores = reranker.predict(pairs, batch_size=int(batch_size))
        else:
            return results
    except Exception:
        return results

    if not raw_scores or len(raw_scores) != rerank_count:
        return results

    scores = [float(s) for s in raw_scores]
    min_s = min(scores)
    max_s = max(scores)

    def sigmoid(x: float) -> float:
        # Clamp to keep exp() stable.
        x = max(-50.0, min(50.0, x))
        return 1.0 / (1.0 + math.exp(-x))

    if 0.0 <= min_s and max_s <= 1.0:
        probs = scores
    else:
        probs = [sigmoid(s) for s in scores]

    reranked_results: List[SearchResult] = []

    for idx, result in enumerate(results):
        if idx < rerank_count:
            prev_score = float(result.score)
            ce_score = scores[idx]
            ce_prob = probs[idx]
            combined_score = 0.5 * prev_score + 0.5 * ce_prob

            reranked_results.append(
                SearchResult(
                    path=result.path,
                    score=combined_score,
                    excerpt=result.excerpt,
                    content=result.content,
                    symbol=result.symbol,
                    chunk=result.chunk,
                    metadata={
                        **result.metadata,
                        "pre_cross_encoder_score": prev_score,
                        "cross_encoder_score": ce_score,
                        "cross_encoder_prob": ce_prob,
                        "cross_encoder_reranked": True,
                    },
                    start_line=result.start_line,
                    end_line=result.end_line,
                    symbol_name=result.symbol_name,
                    symbol_kind=result.symbol_kind,
                    additional_locations=list(result.additional_locations),
                )
            )
        else:
            reranked_results.append(
                SearchResult(
                    path=result.path,
                    score=result.score,
                    excerpt=result.excerpt,
                    content=result.content,
                    symbol=result.symbol,
                    chunk=result.chunk,
                    metadata={**result.metadata},
                    start_line=result.start_line,
                    end_line=result.end_line,
                    symbol_name=result.symbol_name,
                    symbol_kind=result.symbol_kind,
                    additional_locations=list(result.additional_locations),
                )
            )

    reranked_results.sort(key=lambda r: r.score, reverse=True)
    return reranked_results


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
