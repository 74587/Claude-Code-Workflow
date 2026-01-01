"""Tests for LiteLLMReranker (LLM-based reranking)."""

from __future__ import annotations

import sys
import types
from dataclasses import dataclass

import pytest

from codexlens.semantic.reranker.litellm_reranker import LiteLLMReranker


def _install_dummy_ccw_litellm(
    monkeypatch: pytest.MonkeyPatch, *, responses: list[str]
) -> None:
    @dataclass(frozen=True, slots=True)
    class ChatMessage:
        role: str
        content: str

    class LiteLLMClient:
        def __init__(self, model: str = "default", **kwargs) -> None:
            self.model = model
            self.kwargs = kwargs
            self._responses = list(responses)
            self.calls: list[list[ChatMessage]] = []

        def chat(self, messages, **kwargs):
            self.calls.append(list(messages))
            content = self._responses.pop(0) if self._responses else ""
            return types.SimpleNamespace(content=content)

    dummy = types.ModuleType("ccw_litellm")
    dummy.ChatMessage = ChatMessage
    dummy.LiteLLMClient = LiteLLMClient
    monkeypatch.setitem(sys.modules, "ccw_litellm", dummy)


def test_score_pairs_parses_numbers_and_normalizes_scales(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_dummy_ccw_litellm(monkeypatch, responses=["0.73", "7", "80"])

    reranker = LiteLLMReranker(model="dummy")
    scores = reranker.score_pairs([("q", "d1"), ("q", "d2"), ("q", "d3")])
    assert scores == pytest.approx([0.73, 0.7, 0.8])


def test_score_pairs_parses_json_score_field(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_dummy_ccw_litellm(monkeypatch, responses=['{"score": 0.42}'])

    reranker = LiteLLMReranker(model="dummy")
    scores = reranker.score_pairs([("q", "d")])
    assert scores == pytest.approx([0.42])


def test_score_pairs_uses_default_score_on_parse_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _install_dummy_ccw_litellm(monkeypatch, responses=["N/A"])

    reranker = LiteLLMReranker(model="dummy", default_score=0.123)
    scores = reranker.score_pairs([("q", "d")])
    assert scores == pytest.approx([0.123])


def test_rate_limiting_sleeps_between_requests(monkeypatch: pytest.MonkeyPatch) -> None:
    _install_dummy_ccw_litellm(monkeypatch, responses=["0.1", "0.2"])

    reranker = LiteLLMReranker(model="dummy", min_interval_seconds=1.0)

    import codexlens.semantic.reranker.litellm_reranker as litellm_reranker_module

    sleeps: list[float] = []
    times = iter([100.0, 100.0, 100.1, 100.1])

    monkeypatch.setattr(litellm_reranker_module.time, "monotonic", lambda: next(times))
    monkeypatch.setattr(
        litellm_reranker_module.time, "sleep", lambda seconds: sleeps.append(seconds)
    )

    _ = reranker.score_pairs([("q", "d1"), ("q", "d2")])
    assert sleeps == pytest.approx([0.9])

