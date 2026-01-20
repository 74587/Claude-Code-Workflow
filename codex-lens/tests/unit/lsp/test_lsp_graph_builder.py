"""Unit tests for LspGraphBuilder.

This module tests the LspGraphBuilder class responsible for building
code association graphs by BFS expansion from seed symbols using LSP.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from codexlens.hybrid_search.data_structures import (
    CallHierarchyItem,
    CodeAssociationGraph,
    CodeSymbolNode,
    Range,
)
from codexlens.lsp.lsp_bridge import Location, LspBridge
from codexlens.lsp.lsp_graph_builder import LspGraphBuilder


@pytest.fixture
def mock_lsp_bridge() -> AsyncMock:
    """Create a mock LspBridge with async methods."""
    bridge = AsyncMock(spec=LspBridge)
    bridge.get_references = AsyncMock(return_value=[])
    bridge.get_call_hierarchy = AsyncMock(return_value=[])
    bridge.get_document_symbols = AsyncMock(return_value=[])
    return bridge


@pytest.fixture
def seed_nodes() -> List[CodeSymbolNode]:
    """Create seed nodes for testing."""
    return [
        CodeSymbolNode(
            id="main.py:main:1",
            name="main",
            kind="function",
            file_path="main.py",
            range=Range(
                start_line=1,
                start_character=0,
                end_line=10,
                end_character=0,
            ),
        )
    ]


@pytest.fixture
def reference_location() -> Location:
    """Create a reference location for testing."""
    return Location(
        file_path="utils.py",
        line=5,
        character=10,
    )


@pytest.fixture
def call_hierarchy_item() -> CallHierarchyItem:
    """Create a call hierarchy item for testing."""
    return CallHierarchyItem(
        name="caller_func",
        kind="function",
        file_path="caller.py",
        range=Range(
            start_line=20,
            start_character=0,
            end_line=30,
            end_character=0,
        ),
        detail="Calls main()",
    )


class TestSingleLevelGraphExpansion:
    """P0: Test single level graph expansion with max_depth=1."""

    @pytest.mark.asyncio
    async def test_single_level_graph_expansion(
        self,
        mock_lsp_bridge: AsyncMock,
        seed_nodes: List[CodeSymbolNode],
        reference_location: Location,
        call_hierarchy_item: CallHierarchyItem,
    ) -> None:
        """Test BFS expansion at depth 1 produces correct graph structure.
        
        Input: max_depth=1, single seed node
        Mock: LspBridge returns 1 reference + 1 incoming call for seed only
        Assert: Graph contains 3 nodes (seed, ref, call) and 2 edges from seed
        """
        call_count = {"refs": 0, "calls": 0}
        
        async def mock_get_references(node: CodeSymbolNode) -> List[Location]:
            """Return references only for the seed node."""
            call_count["refs"] += 1
            if node.file_path == "main.py":
                return [reference_location]
            return []  # No references for expanded nodes
        
        async def mock_get_call_hierarchy(node: CodeSymbolNode) -> List[CallHierarchyItem]:
            """Return call hierarchy only for the seed node."""
            call_count["calls"] += 1
            if node.file_path == "main.py":
                return [call_hierarchy_item]
            return []  # No call hierarchy for expanded nodes
        
        mock_lsp_bridge.get_references.side_effect = mock_get_references
        mock_lsp_bridge.get_call_hierarchy.side_effect = mock_get_call_hierarchy
        
        # Mock document symbols to provide symbol info for locations
        mock_lsp_bridge.get_document_symbols.return_value = [
            {
                "name": "helper_func",
                "kind": 12,  # function
                "range": {
                    "start": {"line": 4, "character": 0},
                    "end": {"line": 10, "character": 0},
                },
            }
        ]
        
        builder = LspGraphBuilder(max_depth=1, max_nodes=100, max_concurrent=10)
        graph = await builder.build_from_seeds(seed_nodes, mock_lsp_bridge)
        
        # Verify graph structure
        assert len(graph.nodes) == 3, f"Expected 3 nodes, got {len(graph.nodes)}: {list(graph.nodes.keys())}"
        assert len(graph.edges) == 2, f"Expected 2 edges, got {len(graph.edges)}: {graph.edges}"
        
        # Verify seed node is present
        assert "main.py:main:1" in graph.nodes
        
        # Verify edges exist with correct relationship types
        edge_types = [edge[2] for edge in graph.edges]
        assert "references" in edge_types, "Expected 'references' edge"
        assert "calls" in edge_types, "Expected 'calls' edge"
        
        # Verify expansion was called for seed and expanded nodes
        # (nodes at depth 1 should not be expanded beyond max_depth=1)
        assert call_count["refs"] >= 1, "get_references should be called at least once"


class TestMaxNodesBoundary:
    """P0: Test max_nodes boundary stops expansion."""

    @pytest.mark.asyncio
    async def test_max_nodes_boundary(
        self,
        mock_lsp_bridge: AsyncMock,
        seed_nodes: List[CodeSymbolNode],
    ) -> None:
        """Test graph expansion stops when max_nodes is reached.
        
        Input: max_nodes=5
        Mock: LspBridge returns many references
        Assert: Graph expansion stops at 5 nodes
        """
        # Create many reference locations
        many_refs = [
            Location(file_path=f"file{i}.py", line=i, character=0)
            for i in range(20)
        ]
        mock_lsp_bridge.get_references.return_value = many_refs
        mock_lsp_bridge.get_call_hierarchy.return_value = []
        mock_lsp_bridge.get_document_symbols.return_value = []
        
        builder = LspGraphBuilder(max_depth=10, max_nodes=5, max_concurrent=10)
        graph = await builder.build_from_seeds(seed_nodes, mock_lsp_bridge)
        
        # Verify node count does not exceed max_nodes
        assert len(graph.nodes) <= 5, (
            f"Expected at most 5 nodes, got {len(graph.nodes)}"
        )


class TestMaxDepthBoundary:
    """P1: Test max_depth boundary limits BFS expansion."""

    @pytest.mark.asyncio
    async def test_max_depth_boundary(
        self,
        mock_lsp_bridge: AsyncMock,
        seed_nodes: List[CodeSymbolNode],
    ) -> None:
        """Test BFS queue does not add nodes beyond max_depth.
        
        Input: max_depth=2
        Mock: Multi-level expansion responses
        Assert: BFS queue stops adding new nodes when depth > 2
        """
        # Track which depths are expanded
        expanded_depths = set()
        
        def create_ref_for_depth(depth: int) -> Location:
            return Location(
                file_path=f"depth{depth}.py",
                line=depth * 10 + 1,
                character=0,
            )
        
        async def mock_get_references(node: CodeSymbolNode) -> List[Location]:
            """Return references based on node's apparent depth."""
            # Determine which depth level this node represents
            if node.file_path == "main.py":
                expanded_depths.add(0)
                return [create_ref_for_depth(1)]
            elif "depth1" in node.file_path:
                expanded_depths.add(1)
                return [create_ref_for_depth(2)]
            elif "depth2" in node.file_path:
                expanded_depths.add(2)
                return [create_ref_for_depth(3)]
            elif "depth3" in node.file_path:
                expanded_depths.add(3)
                return [create_ref_for_depth(4)]
            return []
        
        mock_lsp_bridge.get_references.side_effect = mock_get_references
        mock_lsp_bridge.get_call_hierarchy.return_value = []
        mock_lsp_bridge.get_document_symbols.return_value = []
        
        builder = LspGraphBuilder(max_depth=2, max_nodes=100, max_concurrent=10)
        graph = await builder.build_from_seeds(seed_nodes, mock_lsp_bridge)
        
        # Collect file paths from graph
        node_files = [node.file_path for node in graph.nodes.values()]
        
        # Should have: seed (main.py), depth1 (from seed expansion), depth2 (from depth1 expansion)
        # depth3 should only be added to graph but NOT expanded (depth > max_depth=2)
        assert "main.py" in node_files, "Seed node should be in graph"
        assert any("depth1" in f for f in node_files), "Depth 1 node should be in graph"
        assert any("depth2" in f for f in node_files), "Depth 2 node should be in graph"
        
        # The depth3 node might be added to the graph (from depth2 expansion)
        # but should NOT be expanded (no depth4 nodes should exist)
        depth4_nodes = [f for f in node_files if "depth4" in f]
        assert len(depth4_nodes) == 0, (
            f"Nodes beyond max_depth should not be expanded: {depth4_nodes}"
        )
        
        # Verify expansion didn't go to depth 3 (would mean depth4 nodes were created)
        # The depth 3 node itself may be in the graph but shouldn't have been expanded
        assert 3 not in expanded_depths or 4 not in expanded_depths, (
            f"Expansion should stop at max_depth, expanded depths: {expanded_depths}"
        )


