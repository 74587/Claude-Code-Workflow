"""SQLite storage for CodexLens indexing and search."""

from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from codexlens.entities import IndexedFile, SearchResult, Symbol
from codexlens.errors import StorageError


class SQLiteStore:
    """SQLiteStore providing FTS5 search and symbol lookup.
    
    Implements thread-local connection pooling for improved performance.
    """

    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self._lock = threading.RLock()
        self._local = threading.local()
        self._pool_lock = threading.Lock()
        self._pool: Dict[int, sqlite3.Connection] = {}
        self._pool_generation = 0

    def _get_connection(self) -> sqlite3.Connection:
        """Get or create a thread-local database connection."""
        thread_id = threading.get_ident()
        if getattr(self._local, "generation", None) == self._pool_generation:
            conn = getattr(self._local, "conn", None)
            if conn is not None:
                return conn

        with self._pool_lock:
            conn = self._pool.get(thread_id)
            if conn is None:
                conn = sqlite3.connect(self.db_path, check_same_thread=False)
                conn.row_factory = sqlite3.Row
                conn.execute("PRAGMA journal_mode=WAL")
                conn.execute("PRAGMA synchronous=NORMAL")
                conn.execute("PRAGMA foreign_keys=ON")
                self._pool[thread_id] = conn

            self._local.conn = conn
            self._local.generation = self._pool_generation
            return conn

    def close(self) -> None:
        """Close all pooled connections."""
        with self._lock:
            with self._pool_lock:
                for conn in self._pool.values():
                    conn.close()
                self._pool.clear()
                self._pool_generation += 1

            if hasattr(self._local, "conn"):
                self._local.conn = None
            if hasattr(self._local, "generation"):
                self._local.generation = self._pool_generation

    def __enter__(self) -> SQLiteStore:
        self.initialize()
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        self.close()

    def initialize(self) -> None:
        with self._lock:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            conn = self._get_connection()
            self._create_schema(conn)
            self._ensure_fts_external_content(conn)


    def add_file(self, indexed_file: IndexedFile, content: str) -> None:
        with self._lock:
            conn = self._get_connection()
            path = str(Path(indexed_file.path).resolve())
            language = indexed_file.language
            mtime = Path(path).stat().st_mtime if Path(path).exists() else None
            line_count = content.count(chr(10)) + 1

            conn.execute(
                """
                INSERT INTO files(path, language, content, mtime, line_count)
                VALUES(?, ?, ?, ?, ?)
                ON CONFLICT(path) DO UPDATE SET
                    language=excluded.language,
                    content=excluded.content,
                    mtime=excluded.mtime,
                    line_count=excluded.line_count
                """,
                (path, language, content, mtime, line_count),
            )

            row = conn.execute("SELECT id FROM files WHERE path=?", (path,)).fetchone()
            if not row:
                raise StorageError(f"Failed to read file id for {path}")
            file_id = int(row["id"])

            conn.execute("DELETE FROM symbols WHERE file_id=?", (file_id,))
            if indexed_file.symbols:
                conn.executemany(
                    """
                    INSERT INTO symbols(file_id, name, kind, start_line, end_line)
                    VALUES(?, ?, ?, ?, ?)
                    """,
                    [
                        (file_id, s.name, s.kind, s.range[0], s.range[1])
                        for s in indexed_file.symbols
                    ],
                )
            conn.commit()

    def add_files(self, files_data: List[tuple[IndexedFile, str]]) -> None:
        """Add multiple files in a single transaction for better performance.
        
        Args:
            files_data: List of (indexed_file, content) tuples
        """
        with self._lock:
            conn = self._get_connection()
            try:
                conn.execute("BEGIN")
                
                for indexed_file, content in files_data:
                    path = str(Path(indexed_file.path).resolve())
                    language = indexed_file.language
                    mtime = Path(path).stat().st_mtime if Path(path).exists() else None
                    line_count = content.count(chr(10)) + 1

                    conn.execute(
                        """
                        INSERT INTO files(path, language, content, mtime, line_count)
                        VALUES(?, ?, ?, ?, ?)
                        ON CONFLICT(path) DO UPDATE SET
                            language=excluded.language,
                            content=excluded.content,
                            mtime=excluded.mtime,
                            line_count=excluded.line_count
                        """,
                        (path, language, content, mtime, line_count),
                    )

                    row = conn.execute("SELECT id FROM files WHERE path=?", (path,)).fetchone()
                    if not row:
                        raise StorageError(f"Failed to read file id for {path}")
                    file_id = int(row["id"])

                    conn.execute("DELETE FROM symbols WHERE file_id=?", (file_id,))
                    if indexed_file.symbols:
                        conn.executemany(
                            """
                            INSERT INTO symbols(file_id, name, kind, start_line, end_line)
                            VALUES(?, ?, ?, ?, ?)
                            """,
                            [
                                (file_id, s.name, s.kind, s.range[0], s.range[1])
                                for s in indexed_file.symbols
                            ],
                        )
                
                conn.commit()
            except Exception:
                conn.rollback()
                raise

    def remove_file(self, path: str | Path) -> bool:
        """Remove a file from the index."""
        with self._lock:
            conn = self._get_connection()
            resolved_path = str(Path(path).resolve())

            row = conn.execute(
                "SELECT id FROM files WHERE path=?", (resolved_path,)
            ).fetchone()

            if not row:
                return False

            file_id = int(row["id"])
            conn.execute("DELETE FROM files WHERE id=?", (file_id,))
            conn.commit()
            return True

    def file_exists(self, path: str | Path) -> bool:
        """Check if a file exists in the index."""
        with self._lock:
            conn = self._get_connection()
            resolved_path = str(Path(path).resolve())
            row = conn.execute(
                "SELECT 1 FROM files WHERE path=?", (resolved_path,)
            ).fetchone()
            return row is not None

    def get_file_mtime(self, path: str | Path) -> float | None:
        """Get the stored mtime for a file."""
        with self._lock:
            conn = self._get_connection()
            resolved_path = str(Path(path).resolve())
            row = conn.execute(
                "SELECT mtime FROM files WHERE path=?", (resolved_path,)
            ).fetchone()
            return float(row["mtime"]) if row and row["mtime"] else None


    def search_fts(self, query: str, *, limit: int = 20, offset: int = 0) -> List[SearchResult]:
        with self._lock:
            conn = self._get_connection()
            try:
                rows = conn.execute(
                    """
                    SELECT rowid, path, bm25(files_fts) AS rank,
                           snippet(files_fts, 2, '[bold red]', '[/bold red]', "...", 20) AS excerpt
                    FROM files_fts
                    WHERE files_fts MATCH ?
                    ORDER BY rank
                    LIMIT ? OFFSET ?
                    """,
                    (query, limit, offset),
                ).fetchall()
            except sqlite3.DatabaseError as exc:
                raise StorageError(f"FTS search failed: {exc}") from exc

            results: List[SearchResult] = []
            for row in rows:
                rank = float(row["rank"]) if row["rank"] is not None else 0.0
                score = abs(rank) if rank < 0 else 0.0
                results.append(
                    SearchResult(
                        path=row["path"],
                        score=score,
                        excerpt=row["excerpt"],
                    )
                )
            return results

    def search_files_only(
        self, query: str, *, limit: int = 20, offset: int = 0
    ) -> List[str]:
        """Search indexed file contents and return only file paths."""
        with self._lock:
            conn = self._get_connection()
            try:
                rows = conn.execute(
                    """
                    SELECT path
                    FROM files_fts
                    WHERE files_fts MATCH ?
                    ORDER BY bm25(files_fts)
                    LIMIT ? OFFSET ?
                    """,
                    (query, limit, offset),
                ).fetchall()
            except sqlite3.DatabaseError as exc:
                raise StorageError(f"FTS search failed: {exc}") from exc

            return [row["path"] for row in rows]

    def search_symbols(
        self, name: str, *, kind: Optional[str] = None, limit: int = 50
    ) -> List[Symbol]:
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
                Symbol(name=row["name"], kind=row["kind"], range=(row["start_line"], row["end_line"]))
                for row in rows
            ]


    def stats(self) -> Dict[str, Any]:
        with self._lock:
            conn = self._get_connection()
            file_count = conn.execute("SELECT COUNT(*) AS c FROM files").fetchone()["c"]
            symbol_count = conn.execute("SELECT COUNT(*) AS c FROM symbols").fetchone()["c"]
            lang_rows = conn.execute(
                "SELECT language, COUNT(*) AS c FROM files GROUP BY language ORDER BY c DESC"
            ).fetchall()
            languages = {row["language"]: row["c"] for row in lang_rows}
            return {
                "files": int(file_count),
                "symbols": int(symbol_count),
                "languages": languages,
                "db_path": str(self.db_path),
            }

    def _connect(self) -> sqlite3.Connection:
        """Legacy method for backward compatibility."""
        return self._get_connection()

    def _create_schema(self, conn: sqlite3.Connection) -> None:
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS files (
                    id INTEGER PRIMARY KEY,
                    path TEXT UNIQUE NOT NULL,
                    language TEXT NOT NULL,
                    content TEXT NOT NULL,
                    mtime REAL,
                    line_count INTEGER
                )
                """
            )
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS symbols (
                    id INTEGER PRIMARY KEY,
                    file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    start_line INTEGER NOT NULL,
                    end_line INTEGER NOT NULL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind)")
            conn.commit()
        except sqlite3.DatabaseError as exc:
            raise StorageError(f"Failed to initialize database schema: {exc}") from exc

    def _ensure_fts_external_content(self, conn: sqlite3.Connection) -> None:
        """Ensure files_fts is an FTS5 external-content table (no content duplication)."""
        try:
            sql_row = conn.execute(
                "SELECT sql FROM sqlite_master WHERE type='table' AND name='files_fts'"
            ).fetchone()
            sql = str(sql_row["sql"]) if sql_row and sql_row["sql"] else None

            if sql is None:
                self._create_external_fts(conn)
                conn.commit()
                return

            if (
                "content='files'" in sql
                or 'content="files"' in sql
                or "content=files" in sql
            ):
                self._create_fts_triggers(conn)
                conn.commit()
                return

            self._migrate_fts_to_external(conn)
        except sqlite3.DatabaseError as exc:
            raise StorageError(f"Failed to ensure FTS schema: {exc}") from exc

    def _create_external_fts(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE VIRTUAL TABLE files_fts USING fts5(
                path UNINDEXED,
                language UNINDEXED,
                content,
                content='files',
                content_rowid='id'
            )
            """
        )
        self._create_fts_triggers(conn)

    def _create_fts_triggers(self, conn: sqlite3.Connection) -> None:
        conn.execute(
            """
            CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
                INSERT INTO files_fts(rowid, path, language, content)
                VALUES(new.id, new.path, new.language, new.content);
            END
            """
        )
        conn.execute(
            """
            CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
                INSERT INTO files_fts(files_fts, rowid, path, language, content)
                VALUES('delete', old.id, old.path, old.language, old.content);
            END
            """
        )
        conn.execute(
            """
            CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
                INSERT INTO files_fts(files_fts, rowid, path, language, content)
                VALUES('delete', old.id, old.path, old.language, old.content);
                INSERT INTO files_fts(rowid, path, language, content)
                VALUES(new.id, new.path, new.language, new.content);
            END
            """
        )

    def _migrate_fts_to_external(self, conn: sqlite3.Connection) -> None:
        """Migrate legacy files_fts (with duplicated content) to external content."""
        try:
            conn.execute("BEGIN")
            conn.execute("DROP TRIGGER IF EXISTS files_ai")
            conn.execute("DROP TRIGGER IF EXISTS files_ad")
            conn.execute("DROP TRIGGER IF EXISTS files_au")

            conn.execute("ALTER TABLE files_fts RENAME TO files_fts_legacy")
            self._create_external_fts(conn)
            conn.execute("INSERT INTO files_fts(files_fts) VALUES('rebuild')")
            conn.execute("DROP TABLE files_fts_legacy")
            conn.commit()
        except sqlite3.DatabaseError:
            try:
                conn.rollback()
            except Exception:
                pass

            try:
                conn.execute("DROP TABLE IF EXISTS files_fts")
            except Exception:
                pass

            try:
                conn.execute("ALTER TABLE files_fts_legacy RENAME TO files_fts")
                conn.commit()
            except Exception:
                pass
            raise

        try:
            conn.execute("VACUUM")
        except sqlite3.DatabaseError:
            pass
