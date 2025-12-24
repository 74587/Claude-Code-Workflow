"""LiteLLM embedder implementation for text embeddings."""

from __future__ import annotations

import logging
from typing import Any, Sequence

import litellm
import numpy as np
from numpy.typing import NDArray

from ..config import LiteLLMConfig, get_config
from ..interfaces.embedder import AbstractEmbedder

logger = logging.getLogger(__name__)


class LiteLLMEmbedder(AbstractEmbedder):
    """LiteLLM embedder implementation.

    Supports multiple embedding providers (OpenAI, etc.) through LiteLLM's unified interface.

    Example:
        embedder = LiteLLMEmbedder(model="default")
        vectors = embedder.embed(["Hello world", "Another text"])
        print(vectors.shape)  # (2, 1536)
    """

    def __init__(
        self,
        model: str = "default",
        config: LiteLLMConfig | None = None,
        **litellm_kwargs: Any,
    ) -> None:
        """Initialize LiteLLM embedder.

        Args:
            model: Model name from configuration (default: "default")
            config: Configuration instance (default: use global config)
            **litellm_kwargs: Additional arguments to pass to litellm.embedding()
        """
        self._config = config or get_config()
        self._model_name = model
        self._litellm_kwargs = litellm_kwargs

        # Get embedding model configuration
        try:
            self._model_config = self._config.get_embedding_model(model)
        except ValueError as e:
            logger.error(f"Failed to get embedding model configuration: {e}")
            raise

        # Get provider configuration
        try:
            self._provider_config = self._config.get_provider(self._model_config.provider)
        except ValueError as e:
            logger.error(f"Failed to get provider configuration: {e}")
            raise

        # Set up LiteLLM environment
        self._setup_litellm()

    def _setup_litellm(self) -> None:
        """Configure LiteLLM with provider settings."""
        provider = self._model_config.provider

        # Set API key
        if self._provider_config.api_key:
            litellm.api_key = self._provider_config.api_key
            # Also set environment-specific keys
            if provider == "openai":
                litellm.openai_key = self._provider_config.api_key
            elif provider == "anthropic":
                litellm.anthropic_key = self._provider_config.api_key

        # Set API base
        if self._provider_config.api_base:
            litellm.api_base = self._provider_config.api_base

    def _format_model_name(self) -> str:
        """Format model name for LiteLLM.

        Returns:
            Formatted model name (e.g., "openai/text-embedding-3-small")
        """
        provider = self._model_config.provider
        model = self._model_config.model

        # For some providers, LiteLLM expects explicit prefix
        if provider in ["azure", "vertex_ai", "bedrock"]:
            return f"{provider}/{model}"

        # For providers with custom api_base (OpenAI-compatible endpoints),
        # use openai/ prefix to tell LiteLLM to use OpenAI API format
        if self._provider_config.api_base and provider not in ["openai", "anthropic"]:
            return f"openai/{model}"

        return model

    @property
    def dimensions(self) -> int:
        """Embedding vector size."""
        return self._model_config.dimensions

    def embed(
        self,
        texts: str | Sequence[str],
        *,
        batch_size: int | None = None,
        **kwargs: Any,
    ) -> NDArray[np.floating]:
        """Embed one or more texts.

        Args:
            texts: Single text or sequence of texts
            batch_size: Batch size for processing (currently unused, LiteLLM handles batching)
            **kwargs: Additional arguments for litellm.embedding()

        Returns:
            A numpy array of shape (n_texts, dimensions).

        Raises:
            Exception: If LiteLLM embedding fails
        """
        # Normalize input to list
        if isinstance(texts, str):
            text_list = [texts]
            single_input = True
        else:
            text_list = list(texts)
            single_input = False

        if not text_list:
            # Return empty array with correct shape
            return np.empty((0, self.dimensions), dtype=np.float32)

        # Merge kwargs
        embedding_kwargs = {**self._litellm_kwargs, **kwargs}

        try:
            # For OpenAI-compatible endpoints, ensure encoding_format is set
            if self._provider_config.api_base and "encoding_format" not in embedding_kwargs:
                embedding_kwargs["encoding_format"] = "float"

            # Call LiteLLM embedding
            response = litellm.embedding(
                model=self._format_model_name(),
                input=text_list,
                **embedding_kwargs,
            )

            # Extract embeddings
            embeddings = [item["embedding"] for item in response.data]

            # Convert to numpy array
            result = np.array(embeddings, dtype=np.float32)

            # Validate dimensions
            if result.shape[1] != self.dimensions:
                logger.warning(
                    f"Expected {self.dimensions} dimensions, got {result.shape[1]}. "
                    f"Configuration may be incorrect."
                )

            return result

        except Exception as e:
            logger.error(f"LiteLLM embedding failed: {e}")
            raise

    @property
    def model_name(self) -> str:
        """Get configured model name."""
        return self._model_name

    @property
    def provider(self) -> str:
        """Get configured provider name."""
        return self._model_config.provider
