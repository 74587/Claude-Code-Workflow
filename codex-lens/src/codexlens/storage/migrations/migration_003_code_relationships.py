"""
Migration 003: Add code relationships storage.

This migration introduces the `code_relationships` table to store semantic
relationships between code symbols (function calls, inheritance, imports).
This enables graph-based code navigation and dependency analysis.
"""

import logging
from sqlite3 import Connection

log = logging.getLogger(__name__)


def upgrade(db_conn: Connection):
    """
    Applies the migration to add code relationships table.

    - Creates `code_relationships` table with foreign key to symbols
    - Creates indexes for efficient relationship queries
    - Supports lazy expansion with target_symbol being qualified names

    Args:
        db_conn: The SQLite database connection.
    """
    cursor = db_conn.cursor()

    log.info("Creating 'code_relationships' table...")
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS code_relationships (
            id INTEGER PRIMARY KEY,
            source_symbol_id INTEGER NOT NULL,
            target_qualified_name TEXT NOT NULL,
            relationship_type TEXT NOT NULL,
            source_line INTEGER NOT NULL,
            target_file TEXT,
            FOREIGN KEY (source_symbol_id) REFERENCES symbols (id) ON DELETE CASCADE
        )
        """
    )

    log.info("Creating indexes for code_relationships...")
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_relationships_source ON code_relationships (source_symbol_id)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_relationships_target ON code_relationships (target_qualified_name)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_relationships_type ON code_relationships (relationship_type)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_relationships_source_line ON code_relationships (source_line)"
    )

    log.info("Finished creating code_relationships table and indexes.")
