"""
Migration 004: Add dual FTS tables for exact and fuzzy matching.

This migration introduces two FTS5 tables:
- files_fts_exact: Uses unicode61 tokenizer for exact token matching
- files_fts_fuzzy: Uses trigram tokenizer (or extended unicode61) for substring/fuzzy matching

Both tables are synchronized with the files table via triggers for automatic updates.
"""

import logging
from sqlite3 import Connection

from codexlens.storage.sqlite_utils import check_trigram_support, get_sqlite_version

log = logging.getLogger(__name__)


def upgrade(db_conn: Connection):
    """
    Applies the migration to add dual FTS tables.

    - Drops old files_fts table and triggers
    - Creates files_fts_exact with unicode61 tokenizer
    - Creates files_fts_fuzzy with trigram or extended unicode61 tokenizer
    - Creates synchronized triggers for both tables
    - Rebuilds FTS indexes from files table

    Args:
        db_conn: The SQLite database connection.
    """
    cursor = db_conn.cursor()

    try:
        # Check trigram support
        has_trigram = check_trigram_support(db_conn)
        version = get_sqlite_version(db_conn)
        log.info(f"SQLite version: {'.'.join(map(str, version))}")

        if has_trigram:
            log.info("Trigram tokenizer available, using for fuzzy FTS table")
            fuzzy_tokenizer = "trigram"
        else:
            log.warning(
                f"Trigram tokenizer not available (requires SQLite >= 3.34), "
                f"using extended unicode61 tokenizer for fuzzy matching"
            )
            fuzzy_tokenizer = "unicode61 tokenchars '_-.'"

        # Start transaction
        cursor.execute("BEGIN TRANSACTION")

        # Check if files table has 'name' column (v2 schema doesn't have it)
        cursor.execute("PRAGMA table_info(files)")
        columns = {row[1] for row in cursor.fetchall()}
        
        if 'name' not in columns:
            log.info("Adding 'name' column to files table (v2 schema upgrade)...")
            # Add name column
            cursor.execute("ALTER TABLE files ADD COLUMN name TEXT")
            # Populate name from path (extract filename from last '/')
            # Use Python to do the extraction since SQLite doesn't have reverse()
            cursor.execute("SELECT rowid, path FROM files")
            rows = cursor.fetchall()
            for rowid, path in rows:
                # Extract filename from path
                name = path.split('/')[-1] if '/' in path else path
                cursor.execute("UPDATE files SET name = ? WHERE rowid = ?", (name, rowid))
            
        # Rename 'path' column to 'full_path' if needed
        if 'path' in columns and 'full_path' not in columns:
            log.info("Renaming 'path' to 'full_path' (v2 schema upgrade)...")
            # Check if indexed_at column exists in v2 schema
            has_indexed_at = 'indexed_at' in columns
            has_mtime = 'mtime' in columns
            
            # SQLite doesn't support RENAME COLUMN before 3.25, so use table recreation
            cursor.execute("""
                CREATE TABLE files_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    full_path TEXT NOT NULL UNIQUE,
                    content TEXT,
                    language TEXT,
                    mtime REAL,
                    indexed_at TEXT
                )
            """)
            
            # Build INSERT statement based on available columns
            # Note: v2 schema has no rowid (path is PRIMARY KEY), so use NULL for AUTOINCREMENT
            if has_indexed_at and has_mtime:
                cursor.execute("""
                    INSERT INTO files_new (name, full_path, content, language, mtime, indexed_at)
                    SELECT name, path, content, language, mtime, indexed_at FROM files
                """)
            elif has_indexed_at:
                cursor.execute("""
                    INSERT INTO files_new (name, full_path, content, language, indexed_at)
                    SELECT name, path, content, language, indexed_at FROM files
                """)
            elif has_mtime:
                cursor.execute("""
                    INSERT INTO files_new (name, full_path, content, language, mtime)
                    SELECT name, path, content, language, mtime FROM files
                """)
            else:
                cursor.execute("""
                    INSERT INTO files_new (name, full_path, content, language)
                    SELECT name, path, content, language FROM files
                """)
            
            cursor.execute("DROP TABLE files")
            cursor.execute("ALTER TABLE files_new RENAME TO files")

        log.info("Dropping old FTS triggers and table...")
        # Drop old triggers
        cursor.execute("DROP TRIGGER IF EXISTS files_ai")
        cursor.execute("DROP TRIGGER IF EXISTS files_ad")
        cursor.execute("DROP TRIGGER IF EXISTS files_au")

        # Drop old FTS table
        cursor.execute("DROP TABLE IF EXISTS files_fts")

        # Create exact FTS table (unicode61 with underscores/hyphens/dots as token chars)
        # Note: tokenchars includes '.' to properly tokenize qualified names like PortRole.FLOW
        log.info("Creating files_fts_exact table with unicode61 tokenizer...")
        cursor.execute(
            """
            CREATE VIRTUAL TABLE files_fts_exact USING fts5(
                name, full_path UNINDEXED, content,
                content='files',
                content_rowid='id',
                tokenize="unicode61 tokenchars '_-.'"
            )
            """
        )

        # Create fuzzy FTS table (trigram or extended unicode61)
        log.info(f"Creating files_fts_fuzzy table with {fuzzy_tokenizer} tokenizer...")
        cursor.execute(
            f"""
            CREATE VIRTUAL TABLE files_fts_fuzzy USING fts5(
                name, full_path UNINDEXED, content,
                content='files',
                content_rowid='id',
                tokenize="{fuzzy_tokenizer}"
            )
            """
        )

        # Create synchronized triggers for files_fts_exact
        log.info("Creating triggers for files_fts_exact...")
        cursor.execute(
            """
            CREATE TRIGGER files_exact_ai AFTER INSERT ON files BEGIN
                INSERT INTO files_fts_exact(rowid, name, full_path, content)
                VALUES(new.id, new.name, new.full_path, new.content);
            END
            """
        )
        cursor.execute(
            """
            CREATE TRIGGER files_exact_ad AFTER DELETE ON files BEGIN
                INSERT INTO files_fts_exact(files_fts_exact, rowid, name, full_path, content)
                VALUES('delete', old.id, old.name, old.full_path, old.content);
            END
            """
        )
        cursor.execute(
            """
            CREATE TRIGGER files_exact_au AFTER UPDATE ON files BEGIN
                INSERT INTO files_fts_exact(files_fts_exact, rowid, name, full_path, content)
                VALUES('delete', old.id, old.name, old.full_path, old.content);
                INSERT INTO files_fts_exact(rowid, name, full_path, content)
                VALUES(new.id, new.name, new.full_path, new.content);
            END
            """
        )

        # Create synchronized triggers for files_fts_fuzzy
        log.info("Creating triggers for files_fts_fuzzy...")
        cursor.execute(
            """
            CREATE TRIGGER files_fuzzy_ai AFTER INSERT ON files BEGIN
                INSERT INTO files_fts_fuzzy(rowid, name, full_path, content)
                VALUES(new.id, new.name, new.full_path, new.content);
            END
            """
        )
        cursor.execute(
            """
            CREATE TRIGGER files_fuzzy_ad AFTER DELETE ON files BEGIN
                INSERT INTO files_fts_fuzzy(files_fts_fuzzy, rowid, name, full_path, content)
                VALUES('delete', old.id, old.name, old.full_path, old.content);
            END
            """
        )
        cursor.execute(
            """
            CREATE TRIGGER files_fuzzy_au AFTER UPDATE ON files BEGIN
                INSERT INTO files_fts_fuzzy(files_fts_fuzzy, rowid, name, full_path, content)
                VALUES('delete', old.id, old.name, old.full_path, old.content);
                INSERT INTO files_fts_fuzzy(rowid, name, full_path, content)
                VALUES(new.id, new.name, new.full_path, new.content);
            END
            """
        )

        # Rebuild FTS indexes from files table
        log.info("Rebuilding FTS indexes from files table...")
        cursor.execute("INSERT INTO files_fts_exact(files_fts_exact) VALUES('rebuild')")
        cursor.execute("INSERT INTO files_fts_fuzzy(files_fts_fuzzy) VALUES('rebuild')")

        # Commit transaction
        cursor.execute("COMMIT")
        log.info("Migration 004 completed successfully")

        # Vacuum to reclaim space (outside transaction)
        try:
            log.info("Running VACUUM to reclaim space...")
            cursor.execute("VACUUM")
        except Exception as e:
            log.warning(f"VACUUM failed (non-critical): {e}")

    except Exception as e:
        log.error(f"Migration 004 failed: {e}")
        try:
            cursor.execute("ROLLBACK")
        except Exception:
            pass
        raise
