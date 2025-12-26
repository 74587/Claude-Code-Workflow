import sqlite3
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from codexlens.config import Config
from codexlens.entities import Symbol
from codexlens.errors import StorageError
from codexlens.search.chain_search import ChainSearchEngine
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


def test_add_symbol(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    index_path = temp_paths / "indexes" / "_index.db"
    file_path = temp_paths / "src" / "a.py"

    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text("", encoding="utf-8")
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("class AuthManager:\n    pass\n", encoding="utf-8")

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        store.add_symbol(
            Symbol(name="AuthManager", kind="class", range=(1, 2)),
            file_path=file_path,
            index_path=index_path,
        )

        matches = store.search("AuthManager", kind="class", limit=10, prefix_mode=True)
        assert len(matches) == 1
        assert matches[0].name == "AuthManager"
        assert matches[0].file == str(file_path.resolve())

    # Schema version safety: newer schema versions should be rejected.
    bad_db = temp_paths / "indexes" / "_global_symbols_bad.db"
    bad_db.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(bad_db)
    conn.execute("PRAGMA user_version = 999")
    conn.close()

    with pytest.raises(StorageError):
        GlobalSymbolIndex(bad_db, project_id=1).initialize()


def test_search_symbols(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    index_path = temp_paths / "indexes" / "_index.db"
    file_path = temp_paths / "src" / "mod.py"

    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text("", encoding="utf-8")
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("def authenticate():\n  pass\n", encoding="utf-8")

    with GlobalSymbolIndex(db_path, project_id=7) as store:
        store.add_symbol(
            Symbol(name="authenticate", kind="function", range=(1, 2)),
            file_path=file_path,
            index_path=index_path,
        )

        locations = store.search_symbols("auth", kind="function", limit=10, prefix_mode=True)
        assert locations
        assert any(p.endswith("mod.py") for p, _ in locations)
        assert any(rng == (1, 2) for _, rng in locations)


def test_update_file_symbols(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "mod.py"
    index_path = temp_paths / "indexes" / "_index.db"

    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("def a():\n  pass\n", encoding="utf-8")
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text("", encoding="utf-8")

    with GlobalSymbolIndex(db_path, project_id=7) as store:
        store.update_file_symbols(
            file_path=file_path,
            symbols=[
                Symbol(name="old_func", kind="function", range=(1, 2)),
                Symbol(name="Other", kind="class", range=(10, 20)),
            ],
            index_path=index_path,
        )
        assert any(s.name == "old_func" for s in store.search("old_", prefix_mode=True))

        store.update_file_symbols(
            file_path=file_path,
            symbols=[Symbol(name="new_func", kind="function", range=(3, 4))],
            index_path=index_path,
        )
        assert not any(s.name == "old_func" for s in store.search("old_", prefix_mode=True))
        assert any(s.name == "new_func" for s in store.search("new_", prefix_mode=True))

        # Backward-compatible path: index_path can be omitted after it's been established.
        store.update_file_symbols(
            file_path=file_path,
            symbols=[Symbol(name="new_func2", kind="function", range=(5, 6))],
            index_path=None,
        )
        assert any(s.name == "new_func2" for s in store.search("new_func2", prefix_mode=True))

        # New file + symbols without index_path should raise.
        missing_index_file = temp_paths / "src" / "new_file.py"
        with pytest.raises(StorageError):
            store.update_file_symbols(
                file_path=missing_index_file,
                symbols=[Symbol(name="must_fail", kind="function", range=(1, 1))],
                index_path=None,
            )

        deleted = store.delete_file_symbols(file_path)
        assert deleted > 0


def test_incremental_updates(temp_paths: Path, monkeypatch):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    file_path = temp_paths / "src" / "same.py"
    idx_a = temp_paths / "indexes" / "a" / "_index.db"
    idx_b = temp_paths / "indexes" / "b" / "_index.db"

    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("class AuthManager:\n    pass\n", encoding="utf-8")
    idx_a.parent.mkdir(parents=True, exist_ok=True)
    idx_a.write_text("", encoding="utf-8")
    idx_b.parent.mkdir(parents=True, exist_ok=True)
    idx_b.write_text("", encoding="utf-8")

    with GlobalSymbolIndex(db_path, project_id=42) as store:
        sym = Symbol(name="AuthManager", kind="class", range=(1, 2))
        store.add_symbol(sym, file_path=file_path, index_path=idx_a)
        store.add_symbol(sym, file_path=file_path, index_path=idx_b)

        # prefix_mode=False exercises substring matching.
        assert store.search("Manager", prefix_mode=False)

    conn = sqlite3.connect(db_path)
    row = conn.execute(
        """
        SELECT index_path
        FROM global_symbols
        WHERE project_id=? AND symbol_name=? AND symbol_kind=? AND file_path=?
        """,
        (42, "AuthManager", "class", str(file_path.resolve())),
    ).fetchone()
    conn.close()

    assert row is not None
    assert str(Path(row[0]).resolve()) == str(idx_b.resolve())

    # Migration path coverage: simulate a future schema version and an older DB version.
    migrating_db = temp_paths / "indexes" / "_global_symbols_migrate.db"
    migrating_db.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(migrating_db)
    conn.execute("PRAGMA user_version = 1")
    conn.close()

    monkeypatch.setattr(GlobalSymbolIndex, "SCHEMA_VERSION", 2)
    GlobalSymbolIndex(migrating_db, project_id=1).initialize()


def test_concurrent_access(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    index_path = temp_paths / "indexes" / "_index.db"
    file_path = temp_paths / "src" / "a.py"

    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text("", encoding="utf-8")
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("class A:\n    pass\n", encoding="utf-8")

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        def add_many(worker_id: int):
            for i in range(50):
                store.add_symbol(
                    Symbol(name=f"Sym{worker_id}_{i}", kind="class", range=(1, 2)),
                    file_path=file_path,
                    index_path=index_path,
                )

        with ThreadPoolExecutor(max_workers=8) as ex:
            list(ex.map(add_many, range(8)))

        matches = store.search("Sym", kind="class", limit=1000, prefix_mode=True)
        assert len(matches) >= 200


def test_chain_search_integration(temp_paths: Path):
    project_root = temp_paths / "project"
    project_root.mkdir(parents=True, exist_ok=True)

    index_root = temp_paths / "indexes"
    mapper = PathMapper(index_root=index_root)
    index_db_path = mapper.source_to_index_db(project_root)
    index_db_path.parent.mkdir(parents=True, exist_ok=True)
    index_db_path.write_text("", encoding="utf-8")

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    project_info = registry.register_project(project_root, mapper.source_to_index_dir(project_root))

    global_db_path = project_info.index_root / GlobalSymbolIndex.DEFAULT_DB_NAME
    with GlobalSymbolIndex(global_db_path, project_id=project_info.id) as global_index:
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
    engine._search_symbols_parallel = MagicMock(side_effect=AssertionError("should not traverse chain"))

    symbols = engine.search_symbols("Auth", project_root)
    assert any(s.name == "AuthManager" for s in symbols)
    registry.close()


def test_disabled_fallback(temp_paths: Path):
    project_root = temp_paths / "project"
    project_root.mkdir(parents=True, exist_ok=True)

    index_root = temp_paths / "indexes"
    mapper = PathMapper(index_root=index_root)
    index_db_path = mapper.source_to_index_db(project_root)
    index_db_path.parent.mkdir(parents=True, exist_ok=True)
    index_db_path.write_text("", encoding="utf-8")

    registry = RegistryStore(db_path=temp_paths / "registry.db")
    registry.initialize()
    registry.register_project(project_root, mapper.source_to_index_dir(project_root))

    config = Config(data_dir=temp_paths / "data", global_symbol_index_enabled=False)
    engine = ChainSearchEngine(registry, mapper, config=config)
    engine._collect_index_paths = MagicMock(return_value=[index_db_path])
    engine._search_symbols_parallel = MagicMock(
        return_value=[Symbol(name="FallbackSymbol", kind="function", range=(1, 2))]
    )

    symbols = engine.search_symbols("Fallback", project_root)
    assert any(s.name == "FallbackSymbol" for s in symbols)
    assert engine._search_symbols_parallel.called
    registry.close()


def test_performance_benchmark(temp_paths: Path):
    db_path = temp_paths / "indexes" / "_global_symbols.db"
    index_path = temp_paths / "indexes" / "_index.db"
    file_path = temp_paths / "src" / "perf.py"

    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("class AuthManager:\n    pass\n", encoding="utf-8")
    index_path.parent.mkdir(parents=True, exist_ok=True)
    index_path.write_text("", encoding="utf-8")

    with GlobalSymbolIndex(db_path, project_id=1) as store:
        for i in range(500):
            store.add_symbol(
                Symbol(name=f"AuthManager{i}", kind="class", range=(1, 2)),
                file_path=file_path,
                index_path=index_path,
            )

        start = time.perf_counter()
        results = store.search("AuthManager", kind="class", limit=50, prefix_mode=True)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms < 100.0
        assert results
