"""No-op clustering strategy for search results.

NoOpStrategy returns all results ungrouped when clustering dependencies
are not available or clustering is disabled.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

from .base import BaseClusteringStrategy, ClusteringConfig

if TYPE_CHECKING:
    import numpy as np
    from codexlens.entities import SearchResult


class NoOpStrategy(BaseClusteringStrategy):
    """No-op clustering strategy that returns all results ungrouped.

    This strategy is used as a final fallback when no clustering dependencies
    are available, or when clustering is explicitly disabled. Each result
    is treated as its own singleton cluster.

    Example:
        >>> from codexlens.search.clustering import NoOpStrategy
        >>> strategy = NoOpStrategy()
        >>> clusters = strategy.cluster(embeddings, results)
        >>> # Returns [[0], [1], [2], ...] - each result in its own cluster
        >>> representatives = strategy.select_representatives(clusters, results)
        >>> # Returns all results sorted by score
    """

    def __init__(self, config: Optional[ClusteringConfig] = None) -> None:
        """Initialize NoOp clustering strategy.

        Args:
            config: Clustering configuration. Ignored for NoOpStrategy
                but accepted for interface compatibility.
        """
        super().__init__(config)

    def cluster(
        self,
        embeddings: "np.ndarray",
        results: List["SearchResult"],
    ) -> List[List[int]]:
        """Return each result as its own singleton cluster.

        Args:
            embeddings: NumPy array of shape (n_results, embedding_dim).
                Not used but accepted for interface compatibility.
            results: List of SearchResult objects.

        Returns:
            List of singleton clusters, one per result.
        """
        return [[i] for i in range(len(results))]

    def select_representatives(
        self,
        clusters: List[List[int]],
        results: List["SearchResult"],
        embeddings: Optional["np.ndarray"] = None,
    ) -> List["SearchResult"]:
        """Return all results sorted by score.

        Since each cluster is a singleton, this effectively returns all
        results sorted by score descending.

        Args:
            clusters: List of singleton clusters.
            results: Original list of SearchResult objects.
            embeddings: Optional embeddings (not used).

        Returns:
            All SearchResult objects sorted by score (highest first).
        """
        if not results:
            return []

        # Return all results sorted by score
        return sorted(results, key=lambda r: r.score, reverse=True)
