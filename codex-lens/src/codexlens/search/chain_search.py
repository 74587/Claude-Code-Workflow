"""Chain search engine for recursive multi-directory searching.

Provides parallel search across directory hierarchies using indexed _index.db files.
Supports depth-limited traversal, result aggregation, and symbol search.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict, Any
import logging
import time

from codexlens.entities import SearchResult, Symbol
from codexlens.storage.registry import RegistryStore, DirMapping
from codexlens.storage.dir_index import DirIndexStore, SubdirLink
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.sqlite_store import SQLiteStore


@dataclass
class SearchOptions:
    """Configuration options for chain search.

    Attributes:
        depth: Maximum search depth (-1 = unlimited, 0 = current dir only)
        max_workers: Number of parallel worker threads
        limit_per_dir: Maximum results per directory
        total_limit: Total result limit across all directories
        include_symbols: Whether to include symbol search results
        files_only: Return only file paths without excerpts
        include_semantic: Whether to include semantic keyword search results
    """
    depth: int = -1
    max_workers: int = 8
    limit_per_dir: int = 10
    total_limit: int = 100
    include_symbols: bool = False
    files_only: bool = False
    include_semantic: bool = False


@dataclass
class SearchStats:
    """Statistics collected during search execution.

    Attributes:
        dirs_searched: Number of directories searched
        files_matched: Number of files with matches
        time_ms: Total search time in milliseconds
        errors: List of error messages encountered
    """
    dirs_searched: int = 0
    files_matched: int = 0
    time_ms: float = 0
    errors: List[str] = field(default_factory=list)


@dataclass
class ChainSearchResult:
    """Comprehensive search result with metadata.

    Attributes:
        query: Original search query
        results: List of SearchResult objects
        symbols: List of Symbol objects (if include_symbols=True)
        stats: SearchStats with execution metrics
    """
    query: str
    results: List[SearchResult]
    symbols: List[Symbol]
    stats: SearchStats


class ChainSearchEngine:
    """Parallel chain search engine for hierarchical directory indexes.

    Searches across multiple directory indexes in parallel, following subdirectory
    links to recursively traverse the file tree. Supports depth limits, result
    aggregation, and both content and symbol searches.

    Thread-safe with configurable parallelism.

    Attributes:
        registry: Global project registry
        mapper: Path mapping utility
        logger: Python logger instance
    """

    def __init__(self,
                 registry: RegistryStore,
                 mapper: PathMapper,
                 max_workers: int = 8):
        """Initialize chain search engine.

        Args:
            registry: Global project registry for path lookups
            mapper: Path mapper for source/index conversions
            max_workers: Maximum parallel workers (default 8)
        """
        self.registry = registry
        self.mapper = mapper
        self.logger = logging.getLogger(__name__)
        self._max_workers = max_workers
        self._executor: Optional[ThreadPoolExecutor] = None

    def _get_executor(self, max_workers: Optional[int] = None) -> ThreadPoolExecutor:
        """Get or create the shared thread pool executor.

        Lazy initialization to avoid creating executor if never used.

        Args:
            max_workers: Override default max_workers if specified

        Returns:
            ThreadPoolExecutor instance
        """
        workers = max_workers or self._max_workers
        if self._executor is None:
            self._executor = ThreadPoolExecutor(max_workers=workers)
        return self._executor

    def close(self) -> None:
        """Shutdown the thread pool executor."""
        if self._executor is not None:
            self._executor.shutdown(wait=True)
            self._executor = None

    def __enter__(self) -> "ChainSearchEngine":
        """Context manager entry."""
        return self

    def __exit__(self, exc_type: object, exc: object, tb: object) -> None:
        """Context manager exit."""
        self.close()

    def search(self, query: str,
               source_path: Path,
               options: Optional[SearchOptions] = None) -> ChainSearchResult:
        """Execute chain search from source_path with recursive traversal.

        Process:
        1. Locate starting index for source_path
        2. Collect all child indexes based on depth limit
        3. Search indexes in parallel using ThreadPoolExecutor
        4. Aggregate, deduplicate, and rank results

        Args:
            query: FTS5 search query string
            source_path: Starting directory path
            options: Search configuration (uses defaults if None)

        Returns:
            ChainSearchResult with results, symbols, and statistics

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper)
            >>> result = engine.search("authentication", Path("D:/project/src"))
            >>> for r in result.results[:5]:
            ...     print(f"{r.path}: {r.score:.2f}")
        """
        options = options or SearchOptions()
        start_time = time.time()
        stats = SearchStats()

        # Step 1: Find starting index
        start_index = self._find_start_index(source_path)
        if not start_index:
            self.logger.warning(f"No index found for {source_path}")
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # Step 2: Collect all index paths to search
        index_paths = self._collect_index_paths(start_index, options.depth)
        stats.dirs_searched = len(index_paths)

        if not index_paths:
            self.logger.warning(f"No indexes collected from {start_index}")
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # Step 3: Parallel search
        results, search_stats = self._search_parallel(
            index_paths, query, options
        )
        stats.errors = search_stats.errors

        # Step 4: Merge and rank
        final_results = self._merge_and_rank(results, options.total_limit)
        stats.files_matched = len(final_results)

        # Optional: Symbol search
        symbols = []
        if options.include_symbols:
            symbols = self._search_symbols_parallel(
                index_paths, query, None, options.total_limit
            )

        stats.time_ms = (time.time() - start_time) * 1000

        return ChainSearchResult(
            query=query,
            results=final_results,
            symbols=symbols,
            stats=stats
        )

    def search_files_only(self, query: str,
                          source_path: Path,
                          options: Optional[SearchOptions] = None) -> List[str]:
        """Search and return only matching file paths.

        Faster than full search when excerpts are not needed.

        Args:
            query: FTS5 search query string
            source_path: Starting directory path
            options: Search configuration (uses defaults if None)

        Returns:
            List of file paths as strings

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper)
            >>> paths = engine.search_files_only("TODO", Path("D:/project"))
            >>> print(f"Found {len(paths)} files with TODOs")
        """
        options = options or SearchOptions()
        options.files_only = True

        result = self.search(query, source_path, options)
        return [r.path for r in result.results]

    def search_symbols(self, name: str,
                       source_path: Path,
                       kind: Optional[str] = None,
                       options: Optional[SearchOptions] = None) -> List[Symbol]:
        """Chain symbol search across directory hierarchy.

        Args:
            name: Symbol name pattern (partial match supported)
            source_path: Starting directory path
            kind: Optional symbol kind filter (e.g., 'function', 'class')
            options: Search configuration (uses defaults if None)

        Returns:
            List of Symbol objects sorted by name

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper)
            >>> funcs = engine.search_symbols("init", Path("D:/project"), kind="function")
            >>> for sym in funcs[:10]:
            ...     print(f"{sym.name} ({sym.kind}): lines {sym.range}")
        """
        options = options or SearchOptions()

        start_index = self._find_start_index(source_path)
        if not start_index:
            self.logger.warning(f"No index found for {source_path}")
            return []

        index_paths = self._collect_index_paths(start_index, options.depth)
        if not index_paths:
            return []

        return self._search_symbols_parallel(
            index_paths, name, kind, options.total_limit
        )

    def search_callers(self, target_symbol: str,
                       source_path: Path,
                       options: Optional[SearchOptions] = None) -> List[Dict[str, Any]]:
        """Find all callers of a given symbol across directory hierarchy.

        Args:
            target_symbol: Name of the symbol to find callers for
            source_path: Starting directory path
            options: Search configuration (uses defaults if None)

        Returns:
            List of relationship dicts with caller information

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper)
            >>> callers = engine.search_callers("my_function", Path("D:/project"))
            >>> for caller in callers:
            ...     print(f"{caller['source_symbol']} in {caller['source_file']}:{caller['source_line']}")
        """
        options = options or SearchOptions()

        start_index = self._find_start_index(source_path)
        if not start_index:
            self.logger.warning(f"No index found for {source_path}")
            return []

        index_paths = self._collect_index_paths(start_index, options.depth)
        if not index_paths:
            return []

        return self._search_callers_parallel(
            index_paths, target_symbol, options.total_limit
        )

    def search_callees(self, source_symbol: str,
                       source_path: Path,
                       options: Optional[SearchOptions] = None) -> List[Dict[str, Any]]:
        """Find all callees (what a symbol calls) across directory hierarchy.

        Args:
            source_symbol: Name of the symbol to find callees for
            source_path: Starting directory path
            options: Search configuration (uses defaults if None)

        Returns:
            List of relationship dicts with callee information

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper)
            >>> callees = engine.search_callees("MyClass.method", Path("D:/project"))
            >>> for callee in callees:
            ...     print(f"Calls {callee['target_symbol']} at line {callee['source_line']}")
        """
        options = options or SearchOptions()

        start_index = self._find_start_index(source_path)
        if not start_index:
            self.logger.warning(f"No index found for {source_path}")
            return []

        index_paths = self._collect_index_paths(start_index, options.depth)
        if not index_paths:
            return []

        return self._search_callees_parallel(
            index_paths, source_symbol, options.total_limit
        )

    def search_inheritance(self, class_name: str,
                           source_path: Path,
                           options: Optional[SearchOptions] = None) -> List[Dict[str, Any]]:
        """Find inheritance relationships for a class across directory hierarchy.

        Args:
            class_name: Name of the class to find inheritance for
            source_path: Starting directory path
            options: Search configuration (uses defaults if None)

        Returns:
            List of relationship dicts with inheritance information

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper)
            >>> inheritance = engine.search_inheritance("BaseClass", Path("D:/project"))
            >>> for rel in inheritance:
            ...     print(f"{rel['source_symbol']} extends {rel['target_symbol']}")
        """
        options = options or SearchOptions()

        start_index = self._find_start_index(source_path)
        if not start_index:
            self.logger.warning(f"No index found for {source_path}")
            return []

        index_paths = self._collect_index_paths(start_index, options.depth)
        if not index_paths:
            return []

        return self._search_inheritance_parallel(
            index_paths, class_name, options.total_limit
        )

    # === Internal Methods ===

    def _find_start_index(self, source_path: Path) -> Optional[Path]:
        """Find index database path for source directory.

        Attempts exact match first, then searches for nearest ancestor index.

        Args:
            source_path: Source directory path

        Returns:
            Path to _index.db file, or None if not found
        """
        source_path = source_path.resolve()

        # Try exact match first
        exact_index = self.mapper.source_to_index_db(source_path)
        if exact_index.exists():
            self.logger.debug(f"Found exact index: {exact_index}")
            return exact_index

        # Try nearest ancestor via registry
        nearest = self.registry.find_nearest_index(source_path)
        if nearest:
            self.logger.debug(f"Found nearest index: {nearest.index_path}")
            return nearest.index_path

        self.logger.warning(f"No index found for {source_path}")
        return None

    def _collect_index_paths(self, start_index: Path,
                              depth: int) -> List[Path]:
        """Recursively collect all subdirectory index paths.

        Traverses directory tree via subdirs table in each _index.db,
        respecting depth limit.

        Args:
            start_index: Starting _index.db path
            depth: Maximum depth (-1 = unlimited, 0 = current only)

        Returns:
            List of _index.db paths to search
        """
        collected = []
        visited = set()

        def _collect_recursive(index_path: Path, current_depth: int):
            # Normalize path to avoid duplicates
            normalized = index_path.resolve()
            if normalized in visited:
                return
            visited.add(normalized)

            # Add current index
            if normalized.exists():
                collected.append(normalized)
            else:
                self.logger.debug(f"Index does not exist: {normalized}")
                return

            # Check depth limit
            if depth >= 0 and current_depth >= depth:
                return

            # Read subdirs and recurse
            try:
                with DirIndexStore(normalized) as store:
                    subdirs = store.get_subdirs()
                    for subdir in subdirs:
                        _collect_recursive(subdir.index_path, current_depth + 1)
            except Exception as exc:
                self.logger.warning(f"Failed to read subdirs from {normalized}: {exc}")

        _collect_recursive(start_index, 0)
        self.logger.info(f"Collected {len(collected)} indexes (depth={depth})")
        return collected

    def _search_parallel(self, index_paths: List[Path],
                          query: str,
                          options: SearchOptions) -> tuple[List[SearchResult], SearchStats]:
        """Search multiple indexes in parallel using shared ThreadPoolExecutor.

        Args:
            index_paths: List of _index.db paths to search
            query: FTS5 query string
            options: Search configuration

        Returns:
            Tuple of (all results, search statistics)
        """
        all_results = []
        stats = SearchStats()

        executor = self._get_executor(options.max_workers)
        # Submit all search tasks
        future_to_path = {
            executor.submit(
                self._search_single_index,
                idx_path,
                query,
                options.limit_per_dir,
                options.files_only,
                options.include_semantic
            ): idx_path
            for idx_path in index_paths
        }

        # Collect results as they complete
        for future in as_completed(future_to_path):
            idx_path = future_to_path[future]
            try:
                results = future.result()
                all_results.extend(results)
                self.logger.debug(f"Got {len(results)} results from {idx_path.parent.name}")
            except Exception as exc:
                error_msg = f"Search failed for {idx_path}: {exc}"
                self.logger.error(error_msg)
                stats.errors.append(error_msg)

        return all_results, stats

    def _search_single_index(self, index_path: Path,
                              query: str,
                              limit: int,
                              files_only: bool = False,
                              include_semantic: bool = False) -> List[SearchResult]:
        """Search a single index database.

        Handles exceptions gracefully, returning empty list on failure.

        Args:
            index_path: Path to _index.db file
            query: FTS5 query string
            limit: Maximum results from this index
            files_only: If True, skip snippet generation for faster search
            include_semantic: If True, also search semantic keywords and merge results

        Returns:
            List of SearchResult objects (empty on error)
        """
        try:
            with DirIndexStore(index_path) as store:
                # Get FTS results
                if files_only:
                    # Fast path: return paths only without snippets
                    paths = store.search_files_only(query, limit=limit)
                    fts_results = [SearchResult(path=p, score=0.0, excerpt="") for p in paths]
                else:
                    fts_results = store.search_fts(query, limit=limit)
                
                # Optionally add semantic keyword results
                if include_semantic:
                    try:
                        semantic_matches = store.search_semantic_keywords(query)
                        # Convert semantic matches to SearchResult with 0.8x weight
                        for file_entry, keywords in semantic_matches:
                            # Create excerpt from keywords
                            excerpt = f"Keywords: {', '.join(keywords[:5])}"
                            # Use a base score of 10.0 for semantic matches, weighted by 0.8
                            semantic_result = SearchResult(
                                path=str(file_entry.full_path),
                                score=10.0 * 0.8,
                                excerpt=excerpt
                            )
                            fts_results.append(semantic_result)
                    except Exception as sem_exc:
                        self.logger.debug(f"Semantic search error in {index_path}: {sem_exc}")
                
                return fts_results
        except Exception as exc:
            self.logger.debug(f"Search error in {index_path}: {exc}")
            return []

    def _merge_and_rank(self, results: List[SearchResult],
                         limit: int) -> List[SearchResult]:
        """Aggregate, deduplicate, and rank results.

        Process:
        1. Deduplicate by path (keep highest score)
        2. Sort by score descending
        3. Limit to requested count

        Args:
            results: Raw results from all indexes
            limit: Maximum results to return

        Returns:
            Deduplicated and ranked results
        """
        # Deduplicate by path, keeping best score
        path_to_result: Dict[str, SearchResult] = {}
        for result in results:
            path = result.path
            if path not in path_to_result or result.score > path_to_result[path].score:
                path_to_result[path] = result

        # Sort by score descending
        unique_results = list(path_to_result.values())
        unique_results.sort(key=lambda r: r.score, reverse=True)

        # Apply limit
        return unique_results[:limit]

    def _search_symbols_parallel(self, index_paths: List[Path],
                                  name: str,
                                  kind: Optional[str],
                                  limit: int) -> List[Symbol]:
        """Search symbols across multiple indexes in parallel.

        Args:
            index_paths: List of _index.db paths to search
            name: Symbol name pattern
            kind: Optional symbol kind filter
            limit: Total symbol limit

        Returns:
            Deduplicated and sorted symbols
        """
        all_symbols = []

        executor = self._get_executor()
        # Submit all symbol search tasks
        future_to_path = {
            executor.submit(
                self._search_symbols_single,
                idx_path,
                name,
                kind
            ): idx_path
            for idx_path in index_paths
        }

        # Collect results
        for future in as_completed(future_to_path):
            try:
                symbols = future.result()
                all_symbols.extend(symbols)
            except Exception as exc:
                self.logger.error(f"Symbol search failed: {exc}")

        # Deduplicate by (name, kind, range)
        seen = set()
        unique_symbols = []
        for sym in all_symbols:
            key = (sym.name, sym.kind, sym.range)
            if key not in seen:
                seen.add(key)
                unique_symbols.append(sym)

        # Sort by name
        unique_symbols.sort(key=lambda s: s.name)

        return unique_symbols[:limit]

    def _search_symbols_single(self, index_path: Path,
                                name: str,
                                kind: Optional[str]) -> List[Symbol]:
        """Search symbols in a single index.

        Args:
            index_path: Path to _index.db file
            name: Symbol name pattern
            kind: Optional symbol kind filter

        Returns:
            List of Symbol objects (empty on error)
        """
        try:
            with DirIndexStore(index_path) as store:
                return store.search_symbols(name, kind=kind)
        except Exception as exc:
            self.logger.debug(f"Symbol search error in {index_path}: {exc}")
            return []

    def _search_callers_parallel(self, index_paths: List[Path],
                                  target_symbol: str,
                                  limit: int) -> List[Dict[str, Any]]:
        """Search for callers across multiple indexes in parallel.

        Args:
            index_paths: List of _index.db paths to search
            target_symbol: Target symbol name
            limit: Total result limit

        Returns:
            Deduplicated list of caller relationships
        """
        all_callers = []

        executor = self._get_executor()
        future_to_path = {
            executor.submit(
                self._search_callers_single,
                idx_path,
                target_symbol
            ): idx_path
            for idx_path in index_paths
        }

        for future in as_completed(future_to_path):
            try:
                callers = future.result()
                all_callers.extend(callers)
            except Exception as exc:
                self.logger.error(f"Caller search failed: {exc}")

        # Deduplicate by (source_file, source_line)
        seen = set()
        unique_callers = []
        for caller in all_callers:
            key = (caller.get("source_file"), caller.get("source_line"))
            if key not in seen:
                seen.add(key)
                unique_callers.append(caller)

        # Sort by source file and line
        unique_callers.sort(key=lambda c: (c.get("source_file", ""), c.get("source_line", 0)))

        return unique_callers[:limit]

    def _search_callers_single(self, index_path: Path,
                                target_symbol: str) -> List[Dict[str, Any]]:
        """Search for callers in a single index.

        Args:
            index_path: Path to _index.db file
            target_symbol: Target symbol name

        Returns:
            List of caller relationship dicts (empty on error)
        """
        try:
            with SQLiteStore(index_path) as store:
                return store.query_relationships_by_target(target_symbol)
        except Exception as exc:
            self.logger.debug(f"Caller search error in {index_path}: {exc}")
            return []

    def _search_callees_parallel(self, index_paths: List[Path],
                                  source_symbol: str,
                                  limit: int) -> List[Dict[str, Any]]:
        """Search for callees across multiple indexes in parallel.

        Args:
            index_paths: List of _index.db paths to search
            source_symbol: Source symbol name
            limit: Total result limit

        Returns:
            Deduplicated list of callee relationships
        """
        all_callees = []

        executor = self._get_executor()
        future_to_path = {
            executor.submit(
                self._search_callees_single,
                idx_path,
                source_symbol
            ): idx_path
            for idx_path in index_paths
        }

        for future in as_completed(future_to_path):
            try:
                callees = future.result()
                all_callees.extend(callees)
            except Exception as exc:
                self.logger.error(f"Callee search failed: {exc}")

        # Deduplicate by (target_symbol, source_line)
        seen = set()
        unique_callees = []
        for callee in all_callees:
            key = (callee.get("target_symbol"), callee.get("source_line"))
            if key not in seen:
                seen.add(key)
                unique_callees.append(callee)

        # Sort by source line
        unique_callees.sort(key=lambda c: c.get("source_line", 0))

        return unique_callees[:limit]

    def _search_callees_single(self, index_path: Path,
                                source_symbol: str) -> List[Dict[str, Any]]:
        """Search for callees in a single index.

        Args:
            index_path: Path to _index.db file
            source_symbol: Source symbol name

        Returns:
            List of callee relationship dicts (empty on error)
        """
        try:
            with SQLiteStore(index_path) as store:
                # Single JOIN query to get all callees (fixes N+1 query problem)
                # Uses public execute_query API instead of _get_connection bypass
                rows = store.execute_query(
                    """
                    SELECT
                        s.name AS source_symbol,
                        r.target_qualified_name AS target_symbol,
                        r.relationship_type,
                        r.source_line,
                        f.path AS source_file,
                        r.target_file
                    FROM code_relationships r
                    JOIN symbols s ON r.source_symbol_id = s.id
                    JOIN files f ON s.file_id = f.id
                    WHERE s.name = ? AND r.relationship_type = 'call'
                    ORDER BY f.path, r.source_line
                    LIMIT 100
                    """,
                    (source_symbol,)
                )

                return [
                    {
                        "source_symbol": row["source_symbol"],
                        "target_symbol": row["target_symbol"],
                        "relationship_type": row["relationship_type"],
                        "source_line": row["source_line"],
                        "source_file": row["source_file"],
                        "target_file": row["target_file"],
                    }
                    for row in rows
                ]
        except Exception as exc:
            self.logger.debug(f"Callee search error in {index_path}: {exc}")
            return []

    def _search_inheritance_parallel(self, index_paths: List[Path],
                                      class_name: str,
                                      limit: int) -> List[Dict[str, Any]]:
        """Search for inheritance relationships across multiple indexes in parallel.

        Args:
            index_paths: List of _index.db paths to search
            class_name: Class name to search for
            limit: Total result limit

        Returns:
            Deduplicated list of inheritance relationships
        """
        all_inheritance = []

        executor = self._get_executor()
        future_to_path = {
            executor.submit(
                self._search_inheritance_single,
                idx_path,
                class_name
            ): idx_path
            for idx_path in index_paths
        }

        for future in as_completed(future_to_path):
            try:
                inheritance = future.result()
                all_inheritance.extend(inheritance)
            except Exception as exc:
                self.logger.error(f"Inheritance search failed: {exc}")

        # Deduplicate by (source_symbol, target_symbol)
        seen = set()
        unique_inheritance = []
        for rel in all_inheritance:
            key = (rel.get("source_symbol"), rel.get("target_symbol"))
            if key not in seen:
                seen.add(key)
                unique_inheritance.append(rel)

        # Sort by source file
        unique_inheritance.sort(key=lambda r: r.get("source_file", ""))

        return unique_inheritance[:limit]

    def _search_inheritance_single(self, index_path: Path,
                                    class_name: str) -> List[Dict[str, Any]]:
        """Search for inheritance relationships in a single index.

        Args:
            index_path: Path to _index.db file
            class_name: Class name to search for

        Returns:
            List of inheritance relationship dicts (empty on error)
        """
        try:
            with SQLiteStore(index_path) as store:
                # Use UNION to find relationships where class is either:
                # 1. The base class (target) - find derived classes
                # 2. The derived class (source) - find parent classes
                # Uses public execute_query API instead of _get_connection bypass
                rows = store.execute_query(
                    """
                    SELECT
                        s.name AS source_symbol,
                        r.target_qualified_name,
                        r.relationship_type,
                        r.source_line,
                        f.path AS source_file,
                        r.target_file
                    FROM code_relationships r
                    JOIN symbols s ON r.source_symbol_id = s.id
                    JOIN files f ON s.file_id = f.id
                    WHERE r.target_qualified_name = ? AND r.relationship_type = 'inherits'
                    UNION
                    SELECT
                        s.name AS source_symbol,
                        r.target_qualified_name,
                        r.relationship_type,
                        r.source_line,
                        f.path AS source_file,
                        r.target_file
                    FROM code_relationships r
                    JOIN symbols s ON r.source_symbol_id = s.id
                    JOIN files f ON s.file_id = f.id
                    WHERE s.name = ? AND r.relationship_type = 'inherits'
                    LIMIT 100
                    """,
                    (class_name, class_name)
                )

                return [
                    {
                        "source_symbol": row["source_symbol"],
                        "target_symbol": row["target_qualified_name"],
                        "relationship_type": row["relationship_type"],
                        "source_line": row["source_line"],
                        "source_file": row["source_file"],
                        "target_file": row["target_file"],
                    }
                    for row in rows
                ]
        except Exception as exc:
            self.logger.debug(f"Inheritance search error in {index_path}: {exc}")
            return []


# === Convenience Functions ===

def quick_search(query: str,
                 source_path: Path,
                 depth: int = -1) -> List[SearchResult]:
    """Quick search convenience function with automatic initialization.

    Creates temporary registry and mapper instances for one-off searches.
    For repeated searches, create a ChainSearchEngine instance directly.

    Args:
        query: FTS5 search query string
        source_path: Starting directory path
        depth: Maximum search depth (-1 = unlimited)

    Returns:
        List of SearchResult objects sorted by relevance

    Examples:
        >>> from pathlib import Path
        >>> results = quick_search("authentication", Path("D:/project/src"))
        >>> print(f"Found {len(results)} matches")
    """
    registry = RegistryStore()
    registry.initialize()

    mapper = PathMapper()

    engine = ChainSearchEngine(registry, mapper)
    options = SearchOptions(depth=depth)

    result = engine.search(query, source_path, options)

    registry.close()

    return result.results
