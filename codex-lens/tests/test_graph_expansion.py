import sqlite3
import tempfile
from pathlib import Path

import pytest

from codexlens.config import Config
from codexlens.entities import CodeRelationship, RelationshipType, SearchResult, Symbol
from codexlens.search.chain_search import ChainSearchEngine, SearchOptions
from codexlens.search.graph_expander import GraphExpander
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


def _create_index_with_neighbors(root: Path) -> tuple[PathMapper, Path, Path]:
    project_root = root / "project"
    project_root.mkdir(parents=True, exist_ok=True)

    index_root = root / "indexes"
    mapper = PathMapper(index_root=index_root)
    index_db_path = mapper.source_to_index_db(project_root)
    index_db_path.parent.mkdir(parents=True, exist_ok=True)

    content = "\n".join(
        [
            "def a():",
            "    b()",
            "",
            "def b():",
            "    c()",
            "",
            "def c():",
            "    return 1",
            "",
        ]
    )
    file_path = project_root / "module.py"
    file_path.write_text(content, encoding="utf-8")

    symbols = [
        Symbol(name="a", kind="function", range=(1, 2), file=str(file_path)),
        Symbol(name="b", kind="function", range=(4, 5), file=str(file_path)),
        Symbol(name="c", kind="function", range=(7, 8), file=str(file_path)),
    ]
    relationships = [
        CodeRelationship(
            source_symbol="a",
            target_symbol="b",
            relationship_type=RelationshipType.CALL,
            source_file=str(file_path),
            target_file=None,
            source_line=2,
        ),
        CodeRelationship(
            source_symbol="b",
            target_symbol="c",
            relationship_type=RelationshipType.CALL,
            source_file=str(file_path),
            target_file=None,
            source_line=5,
        ),
    ]

    config = Config(data_dir=root / "data")
    store = DirIndexStore(index_db_path, config=config)
    store.initialize()
    store.add_file(
        name=file_path.name,
        full_path=file_path,
        content=content,
        language="python",
        symbols=symbols,
        relationships=relationships,
    )
    _compute_graph_neighbors(store)
    store.close()

    return mapper, project_root, file_path


def test_graph_neighbors_precomputed_two_hop(temp_paths: Path) -> None:
    mapper, project_root, file_path = _create_index_with_neighbors(temp_paths)
    index_db_path = mapper.source_to_index_db(project_root)

    conn = sqlite3.connect(str(index_db_path))
    conn.row_factory = sqlite3.Row
    try:
        rows = conn.execute(
            """
            SELECT s1.name AS source_name, s2.name AS neighbor_name, gn.relationship_depth
            FROM graph_neighbors gn
            JOIN symbols s1 ON s1.id = gn.source_symbol_id
            JOIN symbols s2 ON s2.id = gn.neighbor_symbol_id
            ORDER BY source_name, neighbor_name, relationship_depth
            """
        ).fetchall()
    finally:
        conn.close()

    triples = {(r["source_name"], r["neighbor_name"], int(r["relationship_depth"])) for r in rows}
    assert ("a", "b", 1) in triples
    assert ("a", "c", 2) in triples
    assert ("b", "c", 1) in triples
    assert ("c", "b", 1) in triples
    assert file_path.exists()


def test_graph_expander_returns_related_results_with_depth_metadata(temp_paths: Path) -> None:
    mapper, project_root, file_path = _create_index_with_neighbors(temp_paths)
    _ = project_root

    expander = GraphExpander(mapper, config=Config(data_dir=temp_paths / "data", graph_expansion_depth=2))
    base = SearchResult(
        path=str(file_path.resolve()),
        score=1.0,
        excerpt="",
        content=None,
        start_line=1,
        end_line=2,
        symbol_name="a",
        symbol_kind="function",
    )
    related = expander.expand([base], depth=2, max_expand=1, max_related=10)

    depth_by_symbol = {r.symbol_name: r.metadata.get("relationship_depth") for r in related}
    assert depth_by_symbol.get("b") == 1
    assert depth_by_symbol.get("c") == 2


def test_chain_search_populates_related_results_when_enabled(temp_paths: Path) -> None:
    mapper, project_root, file_path = _create_index_with_neighbors(temp_paths)
    _ = file_path

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()

    config = Config(
        data_dir=temp_paths / "data",
        enable_graph_expansion=True,
        graph_expansion_depth=2,
    )
    engine = ChainSearchEngine(registry, mapper, config=config)
    try:
        options = SearchOptions(depth=0, total_limit=10, enable_fuzzy=False)
        result = engine.search("b", project_root, options)

        assert result.results
        assert result.results[0].symbol_name == "a"

        depth_by_symbol = {r.symbol_name: r.metadata.get("relationship_depth") for r in result.related_results}
        assert depth_by_symbol.get("b") == 1
        assert depth_by_symbol.get("c") == 2
    finally:
        engine.close()


def test_chain_search_related_results_empty_when_disabled(temp_paths: Path) -> None:
    mapper, project_root, file_path = _create_index_with_neighbors(temp_paths)
    _ = file_path

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()

    config = Config(
        data_dir=temp_paths / "data",
        enable_graph_expansion=False,
    )
    engine = ChainSearchEngine(registry, mapper, config=config)
    try:
        options = SearchOptions(depth=0, total_limit=10, enable_fuzzy=False)
        result = engine.search("b", project_root, options)
        assert result.related_results == []
    finally:
        engine.close()

