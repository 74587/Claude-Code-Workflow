"""Base class for embedders.

Defines the interface that all embedders must implement.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Iterable

import numpy as np


class BaseEmbedder(ABC):
    """Base class for all embedders.

    All embedder implementations must inherit from this class and implement
    the abstract methods to ensure a consistent interface.
    """

    @property
    @abstractmethod
    def embedding_dim(self) -> int:
        """Return embedding dimensions.

        Returns:
            int: Dimension of the embedding vectors.
        """
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Return model name.

        Returns:
            str: Name or identifier of the underlying model.
        """
        ...

    @abstractmethod
    def embed_to_numpy(self, texts: str | Iterable[str]) -> np.ndarray:
        """Embed texts to numpy array.

        Args:
            texts: Single text or iterable of texts to embed.

        Returns:
            numpy.ndarray: Array of shape (n_texts, embedding_dim) containing embeddings.
        """
        ...
