"""
Migration 009: Add SPLADE sparse retrieval tables.

This migration introduces SPLADE (Sparse Lexical AnD Expansion) support:
- splade_metadata: Model configuration (model name, vocab size, ONNX path)
- splade_posting_list: Inverted index mapping token_id -> (chunk_id, weight)

The SPLADE tables are designed for efficient sparse vector retrieval:
- Token-based lookup for query expansion
- Chunk-based deletion for index maintenance
- Maintains backward compatibility with existing FTS tables
"""

import logging
from sqlite3 import Connection

log = logging.getLogger(__name__)


def upgrade(db_conn: Connection) -> None:
    """
    Adds SPLADE tables for sparse retrieval.

    Creates:
    - splade_metadata: Stores model configuration and ONNX path
    - splade_posting_list: Inverted index with token_id -> (chunk_id, weight) mappings
    - Indexes for efficient token-based and chunk-based lookups

    Args:
        db_conn: The SQLite database connection.
    """
    cursor = db_conn.cursor()

    log.info("Creating splade_metadata table...")
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS splade_metadata (
            id INTEGER PRIMARY KEY DEFAULT 1,
            model_name TEXT NOT NULL,
            vocab_size INTEGER NOT NULL,
            onnx_path TEXT,
            created_at REAL
        )
        """
    )

    log.info("Creating splade_posting_list table...")
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS splade_posting_list (
            token_id INTEGER NOT NULL,
            chunk_id INTEGER NOT NULL,
            weight REAL NOT NULL,
            PRIMARY KEY (token_id, chunk_id),
            FOREIGN KEY (chunk_id) REFERENCES semantic_chunks(id) ON DELETE CASCADE
        )
        """
    )

    log.info("Creating indexes for splade_posting_list...")
    # Index for efficient chunk-based lookups (deletion, updates)
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_splade_by_chunk
        ON splade_posting_list(chunk_id)
        """
    )

    # Index for efficient term-based retrieval
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_splade_by_token
        ON splade_posting_list(token_id)
        """
    )

    log.info("Migration 009 completed successfully")


def downgrade(db_conn: Connection) -> None:
    """
    Removes SPLADE tables.

    Drops:
    - splade_posting_list (and associated indexes)
    - splade_metadata

    Args:
        db_conn: The SQLite database connection.
    """
    cursor = db_conn.cursor()

    log.info("Dropping SPLADE indexes...")
    cursor.execute("DROP INDEX IF EXISTS idx_splade_by_chunk")
    cursor.execute("DROP INDEX IF EXISTS idx_splade_by_token")

    log.info("Dropping splade_posting_list table...")
    cursor.execute("DROP TABLE IF EXISTS splade_posting_list")

    log.info("Dropping splade_metadata table...")
    cursor.execute("DROP TABLE IF EXISTS splade_metadata")

    log.info("Migration 009 downgrade completed successfully")
