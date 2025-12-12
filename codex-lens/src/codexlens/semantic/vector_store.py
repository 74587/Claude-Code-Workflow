"""Vector storage and similarity search for semantic chunks."""

from __future__ import annotations

import json
import sqlite3
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
    """SQLite-based vector storage with cosine similarity search."""

    def __init__(self, db_path: str | Path) -> None:
        if not SEMANTIC_AVAILABLE:
            raise ImportError(
                "Semantic search dependencies not available. "
                "Install with: pip install codexlens[semantic]"
            )

        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    def _init_schema(self) -> None:
        """Initialize vector storage schema."""
        with sqlite3.connect(self.db_path) as conn:
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
            return cursor.lastrowid or 0

    def add_chunks(self, chunks: List[SemanticChunk], file_path: str) -> List[int]:
        """Add multiple chunks with embeddings.

        Returns:
            List of inserted chunk IDs.
        """
        ids = []
        for chunk in chunks:
            ids.append(self.add_chunk(chunk, file_path))
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
            return cursor.rowcount

    def search_similar(
        self,
        query_embedding: List[float],
        top_k: int = 10,
        min_score: float = 0.0,
    ) -> List[SearchResult]:
        """Find chunks most similar to query embedding.

        Args:
            query_embedding: Query vector.
            top_k: Maximum results to return.
            min_score: Minimum similarity score (0-1).

        Returns:
            List of SearchResult ordered by similarity (highest first).
        """
        results: List[Tuple[float, SearchResult]] = []

        with sqlite3.connect(self.db_path) as conn:
            rows = conn.execute(
                "SELECT id, file_path, content, embedding, metadata FROM semantic_chunks"
            ).fetchall()

        for row_id, file_path, content, embedding_blob, metadata_json in rows:
            stored_embedding = np.frombuffer(embedding_blob, dtype=np.float32).tolist()
            score = _cosine_similarity(query_embedding, stored_embedding)

            if score >= min_score:
                metadata = json.loads(metadata_json) if metadata_json else {}

                # Build excerpt
                excerpt = content[:200] + "..." if len(content) > 200 else content

                results.append((score, SearchResult(
                    path=file_path,
                    score=score,
                    excerpt=excerpt,
                    symbol=None,
                )))

        # Sort by score descending
        results.sort(key=lambda x: x[0], reverse=True)

        return [r for _, r in results[:top_k]]

    def count_chunks(self) -> int:
        """Count total chunks in store."""
        with sqlite3.connect(self.db_path) as conn:
            row = conn.execute("SELECT COUNT(*) FROM semantic_chunks").fetchone()
            return row[0] if row else 0
