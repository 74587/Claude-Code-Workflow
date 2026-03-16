from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace


MODULE_PATH = Path(__file__).resolve().parents[1] / "benchmarks" / "compare_ccw_smart_search_stage2.py"
MODULE_NAME = "compare_ccw_smart_search_stage2_test_module"
MODULE_SPEC = importlib.util.spec_from_file_location(MODULE_NAME, MODULE_PATH)
assert MODULE_SPEC is not None and MODULE_SPEC.loader is not None
benchmark = importlib.util.module_from_spec(MODULE_SPEC)
sys.modules[MODULE_NAME] = benchmark
MODULE_SPEC.loader.exec_module(benchmark)


class _FakeChainResult:
    def __init__(self, paths: list[str]) -> None:
        self.results = [SimpleNamespace(path=path) for path in paths]


class _FakeEngine:
    def __init__(
        self,
        *,
        search_paths: list[str] | None = None,
        cascade_paths: list[str] | None = None,
    ) -> None:
        self.search_paths = search_paths or []
        self.cascade_paths = cascade_paths or []
        self.search_calls: list[dict[str, object]] = []
        self.cascade_calls: list[dict[str, object]] = []

    def search(self, query: str, source_path: Path, options: object) -> _FakeChainResult:
        self.search_calls.append(
            {
                "query": query,
                "source_path": source_path,
                "options": options,
            }
        )
        return _FakeChainResult(self.search_paths)

    def cascade_search(
        self,
        query: str,
        source_path: Path,
        *,
        k: int,
        coarse_k: int,
        options: object,
        strategy: str,
    ) -> _FakeChainResult:
        self.cascade_calls.append(
            {
                "query": query,
                "source_path": source_path,
                "k": k,
                "coarse_k": coarse_k,
                "options": options,
                "strategy": strategy,
            }
        )
        return _FakeChainResult(self.cascade_paths)


def test_strategy_specs_include_baselines_before_stage2_modes() -> None:
    specs = benchmark._strategy_specs(
        ["realtime", "static_global_graph"],
        include_dense_baseline=True,
        baseline_methods=["auto", "fts", "hybrid"],
    )

    assert [spec.strategy_key for spec in specs] == [
        "auto",
        "fts",
        "hybrid",
        "dense_rerank",
        "staged:realtime",
        "staged:static_global_graph",
    ]


def test_select_effective_method_matches_cli_auto_routing() -> None:
    assert benchmark._select_effective_method("find_descendant_project_roots", "auto") == "fts"
    assert benchmark._select_effective_method("build dist artifact output", "auto") == "fts"
    assert benchmark._select_effective_method("embedding backend fastembed local litellm api config", "auto") == "fts"
    assert benchmark._select_effective_method("get_reranker factory onnx backend selection", "auto") == "fts"
    assert benchmark._select_effective_method("how does the authentication flow work", "auto") == "dense_rerank"
    assert benchmark._select_effective_method("how smart_search keyword routing works", "auto") == "hybrid"


def test_filter_dataset_by_query_match_uses_case_insensitive_substring() -> None:
    dataset = [
        {"query": "embedding backend fastembed local litellm api config", "relevant_paths": ["a"]},
        {"query": "get_reranker factory onnx backend selection", "relevant_paths": ["b"]},
        {"query": "how does smart search route keyword queries", "relevant_paths": ["c"]},
    ]

    filtered = benchmark._filter_dataset_by_query_match(dataset, "BACKEND")
    assert [item["query"] for item in filtered] == [
        "embedding backend fastembed local litellm api config",
        "get_reranker factory onnx backend selection",
    ]

    narrow_filtered = benchmark._filter_dataset_by_query_match(dataset, "FASTEMBED")
    assert [item["query"] for item in narrow_filtered] == [
        "embedding backend fastembed local litellm api config",
    ]

    unfiltered = benchmark._filter_dataset_by_query_match(dataset, None)
    assert [item["query"] for item in unfiltered] == [item["query"] for item in dataset]


