"""
Migration 002: Add token_count and symbol_type to symbols table.

This migration adds token counting metadata to symbols for accurate chunk
splitting and performance optimization. It also adds symbol_type for better
filtering in searches.
"""

import logging
from sqlite3 import Connection

log = logging.getLogger(__name__)


def upgrade(db_conn: Connection):
    """
    Applies the migration to add token metadata to symbols.

    - Adds token_count column to symbols table
    - Adds symbol_type column to symbols table (for future use)
    - Creates index on symbol_type for efficient filtering
    - Backfills existing symbols with NULL token_count (to be calculated lazily)

    Args:
        db_conn: The SQLite database connection.
    """
    cursor = db_conn.cursor()

    log.info("Adding token_count column to symbols table...")
    try:
        cursor.execute("ALTER TABLE symbols ADD COLUMN token_count INTEGER")
        log.info("Successfully added token_count column.")
    except Exception as e:
        # Column might already exist
        log.warning(f"Could not add token_count column (might already exist): {e}")

    log.info("Adding symbol_type column to symbols table...")
    try:
        cursor.execute("ALTER TABLE symbols ADD COLUMN symbol_type TEXT")
        log.info("Successfully added symbol_type column.")
    except Exception as e:
        # Column might already exist
        log.warning(f"Could not add symbol_type column (might already exist): {e}")

    log.info("Creating index on symbol_type for efficient filtering...")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_symbols_type ON symbols(symbol_type)")

    log.info("Migration 002 completed successfully.")
