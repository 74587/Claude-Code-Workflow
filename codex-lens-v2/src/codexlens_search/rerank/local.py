from __future__ import annotations

from codexlens_search.config import Config
from .base import BaseReranker


class FastEmbedReranker(BaseReranker):
    """Local reranker backed by fastembed TextCrossEncoder."""

    def __init__(self, config: Config) -> None:
        self._config = config
        self._model = None

    def _load(self) -> None:
        if self._model is None:
            from fastembed.rerank.cross_encoder import TextCrossEncoder
            self._model = TextCrossEncoder(model_name=self._config.reranker_model)

    def score_pairs(self, query: str, documents: list[str]) -> list[float]:
        self._load()
        results = list(self._model.rerank(query, documents))
        scores = [0.0] * len(documents)
        for r in results:
            scores[r.index] = float(r.score)
        return scores
