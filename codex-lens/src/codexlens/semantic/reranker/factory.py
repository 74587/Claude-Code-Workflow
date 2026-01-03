"""Factory for creating rerankers.

Provides a unified interface for instantiating different reranker backends.
"""

from __future__ import annotations

from typing import Any

from .base import BaseReranker


def check_reranker_available(backend: str) -> tuple[bool, str | None]:
    """Check whether a specific reranker backend can be used.

    Notes:
    - "fastembed" uses fastembed TextCrossEncoder (pip install fastembed>=0.4.0). [Recommended]
    - "onnx" redirects to "fastembed" for backward compatibility.
    - "legacy" uses sentence-transformers CrossEncoder (pip install codexlens[reranker-legacy]).
    - "api" uses a remote reranking HTTP API (requires httpx).
    - "litellm" uses `ccw-litellm` for unified access to LLM providers.
    """
    backend = (backend or "").strip().lower()

    if backend == "legacy":
        from .legacy import check_cross_encoder_available

        return check_cross_encoder_available()

    if backend == "fastembed":
        from .fastembed_reranker import check_fastembed_reranker_available

        return check_fastembed_reranker_available()

    if backend == "onnx":
        # Redirect to fastembed for backward compatibility
        from .fastembed_reranker import check_fastembed_reranker_available

        return check_fastembed_reranker_available()

    if backend == "litellm":
        try:
            import ccw_litellm  # noqa: F401
        except ImportError as exc:  # pragma: no cover - optional dependency
            return (
                False,
                f"ccw-litellm not available: {exc}. Install with: pip install ccw-litellm",
            )

        try:
            from .litellm_reranker import LiteLLMReranker  # noqa: F401
        except Exception as exc:  # pragma: no cover - defensive
            return False, f"LiteLLM reranker backend not available: {exc}"

        return True, None

    if backend == "api":
        from .api_reranker import check_httpx_available

        return check_httpx_available()

    return False, (
        f"Invalid reranker backend: {backend}. "
        "Must be 'fastembed', 'onnx', 'api', 'litellm', or 'legacy'."
    )


def get_reranker(
    backend: str = "fastembed",
    model_name: str | None = None,
    *,
    device: str | None = None,
    **kwargs: Any,
) -> BaseReranker:
    """Factory function to create reranker based on backend.

    Args:
        backend: Reranker backend to use. Options:
            - "fastembed": FastEmbed TextCrossEncoder backend (default, recommended)
            - "onnx": Redirects to fastembed for backward compatibility
            - "api": HTTP API backend (remote providers)
            - "litellm": LiteLLM backend (LLM-based, for API mode)
            - "legacy": sentence-transformers CrossEncoder backend (optional)
        model_name: Model identifier for model-based backends. Defaults depend on backend:
            - fastembed: Xenova/ms-marco-MiniLM-L-6-v2
            - onnx: (redirects to fastembed)
            - api: BAAI/bge-reranker-v2-m3 (SiliconFlow)
            - legacy: cross-encoder/ms-marco-MiniLM-L-6-v2
            - litellm: default
        device: Optional device string for backends that support it (legacy only).
        **kwargs: Additional backend-specific arguments.

    Returns:
        BaseReranker: Configured reranker instance.

    Raises:
        ValueError: If backend is not recognized.
        ImportError: If required backend dependencies are not installed or backend is unavailable.
    """
    backend = (backend or "").strip().lower()

    if backend == "fastembed":
        ok, err = check_reranker_available("fastembed")
        if not ok:
            raise ImportError(err)

        from .fastembed_reranker import FastEmbedReranker

        resolved_model_name = (model_name or "").strip() or FastEmbedReranker.DEFAULT_MODEL
        _ = device  # Device selection is managed via fastembed providers.
        return FastEmbedReranker(model_name=resolved_model_name, **kwargs)

    if backend == "onnx":
        # Redirect to fastembed for backward compatibility
        ok, err = check_reranker_available("fastembed")
        if not ok:
            raise ImportError(err)

        from .fastembed_reranker import FastEmbedReranker

        resolved_model_name = (model_name or "").strip() or FastEmbedReranker.DEFAULT_MODEL
        _ = device  # Device selection is managed via fastembed providers.
        return FastEmbedReranker(model_name=resolved_model_name, **kwargs)

    if backend == "legacy":
        ok, err = check_reranker_available("legacy")
        if not ok:
            raise ImportError(err)

        from .legacy import CrossEncoderReranker

        resolved_model_name = (model_name or "").strip() or "cross-encoder/ms-marco-MiniLM-L-6-v2"
        return CrossEncoderReranker(model_name=resolved_model_name, device=device)

    if backend == "litellm":
        ok, err = check_reranker_available("litellm")
        if not ok:
            raise ImportError(err)

        from .litellm_reranker import LiteLLMReranker

        _ = device  # Device selection is not applicable to remote LLM backends.
        resolved_model_name = (model_name or "").strip() or "default"
        return LiteLLMReranker(model=resolved_model_name, **kwargs)

    if backend == "api":
        ok, err = check_reranker_available("api")
        if not ok:
            raise ImportError(err)

        from .api_reranker import APIReranker

        _ = device  # Device selection is not applicable to remote HTTP backends.
        resolved_model_name = (model_name or "").strip() or None
        return APIReranker(model_name=resolved_model_name, **kwargs)

    raise ValueError(
        f"Unknown backend: {backend}. Supported backends: 'fastembed', 'onnx', 'api', 'litellm', 'legacy'"
    )
