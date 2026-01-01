"""Tests for reranker factory and availability checks."""

from __future__ import annotations

import builtins
import math
import sys
import types

import pytest

from codexlens.semantic.reranker import (
    BaseReranker,
    ONNXReranker,
    check_reranker_available,
    get_reranker,
)
from codexlens.semantic.reranker import legacy as legacy_module


def test_public_imports_work() -> None:
    from codexlens.semantic.reranker import BaseReranker as ImportedBaseReranker
    from codexlens.semantic.reranker import get_reranker as imported_get_reranker

    assert ImportedBaseReranker is BaseReranker
    assert imported_get_reranker is get_reranker


def test_base_reranker_is_abstract() -> None:
    with pytest.raises(TypeError):
        BaseReranker()  # type: ignore[abstract]


def test_check_reranker_available_invalid_backend() -> None:
    ok, err = check_reranker_available("nope")
    assert ok is False
    assert "Invalid reranker backend" in (err or "")


def test_get_reranker_invalid_backend_raises_value_error() -> None:
    with pytest.raises(ValueError, match="Unknown backend"):
        get_reranker("nope")


def test_get_reranker_legacy_missing_dependency_raises_import_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(legacy_module, "CROSS_ENCODER_AVAILABLE", False)
    monkeypatch.setattr(legacy_module, "_import_error", "missing sentence-transformers")

    with pytest.raises(ImportError, match="missing sentence-transformers"):
        get_reranker(backend="legacy", model_name="dummy-model")


def test_get_reranker_legacy_returns_cross_encoder_reranker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class DummyCrossEncoder:
        def __init__(self, model_name: str, *, device: str | None = None) -> None:
            self.model_name = model_name
            self.device = device
            self.last_batch_size: int | None = None

        def predict(self, pairs: list[tuple[str, str]], *, batch_size: int = 32) -> list[float]:
            self.last_batch_size = int(batch_size)
            return [0.5 for _ in pairs]

    monkeypatch.setattr(legacy_module, "_CrossEncoder", DummyCrossEncoder)
    monkeypatch.setattr(legacy_module, "CROSS_ENCODER_AVAILABLE", True)
    monkeypatch.setattr(legacy_module, "_import_error", None)

    reranker = get_reranker(backend="  LEGACY  ", model_name="dummy-model", device="cpu")
    assert isinstance(reranker, legacy_module.CrossEncoderReranker)

    assert reranker.score_pairs([]) == []

    scores = reranker.score_pairs([("q", "d1"), ("q", "d2")], batch_size=0)
    assert scores == pytest.approx([0.5, 0.5])
    assert reranker._model is not None
    assert reranker._model.last_batch_size == 32


def test_check_reranker_available_onnx_missing_deps(monkeypatch: pytest.MonkeyPatch) -> None:
    real_import = builtins.__import__

    def fake_import(name: str, globals=None, locals=None, fromlist=(), level: int = 0):
        if name == "onnxruntime":
            raise ImportError("no onnxruntime")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    ok, err = check_reranker_available("onnx")
    assert ok is False
    assert "onnxruntime not available" in (err or "")


def test_check_reranker_available_onnx_deps_present(monkeypatch: pytest.MonkeyPatch) -> None:
    dummy_onnxruntime = types.ModuleType("onnxruntime")
    dummy_optimum = types.ModuleType("optimum")
    dummy_optimum.__path__ = []  # Mark as package for submodule imports.
    dummy_optimum_ort = types.ModuleType("optimum.onnxruntime")
    dummy_optimum_ort.ORTModelForSequenceClassification = object()

    dummy_transformers = types.ModuleType("transformers")
    dummy_transformers.AutoTokenizer = object()

    monkeypatch.setitem(sys.modules, "onnxruntime", dummy_onnxruntime)
    monkeypatch.setitem(sys.modules, "optimum", dummy_optimum)
    monkeypatch.setitem(sys.modules, "optimum.onnxruntime", dummy_optimum_ort)
    monkeypatch.setitem(sys.modules, "transformers", dummy_transformers)

    ok, err = check_reranker_available("onnx")
    assert ok is True
    assert err is None


def test_check_reranker_available_litellm_missing_deps(monkeypatch: pytest.MonkeyPatch) -> None:
    real_import = builtins.__import__

    def fake_import(name: str, globals=None, locals=None, fromlist=(), level: int = 0):
        if name == "ccw_litellm":
            raise ImportError("no ccw-litellm")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    ok, err = check_reranker_available("litellm")
    assert ok is False
    assert "ccw-litellm not available" in (err or "")


