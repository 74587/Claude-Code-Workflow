"""Optional semantic search module for CodexLens.

Install with: pip install codexlens[semantic]
Uses fastembed (ONNX-based, lightweight ~200MB)
"""

from __future__ import annotations

SEMANTIC_AVAILABLE = False
SEMANTIC_BACKEND: str | None = None
_import_error: str | None = None

def _detect_backend() -> tuple[bool, str | None, str | None]:
    """Detect if fastembed is available."""
    try:
        import numpy as np
    except ImportError as e:
        return False, None, f"numpy not available: {e}"

    try:
        from fastembed import TextEmbedding
        return True, "fastembed", None
    except ImportError:
        pass

    return False, None, "fastembed not available. Install with: pip install codexlens[semantic]"

# Initialize on module load
SEMANTIC_AVAILABLE, SEMANTIC_BACKEND, _import_error = _detect_backend()

def check_semantic_available() -> tuple[bool, str | None]:
    """Check if semantic search dependencies are available."""
    return SEMANTIC_AVAILABLE, _import_error

# Export LLM enhancement classes
try:
    from .llm_enhancer import (
        LLMEnhancer,
        LLMConfig,
        SemanticMetadata,
        FileData,
        EnhancedSemanticIndexer,
        create_enhancer,
        create_enhanced_indexer,
    )
    LLM_AVAILABLE = True
except ImportError:
    LLM_AVAILABLE = False
    LLMEnhancer = None  # type: ignore
    LLMConfig = None  # type: ignore
    SemanticMetadata = None  # type: ignore
    FileData = None  # type: ignore
    EnhancedSemanticIndexer = None  # type: ignore
    create_enhancer = None  # type: ignore
    create_enhanced_indexer = None  # type: ignore

__all__ = [
    "SEMANTIC_AVAILABLE",
    "SEMANTIC_BACKEND",
    "check_semantic_available",
    "LLM_AVAILABLE",
    "LLMEnhancer",
    "LLMConfig",
    "SemanticMetadata",
    "FileData",
    "EnhancedSemanticIndexer",
    "create_enhancer",
    "create_enhanced_indexer",
]
