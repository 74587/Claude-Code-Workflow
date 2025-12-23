from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Literal, Sequence


@dataclass(frozen=True, slots=True)
class ChatMessage:
    role: Literal["system", "user", "assistant", "tool"]
    content: str


@dataclass(frozen=True, slots=True)
class LLMResponse:
    content: str
    raw: Any | None = None


class AbstractLLMClient(ABC):
    """LiteLLM-like client interface.

    Implementers only need to provide synchronous methods; async wrappers are
    provided via `asyncio.to_thread`.
    """

    @abstractmethod
    def chat(self, messages: Sequence[ChatMessage], **kwargs: Any) -> LLMResponse:
        """Chat completion for a sequence of messages."""

    @abstractmethod
    def complete(self, prompt: str, **kwargs: Any) -> LLMResponse:
        """Text completion for a prompt."""

    async def achat(self, messages: Sequence[ChatMessage], **kwargs: Any) -> LLMResponse:
        """Async wrapper around `chat` using a worker thread by default."""

        return await asyncio.to_thread(self.chat, messages, **kwargs)

    async def acomplete(self, prompt: str, **kwargs: Any) -> LLMResponse:
        """Async wrapper around `complete` using a worker thread by default."""

        return await asyncio.to_thread(self.complete, prompt, **kwargs)

