"""SPLADE inverted index storage for sparse vector retrieval.

This module implements SQLite-based inverted index for SPLADE sparse vectors,
enabling efficient sparse retrieval using dot-product scoring.
"""

from __future__ import annotations

import logging
import sqlite3
import threading
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from codexlens.entities import SearchResult
from codexlens.errors import StorageError

logger = logging.getLogger(__name__)


class SpladeIndex:
    """SQLite-based inverted index for SPLADE sparse vectors.
    
    Stores sparse vectors as posting lists mapping token_id -> (chunk_id, weight).
    Supports efficient dot-product retrieval using SQL joins.
    """

    def __init__(self, db_path: Path | str) -> None:
        """Initialize SPLADE index.
        
        Args:
            db_path: Path to SQLite database file.
        """
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Thread-safe connection management
        self._lock = threading.RLock()
        self._local = threading.local()
        
    def _get_connection(self) -> sqlite3.Connection:
        """Get or create a thread-local database connection.

        Each thread gets its own connection to ensure thread safety.
        Connections are stored in thread-local storage.
        """
        conn = getattr(self._local, "conn", None)
        if conn is None:
            # Thread-local connection - each thread has its own
            conn = sqlite3.connect(
                self.db_path,
                timeout=30.0,  # Wait up to 30s for locks
                check_same_thread=True,  # Enforce thread safety
            )
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA foreign_keys=ON")
            # Limit mmap to 1GB to avoid OOM on smaller systems
            conn.execute("PRAGMA mmap_size=1073741824")
            self._local.conn = conn
        return conn
    
    def close(self) -> None:
        """Close thread-local database connection."""
        with self._lock:
            conn = getattr(self._local, "conn", None)
            if conn is not None:
                conn.close()
                self._local.conn = None
    
    def __enter__(self) -> SpladeIndex:
        """Context manager entry."""
        self.create_tables()
        return self
    
    def __exit__(self, exc_type, exc, tb) -> None:
        """Context manager exit."""
        self.close()
    
    def has_index(self) -> bool:
        """Check if SPLADE tables exist in database.
        
        Returns:
            True if tables exist, False otherwise.
        """
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.execute(
                    """
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name='splade_posting_list'
                    """
                )
                return cursor.fetchone() is not None
            except sqlite3.Error as e:
                logger.error("Failed to check index existence: %s", e)
                return False
    
    def create_tables(self) -> None:
        """Create SPLADE schema if not exists.
        
        Note: The splade_posting_list table has a FOREIGN KEY constraint
        referencing semantic_chunks(id). Ensure VectorStore.create_tables()
        is called first to create the semantic_chunks table.
        """
        with self._lock:
            conn = self._get_connection()
            try:
                # Inverted index for sparse vectors
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS splade_posting_list (
                        token_id INTEGER NOT NULL,
                        chunk_id INTEGER NOT NULL,
                        weight REAL NOT NULL,
                        PRIMARY KEY (token_id, chunk_id),
                        FOREIGN KEY (chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
                    )
                """)
                
                # Indexes for efficient lookups
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_splade_by_chunk 
                    ON splade_posting_list(chunk_id)
                """)
                conn.execute("""
                    CREATE INDEX IF NOT EXISTS idx_splade_by_token 
                    ON splade_posting_list(token_id)
                """)
                
                # Model metadata
                conn.execute("""
                    CREATE TABLE IF NOT EXISTS splade_metadata (
                        id INTEGER PRIMARY KEY DEFAULT 1,
                        model_name TEXT NOT NULL,
                        vocab_size INTEGER NOT NULL,
                        onnx_path TEXT,
                        created_at REAL
                    )
                """)
                
                conn.commit()
                logger.debug("SPLADE schema created successfully")
            except sqlite3.Error as e:
                raise StorageError(
                    f"Failed to create SPLADE schema: {e}",
                    db_path=str(self.db_path),
                    operation="create_tables"
                ) from e
    
    def add_posting(self, chunk_id: int, sparse_vec: Dict[int, float]) -> None:
        """Add a single document to inverted index.
        
        Args:
            chunk_id: Chunk ID (foreign key to semantic_chunks.id).
            sparse_vec: Sparse vector as {token_id: weight} mapping.
        """
        if not sparse_vec:
            logger.warning("Empty sparse vector for chunk_id=%d, skipping", chunk_id)
            return
        
        with self._lock:
            conn = self._get_connection()
            try:
                # Insert all non-zero weights for this chunk
                postings = [
                    (token_id, chunk_id, weight)
                    for token_id, weight in sparse_vec.items()
                    if weight > 0  # Only store non-zero weights
                ]
                
                if postings:
                    conn.executemany(
                        """
                        INSERT OR REPLACE INTO splade_posting_list 
                        (token_id, chunk_id, weight)
                        VALUES (?, ?, ?)
                        """,
                        postings
                    )
                    conn.commit()
                    logger.debug(
                        "Added %d postings for chunk_id=%d", len(postings), chunk_id
                    )
            except sqlite3.Error as e:
                raise StorageError(
                    f"Failed to add posting for chunk_id={chunk_id}: {e}",
                    db_path=str(self.db_path),
                    operation="add_posting"
                ) from e
    
    def add_postings_batch(
        self, postings: List[Tuple[int, Dict[int, float]]]
    ) -> None:
        """Batch insert postings for multiple chunks.
        
        Args:
            postings: List of (chunk_id, sparse_vec) tuples.
        """
        if not postings:
            return
        
        with self._lock:
            conn = self._get_connection()
            try:
                # Flatten all postings into single batch
                batch_data = []
                for chunk_id, sparse_vec in postings:
                    for token_id, weight in sparse_vec.items():
                        if weight > 0:  # Only store non-zero weights
                            batch_data.append((token_id, chunk_id, weight))
                
                if batch_data:
                    conn.executemany(
                        """
                        INSERT OR REPLACE INTO splade_posting_list 
                        (token_id, chunk_id, weight)
                        VALUES (?, ?, ?)
                        """,
                        batch_data
                    )
                    conn.commit()
                    logger.debug(
                        "Batch inserted %d postings for %d chunks",
                        len(batch_data),
                        len(postings)
                    )
            except sqlite3.Error as e:
                raise StorageError(
                    f"Failed to batch insert postings: {e}",
                    db_path=str(self.db_path),
                    operation="add_postings_batch"
                ) from e
    
    def remove_chunk(self, chunk_id: int) -> int:
        """Remove all postings for a chunk.
        
        Args:
            chunk_id: Chunk ID to remove.
            
        Returns:
            Number of deleted postings.
        """
        with self._lock:
            conn = self._get_connection()
            try:
                cursor = conn.execute(
                    "DELETE FROM splade_posting_list WHERE chunk_id = ?",
                    (chunk_id,)
                )
                conn.commit()
                deleted = cursor.rowcount
                logger.debug("Removed %d postings for chunk_id=%d", deleted, chunk_id)
                return deleted
            except sqlite3.Error as e:
                raise StorageError(
                    f"Failed to remove chunk_id={chunk_id}: {e}",
                    db_path=str(self.db_path),
                    operation="remove_chunk"
                ) from e
    
    def search(
        self,
        query_sparse: Dict[int, float],
        limit: int = 50,
        min_score: float = 0.0
    ) -> List[Tuple[int, float]]:
        """Search for similar chunks using dot-product scoring.
        
        Implements efficient sparse dot-product via SQL JOIN:
        score(q, d) = sum(q[t] * d[t]) for all tokens t
        
        Args:
            query_sparse: Query sparse vector as {token_id: weight}.
            limit: Maximum number of results.
            min_score: Minimum score threshold.
            
        Returns:
            List of (chunk_id, score) tuples, ordered by score descending.
        """
        if not query_sparse:
            logger.warning("Empty query sparse vector")
            return []
        
        with self._lock:
            conn = self._get_connection()
            try:
                # Build VALUES clause for query terms
                # Each term: (token_id, weight)
                query_terms = [
                    (token_id, weight)
                    for token_id, weight in query_sparse.items()
                    if weight > 0
                ]
                
                if not query_terms:
                    logger.warning("No non-zero query terms")
                    return []
                
                # Create CTE for query terms using parameterized VALUES
                # Build placeholders and params to prevent SQL injection
                params = []
                placeholders = []
                for token_id, weight in query_terms:
                    placeholders.append("(?, ?)")
                    params.extend([token_id, weight])

                values_placeholders = ", ".join(placeholders)

                sql = f"""
                    WITH query_terms(token_id, weight) AS (
                        VALUES {values_placeholders}
                    )
                    SELECT
                        p.chunk_id,
                        SUM(p.weight * q.weight) as score
                    FROM splade_posting_list p
                    INNER JOIN query_terms q ON p.token_id = q.token_id
                    GROUP BY p.chunk_id
                    HAVING score >= ?
                    ORDER BY score DESC
                    LIMIT ?
                """

                # Append min_score and limit to params
                params.extend([min_score, limit])
                rows = conn.execute(sql, params).fetchall()
                
                results = [(row["chunk_id"], float(row["score"])) for row in rows]
                logger.debug(
                    "SPLADE search: %d query terms, %d results", 
                    len(query_terms), 
                    len(results)
                )
                return results
                
            except sqlite3.Error as e:
                raise StorageError(
                    f"SPLADE search failed: {e}",
                    db_path=str(self.db_path),
                    operation="search"
                ) from e
    
    def get_metadata(self) -> Optional[Dict]:
        """Get SPLADE model metadata.
        
        Returns:
            Dictionary with model_name, vocab_size, onnx_path, created_at,
            or None if not set.
        """
        with self._lock:
            conn = self._get_connection()
            try:
                row = conn.execute(
                    """
                    SELECT model_name, vocab_size, onnx_path, created_at
                    FROM splade_metadata
                    WHERE id = 1
                    """
                ).fetchone()
                
                if row:
                    return {
                        "model_name": row["model_name"],
                        "vocab_size": row["vocab_size"],
                        "onnx_path": row["onnx_path"],
                        "created_at": row["created_at"]
                    }
                return None
            except sqlite3.Error as e:
                logger.error("Failed to get metadata: %s", e)
                return None
    
    def set_metadata(
        self,
        model_name: str,
        vocab_size: int,
        onnx_path: Optional[str] = None
    ) -> None:
        """Set SPLADE model metadata.
        
        Args:
            model_name: SPLADE model name.
            vocab_size: Vocabulary size (typically ~30k for BERT vocab).
            onnx_path: Optional path to ONNX model file.
        """
        with self._lock:
            conn = self._get_connection()
            try:
                current_time = time.time()
                conn.execute(
                    """
                    INSERT OR REPLACE INTO splade_metadata
                    (id, model_name, vocab_size, onnx_path, created_at)
                    VALUES (1, ?, ?, ?, ?)
                    """,
                    (model_name, vocab_size, onnx_path, current_time)
                )
                conn.commit()
                logger.info(
                    "Set SPLADE metadata: model=%s, vocab_size=%d",
                    model_name,
                    vocab_size
                )
            except sqlite3.Error as e:
                raise StorageError(
                    f"Failed to set metadata: {e}",
                    db_path=str(self.db_path),
                    operation="set_metadata"
                ) from e
    
    def get_stats(self) -> Dict:
        """Get index statistics.
        
        Returns:
            Dictionary with total_postings, unique_tokens, unique_chunks.
        """
        with self._lock:
            conn = self._get_connection()
            try:
                row = conn.execute("""
                    SELECT
                        COUNT(*) as total_postings,
                        COUNT(DISTINCT token_id) as unique_tokens,
                        COUNT(DISTINCT chunk_id) as unique_chunks
                    FROM splade_posting_list
                """).fetchone()
                
                return {
                    "total_postings": row["total_postings"],
                    "unique_tokens": row["unique_tokens"],
                    "unique_chunks": row["unique_chunks"]
                }
            except sqlite3.Error as e:
                logger.error("Failed to get stats: %s", e)
                return {
                    "total_postings": 0,
                    "unique_tokens": 0,
                    "unique_chunks": 0
                }
