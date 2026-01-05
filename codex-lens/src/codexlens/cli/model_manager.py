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

try:
    # fastembed >= 0.4.0 moved TextCrossEncoder to rerank.cross_encoder
    from fastembed.rerank.cross_encoder import TextCrossEncoder
    RERANKER_AVAILABLE = True
except ImportError:
    try:
        # Fallback for older versions
        from fastembed import TextCrossEncoder
        RERANKER_AVAILABLE = True
    except ImportError:
        RERANKER_AVAILABLE = False


# Reranker model profiles with metadata
# Note: fastembed TextCrossEncoder uses ONNX models from HuggingFace
RERANKER_MODEL_PROFILES = {
    "ms-marco-mini": {
        "model_name": "Xenova/ms-marco-MiniLM-L-6-v2",
        "cache_name": "Xenova/ms-marco-MiniLM-L-6-v2",
        "size_mb": 90,
        "description": "Fast, lightweight reranker (default)",
        "use_case": "Quick prototyping, resource-constrained environments",
        "recommended": True,
    },
    "ms-marco-12": {
        "model_name": "Xenova/ms-marco-MiniLM-L-12-v2",
        "cache_name": "Xenova/ms-marco-MiniLM-L-12-v2",
        "size_mb": 130,
        "description": "Better quality, 12-layer MiniLM",
        "use_case": "General purpose reranking with better accuracy",
        "recommended": True,
    },
    "bge-base": {
        "model_name": "BAAI/bge-reranker-base",
        "cache_name": "BAAI/bge-reranker-base",
        "size_mb": 280,
        "description": "BGE reranker base model",
        "use_case": "High-quality reranking for production",
        "recommended": True,
    },
    "bge-large": {
        "model_name": "BAAI/bge-reranker-large",
        "cache_name": "BAAI/bge-reranker-large",
        "size_mb": 560,
        "description": "BGE reranker large model (high resource usage)",
        "use_case": "Maximum quality reranking",
        "recommended": False,
    },
    "jina-tiny": {
        "model_name": "jinaai/jina-reranker-v1-tiny-en",
        "cache_name": "jinaai/jina-reranker-v1-tiny-en",
        "size_mb": 70,
        "description": "Jina tiny reranker, very fast",
        "use_case": "Ultra-low latency applications",
        "recommended": True,
    },
    "jina-turbo": {
        "model_name": "jinaai/jina-reranker-v1-turbo-en",
        "cache_name": "jinaai/jina-reranker-v1-turbo-en",
        "size_mb": 150,
        "description": "Jina turbo reranker, balanced",
        "use_case": "Fast reranking with good accuracy",
        "recommended": True,
    },
}


# Model profiles with metadata
# Note: 768d is max recommended dimension for optimal performance/quality balance
# 1024d models are available but not recommended due to higher resource usage
# cache_name: The actual Hugging Face repo name used by fastembed for ONNX caching
MODEL_PROFILES = {
    "fast": {
        "model_name": "BAAI/bge-small-en-v1.5",
        "cache_name": "qdrant/bge-small-en-v1.5-onnx-q",  # fastembed uses ONNX version
        "dimensions": 384,
        "size_mb": 80,
        "description": "Fast, lightweight, English-optimized",
        "use_case": "Quick prototyping, resource-constrained environments",
        "recommended": True,
    },
    "base": {
        "model_name": "BAAI/bge-base-en-v1.5",
        "cache_name": "qdrant/bge-base-en-v1.5-onnx-q",  # fastembed uses ONNX version
        "dimensions": 768,
        "size_mb": 220,
        "description": "General purpose, good balance of speed and quality",
        "use_case": "General text search, documentation",
        "recommended": True,
    },
    "code": {
        "model_name": "jinaai/jina-embeddings-v2-base-code",
        "cache_name": "jinaai/jina-embeddings-v2-base-code",  # Uses original name
        "dimensions": 768,
        "size_mb": 150,
        "description": "Code-optimized, best for programming languages",
        "use_case": "Open source projects, code semantic search",
        "recommended": True,
    },
    "minilm": {
        "model_name": "sentence-transformers/all-MiniLM-L6-v2",
        "cache_name": "qdrant/all-MiniLM-L6-v2-onnx",  # fastembed uses ONNX version
        "dimensions": 384,
        "size_mb": 90,
        "description": "Popular lightweight model, good quality",
        "use_case": "General purpose, low resource environments",
        "recommended": True,
    },
    "multilingual": {
        "model_name": "intfloat/multilingual-e5-large",
        "cache_name": "qdrant/multilingual-e5-large-onnx",  # fastembed uses ONNX version
        "dimensions": 1024,
        "size_mb": 1000,
        "description": "Multilingual + code support (high resource usage)",
        "use_case": "Enterprise multilingual projects",
        "recommended": False,  # 1024d not recommended
    },
    "balanced": {
        "model_name": "mixedbread-ai/mxbai-embed-large-v1",
        "cache_name": "mixedbread-ai/mxbai-embed-large-v1",  # Uses original name
        "dimensions": 1024,
        "size_mb": 600,
        "description": "High accuracy, general purpose (high resource usage)",
        "use_case": "High-quality semantic search, balanced performance",
        "recommended": False,  # 1024d not recommended
    },
}


