"""get_hover API implementation.

This module provides the get_hover() function for retrieving
detailed hover information for symbols.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from ..entities import Symbol
from ..storage.global_index import GlobalSymbolIndex
from ..storage.registry import RegistryStore
from ..errors import IndexNotFoundError
from .models import HoverInfo
from .utils import resolve_project

logger = logging.getLogger(__name__)


def get_hover(
    project_root: str,
    symbol_name: str,
    file_path: Optional[str] = None
) -> Optional[HoverInfo]:
    """Get detailed hover information for a symbol.

    Args:
        project_root: Project root directory (for index location)
        symbol_name: Name of the symbol to look up
        file_path: Optional file path to disambiguate when symbol
                  appears in multiple files

    Returns:
        HoverInfo if symbol found, None otherwise

    Raises:
        IndexNotFoundError: If project is not indexed
    """
    project_path = resolve_project(project_root)

    # Get project info from registry
    registry = RegistryStore()
    project_info = registry.get_project(project_path)
    if project_info is None:
        raise IndexNotFoundError(f"Project not indexed: {project_path}")

    # Open global symbol index
    index_db = project_info.index_root / "_global_symbols.db"
    if not index_db.exists():
        raise IndexNotFoundError(f"Global symbol index not found: {index_db}")

    global_index = GlobalSymbolIndex(str(index_db), project_info.id)

    # Search for the symbol
    results = global_index.search(
        name=symbol_name,
        kind=None,
        limit=50,
        prefix_mode=False
    )

    if not results:
        logger.debug(f"No hover info found for {symbol_name}")
        return None

    # If file_path provided, filter to that file
    if file_path:
        file_path_resolved = str(Path(file_path).resolve())
        matching = [s for s in results if s.file == file_path_resolved]
        if matching:
            results = matching

    # Take the first result
    symbol = results[0]

    # Build hover info
    return HoverInfo(
        name=symbol.name,
        kind=symbol.kind,
        signature=_extract_signature(symbol),
        documentation=_extract_documentation(symbol),
        file_path=symbol.file or "",
        line_range=symbol.range if symbol.range else (1, 1),
        type_info=_extract_type_info(symbol)
    )


def _extract_signature(symbol: Symbol) -> str:
    """Extract signature from symbol.

    For now, generates a basic signature based on kind and name.
    In a full implementation, this would parse the actual source code.

    Args:
        symbol: The symbol to extract signature from

    Returns:
        Signature string
    """
    if symbol.kind == "function":
        return f"def {symbol.name}(...)"
    elif symbol.kind == "method":
        return f"def {symbol.name}(self, ...)"
    elif symbol.kind == "class":
        return f"class {symbol.name}"
    elif symbol.kind == "variable":
        return symbol.name
    elif symbol.kind == "constant":
        return f"{symbol.name} = ..."
    else:
        return f"{symbol.kind} {symbol.name}"


def _extract_documentation(symbol: Symbol) -> Optional[str]:
    """Extract documentation from symbol.

    In a full implementation, this would parse docstrings from source.
    For now, returns None.

    Args:
        symbol: The symbol to extract documentation from

    Returns:
        Documentation string if available, None otherwise
    """
    # Would need to read source file and parse docstring
    # For V1, return None
    return None


def _extract_type_info(symbol: Symbol) -> Optional[str]:
    """Extract type information from symbol.

    In a full implementation, this would parse type annotations.
    For now, returns None.

    Args:
        symbol: The symbol to extract type info from

    Returns:
        Type info string if available, None otherwise
    """
    # Would need to parse type annotations from source
    # For V1, return None
    return None
