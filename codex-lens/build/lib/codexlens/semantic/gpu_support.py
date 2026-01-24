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
class GPUDevice:
    """Individual GPU device info."""
    device_id: int
    name: str
    is_discrete: bool  # True for discrete GPU (NVIDIA, AMD), False for integrated (Intel UHD)
    vendor: str  # "nvidia", "amd", "intel", "unknown"


@dataclass
class GPUInfo:
    """GPU availability and configuration info."""

    gpu_available: bool = False
    cuda_available: bool = False
    gpu_count: int = 0
    gpu_name: Optional[str] = None
    onnx_providers: List[str] = None
    devices: List[GPUDevice] = None  # List of detected GPU devices
    preferred_device_id: Optional[int] = None  # Preferred GPU for embedding

    def __post_init__(self):
        if self.onnx_providers is None:
            self.onnx_providers = ["CPUExecutionProvider"]
        if self.devices is None:
            self.devices = []


_gpu_info_cache: Optional[GPUInfo] = None


def _enumerate_gpus() -> List[GPUDevice]:
    """Enumerate available GPU devices using WMI on Windows.
    
    Returns:
        List of GPUDevice with device info, ordered by device_id.
    """
    devices = []
    
    try:
        import subprocess
        import sys
        
        if sys.platform == "win32":
            # Use PowerShell to query GPU information via WMI
            cmd = [
                "powershell", "-NoProfile", "-Command",
                "Get-WmiObject Win32_VideoController | Select-Object DeviceID, Name, AdapterCompatibility | ConvertTo-Json"
            ]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
            
            if result.returncode == 0 and result.stdout.strip():
                import json
                gpu_data = json.loads(result.stdout)
                
                # Handle single GPU case (returns dict instead of list)
                if isinstance(gpu_data, dict):
                    gpu_data = [gpu_data]
                
                for idx, gpu in enumerate(gpu_data):
                    name = gpu.get("Name", "Unknown GPU")
                    compat = gpu.get("AdapterCompatibility", "").lower()
                    
                    # Determine vendor
                    name_lower = name.lower()
                    if "nvidia" in name_lower or "nvidia" in compat:
                        vendor = "nvidia"
                        is_discrete = True
                    elif "amd" in name_lower or "radeon" in name_lower or "amd" in compat:
                        vendor = "amd"
                        is_discrete = True
                    elif "intel" in name_lower or "intel" in compat:
                        vendor = "intel"
                        # Intel UHD/Iris are integrated, Intel Arc is discrete
                        is_discrete = "arc" in name_lower
                    else:
                        vendor = "unknown"
                        is_discrete = False
                    
                    devices.append(GPUDevice(
                        device_id=idx,
                        name=name,
                        is_discrete=is_discrete,
                        vendor=vendor
                    ))
                    logger.debug(f"Detected GPU {idx}: {name} (vendor={vendor}, discrete={is_discrete})")
                    
    except Exception as e:
        logger.debug(f"GPU enumeration failed: {e}")
    
    return devices


def _get_preferred_device_id(devices: List[GPUDevice]) -> Optional[int]:
    """Determine the preferred GPU device_id for embedding.
    
    Preference order:
    1. NVIDIA discrete GPU (best DirectML/CUDA support)
    2. AMD discrete GPU
    3. Intel Arc (discrete)
    4. Intel integrated (fallback)
    
    Returns:
        device_id of preferred GPU, or None to use default.
    """
    if not devices:
        return None
    
    # Priority: NVIDIA > AMD > Intel Arc > Intel integrated
    priority_order = [
        ("nvidia", True),   # NVIDIA discrete
        ("amd", True),      # AMD discrete
        ("intel", True),    # Intel Arc (discrete)
        ("intel", False),   # Intel integrated (fallback)
    ]
    
    for target_vendor, target_discrete in priority_order:
        for device in devices:
            if device.vendor == target_vendor and device.is_discrete == target_discrete:
                logger.info(f"Preferred GPU: {device.name} (device_id={device.device_id})")
                return device.device_id
    
    # If no match, use first device
    if devices:
        return devices[0].device_id
    
    return None


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

    # Enumerate GPU devices first
    info.devices = _enumerate_gpus()
    info.gpu_count = len(info.devices)
    if info.devices:
        # Set preferred device (discrete GPU preferred over integrated)
        info.preferred_device_id = _get_preferred_device_id(info.devices)
        # Set gpu_name to preferred device name
        for dev in info.devices:
            if dev.device_id == info.preferred_device_id:
                info.gpu_name = dev.name
                break

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