def get_cache_dir() -> Path:
    """Get fastembed cache directory.

    Returns:
        Path to cache directory (~/.cache/huggingface or custom path)
    """
    # Check HF_HOME environment variable first
    if "HF_HOME" in os.environ:
        return Path(os.environ["HF_HOME"])

    # fastembed 0.7.4+ uses HuggingFace cache when cache_dir is specified
    # Models are stored directly under the cache directory
    return Path.home() / ".cache" / "huggingface"


def _get_model_cache_path(cache_dir: Path, info: Dict) -> Path:
    """Get the actual cache path for a model.

    fastembed 0.7.4+ uses HuggingFace Hub's naming convention:
    - Prefix: 'models--'
    - Replace '/' with '--' in model name
    Example: jinaai/jina-embeddings-v2-base-code
             -> models--jinaai--jina-embeddings-v2-base-code

    Args:
        cache_dir: The fastembed cache directory (HuggingFace hub path)
        info: Model profile info dictionary

    Returns:
        Path to the model cache directory
    """
    # HuggingFace Hub naming: models--{org}--{model}
    # Use cache_name if available (for mapped ONNX models), else model_name
    target_name = info.get("cache_name", info["model_name"])
    sanitized_name = f"models--{target_name.replace('/', '--')}"
    return cache_dir / sanitized_name


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

        # Check if model is cached using the actual cache name
        installed = False
        cache_size_mb = 0

        if cache_exists:
            # Check for model directory in cache using correct cache_name
            model_cache_path = _get_model_cache_path(cache_dir, info)
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

    info = MODEL_PROFILES[profile]
    model_name = info["model_name"]

    try:
        # Get cache directory
        cache_dir = get_cache_dir()

        # Download model by instantiating TextEmbedding with explicit cache_dir
        # This ensures fastembed uses the correct HuggingFace Hub cache location
        if progress_callback:
            progress_callback(f"Downloading {model_name}...")

        # CRITICAL: Must specify cache_dir to use HuggingFace cache
        # and call embed() to trigger actual download
        embedder = TextEmbedding(model_name=model_name, cache_dir=str(cache_dir))

        # Trigger actual download by calling embed
        # TextEmbedding.__init__ alone doesn't download files
        if progress_callback:
            progress_callback(f"Initializing {model_name}...")

        list(embedder.embed(["test"]))  # Trigger download

        if progress_callback:
            progress_callback(f"Model {model_name} downloaded successfully")

        # Get cache info using correct HuggingFace Hub path
        model_cache_path = _get_model_cache_path(cache_dir, info)

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

    info = MODEL_PROFILES[profile]
    model_name = info["model_name"]
    cache_dir = get_cache_dir()
    model_cache_path = _get_model_cache_path(cache_dir, info)

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

    # Check installation status using correct cache_name
    cache_dir = get_cache_dir()
    model_cache_path = _get_model_cache_path(cache_dir, info)
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


# ============================================================================
# Reranker Model Management Functions
# ============================================================================


