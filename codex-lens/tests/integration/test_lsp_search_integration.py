"""Integration tests for HybridSearchEngine LSP graph search.

Tests the _search_lsp_graph method which orchestrates:
1. Seed retrieval via vector/splade/exact fallback chain
2. LSP graph expansion via LspBridge and LspGraphBuilder
3. Result deduplication and merging

Test Priority:
- P0: Critical path tests (e2e success, fallback chain)
- P1: Important edge cases (no seeds, bridge failures)
- P2: Supplementary tests (deduplication)
"""

from __future__ import annotations

import asyncio
import logging
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from codexlens.entities import SearchResult
from codexlens.hybrid_search.data_structures import (
    CallHierarchyItem,
    CodeAssociationGraph,
    CodeSymbolNode,
    Range,
)
from codexlens.search.hybrid_search import HybridSearchEngine


# -----------------------------------------------------------------------------
# Fixtures
# -----------------------------------------------------------------------------


@pytest.fixture
def tmp_index_path(tmp_path: Path) -> Path:
    """Create a temporary index database path."""
    db_path = tmp_path / "_index.db"
    # Create empty file to satisfy existence checks
    db_path.write_bytes(b"")
    return db_path


@pytest.fixture
def sample_search_result() -> SearchResult:
    """Create a sample SearchResult for use as seed."""
    return SearchResult(
        path="/path/to/file.py",
        content="def auth_flow(): ...",
        excerpt="def auth_flow(): ...",
        start_line=10,
        end_line=20,
        symbol_name="auth_flow",
        symbol_kind="function",
        score=0.9,
    )


@pytest.fixture
def sample_search_result_2() -> SearchResult:
    """Create a second sample SearchResult."""
    return SearchResult(
        path="/path/to/other.py",
        content="def init_db(): ...",
        excerpt="def init_db(): ...",
        start_line=5,
        end_line=15,
        symbol_name="init_db",
        symbol_kind="function",
        score=0.85,
    )


@pytest.fixture
def sample_code_symbol_node() -> CodeSymbolNode:
    """Create a sample CodeSymbolNode for graph expansion."""
    return CodeSymbolNode(
        id="/path/to/related.py:helper_func:30",
        name="helper_func",
        kind="function",
        file_path="/path/to/related.py",
        range=Range(
            start_line=30,
            start_character=0,
            end_line=40,
            end_character=0,
        ),
        raw_code="def helper_func(): pass",
        docstring="Helper function",
    )


@pytest.fixture
def sample_code_symbol_node_2() -> CodeSymbolNode:
    """Create another sample CodeSymbolNode."""
    return CodeSymbolNode(
        id="/path/to/util.py:validate:50",
        name="validate",
        kind="function",
        file_path="/path/to/util.py",
        range=Range(
            start_line=50,
            start_character=0,
            end_line=60,
            end_character=0,
        ),
        raw_code="def validate(): pass",
        docstring="Validation function",
    )


@pytest.fixture
def mock_search_engine() -> HybridSearchEngine:
    """Create a HybridSearchEngine with default settings."""
    return HybridSearchEngine()


def create_mock_graph_with_seed_and_related(
    seed_result: SearchResult,
    related_nodes: List[CodeSymbolNode],
) -> CodeAssociationGraph:
    """Helper to create a mock graph with seed and related nodes."""
    graph = CodeAssociationGraph()

    # Add seed node
    seed_node_id = f"{seed_result.path}:{seed_result.symbol_name or 'unknown'}:{seed_result.start_line or 0}"
    seed_node = CodeSymbolNode(
        id=seed_node_id,
        name=seed_result.symbol_name or "unknown",
        kind=seed_result.symbol_kind or "unknown",
        file_path=seed_result.path,
        range=Range(
            start_line=seed_result.start_line or 1,
            start_character=0,
            end_line=seed_result.end_line or 1,
            end_character=0,
        ),
    )
    graph.add_node(seed_node)

    # Add related nodes
    for node in related_nodes:
        graph.add_node(node)

    return graph


# -----------------------------------------------------------------------------
# P0: Critical Tests
# -----------------------------------------------------------------------------


