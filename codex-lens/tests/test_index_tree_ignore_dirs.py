from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

from codexlens.config import Config
from codexlens.storage.index_tree import IndexTreeBuilder


def _relative_dirs(source_root: Path, dirs_by_depth: dict[int, list[Path]]) -> set[str]:
    return {
        path.relative_to(source_root).as_posix()
        for paths in dirs_by_depth.values()
        for path in paths
        if path != source_root
    }


def test_collect_dirs_by_depth_skips_common_build_artifact_dirs(tmp_path: Path) -> None:
    src_dir = tmp_path / "src"
    src_dir.mkdir()
    (src_dir / "app.py").write_text("print('ok')\n", encoding="utf-8")

    for artifact_dir in ["dist", "build", "coverage", ".next", "out", ".turbo", ".parcel-cache", "target"]:
        target_dir = tmp_path / artifact_dir
        target_dir.mkdir(parents=True, exist_ok=True)
        (target_dir / "generated.py").write_text("print('artifact')\n", encoding="utf-8")

    builder = IndexTreeBuilder(
        registry=MagicMock(),
        mapper=MagicMock(),
        config=Config(data_dir=tmp_path / "data"),
        incremental=False,
    )

    dirs_by_depth = builder._collect_dirs_by_depth(tmp_path)
    discovered_dirs = _relative_dirs(tmp_path, dirs_by_depth)

    assert "src" in discovered_dirs
    assert "dist" not in discovered_dirs
    assert "build" not in discovered_dirs
    assert "coverage" not in discovered_dirs
    assert ".next" not in discovered_dirs
    assert "out" not in discovered_dirs
    assert ".turbo" not in discovered_dirs
    assert ".parcel-cache" not in discovered_dirs
    assert "target" not in discovered_dirs


def test_should_index_dir_ignores_transitive_build_only_subtrees(tmp_path: Path) -> None:
    package_dir = tmp_path / "package"
    dist_dir = package_dir / "dist"
    dist_dir.mkdir(parents=True)
    (dist_dir / "bundle.py").write_text("print('compiled')\n", encoding="utf-8")

    builder = IndexTreeBuilder(
        registry=MagicMock(),
        mapper=MagicMock(),
        config=Config(data_dir=tmp_path / "data"),
        incremental=False,
    )

    assert builder._should_index_dir(package_dir) is False


def test_collect_dirs_by_depth_respects_relative_ignore_patterns_from_config(tmp_path: Path) -> None:
    src_dir = tmp_path / "frontend" / "src"
    src_dir.mkdir(parents=True)
    (src_dir / "app.ts").write_text("export const app = 1\n", encoding="utf-8")

    dist_dir = tmp_path / "frontend" / "dist"
    dist_dir.mkdir(parents=True)
    (dist_dir / "bundle.ts").write_text("export const bundle = 1\n", encoding="utf-8")

    builder = IndexTreeBuilder(
        registry=MagicMock(),
        mapper=MagicMock(),
        config=Config(data_dir=tmp_path / "data", ignore_patterns=["frontend/dist"]),
        incremental=False,
    )

    dirs_by_depth = builder._collect_dirs_by_depth(tmp_path)
    discovered_dirs = _relative_dirs(tmp_path, dirs_by_depth)

    assert "frontend/src" in discovered_dirs
    assert "frontend/dist" not in discovered_dirs


def test_iter_source_files_respects_extension_filters_and_relative_patterns(tmp_path: Path) -> None:
    frontend_dir = tmp_path / "frontend"
    frontend_dir.mkdir()
    (frontend_dir / "app.ts").write_text("export const app = 1\n", encoding="utf-8")
    (frontend_dir / "bundle.min.js").write_text("export const bundle = 1\n", encoding="utf-8")
    (frontend_dir / "skip.ts").write_text("export const skip = 1\n", encoding="utf-8")

    builder = IndexTreeBuilder(
        registry=MagicMock(),
        mapper=MagicMock(),
        config=Config(
            data_dir=tmp_path / "data",
            extension_filters=["*.min.js", "frontend/skip.ts"],
        ),
        incremental=False,
    )

    source_files = builder._iter_source_files(frontend_dir, source_root=tmp_path)

    assert [path.name for path in source_files] == ["app.ts"]
    assert builder._should_index_dir(frontend_dir, source_root=tmp_path) is True


def test_builder_loads_saved_ignore_and_extension_filters_by_default(tmp_path: Path, monkeypatch) -> None:
    codexlens_home = tmp_path / "codexlens-home"
    codexlens_home.mkdir()
    (codexlens_home / "settings.json").write_text(
        json.dumps(
            {
                "ignore_patterns": ["frontend/dist"],
                "extension_filters": ["*.min.js"],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setenv("CODEXLENS_DATA_DIR", str(codexlens_home))

    frontend_dir = tmp_path / "frontend"
    frontend_dir.mkdir()
    dist_dir = frontend_dir / "dist"
    dist_dir.mkdir()
    (frontend_dir / "app.ts").write_text("export const app = 1\n", encoding="utf-8")
    (frontend_dir / "bundle.min.js").write_text("export const bundle = 1\n", encoding="utf-8")
    (dist_dir / "compiled.ts").write_text("export const compiled = 1\n", encoding="utf-8")

    builder = IndexTreeBuilder(
        registry=MagicMock(),
        mapper=MagicMock(),
        config=None,
        incremental=False,
    )

    source_files = builder._iter_source_files(frontend_dir, source_root=tmp_path)
    dirs_by_depth = builder._collect_dirs_by_depth(tmp_path)
    discovered_dirs = _relative_dirs(tmp_path, dirs_by_depth)

    assert [path.name for path in source_files] == ["app.ts"]
    assert "frontend/dist" not in discovered_dirs
