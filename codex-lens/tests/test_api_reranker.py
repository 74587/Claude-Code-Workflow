"""Tests for APIReranker backend."""

from __future__ import annotations

import sys
import types
from typing import Any

import pytest

from codexlens.semantic.reranker import get_reranker
from codexlens.semantic.reranker.api_reranker import APIReranker


class DummyResponse:
    def __init__(
        self,
        *,
        status_code: int = 200,
        json_data: Any = None,
        text: str = "",
        headers: dict[str, str] | None = None,
    ) -> None:
        self.status_code = int(status_code)
        self._json_data = json_data
        self.text = text
        self.headers = headers or {}

    def json(self) -> Any:
        return self._json_data


class DummyClient:
    def __init__(self, *, base_url: str | None = None, headers: dict[str, str] | None = None, timeout: float | None = None) -> None:
        self.base_url = base_url
        self.headers = headers or {}
        self.timeout = timeout
        self.closed = False
        self.calls: list[dict[str, Any]] = []
        self._responses: list[DummyResponse] = []

    def queue(self, response: DummyResponse) -> None:
        self._responses.append(response)

    def post(self, endpoint: str, *, json: dict[str, Any] | None = None) -> DummyResponse:
        self.calls.append({"endpoint": endpoint, "json": json})
        if not self._responses:
            raise AssertionError("DummyClient has no queued responses")
        return self._responses.pop(0)

    def close(self) -> None:
        self.closed = True


@pytest.fixture
def httpx_clients(monkeypatch: pytest.MonkeyPatch) -> list[DummyClient]:
    clients: list[DummyClient] = []

    dummy_httpx = types.ModuleType("httpx")

    def Client(*, base_url: str | None = None, headers: dict[str, str] | None = None, timeout: float | None = None) -> DummyClient:
        client = DummyClient(base_url=base_url, headers=headers, timeout=timeout)
        clients.append(client)
        return client

    dummy_httpx.Client = Client
    monkeypatch.setitem(sys.modules, "httpx", dummy_httpx)

    return clients


def test_api_reranker_requires_api_key(
    monkeypatch: pytest.MonkeyPatch, httpx_clients: list[DummyClient]
) -> None:
    # Force empty key in-process so the reranker does not fall back to any
    # workspace/global .env configuration that may exist on the machine.
    monkeypatch.setenv("RERANKER_API_KEY", "")
    monkeypatch.setenv("CODEXLENS_RERANKER_API_KEY", "")

    with pytest.raises(ValueError, match="Missing API key"):
        APIReranker()

    assert httpx_clients == []


def test_api_reranker_reads_api_key_from_env(
    monkeypatch: pytest.MonkeyPatch, httpx_clients: list[DummyClient]
) -> None:
    monkeypatch.setenv("RERANKER_API_KEY", "test-key")

    reranker = APIReranker()
    assert len(httpx_clients) == 1
    assert httpx_clients[0].headers["Authorization"] == "Bearer test-key"
    reranker.close()
    assert httpx_clients[0].closed is True


def test_api_reranker_strips_v1_from_api_base_to_avoid_double_v1(
    monkeypatch: pytest.MonkeyPatch, httpx_clients: list[DummyClient]
) -> None:
    monkeypatch.setenv("RERANKER_API_KEY", "test-key")

    reranker = APIReranker(api_base="https://api.siliconflow.cn/v1", provider="siliconflow")
    assert len(httpx_clients) == 1
    # Endpoint already includes /v1, so api_base should not.
    assert httpx_clients[0].base_url == "https://api.siliconflow.cn"
    reranker.close()


def test_api_reranker_strips_endpoint_from_api_base_to_avoid_double_endpoint(
    monkeypatch: pytest.MonkeyPatch, httpx_clients: list[DummyClient]
) -> None:
    monkeypatch.setenv("RERANKER_API_KEY", "test-key")

    reranker = APIReranker(api_base="https://api.siliconflow.cn/v1/rerank", provider="siliconflow")
    assert len(httpx_clients) == 1
    # If api_base already includes the endpoint suffix, strip it.
    assert httpx_clients[0].base_url == "https://api.siliconflow.cn"
    reranker.close()


def test_api_reranker_scores_pairs_siliconflow(
    monkeypatch: pytest.MonkeyPatch, httpx_clients: list[DummyClient]
) -> None:
    monkeypatch.delenv("RERANKER_API_KEY", raising=False)
    # Avoid picking up any machine-local default model from global .env.
    monkeypatch.setenv("RERANKER_MODEL", "")
    monkeypatch.setenv("CODEXLENS_RERANKER_MODEL", "")

    reranker = APIReranker(api_key="k", provider="siliconflow")
    client = httpx_clients[0]

    client.queue(
        DummyResponse(
            json_data={
                "results": [
                    {"index": 0, "relevance_score": 0.9},
                    {"index": 1, "relevance_score": 0.1},
                ]
            }
        )
    )

    scores = reranker.score_pairs([("q", "d1"), ("q", "d2")])
    assert scores == pytest.approx([0.9, 0.1])

    assert client.calls[0]["endpoint"] == "/v1/rerank"
    payload = client.calls[0]["json"]
    assert payload["model"] == "BAAI/bge-reranker-v2-m3"
    assert payload["query"] == "q"
    assert payload["documents"] == ["d1", "d2"]
    assert payload["top_n"] == 2
    assert payload["return_documents"] is False


def test_api_reranker_retries_on_5xx(
    monkeypatch: pytest.MonkeyPatch, httpx_clients: list[DummyClient]
) -> None:
    monkeypatch.setenv("RERANKER_API_KEY", "k")

    from codexlens.semantic.reranker import api_reranker as api_reranker_module

    monkeypatch.setattr(api_reranker_module.time, "sleep", lambda *_args, **_kwargs: None)

    reranker = APIReranker(max_retries=1)
    client = httpx_clients[0]

    client.queue(DummyResponse(status_code=500, text="oops", json_data={"error": "oops"}))
    client.queue(
        DummyResponse(
            json_data={"results": [{"index": 0, "relevance_score": 0.7}]},
        )
    )

    scores = reranker.score_pairs([("q", "d")])
    assert scores == pytest.approx([0.7])
    assert len(client.calls) == 2


def test_api_reranker_unauthorized_raises(
    monkeypatch: pytest.MonkeyPatch, httpx_clients: list[DummyClient]
) -> None:
    monkeypatch.setenv("RERANKER_API_KEY", "k")

    reranker = APIReranker()
    client = httpx_clients[0]
    client.queue(DummyResponse(status_code=401, text="unauthorized"))

    with pytest.raises(RuntimeError, match="unauthorized"):
        reranker.score_pairs([("q", "d")])


def test_factory_api_backend_constructs_reranker(
    monkeypatch: pytest.MonkeyPatch, httpx_clients: list[DummyClient]
) -> None:
    monkeypatch.setenv("RERANKER_API_KEY", "k")

    reranker = get_reranker(backend="api")
    assert isinstance(reranker, APIReranker)
    assert len(httpx_clients) == 1