def test_apply_query_limit_runs_after_filtering() -> None:
    dataset = [
        {"query": "executeHybridMode dense_rerank semantic smart_search", "relevant_paths": ["a"]},
        {"query": "embedding backend fastembed local litellm api config", "relevant_paths": ["b"]},
        {"query": "reranker backend onnx api legacy configuration", "relevant_paths": ["c"]},
    ]

    filtered = benchmark._filter_dataset_by_query_match(dataset, "backend")
    limited = benchmark._apply_query_limit(filtered, 1)

    assert [item["query"] for item in limited] == [
        "embedding backend fastembed local litellm api config",
    ]


def test_make_progress_payload_reports_partial_completion() -> None:
    args = SimpleNamespace(
        queries_file=Path("queries.jsonl"),
        k=10,
        coarse_k=100,
    )
    strategy_specs = [
        benchmark.StrategySpec(strategy_key="auto", strategy="auto", stage2_mode=None),
        benchmark.StrategySpec(strategy_key="dense_rerank", strategy="dense_rerank", stage2_mode=None),
    ]
    evaluations = [
        benchmark.QueryEvaluation(
            query="embedding backend fastembed local litellm api config",
            intent="config",
            notes=None,
            relevant_paths=["codex-lens/src/codexlens/config.py"],
            runs={
                "auto": benchmark.StrategyRun(
                    strategy_key="auto",
                    strategy="auto",
                    stage2_mode=None,
                    effective_method="fts",
                    execution_method="fts",
                    latency_ms=123.0,
                    topk_paths=["config.py"],
                    first_hit_rank=1,
                    hit_at_k=True,
                    recall_at_k=1.0,
                    generated_artifact_count=0,
                    test_file_count=0,
                    error=None,
                )
            },
        )
    ]

    payload = benchmark._make_progress_payload(
        args=args,
        source_root=Path("D:/repo"),
        strategy_specs=strategy_specs,
        evaluations=evaluations,
        query_index=1,
        total_queries=3,
        run_index=2,
        total_runs=6,
        current_query="embedding backend fastembed local litellm api config",
        current_strategy_key="complete",
    )

    assert payload["status"] == "running"
    assert payload["progress"]["completed_queries"] == 1
    assert payload["progress"]["completed_runs"] == 2
    assert payload["progress"]["total_runs"] == 6
    assert payload["strategy_keys"] == ["auto", "dense_rerank"]
    assert payload["evaluations"][0]["runs"]["auto"]["effective_method"] == "fts"


def test_write_final_outputs_updates_progress_snapshot(tmp_path: Path) -> None:
    output_path = tmp_path / "results.json"
    progress_path = tmp_path / "progress.json"
    payload = {
        "status": "completed",
        "query_count": 1,
        "strategies": {"auto": {"effective_methods": {"fts": 1}}},
    }

    benchmark._write_final_outputs(
        output_path=output_path,
        progress_output=progress_path,
        payload=payload,
    )

    assert json.loads(output_path.read_text(encoding="utf-8")) == payload
    assert json.loads(progress_path.read_text(encoding="utf-8")) == payload


def test_build_parser_defaults_reranker_gpu_to_disabled() -> None:
    parser = benchmark.build_parser()
    args = parser.parse_args([])

    assert args.embedding_use_gpu is False
    assert args.reranker_use_gpu is False
    assert args.reranker_model == benchmark.DEFAULT_LOCAL_ONNX_RERANKER_MODEL


def test_build_strategy_runtime_clones_config(monkeypatch, tmp_path: Path) -> None:
    class _FakeRegistry:
        def __init__(self) -> None:
            self.initialized = False

        def initialize(self) -> None:
            self.initialized = True

    class _FakeMapper:
        pass

    class _FakeEngine:
        def __init__(self, *, registry, mapper, config) -> None:
            self.registry = registry
            self.mapper = mapper
            self.config = config

    monkeypatch.setattr(benchmark, "RegistryStore", _FakeRegistry)
    monkeypatch.setattr(benchmark, "PathMapper", _FakeMapper)
    monkeypatch.setattr(benchmark, "ChainSearchEngine", _FakeEngine)

    base_config = benchmark.Config(data_dir=tmp_path, reranker_use_gpu=False)
    strategy_spec = benchmark.StrategySpec(strategy_key="dense_rerank", strategy="dense_rerank", stage2_mode=None)

    runtime = benchmark._build_strategy_runtime(base_config, strategy_spec)

    assert runtime.strategy_spec == strategy_spec
    assert runtime.config is not base_config
    assert runtime.config.reranker_use_gpu is False
    assert runtime.registry.initialized is True
    assert runtime.engine.config is runtime.config