def list_reranker_models() -> Dict[str, any]:
    """List available reranker model profiles and their installation status.

    Returns:
        Dictionary with reranker model profiles, installed status, and cache info
    """
    if not RERANKER_AVAILABLE:
        return {
            "success": False,
            "error": "fastembed reranker not available. Install with: pip install fastembed>=0.4.0",
        }

    cache_dir = get_cache_dir()
    cache_exists = cache_dir.exists()

    models = []
    for profile, info in RERANKER_MODEL_PROFILES.items():
        model_name = info["model_name"]

        # Check if model is cached
        installed = False
        cache_size_mb = 0

        if cache_exists:
            model_cache_path = _get_model_cache_path(cache_dir, info)
            if model_cache_path.exists():
                installed = True
                total_size = sum(
                    f.stat().st_size
                    for f in model_cache_path.rglob("*")
                    if f.is_file()
                )
                cache_size_mb = round(total_size / (1024 * 1024), 1)

        models.append({
            "profile": profile,
            "model_name": model_name,
            "estimated_size_mb": info["size_mb"],
            "actual_size_mb": cache_size_mb if installed else None,
            "description": info["description"],
            "use_case": info["use_case"],
            "installed": installed,
            "recommended": info.get("recommended", True),
        })

    return {
        "success": True,
        "result": {
            "models": models,
            "cache_dir": str(cache_dir),
            "cache_exists": cache_exists,
        },
    }


def download_reranker_model(profile: str, progress_callback: Optional[callable] = None) -> Dict[str, any]:
    """Download a reranker model by profile name.

    Args:
        profile: Reranker model profile name
        progress_callback: Optional callback function to report progress

    Returns:
        Result dictionary with success status
    """
    if not RERANKER_AVAILABLE:
        return {
            "success": False,
            "error": "fastembed reranker not available. Install with: pip install fastembed>=0.4.0",
        }

    if profile not in RERANKER_MODEL_PROFILES:
        return {
            "success": False,
            "error": f"Unknown reranker profile: {profile}. Available: {', '.join(RERANKER_MODEL_PROFILES.keys())}",
        }

    info = RERANKER_MODEL_PROFILES[profile]
    model_name = info["model_name"]

    try:
        cache_dir = get_cache_dir()

        if progress_callback:
            progress_callback(f"Downloading reranker {model_name}...")

        # Download model by instantiating TextCrossEncoder with explicit cache_dir
        reranker = TextCrossEncoder(model_name=model_name, cache_dir=str(cache_dir))

        # Trigger actual download by calling rerank
        if progress_callback:
            progress_callback(f"Initializing {model_name}...")

        list(reranker.rerank("test query", ["test document"]))

        if progress_callback:
            progress_callback(f"Reranker {model_name} downloaded successfully")

        # Get cache info
        model_cache_path = _get_model_cache_path(cache_dir, info)

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
            "error": f"Failed to download reranker model: {str(e)}",
        }


def delete_reranker_model(profile: str) -> Dict[str, any]:
    """Delete a downloaded reranker model from cache.

    Args:
        profile: Reranker model profile name to delete

    Returns:
        Result dictionary with success status
    """
    if profile not in RERANKER_MODEL_PROFILES:
        return {
            "success": False,
            "error": f"Unknown reranker profile: {profile}. Available: {', '.join(RERANKER_MODEL_PROFILES.keys())}",
        }

    info = RERANKER_MODEL_PROFILES[profile]
    model_name = info["model_name"]
    cache_dir = get_cache_dir()
    model_cache_path = _get_model_cache_path(cache_dir, info)

    if not model_cache_path.exists():
        return {
            "success": False,
            "error": f"Reranker model {profile} ({model_name}) is not installed",
        }

    try:
        total_size = sum(
            f.stat().st_size
            for f in model_cache_path.rglob("*")
            if f.is_file()
        )
        size_mb = round(total_size / (1024 * 1024), 1)

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
            "error": f"Failed to delete reranker model: {str(e)}",
        }


def get_reranker_model_info(profile: str) -> Dict[str, any]:
    """Get detailed information about a reranker model profile.

    Args:
        profile: Reranker model profile name

    Returns:
        Result dictionary with model information
    """
    if profile not in RERANKER_MODEL_PROFILES:
        return {
            "success": False,
            "error": f"Unknown reranker profile: {profile}. Available: {', '.join(RERANKER_MODEL_PROFILES.keys())}",
        }

    info = RERANKER_MODEL_PROFILES[profile]
    model_name = info["model_name"]

    cache_dir = get_cache_dir()
    model_cache_path = _get_model_cache_path(cache_dir, info)
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
            "estimated_size_mb": info["size_mb"],
            "actual_size_mb": cache_size_mb,
            "description": info["description"],
            "use_case": info["use_case"],
            "installed": installed,
            "recommended": info.get("recommended", True),
            "cache_path": str(model_cache_path) if installed else None,
        },
    }
