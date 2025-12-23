"""Embedder for semantic code search using fastembed.

Supports GPU acceleration via ONNX execution providers (CUDA, TensorRT, DirectML, ROCm, CoreML).
GPU acceleration is automatic when available, with transparent CPU fallback.
"""

from __future__ import annotations

import gc
import logging
import threading
from typing import Dict, Iterable, List, Optional

import numpy as np

from . import SEMANTIC_AVAILABLE
from .base import BaseEmbedder
from .gpu_support import get_optimal_providers, is_gpu_available, get_gpu_summary, get_selected_device_id

logger = logging.getLogger(__name__)

# Global embedder cache for singleton pattern
_embedder_cache: Dict[str, "Embedder"] = {}
_cache_lock = threading.Lock()


def get_embedder(profile: str = "code", use_gpu: bool = True) -> "Embedder":
    """Get or create a cached Embedder instance (thread-safe singleton).

    This function provides significant performance improvement by reusing
    Embedder instances across multiple searches, avoiding repeated model
    loading overhead (~0.8s per load).

    Args:
        profile: Model profile ("fast", "code", "multilingual", "balanced")
        use_gpu: If True, use GPU acceleration when available (default: True)

    Returns:
        Cached Embedder instance for the given profile
    """
    global _embedder_cache

    # Cache key includes GPU preference to support mixed configurations
    cache_key = f"{profile}:{'gpu' if use_gpu else 'cpu'}"

    # Fast path: check cache without lock
    if cache_key in _embedder_cache:
        return _embedder_cache[cache_key]

    # Slow path: acquire lock for initialization
    with _cache_lock:
        # Double-check after acquiring lock
        if cache_key in _embedder_cache:
            return _embedder_cache[cache_key]

        # Create new embedder and cache it
        embedder = Embedder(profile=profile, use_gpu=use_gpu)
        # Pre-load model to ensure it's ready
        embedder._load_model()
        _embedder_cache[cache_key] = embedder

        # Log GPU status on first embedder creation
        if use_gpu and is_gpu_available():
            logger.info(f"Embedder initialized with GPU: {get_gpu_summary()}")
        elif use_gpu:
            logger.debug("GPU not available, using CPU for embeddings")

        return embedder


def clear_embedder_cache() -> None:
    """Clear the embedder cache and release ONNX resources.

    This method ensures proper cleanup of ONNX model resources to prevent
    memory leaks when embedders are no longer needed.
    """
    global _embedder_cache
    with _cache_lock:
        # Release ONNX resources before clearing cache
        for embedder in _embedder_cache.values():
            if embedder._model is not None:
                del embedder._model
                embedder._model = None
        _embedder_cache.clear()
        gc.collect()


