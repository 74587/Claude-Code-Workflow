import json

from typer.testing import CliRunner

import codexlens.cli.commands as commands
from codexlens.cli.commands import app
import codexlens.cli.embedding_manager as embedding_manager
from codexlens.config import Config
from codexlens.entities import SearchResult
from codexlens.search.chain_search import ChainSearchResult, SearchStats


def test_index_status_json_preserves_legacy_embeddings_contract(
    monkeypatch,
    tmp_path,
) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    (workspace / "_index.db").touch()

    legacy_summary = {
        "total_indexes": 3,
        "indexes_with_embeddings": 1,
        "total_chunks": 42,
        "indexes": [
            {
                "project": "child",
                "path": str(workspace / "child" / "_index.db"),
                "has_embeddings": True,
                "total_chunks": 42,
                "total_files": 1,
                "coverage_percent": 100.0,
            }
        ],
    }
    root_status = {
        "total_indexes": 3,
        "total_files": 2,
        "files_with_embeddings": 0,
        "files_without_embeddings": 2,
        "total_chunks": 0,
        "coverage_percent": 0.0,
        "indexes_with_embeddings": 1,
        "indexes_without_embeddings": 2,
        "model_info": None,
        "root": {
            "index_path": str(workspace / "_index.db"),
            "exists": False,
            "total_files": 2,
            "files_with_embeddings": 0,
            "files_without_embeddings": 2,
            "total_chunks": 0,
            "coverage_percent": 0.0,
            "has_embeddings": False,
            "storage_mode": "none",
        },
        "subtree": {
            "total_indexes": 3,
            "total_files": 3,
            "files_with_embeddings": 1,
            "files_without_embeddings": 2,
            "total_chunks": 42,
            "coverage_percent": 33.3,
            "indexes_with_embeddings": 1,
            "indexes_without_embeddings": 2,
        },
        "centralized": {
            "dense_index_exists": False,
            "binary_index_exists": False,
            "dense_ready": False,
            "binary_ready": False,
            "usable": False,
            "chunk_metadata_rows": 0,
            "binary_vector_rows": 0,
            "files_with_embeddings": 0,
        },
    }

    monkeypatch.setattr(
        embedding_manager,
        "get_embeddings_status",
        lambda _index_root: {"success": True, "result": root_status},
    )
    monkeypatch.setattr(
        embedding_manager,
        "get_embedding_stats_summary",
        lambda _index_root: {"success": True, "result": legacy_summary},
    )
    monkeypatch.setattr(
        commands,
        "RegistryStore",
        type(
            "FakeRegistryStore",
            (),
            {
                "initialize": lambda self: None,
                "close": lambda self: None,
            },
        ),
    )
    monkeypatch.setattr(
        commands,
        "PathMapper",
        type(
            "FakePathMapper",
            (),
            {
                "source_to_index_db": lambda self, _target_path: workspace / "_index.db",
            },
        ),
    )

    runner = CliRunner()
    result = runner.invoke(app, ["index", "status", str(workspace), "--json"])

    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    body = payload["result"]
    assert body["embeddings"] == legacy_summary
    assert body["embeddings_error"] is None
    assert body["embeddings_status"] == root_status
    assert body["embeddings_status_error"] is None
    assert body["embeddings_summary"] == legacy_summary


