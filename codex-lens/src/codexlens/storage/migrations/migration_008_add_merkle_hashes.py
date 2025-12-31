"""
Migration 008: Add Merkle hash tables for content-based incremental indexing.

Adds:
- merkle_hashes: per-file SHA-256 hashes (keyed by file_id)
- merkle_state: directory-level root hash (single row, id=1)

Backfills merkle_hashes using the existing `files.content` column when available.
"""

from __future__ import annotations

import hashlib
import logging
import time
from sqlite3 import Connection

log = logging.getLogger(__name__)


def upgrade(db_conn: Connection) -> None:
    cursor = db_conn.cursor()

    log.info("Creating merkle_hashes table...")
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS merkle_hashes (
            file_id INTEGER PRIMARY KEY REFERENCES files(id) ON DELETE CASCADE,
            sha256 TEXT NOT NULL,
            updated_at REAL
        )
        """
    )

    log.info("Creating merkle_state table...")
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS merkle_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            root_hash TEXT,
            updated_at REAL
        )
        """
    )

    # Backfill file hashes from stored content (best-effort).
    try:
        rows = cursor.execute("SELECT id, content FROM files").fetchall()
    except Exception as exc:
        log.warning("Unable to backfill merkle hashes (files table missing?): %s", exc)
        return

    now = time.time()
    inserts: list[tuple[int, str, float]] = []

    for row in rows:
        file_id = int(row[0])
        content = row[1]
        if content is None:
            continue
        try:
            digest = hashlib.sha256(str(content).encode("utf-8", errors="ignore")).hexdigest()
            inserts.append((file_id, digest, now))
        except Exception:
            continue

    if not inserts:
        return

    log.info("Backfilling %d file hashes...", len(inserts))
    cursor.executemany(
        """
        INSERT INTO merkle_hashes(file_id, sha256, updated_at)
        VALUES(?, ?, ?)
        ON CONFLICT(file_id) DO UPDATE SET
            sha256=excluded.sha256,
            updated_at=excluded.updated_at
        """,
        inserts,
    )

