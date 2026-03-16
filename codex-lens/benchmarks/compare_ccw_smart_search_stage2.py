#!/usr/bin/env python
"""Benchmark local-only staged stage2 modes for CCW smart_search queries.

This benchmark reuses the existing CodexLens benchmark style, but focuses on
the real search intents that drive CCW `smart_search`. It evaluates:

1. `dense_rerank` baseline
2. `staged` + `precomputed`
3. `staged` + `realtime`
4. `staged` + `static_global_graph`

Metrics:
  - Hit@K
  - MRR@K
  - Recall@K
  - latency (avg/p50/p95)

The runner is intentionally local-only. By default it uses:
  - embedding backend: `fastembed`
  - reranker backend: `onnx`

Examples:
  python benchmarks/compare_ccw_smart_search_stage2.py --dry-run
  python benchmarks/compare_ccw_smart_search_stage2.py --self-check
  python benchmarks/compare_ccw_smart_search_stage2.py --source .. --k 10
  python benchmarks/compare_ccw_smart_search_stage2.py --embedding-model code --reranker-model cross-encoder/ms-marco-MiniLM-L-6-v2
"""

from __future__ import annotations

import argparse
from copy import deepcopy
import gc
import json
import os
import re
import statistics
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from codexlens.config import Config
from codexlens.search.chain_search import ChainSearchEngine, SearchOptions
from codexlens.search.ranking import (
    QueryIntent,
    detect_query_intent,
    is_generated_artifact_path,
    is_test_file,
    query_prefers_lexical_search,
    query_targets_generated_files,
)
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore


DEFAULT_SOURCE = Path(__file__).resolve().parents[2]
DEFAULT_QUERIES_FILE = Path(__file__).parent / "accuracy_queries_ccw_smart_search.jsonl"
DEFAULT_OUTPUT = Path(__file__).parent / "results" / "ccw_smart_search_stage2.json"

VALID_STAGE2_MODES = ("precomputed", "realtime", "static_global_graph")
VALID_LOCAL_EMBEDDING_BACKENDS = ("fastembed",)
VALID_LOCAL_RERANKER_BACKENDS = ("onnx", "fastembed", "legacy")
VALID_BASELINE_METHODS = ("auto", "fts", "hybrid")
DEFAULT_LOCAL_ONNX_RERANKER_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2"


def _now_ms() -> float:
    return time.perf_counter() * 1000.0


def _normalize_path_key(path: str) -> str:
    try:
        candidate = Path(path)
        if str(candidate) and (candidate.is_absolute() or re.match(r"^[A-Za-z]:", str(candidate))):
            normalized = str(candidate.resolve())
        else:
            normalized = str(candidate)
    except Exception:
        normalized = path
    normalized = normalized.replace("/", "\\")
    if os.name == "nt":
        normalized = normalized.lower()
    return normalized


def _dedup_topk(paths: Iterable[str], k: int) -> List[str]:
    output: List[str] = []
    seen: set[str] = set()
    for path in paths:
        if path in seen:
            continue
        seen.add(path)
        output.append(path)
        if len(output) >= k:
            break
    return output


def _first_hit_rank(topk_paths: Sequence[str], relevant: set[str]) -> Optional[int]:
    for index, path in enumerate(topk_paths, start=1):
        if path in relevant:
            return index
    return None


def _mrr(ranks: Sequence[Optional[int]]) -> float:
    values = [1.0 / rank for rank in ranks if rank and rank > 0]
    return statistics.mean(values) if values else 0.0


def _mean(values: Sequence[float]) -> float:
    return statistics.mean(values) if values else 0.0


