"""Tests for ANN (Approximate Nearest Neighbor) index using HNSW."""

import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

# Skip all tests if semantic dependencies not available
pytest.importorskip("numpy")


def _hnswlib_available() -> bool:
    """Check if hnswlib is available."""
    try:
        import hnswlib
        return True
    except ImportError:
        return False


class TestANNIndex:
    """Test suite for ANNIndex class."""

    @pytest.fixture
    def temp_db(self):
        """Create a temporary database file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir) / "_index.db"

    @pytest.fixture
    def sample_vectors(self):
        """Generate sample vectors for testing."""
        import numpy as np
        np.random.seed(42)
        # 100 vectors of dimension 384 (matches fast model)
        return np.random.randn(100, 384).astype(np.float32)

    @pytest.fixture
    def sample_ids(self):
        """Generate sample IDs."""
        return list(range(1, 101))

    def test_import_check(self):
        """Test that HNSWLIB_AVAILABLE flag is set correctly."""
        try:
            from codexlens.semantic.ann_index import HNSWLIB_AVAILABLE
            # Should be True if hnswlib is installed, False otherwise
            assert isinstance(HNSWLIB_AVAILABLE, bool)
        except ImportError:
            pytest.skip("ann_index module not available")

    @pytest.mark.skipif(
        not _hnswlib_available(),
        reason="hnswlib not installed"
    )
    def test_create_index(self, temp_db):
        """Test creating a new ANN index."""
        from codexlens.semantic.ann_index import ANNIndex

        index = ANNIndex(temp_db, dim=384)
        assert index.dim == 384
        assert index.count() == 0
        assert not index.is_loaded

    @pytest.mark.skipif(
        not _hnswlib_available(),
        reason="hnswlib not installed"
    )
    def test_add_vectors(self, temp_db, sample_vectors, sample_ids):
        """Test adding vectors to the index."""
        from codexlens.semantic.ann_index import ANNIndex

        index = ANNIndex(temp_db, dim=384)
        index.add_vectors(sample_ids, sample_vectors)

        assert index.count() == 100
        assert index.is_loaded

    @pytest.mark.skipif(
        not _hnswlib_available(),
        reason="hnswlib not installed"
    )
    def test_search(self, temp_db, sample_vectors, sample_ids):
        """Test searching for similar vectors."""
        from codexlens.semantic.ann_index import ANNIndex

        index = ANNIndex(temp_db, dim=384)
        index.add_vectors(sample_ids, sample_vectors)

        # Search for the first vector - should find itself
        query = sample_vectors[0]
        ids, distances = index.search(query, top_k=5)

        assert len(ids) == 5
        assert len(distances) == 5
        # First result should be the query vector itself (or very close)
        assert ids[0] == 1  # ID of first vector
        assert distances[0] < 0.01  # Very small distance (almost identical)

    @pytest.mark.skipif(
        not _hnswlib_available(),
        reason="hnswlib not installed"
    )
    def test_save_and_load(self, temp_db, sample_vectors, sample_ids):
        """Test saving and loading index from disk."""
        from codexlens.semantic.ann_index import ANNIndex

        # Create and save index
        index1 = ANNIndex(temp_db, dim=384)
        index1.add_vectors(sample_ids, sample_vectors)
        index1.save()

        # Check that file was created (new naming: {db_stem}_vectors.hnsw)
        hnsw_path = temp_db.parent / f"{temp_db.stem}_vectors.hnsw"
        assert hnsw_path.exists()

        # Load in new instance
        index2 = ANNIndex(temp_db, dim=384)
        loaded = index2.load()

        assert loaded is True
        assert index2.count() == 100
        assert index2.is_loaded

        # Verify search still works
        query = sample_vectors[0]
        ids, distances = index2.search(query, top_k=5)
        assert ids[0] == 1

    @pytest.mark.skipif(
        not _hnswlib_available(),
        reason="hnswlib not installed"
    )
    def test_load_nonexistent(self, temp_db):
        """Test loading when index file doesn't exist."""
        from codexlens.semantic.ann_index import ANNIndex

        index = ANNIndex(temp_db, dim=384)
        loaded = index.load()

        assert loaded is False
        assert not index.is_loaded

    @pytest.mark.skipif(
        not _hnswlib_available(),
        reason="hnswlib not installed"
    )
    def test_remove_vectors(self, temp_db, sample_vectors, sample_ids):
        """Test removing vectors from the index."""
        from codexlens.semantic.ann_index import ANNIndex

        index = ANNIndex(temp_db, dim=384)
        index.add_vectors(sample_ids, sample_vectors)

        # Remove first 10 vectors
        index.remove_vectors(list(range(1, 11)))

        # Search for removed vector - should not be in results
        query = sample_vectors[0]
        ids, distances = index.search(query, top_k=5)

        # ID 1 should not be in results (soft deleted)
        assert 1 not in ids

    @pytest.mark.skipif(
        not _hnswlib_available(),
        reason="hnswlib not installed"
    )
    def test_incremental_add(self, temp_db):
        """Test adding vectors incrementally."""
        import numpy as np
        from codexlens.semantic.ann_index import ANNIndex

        index = ANNIndex(temp_db, dim=384)

        # Add first batch
        vectors1 = np.random.randn(50, 384).astype(np.float32)
        index.add_vectors(list(range(1, 51)), vectors1)
        assert index.count() == 50

        # Add second batch
        vectors2 = np.random.randn(50, 384).astype(np.float32)
        index.add_vectors(list(range(51, 101)), vectors2)
        assert index.count() == 100

    @pytest.mark.skipif(
        not _hnswlib_available(),
        reason="hnswlib not installed"
    )
    def test_search_empty_index(self, temp_db):
        """Test searching an empty index."""
        import numpy as np
        from codexlens.semantic.ann_index import ANNIndex

        index = ANNIndex(temp_db, dim=384)
        query = np.random.randn(384).astype(np.float32)

        ids, distances = index.search(query, top_k=5)

        assert ids == []
        assert distances == []

    @pytest.mark.skipif(
        not _hnswlib_available(),
        reason="hnswlib not installed"
    )
    def test_invalid_dimension(self, temp_db, sample_vectors, sample_ids):
        """Test adding vectors with wrong dimension."""
        import numpy as np
        from codexlens.semantic.ann_index import ANNIndex

        index = ANNIndex(temp_db, dim=384)

        # Try to add vectors with wrong dimension
        wrong_vectors = np.random.randn(10, 768).astype(np.float32)
        with pytest.raises(ValueError, match="dimension"):
            index.add_vectors(list(range(1, 11)), wrong_vectors)

    @pytest.mark.skipif(
        not _hnswlib_available(),
        reason="hnswlib not installed"
    )
    def test_auto_resize(self, temp_db):
        """Test that index automatically resizes when capacity is exceeded."""
        import numpy as np
        from codexlens.semantic.ann_index import ANNIndex

        index = ANNIndex(temp_db, dim=384)
        # Override initial capacity to test resize
        index._max_elements = 100

        # Add more vectors than initial capacity
        vectors = np.random.randn(150, 384).astype(np.float32)
        index.add_vectors(list(range(1, 151)), vectors)

        assert index.count() == 150
        assert index._max_elements >= 150