def test_check_reranker_available_litellm_deps_present(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    dummy_litellm = types.ModuleType("ccw_litellm")
    monkeypatch.setitem(sys.modules, "ccw_litellm", dummy_litellm)

    ok, err = check_reranker_available("litellm")
    assert ok is True
    assert err is None


def test_check_reranker_available_api_missing_deps(monkeypatch: pytest.MonkeyPatch) -> None:
    real_import = builtins.__import__

    def fake_import(name: str, globals=None, locals=None, fromlist=(), level: int = 0):
        if name == "httpx":
            raise ImportError("no httpx")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    ok, err = check_reranker_available("api")
    assert ok is False
    assert "httpx not available" in (err or "")


def test_check_reranker_available_api_deps_present(monkeypatch: pytest.MonkeyPatch) -> None:
    dummy_httpx = types.ModuleType("httpx")
    monkeypatch.setitem(sys.modules, "httpx", dummy_httpx)

    ok, err = check_reranker_available("api")
    assert ok is True
    assert err is None


def test_get_reranker_litellm_returns_litellm_reranker(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    from dataclasses import dataclass

    @dataclass(frozen=True, slots=True)
    class ChatMessage:
        role: str
        content: str

    class DummyLiteLLMClient:
        def __init__(self, model: str = "default", **kwargs) -> None:
            self.model = model
            self.kwargs = kwargs

        def chat(self, messages, **kwargs):
            return types.SimpleNamespace(content="0.5")

    dummy_litellm = types.ModuleType("ccw_litellm")
    dummy_litellm.ChatMessage = ChatMessage
    dummy_litellm.LiteLLMClient = DummyLiteLLMClient
    monkeypatch.setitem(sys.modules, "ccw_litellm", dummy_litellm)

    reranker = get_reranker(backend="litellm", model_name="dummy-model")

    from codexlens.semantic.reranker.litellm_reranker import LiteLLMReranker

    assert isinstance(reranker, LiteLLMReranker)
    assert reranker.score_pairs([("q", "d")]) == pytest.approx([0.5])


def test_get_reranker_onnx_raises_import_error_with_dependency_hint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    real_import = builtins.__import__

    def fake_import(name: str, globals=None, locals=None, fromlist=(), level: int = 0):
        if name == "onnxruntime":
            raise ImportError("no onnxruntime")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)

    with pytest.raises(ImportError) as exc:
        get_reranker(backend="onnx", model_name="any")

    assert "onnxruntime" in str(exc.value)


def test_get_reranker_default_backend_is_onnx(monkeypatch: pytest.MonkeyPatch) -> None:
    dummy_onnxruntime = types.ModuleType("onnxruntime")
    dummy_optimum = types.ModuleType("optimum")
    dummy_optimum.__path__ = []  # Mark as package for submodule imports.
    dummy_optimum_ort = types.ModuleType("optimum.onnxruntime")
    dummy_optimum_ort.ORTModelForSequenceClassification = object()

    dummy_transformers = types.ModuleType("transformers")
    dummy_transformers.AutoTokenizer = object()

    monkeypatch.setitem(sys.modules, "onnxruntime", dummy_onnxruntime)
    monkeypatch.setitem(sys.modules, "optimum", dummy_optimum)
    monkeypatch.setitem(sys.modules, "optimum.onnxruntime", dummy_optimum_ort)
    monkeypatch.setitem(sys.modules, "transformers", dummy_transformers)

    reranker = get_reranker()
    assert isinstance(reranker, ONNXReranker)


def test_onnx_reranker_scores_pairs_with_sigmoid_normalization(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import numpy as np

    dummy_onnxruntime = types.ModuleType("onnxruntime")

    dummy_optimum = types.ModuleType("optimum")
    dummy_optimum.__path__ = []  # Mark as package for submodule imports.
    dummy_optimum_ort = types.ModuleType("optimum.onnxruntime")

    class DummyModelOutput:
        def __init__(self, logits: np.ndarray) -> None:
            self.logits = logits

    class DummyModel:
        input_names = ["input_ids", "attention_mask"]

        def __init__(self) -> None:
            self.calls: list[int] = []
            self._next_logit = 0

        def __call__(self, **inputs):
            batch = int(inputs["input_ids"].shape[0])
            start = self._next_logit
            self._next_logit += batch
            self.calls.append(batch)
            logits = np.arange(start, start + batch, dtype=np.float32).reshape(batch, 1)
            return DummyModelOutput(logits=logits)

    class DummyORTModelForSequenceClassification:
        @classmethod
        def from_pretrained(cls, model_name: str, providers=None, **kwargs):
            _ = model_name, providers, kwargs
            return DummyModel()

    dummy_optimum_ort.ORTModelForSequenceClassification = DummyORTModelForSequenceClassification

    dummy_transformers = types.ModuleType("transformers")

    class DummyAutoTokenizer:
        model_max_length = 512

        @classmethod
        def from_pretrained(cls, model_name: str, **kwargs):
            _ = model_name, kwargs
            return cls()

        def __call__(self, *, text, text_pair, return_tensors, **kwargs):
            _ = text_pair, kwargs
            assert return_tensors == "np"
            batch = len(text)
            # Include token_type_ids to ensure input filtering is exercised.
            return {
                "input_ids": np.zeros((batch, 4), dtype=np.int64),
                "attention_mask": np.ones((batch, 4), dtype=np.int64),
                "token_type_ids": np.zeros((batch, 4), dtype=np.int64),
            }

    dummy_transformers.AutoTokenizer = DummyAutoTokenizer

    monkeypatch.setitem(sys.modules, "onnxruntime", dummy_onnxruntime)
    monkeypatch.setitem(sys.modules, "optimum", dummy_optimum)
    monkeypatch.setitem(sys.modules, "optimum.onnxruntime", dummy_optimum_ort)
    monkeypatch.setitem(sys.modules, "transformers", dummy_transformers)

    reranker = get_reranker(backend="onnx", model_name="dummy-model", use_gpu=False)
    assert isinstance(reranker, ONNXReranker)
    assert reranker._model is None

    pairs = [("q", f"d{idx}") for idx in range(5)]
    scores = reranker.score_pairs(pairs, batch_size=2)

    assert reranker._model is not None
    assert reranker._model.calls == [2, 2, 1]
    assert len(scores) == len(pairs)
    assert all(0.0 <= s <= 1.0 for s in scores)

    expected = [1.0 / (1.0 + math.exp(-float(i))) for i in range(len(pairs))]
    assert scores == pytest.approx(expected, rel=1e-6, abs=1e-6)
