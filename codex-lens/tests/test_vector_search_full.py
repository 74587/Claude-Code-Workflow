"""Full coverage tests for vector/semantic search functionality.

Tests cover:
- Embedder model loading and embedding generation
- VectorStore CRUD operations and caching
- Cosine similarity computation
- Semantic search accuracy and relevance
- Performance benchmarks
- Edge cases and error handling
- Thread safety and concurrent access
"""

import json
import tempfile
import threading
import time
from pathlib import Path
from typing import List

import pytest

from codexlens.entities import SemanticChunk, Symbol, SearchResult
from codexlens.semantic import SEMANTIC_AVAILABLE, check_semantic_available

# Skip all tests if semantic dependencies not available
pytestmark = pytest.mark.skipif(
    not SEMANTIC_AVAILABLE,
    reason="Semantic search dependencies not installed (pip install codexlens[semantic])"
)


# === Fixtures ===

@pytest.fixture
def temp_db(tmp_path):
    """Create temporary database path."""
    return tmp_path / "test_semantic.db"


@pytest.fixture
def embedder():
    """Create Embedder instance."""
    from codexlens.semantic.embedder import Embedder
    return Embedder()


@pytest.fixture
def vector_store(temp_db):
    """Create VectorStore instance."""
    from codexlens.semantic.vector_store import VectorStore
    return VectorStore(temp_db)


@pytest.fixture
def sample_code_chunks():
    """Sample code chunks for testing."""
    return [
        {
            "content": "def authenticate(username, password): return check_credentials(username, password)",
            "metadata": {"symbol_name": "authenticate", "symbol_kind": "function", "start_line": 1, "end_line": 1, "language": "python"},
        },
        {
            "content": "class DatabaseConnection:\n    def connect(self, host, port): pass\n    def execute(self, query): pass",
            "metadata": {"symbol_name": "DatabaseConnection", "symbol_kind": "class", "start_line": 1, "end_line": 3, "language": "python"},
        },
        {
            "content": "async function fetchUserData(userId) { return await api.get('/users/' + userId); }",
            "metadata": {"symbol_name": "fetchUserData", "symbol_kind": "function", "start_line": 1, "end_line": 1, "language": "javascript"},
        },
        {
            "content": "def calculate_sum(numbers): return sum(numbers)",
            "metadata": {"symbol_name": "calculate_sum", "symbol_kind": "function", "start_line": 1, "end_line": 1, "language": "python"},
        },
        {
            "content": "class UserProfile:\n    def __init__(self, name, email):\n        self.name = name\n        self.email = email",
            "metadata": {"symbol_name": "UserProfile", "symbol_kind": "class", "start_line": 1, "end_line": 4, "language": "python"},
        },
    ]


# === Embedder Tests ===

class TestEmbedder:
    """Tests for Embedder class."""

    def test_embedder_initialization(self, embedder):
        """Test embedder initializes correctly."""
        assert embedder.model_name == "BAAI/bge-small-en-v1.5"
        assert embedder.EMBEDDING_DIM == 384
        assert embedder._model is None  # Lazy loading

    def test_embed_single_returns_correct_dimension(self, embedder):
        """Test single embedding has correct dimension."""
        text = "def hello(): print('world')"
        embedding = embedder.embed_single(text)

        assert isinstance(embedding, list)
        assert len(embedding) == 384
        assert all(isinstance(x, float) for x in embedding)

    def test_embed_batch_returns_correct_count(self, embedder):
        """Test batch embedding returns correct number of embeddings."""
        texts = [
            "def foo(): pass",
            "def bar(): pass",
            "def baz(): pass",
        ]
        embeddings = embedder.embed(texts)

        assert len(embeddings) == len(texts)
        assert all(len(e) == 384 for e in embeddings)

    def test_embed_empty_string(self, embedder):
        """Test embedding empty string."""
        embedding = embedder.embed_single("")
        assert len(embedding) == 384

    def test_embed_unicode_text(self, embedder):
        """Test embedding unicode text."""
        text = "def 你好(): return '世界'"
        embedding = embedder.embed_single(text)
        assert len(embedding) == 384

    def test_embed_long_text(self, embedder):
        """Test embedding long text."""
        text = "def process(): pass\n" * 100
        embedding = embedder.embed_single(text)
        assert len(embedding) == 384

    def test_embed_special_characters(self, embedder):
        """Test embedding text with special characters."""
        text = "def test(): return {'key': 'value', '@decorator': True}"
        embedding = embedder.embed_single(text)
        assert len(embedding) == 384

    def test_lazy_model_loading(self, embedder):
        """Test model loads lazily on first embed call."""
        assert embedder._model is None
        embedder.embed_single("test")
        assert embedder._model is not None

    def test_model_reuse(self, embedder):
        """Test model is reused across multiple calls."""
        embedder.embed_single("test1")
        model_ref = embedder._model
        embedder.embed_single("test2")
        assert embedder._model is model_ref  # Same instance


