"""Graph expansion for search results using precomputed neighbors.

Expands top search results with related symbol definitions by traversing
precomputed N-hop neighbors stored in the per-directory index databases.
"""

from __future__ import annotations

import logging
import sqlite3
from pathlib import Path
from typing import Dict, List, Optional, Sequence, Tuple

from codexlens.config import Config
from codexlens.entities import SearchResult
from codexlens.storage.path_mapper import PathMapper

logger = logging.getLogger(__name__)


def _result_key(result: SearchResult) -> Tuple[str, Optional[str], Optional[int], Optional[int]]:
    return (result.path, result.symbol_name, result.start_line, result.end_line)


def _slice_content_block(content: str, start_line: Optional[int], end_line: Optional[int]) -> Optional[str]:
    if content is None:
        return None
    if start_line is None or end_line is None:
        return None
    if start_line < 1 or end_line < start_line:
        return None

    lines = content.splitlines()
    start_idx = max(0, start_line - 1)
    end_idx = min(len(lines), end_line)
    if start_idx >= len(lines):
        return None
    return "\n".join(lines[start_idx:end_idx])


class GraphExpander:
    """Expands SearchResult lists with related symbols from the code graph."""

    def __init__(self, mapper: PathMapper, *, config: Optional[Config] = None) -> None:
        self._mapper = mapper
        self._config = config
        self._logger = logging.getLogger(__name__)

    def expand(
        self,
        results: Sequence[SearchResult],
        *,
        depth: Optional[int] = None,
        max_expand: int = 10,
        max_related: int = 50,
    ) -> List[SearchResult]:
        """Expand top results with related symbols.

        Args:
            results: Base ranked results.
            depth: Maximum relationship depth to include (defaults to Config or 2).
            max_expand: Only expand the top-N base results to bound cost.
            max_related: Maximum related results to return.

        Returns:
            A list of related SearchResult objects with relationship_depth metadata.
        """
        if not results:
            return []

        configured_depth = getattr(self._config, "graph_expansion_depth", 2) if self._config else 2
        max_depth = int(depth if depth is not None else configured_depth)
        if max_depth <= 0:
            return []
        max_depth = min(max_depth, 2)

        expand_count = max(0, int(max_expand))
        related_limit = max(0, int(max_related))
        if expand_count == 0 or related_limit == 0:
            return []

        seen = {_result_key(r) for r in results}
        related_results: List[SearchResult] = []
        conn_cache: Dict[Path, sqlite3.Connection] = {}

        try:
            for base in list(results)[:expand_count]:
                if len(related_results) >= related_limit:
                    break

                if not base.symbol_name or not base.path:
                    continue

                index_path = self._mapper.source_to_index_db(Path(base.path).parent)
                conn = conn_cache.get(index_path)
                if conn is None:
                    conn = self._connect_readonly(index_path)
                    if conn is None:
                        continue
                    conn_cache[index_path] = conn

                source_ids = self._resolve_source_symbol_ids(
                    conn,
                    file_path=base.path,
                    symbol_name=base.symbol_name,
                    symbol_kind=base.symbol_kind,
                )
                if not source_ids:
                    continue

                for source_id in source_ids:
                    neighbors = self._get_neighbors(conn, source_id, max_depth=max_depth, limit=related_limit)
                    for neighbor_id, rel_depth in neighbors:
                        if len(related_results) >= related_limit:
                            break
                        row = self._get_symbol_details(conn, neighbor_id)
                        if row is None:
                            continue

                        path = str(row["full_path"])
                        symbol_name = str(row["name"])
                        symbol_kind = str(row["kind"])
                        start_line = int(row["start_line"]) if row["start_line"] is not None else None
                        end_line = int(row["end_line"]) if row["end_line"] is not None else None
                        content_block = _slice_content_block(
                            str(row["content"]) if row["content"] is not None else "",
                            start_line,
                            end_line,
                        )

                        score = float(base.score) * (0.5 ** int(rel_depth))
                        candidate = SearchResult(
                            path=path,
                            score=max(0.0, score),
                            excerpt=None,
                            content=content_block,
                            start_line=start_line,
                            end_line=end_line,
                            symbol_name=symbol_name,
                            symbol_kind=symbol_kind,
                            metadata={"relationship_depth": int(rel_depth)},
                        )

                        key = _result_key(candidate)
                        if key in seen:
                            continue
                        seen.add(key)
                        related_results.append(candidate)

        finally:
            for conn in conn_cache.values():
                try:
                    conn.close()
                except Exception:
                    pass

        return related_results

    def _connect_readonly(self, index_path: Path) -> Optional[sqlite3.Connection]:
        try:
            if not index_path.exists() or index_path.stat().st_size == 0:
                return None
        except OSError:
            return None

        try:
            conn = sqlite3.connect(f"file:{index_path}?mode=ro", uri=True, check_same_thread=False)
            conn.row_factory = sqlite3.Row
            return conn
        except Exception as exc:
            self._logger.debug("GraphExpander failed to open %s: %s", index_path, exc)
            return None

    def _resolve_source_symbol_ids(
        self,
        conn: sqlite3.Connection,
        *,
        file_path: str,
        symbol_name: str,
        symbol_kind: Optional[str],
    ) -> List[int]:
        try:
            if symbol_kind:
                rows = conn.execute(
                    """
                    SELECT s.id
                    FROM symbols s
                    JOIN files f ON f.id = s.file_id
                    WHERE f.full_path = ? AND s.name = ? AND s.kind = ?
                    """,
                    (file_path, symbol_name, symbol_kind),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT s.id
                    FROM symbols s
                    JOIN files f ON f.id = s.file_id
                    WHERE f.full_path = ? AND s.name = ?
                    """,
                    (file_path, symbol_name),
                ).fetchall()
        except sqlite3.Error:
            return []

        ids: List[int] = []
        for row in rows:
            try:
                ids.append(int(row["id"]))
            except Exception:
                continue
        return ids

    def _get_neighbors(
        self,
        conn: sqlite3.Connection,
        source_symbol_id: int,
        *,
        max_depth: int,
        limit: int,
    ) -> List[Tuple[int, int]]:
        try:
            rows = conn.execute(
                """
                SELECT neighbor_symbol_id, relationship_depth
                FROM graph_neighbors
                WHERE source_symbol_id = ? AND relationship_depth <= ?
                ORDER BY relationship_depth ASC, neighbor_symbol_id ASC
                LIMIT ?
                """,
                (int(source_symbol_id), int(max_depth), int(limit)),
            ).fetchall()
        except sqlite3.Error:
            return []

        neighbors: List[Tuple[int, int]] = []
        for row in rows:
            try:
                neighbors.append((int(row["neighbor_symbol_id"]), int(row["relationship_depth"])))
            except Exception:
                continue
        return neighbors

    def _get_symbol_details(self, conn: sqlite3.Connection, symbol_id: int) -> Optional[sqlite3.Row]:
        try:
            return conn.execute(
                """
                SELECT
                    s.id,
                    s.name,
                    s.kind,
                    s.start_line,
                    s.end_line,
                    f.full_path,
                    f.content
                FROM symbols s
                JOIN files f ON f.id = s.file_id
                WHERE s.id = ?
                """,
                (int(symbol_id),),
            ).fetchone()
        except sqlite3.Error:
            return None

