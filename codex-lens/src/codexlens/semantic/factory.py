"""Factory for creating embedders.

Provides a unified interface for instantiating different embedder backends.
"""

from __future__ import annotations

from typing import Any

from .base import BaseEmbedder


def get_embedder(
    backend: str = "fastembed",
    profile: str = "code",
    model: str = "default",
    use_gpu: bool = True,
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
    """
    if backend == "fastembed":
        from .embedder import Embedder
        return Embedder(profile=profile, use_gpu=use_gpu, **kwargs)
    elif backend == "litellm":
        from .litellm_embedder import LiteLLMEmbedderWrapper
        return LiteLLMEmbedderWrapper(model=model, **kwargs)
    else:
        raise ValueError(
            f"Unknown backend: {backend}. "
            f"Supported backends: 'fastembed', 'litellm'"
        )
