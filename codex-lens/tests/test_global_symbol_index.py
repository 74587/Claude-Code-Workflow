import sqlite3
import tempfile
import time
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from codexlens.config import Config
from codexlens.entities import Symbol
from codexlens.search.chain_search import ChainSearchEngine
from codexlens.storage.dir_index import DirIndexStore
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


def test_global_symbol_index_add_and_search_under_50ms(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "a.py"
    index_path = temp_paths / "indexes" / "_index.db"

    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("class AuthManager:\n    pass\n", encoding="utf-8")
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text("", encoding="utf-8")

    store = GlobalSymbolIndex(db_path, project_id=1)
    store.initialize()

    # Insert enough rows to ensure index usage, still small enough to be fast.
    for i in range(200):
        store.add_symbol(
            Symbol(name=f"AuthManager{i}", kind="class", range=(1, 2)),
            file_path=file_path,
            index_path=index_path,
        )

    start = time.perf_counter()
    results = store.search("AuthManager", kind="class", limit=50, prefix_mode=True)
    elapsed_ms = (time.perf_counter() - start) * 1000

    assert elapsed_ms < 50.0
    assert len(results) >= 1
    assert all(r.kind == "class" for r in results)
    assert all((r.file or "").endswith("a.py") for r in results)

    locations = store.search_symbols("AuthManager", kind="class", limit=50, prefix_mode=True)
    assert locations
    assert all(isinstance(p, str) and isinstance(rng, tuple) for p, rng in locations)


def test_update_file_symbols_replaces_atomically(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "mod.py"
    index_path = temp_paths / "indexes" / "_index.db"

    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("def a():\n  pass\n", encoding="utf-8")
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text("", encoding="utf-8")

    store = GlobalSymbolIndex(db_path, project_id=7)
    store.initialize()

    store.update_file_symbols(
        file_path=file_path,
        symbols=[
            Symbol(name="old_func", kind="function", range=(1, 2)),
            Symbol(name="Other", kind="class", range=(10, 20)),
        ],
        index_path=index_path,
    )

    assert any(s.name == "old_func" for s in store.search("old_", prefix_mode=True))

    # Replace with new set (delete + insert)
    store.update_file_symbols(
        file_path=file_path,
        symbols=[Symbol(name="new_func", kind="function", range=(3, 4))],
        index_path=index_path,
    )

    assert not any(s.name == "old_func" for s in store.search("old_", prefix_mode=True))
    assert any(s.name == "new_func" for s in store.search("new_", prefix_mode=True))

    # Backward-compatible path: omit index_path after it has been established.
    store.update_file_symbols(
        file_path=file_path,
        symbols=[Symbol(name="new_func2", kind="function", range=(5, 6))],
        index_path=None,
    )
    assert any(s.name == "new_func2" for s in store.search("new_func2", prefix_mode=True))


def test_dir_index_store_updates_global_index_when_enabled(temp_paths: Path):
    config = Config(data_dir=temp_paths / "data")

    index_db_path = temp_paths / "indexes" / "proj" / "_index.db"
    global_db_path = temp_paths / "indexes" / "proj" / GlobalSymbolIndex.DEFAULT_DB_NAME
    source_file = temp_paths / "src" / "x.py"

    source_file.parent.mkdir(parents=True, exist_ok=True)
    source_file.write_text("class MyClass:\n    pass\n", encoding="utf-8")

    global_index = GlobalSymbolIndex(global_db_path, project_id=123)
    global_index.initialize()

    with DirIndexStore(index_db_path, config=config, global_index=global_index) as store:
        store.add_file(
            name=source_file.name,
            full_path=source_file,
            content=source_file.read_text(encoding="utf-8"),
            language="python",
            symbols=[Symbol(name="MyClass", kind="class", range=(1, 2))],
        )

    matches = global_index.search("MyClass", kind="class", limit=10)
    assert len(matches) == 1
    assert matches[0].file == str(source_file.resolve())

    # Verify all required fields were written.
    conn = sqlite3.connect(global_db_path)
    row = conn.execute(
        """
        SELECT project_id, symbol_name, symbol_kind, file_path, start_line, end_line, index_path
        FROM global_symbols
        WHERE project_id=? AND symbol_name=?
        """,
        (123, "MyClass"),
    ).fetchone()
    conn.close()

    assert row is not None
    assert row[0] == 123
    assert row[1] == "MyClass"
    assert row[2] == "class"
    assert row[3] == str(source_file.resolve())
    assert row[4] == 1
    assert row[5] == 2
    assert row[6] == str(index_db_path.resolve())


def test_chain_search_uses_global_index_fast_path(temp_paths: Path):
    project_root = temp_paths / "project"
    project_root.mkdir(parents=True, exist_ok=True)

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

    file_path = project_root / "auth.py"
    global_index.update_file_symbols(
        file_path=file_path,
        symbols=[
            Symbol(name="AuthManager", kind="class", range=(1, 10)),
            Symbol(name="authenticate", kind="function", range=(12, 20)),
        ],
        index_path=index_db_path,
    )

    config = Config(data_dir=temp_paths / "data", global_symbol_index_enabled=True)
    engine = ChainSearchEngine(registry, mapper, config=config)
    assert registry.find_by_source_path(str(project_root)) is not None
    assert registry.find_by_source_path(str(project_root.resolve())) is not None
    assert global_db_path.exists()
    assert GlobalSymbolIndex(global_db_path, project_id=project_info.id).search("Auth", limit=10)
    engine._search_symbols_parallel = MagicMock(side_effect=AssertionError("should not traverse chain"))

    symbols = engine.search_symbols("Auth", project_root)
    assert any(s.name == "AuthManager" for s in symbols)