class TestVectorStoreWithANN:
    """Test VectorStore integration with ANN index."""

    @pytest.fixture
    def temp_db(self):
        """Create a temporary database file."""
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
            yield Path(tmpdir) / "_index.db"

    @pytest.fixture
    def sample_chunks(self):
        """Create sample semantic chunks with embeddings."""
        import numpy as np
        from codexlens.entities import SemanticChunk

        np.random.seed(42)
        chunks = []
        for i in range(10):
            chunk = SemanticChunk(
                content=f"def function_{i}(): pass",
                metadata={"symbol_name": f"function_{i}", "symbol_kind": "function"},
            )
            chunk.embedding = np.random.randn(384).astype(np.float32).tolist()
            chunks.append(chunk)
        return chunks

    def test_vector_store_with_ann(self, temp_db, sample_chunks):
        """Test VectorStore using ANN index for search."""
        from codexlens.semantic.vector_store import VectorStore, HNSWLIB_AVAILABLE

        store = VectorStore(temp_db)

        # Add chunks
        ids = store.add_chunks(sample_chunks, "test.py")
        assert len(ids) == 10

        # Check ANN status
        if HNSWLIB_AVAILABLE:
            assert store.ann_available or store.ann_count >= 0

        # Search
        query_embedding = sample_chunks[0].embedding
        results = store.search_similar(query_embedding, top_k=5)

        assert len(results) <= 5
        if results:
            # First result should have high similarity
            assert results[0].score > 0.9

    def test_vector_store_rebuild_ann(self, temp_db, sample_chunks):
        """Test rebuilding ANN index from SQLite data."""
        from codexlens.semantic.vector_store import VectorStore, HNSWLIB_AVAILABLE

        if not HNSWLIB_AVAILABLE:
            pytest.skip("hnswlib not installed")

        store = VectorStore(temp_db)

        # Add chunks
        store.add_chunks(sample_chunks, "test.py")

        # Rebuild ANN index
        count = store.rebuild_ann_index()
        assert count == 10

        # Verify search works
        query_embedding = sample_chunks[0].embedding
        results = store.search_similar(query_embedding, top_k=5)
        assert len(results) > 0

    def test_vector_store_delete_updates_ann(self, temp_db, sample_chunks):
        """Test that deleting chunks updates ANN index."""
        from codexlens.semantic.vector_store import VectorStore, HNSWLIB_AVAILABLE

        if not HNSWLIB_AVAILABLE:
            pytest.skip("hnswlib not installed")

        store = VectorStore(temp_db)

        # Add chunks for two files
        store.add_chunks(sample_chunks[:5], "file1.py")
        store.add_chunks(sample_chunks[5:], "file2.py")

        initial_count = store.count_chunks()
        assert initial_count == 10

        # Delete one file's chunks
        deleted = store.delete_file_chunks("file1.py")
        assert deleted == 5

        # Verify count
        assert store.count_chunks() == 5

    def test_vector_store_batch_add(self, temp_db, sample_chunks):
        """Test batch adding chunks from multiple files."""
        from codexlens.semantic.vector_store import VectorStore

        store = VectorStore(temp_db)

        # Prepare chunks with paths
        chunks_with_paths = [
            (chunk, f"file{i % 3}.py")
            for i, chunk in enumerate(sample_chunks)
        ]

        # Batch add
        ids = store.add_chunks_batch(chunks_with_paths)
        assert len(ids) == 10

        # Verify
        assert store.count_chunks() == 10

    def test_vector_store_fallback_search(self, temp_db, sample_chunks):
        """Test that search falls back to brute-force when ANN unavailable."""
        from codexlens.semantic.vector_store import VectorStore

        store = VectorStore(temp_db)
        store.add_chunks(sample_chunks, "test.py")

        # Force disable ANN
        store._ann_index = None

        # Search should still work (brute-force fallback)
        query_embedding = sample_chunks[0].embedding
        results = store.search_similar(query_embedding, top_k=5)

        assert len(results) > 0
        assert results[0].score > 0.9