class TestP0CriticalLspSearch:
    """P0 Critical: Core E2E tests for LSP graph search."""

    def test_e2e_lsp_search_vector_seed_success(
        self,
        tmp_index_path: Path,
        sample_search_result: SearchResult,
        sample_code_symbol_node: CodeSymbolNode,
        sample_code_symbol_node_2: CodeSymbolNode,
    ) -> None:
        """Test E2E LSP search with vector providing seed, returning graph-expanded results.

        Input: query="authentication flow"
        Mock: _search_vector returns 1 SearchResult as seed
        Mock: LspBridge/LspGraphBuilder returns 2 related symbols
        Assert: Returns 2 new results (seed is filtered from final results)
        """
        engine = HybridSearchEngine()

        # Create mock graph with seed and 2 related nodes
        mock_graph = create_mock_graph_with_seed_and_related(
            sample_search_result,
            [sample_code_symbol_node, sample_code_symbol_node_2],
        )

        # Patch seed search methods
        with patch.object(
            engine, "_search_vector", return_value=[sample_search_result]
        ) as mock_vector, patch.object(
            engine, "_search_splade", return_value=[]
        ), patch.object(
            engine, "_search_exact", return_value=[]
        ):
            # Patch LSP module at the import location
            with patch.dict("sys.modules", {"codexlens.lsp": MagicMock()}):
                # Patch the module-level HAS_LSP check
                with patch("codexlens.search.hybrid_search.HAS_LSP", True):
                    # Create mock LspBridge class
                    mock_bridge_instance = AsyncMock()
                    mock_bridge_class = MagicMock()
                    mock_bridge_class.return_value.__aenter__ = AsyncMock(
                        return_value=mock_bridge_instance
                    )
                    mock_bridge_class.return_value.__aexit__ = AsyncMock(
                        return_value=None
                    )

                    # Create mock LspGraphBuilder
                    async def mock_build(seeds, bridge):
                        return mock_graph

                    mock_builder_instance = MagicMock()
                    mock_builder_instance.build_from_seeds = mock_build
                    mock_builder_class = MagicMock(return_value=mock_builder_instance)

                    # Patch at module level
                    with patch(
                        "codexlens.search.hybrid_search.LspBridge",
                        mock_bridge_class,
                    ), patch(
                        "codexlens.search.hybrid_search.LspGraphBuilder",
                        mock_builder_class,
                    ):
                        results = engine._search_lsp_graph(
                            index_path=tmp_index_path,
                            query="authentication flow",
                            limit=10,
                            max_depth=1,
                            max_nodes=20,
                        )

        # Verify vector search was called first
        mock_vector.assert_called_once()

        # Should return 2 results (the two non-seed nodes)
        assert len(results) == 2

        # Verify seed is not in results
        seed_node_id = f"{sample_search_result.path}:{sample_search_result.symbol_name or 'unknown'}:{sample_search_result.start_line or 0}"
        result_node_ids = {
            f"{r.path}:{r.symbol_name or 'unknown'}:{r.start_line or 0}"
            for r in results
        }
        assert seed_node_id not in result_node_ids

        # Verify the returned results are the graph-expanded nodes
        result_paths = {r.path for r in results}
        assert sample_code_symbol_node.file_path in result_paths
        assert sample_code_symbol_node_2.file_path in result_paths

    def test_seed_fallback_chain_vector_fails_fts_succeeds(
        self,
        tmp_index_path: Path,
        sample_search_result: SearchResult,
        sample_code_symbol_node: CodeSymbolNode,
    ) -> None:
        """Test seed fallback chain: vector -> splade -> exact.

        Input: query="init_db"
        Mock: _search_vector returns []
        Mock: _search_splade returns []
        Mock: _search_exact returns 1 seed
        Assert: Fallback chain called in order, uses exact's seed
        """
        engine = HybridSearchEngine()

        call_order: List[str] = []

        def track_vector(*args, **kwargs):
            call_order.append("vector")
            return []

        def track_splade(*args, **kwargs):
            call_order.append("splade")
            return []

        def track_exact(*args, **kwargs):
            call_order.append("exact")
            return [sample_search_result]

        # Create mock graph
        mock_graph = create_mock_graph_with_seed_and_related(
            sample_search_result,
            [sample_code_symbol_node],
        )

        with patch.object(
            engine, "_search_vector", side_effect=track_vector
        ) as mock_vector, patch.object(
            engine, "_search_splade", side_effect=track_splade
        ) as mock_splade, patch.object(
            engine, "_search_exact", side_effect=track_exact
        ) as mock_exact:
            with patch("codexlens.search.hybrid_search.HAS_LSP", True):
                # Create mock LspBridge class
                mock_bridge_instance = AsyncMock()
                mock_bridge_class = MagicMock()
                mock_bridge_class.return_value.__aenter__ = AsyncMock(
                    return_value=mock_bridge_instance
                )
                mock_bridge_class.return_value.__aexit__ = AsyncMock(
                    return_value=None
                )

                # Create mock LspGraphBuilder
                async def mock_build(seeds, bridge):
                    return mock_graph

                mock_builder_instance = MagicMock()
                mock_builder_instance.build_from_seeds = mock_build
                mock_builder_class = MagicMock(return_value=mock_builder_instance)

                with patch(
                    "codexlens.search.hybrid_search.LspBridge",
                    mock_bridge_class,
                ), patch(
                    "codexlens.search.hybrid_search.LspGraphBuilder",
                    mock_builder_class,
                ):
                    results = engine._search_lsp_graph(
                        index_path=tmp_index_path,
                        query="init_db",
                        limit=10,
                        max_depth=1,
                        max_nodes=20,
                    )

        # Verify fallback chain order: vector -> splade -> exact
        assert call_order == ["vector", "splade", "exact"]

        # All three methods should be called
        mock_vector.assert_called_once()
        mock_splade.assert_called_once()
        mock_exact.assert_called_once()

        # Should return results from graph expansion (1 related node)
        assert len(results) == 1


