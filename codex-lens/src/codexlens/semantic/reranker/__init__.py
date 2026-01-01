"""Reranker backends for second-stage search ranking.

This subpackage provides a unified interface and factory for different reranking
implementations (e.g., ONNX, API-based, LiteLLM, and legacy sentence-transformers).
"""

from __future__ import annotations

from .base import BaseReranker
from .factory import check_reranker_available, get_reranker
from .legacy import CrossEncoderReranker, check_cross_encoder_available
from .onnx_reranker import ONNXReranker, check_onnx_reranker_available

__all__ = [
    "BaseReranker",
    "check_reranker_available",
    "get_reranker",
    "CrossEncoderReranker",
    "check_cross_encoder_available",
    "ONNXReranker",
    "check_onnx_reranker_available",
]
