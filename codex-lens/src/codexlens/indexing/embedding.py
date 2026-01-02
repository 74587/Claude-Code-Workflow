"""Multi-type embedding backends for cascade retrieval.

This module provides embedding backends optimized for cascade retrieval:
1. BinaryEmbeddingBackend - Fast coarse filtering with binary vectors
2. DenseEmbeddingBackend - High-precision dense vectors for reranking
3. CascadeEmbeddingBackend - Combined binary + dense for two-stage retrieval

Cascade retrieval workflow:
1. Binary search (fast, ~32 bytes/vector) -> top-K candidates
2. Dense rerank (precise, ~8KB/vector) -> final results
"""

from __future__ import annotations

import logging
from typing import Iterable, List, Optional, Tuple

import numpy as np

from codexlens.semantic.base import BaseEmbedder

logger = logging.getLogger(__name__)


# =============================================================================
# Utility Functions
# =============================================================================


def binarize_embedding(embedding: np.ndarray) -> np.ndarray:
    """Convert float embedding to binary vector.

    Applies sign-based quantization: values > 0 become 1, values <= 0 become 0.

    Args:
        embedding: Float32 embedding of any dimension

    Returns:
        Binary vector (uint8 with values 0 or 1) of same dimension
    """
    return (embedding > 0).astype(np.uint8)


