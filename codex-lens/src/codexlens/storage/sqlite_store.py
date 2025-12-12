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
    """SQLiteStore providing FTS5 search and symbol lookup."""

    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self._lock = threading.RLock()

    def initialize(self) -> None:
        with self._lock:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            with self._connect() as conn:
                self._create_schema(conn)

    def add_file(self, indexed_file: IndexedFile, content: str) -> None:
        with self._lock:
            with self._connect() as conn:
                path = str(Path(indexed_file.path).resolve())
                language = indexed_file.language
                mtime = Path(path).stat().st_mtime if Path(path).exists() else None
                line_count = content.count("\n") + 1

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

                conn.execute(
                    "INSERT OR REPLACE INTO files_fts(rowid, path, language, content) VALUES(?, ?, ?, ?)",
                    (file_id, path, language, content),
                )

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

    def remove_file(self, path: str | Path) -> bool:
        """Remove a file from the index.

        Returns True if the file was removed, False if it didn't exist.
        """
        with self._lock:
            with self._connect() as conn:
                resolved_path = str(Path(path).resolve())

                # Get file_id first
                row = conn.execute(
                    "SELECT id FROM files WHERE path=?", (resolved_path,)
                ).fetchone()

                if not row:
                    return False

                file_id = int(row["id"])

                # Delete from FTS index
                conn.execute("DELETE FROM files_fts WHERE rowid=?", (file_id,))

                # Delete symbols (CASCADE should handle this, but be explicit)
                conn.execute("DELETE FROM symbols WHERE file_id=?", (file_id,))

                # Delete file record
                conn.execute("DELETE FROM files WHERE id=?", (file_id,))

                return True

    def file_exists(self, path: str | Path) -> bool:
        """Check if a file exists in the index."""
        with self._lock:
            with self._connect() as conn:
                resolved_path = str(Path(path).resolve())
                row = conn.execute(
                    "SELECT 1 FROM files WHERE path=?", (resolved_path,)
                ).fetchone()
                return row is not None

    def get_file_mtime(self, path: str | Path) -> float | None:
        """Get the stored mtime for a file, or None if not indexed."""
        with self._lock:
            with self._connect() as conn:
                resolved_path = str(Path(path).resolve())
                row = conn.execute(
                    "SELECT mtime FROM files WHERE path=?", (resolved_path,)
                ).fetchone()
                return float(row["mtime"]) if row and row["mtime"] else None

    def search_fts(self, query: str, *, limit: int = 20, offset: int = 0) -> List[SearchResult]:
        with self._lock:
            with self._connect() as conn:
                try:
                    rows = conn.execute(
                        """
                        SELECT rowid, path, bm25(files_fts) AS rank,
                               snippet(files_fts, 2, '[bold red]', '[/bold red]', '…', 20) AS excerpt
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
                    # BM25 returns negative values where more negative = better match
                    # Convert to positive score where higher = better
                    rank = float(row["rank"]) if row["rank"] is not None else 0.0
                    score = max(0.0, -rank)  # Negate to make positive, clamp at 0
                    results.append(
                        SearchResult(
                            path=row["path"],
                            score=score,
                            excerpt=row["excerpt"],
                        )
                    )
                return results

    def search_symbols(
        self, name: str, *, kind: Optional[str] = None, limit: int = 50
    ) -> List[Symbol]:
        pattern = f"%{name}%"
        with self._lock:
            with self._connect() as conn:
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
            with self._connect() as conn:
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
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        return conn

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
                CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
                    path UNINDEXED,
                    language UNINDEXED,
                    content
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
        except sqlite3.DatabaseError as exc:
            raise StorageError(f"Failed to initialize database schema: {exc}") from exc

