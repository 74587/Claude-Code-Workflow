"""Embedder for semantic code search using fastembed."""

from __future__ import annotations

from typing import Iterable, List

from . import SEMANTIC_AVAILABLE


class Embedder:
    """Generate embeddings for code chunks using fastembed (ONNX-based)."""

    MODEL_NAME = "BAAI/bge-small-en-v1.5"
    EMBEDDING_DIM = 384

    def __init__(self, model_name: str | None = None) -> None:
        if not SEMANTIC_AVAILABLE:
            raise ImportError(
                "Semantic search dependencies not available. "
                "Install with: pip install codexlens[semantic]"
            )

        self.model_name = model_name or self.MODEL_NAME
        self._model = None

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
