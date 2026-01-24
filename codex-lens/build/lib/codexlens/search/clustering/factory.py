"""Factory for creating clustering strategies.

Provides a unified interface for instantiating different clustering backends
with automatic fallback chain: hdbscan -> dbscan -> noop.
"""

from __future__ import annotations

from typing import Any, Optional

from .base import BaseClusteringStrategy, ClusteringConfig
from .noop_strategy import NoOpStrategy


def check_clustering_strategy_available(strategy: str) -> tuple[bool, str | None]:
    """Check whether a specific clustering strategy can be used.

    Args:
        strategy: Strategy name to check. Options:
            - "hdbscan": HDBSCAN clustering (requires hdbscan package)
            - "dbscan": DBSCAN clustering (requires sklearn)
            - "frequency": Frequency-based clustering (always available)
            - "noop": No-op strategy (always available)

    Returns:
        Tuple of (is_available, error_message).
        error_message is None if available, otherwise contains install instructions.
    """
    strategy = (strategy or "").strip().lower()

    if strategy == "hdbscan":
        try:
            import hdbscan  # noqa: F401
        except ImportError:
            return False, (
                "hdbscan package not available. "
                "Install with: pip install codexlens[clustering]"
            )
        return True, None

    if strategy == "dbscan":
        try:
            from sklearn.cluster import DBSCAN  # noqa: F401
        except ImportError:
            return False, (
                "scikit-learn package not available. "
                "Install with: pip install codexlens[clustering]"
            )
        return True, None

    if strategy == "frequency":
        # Frequency strategy is always available (no external deps)
        return True, None

    if strategy == "noop":
        return True, None

    return False, (
        f"Invalid clustering strategy: {strategy}. "
        "Must be 'hdbscan', 'dbscan', 'frequency', or 'noop'."
    )


def get_strategy(
    strategy: str = "hdbscan",
    config: Optional[ClusteringConfig] = None,
    *,
    fallback: bool = True,
    **kwargs: Any,
) -> BaseClusteringStrategy:
    """Factory function to create clustering strategy with fallback chain.

    The fallback chain is: hdbscan -> dbscan -> frequency -> noop

    Args:
        strategy: Clustering strategy to use. Options:
            - "hdbscan": HDBSCAN clustering (default, recommended)
            - "dbscan": DBSCAN clustering (fallback)
            - "frequency": Frequency-based clustering (groups by symbol occurrence)
            - "noop": No-op strategy (returns all results ungrouped)
            - "auto": Try hdbscan, then dbscan, then noop
        config: Clustering configuration. Uses defaults if not provided.
            For frequency strategy, pass FrequencyConfig for full control.
        fallback: If True (default), automatically fall back to next strategy
            in the chain when primary is unavailable. If False, raise ImportError
            when requested strategy is unavailable.
        **kwargs: Additional strategy-specific arguments.
            For DBSCANStrategy: eps, eps_percentile
            For FrequencyStrategy: group_by, min_frequency, etc.

    Returns:
        BaseClusteringStrategy: Configured clustering strategy instance.

    Raises:
        ValueError: If strategy is not recognized.
        ImportError: If required dependencies are not installed and fallback=False.

    Example:
        >>> from codexlens.search.clustering import get_strategy, ClusteringConfig
        >>> config = ClusteringConfig(min_cluster_size=3)
        >>> # Auto-select best available strategy
        >>> strategy = get_strategy("auto", config)
        >>> # Explicitly use HDBSCAN (will fall back if unavailable)
        >>> strategy = get_strategy("hdbscan", config)
        >>> # Use frequency-based strategy
        >>> from codexlens.search.clustering import FrequencyConfig
        >>> freq_config = FrequencyConfig(min_frequency=2, group_by="symbol")
        >>> strategy = get_strategy("frequency", freq_config)
    """
    strategy = (strategy or "").strip().lower()

    # Handle "auto" - try strategies in order
    if strategy == "auto":
        return _get_best_available_strategy(config, **kwargs)

    if strategy == "hdbscan":
        ok, err = check_clustering_strategy_available("hdbscan")
        if ok:
            from .hdbscan_strategy import HDBSCANStrategy
            return HDBSCANStrategy(config)

        if fallback:
            # Try dbscan fallback
            ok_dbscan, _ = check_clustering_strategy_available("dbscan")
            if ok_dbscan:
                from .dbscan_strategy import DBSCANStrategy
                return DBSCANStrategy(config, **kwargs)
            # Final fallback to noop
            return NoOpStrategy(config)

        raise ImportError(err)

    if strategy == "dbscan":
        ok, err = check_clustering_strategy_available("dbscan")
        if ok:
            from .dbscan_strategy import DBSCANStrategy
            return DBSCANStrategy(config, **kwargs)

        if fallback:
            # Fallback to noop
            return NoOpStrategy(config)

        raise ImportError(err)

    if strategy == "frequency":
        from .frequency_strategy import FrequencyStrategy, FrequencyConfig
        # If config is ClusteringConfig but not FrequencyConfig, create default FrequencyConfig
        if config is None or not isinstance(config, FrequencyConfig):
            freq_config = FrequencyConfig(**kwargs) if kwargs else FrequencyConfig()
        else:
            freq_config = config
        return FrequencyStrategy(freq_config)

    if strategy == "noop":
        return NoOpStrategy(config)

    raise ValueError(
        f"Unknown clustering strategy: {strategy}. "
        "Supported strategies: 'hdbscan', 'dbscan', 'frequency', 'noop', 'auto'"
    )


def _get_best_available_strategy(
    config: Optional[ClusteringConfig] = None,
    **kwargs: Any,
) -> BaseClusteringStrategy:
    """Get the best available clustering strategy.

    Tries strategies in order: hdbscan -> dbscan -> noop

    Args:
        config: Clustering configuration.
        **kwargs: Additional strategy-specific arguments.

    Returns:
        Best available clustering strategy instance.
    """
    # Try HDBSCAN first
    ok, _ = check_clustering_strategy_available("hdbscan")
    if ok:
        from .hdbscan_strategy import HDBSCANStrategy
        return HDBSCANStrategy(config)

    # Try DBSCAN second
    ok, _ = check_clustering_strategy_available("dbscan")
    if ok:
        from .dbscan_strategy import DBSCANStrategy
        return DBSCANStrategy(config, **kwargs)

    # Fallback to NoOp
    return NoOpStrategy(config)


# Alias for backward compatibility
ClusteringStrategyFactory = type(
    "ClusteringStrategyFactory",
    (),
    {
        "get_strategy": staticmethod(get_strategy),
        "check_available": staticmethod(check_clustering_strategy_available),
    },
)
