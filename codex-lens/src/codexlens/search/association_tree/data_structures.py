"""Data structures for association tree building.

Defines the core data classes for representing call hierarchy trees and
deduplicated results.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from codexlens.hybrid_search.data_structures import CallHierarchyItem, Range


@dataclass
class TreeNode:
    """Node in the call association tree.

    Represents a single function/method in the tree, including its position
    in the hierarchy and relationships.

    Attributes:
        item: LSP CallHierarchyItem containing symbol information
        depth: Distance from the root node (seed) - 0 for roots
        children: List of child nodes (functions called by this node)
        parents: List of parent nodes (functions that call this node)
        is_cycle: Whether this node creates a circular reference
        path_from_root: Path (list of node IDs) from root to this node
    """

    item: CallHierarchyItem
    depth: int = 0
    children: List[TreeNode] = field(default_factory=list)
    parents: List[TreeNode] = field(default_factory=list)
    is_cycle: bool = False
    path_from_root: List[str] = field(default_factory=list)

    @property
    def node_id(self) -> str:
        """Unique identifier for this node."""
        return f"{self.item.file_path}:{self.item.name}:{self.item.range.start_line}"

    def __hash__(self) -> int:
        """Hash based on node ID."""
        return hash(self.node_id)

    def __eq__(self, other: object) -> bool:
        """Equality based on node ID."""
        if not isinstance(other, TreeNode):
            return False
        return self.node_id == other.node_id

    def __repr__(self) -> str:
        """String representation of the node."""
        cycle_marker = " [CYCLE]" if self.is_cycle else ""
        return f"TreeNode({self.item.name}@{self.item.file_path}:{self.item.range.start_line}){cycle_marker}"


@dataclass
class CallTree:
    """Complete call tree structure built from seeds.

    Contains all nodes discovered through recursive expansion and
    the relationships between them.

    Attributes:
        roots: List of root nodes (seed symbols)
        all_nodes: Dictionary mapping node_id -> TreeNode for quick lookup
        node_list: Flat list of all nodes in tree order
        edges: List of (from_node_id, to_node_id) tuples representing calls
        depth_reached: Maximum depth achieved in expansion
    """

    roots: List[TreeNode] = field(default_factory=list)
    all_nodes: Dict[str, TreeNode] = field(default_factory=dict)
    node_list: List[TreeNode] = field(default_factory=list)
    edges: List[tuple[str, str]] = field(default_factory=list)
    depth_reached: int = 0

    def add_node(self, node: TreeNode) -> None:
        """Add a node to the tree.

        Args:
            node: TreeNode to add
        """
        if node.node_id not in self.all_nodes:
            self.all_nodes[node.node_id] = node
            self.node_list.append(node)

    def add_edge(self, from_node: TreeNode, to_node: TreeNode) -> None:
        """Add an edge between two nodes.

        Args:
            from_node: Source node
            to_node: Target node
        """
        edge = (from_node.node_id, to_node.node_id)
        if edge not in self.edges:
            self.edges.append(edge)

    def get_node(self, node_id: str) -> Optional[TreeNode]:
        """Get a node by ID.

        Args:
            node_id: Node identifier

        Returns:
            TreeNode if found, None otherwise
        """
        return self.all_nodes.get(node_id)

    def __len__(self) -> int:
        """Return total number of nodes in tree."""
        return len(self.all_nodes)

    def __repr__(self) -> str:
        """String representation of the tree."""
        return (
            f"CallTree(roots={len(self.roots)}, nodes={len(self.all_nodes)}, "
            f"depth={self.depth_reached})"
        )


@dataclass
class UniqueNode:
    """Deduplicated unique code symbol from the tree.

    Represents a single unique code location that may appear multiple times
    in the tree under different contexts. Contains aggregated information
    about all occurrences.

    Attributes:
        file_path: Absolute path to the file
        name: Symbol name (function, method, class, etc.)
        kind: Symbol kind (function, method, class, etc.)
        range: Code range in the file
        min_depth: Minimum depth at which this node appears in the tree
        occurrences: Number of times this node appears in the tree
        paths: List of paths from roots to this node
        context_nodes: Related nodes from the tree
        score: Composite relevance score (higher is better)
    """

    file_path: str
    name: str
    kind: str
    range: Range
    min_depth: int = 0
    occurrences: int = 1
    paths: List[List[str]] = field(default_factory=list)
    context_nodes: List[str] = field(default_factory=list)
    score: float = 0.0

    @property
    def node_key(self) -> tuple[str, int, int]:
        """Unique key for deduplication.

        Uses (file_path, start_line, end_line) as the unique identifier
        for this symbol across all occurrences.
        """
        return (
            self.file_path,
            self.range.start_line,
            self.range.end_line,
        )

    def add_path(self, path: List[str]) -> None:
        """Add a path from root to this node.

        Args:
            path: List of node IDs from root to this node
        """
        if path not in self.paths:
            self.paths.append(path)

    def __hash__(self) -> int:
        """Hash based on node key."""
        return hash(self.node_key)

    def __eq__(self, other: object) -> bool:
        """Equality based on node key."""
        if not isinstance(other, UniqueNode):
            return False
        return self.node_key == other.node_key

    def __repr__(self) -> str:
        """String representation of the unique node."""
        return (
            f"UniqueNode({self.name}@{self.file_path}:{self.range.start_line}, "
            f"depth={self.min_depth}, occ={self.occurrences}, score={self.score:.2f})"
        )