class TestEmbeddingSimilarity:
    """Tests for embedding similarity."""

    def test_identical_text_similarity(self, embedder):
        """Test identical text has similarity ~1.0."""
        from codexlens.semantic.vector_store import _cosine_similarity

        text = "def calculate_sum(a, b): return a + b"
        emb1 = embedder.embed_single(text)
        emb2 = embedder.embed_single(text)

        similarity = _cosine_similarity(emb1, emb2)
        assert similarity > 0.99, "Identical text should have ~1.0 similarity"

    def test_similar_code_high_similarity(self, embedder):
        """Test similar code has high similarity."""
        from codexlens.semantic.vector_store import _cosine_similarity

        code1 = "def add(a, b): return a + b"
        code2 = "def sum_numbers(x, y): return x + y"

        emb1 = embedder.embed_single(code1)
        emb2 = embedder.embed_single(code2)

        similarity = _cosine_similarity(emb1, emb2)
        assert similarity > 0.6, "Similar functions should have high similarity"

    def test_different_code_lower_similarity(self, embedder):
        """Test different code has lower similarity than similar code."""
        from codexlens.semantic.vector_store import _cosine_similarity

        code1 = "def add(a, b): return a + b"
        code2 = "def sum_numbers(x, y): return x + y"
        code3 = "class UserAuth: def login(self, user, pwd): pass"

        emb1 = embedder.embed_single(code1)
        emb2 = embedder.embed_single(code2)
        emb3 = embedder.embed_single(code3)

        sim_similar = _cosine_similarity(emb1, emb2)
        sim_different = _cosine_similarity(emb1, emb3)

        assert sim_similar > sim_different, "Similar code should have higher similarity"

    def test_zero_vector_similarity(self):
        """Test cosine similarity with zero vector."""
        from codexlens.semantic.vector_store import _cosine_similarity

        zero_vec = [0.0] * 384
        normal_vec = [1.0] * 384

        similarity = _cosine_similarity(zero_vec, normal_vec)
        assert similarity == 0.0, "Zero vector should have 0 similarity"


# === VectorStore Tests ===

class TestVectorStoreCRUD:
    """Tests for VectorStore CRUD operations."""

    def test_add_chunk(self, vector_store, embedder):
        """Test adding a single chunk."""
        chunk = SemanticChunk(
            content="def test(): pass",
            metadata={"language": "python"},
        )
        chunk.embedding = embedder.embed_single(chunk.content)

        chunk_id = vector_store.add_chunk(chunk, "/test/file.py")

        assert chunk_id > 0
        assert vector_store.count_chunks() == 1

    def test_add_chunk_without_embedding_raises(self, vector_store):
        """Test adding chunk without embedding raises error."""
        chunk = SemanticChunk(content="def test(): pass", metadata={})

        with pytest.raises(ValueError, match="must have embedding"):
            vector_store.add_chunk(chunk, "/test/file.py")

    def test_add_chunks_batch(self, vector_store, embedder, sample_code_chunks):
        """Test batch adding chunks."""
        chunks = []
        for data in sample_code_chunks:
            chunk = SemanticChunk(content=data["content"], metadata=data["metadata"])
            chunk.embedding = embedder.embed_single(chunk.content)
            chunks.append(chunk)

        ids = vector_store.add_chunks(chunks, "/test/multi.py")

        assert len(ids) == len(chunks)
        assert vector_store.count_chunks() == len(chunks)

    def test_add_empty_batch(self, vector_store):
        """Test adding empty batch returns empty list."""
        ids = vector_store.add_chunks([], "/test/empty.py")
        assert ids == []

    def test_delete_file_chunks(self, vector_store, embedder):
        """Test deleting chunks by file path."""
        # Add chunks for two files
        chunk1 = SemanticChunk(content="def a(): pass", metadata={})
        chunk1.embedding = embedder.embed_single(chunk1.content)
        vector_store.add_chunk(chunk1, "/test/file1.py")

        chunk2 = SemanticChunk(content="def b(): pass", metadata={})
        chunk2.embedding = embedder.embed_single(chunk2.content)
        vector_store.add_chunk(chunk2, "/test/file2.py")

        assert vector_store.count_chunks() == 2

        # Delete one file's chunks
        deleted = vector_store.delete_file_chunks("/test/file1.py")

        assert deleted == 1
        assert vector_store.count_chunks() == 1

    def test_delete_nonexistent_file(self, vector_store):
        """Test deleting non-existent file returns 0."""
        deleted = vector_store.delete_file_chunks("/nonexistent/file.py")
        assert deleted == 0

    def test_count_chunks_empty(self, vector_store):
        """Test count on empty store."""
        assert vector_store.count_chunks() == 0


