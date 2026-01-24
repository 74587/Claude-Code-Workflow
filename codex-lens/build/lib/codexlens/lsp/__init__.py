"""LSP module for real-time language server integration.

This module provides:
- LspBridge: HTTP bridge to VSCode language servers
- LspGraphBuilder: Build code association graphs via LSP
- Location: Position in a source file

Example:
    >>> from codexlens.lsp import LspBridge, LspGraphBuilder
    >>> 
    >>> async with LspBridge() as bridge:
    ...     refs = await bridge.get_references(symbol)
    ...     graph = await LspGraphBuilder().build_from_seeds(seeds, bridge)
"""

from codexlens.lsp.lsp_bridge import (
    CacheEntry,
    Location,
    LspBridge,
)
from codexlens.lsp.lsp_graph_builder import (
    LspGraphBuilder,
)

# Alias for backward compatibility
GraphBuilder = LspGraphBuilder

__all__ = [
    "CacheEntry",
    "GraphBuilder",
    "Location",
    "LspBridge",
    "LspGraphBuilder",
]
