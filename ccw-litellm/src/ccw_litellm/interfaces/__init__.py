"""Abstract interfaces for ccw-litellm."""

from __future__ import annotations

from .embedder import AbstractEmbedder
from .llm import AbstractLLMClient, ChatMessage, LLMResponse

__all__ = [
    "AbstractEmbedder",
    "AbstractLLMClient",
    "ChatMessage",
    "LLMResponse",
]

