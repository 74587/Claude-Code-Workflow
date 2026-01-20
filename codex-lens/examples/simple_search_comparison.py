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
import re
import os
from pathlib import Path

def strip_ansi(text: str) -> str:
    """Remove ANSI color codes from text."""
    ansi_escape = re.compile(r'\x1b\[[0-9;]*m')
    return ansi_escape.sub('', text)

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
        env={**os.environ, "NO_COLOR": "1"},  # Try to disable colors
    )
    elapsed = time.perf_counter() - start

    if result.returncode != 0:
        print(f"Error running {method} search:")
        print(result.stderr[:200])
        return [], elapsed

    try:
        # Strip ANSI codes and parse JSON
        clean_output = strip_ansi(result.stdout)
        data = json.loads(clean_output)
        # Results are nested in "result" object
        if "result" in data and "results" in data["result"]:
            return data["result"]["results"], elapsed
        return data.get("results", []), elapsed
    except json.JSONDecodeError as e:
        print(f"Failed to parse JSON output for {method}: {e}")
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
