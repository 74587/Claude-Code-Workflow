"""SQLite utility functions for CodexLens storage layer."""

from __future__ import annotations

import logging
import sqlite3

log = logging.getLogger(__name__)


def check_trigram_support(conn: sqlite3.Connection) -> bool:
    """Check if SQLite supports trigram tokenizer for FTS5.

    Trigram tokenizer requires SQLite >= 3.34.0.

    Args:
        conn: Database connection to test

    Returns:
        True if trigram tokenizer is available, False otherwise
    """
    try:
        # Test by creating a temporary virtual table with trigram tokenizer
        conn.execute(
            """
            CREATE VIRTUAL TABLE IF NOT EXISTS test_trigram_check
            USING fts5(test_content, tokenize='trigram')
            """
        )
        # Clean up test table
        conn.execute("DROP TABLE IF EXISTS test_trigram_check")
        conn.commit()
        return True
    except sqlite3.OperationalError as e:
        # Trigram tokenizer not available
        if "unrecognized tokenizer" in str(e).lower():
            log.debug("Trigram tokenizer not available in this SQLite version")
            return False
        # Other operational errors should be re-raised
        raise
    except Exception:
        # Any other exception means trigram is not supported
        return False


def get_sqlite_version(conn: sqlite3.Connection) -> tuple[int, int, int]:
    """Get SQLite version as (major, minor, patch) tuple.

    Args:
        conn: Database connection

    Returns:
        Version tuple, e.g., (3, 34, 1)
    """
    row = conn.execute("SELECT sqlite_version()").fetchone()
    version_str = row[0] if row else "0.0.0"
    parts = version_str.split('.')
    try:
        major = int(parts[0]) if len(parts) > 0 else 0
        minor = int(parts[1]) if len(parts) > 1 else 0
        patch = int(parts[2]) if len(parts) > 2 else 0
        return (major, minor, patch)
    except (ValueError, IndexError):
        return (0, 0, 0)
