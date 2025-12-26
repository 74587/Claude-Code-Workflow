"""Hybrid search engine orchestrating parallel exact/fuzzy/vector searches with RRF fusion.

Coordinates multiple search backends in parallel using ThreadPoolExecutor and combines
results via Reciprocal Rank Fusion (RRF) algorithm.
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional


@contextmanager
def timer(name: str, logger: logging.Logger, level: int = logging.DEBUG):
    """Context manager for timing code blocks.

    Args:
        name: Name of the operation being timed
        logger: Logger instance to use
        level: Logging level (default DEBUG)
    """
    start = time.perf_counter()
    try:
        yield
    finally:
        elapsed_ms = (time.perf_counter() - start) * 1000
        logger.log(level, "[TIMING] %s: %.2fms", name, elapsed_ms)

from codexlens.config import Config
from codexlens.entities import SearchResult
from codexlens.search.ranking import (
    apply_symbol_boost,
    get_rrf_weights,
    reciprocal_rank_fusion,
    rerank_results,
    tag_search_source,
)
from codexlens.storage.dir_index import DirIndexStore


class HybridSearchEngine:
    """Hybrid search engine with parallel execution and RRF fusion.

    Orchestrates searches across exact FTS, fuzzy FTS, and optional vector backends,
    executing them in parallel and fusing results via Reciprocal Rank Fusion.

    Attributes:
        logger: Python logger instance
        default_weights: Default RRF weights for each source
    """

    # Default RRF weights (vector: 60%, exact: 30%, fuzzy: 10%)
    DEFAULT_WEIGHTS = {
        "exact": 0.3,
        "fuzzy": 0.1,
        "vector": 0.6,
    }

    def __init__(
        self,
        weights: Optional[Dict[str, float]] = None,
        config: Optional[Config] = None,
        embedder: Any = None,
    ):
        """Initialize hybrid search engine.

        Args:
            weights: Optional custom RRF weights (default: DEFAULT_WEIGHTS)
            config: Optional runtime config (enables optional reranking features)
            embedder: Optional embedder instance for embedding-based reranking
        """
        self.logger = logging.getLogger(__name__)
        self.weights = weights or self.DEFAULT_WEIGHTS.copy()
        self._config = config
        self.embedder = embedder

    def search(
        self,
        index_path: Path,
        query: str,
        limit: int = 20,
        enable_fuzzy: bool = True,
        enable_vector: bool = False,
        pure_vector: bool = False,
    ) -> List[SearchResult]:
        """Execute hybrid search with parallel retrieval and RRF fusion.

        Args:
            index_path: Path to _index.db file
            query: FTS5 query string (for FTS) or natural language query (for vector)
            limit: Maximum results to return after fusion
            enable_fuzzy: Enable fuzzy FTS search (default True)
            enable_vector: Enable vector search (default False)
            pure_vector: If True, only use vector search without FTS fallback (default False)

        Returns:
            List of SearchResult objects sorted by fusion score

        Examples:
            >>> engine = HybridSearchEngine()
            >>> # Hybrid search (exact + fuzzy + vector)
            >>> results = engine.search(Path("project/_index.db"), "authentication",
            ...                         enable_vector=True)
            >>> # Pure vector search (semantic only)
            >>> results = engine.search(Path("project/_index.db"),
            ...                         "how to authenticate users",
            ...                         enable_vector=True, pure_vector=True)
            >>> for r in results[:5]:
            ...     print(f"{r.path}: {r.score:.3f}")
        """
        # Determine which backends to use
        backends = {}

        if pure_vector:
            # Pure vector mode: only use vector search, no FTS fallback
            if enable_vector:
                backends["vector"] = True
            else:
                # Invalid configuration: pure_vector=True but enable_vector=False
                self.logger.warning(
                    "pure_vector=True requires enable_vector=True. "
                    "Falling back to exact search. "
                    "To use pure vector search, enable vector search mode."
                )
                backends["exact"] = True
        else:
            # Hybrid mode: always include exact search as baseline
            backends["exact"] = True
            if enable_fuzzy:
                backends["fuzzy"] = True
            if enable_vector:
                backends["vector"] = True

        # Execute parallel searches
        with timer("parallel_search_total", self.logger):
            results_map = self._search_parallel(index_path, query, backends, limit)

        # Provide helpful message if pure-vector mode returns no results
        if pure_vector and enable_vector and len(results_map.get("vector", [])) == 0:
            self.logger.warning(
                "Pure vector search returned no results. "
                "This usually means embeddings haven't been generated. "
                "Run: codexlens embeddings-generate %s",
                index_path.parent if index_path.name == "_index.db" else index_path
            )

        # Apply RRF fusion
        # Filter weights to only active backends
        active_weights = {
            source: weight
            for source, weight in self.weights.items()
            if source in results_map
        }

        with timer("rrf_fusion", self.logger):
            adaptive_weights = get_rrf_weights(query, active_weights)
            fused_results = reciprocal_rank_fusion(results_map, adaptive_weights)

        # Optional: boost results that include explicit symbol matches
        boost_factor = (
            self._config.symbol_boost_factor
            if self._config is not None
            else 1.5
        )
        with timer("symbol_boost", self.logger):
            fused_results = apply_symbol_boost(
                fused_results, boost_factor=boost_factor
            )

        # Optional: embedding-based reranking on top results
        if self._config is not None and self._config.enable_reranking:
            with timer("reranking", self.logger):
                if self.embedder is None:
                    self.embedder = self._get_reranking_embedder()
                fused_results = rerank_results(
                    query,
                    fused_results[:100],
                    self.embedder,
                    top_k=self._config.reranking_top_k,
                )

        # Apply final limit
        return fused_results[:limit]

    def _get_reranking_embedder(self) -> Any:
        """Create an embedder for reranking based on Config embedding settings."""
        if self._config is None:
            return None

        try:
            from codexlens.semantic.factory import get_embedder
        except Exception as exc:
            self.logger.debug("Reranking embedder unavailable: %s", exc)
            return None

        try:
            if self._config.embedding_backend == "fastembed":
                return get_embedder(
                    backend="fastembed",
                    profile=self._config.embedding_model,
                    use_gpu=self._config.embedding_use_gpu,
                )
            if self._config.embedding_backend == "litellm":
                return get_embedder(
                    backend="litellm",
                    model=self._config.embedding_model,
                    endpoints=self._config.embedding_endpoints,
                    strategy=self._config.embedding_strategy,
                    cooldown=self._config.embedding_cooldown,
                )
        except Exception as exc:
            self.logger.debug("Failed to initialize reranking embedder: %s", exc)
            return None

        self.logger.debug(
            "Unknown embedding backend for reranking: %s",
            self._config.embedding_backend,
        )
        return None

    def _search_parallel(
        self,
        index_path: Path,
        query: str,
        backends: Dict[str, bool],
        limit: int,
    ) -> Dict[str, List[SearchResult]]:
        """Execute parallel searches across enabled backends.

        Args:
            index_path: Path to _index.db file
            query: FTS5 query string
            backends: Dictionary of backend name to enabled flag
            limit: Results limit per backend

        Returns:
            Dictionary mapping source name to results list
        """
        results_map: Dict[str, List[SearchResult]] = {}
        timing_data: Dict[str, float] = {}

        # Use ThreadPoolExecutor for parallel I/O-bound searches
        with ThreadPoolExecutor(max_workers=len(backends)) as executor:
            # Submit search tasks with timing
            future_to_source = {}
            submit_times = {}

            if backends.get("exact"):
                submit_times["exact"] = time.perf_counter()
                future = executor.submit(
                    self._search_exact, index_path, query, limit
                )
                future_to_source[future] = "exact"

            if backends.get("fuzzy"):
                submit_times["fuzzy"] = time.perf_counter()
                future = executor.submit(
                    self._search_fuzzy, index_path, query, limit
                )
                future_to_source[future] = "fuzzy"

            if backends.get("vector"):
                submit_times["vector"] = time.perf_counter()
                future = executor.submit(
                    self._search_vector, index_path, query, limit
                )
                future_to_source[future] = "vector"

            # Collect results as they complete
            for future in as_completed(future_to_source):
                source = future_to_source[future]
                elapsed_ms = (time.perf_counter() - submit_times[source]) * 1000
                timing_data[source] = elapsed_ms
                try:
                    results = future.result()
                    # Tag results with source for debugging
                    tagged_results = tag_search_source(results, source)
                    results_map[source] = tagged_results
                    self.logger.debug(
                        "[TIMING] %s_search: %.2fms (%d results)",
                        source, elapsed_ms, len(results)
                    )
                except Exception as exc:
                    self.logger.error("Search failed for %s: %s", source, exc)
                    results_map[source] = []

        # Log timing summary
        if timing_data:
            timing_str = ", ".join(f"{k}={v:.1f}ms" for k, v in timing_data.items())
            self.logger.debug("[TIMING] search_backends: {%s}", timing_str)

        return results_map

    def _search_exact(
        self, index_path: Path, query: str, limit: int
    ) -> List[SearchResult]:
        """Execute exact FTS search using unicode61 tokenizer.

        Args:
            index_path: Path to _index.db file
            query: FTS5 query string
            limit: Maximum results

        Returns:
            List of SearchResult objects
        """
        try:
            with DirIndexStore(index_path) as store:
                return store.search_fts_exact(
                    query, limit=limit, return_full_content=True
                )
        except Exception as exc:
            self.logger.debug("Exact search error: %s", exc)
            return []

    def _search_fuzzy(
        self, index_path: Path, query: str, limit: int
    ) -> List[SearchResult]:
        """Execute fuzzy FTS search using trigram/extended unicode61 tokenizer.

        Args:
            index_path: Path to _index.db file
            query: FTS5 query string
            limit: Maximum results

        Returns:
            List of SearchResult objects
        """
        try:
            with DirIndexStore(index_path) as store:
                return store.search_fts_fuzzy(
                    query, limit=limit, return_full_content=True
                )
        except Exception as exc:
            self.logger.debug("Fuzzy search error: %s", exc)
            return []

    def _search_vector(
        self, index_path: Path, query: str, limit: int
    ) -> List[SearchResult]:
        """Execute vector similarity search using semantic embeddings.

        Args:
            index_path: Path to _index.db file
            query: Natural language query string
            limit: Maximum results

        Returns:
            List of SearchResult objects ordered by semantic similarity
        """
        try:
            # Check if semantic chunks table exists
            import sqlite3

            start_check = time.perf_counter()
            try:
                with sqlite3.connect(index_path) as conn:
                    cursor = conn.execute(
                        "SELECT name FROM sqlite_master WHERE type='table' AND name='semantic_chunks'"
                    )
                    has_semantic_table = cursor.fetchone() is not None
            except sqlite3.Error as e:
                self.logger.error("Database check failed in vector search: %s", e)
                return []
            self.logger.debug(
                "[TIMING] vector_table_check: %.2fms",
                (time.perf_counter() - start_check) * 1000
            )

            if not has_semantic_table:
                self.logger.info(
                    "No embeddings found in index. "
                    "Generate embeddings with: codexlens embeddings-generate %s",
                    index_path.parent if index_path.name == "_index.db" else index_path
                )
                return []

            # Initialize embedder and vector store
            from codexlens.semantic.factory import get_embedder
            from codexlens.semantic.vector_store import VectorStore

            start_init = time.perf_counter()
            vector_store = VectorStore(index_path)
            self.logger.debug(
                "[TIMING] vector_store_init: %.2fms",
                (time.perf_counter() - start_init) * 1000
            )

            # Check if vector store has data
            if vector_store.count_chunks() == 0:
                self.logger.info(
                    "Vector store is empty (0 chunks). "
                    "Generate embeddings with: codexlens embeddings-generate %s",
                    index_path.parent if index_path.name == "_index.db" else index_path
                )
                return []

            # Get stored model configuration (preferred) or auto-detect from dimension
            start_embedder = time.perf_counter()
            model_config = vector_store.get_model_config()
            if model_config:
                backend = model_config.get("backend", "fastembed")
                model_name = model_config["model_name"]
                model_profile = model_config["model_profile"]
                self.logger.debug(
                    "Using stored model config: %s backend, %s (%s, %dd)",
                    backend, model_profile, model_name, model_config["embedding_dim"]
                )

                # Get embedder based on backend
                if backend == "litellm":
                    embedder = get_embedder(backend="litellm", model=model_name)
                else:
                    embedder = get_embedder(backend="fastembed", profile=model_profile)
            else:
                # Fallback: auto-detect from embedding dimension
                detected_dim = vector_store.dimension
                if detected_dim is None:
                    self.logger.info("Vector store dimension unknown, using default profile")
                    embedder = get_embedder(backend="fastembed", profile="code")
                elif detected_dim == 384:
                    embedder = get_embedder(backend="fastembed", profile="fast")
                elif detected_dim == 768:
                    embedder = get_embedder(backend="fastembed", profile="code")
                elif detected_dim == 1024:
                    embedder = get_embedder(backend="fastembed", profile="multilingual")
                elif detected_dim == 1536:
                    # Likely OpenAI text-embedding-3-small or ada-002
                    self.logger.info(
                        "Detected 1536-dim embeddings (likely OpenAI), using litellm backend with text-embedding-3-small"
                    )
                    embedder = get_embedder(backend="litellm", model="text-embedding-3-small")
                elif detected_dim == 3072:
                    # Likely OpenAI text-embedding-3-large
                    self.logger.info(
                        "Detected 3072-dim embeddings (likely OpenAI), using litellm backend with text-embedding-3-large"
                    )
                    embedder = get_embedder(backend="litellm", model="text-embedding-3-large")
                else:
                    self.logger.debug(
                        "Unknown dimension %s, using default fastembed profile 'code'",
                        detected_dim
                    )
                    embedder = get_embedder(backend="fastembed", profile="code")
            self.logger.debug(
                "[TIMING] embedder_init: %.2fms",
                (time.perf_counter() - start_embedder) * 1000
            )

            # Generate query embedding
            start_embed = time.perf_counter()
            query_embedding = embedder.embed_single(query)
            self.logger.debug(
                "[TIMING] query_embedding: %.2fms",
                (time.perf_counter() - start_embed) * 1000
            )

            # Search for similar chunks
            start_search = time.perf_counter()
            results = vector_store.search_similar(
                query_embedding=query_embedding,
                top_k=limit,
                min_score=0.0,  # Return all results, let RRF handle filtering
                return_full_content=True,
            )
            self.logger.debug(
                "[TIMING] vector_similarity_search: %.2fms (%d results)",
                (time.perf_counter() - start_search) * 1000, len(results)
            )

            return results

        except ImportError as exc:
            self.logger.debug("Semantic dependencies not available: %s", exc)
            return []
        except Exception as exc:
            self.logger.error("Vector search error: %s", exc)
            return []
