from .chain_search import (
    ChainSearchEngine,
    SearchOptions,
    SearchStats,
    ChainSearchResult,
    quick_search,
)

# Clustering availability flag (lazy import pattern)
CLUSTERING_AVAILABLE = False
_clustering_import_error: str | None = None

try:
    from .clustering import CLUSTERING_AVAILABLE as _clustering_flag
    from .clustering import check_clustering_available
    CLUSTERING_AVAILABLE = _clustering_flag
except ImportError as e:
    _clustering_import_error = str(e)

    def check_clustering_available() -> tuple[bool, str | None]:
        """Fallback when clustering module not loadable."""
        return False, _clustering_import_error


# Clustering module exports (conditional)
try:
    from .clustering import (
        BaseClusteringStrategy,
        ClusteringConfig,
        ClusteringStrategyFactory,
        get_strategy,
    )
    _clustering_exports = [
        "BaseClusteringStrategy",
        "ClusteringConfig",
        "ClusteringStrategyFactory",
        "get_strategy",
    ]
except ImportError:
    _clustering_exports = []


__all__ = [
    "ChainSearchEngine",
    "SearchOptions",
    "SearchStats",
    "ChainSearchResult",
    "quick_search",
    # Clustering
    "CLUSTERING_AVAILABLE",
    "check_clustering_available",
    *_clustering_exports,
]
