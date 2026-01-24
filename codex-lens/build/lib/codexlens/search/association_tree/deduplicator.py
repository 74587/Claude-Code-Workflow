"""Result deduplication for association tree nodes.

Provides functionality to extract unique nodes from a call tree and assign
relevance scores based on various factors.
"""

from __future__ import annotations

import logging
from typing import Dict, List, Optional

from .data_structures import (
    CallTree,
    TreeNode,
    UniqueNode,
)

logger = logging.getLogger(__name__)


# Symbol kind weights for scoring (higher = more relevant)
KIND_WEIGHTS: Dict[str, float] = {
    # Functions and methods are primary targets
    "function": 1.0,
    "method": 1.0,
    "12": 1.0,  # LSP SymbolKind.Function
    "6": 1.0,   # LSP SymbolKind.Method
    # Classes are important but secondary
    "class": 0.8,
    "5": 0.8,   # LSP SymbolKind.Class
    # Interfaces and types
    "interface": 0.7,
    "11": 0.7,  # LSP SymbolKind.Interface
    "type": 0.6,
    # Constructors
    "constructor": 0.9,
    "9": 0.9,   # LSP SymbolKind.Constructor
    # Variables and constants
    "variable": 0.4,
    "13": 0.4,  # LSP SymbolKind.Variable
    "constant": 0.5,
    "14": 0.5,  # LSP SymbolKind.Constant
    # Default for unknown kinds
    "unknown": 0.3,
}


