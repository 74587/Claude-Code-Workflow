"""Tests for embedder cache concurrency."""

from __future__ import annotations

import threading
import time

import pytest

import codexlens.semantic.embedder as embedder_module


def _patch_embedder_for_unit_tests(monkeypatch: pytest.MonkeyPatch) -> None:
    """Make get_embedder() tests deterministic and fast (no model downloads)."""

    monkeypatch.setattr(embedder_module, "SEMANTIC_AVAILABLE", True)
    monkeypatch.setattr(embedder_module, "get_optimal_providers", lambda *args, **kwargs: [])
    monkeypatch.setattr(embedder_module, "is_gpu_available", lambda: False)
    monkeypatch.setattr(embedder_module.Embedder, "_load_model", lambda self: None)


def test_embedder_instances_are_cached_and_reused(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_embedder_for_unit_tests(monkeypatch)
    embedder_module.clear_embedder_cache()

    first = embedder_module.get_embedder(profile="code", use_gpu=False)
    second = embedder_module.get_embedder(profile="code", use_gpu=False)

    assert first is second


def test_concurrent_cache_access(monkeypatch: pytest.MonkeyPatch) -> None:
    _patch_embedder_for_unit_tests(monkeypatch)
    embedder_module.clear_embedder_cache()

    profiles = ["fast", "code", "balanced", "multilingual"]
    for profile in profiles:
        embedder_module.get_embedder(profile=profile, use_gpu=False)

    errors: list[BaseException] = []
    errors_lock = threading.Lock()

    def record_error(err: BaseException) -> None:
        with errors_lock:
            errors.append(err)

    worker_count = 20
    start_barrier = threading.Barrier(worker_count + 1)
    stop_at = time.monotonic() + 1.0

    def clear_worker() -> None:
        try:
            start_barrier.wait()
            while time.monotonic() < stop_at:
                embedder_module.clear_embedder_cache()
                time.sleep(0)
        except BaseException as err:
            record_error(err)

    def access_worker(profile: str) -> None:
        try:
            start_barrier.wait()
            while time.monotonic() < stop_at:
                embedder_module.get_embedder(profile=profile, use_gpu=False)
        except BaseException as err:
            record_error(err)

    threads: list[threading.Thread] = [
        threading.Thread(target=clear_worker, name="clear-embedder-cache"),
    ]
    for idx in range(worker_count):
        threads.append(
            threading.Thread(
                target=access_worker,
                name=f"get-embedder-{idx}",
                args=(profiles[idx % len(profiles)],),
            )
        )

    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=10)

    assert not errors, f"Unexpected errors during concurrent access: {errors!r}"
