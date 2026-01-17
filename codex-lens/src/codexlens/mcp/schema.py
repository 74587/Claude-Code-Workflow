"""MCP data models."""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from typing import List, Optional


@dataclass
class SymbolInfo:
    """Information about a code symbol."""
    name: str
    kind: str
    file_path: str
    line_start: int
    line_end: int
    signature: Optional[str] = None
    documentation: Optional[str] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class ReferenceInfo:
    """Information about a symbol reference."""
    file_path: str
    line: int
    column: int
    context: str
    relationship_type: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class RelatedSymbol:
    """Related symbol (import, call target, etc.)."""
    name: str
    kind: str
    relationship: str  # "imports", "calls", "inherits", "uses"
    file_path: Optional[str] = None

    def to_dict(self) -> dict:
        return {k: v for k, v in asdict(self).items() if v is not None}


@dataclass
class MCPContext:
    """Model Context Protocol context object.

    This is the structured context that gets injected into
    LLM prompts to provide code understanding.
    """
    version: str = "1.0"
    context_type: str = "code_context"
    symbol: Optional[SymbolInfo] = None
    definition: Optional[str] = None
    references: List[ReferenceInfo] = field(default_factory=list)
    related_symbols: List[RelatedSymbol] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        result = {
            "version": self.version,
            "context_type": self.context_type,
            "metadata": self.metadata,
        }

        if self.symbol:
            result["symbol"] = self.symbol.to_dict()
        if self.definition:
            result["definition"] = self.definition
        if self.references:
            result["references"] = [r.to_dict() for r in self.references]
        if self.related_symbols:
            result["related_symbols"] = [s.to_dict() for s in self.related_symbols]

        return result

    def to_json(self, indent: int = 2) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), indent=indent)

    def to_prompt_injection(self) -> str:
        """Format for injection into LLM prompt."""
        parts = ["<code_context>"]

        if self.symbol:
            parts.append(f"## Symbol: {self.symbol.name}")
            parts.append(f"Type: {self.symbol.kind}")
            parts.append(f"Location: {self.symbol.file_path}:{self.symbol.line_start}")

        if self.definition:
            parts.append("\n## Definition")
            parts.append(f"```\n{self.definition}\n```")

        if self.references:
            parts.append(f"\n## References ({len(self.references)} found)")
            for ref in self.references[:5]:  # Limit to 5
                parts.append(f"- {ref.file_path}:{ref.line} ({ref.relationship_type})")
                parts.append(f"  ```\n  {ref.context}\n  ```")

        if self.related_symbols:
            parts.append("\n## Related Symbols")
            for sym in self.related_symbols[:10]:  # Limit to 10
                parts.append(f"- {sym.name} ({sym.relationship})")

        parts.append("</code_context>")
        return "\n".join(parts)
