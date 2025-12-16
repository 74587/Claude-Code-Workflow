"""Pydantic entity models for CodexLens."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field, field_validator


class Symbol(BaseModel):
    """A code symbol discovered in a file."""

    name: str = Field(..., min_length=1)
    kind: str = Field(..., min_length=1)
    range: Tuple[int, int] = Field(..., description="(start_line, end_line), 1-based inclusive")
    file: Optional[str] = Field(default=None, description="Full path to the file containing this symbol")
    token_count: Optional[int] = Field(default=None, description="Token count for symbol content")
    symbol_type: Optional[str] = Field(default=None, description="Extended symbol type for filtering")

    @field_validator("range")
    @classmethod
    def validate_range(cls, value: Tuple[int, int]) -> Tuple[int, int]:
        if len(value) != 2:
            raise ValueError("range must be a (start_line, end_line) tuple")
        start_line, end_line = value
        if start_line < 1 or end_line < 1:
            raise ValueError("range lines must be >= 1")
        if end_line < start_line:
            raise ValueError("end_line must be >= start_line")
        return value

    @field_validator("token_count")
    @classmethod
    def validate_token_count(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value < 0:
            raise ValueError("token_count must be >= 0")
        return value


class SemanticChunk(BaseModel):
    """A semantically meaningful chunk of content, optionally embedded."""

    content: str = Field(..., min_length=1)
    embedding: Optional[List[float]] = Field(default=None, description="Vector embedding for semantic search")
    metadata: Dict[str, Any] = Field(default_factory=dict)

    @field_validator("embedding")
    @classmethod
    def validate_embedding(cls, value: Optional[List[float]]) -> Optional[List[float]]:
        if value is None:
            return value
        if not value:
            raise ValueError("embedding cannot be empty when provided")
        return value


class IndexedFile(BaseModel):
    """An indexed source file with symbols and optional semantic chunks."""

    path: str = Field(..., min_length=1)
    language: str = Field(..., min_length=1)
    symbols: List[Symbol] = Field(default_factory=list)
    chunks: List[SemanticChunk] = Field(default_factory=list)

    @field_validator("path", "language")
    @classmethod
    def strip_and_validate_nonempty(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("value cannot be blank")
        return cleaned


class CodeRelationship(BaseModel):
    """A relationship between code symbols (e.g., function calls, inheritance)."""

    source_symbol: str = Field(..., min_length=1, description="Name of source symbol")
    target_symbol: str = Field(..., min_length=1, description="Name of target symbol")
    relationship_type: str = Field(..., min_length=1, description="Type of relationship (call, inherits, etc.)")
    source_file: str = Field(..., min_length=1, description="File path containing source symbol")
    target_file: Optional[str] = Field(default=None, description="File path containing target (None if same file)")
    source_line: int = Field(..., ge=1, description="Line number where relationship occurs (1-based)")

    @field_validator("relationship_type")
    @classmethod
    def validate_relationship_type(cls, value: str) -> str:
        allowed_types = {"call", "inherits", "imports"}
        if value not in allowed_types:
            raise ValueError(f"relationship_type must be one of {allowed_types}")
        return value


class SearchResult(BaseModel):
    """A unified search result for lexical or semantic search."""

    path: str = Field(..., min_length=1)
    score: float = Field(..., ge=0.0)
    excerpt: Optional[str] = None
    content: Optional[str] = Field(default=None, description="Full content of matched code block")
    symbol: Optional[Symbol] = None
    chunk: Optional[SemanticChunk] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    
    # Additional context for complete code blocks
    start_line: Optional[int] = Field(default=None, description="Start line of code block (1-based)")
    end_line: Optional[int] = Field(default=None, description="End line of code block (1-based)")
    symbol_name: Optional[str] = Field(default=None, description="Name of matched symbol/function/class")
    symbol_kind: Optional[str] = Field(default=None, description="Kind of symbol (function/class/method)")