def test_search_json_preserves_dense_rerank_method_label(
    monkeypatch,
    tmp_path,
) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    search_result = ChainSearchResult(
        query="greet function",
        results=[
            SearchResult(
                path=str(workspace / "src" / "app.py"),
                score=0.97,
                excerpt="def greet(name):",
                content="def greet(name):\n    return f'hello {name}'\n",
            )
        ],
        symbols=[],
        stats=SearchStats(dirs_searched=2, files_matched=1, time_ms=12.5),
    )
    captured: dict[str, object] = {}

    monkeypatch.setattr(commands.Config, "load", staticmethod(lambda: Config(data_dir=tmp_path / "data")))
    monkeypatch.setattr(
        commands,
        "RegistryStore",
        type(
            "FakeRegistryStore",
            (),
            {
                "initialize": lambda self: None,
                "close": lambda self: None,
            },
        ),
    )
    monkeypatch.setattr(
        commands,
        "PathMapper",
        type(
            "FakePathMapper",
            (),
            {},
        ),
    )

    class FakeChainSearchEngine:
        def __init__(self, registry, mapper, config=None):
            captured["registry"] = registry
            captured["mapper"] = mapper
            captured["config"] = config

        def search(self, *_args, **_kwargs):
            raise AssertionError("dense_rerank should dispatch via cascade_search")

        def cascade_search(self, query, source_path, k=10, options=None, strategy=None):
            captured["query"] = query
            captured["source_path"] = source_path
            captured["limit"] = k
            captured["options"] = options
            captured["strategy"] = strategy
            return search_result

    monkeypatch.setattr(commands, "ChainSearchEngine", FakeChainSearchEngine)

    runner = CliRunner()
    result = runner.invoke(
        app,
        ["search", "greet function", "--path", str(workspace), "--method", "dense_rerank", "--json"],
    )

    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    body = payload["result"]
    assert body["method"] == "dense_rerank"
    assert body["count"] == 1
    assert body["results"][0]["path"] == str(workspace / "src" / "app.py")
    assert captured["strategy"] == "dense_rerank"
    assert captured["limit"] == 20


def test_search_json_auto_routes_keyword_queries_to_fts(
    monkeypatch,
    tmp_path,
) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    search_result = ChainSearchResult(
        query="windowsHide",
        results=[
            SearchResult(
                path=str(workspace / "src" / "spawn.ts"),
                score=0.91,
                excerpt="windowsHide: true",
                content="spawn('node', [], { windowsHide: true })",
            )
        ],
        symbols=[],
        stats=SearchStats(dirs_searched=2, files_matched=1, time_ms=8.0),
    )
    captured: dict[str, object] = {}

    monkeypatch.setattr(commands.Config, "load", staticmethod(lambda: Config(data_dir=tmp_path / "data")))
    monkeypatch.setattr(
        commands,
        "RegistryStore",
        type("FakeRegistryStore", (), {"initialize": lambda self: None, "close": lambda self: None}),
    )
    monkeypatch.setattr(commands, "PathMapper", type("FakePathMapper", (), {}))

    class FakeChainSearchEngine:
        def __init__(self, registry, mapper, config=None):
            captured["config"] = config

        def search(self, query, source_path, options=None):
            captured["query"] = query
            captured["source_path"] = source_path
            captured["options"] = options
            return search_result

        def cascade_search(self, *_args, **_kwargs):
            raise AssertionError("auto keyword queries should not dispatch to cascade_search")

    monkeypatch.setattr(commands, "ChainSearchEngine", FakeChainSearchEngine)

    runner = CliRunner()
    result = runner.invoke(
        app,
        ["search", "windowsHide", "--path", str(workspace), "--json"],
    )

    assert result.exit_code == 0, result.output
    body = json.loads(result.stdout)["result"]
    assert body["method"] == "fts"
    assert captured["options"].enable_vector is False
    assert captured["options"].hybrid_mode is False


def test_search_json_auto_routes_mixed_queries_to_hybrid(
    monkeypatch,
    tmp_path,
) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    search_result = ChainSearchResult(
        query="how does my_function work",
        results=[
            SearchResult(
                path=str(workspace / "src" / "app.py"),
                score=0.81,
                excerpt="def my_function():",
                content="def my_function():\n    return 1\n",
            )
        ],
        symbols=[],
        stats=SearchStats(dirs_searched=2, files_matched=1, time_ms=10.0),
    )
    captured: dict[str, object] = {}

    monkeypatch.setattr(commands.Config, "load", staticmethod(lambda: Config(data_dir=tmp_path / "data")))
    monkeypatch.setattr(
        commands,
        "RegistryStore",
        type("FakeRegistryStore", (), {"initialize": lambda self: None, "close": lambda self: None}),
    )
    monkeypatch.setattr(commands, "PathMapper", type("FakePathMapper", (), {}))

    class FakeChainSearchEngine:
        def __init__(self, registry, mapper, config=None):
            captured["config"] = config

        def search(self, query, source_path, options=None):
            captured["query"] = query
            captured["source_path"] = source_path
            captured["options"] = options
            return search_result

        def cascade_search(self, *_args, **_kwargs):
            raise AssertionError("mixed auto queries should not dispatch to cascade_search")

    monkeypatch.setattr(commands, "ChainSearchEngine", FakeChainSearchEngine)

    runner = CliRunner()
    result = runner.invoke(
        app,
        ["search", "how does my_function work", "--path", str(workspace), "--json"],
    )

    assert result.exit_code == 0, result.output
    body = json.loads(result.stdout)["result"]
    assert body["method"] == "hybrid"
    assert captured["options"].enable_vector is True
    assert captured["options"].hybrid_mode is True
    assert captured["options"].enable_cascade is False


