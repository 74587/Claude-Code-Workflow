"""Regression tests for staged cascade Stage 2 expansion depth.

Staged cascade is documented as:
  coarse (binary) → LSP/graph expansion → clustering → optional rerank

This test ensures Stage 2 respects Config.staged_lsp_depth (not unrelated
graph_expansion_depth settings).
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

from codexlens.config import Config
from codexlens.entities import CodeRelationship, RelationshipType, SearchResult, Symbol
from codexlens.search.chain_search import ChainSearchEngine
from codexlens.storage.dir_index import DirIndexStore
from codexlens.storage.index_tree import _compute_graph_neighbors
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore


@pytest.fixture()
def temp_paths() -> Path:
    tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    root = Path(tmpdir.name)
    yield root
    try:
        tmpdir.cleanup()
    except (PermissionError, OSError):
        pass


def _create_index_with_neighbors(root: Path) -> tuple[PathMapper, Path, Path, str]:
    project_root = root / "project"
    project_root.mkdir(parents=True, exist_ok=True)

    index_root = root / "indexes"
    mapper = PathMapper(index_root=index_root)
    index_db_path = mapper.source_to_index_db(project_root)
    index_db_path.parent.mkdir(parents=True, exist_ok=True)

    # Use 3 files so staged_cascade_search's final "deduplicate by path" step
    # doesn't collapse all expanded symbols into a single file result.
    content_a = "\n".join(["def a():", "    b()", ""])
    content_b = "\n".join(["def b():", "    c()", ""])
    content_c = "\n".join(["def c():", "    return 1", ""])

    file_a = project_root / "a.py"
    file_b = project_root / "b.py"
    file_c = project_root / "c.py"
    file_a.write_text(content_a, encoding="utf-8")
    file_b.write_text(content_b, encoding="utf-8")
    file_c.write_text(content_c, encoding="utf-8")

    symbols_a = [Symbol(name="a", kind="function", range=(1, 2), file=str(file_a))]
    symbols_b = [Symbol(name="b", kind="function", range=(1, 2), file=str(file_b))]
    symbols_c = [Symbol(name="c", kind="function", range=(1, 2), file=str(file_c))]

    relationships_a = [
        CodeRelationship(
            source_symbol="a",
            target_symbol="b",
            relationship_type=RelationshipType.CALL,
            source_file=str(file_a),
            target_file=str(file_b),
            source_line=2,
        )
    ]
    relationships_b = [
        CodeRelationship(
            source_symbol="b",
            target_symbol="c",
            relationship_type=RelationshipType.CALL,
            source_file=str(file_b),
            target_file=str(file_c),
            source_line=2,
        )
    ]

    config = Config(data_dir=root / "data")
    store = DirIndexStore(index_db_path, config=config)
    store.initialize()
    store.add_file(
        name=file_a.name,
        full_path=file_a,
        content=content_a,
        language="python",
        symbols=symbols_a,
        relationships=relationships_a,
    )
    store.add_file(
        name=file_b.name,
        full_path=file_b,
        content=content_b,
        language="python",
        symbols=symbols_b,
        relationships=relationships_b,
    )
    store.add_file(
        name=file_c.name,
        full_path=file_c,
        content=content_c,
        language="python",
        symbols=symbols_c,
        relationships=[],
    )
    _compute_graph_neighbors(store)
    store.close()

    return mapper, project_root, file_a, content_a


def test_staged_cascade_stage2_uses_staged_lsp_depth(temp_paths: Path) -> None:
    mapper, project_root, file_path, content = _create_index_with_neighbors(temp_paths)
    index_db_path = mapper.source_to_index_db(project_root)

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()

    # Intentionally conflicting depths: staged_lsp_depth should win for staged cascade.
    config = Config(
        data_dir=temp_paths / "data",
        staged_lsp_depth=1,
        graph_expansion_depth=2,
        enable_staged_rerank=False,
        staged_clustering_strategy="noop",
    )

    engine = ChainSearchEngine(registry, mapper, config=config)
    try:
        base = SearchResult(
            path=str(file_path.resolve()),
            score=1.0,
            excerpt="",
            content=content,
            start_line=1,
            end_line=2,
            symbol_name="a",
            symbol_kind="function",
        )

        with patch("codexlens.search.chain_search.NUMPY_AVAILABLE", True):
            with patch.object(engine, "_find_start_index", return_value=index_db_path):
                with patch.object(engine, "_collect_index_paths", return_value=[index_db_path]):
                    # Bypass binary vector infrastructure; Stage 1 output is sufficient for Stage 2 behavior.
                    with patch.object(
                        engine,
                        "_stage1_binary_search",
                        return_value=([base], index_db_path.parent),
                    ):
                        result = engine.staged_cascade_search(
                            query="test",
                            source_path=project_root,
                            k=3,
                            coarse_k=10,
                        )

        symbol_names = {r.symbol_name for r in result.results if r.symbol_name}
        assert "b" in symbol_names
        # With staged_lsp_depth=1, Stage 2 should NOT include 2-hop neighbor "c".
        assert "c" not in symbol_names
    finally:
        engine.close()