class ResultDeduplicator:
    """Extracts and scores unique nodes from call trees.

    Processes a CallTree to extract unique code locations, merging duplicates
    and assigning relevance scores based on:
        - Depth: Shallower nodes (closer to seeds) score higher
        - Frequency: Nodes appearing multiple times score higher
        - Kind: Function/method > class > variable

    Attributes:
        depth_weight: Weight for depth factor in scoring (default 0.4)
        frequency_weight: Weight for frequency factor (default 0.3)
        kind_weight: Weight for symbol kind factor (default 0.3)
        max_depth_penalty: Maximum depth before full penalty applied
    """

    def __init__(
        self,
        depth_weight: float = 0.4,
        frequency_weight: float = 0.3,
        kind_weight: float = 0.3,
        max_depth_penalty: int = 10,
    ):
        """Initialize ResultDeduplicator.

        Args:
            depth_weight: Weight for depth factor (0.0-1.0)
            frequency_weight: Weight for frequency factor (0.0-1.0)
            kind_weight: Weight for symbol kind factor (0.0-1.0)
            max_depth_penalty: Depth at which score becomes 0 for depth factor
        """
        self.depth_weight = depth_weight
        self.frequency_weight = frequency_weight
        self.kind_weight = kind_weight
        self.max_depth_penalty = max_depth_penalty

    def deduplicate(
        self,
        tree: CallTree,
        max_results: Optional[int] = None,
    ) -> List[UniqueNode]:
        """Extract unique nodes from the call tree.

        Traverses the tree, groups nodes by their unique key (file_path,
        start_line, end_line), and merges duplicate occurrences.

        Args:
            tree: CallTree to process
            max_results: Maximum number of results to return (None = all)

        Returns:
            List of UniqueNode objects, sorted by score descending
        """
        if not tree.node_list:
            return []

        # Group nodes by unique key
        unique_map: Dict[tuple, UniqueNode] = {}

        for node in tree.node_list:
            if node.is_cycle:
                # Skip cycle markers - they point to already-counted nodes
                continue

            key = self._get_node_key(node)

            if key in unique_map:
                # Update existing unique node
                unique_node = unique_map[key]
                unique_node.occurrences += 1
                unique_node.min_depth = min(unique_node.min_depth, node.depth)
                unique_node.add_path(node.path_from_root)

                # Collect context from relationships
                for parent in node.parents:
                    if not parent.is_cycle:
                        unique_node.context_nodes.append(parent.node_id)
                for child in node.children:
                    if not child.is_cycle:
                        unique_node.context_nodes.append(child.node_id)
            else:
                # Create new unique node
                unique_node = UniqueNode(
                    file_path=node.item.file_path,
                    name=node.item.name,
                    kind=node.item.kind,
                    range=node.item.range,
                    min_depth=node.depth,
                    occurrences=1,
                    paths=[node.path_from_root.copy()],
                    context_nodes=[],
                    score=0.0,
                )

                # Collect initial context
                for parent in node.parents:
                    if not parent.is_cycle:
                        unique_node.context_nodes.append(parent.node_id)
                for child in node.children:
                    if not child.is_cycle:
                        unique_node.context_nodes.append(child.node_id)

                unique_map[key] = unique_node

        # Calculate scores for all unique nodes
        unique_nodes = list(unique_map.values())

        # Find max frequency for normalization
        max_frequency = max((n.occurrences for n in unique_nodes), default=1)

        for node in unique_nodes:
            node.score = self._score_node(node, max_frequency)

        # Sort by score descending
        unique_nodes.sort(key=lambda n: n.score, reverse=True)

        # Apply max_results limit
        if max_results is not None and max_results > 0:
            unique_nodes = unique_nodes[:max_results]

        logger.debug(
            "Deduplicated %d tree nodes to %d unique nodes",
            len(tree.node_list),
            len(unique_nodes),
        )

        return unique_nodes

    def _score_node(
        self,
        node: UniqueNode,
        max_frequency: int,
    ) -> float:
        """Calculate composite score for a unique node.

        Score = depth_weight * depth_score +
                frequency_weight * frequency_score +
                kind_weight * kind_score

        Args:
            node: UniqueNode to score
            max_frequency: Maximum occurrence count for normalization

        Returns:
            Composite score between 0.0 and 1.0
        """
        # Depth score: closer to root = higher score
        # Score of 1.0 at depth 0, decreasing to 0.0 at max_depth_penalty
        depth_score = max(
            0.0,
            1.0 - (node.min_depth / self.max_depth_penalty),
        )

        # Frequency score: more occurrences = higher score
        frequency_score = node.occurrences / max_frequency if max_frequency > 0 else 0.0

        # Kind score: function/method > class > variable
        kind_str = str(node.kind).lower()
        kind_score = KIND_WEIGHTS.get(kind_str, KIND_WEIGHTS["unknown"])

        # Composite score
        score = (
            self.depth_weight * depth_score
            + self.frequency_weight * frequency_score
            + self.kind_weight * kind_score
        )

        return score

    def _get_node_key(self, node: TreeNode) -> tuple:
        """Get unique key for a tree node.

        Uses (file_path, start_line, end_line) as the unique identifier.

        Args:
            node: TreeNode

        Returns:
            Tuple key for deduplication
        """
        return (
            node.item.file_path,
            node.item.range.start_line,
            node.item.range.end_line,
        )

    def filter_by_kind(
        self,
        nodes: List[UniqueNode],
        kinds: List[str],
    ) -> List[UniqueNode]:
        """Filter unique nodes by symbol kind.

        Args:
            nodes: List of UniqueNode to filter
            kinds: List of allowed kinds (e.g., ["function", "method"])

        Returns:
            Filtered list of UniqueNode
        """
        kinds_lower = [k.lower() for k in kinds]
        return [
            node
            for node in nodes
            if str(node.kind).lower() in kinds_lower
        ]

    def filter_by_file(
        self,
        nodes: List[UniqueNode],
        file_patterns: List[str],
    ) -> List[UniqueNode]:
        """Filter unique nodes by file path patterns.

        Args:
            nodes: List of UniqueNode to filter
            file_patterns: List of path substrings to match

        Returns:
            Filtered list of UniqueNode
        """
        return [
            node
            for node in nodes
            if any(pattern in node.file_path for pattern in file_patterns)
        ]

    def to_dict_list(self, nodes: List[UniqueNode]) -> List[Dict]:
        """Convert list of UniqueNode to JSON-serializable dicts.

        Args:
            nodes: List of UniqueNode

        Returns:
            List of dictionaries
        """
        return [
            {
                "file_path": node.file_path,
                "name": node.name,
                "kind": node.kind,
                "range": {
                    "start_line": node.range.start_line,
                    "start_character": node.range.start_character,
                    "end_line": node.range.end_line,
                    "end_character": node.range.end_character,
                },
                "min_depth": node.min_depth,
                "occurrences": node.occurrences,
                "path_count": len(node.paths),
                "score": round(node.score, 4),
            }
            for node in nodes
        ]
