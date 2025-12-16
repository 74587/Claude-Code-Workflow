"""Model Manager - Manage fastembed models for semantic search."""

import json
import os
import shutil
from pathlib import Path
from typing import Dict, List, Optional

try:
    from fastembed import TextEmbedding
    FASTEMBED_AVAILABLE = True
except ImportError:
    FASTEMBED_AVAILABLE = False


# Model profiles with metadata
MODEL_PROFILES = {
    "fast": {
        "model_name": "BAAI/bge-small-en-v1.5",
        "dimensions": 384,
        "size_mb": 80,
        "description": "Fast, lightweight, English-optimized",
        "use_case": "Quick prototyping, resource-constrained environments",
    },
    "code": {
        "model_name": "jinaai/jina-embeddings-v2-base-code",
        "dimensions": 768,
        "size_mb": 150,
        "description": "Code-optimized, best for programming languages",
        "use_case": "Open source projects, code semantic search",
    },
    "multilingual": {
        "model_name": "intfloat/multilingual-e5-large",
        "dimensions": 1024,
        "size_mb": 1000,
        "description": "Multilingual + code support",
        "use_case": "Enterprise multilingual projects",
    },
    "balanced": {
        "model_name": "mixedbread-ai/mxbai-embed-large-v1",
        "dimensions": 1024,
        "size_mb": 600,
        "description": "High accuracy, general purpose",
        "use_case": "High-quality semantic search, balanced performance",
    },
}


def get_cache_dir() -> Path:
    """Get fastembed cache directory.

    Returns:
        Path to cache directory (usually ~/.cache/fastembed or %LOCALAPPDATA%\\Temp\\fastembed_cache)
    """
    # Check HF_HOME environment variable first
    if "HF_HOME" in os.environ:
        return Path(os.environ["HF_HOME"])

    # Default cache locations
    if os.name == "nt":  # Windows
        cache_dir = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local")) / "Temp" / "fastembed_cache"
    else:  # Unix-like
        cache_dir = Path.home() / ".cache" / "fastembed"

    return cache_dir


def list_models() -> Dict[str, any]:
    """List available model profiles and their installation status.

    Returns:
        Dictionary with model profiles, installed status, and cache info
    """
    if not FASTEMBED_AVAILABLE:
        return {
            "success": False,
            "error": "fastembed not installed. Install with: pip install codexlens[semantic]",
        }

    cache_dir = get_cache_dir()
    cache_exists = cache_dir.exists()

    models = []
    for profile, info in MODEL_PROFILES.items():
        model_name = info["model_name"]

        # Check if model is cached
        installed = False
        cache_size_mb = 0

        if cache_exists:
            # Check for model directory in cache
            model_cache_path = cache_dir / f"models--{model_name.replace('/', '--')}"
            if model_cache_path.exists():
                installed = True
                # Calculate cache size
                total_size = sum(
                    f.stat().st_size
                    for f in model_cache_path.rglob("*")
                    if f.is_file()
                )
                cache_size_mb = round(total_size / (1024 * 1024), 1)

        models.append({
            "profile": profile,
            "model_name": model_name,
            "dimensions": info["dimensions"],
            "estimated_size_mb": info["size_mb"],
            "actual_size_mb": cache_size_mb if installed else None,
            "description": info["description"],
            "use_case": info["use_case"],
            "installed": installed,
        })

    return {
        "success": True,
        "result": {
            "models": models,
            "cache_dir": str(cache_dir),
            "cache_exists": cache_exists,
        },
    }


def download_model(profile: str, progress_callback: Optional[callable] = None) -> Dict[str, any]:
    """Download a model by profile name.

    Args:
        profile: Model profile name (fast, code, multilingual, balanced)
        progress_callback: Optional callback function to report progress

    Returns:
        Result dictionary with success status
    """
    if not FASTEMBED_AVAILABLE:
        return {
            "success": False,
            "error": "fastembed not installed. Install with: pip install codexlens[semantic]",
        }

    if profile not in MODEL_PROFILES:
        return {
            "success": False,
            "error": f"Unknown profile: {profile}. Available: {', '.join(MODEL_PROFILES.keys())}",
        }

    model_name = MODEL_PROFILES[profile]["model_name"]

    try:
        # Download model by instantiating TextEmbedding
        # This will automatically download to cache if not present
        if progress_callback:
            progress_callback(f"Downloading {model_name}...")

        embedder = TextEmbedding(model_name=model_name)

        if progress_callback:
            progress_callback(f"Model {model_name} downloaded successfully")

        # Get cache info
        cache_dir = get_cache_dir()
        model_cache_path = cache_dir / f"models--{model_name.replace('/', '--')}"

        cache_size = 0
        if model_cache_path.exists():
            total_size = sum(
                f.stat().st_size
                for f in model_cache_path.rglob("*")
                if f.is_file()
            )
            cache_size = round(total_size / (1024 * 1024), 1)

        return {
            "success": True,
            "result": {
                "profile": profile,
                "model_name": model_name,
                "cache_size_mb": cache_size,
                "cache_path": str(model_cache_path),
            },
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to download model: {str(e)}",
        }


def delete_model(profile: str) -> Dict[str, any]:
    """Delete a downloaded model from cache.

    Args:
        profile: Model profile name to delete

    Returns:
        Result dictionary with success status
    """
    if profile not in MODEL_PROFILES:
        return {
            "success": False,
            "error": f"Unknown profile: {profile}. Available: {', '.join(MODEL_PROFILES.keys())}",
        }

    model_name = MODEL_PROFILES[profile]["model_name"]
    cache_dir = get_cache_dir()
    model_cache_path = cache_dir / f"models--{model_name.replace('/', '--')}"

    if not model_cache_path.exists():
        return {
            "success": False,
            "error": f"Model {profile} ({model_name}) is not installed",
        }

    try:
        # Calculate size before deletion
        total_size = sum(
            f.stat().st_size
            for f in model_cache_path.rglob("*")
            if f.is_file()
        )
        size_mb = round(total_size / (1024 * 1024), 1)

        # Delete model directory
        shutil.rmtree(model_cache_path)

        return {
            "success": True,
            "result": {
                "profile": profile,
                "model_name": model_name,
                "deleted_size_mb": size_mb,
                "cache_path": str(model_cache_path),
            },
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to delete model: {str(e)}",
        }


def get_model_info(profile: str) -> Dict[str, any]:
    """Get detailed information about a model profile.

    Args:
        profile: Model profile name

    Returns:
        Result dictionary with model information
    """
    if profile not in MODEL_PROFILES:
        return {
            "success": False,
            "error": f"Unknown profile: {profile}. Available: {', '.join(MODEL_PROFILES.keys())}",
        }

    info = MODEL_PROFILES[profile]
    model_name = info["model_name"]

    # Check installation status
    cache_dir = get_cache_dir()
    model_cache_path = cache_dir / f"models--{model_name.replace('/', '--')}"
    installed = model_cache_path.exists()

    cache_size_mb = None
    if installed:
        total_size = sum(
            f.stat().st_size
            for f in model_cache_path.rglob("*")
            if f.is_file()
        )
        cache_size_mb = round(total_size / (1024 * 1024), 1)

    return {
        "success": True,
        "result": {
            "profile": profile,
            "model_name": model_name,
            "dimensions": info["dimensions"],
            "estimated_size_mb": info["size_mb"],
            "actual_size_mb": cache_size_mb,
            "description": info["description"],
            "use_case": info["use_case"],
            "installed": installed,
            "cache_path": str(model_cache_path) if installed else None,
        },
    }
