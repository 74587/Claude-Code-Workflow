from __future__ import annotations

import platform
from pathlib import Path

from codexlens.storage.path_mapper import PathMapper


def test_denormalize_path_windows_drive_is_absolute() -> None:
    if platform.system() != "Windows":
        return

    mapper = PathMapper(index_root=Path("C:/tmp/codexlens_indexes"))
    mapped = mapper.denormalize_path("D/Claude_dms3/codex-lens/src")

    assert mapped.is_absolute()
    assert str(mapped).lower().startswith("d:\\") or str(mapped).lower().startswith("d:/")
    assert mapped == Path("D:/Claude_dms3/codex-lens/src")

