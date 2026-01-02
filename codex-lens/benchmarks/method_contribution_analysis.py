"""Analysis script for hybrid search method contribution and storage architecture.

This script analyzes:
1. Individual method contribution in hybrid search (FTS/SPLADE/Vector)
2. Storage architecture conflicts between different retrieval methods
3. FTS + Rerank fusion experiment
"""

import json
import sqlite3
import time
from pathlib import Path
from typing import Dict, List, Tuple, Any
from collections import defaultdict

# Add project root to path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from codexlens.storage.registry import RegistryStore
from codexlens.storage.path_mapper import PathMapper
from codexlens.search.hybrid_search import HybridSearchEngine
from codexlens.search.ranking import (
    reciprocal_rank_fusion,
    cross_encoder_rerank,
    DEFAULT_WEIGHTS,
    FTS_FALLBACK_WEIGHTS,
)
from codexlens.search.hybrid_search import THREE_WAY_WEIGHTS
from codexlens.entities import SearchResult


def find_project_index(source_path: Path) -> Path:
    """Find the index database for a project."""
    registry = RegistryStore()
    registry.initialize()

    mapper = PathMapper()
    index_path = mapper.source_to_index_db(source_path)

    if not index_path.exists():
        nearest = registry.find_nearest_index(source_path)
        if nearest:
            index_path = nearest.index_path

    registry.close()
    return index_path


def analyze_storage_architecture(index_path: Path) -> Dict[str, Any]:
    """Analyze storage tables and check for conflicts.

    Returns:
        Dictionary with table analysis and conflict detection.
    """
    results = {
        "tables": {},
        "conflicts": [],
        "recommendations": []
    }

    with sqlite3.connect(index_path) as conn:
        # Get all tables
        cursor = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = [row[0] for row in cursor.fetchall()]

        for table in tables:
            # Get row count and columns
            try:
                count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                cols = conn.execute(f"PRAGMA table_info({table})").fetchall()
                col_names = [c[1] for c in cols]

                results["tables"][table] = {
                    "row_count": count,
                    "columns": col_names
                }
            except Exception as e:
                results["tables"][table] = {"error": str(e)}

        # Check for data overlap/conflicts
        # 1. Check if chunks and semantic_chunks have different data
        if "chunks" in tables and "semantic_chunks" in tables:
            chunks_count = results["tables"]["chunks"]["row_count"]
            semantic_count = results["tables"]["semantic_chunks"]["row_count"]

            if chunks_count > 0 and semantic_count > 0:
                # Check for ID overlap
                overlap = conn.execute("""
                    SELECT COUNT(*) FROM chunks c
                    JOIN semantic_chunks sc ON c.id = sc.id
                """).fetchone()[0]

                results["conflicts"].append({
                    "type": "table_overlap",
                    "tables": ["chunks", "semantic_chunks"],
                    "chunks_count": chunks_count,
                    "semantic_count": semantic_count,
                    "id_overlap": overlap,
                    "description": (
                        f"Both chunks ({chunks_count}) and semantic_chunks ({semantic_count}) "
                        f"have data. ID overlap: {overlap}. "
                        "This can cause confusion - binary_cascade reads from semantic_chunks "
                        "but SQLiteStore reads from chunks."
                    )
                })
            elif chunks_count == 0 and semantic_count > 0:
                results["recommendations"].append(
                    "chunks table is empty but semantic_chunks has data. "
                    "Use cascade-index (semantic_chunks) for better semantic search."
                )
            elif chunks_count > 0 and semantic_count == 0:
                results["recommendations"].append(
                    "semantic_chunks is empty. Run 'codexlens cascade-index' to enable "
                    "binary cascade search."
                )

        # 2. Check SPLADE index status
        if "splade_posting_list" in tables:
            splade_count = results["tables"]["splade_posting_list"]["row_count"]
            if splade_count == 0:
                results["recommendations"].append(
                    "SPLADE tables exist but empty. Run SPLADE indexing to enable sparse retrieval."
                )

        # 3. Check FTS tables
        fts_tables = [t for t in tables if t.startswith("files_fts")]
        if len(fts_tables) >= 2:
            results["recommendations"].append(
                f"Found {len(fts_tables)} FTS tables: {fts_tables}. "
                "Dual FTS (exact + fuzzy) is properly configured."
            )

    return results


