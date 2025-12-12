"""Embedder for semantic code search."""

from __future__ import annotations

from typing import Iterable, List

from . import SEMANTIC_AVAILABLE, SEMANTIC_BACKEND

if SEMANTIC_AVAILABLE:
    import numpy as np


class Embedder:
    """Generate embeddings for code chunks using fastembed or sentence-transformers."""

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
        self._backend = SEMANTIC_BACKEND

    def _load_model(self) -> None:
        """Lazy load the embedding model."""
        if self._model is not None:
            return

        if self._backend == "fastembed":
            from fastembed import TextEmbedding
            self._model = TextEmbedding(model_name=self.model_name)
        else:
            from sentence_transformers import SentenceTransformer
            self._model = SentenceTransformer(self.model_name)

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

        if self._backend == "fastembed":
            embeddings = list(self._model.embed(texts))
            return [emb.tolist() for emb in embeddings]
        else:
            embeddings = self._model.encode(texts)
            return embeddings.tolist()

    def embed_single(self, text: str) -> List[float]:
        """Generate embedding for a single text."""
        return self.embed(text)[0]