def _percentile(values: Sequence[float], percentile: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    if len(ordered) == 1:
        return ordered[0]
    index = (len(ordered) - 1) * percentile
    lower = int(index)
    upper = min(lower + 1, len(ordered) - 1)
    if lower == upper:
        return ordered[lower]
    fraction = index - lower
    return ordered[lower] + (ordered[upper] - ordered[lower]) * fraction


def _load_labeled_queries(path: Path, limit: Optional[int]) -> List[Dict[str, Any]]:
    if not path.is_file():
        raise SystemExit(f"Queries file does not exist: {path}")

    output: List[Dict[str, Any]] = []
    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            item = json.loads(line)
        except Exception as exc:
            raise SystemExit(f"Invalid JSONL line in {path}: {raw_line!r} ({exc})") from exc
        if not isinstance(item, dict) or "query" not in item or "relevant_paths" not in item:
            raise SystemExit(f"Invalid query item (expected object with query/relevant_paths): {item!r}")
        relevant_paths = item.get("relevant_paths")
        if not isinstance(relevant_paths, list) or not relevant_paths:
            raise SystemExit(f"Query item must include non-empty relevant_paths[]: {item!r}")
        output.append(item)
        if limit is not None and len(output) >= limit:
            break
    return output


def _resolve_expected_paths(source_root: Path, paths: Sequence[str]) -> Tuple[List[str], set[str], List[str]]:
    resolved_display: List[str] = []
    resolved_keys: set[str] = set()
    missing: List[str] = []

    for raw_path in paths:
        candidate = Path(raw_path)
        if not candidate.is_absolute():
            candidate = (source_root / candidate).resolve()
        if not candidate.exists():
            missing.append(str(candidate))
        resolved_display.append(str(candidate))
        resolved_keys.add(_normalize_path_key(str(candidate)))
    return resolved_display, resolved_keys, missing


def _validate_local_only_backends(embedding_backend: str, reranker_backend: str) -> None:
    if embedding_backend not in VALID_LOCAL_EMBEDDING_BACKENDS:
        raise SystemExit(
            "This runner is local-only. "
            f"--embedding-backend must be one of {', '.join(VALID_LOCAL_EMBEDDING_BACKENDS)}; got {embedding_backend!r}"
        )
    if reranker_backend not in VALID_LOCAL_RERANKER_BACKENDS:
        raise SystemExit(
            "This runner is local-only. "
            f"--reranker-backend must be one of {', '.join(VALID_LOCAL_RERANKER_BACKENDS)}; got {reranker_backend!r}"
        )


def _validate_stage2_modes(stage2_modes: Sequence[str]) -> List[str]:
    normalized = [str(mode).strip().lower() for mode in stage2_modes if str(mode).strip()]
    if not normalized:
        raise SystemExit("At least one --stage2-modes entry is required")
    invalid = [mode for mode in normalized if mode not in VALID_STAGE2_MODES]
    if invalid:
        raise SystemExit(
            f"Invalid --stage2-modes entry: {invalid[0]} "
            f"(valid: {', '.join(VALID_STAGE2_MODES)})"
        )
    deduped: List[str] = []
    seen: set[str] = set()
    for mode in normalized:
        if mode in seen:
            continue
        seen.add(mode)
        deduped.append(mode)
    return deduped


def _validate_baseline_methods(methods: Sequence[str]) -> List[str]:
    normalized = [str(method).strip().lower() for method in methods if str(method).strip()]
    invalid = [method for method in normalized if method not in VALID_BASELINE_METHODS]
    if invalid:
        raise SystemExit(
            f"Invalid --baseline-methods entry: {invalid[0]} "
            f"(valid: {', '.join(VALID_BASELINE_METHODS)})"
        )
    deduped: List[str] = []
    seen: set[str] = set()
    for method in normalized:
        if method in seen:
            continue
        seen.add(method)
        deduped.append(method)
    return deduped


@dataclass
class StrategyRun:
    strategy_key: str
    strategy: str
    stage2_mode: Optional[str]
    effective_method: str
    execution_method: str
    latency_ms: float
    topk_paths: List[str]
    first_hit_rank: Optional[int]
    hit_at_k: bool
    recall_at_k: float
    generated_artifact_count: int
    test_file_count: int
    error: Optional[str] = None


@dataclass
class QueryEvaluation:
    query: str
    intent: Optional[str]
    notes: Optional[str]
    relevant_paths: List[str]
    runs: Dict[str, StrategyRun]


@dataclass
class PairwiseDelta:
    mode_a: str
    mode_b: str
    hit_at_k_delta: float
    mrr_at_k_delta: float
    avg_recall_at_k_delta: float
    avg_latency_ms_delta: float


@dataclass
class StrategySpec:
    strategy_key: str
    strategy: str
    stage2_mode: Optional[str]


@dataclass
class StrategyRuntime:
    strategy_spec: StrategySpec
    config: Config
    registry: RegistryStore
    engine: ChainSearchEngine


def _strategy_specs(
    stage2_modes: Sequence[str],
    include_dense_baseline: bool,
    *,
    baseline_methods: Sequence[str],
) -> List[StrategySpec]:
    specs: List[StrategySpec] = []
    for method in baseline_methods:
        specs.append(StrategySpec(strategy_key=method, strategy=method, stage2_mode=None))
    if include_dense_baseline:
        specs.append(StrategySpec(strategy_key="dense_rerank", strategy="dense_rerank", stage2_mode=None))
    for stage2_mode in stage2_modes:
        specs.append(
            StrategySpec(
                strategy_key=f"staged:{stage2_mode}",
                strategy="staged",
                stage2_mode=stage2_mode,
            )
        )
    return specs


def _build_strategy_runtime(base_config: Config, strategy_spec: StrategySpec) -> StrategyRuntime:
    runtime_config = deepcopy(base_config)
    registry = RegistryStore()
    registry.initialize()
    mapper = PathMapper()
    engine = ChainSearchEngine(registry=registry, mapper=mapper, config=runtime_config)
    return StrategyRuntime(
        strategy_spec=strategy_spec,
        config=runtime_config,
        registry=registry,
        engine=engine,
    )


def _select_effective_method(query: str, requested_method: str) -> str:
    requested = str(requested_method).strip().lower()
    if requested != "auto":
        return requested
    if query_targets_generated_files(query) or query_prefers_lexical_search(query):
        return "fts"
    intent = detect_query_intent(query)
    if intent == QueryIntent.KEYWORD:
        return "fts"
    if intent == QueryIntent.SEMANTIC:
        return "dense_rerank"
    return "hybrid"


def _filter_dataset_by_query_match(
    dataset: Sequence[Dict[str, Any]],
    query_match: Optional[str],
) -> List[Dict[str, Any]]:
    """Filter labeled queries by case-insensitive substring match."""
    needle = str(query_match or "").strip().casefold()
    if not needle:
        return list(dataset)
    return [
        dict(item)
        for item in dataset
        if needle in str(item.get("query", "")).casefold()
    ]


def _apply_query_limit(
    dataset: Sequence[Dict[str, Any]],
    query_limit: Optional[int],
) -> List[Dict[str, Any]]:
    """Apply the optional query limit after any dataset-level filtering."""
    if query_limit is None:
        return list(dataset)
    return [dict(item) for item in list(dataset)[: max(0, int(query_limit))]]


def _write_json_payload(path: Path, payload: Dict[str, Any]) -> None:
    """Persist a benchmark payload as UTF-8 JSON."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _write_final_outputs(
    *,
    output_path: Path,
    progress_output: Optional[Path],
    payload: Dict[str, Any],
) -> None:
    """Persist the final completed payload to both result and progress outputs."""
    _write_json_payload(output_path, payload)
    if progress_output is not None:
        _write_json_payload(progress_output, payload)


def _make_progress_payload(
    *,
    args: argparse.Namespace,
    source_root: Path,
    strategy_specs: Sequence[StrategySpec],
    evaluations: Sequence[QueryEvaluation],
    query_index: int,
    total_queries: int,
    run_index: int,
    total_runs: int,
    current_query: str,
    current_strategy_key: str,
) -> Dict[str, Any]:
    """Create a partial progress snapshot for long benchmark runs."""
    return {
        "status": "running",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "source": str(source_root),
        "queries_file": str(args.queries_file),
        "query_count": len(evaluations),
        "planned_query_count": total_queries,
        "k": int(args.k),
        "coarse_k": int(args.coarse_k),
        "strategy_keys": [spec.strategy_key for spec in strategy_specs],
        "progress": {
            "completed_queries": query_index,
            "total_queries": total_queries,
            "completed_runs": run_index,
            "total_runs": total_runs,
            "current_query": current_query,
            "current_strategy_key": current_strategy_key,
        },
        "evaluations": [
            {
                "query": evaluation.query,
                "intent": evaluation.intent,
                "notes": evaluation.notes,
                "relevant_paths": evaluation.relevant_paths,
                "runs": {key: asdict(run) for key, run in evaluation.runs.items()},
            }
            for evaluation in evaluations
        ],
    }


def _make_search_options(method: str, *, k: int) -> SearchOptions:
    normalized = str(method).strip().lower()
    if normalized == "fts":
        return SearchOptions(
            total_limit=k,
            hybrid_mode=False,
            enable_fuzzy=False,
            enable_vector=False,
            pure_vector=False,
            enable_cascade=False,
        )
    if normalized == "hybrid":
        return SearchOptions(
            total_limit=k,
            hybrid_mode=True,
            enable_fuzzy=False,
            enable_vector=True,
            pure_vector=False,
            enable_cascade=False,
        )
    if normalized in {"dense_rerank", "staged"}:
        return SearchOptions(
            total_limit=k,
            hybrid_mode=True,
            enable_fuzzy=False,
            enable_vector=True,
            pure_vector=False,
            enable_cascade=True,
        )
    raise ValueError(f"Unsupported benchmark method: {method}")


def _run_strategy(
    engine: ChainSearchEngine,
    config: Config,
    *,
    strategy_spec: StrategySpec,
    query: str,
    source_path: Path,
    k: int,
    coarse_k: int,
    relevant: set[str],
) -> StrategyRun:
    gc.collect()
    effective_method = _select_effective_method(query, strategy_spec.strategy)
    execution_method = "cascade" if effective_method in {"dense_rerank", "staged"} else effective_method
    previous_cascade_strategy = getattr(config, "cascade_strategy", None)
    previous_stage2_mode = getattr(config, "staged_stage2_mode", None)

    start_ms = _now_ms()
    try:
        options = _make_search_options(
            "staged" if strategy_spec.strategy == "staged" else effective_method,
            k=k,
        )
        if strategy_spec.strategy == "staged":
            config.cascade_strategy = "staged"
            if strategy_spec.stage2_mode:
                config.staged_stage2_mode = strategy_spec.stage2_mode
            result = engine.cascade_search(
                query=query,
                source_path=source_path,
                k=k,
                coarse_k=coarse_k,
                options=options,
                strategy="staged",
            )
        elif effective_method == "dense_rerank":
            config.cascade_strategy = "dense_rerank"
            result = engine.cascade_search(
                query=query,
                source_path=source_path,
                k=k,
                coarse_k=coarse_k,
                options=options,
                strategy="dense_rerank",
            )
        else:
            result = engine.search(
                query=query,
                source_path=source_path,
                options=options,
            )
        latency_ms = _now_ms() - start_ms
        paths_raw = [item.path for item in (result.results or []) if getattr(item, "path", None)]
        topk = _dedup_topk((_normalize_path_key(path) for path in paths_raw), k=k)
        rank = _first_hit_rank(topk, relevant)
        recall = 0.0
        if relevant:
            recall = len(set(topk) & relevant) / float(len(relevant))
        return StrategyRun(
            strategy_key=strategy_spec.strategy_key,
            strategy=strategy_spec.strategy,
            stage2_mode=strategy_spec.stage2_mode,
            effective_method=effective_method,
            execution_method=execution_method,
            latency_ms=latency_ms,
            topk_paths=topk,
            first_hit_rank=rank,
            hit_at_k=rank is not None,
            recall_at_k=recall,
            generated_artifact_count=sum(1 for path in topk if is_generated_artifact_path(path)),
            test_file_count=sum(1 for path in topk if is_test_file(path)),
            error=None,
        )
    except Exception as exc:
        latency_ms = _now_ms() - start_ms
        return StrategyRun(
            strategy_key=strategy_spec.strategy_key,
            strategy=strategy_spec.strategy,
            stage2_mode=strategy_spec.stage2_mode,
            effective_method=effective_method,
            execution_method=execution_method,
            latency_ms=latency_ms,
            topk_paths=[],
            first_hit_rank=None,
            hit_at_k=False,
            recall_at_k=0.0,
            generated_artifact_count=0,
            test_file_count=0,
            error=f"{type(exc).__name__}: {exc}",
        )
    finally:
        config.cascade_strategy = previous_cascade_strategy
        config.staged_stage2_mode = previous_stage2_mode


def _summarize_runs(runs: Sequence[StrategyRun]) -> Dict[str, Any]:
    latencies = [run.latency_ms for run in runs if not run.error]
    ranks = [run.first_hit_rank for run in runs]
    effective_method_counts: Dict[str, int] = {}
    for run in runs:
        effective_method_counts[run.effective_method] = effective_method_counts.get(run.effective_method, 0) + 1
    return {
        "query_count": len(runs),
        "hit_at_k": _mean([1.0 if run.hit_at_k else 0.0 for run in runs]),
        "mrr_at_k": _mrr(ranks),
        "avg_recall_at_k": _mean([run.recall_at_k for run in runs]),
        "avg_latency_ms": _mean(latencies),
        "p50_latency_ms": _percentile(latencies, 0.50),
        "p95_latency_ms": _percentile(latencies, 0.95),
        "avg_generated_artifact_count": _mean([float(run.generated_artifact_count) for run in runs]),
        "avg_test_file_count": _mean([float(run.test_file_count) for run in runs]),
        "runs_with_generated_artifacts": sum(1 for run in runs if run.generated_artifact_count > 0),
        "runs_with_test_files": sum(1 for run in runs if run.test_file_count > 0),
        "effective_methods": effective_method_counts,
        "errors": sum(1 for run in runs if run.error),
    }


def _build_pairwise_deltas(stage2_summaries: Dict[str, Dict[str, Any]]) -> List[PairwiseDelta]:
    modes = list(stage2_summaries.keys())
    deltas: List[PairwiseDelta] = []
    for left_index in range(len(modes)):
        for right_index in range(left_index + 1, len(modes)):
            left = modes[left_index]
            right = modes[right_index]
            left_summary = stage2_summaries[left]
            right_summary = stage2_summaries[right]
            deltas.append(
                PairwiseDelta(
                    mode_a=left,
                    mode_b=right,
                    hit_at_k_delta=left_summary["hit_at_k"] - right_summary["hit_at_k"],
                    mrr_at_k_delta=left_summary["mrr_at_k"] - right_summary["mrr_at_k"],
                    avg_recall_at_k_delta=left_summary["avg_recall_at_k"] - right_summary["avg_recall_at_k"],
                    avg_latency_ms_delta=left_summary["avg_latency_ms"] - right_summary["avg_latency_ms"],
                )
            )
    return deltas


def _make_plan_payload(
    *,
    args: argparse.Namespace,
    source_root: Path,
    dataset: Sequence[Dict[str, Any]],
    baseline_methods: Sequence[str],
    stage2_modes: Sequence[str],
    strategy_specs: Sequence[StrategySpec],
) -> Dict[str, Any]:
    return {
        "mode": "dry-run" if args.dry_run else "self-check",
        "local_only": True,
        "source": str(source_root),
        "queries_file": str(args.queries_file),
        "query_count": len(dataset),
        "query_match": args.query_match,
        "k": int(args.k),
        "coarse_k": int(args.coarse_k),
        "baseline_methods": list(baseline_methods),
        "stage2_modes": list(stage2_modes),
        "strategy_keys": [spec.strategy_key for spec in strategy_specs],
        "local_backends": {
            "embedding_backend": args.embedding_backend,
            "embedding_model": args.embedding_model,
            "reranker_backend": args.reranker_backend,
            "reranker_model": args.reranker_model,
            "embedding_use_gpu": bool(args.embedding_use_gpu),
            "reranker_use_gpu": bool(args.reranker_use_gpu),
        },
        "output": str(args.output),
        "progress_output": str(args.progress_output) if args.progress_output else None,
        "dataset_preview": [
            {
                "query": item.get("query"),
                "intent": item.get("intent"),
                "relevant_paths": item.get("relevant_paths"),
            }
            for item in list(dataset)[: min(3, len(dataset))]
        ],
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=DEFAULT_SOURCE,
        help="Source root to benchmark. Defaults to the repository root so CCW and CodexLens paths resolve together.",
    )
    parser.add_argument(
        "--queries-file",
        type=Path,
        default=DEFAULT_QUERIES_FILE,
        help="Labeled JSONL dataset of CCW smart_search queries",
    )
    parser.add_argument("--query-limit", type=int, default=None, help="Optional query limit")
    parser.add_argument(
        "--query-match",
        type=str,
        default=None,
        help="Optional case-insensitive substring filter for selecting specific benchmark queries.",
    )
    parser.add_argument("--k", type=int, default=10, help="Top-k to evaluate")
    parser.add_argument("--coarse-k", type=int, default=100, help="Stage-1 coarse_k")
    parser.add_argument(
        "--baseline-methods",
        nargs="*",
        default=list(VALID_BASELINE_METHODS),
        help="Requested smart_search baselines to compare before staged modes (valid: auto, fts, hybrid).",
    )
    parser.add_argument(
        "--stage2-modes",
        nargs="*",
        default=list(VALID_STAGE2_MODES),
        help="Stage-2 modes to compare",
    )
    parser.add_argument("--warmup", type=int, default=0, help="Warmup iterations per strategy")
    parser.add_argument(
        "--embedding-backend",
        default="fastembed",
        help="Local embedding backend. This runner only accepts fastembed.",
    )
    parser.add_argument(
        "--embedding-model",
        default="code",
        help="Embedding model/profile for the local embedding backend",
    )
    parser.add_argument(
        "--embedding-use-gpu",
        action="store_true",
        help="Enable GPU acceleration for local embeddings. Off by default for stability.",
    )
    parser.add_argument(
        "--reranker-backend",
        default="onnx",
        help="Local reranker backend. Supported local values: onnx, fastembed, legacy.",
    )
    parser.add_argument(
        "--reranker-model",
        default=DEFAULT_LOCAL_ONNX_RERANKER_MODEL,
        help="Reranker model name for the local reranker backend",
    )
    parser.add_argument(
        "--reranker-use-gpu",
        action="store_true",
        help="Enable GPU acceleration for the local reranker. Off by default for stability.",
    )
    parser.add_argument(
        "--skip-dense-baseline",
        action="store_true",
        help="Only compare staged stage2 modes and skip the dense_rerank baseline.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate dataset/config and print the benchmark plan without running retrieval.",
    )
    parser.add_argument(
        "--self-check",
        action="store_true",
        help="Smoke-check the entrypoint by validating dataset, source paths, and stage matrix wiring.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output JSON path",
    )
    parser.add_argument(
        "--progress-output",
        type=Path,
        default=None,
        help="Optional JSON path updated after each query with partial progress and completed runs.",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    source_root = args.source.expanduser().resolve()
    if not source_root.exists():
        raise SystemExit(f"Source path does not exist: {source_root}")
    if int(args.k) <= 0:
        raise SystemExit("--k must be > 0")
    if int(args.coarse_k) <= 0:
        raise SystemExit("--coarse-k must be > 0")
    if int(args.coarse_k) < int(args.k):
        raise SystemExit("--coarse-k must be >= --k")
    if int(args.warmup) < 0:
        raise SystemExit("--warmup must be >= 0")

    embedding_backend = str(args.embedding_backend).strip().lower()
    reranker_backend = str(args.reranker_backend).strip().lower()
    _validate_local_only_backends(embedding_backend, reranker_backend)
    baseline_methods = _validate_baseline_methods(args.baseline_methods)
    stage2_modes = _validate_stage2_modes(args.stage2_modes)

    dataset = _load_labeled_queries(args.queries_file, None)
    dataset = _filter_dataset_by_query_match(dataset, args.query_match)
    dataset = _apply_query_limit(dataset, args.query_limit)
    if not dataset:
        raise SystemExit("No queries to run")

    missing_paths: List[str] = []
    for item in dataset:
        _, _, item_missing = _resolve_expected_paths(source_root, [str(path) for path in item["relevant_paths"]])
        missing_paths.extend(item_missing)
    if missing_paths:
        preview = ", ".join(missing_paths[:3])
        raise SystemExit(
            "Dataset relevant_paths do not resolve under the selected source root. "
            f"Examples: {preview}"
        )

    strategy_specs = _strategy_specs(
        stage2_modes,
        include_dense_baseline=not args.skip_dense_baseline,
        baseline_methods=baseline_methods,
    )

    if args.dry_run or args.self_check:
        payload = _make_plan_payload(
            args=args,
            source_root=source_root,
            dataset=dataset,
            baseline_methods=baseline_methods,
            stage2_modes=stage2_modes,
            strategy_specs=strategy_specs,
        )
        if args.self_check:
            payload["status"] = "ok"
            payload["checks"] = {
                "dataset_loaded": True,
                "stage2_matrix_size": len(stage2_modes),
                "local_only_validation": True,
                "source_path_exists": True,
            }
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return

    config = Config.load()
    config.cascade_strategy = "staged"
    config.enable_staged_rerank = True
    config.enable_cross_encoder_rerank = True
    config.embedding_backend = embedding_backend
    config.embedding_model = str(args.embedding_model).strip()
    config.embedding_use_gpu = bool(args.embedding_use_gpu)
    config.embedding_auto_embed_missing = False
    config.reranker_backend = reranker_backend
    config.reranker_model = str(args.reranker_model).strip()
    config.reranker_use_gpu = bool(args.reranker_use_gpu)

    strategy_runtimes = {
        spec.strategy_key: _build_strategy_runtime(config, spec)
        for spec in strategy_specs
    }

    evaluations: List[QueryEvaluation] = []
    total_queries = len(dataset)
    total_runs = total_queries * len(strategy_specs)
    completed_runs = 0

    try:
        if int(args.warmup) > 0:
            warm_query = str(dataset[0]["query"]).strip()
            warm_relevant_paths = [str(path) for path in dataset[0]["relevant_paths"]]
            _, warm_relevant, _ = _resolve_expected_paths(source_root, warm_relevant_paths)
            for spec in strategy_specs:
                runtime = strategy_runtimes[spec.strategy_key]
                for _ in range(int(args.warmup)):
                    _run_strategy(
                        runtime.engine,
                        runtime.config,
                        strategy_spec=spec,
                        query=warm_query,
                        source_path=source_root,
                        k=min(int(args.k), 5),
                        coarse_k=min(int(args.coarse_k), 50),
                        relevant=warm_relevant,
                    )

        for index, item in enumerate(dataset, start=1):
            query = str(item.get("query", "")).strip()
            if not query:
                continue
            print(f"[query {index}/{total_queries}] {query}", flush=True)
            relevant_paths, relevant, _ = _resolve_expected_paths(
                source_root,
                [str(path) for path in item["relevant_paths"]],
            )
            runs: Dict[str, StrategyRun] = {}
            for spec in strategy_specs:
                if args.progress_output is not None:
                    _write_json_payload(
                        args.progress_output,
                        _make_progress_payload(
                            args=args,
                            source_root=source_root,
                            strategy_specs=strategy_specs,
                            evaluations=evaluations,
                            query_index=index - 1,
                            total_queries=total_queries,
                            run_index=completed_runs,
                            total_runs=total_runs,
                            current_query=query,
                            current_strategy_key=spec.strategy_key,
                        ),
                    )
                print(
                    f"[run {completed_runs + 1}/{total_runs}] "
                    f"strategy={spec.strategy_key} query={query}",
                    flush=True,
                )
                runtime = strategy_runtimes[spec.strategy_key]
                runs[spec.strategy_key] = _run_strategy(
                    runtime.engine,
                    runtime.config,
                    strategy_spec=spec,
                    query=query,
                    source_path=source_root,
                    k=int(args.k),
                    coarse_k=int(args.coarse_k),
                    relevant=relevant,
                )
                completed_runs += 1
                run = runs[spec.strategy_key]
                outcome = "error" if run.error else "ok"
                print(
                    f"[done {completed_runs}/{total_runs}] "
                    f"strategy={spec.strategy_key} outcome={outcome} "
                    f"latency_ms={run.latency_ms:.2f} "
                    f"first_hit_rank={run.first_hit_rank}",
                    flush=True,
                )
            evaluations.append(
                QueryEvaluation(
                    query=query,
                    intent=str(item.get("intent")) if item.get("intent") is not None else None,
                    notes=str(item.get("notes")) if item.get("notes") is not None else None,
                    relevant_paths=relevant_paths,
                    runs=runs,
                )
            )
            if args.progress_output is not None:
                _write_json_payload(
                    args.progress_output,
                    _make_progress_payload(
                        args=args,
                        source_root=source_root,
                        strategy_specs=strategy_specs,
                        evaluations=evaluations,
                        query_index=index,
                        total_queries=total_queries,
                        run_index=completed_runs,
                        total_runs=total_runs,
                        current_query=query,
                        current_strategy_key="complete",
                    ),
                )
    finally:
        for runtime in strategy_runtimes.values():
            try:
                runtime.engine.close()
            except Exception:
                pass
        for runtime in strategy_runtimes.values():
            try:
                runtime.registry.close()
            except Exception:
                pass

    strategy_summaries: Dict[str, Dict[str, Any]] = {}
    for spec in strategy_specs:
        spec_runs = [evaluation.runs[spec.strategy_key] for evaluation in evaluations if spec.strategy_key in evaluation.runs]
        summary = _summarize_runs(spec_runs)
        summary["strategy"] = spec.strategy
        summary["stage2_mode"] = spec.stage2_mode
        strategy_summaries[spec.strategy_key] = summary

    stage2_mode_matrix = {
        mode: strategy_summaries[f"staged:{mode}"]
        for mode in stage2_modes
        if f"staged:{mode}" in strategy_summaries
    }
    pairwise_deltas = [asdict(item) for item in _build_pairwise_deltas(stage2_mode_matrix)]

    payload = {
        "status": "completed",
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "source": str(source_root),
        "queries_file": str(args.queries_file),
        "query_count": len(evaluations),
        "query_match": args.query_match,
        "k": int(args.k),
        "coarse_k": int(args.coarse_k),
        "local_only": True,
        "strategies": strategy_summaries,
        "stage2_mode_matrix": stage2_mode_matrix,
        "pairwise_stage2_deltas": pairwise_deltas,
        "config": {
            "embedding_backend": config.embedding_backend,
            "embedding_model": config.embedding_model,
            "embedding_use_gpu": bool(config.embedding_use_gpu),
            "reranker_backend": config.reranker_backend,
            "reranker_model": config.reranker_model,
            "reranker_use_gpu": bool(config.reranker_use_gpu),
            "enable_staged_rerank": bool(config.enable_staged_rerank),
            "enable_cross_encoder_rerank": bool(config.enable_cross_encoder_rerank),
        },
        "progress_output": str(args.progress_output) if args.progress_output else None,
        "evaluations": [
            {
                "query": evaluation.query,
                "intent": evaluation.intent,
                "notes": evaluation.notes,
                "relevant_paths": evaluation.relevant_paths,
                "runs": {key: asdict(run) for key, run in evaluation.runs.items()},
            }
            for evaluation in evaluations
        ],
    }

    _write_final_outputs(
        output_path=args.output,
        progress_output=args.progress_output,
        payload=payload,
    )
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