class TestSearchAccuracy:
    """Test search accuracy comparing ANN vs brute-force."""

    @pytest.fixture
    def temp_db(self):
        """Create a temporary database file."""
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
            yield Path(tmpdir) / "_index.db"

    @pytest.mark.skipif(
        not _hnswlib_available(),
        reason="hnswlib not installed"
    )
    def test_ann_vs_brute_force_recall(self, temp_db):
        """Test that ANN search has high recall compared to brute-force."""
        import numpy as np
        from codexlens.entities import SemanticChunk
        from codexlens.semantic.vector_store import VectorStore

        np.random.seed(42)

        # Create larger dataset
        chunks = []
        for i in range(100):
            chunk = SemanticChunk(
                content=f"code block {i}",
                metadata={"chunk_id": i},
            )
            chunk.embedding = np.random.randn(384).astype(np.float32).tolist()
            chunks.append(chunk)

        store = VectorStore(temp_db)
        store.add_chunks(chunks, "test.py")

        # Get brute-force results
        store._ann_index = None  # Force brute-force
        store._invalidate_cache()  # Clear cache to force refresh
        query = chunks[0].embedding
        bf_results = store.search_similar(query, top_k=10)
        # Use chunk_id from metadata for comparison (more reliable than path+score)
        bf_chunk_ids = {r.metadata.get("chunk_id") for r in bf_results}

        # Rebuild ANN and get ANN results
        store.rebuild_ann_index()
        ann_results = store.search_similar(query, top_k=10)
        ann_chunk_ids = {r.metadata.get("chunk_id") for r in ann_results}

        # Calculate recall (how many brute-force results are in ANN results)
        # ANN should find at least 80% of the same results
        overlap = len(bf_chunk_ids & ann_chunk_ids)
        recall = overlap / len(bf_chunk_ids) if bf_chunk_ids else 1.0

        assert recall >= 0.8, f"ANN recall too low: {recall} (overlap: {overlap}, bf: {bf_chunk_ids}, ann: {ann_chunk_ids})"



