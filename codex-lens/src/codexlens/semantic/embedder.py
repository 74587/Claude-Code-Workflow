"""Embedder for semantic code search using fastembed."""

from __future__ import annotations

from typing import Iterable, List

from . import SEMANTIC_AVAILABLE


class Embedder:
    """Generate embeddings for code chunks using fastembed (ONNX-based).

    Supported Model Profiles:
    - fast: BAAI/bge-small-en-v1.5 (384 dim) - Fast, lightweight, English-optimized
    - code: jinaai/jina-embeddings-v2-base-code (768 dim) - Code-optimized, best for programming languages
    - multilingual: intfloat/multilingual-e5-large (1024 dim) - Multilingual + code support
    - balanced: mixedbread-ai/mxbai-embed-large-v1 (1024 dim) - High accuracy, general purpose
    """

    # Model profiles for different use cases
    MODELS = {
        "fast": "BAAI/bge-small-en-v1.5",           # 384 dim - Fast, lightweight
        "code": "jinaai/jina-embeddings-v2-base-code",  # 768 dim - Code-optimized
        "multilingual": "intfloat/multilingual-e5-large",  # 1024 dim - Multilingual
        "balanced": "mixedbread-ai/mxbai-embed-large-v1",  # 1024 dim - High accuracy
    }

    # Dimension mapping for each model
    MODEL_DIMS = {
        "BAAI/bge-small-en-v1.5": 384,
        "jinaai/jina-embeddings-v2-base-code": 768,
        "intfloat/multilingual-e5-large": 1024,
        "mixedbread-ai/mxbai-embed-large-v1": 1024,
    }

    # Default model (fast profile)
    DEFAULT_MODEL = "BAAI/bge-small-en-v1.5"
    DEFAULT_PROFILE = "fast"

    def __init__(self, model_name: str | None = None, profile: str | None = None) -> None:
        """Initialize embedder with model or profile.

        Args:
            model_name: Explicit model name (e.g., "jinaai/jina-embeddings-v2-base-code")
            profile: Model profile shortcut ("fast", "code", "multilingual", "balanced")
                    If both provided, model_name takes precedence.
        """
        if not SEMANTIC_AVAILABLE:
            raise ImportError(
                "Semantic search dependencies not available. "
                "Install with: pip install codexlens[semantic]"
            )

        # Resolve model name from profile or use explicit name
        if model_name:
            self.model_name = model_name
        elif profile and profile in self.MODELS:
            self.model_name = self.MODELS[profile]
        else:
            self.model_name = self.DEFAULT_MODEL

        self._model = None

    @property
    def embedding_dim(self) -> int:
        """Get embedding dimension for current model."""
        return self.MODEL_DIMS.get(self.model_name, 768)  # Default to 768 if unknown

    def _load_model(self) -> None:
        """Lazy load the embedding model."""
        if self._model is not None:
            return

        from fastembed import TextEmbedding
        self._model = TextEmbedding(model_name=self.model_name)

    def embed(self, texts: str | Iterable[str]) -> List[List[float]]:
        """Generate embeddings for one or more texts.

        Args:
            texts: Single text or iterable of texts to embed.

        Returns:
            List of embedding vectors (each is a list of floats).
        """
        self._load_model()

        if isinstance(texts, str):
            texts = [texts]
        else:
            texts = list(texts)

        embeddings = list(self._model.embed(texts))
        return [emb.tolist() for emb in embeddings]

    def embed_single(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        return self.embed(text)[0]
