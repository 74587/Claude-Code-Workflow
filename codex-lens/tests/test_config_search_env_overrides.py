"""Unit tests for Config .env overrides for final search ranking penalties."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from codexlens.config import Config


@pytest.fixture
def temp_config_dir() -> Path:
    """Create temporary directory for config data_dir."""
    tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    yield Path(tmpdir.name)
    try:
        tmpdir.cleanup()
    except (PermissionError, OSError):
        pass


def test_search_penalty_env_overrides_apply(temp_config_dir: Path) -> None:
    config = Config(data_dir=temp_config_dir)

    env_path = temp_config_dir / ".env"
    env_path.write_text(
        "\n".join(
            [
                "TEST_FILE_PENALTY=0.25",
                "GENERATED_FILE_PENALTY=0.4",
                "",
            ]
        ),
        encoding="utf-8",
    )

    config.load_settings()

    assert config.test_file_penalty == 0.25
    assert config.generated_file_penalty == 0.4


def test_reranker_gpu_env_override_apply(temp_config_dir: Path) -> None:
    config = Config(data_dir=temp_config_dir)

    env_path = temp_config_dir / ".env"
    env_path.write_text(
        "\n".join(
            [
                "RERANKER_USE_GPU=false",
                "",
            ]
        ),
        encoding="utf-8",
    )

    config.load_settings()

    assert config.reranker_use_gpu is False


def test_search_penalty_env_overrides_invalid_ignored(temp_config_dir: Path) -> None:
    config = Config(data_dir=temp_config_dir)

    env_path = temp_config_dir / ".env"
    env_path.write_text(
        "\n".join(
            [
                "TEST_FILE_PENALTY=oops",
                "GENERATED_FILE_PENALTY=nope",
                "",
            ]
        ),
        encoding="utf-8",
    )

    config.load_settings()

    assert config.test_file_penalty == 0.15
    assert config.generated_file_penalty == 0.35
    assert config.reranker_use_gpu is True
