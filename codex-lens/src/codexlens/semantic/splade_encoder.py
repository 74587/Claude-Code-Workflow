"""ONNX-optimized SPLADE sparse encoder for code search.

This module provides SPLADE (Sparse Lexical and Expansion) encoding using ONNX Runtime
for efficient sparse vector generation. SPLADE produces vocabulary-aligned sparse vectors
that combine the interpretability of BM25 with neural relevance modeling.

Install (CPU):
    pip install onnxruntime optimum[onnxruntime] transformers

Install (GPU):
    pip install onnxruntime-gpu optimum[onnxruntime-gpu] transformers
"""

from __future__ import annotations

import logging
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


def check_splade_available() -> Tuple[bool, Optional[str]]:
    """Check whether SPLADE dependencies are available.

    Returns:
        Tuple of (available: bool, error_message: Optional[str])
    """
    try:
        import numpy  # noqa: F401
    except ImportError as exc:
        return False, f"numpy not available: {exc}. Install with: pip install numpy"

    try:
        import onnxruntime  # noqa: F401
    except ImportError as exc:
        return (
            False,
            f"onnxruntime not available: {exc}. Install with: pip install onnxruntime",
        )

    try:
        from optimum.onnxruntime import ORTModelForMaskedLM  # noqa: F401
    except ImportError as exc:
        return (
            False,
            f"optimum[onnxruntime] not available: {exc}. Install with: pip install optimum[onnxruntime]",
        )

    try:
        from transformers import AutoTokenizer  # noqa: F401
    except ImportError as exc:
        return (
            False,
            f"transformers not available: {exc}. Install with: pip install transformers",
        )

    return True, None


# Global cache for SPLADE encoders (singleton pattern)
_splade_cache: Dict[str, "SpladeEncoder"] = {}
_cache_lock = threading.RLock()


def get_splade_encoder(
    model_name: str = "naver/splade-cocondenser-ensembledistil",
    use_gpu: bool = True,
    max_length: int = 512,
    sparsity_threshold: float = 0.01,
    cache_dir: Optional[str] = None,
) -> "SpladeEncoder":
    """Get or create cached SPLADE encoder (thread-safe singleton).

    This function provides significant performance improvement by reusing
    SpladeEncoder instances across multiple searches, avoiding repeated model
    loading overhead.

    Args:
        model_name: SPLADE model name (default: naver/splade-cocondenser-ensembledistil)
        use_gpu: If True, use GPU acceleration when available
        max_length: Maximum sequence length for tokenization
        sparsity_threshold: Minimum weight to include in sparse vector
        cache_dir: Directory to cache ONNX models (default: ~/.cache/codexlens/splade)

    Returns:
        Cached SpladeEncoder instance for the given configuration
    """
    global _splade_cache

    # Cache key includes all configuration parameters
    cache_key = f"{model_name}:{'gpu' if use_gpu else 'cpu'}:{max_length}:{sparsity_threshold}"

    with _cache_lock:
        encoder = _splade_cache.get(cache_key)
        if encoder is not None:
            return encoder

        # Create new encoder and cache it
        encoder = SpladeEncoder(
            model_name=model_name,
            use_gpu=use_gpu,
            max_length=max_length,
            sparsity_threshold=sparsity_threshold,
            cache_dir=cache_dir,
        )
        # Pre-load model to ensure it's ready
        encoder._load_model()
        _splade_cache[cache_key] = encoder

        return encoder


def clear_splade_cache() -> None:
    """Clear the SPLADE encoder cache and release ONNX resources.

    This method ensures proper cleanup of ONNX model resources to prevent
    memory leaks when encoders are no longer needed.
    """
    global _splade_cache
    with _cache_lock:
        # Release ONNX resources before clearing cache
        for encoder in _splade_cache.values():
            if encoder._model is not None:
                del encoder._model
                encoder._model = None
            if encoder._tokenizer is not None:
                del encoder._tokenizer
                encoder._tokenizer = None
        _splade_cache.clear()


