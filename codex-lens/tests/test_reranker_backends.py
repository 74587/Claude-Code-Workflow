"""Mocked smoke tests for all reranker backends."""

from __future__ import annotations

import sys
import types
from dataclasses import dataclass

import pytest


def test_reranker_backend_legacy_scores_pairs(monkeypatch: pytest.MonkeyPatch) -> None:
    from codexlens.semantic.reranker import legacy as legacy_module

    class DummyCrossEncoder:
        def __init__(self, model_name: str, *, device: str | None = None) -> None:
            self.model_name = model_name
            self.device = device
            self.calls: list[dict[str, object]] = []

        def predict(self, pairs: list[tuple[str, str]], *, batch_size: int = 32) -> list[float]:
            self.calls.append({"pairs": list(pairs), "batch_size": int(batch_size)})
            return [0.5 for _ in pairs]

    monkeypatch.setattr(legacy_module, "_CrossEncoder", DummyCrossEncoder)
    monkeypatch.setattr(legacy_module, "CROSS_ENCODER_AVAILABLE", True)
    monkeypatch.setattr(legacy_module, "_import_error", None)

    reranker = legacy_module.CrossEncoderReranker(model_name="dummy-model", device="cpu")
    scores = reranker.score_pairs([("q", "d1"), ("q", "d2")], batch_size=0)
    assert scores == pytest.approx([0.5, 0.5])


def test_reranker_backend_onnx_availability_check(monkeypatch: pytest.MonkeyPatch) -> None:
    from codexlens.semantic.reranker.onnx_reranker import check_onnx_reranker_available

    dummy_numpy = types.ModuleType("numpy")
    dummy_onnxruntime = types.ModuleType("onnxruntime")

    dummy_optimum = types.ModuleType("optimum")
    dummy_optimum.__path__ = []  # Mark as package for submodule imports.
    dummy_optimum_ort = types.ModuleType("optimum.onnxruntime")
    dummy_optimum_ort.ORTModelForSequenceClassification = object()

    dummy_transformers = types.ModuleType("transformers")
    dummy_transformers.AutoTokenizer = object()

    monkeypatch.setitem(sys.modules, "numpy", dummy_numpy)
    monkeypatch.setitem(sys.modules, "onnxruntime", dummy_onnxruntime)
    monkeypatch.setitem(sys.modules, "optimum", dummy_optimum)
    monkeypatch.setitem(sys.modules, "optimum.onnxruntime", dummy_optimum_ort)
    monkeypatch.setitem(sys.modules, "transformers", dummy_transformers)

    ok, err = check_onnx_reranker_available()
    assert ok is True
    assert err is None


def test_reranker_backend_api_constructs_with_dummy_httpx(monkeypatch: pytest.MonkeyPatch) -> None:
    from codexlens.semantic.reranker.api_reranker import APIReranker

    created: list[object] = []

    class DummyClient:
        def __init__(
            self,
            *,
            base_url: str | None = None,
            headers: dict[str, str] | None = None,
            timeout: float | None = None,
        ) -> None:
            self.base_url = base_url
            self.headers = headers or {}
            self.timeout = timeout
            self.closed = False
            created.append(self)

        def close(self) -> None:
            self.closed = True

    dummy_httpx = types.ModuleType("httpx")
    dummy_httpx.Client = DummyClient
    monkeypatch.setitem(sys.modules, "httpx", dummy_httpx)

    reranker = APIReranker(api_key="k", provider="siliconflow")
    assert reranker.provider == "siliconflow"
    assert len(created) == 1
    assert created[0].headers["Authorization"] == "Bearer k"
    reranker.close()
    assert created[0].closed is True


def test_reranker_backend_litellm_scores_pairs(monkeypatch: pytest.MonkeyPatch) -> None:
    from codexlens.semantic.reranker.litellm_reranker import LiteLLMReranker

    @dataclass(frozen=True, slots=True)
    class ChatMessage:
        role: str
        content: str

    class DummyLiteLLMClient:
        def __init__(self, model: str = "default", **_kwargs: object) -> None:
            self.model = model

        def chat(self, _messages: list[ChatMessage]) -> object:
            return types.SimpleNamespace(content="0.5")

    dummy_litellm = types.ModuleType("ccw_litellm")
    dummy_litellm.ChatMessage = ChatMessage
    dummy_litellm.LiteLLMClient = DummyLiteLLMClient
    monkeypatch.setitem(sys.modules, "ccw_litellm", dummy_litellm)

    reranker = LiteLLMReranker(model="dummy")
    assert reranker.score_pairs([("q", "d")]) == pytest.approx([0.5])

