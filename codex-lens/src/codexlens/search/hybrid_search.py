"""Hybrid search engine orchestrating parallel exact/fuzzy/vector searches with RRF fusion.

Coordinates multiple search backends in parallel using ThreadPoolExecutor and combines
results via Reciprocal Rank Fusion (RRF) algorithm.
"""

from __future__ import annotations

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional

from codexlens.entities import SearchResult
from codexlens.search.ranking import reciprocal_rank_fusion, tag_search_source
from codexlens.storage.dir_index import DirIndexStore


class HybridSearchEngine:
    """Hybrid search engine with parallel execution and RRF fusion.

    Orchestrates searches across exact FTS, fuzzy FTS, and optional vector backends,
    executing them in parallel and fusing results via Reciprocal Rank Fusion.

    Attributes:
        logger: Python logger instance
        default_weights: Default RRF weights for each source
    """

    # Default RRF weights (exact: 40%, fuzzy: 30%, vector: 30%)
    DEFAULT_WEIGHTS = {
        "exact": 0.4,
        "fuzzy": 0.3,
        "vector": 0.3,
    }

    def __init__(self, weights: Optional[Dict[str, float]] = None):
        """Initialize hybrid search engine.

        Args:
            weights: Optional custom RRF weights (default: DEFAULT_WEIGHTS)
        """
        self.logger = logging.getLogger(__name__)
        self.weights = weights or self.DEFAULT_WEIGHTS.copy()

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

        fused_results = reciprocal_rank_fusion(results_map, active_weights)

        # Apply final limit
        return fused_results[:limit]

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

        # Use ThreadPoolExecutor for parallel I/O-bound searches
        with ThreadPoolExecutor(max_workers=len(backends)) as executor:
            # Submit search tasks
            future_to_source = {}

            if backends.get("exact"):
                future = executor.submit(
                    self._search_exact, index_path, query, limit
                )
                future_to_source[future] = "exact"

            if backends.get("fuzzy"):
                future = executor.submit(
                    self._search_fuzzy, index_path, query, limit
                )
                future_to_source[future] = "fuzzy"

            if backends.get("vector"):
                future = executor.submit(
                    self._search_vector, index_path, query, limit
                )
                future_to_source[future] = "vector"

            # Collect results as they complete
            for future in as_completed(future_to_source):
                source = future_to_source[future]
                try:
                    results = future.result()
                    # Tag results with source for debugging
                    tagged_results = tag_search_source(results, source)
                    results_map[source] = tagged_results
                    self.logger.debug(
                        "Got %d results from %s search", len(results), source
                    )
                except Exception as exc:
                    self.logger.error("Search failed for %s: %s", source, exc)
                    results_map[source] = []

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
                return store.search_fts_exact(query, limit=limit)
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
                return store.search_fts_fuzzy(query, limit=limit)
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
            conn = sqlite3.connect(index_path)
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='semantic_chunks'"
            )
            has_semantic_table = cursor.fetchone() is not None
            conn.close()

            if not has_semantic_table:
                self.logger.info(
                    "No embeddings found in index. "
                    "Generate embeddings with: codexlens embeddings-generate %s",
                    index_path.parent if index_path.name == "_index.db" else index_path
                )
                return []

            # Initialize embedder and vector store
            from codexlens.semantic.embedder import Embedder
            from codexlens.semantic.vector_store import VectorStore

            vector_store = VectorStore(index_path)

            # Check if vector store has data
            if vector_store.count_chunks() == 0:
                self.logger.info(
                    "Vector store is empty (0 chunks). "
                    "Generate embeddings with: codexlens embeddings-generate %s",
                    index_path.parent if index_path.name == "_index.db" else index_path
                )
                return []

            # Auto-detect embedding dimension and select appropriate profile
            detected_dim = vector_store.dimension
            if detected_dim is None:
                self.logger.info("Vector store dimension unknown, using default profile")
                profile = "code"  # Default fallback
            elif detected_dim == 384:
                profile = "fast"
            elif detected_dim == 768:
                profile = "code"
            elif detected_dim == 1024:
                profile = "multilingual"  # or balanced, both are 1024
            else:
                profile = "code"  # Default fallback

            embedder = Embedder(profile=profile)

            # Generate query embedding
            query_embedding = embedder.embed_single(query)

            # Search for similar chunks
            results = vector_store.search_similar(
                query_embedding=query_embedding,
                top_k=limit,
                min_score=0.0,  # Return all results, let RRF handle filtering
                return_full_content=True,
            )

            self.logger.debug("Vector search found %d results", len(results))
            return results

        except ImportError as exc:
            self.logger.debug("Semantic dependencies not available: %s", exc)
            return []
        except Exception as exc:
            self.logger.error("Vector search error: %s", exc)
            return []
