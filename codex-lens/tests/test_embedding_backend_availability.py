"""Tests for embedding backend availability checks.

These tests validate the logic used to decide whether embeddings generation
should run for a given backend (fastembed vs. litellm).
"""

import pytest


def test_is_embedding_backend_available_invalid_backend(monkeypatch):
    import codexlens.semantic as semantic

    ok, err = semantic.is_embedding_backend_available("nope")
    assert ok is False
    assert "Invalid embedding backend" in (err or "")


def test_is_embedding_backend_available_fastembed_true(monkeypatch):
    import codexlens.semantic as semantic

    monkeypatch.setattr(semantic, "SEMANTIC_AVAILABLE", True)
    ok, err = semantic.is_embedding_backend_available("fastembed")
    assert ok is True
    assert err is None


def test_is_embedding_backend_available_fastembed_false(monkeypatch):
    import codexlens.semantic as semantic

    monkeypatch.setattr(semantic, "SEMANTIC_AVAILABLE", False)
    monkeypatch.setattr(semantic, "_import_error", "fastembed missing")
    ok, err = semantic.is_embedding_backend_available("fastembed")
    assert ok is False
    assert err == "fastembed missing"


def test_is_embedding_backend_available_litellm_true(monkeypatch):
    import codexlens.semantic as semantic

    monkeypatch.setattr(semantic, "LITELLM_AVAILABLE", True)
    ok, err = semantic.is_embedding_backend_available("litellm")
    assert ok is True
    assert err is None


def test_is_embedding_backend_available_litellm_false(monkeypatch):
    import codexlens.semantic as semantic

    monkeypatch.setattr(semantic, "LITELLM_AVAILABLE", False)
    ok, err = semantic.is_embedding_backend_available("litellm")
    assert ok is False
    assert "ccw-litellm not available" in (err or "")


def test_generate_embeddings_uses_backend_availability_gate(monkeypatch, tmp_path):
    from codexlens.cli import embedding_manager

    monkeypatch.setattr(
        embedding_manager,
        "is_embedding_backend_available",
        lambda _backend: (False, "blocked"),
    )

    result = embedding_manager.generate_embeddings(tmp_path / "_index.db", embedding_backend="litellm")
    assert result["success"] is False
    assert result["error"] == "blocked"

