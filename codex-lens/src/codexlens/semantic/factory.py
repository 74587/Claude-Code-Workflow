"""Factory for creating embedders.

Provides a unified interface for instantiating different embedder backends.
Includes caching to avoid repeated model loading overhead.
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Dict, List, Optional

from .base import BaseEmbedder

# Module-level cache for embedder instances
# Key: (backend, profile, model, use_gpu) -> embedder instance
_embedder_cache: Dict[tuple, BaseEmbedder] = {}
_cache_lock = threading.Lock()
_logger = logging.getLogger(__name__)


def get_embedder(
    backend: str = "fastembed",
    profile: str = "code",
    model: str = "default",
    use_gpu: bool = True,
    endpoints: Optional[List[Dict[str, Any]]] = None,
    strategy: str = "latency_aware",
    cooldown: float = 60.0,
    **kwargs: Any,
) -> BaseEmbedder:
    """Factory function to create embedder based on backend.

    Args:
        backend: Embedder backend to use. Options:
            - "fastembed": Use fastembed (ONNX-based) embedder (default)
            - "litellm": Use ccw-litellm embedder
        profile: Model profile for fastembed backend ("fast", "code", "multilingual", "balanced")
                Used only when backend="fastembed". Default: "code"
        model: Model identifier for litellm backend.
              Used only when backend="litellm". Default: "default"
        use_gpu: Whether to use GPU acceleration when available (default: True).
                Used only when backend="fastembed".
        endpoints: Optional list of endpoint configurations for multi-endpoint load balancing.
                  Each endpoint is a dict with keys: model, api_key, api_base, weight.
                  Used only when backend="litellm" and multiple endpoints provided.
        strategy: Selection strategy for multi-endpoint mode:
                 "round_robin", "latency_aware", "weighted_random".
                 Default: "latency_aware"
        cooldown: Default cooldown seconds for rate-limited endpoints (default: 60.0)
        **kwargs: Additional backend-specific arguments

    Returns:
        BaseEmbedder: Configured embedder instance

    Raises:
        ValueError: If backend is not recognized
        ImportError: If required backend dependencies are not installed

    Examples:
        Create fastembed embedder with code profile:
            >>> embedder = get_embedder(backend="fastembed", profile="code")

        Create fastembed embedder with fast profile and CPU only:
            >>> embedder = get_embedder(backend="fastembed", profile="fast", use_gpu=False)

        Create litellm embedder:
            >>> embedder = get_embedder(backend="litellm", model="text-embedding-3-small")

        Create rotational embedder with multiple endpoints:
            >>> endpoints = [
            ...     {"model": "openai/text-embedding-3-small", "api_key": "sk-..."},
            ...     {"model": "azure/my-embedding", "api_base": "https://...", "api_key": "..."},
            ... ]
            >>> embedder = get_embedder(backend="litellm", endpoints=endpoints)
    """
    # Build cache key from immutable configuration
    if backend == "fastembed":
        cache_key = ("fastembed", profile, None, use_gpu)
    elif backend == "litellm":
        # For litellm, use model as part of cache key
        # Multi-endpoint mode is not cached as it's more complex
        if endpoints and len(endpoints) > 1:
            cache_key = None  # Skip cache for multi-endpoint
        else:
            effective_model = endpoints[0]["model"] if endpoints else model
            cache_key = ("litellm", None, effective_model, None)
    else:
        cache_key = None

    # Check cache first (thread-safe)
    if cache_key is not None:
        with _cache_lock:
            if cache_key in _embedder_cache:
                _logger.debug("Returning cached embedder for %s", cache_key)
                return _embedder_cache[cache_key]

    # Create new embedder instance
    embedder: Optional[BaseEmbedder] = None

    if backend == "fastembed":
        from .embedder import Embedder
        embedder = Embedder(profile=profile, use_gpu=use_gpu, **kwargs)
    elif backend == "litellm":
        # Check if multi-endpoint mode is requested
        if endpoints and len(endpoints) > 1:
            from .rotational_embedder import create_rotational_embedder
            # Multi-endpoint is not cached
            return create_rotational_embedder(
                endpoints_config=endpoints,
                strategy=strategy,
                default_cooldown=cooldown,
            )
        elif endpoints and len(endpoints) == 1:
            # Single endpoint in list - use it directly
            ep = endpoints[0]
            ep_kwargs = {**kwargs}
            if "api_key" in ep:
                ep_kwargs["api_key"] = ep["api_key"]
            if "api_base" in ep:
                ep_kwargs["api_base"] = ep["api_base"]
            from .litellm_embedder import LiteLLMEmbedderWrapper
            embedder = LiteLLMEmbedderWrapper(model=ep["model"], **ep_kwargs)
        else:
            # No endpoints list - use model parameter
            from .litellm_embedder import LiteLLMEmbedderWrapper
            embedder = LiteLLMEmbedderWrapper(model=model, **kwargs)
    else:
        raise ValueError(
            f"Unknown backend: {backend}. "
            f"Supported backends: 'fastembed', 'litellm'"
        )

    # Cache the embedder for future use (thread-safe)
    if cache_key is not None and embedder is not None:
        with _cache_lock:
            # Double-check to avoid race condition
            if cache_key not in _embedder_cache:
                _embedder_cache[cache_key] = embedder
                _logger.debug("Cached new embedder for %s", cache_key)
            else:
                # Another thread created it already, use that one
                embedder = _embedder_cache[cache_key]

    return embedder  # type: ignore


def clear_embedder_cache() -> int:
    """Clear the embedder cache.

    Returns:
        Number of embedders cleared from cache
    """
    with _cache_lock:
        count = len(_embedder_cache)
        _embedder_cache.clear()
        _logger.debug("Cleared %d embedders from cache", count)
        return count