def pack_binary_embedding(binary_vector: np.ndarray) -> bytes:
    """Pack binary vector into compact bytes format.

    Packs 8 binary values into each byte for storage efficiency.
    For a 256-dim binary vector, output is 32 bytes.

    Args:
        binary_vector: Binary vector (uint8 with values 0 or 1)

    Returns:
        Packed bytes (length = ceil(dim / 8))
    """
    # Ensure vector length is multiple of 8 by padding if needed
    dim = len(binary_vector)
    padded_dim = ((dim + 7) // 8) * 8
    if padded_dim > dim:
        padded = np.zeros(padded_dim, dtype=np.uint8)
        padded[:dim] = binary_vector
        binary_vector = padded

    # Pack 8 bits per byte
    packed = np.packbits(binary_vector)
    return packed.tobytes()


def unpack_binary_embedding(packed_bytes: bytes, dim: int = 256) -> np.ndarray:
    """Unpack bytes back to binary vector.

    Args:
        packed_bytes: Packed binary data
        dim: Original vector dimension (default: 256)

    Returns:
        Binary vector (uint8 with values 0 or 1)
    """
    unpacked = np.unpackbits(np.frombuffer(packed_bytes, dtype=np.uint8))
    return unpacked[:dim]


def hamming_distance(a: bytes, b: bytes) -> int:
    """Compute Hamming distance between two packed binary vectors.

    Uses XOR and popcount for efficient distance computation.

    Args:
        a: First packed binary vector
        b: Second packed binary vector

    Returns:
        Hamming distance (number of differing bits)
    """
    a_arr = np.frombuffer(a, dtype=np.uint8)
    b_arr = np.frombuffer(b, dtype=np.uint8)
    xor = np.bitwise_xor(a_arr, b_arr)
    return int(np.unpackbits(xor).sum())


# =============================================================================
# Binary Embedding Backend
# =============================================================================


class BinaryEmbeddingBackend(BaseEmbedder):
    """Generate 256-dimensional binary embeddings for fast coarse retrieval.

    Uses a lightweight embedding model and applies sign-based quantization
    to produce compact binary vectors (32 bytes per embedding).

    Suitable for:
    - First-stage candidate retrieval
    - Hamming distance-based similarity search
    - Memory-constrained environments

    Model: sentence-transformers/all-MiniLM-L6-v2 (384 dim) -> quantized to 256 bits
    """

    DEFAULT_MODEL = "BAAI/bge-small-en-v1.5"  # 384 dim, fast
    BINARY_DIM = 256

    def __init__(
        self,
        model_name: Optional[str] = None,
        use_gpu: bool = True,
    ) -> None:
        """Initialize binary embedding backend.

        Args:
            model_name: Base embedding model name. Defaults to BAAI/bge-small-en-v1.5
            use_gpu: Whether to use GPU acceleration
        """
        from codexlens.semantic import SEMANTIC_AVAILABLE

        if not SEMANTIC_AVAILABLE:
            raise ImportError(
                "Semantic search dependencies not available. "
                "Install with: pip install codexlens[semantic]"
            )

        self._model_name = model_name or self.DEFAULT_MODEL
        self._use_gpu = use_gpu
        self._model = None

        # Projection matrix for dimension reduction (lazily initialized)
        self._projection_matrix: Optional[np.ndarray] = None

    @property
    def model_name(self) -> str:
        """Return model name."""
        return self._model_name

    @property
    def embedding_dim(self) -> int:
        """Return binary embedding dimension (256)."""
        return self.BINARY_DIM

    @property
    def packed_bytes(self) -> int:
        """Return packed bytes size (32 bytes for 256 bits)."""
        return self.BINARY_DIM // 8

    def _load_model(self) -> None:
        """Lazy load the embedding model."""
        if self._model is not None:
            return

        from fastembed import TextEmbedding
        from codexlens.semantic.gpu_support import get_optimal_providers

        providers = get_optimal_providers(use_gpu=self._use_gpu, with_device_options=True)
        try:
            self._model = TextEmbedding(
                model_name=self._model_name,
                providers=providers,
            )
        except TypeError:
            # Fallback for older fastembed versions
            self._model = TextEmbedding(model_name=self._model_name)

        logger.debug(f"BinaryEmbeddingBackend loaded model: {self._model_name}")

    def _get_projection_matrix(self, input_dim: int) -> np.ndarray:
        """Get or create projection matrix for dimension reduction.

        Uses random projection with fixed seed for reproducibility.

        Args:
            input_dim: Input embedding dimension from base model

        Returns:
            Projection matrix of shape (input_dim, BINARY_DIM)
        """
        if self._projection_matrix is not None:
            return self._projection_matrix

        # Fixed seed for reproducibility across sessions
        rng = np.random.RandomState(42)
        # Gaussian random projection
        self._projection_matrix = rng.randn(input_dim, self.BINARY_DIM).astype(np.float32)
        # Normalize columns for consistent scale
        norms = np.linalg.norm(self._projection_matrix, axis=0, keepdims=True)
        self._projection_matrix /= (norms + 1e-8)

        return self._projection_matrix

    def embed_to_numpy(self, texts: str | Iterable[str]) -> np.ndarray:
        """Generate binary embeddings as numpy array.

        Args:
            texts: Single text or iterable of texts

        Returns:
            Binary embeddings of shape (n_texts, 256) with values 0 or 1
        """
        self._load_model()

        if isinstance(texts, str):
            texts = [texts]
        else:
            texts = list(texts)

        # Get base float embeddings
        float_embeddings = np.array(list(self._model.embed(texts)))
        input_dim = float_embeddings.shape[1]

        # Project to target dimension if needed
        if input_dim != self.BINARY_DIM:
            projection = self._get_projection_matrix(input_dim)
            float_embeddings = float_embeddings @ projection

        # Binarize
        return binarize_embedding(float_embeddings)

    def embed_packed(self, texts: str | Iterable[str]) -> List[bytes]:
        """Generate packed binary embeddings.

        Args:
            texts: Single text or iterable of texts

        Returns:
            List of packed bytes (32 bytes each for 256-dim)
        """
        binary = self.embed_to_numpy(texts)
        return [pack_binary_embedding(vec) for vec in binary]


# =============================================================================
# Dense Embedding Backend
# =============================================================================


class DenseEmbeddingBackend(BaseEmbedder):
    """Generate high-dimensional dense embeddings for precise reranking.

    Uses large embedding models to produce 2048-dimensional float32 vectors
    for maximum retrieval quality.

    Suitable for:
    - Second-stage reranking
    - High-precision similarity search
    - Quality-critical applications

    Model: BAAI/bge-large-en-v1.5 (1024 dim) with optional expansion
    """

    DEFAULT_MODEL = "BAAI/bge-large-en-v1.5"  # 1024 dim, high quality
    TARGET_DIM = 2048

    def __init__(
        self,
        model_name: Optional[str] = None,
        use_gpu: bool = True,
        expand_dim: bool = True,
    ) -> None:
        """Initialize dense embedding backend.

        Args:
            model_name: Dense embedding model name. Defaults to BAAI/bge-large-en-v1.5
            use_gpu: Whether to use GPU acceleration
            expand_dim: If True, expand embeddings to TARGET_DIM using learned expansion
        """
        from codexlens.semantic import SEMANTIC_AVAILABLE

        if not SEMANTIC_AVAILABLE:
            raise ImportError(
                "Semantic search dependencies not available. "
                "Install with: pip install codexlens[semantic]"
            )

        self._model_name = model_name or self.DEFAULT_MODEL
        self._use_gpu = use_gpu
        self._expand_dim = expand_dim
        self._model = None
        self._native_dim: Optional[int] = None

        # Expansion matrix for dimension expansion (lazily initialized)
        self._expansion_matrix: Optional[np.ndarray] = None

    @property
    def model_name(self) -> str:
        """Return model name."""
        return self._model_name

    @property
    def embedding_dim(self) -> int:
        """Return embedding dimension.

        Returns TARGET_DIM if expand_dim is True, otherwise native model dimension.
        """
        if self._expand_dim:
            return self.TARGET_DIM
        # Return cached native dim or estimate based on model
        if self._native_dim is not None:
            return self._native_dim
        # Model dimension estimates
        model_dims = {
            "BAAI/bge-large-en-v1.5": 1024,
            "BAAI/bge-base-en-v1.5": 768,
            "BAAI/bge-small-en-v1.5": 384,
            "intfloat/multilingual-e5-large": 1024,
        }
        return model_dims.get(self._model_name, 1024)

    @property
    def max_tokens(self) -> int:
        """Return maximum token limit."""
        return 512  # Conservative default for large models

    def _load_model(self) -> None:
        """Lazy load the embedding model."""
        if self._model is not None:
            return

        from fastembed import TextEmbedding
        from codexlens.semantic.gpu_support import get_optimal_providers

        providers = get_optimal_providers(use_gpu=self._use_gpu, with_device_options=True)
        try:
            self._model = TextEmbedding(
                model_name=self._model_name,
                providers=providers,
            )
        except TypeError:
            self._model = TextEmbedding(model_name=self._model_name)

        logger.debug(f"DenseEmbeddingBackend loaded model: {self._model_name}")

    def _get_expansion_matrix(self, input_dim: int) -> np.ndarray:
        """Get or create expansion matrix for dimension expansion.

        Uses random orthogonal projection for information-preserving expansion.

        Args:
            input_dim: Input embedding dimension from base model

        Returns:
            Expansion matrix of shape (input_dim, TARGET_DIM)
        """
        if self._expansion_matrix is not None:
            return self._expansion_matrix

        # Fixed seed for reproducibility
        rng = np.random.RandomState(123)

        # Create semi-orthogonal expansion matrix
        # First input_dim columns form identity-like structure
        self._expansion_matrix = np.zeros((input_dim, self.TARGET_DIM), dtype=np.float32)

        # Copy original dimensions
        copy_dim = min(input_dim, self.TARGET_DIM)
        self._expansion_matrix[:copy_dim, :copy_dim] = np.eye(copy_dim, dtype=np.float32)

        # Fill remaining with random projections
        if self.TARGET_DIM > input_dim:
            random_part = rng.randn(input_dim, self.TARGET_DIM - input_dim).astype(np.float32)
            # Normalize
            norms = np.linalg.norm(random_part, axis=0, keepdims=True)
            random_part /= (norms + 1e-8)
            self._expansion_matrix[:, input_dim:] = random_part

        return self._expansion_matrix

    def embed_to_numpy(self, texts: str | Iterable[str]) -> np.ndarray:
        """Generate dense embeddings as numpy array.

        Args:
            texts: Single text or iterable of texts

        Returns:
            Dense embeddings of shape (n_texts, TARGET_DIM) as float32
        """
        self._load_model()

        if isinstance(texts, str):
            texts = [texts]
        else:
            texts = list(texts)

        # Get base float embeddings
        float_embeddings = np.array(list(self._model.embed(texts)), dtype=np.float32)
        self._native_dim = float_embeddings.shape[1]

        # Expand to target dimension if needed
        if self._expand_dim and self._native_dim < self.TARGET_DIM:
            expansion = self._get_expansion_matrix(self._native_dim)
            float_embeddings = float_embeddings @ expansion

        return float_embeddings


# =============================================================================
# Cascade Embedding Backend
# =============================================================================


class CascadeEmbeddingBackend(BaseEmbedder):
    """Combined binary + dense embedding backend for cascade retrieval.

    Generates both binary (for fast coarse filtering) and dense (for precise
    reranking) embeddings in a single pass, optimized for two-stage retrieval.

    Cascade workflow:
    1. encode_cascade() returns (binary_embeddings, dense_embeddings)
    2. Binary search: Use Hamming distance on binary vectors -> top-K candidates
    3. Dense rerank: Use cosine similarity on dense vectors -> final results

    Memory efficiency:
    - Binary: 32 bytes per vector (256 bits)
    - Dense: 8192 bytes per vector (2048 x float32)
    - Total: ~8KB per document for full cascade support
    """

    def __init__(
        self,
        binary_model: Optional[str] = None,
        dense_model: Optional[str] = None,
        use_gpu: bool = True,
    ) -> None:
        """Initialize cascade embedding backend.

        Args:
            binary_model: Model for binary embeddings. Defaults to BAAI/bge-small-en-v1.5
            dense_model: Model for dense embeddings. Defaults to BAAI/bge-large-en-v1.5
            use_gpu: Whether to use GPU acceleration
        """
        self._binary_backend = BinaryEmbeddingBackend(
            model_name=binary_model,
            use_gpu=use_gpu,
        )
        self._dense_backend = DenseEmbeddingBackend(
            model_name=dense_model,
            use_gpu=use_gpu,
            expand_dim=True,
        )
        self._use_gpu = use_gpu

    @property
    def model_name(self) -> str:
        """Return model names for both backends."""
        return f"cascade({self._binary_backend.model_name}, {self._dense_backend.model_name})"

    @property
    def embedding_dim(self) -> int:
        """Return dense embedding dimension (for compatibility)."""
        return self._dense_backend.embedding_dim

    @property
    def binary_dim(self) -> int:
        """Return binary embedding dimension."""
        return self._binary_backend.embedding_dim

    @property
    def dense_dim(self) -> int:
        """Return dense embedding dimension."""
        return self._dense_backend.embedding_dim

    def embed_to_numpy(self, texts: str | Iterable[str]) -> np.ndarray:
        """Generate dense embeddings (for BaseEmbedder compatibility).

        For cascade embeddings, use encode_cascade() instead.

        Args:
            texts: Single text or iterable of texts

        Returns:
            Dense embeddings of shape (n_texts, dense_dim)
        """
        return self._dense_backend.embed_to_numpy(texts)

    def encode_cascade(
        self,
        texts: str | Iterable[str],
        batch_size: int = 32,
    ) -> Tuple[np.ndarray, np.ndarray]:
        """Generate both binary and dense embeddings.

        Args:
            texts: Single text or iterable of texts
            batch_size: Batch size for processing

        Returns:
            Tuple of:
            - binary_embeddings: Shape (n_texts, 256), uint8 values 0/1
            - dense_embeddings: Shape (n_texts, 2048), float32
        """
        if isinstance(texts, str):
            texts = [texts]
        else:
            texts = list(texts)

        binary_embeddings = self._binary_backend.embed_to_numpy(texts)
        dense_embeddings = self._dense_backend.embed_to_numpy(texts)

        return binary_embeddings, dense_embeddings

    def encode_binary(self, texts: str | Iterable[str]) -> np.ndarray:
        """Generate only binary embeddings.

        Args:
            texts: Single text or iterable of texts

        Returns:
            Binary embeddings of shape (n_texts, 256)
        """
        return self._binary_backend.embed_to_numpy(texts)

    def encode_dense(self, texts: str | Iterable[str]) -> np.ndarray:
        """Generate only dense embeddings.

        Args:
            texts: Single text or iterable of texts

        Returns:
            Dense embeddings of shape (n_texts, 2048)
        """
        return self._dense_backend.embed_to_numpy(texts)

    def encode_binary_packed(self, texts: str | Iterable[str]) -> List[bytes]:
        """Generate packed binary embeddings.

        Args:
            texts: Single text or iterable of texts

        Returns:
            List of packed bytes (32 bytes each)
        """
        return self._binary_backend.embed_packed(texts)


# =============================================================================
# Factory Function
# =============================================================================


def get_cascade_embedder(
    binary_model: Optional[str] = None,
    dense_model: Optional[str] = None,
    use_gpu: bool = True,
) -> CascadeEmbeddingBackend:
    """Factory function to create a cascade embedder.

    Args:
        binary_model: Model for binary embeddings (default: BAAI/bge-small-en-v1.5)
        dense_model: Model for dense embeddings (default: BAAI/bge-large-en-v1.5)
        use_gpu: Whether to use GPU acceleration

    Returns:
        Configured CascadeEmbeddingBackend instance

    Example:
        >>> embedder = get_cascade_embedder()
        >>> binary, dense = embedder.encode_cascade(["hello world"])
        >>> binary.shape  # (1, 256)
        >>> dense.shape   # (1, 2048)
    """
    return CascadeEmbeddingBackend(
        binary_model=binary_model,
        dense_model=dense_model,
        use_gpu=use_gpu,
    )
