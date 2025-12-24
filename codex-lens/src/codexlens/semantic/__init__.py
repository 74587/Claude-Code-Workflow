"""Optional semantic search module for CodexLens.

Install with: pip install codexlens[semantic]
Uses fastembed (ONNX-based, lightweight ~200MB)

GPU Acceleration:
- Automatic GPU detection and usage when available
- Supports CUDA (NVIDIA), TensorRT, DirectML (Windows), ROCm (AMD), CoreML (Apple)
- Install GPU support: pip install onnxruntime-gpu (NVIDIA) or onnxruntime-directml (Windows)
"""

from __future__ import annotations

SEMANTIC_AVAILABLE = False
SEMANTIC_BACKEND: str | None = None
GPU_AVAILABLE = False
LITELLM_AVAILABLE = False
_import_error: str | None = None


def _detect_backend() -> tuple[bool, str | None, bool, str | None]:
    """Detect if fastembed and GPU are available."""
    try:
        import numpy as np
    except ImportError as e:
        return False, None, False, f"numpy not available: {e}"

    try:
        from fastembed import TextEmbedding
    except ImportError:
        return False, None, False, "fastembed not available. Install with: pip install codexlens[semantic]"

    # Check GPU availability
    gpu_available = False
    try:
        from .gpu_support import is_gpu_available
        gpu_available = is_gpu_available()
    except ImportError:
        pass

    return True, "fastembed", gpu_available, None


# Initialize on module load
SEMANTIC_AVAILABLE, SEMANTIC_BACKEND, GPU_AVAILABLE, _import_error = _detect_backend()


def check_semantic_available() -> tuple[bool, str | None]:
    """Check if semantic search dependencies are available."""
    return SEMANTIC_AVAILABLE, _import_error


def check_gpu_available() -> tuple[bool, str]:
    """Check if GPU acceleration is available.

    Returns:
        Tuple of (is_available, status_message)
    """
    if not SEMANTIC_AVAILABLE:
        return False, "Semantic search not available"

    try:
        from .gpu_support import is_gpu_available, get_gpu_summary
        if is_gpu_available():
            return True, get_gpu_summary()
        return False, "No GPU detected (using CPU)"
    except ImportError:
        return False, "GPU support module not available"


# Export embedder components
# BaseEmbedder is always available (abstract base class)
from .base import BaseEmbedder

# Factory function for creating embedders
from .factory import get_embedder as get_embedder_factory

# Optional: LiteLLMEmbedderWrapper (only if ccw-litellm is installed)
try:
    import ccw_litellm  # noqa: F401
    from .litellm_embedder import LiteLLMEmbedderWrapper
    LITELLM_AVAILABLE = True
except ImportError:
    LiteLLMEmbedderWrapper = None
    LITELLM_AVAILABLE = False


def is_embedding_backend_available(backend: str) -> tuple[bool, str | None]:
    """Check whether a specific embedding backend can be used.

    Notes:
    - "fastembed" requires the optional semantic deps (pip install codexlens[semantic]).
    - "litellm" requires ccw-litellm to be installed in the same environment.
    """
    backend = (backend or "").strip().lower()
    if backend == "fastembed":
        if SEMANTIC_AVAILABLE:
            return True, None
        return False, _import_error or "fastembed not available. Install with: pip install codexlens[semantic]"
    if backend == "litellm":
        if LITELLM_AVAILABLE:
            return True, None
        return False, "ccw-litellm not available. Install with: pip install ccw-litellm"
    return False, f"Invalid embedding backend: {backend}. Must be 'fastembed' or 'litellm'."


__all__ = [
    "SEMANTIC_AVAILABLE",
    "SEMANTIC_BACKEND",
    "GPU_AVAILABLE",
    "LITELLM_AVAILABLE",
    "check_semantic_available",
    "is_embedding_backend_available",
    "check_gpu_available",
    "BaseEmbedder",
    "get_embedder_factory",
    "LiteLLMEmbedderWrapper",
]
