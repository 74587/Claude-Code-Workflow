"""Approximate Nearest Neighbor (ANN) index using HNSW algorithm.

Provides O(log N) similarity search using hnswlib's Hierarchical Navigable Small World graphs.
Falls back to brute-force search when hnswlib is not available.

Key features:
- HNSW index for fast approximate nearest neighbor search
- Persistent index storage (saved alongside SQLite database)
- Incremental vector addition and deletion
- Thread-safe operations
- Cosine similarity metric
- Support for centralized storage mode (single index at project root)
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import List, Optional, Tuple

from codexlens.errors import StorageError
from codexlens.config import VECTORS_HNSW_NAME

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

    @classmethod
    def create_central(
        cls,
        index_root: Path,
        dim: int,
        initial_capacity: int = 50000,
        auto_save: bool = False,
        expansion_threshold: float = 0.8,
    ) -> "ANNIndex":
        """Create a centralized ANN index at the project index root.

        This method creates a single shared HNSW index file at the project root,
        rather than per-directory indexes. Use this for projects that want all
        dense vectors stored in one central location.

        Args:
            index_root: Root directory for the index (e.g., .codexlens/<project_hash>/)
            dim: Dimension of embedding vectors
            initial_capacity: Initial maximum elements capacity (default: 50000)
            auto_save: Whether to automatically save index after operations (default: False)
            expansion_threshold: Capacity threshold to trigger auto-expansion (default: 0.8)

        Returns:
            ANNIndex instance configured for centralized storage

        Example:
            >>> index = ANNIndex.create_central(Path(".codexlens/abc123"), dim=768)
            >>> index.hnsw_path  # Returns: .codexlens/abc123/_vectors.hnsw
        """
        # Create a dummy index_path that will result in the central hnsw_path
        # The index_path is used to derive hnsw_path, so we create a virtual path
        # such that self.hnsw_path = index_root / VECTORS_HNSW_NAME
        instance = cls.__new__(cls)

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

        instance.index_path = index_root
        instance.dim = dim

        # Centralized mode: use VECTORS_HNSW_NAME directly at index_root
        instance.hnsw_path = index_root / VECTORS_HNSW_NAME

        # HNSW parameters
        instance.space = "cosine"
        instance.M = 16
        instance.ef_construction = 200
        instance.ef = 50

        # Memory management parameters
        instance._auto_save = auto_save
        instance._expansion_threshold = expansion_threshold

        # Thread safety
        instance._lock = threading.RLock()

        # HNSW index instance
        instance._index: Optional[hnswlib.Index] = None
        instance._max_elements = initial_capacity
        instance._current_count = 0

        logger.info(
            f"Initialized centralized ANNIndex at {instance.hnsw_path} with "
            f"capacity={initial_capacity}, auto_save={auto_save}"
        )

        return instance

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



class BinaryANNIndex:
    """Binary vector ANN index using Hamming distance for fast coarse retrieval.

    .. deprecated::
        This class is deprecated. Use :class:`codexlens.search.binary_searcher.BinarySearcher`
        instead, which provides faster memory-mapped search with centralized storage.

    Optimized for binary vectors (256-bit / 32 bytes per vector).
    Uses packed binary representation for memory efficiency.

    Performance characteristics:
    - Storage: 32 bytes per vector (vs ~8KB for dense vectors)
    - Distance: Hamming distance via XOR + popcount (CPU-efficient)
    - Search: O(N) brute-force with SIMD-accelerated distance computation

    Index parameters:
    - dim: Binary vector dimension (default: 256)
    - packed_dim: Packed bytes size (dim / 8 = 32 for 256-bit)

    Usage:
        index = BinaryANNIndex(index_path, dim=256)
        index.add_vectors([1, 2, 3], packed_vectors)  # List of 32-byte packed vectors
        ids, distances = index.search(query_packed, top_k=10)
    """

    DEFAULT_DIM = 256  # Default binary vector dimension

    def __init__(
        self,
        index_path: Path,
        dim: int = 256,
        initial_capacity: int = 100000,
        auto_save: bool = False,
    ) -> None:
        """Initialize Binary ANN index.

        Args:
            index_path: Path to database (index will be saved as _binary_vectors.bin)
            dim: Dimension of binary vectors (default: 256)
            initial_capacity: Initial capacity hint (default: 100000)
            auto_save: Whether to automatically save index after operations

        Raises:
            ImportError: If required dependencies are not available
            ValueError: If dimension is invalid
        """
        if not SEMANTIC_AVAILABLE:
            raise ImportError(
                "Semantic search dependencies not available. "
                "Install with: pip install codexlens[semantic]"
            )

        import warnings
        warnings.warn(
            "BinaryANNIndex is deprecated. Use codexlens.search.binary_searcher.BinarySearcher "
            "instead for faster memory-mapped search with centralized storage.",
            DeprecationWarning,
            stacklevel=2
        )

        if dim <= 0 or dim % 8 != 0:
            raise ValueError(
                f"Invalid dimension: {dim}. Must be positive and divisible by 8."
            )

        self.index_path = Path(index_path)
        self.dim = dim
        self.packed_dim = dim // 8  # 32 bytes for 256-bit vectors

        # Derive binary index path from database path
        db_stem = self.index_path.stem
        self.binary_path = self.index_path.parent / f"{db_stem}_binary_vectors.bin"

        # Memory management
        self._auto_save = auto_save
        self._initial_capacity = initial_capacity

        # Thread safety
        self._lock = threading.RLock()

        # In-memory storage: id -> packed binary vector
        self._vectors: dict[int, bytes] = {}
        self._id_list: list[int] = []  # Ordered list for efficient iteration

        # Cached numpy array for vectorized search (invalidated on add/remove)
        self._vectors_matrix: Optional[np.ndarray] = None
        self._ids_array: Optional[np.ndarray] = None
        self._cache_valid: bool = False

        logger.info(
            f"Initialized BinaryANNIndex with dim={dim}, packed_dim={self.packed_dim}"
        )

    def add_vectors(self, ids: List[int], vectors: List[bytes]) -> None:
        """Add packed binary vectors to the index.

        Args:
            ids: List of vector IDs (must be unique)
            vectors: List of packed binary vectors (each of size packed_dim bytes)

        Raises:
            ValueError: If shapes don't match or vectors are invalid
            StorageError: If index operation fails
        """
        if len(ids) == 0:
            return

        if len(vectors) != len(ids):
            raise ValueError(
                f"Number of vectors ({len(vectors)}) must match number of IDs ({len(ids)})"
            )

        # Validate vector sizes
        for i, vec in enumerate(vectors):
            if len(vec) != self.packed_dim:
                raise ValueError(
                    f"Vector {i} has size {len(vec)}, expected {self.packed_dim}"
                )

        with self._lock:
            try:
                for vec_id, vec in zip(ids, vectors):
                    if vec_id not in self._vectors:
                        self._id_list.append(vec_id)
                    self._vectors[vec_id] = vec

                # Invalidate cache on modification
                self._cache_valid = False

                logger.debug(
                    f"Added {len(ids)} binary vectors to index (total: {len(self._vectors)})"
                )

                if self._auto_save:
                    self.save()

            except Exception as e:
                raise StorageError(f"Failed to add vectors to Binary ANN index: {e}")

    def add_vectors_numpy(self, ids: List[int], vectors: np.ndarray) -> None:
        """Add unpacked binary vectors (0/1 values) to the index.

        Convenience method that packs the vectors before adding.

        Args:
            ids: List of vector IDs (must be unique)
            vectors: Numpy array of shape (N, dim) with binary values (0 or 1)

        Raises:
            ValueError: If shapes don't match
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

        # Pack vectors
        packed_vectors = []
        for i in range(vectors.shape[0]):
            packed = np.packbits(vectors[i].astype(np.uint8)).tobytes()
            packed_vectors.append(packed)

        self.add_vectors(ids, packed_vectors)

    def remove_vectors(self, ids: List[int]) -> None:
        """Remove vectors from the index.

        Args:
            ids: List of vector IDs to remove

        Raises:
            StorageError: If index operation fails

        Note:
            Optimized for batch deletion using set operations instead of
            O(N) list.remove() calls for each ID.
        """
        if len(ids) == 0:
            return

        with self._lock:
            try:
                # Use set for O(1) lookup during filtering
                ids_to_remove = set(ids)
                removed_count = 0

                # Remove from dictionary - O(1) per deletion
                for vec_id in ids_to_remove:
                    if vec_id in self._vectors:
                        del self._vectors[vec_id]
                        removed_count += 1

                # Rebuild ID list efficiently - O(N) once instead of O(N) per removal
                if removed_count > 0:
                    self._id_list = [id_ for id_ in self._id_list if id_ not in ids_to_remove]
                    # Invalidate cache on modification
                    self._cache_valid = False

                logger.debug(f"Removed {removed_count}/{len(ids)} vectors from index")

                if self._auto_save and removed_count > 0:
                    self.save()

            except Exception as e:
                raise StorageError(
                    f"Failed to remove vectors from Binary ANN index: {e}"
                )

    def _build_cache(self) -> None:
        """Build numpy array cache from vectors dict for vectorized search.

        Pre-computes a contiguous numpy array from all vectors for efficient
        batch distance computation. Called lazily on first search after modification.
        """
        if self._cache_valid:
            return

        n_vectors = len(self._id_list)
        if n_vectors == 0:
            self._vectors_matrix = None
            self._ids_array = None
            self._cache_valid = True
            return

        # Build contiguous numpy array of all packed vectors
        # Shape: (n_vectors, packed_dim) with uint8 dtype
        self._vectors_matrix = np.empty((n_vectors, self.packed_dim), dtype=np.uint8)
        self._ids_array = np.array(self._id_list, dtype=np.int64)

        for i, vec_id in enumerate(self._id_list):
            vec_bytes = self._vectors[vec_id]
            self._vectors_matrix[i] = np.frombuffer(vec_bytes, dtype=np.uint8)

        self._cache_valid = True
        logger.debug(f"Built vectorized cache for {n_vectors} binary vectors")

    def search(
        self, query: bytes, top_k: int = 10
    ) -> Tuple[List[int], List[int]]:
        """Search for nearest neighbors using Hamming distance.

        Uses vectorized batch computation for O(N) search with SIMD acceleration.
        Pre-computes and caches numpy arrays for efficient repeated queries.

        Args:
            query: Packed binary query vector (size: packed_dim bytes)
            top_k: Number of nearest neighbors to return

        Returns:
            Tuple of (ids, distances) where:
            - ids: List of vector IDs ordered by Hamming distance (ascending)
            - distances: List of Hamming distances (lower = more similar)

        Raises:
            ValueError: If query size is invalid
            StorageError: If search operation fails
        """
        if len(query) != self.packed_dim:
            raise ValueError(
                f"Query size ({len(query)}) must match packed_dim ({self.packed_dim})"
            )

        with self._lock:
            try:
                if len(self._vectors) == 0:
                    return [], []

                # Build cache if needed (lazy initialization)
                self._build_cache()

                if self._vectors_matrix is None or self._ids_array is None:
                    return [], []

                # Vectorized Hamming distance computation
                # 1. Convert query to numpy array
                query_arr = np.frombuffer(query, dtype=np.uint8)

                # 2. Broadcast XOR: (1, packed_dim) XOR (n_vectors, packed_dim)
                #    Result shape: (n_vectors, packed_dim)
                xor_result = np.bitwise_xor(query_arr, self._vectors_matrix)

                # 3. Vectorized popcount using lookup table for efficiency
                #    np.unpackbits is slow for large arrays, use popcount LUT instead
                popcount_lut = np.array([bin(i).count('1') for i in range(256)], dtype=np.uint8)
                bit_counts = popcount_lut[xor_result]

                # 4. Sum across packed bytes to get Hamming distance per vector
                distances = bit_counts.sum(axis=1)

                # 5. Get top-k using argpartition (O(N) instead of O(N log N) for full sort)
                n_vectors = len(distances)
                k = min(top_k, n_vectors)

                if k == n_vectors:
                    # No partitioning needed, just sort all
                    sorted_indices = np.argsort(distances)
                else:
                    # Use argpartition for O(N) partial sort
                    partition_indices = np.argpartition(distances, k)[:k]
                    # Sort only the top-k
                    top_k_distances = distances[partition_indices]
                    sorted_order = np.argsort(top_k_distances)
                    sorted_indices = partition_indices[sorted_order]

                # 6. Return results
                result_ids = self._ids_array[sorted_indices].tolist()
                result_dists = distances[sorted_indices].tolist()

                return result_ids, result_dists

            except Exception as e:
                raise StorageError(f"Failed to search Binary ANN index: {e}")

    def search_numpy(
        self, query: np.ndarray, top_k: int = 10
    ) -> Tuple[List[int], List[int]]:
        """Search with unpacked binary query vector.

        Convenience method that packs the query before searching.

        Args:
            query: Binary query vector of shape (dim,) with values 0 or 1
            top_k: Number of nearest neighbors to return

        Returns:
            Tuple of (ids, distances)
        """
        if query.ndim == 2:
            query = query.flatten()

        if len(query) != self.dim:
            raise ValueError(
                f"Query dimension ({len(query)}) must match index dimension ({self.dim})"
            )

        packed_query = np.packbits(query.astype(np.uint8)).tobytes()
        return self.search(packed_query, top_k)

    def search_batch(
        self, queries: List[bytes], top_k: int = 10
    ) -> List[Tuple[List[int], List[int]]]:
        """Batch search for multiple queries.

        Args:
            queries: List of packed binary query vectors
            top_k: Number of nearest neighbors to return per query

        Returns:
            List of (ids, distances) tuples, one per query
        """
        results = []
        for query in queries:
            ids, dists = self.search(query, top_k)
            results.append((ids, dists))
        return results

    def save(self) -> None:
        """Save index to disk.

        Binary format:
        - 4 bytes: magic number (0x42494E56 = "BINV")
        - 4 bytes: version (1)
        - 4 bytes: dim
        - 4 bytes: packed_dim
        - 4 bytes: num_vectors
        - For each vector:
          - 4 bytes: id
          - packed_dim bytes: vector data

        Raises:
            StorageError: If save operation fails
        """
        with self._lock:
            try:
                if len(self._vectors) == 0:
                    logger.debug("Skipping save: index is empty")
                    return

                # Ensure parent directory exists
                self.binary_path.parent.mkdir(parents=True, exist_ok=True)

                with open(self.binary_path, "wb") as f:
                    # Header
                    f.write(b"BINV")  # Magic number
                    f.write(np.array([1], dtype=np.uint32).tobytes())  # Version
                    f.write(np.array([self.dim], dtype=np.uint32).tobytes())
                    f.write(np.array([self.packed_dim], dtype=np.uint32).tobytes())
                    f.write(
                        np.array([len(self._vectors)], dtype=np.uint32).tobytes()
                    )

                    # Vectors
                    for vec_id in self._id_list:
                        f.write(np.array([vec_id], dtype=np.uint32).tobytes())
                        f.write(self._vectors[vec_id])

                logger.debug(
                    f"Saved binary index to {self.binary_path} "
                    f"({len(self._vectors)} vectors)"
                )

            except Exception as e:
                raise StorageError(f"Failed to save Binary ANN index: {e}")

    def load(self) -> bool:
        """Load index from disk.

        Returns:
            True if index was loaded successfully, False if index file doesn't exist

        Raises:
            StorageError: If load operation fails
        """
        with self._lock:
            try:
                if not self.binary_path.exists():
                    logger.debug(f"Binary index file not found: {self.binary_path}")
                    return False

                with open(self.binary_path, "rb") as f:
                    # Read header
                    magic = f.read(4)
                    if magic != b"BINV":
                        raise StorageError(
                            f"Invalid binary index file: bad magic number"
                        )

                    version = np.frombuffer(f.read(4), dtype=np.uint32)[0]
                    if version != 1:
                        raise StorageError(
                            f"Unsupported binary index version: {version}"
                        )

                    file_dim = np.frombuffer(f.read(4), dtype=np.uint32)[0]
                    file_packed_dim = np.frombuffer(f.read(4), dtype=np.uint32)[0]
                    num_vectors = np.frombuffer(f.read(4), dtype=np.uint32)[0]

                    if file_dim != self.dim or file_packed_dim != self.packed_dim:
                        raise StorageError(
                            f"Dimension mismatch: file has dim={file_dim}, "
                            f"packed_dim={file_packed_dim}, "
                            f"expected dim={self.dim}, packed_dim={self.packed_dim}"
                        )

                    # Clear existing data
                    self._vectors.clear()
                    self._id_list.clear()
                    self._cache_valid = False

                    # Read vectors
                    for _ in range(num_vectors):
                        vec_id = np.frombuffer(f.read(4), dtype=np.uint32)[0]
                        vec_data = f.read(self.packed_dim)
                        self._vectors[int(vec_id)] = vec_data
                        self._id_list.append(int(vec_id))

                logger.info(
                    f"Loaded binary index from {self.binary_path} "
                    f"({len(self._vectors)} vectors)"
                )

                return True

            except StorageError:
                raise
            except Exception as e:
                raise StorageError(f"Failed to load Binary ANN index: {e}")

    def count(self) -> int:
        """Get number of vectors in the index.

        Returns:
            Number of vectors currently in the index
        """
        with self._lock:
            return len(self._vectors)

    @property
    def is_loaded(self) -> bool:
        """Check if index has vectors.

        Returns:
            True if index has vectors, False otherwise
        """
        with self._lock:
            return len(self._vectors) > 0

    def get_vector(self, vec_id: int) -> Optional[bytes]:
        """Get a specific vector by ID.

        Args:
            vec_id: Vector ID to retrieve

        Returns:
            Packed binary vector or None if not found
        """
        with self._lock:
            return self._vectors.get(vec_id)

    def clear(self) -> None:
        """Clear all vectors from the index."""
        with self._lock:
            self._vectors.clear()
            self._id_list.clear()
            self._vectors_matrix = None
            self._ids_array = None
            self._cache_valid = False
            logger.debug("Cleared binary index")


