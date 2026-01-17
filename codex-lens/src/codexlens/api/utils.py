"""Utility functions for the codexlens API.

This module provides helper functions for:
- Project resolution
- Relationship type normalization
- Result ranking by proximity
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional, TypeVar, Callable

from .models import DefinitionResult


# Type variable for generic ranking
T = TypeVar('T')


def resolve_project(project_root: str) -> Path:
    """Resolve and validate project root path.

    Args:
        project_root: Path to project root (relative or absolute)

    Returns:
        Resolved absolute Path

    Raises:
        ValueError: If path does not exist or is not a directory
    """
    path = Path(project_root).resolve()
    if not path.exists():
        raise ValueError(f"Project root does not exist: {path}")
    if not path.is_dir():
        raise ValueError(f"Project root is not a directory: {path}")
    return path


# Relationship type normalization mapping
_RELATIONSHIP_NORMALIZATION = {
    # Plural to singular
    "calls": "call",
    "imports": "import",
    "inherits": "inheritance",
    "uses": "use",
    # Already normalized (passthrough)
    "call": "call",
    "import": "import",
    "inheritance": "inheritance",
    "use": "use",
    "type_annotation": "type_annotation",
}


def normalize_relationship_type(relationship: str) -> str:
    """Normalize relationship type to canonical form.

    Converts plural forms and variations to standard singular forms:
    - 'calls' -> 'call'
    - 'imports' -> 'import'
    - 'inherits' -> 'inheritance'
    - 'uses' -> 'use'

    Args:
        relationship: Raw relationship type string

    Returns:
        Normalized relationship type

    Examples:
        >>> normalize_relationship_type('calls')
        'call'
        >>> normalize_relationship_type('inherits')
        'inheritance'
        >>> normalize_relationship_type('call')
        'call'
    """
    return _RELATIONSHIP_NORMALIZATION.get(relationship.lower(), relationship)


def rank_by_proximity(
    results: List[DefinitionResult],
    file_context: Optional[str] = None
) -> List[DefinitionResult]:
    """Rank results by file path proximity to context.

    V1 Implementation: Uses path-based proximity scoring.

    Scoring algorithm:
    1. Same directory: highest score (100)
    2. Otherwise: length of common path prefix

    Args:
        results: List of definition results to rank
        file_context: Reference file path for proximity calculation.
                     If None, returns results unchanged.

    Returns:
        Results sorted by proximity score (highest first)

    Examples:
        >>> results = [
        ...     DefinitionResult(name="foo", kind="function",
        ...                      file_path="/a/b/c.py", line=1, end_line=10),
        ...     DefinitionResult(name="foo", kind="function",
        ...                      file_path="/a/x/y.py", line=1, end_line=10),
        ... ]
        >>> ranked = rank_by_proximity(results, "/a/b/test.py")
        >>> ranked[0].file_path
        '/a/b/c.py'
    """
    if not file_context or not results:
        return results

    def proximity_score(result: DefinitionResult) -> int:
        """Calculate proximity score for a result."""
        result_dir = os.path.dirname(result.file_path)
        context_dir = os.path.dirname(file_context)

        # Same directory gets highest score
        if result_dir == context_dir:
            return 100

        # Otherwise, score by common path prefix length
        try:
            common = os.path.commonpath([result.file_path, file_context])
            return len(common)
        except ValueError:
            # No common path (different drives on Windows)
            return 0

    return sorted(results, key=proximity_score, reverse=True)


def rank_by_score(
    results: List[T],
    score_fn: Callable[[T], float],
    reverse: bool = True
) -> List[T]:
    """Generic ranking function by custom score.

    Args:
        results: List of items to rank
        score_fn: Function to extract score from item
        reverse: If True, highest scores first (default)

    Returns:
        Sorted list
    """
    return sorted(results, key=score_fn, reverse=reverse)
