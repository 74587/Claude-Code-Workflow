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


def test_find_descendant_project_roots_returns_nested_project_roots(tmp_path: Path) -> None:
    db_path = tmp_path / "registry.db"
    workspace_root = tmp_path / "workspace"
    child_a = workspace_root / "packages" / "app-a"
    child_b = workspace_root / "tools" / "app-b"
    outside_root = tmp_path / "external"

    with RegistryStore(db_path=db_path) as store:
        workspace_project = store.register_project(
            workspace_root,
            tmp_path / "indexes" / "workspace",
        )
        child_a_project = store.register_project(
            child_a,
            tmp_path / "indexes" / "workspace" / "packages" / "app-a",
        )
        child_b_project = store.register_project(
            child_b,
            tmp_path / "indexes" / "workspace" / "tools" / "app-b",
        )
        outside_project = store.register_project(
            outside_root,
            tmp_path / "indexes" / "external",
        )

        store.register_dir(
            workspace_project.id,
            workspace_root,
            tmp_path / "indexes" / "workspace" / "_index.db",
            depth=0,
        )
        child_a_mapping = store.register_dir(
            child_a_project.id,
            child_a,
            tmp_path / "indexes" / "workspace" / "packages" / "app-a" / "_index.db",
            depth=0,
        )
        child_b_mapping = store.register_dir(
            child_b_project.id,
            child_b,
            tmp_path / "indexes" / "workspace" / "tools" / "app-b" / "_index.db",
            depth=0,
        )
        store.register_dir(
            outside_project.id,
            outside_root,
            tmp_path / "indexes" / "external" / "_index.db",
            depth=0,
        )

        descendants = store.find_descendant_project_roots(workspace_root)

        assert [mapping.index_path for mapping in descendants] == [
            child_a_mapping.index_path,
            child_b_mapping.index_path,
        ]
