"""Association tree builder using LSP call hierarchy.

Builds call relationship trees by recursively expanding from seed locations
using Language Server Protocol (LSP) call hierarchy capabilities.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Dict, List, Optional, Set

from codexlens.hybrid_search.data_structures import CallHierarchyItem, Range
from codexlens.lsp.standalone_manager import StandaloneLspManager
from .data_structures import CallTree, TreeNode

logger = logging.getLogger(__name__)


class AssociationTreeBuilder:
    """Builds association trees from seed locations using LSP call hierarchy.

    Uses depth-first recursive expansion to build a tree of code relationships
    starting from seed locations (typically from vector search results).

    Strategy:
        - Start from seed locations (vector search results)
        - For each seed, get call hierarchy items via LSP
        - Recursively expand incoming calls (callers) if expand_callers=True
        - Recursively expand outgoing calls (callees) if expand_callees=True
        - Track visited nodes to prevent cycles
        - Stop at max_depth or when no more relations found

    Attributes:
        lsp_manager: StandaloneLspManager for LSP communication
        visited: Set of visited node IDs to prevent cycles
        timeout: Timeout for individual LSP requests (seconds)
    """

    def __init__(
        self,
        lsp_manager: StandaloneLspManager,
        timeout: float = 5.0,
        analysis_wait: float = 2.0,
    ):
        """Initialize AssociationTreeBuilder.

        Args:
            lsp_manager: StandaloneLspManager instance for LSP communication
            timeout: Timeout for individual LSP requests in seconds
            analysis_wait: Time to wait for LSP analysis on first file (seconds)
        """
        self.lsp_manager = lsp_manager
        self.timeout = timeout
        self.analysis_wait = analysis_wait
        self.visited: Set[str] = set()
        self._analyzed_files: Set[str] = set()  # Track files already analyzed

    async def build_tree(
        self,
        seed_file_path: str,
        seed_line: int,
        seed_character: int = 1,
        max_depth: int = 5,
        expand_callers: bool = True,
        expand_callees: bool = True,
    ) -> CallTree:
        """Build call tree from a single seed location.

        Args:
            seed_file_path: Path to the seed file
            seed_line: Line number of the seed symbol (1-based)
            seed_character: Character position (1-based, default 1)
            max_depth: Maximum recursion depth (default 5)
            expand_callers: Whether to expand incoming calls (callers)
            expand_callees: Whether to expand outgoing calls (callees)

        Returns:
            CallTree containing all discovered nodes and relationships
        """
        tree = CallTree()
        self.visited.clear()

        # Determine wait time - only wait for analysis on first encounter of file
        wait_time = 0.0
        if seed_file_path not in self._analyzed_files:
            wait_time = self.analysis_wait
            self._analyzed_files.add(seed_file_path)

        # Get call hierarchy items for the seed position
        try:
            hierarchy_items = await asyncio.wait_for(
                self.lsp_manager.get_call_hierarchy_items(
                    file_path=seed_file_path,
                    line=seed_line,
                    character=seed_character,
                    wait_for_analysis=wait_time,
                ),
                timeout=self.timeout + wait_time,
            )
        except asyncio.TimeoutError:
            logger.warning(
                "Timeout getting call hierarchy items for %s:%d",
                seed_file_path,
                seed_line,
            )
            return tree
        except Exception as e:
            logger.error(
                "Error getting call hierarchy items for %s:%d: %s",
                seed_file_path,
                seed_line,
                e,
            )
            return tree

        if not hierarchy_items:
            logger.debug(
                "No call hierarchy items found for %s:%d",
                seed_file_path,
                seed_line,
            )
            return tree

        # Create root nodes from hierarchy items
        for item_dict in hierarchy_items:
            # Convert LSP dict to CallHierarchyItem
            item = self._dict_to_call_hierarchy_item(item_dict)
            if not item:
                continue

            root_node = TreeNode(
                item=item,
                depth=0,
                path_from_root=[self._create_node_id(item)],
            )
            tree.roots.append(root_node)
            tree.add_node(root_node)

            # Mark as visited
            self.visited.add(root_node.node_id)

            # Recursively expand the tree
            await self._expand_node(
                node=root_node,
                node_dict=item_dict,
                tree=tree,
                current_depth=0,
                max_depth=max_depth,
                expand_callers=expand_callers,
                expand_callees=expand_callees,
            )

        tree.depth_reached = max_depth
        return tree

    async def _expand_node(
        self,
        node: TreeNode,
        node_dict: Dict,
        tree: CallTree,
        current_depth: int,
        max_depth: int,
        expand_callers: bool,
        expand_callees: bool,
    ) -> None:
        """Recursively expand a node by fetching its callers and callees.

        Args:
            node: TreeNode to expand
            node_dict: LSP CallHierarchyItem dict (for LSP requests)
            tree: CallTree to add discovered nodes to
            current_depth: Current recursion depth
            max_depth: Maximum allowed depth
            expand_callers: Whether to expand incoming calls
            expand_callees: Whether to expand outgoing calls
        """
        # Stop if max depth reached
        if current_depth >= max_depth:
            return

        # Prepare tasks for parallel expansion
        tasks = []

        if expand_callers:
            tasks.append(
                self._expand_incoming_calls(
                    node=node,
                    node_dict=node_dict,
                    tree=tree,
                    current_depth=current_depth,
                    max_depth=max_depth,
                    expand_callers=expand_callers,
                    expand_callees=expand_callees,
                )
            )

        if expand_callees:
            tasks.append(
                self._expand_outgoing_calls(
                    node=node,
                    node_dict=node_dict,
                    tree=tree,
                    current_depth=current_depth,
                    max_depth=max_depth,
                    expand_callers=expand_callers,
                    expand_callees=expand_callees,
                )
            )

        # Execute expansions in parallel
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def _expand_incoming_calls(
        self,
        node: TreeNode,
        node_dict: Dict,
        tree: CallTree,
        current_depth: int,
        max_depth: int,
        expand_callers: bool,
        expand_callees: bool,
    ) -> None:
        """Expand incoming calls (callers) for a node.

        Args:
            node: TreeNode being expanded
            node_dict: LSP dict for the node
            tree: CallTree to add nodes to
            current_depth: Current depth
            max_depth: Maximum depth
            expand_callers: Whether to continue expanding callers
            expand_callees: Whether to expand callees
        """
        try:
            incoming_calls = await asyncio.wait_for(
                self.lsp_manager.get_incoming_calls(item=node_dict),
                timeout=self.timeout,
            )
        except asyncio.TimeoutError:
            logger.debug("Timeout getting incoming calls for %s", node.node_id)
            return
        except Exception as e:
            logger.debug("Error getting incoming calls for %s: %s", node.node_id, e)
            return

        if not incoming_calls:
            return

        # Process each incoming call
        for call_dict in incoming_calls:
            caller_dict = call_dict.get("from")
            if not caller_dict:
                continue

            # Convert to CallHierarchyItem
            caller_item = self._dict_to_call_hierarchy_item(caller_dict)
            if not caller_item:
                continue

            caller_id = self._create_node_id(caller_item)

            # Check for cycles
            if caller_id in self.visited:
                # Create cycle marker node
                cycle_node = TreeNode(
                    item=caller_item,
                    depth=current_depth + 1,
                    is_cycle=True,
                    path_from_root=node.path_from_root + [caller_id],
                )
                node.parents.append(cycle_node)
                continue

            # Create new caller node
            caller_node = TreeNode(
                item=caller_item,
                depth=current_depth + 1,
                path_from_root=node.path_from_root + [caller_id],
            )

            # Add to tree
            tree.add_node(caller_node)
            tree.add_edge(caller_node, node)

            # Update relationships
            node.parents.append(caller_node)
            caller_node.children.append(node)

            # Mark as visited
            self.visited.add(caller_id)

            # Recursively expand the caller
            await self._expand_node(
                node=caller_node,
                node_dict=caller_dict,
                tree=tree,
                current_depth=current_depth + 1,
                max_depth=max_depth,
                expand_callers=expand_callers,
                expand_callees=expand_callees,
            )

    async def _expand_outgoing_calls(
        self,
        node: TreeNode,
        node_dict: Dict,
        tree: CallTree,
        current_depth: int,
        max_depth: int,
        expand_callers: bool,
        expand_callees: bool,
    ) -> None:
        """Expand outgoing calls (callees) for a node.

        Args:
            node: TreeNode being expanded
            node_dict: LSP dict for the node
            tree: CallTree to add nodes to
            current_depth: Current depth
            max_depth: Maximum depth
            expand_callers: Whether to expand callers
            expand_callees: Whether to continue expanding callees
        """
        try:
            outgoing_calls = await asyncio.wait_for(
                self.lsp_manager.get_outgoing_calls(item=node_dict),
                timeout=self.timeout,
            )
        except asyncio.TimeoutError:
            logger.debug("Timeout getting outgoing calls for %s", node.node_id)
            return
        except Exception as e:
            logger.debug("Error getting outgoing calls for %s: %s", node.node_id, e)
            return

        if not outgoing_calls:
            return

        # Process each outgoing call
        for call_dict in outgoing_calls:
            callee_dict = call_dict.get("to")
            if not callee_dict:
                continue

            # Convert to CallHierarchyItem
            callee_item = self._dict_to_call_hierarchy_item(callee_dict)
            if not callee_item:
                continue

            callee_id = self._create_node_id(callee_item)

            # Check for cycles
            if callee_id in self.visited:
                # Create cycle marker node
                cycle_node = TreeNode(
                    item=callee_item,
                    depth=current_depth + 1,
                    is_cycle=True,
                    path_from_root=node.path_from_root + [callee_id],
                )
                node.children.append(cycle_node)
                continue

            # Create new callee node
            callee_node = TreeNode(
                item=callee_item,
                depth=current_depth + 1,
                path_from_root=node.path_from_root + [callee_id],
            )

            # Add to tree
            tree.add_node(callee_node)
            tree.add_edge(node, callee_node)

            # Update relationships
            node.children.append(callee_node)
            callee_node.parents.append(node)

            # Mark as visited
            self.visited.add(callee_id)

            # Recursively expand the callee
            await self._expand_node(
                node=callee_node,
                node_dict=callee_dict,
                tree=tree,
                current_depth=current_depth + 1,
                max_depth=max_depth,
                expand_callers=expand_callers,
                expand_callees=expand_callees,
            )

    def _dict_to_call_hierarchy_item(
        self, item_dict: Dict
    ) -> Optional[CallHierarchyItem]:
        """Convert LSP dict to CallHierarchyItem.

        Args:
            item_dict: LSP CallHierarchyItem dictionary

        Returns:
            CallHierarchyItem or None if conversion fails
        """
        try:
            # Extract URI and convert to file path
            uri = item_dict.get("uri", "")
            file_path = uri.replace("file:///", "").replace("file://", "")

            # Handle Windows paths (file:///C:/...)
            if len(file_path) > 2 and file_path[0] == "/" and file_path[2] == ":":
                file_path = file_path[1:]

            # Extract range
            range_dict = item_dict.get("range", {})
            start = range_dict.get("start", {})
            end = range_dict.get("end", {})

            # Create Range (convert from 0-based to 1-based)
            item_range = Range(
                start_line=start.get("line", 0) + 1,
                start_character=start.get("character", 0) + 1,
                end_line=end.get("line", 0) + 1,
                end_character=end.get("character", 0) + 1,
            )

            return CallHierarchyItem(
                name=item_dict.get("name", "unknown"),
                kind=str(item_dict.get("kind", "unknown")),
                file_path=file_path,
                range=item_range,
                detail=item_dict.get("detail"),
            )

        except Exception as e:
            logger.debug("Failed to convert dict to CallHierarchyItem: %s", e)
            return None

    def _create_node_id(self, item: CallHierarchyItem) -> str:
        """Create unique node ID from CallHierarchyItem.

        Args:
            item: CallHierarchyItem

        Returns:
            Unique node ID string
        """
        return f"{item.file_path}:{item.name}:{item.range.start_line}"
