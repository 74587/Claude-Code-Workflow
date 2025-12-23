"""ccw-litellm package.

This package provides a small, stable interface layer around LiteLLM to share
between the ccw and codex-lens projects.
"""

from __future__ import annotations

from .clients import LiteLLMClient, LiteLLMEmbedder
from .config import (
    EmbeddingModelConfig,
    LiteLLMConfig,
    LLMModelConfig,
    ProviderConfig,
    get_config,
    load_config,
    reset_config,
)
from .interfaces import (
    AbstractEmbedder,
    AbstractLLMClient,
    ChatMessage,
    LLMResponse,
)

__version__ = "0.1.0"

__all__ = [
    "__version__",
    # Abstract interfaces
    "AbstractEmbedder",
    "AbstractLLMClient",
    "ChatMessage",
    "LLMResponse",
    # Client implementations
    "LiteLLMClient",
    "LiteLLMEmbedder",
    # Configuration
    "LiteLLMConfig",
    "ProviderConfig",
    "LLMModelConfig",
    "EmbeddingModelConfig",
    "load_config",
    "get_config",
    "reset_config",
]