def test_search_json_auto_routes_generated_artifact_queries_to_fts(
    monkeypatch,
    tmp_path,
) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    search_result = ChainSearchResult(
        query="dist bundle output",
        results=[
            SearchResult(
                path=str(workspace / "dist" / "bundle.js"),
                score=0.77,
                excerpt="bundle output",
                content="console.log('bundle')",
            )
        ],
        symbols=[],
        stats=SearchStats(dirs_searched=2, files_matched=1, time_ms=9.0),
    )
    captured: dict[str, object] = {}

    monkeypatch.setattr(commands.Config, "load", staticmethod(lambda: Config(data_dir=tmp_path / "data")))
    monkeypatch.setattr(
        commands,
        "RegistryStore",
        type("FakeRegistryStore", (), {"initialize": lambda self: None, "close": lambda self: None}),
    )
    monkeypatch.setattr(commands, "PathMapper", type("FakePathMapper", (), {}))

    class FakeChainSearchEngine:
        def __init__(self, registry, mapper, config=None):
            captured["config"] = config

        def search(self, query, source_path, options=None):
            captured["query"] = query
            captured["source_path"] = source_path
            captured["options"] = options
            return search_result

        def cascade_search(self, *_args, **_kwargs):
            raise AssertionError("generated artifact auto queries should not dispatch to cascade_search")

    monkeypatch.setattr(commands, "ChainSearchEngine", FakeChainSearchEngine)

    runner = CliRunner()
    result = runner.invoke(
        app,
        ["search", "dist bundle output", "--path", str(workspace), "--json"],
    )

    assert result.exit_code == 0, result.output
    body = json.loads(result.stdout)["result"]
    assert body["method"] == "fts"
    assert captured["options"].enable_vector is False
    assert captured["options"].hybrid_mode is False


def test_auto_select_search_method_prefers_fts_for_lexical_config_queries() -> None:
    assert commands._auto_select_search_method("embedding backend fastembed local litellm api config") == "fts"
    assert commands._auto_select_search_method("get_reranker factory onnx backend selection") == "fts"
    assert commands._auto_select_search_method("how to authenticate users safely?") == "dense_rerank"


