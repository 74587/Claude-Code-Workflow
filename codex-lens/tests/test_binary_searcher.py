"""Unit tests for BinarySearcher - binary vector search using Hamming distance.

Tests cover:
- load: mmap file loading, DB fallback, no data scenario
- search: basic search, top_k limit, empty index
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch, mock_open

import numpy as np
import pytest

from codexlens.search.binary_searcher import BinarySearcher


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def temp_paths():
    """Create temporary directory structure."""
    tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    root = Path(tmpdir.name)
    yield root
    try:
        tmpdir.cleanup()
    except (PermissionError, OSError):
        pass


@pytest.fixture
def binary_mmap_setup(temp_paths):
    """Create a mock memory-mapped binary vectors file with metadata."""
    num_vectors = 10
    dim_bytes = 32  # 256 bits = 32 bytes

    # Create binary matrix
    rng = np.random.default_rng(42)
    binary_matrix = rng.integers(0, 256, size=(num_vectors, dim_bytes), dtype=np.uint8)
    chunk_ids = list(range(100, 100 + num_vectors))

    # Write mmap file
    mmap_path = temp_paths / "_binary_vectors.mmap"
    binary_matrix.tofile(str(mmap_path))

    # Write metadata
    meta_path = mmap_path.with_suffix(".meta.json")
    meta = {
        "shape": [num_vectors, dim_bytes],
        "chunk_ids": chunk_ids,
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f)

    return temp_paths, binary_matrix, chunk_ids


# =============================================================================
# Tests: load
# =============================================================================


class TestBinarySearcherLoad:
    """Tests for BinarySearcher.load()."""

    def test_load_mmap(self, binary_mmap_setup):
        """Memory-mapped file loading should succeed and mark is_memmap."""
        index_root, binary_matrix, chunk_ids = binary_mmap_setup
        searcher = BinarySearcher(index_root)

        result = searcher.load()

        assert result is True
        assert searcher._loaded is True
        assert searcher.is_memmap is True
        assert searcher.vector_count == len(chunk_ids)

    def test_load_db_fallback(self, temp_paths):
        """Should fall back to DB loading when no mmap file exists."""
        searcher = BinarySearcher(temp_paths)

        # Mock the DB fallback
        with patch.object(searcher, "_load_from_db", return_value=True) as mock_db:
            result = searcher.load()

        assert result is True
        mock_db.assert_called_once()

    def test_load_no_data(self, temp_paths):
        """Should return False when neither mmap nor DB data available."""
        searcher = BinarySearcher(temp_paths)

        with patch.object(searcher, "_load_from_db", return_value=False):
            result = searcher.load()

        assert result is False
        assert searcher._loaded is False


# =============================================================================
# Tests: search
# =============================================================================


class TestBinarySearcherSearch:
    """Tests for BinarySearcher.search()."""

    def test_search_basic(self, binary_mmap_setup):
        """Basic search should return (chunk_id, distance) tuples."""
        index_root, binary_matrix, chunk_ids = binary_mmap_setup
        searcher = BinarySearcher(index_root)
        searcher.load()

        # Create a query vector (256 dimensions, will be binarized)
        rng = np.random.default_rng(99)
        query_vector = rng.standard_normal(256).astype(np.float32)

        results = searcher.search(query_vector, top_k=5)

        assert len(results) == 5
        # Results should be (chunk_id, hamming_distance) tuples
        for chunk_id, distance in results:
            assert isinstance(chunk_id, int)
            assert isinstance(distance, int)
            assert chunk_id in chunk_ids

    def test_search_top_k(self, binary_mmap_setup):
        """Search should respect top_k limit."""
        index_root, binary_matrix, chunk_ids = binary_mmap_setup
        searcher = BinarySearcher(index_root)
        searcher.load()

        query_vector = np.random.default_rng(42).standard_normal(256).astype(np.float32)

        results_3 = searcher.search(query_vector, top_k=3)
        results_7 = searcher.search(query_vector, top_k=7)

        assert len(results_3) == 3
        assert len(results_7) == 7
        # Results should be sorted by distance (ascending)
        distances_3 = [d for _, d in results_3]
        assert distances_3 == sorted(distances_3)

    def test_search_empty_index(self, temp_paths):
        """Search on empty/unloaded index should return empty list."""
        searcher = BinarySearcher(temp_paths)
        # Do not load - index is empty

        query_vector = np.zeros(256, dtype=np.float32)

        with patch.object(searcher, "load", return_value=False):
            results = searcher.search(query_vector, top_k=5)

        assert results == []
