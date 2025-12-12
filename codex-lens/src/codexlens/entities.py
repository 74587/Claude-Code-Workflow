"""Pydantic entity models for CodexLens."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field, field_validator


class Symbol(BaseModel):
    """A code symbol discovered in a file."""

    name: str = Field(..., min_length=1)
    kind: str = Field(..., min_length=1)
    range: Tuple[int, int] = Field(..., description="(start_line, end_line), 1-based inclusive")

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


class SearchResult(BaseModel):
    """A unified search result for lexical or semantic search."""

    path: str = Field(..., min_length=1)
    score: float = Field(..., ge=0.0)
    excerpt: Optional[str] = None
    symbol: Optional[Symbol] = None
    chunk: Optional[SemanticChunk] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