class SpladeEncoder:
    """ONNX-optimized SPLADE sparse encoder.

    Produces sparse vectors with vocabulary-aligned dimensions.
    Output: Dict[int, float] mapping token_id to weight.

    SPLADE activation formula:
        splade_repr = log(1 + ReLU(logits)) * attention_mask
        splade_vec = max_pooling(splade_repr, axis=sequence_length)

    References:
        - SPLADE: https://arxiv.org/abs/2107.05720
        - SPLADE v2: https://arxiv.org/abs/2109.10086
    """

    DEFAULT_MODEL = "naver/splade-cocondenser-ensembledistil"

    def __init__(
        self,
        model_name: str = DEFAULT_MODEL,
        use_gpu: bool = True,
        max_length: int = 512,
        sparsity_threshold: float = 0.01,
        providers: Optional[List[Any]] = None,
        cache_dir: Optional[str] = None,
    ) -> None:
        """Initialize SPLADE encoder.

        Args:
            model_name: SPLADE model name (default: naver/splade-cocondenser-ensembledistil)
            use_gpu: If True, use GPU acceleration when available
            max_length: Maximum sequence length for tokenization
            sparsity_threshold: Minimum weight to include in sparse vector
            providers: Explicit ONNX providers list (overrides use_gpu)
            cache_dir: Directory to cache ONNX models (default: ~/.cache/codexlens/splade)
        """
        self.model_name = (model_name or self.DEFAULT_MODEL).strip()
        if not self.model_name:
            raise ValueError("model_name cannot be blank")

        self.use_gpu = bool(use_gpu)
        self.max_length = int(max_length) if max_length > 0 else 512
        self.sparsity_threshold = float(sparsity_threshold)
        self.providers = providers

        # Setup ONNX cache directory
        if cache_dir:
            self._cache_dir = Path(cache_dir)
        else:
            self._cache_dir = Path.home() / ".cache" / "codexlens" / "splade"

        self._tokenizer: Any | None = None
        self._model: Any | None = None
        self._vocab_size: int | None = None
        self._lock = threading.RLock()

    def _get_local_cache_path(self) -> Path:
        """Get local cache path for this model's ONNX files.

        Returns:
            Path to the local ONNX cache directory for this model
        """
        # Replace / with -- for filesystem-safe naming
        safe_name = self.model_name.replace("/", "--")
        return self._cache_dir / safe_name

    def _load_model(self) -> None:
        """Lazy load ONNX model and tokenizer.

        First checks local cache for ONNX model, falling back to
        HuggingFace download and conversion if not cached.
        """
        if self._model is not None and self._tokenizer is not None:
            return

        ok, err = check_splade_available()
        if not ok:
            raise ImportError(err)

        with self._lock:
            if self._model is not None and self._tokenizer is not None:
                return

            from inspect import signature

            from optimum.onnxruntime import ORTModelForMaskedLM
            from transformers import AutoTokenizer

            if self.providers is None:
                from .gpu_support import get_optimal_providers

                # Include device_id options for DirectML/CUDA selection when available
                self.providers = get_optimal_providers(
                    use_gpu=self.use_gpu, with_device_options=True
                )

            # Some Optimum versions accept `providers`, others accept a single `provider`
            # Prefer passing the full providers list, with a conservative fallback
            model_kwargs: dict[str, Any] = {}
            try:
                params = signature(ORTModelForMaskedLM.from_pretrained).parameters
                if "providers" in params:
                    model_kwargs["providers"] = self.providers
                elif "provider" in params:
                    provider_name = "CPUExecutionProvider"
                    if self.providers:
                        first = self.providers[0]
                        provider_name = first[0] if isinstance(first, tuple) else str(first)
                    model_kwargs["provider"] = provider_name
            except Exception as e:
                logger.debug(f"Failed to inspect ORTModel signature: {e}")
                model_kwargs = {}

            # Check for local ONNX cache first
            local_cache = self._get_local_cache_path()
            onnx_model_path = local_cache / "model.onnx"

            if onnx_model_path.exists():
                # Load from local cache
                logger.info(f"Loading SPLADE from local cache: {local_cache}")
                try:
                    self._model = ORTModelForMaskedLM.from_pretrained(
                        str(local_cache),
                        **model_kwargs,
                    )
                    self._tokenizer = AutoTokenizer.from_pretrained(
                        str(local_cache), use_fast=True
                    )
                    self._vocab_size = len(self._tokenizer)
                    logger.info(
                        f"SPLADE loaded from cache: {self.model_name}, vocab={self._vocab_size}"
                    )
                    return
                except Exception as e:
                    logger.warning(f"Failed to load from cache, redownloading: {e}")

            # Download and convert from HuggingFace
            logger.info(f"Downloading SPLADE model: {self.model_name}")
            try:
                self._model = ORTModelForMaskedLM.from_pretrained(
                    self.model_name,
                    export=True,  # Export to ONNX
                    **model_kwargs,
                )
                logger.debug(f"SPLADE model loaded: {self.model_name}")
            except TypeError:
                # Fallback for older Optimum versions: retry without provider arguments
                self._model = ORTModelForMaskedLM.from_pretrained(
                    self.model_name,
                    export=True,
                )
                logger.warning(
                    "Optimum version doesn't support provider parameters. "
                    "Upgrade optimum for GPU acceleration: pip install --upgrade optimum"
                )

            self._tokenizer = AutoTokenizer.from_pretrained(self.model_name, use_fast=True)

            # Cache vocabulary size
            self._vocab_size = len(self._tokenizer)
            logger.debug(f"SPLADE tokenizer loaded: vocab_size={self._vocab_size}")

            # Save to local cache for future use
            try:
                local_cache.mkdir(parents=True, exist_ok=True)
                self._model.save_pretrained(str(local_cache))
                self._tokenizer.save_pretrained(str(local_cache))
                logger.info(f"SPLADE model cached to: {local_cache}")
            except Exception as e:
                logger.warning(f"Failed to cache SPLADE model: {e}")

    @staticmethod
    def _splade_activation(logits: Any, attention_mask: Any) -> Any:
        """Apply SPLADE activation function to model outputs.

        Formula: log(1 + ReLU(logits)) * attention_mask

        Args:
            logits: Model output logits (batch, seq_len, vocab_size)
            attention_mask: Attention mask (batch, seq_len)

        Returns:
            SPLADE representations (batch, seq_len, vocab_size)
        """
        import numpy as np

        # ReLU activation
        relu_logits = np.maximum(0, logits)

        # Log(1 + x) transformation
        log_relu = np.log1p(relu_logits)

        # Apply attention mask (expand to match vocab dimension)
        # attention_mask: (batch, seq_len) -> (batch, seq_len, 1)
        mask_expanded = np.expand_dims(attention_mask, axis=-1)

        # Element-wise multiplication
        splade_repr = log_relu * mask_expanded

        return splade_repr

    @staticmethod
    def _max_pooling(splade_repr: Any) -> Any:
        """Max pooling over sequence length dimension.

        Args:
            splade_repr: SPLADE representations (batch, seq_len, vocab_size)

        Returns:
            Pooled sparse vectors (batch, vocab_size)
        """
        import numpy as np

        # Max pooling over sequence dimension (axis=1)
        return np.max(splade_repr, axis=1)

    def _to_sparse_dict(self, dense_vec: Any) -> Dict[int, float]:
        """Convert dense vector to sparse dictionary.

        Args:
            dense_vec: Dense vector (vocab_size,)

        Returns:
            Sparse dictionary {token_id: weight} with weights above threshold
        """
        import numpy as np

        # Find non-zero indices above threshold
        nonzero_indices = np.where(dense_vec > self.sparsity_threshold)[0]

        # Create sparse dictionary
        sparse_dict = {
            int(idx): float(dense_vec[idx])
            for idx in nonzero_indices
        }

        return sparse_dict

    def encode_text(self, text: str) -> Dict[int, float]:
        """Encode text to sparse vector {token_id: weight}.

        Args:
            text: Input text to encode

        Returns:
            Sparse vector as dictionary mapping token_id to weight
        """
        self._load_model()

        if self._model is None or self._tokenizer is None:
            raise RuntimeError("Model not loaded")

        import numpy as np

        # Tokenize input
        encoded = self._tokenizer(
            text,
            padding=True,
            truncation=True,
            max_length=self.max_length,
            return_tensors="np",
        )

        # Forward pass through model
        outputs = self._model(**encoded)

        # Extract logits
        if hasattr(outputs, "logits"):
            logits = outputs.logits
        elif isinstance(outputs, dict) and "logits" in outputs:
            logits = outputs["logits"]
        elif isinstance(outputs, (list, tuple)) and outputs:
            logits = outputs[0]
        else:
            raise RuntimeError("Unexpected model output format")

        # Apply SPLADE activation
        attention_mask = encoded["attention_mask"]
        splade_repr = self._splade_activation(logits, attention_mask)

        # Max pooling over sequence length
        splade_vec = self._max_pooling(splade_repr)

        # Convert to sparse dictionary (single item batch)
        sparse_dict = self._to_sparse_dict(splade_vec[0])

        return sparse_dict

    def encode_batch(self, texts: List[str], batch_size: int = 32) -> List[Dict[int, float]]:
        """Batch encode texts to sparse vectors.

        Args:
            texts: List of input texts to encode
            batch_size: Batch size for encoding (default: 32)

        Returns:
            List of sparse vectors as dictionaries
        """
        if not texts:
            return []

        self._load_model()

        if self._model is None or self._tokenizer is None:
            raise RuntimeError("Model not loaded")

        import numpy as np

        results: List[Dict[int, float]] = []

        # Process in batches
        for i in range(0, len(texts), batch_size):
            batch_texts = texts[i:i + batch_size]

            # Tokenize batch
            encoded = self._tokenizer(
                batch_texts,
                padding=True,
                truncation=True,
                max_length=self.max_length,
                return_tensors="np",
            )

            # Forward pass through model
            outputs = self._model(**encoded)

            # Extract logits
            if hasattr(outputs, "logits"):
                logits = outputs.logits
            elif isinstance(outputs, dict) and "logits" in outputs:
                logits = outputs["logits"]
            elif isinstance(outputs, (list, tuple)) and outputs:
                logits = outputs[0]
            else:
                raise RuntimeError("Unexpected model output format")

            # Apply SPLADE activation
            attention_mask = encoded["attention_mask"]
            splade_repr = self._splade_activation(logits, attention_mask)

            # Max pooling over sequence length
            splade_vecs = self._max_pooling(splade_repr)

            # Convert each vector to sparse dictionary
            for vec in splade_vecs:
                sparse_dict = self._to_sparse_dict(vec)
                results.append(sparse_dict)

        return results

    @property
    def vocab_size(self) -> int:
        """Return vocabulary size (~30k for BERT-based models).

        Returns:
            Vocabulary size (number of tokens in tokenizer)
        """
        if self._vocab_size is not None:
            return self._vocab_size

        self._load_model()
        return self._vocab_size or 0

    def get_token(self, token_id: int) -> str:
        """Convert token_id to string (for debugging).

        Args:
            token_id: Token ID to convert

        Returns:
            Token string
        """
        self._load_model()

        if self._tokenizer is None:
            raise RuntimeError("Tokenizer not loaded")

        return self._tokenizer.decode([token_id])

    def get_top_tokens(self, sparse_vec: Dict[int, float], top_k: int = 10) -> List[Tuple[str, float]]:
        """Get top-k tokens with highest weights from sparse vector.

        Useful for debugging and understanding what the model is focusing on.

        Args:
            sparse_vec: Sparse vector as {token_id: weight}
            top_k: Number of top tokens to return

        Returns:
            List of (token_string, weight) tuples, sorted by weight descending
        """
        self._load_model()

        if not sparse_vec:
            return []

        # Sort by weight descending
        sorted_items = sorted(sparse_vec.items(), key=lambda x: x[1], reverse=True)

        # Take top-k and convert token_ids to strings
        top_items = sorted_items[:top_k]

        return [
            (self.get_token(token_id), weight)
            for token_id, weight in top_items
        ]
