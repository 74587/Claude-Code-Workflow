"""CodexLens exception hierarchy."""

from __future__ import annotations


class CodexLensError(Exception):
    """Base class for all CodexLens errors."""


class ConfigError(CodexLensError):
    """Raised when configuration is invalid or cannot be loaded."""


class ParseError(CodexLensError):
    """Raised when parsing or indexing a file fails."""


class StorageError(CodexLensError):
    """Raised when reading/writing index storage fails.

    Attributes:
        message: Human-readable error description
        db_path: Path to the database file (if applicable)
        operation: The operation that failed (e.g., 'query', 'initialize', 'migrate')
        details: Additional context for debugging
    """

    def __init__(
        self,
        message: str,
        db_path: str | None = None,
        operation: str | None = None,
        details: dict | None = None
    ) -> None:
        super().__init__(message)
        self.message = message
        self.db_path = db_path
        self.operation = operation
        self.details = details or {}

    def __str__(self) -> str:
        parts = [self.message]
        if self.db_path:
            parts.append(f"[db: {self.db_path}]")
        if self.operation:
            parts.append(f"[op: {self.operation}]")
        if self.details:
            detail_str = ", ".join(f"{k}={v}" for k, v in self.details.items())
            parts.append(f"[{detail_str}]")
        return " ".join(parts)


class SearchError(CodexLensError):
    """Raised when a search operation fails."""

