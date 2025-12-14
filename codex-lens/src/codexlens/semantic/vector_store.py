"""Vector storage and similarity search for semantic chunks.

Optimized for high-performance similarity search using:
- Cached embedding matrix for batch operations
- NumPy vectorized cosine similarity (100x+ faster than loops)
- Lazy content loading (only fetch for top-k results)
"""

from __future__ import annotations

import json
import sqlite3
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from codexlens.entities import SearchResult, SemanticChunk
from codexlens.errors import StorageError

from . import SEMANTIC_AVAILABLE

if SEMANTIC_AVAILABLE:
    import numpy as np


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
    """SQLite-based vector storage with optimized cosine similarity search.

    Performance optimizations:
    - Embedding matrix cached in memory for batch similarity computation
    - NumPy vectorized operations instead of Python loops
    - Lazy content loading - only fetch full content for top-k results
    - Thread-safe cache invalidation
    """

    def __init__(self, db_path: str | Path) -> None:
        if not SEMANTIC_AVAILABLE:
            raise ImportError(
                "Semantic search dependencies not available. "
                "Install with: pip install codexlens[semantic]"
            )

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)

        # Embedding cache for fast similarity search
        self._cache_lock = threading.RLock()
        self._embedding_matrix: Optional[np.ndarray] = None
        self._embedding_norms: Optional[np.ndarray] = None
        self._chunk_ids: Optional[List[int]] = None
        self._cache_version: int = 0

        self._init_schema()

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

    def add_chunk(self, chunk: SemanticChunk, file_path: str) -> int:
        """Add a single chunk with its embedding.

        Returns:
            The inserted chunk ID.
        """
        if chunk.embedding is None:
            raise ValueError("Chunk must have embedding before adding to store")

        embedding_blob = np.array(chunk.embedding, dtype=np.float32).tobytes()
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
        for chunk in chunks:
            if chunk.embedding is None:
                raise ValueError("All chunks must have embeddings")
            embedding_blob = np.array(chunk.embedding, dtype=np.float32).tobytes()
            metadata_json = json.dumps(chunk.metadata) if chunk.metadata else None
            batch_data.append((file_path, chunk.content, embedding_blob, metadata_json))

        # Batch insert
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.executemany(
                """
                INSERT INTO semantic_chunks (file_path, content, embedding, metadata)
                VALUES (?, ?, ?, ?)
                """,
                batch_data
            )
            conn.commit()
            # Get inserted IDs (approximate - assumes sequential)
            last_id = cursor.lastrowid or 0
            ids = list(range(last_id - len(chunks) + 1, last_id + 1))

        # Invalidate cache after modification
        self._invalidate_cache()
        return ids

    def delete_file_chunks(self, file_path: str) -> int:
        """Delete all chunks for a file.

        Returns:
            Number of deleted chunks.
        """
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.execute(
                "DELETE FROM semantic_chunks WHERE file_path = ?",
                (file_path,)
            )
            conn.commit()
            deleted = cursor.rowcount

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

        Optimized with:
        - Vectorized NumPy similarity computation (100x+ faster)
        - Cached embedding matrix (avoids repeated DB reads)
        - Lazy content loading (only fetch for top-k results)

        Args:
            query_embedding: Query vector.
            top_k: Maximum results to return.
            min_score: Minimum similarity score (0-1).
            return_full_content: If True, return full code block content.

        Returns:
            List of SearchResult ordered by similarity (highest first).
        """
        with self._cache_lock:
            # Refresh cache if needed
            if self._embedding_matrix is None:
                if not self._refresh_cache():
                    return []  # No data

            # Vectorized cosine similarity
            query_vec = np.array(query_embedding, dtype=np.float32).reshape(1, -1)
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