class TestVectorStoreSearch:
    """Tests for VectorStore search functionality."""

    def test_search_similar_basic(self, vector_store, embedder, sample_code_chunks):
        """Test basic similarity search."""
        # Add chunks
        for data in sample_code_chunks:
            chunk = SemanticChunk(content=data["content"], metadata=data["metadata"])
            chunk.embedding = embedder.embed_single(chunk.content)
            vector_store.add_chunk(chunk, "/test/file.py")

        # Search
        query = "function to authenticate user login"
        query_embedding = embedder.embed_single(query)
        results = vector_store.search_similar(query_embedding, top_k=3)

        assert len(results) > 0
        assert all(isinstance(r, SearchResult) for r in results)
        # Top result should be auth-related
        assert "authenticate" in results[0].excerpt.lower() or "auth" in results[0].path.lower()

    def test_search_respects_top_k(self, vector_store, embedder, sample_code_chunks):
        """Test search respects top_k parameter."""
        # Add all chunks
        for data in sample_code_chunks:
            chunk = SemanticChunk(content=data["content"], metadata=data["metadata"])
            chunk.embedding = embedder.embed_single(chunk.content)
            vector_store.add_chunk(chunk, "/test/file.py")

        query_embedding = embedder.embed_single("code")

        results_2 = vector_store.search_similar(query_embedding, top_k=2)
        results_5 = vector_store.search_similar(query_embedding, top_k=5)

        assert len(results_2) <= 2
        assert len(results_5) <= 5

    def test_search_min_score_filtering(self, vector_store, embedder):
        """Test min_score filtering."""
        chunk = SemanticChunk(
            content="def hello(): print('hello world')",
            metadata={},
        )
        chunk.embedding = embedder.embed_single(chunk.content)
        vector_store.add_chunk(chunk, "/test/hello.py")

        query_embedding = embedder.embed_single("database connection pool")

        results_no_filter = vector_store.search_similar(query_embedding, min_score=0.0)
        results_high_filter = vector_store.search_similar(query_embedding, min_score=0.9)

        assert len(results_no_filter) >= len(results_high_filter)

    def test_search_returns_sorted_by_score(self, vector_store, embedder, sample_code_chunks):
        """Test results are sorted by score descending."""
        for data in sample_code_chunks:
            chunk = SemanticChunk(content=data["content"], metadata=data["metadata"])
            chunk.embedding = embedder.embed_single(chunk.content)
            vector_store.add_chunk(chunk, "/test/file.py")

        query_embedding = embedder.embed_single("function")
        results = vector_store.search_similar(query_embedding, top_k=5)

        if len(results) > 1:
            for i in range(len(results) - 1):
                assert results[i].score >= results[i + 1].score

    def test_search_includes_metadata(self, vector_store, embedder):
        """Test search results include metadata."""
        chunk = SemanticChunk(
            content="def test_function(): pass",
            metadata={
                "symbol_name": "test_function",
                "symbol_kind": "function",
                "start_line": 10,
                "end_line": 15,
            },
        )
        chunk.embedding = embedder.embed_single(chunk.content)
        vector_store.add_chunk(chunk, "/test/func.py")

        query_embedding = embedder.embed_single("test function")
        results = vector_store.search_similar(query_embedding, top_k=1)

        assert len(results) == 1
        assert results[0].symbol_name == "test_function"
        assert results[0].symbol_kind == "function"
        assert results[0].start_line == 10
        assert results[0].end_line == 15

    def test_search_empty_store_returns_empty(self, vector_store, embedder):
        """Test search on empty store returns empty list."""
        query_embedding = embedder.embed_single("anything")
        results = vector_store.search_similar(query_embedding)
        assert results == []

    def test_search_with_return_full_content_false(self, vector_store, embedder):
        """Test search with return_full_content=False."""
        chunk = SemanticChunk(
            content="def long_function(): " + "pass\n" * 100,
            metadata={},
        )
        chunk.embedding = embedder.embed_single(chunk.content)
        vector_store.add_chunk(chunk, "/test/long.py")

        query_embedding = embedder.embed_single("function")
        results = vector_store.search_similar(
            query_embedding, top_k=1, return_full_content=False
        )

        assert len(results) == 1
        assert results[0].content is None
        assert results[0].excerpt is not None


