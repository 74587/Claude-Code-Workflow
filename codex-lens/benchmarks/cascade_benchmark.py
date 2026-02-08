#!/usr/bin/env python
"""Benchmark script for comparing cascade search strategies.

Compares:
- binary: 256-dim binary coarse ranking + 2048-dim dense fine ranking
- hybrid: FTS+Vector coarse ranking + CrossEncoder fine ranking

Usage:
    python benchmarks/cascade_benchmark.py [--source PATH] [--queries N] [--warmup N]
"""

from __future__ import annotations

import argparse
import gc
import json
import os
import statistics
import sys
import time
import traceback
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Optional, Dict, Any

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from codexlens.search.chain_search import ChainSearchEngine, SearchOptions
from codexlens.config import Config
from codexlens.storage.registry import RegistryStore
from codexlens.storage.path_mapper import PathMapper


@dataclass
class BenchmarkResult:
    """Result from a single benchmark run."""
    strategy: str
    query: str
    latency_ms: float
    num_results: int
    top_result: Optional[str]
    error: Optional[str] = None


@dataclass
class BenchmarkSummary:
    """Aggregated benchmark statistics."""
    strategy: str
    total_queries: int
    successful_queries: int
    avg_latency_ms: float
    min_latency_ms: float
    max_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    avg_results: float
    errors: List[str]


# Default test queries covering different scenarios
DEFAULT_QUERIES = [
    # Code patterns
    "def search",
    "class Engine",
    "import numpy",
    "async def",
    "raise ValueError",
    # Semantic queries
    "how to parse json",
    "database connection",
    "error handling",
    "authentication logic",
    "file read write",
    # Technical terms
    "embedding vector",
    "cosine similarity",
    "binary quantization",
    "hamming distance",
    "reranking",
]


def percentile(data: List[float], p: float) -> float:
    """Calculate percentile of sorted data."""
    if not data:
        return 0.0
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * (p / 100)
    f = int(k)
    c = f + 1 if f + 1 < len(sorted_data) else f
    return sorted_data[f] + (k - f) * (sorted_data[c] - sorted_data[f])


def run_single_benchmark(
    engine: ChainSearchEngine,
    query: str,
    source_path: Path,
    strategy: str,
    options: Optional[SearchOptions] = None,
) -> BenchmarkResult:
    """Run a single benchmark query."""
    gc.collect()
    
    start_time = time.perf_counter()
    try:
        result = engine.cascade_search(
            query=query,
            source_path=source_path,
            k=10,
            coarse_k=100,
            options=options,
            strategy=strategy,
        )
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        
        top_result = None
        if result.results:
            r = result.results[0]
            line = r.start_line or 0
            top_result = f"{r.path}:{line}"
        
        return BenchmarkResult(
            strategy=strategy,
            query=query,
            latency_ms=elapsed_ms,
            num_results=len(result.results),
            top_result=top_result,
        )
    except Exception as e:
        elapsed_ms = (time.perf_counter() - start_time) * 1000
        return BenchmarkResult(
            strategy=strategy,
            query=query,
            latency_ms=elapsed_ms,
            num_results=0,
            top_result=None,
            error=str(e),
        )