class Embedder(BaseEmbedder):
    """Generate embeddings for code chunks using fastembed (ONNX-based).

    Supported Model Profiles:
    - fast: BAAI/bge-small-en-v1.5 (384 dim) - Fast, lightweight, English-optimized
    - code: jinaai/jina-embeddings-v2-base-code (768 dim) - Code-optimized, best for programming languages
    - multilingual: intfloat/multilingual-e5-large (1024 dim) - Multilingual + code support
    - balanced: mixedbread-ai/mxbai-embed-large-v1 (1024 dim) - High accuracy, general purpose
    """

    # Model profiles for different use cases
    MODELS = {
        "fast": "BAAI/bge-small-en-v1.5",           # 384 dim - Fast, lightweight
        "code": "jinaai/jina-embeddings-v2-base-code",  # 768 dim - Code-optimized
        "multilingual": "intfloat/multilingual-e5-large",  # 1024 dim - Multilingual
        "balanced": "mixedbread-ai/mxbai-embed-large-v1",  # 1024 dim - High accuracy
    }

    # Dimension mapping for each model
    MODEL_DIMS = {
        "BAAI/bge-small-en-v1.5": 384,
        "jinaai/jina-embeddings-v2-base-code": 768,
        "intfloat/multilingual-e5-large": 1024,
        "mixedbread-ai/mxbai-embed-large-v1": 1024,
    }

    # Default model (fast profile)
    DEFAULT_MODEL = "BAAI/bge-small-en-v1.5"
    DEFAULT_PROFILE = "fast"

    def __init__(
        self,
        model_name: str | None = None,
        profile: str | None = None,
        use_gpu: bool = True,
        providers: List[str] | None = None,
    ) -> None:
        """Initialize embedder with model or profile.

        Args:
            model_name: Explicit model name (e.g., "jinaai/jina-embeddings-v2-base-code")
            profile: Model profile shortcut ("fast", "code", "multilingual", "balanced")
                    If both provided, model_name takes precedence.
            use_gpu: If True, use GPU acceleration when available (default: True)
            providers: Explicit ONNX providers list (overrides use_gpu if provided)
        """
        if not SEMANTIC_AVAILABLE:
            raise ImportError(
                "Semantic search dependencies not available. "
                "Install with: pip install codexlens[semantic]"
            )

        # Resolve model name from profile or use explicit name
        if model_name:
            self._model_name = model_name
        elif profile and profile in self.MODELS:
            self._model_name = self.MODELS[profile]
        else:
            self._model_name = self.DEFAULT_MODEL

        # Configure ONNX execution providers with device_id options for GPU selection
        # Using with_device_options=True ensures DirectML/CUDA device_id is passed correctly
        if providers is not None:
            self._providers = providers
        else:
            self._providers = get_optimal_providers(use_gpu=use_gpu, with_device_options=True)

        self._use_gpu = use_gpu
        self._model = None

    @property
    def model_name(self) -> str:
        """Get model name."""
        return self._model_name

    @property
    def embedding_dim(self) -> int:
        """Get embedding dimension for current model."""
        return self.MODEL_DIMS.get(self._model_name, 768)  # Default to 768 if unknown

    @property
    def providers(self) -> List[str]:
        """Get configured ONNX execution providers."""
        return self._providers

    @property
    def is_gpu_enabled(self) -> bool:
        """Check if GPU acceleration is enabled for this embedder."""
        gpu_providers = {"CUDAExecutionProvider", "TensorrtExecutionProvider",
                        "DmlExecutionProvider", "ROCMExecutionProvider", "CoreMLExecutionProvider"}
        # Handle both string providers and tuple providers (name, options)
        for p in self._providers:
            provider_name = p[0] if isinstance(p, tuple) else p
            if provider_name in gpu_providers:
                return True
        return False

    def _load_model(self) -> None:
        """Lazy load the embedding model with configured providers."""
        if self._model is not None:
            return

        from fastembed import TextEmbedding

        # providers already include device_id options via get_optimal_providers(with_device_options=True)
        # DO NOT pass device_ids separately - fastembed ignores it when providers is specified
        # See: fastembed/text/onnx_embedding.py - device_ids is only used with cuda=True
        try:
            self._model = TextEmbedding(
                model_name=self.model_name,
                providers=self._providers,
            )
            logger.debug(f"Model loaded with providers: {self._providers}")
        except TypeError:
            # Fallback for older fastembed versions without providers parameter
            logger.warning(
                "fastembed version doesn't support 'providers' parameter. "
                "Upgrade fastembed for GPU acceleration: pip install --upgrade fastembed"
            )
            self._model = TextEmbedding(model_name=self.model_name)

    def embed(self, texts: str | Iterable[str]) -> List[List[float]]:
        """Generate embeddings for one or more texts.

        Args:
            texts: Single text or iterable of texts to embed.

        Returns:
            List of embedding vectors (each is a list of floats).

        Note:
            This method converts numpy arrays to Python lists for backward compatibility.
            For memory-efficient processing, use embed_to_numpy() instead.
        """
        self._load_model()

        if isinstance(texts, str):
            texts = [texts]
        else:
            texts = list(texts)

        embeddings = list(self._model.embed(texts))
        return [emb.tolist() for emb in embeddings]

    def embed_to_numpy(self, texts: str | Iterable[str], batch_size: Optional[int] = None) -> np.ndarray:
        """Generate embeddings for one or more texts (returns numpy arrays).

        This method is more memory-efficient than embed() as it avoids converting
        numpy arrays to Python lists, which can significantly reduce memory usage
        during batch processing.

        Args:
            texts: Single text or iterable of texts to embed.
            batch_size: Optional batch size for fastembed processing.
                       Larger values improve GPU utilization but use more memory.

        Returns:
            numpy.ndarray of shape (n_texts, embedding_dim) containing embeddings.
        """
        self._load_model()

        if isinstance(texts, str):
            texts = [texts]
        else:
            texts = list(texts)

        # Pass batch_size to fastembed for optimal GPU utilization
        # Default batch_size in fastembed is 256, but larger values can improve throughput
        if batch_size is not None:
            embeddings = list(self._model.embed(texts, batch_size=batch_size))
        else:
            embeddings = list(self._model.embed(texts))
        return np.array(embeddings)

    def embed_single(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        return self.embed(text)[0]
