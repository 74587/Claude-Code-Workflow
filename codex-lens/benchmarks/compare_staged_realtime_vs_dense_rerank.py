#!/usr/bin/env python
"""Compare staged realtime LSP pipeline vs direct dense->rerank cascade.

This benchmark compares two retrieval pipelines:
1) staged+realtime: coarse (binary or dense fallback) -> realtime LSP graph expand -> clustering -> rerank
2) dense_rerank: dense ANN coarse -> cross-encoder rerank

Because most repos do not have ground-truth labels, this script reports:
- latency statistics
- top-k overlap metrics (Jaccard + RBO)
- diversity proxies (unique files/dirs)
- staged pipeline stage stats (if present)

Usage:
  python benchmarks/compare_staged_realtime_vs_dense_rerank.py --source ./src
  python benchmarks/compare_staged_realtime_vs_dense_rerank.py --queries-file benchmarks/queries.txt
"""

from __future__ import annotations

import argparse
import gc
import json
import os
import re
import statistics
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

# Add src to path (match other benchmark scripts)
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from codexlens.config import Config
from codexlens.search.chain_search import ChainSearchEngine, SearchOptions
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore


DEFAULT_QUERIES = [
    "class Config",
    "def search",
    "LspBridge",
    "graph expansion",
    "clustering strategy",
    "error handling",
    "how to parse json",
]


def _now_ms() -> float:
    return time.perf_counter() * 1000.0


def _safe_relpath(path: str, root: Path) -> str:
    try:
        return str(Path(path).resolve().relative_to(root.resolve()))
    except Exception:
        return path


def _normalize_path_key(path: str) -> str:
    """Normalize file paths for overlap/dedup metrics (Windows-safe)."""
    try:
        p = Path(path)
        # Don't explode on non-files like "<memory>".
        if str(p) and (p.is_absolute() or re.match(r"^[A-Za-z]:", str(p))):
            norm = str(p.resolve())
        else:
            norm = str(p)
    except Exception:
        norm = path
    norm = norm.replace("/", "\\")
    if os.name == "nt":
        norm = norm.lower()
    return norm


def _extract_stage_stats(errors: List[str]) -> Optional[Dict[str, Any]]:
    """Extract STAGE_STATS JSON blob from SearchStats.errors."""
    for item in errors or []:
        if not isinstance(item, str):
            continue
        if not item.startswith("STAGE_STATS:"):
            continue
        payload = item[len("STAGE_STATS:") :]
        try:
            return json.loads(payload)
        except Exception:
            return None
    return None


def jaccard_topk(a: List[str], b: List[str]) -> float:
    sa, sb = set(a), set(b)
    if not sa and not sb:
        return 1.0
    if not sa or not sb:
        return 0.0
    return len(sa & sb) / len(sa | sb)


def rbo(a: List[str], b: List[str], p: float = 0.9) -> float:
    """Rank-biased overlap for two ranked lists."""
    if p <= 0.0 or p >= 1.0:
        raise ValueError("p must be in (0, 1)")
    if not a and not b:
        return 1.0

    depth = max(len(a), len(b))
    seen_a: set[str] = set()
    seen_b: set[str] = set()

    score = 0.0
    for d in range(1, depth + 1):
        if d <= len(a):
            seen_a.add(a[d - 1])
        if d <= len(b):
            seen_b.add(b[d - 1])
        overlap = len(seen_a & seen_b)
        score += (overlap / d) * ((1.0 - p) * (p ** (d - 1)))
    return score


def _unique_parent_dirs(paths: Iterable[str]) -> int:
    dirs = set()
    for p in paths:
        try:
            dirs.add(str(Path(p).parent))
        except Exception:
            continue
    return len(dirs)


@dataclass
class RunDetail:
    strategy: str
    query: str
    latency_ms: float
    num_results: int
    topk_paths: List[str]
    stage_stats: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


@dataclass
class CompareDetail:
    query: str
    staged: RunDetail
    dense_rerank: RunDetail
    jaccard_topk: float
    rbo_topk: float
    staged_unique_files_topk: int
    dense_unique_files_topk: int
    staged_unique_dirs_topk: int
    dense_unique_dirs_topk: int


def _run_once(
    engine: ChainSearchEngine,
    query: str,
    source_path: Path,
    *,
    strategy: str,
    k: int,
    coarse_k: int,
    options: Optional[SearchOptions] = None,
) -> RunDetail:
    gc.collect()
    start_ms = _now_ms()
    try:
        result = engine.cascade_search(
            query=query,
            source_path=source_path,
            k=k,
            coarse_k=coarse_k,
            options=options,
            strategy=strategy,
        )
        latency_ms = _now_ms() - start_ms
        paths_raw = [r.path for r in (result.results or []) if getattr(r, "path", None)]
        paths = [_normalize_path_key(p) for p in paths_raw]
        topk: List[str] = []
        seen: set[str] = set()
        for p in paths:
            if p in seen:
                continue
            seen.add(p)
            topk.append(p)
            if len(topk) >= k:
                break
        stage_stats = _extract_stage_stats(getattr(result.stats, "errors", []))
        return RunDetail(
            strategy=strategy,
            query=query,
            latency_ms=latency_ms,
            num_results=len(paths),
            topk_paths=topk,
            stage_stats=stage_stats,
        )
    except Exception as exc:
        latency_ms = _now_ms() - start_ms
        return RunDetail(
            strategy=strategy,
            query=query,
            latency_ms=latency_ms,
            num_results=0,
            topk_paths=[],
            stage_stats=None,
            error=repr(exc),
        )


