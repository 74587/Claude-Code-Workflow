"""Chain search engine for recursive multi-directory searching.

Provides parallel search across directory hierarchies using indexed _index.db files.
Supports depth-limited traversal, result aggregation, and symbol search.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Dict, Any, Literal, Tuple, TYPE_CHECKING
import logging
import os
import time

from codexlens.entities import SearchResult, Symbol

if TYPE_CHECKING:
    import numpy as np

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False
from codexlens.config import Config
from codexlens.storage.registry import RegistryStore, DirMapping
from codexlens.storage.dir_index import DirIndexStore, SubdirLink
from codexlens.storage.global_index import GlobalSymbolIndex
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.sqlite_store import SQLiteStore
from codexlens.search.hybrid_search import HybridSearchEngine


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
        hybrid_mode: Enable hybrid search with RRF fusion (default False)
        enable_fuzzy: Enable fuzzy FTS in hybrid mode (default True)
        enable_vector: Enable vector semantic search (default False)
        pure_vector: If True, only use vector search without FTS fallback (default False)
        hybrid_weights: Custom RRF weights for hybrid search (optional)
        group_results: Enable grouping of similar results (default False)
        grouping_threshold: Score threshold for grouping similar results (default 0.01)
    """
    depth: int = -1
    max_workers: int = 8
    limit_per_dir: int = 10
    total_limit: int = 100
    include_symbols: bool = False
    files_only: bool = False
    include_semantic: bool = False
    hybrid_mode: bool = False
    enable_fuzzy: bool = True
    enable_vector: bool = False
    pure_vector: bool = False
    hybrid_weights: Optional[Dict[str, float]] = None
    group_results: bool = False
    grouping_threshold: float = 0.01


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
        related_results: Expanded results from graph neighbors (optional)
        symbols: List of Symbol objects (if include_symbols=True)
        stats: SearchStats with execution metrics
    """
    query: str
    results: List[SearchResult]
    symbols: List[Symbol]
    stats: SearchStats
    related_results: List[SearchResult] = field(default_factory=list)


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
                 max_workers: int = 8,
                 config: Config | None = None):
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
        self._config = config

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

        # Step 5: Optional grouping of similar results
        if options.group_results:
            from codexlens.search.ranking import group_similar_results
            final_results = group_similar_results(
                final_results, score_threshold_abs=options.grouping_threshold
            )

        stats.files_matched = len(final_results)

        # Optional: Symbol search
        symbols = []
        if options.include_symbols:
            symbols = self._search_symbols_parallel(
                index_paths, query, None, options.total_limit
            )

        # Optional: graph expansion using precomputed neighbors
        related_results: List[SearchResult] = []
        if self._config is not None and getattr(self._config, "enable_graph_expansion", False):
            try:
                from codexlens.search.enrichment import SearchEnrichmentPipeline

                pipeline = SearchEnrichmentPipeline(self.mapper, config=self._config)
                related_results = pipeline.expand_related_results(final_results)
            except Exception as exc:
                self.logger.debug("Graph expansion failed: %s", exc)
                related_results = []

        stats.time_ms = (time.time() - start_time) * 1000

        return ChainSearchResult(
            query=query,
            results=final_results,
            symbols=symbols,
            stats=stats,
            related_results=related_results,
        )

    def hybrid_cascade_search(
        self,
        query: str,
        source_path: Path,
        k: int = 10,
        coarse_k: int = 100,
        options: Optional[SearchOptions] = None,
    ) -> ChainSearchResult:
        """Execute two-stage cascade search with hybrid coarse retrieval and cross-encoder reranking.

        Hybrid cascade search process:
        1. Stage 1 (Coarse): Fast retrieval using RRF fusion of FTS + SPLADE + Vector
           to get coarse_k candidates
        2. Stage 2 (Fine): CrossEncoder reranking of candidates to get final k results

        This approach balances recall (from broad coarse search) with precision
        (from expensive but accurate cross-encoder scoring).

        Note: This method is the original hybrid approach. For binary vector cascade,
        use binary_cascade_search() instead.

        Args:
            query: Natural language or keyword query string
            source_path: Starting directory path
            k: Number of final results to return (default 10)
            coarse_k: Number of coarse candidates from first stage (default 100)
            options: Search configuration (uses defaults if None)

        Returns:
            ChainSearchResult with reranked results and statistics

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper, config=config)
            >>> result = engine.hybrid_cascade_search(
            ...     "how to authenticate users",
            ...     Path("D:/project/src"),
            ...     k=10,
            ...     coarse_k=100
            ... )
            >>> for r in result.results:
            ...     print(f"{r.path}: {r.score:.3f}")
        """
        options = options or SearchOptions()
        start_time = time.time()
        stats = SearchStats()

        # Use config defaults if available
        if self._config is not None:
            if hasattr(self._config, "cascade_coarse_k"):
                coarse_k = coarse_k or self._config.cascade_coarse_k
            if hasattr(self._config, "cascade_fine_k"):
                k = k or self._config.cascade_fine_k

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

        # Step 2: Collect all index paths
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

        # Stage 1: Coarse retrieval with hybrid search (FTS + SPLADE + Vector)
        # Use hybrid mode for multi-signal retrieval
        coarse_options = SearchOptions(
            depth=options.depth,
            max_workers=1,  # Single thread for GPU safety
            limit_per_dir=max(coarse_k // len(index_paths), 20),
            total_limit=coarse_k,
            hybrid_mode=True,
            enable_fuzzy=options.enable_fuzzy,
            enable_vector=True,  # Enable vector for semantic matching
            pure_vector=False,
            hybrid_weights=options.hybrid_weights,
        )

        self.logger.debug(
            "Cascade Stage 1: Coarse retrieval for %d candidates", coarse_k
        )
        coarse_results, search_stats = self._search_parallel(
            index_paths, query, coarse_options
        )
        stats.errors = search_stats.errors

        # Merge and deduplicate coarse results
        coarse_merged = self._merge_and_rank(coarse_results, coarse_k)
        self.logger.debug(
            "Cascade Stage 1 complete: %d candidates retrieved", len(coarse_merged)
        )

        if not coarse_merged:
            stats.time_ms = (time.time() - start_time) * 1000
            return ChainSearchResult(
                query=query,
                results=[],
                symbols=[],
                stats=stats
            )

        # Stage 2: Cross-encoder reranking
        self.logger.debug(
            "Cascade Stage 2: Cross-encoder reranking %d candidates to top-%d",
            len(coarse_merged),
            k,
        )

        final_results = self._cross_encoder_rerank(query, coarse_merged, k)

        # Optional: grouping of similar results
        if options.group_results:
            from codexlens.search.ranking import group_similar_results
            final_results = group_similar_results(
                final_results, score_threshold_abs=options.grouping_threshold
            )

        stats.files_matched = len(final_results)
        stats.time_ms = (time.time() - start_time) * 1000

        self.logger.debug(
            "Cascade search complete: %d results in %.2fms",
            len(final_results),
            stats.time_ms,
        )

        return ChainSearchResult(
            query=query,
            results=final_results,
            symbols=[],
            stats=stats,
        )

    def binary_cascade_search(
        self,
        query: str,
        source_path: Path,
        k: int = 10,
        coarse_k: int = 100,
        options: Optional[SearchOptions] = None,
    ) -> ChainSearchResult:
        """Execute binary cascade search with binary coarse ranking and dense fine ranking.

        Binary cascade search process:
        1. Stage 1 (Coarse): Fast binary vector search using Hamming distance
           to quickly filter to coarse_k candidates (256-dim binary, 32 bytes/vector)
        2. Stage 2 (Fine): Dense vector cosine similarity for precise reranking
           of candidates (2048-dim float32)

        This approach leverages the speed of binary search (~100x faster) while
        maintaining precision through dense vector reranking.

        Performance characteristics:
        - Binary search: O(N) with SIMD-accelerated XOR + popcount
        - Dense rerank: Only applied to top coarse_k candidates
        - Memory: 32 bytes (binary) + 8KB (dense) per chunk

        Args:
            query: Natural language or keyword query string
            source_path: Starting directory path
            k: Number of final results to return (default 10)
            coarse_k: Number of coarse candidates from first stage (default 100)
            options: Search configuration (uses defaults if None)

        Returns:
            ChainSearchResult with reranked results and statistics

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper, config=config)
            >>> result = engine.binary_cascade_search(
            ...     "how to authenticate users",
            ...     Path("D:/project/src"),
            ...     k=10,
            ...     coarse_k=100
            ... )
            >>> for r in result.results:
            ...     print(f"{r.path}: {r.score:.3f}")
        """
        if not NUMPY_AVAILABLE:
            self.logger.warning(
                "NumPy not available, falling back to hybrid cascade search"
            )
            return self.hybrid_cascade_search(query, source_path, k, coarse_k, options)

        options = options or SearchOptions()
        start_time = time.time()
        stats = SearchStats()

        # Use config defaults if available
        if self._config is not None:
            if hasattr(self._config, "cascade_coarse_k"):
                coarse_k = coarse_k or self._config.cascade_coarse_k
            if hasattr(self._config, "cascade_fine_k"):
                k = k or self._config.cascade_fine_k

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

        # Step 2: Collect all index paths
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

        # Initialize embedding backends
        try:
            from codexlens.indexing.embedding import (
                BinaryEmbeddingBackend,
                DenseEmbeddingBackend,
            )
            from codexlens.semantic.ann_index import BinaryANNIndex
        except ImportError as exc:
            self.logger.warning(
                "Binary cascade dependencies not available: %s. "
                "Falling back to hybrid cascade search.",
                exc
            )
            return self.hybrid_cascade_search(query, source_path, k, coarse_k, options)

        # Stage 1: Binary vector coarse retrieval
        self.logger.debug(
            "Binary Cascade Stage 1: Binary coarse retrieval for %d candidates",
            coarse_k,
        )

        use_gpu = True
        if self._config is not None:
            use_gpu = getattr(self._config, "embedding_use_gpu", True)

        try:
            binary_backend = BinaryEmbeddingBackend(use_gpu=use_gpu)
            query_binary_packed = binary_backend.embed_packed([query])[0]
        except Exception as exc:
            self.logger.warning(
                "Failed to generate binary query embedding: %s. "
                "Falling back to hybrid cascade search.",
                exc
            )
            return self.hybrid_cascade_search(query, source_path, k, coarse_k, options)

        # Search all indexes for binary candidates
        all_candidates: List[Tuple[int, int, Path]] = []  # (chunk_id, distance, index_path)

        for index_path in index_paths:
            try:
                # Get or create binary index for this path
                binary_index = self._get_or_create_binary_index(index_path)
                if binary_index is None or binary_index.count() == 0:
                    continue

                # Search binary index
                ids, distances = binary_index.search(query_binary_packed, coarse_k)
                for chunk_id, dist in zip(ids, distances):
                    all_candidates.append((chunk_id, dist, index_path))

            except Exception as exc:
                self.logger.debug(
                    "Binary search failed for %s: %s", index_path, exc
                )
                stats.errors.append(f"Binary search failed for {index_path}: {exc}")

        if not all_candidates:
            self.logger.debug("No binary candidates found, falling back to hybrid")
            return self.hybrid_cascade_search(query, source_path, k, coarse_k, options)

        # Sort by Hamming distance and take top coarse_k
        all_candidates.sort(key=lambda x: x[1])
        coarse_candidates = all_candidates[:coarse_k]

        self.logger.debug(
            "Binary Cascade Stage 1 complete: %d candidates retrieved",
            len(coarse_candidates),
        )

        # Stage 2: Dense vector fine ranking
        self.logger.debug(
            "Binary Cascade Stage 2: Dense reranking %d candidates to top-%d",
            len(coarse_candidates),
            k,
        )

        try:
            dense_backend = DenseEmbeddingBackend(use_gpu=use_gpu)
            query_dense = dense_backend.embed_to_numpy([query])[0]
        except Exception as exc:
            self.logger.warning(
                "Failed to generate dense query embedding: %s. "
                "Using Hamming distance scores only.",
                exc
            )
            # Fall back to using Hamming distance as score
            return self._build_results_from_candidates(
                coarse_candidates[:k], index_paths, stats, query, start_time
            )

        # Group candidates by index path for batch retrieval
        candidates_by_index: Dict[Path, List[int]] = {}
        for chunk_id, _, index_path in coarse_candidates:
            if index_path not in candidates_by_index:
                candidates_by_index[index_path] = []
            candidates_by_index[index_path].append(chunk_id)

        # Retrieve dense embeddings and compute cosine similarity
        scored_results: List[Tuple[float, SearchResult]] = []

        for index_path, chunk_ids in candidates_by_index.items():
            try:
                store = SQLiteStore(index_path)
                dense_embeddings = store.get_dense_embeddings(chunk_ids)
                chunks_data = store.get_chunks_by_ids(chunk_ids)

                # Create lookup for chunk content
                chunk_content: Dict[int, Dict[str, Any]] = {
                    c["id"]: c for c in chunks_data
                }

                for chunk_id in chunk_ids:
                    dense_bytes = dense_embeddings.get(chunk_id)
                    chunk_info = chunk_content.get(chunk_id)

                    if dense_bytes is None or chunk_info is None:
                        continue

                    # Compute cosine similarity
                    dense_vec = np.frombuffer(dense_bytes, dtype=np.float32)
                    score = self._compute_cosine_similarity(query_dense, dense_vec)

                    # Create search result
                    excerpt = chunk_info.get("content", "")[:500]
                    result = SearchResult(
                        path=chunk_info.get("file_path", ""),
                        score=float(score),
                        excerpt=excerpt,
                    )
                    scored_results.append((score, result))

            except Exception as exc:
                self.logger.debug(
                    "Dense reranking failed for %s: %s", index_path, exc
                )
                stats.errors.append(f"Dense reranking failed for {index_path}: {exc}")

        # Sort by score descending and deduplicate by path
        scored_results.sort(key=lambda x: x[0], reverse=True)

        path_to_result: Dict[str, SearchResult] = {}
        for score, result in scored_results:
            if result.path not in path_to_result:
                path_to_result[result.path] = result

        final_results = list(path_to_result.values())[:k]

        # Optional: grouping of similar results
        if options.group_results:
            from codexlens.search.ranking import group_similar_results
            final_results = group_similar_results(
                final_results, score_threshold_abs=options.grouping_threshold
            )

        stats.files_matched = len(final_results)
        stats.time_ms = (time.time() - start_time) * 1000

        self.logger.debug(
            "Binary cascade search complete: %d results in %.2fms",
            len(final_results),
            stats.time_ms,
        )

        return ChainSearchResult(
            query=query,
            results=final_results,
            symbols=[],
            stats=stats,
        )

    def cascade_search(
        self,
        query: str,
        source_path: Path,
        k: int = 10,
        coarse_k: int = 100,
        options: Optional[SearchOptions] = None,
        strategy: Literal["binary", "hybrid"] = "binary",
    ) -> ChainSearchResult:
        """Unified cascade search entry point with strategy selection.

        Provides a single interface for cascade search with configurable strategy:
        - "binary": Uses binary vector coarse ranking + dense fine ranking (faster)
        - "hybrid": Uses FTS+SPLADE+Vector coarse ranking + cross-encoder reranking (original)

        The strategy can be configured via:
        1. The `strategy` parameter (highest priority)
        2. Config `cascade_strategy` setting
        3. Default: "binary"

        Args:
            query: Natural language or keyword query string
            source_path: Starting directory path
            k: Number of final results to return (default 10)
            coarse_k: Number of coarse candidates from first stage (default 100)
            options: Search configuration (uses defaults if None)
            strategy: Cascade strategy - "binary" or "hybrid" (default "binary")

        Returns:
            ChainSearchResult with reranked results and statistics

        Examples:
            >>> engine = ChainSearchEngine(registry, mapper, config=config)
            >>> # Use binary cascade (default, faster)
            >>> result = engine.cascade_search("auth", Path("D:/project"))
            >>> # Use hybrid cascade (original behavior)
            >>> result = engine.cascade_search("auth", Path("D:/project"), strategy="hybrid")
        """
        # Check config for strategy override
        effective_strategy = strategy
        if self._config is not None:
            config_strategy = getattr(self._config, "cascade_strategy", None)
            if config_strategy in ("binary", "hybrid"):
                # Only use config if no explicit strategy was passed
                # (we can't detect if strategy was explicitly passed vs default)
                effective_strategy = config_strategy

        if effective_strategy == "binary":
            return self.binary_cascade_search(query, source_path, k, coarse_k, options)
        else:
            return self.hybrid_cascade_search(query, source_path, k, coarse_k, options)

    def _get_or_create_binary_index(self, index_path: Path) -> Optional[Any]:
        """Get or create a BinaryANNIndex for the given index path.

        Attempts to load an existing binary index from disk. If not found,
        returns None (binary index should be built during indexing).

        Args:
            index_path: Path to the _index.db file

        Returns:
            BinaryANNIndex instance or None if not available
        """
        try:
            from codexlens.semantic.ann_index import BinaryANNIndex

            binary_index = BinaryANNIndex(index_path, dim=256)
            if binary_index.load():
                return binary_index
            return None
        except Exception as exc:
            self.logger.debug("Failed to load binary index for %s: %s", index_path, exc)
            return None

    def _compute_cosine_similarity(
        self,
        query_vec: "np.ndarray",
        doc_vec: "np.ndarray",
    ) -> float:
        """Compute cosine similarity between query and document vectors.

        Args:
            query_vec: Query embedding vector
            doc_vec: Document embedding vector

        Returns:
            Cosine similarity score in range [-1, 1]
        """
        if not NUMPY_AVAILABLE:
            return 0.0

        # Ensure same shape
        min_len = min(len(query_vec), len(doc_vec))
        q = query_vec[:min_len]
        d = doc_vec[:min_len]

        # Compute cosine similarity
        dot_product = np.dot(q, d)
        norm_q = np.linalg.norm(q)
        norm_d = np.linalg.norm(d)

        if norm_q == 0 or norm_d == 0:
            return 0.0

        return float(dot_product / (norm_q * norm_d))

    def _build_results_from_candidates(
        self,
        candidates: List[Tuple[int, int, Path]],
        index_paths: List[Path],
        stats: SearchStats,
        query: str,
        start_time: float,
    ) -> ChainSearchResult:
        """Build ChainSearchResult from binary candidates using Hamming distance scores.

        Used as fallback when dense embeddings are not available.

        Args:
            candidates: List of (chunk_id, hamming_distance, index_path) tuples
            index_paths: List of all searched index paths
            stats: SearchStats to update
            query: Original query string
            start_time: Search start time for timing

        Returns:
            ChainSearchResult with results scored by Hamming distance
        """
        results: List[SearchResult] = []

        # Group by index path
        candidates_by_index: Dict[Path, List[Tuple[int, int]]] = {}
        for chunk_id, distance, index_path in candidates:
            if index_path not in candidates_by_index:
                candidates_by_index[index_path] = []
            candidates_by_index[index_path].append((chunk_id, distance))

        for index_path, chunk_tuples in candidates_by_index.items():
            try:
                store = SQLiteStore(index_path)
                chunk_ids = [c[0] for c in chunk_tuples]
                chunks_data = store.get_chunks_by_ids(chunk_ids)

                chunk_content: Dict[int, Dict[str, Any]] = {
                    c["id"]: c for c in chunks_data
                }

                for chunk_id, distance in chunk_tuples:
                    chunk_info = chunk_content.get(chunk_id)
                    if chunk_info is None:
                        continue

                    # Convert Hamming distance to score (lower distance = higher score)
                    # Max Hamming distance for 256-bit is 256
                    score = 1.0 - (distance / 256.0)

                    excerpt = chunk_info.get("content", "")[:500]
                    result = SearchResult(
                        path=chunk_info.get("file_path", ""),
                        score=float(score),
                        excerpt=excerpt,
                    )
                    results.append(result)

            except Exception as exc:
                self.logger.debug(
                    "Failed to build results from %s: %s", index_path, exc
                )

        # Deduplicate by path
        path_to_result: Dict[str, SearchResult] = {}
        for result in results:
            if result.path not in path_to_result or result.score > path_to_result[result.path].score:
                path_to_result[result.path] = result

        final_results = sorted(
            path_to_result.values(),
            key=lambda r: r.score,
            reverse=True,
        )

        stats.files_matched = len(final_results)
        stats.time_ms = (time.time() - start_time) * 1000

        return ChainSearchResult(
            query=query,
            results=final_results,
            symbols=[],
            stats=stats,
        )

    def _cross_encoder_rerank(
        self,
        query: str,
        results: List[SearchResult],
        top_k: int,
    ) -> List[SearchResult]:
        """Rerank results using cross-encoder model.

        Args:
            query: Search query string
            results: Candidate results to rerank
            top_k: Number of top results to return

        Returns:
            Reranked results sorted by cross-encoder score
        """
        if not results:
            return []

        # Try to get reranker from config or create new one
        reranker = None
        try:
            from codexlens.semantic.reranker import (
                check_reranker_available,
                get_reranker,
            )

            # Determine backend and model from config
            backend = "onnx"
            model_name = None
            use_gpu = True

            if self._config is not None:
                backend = getattr(self._config, "reranker_backend", "onnx") or "onnx"
                model_name = getattr(self._config, "reranker_model", None)
                use_gpu = getattr(self._config, "embedding_use_gpu", True)

            ok, err = check_reranker_available(backend)
            if not ok:
                self.logger.debug("Reranker backend unavailable (%s): %s", backend, err)
                return results[:top_k]

            # Create reranker
            kwargs = {}
            if backend == "onnx":
                kwargs["use_gpu"] = use_gpu

            reranker = get_reranker(backend=backend, model_name=model_name, **kwargs)

        except ImportError as exc:
            self.logger.debug("Reranker not available: %s", exc)
            return results[:top_k]
        except Exception as exc:
            self.logger.debug("Failed to initialize reranker: %s", exc)
            return results[:top_k]

        # Use cross_encoder_rerank from ranking module
        from codexlens.search.ranking import cross_encoder_rerank

        return cross_encoder_rerank(
            query=query,
            results=results,
            reranker=reranker,
            top_k=top_k,
            batch_size=32,
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

        # Fast path: project-wide global symbol index (avoids chain traversal).
        if self._config is None or getattr(self._config, "global_symbol_index_enabled", True):
            try:
                # Avoid relying on index_to_source() here; use the same logic as _find_start_index
                # to determine the effective search root directory.
                search_root = source_path.resolve()
                exact_index = self.mapper.source_to_index_db(search_root)
                if not exact_index.exists():
                    nearest = self.registry.find_nearest_index(search_root)
                    if nearest:
                        search_root = nearest.source_path

                project = self.registry.find_by_source_path(str(search_root))
                if project:
                    global_db_path = Path(project["index_root"]) / GlobalSymbolIndex.DEFAULT_DB_NAME
                    if global_db_path.exists():
                        query_limit = max(int(options.total_limit) * 10, int(options.total_limit))
                        with GlobalSymbolIndex(global_db_path, project_id=int(project["id"])) as global_index:
                            candidates = global_index.search(name=name, kind=kind, limit=query_limit)

                        # Apply depth constraint relative to the start index directory.
                        filtered: List[Symbol] = []
                        for sym in candidates:
                            if not sym.file:
                                continue
                            try:
                                root_str = str(search_root)
                                file_dir_str = str(Path(sym.file).parent)

                                # Normalize Windows long-path prefix (\\?\) if present.
                                if root_str.startswith("\\\\?\\"):
                                    root_str = root_str[4:]
                                if file_dir_str.startswith("\\\\?\\"):
                                    file_dir_str = file_dir_str[4:]

                                root_cmp = root_str.lower().rstrip("\\/")
                                dir_cmp = file_dir_str.lower().rstrip("\\/")

                                # Guard against Windows cross-drive comparisons (ValueError).
                                if os.name == "nt":
                                    root_drive, _ = os.path.splitdrive(root_cmp)
                                    dir_drive, _ = os.path.splitdrive(dir_cmp)
                                    if root_drive and dir_drive and root_drive != dir_drive:
                                        self.logger.debug(
                                            "Skipping symbol due to cross-drive path (root=%s file=%s name=%s)",
                                            root_cmp,
                                            sym.file,
                                            sym.name,
                                        )
                                        continue

                                if os.path.commonpath([root_cmp, dir_cmp]) != root_cmp:
                                    continue

                                rel = os.path.relpath(dir_cmp, root_cmp)
                                rel_depth = 0 if rel == "." else len(rel.split(os.sep))
                            except ValueError as exc:
                                self.logger.debug(
                                    "Skipping symbol due to path operation failure (root=%s file=%s name=%s): %s",
                                    str(search_root),
                                    sym.file,
                                    sym.name,
                                    exc,
                                )
                                continue
                            except Exception as exc:
                                self.logger.debug(
                                    "Skipping symbol due to unexpected path error (root=%s file=%s name=%s): %s",
                                    str(search_root),
                                    sym.file,
                                    sym.name,
                                    exc,
                                )
                                continue

                            if options.depth >= 0 and rel_depth > options.depth:
                                continue
                            filtered.append(sym)

                        if filtered:
                            # Match existing semantics: dedupe by (name, kind, range), sort by name.
                            seen = set()
                            unique_symbols: List[Symbol] = []
                            for sym in filtered:
                                key = (sym.name, sym.kind, sym.range)
                                if key in seen:
                                    continue
                                seen.add(key)
                                unique_symbols.append(sym)
                            unique_symbols.sort(key=lambda s: s.name)
                            return unique_symbols[: options.total_limit]
            except Exception as exc:
                self.logger.debug("Global symbol index fast path failed: %s", exc)

        index_paths = self._collect_index_paths(start_index, options.depth)
        if not index_paths:
            return []

        return self._search_symbols_parallel(
            index_paths, name, kind, options.total_limit
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

        # Force single-threaded execution for vector/hybrid search to avoid GPU crashes
        # DirectML/ONNX have threading issues when multiple threads access GPU resources
        effective_workers = options.max_workers
        if options.enable_vector or options.hybrid_mode:
            effective_workers = 1
            self.logger.debug("Using single-threaded mode for vector search (GPU safety)")
            # Pre-load embedder to avoid initialization overhead per-search
            try:
                from codexlens.semantic.embedder import get_embedder
                get_embedder(profile="code", use_gpu=True)
            except Exception:
                pass  # Ignore pre-load failures

        executor = self._get_executor(effective_workers)
        # Submit all search tasks
        future_to_path = {
            executor.submit(
                self._search_single_index,
                idx_path,
                query,
                options.limit_per_dir,
                options.files_only,
                options.include_semantic,
                options.hybrid_mode,
                options.enable_fuzzy,
                options.enable_vector,
                options.pure_vector,
                options.hybrid_weights
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
                              include_semantic: bool = False,
                              hybrid_mode: bool = False,
                              enable_fuzzy: bool = True,
                              enable_vector: bool = False,
                              pure_vector: bool = False,
                              hybrid_weights: Optional[Dict[str, float]] = None) -> List[SearchResult]:
        """Search a single index database.

        Handles exceptions gracefully, returning empty list on failure.

        Args:
            index_path: Path to _index.db file
            query: FTS5 query string (for FTS) or natural language query (for vector)
            limit: Maximum results from this index
            files_only: If True, skip snippet generation for faster search
            include_semantic: If True, also search semantic keywords and merge results
            hybrid_mode: If True, use hybrid search with RRF fusion
            enable_fuzzy: Enable fuzzy FTS in hybrid mode
            enable_vector: Enable vector semantic search
            pure_vector: If True, only use vector search without FTS fallback
            hybrid_weights: Custom RRF weights for hybrid search

        Returns:
            List of SearchResult objects (empty on error)
        """
        try:
            # Use hybrid search if enabled
            if hybrid_mode:
                hybrid_engine = HybridSearchEngine(weights=hybrid_weights)
                fts_results = hybrid_engine.search(
                    index_path,
                    query,
                    limit=limit,
                    enable_fuzzy=enable_fuzzy,
                    enable_vector=enable_vector,
                    pure_vector=pure_vector,
                )
            else:
                # Single-FTS search (exact or fuzzy mode)
                with DirIndexStore(index_path) as store:
                    # Get FTS results
                    if files_only:
                        # Fast path: return paths only without snippets
                        paths = store.search_files_only(query, limit=limit)
                        fts_results = [SearchResult(path=p, score=0.0, excerpt="") for p in paths]
                    else:
                        # Use fuzzy FTS if enable_fuzzy=True (mode="fuzzy"), otherwise exact FTS
                        if enable_fuzzy:
                            fts_results = store.search_fts_fuzzy(
                                query, limit=limit, return_full_content=True
                            )
                        else:
                            fts_results = store.search_fts_exact(
                                query, limit=limit, return_full_content=True
                            )

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

    with ChainSearchEngine(registry, mapper) as engine:
        options = SearchOptions(depth=depth)
        result = engine.search(query, source_path, options)

    registry.close()

    return result.results