def analyze_method_contributions(
    index_path: Path,
    queries: List[str],
    limit: int = 20
) -> Dict[str, Any]:
    """Analyze contribution of each retrieval method.

    Runs each method independently and measures:
    - Result count
    - Latency
    - Score distribution
    - Overlap with other methods
    """
    results = {
        "per_query": [],
        "summary": {}
    }

    for query in queries:
        query_result = {
            "query": query,
            "methods": {},
            "fusion_analysis": {}
        }

        # Run each method independently
        methods = {
            "fts_exact": {"fuzzy": False, "vector": False, "splade": False},
            "fts_fuzzy": {"fuzzy": True, "vector": False, "splade": False},
            "vector": {"fuzzy": False, "vector": True, "splade": False},
            "splade": {"fuzzy": False, "vector": False, "splade": True},
        }

        method_results: Dict[str, List[SearchResult]] = {}

        for method_name, config in methods.items():
            try:
                engine = HybridSearchEngine()

                # Set config to disable/enable specific backends
                engine._config = type('obj', (object,), {
                    'use_fts_fallback': method_name.startswith("fts"),
                    'enable_splade': method_name == "splade",
                    'embedding_use_gpu': True,
                })()

                start = time.perf_counter()

                if method_name == "fts_exact":
                    # Force FTS fallback mode with fuzzy disabled
                    engine.weights = FTS_FALLBACK_WEIGHTS.copy()
                    results_list = engine.search(
                        index_path, query, limit=limit,
                        enable_fuzzy=False, enable_vector=False, pure_vector=False
                    )
                elif method_name == "fts_fuzzy":
                    engine.weights = FTS_FALLBACK_WEIGHTS.copy()
                    results_list = engine.search(
                        index_path, query, limit=limit,
                        enable_fuzzy=True, enable_vector=False, pure_vector=False
                    )
                elif method_name == "vector":
                    results_list = engine.search(
                        index_path, query, limit=limit,
                        enable_fuzzy=False, enable_vector=True, pure_vector=True
                    )
                elif method_name == "splade":
                    engine.weights = {"splade": 1.0}
                    results_list = engine.search(
                        index_path, query, limit=limit,
                        enable_fuzzy=False, enable_vector=False, pure_vector=False
                    )
                else:
                    results_list = []

                latency = (time.perf_counter() - start) * 1000

                method_results[method_name] = results_list

                scores = [r.score for r in results_list]
                query_result["methods"][method_name] = {
                    "count": len(results_list),
                    "latency_ms": latency,
                    "avg_score": sum(scores) / len(scores) if scores else 0,
                    "max_score": max(scores) if scores else 0,
                    "min_score": min(scores) if scores else 0,
                    "top_3_files": [r.path.split("\\")[-1] for r in results_list[:3]]
                }

            except Exception as e:
                query_result["methods"][method_name] = {
                    "error": str(e),
                    "count": 0
                }

        # Compute overlap between methods
        method_paths = {
            name: set(r.path for r in results)
            for name, results in method_results.items()
            if results
        }

        overlaps = {}
        method_names = list(method_paths.keys())
        for i, m1 in enumerate(method_names):
            for m2 in method_names[i+1:]:
                overlap = len(method_paths[m1] & method_paths[m2])
                union = len(method_paths[m1] | method_paths[m2])
                jaccard = overlap / union if union > 0 else 0
                overlaps[f"{m1}_vs_{m2}"] = {
                    "overlap_count": overlap,
                    "jaccard": jaccard,
                    f"{m1}_unique": len(method_paths[m1] - method_paths[m2]),
                    f"{m2}_unique": len(method_paths[m2] - method_paths[m1]),
                }

        query_result["overlaps"] = overlaps

        # Analyze RRF fusion contribution
        if len(method_results) >= 2:
            # Compute RRF with each method's contribution
            rrf_map = {}
            for name, results in method_results.items():
                if results and name in ["fts_exact", "splade", "vector"]:
                    # Rename for RRF
                    rrf_name = name.replace("fts_exact", "exact")
                    rrf_map[rrf_name] = results

            if rrf_map:
                fused = reciprocal_rank_fusion(rrf_map, k=60)

                # Analyze which methods contributed to top results
                source_contributions = defaultdict(int)
                for r in fused[:10]:
                    source_ranks = r.metadata.get("source_ranks", {})
                    for source in source_ranks:
                        source_contributions[source] += 1

                query_result["fusion_analysis"] = {
                    "total_fused": len(fused),
                    "top_10_source_distribution": dict(source_contributions)
                }

        results["per_query"].append(query_result)

    # Compute summary statistics
    method_stats = defaultdict(lambda: {"counts": [], "latencies": []})
    for qr in results["per_query"]:
        for method, data in qr["methods"].items():
            if "count" in data:
                method_stats[method]["counts"].append(data["count"])
                if "latency_ms" in data:
                    method_stats[method]["latencies"].append(data["latency_ms"])

    results["summary"] = {
        method: {
            "avg_count": sum(s["counts"]) / len(s["counts"]) if s["counts"] else 0,
            "avg_latency_ms": sum(s["latencies"]) / len(s["latencies"]) if s["latencies"] else 0,
        }
        for method, s in method_stats.items()
    }

    return results


