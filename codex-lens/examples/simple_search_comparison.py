"""Simple search method comparison using CLI commands.

Compares:
1. FTS (Full-Text Search)
2. Semantic (Dense + Rerank)
3. Hybrid (Future: FTS + Semantic fusion)

Usage:
    python examples/simple_search_comparison.py
"""

import subprocess
import time
import json
from pathlib import Path

def run_search(query: str, method: str, limit: int = 20) -> tuple[list, float]:
    """Run search via CLI and measure time."""
    cmd = [
        "python", "-m", "codexlens", "search",
        query,
        "--method", method,
        "--limit", str(limit),
        "--json",
        "-p", "."
    ]

    start = time.perf_counter()
    result = subprocess.run(
        cmd,
        cwd=str(Path("D:/Claude_dms3/codex-lens/src")),
        capture_output=True,
        text=True,
    )
    elapsed = time.perf_counter() - start

    if result.returncode != 0:
        print(f"Error running {method} search:")
        print(result.stderr)
        return [], elapsed

    try:
        data = json.loads(result.stdout)
        return data.get("results", []), elapsed
    except json.JSONDecodeError:
        print(f"Failed to parse JSON output for {method}")
        return [], elapsed


def print_comparison(query: str):
    """Print comparison for a single query."""
    print(f"\n{'='*80}")
    print(f"Query: {query}")
    print(f"{'='*80}\n")

    # Method 1: FTS
    print("Method 1: FTS (Full-Text Search)")
    results_fts, time_fts = run_search(query, "fts", 20)
    print(f"  Time: {time_fts*1000:.2f}ms")
    print(f"  Results: {len(results_fts)}")
    if results_fts:
        print(f"  Top 3:")
        for i, r in enumerate(results_fts[:3], 1):
            path = r.get("path", "").replace("D:\\Claude_dms3\\codex-lens\\src\\", "")
            score = r.get("score", 0)
            print(f"    {i}. [{score:.4f}] {path}")
    print()

    # Method 2: Semantic (Dense + Rerank)
    print("Method 2: Semantic (Dense + Rerank)")
    results_semantic, time_semantic = run_search(query, "dense_rerank", 20)
    print(f"  Time: {time_semantic*1000:.2f}ms")
    print(f"  Results: {len(results_semantic)}")
    if results_semantic:
        print(f"  Top 3:")
        for i, r in enumerate(results_semantic[:3], 1):
            path = r.get("path", "").replace("D:\\Claude_dms3\\codex-lens\\src\\", "")
            score = r.get("score", 0)
            print(f"    {i}. [{score:.4f}] {path}")
    print()

    # Summary
    print(f"Summary:")
    print(f"  FTS:      {time_fts*1000:8.2f}ms  {len(results_fts):3d} results")
    print(f"  Semantic: {time_semantic*1000:8.2f}ms  {len(results_semantic):3d} results")
    print(f"  Speedup:  {time_semantic/time_fts:6.2f}x (FTS faster)")


def main():
    """Main comparison entry point."""
    queries = [
        "vector search",
        "LSP call hierarchy",
        "search ranking",
        "index building",
    ]

    print("Search Method Comparison")
    print("=" * 80)

    for query in queries:
        print_comparison(query)

    print(f"\n{'='*80}")
    print("Comparison complete")
    print(f"{'='*80}")


if __name__ == "__main__":
    main()
