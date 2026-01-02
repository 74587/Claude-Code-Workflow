"""
Migration 010: Add multi-vector storage support for cascade retrieval.

This migration introduces the chunks table with multi-vector support:
- chunks: Stores code chunks with multiple embedding types
  - embedding: Original embedding for backward compatibility
  - embedding_binary: 256-dim binary vector for coarse ranking (fast)
  - embedding_dense: 2048-dim dense vector for fine ranking (precise)

The multi-vector architecture enables cascade retrieval:
1. First stage: Fast binary vector search for candidate retrieval
2. Second stage: Dense vector reranking for precision
"""

import logging
from sqlite3 import Connection

log = logging.getLogger(__name__)


def upgrade(db_conn: Connection) -> None:
    """
    Adds chunks table with multi-vector embedding columns.

    Creates:
    - chunks: Table for storing code chunks with multiple embedding types
    - idx_chunks_file_path: Index for efficient file-based lookups

    Also migrates existing chunks tables by adding new columns if needed.

    Args:
        db_conn: The SQLite database connection.
    """
    cursor = db_conn.cursor()

    # Check if chunks table already exists
    table_exists = cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='chunks'"
    ).fetchone()

    if table_exists:
        # Migrate existing table - add new columns if missing
        log.info("chunks table exists, checking for missing columns...")
        
        col_info = cursor.execute("PRAGMA table_info(chunks)").fetchall()
        existing_columns = {row[1] for row in col_info}
        
        if "embedding_binary" not in existing_columns:
            log.info("Adding embedding_binary column to chunks table...")
            cursor.execute(
                "ALTER TABLE chunks ADD COLUMN embedding_binary BLOB"
            )
        
        if "embedding_dense" not in existing_columns:
            log.info("Adding embedding_dense column to chunks table...")
            cursor.execute(
                "ALTER TABLE chunks ADD COLUMN embedding_dense BLOB"
            )
    else:
        # Create new table with all columns
        log.info("Creating chunks table with multi-vector support...")
        cursor.execute(
            """
            CREATE TABLE chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding BLOB,
                embedding_binary BLOB,
                embedding_dense BLOB,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

    # Create index for file-based lookups
    log.info("Creating index for chunks table...")
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_chunks_file_path
        ON chunks(file_path)
        """
    )

    log.info("Migration 010 completed successfully")


def downgrade(db_conn: Connection) -> None:
    """
    Removes multi-vector columns from chunks table.

    Note: This does not drop the chunks table entirely to preserve data.
    Only the new columns added by this migration are removed.

    Args:
        db_conn: The SQLite database connection.
    """
    cursor = db_conn.cursor()

    log.info("Removing multi-vector columns from chunks table...")
    
    # SQLite doesn't support DROP COLUMN directly in older versions
    # We need to recreate the table without the columns
    
    # Check if chunks table exists
    table_exists = cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='chunks'"
    ).fetchone()
    
    if not table_exists:
        log.info("chunks table does not exist, nothing to downgrade")
        return

    # Check if the columns exist before trying to remove them
    col_info = cursor.execute("PRAGMA table_info(chunks)").fetchall()
    existing_columns = {row[1] for row in col_info}
    
    needs_migration = (
        "embedding_binary" in existing_columns or
        "embedding_dense" in existing_columns
    )
    
    if not needs_migration:
        log.info("Multi-vector columns not present, nothing to remove")
        return

    # Recreate table without the new columns
    log.info("Recreating chunks table without multi-vector columns...")
    
    cursor.execute(
        """
        CREATE TABLE chunks_backup (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            file_path TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding BLOB,
            metadata TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    
    cursor.execute(
        """
        INSERT INTO chunks_backup (id, file_path, content, embedding, metadata, created_at)
        SELECT id, file_path, content, embedding, metadata, created_at FROM chunks
        """
    )
    
    cursor.execute("DROP TABLE chunks")
    cursor.execute("ALTER TABLE chunks_backup RENAME TO chunks")
    
    # Recreate index
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_chunks_file_path
        ON chunks(file_path)
        """
    )

    log.info("Migration 010 downgrade completed successfully")