def experiment_fts_rerank_fusion(
    index_path: Path,
    queries: List[str],
    limit: int = 10,
    coarse_k: int = 50
) -> Dict[str, Any]:
    """Experiment: FTS + Rerank fusion vs standard hybrid.

    Compares:
    1. Standard Hybrid (SPLADE + Vector RRF)
    2. FTS + CrossEncoder Rerank -> then fuse with Vector
    """
    results = {
        "per_query": [],
        "summary": {}
    }

    # Initialize reranker
    try:
        from codexlens.semantic.reranker import get_reranker, check_reranker_available
        ok, _ = check_reranker_available("onnx")
        if ok:
            reranker = get_reranker(backend="onnx", use_gpu=True)
        else:
            reranker = None
    except Exception as e:
        print(f"Reranker unavailable: {e}")
        reranker = None

    for query in queries:
        query_result = {
            "query": query,
            "strategies": {}
        }

        # Strategy 1: Standard Hybrid (SPLADE + Vector)
        try:
            engine = HybridSearchEngine(weights=DEFAULT_WEIGHTS)
            engine._config = type('obj', (object,), {
                'enable_splade': True,
                'use_fts_fallback': False,
                'embedding_use_gpu': True,
            })()

            start = time.perf_counter()
            standard_results = engine.search(
                index_path, query, limit=limit,
                enable_vector=True
            )
            standard_latency = (time.perf_counter() - start) * 1000

            query_result["strategies"]["standard_hybrid"] = {
                "count": len(standard_results),
                "latency_ms": standard_latency,
                "top_5": [r.path.split("\\")[-1] for r in standard_results[:5]],
                "scores": [r.score for r in standard_results[:5]]
            }
        except Exception as e:
            query_result["strategies"]["standard_hybrid"] = {"error": str(e)}

        # Strategy 2: FTS + Rerank -> Fuse with Vector
        try:
            # Step 1: Get FTS results (coarse)
            fts_engine = HybridSearchEngine(weights=FTS_FALLBACK_WEIGHTS)
            fts_engine._config = type('obj', (object,), {
                'use_fts_fallback': True,
                'enable_splade': False,
                'embedding_use_gpu': True,
            })()

            start = time.perf_counter()
            fts_results = fts_engine.search(
                index_path, query, limit=coarse_k,
                enable_fuzzy=True, enable_vector=False
            )
            fts_latency = (time.perf_counter() - start) * 1000

            # Step 2: Rerank FTS results with CrossEncoder
            if reranker and fts_results:
                rerank_start = time.perf_counter()
                reranked_fts = cross_encoder_rerank(
                    query, fts_results, reranker, top_k=20
                )
                rerank_latency = (time.perf_counter() - rerank_start) * 1000
            else:
                reranked_fts = fts_results[:20]
                rerank_latency = 0

            # Step 3: Get Vector results
            vector_engine = HybridSearchEngine()
            vector_results = vector_engine.search(
                index_path, query, limit=20,
                enable_vector=True, pure_vector=True
            )

            # Step 4: Fuse reranked FTS with Vector
            if reranked_fts and vector_results:
                fusion_map = {
                    "fts_reranked": reranked_fts,
                    "vector": vector_results
                }
                fused_results = reciprocal_rank_fusion(
                    fusion_map,
                    weights={"fts_reranked": 0.5, "vector": 0.5},
                    k=60
                )
            else:
                fused_results = reranked_fts or vector_results or []

            total_latency = fts_latency + rerank_latency + (time.perf_counter() - start) * 1000

            query_result["strategies"]["fts_rerank_fusion"] = {
                "count": len(fused_results),
                "total_latency_ms": fts_latency + rerank_latency,
                "fts_latency_ms": fts_latency,
                "rerank_latency_ms": rerank_latency,
                "top_5": [r.path.split("\\")[-1] for r in fused_results[:5]],
                "scores": [r.score for r in fused_results[:5]]
            }
        except Exception as e:
            query_result["strategies"]["fts_rerank_fusion"] = {"error": str(e)}

        # Compute overlap between strategies
        if (
            "error" not in query_result["strategies"].get("standard_hybrid", {})
            and "error" not in query_result["strategies"].get("fts_rerank_fusion", {})
        ):
            standard_paths = set(r.path.split("\\")[-1] for r in standard_results[:10])
            fts_rerank_paths = set(r.path.split("\\")[-1] for r in fused_results[:10])

            overlap = len(standard_paths & fts_rerank_paths)
            query_result["comparison"] = {
                "top_10_overlap": overlap,
                "standard_unique": list(standard_paths - fts_rerank_paths)[:3],
                "fts_rerank_unique": list(fts_rerank_paths - standard_paths)[:3]
            }

        results["per_query"].append(query_result)

    return results


