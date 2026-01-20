"""Search method comparison benchmark.

Compares different search strategies:
1. Pure FTS (exact + fuzzy matching)
2. Pure Vector (semantic search only)
3. Hybrid Fusion (FTS + Vector with RRF)
4. Vector + LSP Association Tree (new strategy)

Usage:
    python examples/search_comparison_benchmark.py
"""

from __future__ import annotations

import asyncio
import time
from pathlib import Path
from typing import List, Dict, Any

from codexlens.config import Config
from codexlens.entities import SearchResult
from codexlens.search.hybrid_search import HybridSearchEngine
from codexlens.lsp.standalone_manager import StandaloneLspManager
from codexlens.search.association_tree import AssociationTreeBuilder, ResultDeduplicator


class SearchBenchmark:
    """Benchmark different search strategies."""

    def __init__(self, index_path: Path, config: Config):
        """Initialize benchmark.

        Args:
            index_path: Path to _index.db file
            config: CodexLens config
        """
        self.index_path = index_path
        self.config = config
        self.engine = HybridSearchEngine(config=config)
        self.lsp_manager: StandaloneLspManager | None = None
        self.tree_builder: AssociationTreeBuilder | None = None
        self.deduplicator = ResultDeduplicator(
            depth_weight=0.4,
            frequency_weight=0.3,
            kind_weight=0.3,
            max_depth_penalty=10,
        )

    async def setup_lsp(self):
        """Setup LSP manager for association tree search."""
        self.lsp_manager = StandaloneLspManager(
            workspace_root=str(self.index_path.parent),
            timeout=5.0,
        )
        await self.lsp_manager.start()
        self.tree_builder = AssociationTreeBuilder(
            lsp_manager=self.lsp_manager,
            timeout=5.0,
        )

    async def cleanup_lsp(self):
        """Cleanup LSP manager."""
        if self.lsp_manager:
            await self.lsp_manager.stop()

    def method1_pure_fts(self, query: str, limit: int = 20) -> tuple[List[SearchResult], float]:
        """Method 1: Pure FTS (exact + fuzzy)."""
        start = time.perf_counter()
        results = self.engine.search(
            index_path=self.index_path,
            query=query,
            limit=limit,
            enable_fuzzy=True,
            enable_vector=False,
            pure_vector=False,
        )
        elapsed = time.perf_counter() - start
        return results, elapsed

    def method2_pure_vector(self, query: str, limit: int = 20) -> tuple[List[SearchResult], float]:
        """Method 2: Pure Vector (semantic search only)."""
        start = time.perf_counter()
        results = self.engine.search(
            index_path=self.index_path,
            query=query,
            limit=limit,
            enable_fuzzy=False,
            enable_vector=True,
            pure_vector=True,
        )
        elapsed = time.perf_counter() - start
        return results, elapsed

    def method3_hybrid_fusion(self, query: str, limit: int = 20) -> tuple[List[SearchResult], float]:
        """Method 3: Hybrid Fusion (FTS + Vector with RRF)."""
        start = time.perf_counter()
        results = self.engine.search(
            index_path=self.index_path,
            query=query,
            limit=limit,
            enable_fuzzy=True,
            enable_vector=True,
            pure_vector=False,
        )
        elapsed = time.perf_counter() - start
        return results, elapsed

    async def method4_vector_lsp_tree(
        self,
        query: str,
        limit: int = 20,
        max_depth: int = 3,
        expand_callers: bool = True,
        expand_callees: bool = True,
    ) -> tuple[List[SearchResult], float, Dict[str, Any]]:
        """Method 4: Vector + LSP Association Tree (new strategy).

        Steps:
        1. Vector search to find seed results (top 5-10)
        2. For each seed, build LSP association tree
        3. Deduplicate and score all discovered nodes
        4. Return top N results

        Args:
            query: Search query
            limit: Final result limit
            max_depth: Maximum depth for LSP tree expansion
            expand_callers: Whether to expand incoming calls
            expand_callees: Whether to expand outgoing calls

        Returns:
            Tuple of (results, elapsed_time, stats)
        """
        if not self.tree_builder:
            raise RuntimeError("LSP not initialized. Call setup_lsp() first.")

        start = time.perf_counter()
        stats = {
            "seed_count": 0,
            "trees_built": 0,
            "total_tree_nodes": 0,
            "unique_nodes": 0,
            "dedup_time_ms": 0,
        }

        # Step 1: Get seed results from vector search (top 10)
        seed_results = self.engine.search(
            index_path=self.index_path,
            query=query,
            limit=10,
            enable_fuzzy=False,
            enable_vector=True,
            pure_vector=True,
        )
        stats["seed_count"] = len(seed_results)

        if not seed_results:
            return [], time.perf_counter() - start, stats

        # Step 2: Build association trees for each seed
        all_trees = []
        for seed in seed_results:
            try:
                tree = await self.tree_builder.build_tree(
                    seed_file_path=seed.path,
                    seed_line=seed.start_line or 1,
                    seed_character=1,
                    max_depth=max_depth,
                    expand_callers=expand_callers,
                    expand_callees=expand_callees,
                )
                if tree.node_list:
                    all_trees.append(tree)
                    stats["trees_built"] += 1
                    stats["total_tree_nodes"] += len(tree.node_list)
            except Exception as e:
                print(f"Error building tree for {seed.path}:{seed.start_line}: {e}")
                continue

        if not all_trees:
            # Fallback to seed results if no trees built
            return seed_results[:limit], time.perf_counter() - start, stats

        # Step 3: Merge and deduplicate all trees
        dedup_start = time.perf_counter()

        # Merge all node_lists into a single CallTree
        from codexlens.search.association_tree.data_structures import CallTree
        merged_tree = CallTree()
        for tree in all_trees:
            merged_tree.node_list.extend(tree.node_list)

        # Deduplicate
        unique_nodes = self.deduplicator.deduplicate(
            tree=merged_tree,
            max_results=limit,
        )
        stats["unique_nodes"] = len(unique_nodes)
        stats["dedup_time_ms"] = (time.perf_counter() - dedup_start) * 1000

        # Step 4: Convert UniqueNode to SearchResult
        results = []
        for node in unique_nodes:
            # Use node.score as the search score
            result = SearchResult(
                path=node.file_path,
                score=node.score,
                start_line=node.range.start_line,
                end_line=node.range.end_line,
                symbol_name=node.name,
                symbol_kind=node.kind,
                content="",  # LSP doesn't provide content
                metadata={"search_source": "lsp_tree"},
            )
            results.append(result)

        elapsed = time.perf_counter() - start
        return results, elapsed, stats

    def print_results(self, method_name: str, results: List[SearchResult], elapsed: float, stats: Dict[str, Any] | None = None):
        """Print benchmark results."""
        print(f"\n{'='*80}")
        print(f"Method: {method_name}")
        print(f"{'='*80}")
        print(f"Time: {elapsed*1000:.2f}ms")
        print(f"Results: {len(results)}")

        if stats:
            print(f"\nStats:")
            for key, value in stats.items():
                print(f"  {key}: {value}")

        print(f"\nTop 5 Results:")
        for i, result in enumerate(results[:5], 1):
            print(f"{i}. [{result.score:.4f}] {result.path}:{result.start_line}")
            if result.symbol_name:
                print(f"   Name: {result.symbol_name}")
            if result.metadata.get("search_source"):
                print(f"   Source: {result.metadata.get('search_source')}")

    async def run_comparison(self, query: str, limit: int = 20):
        """Run comparison for a single query."""
        print(f"\n{'#'*80}")
        print(f"Query: {query}")
        print(f"{'#'*80}")

        # Method 1: Pure FTS
        results1, time1 = self.method1_pure_fts(query, limit)
        self.print_results("Method 1: Pure FTS", results1, time1)

        # Method 2: Pure Vector
        results2, time2 = self.method2_pure_vector(query, limit)
        self.print_results("Method 2: Pure Vector", results2, time2)

        # Method 3: Hybrid Fusion
        results3, time3 = self.method3_hybrid_fusion(query, limit)
        self.print_results("Method 3: Hybrid Fusion (FTS+Vector)", results3, time3)

        # Method 4: Vector + LSP Tree (requires LSP setup)
        results4 = None
        time4 = 0.0
        try:
            results4, time4, stats4 = await self.method4_vector_lsp_tree(query, limit, max_depth=3)
            self.print_results("Method 4: Vector + LSP Association Tree", results4, time4, stats4)
        except Exception as e:
            print(f"\nMethod 4: Vector + LSP Association Tree")
            print(f"Error: {e}")

        # Comparison summary
        print(f"\n{'='*80}")
        print(f"Summary")
        print(f"{'='*80}")
        print(f"Method 1 (FTS):           {time1*1000:8.2f}ms  {len(results1):3d} results")
        print(f"Method 2 (Vector):        {time2*1000:8.2f}ms  {len(results2):3d} results")
        print(f"Method 3 (Hybrid):        {time3*1000:8.2f}ms  {len(results3):3d} results")
        if results4 is not None:
            print(f"Method 4 (Vector+LSP):    {time4*1000:8.2f}ms  {len(results4):3d} results")


async def main():
    """Main benchmark entry point."""
    # Setup - use the actual index path from ~/.codexlens/indexes/
    import os
    codexlens_home = Path(os.path.expanduser("~/.codexlens"))
    index_path = codexlens_home / "indexes/D/Claude_dms3/codex-lens/src/codexlens/_index.db"

    if not index_path.exists():
        print(f"Error: Index not found at {index_path}")
        print("Please run: python -m codexlens index init src")
        return

    project_root = Path("D:/Claude_dms3/codex-lens/src")

    config = Config()
    benchmark = SearchBenchmark(index_path, config)

    # Test queries
    queries = [
        "vector search implementation",
        "LSP call hierarchy",
        "search result ranking",
        "index building",
    ]

    # Setup LSP for Method 4
    print("Setting up LSP manager...")
    try:
        await benchmark.setup_lsp()
        print("LSP manager ready")
    except Exception as e:
        print(f"Warning: Could not setup LSP: {e}")
        print("Method 4 will be skipped")

    try:
        # Run benchmarks
        for query in queries:
            await benchmark.run_comparison(query, limit=20)

    finally:
        # Cleanup
        await benchmark.cleanup_lsp()
        print("\nBenchmark complete")


if __name__ == "__main__":
    asyncio.run(main())