class TestVectorStoreCache:
    """Tests for VectorStore caching behavior."""

    def test_cache_invalidation_on_add(self, vector_store, embedder):
        """Test cache is invalidated when chunks are added."""
        chunk1 = SemanticChunk(content="def a(): pass", metadata={})
        chunk1.embedding = embedder.embed_single(chunk1.content)
        vector_store.add_chunk(chunk1, "/test/a.py")

        # Trigger cache population
        query_embedding = embedder.embed_single("function")
        vector_store.search_similar(query_embedding)

        initial_version = vector_store._cache_version

        # Add another chunk
        chunk2 = SemanticChunk(content="def b(): pass", metadata={})
        chunk2.embedding = embedder.embed_single(chunk2.content)
        vector_store.add_chunk(chunk2, "/test/b.py")

        assert vector_store._cache_version > initial_version
        assert vector_store._embedding_matrix is None

    def test_cache_invalidation_on_delete(self, vector_store, embedder):
        """Test cache is invalidated when chunks are deleted."""
        chunk = SemanticChunk(content="def a(): pass", metadata={})
        chunk.embedding = embedder.embed_single(chunk.content)
        vector_store.add_chunk(chunk, "/test/a.py")

        # Trigger cache population
        query_embedding = embedder.embed_single("function")
        vector_store.search_similar(query_embedding)

        initial_version = vector_store._cache_version

        # Delete chunk
        vector_store.delete_file_chunks("/test/a.py")

        assert vector_store._cache_version > initial_version

    def test_manual_cache_clear(self, vector_store, embedder):
        """Test manual cache clearing."""
        chunk = SemanticChunk(content="def a(): pass", metadata={})
        chunk.embedding = embedder.embed_single(chunk.content)
        vector_store.add_chunk(chunk, "/test/a.py")

        # Trigger cache population
        query_embedding = embedder.embed_single("function")
        vector_store.search_similar(query_embedding)

        assert vector_store._embedding_matrix is not None

        vector_store.clear_cache()

        assert vector_store._embedding_matrix is None


# === Semantic Search Accuracy Tests ===

class TestSemanticSearchAccuracy:
    """Tests for semantic search accuracy and relevance."""

    def test_auth_query_finds_auth_code(self, vector_store, embedder, sample_code_chunks):
        """Test authentication query finds auth code."""
        for data in sample_code_chunks:
            chunk = SemanticChunk(content=data["content"], metadata=data["metadata"])
            chunk.embedding = embedder.embed_single(chunk.content)
            vector_store.add_chunk(chunk, "/test/file.py")

        query = "user authentication login"
        query_embedding = embedder.embed_single(query)
        results = vector_store.search_similar(query_embedding, top_k=1)

        assert len(results) > 0
        assert "authenticate" in results[0].excerpt.lower()

    def test_database_query_finds_db_code(self, vector_store, embedder, sample_code_chunks):
        """Test database query finds database code."""
        for data in sample_code_chunks:
            chunk = SemanticChunk(content=data["content"], metadata=data["metadata"])
            chunk.embedding = embedder.embed_single(chunk.content)
            vector_store.add_chunk(chunk, "/test/file.py")

        query = "database connection execute query"
        query_embedding = embedder.embed_single(query)
        results = vector_store.search_similar(query_embedding, top_k=1)

        assert len(results) > 0
        assert "database" in results[0].excerpt.lower() or "connect" in results[0].excerpt.lower()

    def test_math_query_finds_calculation_code(self, vector_store, embedder, sample_code_chunks):
        """Test math query finds calculation code."""
        for data in sample_code_chunks:
            chunk = SemanticChunk(content=data["content"], metadata=data["metadata"])
            chunk.embedding = embedder.embed_single(chunk.content)
            vector_store.add_chunk(chunk, "/test/file.py")

        query = "sum numbers add calculation"
        query_embedding = embedder.embed_single(query)
        results = vector_store.search_similar(query_embedding, top_k=1)

        assert len(results) > 0
        assert "sum" in results[0].excerpt.lower() or "calculate" in results[0].excerpt.lower()


