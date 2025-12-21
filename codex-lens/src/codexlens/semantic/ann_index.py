"""Approximate Nearest Neighbor (ANN) index using HNSW algorithm.

Provides O(log N) similarity search using hnswlib's Hierarchical Navigable Small World graphs.
Falls back to brute-force search when hnswlib is not available.

Key features:
- HNSW index for fast approximate nearest neighbor search
- Persistent index storage (saved alongside SQLite database)
- Incremental vector addition and deletion
- Thread-safe operations
- Cosine similarity metric
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import List, Optional, Tuple

from codexlens.errors import StorageError

from . import SEMANTIC_AVAILABLE

if SEMANTIC_AVAILABLE:
    import numpy as np

logger = logging.getLogger(__name__)

# Try to import hnswlib (optional dependency)
try:
    import hnswlib

    HNSWLIB_AVAILABLE = True
except ImportError:
    HNSWLIB_AVAILABLE = False


class ANNIndex:
    """HNSW-based approximate nearest neighbor index for vector similarity search.

    Performance characteristics:
    - Build time: O(N log N) where N is number of vectors
    - Search time: O(log N) approximate
    - Memory: ~(M * 2 * 4 * d) bytes per vector (M=16, d=dimension)

    Index parameters:
    - space: cosine (cosine similarity metric)
    - M: 16 (max connections per node - balance between speed and recall)
    - ef_construction: 200 (search width during build - higher = better quality)
    - ef: 50 (search width during query - higher = better recall)
    """

    def __init__(
        self,
        index_path: Path,
        dim: int,
        initial_capacity: int = 50000,
        auto_save: bool = False,
        expansion_threshold: float = 0.8,
    ) -> None:
        """Initialize ANN index.

        Args:
            index_path: Path to SQLite database (index will be saved as _vectors.hnsw)
            dim: Dimension of embedding vectors
            initial_capacity: Initial maximum elements capacity (default: 50000)
            auto_save: Whether to automatically save index after operations (default: False)
            expansion_threshold: Capacity threshold to trigger auto-expansion (default: 0.8)

        Raises:
            ImportError: If required dependencies are not available
            ValueError: If dimension or capacity is invalid
        """
        if not SEMANTIC_AVAILABLE:
            raise ImportError(
                "Semantic search dependencies not available. "
                "Install with: pip install codexlens[semantic]"
            )

        if not HNSWLIB_AVAILABLE:
            raise ImportError(
                "hnswlib is required for ANN index. "
                "Install with: pip install hnswlib"
            )

        if dim <= 0:
            raise ValueError(f"Invalid dimension: {dim}")

        if initial_capacity <= 0:
            raise ValueError(f"Invalid initial capacity: {initial_capacity}")

        if not 0.0 < expansion_threshold < 1.0:
            raise ValueError(
                f"Invalid expansion threshold: {expansion_threshold}. Must be between 0 and 1."
            )

        self.index_path = Path(index_path)
        self.dim = dim

        # Derive HNSW index path from database path
        # e.g., /path/to/_index.db -> /path/to/_index_vectors.hnsw
        # This ensures unique HNSW files for each database
        db_stem = self.index_path.stem  # e.g., "_index" or "tmp123"
        self.hnsw_path = self.index_path.parent / f"{db_stem}_vectors.hnsw"

        # HNSW parameters
        self.space = "cosine"  # Cosine similarity metric
        self.M = 16  # Max connections per node (16 is good balance)
        self.ef_construction = 200  # Build-time search width (higher = better quality)
        self.ef = 50  # Query-time search width (higher = better recall)

        # Memory management parameters
        self._auto_save = auto_save
        self._expansion_threshold = expansion_threshold

        # Thread safety
        self._lock = threading.RLock()

        # HNSW index instance
        self._index: Optional[hnswlib.Index] = None
        self._max_elements = initial_capacity  # Initial capacity (reduced from 1M to 50K)
        self._current_count = 0  # Track number of vectors

        logger.info(
            f"Initialized ANNIndex with capacity={initial_capacity}, "
            f"auto_save={auto_save}, expansion_threshold={expansion_threshold}"
        )

    def _ensure_index(self) -> None:
        """Ensure HNSW index is initialized (lazy initialization)."""
        if self._index is None:
            self._index = hnswlib.Index(space=self.space, dim=self.dim)
            self._index.init_index(
                max_elements=self._max_elements,
                ef_construction=self.ef_construction,
                M=self.M,
            )
            self._index.set_ef(self.ef)
            self._current_count = 0
            logger.debug(f"Created new HNSW index with capacity {self._max_elements}")

    def _auto_expand_if_needed(self, additional_count: int) -> None:
        """Auto-expand index capacity if threshold is reached.

        Args:
            additional_count: Number of vectors to be added

        Note:
            This is called internally by add_vectors and is thread-safe.
        """
        usage_ratio = (self._current_count + additional_count) / self._max_elements

        if usage_ratio >= self._expansion_threshold:
            # Calculate new capacity (2x current or enough to fit new vectors)
            new_capacity = max(
                self._max_elements * 2,
                self._current_count + additional_count,
            )

            logger.info(
                f"Expanding index capacity: {self._max_elements} -> {new_capacity} "
                f"(usage: {usage_ratio:.1%}, threshold: {self._expansion_threshold:.1%})"
            )

            self._index.resize_index(new_capacity)
            self._max_elements = new_capacity

    def add_vectors(self, ids: List[int], vectors: np.ndarray) -> None:
        """Add vectors to the index.

        Args:
            ids: List of vector IDs (must be unique)
            vectors: Numpy array of shape (N, dim) where N = len(ids)

        Raises:
            ValueError: If shapes don't match or vectors are invalid
            StorageError: If index operation fails
        """
        if len(ids) == 0:
            return

        if vectors.shape[0] != len(ids):
            raise ValueError(
                f"Number of vectors ({vectors.shape[0]}) must match number of IDs ({len(ids)})"
            )

        if vectors.shape[1] != self.dim:
            raise ValueError(
                f"Vector dimension ({vectors.shape[1]}) must match index dimension ({self.dim})"
            )

        with self._lock:
            try:
                self._ensure_index()

                # Auto-expand if threshold reached
                self._auto_expand_if_needed(len(ids))

                # Ensure vectors are C-contiguous float32 (hnswlib requirement)
                if not vectors.flags['C_CONTIGUOUS'] or vectors.dtype != np.float32:
                    vectors = np.ascontiguousarray(vectors, dtype=np.float32)

                # Add vectors to index
                self._index.add_items(vectors, ids)
                self._current_count += len(ids)

                logger.debug(
                    f"Added {len(ids)} vectors to index "
                    f"(total: {self._current_count}/{self._max_elements})"
                )

                # Auto-save if enabled
                if self._auto_save:
                    self.save()

            except Exception as e:
                raise StorageError(f"Failed to add vectors to ANN index: {e}")

    def remove_vectors(self, ids: List[int]) -> None:
        """Remove vectors from the index by marking them as deleted.

        Note: hnswlib uses soft deletion (mark_deleted). Vectors are not
        physically removed but will be excluded from search results.

        Args:
            ids: List of vector IDs to remove

        Raises:
            StorageError: If index operation fails
        """
        if len(ids) == 0:
            return

        with self._lock:
            try:
                if self._index is None or self._current_count == 0:
                    return  # Nothing to remove

                # Mark vectors as deleted
                deleted_count = 0
                for vec_id in ids:
                    try:
                        self._index.mark_deleted(vec_id)
                        deleted_count += 1
                    except RuntimeError:
                        # ID not found - ignore (idempotent deletion)
                        pass

                logger.debug(f"Marked {deleted_count}/{len(ids)} vectors as deleted")

                # Auto-save if enabled
                if self._auto_save and deleted_count > 0:
                    self.save()

            except Exception as e:
                raise StorageError(f"Failed to remove vectors from ANN index: {e}")

    def search(
        self, query: np.ndarray, top_k: int = 10
    ) -> Tuple[List[int], List[float]]:
        """Search for nearest neighbors.

        Args:
            query: Query vector of shape (dim,) or (1, dim)
            top_k: Number of nearest neighbors to return

        Returns:
            Tuple of (ids, distances) where:
            - ids: List of vector IDs ordered by similarity
            - distances: List of cosine distances (lower = more similar)

        Raises:
            ValueError: If query shape is invalid
            StorageError: If search operation fails
        """
        # Validate query shape
        if query.ndim == 1:
            query = query.reshape(1, -1)

        if query.shape[0] != 1:
            raise ValueError(
                f"Query must be a single vector, got shape {query.shape}"
            )

        if query.shape[1] != self.dim:
            raise ValueError(
                f"Query dimension ({query.shape[1]}) must match index dimension ({self.dim})"
            )

        with self._lock:
            try:
                if self._index is None or self._current_count == 0:
                    return [], []  # Empty index

                # Perform kNN search
                labels, distances = self._index.knn_query(query, k=top_k)

                # Convert to lists and flatten (knn_query returns 2D arrays)
                ids = labels[0].tolist()
                dists = distances[0].tolist()

                return ids, dists

            except Exception as e:
                raise StorageError(f"Failed to search ANN index: {e}")

    def save(self) -> None:
        """Save index to disk.

        Index is saved to [db_path_directory]/_vectors.hnsw

        Raises:
            StorageError: If save operation fails
        """
        with self._lock:
            try:
                if self._index is None or self._current_count == 0:
                    logger.debug("Skipping save: index is empty")
                    return  # Nothing to save

                # Ensure parent directory exists
                self.hnsw_path.parent.mkdir(parents=True, exist_ok=True)

                # Save index
                self._index.save_index(str(self.hnsw_path))

                logger.debug(
                    f"Saved index to {self.hnsw_path} "
                    f"({self._current_count} vectors, capacity: {self._max_elements})"
                )

            except Exception as e:
                raise StorageError(f"Failed to save ANN index: {e}")

    def load(self) -> bool:
        """Load index from disk.

        Returns:
            True if index was loaded successfully, False if index file doesn't exist

        Raises:
            StorageError: If load operation fails
        """
        with self._lock:
            try:
                if not self.hnsw_path.exists():
                    logger.debug(f"Index file not found: {self.hnsw_path}")
                    return False  # Index file doesn't exist (not an error)

                # Create fresh index object for loading (don't call init_index first)
                self._index = hnswlib.Index(space=self.space, dim=self.dim)

                # Load index from disk
                # Note: max_elements here is just for initial allocation, can expand later
                self._index.load_index(str(self.hnsw_path), max_elements=self._max_elements)

                # Update count and capacity from loaded index
                self._current_count = self._index.get_current_count()
                self._max_elements = self._index.get_max_elements()

                # Set query-time ef parameter
                self._index.set_ef(self.ef)

                logger.info(
                    f"Loaded index from {self.hnsw_path} "
                    f"({self._current_count} vectors, capacity: {self._max_elements})"
                )

                return True

            except Exception as e:
                raise StorageError(f"Failed to load ANN index: {e}")

    def count(self) -> int:
        """Get number of vectors in the index.

        Returns:
            Number of vectors currently in the index
        """
        with self._lock:
            return self._current_count

    @property
    def capacity(self) -> int:
        """Get current maximum capacity of the index.

        Returns:
            Maximum number of vectors the index can hold before expansion
        """
        with self._lock:
            return self._max_elements

    @property
    def usage_ratio(self) -> float:
        """Get current usage ratio (count / capacity).

        Returns:
            Usage ratio between 0.0 and 1.0
        """
        with self._lock:
            if self._max_elements == 0:
                return 0.0
            return self._current_count / self._max_elements

    @property
    def is_loaded(self) -> bool:
        """Check if index is loaded and ready for use.

        Returns:
            True if index is loaded, False otherwise
        """
        with self._lock:
            return self._index is not None and self._current_count > 0
