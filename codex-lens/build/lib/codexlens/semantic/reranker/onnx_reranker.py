"""Optimum + ONNX Runtime reranker backend.

This reranker uses Hugging Face Optimum's ONNXRuntime backend for sequence
classification models. It is designed to run without requiring PyTorch at
runtime by using numpy tensors and ONNX Runtime execution providers.

Install (CPU):
    pip install onnxruntime optimum[onnxruntime] transformers
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Iterable, Sequence

from .base import BaseReranker

logger = logging.getLogger(__name__)


def check_onnx_reranker_available() -> tuple[bool, str | None]:
    """Check whether Optimum + ONNXRuntime reranker dependencies are available."""
    try:
        import numpy  # noqa: F401
    except ImportError as exc:  # pragma: no cover - optional dependency
        return False, f"numpy not available: {exc}. Install with: pip install numpy"

    try:
        import onnxruntime  # noqa: F401
    except ImportError as exc:  # pragma: no cover - optional dependency
        return (
            False,
            f"onnxruntime not available: {exc}. Install with: pip install onnxruntime",
        )

    try:
        from optimum.onnxruntime import ORTModelForSequenceClassification  # noqa: F401
    except ImportError as exc:  # pragma: no cover - optional dependency
        return (
            False,
            f"optimum[onnxruntime] not available: {exc}. Install with: pip install optimum[onnxruntime]",
        )

    try:
        from transformers import AutoTokenizer  # noqa: F401
    except ImportError as exc:  # pragma: no cover - optional dependency
        return (
            False,
            f"transformers not available: {exc}. Install with: pip install transformers",
        )

    return True, None


def _iter_batches(items: Sequence[Any], batch_size: int) -> Iterable[Sequence[Any]]:
    for i in range(0, len(items), batch_size):
        yield items[i : i + batch_size]


class ONNXReranker(BaseReranker):
    """Cross-encoder reranker using Optimum + ONNX Runtime with lazy loading."""

    DEFAULT_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2"

    def __init__(
        self,
        model_name: str | None = None,
        *,
        use_gpu: bool = True,
        providers: list[Any] | None = None,
        max_length: int | None = None,
    ) -> None:
        self.model_name = (model_name or self.DEFAULT_MODEL).strip()
        if not self.model_name:
            raise ValueError("model_name cannot be blank")

        self.use_gpu = bool(use_gpu)
        self.providers = providers

        self.max_length = int(max_length) if max_length is not None else None

        self._tokenizer: Any | None = None
        self._model: Any | None = None
        self._model_input_names: set[str] | None = None
        self._lock = threading.RLock()

    def _load_model(self) -> None:
        if self._model is not None and self._tokenizer is not None:
            return

        ok, err = check_onnx_reranker_available()
        if not ok:
            raise ImportError(err)

        with self._lock:
            if self._model is not None and self._tokenizer is not None:
                return

            from inspect import signature

            from optimum.onnxruntime import ORTModelForSequenceClassification
            from transformers import AutoTokenizer

            if self.providers is None:
                from ..gpu_support import get_optimal_providers

                # Include device_id options for DirectML/CUDA selection when available.
                self.providers = get_optimal_providers(
                    use_gpu=self.use_gpu, with_device_options=True
                )

            # Some Optimum versions accept `providers`, others accept a single `provider`.
            # Prefer passing the full providers list, with a conservative fallback.
            model_kwargs: dict[str, Any] = {}
            try:
                params = signature(ORTModelForSequenceClassification.from_pretrained).parameters
                if "providers" in params:
                    model_kwargs["providers"] = self.providers
                elif "provider" in params:
                    provider_name = "CPUExecutionProvider"
                    if self.providers:
                        first = self.providers[0]
                        provider_name = first[0] if isinstance(first, tuple) else str(first)
                    model_kwargs["provider"] = provider_name
            except Exception:
                model_kwargs = {}

            try:
                self._model = ORTModelForSequenceClassification.from_pretrained(
                    self.model_name,
                    **model_kwargs,
                )
            except TypeError:
                # Fallback for older Optimum versions: retry without provider arguments.
                self._model = ORTModelForSequenceClassification.from_pretrained(self.model_name)

            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name, use_fast=True)

            # Cache model input names to filter tokenizer outputs defensively.
            input_names: set[str] | None = None
            for attr in ("input_names", "model_input_names"):
                names = getattr(self._model, attr, None)
                if isinstance(names, (list, tuple)) and names:
                    input_names = {str(n) for n in names}
                    break
            if input_names is None:
                try:
                    session = getattr(self._model, "model", None)
                    if session is not None and hasattr(session, "get_inputs"):
                        input_names = {i.name for i in session.get_inputs()}
                except Exception:
                    input_names = None
            self._model_input_names = input_names

    @staticmethod
    def _sigmoid(x: "Any") -> "Any":
        import numpy as np

        x = np.clip(x, -50.0, 50.0)
        return 1.0 / (1.0 + np.exp(-x))

    @staticmethod
    def _select_relevance_logit(logits: "Any") -> "Any":
        import numpy as np

        arr = np.asarray(logits)
        if arr.ndim == 0:
            return arr.reshape(1)
        if arr.ndim == 1:
            return arr
        if arr.ndim >= 2:
            # Common cases:
            # - Regression: (batch, 1)
            # - Binary classification: (batch, 2)
            if arr.shape[-1] == 1:
                return arr[..., 0]
            if arr.shape[-1] == 2:
                # Convert 2-logit softmax into a single logit via difference.
                return arr[..., 1] - arr[..., 0]
            return arr.max(axis=-1)
        return arr.reshape(-1)

    def _tokenize_batch(self, batch: Sequence[tuple[str, str]]) -> dict[str, Any]:
        if self._tokenizer is None:
            raise RuntimeError("Tokenizer not loaded")  # pragma: no cover - defensive

        queries = [q for q, _ in batch]
        docs = [d for _, d in batch]

        tokenizer_kwargs: dict[str, Any] = {
            "text": queries,
            "text_pair": docs,
            "padding": True,
            "truncation": True,
            "return_tensors": "np",
        }

        max_len = self.max_length
        if max_len is None:
            try:
                model_max = int(getattr(self._tokenizer, "model_max_length", 0) or 0)
                if 0 < model_max < 10_000:
                    max_len = model_max
                else:
                    max_len = 512
            except Exception:
                max_len = 512
        if max_len is not None and max_len > 0:
            tokenizer_kwargs["max_length"] = int(max_len)

        encoded = self._tokenizer(**tokenizer_kwargs)
        inputs = dict(encoded)

        # Some models do not accept token_type_ids; filter to known input names if available.
        if self._model_input_names:
            inputs = {k: v for k, v in inputs.items() if k in self._model_input_names}

        return inputs

    def _forward_logits(self, inputs: dict[str, Any]) -> Any:
        if self._model is None:
            raise RuntimeError("Model not loaded")  # pragma: no cover - defensive

        outputs = self._model(**inputs)
        if hasattr(outputs, "logits"):
            return outputs.logits
        if isinstance(outputs, dict) and "logits" in outputs:
            return outputs["logits"]
        if isinstance(outputs, (list, tuple)) and outputs:
            return outputs[0]
        raise RuntimeError("Unexpected model output format")  # pragma: no cover - defensive

    def score_pairs(
        self,
        pairs: Sequence[tuple[str, str]],
        *,
        batch_size: int = 32,
    ) -> list[float]:
        """Score (query, doc) pairs with sigmoid-normalized outputs in [0, 1]."""
        if not pairs:
            return []

        self._load_model()

        if self._model is None or self._tokenizer is None:  # pragma: no cover - defensive
            return []

        import numpy as np

        bs = int(batch_size) if batch_size and int(batch_size) > 0 else 32
        scores: list[float] = []

        for batch in _iter_batches(list(pairs), bs):
            inputs = self._tokenize_batch(batch)
            logits = self._forward_logits(inputs)
            rel_logits = self._select_relevance_logit(logits)
            probs = self._sigmoid(rel_logits)
            probs = np.clip(probs, 0.0, 1.0)
            scores.extend([float(p) for p in probs.reshape(-1).tolist()])

        if len(scores) != len(pairs):
            logger.debug(
                "ONNX reranker produced %d scores for %d pairs", len(scores), len(pairs)
            )
            return scores[: len(pairs)]

        return scores
