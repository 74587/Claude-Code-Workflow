"""Unit tests for association tree building and deduplication.

Tests the AssociationTreeBuilder and ResultDeduplicator components using
mocked LSP responses.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from codexlens.hybrid_search.data_structures import CallHierarchyItem, Range
from codexlens.search.association_tree import (
    AssociationTreeBuilder,
    CallTree,
    ResultDeduplicator,
    TreeNode,
    UniqueNode,
)


class MockLspManager:
    """Mock LSP manager for testing."""

    def __init__(self):
        """Initialize mock with empty responses."""
        self.call_hierarchy_items: Dict[str, List[Dict]] = {}
        self.incoming_calls: Dict[str, List[Dict]] = {}
        self.outgoing_calls: Dict[str, List[Dict]] = {}

    async def get_call_hierarchy_items(
        self, file_path: str, line: int, character: int, wait_for_analysis: float = 0.0
    ) -> List[Dict]:
        """Mock get_call_hierarchy_items."""
        key = f"{file_path}:{line}:{character}"
        return self.call_hierarchy_items.get(key, [])

    async def get_incoming_calls(self, item: Dict[str, Any]) -> List[Dict]:
        """Mock get_incoming_calls."""
        name = item.get("name", "")
        return self.incoming_calls.get(name, [])

    async def get_outgoing_calls(self, item: Dict[str, Any]) -> List[Dict]:
        """Mock get_outgoing_calls."""
        name = item.get("name", "")
        return self.outgoing_calls.get(name, [])


def create_mock_item(
    name: str,
    file_path: str,
    start_line: int,
    end_line: int,
    kind: str = "function",
) -> Dict[str, Any]:
    """Create a mock CallHierarchyItem dict.

    Args:
        name: Symbol name
        file_path: File path
        start_line: Start line (0-based for LSP)
        end_line: End line (0-based for LSP)
        kind: Symbol kind

    Returns:
        LSP CallHierarchyItem dict
    """
    return {
        "name": name,
        "kind": kind,
        "uri": f"file:///{file_path}",
        "range": {
            "start": {"line": start_line, "character": 0},
            "end": {"line": end_line, "character": 0},
        },
        "detail": f"def {name}(...)",
    }


@pytest.mark.asyncio
async def test_simple_tree_building():
    """Test building a simple tree with one root and one callee."""
    mock_lsp = MockLspManager()

    # Root function
    root_item = create_mock_item("main", "test.py", 10, 15)

    # Callee function
    callee_item = create_mock_item("helper", "test.py", 20, 25)

    # Setup mock responses
    mock_lsp.call_hierarchy_items["test.py:11:1"] = [root_item]
    mock_lsp.outgoing_calls["main"] = [{"to": callee_item}]
    mock_lsp.incoming_calls["main"] = []
    mock_lsp.outgoing_calls["helper"] = []
    mock_lsp.incoming_calls["helper"] = []

    # Build tree
    builder = AssociationTreeBuilder(mock_lsp)
    tree = await builder.build_tree(
        seed_file_path="test.py",
        seed_line=11,
        seed_character=1,
        max_depth=2,
        expand_callers=False,
        expand_callees=True,
    )

    # Assertions
    assert len(tree.roots) == 1
    assert tree.roots[0].item.name == "main"
    assert len(tree.roots[0].children) == 1
    assert tree.roots[0].children[0].item.name == "helper"
    assert len(tree.all_nodes) == 2


@pytest.mark.asyncio
async def test_tree_with_cycle_detection():
    """Test that cycles are properly detected and marked."""
    mock_lsp = MockLspManager()

    # Create circular reference: A -> B -> A
    item_a = create_mock_item("func_a", "test.py", 10, 15)
    item_b = create_mock_item("func_b", "test.py", 20, 25)

    # Setup mock responses
    mock_lsp.call_hierarchy_items["test.py:11:1"] = [item_a]
    mock_lsp.outgoing_calls["func_a"] = [{"to": item_b}]
    mock_lsp.outgoing_calls["func_b"] = [{"to": item_a}]  # Cycle
    mock_lsp.incoming_calls["func_a"] = []
    mock_lsp.incoming_calls["func_b"] = []

    # Build tree
    builder = AssociationTreeBuilder(mock_lsp)
    tree = await builder.build_tree(
        seed_file_path="test.py",
        seed_line=11,
        seed_character=1,
        max_depth=5,
        expand_callers=False,
        expand_callees=True,
    )

    # Should have 2 unique nodes (func_a and func_b)
    assert len(tree.all_nodes) == 2

    # func_b should have a cycle child pointing back to func_a
    func_b_node = None
    for node in tree.node_list:
        if node.item.name == "func_b":
            func_b_node = node
            break

    assert func_b_node is not None
    assert len(func_b_node.children) == 1
    assert func_b_node.children[0].is_cycle
    assert func_b_node.children[0].item.name == "func_a"


@pytest.mark.asyncio
async def test_max_depth_limit():
    """Test that expansion stops at max_depth."""
    mock_lsp = MockLspManager()

    # Chain: A -> B -> C -> D
    items = {
        "A": create_mock_item("func_a", "test.py", 10, 15),
        "B": create_mock_item("func_b", "test.py", 20, 25),
        "C": create_mock_item("func_c", "test.py", 30, 35),
        "D": create_mock_item("func_d", "test.py", 40, 45),
    }

    mock_lsp.call_hierarchy_items["test.py:11:1"] = [items["A"]]
    mock_lsp.outgoing_calls["func_a"] = [{"to": items["B"]}]
    mock_lsp.outgoing_calls["func_b"] = [{"to": items["C"]}]
    mock_lsp.outgoing_calls["func_c"] = [{"to": items["D"]}]
    mock_lsp.outgoing_calls["func_d"] = []

    for name in ["func_a", "func_b", "func_c", "func_d"]:
        mock_lsp.incoming_calls[name] = []

    # Build tree with max_depth=2
    builder = AssociationTreeBuilder(mock_lsp)
    tree = await builder.build_tree(
        seed_file_path="test.py",
        seed_line=11,
        max_depth=2,
        expand_callers=False,
        expand_callees=True,
    )

    # Should only have nodes A, B, C (depths 0, 1, 2)
    # D should not be included (would be depth 3)
    assert len(tree.all_nodes) == 3
    node_names = {node.item.name for node in tree.node_list}
    assert "func_a" in node_names
    assert "func_b" in node_names
    assert "func_c" in node_names
    assert "func_d" not in node_names


@pytest.mark.asyncio
async def test_empty_tree():
    """Test building tree when no call hierarchy items found."""
    mock_lsp = MockLspManager()

    # No items configured
    builder = AssociationTreeBuilder(mock_lsp)
    tree = await builder.build_tree(
        seed_file_path="test.py",
        seed_line=11,
        max_depth=2,
    )

    # Should have empty tree
    assert len(tree.roots) == 0
    assert len(tree.all_nodes) == 0


def test_deduplication_basic():
    """Test basic deduplication of tree nodes."""
    # Create test tree with duplicate nodes
    tree = CallTree()

    # Same function appearing at different depths via different paths
    # This simulates the real scenario where a function appears multiple times
    # in a call tree (e.g., reached from different callers)
    item_a1 = CallHierarchyItem(
        name="func_a",
        kind="function",
        file_path="test.py",
        range=Range(10, 0, 15, 0),
    )
    item_a2 = CallHierarchyItem(
        name="func_a",
        kind="function",
        file_path="test.py",
        range=Range(10, 0, 15, 0),  # Same range
    )

    node1 = TreeNode(item=item_a1, depth=0, path_from_root=["node1"])
    node2 = TreeNode(item=item_a2, depth=2, path_from_root=["root", "mid", "node2"])

    # Manually add to node_list to simulate same symbol from different paths
    tree.node_list.append(node1)
    tree.node_list.append(node2)

    # Different function
    item_b = CallHierarchyItem(
        name="func_b",
        kind="function",
        file_path="test.py",
        range=Range(20, 0, 25, 0),
    )
    node3 = TreeNode(item=item_b, depth=1, path_from_root=["root", "node3"])
    tree.node_list.append(node3)

    # Deduplicate
    deduplicator = ResultDeduplicator()
    unique_nodes = deduplicator.deduplicate(tree)

    # Should have 2 unique nodes (func_a merged, func_b separate)
    assert len(unique_nodes) == 2

    # func_a should have occurrences=2 and min_depth=0
    func_a_node = next(n for n in unique_nodes if n.name == "func_a")
    assert func_a_node.occurrences == 2
    assert func_a_node.min_depth == 0

    # func_b should have occurrences=1 and min_depth=1
    func_b_node = next(n for n in unique_nodes if n.name == "func_b")
    assert func_b_node.occurrences == 1
    assert func_b_node.min_depth == 1


def test_deduplication_scoring():
    """Test that scoring prioritizes depth and frequency correctly."""
    tree = CallTree()

    # Create nodes with different characteristics
    # Node at depth 0 (root)
    item1 = CallHierarchyItem(
        name="root_func",
        kind="function",
        file_path="test.py",
        range=Range(10, 0, 15, 0),
    )
    node1 = TreeNode(item=item1, depth=0)
    tree.add_node(node1)

    # Node at depth 5 (deep)
    item2 = CallHierarchyItem(
        name="deep_func",
        kind="function",
        file_path="test.py",
        range=Range(20, 0, 25, 0),
    )
    node2 = TreeNode(item=item2, depth=5)
    tree.add_node(node2)

    # Deduplicate and score
    deduplicator = ResultDeduplicator()
    unique_nodes = deduplicator.deduplicate(tree)

    # Root node should score higher than deep node
    root_node = next(n for n in unique_nodes if n.name == "root_func")
    deep_node = next(n for n in unique_nodes if n.name == "deep_func")

    assert root_node.score > deep_node.score


def test_deduplication_max_results():
    """Test that max_results limit works correctly."""
    tree = CallTree()

    # Create 5 unique nodes
    for i in range(5):
        item = CallHierarchyItem(
            name=f"func_{i}",
            kind="function",
            file_path="test.py",
            range=Range(i * 10, 0, i * 10 + 5, 0),
        )
        node = TreeNode(item=item, depth=i)
        tree.add_node(node)

    # Deduplicate with max_results=3
    deduplicator = ResultDeduplicator()
    unique_nodes = deduplicator.deduplicate(tree, max_results=3)

    # Should only return 3 nodes
    assert len(unique_nodes) == 3


def test_filter_by_kind():
    """Test filtering unique nodes by symbol kind."""
    # Create unique nodes with different kinds
    nodes = [
        UniqueNode(
            file_path="test.py",
            name="func1",
            kind="function",
            range=Range(10, 0, 15, 0),
        ),
        UniqueNode(
            file_path="test.py",
            name="cls1",
            kind="class",
            range=Range(20, 0, 30, 0),
        ),
        UniqueNode(
            file_path="test.py",
            name="var1",
            kind="variable",
            range=Range(40, 0, 40, 10),
        ),
    ]

    deduplicator = ResultDeduplicator()

    # Filter for functions only
    filtered = deduplicator.filter_by_kind(nodes, ["function"])
    assert len(filtered) == 1
    assert filtered[0].name == "func1"

    # Filter for functions and classes
    filtered = deduplicator.filter_by_kind(nodes, ["function", "class"])
    assert len(filtered) == 2


def test_to_dict_list():
    """Test conversion of unique nodes to dict list."""
    nodes = [
        UniqueNode(
            file_path="test.py",
            name="func1",
            kind="function",
            range=Range(10, 0, 15, 0),
            min_depth=0,
            occurrences=2,
            score=0.85,
        ),
    ]

    deduplicator = ResultDeduplicator()
    dict_list = deduplicator.to_dict_list(nodes)

    assert len(dict_list) == 1
    assert dict_list[0]["name"] == "func1"
    assert dict_list[0]["kind"] == "function"
    assert dict_list[0]["min_depth"] == 0
    assert dict_list[0]["occurrences"] == 2
    assert dict_list[0]["score"] == 0.85


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
