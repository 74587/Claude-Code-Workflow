from __future__ import annotations

import asyncio
from abc import ABC, abstractmethod
from typing import Any, Sequence

import numpy as np
from numpy.typing import NDArray


class AbstractEmbedder(ABC):
    """Embedding interface compatible with fastembed-style embedders.

    Implementers only need to provide the synchronous `embed` method; an
    asynchronous `aembed` wrapper is provided for convenience.
    """

    @property
    @abstractmethod
    def dimensions(self) -> int:
        """Embedding vector size."""

    @abstractmethod
    def embed(
        self,
        texts: str | Sequence[str],
        *,
        batch_size: int | None = None,
        **kwargs: Any,
    ) -> NDArray[np.floating]:
        """Embed one or more texts.

        Returns:
            A numpy array of shape (n_texts, dimensions).
        """

    async def aembed(
        self,
        texts: str | Sequence[str],
        *,
        batch_size: int | None = None,
        **kwargs: Any,
    ) -> NDArray[np.floating]:
        """Async wrapper around `embed` using a worker thread by default."""

        return await asyncio.to_thread(
            self.embed,
            texts,
            batch_size=batch_size,
            **kwargs,
        )

