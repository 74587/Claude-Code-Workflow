import logging
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from codexlens.config import Config
from codexlens.entities import Symbol
from codexlens.search.chain_search import ChainSearchEngine, SearchOptions
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

