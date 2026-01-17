"""Base classes for clustering strategies in the hybrid search pipeline.

This module defines the abstract base class for clustering strategies used
in the staged hybrid search pipeline. Strategies cluster search results
based on their embeddings and select representative results from each cluster.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, List, Optional

if TYPE_CHECKING:
    import numpy as np
    from codexlens.entities import SearchResult


@dataclass
class ClusteringConfig:
    """Configuration parameters for clustering strategies.

    Attributes:
        min_cluster_size: Minimum number of results to form a cluster.
            HDBSCAN default is 5, but for search results 2-3 is often better.
        min_samples: Number of samples in a neighborhood for a point to be
            considered a core point. Lower values allow more clusters.
        metric: Distance metric for clustering. Common options:
            - 'euclidean': Standard L2 distance
            - 'cosine': Cosine distance (1 - cosine_similarity)
            - 'manhattan': L1 distance
        cluster_selection_epsilon: Distance threshold for cluster selection.
            Results within this distance may be merged into the same cluster.
        allow_single_cluster: If True, allow all results to form one cluster.
            Useful when results are very similar.
        prediction_data: If True, generate prediction data for new points.
    """

    min_cluster_size: int = 3
    min_samples: int = 2
    metric: str = "cosine"
    cluster_selection_epsilon: float = 0.0
    allow_single_cluster: bool = True
    prediction_data: bool = False

    def __post_init__(self) -> None:
        """Validate configuration parameters."""
        if self.min_cluster_size < 2:
            raise ValueError("min_cluster_size must be >= 2")
        if self.min_samples < 1:
            raise ValueError("min_samples must be >= 1")
        if self.metric not in ("euclidean", "cosine", "manhattan"):
            raise ValueError(f"metric must be one of: euclidean, cosine, manhattan; got {self.metric}")
        if self.cluster_selection_epsilon < 0:
            raise ValueError("cluster_selection_epsilon must be >= 0")


class BaseClusteringStrategy(ABC):
    """Abstract base class for clustering strategies.

    Clustering strategies are used in the staged hybrid search pipeline to
    group similar search results and select representative results from each
    cluster, reducing redundancy while maintaining diversity.

    Subclasses must implement:
        - cluster(): Group results into clusters based on embeddings
        - select_representatives(): Choose best result(s) from each cluster
    """

    def __init__(self, config: Optional[ClusteringConfig] = None) -> None:
        """Initialize the clustering strategy.

        Args:
            config: Clustering configuration. Uses defaults if not provided.
        """
        self.config = config or ClusteringConfig()

    @abstractmethod
    def cluster(
        self,
        embeddings: "np.ndarray",
        results: List["SearchResult"],
    ) -> List[List[int]]:
        """Cluster search results based on their embeddings.

        Args:
            embeddings: NumPy array of shape (n_results, embedding_dim)
                containing the embedding vectors for each result.
            results: List of SearchResult objects corresponding to embeddings.
                Used for additional metadata during clustering.

        Returns:
            List of clusters, where each cluster is a list of indices
            into the results list. Results not assigned to any cluster
            (noise points) should be returned as single-element clusters.

        Example:
            >>> strategy = HDBSCANStrategy()
            >>> clusters = strategy.cluster(embeddings, results)
            >>> # clusters = [[0, 2, 5], [1, 3], [4], [6, 7, 8]]
            >>> # Result indices 0, 2, 5 are in cluster 0
            >>> # Result indices 1, 3 are in cluster 1
            >>> # Result index 4 is a noise point (singleton cluster)
            >>> # Result indices 6, 7, 8 are in cluster 2
        """
        ...

    @abstractmethod
    def select_representatives(
        self,
        clusters: List[List[int]],
        results: List["SearchResult"],
        embeddings: Optional["np.ndarray"] = None,
    ) -> List["SearchResult"]:
        """Select representative results from each cluster.

        This method chooses the best result(s) from each cluster to include
        in the final search results. The selection can be based on:
        - Highest score within cluster
        - Closest to cluster centroid
        - Custom selection logic

        Args:
            clusters: List of clusters from cluster() method.
            results: Original list of SearchResult objects.
            embeddings: Optional embeddings array for centroid-based selection.

        Returns:
            List of representative SearchResult objects, one or more per cluster,
            ordered by relevance (highest score first).

        Example:
            >>> representatives = strategy.select_representatives(clusters, results)
            >>> # Returns best result from each cluster
        """
        ...

    def fit_predict(
        self,
        embeddings: "np.ndarray",
        results: List["SearchResult"],
    ) -> List["SearchResult"]:
        """Convenience method to cluster and select representatives in one call.

        Args:
            embeddings: NumPy array of shape (n_results, embedding_dim).
            results: List of SearchResult objects.

        Returns:
            List of representative SearchResult objects.
        """
        clusters = self.cluster(embeddings, results)
        return self.select_representatives(clusters, results, embeddings)