class TestConcurrentSemaphore:
    """P1: Test concurrent semaphore limits parallel expansion."""

    @pytest.mark.asyncio
    async def test_concurrent_semaphore(
        self,
        mock_lsp_bridge: AsyncMock,
    ) -> None:
        """Test that concurrent node expansions are limited by semaphore.
        
        Input: max_concurrent=3, 10 nodes in queue
        Assert: Simultaneous _expand_node calls never exceed 3
        """
        concurrent_count = {"current": 0, "max_seen": 0}
        lock = asyncio.Lock()
        
        # Create multiple seed nodes
        seeds = [
            CodeSymbolNode(
                id=f"file{i}.py:func{i}:{i}",
                name=f"func{i}",
                kind="function",
                file_path=f"file{i}.py",
                range=Range(
                    start_line=i,
                    start_character=0,
                    end_line=i + 10,
                    end_character=0,
                ),
            )
            for i in range(10)
        ]
        
        original_get_refs = mock_lsp_bridge.get_references
        
        async def tracked_get_references(node: CodeSymbolNode) -> List[Location]:
            """Track concurrent calls to verify semaphore behavior."""
            async with lock:
                concurrent_count["current"] += 1
                if concurrent_count["current"] > concurrent_count["max_seen"]:
                    concurrent_count["max_seen"] = concurrent_count["current"]
            
            # Simulate some work
            await asyncio.sleep(0.01)
            
            async with lock:
                concurrent_count["current"] -= 1
            
            return []
        
        mock_lsp_bridge.get_references.side_effect = tracked_get_references
        mock_lsp_bridge.get_call_hierarchy.return_value = []
        mock_lsp_bridge.get_document_symbols.return_value = []
        
        builder = LspGraphBuilder(max_depth=1, max_nodes=100, max_concurrent=3)
        await builder.build_from_seeds(seeds, mock_lsp_bridge)
        
        # Verify concurrent calls never exceeded max_concurrent
        assert concurrent_count["max_seen"] <= 3, (
            f"Max concurrent calls ({concurrent_count['max_seen']}) exceeded limit (3)"
        )


