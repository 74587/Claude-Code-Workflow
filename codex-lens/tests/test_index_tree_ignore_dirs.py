from __future__ import annotations

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
