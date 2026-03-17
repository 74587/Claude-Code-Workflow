"""Lightweight model download manager for fastembed models.

Handles HuggingFace mirror configuration and cache pre-population so that
fastembed can load models from local cache without network access.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

from .config import Config

log = logging.getLogger(__name__)

# Models that fastembed maps internally (HF repo may differ from model_name)
_EMBED_MODEL_FILES = ["*.onnx", "*.json"]
_RERANK_MODEL_FILES = ["*.onnx", "*.json"]


def _resolve_cache_dir(config: Config) -> str | None:
    """Return cache_dir for fastembed, or None for default."""
    return config.model_cache_dir or None


def _apply_mirror(config: Config) -> None:
    """Set HF_ENDPOINT env var if mirror is configured."""
    if config.hf_mirror:
        os.environ["HF_ENDPOINT"] = config.hf_mirror


def _model_is_cached(model_name: str, cache_dir: str | None) -> bool:
    """Check if a model already exists in the fastembed/HF hub cache.

    Note: fastembed may remap model names internally (e.g. BAAI/bge-small-en-v1.5
    -> qdrant/bge-small-en-v1.5-onnx-q), so we also search by partial name match.
    """
    base = cache_dir or _default_fastembed_cache()
    base_path = Path(base)
    if not base_path.exists():
        return False

    # Exact match first
    safe_name = model_name.replace("/", "--")
    model_dir = base_path / f"models--{safe_name}"
    if _dir_has_onnx(model_dir):
        return True

    # Partial match: fastembed remaps some model names
    short_name = model_name.split("/")[-1].lower()
    for d in base_path.iterdir():
        if short_name in d.name.lower() and _dir_has_onnx(d):
            return True

    return False


def _dir_has_onnx(model_dir: Path) -> bool:
    """Check if a model directory has at least one ONNX file in snapshots."""
    snapshots = model_dir / "snapshots"
    if not snapshots.exists():
        return False
    for snap in snapshots.iterdir():
        if list(snap.rglob("*.onnx")):
            return True
    return False


def _default_fastembed_cache() -> str:
    """Return fastembed's default cache directory."""
    return os.path.join(os.environ.get("TMPDIR", os.path.join(
        os.environ.get("LOCALAPPDATA", os.path.expanduser("~")),
    )), "fastembed_cache")


def ensure_model(model_name: str, config: Config) -> None:
    """Ensure a model is available in the local cache.

    If the model is already cached, this is a no-op.
    If not cached, attempts to download via huggingface_hub with mirror support.
    """
    cache_dir = _resolve_cache_dir(config)

    if _model_is_cached(model_name, cache_dir):
        log.debug("Model %s found in cache", model_name)
        return

    log.info("Model %s not in cache, downloading...", model_name)
    _apply_mirror(config)

    try:
        from huggingface_hub import snapshot_download

        kwargs: dict = {
            "repo_id": model_name,
            "allow_patterns": ["*.onnx", "*.json"],
        }
        if cache_dir:
            kwargs["cache_dir"] = cache_dir
        if config.hf_mirror:
            kwargs["endpoint"] = config.hf_mirror

        path = snapshot_download(**kwargs)
        log.info("Model %s downloaded to %s", model_name, path)

        # fastembed for some reranker models expects model.onnx but repo may
        # only have quantized variants.  Create a symlink/copy if needed.
        _ensure_model_onnx(Path(path))

    except ImportError:
        log.warning(
            "huggingface_hub not installed. Cannot download models. "
            "Install with: pip install huggingface-hub"
        )
    except Exception as e:
        log.warning("Failed to download model %s: %s", model_name, e)


def _ensure_model_onnx(model_dir: Path) -> None:
    """If model.onnx is missing but a quantized variant exists, copy it."""
    onnx_dir = model_dir / "onnx"
    if not onnx_dir.exists():
        onnx_dir = model_dir  # some models put onnx at root

    target = onnx_dir / "model.onnx"
    if target.exists():
        return

    # Look for quantized alternatives
    for name in ["model_quantized.onnx", "model_optimized.onnx",
                 "model_int8.onnx", "model_uint8.onnx"]:
        candidate = onnx_dir / name
        if candidate.exists():
            import shutil
            shutil.copy2(candidate, target)
            log.info("Copied %s -> model.onnx", name)
            return


def get_cache_kwargs(config: Config) -> dict:
    """Return kwargs to pass to fastembed constructors for cache_dir."""
    cache_dir = _resolve_cache_dir(config)
    if cache_dir:
        return {"cache_dir": cache_dir}
    return {}