class TestBinaryANNIndex:
    """Test suite for BinaryANNIndex class (Hamming distance-based search)."""

    @pytest.fixture
    def temp_db(self):
        """Create a temporary database file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir) / "_index.db"

    @pytest.fixture
    def sample_binary_vectors(self):
        """Generate sample binary vectors for testing."""
        import numpy as np
        np.random.seed(42)
        # 100 binary vectors of dimension 256 (packed as 32 bytes each)
        binary_unpacked = (np.random.rand(100, 256) > 0.5).astype(np.uint8)
        packed = [np.packbits(v).tobytes() for v in binary_unpacked]
        return packed, binary_unpacked

    @pytest.fixture
    def sample_ids(self):
        """Generate sample IDs."""
        return list(range(1, 101))

    def test_create_binary_index(self, temp_db):
        """Test creating a new Binary ANN index."""
        from codexlens.semantic.ann_index import BinaryANNIndex

        index = BinaryANNIndex(temp_db, dim=256)
        assert index.dim == 256
        assert index.packed_dim == 32
        assert index.count() == 0
        assert not index.is_loaded

    def test_invalid_dimension(self, temp_db):
        """Test that invalid dimensions are rejected."""
        from codexlens.semantic.ann_index import BinaryANNIndex

        # Dimension must be divisible by 8
        with pytest.raises(ValueError, match="divisible by 8"):
            BinaryANNIndex(temp_db, dim=255)

        with pytest.raises(ValueError, match="positive"):
            BinaryANNIndex(temp_db, dim=0)

    def test_add_packed_vectors(self, temp_db, sample_binary_vectors, sample_ids):
        """Test adding packed binary vectors to the index."""
        from codexlens.semantic.ann_index import BinaryANNIndex

        packed, _ = sample_binary_vectors
        index = BinaryANNIndex(temp_db, dim=256)
        index.add_vectors(sample_ids, packed)

        assert index.count() == 100
        assert index.is_loaded

    def test_add_numpy_vectors(self, temp_db, sample_binary_vectors, sample_ids):
        """Test adding unpacked numpy binary vectors."""
        from codexlens.semantic.ann_index import BinaryANNIndex
        import numpy as np

        _, unpacked = sample_binary_vectors
        index = BinaryANNIndex(temp_db, dim=256)
        index.add_vectors_numpy(sample_ids, unpacked)

        assert index.count() == 100

    def test_search_packed(self, temp_db, sample_binary_vectors, sample_ids):
        """Test searching with packed binary query."""
        from codexlens.semantic.ann_index import BinaryANNIndex

        packed, _ = sample_binary_vectors
        index = BinaryANNIndex(temp_db, dim=256)
        index.add_vectors(sample_ids, packed)

        # Search for the first vector - should find itself with distance 0
        query = packed[0]
        ids, distances = index.search(query, top_k=5)

        assert len(ids) == 5
        assert len(distances) == 5
        # First result should be the query vector itself
        assert ids[0] == 1
        assert distances[0] == 0  # Hamming distance of 0 (identical)

    def test_search_numpy(self, temp_db, sample_binary_vectors, sample_ids):
        """Test searching with unpacked numpy query."""
        from codexlens.semantic.ann_index import BinaryANNIndex

        packed, unpacked = sample_binary_vectors
        index = BinaryANNIndex(temp_db, dim=256)
        index.add_vectors(sample_ids, packed)

        # Search for the first vector using numpy interface
        query = unpacked[0]
        ids, distances = index.search_numpy(query, top_k=5)

        assert len(ids) == 5
        assert ids[0] == 1
        assert distances[0] == 0

    def test_search_batch(self, temp_db, sample_binary_vectors, sample_ids):
        """Test batch search with multiple queries."""
        from codexlens.semantic.ann_index import BinaryANNIndex

        packed, _ = sample_binary_vectors
        index = BinaryANNIndex(temp_db, dim=256)
        index.add_vectors(sample_ids, packed)

        # Search for first 3 vectors
        queries = packed[:3]
        results = index.search_batch(queries, top_k=5)

        assert len(results) == 3
        # Each result should find itself first
        for i, (ids, dists) in enumerate(results):
            assert ids[0] == i + 1
            assert dists[0] == 0

    def test_hamming_distance_ordering(self, temp_db):
        """Test that results are ordered by Hamming distance."""
        from codexlens.semantic.ann_index import BinaryANNIndex
        import numpy as np

        index = BinaryANNIndex(temp_db, dim=256)

        # Create vectors with known Hamming distances from a query
        query = np.zeros(256, dtype=np.uint8)  # All zeros
        v1 = np.zeros(256, dtype=np.uint8)  # Distance 0
        v2 = np.zeros(256, dtype=np.uint8); v2[:10] = 1  # Distance 10
        v3 = np.zeros(256, dtype=np.uint8); v3[:50] = 1  # Distance 50
        v4 = np.ones(256, dtype=np.uint8)  # Distance 256

        index.add_vectors_numpy([1, 2, 3, 4], np.array([v1, v2, v3, v4]))

        query_packed = np.packbits(query).tobytes()
        ids, distances = index.search(query_packed, top_k=4)

        assert ids == [1, 2, 3, 4]
        assert distances == [0, 10, 50, 256]

    def test_save_and_load(self, temp_db, sample_binary_vectors, sample_ids):
        """Test saving and loading binary index from disk."""
        from codexlens.semantic.ann_index import BinaryANNIndex

        packed, _ = sample_binary_vectors

        # Create and save index
        index1 = BinaryANNIndex(temp_db, dim=256)
        index1.add_vectors(sample_ids, packed)
        index1.save()

        # Check that file was created
        binary_path = temp_db.parent / f"{temp_db.stem}_binary_vectors.bin"
        assert binary_path.exists()

        # Load in new instance
        index2 = BinaryANNIndex(temp_db, dim=256)
        loaded = index2.load()

        assert loaded is True
        assert index2.count() == 100
        assert index2.is_loaded

        # Verify search still works
        query = packed[0]
        ids, distances = index2.search(query, top_k=5)
        assert ids[0] == 1
        assert distances[0] == 0

    def test_load_nonexistent(self, temp_db):
        """Test loading when index file doesn't exist."""
        from codexlens.semantic.ann_index import BinaryANNIndex

        index = BinaryANNIndex(temp_db, dim=256)
        loaded = index.load()

        assert loaded is False
        assert not index.is_loaded

    def test_remove_vectors(self, temp_db, sample_binary_vectors, sample_ids):
        """Test removing vectors from the index."""
        from codexlens.semantic.ann_index import BinaryANNIndex

        packed, _ = sample_binary_vectors
        index = BinaryANNIndex(temp_db, dim=256)
        index.add_vectors(sample_ids, packed)

        # Remove first 10 vectors
        index.remove_vectors(list(range(1, 11)))

        assert index.count() == 90

        # Removed vectors should not be findable
        query = packed[0]
        ids, _ = index.search(query, top_k=100)
        for removed_id in range(1, 11):
            assert removed_id not in ids

    def test_get_vector(self, temp_db, sample_binary_vectors, sample_ids):
        """Test retrieving a specific vector by ID."""
        from codexlens.semantic.ann_index import BinaryANNIndex

        packed, _ = sample_binary_vectors
        index = BinaryANNIndex(temp_db, dim=256)
        index.add_vectors(sample_ids, packed)

        # Get existing vector
        vec = index.get_vector(1)
        assert vec == packed[0]

        # Get non-existing vector
        vec = index.get_vector(9999)
        assert vec is None

    def test_clear(self, temp_db, sample_binary_vectors, sample_ids):
        """Test clearing all vectors from the index."""
        from codexlens.semantic.ann_index import BinaryANNIndex

        packed, _ = sample_binary_vectors
        index = BinaryANNIndex(temp_db, dim=256)
        index.add_vectors(sample_ids, packed)
        assert index.count() == 100

        index.clear()
        assert index.count() == 0
        assert not index.is_loaded

    def test_search_empty_index(self, temp_db):
        """Test searching an empty index."""
        from codexlens.semantic.ann_index import BinaryANNIndex
        import numpy as np

        index = BinaryANNIndex(temp_db, dim=256)
        query = np.packbits(np.zeros(256, dtype=np.uint8)).tobytes()

        ids, distances = index.search(query, top_k=5)

        assert ids == []
        assert distances == []

    def test_update_existing_vector(self, temp_db):
        """Test updating an existing vector with new data."""
        from codexlens.semantic.ann_index import BinaryANNIndex
        import numpy as np

        index = BinaryANNIndex(temp_db, dim=256)

        # Add initial vector
        v1 = np.zeros(256, dtype=np.uint8)
        index.add_vectors_numpy([1], v1.reshape(1, -1))

        # Update with different vector
        v2 = np.ones(256, dtype=np.uint8)
        index.add_vectors_numpy([1], v2.reshape(1, -1))

        # Count should still be 1
        assert index.count() == 1

        # Retrieved vector should be the updated one
        stored = index.get_vector(1)
        expected = np.packbits(v2).tobytes()
        assert stored == expected


