"""Single-directory index storage with hierarchical linking.

Each directory maintains its own _index.db with:
- Files in the current directory
- Links to subdirectory indexes
- Full-text search via FTS5
- Symbol table for code navigation
"""

from __future__ import annotations

import sqlite3
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from codexlens.entities import SearchResult, Symbol
from codexlens.errors import StorageError


@dataclass
class SubdirLink:
    """Link to a subdirectory's index database."""

    id: int
    name: str
    index_path: Path
    files_count: int
    direct_files: int
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

    def __init__(self, db_path: str | Path) -> None:
        """Initialize directory index store.

        Args:
            db_path: Path to _index.db file for this directory
        """
        self.db_path = Path(db_path).resolve()
        self._lock = threading.RLock()
        self._conn: Optional[sqlite3.Connection] = None

    def initialize(self) -> None:
        """Create database and schema if not exists."""
        with self._lock:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            conn = self._get_connection()
            self._create_schema(conn)
            self._create_fts_triggers(conn)
            conn.commit()

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
                    conn.executemany(
                        """
                        INSERT INTO symbols(file_id, name, kind, start_line, end_line)
                        VALUES(?, ?, ?, ?, ?)
                        """,
                        [
                            (file_id, s.name, s.kind, s.range[0], s.range[1])
                            for s in symbols
                        ],
                    )

                conn.commit()
                return file_id

            except sqlite3.DatabaseError as exc:
                conn.rollback()
                raise StorageError(f"Failed to add file {name}: {exc}") from exc

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
                        conn.executemany(
                            """
                            INSERT INTO symbols(file_id, name, kind, start_line, end_line)
                            VALUES(?, ?, ?, ?, ?)
                            """,
                            [
                                (file_id, s.name, s.kind, s.range[0], s.range[1])
                                for s in symbols
                            ],
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
            direct_files: Files directly in subdirectory
        """
        with self._lock:
            conn = self._get_connection()
            index_path_str = str(Path(index_path).resolve())

            import time
            last_updated = time.time()

            conn.execute(
                """
                INSERT INTO subdirs(name, index_path, files_count, direct_files, last_updated)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(name) DO UPDATE SET
                    index_path=excluded.index_path,
                    files_count=excluded.files_count,
                    direct_files=excluded.direct_files,
                    last_updated=excluded.last_updated
                """,
                (name, index_path_str, files_count, direct_files, last_updated),
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
                SELECT id, name, index_path, files_count, direct_files, last_updated
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
                    direct_files=int(row["direct_files"]) if row["direct_files"] else 0,
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
                SELECT id, name, index_path, files_count, direct_files, last_updated
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
                direct_files=int(row["direct_files"]) if row["direct_files"] else 0,
                last_updated=float(row["last_updated"]) if row["last_updated"] else 0.0,
            )

    def update_subdir_stats(
        self, name: str, files_count: int, direct_files: Optional[int] = None
    ) -> None:
        """Update subdirectory statistics.

        Args:
            name: Subdirectory name
            files_count: Total files recursively
            direct_files: Files directly in subdirectory (optional)
        """
        with self._lock:
            conn = self._get_connection()
            import time
            last_updated = time.time()

            if direct_files is not None:
                conn.execute(
                    """
                    UPDATE subdirs
                    SET files_count=?, direct_files=?, last_updated=?
                    WHERE name=?
                    """,
                    (files_count, direct_files, last_updated, name),
                )
            else:
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

    def search_fts(self, query: str, limit: int = 20) -> List[SearchResult]:
        """Full-text search in current directory files.

        Args:
            query: FTS5 query string
            limit: Maximum results to return

        Returns:
            List of SearchResult objects sorted by relevance

        Raises:
            StorageError: If FTS search fails
        """
        with self._lock:
            conn = self._get_connection()
            try:
                rows = conn.execute(
                    """
                    SELECT rowid, full_path, bm25(files_fts) AS rank,
                           snippet(files_fts, 2, '[bold red]', '[/bold red]', '...', 20) AS excerpt
                    FROM files_fts
                    WHERE files_fts MATCH ?
                    ORDER BY rank
                    LIMIT ?
                    """,
                    (query, limit),
                ).fetchall()
            except sqlite3.DatabaseError as exc:
                raise StorageError(f"FTS search failed: {exc}") from exc

            results: List[SearchResult] = []
            for row in rows:
                rank = float(row["rank"]) if row["rank"] is not None else 0.0
                score = abs(rank) if rank < 0 else 0.0
                results.append(
                    SearchResult(
                        path=row["full_path"],
                        score=score,
                        excerpt=row["excerpt"],
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
        self, name: str, kind: Optional[str] = None, limit: int = 50
    ) -> List[Symbol]:
        """Search symbols by name pattern.

        Args:
            name: Symbol name pattern (LIKE query)
            kind: Optional symbol kind filter
            limit: Maximum results to return

        Returns:
            List of Symbol objects
        """
        pattern = f"%{name}%"
        with self._lock:
            conn = self._get_connection()
            if kind:
                rows = conn.execute(
                    """
                    SELECT name, kind, start_line, end_line
                    FROM symbols
                    WHERE name LIKE ? AND kind=?
                    ORDER BY name
                    LIMIT ?
                    """,
                    (pattern, kind, limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT name, kind, start_line, end_line
                    FROM symbols
                    WHERE name LIKE ?
                    ORDER BY name
                    LIMIT ?
                    """,
                    (pattern, limit),
                ).fetchall()

            return [
                Symbol(
                    name=row["name"],
                    kind=row["kind"],
                    range=(row["start_line"], row["end_line"]),
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

            # Subdirectories table
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS subdirs (
                    id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    index_path TEXT NOT NULL,
                    files_count INTEGER DEFAULT 0,
                    direct_files INTEGER DEFAULT 0,
                    last_updated REAL
                )
                """
            )

            # Symbols table
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

            # FTS5 external content table with code-friendly tokenizer
            # unicode61 tokenchars keeps underscores as part of tokens
            # so 'user_id' is indexed as one token, not 'user' and 'id'
            conn.execute(
                """
                CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
                    name, full_path UNINDEXED, content,
                    content='files',
                    content_rowid='id',
                    tokenize="unicode61 tokenchars '_'"
                )
                """
            )

            # Indexes
            conn.execute("CREATE INDEX IF NOT EXISTS idx_files_name ON files(name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_files_path ON files(full_path)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_subdirs_name ON subdirs(name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id)")

        except sqlite3.DatabaseError as exc:
            raise StorageError(f"Failed to create schema: {exc}") from exc

    def _create_fts_triggers(self, conn: sqlite3.Connection) -> None:
        """Create FTS5 external content triggers.

        Args:
            conn: Database connection
        """
        # Insert trigger
        conn.execute(
            """
            CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
                INSERT INTO files_fts(rowid, name, full_path, content)
                VALUES(new.id, new.name, new.full_path, new.content);
            END
            """
        )

        # Delete trigger
        conn.execute(
            """
            CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
                INSERT INTO files_fts(files_fts, rowid, name, full_path, content)
                VALUES('delete', old.id, old.name, old.full_path, old.content);
            END
            """
        )

        # Update trigger
        conn.execute(
            """
            CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
                INSERT INTO files_fts(files_fts, rowid, name, full_path, content)
                VALUES('delete', old.id, old.name, old.full_path, old.content);
                INSERT INTO files_fts(rowid, name, full_path, content)
                VALUES(new.id, new.name, new.full_path, new.content);
            END
            """
        )