def create_ann_index(
    index_path: Path,
    index_type: str = "hnsw",
    dim: int = 2048,
    **kwargs,
) -> ANNIndex | BinaryANNIndex:
    """Factory function to create an ANN index.

    Args:
        index_path: Path to database file
        index_type: Type of index - "hnsw" for dense vectors, "binary" for binary vectors
        dim: Vector dimension (default: 2048 for dense, 256 for binary)
        **kwargs: Additional arguments passed to the index constructor

    Returns:
        ANNIndex for dense vectors or BinaryANNIndex for binary vectors

    Raises:
        ValueError: If index_type is invalid

    Example:
        >>> # Dense vector index (HNSW)
        >>> dense_index = create_ann_index(path, index_type="hnsw", dim=2048)
        >>> dense_index.add_vectors(ids, dense_vectors)
        >>>
        >>> # Binary vector index (Hamming distance)
        >>> binary_index = create_ann_index(path, index_type="binary", dim=256)
        >>> binary_index.add_vectors(ids, packed_vectors)
    """
    index_type = index_type.lower()

    if index_type == "hnsw":
        return ANNIndex(index_path=index_path, dim=dim, **kwargs)
    elif index_type == "binary":
        # Default to 256 for binary if not specified
        if dim == 2048:  # Default dense dim was used
            dim = 256
        return BinaryANNIndex(index_path=index_path, dim=dim, **kwargs)
    else:
        raise ValueError(
            f"Invalid index_type: {index_type}. Must be 'hnsw' or 'binary'."
        )
