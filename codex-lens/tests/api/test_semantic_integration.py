"""Integration tests for semantic.py API - fusion strategy routing and result transform.

Tests cover:
- _execute_search: Strategy routing for rrf, binary, staged, hybrid (compat), dense_rerank
- _transform_results: Score extraction and kind filtering
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional
from unittest.mock import MagicMock, Mock, patch

import pytest

from codexlens.api.models import SemanticResult
from codexlens.api.semantic import _execute_search, _transform_results
from codexlens.entities import SearchResult
from codexlens.search.chain_search import (
    ChainSearchEngine,
    ChainSearchResult,
    SearchOptions,
    SearchStats,
)


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def mock_engine():
    """Create mock ChainSearchEngine."""
    engine = MagicMock(spec=ChainSearchEngine)
    return engine


@pytest.fixture
def mock_chain_result():
    """Create mock ChainSearchResult with sample data."""
    return ChainSearchResult(
        query="test query",
        results=[
            SearchResult(
                path="auth.py",
                score=0.9,
                excerpt="def authenticate(user):",
                symbol_name="authenticate",
                symbol_kind="function",
                start_line=10,
                end_line=20,
            ),
            SearchResult(
                path="login.py",
                score=0.7,
                excerpt="class LoginHandler:",
                symbol_name="LoginHandler",
                symbol_kind="class",
                start_line=5,
                end_line=50,
            ),
        ],
        symbols=[],
        stats=SearchStats(),
    )


@pytest.fixture
def mock_options():
    """Create mock SearchOptions."""
    return SearchOptions(
        hybrid_mode=True,
        enable_vector=True,
        enable_fuzzy=True,
    )


# =============================================================================
# Tests: _execute_search strategy routing
# =============================================================================


class TestExecuteSearchStrategyRouting:
    """Tests for _execute_search() fusion strategy routing."""

    def test_fusion_strategy_rrf(self, mock_engine, mock_chain_result, mock_options):
        """Default 'rrf' strategy should call engine.search()."""
        mock_engine.search.return_value = mock_chain_result

        result = _execute_search(
            engine=mock_engine,
            query="test",
            source_path=Path("/project"),
            fusion_strategy="rrf",
            options=mock_options,
            limit=20,
        )

        mock_engine.search.assert_called_once()
        assert isinstance(result, ChainSearchResult)

    def test_fusion_strategy_binary(self, mock_engine, mock_chain_result, mock_options):
        """'binary' strategy should call engine.binary_cascade_search()."""
        mock_engine.binary_cascade_search.return_value = mock_chain_result

        result = _execute_search(
            engine=mock_engine,
            query="test",
            source_path=Path("/project"),
            fusion_strategy="binary",
            options=mock_options,
            limit=20,
        )

        mock_engine.binary_cascade_search.assert_called_once()
        # Verify k and coarse_k parameters
        call_kwargs = mock_engine.binary_cascade_search.call_args
        assert call_kwargs[1]["k"] == 20
        assert call_kwargs[1]["coarse_k"] == 100  # limit * 5

    def test_fusion_strategy_staged(self, mock_engine, mock_chain_result, mock_options):
        """'staged' strategy should call engine.staged_cascade_search()."""
        mock_engine.staged_cascade_search.return_value = mock_chain_result

        result = _execute_search(
            engine=mock_engine,
            query="test",
            source_path=Path("/project"),
            fusion_strategy="staged",
            options=mock_options,
            limit=20,
        )

        mock_engine.staged_cascade_search.assert_called_once()

    def test_fusion_strategy_hybrid_compat(
        self, mock_engine, mock_chain_result, mock_options
    ):
        """'hybrid' strategy should map to binary_rerank_cascade_search (backward compat)."""
        mock_engine.binary_rerank_cascade_search.return_value = mock_chain_result

        result = _execute_search(
            engine=mock_engine,
            query="test",
            source_path=Path("/project"),
            fusion_strategy="hybrid",
            options=mock_options,
            limit=20,
        )

        mock_engine.binary_rerank_cascade_search.assert_called_once()

    def test_fusion_strategy_dense_rerank(
        self, mock_engine, mock_chain_result, mock_options
    ):
        """'dense_rerank' strategy should call engine.search() (default fallback)."""
        # In the current implementation, dense_rerank is not explicitly handled,
        # so it falls through to the default (rrf) branch
        mock_engine.search.return_value = mock_chain_result

        result = _execute_search(
            engine=mock_engine,
            query="test",
            source_path=Path("/project"),
            fusion_strategy="dense_rerank",
            options=mock_options,
            limit=20,
        )

        # dense_rerank falls to default (else branch -> engine.search)
        mock_engine.search.assert_called_once()


# =============================================================================
# Tests: _transform_results
# =============================================================================


class TestTransformResults:
    """Tests for _transform_results()."""

    def test_transform_results_basic(self):
        """_transform_results should convert SearchResult to SemanticResult."""
        results = [
            SearchResult(
                path="auth.py",
                score=0.9,
                excerpt="def authenticate(user):",
                symbol_name="authenticate",
                symbol_kind="function",
                start_line=10,
                end_line=20,
            ),
            SearchResult(
                path="models.py",
                score=0.7,
                excerpt="class UserModel:",
                symbol_name="UserModel",
                symbol_kind="class",
                start_line=1,
                end_line=30,
            ),
        ]

        semantic_results = _transform_results(
            results=results,
            mode="fusion",
            vector_weight=0.5,
            structural_weight=0.3,
            keyword_weight=0.2,
            kind_filter=None,
            include_match_reason=False,
            query="authentication",
        )

        assert len(semantic_results) == 2
        assert all(isinstance(r, SemanticResult) for r in semantic_results)

        # Check first result
        first = semantic_results[0]
        assert first.fusion_score == 0.9
        assert first.symbol_name == "authenticate"
        assert first.kind == "function"
        assert first.file_path == "auth.py"
        assert first.line == 10

        # Should be sorted by fusion_score descending
        scores = [r.fusion_score for r in semantic_results]
        assert scores == sorted(scores, reverse=True)

    def test_transform_results_kind_filter(self):
        """_transform_results should filter by kind when kind_filter is set."""
        results = [
            SearchResult(
                path="auth.py",
                score=0.9,
                excerpt="def auth():",
                symbol_name="auth",
                symbol_kind="function",
            ),
            SearchResult(
                path="models.py",
                score=0.8,
                excerpt="class User:",
                symbol_name="User",
                symbol_kind="class",
            ),
        ]

        # Filter to only functions
        semantic_results = _transform_results(
            results=results,
            mode="fusion",
            vector_weight=0.5,
            structural_weight=0.3,
            keyword_weight=0.2,
            kind_filter=["function"],
            include_match_reason=False,
            query="test",
        )

        assert len(semantic_results) == 1
        assert semantic_results[0].kind == "function"
