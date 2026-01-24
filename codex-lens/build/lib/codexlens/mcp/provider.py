"""MCP context provider."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional, List, TYPE_CHECKING

from codexlens.mcp.schema import (
    MCPContext,
    SymbolInfo,
    ReferenceInfo,
    RelatedSymbol,
)

if TYPE_CHECKING:
    from codexlens.storage.global_index import GlobalSymbolIndex
    from codexlens.storage.registry import RegistryStore
    from codexlens.search.chain_search import ChainSearchEngine

logger = logging.getLogger(__name__)


class MCPProvider:
    """Builds MCP context objects from codex-lens data."""

    def __init__(
        self,
        global_index: "GlobalSymbolIndex",
        search_engine: "ChainSearchEngine",
        registry: "RegistryStore",
    ) -> None:
        self.global_index = global_index
        self.search_engine = search_engine
        self.registry = registry

    def build_context(
        self,
        symbol_name: str,
        context_type: str = "symbol_explanation",
        include_references: bool = True,
        include_related: bool = True,
        max_references: int = 10,
    ) -> Optional[MCPContext]:
        """Build comprehensive context for a symbol.

        Args:
            symbol_name: Name of the symbol to contextualize
            context_type: Type of context being requested
            include_references: Whether to include reference locations
            include_related: Whether to include related symbols
            max_references: Maximum number of references to include

        Returns:
            MCPContext object or None if symbol not found
        """
        # Look up symbol
        symbols = self.global_index.search(symbol_name, prefix_mode=False, limit=1)

        if not symbols:
            logger.debug(f"Symbol not found for MCP context: {symbol_name}")
            return None

        symbol = symbols[0]

        # Build SymbolInfo
        symbol_info = SymbolInfo(
            name=symbol.name,
            kind=symbol.kind,
            file_path=symbol.file or "",
            line_start=symbol.range[0],
            line_end=symbol.range[1],
            signature=None,  # Symbol entity doesn't have signature
            documentation=None,  # Symbol entity doesn't have docstring
        )

        # Extract definition source code
        definition = self._extract_definition(symbol)

        # Get references
        references = []
        if include_references:
            refs = self.search_engine.search_references(
                symbol_name,
                limit=max_references,
            )
            references = [
                ReferenceInfo(
                    file_path=r.file_path,
                    line=r.line,
                    column=r.column,
                    context=r.context,
                    relationship_type=r.relationship_type,
                )
                for r in refs
            ]

        # Get related symbols
        related_symbols = []
        if include_related:
            related_symbols = self._get_related_symbols(symbol)

        return MCPContext(
            context_type=context_type,
            symbol=symbol_info,
            definition=definition,
            references=references,
            related_symbols=related_symbols,
            metadata={
                "source": "codex-lens",
            },
        )

    def _extract_definition(self, symbol) -> Optional[str]:
        """Extract source code for symbol definition."""
        try:
            file_path = Path(symbol.file) if symbol.file else None
            if not file_path or not file_path.exists():
                return None

            content = file_path.read_text(encoding='utf-8', errors='ignore')
            lines = content.split("\n")

            start = symbol.range[0] - 1
            end = symbol.range[1]

            if start >= len(lines):
                return None

            return "\n".join(lines[start:end])
        except Exception as e:
            logger.debug(f"Failed to extract definition: {e}")
            return None

    def _get_related_symbols(self, symbol) -> List[RelatedSymbol]:
        """Get symbols related to the given symbol."""
        related = []

        try:
            # Search for symbols that might be related by name patterns
            # This is a simplified implementation - could be enhanced with relationship data

            # Look for imports/callers via reference search
            refs = self.search_engine.search_references(symbol.name, limit=20)

            seen_names = set()
            for ref in refs:
                # Extract potential symbol name from context
                if ref.relationship_type and ref.relationship_type not in seen_names:
                    related.append(RelatedSymbol(
                        name=f"{Path(ref.file_path).stem}",
                        kind="module",
                        relationship=ref.relationship_type,
                        file_path=ref.file_path,
                    ))
                    seen_names.add(ref.relationship_type)
                    if len(related) >= 10:
                        break

        except Exception as e:
            logger.debug(f"Failed to get related symbols: {e}")

        return related

    def build_context_for_file(
        self,
        file_path: Path,
        context_type: str = "file_overview",
    ) -> MCPContext:
        """Build context for an entire file."""
        # Try to get symbols by searching with file path
        # Note: GlobalSymbolIndex doesn't have search_by_file, so we use a different approach
        symbols = []

        # Search for common symbols that might be in this file
        # This is a simplified approach - a full implementation would query by file path
        try:
            # Use the global index to search for symbols from this file
            file_str = str(file_path.resolve())
            # Get all symbols and filter by file path (not efficient but works)
            all_symbols = self.global_index.search("", prefix_mode=True, limit=1000)
            symbols = [s for s in all_symbols if s.file and str(Path(s.file).resolve()) == file_str]
        except Exception as e:
            logger.debug(f"Failed to get file symbols: {e}")

        related = [
            RelatedSymbol(
                name=s.name,
                kind=s.kind,
                relationship="defines",
            )
            for s in symbols
        ]

        return MCPContext(
            context_type=context_type,
            related_symbols=related,
            metadata={
                "file_path": str(file_path),
                "symbol_count": len(symbols),
            },
        )
