"""Optional semantic search module for CodexLens.

Install with: pip install codexlens[semantic]
"""

from __future__ import annotations

SEMANTIC_AVAILABLE = False
_import_error: str | None = None

try:
    import numpy as np
    try:
        from fastembed import TextEmbedding
        SEMANTIC_BACKEND = "fastembed"
    except ImportError:
        try:
            from sentence_transformers import SentenceTransformer
            SEMANTIC_BACKEND = "sentence-transformers"
        except ImportError:
            raise ImportError("Neither fastembed nor sentence-transformers available")
    SEMANTIC_AVAILABLE = True
except ImportError as e:
    _import_error = str(e)
    SEMANTIC_BACKEND = None

def check_semantic_available() -> tuple[bool, str | None]:
    """Check if semantic search dependencies are available."""
    return SEMANTIC_AVAILABLE, _import_error

__all__ = ["SEMANTIC_AVAILABLE", "SEMANTIC_BACKEND", "check_semantic_available"]
