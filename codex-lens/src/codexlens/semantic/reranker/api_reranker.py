"""API-based reranker using a remote HTTP provider.

Supported providers:
- SiliconFlow: https://api.siliconflow.cn/v1/rerank
- Cohere: https://api.cohere.ai/v1/rerank
- Jina: https://api.jina.ai/v1/rerank
"""

from __future__ import annotations

import logging
import os
import random
import time
from pathlib import Path
from typing import Any, Mapping, Sequence

from .base import BaseReranker

logger = logging.getLogger(__name__)

_DEFAULT_ENV_API_KEY = "RERANKER_API_KEY"


def _get_env_with_fallback(key: str, workspace_root: Path | None = None) -> str | None:
    """Get environment variable with .env file fallback."""
    # Check os.environ first
    if key in os.environ:
        return os.environ[key]

    # Try loading from .env files
    try:
        from codexlens.env_config import get_env
        return get_env(key, workspace_root=workspace_root)
    except ImportError:
        return None


def check_httpx_available() -> tuple[bool, str | None]:
    try:
        import httpx  # noqa: F401
    except ImportError as exc:  # pragma: no cover - optional dependency
        return False, f"httpx not available: {exc}. Install with: pip install httpx"
    return True, None


class APIReranker(BaseReranker):
    """Reranker backed by a remote reranking HTTP API."""

    _PROVIDER_DEFAULTS: Mapping[str, Mapping[str, str]] = {
        "siliconflow": {
            "api_base": "https://api.siliconflow.cn",
            "endpoint": "/v1/rerank",
            "default_model": "BAAI/bge-reranker-v2-m3",
        },
        "cohere": {
            "api_base": "https://api.cohere.ai",
            "endpoint": "/v1/rerank",
            "default_model": "rerank-english-v3.0",
        },
        "jina": {
            "api_base": "https://api.jina.ai",
            "endpoint": "/v1/rerank",
            "default_model": "jina-reranker-v2-base-multilingual",
        },
    }

    def __init__(
        self,
        *,
        provider: str = "siliconflow",
        model_name: str | None = None,
        api_key: str | None = None,
        api_base: str | None = None,
        timeout: float = 30.0,
        max_retries: int = 3,
        backoff_base_s: float = 0.5,
        backoff_max_s: float = 8.0,
        env_api_key: str = _DEFAULT_ENV_API_KEY,
        workspace_root: Path | str | None = None,
    ) -> None:
        ok, err = check_httpx_available()
        if not ok:  # pragma: no cover - exercised via factory availability tests
            raise ImportError(err)

        import httpx

        self._workspace_root = Path(workspace_root) if workspace_root else None

        self.provider = (provider or "").strip().lower()
        if self.provider not in self._PROVIDER_DEFAULTS:
            raise ValueError(
                f"Unknown reranker provider: {provider}. "
                f"Supported providers: {', '.join(sorted(self._PROVIDER_DEFAULTS))}"
            )

        defaults = self._PROVIDER_DEFAULTS[self.provider]

        # Load api_base from env with .env fallback
        env_api_base = _get_env_with_fallback("RERANKER_API_BASE", self._workspace_root)
        self.api_base = (api_base or env_api_base or defaults["api_base"]).strip().rstrip("/")
        self.endpoint = defaults["endpoint"]

        # Load model from env with .env fallback
        env_model = _get_env_with_fallback("RERANKER_MODEL", self._workspace_root)
        self.model_name = (model_name or env_model or defaults["default_model"]).strip()
        if not self.model_name:
            raise ValueError("model_name cannot be blank")

        # Load API key from env with .env fallback
        resolved_key = api_key or _get_env_with_fallback(env_api_key, self._workspace_root) or ""
        resolved_key = resolved_key.strip()
        if not resolved_key:
            raise ValueError(
                f"Missing API key for reranker provider '{self.provider}'. "
                f"Pass api_key=... or set ${env_api_key}."
            )
        self._api_key = resolved_key

        self.timeout_s = float(timeout) if timeout and float(timeout) > 0 else 30.0
        self.max_retries = int(max_retries) if max_retries and int(max_retries) >= 0 else 3
        self.backoff_base_s = float(backoff_base_s) if backoff_base_s and float(backoff_base_s) > 0 else 0.5
        self.backoff_max_s = float(backoff_max_s) if backoff_max_s and float(backoff_max_s) > 0 else 8.0

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        if self.provider == "cohere":
            headers.setdefault("Cohere-Version", "2022-12-06")

        self._client = httpx.Client(
            base_url=self.api_base,
            headers=headers,
            timeout=self.timeout_s,
        )

    def close(self) -> None:
        try:
            self._client.close()
        except Exception:  # pragma: no cover - defensive
            return

    def _sleep_backoff(self, attempt: int, *, retry_after_s: float | None = None) -> None:
        if retry_after_s is not None and retry_after_s > 0:
            time.sleep(min(float(retry_after_s), self.backoff_max_s))
            return

        exp = self.backoff_base_s * (2**attempt)
        jitter = random.uniform(0, min(0.5, self.backoff_base_s))
        time.sleep(min(self.backoff_max_s, exp + jitter))

    @staticmethod
    def _parse_retry_after_seconds(headers: Mapping[str, str]) -> float | None:
        value = (headers.get("Retry-After") or "").strip()
        if not value:
            return None
        try:
            return float(value)
        except ValueError:
            return None

    @staticmethod
    def _should_retry_status(status_code: int) -> bool:
        return status_code == 429 or 500 <= status_code <= 599

    def _request_json(self, payload: Mapping[str, Any]) -> Mapping[str, Any]:
        last_exc: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                response = self._client.post(self.endpoint, json=dict(payload))
            except Exception as exc:  # httpx is optional at import-time
                last_exc = exc
                if attempt < self.max_retries:
                    self._sleep_backoff(attempt)
                    continue
                raise RuntimeError(
                    f"Rerank request failed for provider '{self.provider}' after "
                    f"{self.max_retries + 1} attempts: {type(exc).__name__}: {exc}"
                ) from exc

            status = int(getattr(response, "status_code", 0) or 0)
            if status >= 400:
                body_preview = ""
                try:
                    body_preview = (response.text or "").strip()
                except Exception:
                    body_preview = ""
                if len(body_preview) > 300:
                    body_preview = body_preview[:300] + "…"

                if self._should_retry_status(status) and attempt < self.max_retries:
                    retry_after = self._parse_retry_after_seconds(response.headers)
                    logger.warning(
                        "Rerank request to %s%s failed with HTTP %s (attempt %s/%s). Retrying…",
                        self.api_base,
                        self.endpoint,
                        status,
                        attempt + 1,
                        self.max_retries + 1,
                    )
                    self._sleep_backoff(attempt, retry_after_s=retry_after)
                    continue

                if status in {401, 403}:
                    raise RuntimeError(
                        f"Rerank request unauthorized for provider '{self.provider}' (HTTP {status}). "
                        "Check your API key."
                    )

                raise RuntimeError(
                    f"Rerank request failed for provider '{self.provider}' (HTTP {status}). "
                    f"Response: {body_preview or '<empty>'}"
                )

            try:
                data = response.json()
            except Exception as exc:
                raise RuntimeError(
                    f"Rerank response from provider '{self.provider}' is not valid JSON: "
                    f"{type(exc).__name__}: {exc}"
                ) from exc

            if not isinstance(data, dict):
                raise RuntimeError(
                    f"Rerank response from provider '{self.provider}' must be a JSON object; "
                    f"got {type(data).__name__}"
                )

            return data

        raise RuntimeError(
            f"Rerank request failed for provider '{self.provider}'. Last error: {last_exc}"
        )

    @staticmethod
    def _extract_scores_from_results(results: Any, expected: int) -> list[float]:
        if not isinstance(results, list):
            raise RuntimeError(f"Invalid rerank response: 'results' must be a list, got {type(results).__name__}")

        scores: list[float] = [0.0 for _ in range(expected)]
        filled = 0

        for item in results:
            if not isinstance(item, dict):
                continue
            idx = item.get("index")
            score = item.get("relevance_score", item.get("score"))
            if idx is None or score is None:
                continue
            try:
                idx_int = int(idx)
                score_f = float(score)
            except (TypeError, ValueError):
                continue
            if 0 <= idx_int < expected:
                scores[idx_int] = score_f
                filled += 1

        if filled != expected:
            raise RuntimeError(
                f"Rerank response contained {filled}/{expected} scored documents; "
                "ensure top_n matches the number of documents."
            )

        return scores

    def _build_payload(self, *, query: str, documents: Sequence[str]) -> Mapping[str, Any]:
        payload: dict[str, Any] = {
            "model": self.model_name,
            "query": query,
            "documents": list(documents),
            "top_n": len(documents),
            "return_documents": False,
        }
        return payload

    def _rerank_one_query(self, *, query: str, documents: Sequence[str]) -> list[float]:
        if not documents:
            return []

        payload = self._build_payload(query=query, documents=documents)
        data = self._request_json(payload)

        results = data.get("results")
        return self._extract_scores_from_results(results, expected=len(documents))

    def score_pairs(
        self,
        pairs: Sequence[tuple[str, str]],
        *,
        batch_size: int = 32,  # noqa: ARG002 - kept for BaseReranker compatibility
    ) -> list[float]:
        if not pairs:
            return []

        grouped: dict[str, list[tuple[int, str]]] = {}
        for idx, (query, doc) in enumerate(pairs):
            grouped.setdefault(str(query), []).append((idx, str(doc)))

        scores: list[float] = [0.0 for _ in range(len(pairs))]

        for query, items in grouped.items():
            documents = [doc for _, doc in items]
            query_scores = self._rerank_one_query(query=query, documents=documents)
            for (orig_idx, _), score in zip(items, query_scores):
                scores[orig_idx] = float(score)

        return scores
