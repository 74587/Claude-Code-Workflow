"""Tests for CodexLens entity models."""

import pytest
from pydantic import ValidationError

from codexlens.entities import IndexedFile, SearchResult, SemanticChunk, Symbol


class TestSymbol:
    """Tests for Symbol entity."""

    def test_create_valid_symbol(self):
        """Test creating a valid symbol."""
        symbol = Symbol(name="hello", kind="function", range=(1, 10))
        assert symbol.name == "hello"
        assert symbol.kind == "function"
        assert symbol.range == (1, 10)

    def test_symbol_range_validation(self):
        """Test that range values must be valid."""
        # Range must have start >= 1
        with pytest.raises(ValidationError):
            Symbol(name="test", kind="function", range=(0, 5))

        # Range must have end >= start
        with pytest.raises(ValidationError):
            Symbol(name="test", kind="function", range=(5, 3))

        # Both values must be >= 1
        with pytest.raises(ValidationError):
            Symbol(name="test", kind="function", range=(-1, 5))

    def test_symbol_name_required(self):
        """Test that name is required and non-empty."""
        with pytest.raises(ValidationError):
            Symbol(name="", kind="function", range=(1, 1))

    def test_symbol_kind_required(self):
        """Test that kind is required and non-empty."""
        with pytest.raises(ValidationError):
            Symbol(name="test", kind="", range=(1, 1))

    def test_symbol_equal_range(self):
        """Test symbol with equal start and end line."""
        symbol = Symbol(name="one_liner", kind="function", range=(5, 5))
        assert symbol.range == (5, 5)


class TestSemanticChunk:
    """Tests for SemanticChunk entity."""

    def test_create_chunk_without_embedding(self):
        """Test creating a chunk without embedding."""
        chunk = SemanticChunk(content="def hello(): pass")
        assert chunk.content == "def hello(): pass"
        assert chunk.embedding is None
        assert chunk.metadata == {}

    def test_create_chunk_with_embedding(self):
        """Test creating a chunk with embedding."""
        embedding = [0.1, 0.2, 0.3, 0.4]
        chunk = SemanticChunk(content="some code", embedding=embedding)
        assert chunk.embedding == embedding

    def test_chunk_with_metadata(self):
        """Test creating a chunk with metadata."""
        metadata = {"file": "test.py", "language": "python", "line": 10}
        chunk = SemanticChunk(content="code", metadata=metadata)
        assert chunk.metadata == metadata

    def test_chunk_content_required(self):
        """Test that content is required and non-empty."""
        with pytest.raises(ValidationError):
            SemanticChunk(content="")

    def test_chunk_embedding_validation(self):
        """Test that embedding cannot be empty list when provided."""
        with pytest.raises(ValidationError):
            SemanticChunk(content="code", embedding=[])

    def test_chunk_embedding_with_floats(self):
        """Test embedding with various float values."""
        embedding = [0.0, 1.0, -0.5, 0.123456789]
        chunk = SemanticChunk(content="code", embedding=embedding)
        assert chunk.embedding == embedding

    def test_chunk_zero_vector_validation(self):
        """Test that zero vector embeddings are rejected."""
        with pytest.raises(ValidationError) as exc:
            SemanticChunk(content="code", embedding=[0.0, 0.0, 0.0, 0.0])
        assert "zero vector" in str(exc.value).lower()

    def test_chunk_near_zero_vector_validation(self):
        """Test that near-zero vector embeddings are rejected."""
        with pytest.raises(ValidationError) as exc:
            SemanticChunk(content="code", embedding=[1e-11, 1e-11, 1e-11])
        assert "zero vector" in str(exc.value).lower()

    def test_chunk_small_nonzero_vector_validation(self):
        """Test that small but non-zero embeddings are allowed."""
        embedding = [0.001, 0.001, 0.001]
        chunk = SemanticChunk(content="code", embedding=embedding)
        assert chunk.embedding == embedding


