"""Simple filesystem cache helpers."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class FileCache:
    """Caches file mtimes for incremental indexing."""

    cache_path: Path

    def load_mtime(self, path: Path) -> Optional[float]:
        try:
            key = self._key_for(path)
            record = (self.cache_path / key).read_text(encoding="utf-8")
            return float(record)
        except Exception:
            return None

    def store_mtime(self, path: Path, mtime: float) -> None:
        self.cache_path.mkdir(parents=True, exist_ok=True)
        key = self._key_for(path)
        (self.cache_path / key).write_text(str(mtime), encoding="utf-8")

    def _key_for(self, path: Path) -> str:
        safe = str(path).replace(":", "_").replace("\\", "_").replace("/", "_")
        return f"{safe}.mtime"