# === Performance Tests ===

class TestVectorSearchPerformance:
    """Performance tests for vector search."""

    def test_embedding_performance(self, embedder):
        """Test embedding generation performance."""
        text = "def calculate_sum(a, b): return a + b"

        # Warm up
        embedder.embed_single(text)

        # Measure
        start = time.perf_counter()
        iterations = 10
        for _ in range(iterations):
            embedder.embed_single(text)
        elapsed = time.perf_counter() - start

        avg_ms = (elapsed / iterations) * 1000
        assert avg_ms < 100, f"Single embedding should be <100ms, got {avg_ms:.2f}ms"

    def test_batch_embedding_performance(self, embedder):
        """Test batch embedding performance."""
        texts = [f"def function_{i}(): pass" for i in range(50)]

        # Warm up
        embedder.embed(texts[:5])

        # Measure
        start = time.perf_counter()
        embedder.embed(texts)
        elapsed = time.perf_counter() - start

        total_ms = elapsed * 1000
        per_text_ms = total_ms / len(texts)
        assert per_text_ms < 20, f"Per-text embedding should be <20ms, got {per_text_ms:.2f}ms"

    def test_search_performance_small(self, vector_store, embedder):
        """Test search performance with small dataset."""
        # Add 100 chunks
        for i in range(100):
            chunk = SemanticChunk(
                content=f"def function_{i}(): return {i}",
                metadata={"index": i},
            )
            chunk.embedding = embedder.embed_single(chunk.content)
            vector_store.add_chunk(chunk, f"/test/file_{i}.py")

        query_embedding = embedder.embed_single("function return value")

        # Warm up
        vector_store.search_similar(query_embedding)

        # Measure
        start = time.perf_counter()
        iterations = 10
        for _ in range(iterations):
            vector_store.search_similar(query_embedding)
        elapsed = time.perf_counter() - start

        avg_ms = (elapsed / iterations) * 1000
        assert avg_ms < 50, f"Search with 100 chunks should be <50ms, got {avg_ms:.2f}ms"

    def test_search_performance_medium(self, vector_store, embedder):
        """Test search performance with medium dataset."""
        # Add 500 chunks in batch
        chunks = []
        for i in range(500):
            chunk = SemanticChunk(
                content=f"def function_{i}(x): return x * {i}",
                metadata={"index": i},
            )
            chunk.embedding = embedder.embed_single(chunk.content)
            chunks.append(chunk)

        vector_store.add_chunks(chunks, "/test/bulk.py")

        query_embedding = embedder.embed_single("multiply value")

        # Warm up
        vector_store.search_similar(query_embedding)

        # Measure
        start = time.perf_counter()
        iterations = 5
        for _ in range(iterations):
            vector_store.search_similar(query_embedding)
        elapsed = time.perf_counter() - start

        avg_ms = (elapsed / iterations) * 1000
        assert avg_ms < 100, f"Search with 500 chunks should be <100ms, got {avg_ms:.2f}ms"


# === Thread Safety Tests ===

