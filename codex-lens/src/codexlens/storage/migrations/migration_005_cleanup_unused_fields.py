"""
Migration 005: Remove unused and redundant database fields.

This migration removes four problematic fields identified by Gemini analysis:

1. **semantic_metadata.keywords** (deprecated - replaced by file_keywords table)
   - Data: Migrated to normalized file_keywords table in migration 001
   - Impact: Column now redundant, remove to prevent sync issues

2. **symbols.token_count** (unused - always NULL)
   - Data: Never populated, always NULL
   - Impact: No data loss, just removes unused column

3. **symbols.symbol_type** (redundant - duplicates kind)
   - Data: Redundant with symbols.kind field
   - Impact: No data loss, kind field contains same information

4. **subdirs.direct_files** (unused - never displayed)
   - Data: Never used in queries or display logic
   - Impact: No data loss, just removes unused column

Schema changes use table recreation pattern (SQLite best practice):
- Create new table without deprecated columns
- Copy data from old table
- Drop old table
- Rename new table
- Recreate indexes
"""

import logging
from sqlite3 import Connection

log = logging.getLogger(__name__)


def upgrade(db_conn: Connection):
    """Remove unused and redundant fields from schema.

    Args:
        db_conn: The SQLite database connection.
    """
    cursor = db_conn.cursor()

    try:
        cursor.execute("BEGIN TRANSACTION")

        # Step 1: Remove semantic_metadata.keywords
        log.info("Removing semantic_metadata.keywords column...")

        # Check if semantic_metadata table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='semantic_metadata'"
        )
        if cursor.fetchone():
            cursor.execute("""
                CREATE TABLE semantic_metadata_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id INTEGER NOT NULL UNIQUE,
                    summary TEXT,
                    purpose TEXT,
                    llm_tool TEXT,
                    generated_at REAL,
                    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
                )
            """)

            cursor.execute("""
                INSERT INTO semantic_metadata_new (id, file_id, summary, purpose, llm_tool, generated_at)
                SELECT id, file_id, summary, purpose, llm_tool, generated_at
                FROM semantic_metadata
            """)

            cursor.execute("DROP TABLE semantic_metadata")
            cursor.execute("ALTER TABLE semantic_metadata_new RENAME TO semantic_metadata")

            # Recreate index
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_semantic_file ON semantic_metadata(file_id)"
            )
            log.info("Removed semantic_metadata.keywords column")
        else:
            log.info("semantic_metadata table does not exist, skipping")

        # Step 2: Remove symbols.token_count and symbols.symbol_type
        log.info("Removing symbols.token_count and symbols.symbol_type columns...")

        # Check if symbols table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='symbols'"
        )
        if cursor.fetchone():
            cursor.execute("""
                CREATE TABLE symbols_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    file_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    kind TEXT,
                    start_line INTEGER,
                    end_line INTEGER,
                    FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
                )
            """)

            cursor.execute("""
                INSERT INTO symbols_new (id, file_id, name, kind, start_line, end_line)
                SELECT id, file_id, name, kind, start_line, end_line
                FROM symbols
            """)

            cursor.execute("DROP TABLE symbols")
            cursor.execute("ALTER TABLE symbols_new RENAME TO symbols")

            # Recreate indexes (excluding idx_symbols_type which indexed symbol_type)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name)")
            log.info("Removed symbols.token_count and symbols.symbol_type columns")
        else:
            log.info("symbols table does not exist, skipping")

        # Step 3: Remove subdirs.direct_files
        log.info("Removing subdirs.direct_files column...")

        # Check if subdirs table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='subdirs'"
        )
        if cursor.fetchone():
            cursor.execute("""
                CREATE TABLE subdirs_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    index_path TEXT NOT NULL,
                    files_count INTEGER DEFAULT 0,
                    last_updated REAL
                )
            """)

            cursor.execute("""
                INSERT INTO subdirs_new (id, name, index_path, files_count, last_updated)
                SELECT id, name, index_path, files_count, last_updated
                FROM subdirs
            """)

            cursor.execute("DROP TABLE subdirs")
            cursor.execute("ALTER TABLE subdirs_new RENAME TO subdirs")

            # Recreate index
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_subdirs_name ON subdirs(name)")
            log.info("Removed subdirs.direct_files column")
        else:
            log.info("subdirs table does not exist, skipping")

        cursor.execute("COMMIT")
        log.info("Migration 005 completed successfully")

        # Vacuum to reclaim space (outside transaction)
        try:
            log.info("Running VACUUM to reclaim space...")
            cursor.execute("VACUUM")
            log.info("VACUUM completed successfully")
        except Exception as e:
            log.warning(f"VACUUM failed (non-critical): {e}")

    except Exception as e:
        log.error(f"Migration 005 failed: {e}")
        try:
            cursor.execute("ROLLBACK")
        except Exception:
            pass
        raise


def downgrade(db_conn: Connection):
    """Restore removed fields (data will be lost for keywords, token_count, symbol_type, direct_files).

    This is a placeholder - true downgrade is not feasible as data is lost.
    The migration is designed to be one-way since removed fields are unused/redundant.

    Args:
        db_conn: The SQLite database connection.
    """
    log.warning(
        "Migration 005 downgrade not supported - removed fields are unused/redundant. "
        "Data cannot be restored."
    )
    raise NotImplementedError(
        "Migration 005 downgrade not supported - this is a one-way migration"
    )
