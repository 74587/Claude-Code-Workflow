"""Vector storage and similarity search for semantic chunks.

Optimized for high-performance similarity search using:
- HNSW index for O(log N) approximate nearest neighbor search (primary)
- Cached embedding matrix for batch operations (fallback)
- NumPy vectorized cosine similarity (fallback, 100x+ faster than loops)
- Lazy content loading (only fetch for top-k results)
"""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from codexlens.entities import SearchResult, SemanticChunk
from codexlens.errors import StorageError

from . import SEMANTIC_AVAILABLE

if SEMANTIC_AVAILABLE:
    import numpy as np

# Try to import ANN index (optional hnswlib dependency)
try:
    from codexlens.semantic.ann_index import ANNIndex, HNSWLIB_AVAILABLE
except ImportError:
    HNSWLIB_AVAILABLE = False
    ANNIndex = None


logger = logging.getLogger(__name__)


def _cosine_similarity(a: List[float], b: List[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not SEMANTIC_AVAILABLE:
        raise ImportError("numpy required for vector operations")

    a_arr = np.array(a)
    b_arr = np.array(b)

    norm_a = np.linalg.norm(a_arr)
    norm_b = np.linalg.norm(b_arr)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(np.dot(a_arr, b_arr) / (norm_a * norm_b))


class VectorStore:
    """SQLite-based vector storage with HNSW-accelerated similarity search.

    Performance optimizations:
    - HNSW index for O(log N) approximate nearest neighbor search
    - Embedding matrix cached in memory for batch similarity computation (fallback)
    - NumPy vectorized operations instead of Python loops (fallback)
    - Lazy content loading - only fetch full content for top-k results
    - Thread-safe cache invalidation
    """

    # Default embedding dimension (used when creating new index)
    DEFAULT_DIM = 768

    def __init__(self, db_path: str | Path) -> None:
        if not SEMANTIC_AVAILABLE:
            raise ImportError(
                "Semantic search dependencies not available. "
                "Install with: pip install codexlens[semantic]"
            )

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        # Embedding cache for fast similarity search (fallback)
        self._cache_lock = threading.RLock()
        self._embedding_matrix: Optional[np.ndarray] = None
        self._embedding_norms: Optional[np.ndarray] = None
        self._chunk_ids: Optional[List[int]] = None
        self._cache_version: int = 0

        # ANN index for O(log N) search
        self._ann_index: Optional[ANNIndex] = None
        self._ann_dim: Optional[int] = None
        self._ann_write_lock = threading.Lock()  # Protects ANN index modifications

        self._init_schema()
        self._init_ann_index()

    def _init_schema(self) -> None:
        """Initialize vector storage schema."""
        with sqlite3.connect(self.db_path) as conn:
            # Enable memory mapping for faster reads
            conn.execute("PRAGMA mmap_size = 30000000000")  # 30GB limit
            conn.execute("""
                CREATE TABLE IF NOT EXISTS semantic_chunks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_path TEXT NOT NULL,
                    content TEXT NOT NULL,
                    embedding BLOB NOT NULL,
                    metadata TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_chunks_file
                ON semantic_chunks(file_path)
            """)
            conn.commit()

    def _init_ann_index(self) -> None:
        """Initialize ANN index (lazy loading from existing data)."""
        if not HNSWLIB_AVAILABLE:
            logger.debug("hnswlib not available, using brute-force search")
            return

        # Try to detect embedding dimension from existing data
        dim = self._detect_embedding_dim()
        if dim is None:
            # No data yet, will initialize on first add
            logger.debug("No embeddings found, ANN index will be created on first add")
            return

        self._ann_dim = dim

        try:
            self._ann_index = ANNIndex(self.db_path, dim)
            if self._ann_index.load():
                logger.debug(
                    "Loaded ANN index with %d vectors", self._ann_index.count()
                )
            else:
                # Index file doesn't exist, try to build from SQLite data
                logger.debug("ANN index file not found, rebuilding from SQLite")
                self._rebuild_ann_index_internal()
        except Exception as e:
            logger.warning("Failed to initialize ANN index: %s", e)
            self._ann_index = None

    def _detect_embedding_dim(self) -> Optional[int]:
        """Detect embedding dimension from existing data."""
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute(
                "SELECT embedding FROM semantic_chunks LIMIT 1"
            ).fetchone()
            if row and row[0]:
                # Embedding is stored as float32 blob
                blob = row[0]
                return len(blob) // np.dtype(np.float32).itemsize
        return None

    @property
    def dimension(self) -> Optional[int]:
        """Return the dimension of embeddings in the store.

        Returns:
            Embedding dimension if available, None if store is empty.
        """
        if self._ann_dim is not None:
            return self._ann_dim
        self._ann_dim = self._detect_embedding_dim()
        return self._ann_dim

    def _rebuild_ann_index_internal(self) -> int:
        """Internal method to rebuild ANN index from SQLite data."""
        if self._ann_index is None:
            return 0

        with sqlite3.connect(self.db_path) as conn:
            conn.execute("PRAGMA mmap_size = 30000000000")
            rows = conn.execute(
                "SELECT id, embedding FROM semantic_chunks"
            ).fetchall()

        if not rows:
            return 0

        # Extract IDs and embeddings
        ids = [r[0] for r in rows]
        embeddings = np.vstack([
            np.frombuffer(r[1], dtype=np.float32) for r in rows
        ])

        # Add to ANN index
        self._ann_index.add_vectors(ids, embeddings)
        self._ann_index.save()

        logger.info("Rebuilt ANN index with %d vectors", len(ids))
        return len(ids)

    def rebuild_ann_index(self) -> int:
        """Rebuild HNSW index from all chunks in SQLite.

        Use this method to:
        - Migrate existing data to use ANN search
        - Repair corrupted index
        - Reclaim space after many deletions

        Returns:
            Number of vectors indexed.
        """
        if not HNSWLIB_AVAILABLE:
            logger.warning("hnswlib not available, cannot rebuild ANN index")
            return 0

        # Detect dimension
        dim = self._detect_embedding_dim()
        if dim is None:
            logger.warning("No embeddings found, cannot rebuild ANN index")
            return 0

        self._ann_dim = dim

        # Create new index
        try:
            self._ann_index = ANNIndex(self.db_path, dim)
            return self._rebuild_ann_index_internal()
        except Exception as e:
            logger.error("Failed to rebuild ANN index: %s", e)
            self._ann_index = None
            return 0

    def _invalidate_cache(self) -> None:
        """Invalidate the embedding cache (thread-safe)."""
        with self._cache_lock:
            self._embedding_matrix = None
            self._embedding_norms = None
            self._chunk_ids = None
            self._cache_version += 1

    def _refresh_cache(self) -> bool:
        """Load embeddings into numpy matrix for fast similarity search.

        Returns:
            True if cache was refreshed successfully, False if no data.
        """
        with self._cache_lock:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute("PRAGMA mmap_size = 30000000000")
                rows = conn.execute(
                    "SELECT id, embedding FROM semantic_chunks"
                ).fetchall()

            if not rows:
                self._embedding_matrix = None
                self._embedding_norms = None
                self._chunk_ids = None
                return False

            # Extract IDs and embeddings
            self._chunk_ids = [r[0] for r in rows]

            # Bulk convert binary blobs to numpy matrix
            embeddings = [
                np.frombuffer(r[1], dtype=np.float32) for r in rows
            ]
            self._embedding_matrix = np.vstack(embeddings)

            # Pre-compute norms for faster similarity calculation
            self._embedding_norms = np.linalg.norm(
                self._embedding_matrix, axis=1, keepdims=True
            )
            # Avoid division by zero
            self._embedding_norms = np.where(
                self._embedding_norms == 0, 1e-10, self._embedding_norms
            )

            return True

    def _ensure_ann_index(self, dim: int) -> bool:
        """Ensure ANN index is initialized with correct dimension.

        This method is thread-safe and uses double-checked locking.

        Args:
            dim: Embedding dimension

        Returns:
            True if ANN index is ready, False otherwise
        """
        if not HNSWLIB_AVAILABLE:
            return False

        # Fast path: index already initialized (no lock needed)
        if self._ann_index is not None:
            return True

        # Slow path: acquire lock for initialization
        with self._ann_write_lock:
            # Double-check after acquiring lock
            if self._ann_index is not None:
                return True

            try:
                self._ann_dim = dim
                self._ann_index = ANNIndex(self.db_path, dim)
                self._ann_index.load()  # Try to load existing
                return True
            except Exception as e:
                logger.warning("Failed to initialize ANN index: %s", e)
                self._ann_index = None
                return False

    def add_chunk(self, chunk: SemanticChunk, file_path: str) -> int:
        """Add a single chunk with its embedding.

        Returns:
            The inserted chunk ID.
        """
        if chunk.embedding is None:
            raise ValueError("Chunk must have embedding before adding to store")

        embedding_arr = np.array(chunk.embedding, dtype=np.float32)
        embedding_blob = embedding_arr.tobytes()
        metadata_json = json.dumps(chunk.metadata) if chunk.metadata else None

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                """
                INSERT INTO semantic_chunks (file_path, content, embedding, metadata)
                VALUES (?, ?, ?, ?)
                """,
                (file_path, chunk.content, embedding_blob, metadata_json)
            )
            conn.commit()
            chunk_id = cursor.lastrowid or 0

        # Add to ANN index
        if self._ensure_ann_index(len(chunk.embedding)):
            with self._ann_write_lock:
                try:
                    self._ann_index.add_vectors([chunk_id], embedding_arr.reshape(1, -1))
                    self._ann_index.save()
                except Exception as e:
                    logger.warning("Failed to add to ANN index: %s", e)

        # Invalidate cache after modification
        self._invalidate_cache()
        return chunk_id

    def add_chunks(self, chunks: List[SemanticChunk], file_path: str) -> List[int]:
        """Add multiple chunks with embeddings (batch insert).

        Returns:
            List of inserted chunk IDs.
        """
        if not chunks:
            return []

        # Prepare batch data
        batch_data = []
        embeddings_list = []
        for chunk in chunks:
            if chunk.embedding is None:
                raise ValueError("All chunks must have embeddings")
            embedding_arr = np.array(chunk.embedding, dtype=np.float32)
            embedding_blob = embedding_arr.tobytes()
            metadata_json = json.dumps(chunk.metadata) if chunk.metadata else None
            batch_data.append((file_path, chunk.content, embedding_blob, metadata_json))
            embeddings_list.append(embedding_arr)

        # Batch insert to SQLite
        with sqlite3.connect(self.db_path) as conn:
            # Get starting ID before insert
            row = conn.execute("SELECT MAX(id) FROM semantic_chunks").fetchone()
            start_id = (row[0] or 0) + 1

            conn.executemany(
                """
                INSERT INTO semantic_chunks (file_path, content, embedding, metadata)
                VALUES (?, ?, ?, ?)
                """,
                batch_data
            )
            conn.commit()
            # Calculate inserted IDs based on starting ID
            ids = list(range(start_id, start_id + len(chunks)))

        # Add to ANN index
        if embeddings_list and self._ensure_ann_index(len(embeddings_list[0])):
            with self._ann_write_lock:
                try:
                    embeddings_matrix = np.vstack(embeddings_list)
                    self._ann_index.add_vectors(ids, embeddings_matrix)
                    self._ann_index.save()
                except Exception as e:
                    logger.warning("Failed to add batch to ANN index: %s", e)

        # Invalidate cache after modification
        self._invalidate_cache()
        return ids

    def add_chunks_batch(
        self, chunks_with_paths: List[Tuple[SemanticChunk, str]]
    ) -> List[int]:
        """Batch insert chunks from multiple files in a single transaction.

        This method is optimized for bulk operations during index generation.

        Args:
            chunks_with_paths: List of (chunk, file_path) tuples

        Returns:
            List of inserted chunk IDs
        """
        if not chunks_with_paths:
            return []

        # Prepare batch data
        batch_data = []
        embeddings_list = []
        for chunk, file_path in chunks_with_paths:
            if chunk.embedding is None:
                raise ValueError("All chunks must have embeddings")
            embedding_arr = np.array(chunk.embedding, dtype=np.float32)
            embedding_blob = embedding_arr.tobytes()
            metadata_json = json.dumps(chunk.metadata) if chunk.metadata else None
            batch_data.append((file_path, chunk.content, embedding_blob, metadata_json))
            embeddings_list.append(embedding_arr)

        # Batch insert to SQLite in single transaction
        with sqlite3.connect(self.db_path) as conn:
            # Get starting ID before insert
            row = conn.execute("SELECT MAX(id) FROM semantic_chunks").fetchone()
            start_id = (row[0] or 0) + 1

            conn.executemany(
                """
                INSERT INTO semantic_chunks (file_path, content, embedding, metadata)
                VALUES (?, ?, ?, ?)
                """,
                batch_data
            )
            conn.commit()
            # Calculate inserted IDs based on starting ID
            ids = list(range(start_id, start_id + len(chunks_with_paths)))

        # Add to ANN index
        if embeddings_list and self._ensure_ann_index(len(embeddings_list[0])):
            with self._ann_write_lock:
                try:
                    embeddings_matrix = np.vstack(embeddings_list)
                    self._ann_index.add_vectors(ids, embeddings_matrix)
                    self._ann_index.save()
                except Exception as e:
                    logger.warning("Failed to add batch to ANN index: %s", e)

        # Invalidate cache after modification
        self._invalidate_cache()
        return ids

    def delete_file_chunks(self, file_path: str) -> int:
        """Delete all chunks for a file.

        Returns:
            Number of deleted chunks.
        """
        # Get chunk IDs before deletion (for ANN index)
        chunk_ids_to_delete = []
        if self._ann_index is not None:
            with sqlite3.connect(self.db_path) as conn:
                rows = conn.execute(
                    "SELECT id FROM semantic_chunks WHERE file_path = ?",
                    (file_path,)
                ).fetchall()
                chunk_ids_to_delete = [r[0] for r in rows]

        # Delete from SQLite
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM semantic_chunks WHERE file_path = ?",
                (file_path,)
            )
            conn.commit()
            deleted = cursor.rowcount

        # Remove from ANN index
        if deleted > 0 and self._ann_index is not None and chunk_ids_to_delete:
            with self._ann_write_lock:
                try:
                    self._ann_index.remove_vectors(chunk_ids_to_delete)
                    self._ann_index.save()
                except Exception as e:
                    logger.warning("Failed to remove from ANN index: %s", e)

        if deleted > 0:
            self._invalidate_cache()
        return deleted

    def search_similar(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        min_score: float = 0.0,
        return_full_content: bool = True,
    ) -> List[SearchResult]:
        """Find chunks most similar to query embedding.

        Uses HNSW index for O(log N) search when available, falls back to
        brute-force NumPy search otherwise.

        Args:
            query_embedding: Query vector.
            top_k: Maximum results to return.
            min_score: Minimum similarity score (0-1).
            return_full_content: If True, return full code block content.

        Returns:
            List of SearchResult ordered by similarity (highest first).
        """
        query_vec = np.array(query_embedding, dtype=np.float32)

        # Try HNSW search first (O(log N))
        if (
            HNSWLIB_AVAILABLE
            and self._ann_index is not None
            and self._ann_index.is_loaded
            and self._ann_index.count() > 0
        ):
            try:
                return self._search_with_ann(
                    query_vec, top_k, min_score, return_full_content
                )
            except Exception as e:
                logger.warning("ANN search failed, falling back to brute-force: %s", e)

        # Fallback to brute-force search (O(N))
        return self._search_brute_force(
            query_vec, top_k, min_score, return_full_content
        )

    def _search_with_ann(
        self,
        query_vec: np.ndarray,
        top_k: int,
        min_score: float,
        return_full_content: bool,
    ) -> List[SearchResult]:
        """Search using HNSW index (O(log N)).

        Args:
            query_vec: Query vector as numpy array
            top_k: Maximum results to return
            min_score: Minimum similarity score (0-1)
            return_full_content: If True, return full code block content

        Returns:
            List of SearchResult ordered by similarity (highest first)
        """
        # Limit top_k to available vectors to prevent hnswlib error
        ann_count = self._ann_index.count()
        effective_top_k = min(top_k, ann_count) if ann_count > 0 else 0

        if effective_top_k == 0:
            return []

        # HNSW search returns (ids, distances)
        # For cosine space: distance = 1 - similarity
        ids, distances = self._ann_index.search(query_vec, effective_top_k)

        if not ids:
            return []

        # Convert distances to similarity scores
        scores = [1.0 - d for d in distances]

        # Filter by min_score
        filtered = [
            (chunk_id, score)
            for chunk_id, score in zip(ids, scores)
            if score >= min_score
        ]

        if not filtered:
            return []

        top_ids = [f[0] for f in filtered]
        top_scores = [f[1] for f in filtered]

        # Fetch content from SQLite
        return self._fetch_results_by_ids(top_ids, top_scores, return_full_content)

    def _search_brute_force(
        self,
        query_vec: np.ndarray,
        top_k: int,
        min_score: float,
        return_full_content: bool,
    ) -> List[SearchResult]:
        """Brute-force search using NumPy (O(N) fallback).

        Args:
            query_vec: Query vector as numpy array
            top_k: Maximum results to return
            min_score: Minimum similarity score (0-1)
            return_full_content: If True, return full code block content

        Returns:
            List of SearchResult ordered by similarity (highest first)
        """
        logger.warning(
            "Using brute-force vector search (hnswlib not available). "
            "This may cause high memory usage for large indexes. "
            "Install hnswlib for better performance: pip install hnswlib"
        )

        with self._cache_lock:
            # Refresh cache if needed
            if self._embedding_matrix is None:
                if not self._refresh_cache():
                    return []  # No data

            # Vectorized cosine similarity
            query_vec = query_vec.reshape(1, -1)
            query_norm = np.linalg.norm(query_vec)
            if query_norm == 0:
                return []

            # Compute all similarities at once: (N,) scores
            # similarity = (A @ B.T) / (||A|| * ||B||)
            dot_products = np.dot(self._embedding_matrix, query_vec.T).flatten()
            scores = dot_products / (self._embedding_norms.flatten() * query_norm)

            # Filter by min_score and get top-k indices
            valid_mask = scores >= min_score
            valid_indices = np.where(valid_mask)[0]

            if len(valid_indices) == 0:
                return []

            # Sort by score descending and take top_k
            valid_scores = scores[valid_indices]
            sorted_order = np.argsort(valid_scores)[::-1][:top_k]
            top_indices = valid_indices[sorted_order]
            top_scores = valid_scores[sorted_order]

            # Get chunk IDs for top results
            top_ids = [self._chunk_ids[i] for i in top_indices]

        # Fetch content only for top-k results (lazy loading)
        results = self._fetch_results_by_ids(
            top_ids, top_scores.tolist(), return_full_content
        )

        return results

    def _fetch_results_by_ids(
        self,
        chunk_ids: List[int],
        scores: List[float],
        return_full_content: bool,
    ) -> List[SearchResult]:
        """Fetch full result data for specific chunk IDs.

        Args:
            chunk_ids: List of chunk IDs to fetch.
            scores: Corresponding similarity scores.
            return_full_content: Whether to include full content.

        Returns:
            List of SearchResult objects.
        """
        if not chunk_ids:
            return []

        # Build parameterized query for IN clause
        placeholders = ",".join("?" * len(chunk_ids))
        query = f"""
            SELECT id, file_path, content, metadata
            FROM semantic_chunks
            WHERE id IN ({placeholders})
        """

        with sqlite3.connect(self.db_path) as conn:
            conn.execute("PRAGMA mmap_size = 30000000000")
            rows = conn.execute(query, chunk_ids).fetchall()

        # Build ID -> row mapping
        id_to_row = {r[0]: r for r in rows}

        results = []
        for chunk_id, score in zip(chunk_ids, scores):
            row = id_to_row.get(chunk_id)
            if not row:
                continue

            _, file_path, content, metadata_json = row
            metadata = json.loads(metadata_json) if metadata_json else {}

            # Build excerpt (short preview)
            excerpt = content[:200] + "..." if len(content) > 200 else content

            # Extract symbol information from metadata
            symbol_name = metadata.get("symbol_name")
            symbol_kind = metadata.get("symbol_kind")
            start_line = metadata.get("start_line")
            end_line = metadata.get("end_line")

            # Build Symbol object if we have symbol info
            symbol = None
            if symbol_name and symbol_kind and start_line and end_line:
                try:
                    from codexlens.entities import Symbol
                    symbol = Symbol(
                        name=symbol_name,
                        kind=symbol_kind,
                        range=(start_line, end_line)
                    )
                except Exception:
                    pass

            results.append(SearchResult(
                path=file_path,
                score=score,
                excerpt=excerpt,
                content=content if return_full_content else None,
                symbol=symbol,
                metadata=metadata,
                start_line=start_line,
                end_line=end_line,
                symbol_name=symbol_name,
                symbol_kind=symbol_kind,
            ))

        return results

    def count_chunks(self) -> int:
        """Count total chunks in store."""
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute("SELECT COUNT(*) FROM semantic_chunks").fetchone()
            return row[0] if row else 0

    def clear_cache(self) -> None:
        """Manually clear the embedding cache."""
        self._invalidate_cache()

    @property
    def ann_available(self) -> bool:
        """Check if ANN index is available and ready."""
        return (
            HNSWLIB_AVAILABLE
            and self._ann_index is not None
            and self._ann_index.is_loaded
        )

    @property
    def ann_count(self) -> int:
        """Get number of vectors in ANN index."""
        if self._ann_index is not None:
            return self._ann_index.count()
        return 0

    def close(self) -> None:
        """Close the vector store and release resources.

        This ensures SQLite connections are closed and ANN index is cleared,
        allowing temporary files to be deleted on Windows.
        """
        with self._cache_lock:
            self._embedding_matrix = None
            self._embedding_norms = None
            self._chunk_ids = None

        with self._ann_write_lock:
            self._ann_index = None

    def __enter__(self) -> "VectorStore":
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit - close resources."""
        self.close()
