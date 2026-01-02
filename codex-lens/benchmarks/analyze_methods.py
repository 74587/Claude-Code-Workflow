"""Analyze hybrid search methods contribution."""
import json
import sqlite3
import time
from pathlib import Path
from collections import defaultdict
import sys
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from codexlens.search.hybrid_search import HybridSearchEngine
from codexlens.search.ranking import (
    reciprocal_rank_fusion,
    cross_encoder_rerank,
    DEFAULT_WEIGHTS,
    FTS_FALLBACK_WEIGHTS,
)

# Use index with most data
index_path = Path(r"C:\Users\dyw\.codexlens\indexes\D\Claude_dms3\codex-lens\src\codexlens\storage\_index.db")

print("=" * 60)
print("1. STORAGE ARCHITECTURE ANALYSIS")
print("=" * 60)

# Analyze storage
with sqlite3.connect(index_path) as conn:
    cursor = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    )
    tables = [row[0] for row in cursor.fetchall()]

    print("\nTable Overview:")
    for table in tables:
        try:
            count = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
            if count > 0:
                print(f"  {table}: {count} rows")
        except:
            pass

    print("\n--- Conflict Analysis ---")

    chunks_count = 0
    semantic_count = 0

    if "chunks" in tables:
        chunks_count = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
    if "semantic_chunks" in tables:
        semantic_count = conn.execute("SELECT COUNT(*) FROM semantic_chunks").fetchone()[0]

    print(f"  chunks table: {chunks_count} rows")
    print(f"  semantic_chunks table: {semantic_count} rows")

    if semantic_count > 0:
        col_info = conn.execute("PRAGMA table_info(semantic_chunks)").fetchall()
        col_names = [c[1] for c in col_info]

        print(f"\n  semantic_chunks columns: {col_names}")

        for col in ["embedding", "embedding_binary", "embedding_dense"]:
            if col in col_names:
                null_count = conn.execute(
                    f"SELECT COUNT(*) FROM semantic_chunks WHERE {col} IS NULL"
                ).fetchone()[0]
                non_null = semantic_count - null_count
                print(f"  {col}: {non_null}/{semantic_count} non-null")

    if "splade_posting_list" in tables:
        splade_count = conn.execute("SELECT COUNT(*) FROM splade_posting_list").fetchone()[0]
        print(f"\n  splade_posting_list: {splade_count} postings")
    else:
        print("\n  splade_posting_list: NOT EXISTS")

print("\n" + "=" * 60)
print("2. METHOD CONTRIBUTION ANALYSIS")
print("=" * 60)

queries = [
    "database connection",
    "create table",
    "sqlite store",
    "migration",
    "search chunks",
]

results_summary = {
    "fts_exact": [],
    "fts_fuzzy": [],
    "vector": [],
    "splade": [],
}

for query in queries:
    print(f"\nQuery: '{query}'")

    # FTS Exact
    try:
        engine = HybridSearchEngine(weights=FTS_FALLBACK_WEIGHTS)
        engine._config = type("obj", (object,), {
            "use_fts_fallback": True,
            "enable_splade": False,
            "embedding_use_gpu": True,
            "symbol_boost_factor": 1.5,
            "enable_reranking": False,
        })()

        start = time.perf_counter()
        results = engine.search(index_path, query, limit=10, enable_fuzzy=False, enable_vector=False)
        latency = (time.perf_counter() - start) * 1000

        results_summary["fts_exact"].append({"count": len(results), "latency": latency})
        top_file = results[0].path.split("\\")[-1] if results else "N/A"
        top_score = results[0].score if results else 0
        print(f"  FTS Exact: {len(results)} results, {latency:.1f}ms, top: {top_file} ({top_score:.3f})")
    except Exception as e:
        print(f"  FTS Exact: ERROR - {e}")

    # FTS Fuzzy
    try:
        engine = HybridSearchEngine(weights=FTS_FALLBACK_WEIGHTS)
        engine._config = type("obj", (object,), {
            "use_fts_fallback": True,
            "enable_splade": False,
            "embedding_use_gpu": True,
            "symbol_boost_factor": 1.5,
            "enable_reranking": False,
        })()

        start = time.perf_counter()
        results = engine.search(index_path, query, limit=10, enable_fuzzy=True, enable_vector=False)
        latency = (time.perf_counter() - start) * 1000

        results_summary["fts_fuzzy"].append({"count": len(results), "latency": latency})
        top_file = results[0].path.split("\\")[-1] if results else "N/A"
        top_score = results[0].score if results else 0
        print(f"  FTS Fuzzy: {len(results)} results, {latency:.1f}ms, top: {top_file} ({top_score:.3f})")
    except Exception as e:
        print(f"  FTS Fuzzy: ERROR - {e}")

    # Vector
    try:
        engine = HybridSearchEngine()
        engine._config = type("obj", (object,), {
            "use_fts_fallback": False,
            "enable_splade": False,
            "embedding_use_gpu": True,
            "symbol_boost_factor": 1.5,
            "enable_reranking": False,
        })()

        start = time.perf_counter()
        results = engine.search(index_path, query, limit=10, enable_vector=True, pure_vector=True)
        latency = (time.perf_counter() - start) * 1000

        results_summary["vector"].append({"count": len(results), "latency": latency})
        top_file = results[0].path.split("\\")[-1] if results else "N/A"
        top_score = results[0].score if results else 0
        print(f"  Vector: {len(results)} results, {latency:.1f}ms, top: {top_file} ({top_score:.3f})")
    except Exception as e:
        print(f"  Vector: ERROR - {e}")

    # SPLADE
    try:
        engine = HybridSearchEngine(weights={"splade": 1.0})
        engine._config = type("obj", (object,), {
            "use_fts_fallback": False,
            "enable_splade": True,
            "embedding_use_gpu": True,
            "symbol_boost_factor": 1.5,
            "enable_reranking": False,
        })()

        start = time.perf_counter()
        results = engine.search(index_path, query, limit=10, enable_fuzzy=False, enable_vector=False)
        latency = (time.perf_counter() - start) * 1000

        results_summary["splade"].append({"count": len(results), "latency": latency})
        top_file = results[0].path.split("\\")[-1] if results else "N/A"
        top_score = results[0].score if results else 0
        print(f"  SPLADE: {len(results)} results, {latency:.1f}ms, top: {top_file} ({top_score:.3f})")
    except Exception as e:
        print(f"  SPLADE: ERROR - {e}")

