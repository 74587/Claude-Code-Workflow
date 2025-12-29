"""SQLite storage for CodexLens indexing and search."""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
from dataclasses import asdict
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

from codexlens.entities import IndexedFile, SearchResult, Symbol
from codexlens.errors import StorageError

logger = logging.getLogger(__name__)


class SQLiteStore:
    """SQLiteStore providing FTS5 search and symbol lookup.

    Implements thread-local connection pooling for improved performance.
    """

    # Maximum number of connections to keep in pool to prevent memory leaks
    MAX_POOL_SIZE = 32
    # Idle timeout in seconds (10 minutes)
    IDLE_TIMEOUT = 600
    # Periodic cleanup interval in seconds (5 minutes)
    CLEANUP_INTERVAL = 300

    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self._lock = threading.RLock()
        self._local = threading.local()
        self._pool_lock = threading.Lock()
        # Pool stores (connection, last_access_time) tuples
        self._pool: Dict[int, Tuple[sqlite3.Connection, float]] = {}
        self._pool_generation = 0
        self._cleanup_timer: threading.Timer | None = None
        self._cleanup_stop_event = threading.Event()
        self._start_cleanup_timer()

    def _get_connection(self) -> sqlite3.Connection:
        """Get or create a thread-local database connection."""
        thread_id = threading.get_ident()
        current_time = time.time()

        if getattr(self._local, "generation", None) == self._pool_generation:
            conn = getattr(self._local, "conn", None)
            if conn is not None:
                with self._pool_lock:
                    pool_entry = self._pool.get(thread_id)
                    if pool_entry is not None:
                        pooled_conn, _ = pool_entry
                        self._pool[thread_id] = (pooled_conn, current_time)
                        self._local.conn = pooled_conn
                        return pooled_conn

                # Thread-local connection is stale (e.g., cleaned up by timer).
                self._local.conn = None

        with self._pool_lock:
            pool_entry = self._pool.get(thread_id)
            if pool_entry is not None:
                conn, _ = pool_entry
                # Update last access time
                self._pool[thread_id] = (conn, current_time)
            else:
                # Clean up stale and idle connections if pool is too large
                if len(self._pool) >= self.MAX_POOL_SIZE:
                    self._cleanup_stale_connections()

                conn = sqlite3.connect(self.db_path, check_same_thread=False)
                conn.row_factory = sqlite3.Row
                conn.execute("PRAGMA journal_mode=WAL")
                conn.execute("PRAGMA synchronous=NORMAL")
                conn.execute("PRAGMA foreign_keys=ON")
                # Memory-mapped I/O for faster reads (30GB limit)
                conn.execute("PRAGMA mmap_size=30000000000")
                self._pool[thread_id] = (conn, current_time)

            self._local.conn = conn
            self._local.generation = self._pool_generation
            return conn

    def _cleanup_stale_connections(self) -> None:
        """Remove connections for threads that no longer exist or have been idle too long."""
        current_time = time.time()
        # Get list of active thread IDs
        active_threads = {t.ident for t in threading.enumerate() if t.ident is not None}

        # Find connections to remove: dead threads or idle timeout exceeded
        stale_ids: list[tuple[int, str]] = []
        for tid, (conn, last_access) in list(self._pool.items()):
            try:
                is_dead_thread = tid not in active_threads
                is_idle = (current_time - last_access) > self.IDLE_TIMEOUT

                is_invalid_connection = False
                if not is_dead_thread and not is_idle:
                    try:
                        conn.execute("SELECT 1").fetchone()
                    except sqlite3.ProgrammingError:
                        is_invalid_connection = True
                    except sqlite3.Error:
                        is_invalid_connection = True

                if is_invalid_connection:
                    stale_ids.append((tid, "invalid_connection"))
                elif is_dead_thread:
                    stale_ids.append((tid, "dead_thread"))
                elif is_idle:
                    stale_ids.append((tid, "idle_timeout"))
            except Exception:
                # Never break cleanup for a single bad entry.
                continue

        # Close and remove stale connections
        for tid, reason in stale_ids:
            try:
                conn, _ = self._pool[tid]
                conn.close()
            except Exception:
                pass
            del self._pool[tid]
            logger.debug("Cleaned SQLiteStore connection for thread_id=%s (%s)", tid, reason)

    def _start_cleanup_timer(self) -> None:
        if self.CLEANUP_INTERVAL <= 0:
            return

        self._cleanup_stop_event.clear()

        def tick() -> None:
            if self._cleanup_stop_event.is_set():
                return

            try:
                with self._pool_lock:
                    self._cleanup_stale_connections()
            finally:
                with self._pool_lock:
                    if self._cleanup_stop_event.is_set():
                        self._cleanup_timer = None
                        return

                    self._cleanup_timer = threading.Timer(self.CLEANUP_INTERVAL, tick)
                    self._cleanup_timer.daemon = True
                    self._cleanup_timer.start()

        self._cleanup_timer = threading.Timer(self.CLEANUP_INTERVAL, tick)
        self._cleanup_timer.daemon = True
        self._cleanup_timer.start()

    def _stop_cleanup_timer(self) -> None:
        self._cleanup_stop_event.set()
        with self._pool_lock:
            if self._cleanup_timer is not None:
                self._cleanup_timer.cancel()
                self._cleanup_timer = None

    def close(self) -> None:
        """Close all pooled connections."""
        with self._lock:
            self._stop_cleanup_timer()
            with self._pool_lock:
                for conn, _ in self._pool.values():
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

    def execute_query(
        self,
        sql: str,
        params: tuple = (),
        allow_writes: bool = False
    ) -> List[Dict[str, Any]]:
        """Execute a raw SQL query and return results as dictionaries.

        This is the public API for executing custom queries without bypassing
        encapsulation via _get_connection().

        By default, only SELECT queries are allowed. Use allow_writes=True
        for trusted internal code that needs to execute other statements.

        Args:
            sql: SQL query string with ? placeholders for parameters
            params: Tuple of parameter values to bind
            allow_writes: If True, allow non-SELECT statements (default False)

        Returns:
            List of result rows as dictionaries

        Raises:
            StorageError: If query execution fails or validation fails
        """
        # Validate query type for security
        sql_stripped = sql.strip().upper()
        if not allow_writes:
            # Only allow SELECT and WITH (for CTEs) statements
            if not (sql_stripped.startswith("SELECT") or sql_stripped.startswith("WITH")):
                raise StorageError(
                    "Only SELECT queries are allowed. "
                    "Use allow_writes=True for trusted internal operations.",
                    db_path=str(self.db_path),
                    operation="execute_query",
                    details={"query_type": sql_stripped.split()[0] if sql_stripped else "EMPTY"}
                )

        try:
            conn = self._get_connection()
            rows = conn.execute(sql, params).fetchall()
            return [dict(row) for row in rows]
        except sqlite3.Error as e:
            raise StorageError(
                f"Query execution failed: {e}",
                db_path=str(self.db_path),
                operation="execute_query",
                details={"error_type": type(e).__name__}
            ) from e

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
            except Exception as exc:
                try:
                    conn.rollback()
                except Exception as rollback_exc:
                    logger.error(
                        "Rollback failed after add_files() error (%s): %s", exc, rollback_exc
                    )
                    raise exc.with_traceback(exc.__traceback__) from rollback_exc
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
            # Include relationship count if table exists
            relationship_count = 0
            try:
                rel_row = conn.execute("SELECT COUNT(*) AS c FROM code_relationships").fetchone()
                relationship_count = int(rel_row["c"]) if rel_row else 0
            except sqlite3.DatabaseError:
                pass

            return {
                "files": int(file_count),
                "symbols": int(symbol_count),
                "relationships": relationship_count,
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
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS code_relationships (
                    id INTEGER PRIMARY KEY,
                    source_symbol_id INTEGER NOT NULL REFERENCES symbols(id) ON DELETE CASCADE,
                    target_qualified_name TEXT NOT NULL,
                    relationship_type TEXT NOT NULL,
                    source_line INTEGER NOT NULL,
                    target_file TEXT
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_rel_target ON code_relationships(target_qualified_name)")
            conn.execute("CREATE INDEX IF NOT EXISTS idx_rel_source ON code_relationships(source_symbol_id)")
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
                content_rowid='id',
                tokenize="unicode61 tokenchars '_'"
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
        except sqlite3.DatabaseError as exc:
            try:
                conn.rollback()
            except Exception as rollback_exc:
                logger.error(
                    "Rollback failed during FTS schema migration (%s): %s", exc, rollback_exc
                )
                raise exc.with_traceback(exc.__traceback__) from rollback_exc

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