def main():
    """Run all analyses."""
    source_path = Path("D:/Claude_dms3/codex-lens/src")
    index_path = find_project_index(source_path)

    print(f"Using index: {index_path}")
    print(f"Index exists: {index_path.exists()}")
    print()

    # Test queries
    queries = [
        "binary quantization",
        "hamming distance search",
        "embeddings generation",
        "reranking algorithm",
        "database connection handling",
    ]

    # 1. Storage Architecture Analysis
    print("=" * 60)
    print("1. STORAGE ARCHITECTURE ANALYSIS")
    print("=" * 60)

    storage_analysis = analyze_storage_architecture(index_path)

    print("\nTable Overview:")
    for table, info in sorted(storage_analysis["tables"].items()):
        if "row_count" in info:
            print(f"  {table}: {info['row_count']} rows")

    print("\nConflicts Detected:")
    for conflict in storage_analysis["conflicts"]:
        print(f"  - {conflict['description']}")

    print("\nRecommendations:")
    for rec in storage_analysis["recommendations"]:
        print(f"  - {rec}")

    # 2. Method Contribution Analysis
    print("\n" + "=" * 60)
    print("2. METHOD CONTRIBUTION ANALYSIS")
    print("=" * 60)

    contribution_analysis = analyze_method_contributions(index_path, queries)

    print("\nPer-Query Results:")
    for qr in contribution_analysis["per_query"]:
        print(f"\n  Query: '{qr['query']}'")
        for method, data in qr["methods"].items():
            if "error" not in data:
                print(f"    {method}: {data['count']} results, {data['latency_ms']:.1f}ms")
                if data.get("top_3_files"):
                    print(f"      Top 3: {', '.join(data['top_3_files'])}")

        if qr.get("overlaps"):
            print("    Overlaps:")
            for pair, info in qr["overlaps"].items():
                print(f"      {pair}: {info['overlap_count']} common (Jaccard: {info['jaccard']:.2f})")

    print("\nSummary:")
    for method, stats in contribution_analysis["summary"].items():
        print(f"  {method}: avg {stats['avg_count']:.1f} results, {stats['avg_latency_ms']:.1f}ms")

    # 3. FTS + Rerank Fusion Experiment
    print("\n" + "=" * 60)
    print("3. FTS + RERANK FUSION EXPERIMENT")
    print("=" * 60)

    fusion_experiment = experiment_fts_rerank_fusion(index_path, queries)

    print("\nPer-Query Comparison:")
    for qr in fusion_experiment["per_query"]:
        print(f"\n  Query: '{qr['query']}'")
        for strategy, data in qr["strategies"].items():
            if "error" not in data:
                latency = data.get("total_latency_ms") or data.get("latency_ms", 0)
                print(f"    {strategy}: {data['count']} results, {latency:.1f}ms")
                if data.get("top_5"):
                    print(f"      Top 5: {', '.join(data['top_5'][:3])}...")

        if qr.get("comparison"):
            comp = qr["comparison"]
            print(f"    Top-10 Overlap: {comp['top_10_overlap']}/10")

    # Save full results
    output_path = Path(__file__).parent / "results" / "method_contribution_analysis.json"
    output_path.parent.mkdir(exist_ok=True)

    full_results = {
        "storage_analysis": storage_analysis,
        "contribution_analysis": contribution_analysis,
        "fusion_experiment": fusion_experiment
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(full_results, f, indent=2, default=str)

    print(f"\n\nFull results saved to: {output_path}")


if __name__ == "__main__":
    main()