# -----------------------------------------------------------------------------
# P1: Important Tests
# -----------------------------------------------------------------------------


class TestP1ImportantLspSearch:
    """P1 Important: Edge case tests for LSP graph search."""

    def test_e2e_lsp_search_no_seeds_found(
        self,
        tmp_index_path: Path,
    ) -> None:
        """Test LSP search when no seeds found from any source.

        Input: query="non_existent_symbol"
        Mock: All seed search methods return []
        Assert: Returns [], LspBridge is not called
        """
        engine = HybridSearchEngine()

        with patch.object(
            engine, "_search_vector", return_value=[]
        ) as mock_vector, patch.object(
            engine, "_search_splade", return_value=[]
        ) as mock_splade, patch.object(
            engine, "_search_exact", return_value=[]
        ) as mock_exact:
            with patch("codexlens.search.hybrid_search.HAS_LSP", True):
                # LspBridge should NOT be called when no seeds
                mock_bridge_class = MagicMock()

                with patch(
                    "codexlens.search.hybrid_search.LspBridge",
                    mock_bridge_class,
                ):
                    results = engine._search_lsp_graph(
                        index_path=tmp_index_path,
                        query="non_existent_symbol",
                        limit=10,
                        max_depth=1,
                        max_nodes=20,
                    )

        # All search methods should be tried
        mock_vector.assert_called_once()
        mock_splade.assert_called_once()
        mock_exact.assert_called_once()

        # Should return empty list
        assert results == []

        # LspBridge should not be instantiated (no seeds)
        mock_bridge_class.assert_not_called()

    def test_e2e_lsp_search_bridge_fails(
        self,
        tmp_index_path: Path,
        sample_search_result: SearchResult,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        """Test graceful degradation when LspBridge connection fails.

        Mock: Seed search returns valid seed
        Mock: LspBridge raises exception during expansion
        Assert: Returns [], error handled gracefully
        """
        engine = HybridSearchEngine()

        with patch.object(
            engine, "_search_vector", return_value=[sample_search_result]
        ):
            with patch("codexlens.search.hybrid_search.HAS_LSP", True):
                # Make LspBridge raise an error during async context
                mock_bridge_class = MagicMock()
                mock_bridge_class.return_value.__aenter__ = AsyncMock(
                    side_effect=Exception("Connection refused")
                )
                mock_bridge_class.return_value.__aexit__ = AsyncMock(
                    return_value=None
                )

                mock_builder_class = MagicMock()

                with patch(
                    "codexlens.search.hybrid_search.LspBridge",
                    mock_bridge_class,
                ), patch(
                    "codexlens.search.hybrid_search.LspGraphBuilder",
                    mock_builder_class,
                ):
                    with caplog.at_level(logging.DEBUG):
                        results = engine._search_lsp_graph(
                            index_path=tmp_index_path,
                            query="authentication",
                            limit=10,
                            max_depth=1,
                            max_nodes=20,
                        )

        # Should return empty list on failure
        assert results == []


# -----------------------------------------------------------------------------
# P2: Supplementary Tests
# -----------------------------------------------------------------------------


class TestP2SupplementaryLspSearch:
    """P2 Supplementary: Deduplication and edge cases."""

    def test_result_deduping_seed_not_returned(
        self,
        tmp_index_path: Path,
        sample_search_result: SearchResult,
    ) -> None:
        """Test that seed results are deduplicated from final output.

        Mock: Seed search returns SearchResult(path="a.py", symbol_name="foo")
        Mock: LspBridge also returns same symbol in graph
        Assert: Final results do not contain duplicate seed symbol
        """
        engine = HybridSearchEngine()

        # Create a different node that should be returned
        different_node = CodeSymbolNode(
            id="/different/path.py:other_func:100",
            name="other_func",
            kind="function",
            file_path="/different/path.py",
            range=Range(
                start_line=100,
                start_character=0,
                end_line=110,
                end_character=0,
            ),
            raw_code="def other_func(): pass",
            docstring="Other function",
        )

        # Create mock graph with seed and one different node
        mock_graph = create_mock_graph_with_seed_and_related(
            sample_search_result,
            [different_node],
        )

        with patch.object(
            engine, "_search_vector", return_value=[sample_search_result]
        ):
            with patch("codexlens.search.hybrid_search.HAS_LSP", True):
                mock_bridge_instance = AsyncMock()
                mock_bridge_class = MagicMock()
                mock_bridge_class.return_value.__aenter__ = AsyncMock(
                    return_value=mock_bridge_instance
                )
                mock_bridge_class.return_value.__aexit__ = AsyncMock(
                    return_value=None
                )

                async def mock_build(seeds, bridge):
                    return mock_graph

                mock_builder_instance = MagicMock()
                mock_builder_instance.build_from_seeds = mock_build
                mock_builder_class = MagicMock(return_value=mock_builder_instance)

                with patch(
                    "codexlens.search.hybrid_search.LspBridge",
                    mock_bridge_class,
                ), patch(
                    "codexlens.search.hybrid_search.LspGraphBuilder",
                    mock_builder_class,
                ):
                    results = engine._search_lsp_graph(
                        index_path=tmp_index_path,
                        query="test query",
                        limit=10,
                        max_depth=1,
                        max_nodes=20,
                    )

        # Should only return 1 result (the different node, not the seed)
        assert len(results) == 1

        # The seed should NOT be in results
        result_paths = [r.path for r in results]
        assert sample_search_result.path not in result_paths

        # The different node should be in results
        assert "/different/path.py" in result_paths

    def test_lsp_not_available_returns_empty(
        self,
        tmp_index_path: Path,
    ) -> None:
        """Test that _search_lsp_graph returns [] when LSP dependencies unavailable."""
        engine = HybridSearchEngine()

        with patch("codexlens.search.hybrid_search.HAS_LSP", False):
            results = engine._search_lsp_graph(
                index_path=tmp_index_path,
                query="test",
                limit=10,
                max_depth=1,
                max_nodes=20,
            )

        assert results == []

    def test_graph_with_no_new_nodes_returns_empty(
        self,
        tmp_index_path: Path,
        sample_search_result: SearchResult,
    ) -> None:
        """Test when graph only contains seed nodes (no expansion)."""
        engine = HybridSearchEngine()

        # Create graph with ONLY the seed node (no related nodes)
        mock_graph = create_mock_graph_with_seed_and_related(
            sample_search_result,
            [],  # No related nodes
        )

        with patch.object(
            engine, "_search_vector", return_value=[sample_search_result]
        ):
            with patch("codexlens.search.hybrid_search.HAS_LSP", True):
                mock_bridge_instance = AsyncMock()
                mock_bridge_class = MagicMock()
                mock_bridge_class.return_value.__aenter__ = AsyncMock(
                    return_value=mock_bridge_instance
                )
                mock_bridge_class.return_value.__aexit__ = AsyncMock(
                    return_value=None
                )

                async def mock_build(seeds, bridge):
                    return mock_graph

                mock_builder_instance = MagicMock()
                mock_builder_instance.build_from_seeds = mock_build
                mock_builder_class = MagicMock(return_value=mock_builder_instance)

                with patch(
                    "codexlens.search.hybrid_search.LspBridge",
                    mock_bridge_class,
                ), patch(
                    "codexlens.search.hybrid_search.LspGraphBuilder",
                    mock_builder_class,
                ):
                    results = engine._search_lsp_graph(
                        index_path=tmp_index_path,
                        query="test",
                        limit=10,
                        max_depth=1,
                        max_nodes=20,
                    )

        # Should return empty since all nodes are seeds (filtered out)
        assert results == []
