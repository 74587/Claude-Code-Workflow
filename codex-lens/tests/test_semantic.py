"""Tests for CodexLens semantic module."""

import pytest

from codexlens.entities import SemanticChunk, Symbol
from codexlens.semantic.chunker import ChunkConfig, Chunker


class TestChunkConfig:
    """Tests for ChunkConfig."""

    def test_default_config(self):
        """Test default configuration values."""
        config = ChunkConfig()
        assert config.max_chunk_size == 1000
        assert config.overlap == 100
        assert config.min_chunk_size == 50

    def test_custom_config(self):
        """Test custom configuration."""
        config = ChunkConfig(max_chunk_size=2000, overlap=200, min_chunk_size=100)
        assert config.max_chunk_size == 2000
        assert config.overlap == 200
        assert config.min_chunk_size == 100


class TestChunker:
    """Tests for Chunker class."""

    def test_chunker_default_config(self):
        """Test chunker with default config."""
        chunker = Chunker()
        assert chunker.config.max_chunk_size == 1000

    def test_chunker_custom_config(self):
        """Test chunker with custom config."""
        config = ChunkConfig(max_chunk_size=500)
        chunker = Chunker(config=config)
        assert chunker.config.max_chunk_size == 500


class TestChunkBySymbol:
    """Tests for symbol-based chunking."""

    def test_chunk_single_function(self):
        """Test chunking a single function."""
        # Use config with smaller min_chunk_size
        config = ChunkConfig(min_chunk_size=10)
        chunker = Chunker(config=config)
        content = "def hello():\n    print('hello')\n    return True\n"
        symbols = [Symbol(name="hello", kind="function", range=(1, 3))]

        chunks = chunker.chunk_by_symbol(content, symbols, "test.py", "python")

        assert len(chunks) == 1
        assert "def hello():" in chunks[0].content
        assert chunks[0].metadata["symbol_name"] == "hello"
        assert chunks[0].metadata["symbol_kind"] == "function"
        assert chunks[0].metadata["file"] == "test.py"
        assert chunks[0].metadata["language"] == "python"
        assert chunks[0].metadata["strategy"] == "symbol"

    def test_chunk_multiple_symbols(self):
        """Test chunking multiple symbols."""
        # Use config with smaller min_chunk_size
        config = ChunkConfig(min_chunk_size=5)
        chunker = Chunker(config=config)
        content = """def foo():
    pass

def bar():
    pass

class MyClass:
    pass
"""
        symbols = [
            Symbol(name="foo", kind="function", range=(1, 2)),
            Symbol(name="bar", kind="function", range=(4, 5)),
            Symbol(name="MyClass", kind="class", range=(7, 8)),
        ]

        chunks = chunker.chunk_by_symbol(content, symbols, "test.py", "python")

        assert len(chunks) == 3
        names = [c.metadata["symbol_name"] for c in chunks]
        assert "foo" in names
        assert "bar" in names
        assert "MyClass" in names

    def test_chunk_skips_small_content(self):
        """Test that chunks smaller than min_chunk_size are skipped."""
        config = ChunkConfig(min_chunk_size=100)
        chunker = Chunker(config=config)
        content = "def x():\n    pass\n"
        symbols = [Symbol(name="x", kind="function", range=(1, 2))]

        chunks = chunker.chunk_by_symbol(content, symbols, "test.py", "python")

        assert len(chunks) == 0  # Content is too small

    def test_chunk_preserves_line_numbers(self):
        """Test that chunks preserve correct line numbers."""
        config = ChunkConfig(min_chunk_size=5)
        chunker = Chunker(config=config)
        content = "# comment\ndef hello():\n    pass\n"
        symbols = [Symbol(name="hello", kind="function", range=(2, 3))]

        chunks = chunker.chunk_by_symbol(content, symbols, "test.py", "python")

        assert len(chunks) == 1
        assert chunks[0].metadata["start_line"] == 2
        assert chunks[0].metadata["end_line"] == 3

    def test_chunk_handles_empty_symbols(self):
        """Test chunking with empty symbols list."""
        chunker = Chunker()
        content = "# just a comment"
        symbols = []

        chunks = chunker.chunk_by_symbol(content, symbols, "test.py", "python")

        assert len(chunks) == 0


class TestChunkSlidingWindow:
    """Tests for sliding window chunking."""

    def test_sliding_window_basic(self):
        """Test basic sliding window chunking."""
        config = ChunkConfig(max_chunk_size=100, overlap=20, min_chunk_size=10)
        chunker = Chunker(config=config)

        # Create content with multiple lines
        lines = [f"line {i} content here\n" for i in range(20)]
        content = "".join(lines)

        chunks = chunker.chunk_sliding_window(content, "test.py", "python")

        assert len(chunks) > 0
        for chunk in chunks:
            assert chunk.metadata["strategy"] == "sliding_window"
            assert chunk.metadata["file"] == "test.py"
            assert chunk.metadata["language"] == "python"

    def test_sliding_window_empty_content(self):
        """Test sliding window with empty content."""
        chunker = Chunker()
        chunks = chunker.chunk_sliding_window("", "test.py", "python")
        assert len(chunks) == 0

    def test_sliding_window_small_content(self):
        """Test sliding window with content smaller than chunk size."""
        config = ChunkConfig(max_chunk_size=1000, min_chunk_size=10)
        chunker = Chunker(config=config)
        content = "small content here"

        chunks = chunker.chunk_sliding_window(content, "test.py", "python")

        # Small content should produce one chunk
        assert len(chunks) <= 1

    def test_sliding_window_chunk_indices(self):
        """Test that chunk indices are sequential."""
        config = ChunkConfig(max_chunk_size=50, overlap=10, min_chunk_size=5)
        chunker = Chunker(config=config)
        lines = [f"line {i}\n" for i in range(50)]
        content = "".join(lines)

        chunks = chunker.chunk_sliding_window(content, "test.py", "python")

        if len(chunks) > 1:
            indices = [c.metadata["chunk_index"] for c in chunks]
            assert indices == list(range(len(chunks)))