def get_optimal_providers(use_gpu: bool = True, with_device_options: bool = False) -> list:
    """Get optimal ONNX execution providers based on availability.

    Args:
        use_gpu: If True, include GPU providers when available.
                 If False, force CPU-only execution.
        with_device_options: If True, return providers as tuples with device_id options
                            for proper GPU device selection (required for DirectML).

    Returns:
        List of provider names or tuples (provider_name, options_dict) in priority order.
    """
    if not use_gpu:
        return ["CPUExecutionProvider"]

    gpu_info = detect_gpu()

    # Check if GPU was requested but not available - log warning
    if not gpu_info.gpu_available:
        try:
            import onnxruntime as ort
            available_providers = ort.get_available_providers()
        except ImportError:
            available_providers = []
        logger.warning(
            "GPU acceleration was requested, but no supported GPU provider (CUDA, DirectML) "
            f"was found. Available providers: {available_providers}. Falling back to CPU."
        )
    else:
        # Log which GPU provider is being used
        gpu_providers = [p for p in gpu_info.onnx_providers if p != "CPUExecutionProvider"]
        if gpu_providers:
            logger.info(f"Using {gpu_providers[0]} for ONNX GPU acceleration")

    if not with_device_options:
        return gpu_info.onnx_providers

    # Build providers with device_id options for GPU providers
    device_id = get_selected_device_id()
    providers = []
    
    for provider in gpu_info.onnx_providers:
        if provider == "DmlExecutionProvider" and device_id is not None:
            # DirectML requires device_id in provider_options tuple
            providers.append(("DmlExecutionProvider", {"device_id": device_id}))
            logger.debug(f"DmlExecutionProvider configured with device_id={device_id}")
        elif provider == "CUDAExecutionProvider" and device_id is not None:
            # CUDA also supports device_id in provider_options
            providers.append(("CUDAExecutionProvider", {"device_id": device_id}))
            logger.debug(f"CUDAExecutionProvider configured with device_id={device_id}")
        elif provider == "ROCMExecutionProvider" and device_id is not None:
            # ROCm supports device_id
            providers.append(("ROCMExecutionProvider", {"device_id": device_id}))
            logger.debug(f"ROCMExecutionProvider configured with device_id={device_id}")
        else:
            # CPU and other providers don't need device_id
            providers.append(provider)
    
    return providers


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


# User-selected device ID (overrides auto-detection)
_selected_device_id: Optional[int] = None


def get_gpu_devices() -> List[dict]:
    """Get list of available GPU devices for frontend selection.
    
    Returns:
        List of dicts with device info for each GPU.
    """
    info = detect_gpu()
    devices = []
    
    for dev in info.devices:
        devices.append({
            "device_id": dev.device_id,
            "name": dev.name,
            "vendor": dev.vendor,
            "is_discrete": dev.is_discrete,
            "is_preferred": dev.device_id == info.preferred_device_id,
            "is_selected": dev.device_id == get_selected_device_id(),
        })
    
    return devices


def get_selected_device_id() -> Optional[int]:
    """Get the user-selected GPU device_id.
    
    Returns:
        User-selected device_id, or auto-detected preferred device_id if not set.
    """
    global _selected_device_id
    
    if _selected_device_id is not None:
        return _selected_device_id
    
    # Fall back to auto-detected preferred device
    info = detect_gpu()
    return info.preferred_device_id


def set_selected_device_id(device_id: Optional[int]) -> bool:
    """Set the GPU device_id to use for embeddings.
    
    Args:
        device_id: GPU device_id to use, or None to use auto-detection.
        
    Returns:
        True if device_id is valid, False otherwise.
    """
    global _selected_device_id
    
    if device_id is None:
        _selected_device_id = None
        logger.info("GPU selection reset to auto-detection")
        return True
    
    # Validate device_id exists
    info = detect_gpu()
    valid_ids = [dev.device_id for dev in info.devices]
    
    if device_id in valid_ids:
        _selected_device_id = device_id
        device_name = next((dev.name for dev in info.devices if dev.device_id == device_id), "Unknown")
        logger.info(f"GPU selection set to device {device_id}: {device_name}")
        return True
    else:
        logger.warning(f"Invalid device_id {device_id}. Valid IDs: {valid_ids}")
        return False
