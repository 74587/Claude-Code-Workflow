"""DBSCAN-based clustering strategy for search results.

DBSCAN (Density-Based Spatial Clustering of Applications with Noise)
is the fallback clustering strategy when HDBSCAN is not available.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

from .base import BaseClusteringStrategy, ClusteringConfig

if TYPE_CHECKING:
    import numpy as np
    from codexlens.entities import SearchResult


class DBSCANStrategy(BaseClusteringStrategy):
    """DBSCAN-based clustering strategy.

    Uses sklearn's DBSCAN algorithm as a fallback when HDBSCAN is not available.
    DBSCAN requires an explicit eps parameter, which is auto-computed from the
    distance distribution if not provided.

    Example:
        >>> from codexlens.search.clustering import DBSCANStrategy, ClusteringConfig
        >>> config = ClusteringConfig(min_cluster_size=3, metric='cosine')
        >>> strategy = DBSCANStrategy(config)
        >>> clusters = strategy.cluster(embeddings, results)
        >>> representatives = strategy.select_representatives(clusters, results)
    """

    # Default eps percentile for auto-computation
    DEFAULT_EPS_PERCENTILE: float = 15.0

    def __init__(
        self,
        config: Optional[ClusteringConfig] = None,
        eps: Optional[float] = None,
        eps_percentile: float = DEFAULT_EPS_PERCENTILE,
    ) -> None:
        """Initialize DBSCAN clustering strategy.

        Args:
            config: Clustering configuration. Uses defaults if not provided.
            eps: Explicit eps parameter for DBSCAN. If None, auto-computed
                from the distance distribution.
            eps_percentile: Percentile of pairwise distances to use for
                auto-computing eps. Default is 15th percentile.

        Raises:
            ImportError: If sklearn is not installed.
        """
        super().__init__(config)
        self.eps = eps
        self.eps_percentile = eps_percentile

        # Validate sklearn is available
        try:
            from sklearn.cluster import DBSCAN  # noqa: F401
        except ImportError as exc:
            raise ImportError(
                "scikit-learn package is required for DBSCANStrategy. "
                "Install with: pip install codexlens[clustering]"
            ) from exc

    def _compute_eps(self, embeddings: "np.ndarray") -> float:
        """Auto-compute eps from pairwise distance distribution.

        Uses the specified percentile of pairwise distances as eps,
        which typically captures local density well.

        Args:
            embeddings: NumPy array of shape (n_results, embedding_dim).

        Returns:
            Computed eps value.
        """
        import numpy as np
        from sklearn.metrics import pairwise_distances

        # Compute pairwise distances
        distances = pairwise_distances(embeddings, metric=self.config.metric)

        # Get upper triangle (excluding diagonal)
        upper_tri = distances[np.triu_indices_from(distances, k=1)]

        if len(upper_tri) == 0:
            # Only one point, return a default small eps
            return 0.1

        # Use percentile of distances as eps
        eps = float(np.percentile(upper_tri, self.eps_percentile))

        # Ensure eps is positive
        return max(eps, 1e-6)

    def cluster(
        self,
        embeddings: "np.ndarray",
        results: List["SearchResult"],
    ) -> List[List[int]]:
        """Cluster search results using DBSCAN algorithm.

        Args:
            embeddings: NumPy array of shape (n_results, embedding_dim)
                containing the embedding vectors for each result.
            results: List of SearchResult objects corresponding to embeddings.

        Returns:
            List of clusters, where each cluster is a list of indices
            into the results list. Noise points are returned as singleton clusters.
        """
        from sklearn.cluster import DBSCAN
        import numpy as np

        n_results = len(results)
        if n_results == 0:
            return []

        # Handle edge case: single result
        if n_results == 1:
            return [[0]]

        # Determine eps value
        eps = self.eps if self.eps is not None else self._compute_eps(embeddings)

        # Configure DBSCAN clusterer
        # Note: DBSCAN min_samples corresponds to min_cluster_size concept
        clusterer = DBSCAN(
            eps=eps,
            min_samples=self.config.min_samples,
            metric=self.config.metric,
        )

        # Fit and get cluster labels
        # Labels: -1 = noise, 0+ = cluster index
        labels = clusterer.fit_predict(embeddings)

        # Group indices by cluster label
        cluster_map: dict[int, list[int]] = {}
        for idx, label in enumerate(labels):
            if label not in cluster_map:
                cluster_map[label] = []
            cluster_map[label].append(idx)

        # Build result: non-noise clusters first, then noise as singletons
        clusters: List[List[int]] = []

        # Add proper clusters (label >= 0)
        for label in sorted(cluster_map.keys()):
            if label >= 0:
                clusters.append(cluster_map[label])

        # Add noise points as singleton clusters (label == -1)
        if -1 in cluster_map:
            for idx in cluster_map[-1]:
                clusters.append([idx])

        return clusters

    def select_representatives(
        self,
        clusters: List[List[int]],
        results: List["SearchResult"],
        embeddings: Optional["np.ndarray"] = None,
    ) -> List["SearchResult"]:
        """Select representative results from each cluster.

        Selects the result with the highest score from each cluster.

        Args:
            clusters: List of clusters from cluster() method.
            results: Original list of SearchResult objects.
            embeddings: Optional embeddings (not used in score-based selection).

        Returns:
            List of representative SearchResult objects, one per cluster,
            ordered by score (highest first).
        """
        if not clusters or not results:
            return []

        representatives: List["SearchResult"] = []

        for cluster_indices in clusters:
            if not cluster_indices:
                continue

            # Find the result with the highest score in this cluster
            best_idx = max(cluster_indices, key=lambda i: results[i].score)
            representatives.append(results[best_idx])

        # Sort by score descending
        representatives.sort(key=lambda r: r.score, reverse=True)

        return representatives