def test_search_json_fts_zero_results_uses_filesystem_fallback(
    monkeypatch,
    tmp_path,
) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    indexed_result = ChainSearchResult(
        query="find_descendant_project_roots",
        results=[],
        symbols=[],
        stats=SearchStats(dirs_searched=3, files_matched=0, time_ms=7.5),
    )
    fallback_result = SearchResult(
        path=str(workspace / "src" / "registry.py"),
        score=1.0,
        excerpt="def find_descendant_project_roots(...):",
        content=None,
        metadata={
            "filesystem_fallback": True,
            "backend": "ripgrep-fallback",
            "stale_index_suspected": True,
        },
        start_line=12,
        end_line=12,
    )
    captured: dict[str, object] = {"fallback_calls": 0}

    monkeypatch.setattr(commands.Config, "load", staticmethod(lambda: Config(data_dir=tmp_path / "data")))
    monkeypatch.setattr(
        commands,
        "RegistryStore",
        type("FakeRegistryStore", (), {"initialize": lambda self: None, "close": lambda self: None}),
    )
    monkeypatch.setattr(commands, "PathMapper", type("FakePathMapper", (), {}))

    class FakeChainSearchEngine:
        def __init__(self, registry, mapper, config=None):
            captured["config"] = config

        def search(self, query, source_path, options=None):
            captured["query"] = query
            captured["source_path"] = source_path
            captured["options"] = options
            return indexed_result

        def cascade_search(self, *_args, **_kwargs):
            raise AssertionError("fts zero-result queries should not dispatch to cascade_search")

    def fake_fallback(query, source_path, *, limit, config, code_only=False, exclude_extensions=None):
        captured["fallback_calls"] = int(captured["fallback_calls"]) + 1
        captured["fallback_query"] = query
        captured["fallback_path"] = source_path
        captured["fallback_limit"] = limit
        captured["fallback_code_only"] = code_only
        captured["fallback_exclude_extensions"] = exclude_extensions
        return {
            "results": [fallback_result],
            "time_ms": 2.5,
            "fallback": {
                "backend": "ripgrep-fallback",
                "stale_index_suspected": True,
                "reason": "Indexed FTS search returned no results; filesystem fallback used.",
            },
        }

    monkeypatch.setattr(commands, "ChainSearchEngine", FakeChainSearchEngine)
    monkeypatch.setattr(commands, "_filesystem_fallback_search", fake_fallback)

    runner = CliRunner()
    result = runner.invoke(
        app,
        ["search", "find_descendant_project_roots", "--method", "fts", "--path", str(workspace), "--json"],
    )

    assert result.exit_code == 0, result.output
    body = json.loads(result.stdout)["result"]
    assert body["method"] == "fts"
    assert body["count"] == 1
    assert body["results"][0]["path"] == str(workspace / "src" / "registry.py")
    assert body["results"][0]["excerpt"] == "def find_descendant_project_roots(...):"
    assert body["stats"]["files_matched"] == 1
    assert body["stats"]["time_ms"] == 10.0
    assert body["fallback"] == {
        "backend": "ripgrep-fallback",
        "stale_index_suspected": True,
        "reason": "Indexed FTS search returned no results; filesystem fallback used.",
    }
    assert captured["fallback_calls"] == 1
    assert captured["fallback_query"] == "find_descendant_project_roots"
    assert captured["fallback_path"] == workspace
    assert captured["fallback_limit"] == 20
    assert captured["options"].enable_vector is False
    assert captured["options"].hybrid_mode is False


def test_search_json_hybrid_zero_results_does_not_use_filesystem_fallback(
    monkeypatch,
    tmp_path,
) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    indexed_result = ChainSearchResult(
        query="how does my_function work",
        results=[],
        symbols=[],
        stats=SearchStats(dirs_searched=4, files_matched=0, time_ms=11.0),
    )
    captured: dict[str, object] = {"fallback_calls": 0}

    monkeypatch.setattr(commands.Config, "load", staticmethod(lambda: Config(data_dir=tmp_path / "data")))
    monkeypatch.setattr(
        commands,
        "RegistryStore",
        type("FakeRegistryStore", (), {"initialize": lambda self: None, "close": lambda self: None}),
    )
    monkeypatch.setattr(commands, "PathMapper", type("FakePathMapper", (), {}))

    class FakeChainSearchEngine:
        def __init__(self, registry, mapper, config=None):
            captured["config"] = config

        def search(self, query, source_path, options=None):
            captured["query"] = query
            captured["source_path"] = source_path
            captured["options"] = options
            return indexed_result

        def cascade_search(self, *_args, **_kwargs):
            raise AssertionError("hybrid queries should not dispatch to cascade_search")

    def fake_fallback(*_args, **_kwargs):
        captured["fallback_calls"] = int(captured["fallback_calls"]) + 1
        return None

    monkeypatch.setattr(commands, "ChainSearchEngine", FakeChainSearchEngine)
    monkeypatch.setattr(commands, "_filesystem_fallback_search", fake_fallback)

    runner = CliRunner()
    result = runner.invoke(
        app,
        ["search", "how does my_function work", "--path", str(workspace), "--json"],
    )

    assert result.exit_code == 0, result.output
    body = json.loads(result.stdout)["result"]
    assert body["method"] == "hybrid"
    assert body["count"] == 0
    assert "fallback" not in body
    assert body["stats"]["files_matched"] == 0
    assert body["stats"]["time_ms"] == 11.0
    assert captured["fallback_calls"] == 0
    assert captured["options"].enable_vector is True
    assert captured["options"].hybrid_mode is True


