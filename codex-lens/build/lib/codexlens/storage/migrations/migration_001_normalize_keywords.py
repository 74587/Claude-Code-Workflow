"""
Migration 001: Normalize keywords into separate tables.

This migration introduces two new tables, `keywords` and `file_keywords`, to
store semantic keywords in a normalized fashion. It then migrates the existing
keywords from the `semantic_data` JSON blob in the `files` table into these
new tables. This is intended to speed up keyword-based searches significantly.
"""

import json
import logging
from sqlite3 import Connection

log = logging.getLogger(__name__)


def upgrade(db_conn: Connection):
    """
    Applies the migration to normalize keywords.

    - Creates `keywords` and `file_keywords` tables.
    - Creates indexes for efficient querying.
    - Migrates data from `files.semantic_data` to the new tables.

    Args:
        db_conn: The SQLite database connection.
    """
    cursor = db_conn.cursor()

    log.info("Creating 'keywords' and 'file_keywords' tables...")
    # Create a table to store unique keywords
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS keywords (
            id INTEGER PRIMARY KEY,
            keyword TEXT NOT NULL UNIQUE
        )
        """
    )

    # Create a join table to link files and keywords (many-to-many)
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS file_keywords (
            file_id INTEGER NOT NULL,
            keyword_id INTEGER NOT NULL,
            PRIMARY KEY (file_id, keyword_id),
            FOREIGN KEY (file_id) REFERENCES files (id) ON DELETE CASCADE,
            FOREIGN KEY (keyword_id) REFERENCES keywords (id) ON DELETE CASCADE
        )
        """
    )
    
    log.info("Creating indexes for new keyword tables...")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords (keyword)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_file_keywords_file_id ON file_keywords (file_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_file_keywords_keyword_id ON file_keywords (keyword_id)")

    log.info("Migrating existing keywords from 'semantic_metadata' table...")

    # Check if semantic_metadata table exists before querying
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='semantic_metadata'")
    if not cursor.fetchone():
        log.info("No 'semantic_metadata' table found, skipping data migration.")
        return

    # Check if 'keywords' column exists in semantic_metadata table
    # (current schema may already use normalized tables without this column)
    cursor.execute("PRAGMA table_info(semantic_metadata)")
    columns = {row[1] for row in cursor.fetchall()}
    if "keywords" not in columns:
        log.info("No 'keywords' column in semantic_metadata table, skipping data migration.")
        return

    cursor.execute("SELECT file_id, keywords FROM semantic_metadata WHERE keywords IS NOT NULL AND keywords != ''")

    files_to_migrate = cursor.fetchall()
    if not files_to_migrate:
        log.info("No existing files with semantic metadata to migrate.")
        return

    log.info(f"Found {len(files_to_migrate)} files with semantic metadata to migrate.")

    for file_id, keywords_json in files_to_migrate:
        if not keywords_json:
            continue
        try:
            keywords = json.loads(keywords_json)

            if not isinstance(keywords, list):
                log.warning(f"Keywords for file_id {file_id} is not a list, skipping.")
                continue

            for keyword in keywords:
                if not isinstance(keyword, str):
                    log.warning(f"Non-string keyword '{keyword}' found for file_id {file_id}, skipping.")
                    continue

                keyword = keyword.strip()
                if not keyword:
                    continue

                # Get or create keyword_id
                cursor.execute("INSERT OR IGNORE INTO keywords (keyword) VALUES (?)", (keyword,))
                cursor.execute("SELECT id FROM keywords WHERE keyword = ?", (keyword,))
                keyword_id_result = cursor.fetchone()

                if keyword_id_result:
                    keyword_id = keyword_id_result[0]
                    # Link file to keyword
                    cursor.execute(
                        "INSERT OR IGNORE INTO file_keywords (file_id, keyword_id) VALUES (?, ?)",
                        (file_id, keyword_id),
                    )
                else:
                    log.error(f"Failed to retrieve or create keyword_id for keyword: {keyword}")

        except json.JSONDecodeError as e:
            log.warning(f"Could not parse keywords for file_id {file_id}: {e}")
        except Exception as e:
            log.error(f"An unexpected error occurred during migration for file_id {file_id}: {e}", exc_info=True)

    log.info("Finished migrating keywords.")