def run_benchmarks(
    source_path: Path,
    queries: List[str],
    strategies: List[str],
    warmup_runs: int = 2,
    options: Optional[SearchOptions] = None,
) -> Dict[str, List[BenchmarkResult]]:
    """Run benchmarks for all queries and strategies."""
    
    print(f"\n{'='*60}")
    print(f"Cascade Search Benchmark")
    print(f"{'='*60}")
    print(f"Source: {source_path}")
    print(f"Queries: {len(queries)}")
    print(f"Strategies: {strategies}")
    print(f"Warmup runs: {warmup_runs}")
    print(f"{'='*60}\n")
    
    # Initialize engine
    config = Config()
    registry = RegistryStore()  # Uses default path
    registry.initialize()
    mapper = PathMapper()  # Uses default path
    engine = ChainSearchEngine(registry=registry, mapper=mapper, config=config)
    
    results: Dict[str, List[BenchmarkResult]] = {s: [] for s in strategies}
    
    # Warmup phase
    if warmup_runs > 0:
        print(f"Running {warmup_runs} warmup queries...")
        warmup_query = queries[0] if queries else "test"
        for strategy in strategies:
            for _ in range(warmup_runs):
                try:
                    run_single_benchmark(engine, warmup_query, source_path, strategy, options)
                except Exception:
                    pass
        print("Warmup complete.\n")
    
    # Benchmark phase
    total_runs = len(queries) * len(strategies)
    current_run = 0
    
    for query in queries:
        for strategy in strategies:
            current_run += 1
            print(f"[{current_run}/{total_runs}] {strategy}: '{query[:40]}...' ", end="", flush=True)
            
            result = run_single_benchmark(engine, query, source_path, strategy, options)
            results[strategy].append(result)
            
            if result.error:
                print(f"ERROR: {result.error[:50]}")
            else:
                print(f"{result.latency_ms:.1f}ms, {result.num_results} results")
    
    return results


def summarize_results(results: Dict[str, List[BenchmarkResult]]) -> Dict[str, BenchmarkSummary]:
    """Generate summary statistics for each strategy."""
    summaries = {}
    
    for strategy, benchmark_results in results.items():
        latencies = [r.latency_ms for r in benchmark_results if r.error is None]
        result_counts = [r.num_results for r in benchmark_results if r.error is None]
        errors = [r.error for r in benchmark_results if r.error is not None]
        
        if latencies:
            summary = BenchmarkSummary(
                strategy=strategy,
                total_queries=len(benchmark_results),
                successful_queries=len(latencies),
                avg_latency_ms=statistics.mean(latencies),
                min_latency_ms=min(latencies),
                max_latency_ms=max(latencies),
                p50_latency_ms=percentile(latencies, 50),
                p95_latency_ms=percentile(latencies, 95),
                p99_latency_ms=percentile(latencies, 99),
                avg_results=statistics.mean(result_counts) if result_counts else 0,
                errors=errors,
            )
        else:
            summary = BenchmarkSummary(
                strategy=strategy,
                total_queries=len(benchmark_results),
                successful_queries=0,
                avg_latency_ms=0,
                min_latency_ms=0,
                max_latency_ms=0,
                p50_latency_ms=0,
                p95_latency_ms=0,
                p99_latency_ms=0,
                avg_results=0,
                errors=errors,
            )
        
        summaries[strategy] = summary
    
    return summaries