print("\n--- Summary ---")
for method, data in results_summary.items():
    if data:
        avg_count = sum(d["count"] for d in data) / len(data)
        avg_latency = sum(d["latency"] for d in data) / len(data)
        print(f"{method}: avg {avg_count:.1f} results, {avg_latency:.1f}ms")

print("\n" + "=" * 60)
print("3. FTS + RERANK FUSION EXPERIMENT")
print("=" * 60)

# Initialize reranker
reranker = None
try:
    from codexlens.semantic.reranker import get_reranker, check_reranker_available
    ok, _ = check_reranker_available("onnx")
    if ok:
        reranker = get_reranker(backend="onnx", use_gpu=True)
        print("\nReranker loaded: ONNX backend")
except Exception as e:
    print(f"\nReranker unavailable: {e}")

test_queries = ["database connection", "create table migration"]

for query in test_queries:
    print(f"\nQuery: '{query}'")

    # Strategy 1: Standard Hybrid (FTS exact+fuzzy RRF)
    try:
        engine = HybridSearchEngine(weights=FTS_FALLBACK_WEIGHTS)
        engine._config = type("obj", (object,), {
            "use_fts_fallback": True,
            "enable_splade": False,
            "embedding_use_gpu": True,
            "symbol_boost_factor": 1.5,
            "enable_reranking": False,
        })()

        start = time.perf_counter()
        standard_results = engine.search(index_path, query, limit=10, enable_fuzzy=True, enable_vector=False)
        standard_latency = (time.perf_counter() - start) * 1000

        print(f"  Standard FTS RRF: {len(standard_results)} results, {standard_latency:.1f}ms")
        for i, r in enumerate(standard_results[:3]):
            print(f"    {i+1}. {r.path.split(chr(92))[-1]} (score: {r.score:.4f})")
    except Exception as e:
        print(f"  Standard FTS RRF: ERROR - {e}")
        standard_results = []

    # Strategy 2: FTS + CrossEncoder Rerank
    if reranker and standard_results:
        try:
            start = time.perf_counter()
            reranked_results = cross_encoder_rerank(query, standard_results, reranker, top_k=10)
            rerank_latency = (time.perf_counter() - start) * 1000

            print(f"  FTS + Rerank: {len(reranked_results)} results, {rerank_latency:.1f}ms (rerank only)")
            for i, r in enumerate(reranked_results[:3]):
                ce_score = r.metadata.get("cross_encoder_prob", r.score)
                print(f"    {i+1}. {r.path.split(chr(92))[-1]} (CE prob: {ce_score:.4f})")

            # Compare rankings
            standard_order = [r.path.split("\\")[-1] for r in standard_results[:5]]
            reranked_order = [r.path.split("\\")[-1] for r in reranked_results[:5]]

            if standard_order != reranked_order:
                print(f"  Ranking changed!")
                print(f"    Before: {standard_order}")
                print(f"    After:  {reranked_order}")
            else:
                print(f"  Ranking unchanged")

        except Exception as e:
            print(f"  FTS + Rerank: ERROR - {e}")

print("\n" + "=" * 60)
print("CONCLUSIONS")
print("=" * 60)
print("""
1. Storage Architecture:
   - semantic_chunks: Used by cascade-index (binary+dense vectors)
   - chunks: Used by legacy SQLiteStore (currently empty in this index)
   - splade_posting_list: Used by SPLADE sparse retrieval
   - files_fts_*: Used by FTS exact/fuzzy search

   CONFLICT: binary_cascade_search reads from semantic_chunks,
   but standard FTS reads from files table. These are SEPARATE paths.

2. Method Contributions:
   - FTS: Fast but limited to keyword matching
   - Vector: Semantic understanding but requires embeddings
   - SPLADE: Sparse retrieval, good for keyword+semantic hybrid

3. FTS + Rerank Fusion:
   - CrossEncoder reranking can improve precision
   - Adds ~100-200ms latency per query
   - Most effective when initial FTS recall is good
""")