def _load_queries(path: Optional[Path], limit: Optional[int]) -> List[str]:
    if path is None:
        queries = list(DEFAULT_QUERIES)
    else:
        raw = path.read_text(encoding="utf-8", errors="ignore").splitlines()
        queries = []
        for line in raw:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            queries.append(line)
    if limit is not None:
        return queries[:limit]
    return queries


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Compare staged realtime LSP pipeline vs direct dense_rerank cascade"
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=Path(__file__).parent.parent / "src",
        help="Source directory to search (default: ./src)",
    )
    parser.add_argument(
        "--queries-file",
        type=Path,
        default=None,
        help="Optional file with one query per line (# comments supported)",
    )
    parser.add_argument("--queries", type=int, default=None, help="Limit number of queries")
    parser.add_argument("--k", type=int, default=10, help="Final result count (default 10)")
    parser.add_argument("--coarse-k", type=int, default=100, help="Coarse candidates (default 100)")
    parser.add_argument("--warmup", type=int, default=1, help="Warmup runs per strategy (default 1)")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).parent / "results" / "staged_realtime_vs_dense_rerank.json",
        help="Output JSON path",
    )
    args = parser.parse_args()

    if not args.source.exists():
        raise SystemExit(f"Source path does not exist: {args.source}")

    queries = _load_queries(args.queries_file, args.queries)
    if not queries:
        raise SystemExit("No queries to run")

    # Match CLI behavior: load settings + apply global/workspace .env overrides.
    # This is important on Windows where ONNX/DirectML can sometimes crash under load;
    # many users pin EMBEDDING_BACKEND=litellm in ~/.codexlens/.env for stability.
    config = Config.load()
    config.cascade_strategy = "staged"
    config.staged_stage2_mode = "realtime"
    config.enable_staged_rerank = True
    # Stability: on some Windows setups, fastembed + DirectML can crash under load.
    # Dense_rerank uses the embedding backend that matches the index; force CPU here.
    config.embedding_use_gpu = False
    registry = RegistryStore()
    registry.initialize()
    mapper = PathMapper()
    engine = ChainSearchEngine(registry=registry, mapper=mapper, config=config)

    try:
        strategies = ["staged", "dense_rerank"]

        # Warmup
        if args.warmup > 0:
            warm_query = queries[0]
            for s in strategies:
                for _ in range(args.warmup):
                    try:
                        _run_once(
                            engine,
                            warm_query,
                            args.source,
                            strategy=s,
                            k=min(args.k, 5),
                            coarse_k=min(args.coarse_k, 50),
                        )
                    except Exception:
                        pass

        comparisons: List[CompareDetail] = []

        for i, query in enumerate(queries, start=1):
            print(f"[{i}/{len(queries)}] {query}")

            staged = _run_once(
                engine,
                query,
                args.source,
                strategy="staged",
                k=args.k,
                coarse_k=args.coarse_k,
            )
            dense = _run_once(
                engine,
                query,
                args.source,
                strategy="dense_rerank",
                k=args.k,
                coarse_k=args.coarse_k,
            )

            staged_paths = staged.topk_paths
            dense_paths = dense.topk_paths

            comparisons.append(
                CompareDetail(
                    query=query,
                    staged=staged,
                    dense_rerank=dense,
                    jaccard_topk=jaccard_topk(staged_paths, dense_paths),
                    rbo_topk=rbo(staged_paths, dense_paths, p=0.9),
                    staged_unique_files_topk=len(set(staged_paths)),
                    dense_unique_files_topk=len(set(dense_paths)),
                    staged_unique_dirs_topk=_unique_parent_dirs(staged_paths),
                    dense_unique_dirs_topk=_unique_parent_dirs(dense_paths),
                )
            )

        def _latencies(details: List[RunDetail]) -> List[float]:
            return [d.latency_ms for d in details if not d.error]

        staged_runs = [c.staged for c in comparisons]
        dense_runs = [c.dense_rerank for c in comparisons]

        summary = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "source": str(args.source),
            "k": args.k,
            "coarse_k": args.coarse_k,
            "query_count": len(comparisons),
            "avg_jaccard_topk": statistics.mean([c.jaccard_topk for c in comparisons]) if comparisons else 0.0,
            "avg_rbo_topk": statistics.mean([c.rbo_topk for c in comparisons]) if comparisons else 0.0,
            "staged": {
                "success": sum(1 for r in staged_runs if not r.error),
                "avg_latency_ms": statistics.mean(_latencies(staged_runs)) if _latencies(staged_runs) else 0.0,
            },
            "dense_rerank": {
                "success": sum(1 for r in dense_runs if not r.error),
                "avg_latency_ms": statistics.mean(_latencies(dense_runs)) if _latencies(dense_runs) else 0.0,
            },
        }

        args.output.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "summary": summary,
            "comparisons": [asdict(c) for c in comparisons],
        }
        args.output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        print(f"\nSaved: {args.output}")
    finally:
        try:
            engine.close()
        except Exception as exc:
            print(f"WARNING engine.close() failed: {exc!r}", file=sys.stderr)
        try:
            registry.close()
        except Exception as exc:
            print(f"WARNING registry.close() failed: {exc!r}", file=sys.stderr)


if __name__ == "__main__":
    main()
