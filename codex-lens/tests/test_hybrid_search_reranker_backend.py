"""Tests for HybridSearchEngine reranker backend selection."""

from __future__ import annotations

import pytest

from codexlens.config import Config
from codexlens.search.hybrid_search import HybridSearchEngine


def test_get_cross_encoder_reranker_uses_factory_backend_legacy(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    calls: dict[str, object] = {}

    def fake_check_reranker_available(backend: str):
        calls["check_backend"] = backend
        return True, None

    sentinel = object()

    def fake_get_reranker(*, backend: str, model_name=None, device=None, **kwargs):
        calls["get_args"] = {
            "backend": backend,
            "model_name": model_name,
            "device": device,
            "kwargs": kwargs,
        }
        return sentinel

    monkeypatch.setattr(
        "codexlens.semantic.reranker.check_reranker_available",
        fake_check_reranker_available,
    )
    monkeypatch.setattr(
        "codexlens.semantic.reranker.get_reranker",
        fake_get_reranker,
    )

    config = Config(
        data_dir=tmp_path / "legacy",
        enable_reranking=True,
        enable_cross_encoder_rerank=True,
        reranker_backend="legacy",
        reranker_model="dummy-model",
    )
    engine = HybridSearchEngine(config=config)

    reranker = engine._get_cross_encoder_reranker()
    assert reranker is sentinel
    assert calls["check_backend"] == "legacy"

    get_args = calls["get_args"]
    assert isinstance(get_args, dict)
    assert get_args["backend"] == "legacy"
    assert get_args["model_name"] == "dummy-model"
    assert get_args["device"] is None


def test_get_cross_encoder_reranker_uses_factory_backend_onnx_gpu_flag(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    calls: dict[str, object] = {}

    def fake_check_reranker_available(backend: str):
        calls["check_backend"] = backend
        return True, None

    sentinel = object()

    def fake_get_reranker(*, backend: str, model_name=None, device=None, **kwargs):
        calls["get_args"] = {
            "backend": backend,
            "model_name": model_name,
            "device": device,
            "kwargs": kwargs,
        }
        return sentinel

    monkeypatch.setattr(
        "codexlens.semantic.reranker.check_reranker_available",
        fake_check_reranker_available,
    )
    monkeypatch.setattr(
        "codexlens.semantic.reranker.get_reranker",
        fake_get_reranker,
    )

    config = Config(
        data_dir=tmp_path / "onnx",
        enable_reranking=True,
        enable_cross_encoder_rerank=True,
        reranker_backend="onnx",
        embedding_use_gpu=False,
    )
    engine = HybridSearchEngine(config=config)

    reranker = engine._get_cross_encoder_reranker()
    assert reranker is sentinel
    assert calls["check_backend"] == "onnx"

    get_args = calls["get_args"]
    assert isinstance(get_args, dict)
    assert get_args["backend"] == "onnx"
    assert get_args["model_name"] is None
    assert get_args["device"] is None
    assert get_args["kwargs"]["use_gpu"] is False


def test_get_cross_encoder_reranker_returns_none_when_backend_unavailable(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path,
) -> None:
    def fake_check_reranker_available(backend: str):
        return False, "missing deps"

    def fake_get_reranker(*args, **kwargs):
        raise AssertionError("get_reranker should not be called when backend is unavailable")

    monkeypatch.setattr(
        "codexlens.semantic.reranker.check_reranker_available",
        fake_check_reranker_available,
    )
    monkeypatch.setattr(
        "codexlens.semantic.reranker.get_reranker",
        fake_get_reranker,
    )

    config = Config(
        data_dir=tmp_path / "unavailable",
        enable_reranking=True,
        enable_cross_encoder_rerank=True,
        reranker_backend="onnx",
    )
    engine = HybridSearchEngine(config=config)

    assert engine._get_cross_encoder_reranker() is None
