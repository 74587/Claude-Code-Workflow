"""HDBSCAN-based clustering strategy for search results.

HDBSCAN (Hierarchical Density-Based Spatial Clustering of Applications with Noise)
is the primary clustering strategy for grouping similar search results.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, List, Optional

from .base import BaseClusteringStrategy, ClusteringConfig

if TYPE_CHECKING:
    import numpy as np
    from codexlens.entities import SearchResult


class HDBSCANStrategy(BaseClusteringStrategy):
    """HDBSCAN-based clustering strategy.

    Uses HDBSCAN algorithm to cluster search results based on embedding similarity.
    HDBSCAN is preferred over DBSCAN because it:
    - Automatically determines the number of clusters
    - Handles varying density clusters well
    - Identifies noise points (outliers) effectively

    Example:
        >>> from codexlens.search.clustering import HDBSCANStrategy, ClusteringConfig
        >>> config = ClusteringConfig(min_cluster_size=3, metric='cosine')
        >>> strategy = HDBSCANStrategy(config)
        >>> clusters = strategy.cluster(embeddings, results)
        >>> representatives = strategy.select_representatives(clusters, results)
    """

    def __init__(self, config: Optional[ClusteringConfig] = None) -> None:
        """Initialize HDBSCAN clustering strategy.

        Args:
            config: Clustering configuration. Uses defaults if not provided.

        Raises:
            ImportError: If hdbscan package is not installed.
        """
        super().__init__(config)
        # Validate hdbscan is available
        try:
            import hdbscan  # noqa: F401
        except ImportError as exc:
            raise ImportError(
                "hdbscan package is required for HDBSCANStrategy. "
                "Install with: pip install codexlens[clustering]"
            ) from exc

    def cluster(
        self,
        embeddings: "np.ndarray",
        results: List["SearchResult"],
    ) -> List[List[int]]:
        """Cluster search results using HDBSCAN algorithm.

        Args:
            embeddings: NumPy array of shape (n_results, embedding_dim)
                containing the embedding vectors for each result.
            results: List of SearchResult objects corresponding to embeddings.

        Returns:
            List of clusters, where each cluster is a list of indices
            into the results list. Noise points are returned as singleton clusters.
        """
        import hdbscan
        import numpy as np

        n_results = len(results)
        if n_results == 0:
            return []

        # Handle edge case: fewer results than min_cluster_size
        if n_results < self.config.min_cluster_size:
            # Return each result as its own singleton cluster
            return [[i] for i in range(n_results)]

        # Configure HDBSCAN clusterer
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=self.config.min_cluster_size,
            min_samples=self.config.min_samples,
            metric=self.config.metric,
            cluster_selection_epsilon=self.config.cluster_selection_epsilon,
            allow_single_cluster=self.config.allow_single_cluster,
            prediction_data=self.config.prediction_data,
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