def test_run_strategy_routes_auto_keyword_queries_to_fts_search() -> None:
    engine = _FakeEngine(
        search_paths=[
            "D:/repo/src/codexlens/storage/registry.py",
            "D:/repo/build/lib/codexlens/storage/registry.py",
        ]
    )
    config = SimpleNamespace(cascade_strategy="staged", staged_stage2_mode="realtime")
    relevant = {benchmark._normalize_path_key("D:/repo/src/codexlens/storage/registry.py")}

    run = benchmark._run_strategy(
        engine,
        config,
        strategy_spec=benchmark.StrategySpec(strategy_key="auto", strategy="auto", stage2_mode=None),
        query="find_descendant_project_roots",
        source_path=Path("D:/repo"),
        k=5,
        coarse_k=20,
        relevant=relevant,
    )

    assert len(engine.search_calls) == 1
    assert len(engine.cascade_calls) == 0
    assert run.effective_method == "fts"
    assert run.execution_method == "fts"
    assert run.hit_at_k is True
    assert run.generated_artifact_count == 1
    assert run.test_file_count == 0


def test_run_strategy_uses_cascade_for_dense_rerank_and_restores_config() -> None:
    engine = _FakeEngine(cascade_paths=["D:/repo/src/tools/smart-search.ts"])
    config = SimpleNamespace(cascade_strategy="staged", staged_stage2_mode="static_global_graph")
    relevant = {benchmark._normalize_path_key("D:/repo/src/tools/smart-search.ts")}

    run = benchmark._run_strategy(
        engine,
        config,
        strategy_spec=benchmark.StrategySpec(
            strategy_key="dense_rerank",
            strategy="dense_rerank",
            stage2_mode=None,
        ),
        query="how does smart search route keyword queries",
        source_path=Path("D:/repo"),
        k=5,
        coarse_k=20,
        relevant=relevant,
    )

    assert len(engine.search_calls) == 0
    assert len(engine.cascade_calls) == 1
    assert engine.cascade_calls[0]["strategy"] == "dense_rerank"
    assert run.effective_method == "dense_rerank"
    assert run.execution_method == "cascade"
    assert run.hit_at_k is True
    assert config.cascade_strategy == "staged"
    assert config.staged_stage2_mode == "static_global_graph"


def test_summarize_runs_tracks_effective_method_and_artifact_pressure() -> None:
    summary = benchmark._summarize_runs(
        [
            benchmark.StrategyRun(
                strategy_key="auto",
                strategy="auto",
                stage2_mode=None,
                effective_method="fts",
                execution_method="fts",
                latency_ms=10.0,
                topk_paths=["a"],
                first_hit_rank=1,
                hit_at_k=True,
                recall_at_k=1.0,
                generated_artifact_count=1,
                test_file_count=0,
                error=None,
            ),
            benchmark.StrategyRun(
                strategy_key="auto",
                strategy="auto",
                stage2_mode=None,
                effective_method="hybrid",
                execution_method="hybrid",
                latency_ms=30.0,
                topk_paths=["b"],
                first_hit_rank=None,
                hit_at_k=False,
                recall_at_k=0.0,
                generated_artifact_count=0,
                test_file_count=2,
                error=None,
            ),
        ]
    )

    assert summary["effective_methods"] == {"fts": 1, "hybrid": 1}
    assert summary["runs_with_generated_artifacts"] == 1
    assert summary["runs_with_test_files"] == 1
    assert summary["avg_generated_artifact_count"] == 0.5
    assert summary["avg_test_file_count"] == 1.0
