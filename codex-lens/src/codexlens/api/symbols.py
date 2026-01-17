"""workspace_symbols API implementation.

This module provides the workspace_symbols() function for searching
symbols across the entire workspace with prefix matching.
"""

from __future__ import annotations

import fnmatch
import logging
from pathlib import Path
from typing import List, Optional

from ..entities import Symbol
from ..storage.global_index import GlobalSymbolIndex
from ..storage.registry import RegistryStore
from ..errors import IndexNotFoundError
from .models import SymbolInfo
from .utils import resolve_project

logger = logging.getLogger(__name__)


def workspace_symbols(
    project_root: str,
    query: str,
    kind_filter: Optional[List[str]] = None,
    file_pattern: Optional[str] = None,
    limit: int = 50
) -> List[SymbolInfo]:
    """Search for symbols across the entire workspace.

    Uses prefix matching for efficient searching.

    Args:
        project_root: Project root directory (for index location)
        query: Search query (prefix match)
        kind_filter: Optional list of symbol kinds to include
                    (e.g., ["class", "function"])
        file_pattern: Optional glob pattern to filter by file path
                     (e.g., "*.py", "src/**/*.ts")
        limit: Maximum number of results to return

    Returns:
        List of SymbolInfo sorted by score

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

    # Search with prefix matching
    # If kind_filter has multiple kinds, we need to search for each
    all_results: List[Symbol] = []

    if kind_filter and len(kind_filter) > 0:
        # Search for each kind separately
        for kind in kind_filter:
            results = global_index.search(
                name=query,
                kind=kind,
                limit=limit,
                prefix_mode=True
            )
            all_results.extend(results)
    else:
        # Search without kind filter
        all_results = global_index.search(
            name=query,
            kind=None,
            limit=limit,
            prefix_mode=True
        )

    logger.debug(f"Found {len(all_results)} symbols matching '{query}'")

    # Apply file pattern filter if specified
    if file_pattern:
        all_results = [
            sym for sym in all_results
            if sym.file and fnmatch.fnmatch(sym.file, file_pattern)
        ]
        logger.debug(f"After file filter '{file_pattern}': {len(all_results)} symbols")

    # Convert to SymbolInfo and sort by relevance
    symbols = [
        SymbolInfo(
            name=sym.name,
            kind=sym.kind,
            file_path=sym.file or "",
            line=sym.range[0] if sym.range else 1,
            container=None,  # Could extract from parent
            score=_calculate_score(sym.name, query)
        )
        for sym in all_results
    ]

    # Sort by score (exact matches first)
    symbols.sort(key=lambda s: s.score, reverse=True)

    return symbols[:limit]


def _calculate_score(symbol_name: str, query: str) -> float:
    """Calculate relevance score for a symbol match.

    Scoring:
    - Exact match: 1.0
    - Prefix match: 0.8 + 0.2 * (query_len / symbol_len)
    - Case-insensitive match: 0.6

    Args:
        symbol_name: The matched symbol name
        query: The search query

    Returns:
        Score between 0.0 and 1.0
    """
    if symbol_name == query:
        return 1.0

    if symbol_name.lower() == query.lower():
        return 0.9

    if symbol_name.startswith(query):
        ratio = len(query) / len(symbol_name)
        return 0.8 + 0.2 * ratio

    if symbol_name.lower().startswith(query.lower()):
        ratio = len(query) / len(symbol_name)
        return 0.6 + 0.2 * ratio

    return 0.5
