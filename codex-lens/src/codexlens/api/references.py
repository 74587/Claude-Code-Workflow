"""Find references API for codexlens.

This module implements the find_references() function that wraps
ChainSearchEngine.search_references() with grouped result structure
for multi-definition symbols.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional, Dict

from .models import (
    DefinitionResult,
    ReferenceResult,
    GroupedReferences,
)
from .utils import (
    resolve_project,
    normalize_relationship_type,
)


logger = logging.getLogger(__name__)


def _read_line_from_file(file_path: str, line: int) -> str:
    """Read a specific line from a file.

    Args:
        file_path: Path to the file
        line: Line number (1-based)

    Returns:
        The line content, stripped of trailing whitespace.
        Returns empty string if file cannot be read or line doesn't exist.
    """
    try:
        path = Path(file_path)
        if not path.exists():
            return ""

        with path.open("r", encoding="utf-8", errors="replace") as f:
            for i, content in enumerate(f, 1):
                if i == line:
                    return content.rstrip()
            return ""
    except Exception as exc:
        logger.debug("Failed to read line %d from %s: %s", line, file_path, exc)
        return ""


def _transform_to_reference_result(
    raw_ref: "RawReferenceResult",
) -> ReferenceResult:
    """Transform raw ChainSearchEngine reference to API ReferenceResult.

    Args:
        raw_ref: Raw reference result from ChainSearchEngine

    Returns:
        API ReferenceResult with context_line and normalized relationship
    """
    # Read the actual line from the file
    context_line = _read_line_from_file(raw_ref.file_path, raw_ref.line)

    # Normalize relationship type
    relationship = normalize_relationship_type(raw_ref.relationship_type)

    return ReferenceResult(
        file_path=raw_ref.file_path,
        line=raw_ref.line,
        column=raw_ref.column,
        context_line=context_line,
        relationship=relationship,
    )


def find_references(
    project_root: str,
    symbol_name: str,
    symbol_kind: Optional[str] = None,
    include_definition: bool = True,
    group_by_definition: bool = True,
    limit: int = 100,
) -> List[GroupedReferences]:
    """Find all reference locations for a symbol.

    Multi-definition case returns grouped results to resolve ambiguity.

    This function wraps ChainSearchEngine.search_references() and groups
    the results by definition location. Each GroupedReferences contains
    a definition and all references that point to it.

    Args:
        project_root: Project root directory path
        symbol_name: Name of the symbol to find references for
        symbol_kind: Optional symbol kind filter (e.g., 'function', 'class')
        include_definition: Whether to include the definition location
                           in the result (default True)
        group_by_definition: Whether to group references by definition.
                            If False, returns a single group with all references.
                            (default True)
        limit: Maximum number of references to return (default 100)

    Returns:
        List of GroupedReferences. Each group contains:
        - definition: The DefinitionResult for this symbol definition
        - references: List of ReferenceResult pointing to this definition

    Raises:
        ValueError: If project_root does not exist or is not a directory

    Examples:
        >>> refs = find_references("/path/to/project", "authenticate")
        >>> for group in refs:
        ...     print(f"Definition: {group.definition.file_path}:{group.definition.line}")
        ...     for ref in group.references:
        ...         print(f"  Reference: {ref.file_path}:{ref.line} ({ref.relationship})")

    Note:
        Reference relationship types are normalized:
        - 'calls' -> 'call'
        - 'imports' -> 'import'
        - 'inherits' -> 'inheritance'
    """
    # Validate and resolve project root
    project_path = resolve_project(project_root)

    # Import here to avoid circular imports
    from codexlens.config import Config
    from codexlens.storage.registry import RegistryStore
    from codexlens.storage.path_mapper import PathMapper
    from codexlens.storage.global_index import GlobalSymbolIndex
    from codexlens.search.chain_search import ChainSearchEngine
    from codexlens.search.chain_search import ReferenceResult as RawReferenceResult
    from codexlens.entities import Symbol

    # Initialize infrastructure
    config = Config()
    registry = RegistryStore(config.registry_db_path)
    mapper = PathMapper(config.index_root)

    # Create chain search engine
    engine = ChainSearchEngine(registry, mapper, config=config)

    try:
        # Step 1: Find definitions for the symbol
        definitions: List[DefinitionResult] = []

        if include_definition or group_by_definition:
            # Search for symbol definitions
            symbols = engine.search_symbols(
                name=symbol_name,
                source_path=project_path,
                kind=symbol_kind,
            )

            # Convert Symbol to DefinitionResult
            for sym in symbols:
                # Only include exact name matches for definitions
                if sym.name != symbol_name:
                    continue

                # Optionally filter by kind
                if symbol_kind and sym.kind != symbol_kind:
                    continue

                definitions.append(DefinitionResult(
                    name=sym.name,
                    kind=sym.kind,
                    file_path=sym.file or "",
                    line=sym.range[0] if sym.range else 1,
                    end_line=sym.range[1] if sym.range else 1,
                    signature=None,  # Not available from Symbol
                    container=None,  # Not available from Symbol
                    score=1.0,
                ))

        # Step 2: Get all references using ChainSearchEngine
        raw_references = engine.search_references(
            symbol_name=symbol_name,
            source_path=project_path,
            depth=-1,
            limit=limit,
        )

        # Step 3: Transform raw references to API ReferenceResult
        api_references: List[ReferenceResult] = []
        for raw_ref in raw_references:
            api_ref = _transform_to_reference_result(raw_ref)
            api_references.append(api_ref)

        # Step 4: Group references by definition
        if group_by_definition and definitions:
            return _group_references_by_definition(
                definitions=definitions,
                references=api_references,
                include_definition=include_definition,
            )
        else:
            # Return single group with placeholder definition or first definition
            if definitions:
                definition = definitions[0]
            else:
                # Create placeholder definition when no definition found
                definition = DefinitionResult(
                    name=symbol_name,
                    kind=symbol_kind or "unknown",
                    file_path="",
                    line=0,
                    end_line=0,
                    signature=None,
                    container=None,
                    score=0.0,
                )

            return [GroupedReferences(
                definition=definition,
                references=api_references,
            )]

    finally:
        engine.close()


def _group_references_by_definition(
    definitions: List[DefinitionResult],
    references: List[ReferenceResult],
    include_definition: bool = True,
) -> List[GroupedReferences]:
    """Group references by their likely definition.

    Uses file proximity heuristic to assign references to definitions.
    References in the same file or directory as a definition are
    assigned to that definition.

    Args:
        definitions: List of definition locations
        references: List of reference locations
        include_definition: Whether to include definition in results

    Returns:
        List of GroupedReferences with references assigned to definitions
    """
    import os

    if not definitions:
        return []

    if len(definitions) == 1:
        # Single definition - all references belong to it
        return [GroupedReferences(
            definition=definitions[0],
            references=references,
        )]

    # Multiple definitions - group by proximity
    groups: Dict[int, List[ReferenceResult]] = {
        i: [] for i in range(len(definitions))
    }

    for ref in references:
        # Find the closest definition by file proximity
        best_def_idx = 0
        best_score = -1

        for i, defn in enumerate(definitions):
            score = _proximity_score(ref.file_path, defn.file_path)
            if score > best_score:
                best_score = score
                best_def_idx = i

        groups[best_def_idx].append(ref)

    # Build result groups
    result: List[GroupedReferences] = []
    for i, defn in enumerate(definitions):
        # Skip definitions with no references if not including definition itself
        if not include_definition and not groups[i]:
            continue

        result.append(GroupedReferences(
            definition=defn,
            references=groups[i],
        ))

    return result


def _proximity_score(ref_path: str, def_path: str) -> int:
    """Calculate proximity score between two file paths.

    Args:
        ref_path: Reference file path
        def_path: Definition file path

    Returns:
        Proximity score (higher = closer):
        - Same file: 1000
        - Same directory: 100
        - Otherwise: common path prefix length
    """
    import os

    if not ref_path or not def_path:
        return 0

    # Normalize paths
    ref_path = os.path.normpath(ref_path)
    def_path = os.path.normpath(def_path)

    # Same file
    if ref_path == def_path:
        return 1000

    ref_dir = os.path.dirname(ref_path)
    def_dir = os.path.dirname(def_path)

    # Same directory
    if ref_dir == def_dir:
        return 100

    # Common path prefix
    try:
        common = os.path.commonpath([ref_path, def_path])
        return len(common)
    except ValueError:
        # No common path (different drives on Windows)
        return 0


# Type alias for the raw reference from ChainSearchEngine
class RawReferenceResult:
    """Type stub for ChainSearchEngine.ReferenceResult.

    This is only used for type hints and is replaced at runtime
    by the actual import.
    """
    file_path: str
    line: int
    column: int
    context: str
    relationship_type: str
