from __future__ import annotations

import sys
import types
import unittest
from unittest.mock import MagicMock, patch

import numpy as np


def _make_fastembed_mock():
    """Build a minimal fastembed stub so imports succeed without the real package."""
    fastembed_mod = types.ModuleType("fastembed")
    fastembed_mod.TextEmbedding = MagicMock()
    sys.modules.setdefault("fastembed", fastembed_mod)
    return fastembed_mod


_make_fastembed_mock()

from codexlens.config import Config  # noqa: E402
from codexlens.embed.base import BaseEmbedder  # noqa: E402
from codexlens.embed.local import EMBED_PROFILES, FastEmbedEmbedder  # noqa: E402


class TestEmbedSingle(unittest.TestCase):
    def test_embed_single_returns_float32_ndarray(self):
        config = Config()
        embedder = FastEmbedEmbedder(config)

        mock_model = MagicMock()
        mock_model.embed.return_value = iter([np.ones(384, dtype=np.float64)])

        # Inject mock model directly to bypass lazy load (no real fastembed needed)
        embedder._model = mock_model
        result = embedder.embed_single("hello world")

        self.assertIsInstance(result, np.ndarray)
        self.assertEqual(result.dtype, np.float32)
        self.assertEqual(result.shape, (384,))


class TestEmbedBatch(unittest.TestCase):
    def test_embed_batch_returns_list(self):
        config = Config()
        embedder = FastEmbedEmbedder(config)

        vecs = [np.ones(384, dtype=np.float64) * i for i in range(3)]
        mock_model = MagicMock()
        mock_model.embed.return_value = iter(vecs)

        embedder._model = mock_model
        result = embedder.embed_batch(["a", "b", "c"])

        self.assertIsInstance(result, list)
        self.assertEqual(len(result), 3)
        for arr in result:
            self.assertIsInstance(arr, np.ndarray)
            self.assertEqual(arr.dtype, np.float32)


class TestEmbedProfiles(unittest.TestCase):
    def test_embed_profiles_all_have_valid_keys(self):
        expected_keys = {"small", "base", "large", "code"}
        self.assertEqual(set(EMBED_PROFILES.keys()), expected_keys)

    def test_embed_profiles_model_ids_non_empty(self):
        for key, model_id in EMBED_PROFILES.items():
            self.assertIsInstance(model_id, str, msg=f"{key} model id should be str")
            self.assertTrue(len(model_id) > 0, msg=f"{key} model id should be non-empty")


class TestBaseEmbedderAbstract(unittest.TestCase):
    def test_base_embedder_is_abstract(self):
        with self.assertRaises(TypeError):
            BaseEmbedder()  # type: ignore[abstract]


if __name__ == "__main__":
    unittest.main()
