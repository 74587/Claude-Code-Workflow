"""CodexLens package."""

from __future__ import annotations

from . import config, entities, errors
from .config import Config
from .entities import IndexedFile, SearchResult, SemanticChunk, Symbol
from .errors import CodexLensError, ConfigError, ParseError, SearchError, StorageError

__version__ = "0.1.0"

__all__ = [
    "__version__",
    "config",
    "entities",
    "errors",
    "Config",
    "IndexedFile",
    "SearchResult",
    "SemanticChunk",
    "Symbol",
    "CodexLensError",
    "ConfigError",
    "ParseError",
    "StorageError",
    "SearchError",
]