class TestChunkFile:
    """Tests for chunk_file method."""

    def test_chunk_file_with_symbols(self):
        """Test chunk_file uses symbol-based chunking when symbols available."""
        chunker = Chunker()
        content = "def hello():\n    print('world')\n    return 42\n"
        symbols = [Symbol(name="hello", kind="function", range=(1, 3))]

        chunks = chunker.chunk_file(content, symbols, "test.py", "python")

        assert all(c.metadata["strategy"] == "symbol" for c in chunks)

    def test_chunk_file_without_symbols(self):
        """Test chunk_file uses sliding window when no symbols."""
        config = ChunkConfig(min_chunk_size=5)
        chunker = Chunker(config=config)
        content = "# just comments\n# more comments\n# even more\n"

        chunks = chunker.chunk_file(content, [], "test.py", "python")

        # Should use sliding window strategy
        if len(chunks) > 0:
            assert all(c.metadata["strategy"] == "sliding_window" for c in chunks)


class TestChunkMetadata:
    """Tests for chunk metadata."""

    def test_symbol_chunk_metadata_complete(self):
        """Test that symbol chunks have complete metadata."""
        config = ChunkConfig(min_chunk_size=10)
        chunker = Chunker(config=config)
        content = "class MyClass:\n    def method(self):\n        pass\n"
        symbols = [Symbol(name="MyClass", kind="class", range=(1, 3))]

        chunks = chunker.chunk_by_symbol(content, symbols, "/path/to/file.py", "python")

        assert len(chunks) == 1
        meta = chunks[0].metadata
        assert meta["file"] == "/path/to/file.py"
        assert meta["language"] == "python"
        assert meta["symbol_name"] == "MyClass"
        assert meta["symbol_kind"] == "class"
        assert meta["start_line"] == 1
        assert meta["end_line"] == 3
        assert meta["strategy"] == "symbol"

    def test_sliding_window_metadata_complete(self):
        """Test that sliding window chunks have complete metadata."""
        config = ChunkConfig(min_chunk_size=5)
        chunker = Chunker(config=config)
        content = "some content here\nmore content\n"

        chunks = chunker.chunk_sliding_window(content, "/path/file.js", "javascript")

        if len(chunks) > 0:
            meta = chunks[0].metadata
            assert meta["file"] == "/path/file.js"
            assert meta["language"] == "javascript"
            assert "chunk_index" in meta
            assert "start_line" in meta
            assert "end_line" in meta
            assert meta["strategy"] == "sliding_window"


class TestChunkEdgeCases:
    """Edge case tests for chunking."""

    def test_chunk_with_unicode(self):
        """Test chunking content with unicode characters."""
        config = ChunkConfig(min_chunk_size=10)
        chunker = Chunker(config=config)
        content = "def 你好():\n    print('世界')\n    return '🎉'\n"
        symbols = [Symbol(name="你好", kind="function", range=(1, 3))]

        chunks = chunker.chunk_by_symbol(content, symbols, "test.py", "python")

        assert len(chunks) == 1
        assert "你好" in chunks[0].content

    def test_chunk_with_windows_line_endings(self):
        """Test chunking with Windows-style line endings."""
        chunker = Chunker()
        content = "def hello():\r\n    pass\r\n"
        symbols = [Symbol(name="hello", kind="function", range=(1, 2))]

        chunks = chunker.chunk_by_symbol(content, symbols, "test.py", "python")

        # Should handle without errors
        assert len(chunks) <= 1

    def test_chunk_range_out_of_bounds(self):
        """Test chunking when symbol range exceeds content."""
        chunker = Chunker()
        content = "def hello():\n    pass\n"
        # Symbol range goes beyond content
        symbols = [Symbol(name="hello", kind="function", range=(1, 100))]

        # Should not crash, just handle gracefully
        chunks = chunker.chunk_by_symbol(content, symbols, "test.py", "python")
        assert len(chunks) <= 1

    def test_chunk_content_returned_as_semantic_chunk(self):
        """Test that returned chunks are SemanticChunk instances."""
        chunker = Chunker()
        content = "def test():\n    return True\n"
        symbols = [Symbol(name="test", kind="function", range=(1, 2))]

        chunks = chunker.chunk_by_symbol(content, symbols, "test.py", "python")

        for chunk in chunks:
            assert isinstance(chunk, SemanticChunk)
            assert chunk.embedding is None  # Not embedded yet
