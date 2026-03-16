import logging
import os
import sqlite3
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from codexlens.config import (
    BINARY_VECTORS_MMAP_NAME,
    Config,
    VECTORS_HNSW_NAME,
    VECTORS_META_DB_NAME,
)
from codexlens.entities import SearchResult, Symbol
import codexlens.search.chain_search as chain_search_module
from codexlens.search.chain_search import (
    ChainSearchEngine,
    ChainSearchResult,
    SearchOptions,
    SearchStats,
)
from codexlens.storage.global_index import GlobalSymbolIndex
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore


@pytest.fixture()
def temp_paths():
    tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    root = Path(tmpdir.name)
    yield root
    try:
        tmpdir.cleanup()
    except (PermissionError, OSError):
        pass


def test_symbol_filtering_handles_path_failures(monkeypatch: pytest.MonkeyPatch, caplog, temp_paths: Path) -> None:
    project_root = temp_paths / "project"
    (project_root / "src").mkdir(parents=True, exist_ok=True)

    index_root = temp_paths / "indexes"
    mapper = PathMapper(index_root=index_root)
    index_db_path = mapper.source_to_index_db(project_root)
    index_db_path.parent.mkdir(parents=True, exist_ok=True)
    index_db_path.write_text("", encoding="utf-8")  # existence is enough for _find_start_index

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    project_info = registry.register_project(project_root, mapper.source_to_index_dir(project_root))

    global_db_path = project_info.index_root / GlobalSymbolIndex.DEFAULT_DB_NAME
    global_index = GlobalSymbolIndex(global_db_path, project_id=project_info.id)
    global_index.initialize()

    valid_file = project_root / "src" / "auth.py"
    valid_sym = Symbol(name="AuthManager", kind="class", range=(1, 2), file=str(valid_file))
    bad_null = Symbol(name="BadNull", kind="class", range=(1, 2), file="bad\0path.py")
    bad_relative = Symbol(name="BadRelative", kind="class", range=(1, 2), file="relative/path.py")

    candidates = [valid_sym, bad_null, bad_relative]

    if os.name == "nt":
        root_drive, _ = os.path.splitdrive(str(project_root.resolve()))
        other_drive = "C:" if root_drive.lower() != "c:" else "D:"
        candidates.append(
            Symbol(name="CrossDrive", kind="class", range=(1, 2), file=f"{other_drive}\\other\\file.py")
        )

    def fake_search(self, name: str, kind=None, limit: int = 20, prefix_mode: bool = False):
        return candidates

    monkeypatch.setattr(GlobalSymbolIndex, "search", fake_search)

    config = Config(data_dir=temp_paths / "data", global_symbol_index_enabled=True)
    engine = ChainSearchEngine(registry, mapper, config=config)
    engine._search_symbols_parallel = MagicMock(side_effect=AssertionError("should not traverse chain"))

    caplog.set_level(logging.DEBUG, logger="codexlens.search.chain_search")
    symbols = engine.search_symbols(
        "Auth",
        project_root,
        options=SearchOptions(depth=5, total_limit=10),
    )

    assert [s.name for s in symbols] == ["AuthManager"]
    assert "BadNull" in caplog.text
    assert "BadRelative" in caplog.text
    if os.name == "nt":
        assert "CrossDrive" in caplog.text


def test_cascade_search_strategy_routing(temp_paths: Path) -> None:
    """Test cascade_search() routes to correct strategy implementation."""
    from unittest.mock import patch
    from codexlens.search.chain_search import ChainSearchResult, SearchStats

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data")

    engine = ChainSearchEngine(registry, mapper, config=config)
    source_path = temp_paths / "src"

    # Test strategy='staged' routing
    with patch.object(engine, "staged_cascade_search") as mock_staged:
        mock_staged.return_value = ChainSearchResult(
            query="query", results=[], symbols=[], stats=SearchStats()
        )
        engine.cascade_search("query", source_path, strategy="staged")
        mock_staged.assert_called_once()

    # Test strategy='binary' routing
    with patch.object(engine, "binary_cascade_search") as mock_binary:
        mock_binary.return_value = ChainSearchResult(
            query="query", results=[], symbols=[], stats=SearchStats()
        )
        engine.cascade_search("query", source_path, strategy="binary")
        mock_binary.assert_called_once()

    # Test strategy='binary_rerank' routing
    with patch.object(engine, "binary_rerank_cascade_search") as mock_br:
        mock_br.return_value = ChainSearchResult(
            query="query", results=[], symbols=[], stats=SearchStats()
        )
        engine.cascade_search("query", source_path, strategy="binary_rerank")
        mock_br.assert_called_once()

    # Test strategy='dense_rerank' routing
    with patch.object(engine, "dense_rerank_cascade_search") as mock_dr:
        mock_dr.return_value = ChainSearchResult(
            query="query", results=[], symbols=[], stats=SearchStats()
        )
        engine.cascade_search("query", source_path, strategy="dense_rerank")
        mock_dr.assert_called_once()

    # Test default routing (no strategy specified) - defaults to binary
    with patch.object(engine, "binary_cascade_search") as mock_default:
        mock_default.return_value = ChainSearchResult(
            query="query", results=[], symbols=[], stats=SearchStats()
        )
        engine.cascade_search("query", source_path)
        mock_default.assert_called_once()


def test_cascade_search_invalid_strategy(temp_paths: Path) -> None:
    """Test cascade_search() defaults to 'binary' for invalid strategy."""
    from unittest.mock import patch
    from codexlens.search.chain_search import ChainSearchResult, SearchStats

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data")

    engine = ChainSearchEngine(registry, mapper, config=config)
    source_path = temp_paths / "src"

    # Invalid strategy should default to binary
    with patch.object(engine, "binary_cascade_search") as mock_binary:
        mock_binary.return_value = ChainSearchResult(
            query="query", results=[], symbols=[], stats=SearchStats()
        )
        engine.cascade_search("query", source_path, strategy="invalid_strategy")
        mock_binary.assert_called_once()


def test_vector_warmup_uses_embedding_config(monkeypatch: pytest.MonkeyPatch, temp_paths: Path) -> None:
    calls: list[dict[str, object]] = []

    def fake_get_embedder(**kwargs: object) -> object:
        calls.append(dict(kwargs))
        return object()

    import codexlens.semantic.factory as factory

    monkeypatch.setattr(factory, "get_embedder", fake_get_embedder)

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(
        data_dir=temp_paths / "data",
        embedding_backend="fastembed",
        embedding_model="fast",
        embedding_use_gpu=False,
    )

    engine = ChainSearchEngine(registry, mapper, config=config)
    monkeypatch.setattr(engine, "_get_executor", lambda _workers: MagicMock())

    engine._search_parallel([], "query", SearchOptions(enable_vector=True))

    assert calls == [
        {
            "backend": "fastembed",
            "profile": "fast",
            "use_gpu": False,
        }
    ]