def print_comparison_table(summaries: Dict[str, BenchmarkSummary]) -> None:
    """Print formatted comparison table."""
    print(f"\n{'='*80}")
    print("BENCHMARK RESULTS COMPARISON")
    print(f"{'='*80}\n")
    
    # Header
    print(f"{'Metric':<25} {'Binary':>15} {'Hybrid':>15} {'Diff':>15}")
    print(f"{'-'*25} {'-'*15} {'-'*15} {'-'*15}")
    
    binary = summaries.get("binary")
    hybrid = summaries.get("hybrid")
    
    if not binary or not hybrid:
        print("Missing results for comparison")
        return
    
    metrics = [
        ("Total Queries", binary.total_queries, hybrid.total_queries),
        ("Successful", binary.successful_queries, hybrid.successful_queries),
        ("Avg Latency (ms)", binary.avg_latency_ms, hybrid.avg_latency_ms),
        ("Min Latency (ms)", binary.min_latency_ms, hybrid.min_latency_ms),
        ("Max Latency (ms)", binary.max_latency_ms, hybrid.max_latency_ms),
        ("P50 Latency (ms)", binary.p50_latency_ms, hybrid.p50_latency_ms),
        ("P95 Latency (ms)", binary.p95_latency_ms, hybrid.p95_latency_ms),
        ("P99 Latency (ms)", binary.p99_latency_ms, hybrid.p99_latency_ms),
        ("Avg Results", binary.avg_results, hybrid.avg_results),
    ]
    
    for name, b_val, h_val in metrics:
        if isinstance(b_val, float):
            diff = b_val - h_val
            diff_str = f"{diff:+.2f}" if diff != 0 else "0.00"
            speedup = h_val / b_val if b_val > 0 else 0
            if "Latency" in name and speedup > 1:
                diff_str += f" ({speedup:.1f}x faster)"
            print(f"{name:<25} {b_val:>15.2f} {h_val:>15.2f} {diff_str:>15}")
        else:
            diff = b_val - h_val
            print(f"{name:<25} {b_val:>15} {h_val:>15} {diff:>+15}")
    
    # Errors
    print(f"\n{'Errors:':<25}")
    print(f"  Binary: {len(binary.errors)}")
    for err in binary.errors[:3]:
        print(f"    - {err[:60]}...")
    print(f"  Hybrid: {len(hybrid.errors)}")
    for err in hybrid.errors[:3]:
        print(f"    - {err[:60]}...")
    
    # Winner
    print(f"\n{'='*80}")
    if binary.avg_latency_ms < hybrid.avg_latency_ms and binary.successful_queries > 0:
        speedup = hybrid.avg_latency_ms / binary.avg_latency_ms
        print(f"[WINNER] Binary ({speedup:.2f}x faster average latency)")
    elif hybrid.avg_latency_ms < binary.avg_latency_ms and hybrid.successful_queries > 0:
        speedup = binary.avg_latency_ms / hybrid.avg_latency_ms
        print(f"[WINNER] Hybrid ({speedup:.2f}x faster average latency)")
    else:
        print("No clear winner (check errors)")
    print(f"{'='*80}\n")


def save_results(
    results: Dict[str, List[BenchmarkResult]],
    summaries: Dict[str, BenchmarkSummary],
    output_path: Path,
) -> None:
    """Save benchmark results to JSON file."""
    data = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "summaries": {k: asdict(v) for k, v in summaries.items()},
        "details": {
            k: [asdict(r) for r in v]
            for k, v in results.items()
        },
    }
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    
    print(f"Results saved to: {output_path}")


def main():
    parser = argparse.ArgumentParser(description="Benchmark cascade search strategies")
    parser.add_argument(
        "--source", "-s",
        type=Path,
        default=Path(__file__).parent.parent / "src",
        help="Source directory to search (default: ./src)",
    )
    parser.add_argument(
        "--queries", "-q",
        type=int,
        default=len(DEFAULT_QUERIES),
        help=f"Number of queries to run (default: {len(DEFAULT_QUERIES)})",
    )
    parser.add_argument(
        "--warmup", "-w",
        type=int,
        default=2,
        help="Number of warmup runs (default: 2)",
    )
    parser.add_argument(
        "--output", "-o",
        type=Path,
        default=Path(__file__).parent / "results" / "cascade_benchmark.json",
        help="Output file for results (default: benchmarks/results/cascade_benchmark.json)",
    )
    parser.add_argument(
        "--strategies",
        nargs="+",
        default=["binary", "hybrid"],
        choices=["binary", "hybrid"],
        help="Strategies to benchmark (default: both)",
    )
    
    args = parser.parse_args()
    
    # Validate source path
    if not args.source.exists():
        print(f"Error: Source path does not exist: {args.source}")
        sys.exit(1)
    
    # Select queries
    queries = DEFAULT_QUERIES[:args.queries]
    
    # Run benchmarks
    try:
        results = run_benchmarks(
            source_path=args.source,
            queries=queries,
            strategies=args.strategies,
            warmup_runs=args.warmup,
        )
        
        # Generate summaries
        summaries = summarize_results(results)
        
        # Print comparison
        print_comparison_table(summaries)
        
        # Save results
        save_results(results, summaries, args.output)
        
    except KeyboardInterrupt:
        print("\nBenchmark interrupted.")
        sys.exit(1)
    except Exception as e:
        print(f"\nBenchmark failed: {e}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
