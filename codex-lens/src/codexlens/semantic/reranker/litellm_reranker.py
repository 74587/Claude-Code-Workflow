"""Experimental LiteLLM reranker backend.

This module provides :class:`LiteLLMReranker`, which uses an LLM to score the
relevance of a single (query, document) pair per request.

Notes:
    - This backend is experimental and may be slow/expensive compared to local
      rerankers.
    - It relies on `ccw-litellm` for a unified LLM API across providers.
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
from typing import Any, Sequence

from .base import BaseReranker

logger = logging.getLogger(__name__)

_NUMBER_RE = re.compile(r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?")


def _coerce_score_to_unit_interval(score: float) -> float:
    """Coerce a numeric score into [0, 1].

    The prompt asks for a float in [0, 1], but some models may respond with 0-10
    or 0-100 scales. This function attempts a conservative normalization.
    """
    if 0.0 <= score <= 1.0:
        return score
    if 0.0 <= score <= 10.0:
        return score / 10.0
    if 0.0 <= score <= 100.0:
        return score / 100.0
    return max(0.0, min(1.0, score))


def _extract_score(text: str) -> float | None:
    """Extract a numeric relevance score from an LLM response."""
    content = (text or "").strip()
    if not content:
        return None

    # Prefer JSON if present.
    if "{" in content and "}" in content:
        try:
            start = content.index("{")
            end = content.rindex("}") + 1
            payload = json.loads(content[start:end])
            if isinstance(payload, dict) and "score" in payload:
                return float(payload["score"])
        except Exception:
            pass

    match = _NUMBER_RE.search(content)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None


class LiteLLMReranker(BaseReranker):
    """Experimental reranker that uses a LiteLLM-compatible model.

    This reranker scores each (query, doc) pair in isolation (single-pair mode)
    to improve prompt reliability across providers.
    """

    _SYSTEM_PROMPT = (
        "You are a relevance scoring assistant.\n"
        "Given a search query and a document snippet, output a single numeric "
        "relevance score between 0 and 1.\n\n"
        "Scoring guidance:\n"
        "- 1.0: The document directly answers the query.\n"
        "- 0.5: The document is partially relevant.\n"
        "- 0.0: The document is unrelated.\n\n"
        "Output requirements:\n"
        "- Output ONLY the number (e.g., 0.73).\n"
        "- Do not include any other text."
    )

    def __init__(
        self,
        model: str = "default",
        *,
        requests_per_minute: float | None = None,
        min_interval_seconds: float | None = None,
        default_score: float = 0.0,
        max_doc_chars: int = 8000,
        **litellm_kwargs: Any,
    ) -> None:
        """Initialize the reranker.

        Args:
            model: Model name from ccw-litellm configuration (default: "default").
            requests_per_minute: Optional rate limit in requests per minute.
            min_interval_seconds: Optional minimum interval between requests. If set,
                it takes precedence over requests_per_minute.
            default_score: Score to use when an API call fails or parsing fails.
            max_doc_chars: Maximum number of document characters to include in the prompt.
            **litellm_kwargs: Passed through to `ccw_litellm.LiteLLMClient`.

        Raises:
            ImportError: If ccw-litellm is not installed.
            ValueError: If model is blank.
        """
        self.model_name = (model or "").strip()
        if not self.model_name:
            raise ValueError("model cannot be blank")

        self.default_score = float(default_score)

        self.max_doc_chars = int(max_doc_chars) if int(max_doc_chars) > 0 else 0

        if min_interval_seconds is not None:
            self._min_interval_seconds = max(0.0, float(min_interval_seconds))
        elif requests_per_minute is not None and float(requests_per_minute) > 0:
            self._min_interval_seconds = 60.0 / float(requests_per_minute)
        else:
            self._min_interval_seconds = 0.0

        # Prefer deterministic output by default; allow overrides via kwargs.
        litellm_kwargs = dict(litellm_kwargs)
        litellm_kwargs.setdefault("temperature", 0.0)
        litellm_kwargs.setdefault("max_tokens", 16)

        try:
            from ccw_litellm import ChatMessage, LiteLLMClient
        except ImportError as exc:  # pragma: no cover - optional dependency
            raise ImportError(
                "ccw-litellm not installed. Install with: pip install ccw-litellm"
            ) from exc

        self._ChatMessage = ChatMessage
        self._client = LiteLLMClient(model=self.model_name, **litellm_kwargs)

        self._lock = threading.RLock()
        self._last_request_at = 0.0

    def _sanitize_text(self, text: str) -> str:
        # Keep consistent with LiteLLMEmbedderWrapper workaround.
        if text.startswith("import"):
            return " " + text
        return text

    def _rate_limit(self) -> None:
        if self._min_interval_seconds <= 0:
            return
        with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_request_at
            if elapsed < self._min_interval_seconds:
                time.sleep(self._min_interval_seconds - elapsed)
            self._last_request_at = time.monotonic()

    def _build_user_prompt(self, query: str, doc: str) -> str:
        sanitized_query = self._sanitize_text(query or "")
        sanitized_doc = self._sanitize_text(doc or "")
        if self.max_doc_chars and len(sanitized_doc) > self.max_doc_chars:
            sanitized_doc = sanitized_doc[: self.max_doc_chars]

        return (
            "Query:\n"
            f"{sanitized_query}\n\n"
            "Document:\n"
            f"{sanitized_doc}\n\n"
            "Return the relevance score (0 to 1) as a single number:"
        )

    def _score_single_pair(self, query: str, doc: str) -> float:
        messages = [
            self._ChatMessage(role="system", content=self._SYSTEM_PROMPT),
            self._ChatMessage(role="user", content=self._build_user_prompt(query, doc)),
        ]

        try:
            self._rate_limit()
            response = self._client.chat(messages)
        except Exception as exc:
            logger.debug("LiteLLM reranker request failed: %s", exc)
            return self.default_score

        raw = getattr(response, "content", "") or ""
        score = _extract_score(raw)
        if score is None:
            logger.debug("Failed to parse LiteLLM reranker score from response: %r", raw)
            return self.default_score
        return _coerce_score_to_unit_interval(float(score))

    def score_pairs(
        self,
        pairs: Sequence[tuple[str, str]],
        *,
        batch_size: int = 32,
    ) -> list[float]:
        """Score (query, doc) pairs with per-pair LLM calls."""
        if not pairs:
            return []

        bs = int(batch_size) if batch_size and int(batch_size) > 0 else 32

        scores: list[float] = []
        for i in range(0, len(pairs), bs):
            batch = pairs[i : i + bs]
            for query, doc in batch:
                scores.append(self._score_single_pair(query, doc))
        return scores
