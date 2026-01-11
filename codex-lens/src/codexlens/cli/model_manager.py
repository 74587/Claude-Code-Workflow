"""Model Manager - Manage fastembed models for semantic search."""

import json
import os
import shutil
from pathlib import Path
from typing import Dict, List, Optional

try:
    from huggingface_hub import snapshot_download, list_repo_files
    HUGGINGFACE_HUB_AVAILABLE = True
except ImportError:
    HUGGINGFACE_HUB_AVAILABLE = False

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
    # Additional reranker models (commonly used)
    "bge-reranker-v2-m3": {
        "model_name": "BAAI/bge-reranker-v2-m3",
        "cache_name": "BAAI/bge-reranker-v2-m3",
        "size_mb": 560,
        "description": "BGE v2 M3 reranker, multilingual",
        "use_case": "Multilingual reranking, latest BGE version",
        "recommended": True,
    },
    "bge-reranker-v2-gemma": {
        "model_name": "BAAI/bge-reranker-v2-gemma",
        "cache_name": "BAAI/bge-reranker-v2-gemma",
        "size_mb": 2000,
        "description": "BGE v2 Gemma reranker, best quality",
        "use_case": "Maximum quality with Gemma backbone",
        "recommended": False,
    },
    "cross-encoder-ms-marco": {
        "model_name": "cross-encoder/ms-marco-MiniLM-L-6-v2",
        "cache_name": "cross-encoder/ms-marco-MiniLM-L-6-v2",
        "size_mb": 90,
        "description": "Original cross-encoder MS MARCO",
        "use_case": "Classic cross-encoder baseline",
        "recommended": False,
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
    # Additional embedding models (commonly used)
    "bge-large": {
        "model_name": "BAAI/bge-large-en-v1.5",
        "cache_name": "qdrant/bge-large-en-v1.5-onnx-q",
        "dimensions": 1024,
        "size_mb": 650,
        "description": "BGE large model, highest quality",
        "use_case": "Maximum quality semantic search",
        "recommended": False,
    },
    "e5-small": {
        "model_name": "intfloat/e5-small-v2",
        "cache_name": "qdrant/e5-small-v2-onnx",
        "dimensions": 384,
        "size_mb": 80,
        "description": "E5 small model, fast and lightweight",
        "use_case": "Low latency applications",
        "recommended": True,
    },
    "e5-base": {
        "model_name": "intfloat/e5-base-v2",
        "cache_name": "qdrant/e5-base-v2-onnx",
        "dimensions": 768,
        "size_mb": 220,
        "description": "E5 base model, balanced",
        "use_case": "General purpose semantic search",
        "recommended": True,
    },
    "e5-large": {
        "model_name": "intfloat/e5-large-v2",
        "cache_name": "qdrant/e5-large-v2-onnx",
        "dimensions": 1024,
        "size_mb": 650,
        "description": "E5 large model, high quality",
        "use_case": "High quality semantic search",
        "recommended": False,
    },
    "jina-base-en": {
        "model_name": "jinaai/jina-embeddings-v2-base-en",
        "cache_name": "jinaai/jina-embeddings-v2-base-en",
        "dimensions": 768,
        "size_mb": 150,
        "description": "Jina base English model",
        "use_case": "English text semantic search",
        "recommended": True,
    },
    "jina-small-en": {
        "model_name": "jinaai/jina-embeddings-v2-small-en",
        "cache_name": "jinaai/jina-embeddings-v2-small-en",
        "dimensions": 512,
        "size_mb": 60,
        "description": "Jina small English model, very fast",
        "use_case": "Low latency English text search",
        "recommended": True,
    },
    "snowflake-arctic": {
        "model_name": "Snowflake/snowflake-arctic-embed-m",
        "cache_name": "Snowflake/snowflake-arctic-embed-m",
        "dimensions": 768,
        "size_mb": 220,
        "description": "Snowflake Arctic embedding model",
        "use_case": "Enterprise semantic search, high quality",
        "recommended": True,
    },
    "nomic-embed": {
        "model_name": "nomic-ai/nomic-embed-text-v1.5",
        "cache_name": "nomic-ai/nomic-embed-text-v1.5",
        "dimensions": 768,
        "size_mb": 280,
        "description": "Nomic embedding model, open source",
        "use_case": "Open source text embedding",
        "recommended": True,
    },
    "gte-small": {
        "model_name": "thenlper/gte-small",
        "cache_name": "thenlper/gte-small",
        "dimensions": 384,
        "size_mb": 70,
        "description": "GTE small model, fast",
        "use_case": "Fast text embedding",
        "recommended": True,
    },
    "gte-base": {
        "model_name": "thenlper/gte-base",
        "cache_name": "thenlper/gte-base",
        "dimensions": 768,
        "size_mb": 220,
        "description": "GTE base model, balanced",
        "use_case": "General purpose text embedding",
        "recommended": True,
    },
    "gte-large": {
        "model_name": "thenlper/gte-large",
        "cache_name": "thenlper/gte-large",
        "dimensions": 1024,
        "size_mb": 650,
        "description": "GTE large model, high quality",
        "use_case": "High quality text embedding",
        "recommended": False,
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


def scan_discovered_models(model_type: str = "embedding") -> List[Dict]:
    """Scan cache directory for manually placed models not in predefined profiles.
    
    This allows users to manually download models (e.g., via huggingface-cli or 
    by copying the model directory) and have them recognized automatically.
    
    Args:
        model_type: Type of models to scan for ("embedding" or "reranker")
    
    Returns:
        List of discovered model info dictionaries
    """
    cache_dir = get_cache_dir()
    if not cache_dir.exists():
        return []
    
    # Get known model cache names based on type
    if model_type == "reranker":
        known_cache_names = {
            f"models--{info.get('cache_name', info['model_name']).replace('/', '--')}"
            for info in RERANKER_MODEL_PROFILES.values()
        }
    else:
        known_cache_names = {
            f"models--{info.get('cache_name', info['model_name']).replace('/', '--')}"
            for info in MODEL_PROFILES.values()
        }
    
    discovered = []
    
    # Scan for model directories in cache
    for item in cache_dir.iterdir():
        if not item.is_dir() or not item.name.startswith("models--"):
            continue
        
        # Skip known predefined models
        if item.name in known_cache_names:
            continue
        
        # Parse model name from directory (models--org--model -> org/model)
        parts = item.name[8:].split("--")  # Remove "models--" prefix
        if len(parts) >= 2:
            model_name = "/".join(parts)
        else:
            model_name = parts[0] if parts else item.name
        
        # Detect model type by checking for common patterns
        is_reranker = any(keyword in model_name.lower() for keyword in [
            "reranker", "cross-encoder", "ms-marco"
        ])
        is_embedding = any(keyword in model_name.lower() for keyword in [
            "embed", "bge", "e5", "jina", "minilm", "gte", "nomic", "arctic"
        ])
        
        # Filter based on requested type
        if model_type == "reranker" and not is_reranker:
            continue
        if model_type == "embedding" and is_reranker:
            continue
        
        # Calculate cache size
        try:
            total_size = sum(
                f.stat().st_size
                for f in item.rglob("*")
                if f.is_file()
            )
            cache_size_mb = round(total_size / (1024 * 1024), 1)
        except (OSError, PermissionError):
            cache_size_mb = 0
        
        discovered.append({
            "profile": f"discovered:{model_name.replace('/', '-')}",
            "model_name": model_name,
            "cache_name": model_name,
            "cache_path": str(item),
            "actual_size_mb": cache_size_mb,
            "description": f"Manually discovered model",
            "use_case": "User-provided model",
            "installed": True,
            "source": "discovered",  # Mark as discovered
        })
    
    return discovered


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
            "source": "predefined",  # Mark as predefined
            "recommended": info.get("recommended", True),
        })

    # Add discovered models (manually placed by user)
    discovered = scan_discovered_models(model_type="embedding")
    for model in discovered:
        # Try to estimate dimensions based on common model patterns
        dimensions = 768  # Default
        name_lower = model["model_name"].lower()
        if "small" in name_lower or "mini" in name_lower:
            dimensions = 384
        elif "large" in name_lower:
            dimensions = 1024
        
        model["dimensions"] = dimensions
        model["estimated_size_mb"] = model.get("actual_size_mb", 0)
        model["recommended"] = False  # User-provided models are not recommended by default
        models.append(model)

    return {
        "success": True,
        "result": {
            "models": models,
            "cache_dir": str(cache_dir),
            "cache_exists": cache_exists,
            "manual_install_guide": {
                "steps": [
                    "1. Download: huggingface-cli download <org>/<model>",
                    "2. Or copy to cache directory (see paths below)",
                    "3. Refresh to see discovered models"
                ],
                "example": "huggingface-cli download BAAI/bge-small-en-v1.5",
                "paths": {
                    "windows": "%USERPROFILE%\\.cache\\huggingface\\models--<org>--<model>",
                    "linux": "~/.cache/huggingface/models--<org>--<model>",
                    "macos": "~/.cache/huggingface/models--<org>--<model>",
                },
            },
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


def download_custom_model(model_name: str, model_type: str = "embedding", progress_callback: Optional[callable] = None) -> Dict[str, any]:
    """Download a custom model by HuggingFace model name.

    This allows users to download any HuggingFace model directly from
    HuggingFace Hub. The model will be placed in the standard cache
    directory where it can be discovered by scan_discovered_models().

    Note: Downloaded models may not be directly usable by FastEmbed unless
    they are in ONNX format. This function is primarily for downloading
    models that users want to use with other frameworks or custom code.

    Args:
        model_name: Full HuggingFace model name (e.g., "intfloat/e5-small-v2")
        model_type: Type of model ("embedding" or "reranker") - for metadata only
        progress_callback: Optional callback function to report progress

    Returns:
        Result dictionary with success status
    """
    if not HUGGINGFACE_HUB_AVAILABLE:
        return {
            "success": False,
            "error": "huggingface_hub not installed. Install with: pip install huggingface_hub",
        }

    # Validate model name format (org/model-name)
    if not model_name or "/" not in model_name:
        return {
            "success": False,
            "error": "Invalid model name format. Expected: 'org/model-name' (e.g., 'intfloat/e5-small-v2')",
        }

    try:
        cache_dir = get_cache_dir()

        if progress_callback:
            progress_callback(f"Checking model format for {model_name}...")

        # Check if model contains ONNX files before downloading
        try:
            files = list_repo_files(repo_id=model_name)
            has_onnx = any(
                f.endswith('.onnx') or
                f.startswith('onnx/') or
                '/onnx/' in f or
                f == 'model.onnx'
                for f in files
            )

            if not has_onnx:
                return {
                    "success": False,
                    "error": f"Model '{model_name}' does not contain ONNX files. "
                             f"FastEmbed requires ONNX-format models. "
                             f"Try Xenova/* versions or check the recommended models list.",
                    "files_found": len(files),
                    "suggestion": "Use models from the 'Recommended Models' list, or search for ONNX versions (e.g., Xenova/*).",
                }

            if progress_callback:
                progress_callback(f"ONNX format detected. Downloading {model_name}...")

        except Exception as check_err:
            # If we can't check, warn but allow download
            if progress_callback:
                progress_callback(f"Could not verify format, proceeding with download...")

        # Use huggingface_hub to download the model
        # This downloads to the standard HuggingFace cache directory
        local_path = snapshot_download(
            repo_id=model_name,
            cache_dir=str(cache_dir),
        )

        if progress_callback:
            progress_callback(f"Model {model_name} downloaded successfully")

        # Get cache info
        sanitized_name = f"models--{model_name.replace('/', '--')}"
        model_cache_path = cache_dir / sanitized_name

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
                "model_name": model_name,
                "model_type": model_type,
                "cache_size_mb": cache_size,
                "cache_path": str(model_cache_path),
                "local_path": local_path,
                "note": "Model downloaded. Note: Only ONNX-format models are compatible with FastEmbed.",
            },
        }
    
    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to download custom model: {str(e)}",
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
            "source": "predefined",  # Mark as predefined
        })

    # Add discovered reranker models (manually placed by user)
    discovered = scan_discovered_models(model_type="reranker")
    for model in discovered:
        model["estimated_size_mb"] = model.get("actual_size_mb", 0)
        model["recommended"] = False  # User-provided models are not recommended by default
        models.append(model)

    return {
        "success": True,
        "result": {
            "models": models,
            "cache_dir": str(cache_dir),
            "cache_exists": cache_exists,
            "manual_install_guide": {
                "steps": [
                    "1. Download: huggingface-cli download <org>/<model>",
                    "2. Or copy to cache directory (see paths below)",
                    "3. Refresh to see discovered models",
                ],
                "example": "huggingface-cli download BAAI/bge-reranker-base",
                "paths": {
                    "windows": "%USERPROFILE%\\.cache\\huggingface\\models--<org>--<model>",
                    "linux": "~/.cache/huggingface/models--<org>--<model>",
                    "macos": "~/.cache/huggingface/models--<org>--<model>",
                },
            },
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
