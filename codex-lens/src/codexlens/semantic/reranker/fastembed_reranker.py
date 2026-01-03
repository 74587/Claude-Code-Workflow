"""FastEmbed-based reranker backend.

This reranker uses fastembed's TextCrossEncoder for cross-encoder reranking.
FastEmbed is ONNX-based internally but provides a cleaner, unified API.

Install:
    pip install fastembed>=0.4.0
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Sequence

from .base import BaseReranker

logger = logging.getLogger(__name__)


def check_fastembed_reranker_available() -> tuple[bool, str | None]:
    """Check whether fastembed reranker dependencies are available."""
    try:
        import fastembed  # noqa: F401
    except ImportError as exc:  # pragma: no cover - optional dependency
        return (
            False,
            f"fastembed not available: {exc}. Install with: pip install fastembed>=0.4.0",
        )

    try:
        from fastembed.rerank.cross_encoder import TextCrossEncoder  # noqa: F401
    except ImportError as exc:  # pragma: no cover - optional dependency
        return (
            False,
            f"fastembed TextCrossEncoder not available: {exc}. "
            "Upgrade with: pip install fastembed>=0.4.0",
        )

    return True, None


class FastEmbedReranker(BaseReranker):
    """Cross-encoder reranker using fastembed's TextCrossEncoder with lazy loading."""

    DEFAULT_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2"

    # Alternative models supported by fastembed:
    # - "BAAI/bge-reranker-base"
    # - "BAAI/bge-reranker-large"
    # - "cross-encoder/ms-marco-MiniLM-L-6-v2"

    def __init__(
        self,
        model_name: str | None = None,
        *,
        use_gpu: bool = True,
        cache_dir: str | None = None,
        threads: int | None = None,
    ) -> None:
        """Initialize FastEmbed reranker.

        Args:
            model_name: Model identifier. Defaults to Xenova/ms-marco-MiniLM-L-6-v2.
            use_gpu: Whether to use GPU acceleration when available.
            cache_dir: Optional directory for caching downloaded models.
            threads: Optional number of threads for ONNX Runtime.
        """
        self.model_name = (model_name or self.DEFAULT_MODEL).strip()
        if not self.model_name:
            raise ValueError("model_name cannot be blank")

        self.use_gpu = bool(use_gpu)
        self.cache_dir = cache_dir
        self.threads = threads

        self._encoder: Any | None = None
        self._lock = threading.RLock()

    def _load_model(self) -> None:
        """Lazy-load the TextCrossEncoder model."""
        if self._encoder is not None:
            return

        ok, err = check_fastembed_reranker_available()
        if not ok:
            raise ImportError(err)

        with self._lock:
            if self._encoder is not None:
                return

            from fastembed.rerank.cross_encoder import TextCrossEncoder

            # Determine providers based on GPU preference
            providers: list[str] | None = None
            if self.use_gpu:
                try:
                    from ..gpu_support import get_optimal_providers

                    providers = get_optimal_providers(use_gpu=True, with_device_options=False)
                except Exception:
                    # Fallback: let fastembed decide
                    providers = None

            # Build initialization kwargs
            init_kwargs: dict[str, Any] = {}
            if self.cache_dir:
                init_kwargs["cache_dir"] = self.cache_dir
            if self.threads is not None:
                init_kwargs["threads"] = self.threads
            if providers:
                init_kwargs["providers"] = providers

            logger.debug(
                "Loading FastEmbed reranker model: %s (use_gpu=%s)",
                self.model_name,
                self.use_gpu,
            )

            self._encoder = TextCrossEncoder(
                model_name=self.model_name,
                **init_kwargs,
            )

            logger.debug("FastEmbed reranker model loaded successfully")

    @staticmethod
    def _sigmoid(x: float) -> float:
        """Numerically stable sigmoid function."""
        if x < -709:
            return 0.0
        if x > 709:
            return 1.0
        import math
        return 1.0 / (1.0 + math.exp(-x))

    def score_pairs(
        self,
        pairs: Sequence[tuple[str, str]],
        *,
        batch_size: int = 32,
    ) -> list[float]:
        """Score (query, doc) pairs.

        Args:
            pairs: Sequence of (query, doc) string pairs to score.
            batch_size: Batch size for scoring.

        Returns:
            List of scores (one per pair), normalized to [0, 1] range.
        """
        if not pairs:
            return []

        self._load_model()

        if self._encoder is None:  # pragma: no cover - defensive
            return []

        # FastEmbed's TextCrossEncoder.rerank() expects a query and list of documents.
        # For batch scoring of multiple query-doc pairs, we need to process them.
        # Group by query for efficiency when same query appears multiple times.
        query_to_docs: dict[str, list[tuple[int, str]]] = {}
        for idx, (query, doc) in enumerate(pairs):
            if query not in query_to_docs:
                query_to_docs[query] = []
            query_to_docs[query].append((idx, doc))

        # Score each query group
        scores: list[float] = [0.0] * len(pairs)

        for query, indexed_docs in query_to_docs.items():
            docs = [doc for _, doc in indexed_docs]
            indices = [idx for idx, _ in indexed_docs]

            try:
                # TextCrossEncoder.rerank returns raw float scores in same order as input
                raw_scores = list(
                    self._encoder.rerank(
                        query=query,
                        documents=docs,
                        batch_size=batch_size,
                    )
                )

                # Map scores back to original positions and normalize with sigmoid
                for i, raw_score in enumerate(raw_scores):
                    if i < len(indices):
                        original_idx = indices[i]
                        # Normalize score to [0, 1] using stable sigmoid
                        scores[original_idx] = self._sigmoid(float(raw_score))

            except Exception as e:
                logger.warning("FastEmbed rerank failed for query: %s", str(e)[:100])
                # Leave scores as 0.0 for failed queries

        return scores

    def rerank(
        self,
        query: str,
        documents: Sequence[str],
        *,
        top_k: int | None = None,
        batch_size: int = 32,
    ) -> list[tuple[float, str, int]]:
        """Rerank documents for a single query.

        This is a convenience method that provides results in ranked order.

        Args:
            query: The query string.
            documents: List of documents to rerank.
            top_k: Return only top K results. None returns all.
            batch_size: Batch size for scoring.

        Returns:
            List of (score, document, original_index) tuples, sorted by score descending.
        """
        if not documents:
            return []

        self._load_model()

        if self._encoder is None:  # pragma: no cover - defensive
            return []

        try:
            # TextCrossEncoder.rerank returns raw float scores in same order as input
            raw_scores = list(
                self._encoder.rerank(
                    query=query,
                    documents=list(documents),
                    batch_size=batch_size,
                )
            )

            # Convert to our format: (normalized_score, document, original_index)
            ranked = []
            for idx, raw_score in enumerate(raw_scores):
                if idx < len(documents):
                    # Normalize score to [0, 1] using stable sigmoid
                    normalized = self._sigmoid(float(raw_score))
                    ranked.append((normalized, documents[idx], idx))

            # Sort by score descending
            ranked.sort(key=lambda x: x[0], reverse=True)

            if top_k is not None and top_k > 0:
                ranked = ranked[:top_k]

            return ranked

        except Exception as e:
            logger.warning("FastEmbed rerank failed: %s", str(e)[:100])
            return []
