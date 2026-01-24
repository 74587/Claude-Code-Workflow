"""Association tree module for LSP-based code relationship discovery.

This module provides components for building and processing call association trees
using Language Server Protocol (LSP) call hierarchy capabilities.
"""

from .builder import AssociationTreeBuilder
from .data_structures import (
    CallTree,
    TreeNode,
    UniqueNode,
)
from .deduplicator import ResultDeduplicator

__all__ = [
    "AssociationTreeBuilder",
    "CallTree",
    "TreeNode",
    "UniqueNode",
    "ResultDeduplicator",
]
