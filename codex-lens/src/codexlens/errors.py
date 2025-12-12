"""CodexLens exception hierarchy."""

from __future__ import annotations


class CodexLensError(Exception):
    """Base class for all CodexLens errors."""


class ConfigError(CodexLensError):
    """Raised when configuration is invalid or cannot be loaded."""


class ParseError(CodexLensError):
    """Raised when parsing or indexing a file fails."""


class StorageError(CodexLensError):
    """Raised when reading/writing index storage fails."""


class SearchError(CodexLensError):
    """Raised when a search operation fails."""

