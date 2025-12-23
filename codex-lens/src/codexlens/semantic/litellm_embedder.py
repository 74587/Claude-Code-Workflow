"""LiteLLM embedder wrapper for CodexLens.

Provides integration with ccw-litellm's LiteLLMEmbedder for embedding generation.
"""

from __future__ import annotations

from typing import Iterable

import numpy as np

from .base import BaseEmbedder


class LiteLLMEmbedderWrapper(BaseEmbedder):
    """Wrapper for ccw-litellm LiteLLMEmbedder.

    This wrapper adapts the ccw-litellm LiteLLMEmbedder to the CodexLens
    BaseEmbedder interface, enabling seamless integration with CodexLens
    semantic search functionality.

    Args:
        model: Model identifier for LiteLLM (default: "default")
        **kwargs: Additional arguments passed to LiteLLMEmbedder

    Raises:
        ImportError: If ccw-litellm package is not installed
    """

    def __init__(self, model: str = "default", **kwargs) -> None:
        """Initialize LiteLLM embedder wrapper.

        Args:
            model: Model identifier for LiteLLM (default: "default")
            **kwargs: Additional arguments passed to LiteLLMEmbedder

        Raises:
            ImportError: If ccw-litellm package is not installed
        """
        try:
            from ccw_litellm import LiteLLMEmbedder
            self._embedder = LiteLLMEmbedder(model=model, **kwargs)
        except ImportError as e:
            raise ImportError(
                "ccw-litellm not installed. Install with: pip install ccw-litellm"
            ) from e

    @property
    def embedding_dim(self) -> int:
        """Return embedding dimensions from LiteLLMEmbedder.

        Returns:
            int: Dimension of the embedding vectors.
        """
        return self._embedder.dimensions

    @property
    def model_name(self) -> str:
        """Return model name from LiteLLMEmbedder.

        Returns:
            str: Name or identifier of the underlying model.
        """
        return self._embedder.model_name

    def embed_to_numpy(self, texts: str | Iterable[str]) -> np.ndarray:
        """Embed texts to numpy array using LiteLLMEmbedder.

        Args:
            texts: Single text or iterable of texts to embed.

        Returns:
            numpy.ndarray: Array of shape (n_texts, embedding_dim) containing embeddings.
        """
        if isinstance(texts, str):
            texts = [texts]
        else:
            texts = list(texts)
        return self._embedder.embed(texts)
