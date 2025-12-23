from __future__ import annotations

import asyncio
from typing import Any, Sequence

import numpy as np

from ccw_litellm.interfaces import AbstractEmbedder, AbstractLLMClient, ChatMessage, LLMResponse


class _DummyEmbedder(AbstractEmbedder):
    @property
    def dimensions(self) -> int:
        return 3

    def embed(
        self,
        texts: str | Sequence[str],
        *,
        batch_size: int | None = None,
        **kwargs: Any,
    ) -> np.ndarray:
        if isinstance(texts, str):
            texts = [texts]
        _ = batch_size
        _ = kwargs
        return np.zeros((len(texts), self.dimensions), dtype=np.float32)


class _DummyLLM(AbstractLLMClient):
    def chat(self, messages: Sequence[ChatMessage], **kwargs: Any) -> LLMResponse:
        _ = kwargs
        return LLMResponse(content="".join(m.content for m in messages))

    def complete(self, prompt: str, **kwargs: Any) -> LLMResponse:
        _ = kwargs
        return LLMResponse(content=prompt)


def test_embed_sync_shape_and_dtype() -> None:
    emb = _DummyEmbedder()
    out = emb.embed(["a", "b"])
    assert out.shape == (2, 3)
    assert out.dtype == np.float32


def test_embed_async_wrapper() -> None:
    emb = _DummyEmbedder()
    out = asyncio.run(emb.aembed("x"))
    assert out.shape == (1, 3)


def test_llm_sync() -> None:
    llm = _DummyLLM()
    out = llm.chat([ChatMessage(role="user", content="hi")])
    assert out == LLMResponse(content="hi")


def test_llm_async_wrappers() -> None:
    llm = _DummyLLM()
    out1 = asyncio.run(llm.achat([ChatMessage(role="user", content="a")]))
    out2 = asyncio.run(llm.acomplete("b"))
    assert out1.content == "a"
    assert out2.content == "b"
