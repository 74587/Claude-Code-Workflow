"""Merkle tree utilities for change detection.

This module provides a generic, file-system based Merkle tree implementation
that can be used to efficiently diff directory states.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Optional


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_text(text: str) -> str:
    return sha256_bytes(text.encode("utf-8", errors="ignore"))


@dataclass
class MerkleNode:
    """A Merkle node representing either a file (leaf) or directory (internal)."""

    name: str
    rel_path: str
    hash: str
    is_dir: bool
    children: Dict[str, "MerkleNode"] = field(default_factory=dict)

    def iter_files(self) -> Iterable["MerkleNode"]:
        if not self.is_dir:
            yield self
            return
        for child in self.children.values():
            yield from child.iter_files()


@dataclass
class MerkleTree:
    """Merkle tree for a directory snapshot."""

    root: MerkleNode

    @classmethod
    def build_from_directory(cls, root_dir: Path) -> "MerkleTree":
        root_dir = Path(root_dir).resolve()
        node = cls._build_node(root_dir, base=root_dir)
        return cls(root=node)

    @classmethod
    def _build_node(cls, path: Path, *, base: Path) -> MerkleNode:
        if path.is_file():
            rel = str(path.relative_to(base)).replace("\\", "/")
            return MerkleNode(
                name=path.name,
                rel_path=rel,
                hash=sha256_bytes(path.read_bytes()),
                is_dir=False,
            )

        if not path.is_dir():
            rel = str(path.relative_to(base)).replace("\\", "/")
            return MerkleNode(name=path.name, rel_path=rel, hash="", is_dir=False)

        children: Dict[str, MerkleNode] = {}
        for child in sorted(path.iterdir(), key=lambda p: p.name):
            child_node = cls._build_node(child, base=base)
            children[child_node.name] = child_node

        items = [
            f"{'d' if n.is_dir else 'f'}:{name}:{n.hash}"
            for name, n in sorted(children.items(), key=lambda kv: kv[0])
        ]
        dir_hash = sha256_text("\n".join(items))

        rel_path = "." if path == base else str(path.relative_to(base)).replace("\\", "/")
        return MerkleNode(
            name="." if path == base else path.name,
            rel_path=rel_path,
            hash=dir_hash,
            is_dir=True,
            children=children,
        )

    @staticmethod
    def find_changed_files(old: Optional["MerkleTree"], new: Optional["MerkleTree"]) -> List[str]:
        """Find changed/added/removed files between two trees.

        Returns:
            List of relative file paths (POSIX-style separators).
        """
        if old is None and new is None:
            return []
        if old is None:
            return sorted({n.rel_path for n in new.root.iter_files()})  # type: ignore[union-attr]
        if new is None:
            return sorted({n.rel_path for n in old.root.iter_files()})

        changed: set[str] = set()

        def walk(old_node: Optional[MerkleNode], new_node: Optional[MerkleNode]) -> None:
            if old_node is None and new_node is None:
                return

            if old_node is None and new_node is not None:
                changed.update(n.rel_path for n in new_node.iter_files())
                return

            if new_node is None and old_node is not None:
                changed.update(n.rel_path for n in old_node.iter_files())
                return

            assert old_node is not None and new_node is not None

            if old_node.hash == new_node.hash:
                return

            if not old_node.is_dir and not new_node.is_dir:
                changed.add(new_node.rel_path)
                return

            if old_node.is_dir != new_node.is_dir:
                changed.update(n.rel_path for n in old_node.iter_files())
                changed.update(n.rel_path for n in new_node.iter_files())
                return

            names = set(old_node.children.keys()) | set(new_node.children.keys())
            for name in names:
                walk(old_node.children.get(name), new_node.children.get(name))

        walk(old.root, new.root)
        return sorted(changed)

