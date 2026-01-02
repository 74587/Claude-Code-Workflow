"""Code indexing and symbol extraction."""
from codexlens.indexing.symbol_extractor import SymbolExtractor
from codexlens.indexing.embedding import (
    BinaryEmbeddingBackend,
    DenseEmbeddingBackend,
    CascadeEmbeddingBackend,
    get_cascade_embedder,
    binarize_embedding,
    pack_binary_embedding,
    unpack_binary_embedding,
    hamming_distance,
)

__all__ = [
    "SymbolExtractor",
    # Cascade embedding backends
    "BinaryEmbeddingBackend",
    "DenseEmbeddingBackend",
    "CascadeEmbeddingBackend",
    "get_cascade_embedder",
    # Utility functions
    "binarize_embedding",
    "pack_binary_embedding",
    "unpack_binary_embedding",
    "hamming_distance",
]
