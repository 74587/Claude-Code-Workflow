"""API dataclass definitions for codexlens LSP API.

This module defines all result dataclasses used by the public API layer,
following the patterns established in mcp/schema.py.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Tuple


# =============================================================================
# Section 4.2: file_context dataclasses
# =============================================================================

@dataclass
class CallInfo:
    """Call relationship information.

    Attributes:
        symbol_name: Name of the called/calling symbol
        file_path: Target file path (may be None if unresolved)
        line: Line number of the call
        relationship: Type of relationship (call | import | inheritance)
    """
    symbol_name: str
    file_path: Optional[str]
    line: int
    relationship: str  # call | import | inheritance

    def to_dict(self) -> dict:
        """Convert to dictionary, filtering None values."""
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class MethodContext:
    """Method context with call relationships.

    Attributes:
        name: Method/function name
        kind: Symbol kind (function | method | class)
        line_range: Start and end line numbers
        signature: Function signature (if available)
        calls: List of outgoing calls
        callers: List of incoming calls
    """
    name: str
    kind: str  # function | method | class
    line_range: Tuple[int, int]
    signature: Optional[str]
    calls: List[CallInfo] = field(default_factory=list)
    callers: List[CallInfo] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary, filtering None values."""
        result = {
            "name": self.name,
            "kind": self.kind,
            "line_range": list(self.line_range),
            "calls": [c.to_dict() for c in self.calls],
            "callers": [c.to_dict() for c in self.callers],
        }
        if self.signature is not None:
            result["signature"] = self.signature
        return result


@dataclass
class FileContextResult:
    """File context result with method summaries.

    Attributes:
        file_path: Path to the analyzed file
        language: Programming language
        methods: List of method contexts
        summary: Human-readable summary
        discovery_status: Status flags for call resolution
    """
    file_path: str
    language: str
    methods: List[MethodContext]
    summary: str
    discovery_status: Dict[str, bool] = field(default_factory=lambda: {
        "outgoing_resolved": False,
        "incoming_resolved": True,
        "targets_resolved": False
    })

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "file_path": self.file_path,
            "language": self.language,
            "methods": [m.to_dict() for m in self.methods],
            "summary": self.summary,
            "discovery_status": self.discovery_status,
        }


# =============================================================================
# Section 4.3: find_definition dataclasses
# =============================================================================

@dataclass
class DefinitionResult:
    """Definition lookup result.

    Attributes:
        name: Symbol name
        kind: Symbol kind (class, function, method, etc.)
        file_path: File where symbol is defined
        line: Start line number
        end_line: End line number
        signature: Symbol signature (if available)
        container: Containing class/module (if any)
        score: Match score for ranking
    """
    name: str
    kind: str
    file_path: str
    line: int
    end_line: int
    signature: Optional[str] = None
    container: Optional[str] = None
    score: float = 1.0

    def to_dict(self) -> dict:
        """Convert to dictionary, filtering None values."""
        return {k: v for k, v in asdict(self).items() if v is not None}


# =============================================================================
# Section 4.4: find_references dataclasses
# =============================================================================

@dataclass
class ReferenceResult:
    """Reference lookup result.

    Attributes:
        file_path: File containing the reference
        line: Line number
        column: Column number
        context_line: The line of code containing the reference
        relationship: Type of reference (call | import | type_annotation | inheritance)
    """
    file_path: str
    line: int
    column: int
    context_line: str
    relationship: str  # call | import | type_annotation | inheritance

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return asdict(self)


@dataclass
class GroupedReferences:
    """References grouped by definition.

    Used when a symbol has multiple definitions (e.g., overloads).

    Attributes:
        definition: The definition this group refers to
        references: List of references to this definition
    """
    definition: DefinitionResult
    references: List[ReferenceResult] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "definition": self.definition.to_dict(),
            "references": [r.to_dict() for r in self.references],
        }


# =============================================================================
# Section 4.5: workspace_symbols dataclasses
# =============================================================================

@dataclass
class SymbolInfo:
    """Symbol information for workspace search.

    Attributes:
        name: Symbol name
        kind: Symbol kind
        file_path: File where symbol is defined
        line: Line number
        container: Containing class/module (if any)
        score: Match score for ranking
    """
    name: str
    kind: str
    file_path: str
    line: int
    container: Optional[str] = None
    score: float = 1.0

    def to_dict(self) -> dict:
        """Convert to dictionary, filtering None values."""
        return {k: v for k, v in asdict(self).items() if v is not None}


# =============================================================================
# Section 4.6: get_hover dataclasses
# =============================================================================

@dataclass
class HoverInfo:
    """Hover information for a symbol.

    Attributes:
        name: Symbol name
        kind: Symbol kind
        signature: Symbol signature
        documentation: Documentation string (if available)
        file_path: File where symbol is defined
        line_range: Start and end line numbers
        type_info: Type information (if available)
    """
    name: str
    kind: str
    signature: str
    documentation: Optional[str]
    file_path: str
    line_range: Tuple[int, int]
    type_info: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary, filtering None values."""
        result = {
            "name": self.name,
            "kind": self.kind,
            "signature": self.signature,
            "file_path": self.file_path,
            "line_range": list(self.line_range),
        }
        if self.documentation is not None:
            result["documentation"] = self.documentation
        if self.type_info is not None:
            result["type_info"] = self.type_info
        return result


# =============================================================================
# Section 4.7: semantic_search dataclasses
# =============================================================================

@dataclass
class SemanticResult:
    """Semantic search result.

    Attributes:
        symbol_name: Name of the matched symbol
        kind: Symbol kind
        file_path: File where symbol is defined
        line: Line number
        vector_score: Vector similarity score (None if not available)
        structural_score: Structural match score (None if not available)
        fusion_score: Combined fusion score
        snippet: Code snippet
        match_reason: Explanation of why this matched (optional)
    """
    symbol_name: str
    kind: str
    file_path: str
    line: int
    vector_score: Optional[float]
    structural_score: Optional[float]
    fusion_score: float
    snippet: str
    match_reason: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert to dictionary, filtering None values."""
        return {k: v for k, v in asdict(self).items() if v is not None}
