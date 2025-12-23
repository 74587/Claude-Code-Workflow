"""Configuration loader with environment variable substitution."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

import yaml

from .models import LiteLLMConfig

# Default configuration path
DEFAULT_CONFIG_PATH = Path.home() / ".ccw" / "config" / "litellm-config.yaml"

# Global configuration singleton
_config_instance: LiteLLMConfig | None = None


def _substitute_env_vars(value: Any) -> Any:
    """Recursively substitute environment variables in configuration values.

    Supports ${ENV_VAR} and ${ENV_VAR:-default} syntax.

    Args:
        value: Configuration value (str, dict, list, or primitive)

    Returns:
        Value with environment variables substituted
    """
    if isinstance(value, str):
        # Pattern: ${VAR} or ${VAR:-default}
        pattern = r"\$\{([^:}]+)(?::-(.*?))?\}"

        def replace_var(match: re.Match) -> str:
            var_name = match.group(1)
            default_value = match.group(2) if match.group(2) is not None else ""
            return os.environ.get(var_name, default_value)

        return re.sub(pattern, replace_var, value)

    if isinstance(value, dict):
        return {k: _substitute_env_vars(v) for k, v in value.items()}

    if isinstance(value, list):
        return [_substitute_env_vars(item) for item in value]

    return value


def _get_default_config() -> dict[str, Any]:
    """Get default configuration when no config file exists.

    Returns:
        Default configuration dictionary
    """
    return {
        "version": 1,
        "default_provider": "openai",
        "providers": {
            "openai": {
                "api_key": "${OPENAI_API_KEY}",
                "api_base": "https://api.openai.com/v1",
            },
        },
        "llm_models": {
            "default": {
                "provider": "openai",
                "model": "gpt-4",
            },
            "fast": {
                "provider": "openai",
                "model": "gpt-3.5-turbo",
            },
        },
        "embedding_models": {
            "default": {
                "provider": "openai",
                "model": "text-embedding-3-small",
                "dimensions": 1536,
            },
        },
    }


def load_config(config_path: Path | str | None = None) -> LiteLLMConfig:
    """Load LiteLLM configuration from YAML file.

    Args:
        config_path: Path to configuration file (default: ~/.ccw/config/litellm-config.yaml)

    Returns:
        Parsed and validated configuration

    Raises:
        FileNotFoundError: If config file not found and no default available
        ValueError: If configuration is invalid
    """
    if config_path is None:
        config_path = DEFAULT_CONFIG_PATH
    else:
        config_path = Path(config_path)

    # Load configuration
    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                raw_config = yaml.safe_load(f)
        except Exception as e:
            raise ValueError(f"Failed to load configuration from {config_path}: {e}") from e
    else:
        # Use default configuration
        raw_config = _get_default_config()

    # Substitute environment variables
    config_data = _substitute_env_vars(raw_config)

    # Validate and parse with Pydantic
    try:
        return LiteLLMConfig.model_validate(config_data)
    except Exception as e:
        raise ValueError(f"Invalid configuration: {e}") from e


def get_config(config_path: Path | str | None = None, reload: bool = False) -> LiteLLMConfig:
    """Get global configuration singleton.

    Args:
        config_path: Path to configuration file (default: ~/.ccw/config/litellm-config.yaml)
        reload: Force reload configuration from disk

    Returns:
        Global configuration instance
    """
    global _config_instance

    if _config_instance is None or reload:
        _config_instance = load_config(config_path)

    return _config_instance


def reset_config() -> None:
    """Reset global configuration singleton.

    Useful for testing.
    """
    global _config_instance
    _config_instance = None
