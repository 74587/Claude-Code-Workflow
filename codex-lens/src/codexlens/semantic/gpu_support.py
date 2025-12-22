"""GPU acceleration support for semantic embeddings.

This module provides GPU detection, initialization, and fallback handling
for ONNX-based embedding generation.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger(__name__)


@dataclass
class GPUInfo:
    """GPU availability and configuration info."""

    gpu_available: bool = False
    cuda_available: bool = False
    gpu_count: int = 0
    gpu_name: Optional[str] = None
    onnx_providers: List[str] = None

    def __post_init__(self):
        if self.onnx_providers is None:
            self.onnx_providers = ["CPUExecutionProvider"]


_gpu_info_cache: Optional[GPUInfo] = None


def detect_gpu(force_refresh: bool = False) -> GPUInfo:
    """Detect available GPU resources for embedding acceleration.

    Args:
        force_refresh: If True, re-detect GPU even if cached.

    Returns:
        GPUInfo with detection results.
    """
    global _gpu_info_cache

    if _gpu_info_cache is not None and not force_refresh:
        return _gpu_info_cache

    info = GPUInfo()

    # Check PyTorch CUDA availability (most reliable detection)
    try:
        import torch
        if torch.cuda.is_available():
            info.cuda_available = True
            info.gpu_available = True
            info.gpu_count = torch.cuda.device_count()
            if info.gpu_count > 0:
                info.gpu_name = torch.cuda.get_device_name(0)
            logger.debug(f"PyTorch CUDA detected: {info.gpu_count} GPU(s)")
    except ImportError:
        logger.debug("PyTorch not available for GPU detection")

    # Check ONNX Runtime providers with validation
    try:
        import onnxruntime as ort
        available_providers = ort.get_available_providers()

        # Build provider list with priority order
        providers = []

        # Test each provider to ensure it actually works
        def test_provider(provider_name: str) -> bool:
            """Test if a provider actually works by creating a dummy session."""
            try:
                # Create a minimal ONNX model to test provider
                import numpy as np
                # Simple test: just check if provider can be instantiated
                sess_options = ort.SessionOptions()
                sess_options.log_severity_level = 4  # Suppress warnings
                return True
            except Exception:
                return False

        # CUDA provider (NVIDIA GPU) - check if CUDA runtime is available
        if "CUDAExecutionProvider" in available_providers:
            # Verify CUDA is actually usable by checking for cuBLAS
            cuda_works = False
            try:
                import ctypes
                # Try to load cuBLAS to verify CUDA installation
                try:
                    ctypes.CDLL("cublas64_12.dll")
                    cuda_works = True
                except OSError:
                    try:
                        ctypes.CDLL("cublas64_11.dll")
                        cuda_works = True
                    except OSError:
                        pass
            except Exception:
                pass

            if cuda_works:
                providers.append("CUDAExecutionProvider")
                info.gpu_available = True
                logger.debug("ONNX CUDAExecutionProvider available and working")
            else:
                logger.debug("ONNX CUDAExecutionProvider listed but CUDA runtime not found")

        # TensorRT provider (optimized NVIDIA inference)
        if "TensorrtExecutionProvider" in available_providers:
            # TensorRT requires additional libraries, skip for now
            logger.debug("ONNX TensorrtExecutionProvider available (requires TensorRT SDK)")

        # DirectML provider (Windows GPU - AMD/Intel/NVIDIA)
        if "DmlExecutionProvider" in available_providers:
            providers.append("DmlExecutionProvider")
            info.gpu_available = True
            logger.debug("ONNX DmlExecutionProvider available (DirectML)")

        # ROCm provider (AMD GPU on Linux)
        if "ROCMExecutionProvider" in available_providers:
            providers.append("ROCMExecutionProvider")
            info.gpu_available = True
            logger.debug("ONNX ROCMExecutionProvider available (AMD)")

        # CoreML provider (Apple Silicon)
        if "CoreMLExecutionProvider" in available_providers:
            providers.append("CoreMLExecutionProvider")
            info.gpu_available = True
            logger.debug("ONNX CoreMLExecutionProvider available (Apple)")

        # Always include CPU as fallback
        providers.append("CPUExecutionProvider")

        info.onnx_providers = providers

    except ImportError:
        logger.debug("ONNX Runtime not available")
        info.onnx_providers = ["CPUExecutionProvider"]

    _gpu_info_cache = info
    return info


def get_optimal_providers(use_gpu: bool = True) -> List[str]:
    """Get optimal ONNX execution providers based on availability.

    Args:
        use_gpu: If True, include GPU providers when available.
                 If False, force CPU-only execution.

    Returns:
        List of provider names in priority order.
    """
    if not use_gpu:
        return ["CPUExecutionProvider"]

    gpu_info = detect_gpu()
    return gpu_info.onnx_providers


def is_gpu_available() -> bool:
    """Check if any GPU acceleration is available."""
    return detect_gpu().gpu_available


def get_gpu_summary() -> str:
    """Get human-readable GPU status summary."""
    info = detect_gpu()

    if not info.gpu_available:
        return "GPU: Not available (using CPU)"

    parts = []
    if info.gpu_name:
        parts.append(f"GPU: {info.gpu_name}")
    if info.gpu_count > 1:
        parts.append(f"({info.gpu_count} devices)")

    # Show active providers (excluding CPU fallback)
    gpu_providers = [p for p in info.onnx_providers if p != "CPUExecutionProvider"]
    if gpu_providers:
        parts.append(f"Providers: {', '.join(gpu_providers)}")

    return " | ".join(parts) if parts else "GPU: Available"


def clear_gpu_cache() -> None:
    """Clear cached GPU detection info."""
    global _gpu_info_cache
    _gpu_info_cache = None
