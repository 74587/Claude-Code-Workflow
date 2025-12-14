"""Global project registry for CodexLens - SQLite storage."""

from __future__ import annotations

import sqlite3
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

from codexlens.errors import StorageError


@dataclass
class ProjectInfo:
    """Registered project information."""

    id: int
    source_root: Path
    index_root: Path
    created_at: float
    last_indexed: float
    total_files: int
    total_dirs: int
    status: str


@dataclass
class DirMapping:
    """Directory to index path mapping."""

    id: int
    project_id: int
    source_path: Path
    index_path: Path
    depth: int
    files_count: int
    last_updated: float


class RegistryStore:
    """Global project registry - SQLite storage.

    Manages indexed projects and directory-to-index path mappings.
    Thread-safe with connection pooling.
    """

    DEFAULT_DB_PATH = Path.home() / ".codexlens" / "registry.db"

    def __init__(self, db_path: Path | None = None) -> None:
        self.db_path = (db_path or self.DEFAULT_DB_PATH).resolve()
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

    def __enter__(self) -> RegistryStore:
        self.initialize()
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        self.close()

    def initialize(self) -> None:
        """Create database and schema."""
        with self._lock:
            self.db_path.parent.mkdir(parents=True, exist_ok=True)
            conn = self._get_connection()
            self._create_schema(conn)

    def _create_schema(self, conn: sqlite3.Connection) -> None:
        """Create database schema."""
        try:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS projects (
                    id INTEGER PRIMARY KEY,
                    source_root TEXT UNIQUE NOT NULL,
                    index_root TEXT NOT NULL,
                    created_at REAL,
                    last_indexed REAL,
                    total_files INTEGER DEFAULT 0,
                    total_dirs INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'active'
                )
                """
            )

            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS dir_mapping (
                    id INTEGER PRIMARY KEY,
                    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                    source_path TEXT NOT NULL,
                    index_path TEXT NOT NULL,
                    depth INTEGER,
                    files_count INTEGER DEFAULT 0,
                    last_updated REAL,
                    UNIQUE(source_path)
                )
                """
            )

            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_dir_source ON dir_mapping(source_path)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_dir_project ON dir_mapping(project_id)"
            )
            conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_project_source ON projects(source_root)"
            )

            conn.commit()
        except sqlite3.DatabaseError as exc:
            raise StorageError(f"Failed to initialize registry schema: {exc}") from exc

    # === Project Operations ===

    def register_project(self, source_root: Path, index_root: Path) -> ProjectInfo:
        """Register a new project or update existing one.

        Args:
            source_root: Source code root directory
            index_root: Index storage root directory

        Returns:
            ProjectInfo for the registered project
        """
        with self._lock:
            conn = self._get_connection()
            source_root_str = str(source_root.resolve())
            index_root_str = str(index_root.resolve())
            now = time.time()

            conn.execute(
                """
                INSERT INTO projects(source_root, index_root, created_at, last_indexed)
                VALUES(?, ?, ?, ?)
                ON CONFLICT(source_root) DO UPDATE SET
                    index_root=excluded.index_root,
                    last_indexed=excluded.last_indexed,
                    status='active'
                """,
                (source_root_str, index_root_str, now, now),
            )

            row = conn.execute(
                "SELECT * FROM projects WHERE source_root=?", (source_root_str,)
            ).fetchone()

            conn.commit()

            if not row:
                raise StorageError(f"Failed to register project: {source_root}")

            return self._row_to_project_info(row)

    def unregister_project(self, source_root: Path) -> bool:
        """Remove a project registration (cascades to directory mappings).

        Args:
            source_root: Source code root directory

        Returns:
            True if project was removed, False if not found
        """
        with self._lock:
            conn = self._get_connection()
            source_root_str = str(source_root.resolve())

            row = conn.execute(
                "SELECT id FROM projects WHERE source_root=?", (source_root_str,)
            ).fetchone()

            if not row:
                return False

            conn.execute("DELETE FROM projects WHERE source_root=?", (source_root_str,))
            conn.commit()
            return True

    def get_project(self, source_root: Path) -> Optional[ProjectInfo]:
        """Get project information by source root.

        Args:
            source_root: Source code root directory

        Returns:
            ProjectInfo if found, None otherwise
        """
        with self._lock:
            conn = self._get_connection()
            source_root_str = str(source_root.resolve())

            row = conn.execute(
                "SELECT * FROM projects WHERE source_root=?", (source_root_str,)
            ).fetchone()

            return self._row_to_project_info(row) if row else None

    def get_project_by_id(self, project_id: int) -> Optional[ProjectInfo]:
        """Get project information by ID.

        Args:
            project_id: Project database ID

        Returns:
            ProjectInfo if found, None otherwise
        """
        with self._lock:
            conn = self._get_connection()

            row = conn.execute(
                "SELECT * FROM projects WHERE id=?", (project_id,)
            ).fetchone()

            return self._row_to_project_info(row) if row else None

    def list_projects(self, status: Optional[str] = None) -> List[ProjectInfo]:
        """List all registered projects.

        Args:
            status: Optional status filter ('active', 'stale', 'removed')

        Returns:
            List of ProjectInfo objects
        """
        with self._lock:
            conn = self._get_connection()

            if status:
                rows = conn.execute(
                    "SELECT * FROM projects WHERE status=? ORDER BY created_at DESC",
                    (status,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM projects ORDER BY created_at DESC"
                ).fetchall()

            return [self._row_to_project_info(row) for row in rows]

    def update_project_stats(
        self, source_root: Path, total_files: int, total_dirs: int
    ) -> None:
        """Update project statistics.

        Args:
            source_root: Source code root directory
            total_files: Total number of indexed files
            total_dirs: Total number of indexed directories
        """
        with self._lock:
            conn = self._get_connection()
            source_root_str = str(source_root.resolve())

            conn.execute(
                """
                UPDATE projects
                SET total_files=?, total_dirs=?, last_indexed=?
                WHERE source_root=?
                """,
                (total_files, total_dirs, time.time(), source_root_str),
            )
            conn.commit()

    def set_project_status(self, source_root: Path, status: str) -> None:
        """Set project status.

        Args:
            source_root: Source code root directory
            status: Status string ('active', 'stale', 'removed')
        """
        with self._lock:
            conn = self._get_connection()
            source_root_str = str(source_root.resolve())

            conn.execute(
                "UPDATE projects SET status=? WHERE source_root=?",
                (status, source_root_str),
            )
            conn.commit()

    # === Directory Mapping Operations ===

    def register_dir(
        self,
        project_id: int,
        source_path: Path,
        index_path: Path,
        depth: int,
        files_count: int = 0,
    ) -> DirMapping:
        """Register a directory mapping.

        Args:
            project_id: Project database ID
            source_path: Source directory path
            index_path: Index database path
            depth: Directory depth relative to project root
            files_count: Number of files in directory

        Returns:
            DirMapping for the registered directory
        """
        with self._lock:
            conn = self._get_connection()
            source_path_str = str(source_path.resolve())
            index_path_str = str(index_path.resolve())
            now = time.time()

            conn.execute(
                """
                INSERT INTO dir_mapping(
                    project_id, source_path, index_path, depth, files_count, last_updated
                )
                VALUES(?, ?, ?, ?, ?, ?)
                ON CONFLICT(source_path) DO UPDATE SET
                    index_path=excluded.index_path,
                    depth=excluded.depth,
                    files_count=excluded.files_count,
                    last_updated=excluded.last_updated
                """,
                (project_id, source_path_str, index_path_str, depth, files_count, now),
            )

            row = conn.execute(
                "SELECT * FROM dir_mapping WHERE source_path=?", (source_path_str,)
            ).fetchone()

            conn.commit()

            if not row:
                raise StorageError(f"Failed to register directory: {source_path}")

            return self._row_to_dir_mapping(row)

    def unregister_dir(self, source_path: Path) -> bool:
        """Remove a directory mapping.

        Args:
            source_path: Source directory path

        Returns:
            True if directory was removed, False if not found
        """
        with self._lock:
            conn = self._get_connection()
            source_path_str = str(source_path.resolve())

            row = conn.execute(
                "SELECT id FROM dir_mapping WHERE source_path=?", (source_path_str,)
            ).fetchone()

            if not row:
                return False

            conn.execute("DELETE FROM dir_mapping WHERE source_path=?", (source_path_str,))
            conn.commit()
            return True

    def find_index_path(self, source_path: Path) -> Optional[Path]:
        """Find index path for a source directory (exact match).

        Args:
            source_path: Source directory path

        Returns:
            Index path if found, None otherwise
        """
        with self._lock:
            conn = self._get_connection()
            source_path_str = str(source_path.resolve())

            row = conn.execute(
                "SELECT index_path FROM dir_mapping WHERE source_path=?",
                (source_path_str,),
            ).fetchone()

            return Path(row["index_path"]) if row else None

    def find_nearest_index(self, source_path: Path) -> Optional[DirMapping]:
        """Find nearest indexed ancestor directory.

        Searches for the closest parent directory that has an index.
        Useful for supporting subdirectory searches.

        Args:
            source_path: Source directory or file path

        Returns:
            DirMapping for nearest ancestor, None if not found
        """
        with self._lock:
            conn = self._get_connection()
            source_path_resolved = source_path.resolve()

            # Check from current path up to root
            current = source_path_resolved
            while True:
                current_str = str(current)
                row = conn.execute(
                    "SELECT * FROM dir_mapping WHERE source_path=?", (current_str,)
                ).fetchone()

                if row:
                    return self._row_to_dir_mapping(row)

                parent = current.parent
                if parent == current:  # Reached filesystem root
                    break
                current = parent

            return None

    def get_project_dirs(self, project_id: int) -> List[DirMapping]:
        """Get all directory mappings for a project.

        Args:
            project_id: Project database ID

        Returns:
            List of DirMapping objects
        """
        with self._lock:
            conn = self._get_connection()

            rows = conn.execute(
                "SELECT * FROM dir_mapping WHERE project_id=? ORDER BY depth, source_path",
                (project_id,),
            ).fetchall()

            return [self._row_to_dir_mapping(row) for row in rows]

    def get_subdirs(self, source_path: Path) -> List[DirMapping]:
        """Get direct subdirectory mappings.

        Args:
            source_path: Parent directory path

        Returns:
            List of DirMapping objects for direct children
        """
        with self._lock:
            conn = self._get_connection()
            source_path_str = str(source_path.resolve())

            # First get the parent's depth
            parent_row = conn.execute(
                "SELECT depth, project_id FROM dir_mapping WHERE source_path=?",
                (source_path_str,),
            ).fetchone()

            if not parent_row:
                return []

            parent_depth = int(parent_row["depth"])
            project_id = int(parent_row["project_id"])

            # Get all subdirs with depth = parent_depth + 1 and matching path prefix
            rows = conn.execute(
                """
                SELECT * FROM dir_mapping
                WHERE project_id=? AND depth=? AND source_path LIKE ?
                ORDER BY source_path
                """,
                (project_id, parent_depth + 1, f"{source_path_str}%"),
            ).fetchall()

            return [self._row_to_dir_mapping(row) for row in rows]

    def update_dir_stats(self, source_path: Path, files_count: int) -> None:
        """Update directory statistics.

        Args:
            source_path: Source directory path
            files_count: Number of files in directory
        """
        with self._lock:
            conn = self._get_connection()
            source_path_str = str(source_path.resolve())

            conn.execute(
                """
                UPDATE dir_mapping
                SET files_count=?, last_updated=?
                WHERE source_path=?
                """,
                (files_count, time.time(), source_path_str),
            )
            conn.commit()

    def update_index_paths(self, old_root: Path, new_root: Path) -> int:
        """Update all index paths after migration.

        Replaces old_root prefix with new_root in all stored index paths.

        Args:
            old_root: Old index root directory
            new_root: New index root directory

        Returns:
            Number of paths updated
        """
        with self._lock:
            conn = self._get_connection()
            old_root_str = str(old_root.resolve())
            new_root_str = str(new_root.resolve())
            updated = 0

            # Update projects
            conn.execute(
                """
                UPDATE projects
                SET index_root = REPLACE(index_root, ?, ?)
                WHERE index_root LIKE ?
                """,
                (old_root_str, new_root_str, f"{old_root_str}%"),
            )
            updated += conn.total_changes

            # Update dir_mapping
            conn.execute(
                """
                UPDATE dir_mapping
                SET index_path = REPLACE(index_path, ?, ?)
                WHERE index_path LIKE ?
                """,
                (old_root_str, new_root_str, f"{old_root_str}%"),
            )
            updated += conn.total_changes

            conn.commit()
            return updated

    # === Internal Methods ===

    def _row_to_project_info(self, row: sqlite3.Row) -> ProjectInfo:
        """Convert database row to ProjectInfo."""
        return ProjectInfo(
            id=int(row["id"]),
            source_root=Path(row["source_root"]),
            index_root=Path(row["index_root"]),
            created_at=float(row["created_at"]) if row["created_at"] else 0.0,
            last_indexed=float(row["last_indexed"]) if row["last_indexed"] else 0.0,
            total_files=int(row["total_files"]) if row["total_files"] else 0,
            total_dirs=int(row["total_dirs"]) if row["total_dirs"] else 0,
            status=str(row["status"]) if row["status"] else "active",
        )

    def _row_to_dir_mapping(self, row: sqlite3.Row) -> DirMapping:
        """Convert database row to DirMapping."""
        return DirMapping(
            id=int(row["id"]),
            project_id=int(row["project_id"]),
            source_path=Path(row["source_path"]),
            index_path=Path(row["index_path"]),
            depth=int(row["depth"]) if row["depth"] is not None else 0,
            files_count=int(row["files_count"]) if row["files_count"] else 0,
            last_updated=float(row["last_updated"]) if row["last_updated"] else 0.0,
        )