def test_search_single_index_passes_config_to_hybrid_engine(
    monkeypatch: pytest.MonkeyPatch, temp_paths: Path
) -> None:
    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data", embedding_backend="fastembed", embedding_model="code")

    engine = ChainSearchEngine(registry, mapper, config=config)
    index_path = temp_paths / "indexes" / "project" / "_index.db"
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_bytes(b"\x00" * 128)

    captured: dict[str, object] = {}

    class FakeHybridSearchEngine:
        def __init__(self, *, weights=None, config=None):
            captured["weights"] = weights
            captured["config"] = config

        def search(self, *_args, **_kwargs):
            return [SearchResult(path="src/app.py", score=0.9, excerpt="hit")]

    monkeypatch.setattr(chain_search_module, "HybridSearchEngine", FakeHybridSearchEngine)

    results = engine._search_single_index(
        index_path,
        "auth flow",
        limit=5,
        hybrid_mode=True,
        enable_vector=True,
        hybrid_weights={"vector": 1.0},
    )

    assert captured["config"] is config
    assert captured["weights"] == {"vector": 1.0}
    assert len(results) == 1
    assert results[0].path == "src/app.py"


def test_search_parallel_reuses_shared_hybrid_engine(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    from concurrent.futures import Future

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data")

    engine = ChainSearchEngine(registry, mapper, config=config)
    index_root = temp_paths / "indexes" / "project"
    index_a = index_root / "src" / "_index.db"
    index_b = index_root / "tests" / "_index.db"
    index_a.parent.mkdir(parents=True, exist_ok=True)
    index_b.parent.mkdir(parents=True, exist_ok=True)
    index_a.write_bytes(b"\x00" * 128)
    index_b.write_bytes(b"\x00" * 128)

    created_engines: list[object] = []
    search_calls: list[tuple[object, Path]] = []

    class FakeHybridSearchEngine:
        def __init__(self, *, weights=None, config=None):
            self.weights = weights
            self.config = config
            created_engines.append(self)

        def search(self, index_path, *_args, **_kwargs):
            search_calls.append((self, index_path))
            return [SearchResult(path=str(index_path), score=0.9, excerpt="hit")]

    class ImmediateExecutor:
        def submit(self, fn, *args):
            future: Future = Future()
            try:
                future.set_result(fn(*args))
            except Exception as exc:
                future.set_exception(exc)
            return future

    monkeypatch.setattr(chain_search_module, "HybridSearchEngine", FakeHybridSearchEngine)
    monkeypatch.setattr(engine, "_get_executor", lambda _workers: ImmediateExecutor())

    results, stats = engine._search_parallel(
        [index_a, index_b],
        "auth flow",
        SearchOptions(
            hybrid_mode=True,
            enable_vector=True,
            limit_per_dir=5,
            hybrid_weights={"vector": 1.0},
        ),
    )

    assert stats.errors == []
    assert len(created_engines) == 1
    assert [path for _, path in search_calls] == [index_a, index_b]
    assert all(shared is created_engines[0] for shared, _ in search_calls)
    assert len(results) == 2


def test_search_injects_feature_query_anchors_into_merge(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data")
    engine = ChainSearchEngine(registry, mapper, config=config)

    source_path = temp_paths / "project"
    start_index = temp_paths / "indexes" / "project" / "_index.db"
    start_index.parent.mkdir(parents=True, exist_ok=True)
    start_index.write_text("", encoding="utf-8")

    feature_path = str(source_path / "src" / "tools" / "smart-search.ts")
    platform_path = str(source_path / "src" / "utils" / "path-resolver.ts")
    anchor_result = SearchResult(
        path=feature_path,
        score=8.0,
        excerpt="smart search anchor",
        metadata={"feature_query_hint": "smart search"},
    )

    monkeypatch.setattr(engine, "_find_start_index", lambda _source_path: start_index)
    monkeypatch.setattr(
        engine,
        "_collect_index_paths",
        lambda _start_index, _options: [start_index],
    )
    monkeypatch.setattr(
        engine,
        "_search_parallel",
        lambda *_args, **_kwargs: (
            [
                SearchResult(
                    path=platform_path,
                    score=0.9,
                    excerpt="platform hit",
                )
            ],
            SearchStats(),
        ),
    )
    monkeypatch.setattr(engine, "_search_symbols_parallel", lambda *_args, **_kwargs: [])
    collected_queries: list[str] = []
    monkeypatch.setattr(
        engine,
        "_collect_query_feature_anchor_results",
        lambda query, *_args, **_kwargs: (
            collected_queries.append(query),
            [anchor_result],
        )[1],
    )

    result = engine.search(
        "parse CodexLens JSON output strip ANSI smart_search",
        source_path,
        options=SearchOptions(
            total_limit=5,
            hybrid_mode=True,
            enable_fuzzy=False,
            enable_vector=True,
        ),
    )

    assert collected_queries == ["parse CodexLens JSON output strip ANSI smart_search"]
    result_by_path = {item.path: item for item in result.results}
    assert feature_path in result_by_path
    assert platform_path in result_by_path
    assert result_by_path[feature_path].metadata["feature_query_anchor"] is True
    assert result_by_path[feature_path].metadata["feature_query_hint"] == "smart search"


def test_group_index_paths_by_dense_root(temp_paths: Path) -> None:
    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    engine = ChainSearchEngine(registry, mapper, config=Config(data_dir=temp_paths / "data"))

    dense_root_a = temp_paths / "indexes" / "project-a"
    dense_root_b = temp_paths / "indexes" / "project-b"
    orphan_root = temp_paths / "indexes" / "orphan" / "pkg"

    dense_root_a.mkdir(parents=True, exist_ok=True)
    dense_root_b.mkdir(parents=True, exist_ok=True)
    orphan_root.mkdir(parents=True, exist_ok=True)
    (dense_root_a / VECTORS_HNSW_NAME).write_bytes(b"a")
    (dense_root_b / VECTORS_HNSW_NAME).write_bytes(b"b")

    index_a = dense_root_a / "src" / "_index.db"
    index_b = dense_root_b / "tests" / "_index.db"
    orphan_index = orphan_root / "_index.db"
    index_a.parent.mkdir(parents=True, exist_ok=True)
    index_b.parent.mkdir(parents=True, exist_ok=True)
    index_a.write_text("", encoding="utf-8")
    index_b.write_text("", encoding="utf-8")
    orphan_index.write_text("", encoding="utf-8")

    roots, ungrouped = engine._group_index_paths_by_dense_root(
        [index_a, orphan_index, index_b]
    )

    assert roots == [dense_root_a, dense_root_b]
    assert ungrouped == [orphan_index]
    assert engine._find_nearest_dense_hnsw_root(index_a.parent) == dense_root_a
    assert engine._find_nearest_dense_hnsw_root(orphan_index.parent) is None


def test_stage1_binary_search_merges_multiple_centralized_roots(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    import numpy as np

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data", embedding_use_gpu=False)
    engine = ChainSearchEngine(registry, mapper, config=config)

    root_a = temp_paths / "indexes" / "project-a"
    root_b = temp_paths / "indexes" / "project-b"
    for root in (root_a, root_b):
        root.mkdir(parents=True, exist_ok=True)
        (root / BINARY_VECTORS_MMAP_NAME).write_bytes(b"binary")
        (root / VECTORS_META_DB_NAME).write_bytes(b"meta")

    index_a = root_a / "src" / "_index.db"
    index_b = root_b / "src" / "_index.db"
    index_a.parent.mkdir(parents=True, exist_ok=True)
    index_b.parent.mkdir(parents=True, exist_ok=True)
    index_a.write_text("", encoding="utf-8")
    index_b.write_text("", encoding="utf-8")

    class FakeBinarySearcher:
        def __init__(self, root: Path) -> None:
            self.root = root
            self.backend = "fastembed"
            self.model = None
            self.model_profile = "code"

        def search(self, _query_dense, top_k: int):
            return [(1, 8)] if self.root == root_a else [(2, 16)]

    class FakeEmbedder:
        def embed_to_numpy(self, _queries):
            return np.ones((1, 4), dtype=np.float32)

    class FakeVectorMetadataStore:
        def __init__(self, path: Path) -> None:
            self.path = Path(path)

        def get_chunks_by_ids(self, chunk_ids):
            return [
                {
                    "id": chunk_id,
                    "file_path": str(self.path.parent / f"file{chunk_id}.py"),
                    "content": f"chunk {chunk_id}",
                    "metadata": "{\"start_line\": 1, \"end_line\": 2}",
                    "category": "code",
                }
                for chunk_id in chunk_ids
            ]

    import codexlens.semantic.embedder as embedder_module
    from codexlens.search.chain_search import SearchStats

    monkeypatch.setattr(
        engine,
        "_get_centralized_binary_searcher",
        lambda root: FakeBinarySearcher(root),
    )
    monkeypatch.setattr(embedder_module, "get_embedder", lambda **_kwargs: FakeEmbedder())
    monkeypatch.setattr(chain_search_module, "VectorMetadataStore", FakeVectorMetadataStore)

    coarse_results, stage2_root = engine._stage1_binary_search(
        "binary query",
        [index_a, index_b],
        coarse_k=5,
        stats=SearchStats(),
        index_root=index_a.parent,
    )

    assert stage2_root is None
    assert len(coarse_results) == 2
    assert {Path(result.path).name for result in coarse_results} == {"file1.py", "file2.py"}


def test_stage1_binary_search_keeps_duplicate_chunk_ids_isolated_per_root(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    import numpy as np

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data", embedding_use_gpu=False)
    engine = ChainSearchEngine(registry, mapper, config=config)

    root_a = temp_paths / "indexes" / "project-a"
    root_b = temp_paths / "indexes" / "project-b"
    for root in (root_a, root_b):
        root.mkdir(parents=True, exist_ok=True)
        (root / BINARY_VECTORS_MMAP_NAME).write_bytes(b"binary")
        (root / VECTORS_META_DB_NAME).write_bytes(b"meta")

    index_a = root_a / "src" / "_index.db"
    index_b = root_b / "src" / "_index.db"
    index_a.parent.mkdir(parents=True, exist_ok=True)
    index_b.parent.mkdir(parents=True, exist_ok=True)
    index_a.write_text("", encoding="utf-8")
    index_b.write_text("", encoding="utf-8")

    class FakeBinarySearcher:
        def __init__(self, root: Path) -> None:
            self.root = root
            self.backend = "fastembed"
            self.model = None
            self.model_profile = "code"

        def search(self, _query_dense, top_k: int):
            return [(1, 8)] if self.root == root_a else [(1, 16)]

    class FakeEmbedder:
        def embed_to_numpy(self, _queries):
            return np.ones((1, 4), dtype=np.float32)

    class FakeVectorMetadataStore:
        def __init__(self, path: Path) -> None:
            self.path = Path(path)

        def get_chunks_by_ids(self, chunk_ids):
            return [
                {
                    "id": chunk_id,
                    "file_path": str(self.path.parent / f"{self.path.parent.name}-file{chunk_id}.py"),
                    "content": f"chunk {self.path.parent.name}-{chunk_id}",
                    "metadata": "{\"start_line\": 1, \"end_line\": 2}",
                    "category": "code",
                }
                for chunk_id in chunk_ids
            ]

    import codexlens.semantic.embedder as embedder_module
    from codexlens.search.chain_search import SearchStats

    monkeypatch.setattr(
        engine,
        "_get_centralized_binary_searcher",
        lambda root: FakeBinarySearcher(root),
    )
    monkeypatch.setattr(embedder_module, "get_embedder", lambda **_kwargs: FakeEmbedder())
    monkeypatch.setattr(chain_search_module, "VectorMetadataStore", FakeVectorMetadataStore)

    coarse_results, stage2_root = engine._stage1_binary_search(
        "binary query",
        [index_a, index_b],
        coarse_k=5,
        stats=SearchStats(),
        index_root=index_a.parent,
    )

    assert stage2_root is None
    scores_by_name = {Path(result.path).name: result.score for result in coarse_results}
    assert scores_by_name["project-a-file1.py"] == pytest.approx(1.0 - (8.0 / 256.0))
    assert scores_by_name["project-b-file1.py"] == pytest.approx(1.0 - (16.0 / 256.0))



def test_collect_index_paths_includes_nested_registered_project_roots(
    temp_paths: Path,
) -> None:
    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    engine = ChainSearchEngine(registry, mapper, config=Config(data_dir=temp_paths / "data"))

    workspace_root = temp_paths / "workspace"
    child_root = workspace_root / "packages" / "child"
    ignored_root = workspace_root / "dist" / "generated"

    workspace_index = mapper.source_to_index_db(workspace_root)
    child_index = mapper.source_to_index_db(child_root)
    ignored_index = mapper.source_to_index_db(ignored_root)

    for index_path in (workspace_index, child_index, ignored_index):
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text("", encoding="utf-8")

    workspace_project = registry.register_project(
        workspace_root,
        mapper.source_to_index_dir(workspace_root),
    )
    child_project = registry.register_project(
        child_root,
        mapper.source_to_index_dir(child_root),
    )
    ignored_project = registry.register_project(
        ignored_root,
        mapper.source_to_index_dir(ignored_root),
    )

    registry.register_dir(
        workspace_project.id,
        workspace_root,
        workspace_index,
        depth=0,
    )
    registry.register_dir(
        child_project.id,
        child_root,
        child_index,
        depth=0,
    )
    registry.register_dir(
        ignored_project.id,
        ignored_root,
        ignored_index,
        depth=0,
    )

    collected = engine._collect_index_paths(workspace_index, depth=-1)

    assert collected == [workspace_index, child_index]


def test_collect_index_paths_respects_depth_for_nested_registered_project_roots(
    temp_paths: Path,
) -> None:
    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    engine = ChainSearchEngine(registry, mapper, config=Config(data_dir=temp_paths / "data"))

    workspace_root = temp_paths / "workspace"
    direct_child_root = workspace_root / "apps"
    deep_child_root = workspace_root / "packages" / "deep" / "child"

    workspace_index = mapper.source_to_index_db(workspace_root)
    direct_child_index = mapper.source_to_index_db(direct_child_root)
    deep_child_index = mapper.source_to_index_db(deep_child_root)

    for index_path in (workspace_index, direct_child_index, deep_child_index):
        index_path.parent.mkdir(parents=True, exist_ok=True)
        index_path.write_text("", encoding="utf-8")

    workspace_project = registry.register_project(
        workspace_root,
        mapper.source_to_index_dir(workspace_root),
    )
    direct_child_project = registry.register_project(
        direct_child_root,
        mapper.source_to_index_dir(direct_child_root),
    )
    deep_child_project = registry.register_project(
        deep_child_root,
        mapper.source_to_index_dir(deep_child_root),
    )

    registry.register_dir(workspace_project.id, workspace_root, workspace_index, depth=0)
    registry.register_dir(
        direct_child_project.id,
        direct_child_root,
        direct_child_index,
        depth=0,
    )
    registry.register_dir(
        deep_child_project.id,
        deep_child_root,
        deep_child_index,
        depth=0,
    )

    collected = engine._collect_index_paths(workspace_index, depth=1)

    assert collected == [workspace_index, direct_child_index]


def test_binary_rerank_cascade_search_merges_multiple_centralized_roots(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    import numpy as np

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data", embedding_use_gpu=False)
    engine = ChainSearchEngine(registry, mapper, config=config)

    root_a = temp_paths / "indexes" / "project-a"
    root_b = temp_paths / "indexes" / "project-b"
    for root in (root_a, root_b):
        root.mkdir(parents=True, exist_ok=True)
        (root / BINARY_VECTORS_MMAP_NAME).write_bytes(b"binary")
        (root / VECTORS_META_DB_NAME).write_bytes(b"meta")

    index_a = root_a / "src" / "_index.db"
    index_b = root_b / "src" / "_index.db"
    index_a.parent.mkdir(parents=True, exist_ok=True)
    index_b.parent.mkdir(parents=True, exist_ok=True)
    index_a.write_text("", encoding="utf-8")
    index_b.write_text("", encoding="utf-8")

    class FakeBinarySearcher:
        def __init__(self, root: Path) -> None:
            self.root = root
            self.backend = "fastembed"
            self.model = None
            self.model_profile = "code"

        def search(self, _query_dense, top_k: int):
            return [(1, 8)] if self.root == root_a else [(2, 16)]

    class FakeEmbedder:
        def embed_to_numpy(self, _queries):
            return np.ones((1, 4), dtype=np.float32)

    class FakeVectorMetadataStore:
        def __init__(self, path: Path) -> None:
            self.path = Path(path)

        def get_chunks_by_ids(self, chunk_ids):
            return [
                {
                    "chunk_id": chunk_id,
                    "file_path": str(self.path.parent / f"file{chunk_id}.py"),
                    "content": f"chunk {chunk_id}",
                    "metadata": "{}",
                    "category": "code",
                }
                for chunk_id in chunk_ids
            ]

    import codexlens.semantic.embedder as embedder_module

    monkeypatch.setattr(engine, "_find_start_index", lambda _source_path: index_a)
    monkeypatch.setattr(engine, "_collect_index_paths", lambda _start_index, _depth: [index_a, index_b])
    monkeypatch.setattr(
        engine,
        "_get_centralized_binary_searcher",
        lambda root: FakeBinarySearcher(root),
    )
    monkeypatch.setattr(embedder_module, "get_embedder", lambda **_kwargs: FakeEmbedder())
    monkeypatch.setattr(chain_search_module, "VectorMetadataStore", FakeVectorMetadataStore)
    monkeypatch.setattr(engine, "_cross_encoder_rerank", lambda _query, results, top_k: results[:top_k])
    monkeypatch.setattr(engine, "search", lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("unexpected fallback")))

    result = engine.binary_rerank_cascade_search(
        "binary query",
        index_a.parent,
        k=5,
        coarse_k=5,
    )

    assert len(result.results) == 2
    assert {Path(item.path).name for item in result.results} == {"file1.py", "file2.py"}


def test_dense_rerank_cascade_search_overfetches_and_applies_path_penalties(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    import numpy as np
    import codexlens.semantic.ann_index as ann_index_module

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(
        data_dir=temp_paths / "data",
        embedding_use_gpu=False,
        reranker_top_k=3,
        test_file_penalty=0.35,
        generated_file_penalty=0.35,
    )
    engine = ChainSearchEngine(registry, mapper, config=config)

    dense_root = temp_paths / "indexes" / "project"
    dense_root.mkdir(parents=True, exist_ok=True)
    (dense_root / VECTORS_HNSW_NAME).write_bytes(b"hnsw")

    meta_db_path = dense_root / VECTORS_META_DB_NAME
    conn = sqlite3.connect(meta_db_path)
    conn.execute(
        """
        CREATE TABLE chunk_metadata (
            chunk_id INTEGER PRIMARY KEY,
            file_path TEXT NOT NULL,
            content TEXT NOT NULL,
            start_line INTEGER,
            end_line INTEGER
        )
        """
    )
    conn.executemany(
        """
        INSERT INTO chunk_metadata (chunk_id, file_path, content, start_line, end_line)
        VALUES (?, ?, ?, ?, ?)
        """,
        [
            (
                1,
                "project/tests/test_auth.py",
                "def test_auth_flow():\n    pass",
                1,
                2,
            ),
            (
                2,
                "project/src/auth.py",
                "def auth_flow():\n    return True",
                1,
                2,
            ),
            (
                3,
                "project/dist/bundle.js",
                "function authFlow(){return true;}",
                1,
                1,
            ),
        ],
    )
    conn.commit()
    conn.close()

    index_path = dense_root / "src" / "_index.db"
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text("", encoding="utf-8")

    class FakeANNIndex:
        def __init__(self, root: Path, dim: int) -> None:
            self.root = root
            self.dim = dim

        @classmethod
        def create_central(cls, *, index_root: Path, dim: int):
            return cls(index_root, dim)

        def load(self) -> bool:
            return True

        def count(self) -> int:
            return 3

        def search(self, _query_dense, top_k: int):
            ids = [1, 2, 3][:top_k]
            distances = [0.01, 0.02, 0.03][:top_k]
            return ids, distances

    rerank_calls: list[int] = []

    def fake_cross_encoder(_query: str, results: list[SearchResult], top_k: int):
        rerank_calls.append(top_k)
        return results[:top_k]

    monkeypatch.setattr(engine, "_find_start_index", lambda _source_path: index_path)
    monkeypatch.setattr(engine, "_collect_index_paths", lambda _start_index, _depth: [index_path])
    monkeypatch.setattr(engine, "_embed_dense_query", lambda *_args, **_kwargs: np.ones(4, dtype=np.float32))
    monkeypatch.setattr(engine, "_cross_encoder_rerank", fake_cross_encoder)
    monkeypatch.setattr(
        engine,
        "search",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("unexpected fallback")),
    )
    monkeypatch.setattr(ann_index_module, "ANNIndex", FakeANNIndex)

    result = engine.dense_rerank_cascade_search(
        "auth",
        index_path.parent,
        k=1,
        coarse_k=3,
    )

    assert rerank_calls == [3]
    assert len(result.results) == 1
    assert result.results[0].path.endswith("src\\auth.py") or result.results[0].path.endswith("src/auth.py")
    assert result.results[0].metadata == {}


def test_collect_query_feature_anchor_results_uses_explicit_file_hints(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data", embedding_use_gpu=False)
    engine = ChainSearchEngine(registry, mapper, config=config)

    recorded_queries: list[str] = []

    def fake_search(query: str, _source_path: Path, options: SearchOptions | None = None):
        recorded_queries.append(query)
        return ChainSearchResult(
            query=query,
            results=[
                SearchResult(
                    path="/repo/src/tools/smart-search.ts",
                    score=8.7,
                    excerpt="smart search path anchor",
                ),
                SearchResult(
                    path="/repo/src/tools/codex-lens-lsp.ts",
                    score=7.4,
                    excerpt="platform term overlap",
                ),
            ],
            symbols=[],
            stats=SearchStats(),
        )

    monkeypatch.setattr(engine, "search", fake_search)

    anchors = engine._collect_query_feature_anchor_results(
        "parse CodexLens JSON output strip ANSI smart_search",
        temp_paths,
        SearchOptions(),
        limit=4,
    )

    assert recorded_queries == ["smart search"]
    assert [Path(result.path).name for result in anchors] == ["smart-search.ts"]
    assert anchors[0].metadata["feature_query_anchor"] is True
    assert anchors[0].metadata["feature_query_hint_tokens"] == ["smart", "search"]


def test_collect_query_feature_anchor_results_falls_back_to_full_lexical_query(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data", embedding_use_gpu=False)
    engine = ChainSearchEngine(registry, mapper, config=config)

    recorded_calls: list[tuple[str, bool]] = []
    full_query = "EMBEDDING_BACKEND and RERANKER_BACKEND environment variables"

    def fake_search(query: str, _source_path: Path, options: SearchOptions | None = None):
        recorded_calls.append((query, bool(options.inject_feature_anchors) if options else True))
        if query == full_query:
            return ChainSearchResult(
                query=query,
                results=[
                    SearchResult(
                        path="/repo/src/codexlens/env_config.py",
                        score=8.5,
                        excerpt="ENV vars",
                    ),
                    SearchResult(
                        path="/repo/src/codexlens/config.py",
                        score=8.1,
                        excerpt="backend config",
                    ),
                ],
                symbols=[],
                stats=SearchStats(),
            )

        return ChainSearchResult(
            query=query,
            results=[
                SearchResult(
                    path="/repo/src/codexlens/env_config.py",
                    score=7.0,
                    excerpt="hint candidate",
                )
            ],
            symbols=[],
            stats=SearchStats(),
        )

    monkeypatch.setattr(engine, "search", fake_search)

    anchors = engine._collect_query_feature_anchor_results(
        full_query,
        temp_paths,
        SearchOptions(),
        limit=2,
    )

    assert recorded_calls == [
        ("embedding backend", False),
        ("reranker backend", False),
        (full_query, False),
    ]
    assert [Path(result.path).name for result in anchors] == ["env_config.py", "config.py"]
    assert anchors[0].metadata["feature_query_seed_kind"] == "lexical_query"
    assert anchors[0].metadata["feature_query_hint"] == full_query


def test_stage3_cluster_prune_preserves_feature_query_anchors(temp_paths: Path) -> None:
    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data", embedding_use_gpu=False)
    config.staged_clustering_strategy = "score"
    engine = ChainSearchEngine(registry, mapper, config=config)

    anchor = SearchResult(
        path="/repo/src/tools/smart-search.ts",
        score=0.02,
        excerpt="parse JSON output and strip ANSI",
        metadata={
            "feature_query_anchor": True,
            "feature_query_hint": "smart search",
            "feature_query_hint_tokens": ["smart", "search"],
        },
    )
    others = [
        SearchResult(
            path=f"/repo/src/feature-{index}.ts",
            score=0.9 - (0.05 * index),
            excerpt="generic feature implementation",
        )
        for index in range(6)
    ]

    clustered = engine._stage3_cluster_prune(
        [anchor, *others],
        target_count=4,
        query="parse CodexLens JSON output strip ANSI smart_search",
    )

    assert len(clustered) == 4
    assert any(Path(result.path).name == "smart-search.ts" for result in clustered)


def test_dense_rerank_cascade_search_interleaves_mixed_embedding_groups(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    import numpy as np
    import codexlens.semantic.ann_index as ann_index_module

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data", embedding_use_gpu=False)
    engine = ChainSearchEngine(registry, mapper, config=config)

    root_a = temp_paths / "indexes" / "project-a"
    root_b = temp_paths / "indexes" / "project-b"
    for root in (root_a, root_b):
        root.mkdir(parents=True, exist_ok=True)
        (root / VECTORS_HNSW_NAME).write_bytes(b"hnsw")

    for meta_db_path, rows in (
        (
            root_a / VECTORS_META_DB_NAME,
            [
                (1, str(root_a / "src" / "a.py"), "def a():\n    return 1", 1, 2),
                (3, str(root_a / "src" / "a2.py"), "def a2():\n    return 2", 1, 2),
            ],
        ),
        (
            root_b / VECTORS_META_DB_NAME,
            [
                (2, str(root_b / "src" / "b.py"), "def b():\n    return 3", 1, 2),
            ],
        ),
    ):
        conn = sqlite3.connect(meta_db_path)
        conn.execute(
            """
            CREATE TABLE chunk_metadata (
                chunk_id INTEGER PRIMARY KEY,
                file_path TEXT NOT NULL,
                content TEXT NOT NULL,
                start_line INTEGER,
                end_line INTEGER
            )
            """
        )
        conn.executemany(
            """
            INSERT INTO chunk_metadata (chunk_id, file_path, content, start_line, end_line)
            VALUES (?, ?, ?, ?, ?)
            """,
            rows,
        )
        conn.commit()
        conn.close()

    index_a = root_a / "src" / "_index.db"
    index_b = root_b / "src" / "_index.db"
    index_a.parent.mkdir(parents=True, exist_ok=True)
    index_b.parent.mkdir(parents=True, exist_ok=True)
    index_a.write_text("", encoding="utf-8")
    index_b.write_text("", encoding="utf-8")

    class FakeANNIndex:
        def __init__(self, index_path: Path, dim: int) -> None:
            source = Path(index_path)
            self.root = source if source.name != "_index.db" else source.parent
            self.dim = dim

        @classmethod
        def create_central(cls, *, index_root: Path, dim: int):
            return cls(index_root, dim)

        def load(self) -> bool:
            return True

        def count(self) -> int:
            return 2 if self.root == root_a else 1

        def search(self, _query_dense, top_k: int):
            if self.root == root_a:
                return [1, 3][:top_k], [0.01, 0.011][:top_k]
            return [2][:top_k], [0.02][:top_k]

    monkeypatch.setattr(engine, "_find_start_index", lambda _source_path: index_a)
    monkeypatch.setattr(engine, "_collect_index_paths", lambda _start_index, _depth: [index_a, index_b])
    monkeypatch.setattr(
        engine,
        "_resolve_dense_embedding_settings",
        lambda *, index_root: (
            ("fastembed", "code", False)
            if Path(index_root) == root_a
            else ("litellm", "qwen3-embedding-sf", False)
        ),
    )
    monkeypatch.setattr(
        engine,
        "_embed_dense_query",
        lambda _query, *, index_root=None, query_cache=None: (
            np.ones(4, dtype=np.float32)
            if Path(index_root) == root_a
            else np.ones(8, dtype=np.float32)
        ),
    )
    monkeypatch.setattr(engine, "_cross_encoder_rerank", lambda _query, results, top_k: results[:top_k])
    monkeypatch.setattr(
        engine,
        "search",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("unexpected fallback")),
    )
    monkeypatch.setattr(ann_index_module, "ANNIndex", FakeANNIndex)

    result = engine.dense_rerank_cascade_search(
        "route query",
        index_a.parent,
        k=2,
        coarse_k=2,
    )

    assert [Path(item.path).name for item in result.results] == ["a.py", "b.py"]


def test_dense_rerank_cascade_search_reuses_cached_dense_indexes(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    import numpy as np
    import codexlens.semantic.ann_index as ann_index_module

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data", embedding_use_gpu=False)
    engine = ChainSearchEngine(registry, mapper, config=config)

    dense_root = temp_paths / "indexes" / "project"
    dense_root.mkdir(parents=True, exist_ok=True)
    (dense_root / VECTORS_HNSW_NAME).write_bytes(b"hnsw")

    meta_db_path = dense_root / VECTORS_META_DB_NAME
    conn = sqlite3.connect(meta_db_path)
    conn.execute(
        """
        CREATE TABLE chunk_metadata (
            chunk_id INTEGER PRIMARY KEY,
            file_path TEXT NOT NULL,
            content TEXT NOT NULL,
            start_line INTEGER,
            end_line INTEGER
        )
        """
    )
    conn.execute(
        "INSERT INTO chunk_metadata (chunk_id, file_path, content, start_line, end_line) VALUES (?, ?, ?, ?, ?)",
        (1, str((temp_paths / "src" / "impl.py").resolve()), "def impl():\n    return 1", 1, 2),
    )
    conn.commit()
    conn.close()

    index_path = dense_root / "src" / "_index.db"
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text("", encoding="utf-8")

    create_calls: list[tuple[Path, int]] = []

    class FakeANNIndex:
        def __init__(self, root: Path, dim: int) -> None:
            self.root = root
            self.dim = dim

        @classmethod
        def create_central(cls, *, index_root: Path, dim: int):
            create_calls.append((Path(index_root), int(dim)))
            return cls(index_root, dim)

        def load(self) -> bool:
            return True

        def count(self) -> int:
            return 1

        def search(self, _query_dense, top_k: int):
            return [1][:top_k], [0.01][:top_k]

    monkeypatch.setattr(engine, "_find_start_index", lambda _source_path: index_path)
    monkeypatch.setattr(engine, "_collect_index_paths", lambda _start_index, _depth: [index_path])
    monkeypatch.setattr(engine, "_embed_dense_query", lambda *_args, **_kwargs: np.ones(4, dtype=np.float32))
    monkeypatch.setattr(engine, "_cross_encoder_rerank", lambda _query, results, top_k: results[:top_k])
    monkeypatch.setattr(
        engine,
        "search",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("unexpected fallback")),
    )
    monkeypatch.setattr(ann_index_module, "ANNIndex", FakeANNIndex)

    first = engine.dense_rerank_cascade_search("route query", index_path.parent, k=1, coarse_k=1)
    second = engine.dense_rerank_cascade_search("route query", index_path.parent, k=1, coarse_k=1)

    assert len(first.results) == 1
    assert len(second.results) == 1
    assert create_calls == [(dense_root, 4)]


def test_dense_rerank_cascade_search_short_circuits_lexical_priority_queries(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data")
    engine = ChainSearchEngine(registry, mapper, config=config)

    expected = ChainSearchResult(
        query="embedding backend fastembed local litellm api config",
        results=[SearchResult(path="src/config.py", score=0.9, excerpt="embedding_backend = ...")],
        symbols=[],
        stats=SearchStats(dirs_searched=3, files_matched=1, time_ms=12.5),
    )
    search_calls: list[tuple[str, Path, SearchOptions | None]] = []

    def fake_search(query: str, source_path: Path, options: SearchOptions | None = None):
        search_calls.append((query, source_path, options))
        return expected

    monkeypatch.setattr(engine, "search", fake_search)
    monkeypatch.setattr(
        engine,
        "_find_start_index",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("dense path should not run")),
    )
    monkeypatch.setattr(
        engine,
        "_embed_dense_query",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("dense query should not run")),
    )
    monkeypatch.setattr(
        engine,
        "_cross_encoder_rerank",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("rerank should not run")),
    )

    options = SearchOptions(
        depth=2,
        max_workers=3,
        limit_per_dir=4,
        total_limit=7,
        include_symbols=True,
        files_only=False,
        code_only=True,
        exclude_extensions=["md"],
        inject_feature_anchors=False,
    )

    result = engine.dense_rerank_cascade_search(
        "embedding backend fastembed local litellm api config",
        temp_paths / "workspace",
        k=5,
        coarse_k=50,
        options=options,
    )

    assert result is not expected
    assert result.results == expected.results
    assert result.related_results == expected.related_results
    assert result.symbols == []
    assert result.stats == expected.stats
    assert len(search_calls) == 1
    called_query, called_source_path, lexical_options = search_calls[0]
    assert called_query == "embedding backend fastembed local litellm api config"
    assert called_source_path == temp_paths / "workspace"
    assert lexical_options is not None
    assert lexical_options.depth == 2
    assert lexical_options.max_workers == 3
    assert lexical_options.limit_per_dir == 10
    assert lexical_options.total_limit == 20
    assert lexical_options.include_symbols is False
    assert lexical_options.enable_vector is False
    assert lexical_options.hybrid_mode is False
    assert lexical_options.enable_cascade is False
    assert lexical_options.code_only is True
    assert lexical_options.exclude_extensions == ["md"]
    assert lexical_options.inject_feature_anchors is False


def test_cross_encoder_rerank_reuses_cached_reranker_instance(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(
        data_dir=temp_paths / "data",
        enable_cross_encoder_rerank=True,
        reranker_backend="onnx",
        reranker_use_gpu=False,
    )
    engine = ChainSearchEngine(registry, mapper, config=config)

    calls: dict[str, object] = {"check": [], "get": []}

    class DummyReranker:
        def score_pairs(self, pairs, batch_size=32):
            _ = batch_size
            return [1.0 for _ in pairs]

    def fake_check_reranker_available(backend: str):
        calls["check"].append(backend)
        return True, None

    def fake_get_reranker(*, backend: str, model_name=None, device=None, **kwargs):
        calls["get"].append(
            {
                "backend": backend,
                "model_name": model_name,
                "device": device,
                "kwargs": kwargs,
            }
        )
        return DummyReranker()

    monkeypatch.setattr(
        "codexlens.semantic.reranker.check_reranker_available",
        fake_check_reranker_available,
    )
    monkeypatch.setattr(
        "codexlens.semantic.reranker.get_reranker",
        fake_get_reranker,
    )

    results = [
        SearchResult(path=str((temp_paths / f"file_{idx}.py").resolve()), score=1.0 / (idx + 1), excerpt=f"def fn_{idx}(): pass")
        for idx in range(3)
    ]

    first = engine._cross_encoder_rerank("find function", results, top_k=2)
    second = engine._cross_encoder_rerank("find function", results, top_k=2)

    assert len(first) == len(second) == len(results)
    assert calls["check"] == ["onnx"]
    assert len(calls["get"]) == 1
    get_call = calls["get"][0]
    assert isinstance(get_call, dict)
    assert get_call["backend"] == "onnx"
    assert get_call["kwargs"]["use_gpu"] is False


def test_collect_binary_coarse_candidates_interleaves_mixed_dense_fallback_groups(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    import numpy as np
    import codexlens.semantic.ann_index as ann_index_module

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data", embedding_use_gpu=False)
    engine = ChainSearchEngine(registry, mapper, config=config)

    root_a = temp_paths / "indexes" / "project-a"
    root_b = temp_paths / "indexes" / "project-b"
    for root in (root_a, root_b):
        root.mkdir(parents=True, exist_ok=True)
        (root / VECTORS_HNSW_NAME).write_bytes(b"hnsw")

    index_a = root_a / "src" / "_index.db"
    index_b = root_b / "src" / "_index.db"
    index_a.parent.mkdir(parents=True, exist_ok=True)
    index_b.parent.mkdir(parents=True, exist_ok=True)
    index_a.write_text("", encoding="utf-8")
    index_b.write_text("", encoding="utf-8")

    class FakeANNIndex:
        def __init__(self, index_path: Path, dim: int) -> None:
            source = Path(index_path)
            self.root = source if source.name != "_index.db" else source.parent
            self.dim = dim

        @classmethod
        def create_central(cls, *, index_root: Path, dim: int):
            return cls(index_root, dim)

        def load(self) -> bool:
            return True

        def count(self) -> int:
            return 2 if self.root == root_a else 1

        def search(self, _query_dense, top_k: int):
            if self.root == root_a:
                return [1, 3][:top_k], [0.01, 0.011][:top_k]
            return [2][:top_k], [0.02][:top_k]

    monkeypatch.setattr(
        engine,
        "_resolve_dense_embedding_settings",
        lambda *, index_root: (
            ("fastembed", "code", False)
            if Path(index_root) == root_a
            else ("litellm", "qwen3-embedding-sf", False)
        ),
    )
    monkeypatch.setattr(
        engine,
        "_embed_dense_query",
        lambda _query, *, index_root=None, query_cache=None: (
            np.ones(4, dtype=np.float32)
            if Path(index_root) == root_a
            else np.ones(8, dtype=np.float32)
        ),
    )
    monkeypatch.setattr(ann_index_module, "ANNIndex", FakeANNIndex)

    coarse_candidates, used_centralized, using_dense_fallback, stage2_index_root = (
        engine._collect_binary_coarse_candidates(
            "route query",
            [index_a, index_b],
            coarse_k=2,
            stats=SearchStats(),
            index_root=index_a.parent,
            allow_dense_fallback=True,
        )
    )

    assert used_centralized is False
    assert using_dense_fallback is True
    assert stage2_index_root is None
    assert coarse_candidates == [
        (1, 0.01, root_a),
        (2, 0.02, root_b),
    ]


def test_cross_encoder_rerank_deduplicates_duplicate_paths_before_reranking(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data", embedding_use_gpu=False)
    engine = ChainSearchEngine(registry, mapper, config=config)

    captured: dict[str, object] = {}

    monkeypatch.setattr(
        "codexlens.semantic.reranker.check_reranker_available",
        lambda _backend: (True, None),
    )
    monkeypatch.setattr(
        "codexlens.semantic.reranker.get_reranker",
        lambda **_kwargs: object(),
    )

    def fake_cross_encoder_rerank(
        *,
        query: str,
        results: list[SearchResult],
        reranker,
        top_k: int = 50,
        batch_size: int = 32,
        chunk_type_weights=None,
        test_file_penalty: float = 0.0,
    ) -> list[SearchResult]:
        captured["query"] = query
        captured["paths"] = [item.path for item in results]
        captured["scores"] = [float(item.score) for item in results]
        captured["top_k"] = top_k
        captured["batch_size"] = batch_size
        captured["chunk_type_weights"] = chunk_type_weights
        captured["test_file_penalty"] = test_file_penalty
        _ = reranker
        return results[:top_k]

    monkeypatch.setattr(
        "codexlens.search.ranking.cross_encoder_rerank",
        fake_cross_encoder_rerank,
    )

    reranked = engine._cross_encoder_rerank(
        "semantic auth query",
        [
            SearchResult(path="/repo/src/router.py", score=0.91, excerpt="chunk 1"),
            SearchResult(path="/repo/src/router.py", score=0.42, excerpt="chunk 2"),
            SearchResult(path="/repo/src/config.py", score=0.73, excerpt="chunk 3"),
        ],
        top_k=5,
    )

    assert captured["query"] == "semantic auth query"
    assert captured["paths"] == ["/repo/src/router.py", "/repo/src/config.py"]
    assert captured["scores"] == pytest.approx([0.91, 0.73])
    assert captured["top_k"] == 5
    assert len(reranked) == 2


def test_binary_cascade_search_merges_multiple_centralized_roots(
    monkeypatch: pytest.MonkeyPatch,
    temp_paths: Path,
) -> None:
    import sqlite3
    import numpy as np

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    mapper = PathMapper(index_root=temp_paths / "indexes")
    config = Config(data_dir=temp_paths / "data", embedding_use_gpu=False)
    engine = ChainSearchEngine(registry, mapper, config=config)

    root_a = temp_paths / "indexes" / "project-a"
    root_b = temp_paths / "indexes" / "project-b"
    source_db_a = root_a / "source-a.db"
    source_db_b = root_b / "source-b.db"

    for root, source_db, chunk_id in ((root_a, source_db_a, 1), (root_b, source_db_b, 2)):
        root.mkdir(parents=True, exist_ok=True)
        (root / BINARY_VECTORS_MMAP_NAME).write_bytes(b"binary")
        (root / VECTORS_META_DB_NAME).write_bytes(b"meta")
        conn = sqlite3.connect(source_db)
        conn.execute("CREATE TABLE semantic_chunks (id INTEGER PRIMARY KEY, embedding_dense BLOB)")
        conn.execute(
            "INSERT INTO semantic_chunks (id, embedding_dense) VALUES (?, ?)",
            (chunk_id, np.ones(4, dtype=np.float32).tobytes()),
        )
        conn.commit()
        conn.close()

    index_a = root_a / "src" / "_index.db"
    index_b = root_b / "src" / "_index.db"
    index_a.parent.mkdir(parents=True, exist_ok=True)
    index_b.parent.mkdir(parents=True, exist_ok=True)
    index_a.write_text("", encoding="utf-8")
    index_b.write_text("", encoding="utf-8")

    class FakeBinarySearcher:
        def __init__(self, root: Path) -> None:
            self.root = root
            self.backend = "fastembed"
            self.model = None
            self.model_profile = "code"

        def search(self, _query_dense, top_k: int):
            return [(1, 8)] if self.root == root_a else [(2, 16)]

    class FakeEmbedder:
        def embed_to_numpy(self, _queries):
            return np.ones((1, 4), dtype=np.float32)

    class FakeVectorMetadataStore:
        def __init__(self, path: Path) -> None:
            self.path = Path(path)

        def get_chunks_by_ids(self, chunk_ids):
            source_db = source_db_a if self.path.parent == root_a else source_db_b
            return [
                {
                    "chunk_id": chunk_id,
                    "file_path": str(self.path.parent / f"file{chunk_id}.py"),
                    "content": f"chunk {chunk_id}",
                    "source_index_db": str(source_db),
                }
                for chunk_id in chunk_ids
            ]

    import codexlens.semantic.embedder as embedder_module

    monkeypatch.setattr(engine, "_find_start_index", lambda _source_path: index_a)
    monkeypatch.setattr(engine, "_collect_index_paths", lambda _start_index, _depth: [index_a, index_b])
    monkeypatch.setattr(
        engine,
        "_get_centralized_binary_searcher",
        lambda root: FakeBinarySearcher(root),
    )
    monkeypatch.setattr(embedder_module, "get_embedder", lambda **_kwargs: FakeEmbedder())
    monkeypatch.setattr(chain_search_module, "VectorMetadataStore", FakeVectorMetadataStore)
    monkeypatch.setattr(
        engine,
        "_embed_dense_query",
        lambda _query, *, index_root=None, query_cache=None: np.ones(4, dtype=np.float32),
    )
    monkeypatch.setattr(engine, "search", lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("unexpected fallback")))

    result = engine.binary_cascade_search(
        "binary query",
        index_a.parent,
        k=5,
        coarse_k=5,
    )

    assert len(result.results) == 2
    assert {Path(item.path).name for item in result.results} == {"file1.py", "file2.py"}
