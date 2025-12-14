"""Configuration system for CodexLens."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from .errors import ConfigError


# Workspace-local directory name
WORKSPACE_DIR_NAME = ".codexlens"


def _default_global_dir() -> Path:
    """Get global CodexLens data directory."""
    env_override = os.getenv("CODEXLENS_DATA_DIR")
    if env_override:
        return Path(env_override).expanduser().resolve()
    return (Path.home() / ".codexlens").resolve()


def find_workspace_root(start_path: Path) -> Optional[Path]:
    """Find the workspace root by looking for .codexlens directory.

    Searches from start_path upward to find an existing .codexlens directory.
    Returns None if not found.
    """
    current = start_path.resolve()

    # Search up to filesystem root
    while current != current.parent:
        workspace_dir = current / WORKSPACE_DIR_NAME
        if workspace_dir.is_dir():
            return current
        current = current.parent

    # Check root as well
    workspace_dir = current / WORKSPACE_DIR_NAME
    if workspace_dir.is_dir():
        return current

    return None


@dataclass
class Config:
    """Runtime configuration for CodexLens.

    - data_dir: Base directory for all persistent CodexLens data.
    - venv_path: Optional virtualenv used for language tooling.
    - supported_languages: Language IDs and their associated file extensions.
    - parsing_rules: Per-language parsing and chunking hints.
    """

    data_dir: Path = field(default_factory=_default_global_dir)
    venv_path: Path = field(default_factory=lambda: _default_global_dir() / "venv")
    supported_languages: Dict[str, Dict[str, Any]] = field(
        default_factory=lambda: {
            "python": {"extensions": [".py"], "tree_sitter_language": "python"},
            "javascript": {"extensions": [".js", ".jsx"], "tree_sitter_language": "javascript"},
            "typescript": {"extensions": [".ts", ".tsx"], "tree_sitter_language": "typescript"},
            "java": {"extensions": [".java"], "tree_sitter_language": "java"},
            "go": {"extensions": [".go"], "tree_sitter_language": "go"},
            "zig": {"extensions": [".zig"], "tree_sitter_language": "zig"},
            "objective-c": {"extensions": [".m", ".mm"], "tree_sitter_language": "objc"},
        }
    )
    parsing_rules: Dict[str, Dict[str, Any]] = field(
        default_factory=lambda: {
            "default": {
                "max_chunk_chars": 4000,
                "max_chunk_lines": 200,
                "overlap_lines": 20,
            }
        }
    )

    llm_enabled: bool = False
    llm_tool: str = "gemini"
    llm_timeout_ms: int = 300000
    llm_batch_size: int = 5

    def __post_init__(self) -> None:
        try:
            self.data_dir = self.data_dir.expanduser().resolve()
            self.venv_path = self.venv_path.expanduser().resolve()
            self.data_dir.mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            raise ConfigError(f"Failed to initialize data_dir at {self.data_dir}: {exc}") from exc

    @property
    def cache_dir(self) -> Path:
        """Directory for transient caches."""
        return self.data_dir / "cache"

    @property
    def index_dir(self) -> Path:
        """Directory where index artifacts are stored."""
        return self.data_dir / "index"

    @property
    def db_path(self) -> Path:
        """Default SQLite index path."""
        return self.index_dir / "codexlens.db"

    def ensure_runtime_dirs(self) -> None:
        """Create standard runtime directories if missing."""
        for directory in (self.cache_dir, self.index_dir):
            try:
                directory.mkdir(parents=True, exist_ok=True)
            except Exception as exc:
                raise ConfigError(f"Failed to create directory {directory}: {exc}") from exc

    def language_for_path(self, path: str | Path) -> str | None:
        """Infer a supported language ID from a file path."""
        extension = Path(path).suffix.lower()
        for language_id, spec in self.supported_languages.items():
            extensions: List[str] = spec.get("extensions", [])
            if extension in extensions:
                return language_id
        return None

    def rules_for_language(self, language_id: str) -> Dict[str, Any]:
        """Get parsing rules for a specific language, falling back to defaults."""
        return {**self.parsing_rules.get("default", {}), **self.parsing_rules.get(language_id, {})}


@dataclass
class WorkspaceConfig:
    """Workspace-local configuration for CodexLens.

    Stores index data in project/.codexlens/ directory.
    """

    workspace_root: Path

    def __post_init__(self) -> None:
        self.workspace_root = Path(self.workspace_root).resolve()

    @property
    def codexlens_dir(self) -> Path:
        """The .codexlens directory in workspace root."""
        return self.workspace_root / WORKSPACE_DIR_NAME

    @property
    def db_path(self) -> Path:
        """SQLite index path for this workspace."""
        return self.codexlens_dir / "index.db"

    @property
    def cache_dir(self) -> Path:
        """Cache directory for this workspace."""
        return self.codexlens_dir / "cache"

    def initialize(self) -> None:
        """Create the .codexlens directory structure."""
        try:
            self.codexlens_dir.mkdir(parents=True, exist_ok=True)
            self.cache_dir.mkdir(parents=True, exist_ok=True)

            # Create .gitignore to exclude cache but keep index
            gitignore_path = self.codexlens_dir / ".gitignore"
            if not gitignore_path.exists():
                gitignore_path.write_text(
                    "# CodexLens workspace data\n"
                    "cache/\n"
                    "*.log\n"
                )
        except Exception as exc:
            raise ConfigError(f"Failed to initialize workspace at {self.codexlens_dir}: {exc}") from exc

    def exists(self) -> bool:
        """Check if workspace is already initialized."""
        return self.codexlens_dir.is_dir() and self.db_path.exists()

    @classmethod
    def from_path(cls, path: Path) -> Optional["WorkspaceConfig"]:
        """Create WorkspaceConfig from a path by finding workspace root.

        Returns None if no workspace found.
        """
        root = find_workspace_root(path)
        if root is None:
            return None
        return cls(workspace_root=root)

    @classmethod
    def create_at(cls, path: Path) -> "WorkspaceConfig":
        """Create a new workspace at the given path."""
        config = cls(workspace_root=path)
        config.initialize()
        return config
