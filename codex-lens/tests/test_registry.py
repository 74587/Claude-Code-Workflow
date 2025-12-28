"""Tests for RegistryStore path handling."""

from __future__ import annotations

from pathlib import Path

import pytest

from codexlens.storage.registry import RegistryStore


def _swap_case(path: Path) -> str:
    return str(path).swapcase()


def test_path_case_normalization_windows(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """On Windows, path comparisons should be case-insensitive."""
    import codexlens.storage.registry as registry

    monkeypatch.setattr(registry.platform, "system", lambda: "Windows")

    db_path = tmp_path / "registry.db"
    source_root = tmp_path / "MyProject"
    index_root = tmp_path / "indexes"

    with RegistryStore(db_path=db_path) as store:
        store.register_project(source_root, index_root)

        result = store.find_by_source_path(_swap_case(source_root))
        assert result is not None
        assert result["source_root"] == str(source_root.resolve()).lower()


def test_path_case_sensitivity_non_windows(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """On Unix, path comparisons should remain case-sensitive."""
    import codexlens.storage.registry as registry

    monkeypatch.setattr(registry.platform, "system", lambda: "Linux")

    db_path = tmp_path / "registry.db"
    source_root = tmp_path / "MyProject"
    index_root = tmp_path / "indexes"

    with RegistryStore(db_path=db_path) as store:
        store.register_project(source_root, index_root)
        assert store.find_by_source_path(_swap_case(source_root)) is None


def test_find_nearest_index(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Nearest ancestor lookup should be case-insensitive on Windows."""
    import codexlens.storage.registry as registry

    monkeypatch.setattr(registry.platform, "system", lambda: "Windows")

    db_path = tmp_path / "registry.db"
    source_root = tmp_path / "MyProject"
    index_root = tmp_path / "indexes"
    index_db = index_root / "_index.db"

    with RegistryStore(db_path=db_path) as store:
        project = store.register_project(source_root, index_root)
        mapping = store.register_dir(project.id, source_root, index_db, depth=0)

        query_path = Path(_swap_case(source_root)) / "SubDir" / "file.py"
        found = store.find_nearest_index(query_path)

        assert found is not None
        assert found.id == mapping.id