class TestDocumentSymbolCache:
    """P1: Test document symbol caching for same file locations."""

    @pytest.mark.asyncio
    async def test_document_symbol_cache(
        self,
        mock_lsp_bridge: AsyncMock,
        seed_nodes: List[CodeSymbolNode],
    ) -> None:
        """Test that document symbols are cached per file.
        
        Input: 2 locations from the same file
        Mock: get_document_symbols only called once
        Assert: Second location lookup uses cache
        """
        # Two references from the same file
        refs_same_file = [
            Location(file_path="shared.py", line=10, character=0),
            Location(file_path="shared.py", line=20, character=0),
        ]
        
        mock_lsp_bridge.get_references.return_value = refs_same_file
        mock_lsp_bridge.get_call_hierarchy.return_value = []
        
        doc_symbols_call_count = {"count": 0}
        
        async def mock_get_document_symbols(file_path: str) -> List[Dict[str, Any]]:
            doc_symbols_call_count["count"] += 1
            return [
                {
                    "name": "symbol_at_10",
                    "kind": 12,
                    "range": {
                        "start": {"line": 9, "character": 0},
                        "end": {"line": 15, "character": 0},
                    },
                },
                {
                    "name": "symbol_at_20",
                    "kind": 12,
                    "range": {
                        "start": {"line": 19, "character": 0},
                        "end": {"line": 25, "character": 0},
                    },
                },
            ]
        
        mock_lsp_bridge.get_document_symbols.side_effect = mock_get_document_symbols
        
        builder = LspGraphBuilder(max_depth=1, max_nodes=100, max_concurrent=10)
        await builder.build_from_seeds(seed_nodes, mock_lsp_bridge)
        
        # get_document_symbols should be called only once for shared.py
        assert doc_symbols_call_count["count"] == 1, (
            f"Expected 1 call to get_document_symbols, got {doc_symbols_call_count['count']}"
        )
        
        # Verify cache contains the file
        assert "shared.py" in builder._document_symbols_cache
    
    @pytest.mark.asyncio
    async def test_cache_cleared_between_builds(
        self,
        mock_lsp_bridge: AsyncMock,
        seed_nodes: List[CodeSymbolNode],
    ) -> None:
        """Test that clear_cache removes cached document symbols."""
        mock_lsp_bridge.get_references.return_value = []
        mock_lsp_bridge.get_call_hierarchy.return_value = []
        mock_lsp_bridge.get_document_symbols.return_value = []
        
        builder = LspGraphBuilder(max_depth=1, max_nodes=100, max_concurrent=10)
        
        # Manually populate cache
        builder._document_symbols_cache["test.py"] = [{"name": "cached"}]
        
        # Clear cache
        builder.clear_cache()
        
        # Verify cache is empty
        assert len(builder._document_symbols_cache) == 0


