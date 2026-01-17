"""Clustering strategies for the staged hybrid search pipeline.

This module provides extensible clustering infrastructure for grouping
similar search results and selecting representative results.

Install with: pip install codexlens[clustering]

Example:
    >>> from codexlens.search.clustering import (
    ...     CLUSTERING_AVAILABLE,
    ...     ClusteringConfig,
    ...     get_strategy,
    ... )
    >>> config = ClusteringConfig(min_cluster_size=3)
    >>> # Auto-select best available strategy with fallback
    >>> strategy = get_strategy("auto", config)
    >>> representatives = strategy.fit_predict(embeddings, results)
    >>>
    >>> # Or explicitly use a specific strategy
    >>> if CLUSTERING_AVAILABLE:
    ...     from codexlens.search.clustering import HDBSCANStrategy
    ...     strategy = HDBSCANStrategy(config)
    ...     representatives = strategy.fit_predict(embeddings, results)
"""

from __future__ import annotations

# Always export base classes and factory (no heavy dependencies)
from .base import BaseClusteringStrategy, ClusteringConfig
from .factory import (
    ClusteringStrategyFactory,
    check_clustering_strategy_available,
    get_strategy,
)
from .noop_strategy import NoOpStrategy
from .frequency_strategy import FrequencyStrategy, FrequencyConfig

# Feature flag for clustering availability (hdbscan + sklearn)
CLUSTERING_AVAILABLE = False
HDBSCAN_AVAILABLE = False
DBSCAN_AVAILABLE = False
_import_error: str | None = None


def _detect_clustering_available() -> tuple[bool, bool, bool, str | None]:
    """Detect if clustering dependencies are available.

    Returns:
        Tuple of (all_available, hdbscan_available, dbscan_available, error_message).
    """
    hdbscan_ok = False
    dbscan_ok = False

    try:
        import hdbscan  # noqa: F401
        hdbscan_ok = True
    except ImportError:
        pass

    try:
        from sklearn.cluster import DBSCAN  # noqa: F401
        dbscan_ok = True
    except ImportError:
        pass

    all_ok = hdbscan_ok and dbscan_ok
    error = None
    if not all_ok:
        missing = []
        if not hdbscan_ok:
            missing.append("hdbscan")
        if not dbscan_ok:
            missing.append("scikit-learn")
        error = f"{', '.join(missing)} not available. Install with: pip install codexlens[clustering]"

    return all_ok, hdbscan_ok, dbscan_ok, error


# Initialize on module load
CLUSTERING_AVAILABLE, HDBSCAN_AVAILABLE, DBSCAN_AVAILABLE, _import_error = (
    _detect_clustering_available()
)


def check_clustering_available() -> tuple[bool, str | None]:
    """Check if all clustering dependencies are available.

    Returns:
        Tuple of (is_available, error_message).
        error_message is None if available, otherwise contains install instructions.
    """
    return CLUSTERING_AVAILABLE, _import_error


# Conditionally export strategy implementations
__all__ = [
    # Feature flags
    "CLUSTERING_AVAILABLE",
    "HDBSCAN_AVAILABLE",
    "DBSCAN_AVAILABLE",
    "check_clustering_available",
    # Base classes
    "BaseClusteringStrategy",
    "ClusteringConfig",
    # Factory
    "ClusteringStrategyFactory",
    "get_strategy",
    "check_clustering_strategy_available",
    # Always-available strategies
    "NoOpStrategy",
    "FrequencyStrategy",
    "FrequencyConfig",
]

# Conditionally add strategy classes to __all__ and module namespace
if HDBSCAN_AVAILABLE:
    from .hdbscan_strategy import HDBSCANStrategy

    __all__.append("HDBSCANStrategy")

if DBSCAN_AVAILABLE:
    from .dbscan_strategy import DBSCANStrategy

    __all__.append("DBSCANStrategy")
