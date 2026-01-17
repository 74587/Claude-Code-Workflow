"""Model Context Protocol implementation for Claude Code integration."""

from codexlens.mcp.schema import (
    MCPContext,
    SymbolInfo,
    ReferenceInfo,
    RelatedSymbol,
)
from codexlens.mcp.provider import MCPProvider
from codexlens.mcp.hooks import HookManager, create_context_for_prompt

__all__ = [
    "MCPContext",
    "SymbolInfo",
    "ReferenceInfo",
    "RelatedSymbol",
    "MCPProvider",
    "HookManager",
    "create_context_for_prompt",
]
