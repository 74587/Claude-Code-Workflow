"""Configuration system for CodexLens."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from functools import cached_property
from pathlib import Path
from typing import Any, Dict, List, Optional

from .errors import ConfigError


# Workspace-local directory name
WORKSPACE_DIR_NAME = ".codexlens"

# Settings file name
SETTINGS_FILE_NAME = "settings.json"


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
            "markdown": {"extensions": [".md", ".mdx"], "tree_sitter_language": None},
            "text": {"extensions": [".txt"], "tree_sitter_language": None},
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

    # Hybrid chunker configuration
    hybrid_max_chunk_size: int = 2000  # Max characters per chunk before LLM refinement
    hybrid_llm_refinement: bool = False  # Enable LLM-based semantic boundary refinement

    # Embedding configuration
    embedding_backend: str = "fastembed"  # "fastembed" (local) or "litellm" (API)
    embedding_model: str = "code"  # For fastembed: profile (fast/code/multilingual/balanced)
                                   # For litellm: model name from config (e.g., "qwen3-embedding")
    embedding_use_gpu: bool = True  # For fastembed: whether to use GPU acceleration

    # Multi-endpoint configuration for litellm backend
    embedding_endpoints: List[Dict[str, Any]] = field(default_factory=list)
    # List of endpoint configs: [{"model": "...", "api_key": "...", "api_base": "...", "weight": 1.0}]
    embedding_strategy: str = "latency_aware"  # round_robin, latency_aware, weighted_random
    embedding_cooldown: float = 60.0  # Default cooldown seconds for rate-limited endpoints

    def __post_init__(self) -> None:
        try:
            self.data_dir = self.data_dir.expanduser().resolve()
            self.venv_path = self.venv_path.expanduser().resolve()
            self.data_dir.mkdir(parents=True, exist_ok=True)
        except Exception as exc:
            raise ConfigError(f"Failed to initialize data_dir at {self.data_dir}: {exc}") from exc

    @cached_property
    def cache_dir(self) -> Path:
        """Directory for transient caches."""
        return self.data_dir / "cache"

    @cached_property
    def index_dir(self) -> Path:
        """Directory where index artifacts are stored."""
        return self.data_dir / "index"

    @cached_property
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

    @cached_property
    def settings_path(self) -> Path:
        """Path to the settings file."""
        return self.data_dir / SETTINGS_FILE_NAME

    def save_settings(self) -> None:
        """Save embedding and other settings to file."""
        embedding_config = {
            "backend": self.embedding_backend,
            "model": self.embedding_model,
            "use_gpu": self.embedding_use_gpu,
        }
        # Include multi-endpoint config if present
        if self.embedding_endpoints:
            embedding_config["endpoints"] = self.embedding_endpoints
            embedding_config["strategy"] = self.embedding_strategy
            embedding_config["cooldown"] = self.embedding_cooldown

        settings = {
            "embedding": embedding_config,
            "llm": {
                "enabled": self.llm_enabled,
                "tool": self.llm_tool,
                "timeout_ms": self.llm_timeout_ms,
                "batch_size": self.llm_batch_size,
            },
        }
        with open(self.settings_path, "w", encoding="utf-8") as f:
            json.dump(settings, f, indent=2)

    def load_settings(self) -> None:
        """Load settings from file if exists."""
        if not self.settings_path.exists():
            return

        try:
            with open(self.settings_path, "r", encoding="utf-8") as f:
                settings = json.load(f)

            # Load embedding settings
            embedding = settings.get("embedding", {})
            if "backend" in embedding:
                self.embedding_backend = embedding["backend"]
            if "model" in embedding:
                self.embedding_model = embedding["model"]
            if "use_gpu" in embedding:
                self.embedding_use_gpu = embedding["use_gpu"]

            # Load multi-endpoint configuration
            if "endpoints" in embedding:
                self.embedding_endpoints = embedding["endpoints"]
            if "strategy" in embedding:
                self.embedding_strategy = embedding["strategy"]
            if "cooldown" in embedding:
                self.embedding_cooldown = embedding["cooldown"]

            # Load LLM settings
            llm = settings.get("llm", {})
            if "enabled" in llm:
                self.llm_enabled = llm["enabled"]
            if "tool" in llm:
                self.llm_tool = llm["tool"]
            if "timeout_ms" in llm:
                self.llm_timeout_ms = llm["timeout_ms"]
            if "batch_size" in llm:
                self.llm_batch_size = llm["batch_size"]
        except Exception:
            pass  # Silently ignore errors

    @classmethod
    def load(cls) -> "Config":
        """Load config with settings from file."""
        config = cls()
        config.load_settings()
        return config


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
