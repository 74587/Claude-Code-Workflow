from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from codexlens.config import Config
from codexlens.entities import SearchResult
from codexlens.search.chain_search import ChainSearchEngine


def _engine_with_strategy(name: str) -> ChainSearchEngine:
    cfg = Config.load()
    cfg.staged_clustering_strategy = name
    return ChainSearchEngine(registry=MagicMock(), mapper=MagicMock(), config=cfg)


def test_stage3_strategy_score_skips_embedding(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "codexlens.semantic.factory.get_embedder",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("should not embed")),
    )

    engine = _engine_with_strategy("score")
    expanded = [
        SearchResult(path="D:/p/a.py", score=0.9),
        SearchResult(path="D:/p/a.py", score=0.1),
        SearchResult(path="D:/p/b.py", score=0.8),
        SearchResult(path="D:/p/c.py", score=0.7),
    ]

    reps = engine._stage3_cluster_prune(expanded, target_count=3)
    assert [r.path for r in reps] == ["D:/p/a.py", "D:/p/b.py", "D:/p/c.py"]


def test_stage3_strategy_dir_rr_round_robins_dirs(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "codexlens.semantic.factory.get_embedder",
        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("should not embed")),
    )

    engine = _engine_with_strategy("dir_rr")
    expanded = [
        SearchResult(path="D:/p1/a.py", score=0.99),
        SearchResult(path="D:/p1/b.py", score=0.98),
        SearchResult(path="D:/p2/c.py", score=0.97),
        SearchResult(path="D:/p2/d.py", score=0.96),
        SearchResult(path="D:/p3/e.py", score=0.95),
    ]

    reps = engine._stage3_cluster_prune(expanded, target_count=4)
    assert len(reps) == 4
    assert reps[0].path.endswith("p1/a.py")
    assert reps[1].path.endswith("p2/c.py")
    assert reps[2].path.endswith("p3/e.py")

