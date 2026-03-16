from __future__ import annotations

from pathlib import Path
from typing import Iterable, List, Optional, Set

from codexlens.storage.index_tree import DEFAULT_IGNORE_DIRS


EXTRA_IGNORED_INDEX_DIRS = frozenset({".workflow"})
IGNORED_INDEX_DIRS = frozenset({name.casefold() for name in DEFAULT_IGNORE_DIRS | set(EXTRA_IGNORED_INDEX_DIRS)})


def is_ignored_index_path(
    index_path: Path,
    scan_root: Path,
    *,
    ignored_dir_names: Optional[Set[str]] = None,
) -> bool:
    """Return True when an index lives under an ignored/generated subtree."""

    ignored = (
        {name.casefold() for name in ignored_dir_names}
        if ignored_dir_names is not None
        else IGNORED_INDEX_DIRS
    )

    try:
        relative_parts = index_path.resolve().relative_to(scan_root.resolve()).parts[:-1]
    except ValueError:
        return False

    return any(part.casefold() in ignored for part in relative_parts)


def filter_index_paths(
    index_paths: Iterable[Path],
    scan_root: Path,
    *,
    ignored_dir_names: Optional[Set[str]] = None,
) -> List[Path]:
    """Filter out discovered indexes that belong to ignored/generated subtrees."""

    return [
        path
        for path in index_paths
        if not is_ignored_index_path(path, scan_root, ignored_dir_names=ignored_dir_names)
    ]
