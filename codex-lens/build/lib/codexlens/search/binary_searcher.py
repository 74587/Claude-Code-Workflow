"""Binary vector searcher for cascade search.

This module provides fast binary vector search using Hamming distance
for the first stage of cascade search (coarse filtering).

Supports two loading modes:
1. Memory-mapped file (preferred): Low memory footprint, OS-managed paging
2. Database loading (fallback): Loads all vectors into RAM
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

# Pre-computed popcount lookup table for vectorized Hamming distance
# Each byte value (0-255) maps to its bit count
_POPCOUNT_TABLE = np.array([bin(i).count('1') for i in range(256)], dtype=np.uint8)


class BinarySearcher:
    """Fast binary vector search using Hamming distance.

    This class implements the first stage of cascade search:
    fast, approximate retrieval using binary vectors and Hamming distance.

    The binary vectors are derived from dense embeddings by thresholding:
    binary[i] = 1 if dense[i] > 0 else 0

    Hamming distance between two binary vectors counts the number of
    differing bits, which can be computed very efficiently using XOR
    and population count.

    Supports two loading modes:
    - Memory-mapped file (preferred): Uses np.memmap for minimal RAM usage
    - Database (fallback): Loads all vectors into memory from SQLite
    """

    def __init__(self, index_root_or_meta_path: Path) -> None:
        """Initialize BinarySearcher.

        Args:
            index_root_or_meta_path: Either:
                - Path to index root directory (containing _binary_vectors.mmap)
                - Path to _vectors_meta.db (legacy mode, loads from DB)
        """
        path = Path(index_root_or_meta_path)

        # Determine if this is an index root or a specific DB path
        if path.suffix == '.db':
            # Legacy mode: specific DB path
            self.index_root = path.parent
            self.meta_store_path = path
        else:
            # New mode: index root directory
            self.index_root = path
            self.meta_store_path = path / "_vectors_meta.db"

        self._chunk_ids: Optional[np.ndarray] = None
        self._binary_matrix: Optional[np.ndarray] = None
        self._is_memmap = False
        self._loaded = False

    def load(self) -> bool:
        """Load binary vectors using memory-mapped file or database fallback.

        Tries to load from memory-mapped file first (preferred for large indexes),
        falls back to database loading if mmap file doesn't exist.

        Returns:
            True if vectors were loaded successfully.
        """
        if self._loaded:
            return True

        # Try memory-mapped file first (preferred)
        mmap_path = self.index_root / "_binary_vectors.mmap"
        meta_path = mmap_path.with_suffix('.meta.json')

        if mmap_path.exists() and meta_path.exists():
            try:
                with open(meta_path, 'r') as f:
                    meta = json.load(f)

                shape = tuple(meta['shape'])
                self._chunk_ids = np.array(meta['chunk_ids'], dtype=np.int64)

                # Memory-map the binary matrix (read-only)
                self._binary_matrix = np.memmap(
                    str(mmap_path),
                    dtype=np.uint8,
                    mode='r',
                    shape=shape
                )
                self._is_memmap = True
                self._loaded = True

                logger.info(
                    "Memory-mapped %d binary vectors (%d bytes each)",
                    len(self._chunk_ids), shape[1]
                )
                return True

            except Exception as e:
                logger.warning("Failed to load mmap binary vectors, falling back to DB: %s", e)

        # Fallback: load from database
        return self._load_from_db()

    def _load_from_db(self) -> bool:
        """Load binary vectors from database (legacy/fallback mode).

        Returns:
            True if vectors were loaded successfully.
        """
        try:
            from codexlens.storage.vector_meta_store import VectorMetadataStore

            with VectorMetadataStore(self.meta_store_path) as store:
                rows = store.get_all_binary_vectors()

            if not rows:
                logger.warning("No binary vectors found in %s", self.meta_store_path)
                return False

            # Convert to numpy arrays for fast computation
            self._chunk_ids = np.array([r[0] for r in rows], dtype=np.int64)

            # Unpack bytes to numpy array
            binary_arrays = []
            for _, vec_bytes in rows:
                arr = np.frombuffer(vec_bytes, dtype=np.uint8)
                binary_arrays.append(arr)

            self._binary_matrix = np.vstack(binary_arrays)
            self._is_memmap = False
            self._loaded = True

            logger.info(
                "Loaded %d binary vectors from DB (%d bytes each)",
                len(self._chunk_ids), self._binary_matrix.shape[1]
            )
            return True

        except Exception as e:
            logger.error("Failed to load binary vectors: %s", e)
            return False

    def search(
        self,
        query_vector: np.ndarray,
        top_k: int = 100
    ) -> List[Tuple[int, int]]:
        """Search for similar vectors using Hamming distance.

        Args:
            query_vector: Dense query vector (will be binarized).
            top_k: Number of top results to return.

        Returns:
            List of (chunk_id, hamming_distance) tuples sorted by distance.
        """
        if not self._loaded and not self.load():
            return []

        # Binarize query vector
        query_binary = (query_vector > 0).astype(np.uint8)
        query_packed = np.packbits(query_binary)

        # Compute Hamming distances using XOR and popcount
        # XOR gives 1 for differing bits
        xor_result = np.bitwise_xor(self._binary_matrix, query_packed)

        # Vectorized popcount using lookup table (orders of magnitude faster)
        # Sum the bit counts for each byte across all columns
        distances = np.sum(_POPCOUNT_TABLE[xor_result], axis=1, dtype=np.int32)

        # Get top-k with smallest distances
        if top_k >= len(distances):
            top_indices = np.argsort(distances)
        else:
            # Partial sort for efficiency
            top_indices = np.argpartition(distances, top_k)[:top_k]
            top_indices = top_indices[np.argsort(distances[top_indices])]

        results = [
            (int(self._chunk_ids[i]), int(distances[i]))
            for i in top_indices
        ]

        return results

    def search_with_rerank(
        self,
        query_dense: np.ndarray,
        dense_vectors: np.ndarray,
        dense_chunk_ids: np.ndarray,
        top_k: int = 10,
        candidates: int = 100
    ) -> List[Tuple[int, float]]:
        """Two-stage cascade search: binary filter + dense rerank.

        Args:
            query_dense: Dense query vector.
            dense_vectors: Dense vectors for reranking (from HNSW or stored).
            dense_chunk_ids: Chunk IDs corresponding to dense_vectors.
            top_k: Final number of results.
            candidates: Number of candidates from binary search.

        Returns:
            List of (chunk_id, cosine_similarity) tuples.
        """
        # Stage 1: Binary filtering
        binary_results = self.search(query_dense, top_k=candidates)
        if not binary_results:
            return []

        candidate_ids = {r[0] for r in binary_results}

        # Stage 2: Dense reranking
        # Find indices of candidates in dense_vectors
        candidate_mask = np.isin(dense_chunk_ids, list(candidate_ids))
        candidate_indices = np.where(candidate_mask)[0]

        if len(candidate_indices) == 0:
            # Fallback: return binary results with normalized distance
            max_dist = max(r[1] for r in binary_results) if binary_results else 1
            return [(r[0], 1.0 - r[1] / max_dist) for r in binary_results[:top_k]]

        # Compute cosine similarities for candidates
        candidate_vectors = dense_vectors[candidate_indices]
        candidate_ids_array = dense_chunk_ids[candidate_indices]

        # Normalize vectors
        query_norm = query_dense / (np.linalg.norm(query_dense) + 1e-8)
        cand_norms = candidate_vectors / (
            np.linalg.norm(candidate_vectors, axis=1, keepdims=True) + 1e-8
        )

        # Cosine similarities
        similarities = np.dot(cand_norms, query_norm)

        # Sort by similarity (descending)
        sorted_indices = np.argsort(-similarities)[:top_k]

        results = [
            (int(candidate_ids_array[i]), float(similarities[i]))
            for i in sorted_indices
        ]

        return results

    @property
    def vector_count(self) -> int:
        """Get number of loaded binary vectors."""
        return len(self._chunk_ids) if self._chunk_ids is not None else 0

    @property
    def is_memmap(self) -> bool:
        """Check if using memory-mapped file (vs in-memory array)."""
        return self._is_memmap

    def clear(self) -> None:
        """Clear loaded vectors from memory."""
        # For memmap, just delete the reference (OS will handle cleanup)
        if self._is_memmap and self._binary_matrix is not None:
            del self._binary_matrix
        self._chunk_ids = None
        self._binary_matrix = None
        self._is_memmap = False
        self._loaded = False