class TestNodeExpansionErrorHandling:
    """P2: Test error handling during node expansion."""

    @pytest.mark.asyncio
    async def test_node_expansion_error_handling(
        self,
        mock_lsp_bridge: AsyncMock,
    ) -> None:
        """Test that errors in node expansion are logged and other nodes continue.
        
        Mock: get_references throws exception for specific node
        Assert: Error is logged, other nodes continue expanding
        """
        seeds = [
            CodeSymbolNode(
                id="good.py:good:1",
                name="good",
                kind="function",
                file_path="good.py",
                range=Range(start_line=1, start_character=0, end_line=10, end_character=0),
            ),
            CodeSymbolNode(
                id="bad.py:bad:1",
                name="bad",
                kind="function",
                file_path="bad.py",
                range=Range(start_line=1, start_character=0, end_line=10, end_character=0),
            ),
        ]
        
        async def mock_get_references(node: CodeSymbolNode) -> List[Location]:
            if "bad" in node.file_path:
                raise RuntimeError("Simulated LSP error")
            return [Location(file_path="result.py", line=5, character=0)]
        
        mock_lsp_bridge.get_references.side_effect = mock_get_references
        mock_lsp_bridge.get_call_hierarchy.return_value = []
        mock_lsp_bridge.get_document_symbols.return_value = []
        
        builder = LspGraphBuilder(max_depth=1, max_nodes=100, max_concurrent=10)
        
        # Should not raise, error should be caught and logged
        graph = await builder.build_from_seeds(seeds, mock_lsp_bridge)
        
        # Both seed nodes should be in the graph
        assert "good.py:good:1" in graph.nodes
        assert "bad.py:bad:1" in graph.nodes
        
        # The good node's expansion should have succeeded
        # (result.py node should be present)
        result_nodes = [n for n in graph.nodes.keys() if "result.py" in n]
        assert len(result_nodes) >= 1, "Good node's expansion should have succeeded"

    @pytest.mark.asyncio
    async def test_partial_failure_continues_expansion(
        self,
        mock_lsp_bridge: AsyncMock,
        seed_nodes: List[CodeSymbolNode],
    ) -> None:
        """Test that failure in one LSP call doesn't stop other calls."""
        # References succeed, call hierarchy fails
        mock_lsp_bridge.get_references.return_value = [
            Location(file_path="ref.py", line=5, character=0)
        ]
        mock_lsp_bridge.get_call_hierarchy.side_effect = RuntimeError("Call hierarchy failed")
        mock_lsp_bridge.get_document_symbols.return_value = []
        
        builder = LspGraphBuilder(max_depth=1, max_nodes=100, max_concurrent=10)
        graph = await builder.build_from_seeds(seed_nodes, mock_lsp_bridge)
        
        # Should still have the seed and the reference node
        assert len(graph.nodes) >= 2
        
        # Reference edge should exist
        ref_edges = [e for e in graph.edges if e[2] == "references"]
        assert len(ref_edges) >= 1, "Reference edge should exist despite call hierarchy failure"


