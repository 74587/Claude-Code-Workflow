"""Frequency-based clustering strategy for search result deduplication.

This strategy groups search results by symbol/method name and prunes based on
occurrence frequency. High-frequency symbols (frequently referenced methods)
are considered more important and retained, while low-frequency results
(potentially noise) can be filtered out.

Use cases:
- Prioritize commonly called methods/functions
- Filter out one-off results that may be less relevant
- Deduplicate results pointing to the same symbol from different locations
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import TYPE_CHECKING, Dict, List, Optional, Literal

from .base import BaseClusteringStrategy, ClusteringConfig

if TYPE_CHECKING:
    import numpy as np
    from codexlens.entities import SearchResult


@dataclass
class FrequencyConfig(ClusteringConfig):
    """Configuration for frequency-based clustering strategy.

    Attributes:
        group_by: Field to group results by for frequency counting.
            - 'symbol': Group by symbol_name (default, for method/function dedup)
            - 'file': Group by file path
            - 'symbol_kind': Group by symbol type (function, class, etc.)
        min_frequency: Minimum occurrence count to keep a result.
            Results appearing less than this are considered noise and pruned.
        max_representatives_per_group: Maximum results to keep per symbol group.
        frequency_weight: How much to boost score based on frequency.
            Final score = original_score * (1 + frequency_weight * log(frequency))
        keep_mode: How to handle low-frequency results.
            - 'filter': Remove results below min_frequency
            - 'demote': Keep but lower their score ranking
    """

    group_by: Literal["symbol", "file", "symbol_kind"] = "symbol"
    min_frequency: int = 1  # 1 means keep all, 2+ filters singletons
    max_representatives_per_group: int = 3
    frequency_weight: float = 0.1  # Boost factor for frequency
    keep_mode: Literal["filter", "demote"] = "demote"

    def __post_init__(self) -> None:
        """Validate configuration parameters."""
        # Skip parent validation since we don't use HDBSCAN params
        if self.min_frequency < 1:
            raise ValueError("min_frequency must be >= 1")
        if self.max_representatives_per_group < 1:
            raise ValueError("max_representatives_per_group must be >= 1")
        if self.frequency_weight < 0:
            raise ValueError("frequency_weight must be >= 0")
        if self.group_by not in ("symbol", "file", "symbol_kind"):
            raise ValueError(f"group_by must be one of: symbol, file, symbol_kind; got {self.group_by}")
        if self.keep_mode not in ("filter", "demote"):
            raise ValueError(f"keep_mode must be one of: filter, demote; got {self.keep_mode}")


class FrequencyStrategy(BaseClusteringStrategy):
    """Frequency-based clustering strategy for search result deduplication.

    This strategy groups search results by symbol name (or file/kind) and:
    1. Counts how many times each symbol appears in results
    2. Higher frequency = more important (frequently referenced method)
    3. Filters or demotes low-frequency results
    4. Selects top representatives from each frequency group

    Unlike embedding-based strategies (HDBSCAN, DBSCAN), this strategy:
    - Does NOT require embeddings (works with metadata only)
    - Is very fast (O(n) complexity)
    - Is deterministic (no random initialization)
    - Works well for symbol-level deduplication

    Example:
        >>> config = FrequencyConfig(min_frequency=2, group_by="symbol")
        >>> strategy = FrequencyStrategy(config)
        >>> # Results with symbol "authenticate" appearing 5 times
        >>> # will be prioritized over "helper_func" appearing once
        >>> representatives = strategy.fit_predict(embeddings, results)
    """

    def __init__(self, config: Optional[FrequencyConfig] = None) -> None:
        """Initialize the frequency strategy.

        Args:
            config: Frequency configuration. Uses defaults if not provided.
        """
        self.config: FrequencyConfig = config or FrequencyConfig()

    def _get_group_key(self, result: "SearchResult") -> str:
        """Extract grouping key from a search result.

        Args:
            result: SearchResult to extract key from.

        Returns:
            String key for grouping (symbol name, file path, or kind).
        """
        if self.config.group_by == "symbol":
            # Use symbol_name if available, otherwise fall back to file:line
            symbol = getattr(result, "symbol_name", None)
            if symbol:
                return str(symbol)
            # Fallback: use file path + start_line as pseudo-symbol
            start_line = getattr(result, "start_line", 0) or 0
            return f"{result.path}:{start_line}"

        elif self.config.group_by == "file":
            return str(result.path)

        elif self.config.group_by == "symbol_kind":
            kind = getattr(result, "symbol_kind", None)
            return str(kind) if kind else "unknown"

        return str(result.path)  # Default fallback

    def cluster(
        self,
        embeddings: "np.ndarray",
        results: List["SearchResult"],
    ) -> List[List[int]]:
        """Group search results by frequency of occurrence.

        Note: This method ignores embeddings and groups by metadata only.
        The embeddings parameter is kept for interface compatibility.

        Args:
            embeddings: Ignored (kept for interface compatibility).
            results: List of SearchResult objects to cluster.

        Returns:
            List of clusters (groups), where each cluster contains indices
            of results with the same grouping key. Clusters are ordered by
            frequency (highest frequency first).
        """
        if not results:
            return []

        # Group results by key
        groups: Dict[str, List[int]] = defaultdict(list)
        for idx, result in enumerate(results):
            key = self._get_group_key(result)
            groups[key].append(idx)

        # Sort groups by frequency (descending) then by key (for stability)
        sorted_groups = sorted(
            groups.items(),
            key=lambda x: (-len(x[1]), x[0])  # -frequency, then alphabetical
        )

        # Convert to list of clusters
        clusters = [indices for _, indices in sorted_groups]

        return clusters

    def select_representatives(
        self,
        clusters: List[List[int]],
        results: List["SearchResult"],
        embeddings: Optional["np.ndarray"] = None,
    ) -> List["SearchResult"]:
        """Select representative results based on frequency and score.

        For each frequency group:
        1. If frequency < min_frequency: filter or demote based on keep_mode
        2. Sort by score within group
        3. Apply frequency boost to scores
        4. Select top N representatives

        Args:
            clusters: List of clusters from cluster() method.
            results: Original list of SearchResult objects.
            embeddings: Optional embeddings (used for tie-breaking if provided).

        Returns:
            List of representative SearchResult objects, ordered by
            frequency-adjusted score (highest first).
        """
        import math

        if not clusters or not results:
            return []

        representatives: List["SearchResult"] = []
        demoted: List["SearchResult"] = []

        for cluster_indices in clusters:
            if not cluster_indices:
                continue

            frequency = len(cluster_indices)

            # Get results in this cluster, sorted by score
            cluster_results = [results[i] for i in cluster_indices]
            cluster_results.sort(key=lambda r: getattr(r, "score", 0.0), reverse=True)

            # Check frequency threshold
            if frequency < self.config.min_frequency:
                if self.config.keep_mode == "filter":
                    # Skip low-frequency results entirely
                    continue
                else:  # demote mode
                    # Keep but add to demoted list (lower priority)
                    for result in cluster_results[: self.config.max_representatives_per_group]:
                        demoted.append(result)
                    continue

            # Apply frequency boost and select top representatives
            for result in cluster_results[: self.config.max_representatives_per_group]:
                # Calculate frequency-boosted score
                original_score = getattr(result, "score", 0.0)
                # log(frequency + 1) to handle frequency=1 case smoothly
                frequency_boost = 1.0 + self.config.frequency_weight * math.log(frequency + 1)
                boosted_score = original_score * frequency_boost

                # Create new result with boosted score and frequency metadata
                # Note: SearchResult might be immutable, so we preserve original
                # and track boosted score in metadata
                if hasattr(result, "metadata") and isinstance(result.metadata, dict):
                    result.metadata["frequency"] = frequency
                    result.metadata["frequency_boosted_score"] = boosted_score

                representatives.append(result)

        # Sort representatives by boosted score (or original score as fallback)
        def get_sort_score(r: "SearchResult") -> float:
            if hasattr(r, "metadata") and isinstance(r.metadata, dict):
                return r.metadata.get("frequency_boosted_score", getattr(r, "score", 0.0))
            return getattr(r, "score", 0.0)

        representatives.sort(key=get_sort_score, reverse=True)

        # Add demoted results at the end
        if demoted:
            demoted.sort(key=lambda r: getattr(r, "score", 0.0), reverse=True)
            representatives.extend(demoted)

        return representatives

    def fit_predict(
        self,
        embeddings: "np.ndarray",
        results: List["SearchResult"],
    ) -> List["SearchResult"]:
        """Convenience method to cluster and select representatives in one call.

        Args:
            embeddings: NumPy array (may be ignored for frequency-based clustering).
            results: List of SearchResult objects.

        Returns:
            List of representative SearchResult objects.
        """
        clusters = self.cluster(embeddings, results)
        return self.select_representatives(clusters, results, embeddings)