class TestIndexedFile:
    """Tests for IndexedFile entity."""

    def test_create_empty_indexed_file(self):
        """Test creating an indexed file with no symbols or chunks."""
        indexed = IndexedFile(path="/test/file.py", language="python")
        assert indexed.path == "/test/file.py"
        assert indexed.language == "python"
        assert indexed.symbols == []
        assert indexed.chunks == []

    def test_create_indexed_file_with_symbols(self):
        """Test creating an indexed file with symbols."""
        symbols = [
            Symbol(name="MyClass", kind="class", range=(1, 10)),
            Symbol(name="my_func", kind="function", range=(12, 20)),
        ]
        indexed = IndexedFile(
            path="/test/file.py",
            language="python",
            symbols=symbols,
        )
        assert len(indexed.symbols) == 2
        assert indexed.symbols[0].name == "MyClass"

    def test_create_indexed_file_with_chunks(self):
        """Test creating an indexed file with chunks."""
        chunks = [
            SemanticChunk(content="chunk 1", metadata={"line": 1}),
            SemanticChunk(content="chunk 2", metadata={"line": 10}),
        ]
        indexed = IndexedFile(
            path="/test/file.py",
            language="python",
            chunks=chunks,
        )
        assert len(indexed.chunks) == 2

    def test_indexed_file_path_strip(self):
        """Test that path is stripped of whitespace."""
        indexed = IndexedFile(path="  /test/file.py  ", language="python")
        assert indexed.path == "/test/file.py"

    def test_indexed_file_language_strip(self):
        """Test that language is stripped of whitespace."""
        indexed = IndexedFile(path="/test/file.py", language="  python  ")
        assert indexed.language == "python"

    def test_indexed_file_path_required(self):
        """Test that path is required and non-blank."""
        with pytest.raises(ValidationError):
            IndexedFile(path="", language="python")

        with pytest.raises(ValidationError):
            IndexedFile(path="   ", language="python")

    def test_indexed_file_language_required(self):
        """Test that language is required and non-blank."""
        with pytest.raises(ValidationError):
            IndexedFile(path="/test/file.py", language="")


class TestSearchResult:
    """Tests for SearchResult entity."""

    def test_create_minimal_search_result(self):
        """Test creating a minimal search result."""
        result = SearchResult(path="/test/file.py", score=0.95)
        assert result.path == "/test/file.py"
        assert result.score == 0.95
        assert result.excerpt is None
        assert result.symbol is None
        assert result.chunk is None
        assert result.metadata == {}

    def test_create_full_search_result(self):
        """Test creating a search result with all fields."""
        symbol = Symbol(name="test", kind="function", range=(1, 5))
        chunk = SemanticChunk(content="test code")
        result = SearchResult(
            path="/test/file.py",
            score=0.88,
            excerpt="...matching code...",
            symbol=symbol,
            chunk=chunk,
            metadata={"match_type": "fts"},
        )
        assert result.excerpt == "...matching code..."
        assert result.symbol.name == "test"
        assert result.chunk.content == "test code"

    def test_search_result_score_validation(self):
        """Test that score must be >= 0."""
        with pytest.raises(ValidationError):
            SearchResult(path="/test/file.py", score=-0.1)

    def test_search_result_zero_score(self):
        """Test that zero score is valid."""
        result = SearchResult(path="/test/file.py", score=0.0)
        assert result.score == 0.0

    def test_search_result_path_required(self):
        """Test that path is required and non-empty."""
        with pytest.raises(ValidationError):
            SearchResult(path="", score=0.5)


class TestEntitySerialization:
    """Tests for entity serialization."""

    def test_symbol_model_dump(self):
        """Test Symbol serialization."""
        symbol = Symbol(name="test", kind="function", range=(1, 10))
        data = symbol.model_dump()
        assert data == {
            "name": "test",
            "kind": "function",
            "range": (1, 10),
            "file": None,
        }

    def test_indexed_file_model_dump(self):
        """Test IndexedFile serialization."""
        indexed = IndexedFile(
            path="/test.py",
            language="python",
            symbols=[Symbol(name="foo", kind="function", range=(1, 1))],
        )
        data = indexed.model_dump()
        assert data["path"] == "/test.py"
        assert data["language"] == "python"
        assert len(data["symbols"]) == 1

    def test_search_result_model_dump(self):
        """Test SearchResult serialization."""
        result = SearchResult(path="/test.py", score=0.5, excerpt="test")
        data = result.model_dump()
        assert data["path"] == "/test.py"
        assert data["score"] == 0.5
        assert data["excerpt"] == "test"