def test_filesystem_fallback_search_prefers_source_definitions_for_keyword_queries(
    monkeypatch,
    tmp_path,
) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()

    source_path = workspace / "src" / "registry.py"
    test_path = workspace / "tests" / "test_registry.py"
    ref_path = workspace / "src" / "chain_search.py"

    match_lines = [
        {
            "type": "match",
            "data": {
                "path": {"text": str(test_path)},
                "lines": {"text": "def test_find_descendant_project_roots_returns_nested_project_roots():\n"},
                "line_number": 12,
            },
        },
        {
            "type": "match",
            "data": {
                "path": {"text": str(source_path)},
                "lines": {"text": "def find_descendant_project_roots(self, source_root: Path) -> List[DirMapping]:\n"},
                "line_number": 48,
            },
        },
        {
            "type": "match",
            "data": {
                "path": {"text": str(ref_path)},
                "lines": {"text": "descendant_roots = self.registry.find_descendant_project_roots(source_root)\n"},
                "line_number": 91,
            },
        },
    ]

    monkeypatch.setattr(commands.shutil, "which", lambda _name: "rg")
    monkeypatch.setattr(
        commands.subprocess,
        "run",
        lambda *_args, **_kwargs: type(
            "FakeCompletedProcess",
            (),
            {
                "returncode": 0,
                "stdout": "\n".join(json.dumps(line) for line in match_lines),
                "stderr": "",
            },
        )(),
    )

    fallback = commands._filesystem_fallback_search(
        "find_descendant_project_roots",
        workspace,
        limit=5,
        config=Config(data_dir=tmp_path / "data"),
    )

    assert fallback is not None
    assert fallback["fallback"]["backend"] == "ripgrep-fallback"
    assert fallback["results"][0].path == str(source_path)
    assert fallback["results"][1].path == str(ref_path)
    assert fallback["results"][2].path == str(test_path)
    assert fallback["results"][0].score > fallback["results"][1].score > fallback["results"][2].score


def test_clean_json_reports_partial_success_when_locked_files_remain(
    monkeypatch,
    tmp_path,
) -> None:
    workspace = tmp_path / "workspace"
    project_index = tmp_path / "indexes" / "workspace"
    project_index.mkdir(parents=True)
    (project_index / "_index.db").write_text("db", encoding="utf-8")
    locked_path = project_index / "nested" / "_index.db"
    locked_path.parent.mkdir(parents=True)
    locked_path.write_text("locked", encoding="utf-8")

    captured: dict[str, object] = {}

    class FakePathMapper:
        def __init__(self):
            self.index_root = tmp_path / "indexes"

        def source_to_index_dir(self, source_path):
            captured["mapped_source"] = source_path
            return project_index

    class FakeRegistryStore:
        def initialize(self):
            captured["registry_initialized"] = True

        def unregister_project(self, source_path):
            captured["unregistered_project"] = source_path
            return True

        def close(self):
            captured["registry_closed"] = True

    def fake_remove_tree(target):
        captured["removed_target"] = target
        return {
            "removed": False,
            "partial": True,
            "locked_paths": [str(locked_path)],
            "remaining_path": str(project_index),
            "errors": [],
        }

    monkeypatch.setattr(commands, "PathMapper", FakePathMapper)
    monkeypatch.setattr(commands, "RegistryStore", FakeRegistryStore)
    monkeypatch.setattr(commands, "_remove_tree_best_effort", fake_remove_tree)

    runner = CliRunner()
    result = runner.invoke(app, ["clean", str(workspace), "--json"])

    assert result.exit_code == 0, result.output
    payload = json.loads(result.stdout)
    body = payload["result"]
    assert payload["success"] is True
    assert body["cleaned"] == str(workspace.resolve())
    assert body["index_path"] == str(project_index)
    assert body["partial"] is True
    assert body["locked_paths"] == [str(locked_path)]
    assert body["remaining_path"] == str(project_index)
    assert captured["registry_initialized"] is True
    assert captured["registry_closed"] is True
    assert captured["unregistered_project"] == workspace.resolve()
    assert captured["removed_target"] == project_index