class TestEdgeCases:
    """Additional edge case tests."""

    @pytest.mark.asyncio
    async def test_empty_seeds(
        self,
        mock_lsp_bridge: AsyncMock,
    ) -> None:
        """Test building graph with empty seed list."""
        builder = LspGraphBuilder(max_depth=2, max_nodes=100, max_concurrent=10)
        graph = await builder.build_from_seeds([], mock_lsp_bridge)
        
        assert len(graph.nodes) == 0
        assert len(graph.edges) == 0

    @pytest.mark.asyncio
    async def test_self_referencing_node_skipped(
        self,
        mock_lsp_bridge: AsyncMock,
        seed_nodes: List[CodeSymbolNode],
    ) -> None:
        """Test that self-references don't create self-loops."""
        # Reference back to the same node
        mock_lsp_bridge.get_references.return_value = [
            Location(file_path="main.py", line=1, character=0)  # Same as seed
        ]
        mock_lsp_bridge.get_call_hierarchy.return_value = []
        mock_lsp_bridge.get_document_symbols.return_value = [
            {
                "name": "main",
                "kind": 12,
                "range": {
                    "start": {"line": 0, "character": 0},
                    "end": {"line": 9, "character": 0},
                },
            }
        ]
        
        builder = LspGraphBuilder(max_depth=1, max_nodes=100, max_concurrent=10)
        graph = await builder.build_from_seeds(seed_nodes, mock_lsp_bridge)
        
        # Should only have the seed node, no self-loop edge
        # (Note: depending on implementation, self-references may be filtered)
        self_edges = [e for e in graph.edges if e[0] == e[1]]
        assert len(self_edges) == 0, "Self-referencing edges should not exist"

    @pytest.mark.asyncio
    async def test_visited_nodes_not_expanded_twice(
        self,
        mock_lsp_bridge: AsyncMock,
        seed_nodes: List[CodeSymbolNode],
    ) -> None:
        """Test that visited nodes are not expanded multiple times."""
        expansion_calls = {"count": 0}
        
        async def mock_get_references(node: CodeSymbolNode) -> List[Location]:
            expansion_calls["count"] += 1
            # Return same node reference each time
            return [Location(file_path="shared.py", line=10, character=0)]
        
        mock_lsp_bridge.get_references.side_effect = mock_get_references
        mock_lsp_bridge.get_call_hierarchy.return_value = []
        mock_lsp_bridge.get_document_symbols.return_value = []
        
        builder = LspGraphBuilder(max_depth=3, max_nodes=100, max_concurrent=10)
        await builder.build_from_seeds(seed_nodes, mock_lsp_bridge)
        
        # Each unique node should only be expanded once
        # seed (main.py) + shared.py = 2 expansions max
        assert expansion_calls["count"] <= 2, (
            f"Nodes should not be expanded multiple times, got {expansion_calls['count']} calls"
        )