class TestThreadSafety:
    """Tests for thread safety."""

    def test_concurrent_searches(self, vector_store, embedder, sample_code_chunks):
        """Test concurrent searches are thread-safe."""
        # Populate store
        for data in sample_code_chunks:
            chunk = SemanticChunk(content=data["content"], metadata=data["metadata"])
            chunk.embedding = embedder.embed_single(chunk.content)
            vector_store.add_chunk(chunk, "/test/file.py")

        results_list = []
        errors = []

        def search_task(query):
            try:
                query_embedding = embedder.embed_single(query)
                results = vector_store.search_similar(query_embedding, top_k=3)
                results_list.append(len(results))
            except Exception as e:
                errors.append(str(e))

        queries = ["authentication", "database", "function", "class", "async"]
        threads = [threading.Thread(target=search_task, args=(q,)) for q in queries]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f"Errors during concurrent search: {errors}"
        assert len(results_list) == len(queries)

    def test_concurrent_add_and_search(self, vector_store, embedder):
        """Test concurrent add and search operations."""
        errors = []

        def add_task(idx):
            try:
                chunk = SemanticChunk(
                    content=f"def task_{idx}(): pass",
                    metadata={"idx": idx},
                )
                chunk.embedding = embedder.embed_single(chunk.content)
                vector_store.add_chunk(chunk, f"/test/task_{idx}.py")
            except Exception as e:
                errors.append(f"Add error: {e}")

        def search_task():
            try:
                query_embedding = embedder.embed_single("function task")
                vector_store.search_similar(query_embedding)
            except Exception as e:
                errors.append(f"Search error: {e}")

        threads = []
        for i in range(10):
            threads.append(threading.Thread(target=add_task, args=(i,)))
            threads.append(threading.Thread(target=search_task))

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0, f"Errors during concurrent ops: {errors}"


# === Edge Cases ===

class TestEdgeCases:
    """Tests for edge cases."""

    def test_very_short_content(self, vector_store, embedder):
        """Test handling very short content."""
        chunk = SemanticChunk(content="x", metadata={})
        chunk.embedding = embedder.embed_single(chunk.content)
        vector_store.add_chunk(chunk, "/test/short.py")

        query_embedding = embedder.embed_single("x")
        results = vector_store.search_similar(query_embedding)

        assert len(results) == 1

    def test_special_characters_in_path(self, vector_store, embedder):
        """Test handling special characters in file path."""
        chunk = SemanticChunk(content="def test(): pass", metadata={})
        chunk.embedding = embedder.embed_single(chunk.content)

        special_path = "/test/path with spaces/file-name_v2.py"
        vector_store.add_chunk(chunk, special_path)

        query_embedding = embedder.embed_single("test function")
        results = vector_store.search_similar(query_embedding)

        assert len(results) == 1
        assert results[0].path == special_path

    def test_json_metadata_special_chars(self, vector_store, embedder):
        """Test metadata with special JSON characters."""
        metadata = {
            "description": 'Test "quoted" text with \'single\' quotes',
            "path": "C:\\Users\\test\\file.py",
            "tags": ["tag1", "tag2"],
        }
        chunk = SemanticChunk(content="def test(): pass", metadata=metadata)
        chunk.embedding = embedder.embed_single(chunk.content)

        vector_store.add_chunk(chunk, "/test/special.py")

        query_embedding = embedder.embed_single("test")
        results = vector_store.search_similar(query_embedding)

        assert len(results) == 1
        assert results[0].metadata["description"] == metadata["description"]

    def test_search_zero_top_k(self, vector_store, embedder):
        """Test search with top_k=0."""
        chunk = SemanticChunk(content="def test(): pass", metadata={})
        chunk.embedding = embedder.embed_single(chunk.content)
        vector_store.add_chunk(chunk, "/test/file.py")

        query_embedding = embedder.embed_single("test")
        results = vector_store.search_similar(query_embedding, top_k=0)

        assert results == []

    def test_search_very_high_min_score(self, vector_store, embedder):
        """Test search with very high min_score filters all results."""
        chunk = SemanticChunk(content="def hello(): print('world')", metadata={})
        chunk.embedding = embedder.embed_single(chunk.content)
        vector_store.add_chunk(chunk, "/test/hello.py")

        # Query something unrelated with very high threshold
        query_embedding = embedder.embed_single("database connection")
        results = vector_store.search_similar(query_embedding, min_score=0.99)

        # Should filter out since unrelated
        assert len(results) == 0


# === Availability Check Tests ===

class TestAvailabilityCheck:
    """Tests for semantic availability checking."""

    def test_check_semantic_available(self):
        """Test check_semantic_available function."""
        available, error = check_semantic_available()
        assert available is True
        assert error is None

    def test_semantic_available_flag(self):
        """Test SEMANTIC_AVAILABLE flag is True when deps installed."""
        assert SEMANTIC_AVAILABLE is True
