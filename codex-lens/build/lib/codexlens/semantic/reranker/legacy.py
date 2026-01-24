"""Legacy sentence-transformers cross-encoder reranker.

Install with: pip install codexlens[reranker-legacy]
"""

from __future__ import annotations

import logging
import threading
from typing import List, Sequence, Tuple

from .base import BaseReranker

logger = logging.getLogger(__name__)

try:
    from sentence_transformers import CrossEncoder as _CrossEncoder

    CROSS_ENCODER_AVAILABLE = True
    _import_error: str | None = None
except ImportError as exc:  # pragma: no cover - optional dependency
    _CrossEncoder = None  # type: ignore[assignment]
    CROSS_ENCODER_AVAILABLE = False
    _import_error = str(exc)


def check_cross_encoder_available() -> tuple[bool, str | None]:
    if CROSS_ENCODER_AVAILABLE:
        return True, None
    return (
        False,
        _import_error
        or "sentence-transformers not available. Install with: pip install codexlens[reranker-legacy]",
    )


class CrossEncoderReranker(BaseReranker):
    """Cross-encoder reranker with lazy model loading."""

    def __init__(self, model_name: str, *, device: str | None = None) -> None:
        self.model_name = (model_name or "").strip()
        if not self.model_name:
            raise ValueError("model_name cannot be blank")

        self.device = (device or "").strip() or None
        self._model = None
        self._lock = threading.RLock()

    def _load_model(self) -> None:
        if self._model is not None:
            return

        ok, err = check_cross_encoder_available()
        if not ok:
            raise ImportError(err)

        with self._lock:
            if self._model is not None:
                return

            try:
                if self.device:
                    self._model = _CrossEncoder(self.model_name, device=self.device)  # type: ignore[misc]
                else:
                    self._model = _CrossEncoder(self.model_name)  # type: ignore[misc]
            except Exception as exc:
                logger.debug("Failed to load cross-encoder model %s: %s", self.model_name, exc)
                raise

    def score_pairs(
        self,
        pairs: Sequence[Tuple[str, str]],
        *,
        batch_size: int = 32,
    ) -> List[float]:
        """Score (query, doc) pairs using the cross-encoder.

        Returns:
            List of scores (one per pair) in the model's native scale (usually logits).
        """
        if not pairs:
            return []

        self._load_model()

        if self._model is None:  # pragma: no cover - defensive
            return []

        bs = int(batch_size) if batch_size and int(batch_size) > 0 else 32
        scores = self._model.predict(list(pairs), batch_size=bs)  # type: ignore[union-attr]
        return [float(s) for s in scores]
