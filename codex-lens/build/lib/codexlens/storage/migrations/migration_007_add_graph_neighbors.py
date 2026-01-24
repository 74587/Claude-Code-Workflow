"""
Migration 007: Add precomputed graph neighbor table for search expansion.

Adds:
- graph_neighbors: cached N-hop neighbors between symbols (keyed by symbol ids)

This table is derived data (a cache) and is safe to rebuild at any time.
The migration is intentionally idempotent.
"""

from __future__ import annotations

import logging
from sqlite3 import Connection

log = logging.getLogger(__name__)


def upgrade(db_conn: Connection) -> None:
    cursor = db_conn.cursor()

    log.info("Creating graph_neighbors table...")
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS graph_neighbors (
            source_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
            neighbor_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
            relationship_depth INTEGER NOT NULL,
            PRIMARY KEY (source_symbol_id, neighbor_symbol_id)
        )
        """
    )

    log.info("Creating indexes for graph_neighbors...")
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_graph_neighbors_source_depth
        ON graph_neighbors(source_symbol_id, relationship_depth)
        """
    )
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS idx_graph_neighbors_neighbor
        ON graph_neighbors(neighbor_symbol_id)
        """
    )

