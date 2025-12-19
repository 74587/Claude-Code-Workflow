"""Single-directory index storage with hierarchical linking.

Each directory maintains its own _index.db with:
- Files in the current directory
- Links to subdirectory indexes
- Full-text search via FTS5
- Symbol table for code navigation
"""

from __future__ import annotations

import logging
import re
import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from codexlens.entities import CodeRelationship, SearchResult, Symbol
from codexlens.errors import StorageError


@dataclass
class SubdirLink:
    """Link to a subdirectory's index database."""

    id: int
    name: str
    index_path: Path
    files_count: int
    last_updated: float


@dataclass
class FileEntry:
    """Metadata for an indexed file in current directory."""

    id: int
    name: str
    full_path: Path
    language: str
    mtime: float
    line_count: int


class DirIndexStore:
    """Single-directory index storage with hierarchical subdirectory linking.

    Each directory has an independent _index.db containing:
    - Files table: Files in this directory only
    - Subdirs table: Links to child directory indexes
    - Symbols table: Code symbols from files
    - FTS5 index: Full-text search on file content

    Thread-safe operations with WAL mode enabled.
    """

    # Schema version for migration tracking
    # Increment this when schema changes require migration
    SCHEMA_VERSION = 5

    def __init__(self, db_path: str | Path) -> None:
        """Initialize directory index store.

        Args:
            db_path: Path to _index.db file for this directory
        """
        self.db_path = Path(db_path).resolve()
        self._lock = threading.RLock()
        self._conn: Optional[sqlite3.Connection] = None
        self.logger = logging.getLogger(__name__)

    def initialize(self) -> None:
        """Create database and schema if not exists."""
        with self._lock:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            conn = self._get_connection()

            # Check current schema version
            current_version = self._get_schema_version(conn)

            # Fail gracefully if database is from a newer version
            if current_version > self.SCHEMA_VERSION:
                raise StorageError(
                    f"Database schema version {current_version} is newer than "
                    f"supported version {self.SCHEMA_VERSION}. "
                    f"Please update the application or use a compatible database.",
                    db_path=str(self.db_path),
                    operation="initialize",
                    details={
                        "current_version": current_version,
                        "supported_version": self.SCHEMA_VERSION
                    }
                )

            # Create or migrate schema
            if current_version == 0:
                # New database - create schema directly
                self._create_schema(conn)
                self._create_fts_triggers(conn)
                self._set_schema_version(conn, self.SCHEMA_VERSION)
            elif current_version < self.SCHEMA_VERSION:
                # Existing database - apply migrations
                self._apply_migrations(conn, current_version)
                self._set_schema_version(conn, self.SCHEMA_VERSION)

            conn.commit()

    def _get_schema_version(self, conn: sqlite3.Connection) -> int:
        """Get current schema version from database."""
        try:
            row = conn.execute("PRAGMA user_version").fetchone()
            return row[0] if row else 0
        except Exception:
            return 0

    def _set_schema_version(self, conn: sqlite3.Connection, version: int) -> None:
        """Set schema version in database."""
        conn.execute(f"PRAGMA user_version = {version}")

    def _apply_migrations(self, conn: sqlite3.Connection, from_version: int) -> None:
        """Apply schema migrations from current version to latest.

        Args:
            conn: Database connection
            from_version: Current schema version
        """
        # Migration v0/v1 -> v2: Add 'name' column to files table
        if from_version < 2:
            self._migrate_v2_add_name_column(conn)

        # Migration v2 -> v4: Add dual FTS tables (exact + fuzzy)
        if from_version < 4:
            from codexlens.storage.migrations.migration_004_dual_fts import upgrade
            upgrade(conn)

        # Migration v4 -> v5: Remove unused/redundant fields
        if from_version < 5:
            from codexlens.storage.migrations.migration_005_cleanup_unused_fields import upgrade
            upgrade(conn)

    def close(self) -> None:
        """Close database connection."""
        with self._lock:
            if self._conn is not None:
                try:
                    self._conn.close()
                except Exception:
                    pass
                finally:
                    self._conn = None

    def __enter__(self) -> DirIndexStore:
        """Context manager entry."""
        self.initialize()
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        """Context manager exit."""
        self.close()

    # === File Operations ===

    def add_file(
        self,
        name: str,
        full_path: str | Path,
        content: str,
        language: str,
        symbols: Optional[List[Symbol]] = None,
    ) -> int:
        """Add or update a file in the current directory index.

        Args:
            name: Filename without path
            full_path: Complete source file path
            content: File content for indexing
            language: Programming language identifier
            symbols: List of Symbol objects from the file

        Returns:
            Database file_id

        Raises:
            StorageError: If database operations fail
        """
        with self._lock:
            conn = self._get_connection()
            full_path_str = str(Path(full_path).resolve())
            mtime = Path(full_path_str).stat().st_mtime if Path(full_path_str).exists() else None
            line_count = content.count('\n') + 1

            try:
                conn.execute(
                    """
                    INSERT INTO files(name, full_path, language, content, mtime, line_count)
                    VALUES(?, ?, ?, ?, ?, ?)
                    ON CONFLICT(full_path) DO UPDATE SET
                        name=excluded.name,
                        language=excluded.language,
                        content=excluded.content,
                        mtime=excluded.mtime,
                        line_count=excluded.line_count
                    """,
                    (name, full_path_str, language, content, mtime, line_count),
                )

                row = conn.execute("SELECT id FROM files WHERE full_path=?", (full_path_str,)).fetchone()
                if not row:
                    raise StorageError(f"Failed to retrieve file_id for {full_path_str}")

                file_id = int(row["id"])

                # Replace symbols
                conn.execute("DELETE FROM symbols WHERE file_id=?", (file_id,))
                if symbols:
                    # Insert symbols without token_count and symbol_type
                    symbol_rows = []
                    for s in symbols:
                        symbol_rows.append(
                            (file_id, s.name, s.kind, s.range[0], s.range[1])
                        )

                    conn.executemany(
                        """
                        INSERT INTO symbols(file_id, name, kind, start_line, end_line)
                        VALUES(?, ?, ?, ?, ?)
                        """,
                        symbol_rows,
                    )

                conn.commit()
                return file_id

            except sqlite3.DatabaseError as exc:
                conn.rollback()
                raise StorageError(f"Failed to add file {name}: {exc}") from exc

    def add_relationships(
        self,
        file_path: str | Path,
        relationships: List[CodeRelationship],
    ) -> int:
        """Store code relationships for a file.

        Args:
            file_path: Path to the source file
            relationships: List of CodeRelationship objects to store

        Returns:
            Number of relationships stored

        Raises:
            StorageError: If database operations fail
        """
        if not relationships:
            return 0

        with self._lock:
            conn = self._get_connection()
            file_path_str = str(Path(file_path).resolve())

            try:
                # Get file_id
                row = conn.execute(
                    "SELECT id FROM files WHERE full_path=?", (file_path_str,)
                ).fetchone()
                if not row:
                    return 0

                file_id = int(row["id"])

                # Delete existing relationships for symbols in this file
                conn.execute(
                    """
                    DELETE FROM code_relationships
                    WHERE source_symbol_id IN (
                        SELECT id FROM symbols WHERE file_id=?
                    )
                    """,
                    (file_id,),
                )

                # Insert new relationships
                relationship_rows = []
                skipped_relationships = []
                for rel in relationships:
                    # Extract simple name from fully qualified name (e.g., "MyClass.my_method" -> "my_method")
                    # This handles cases where GraphAnalyzer generates qualified names but symbols table stores simple names
                    source_symbol_simple = rel.source_symbol.split(".")[-1] if "." in rel.source_symbol else rel.source_symbol

                    # Find symbol_id by name and file
                    symbol_row = conn.execute(
                        """
                        SELECT id FROM symbols
                        WHERE file_id=? AND name=? AND start_line<=? AND end_line>=?
                        LIMIT 1
                        """,
                        (file_id, source_symbol_simple, rel.source_line, rel.source_line),
                    ).fetchone()

                    if not symbol_row:
                        # Try matching by simple name only
                        symbol_row = conn.execute(
                            "SELECT id FROM symbols WHERE file_id=? AND name=? LIMIT 1",
                            (file_id, source_symbol_simple),
                        ).fetchone()

                    if symbol_row:
                        relationship_rows.append((
                            int(symbol_row["id"]),
                            rel.target_symbol,
                            rel.relationship_type,
                            rel.source_line,
                            rel.target_file,
                        ))
                    else:
                        # Log warning when symbol lookup fails
                        skipped_relationships.append(rel.source_symbol)

                # Log skipped relationships for debugging
                if skipped_relationships:
                    self.logger.warning(
                        "Failed to find source symbol IDs for %d relationships in %s: %s",
                        len(skipped_relationships),
                        file_path_str,
                        ", ".join(set(skipped_relationships))
                    )

                if relationship_rows:
                    conn.executemany(
                        """
                        INSERT INTO code_relationships(
                            source_symbol_id, target_qualified_name, relationship_type,
                            source_line, target_file
                        )
                        VALUES(?, ?, ?, ?, ?)
                        """,
                        relationship_rows,
                    )

                conn.commit()
                return len(relationship_rows)

            except sqlite3.DatabaseError as exc:
                conn.rollback()
                raise StorageError(f"Failed to add relationships: {exc}") from exc

    def add_files_batch(
        self, files: List[Tuple[str, Path, str, str, Optional[List[Symbol]]]]
    ) -> int:
        """Add multiple files in a single transaction.

        Args:
            files: List of (name, full_path, content, language, symbols) tuples

        Returns:
            Number of files added

        Raises:
            StorageError: If batch operation fails
        """
        with self._lock:
            conn = self._get_connection()
            count = 0

            try:
                conn.execute("BEGIN")

                for name, full_path, content, language, symbols in files:
                    full_path_str = str(Path(full_path).resolve())
                    mtime = Path(full_path_str).stat().st_mtime if Path(full_path_str).exists() else None
                    line_count = content.count('\n') + 1

                    conn.execute(
                        """
                        INSERT INTO files(name, full_path, language, content, mtime, line_count)
                        VALUES(?, ?, ?, ?, ?, ?)
                        ON CONFLICT(full_path) DO UPDATE SET
                            name=excluded.name,
                            language=excluded.language,
                            content=excluded.content,
                            mtime=excluded.mtime,
                            line_count=excluded.line_count
                        """,
                        (name, full_path_str, language, content, mtime, line_count),
                    )

                    row = conn.execute("SELECT id FROM files WHERE full_path=?", (full_path_str,)).fetchone()
                    if not row:
                        raise StorageError(f"Failed to retrieve file_id for {full_path_str}")

                    file_id = int(row["id"])
                    count += 1

                    conn.execute("DELETE FROM symbols WHERE file_id=?", (file_id,))
                    if symbols:
                        # Insert symbols
                        symbol_rows = []
                        for s in symbols:
                            symbol_rows.append(
                                (file_id, s.name, s.kind, s.range[0], s.range[1])
                            )

                        conn.executemany(
                            """
                            INSERT INTO symbols(file_id, name, kind, start_line, end_line)
                            VALUES(?, ?, ?, ?, ?)
                            """,
                            symbol_rows,
                        )

                conn.commit()
                return count

            except sqlite3.DatabaseError as exc:
                conn.rollback()
                raise StorageError(f"Batch insert failed: {exc}") from exc

    def remove_file(self, full_path: str | Path) -> bool:
        """Remove a file from the index.

        Args:
            full_path: Complete source file path

        Returns:
            True if file was removed, False if not found
        """
        with self._lock:
            conn = self._get_connection()
            full_path_str = str(Path(full_path).resolve())

            row = conn.execute("SELECT id FROM files WHERE full_path=?", (full_path_str,)).fetchone()
            if not row:
                return False

            file_id = int(row["id"])
            conn.execute("DELETE FROM files WHERE id=?", (file_id,))
            conn.commit()
            return True

    def get_file(self, full_path: str | Path) -> Optional[FileEntry]:
        """Get file metadata.

        Args:
            full_path: Complete source file path

        Returns:
            FileEntry if found, None otherwise
        """
        with self._lock:
            conn = self._get_connection()
            full_path_str = str(Path(full_path).resolve())

            row = conn.execute(
                """
                SELECT id, name, full_path, language, mtime, line_count
                FROM files WHERE full_path=?
                """,
                (full_path_str,),
            ).fetchone()

            if not row:
                return None

            return FileEntry(
                id=int(row["id"]),
                name=row["name"],
                full_path=Path(row["full_path"]),
                language=row["language"],
                mtime=float(row["mtime"]) if row["mtime"] else 0.0,
                line_count=int(row["line_count"]) if row["line_count"] else 0,
            )

    def get_file_mtime(self, full_path: str | Path) -> Optional[float]:
        """Get stored modification time for a file.

        Args:
            full_path: Complete source file path

        Returns:
            Modification time as float, or None if not found
        """
        with self._lock:
            conn = self._get_connection()
            full_path_str = str(Path(full_path).resolve())

            row = conn.execute(
                "SELECT mtime FROM files WHERE full_path=?", (full_path_str,)
            ).fetchone()

            return float(row["mtime"]) if row and row["mtime"] else None

    def needs_reindex(self, full_path: str | Path) -> bool:
        """Check if a file needs reindexing based on mtime comparison.

        Uses 1ms tolerance to handle filesystem timestamp precision variations.

        Args:
            full_path: Complete source file path

        Returns:
            True if file should be reindexed (new, modified, or missing from index)
        """
        full_path_obj = Path(full_path).resolve()
        if not full_path_obj.exists():
            return False  # File doesn't exist, skip indexing

        # Get current filesystem mtime
        try:
            current_mtime = full_path_obj.stat().st_mtime
        except OSError:
            return False  # Can't read file stats, skip

        # Get stored mtime from database
        stored_mtime = self.get_file_mtime(full_path_obj)

        # File not in index, needs indexing
        if stored_mtime is None:
            return True

        # Compare with 1ms tolerance for floating point precision
        MTIME_TOLERANCE = 0.001
        return abs(current_mtime - stored_mtime) > MTIME_TOLERANCE

    def add_file_incremental(
        self,
        name: str,
        full_path: str | Path,
        content: str,
        language: str,
        symbols: Optional[List[Symbol]] = None,
    ) -> Optional[int]:
        """Add or update a file only if it has changed (incremental indexing).

        Checks mtime before indexing to skip unchanged files.

        Args:
            name: Filename without path
            full_path: Complete source file path
            content: File content for indexing
            language: Programming language identifier
            symbols: List of Symbol objects from the file

        Returns:
            Database file_id if indexed, None if skipped (unchanged)

        Raises:
            StorageError: If database operations fail
        """
        # Check if reindexing is needed
        if not self.needs_reindex(full_path):
            return None  # Skip unchanged file

        # File changed or new, perform full indexing
        return self.add_file(name, full_path, content, language, symbols)

    def cleanup_deleted_files(self, source_dir: Path) -> int:
        """Remove indexed files that no longer exist in the source directory.

        Scans the source directory and removes database entries for deleted files.

        Args:
            source_dir: Source directory to scan

        Returns:
            Number of deleted file entries removed

        Raises:
            StorageError: If cleanup operations fail
        """
        with self._lock:
            conn = self._get_connection()
            source_dir = source_dir.resolve()

            try:
                # Get all indexed file paths
                rows = conn.execute("SELECT full_path FROM files").fetchall()
                indexed_paths = {row["full_path"] for row in rows}

                # Build set of existing files in source directory
                existing_paths = set()
                for file_path in source_dir.rglob("*"):
                    if file_path.is_file():
                        existing_paths.add(str(file_path.resolve()))

                # Find orphaned entries (indexed but no longer exist)
                deleted_paths = indexed_paths - existing_paths

                # Remove orphaned entries
                deleted_count = 0
                for deleted_path in deleted_paths:
                    conn.execute("DELETE FROM files WHERE full_path=?", (deleted_path,))
                    deleted_count += 1

                if deleted_count > 0:
                    conn.commit()

                return deleted_count

            except Exception as exc:
                conn.rollback()
                raise StorageError(f"Failed to cleanup deleted files: {exc}") from exc

    def list_files(self) -> List[FileEntry]:
        """List all files in current directory.

        Returns:
            List of FileEntry objects
        """
        with self._lock:
            conn = self._get_connection()
            rows = conn.execute(
                """
                SELECT id, name, full_path, language, mtime, line_count
                FROM files
                ORDER BY name
                """
            ).fetchall()

            return [
                FileEntry(
                    id=int(row["id"]),
                    name=row["name"],
                    full_path=Path(row["full_path"]),
                    language=row["language"],
                    mtime=float(row["mtime"]) if row["mtime"] else 0.0,
                    line_count=int(row["line_count"]) if row["line_count"] else 0,
                )
                for row in rows
            ]

    def file_count(self) -> int:
        """Get number of files in current directory.

        Returns:
            File count
        """
        with self._lock:
            conn = self._get_connection()
            row = conn.execute("SELECT COUNT(*) AS c FROM files").fetchone()
            return int(row["c"]) if row else 0

    # === Semantic Metadata ===

    def add_semantic_metadata(
        self,
        file_id: int,
        summary: str,
        keywords: List[str],
        purpose: str,
        llm_tool: str
    ) -> None:
        """Add or update semantic metadata for a file.

        Args:
            file_id: File ID from files table
            summary: LLM-generated summary
            keywords: List of keywords
            purpose: Purpose/role of the file
            llm_tool: Tool used to generate metadata (gemini/qwen)
        """
        with self._lock:
            conn = self._get_connection()

            import time

            generated_at = time.time()

            # Write to semantic_metadata table (without keywords column)
            conn.execute(
                """
                INSERT INTO semantic_metadata(file_id, summary, purpose, llm_tool, generated_at)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(file_id) DO UPDATE SET
                    summary=excluded.summary,
                    purpose=excluded.purpose,
                    llm_tool=excluded.llm_tool,
                    generated_at=excluded.generated_at
                """,
                (file_id, summary, purpose, llm_tool, generated_at),
            )

            # Write to normalized keywords tables for optimized search
            # First, remove existing keyword associations
            conn.execute("DELETE FROM file_keywords WHERE file_id = ?", (file_id,))

            # Then add new keywords
            for keyword in keywords:
                keyword = keyword.strip()
                if not keyword:
                    continue

                # Insert keyword if it doesn't exist
                conn.execute(
                    "INSERT OR IGNORE INTO keywords(keyword) VALUES(?)",
                    (keyword,)
                )

                # Get keyword_id
                row = conn.execute(
                    "SELECT id FROM keywords WHERE keyword = ?",
                    (keyword,)
                ).fetchone()

                if row:
                    keyword_id = row["id"]
                    # Link file to keyword
                    conn.execute(
                        "INSERT OR IGNORE INTO file_keywords(file_id, keyword_id) VALUES(?, ?)",
                        (file_id, keyword_id)
                    )

            conn.commit()

    def get_semantic_metadata(self, file_id: int) -> Optional[Dict[str, Any]]:
        """Get semantic metadata for a file.

        Args:
            file_id: File ID from files table

        Returns:
            Dict with summary, keywords, purpose, llm_tool, generated_at, or None if not found
        """
        with self._lock:
            conn = self._get_connection()

            # Get semantic metadata (without keywords column)
            row = conn.execute(
                """
                SELECT summary, purpose, llm_tool, generated_at
                FROM semantic_metadata WHERE file_id=?
                """,
                (file_id,),
            ).fetchone()

            if not row:
                return None

            # Get keywords from normalized file_keywords table
            keyword_rows = conn.execute(
                """
                SELECT k.keyword
                FROM file_keywords fk
                JOIN keywords k ON fk.keyword_id = k.id
                WHERE fk.file_id = ?
                ORDER BY k.keyword
                """,
                (file_id,),
            ).fetchall()

            keywords = [kw["keyword"] for kw in keyword_rows]

            return {
                "summary": row["summary"],
                "keywords": keywords,
                "purpose": row["purpose"],
                "llm_tool": row["llm_tool"],
                "generated_at": float(row["generated_at"]) if row["generated_at"] else 0.0,
            }

    def get_files_without_semantic(self) -> List[FileEntry]:
        """Get all files that don't have semantic metadata.

        Returns:
            List of FileEntry objects without semantic metadata
        """
        with self._lock:
            conn = self._get_connection()

            rows = conn.execute(
                """
                SELECT f.id, f.name, f.full_path, f.language, f.mtime, f.line_count
                FROM files f
                LEFT JOIN semantic_metadata sm ON f.id = sm.file_id
                WHERE sm.id IS NULL
                ORDER BY f.name
                """
            ).fetchall()

            return [
                FileEntry(
                    id=int(row["id"]),
                    name=row["name"],
                    full_path=Path(row["full_path"]),
                    language=row["language"],
                    mtime=float(row["mtime"]) if row["mtime"] else 0.0,
                    line_count=int(row["line_count"]) if row["line_count"] else 0,
                )
                for row in rows
            ]

    def search_semantic_keywords(self, keyword: str, use_normalized: bool = True) -> List[Tuple[FileEntry, List[str]]]:
        """Search files by semantic keywords.

        Args:
            keyword: Keyword to search for (case-insensitive)
            use_normalized: Use optimized normalized tables (default: True)

        Returns:
            List of (FileEntry, keywords) tuples where keyword matches
        """
        with self._lock:
            conn = self._get_connection()

            if use_normalized:
                # Optimized query using normalized tables with indexed lookup
                # Use prefix search (keyword%) for better index utilization
                keyword_pattern = f"{keyword}%"

                rows = conn.execute(
                    """
                    SELECT f.id, f.name, f.full_path, f.language, f.mtime, f.line_count,
                           GROUP_CONCAT(k.keyword, ',') as keywords
                    FROM files f
                    JOIN file_keywords fk ON f.id = fk.file_id
                    JOIN keywords k ON fk.keyword_id = k.id
                    WHERE k.keyword LIKE ? COLLATE NOCASE
                    GROUP BY f.id, f.name, f.full_path, f.language, f.mtime, f.line_count
                    ORDER BY f.name
                    """,
                    (keyword_pattern,),
                ).fetchall()

                results = []
                for row in rows:
                    file_entry = FileEntry(
                        id=int(row["id"]),
                        name=row["name"],
                        full_path=Path(row["full_path"]),
                        language=row["language"],
                        mtime=float(row["mtime"]) if row["mtime"] else 0.0,
                        line_count=int(row["line_count"]) if row["line_count"] else 0,
                    )
                    keywords = row["keywords"].split(',') if row["keywords"] else []
                    results.append((file_entry, keywords))

                return results

            else:
                # Fallback using normalized tables with contains matching (slower but more flexible)
                keyword_pattern = f"%{keyword}%"

                rows = conn.execute(
                    """
                    SELECT f.id, f.name, f.full_path, f.language, f.mtime, f.line_count,
                           GROUP_CONCAT(k.keyword, ',') as keywords
                    FROM files f
                    JOIN file_keywords fk ON f.id = fk.file_id
                    JOIN keywords k ON fk.keyword_id = k.id
                    WHERE k.keyword LIKE ? COLLATE NOCASE
                    GROUP BY f.id, f.name, f.full_path, f.language, f.mtime, f.line_count
                    ORDER BY f.name
                    """,
                    (keyword_pattern,),
                ).fetchall()

                results = []
                for row in rows:
                    file_entry = FileEntry(
                        id=int(row["id"]),
                        name=row["name"],
                        full_path=Path(row["full_path"]),
                        language=row["language"],
                        mtime=float(row["mtime"]) if row["mtime"] else 0.0,
                        line_count=int(row["line_count"]) if row["line_count"] else 0,
                    )
                    keywords = row["keywords"].split(',') if row["keywords"] else []
                    results.append((file_entry, keywords))

                return results

    def list_semantic_metadata(
        self,
        offset: int = 0,
        limit: int = 50,
        llm_tool: Optional[str] = None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """List all semantic metadata with file information.

        Args:
            offset: Number of records to skip (for pagination)
            limit: Maximum records to return (max 100)
            llm_tool: Optional filter by LLM tool used

        Returns:
            Tuple of (list of metadata dicts, total count)
        """
        with self._lock:
            conn = self._get_connection()

            # Query semantic metadata without keywords column
            base_query = """
                SELECT f.id as file_id, f.name as file_name, f.full_path,
                       f.language, f.line_count,
                       sm.summary, sm.purpose,
                       sm.llm_tool, sm.generated_at
                FROM files f
                JOIN semantic_metadata sm ON f.id = sm.file_id
            """
            count_query = """
                SELECT COUNT(*) as total
                FROM files f
                JOIN semantic_metadata sm ON f.id = sm.file_id
            """

            params: List[Any] = []
            if llm_tool:
                base_query += " WHERE sm.llm_tool = ?"
                count_query += " WHERE sm.llm_tool = ?"
                params.append(llm_tool)

            base_query += " ORDER BY sm.generated_at DESC LIMIT ? OFFSET ?"
            params.extend([min(limit, 100), offset])

            count_params = [llm_tool] if llm_tool else []
            total_row = conn.execute(count_query, count_params).fetchone()
            total = int(total_row["total"]) if total_row else 0

            rows = conn.execute(base_query, params).fetchall()

            results = []
            for row in rows:
                file_id = int(row["file_id"])

                # Get keywords from normalized file_keywords table
                keyword_rows = conn.execute(
                    """
                    SELECT k.keyword
                    FROM file_keywords fk
                    JOIN keywords k ON fk.keyword_id = k.id
                    WHERE fk.file_id = ?
                    ORDER BY k.keyword
                    """,
                    (file_id,),
                ).fetchall()

                keywords = [kw["keyword"] for kw in keyword_rows]

                results.append({
                    "file_id": file_id,
                    "file_name": row["file_name"],
                    "full_path": row["full_path"],
                    "language": row["language"],
                    "line_count": int(row["line_count"]) if row["line_count"] else 0,
                    "summary": row["summary"],
                    "keywords": keywords,
                    "purpose": row["purpose"],
                    "llm_tool": row["llm_tool"],
                    "generated_at": float(row["generated_at"]) if row["generated_at"] else 0.0,
                })

            return results, total

    # === Subdirectory Links ===

    def register_subdir(
        self,
        name: str,
        index_path: str | Path,
        files_count: int = 0,
        direct_files: int = 0,
    ) -> None:
        """Register or update a subdirectory link.

        Args:
            name: Subdirectory name
            index_path: Path to subdirectory's _index.db
            files_count: Total files recursively
            direct_files: Deprecated parameter (no longer used)
        """
        with self._lock:
            conn = self._get_connection()
            index_path_str = str(Path(index_path).resolve())

            import time
            last_updated = time.time()

            # Note: direct_files parameter is deprecated but kept for backward compatibility
            conn.execute(
                """
                INSERT INTO subdirs(name, index_path, files_count, last_updated)
                VALUES(?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    index_path=excluded.index_path,
                    files_count=excluded.files_count,
                    last_updated=excluded.last_updated
                """,
                (name, index_path_str, files_count, last_updated),
            )
            conn.commit()

    def unregister_subdir(self, name: str) -> bool:
        """Remove a subdirectory link.

        Args:
            name: Subdirectory name

        Returns:
            True if removed, False if not found
        """
        with self._lock:
            conn = self._get_connection()
            row = conn.execute("SELECT id FROM subdirs WHERE name=?", (name,)).fetchone()
            if not row:
                return False

            conn.execute("DELETE FROM subdirs WHERE name=?", (name,))
            conn.commit()
            return True

    def get_subdirs(self) -> List[SubdirLink]:
        """Get all subdirectory links.

        Returns:
            List of SubdirLink objects
        """
        with self._lock:
            conn = self._get_connection()
            rows = conn.execute(
                """
                SELECT id, name, index_path, files_count, last_updated
                FROM subdirs
                ORDER BY name
                """
            ).fetchall()

            return [
                SubdirLink(
                    id=int(row["id"]),
                    name=row["name"],
                    index_path=Path(row["index_path"]),
                    files_count=int(row["files_count"]) if row["files_count"] else 0,
                    last_updated=float(row["last_updated"]) if row["last_updated"] else 0.0,
                )
                for row in rows
            ]

    def get_subdir(self, name: str) -> Optional[SubdirLink]:
        """Get a specific subdirectory link.

        Args:
            name: Subdirectory name

        Returns:
            SubdirLink if found, None otherwise
        """
        with self._lock:
            conn = self._get_connection()
            row = conn.execute(
                """
                SELECT id, name, index_path, files_count, last_updated
                FROM subdirs WHERE name=?
                """,
                (name,),
            ).fetchone()

            if not row:
                return None

            return SubdirLink(
                id=int(row["id"]),
                name=row["name"],
                index_path=Path(row["index_path"]),
                files_count=int(row["files_count"]) if row["files_count"] else 0,
                last_updated=float(row["last_updated"]) if row["last_updated"] else 0.0,
            )

    def update_subdir_stats(
        self, name: str, files_count: int, direct_files: Optional[int] = None
    ) -> None:
        """Update subdirectory statistics.

        Args:
            name: Subdirectory name
            files_count: Total files recursively
            direct_files: Deprecated parameter (no longer used)
        """
        with self._lock:
            conn = self._get_connection()
            import time
            last_updated = time.time()

            # Note: direct_files parameter is deprecated but kept for backward compatibility
            conn.execute(
                """
                UPDATE subdirs
                SET files_count=?, last_updated=?
                WHERE name=?
                """,
                (files_count, last_updated, name),
            )
            conn.commit()

    # === Search ===

    @staticmethod
    def _enhance_fts_query(query: str) -> str:
        """Enhance FTS5 query to support prefix matching for simple queries.

        For simple single-word or multi-word queries without FTS5 operators,
        automatically adds prefix wildcard (*) to enable partial matching.

        Examples:
            "loadPack" -> "loadPack*"
            "load package" -> "load* package*"
            "load*" -> "load*" (already has wildcard, unchanged)
            "NOT test" -> "NOT test" (has FTS operator, unchanged)

        Args:
            query: Original FTS5 query string

        Returns:
            Enhanced query string with prefix wildcards for simple queries
        """
        # Don't modify if query already contains FTS5 operators or wildcards
        if any(op in query.upper() for op in [' AND ', ' OR ', ' NOT ', ' NEAR ', '*', '"']):
            return query

        # For simple queries, add prefix wildcard to each word
        words = query.split()
        enhanced_words = [f"{word}*" if not word.endswith('*') else word for word in words]
        return ' '.join(enhanced_words)

    def _find_match_lines(self, content: str, query: str) -> List[int]:
        """Find line numbers where query terms match.

        Args:
            content: File content
            query: Search query (FTS5 format)

        Returns:
            List of 1-based line numbers containing matches
        """
        # Extract search terms from FTS query (remove operators)
        terms = re.findall(r'["\']([^"\']+)["\']|(\w+)', query)
        search_terms = [t[0] or t[1] for t in terms if t[0] or t[1]]
        # Filter out FTS operators
        fts_operators = {'AND', 'OR', 'NOT', 'NEAR'}
        search_terms = [t for t in search_terms if t.upper() not in fts_operators]

        if not search_terms:
            return [1]  # Default to first line

        lines = content.split('\n')
        match_lines = []

        for i, line in enumerate(lines, 1):
            line_lower = line.lower()
            for term in search_terms:
                # Handle wildcard suffix
                term_clean = term.rstrip('*').lower()
                if term_clean and term_clean in line_lower:
                    match_lines.append(i)
                    break

        return match_lines if match_lines else [1]

    def _find_containing_symbol(
        self, conn: sqlite3.Connection, file_id: int, line_num: int
    ) -> Optional[Tuple[int, int, str, str]]:
        """Find the symbol that contains the given line number.

        Args:
            conn: Database connection
            file_id: File ID in database
            line_num: 1-based line number

        Returns:
            Tuple of (start_line, end_line, symbol_name, symbol_kind) or None
        """
        row = conn.execute(
            """
            SELECT start_line, end_line, name, kind
            FROM symbols
            WHERE file_id = ? AND start_line <= ? AND end_line >= ?
            ORDER BY (end_line - start_line) ASC
            LIMIT 1
            """,
            (file_id, line_num, line_num),
        ).fetchone()

        if row:
            return (row["start_line"], row["end_line"], row["name"], row["kind"])
        return None

    def _extract_code_block(
        self,
        content: str,
        start_line: int,
        end_line: int,
        match_line: Optional[int] = None,
        context_lines: int = 5,
    ) -> Tuple[str, int, int]:
        """Extract code block from content.

        If start_line/end_line are provided (from symbol), use them.
        Otherwise, extract context around match_line.

        Args:
            content: Full file content
            start_line: 1-based start line (from symbol or calculated)
            end_line: 1-based end line (from symbol or calculated)
            match_line: 1-based line where match occurred (for context extraction)
            context_lines: Number of lines before/after match when no symbol

        Returns:
            Tuple of (code_block, actual_start_line, actual_end_line)
        """
        lines = content.split('\n')
        total_lines = len(lines)

        # Clamp to valid range
        start_line = max(1, start_line)
        end_line = min(total_lines, end_line)

        # Extract block (convert to 0-based index)
        block_lines = lines[start_line - 1:end_line]
        block_content = '\n'.join(block_lines)

        return block_content, start_line, end_line

    def search_fts(
        self,
        query: str,
        limit: int = 20,
        enhance_query: bool = False,
        return_full_content: bool = True,
        context_lines: int = 10,
    ) -> List[SearchResult]:
        """Full-text search in current directory files with complete method blocks.

        Uses files_fts_exact (unicode61 tokenizer) for exact token matching.
        For fuzzy/substring search, use search_fts_fuzzy() instead.

        Returns complete code blocks (functions/methods/classes) containing the match,
        rather than just a short snippet.

        Best Practice (from industry analysis of Codanna/Code-Index-MCP):
        - Default: Respects exact user input without modification
        - Users can manually add wildcards (e.g., "loadPack*") for prefix matching
        - Automatic enhancement (enhance_query=True) is NOT recommended as it can
          violate user intent and bring unwanted noise in results

        Args:
            query: FTS5 query string
            limit: Maximum results to return
            enhance_query: If True, automatically add prefix wildcards for simple queries.
                          Default False to respect exact user input.
            return_full_content: If True, include full code block in content field
            context_lines: Lines of context when no symbol contains the match

        Returns:
            List of SearchResult objects with complete code blocks

        Raises:
            StorageError: If FTS search fails
        """
        # Only enhance query if explicitly requested (not default behavior)
        # Best practice: Let users control wildcards manually
        final_query = self._enhance_fts_query(query) if enhance_query else query

        with self._lock:
            conn = self._get_connection()
            try:
                # Join with files table to get content and file_id
                rows = conn.execute(
                    """
                    SELECT f.id AS file_id, f.full_path, f.content,
                           bm25(files_fts_exact) AS rank
                    FROM files_fts_exact
                    JOIN files f ON files_fts_exact.rowid = f.id
                    WHERE files_fts_exact MATCH ?
                    ORDER BY rank
                    LIMIT ?
                    """,
                    (final_query, limit),
                ).fetchall()
            except sqlite3.DatabaseError as exc:
                raise StorageError(f"FTS search failed: {exc}") from exc

            results: List[SearchResult] = []
            for row in rows:
                file_id = row["file_id"]
                file_path = row["full_path"]
                content = row["content"] or ""
                rank = float(row["rank"]) if row["rank"] is not None else 0.0
                score = abs(rank) if rank < 0 else 0.0

                # Find matching lines
                match_lines = self._find_match_lines(content, final_query)
                first_match_line = match_lines[0] if match_lines else 1

                # Find symbol containing the first match
                symbol_info = self._find_containing_symbol(conn, file_id, first_match_line)

                if symbol_info:
                    start_line, end_line, symbol_name, symbol_kind = symbol_info
                else:
                    # No symbol found, use context around match
                    lines = content.split('\n')
                    total_lines = len(lines)
                    start_line = max(1, first_match_line - context_lines)
                    end_line = min(total_lines, first_match_line + context_lines)
                    symbol_name = None
                    symbol_kind = None

                # Extract code block
                block_content, start_line, end_line = self._extract_code_block(
                    content, start_line, end_line
                )

                # Generate excerpt (first 200 chars)
                excerpt = block_content[:200] + "..." if len(block_content) > 200 else block_content

                results.append(
                    SearchResult(
                        path=file_path,
                        score=score,
                        excerpt=excerpt,
                        content=block_content if return_full_content else None,
                        start_line=start_line,
                        end_line=end_line,
                        symbol_name=symbol_name,
                        symbol_kind=symbol_kind,
                    )
                )
            return results

    def search_fts_exact(
        self,
        query: str,
        limit: int = 20,
        return_full_content: bool = True,
        context_lines: int = 10,
    ) -> List[SearchResult]:
        """Full-text search using exact token matching with complete method blocks.

        Returns complete code blocks (functions/methods/classes) containing the match,
        rather than just a short snippet. If no symbol contains the match, returns
        context lines around the match.

        Args:
            query: FTS5 query string
            limit: Maximum results to return
            return_full_content: If True, include full code block in content field
            context_lines: Lines of context when no symbol contains the match

        Returns:
            List of SearchResult objects with complete code blocks

        Raises:
            StorageError: If FTS search fails
        """
        with self._lock:
            conn = self._get_connection()
            try:
                # Join with files table to get content and file_id
                rows = conn.execute(
                    """
                    SELECT f.id AS file_id, f.full_path, f.content,
                           bm25(files_fts_exact) AS rank
                    FROM files_fts_exact
                    JOIN files f ON files_fts_exact.rowid = f.id
                    WHERE files_fts_exact MATCH ?
                    ORDER BY rank
                    LIMIT ?
                    """,
                    (query, limit),
                ).fetchall()
            except sqlite3.DatabaseError as exc:
                raise StorageError(f"FTS exact search failed: {exc}") from exc

            results: List[SearchResult] = []
            for row in rows:
                file_id = row["file_id"]
                file_path = row["full_path"]
                content = row["content"] or ""
                rank = float(row["rank"]) if row["rank"] is not None else 0.0
                score = abs(rank) if rank < 0 else 0.0

                # Find matching lines
                match_lines = self._find_match_lines(content, query)
                first_match_line = match_lines[0] if match_lines else 1

                # Find symbol containing the first match
                symbol_info = self._find_containing_symbol(conn, file_id, first_match_line)

                if symbol_info:
                    start_line, end_line, symbol_name, symbol_kind = symbol_info
                else:
                    # No symbol found, use context around match
                    lines = content.split('\n')
                    total_lines = len(lines)
                    start_line = max(1, first_match_line - context_lines)
                    end_line = min(total_lines, first_match_line + context_lines)
                    symbol_name = None
                    symbol_kind = None

                # Extract code block
                block_content, start_line, end_line = self._extract_code_block(
                    content, start_line, end_line
                )

                # Generate excerpt (first 200 chars)
                excerpt = block_content[:200] + "..." if len(block_content) > 200 else block_content

                results.append(
                    SearchResult(
                        path=file_path,
                        score=score,
                        excerpt=excerpt,
                        content=block_content if return_full_content else None,
                        start_line=start_line,
                        end_line=end_line,
                        symbol_name=symbol_name,
                        symbol_kind=symbol_kind,
                    )
                )
            return results

    def search_fts_fuzzy(
        self,
        query: str,
        limit: int = 20,
        return_full_content: bool = True,
        context_lines: int = 10,
    ) -> List[SearchResult]:
        """Full-text search using fuzzy/substring matching with complete method blocks.

        Returns complete code blocks (functions/methods/classes) containing the match,
        rather than just a short snippet. If no symbol contains the match, returns
        context lines around the match.

        Args:
            query: FTS5 query string
            limit: Maximum results to return
            return_full_content: If True, include full code block in content field
            context_lines: Lines of context when no symbol contains the match

        Returns:
            List of SearchResult objects with complete code blocks

        Raises:
            StorageError: If FTS search fails
        """
        with self._lock:
            conn = self._get_connection()
            try:
                # Join with files table to get content and file_id
                rows = conn.execute(
                    """
                    SELECT f.id AS file_id, f.full_path, f.content,
                           bm25(files_fts_fuzzy) AS rank
                    FROM files_fts_fuzzy
                    JOIN files f ON files_fts_fuzzy.rowid = f.id
                    WHERE files_fts_fuzzy MATCH ?
                    ORDER BY rank
                    LIMIT ?
                    """,
                    (query, limit),
                ).fetchall()
            except sqlite3.DatabaseError as exc:
                raise StorageError(f"FTS fuzzy search failed: {exc}") from exc

            results: List[SearchResult] = []
            for row in rows:
                file_id = row["file_id"]
                file_path = row["full_path"]
                content = row["content"] or ""
                rank = float(row["rank"]) if row["rank"] is not None else 0.0
                score = abs(rank) if rank < 0 else 0.0

                # Find matching lines
                match_lines = self._find_match_lines(content, query)
                first_match_line = match_lines[0] if match_lines else 1

                # Find symbol containing the first match
                symbol_info = self._find_containing_symbol(conn, file_id, first_match_line)

                if symbol_info:
                    start_line, end_line, symbol_name, symbol_kind = symbol_info
                else:
                    # No symbol found, use context around match
                    lines = content.split('\n')
                    total_lines = len(lines)
                    start_line = max(1, first_match_line - context_lines)
                    end_line = min(total_lines, first_match_line + context_lines)
                    symbol_name = None
                    symbol_kind = None

                # Extract code block
                block_content, start_line, end_line = self._extract_code_block(
                    content, start_line, end_line
                )

                # Generate excerpt (first 200 chars)
                excerpt = block_content[:200] + "..." if len(block_content) > 200 else block_content

                results.append(
                    SearchResult(
                        path=file_path,
                        score=score,
                        excerpt=excerpt,
                        content=block_content if return_full_content else None,
                        start_line=start_line,
                        end_line=end_line,
                        symbol_name=symbol_name,
                        symbol_kind=symbol_kind,
                    )
                )
            return results

    def search_files_only(self, query: str, limit: int = 20) -> List[str]:
        """Fast FTS search returning only file paths (no snippet generation).

        Optimized for when only file paths are needed, skipping expensive
        snippet() function call.

        Args:
            query: FTS5 query string
            limit: Maximum results to return

        Returns:
            List of file paths as strings

        Raises:
            StorageError: If FTS search fails
        """
        with self._lock:
            conn = self._get_connection()
            try:
                rows = conn.execute(
                    """
                    SELECT full_path
                    FROM files_fts
                    WHERE files_fts MATCH ?
                    ORDER BY bm25(files_fts)
                    LIMIT ?
                    """,
                    (query, limit),
                ).fetchall()
            except sqlite3.DatabaseError as exc:
                raise StorageError(f"FTS search failed: {exc}") from exc

            return [row["full_path"] for row in rows]

    def search_symbols(
        self, name: str, kind: Optional[str] = None, limit: int = 50, prefix_mode: bool = True
    ) -> List[Symbol]:
        """Search symbols by name pattern.

        Args:
            name: Symbol name pattern
            kind: Optional symbol kind filter
            limit: Maximum results to return
            prefix_mode: If True, use prefix search (faster with index);
                        If False, use substring search (slower)

        Returns:
            List of Symbol objects
        """
        # Prefix search is much faster as it can use index
        if prefix_mode:
            pattern = f"{name}%"
        else:
            pattern = f"%{name}%"

        with self._lock:
            conn = self._get_connection()
            if kind:
                rows = conn.execute(
                    """
                    SELECT s.name, s.kind, s.start_line, s.end_line, f.full_path
                    FROM symbols s
                    JOIN files f ON s.file_id = f.id
                    WHERE s.name LIKE ? AND s.kind=?
                    ORDER BY s.name
                    LIMIT ?
                    """,
                    (pattern, kind, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT s.name, s.kind, s.start_line, s.end_line, f.full_path
                    FROM symbols s
                    JOIN files f ON s.file_id = f.id
                    WHERE s.name LIKE ?
                    ORDER BY s.name
                    LIMIT ?
                    """,
                    (pattern, limit),
                ).fetchall()

            return [
                Symbol(
                    name=row["name"],
                    kind=row["kind"],
                    range=(row["start_line"], row["end_line"]),
                    file=row["full_path"],
                )
                for row in rows
            ]

    # === Statistics ===

    def stats(self) -> Dict[str, Any]:
        """Get current directory statistics.

        Returns:
            Dictionary containing:
            - files: Number of files in this directory
            - symbols: Number of symbols
            - subdirs: Number of subdirectories
            - total_files: Total files including subdirectories
            - languages: Dictionary of language counts
        """
        with self._lock:
            conn = self._get_connection()

            file_count = conn.execute("SELECT COUNT(*) AS c FROM files").fetchone()["c"]
            symbol_count = conn.execute("SELECT COUNT(*) AS c FROM symbols").fetchone()["c"]
            subdir_count = conn.execute("SELECT COUNT(*) AS c FROM subdirs").fetchone()["c"]

            total_files_row = conn.execute(
                "SELECT COALESCE(SUM(files_count), 0) AS total FROM subdirs"
            ).fetchone()
            total_files = int(file_count) + int(total_files_row["total"] if total_files_row else 0)

            lang_rows = conn.execute(
                "SELECT language, COUNT(*) AS c FROM files GROUP BY language ORDER BY c DESC"
            ).fetchall()
            languages = {row["language"]: int(row["c"]) for row in lang_rows}

            return {
                "files": int(file_count),
                "symbols": int(symbol_count),
                "subdirs": int(subdir_count),
                "total_files": total_files,
                "languages": languages,
            }

    # === Internal Methods ===

    def _get_connection(self) -> sqlite3.Connection:
        """Get or create database connection with proper configuration.

        Returns:
            sqlite3.Connection with WAL mode and foreign keys enabled
        """
        if self._conn is None:
            self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
            self._conn.row_factory = sqlite3.Row
            self._conn.execute("PRAGMA journal_mode=WAL")
            self._conn.execute("PRAGMA synchronous=NORMAL")
            self._conn.execute("PRAGMA foreign_keys=ON")
            # Memory-mapped I/O for faster reads (30GB limit)
            self._conn.execute("PRAGMA mmap_size=30000000000")
        return self._conn

    def _create_schema(self, conn: sqlite3.Connection) -> None:
        """Create database schema.

        Args:
            conn: Database connection

        Raises:
            StorageError: If schema creation fails
        """
        try:
            # Files table
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL,
                    full_path TEXT UNIQUE NOT NULL,
                    language TEXT,
                    content TEXT,
                    mtime REAL,
                    line_count INTEGER
                )
                """
            )

            # Subdirectories table (v5: removed direct_files)
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS subdirs (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    index_path TEXT NOT NULL,
                    files_count INTEGER DEFAULT 0,
                    last_updated REAL
                )
                """
            )

            # Symbols table with token metadata
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS symbols (
                    id INTEGER PRIMARY KEY,
                    file_id INTEGER REFERENCES files(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    start_line INTEGER,
                    end_line INTEGER
                )
                """
            )

            # Dual FTS5 external content tables for exact and fuzzy matching
            # files_fts_exact: unicode61 tokenizer for exact token matching
            # files_fts_fuzzy: trigram tokenizer (or extended unicode61) for substring/fuzzy matching
            from codexlens.storage.sqlite_utils import check_trigram_support

            has_trigram = check_trigram_support(conn)
            fuzzy_tokenizer = "trigram" if has_trigram else "unicode61 tokenchars '_-'"

            # Exact FTS table with unicode61 tokenizer
            conn.execute(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS files_fts_exact USING fts5(
                    name, full_path UNINDEXED, content,
                    content='files',
                    content_rowid='id',
                    tokenize="unicode61 tokenchars '_-'"
                )
                """
            )

            # Fuzzy FTS table with trigram or extended unicode61 tokenizer
            conn.execute(
                f"""
                CREATE VIRTUAL TABLE IF NOT EXISTS files_fts_fuzzy USING fts5(
                    name, full_path UNINDEXED, content,
                    content='files',
                    content_rowid='id',
                    tokenize="{fuzzy_tokenizer}"
                )
                """
            )

            # Semantic metadata table (v5: removed keywords column)
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS semantic_metadata (
                    id INTEGER PRIMARY KEY,
                    file_id INTEGER UNIQUE REFERENCES files(id) ON DELETE CASCADE,
                    summary TEXT,
                    purpose TEXT,
                    llm_tool TEXT,
                    generated_at REAL
                )
                """
            )

            # Normalized keywords tables for performance
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS keywords (
                    id INTEGER PRIMARY KEY,
                    keyword TEXT NOT NULL UNIQUE
                )
                """
            )

            conn.execute(
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

            # Code relationships table for graph visualization
            conn.execute(
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

            # Indexes (v5: removed idx_symbols_type)
            conn.execute("CREATE INDEX IF NOT EXISTS idx_files_name ON files(name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_files_path ON files(full_path)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_subdirs_name ON subdirs(name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_semantic_file ON semantic_metadata(file_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_file_keywords_file_id ON file_keywords(file_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_file_keywords_keyword_id ON file_keywords(keyword_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_rel_source ON code_relationships(source_symbol_id)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_rel_target ON code_relationships(target_qualified_name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_rel_type ON code_relationships(relationship_type)")

        except sqlite3.DatabaseError as exc:
            raise StorageError(f"Failed to create schema: {exc}") from exc

    def _migrate_v2_add_name_column(self, conn: sqlite3.Connection) -> None:
        """Migration v2: Add 'name' column to files table.

        Required for FTS5 external content table.

        Args:
            conn: Database connection
        """
        # Check if files table exists and has columns
        cursor = conn.execute("PRAGMA table_info(files)")
        files_columns = {row[1] for row in cursor.fetchall()}

        if not files_columns:
            return  # No files table yet, will be created fresh

        # Skip if 'name' column already exists
        if "name" in files_columns:
            return

        # Add 'name' column with default value
        conn.execute("ALTER TABLE files ADD COLUMN name TEXT NOT NULL DEFAULT ''")

        # Populate 'name' column from full_path using pathlib for robustness
        rows = conn.execute("SELECT id, full_path FROM files WHERE name = ''").fetchall()
        for row in rows:
            file_id = row[0]
            full_path = row[1]
            # Use pathlib.Path.name for cross-platform compatibility
            name = Path(full_path).name if full_path else ""
            conn.execute("UPDATE files SET name = ? WHERE id = ?", (name, file_id))

    def _create_fts_triggers(self, conn: sqlite3.Connection) -> None:
        """Create FTS5 external content triggers for dual FTS tables.

        Creates synchronized triggers for both files_fts_exact and files_fts_fuzzy tables.

        Args:
            conn: Database connection
        """
        # Insert triggers for files_fts_exact
        conn.execute(
            """
            CREATE TRIGGER IF NOT EXISTS files_exact_ai AFTER INSERT ON files BEGIN
                INSERT INTO files_fts_exact(rowid, name, full_path, content)
                VALUES(new.id, new.name, new.full_path, new.content);
            END
            """
        )

        # Delete trigger for files_fts_exact
        conn.execute(
            """
            CREATE TRIGGER IF NOT EXISTS files_exact_ad AFTER DELETE ON files BEGIN
                INSERT INTO files_fts_exact(files_fts_exact, rowid, name, full_path, content)
                VALUES('delete', old.id, old.name, old.full_path, old.content);
            END
            """
        )

        # Update trigger for files_fts_exact
        conn.execute(
            """
            CREATE TRIGGER IF NOT EXISTS files_exact_au AFTER UPDATE ON files BEGIN
                INSERT INTO files_fts_exact(files_fts_exact, rowid, name, full_path, content)
                VALUES('delete', old.id, old.name, old.full_path, old.content);
                INSERT INTO files_fts_exact(rowid, name, full_path, content)
                VALUES(new.id, new.name, new.full_path, new.content);
            END
            """
        )

        # Insert trigger for files_fts_fuzzy
        conn.execute(
            """
            CREATE TRIGGER IF NOT EXISTS files_fuzzy_ai AFTER INSERT ON files BEGIN
                INSERT INTO files_fts_fuzzy(rowid, name, full_path, content)
                VALUES(new.id, new.name, new.full_path, new.content);
            END
            """
        )

        # Delete trigger for files_fts_fuzzy
        conn.execute(
            """
            CREATE TRIGGER IF NOT EXISTS files_fuzzy_ad AFTER DELETE ON files BEGIN
                INSERT INTO files_fts_fuzzy(files_fts_fuzzy, rowid, name, full_path, content)
                VALUES('delete', old.id, old.name, old.full_path, old.content);
            END
            """
        )

        # Update trigger for files_fts_fuzzy
        conn.execute(
            """
            CREATE TRIGGER IF NOT EXISTS files_fuzzy_au AFTER UPDATE ON files BEGIN
                INSERT INTO files_fts_fuzzy(files_fts_fuzzy, rowid, name, full_path, content)
                VALUES('delete', old.id, old.name, old.full_path, old.content);
                INSERT INTO files_fts_fuzzy(rowid, name, full_path, content)
                VALUES(new.id, new.name, new.full_path, new.content);
            END
            """
        )