class TestCreateAnnIndexFactory:
    """Test suite for create_ann_index factory function."""

    @pytest.fixture
    def temp_db(self):
        """Create a temporary database file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir) / "_index.db"

    @pytest.mark.skipif(
        not _hnswlib_available(),
        reason="hnswlib not installed"
    )
    def test_create_hnsw_index(self, temp_db):
        """Test creating HNSW index via factory."""
        from codexlens.semantic.ann_index import create_ann_index, ANNIndex

        index = create_ann_index(temp_db, index_type="hnsw", dim=384)
        assert isinstance(index, ANNIndex)
        assert index.dim == 384

    def test_create_binary_index(self, temp_db):
        """Test creating binary index via factory."""
        from codexlens.semantic.ann_index import create_ann_index, BinaryANNIndex

        index = create_ann_index(temp_db, index_type="binary", dim=256)
        assert isinstance(index, BinaryANNIndex)
        assert index.dim == 256

    def test_create_binary_index_default_dim(self, temp_db):
        """Test that binary index defaults to 256 dim when dense default is used."""
        from codexlens.semantic.ann_index import create_ann_index, BinaryANNIndex

        # When dim=2048 (dense default) is passed with binary type,
        # it should auto-adjust to 256
        index = create_ann_index(temp_db, index_type="binary")
        assert isinstance(index, BinaryANNIndex)
        assert index.dim == 256

    def test_invalid_index_type(self, temp_db):
        """Test that invalid index type raises error."""
        from codexlens.semantic.ann_index import create_ann_index

        with pytest.raises(ValueError, match="Invalid index_type"):
            create_ann_index(temp_db, index_type="invalid")

    def test_case_insensitive_index_type(self, temp_db):
        """Test that index_type is case-insensitive."""
        from codexlens.semantic.ann_index import create_ann_index, BinaryANNIndex

        index = create_ann_index(temp_db, index_type="BINARY", dim=256)
        assert isinstance(index, BinaryANNIndex)
