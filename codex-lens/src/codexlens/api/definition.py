"""find_definition API implementation.

This module provides the find_definition() function for looking up
symbol definitions with a 3-stage fallback strategy.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional

from ..entities import Symbol
from ..storage.global_index import GlobalSymbolIndex
from ..storage.registry import RegistryStore
from ..errors import IndexNotFoundError
from .models import DefinitionResult
from .utils import resolve_project, rank_by_proximity

logger = logging.getLogger(__name__)


def find_definition(
    project_root: str,
    symbol_name: str,
    symbol_kind: Optional[str] = None,
    file_context: Optional[str] = None,
    limit: int = 10
) -> List[DefinitionResult]:
    """Find definition locations for a symbol.

    Uses a 3-stage fallback strategy:
        1. Exact match with kind filter
        2. Exact match without kind filter
        3. Prefix match

    Args:
        project_root: Project root directory (for index location)
        symbol_name: Name of the symbol to find
        symbol_kind: Optional symbol kind filter (class, function, etc.)
        file_context: Optional file path for proximity ranking
        limit: Maximum number of results to return

    Returns:
        List of DefinitionResult sorted by proximity if file_context provided

    Raises:
        IndexNotFoundError: If project is not indexed
    """
    project_path = resolve_project(project_root)

    # Get project info from registry
    registry = RegistryStore()
    project_info = registry.get_project_by_source(str(project_path))
    if project_info is None:
        raise IndexNotFoundError(f"Project not indexed: {project_path}")

    # Open global symbol index
    index_db = project_info.index_root / "_global_symbols.db"
    if not index_db.exists():
        raise IndexNotFoundError(f"Global symbol index not found: {index_db}")

    global_index = GlobalSymbolIndex(str(index_db), project_info.id)

    # Stage 1: Exact match with kind filter
    results = _search_with_kind(global_index, symbol_name, symbol_kind, limit)
    if results:
        logger.debug(f"Stage 1 (exact+kind): Found {len(results)} results for {symbol_name}")
        return _rank_and_convert(results, file_context)

    # Stage 2: Exact match without kind (if kind was specified)
    if symbol_kind:
        results = _search_with_kind(global_index, symbol_name, None, limit)
        if results:
            logger.debug(f"Stage 2 (exact): Found {len(results)} results for {symbol_name}")
            return _rank_and_convert(results, file_context)

    # Stage 3: Prefix match
    results = global_index.search(
        name=symbol_name,
        kind=None,
        limit=limit,
        prefix_mode=True
    )
    if results:
        logger.debug(f"Stage 3 (prefix): Found {len(results)} results for {symbol_name}")
        return _rank_and_convert(results, file_context)

    logger.debug(f"No definitions found for {symbol_name}")
    return []


def _search_with_kind(
    global_index: GlobalSymbolIndex,
    symbol_name: str,
    symbol_kind: Optional[str],
    limit: int
) -> List[Symbol]:
    """Search for symbols with optional kind filter."""
    return global_index.search(
        name=symbol_name,
        kind=symbol_kind,
        limit=limit,
        prefix_mode=False
    )


def _rank_and_convert(
    symbols: List[Symbol],
    file_context: Optional[str]
) -> List[DefinitionResult]:
    """Convert symbols to DefinitionResult and rank by proximity."""
    results = [
        DefinitionResult(
            name=sym.name,
            kind=sym.kind,
            file_path=sym.file or "",
            line=sym.range[0] if sym.range else 1,
            end_line=sym.range[1] if sym.range else 1,
            signature=None,  # Could extract from file if needed
            container=None,  # Could extract from parent symbol
            score=1.0
        )
        for sym in symbols
    ]
    return rank_by_proximity(results, file_context)
