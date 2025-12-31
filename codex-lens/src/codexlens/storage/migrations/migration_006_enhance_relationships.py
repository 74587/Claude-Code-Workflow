"""
Migration 006: Ensure relationship tables and indexes exist.

This migration is intentionally idempotent. It creates the `code_relationships`
table (used for graph visualization) and its indexes if missing.
"""

from __future__ import annotations

import logging
from sqlite3 import Connection

log = logging.getLogger(__name__)


def upgrade(db_conn: Connection) -> None:
    cursor = db_conn.cursor()

    log.info("Ensuring code_relationships table exists...")
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS code_relationships (
            id INTEGER PRIMARY KEY,
            source_symbol_id INTEGER NOT NULL REFERENCES symbols (id) ON DELETE CASCADE,
            target_qualified_name TEXT NOT NULL,
            relationship_type TEXT NOT NULL,
            source_line INTEGER NOT NULL,
            target_file TEXT
        )
        """
    )

    log.info("Ensuring relationship indexes exist...")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rel_source ON code_relationships(source_symbol_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rel_target ON code_relationships(target_qualified_name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_rel_type ON code_relationships(relationship_type)")

