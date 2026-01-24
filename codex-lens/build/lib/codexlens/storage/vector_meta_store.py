"""Central storage for vector metadata.

This module provides a centralized SQLite database for storing chunk metadata
associated with centralized vector indexes. Instead of traversing all _index.db
files to fetch chunk metadata, this provides O(1) lookup by chunk ID.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

from codexlens.errors import StorageError

logger = logging.getLogger(__name__)


class VectorMetadataStore:
    """Store and retrieve chunk metadata for centralized vector search.

    This class provides efficient storage and retrieval of chunk metadata
    for the centralized vector index architecture. All chunk metadata is
    stored in a single _vectors_meta.db file at the project root, enabling
    fast lookups without traversing multiple _index.db files.

    Schema:
        chunk_metadata:
            - chunk_id: INTEGER PRIMARY KEY - Global chunk ID
            - file_path: TEXT NOT NULL - Path to source file
            - content: TEXT - Chunk text content
            - start_line: INTEGER - Start line in source file
            - end_line: INTEGER - End line in source file
            - category: TEXT - Content category (code/doc)
            - metadata: TEXT - JSON-encoded additional metadata
            - source_index_db: TEXT - Path to source _index.db file
    """

    def __init__(self, db_path: Path | str) -> None:
        """Initialize VectorMetadataStore.

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
        """
        conn = getattr(self._local, "conn", None)
        if conn is None:
            conn = sqlite3.connect(
                str(self.db_path),
                timeout=30.0,
                check_same_thread=True,
            )
            conn.row_factory = sqlite3.Row
            conn.execute("PRAGMA journal_mode=WAL")
            conn.execute("PRAGMA synchronous=NORMAL")
            conn.execute("PRAGMA mmap_size=1073741824")  # 1GB mmap
            self._local.conn = conn
        return conn

    def _ensure_schema(self) -> None:
        """Create tables if they don't exist."""
        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS chunk_metadata (
                        chunk_id INTEGER PRIMARY KEY,
                        file_path TEXT NOT NULL,
                        content TEXT,
                        start_line INTEGER,
                        end_line INTEGER,
                        category TEXT,
                        metadata TEXT,
                        source_index_db TEXT
                    )
                ''')
                conn.execute(
                    'CREATE INDEX IF NOT EXISTS idx_chunk_file_path '
                    'ON chunk_metadata(file_path)'
                )
                conn.execute(
                    'CREATE INDEX IF NOT EXISTS idx_chunk_category '
                    'ON chunk_metadata(category)'
                )
                # Binary vectors table for cascade search
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS binary_vectors (
                        chunk_id INTEGER PRIMARY KEY,
                        vector BLOB NOT NULL
                    )
                ''')
                conn.commit()
                logger.debug("VectorMetadataStore schema created/verified")
            except sqlite3.Error as e:
                raise StorageError(
                    f"Failed to create schema: {e}",
                    db_path=str(self.db_path),
                    operation="_ensure_schema"
                ) from e

    def add_chunk(
        self,
        chunk_id: int,
        file_path: str,
        content: str,
        start_line: Optional[int] = None,
        end_line: Optional[int] = None,
        category: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        source_index_db: Optional[str] = None,
    ) -> None:
        """Add a single chunk's metadata.

        Args:
            chunk_id: Global unique chunk ID.
            file_path: Path to source file.
            content: Chunk text content.
            start_line: Start line in source file.
            end_line: End line in source file.
            category: Content category (code/doc).
            metadata: Additional metadata dictionary.
            source_index_db: Path to source _index.db file.
        """
        with self._lock:
            conn = self._get_connection()
            try:
                metadata_json = json.dumps(metadata) if metadata else None
                conn.execute(
                    '''
                    INSERT OR REPLACE INTO chunk_metadata
                    (chunk_id, file_path, content, start_line, end_line,
                     category, metadata, source_index_db)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''',
                    (chunk_id, file_path, content, start_line, end_line,
                     category, metadata_json, source_index_db)
                )
                conn.commit()
            except sqlite3.Error as e:
                raise StorageError(
                    f"Failed to add chunk {chunk_id}: {e}",
                    db_path=str(self.db_path),
                    operation="add_chunk"
                ) from e

    def add_chunks(self, chunks: List[Dict[str, Any]]) -> None:
        """Batch insert chunk metadata.

        Args:
            chunks: List of dictionaries with keys:
                - chunk_id (required): Global unique chunk ID
                - file_path (required): Path to source file
                - content: Chunk text content
                - start_line: Start line in source file
                - end_line: End line in source file
                - category: Content category (code/doc)
                - metadata: Additional metadata dictionary
                - source_index_db: Path to source _index.db file
        """
        if not chunks:
            return

        with self._lock:
            conn = self._get_connection()
            try:
                batch_data = []
                for chunk in chunks:
                    metadata = chunk.get("metadata")
                    metadata_json = json.dumps(metadata) if metadata else None
                    batch_data.append((
                        chunk["chunk_id"],
                        chunk["file_path"],
                        chunk.get("content"),
                        chunk.get("start_line"),
                        chunk.get("end_line"),
                        chunk.get("category"),
                        metadata_json,
                        chunk.get("source_index_db"),
                    ))

                conn.executemany(
                    '''
                    INSERT OR REPLACE INTO chunk_metadata
                    (chunk_id, file_path, content, start_line, end_line,
                     category, metadata, source_index_db)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ''',
                    batch_data
                )
                conn.commit()
                logger.debug("Batch inserted %d chunk metadata records", len(chunks))
            except sqlite3.Error as e:
                raise StorageError(
                    f"Failed to batch insert chunks: {e}",
                    db_path=str(self.db_path),
                    operation="add_chunks"
                ) from e

    def get_chunks_by_ids(
        self,
        chunk_ids: List[int],
        category: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Retrieve chunks by their IDs - the key optimization.

        This is the primary method that replaces traversing all _index.db files.
        Provides O(1) lookup by chunk ID instead of O(n) where n is the number
        of index databases.

        Args:
            chunk_ids: List of chunk IDs to retrieve.
            category: Optional category filter ('code' or 'doc').

        Returns:
            List of dictionaries with chunk metadata:
                - chunk_id: Global chunk ID
                - file_path: Path to source file
                - content: Chunk text content
                - start_line: Start line in source file
                - end_line: End line in source file
                - category: Content category
                - metadata: Parsed metadata dictionary
                - source_index_db: Source _index.db path
        """
        if not chunk_ids:
            return []

        # No lock needed for reads: WAL mode + thread-local connections ensure safety
        conn = self._get_connection()
        try:
            placeholders = ",".join("?" * len(chunk_ids))

            if category:
                query = f'''
                    SELECT chunk_id, file_path, content, start_line, end_line,
                           category, metadata, source_index_db
                    FROM chunk_metadata
                    WHERE chunk_id IN ({placeholders}) AND category = ?
                '''
                params = list(chunk_ids) + [category]
            else:
                query = f'''
                    SELECT chunk_id, file_path, content, start_line, end_line,
                           category, metadata, source_index_db
                    FROM chunk_metadata
                    WHERE chunk_id IN ({placeholders})
                '''
                params = list(chunk_ids)

            rows = conn.execute(query, params).fetchall()

            results = []
            for row in rows:
                metadata = None
                if row["metadata"]:
                    try:
                        metadata = json.loads(row["metadata"])
                    except json.JSONDecodeError:
                        metadata = {}

                results.append({
                    "chunk_id": row["chunk_id"],
                    "file_path": row["file_path"],
                    "content": row["content"],
                    "start_line": row["start_line"],
                    "end_line": row["end_line"],
                    "category": row["category"],
                    "metadata": metadata or {},
                    "source_index_db": row["source_index_db"],
                })

            return results

        except sqlite3.Error as e:
            logger.error("Failed to get chunks by IDs: %s", e)
            return []

    def get_chunk_count(self) -> int:
        """Get total number of chunks in store.

        Returns:
            Total chunk count.
        """
        # No lock needed for reads: WAL mode + thread-local connections ensure safety
        conn = self._get_connection()
        try:
            row = conn.execute(
                "SELECT COUNT(*) FROM chunk_metadata"
            ).fetchone()
            return row[0] if row else 0
        except sqlite3.Error:
            return 0

    def clear(self) -> None:
        """Clear all metadata."""
        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute("DELETE FROM chunk_metadata")
                conn.commit()
                logger.info("Cleared all chunk metadata")
            except sqlite3.Error as e:
                raise StorageError(
                    f"Failed to clear metadata: {e}",
                    db_path=str(self.db_path),
                    operation="clear"
                ) from e

    def close(self) -> None:
        """Close database connection."""
        with self._lock:
            conn = getattr(self._local, "conn", None)
            if conn is not None:
                conn.close()
                self._local.conn = None

    def __enter__(self) -> "VectorMetadataStore":
        """Context manager entry."""
        self._ensure_schema()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        """Context manager exit."""
        self.close()

    # ============= Binary Vector Methods for Cascade Search =============

    def add_binary_vectors(
        self, chunk_ids: List[int], binary_vectors: List[bytes]
    ) -> None:
        """Batch insert binary vectors for cascade search.

        Args:
            chunk_ids: List of chunk IDs.
            binary_vectors: List of packed binary vectors (as bytes).
        """
        if not chunk_ids or len(chunk_ids) != len(binary_vectors):
            return

        with self._lock:
            conn = self._get_connection()
            try:
                data = list(zip(chunk_ids, binary_vectors))
                conn.executemany(
                    "INSERT OR REPLACE INTO binary_vectors (chunk_id, vector) VALUES (?, ?)",
                    data
                )
                conn.commit()
                logger.debug("Added %d binary vectors", len(chunk_ids))
            except sqlite3.Error as e:
                raise StorageError(
                    f"Failed to add binary vectors: {e}",
                    db_path=str(self.db_path),
                    operation="add_binary_vectors"
                ) from e

    def get_all_binary_vectors(self) -> List[tuple]:
        """Get all binary vectors for cascade search.

        Returns:
            List of (chunk_id, vector_bytes) tuples.
        """
        conn = self._get_connection()
        try:
            rows = conn.execute(
                "SELECT chunk_id, vector FROM binary_vectors"
            ).fetchall()
            return [(row[0], row[1]) for row in rows]
        except sqlite3.Error as e:
            logger.error("Failed to get binary vectors: %s", e)
            return []

    def get_binary_vector_count(self) -> int:
        """Get total number of binary vectors.

        Returns:
            Binary vector count.
        """
        conn = self._get_connection()
        try:
            row = conn.execute(
                "SELECT COUNT(*) FROM binary_vectors"
            ).fetchone()
            return row[0] if row else 0
        except sqlite3.Error:
            return 0

    def clear_binary_vectors(self) -> None:
        """Clear all binary vectors."""
        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute("DELETE FROM binary_vectors")
                conn.commit()
                logger.info("Cleared all binary vectors")
            except sqlite3.Error as e:
                raise StorageError(
                    f"Failed to clear binary vectors: {e}",
                    db_path=str(self.db_path),
                    operation="clear_binary_vectors"
                ) from e
