"""Tests for token-aware chunking functionality."""

import pytest

from codexlens.entities import SemanticChunk, Symbol
from codexlens.semantic.chunker import ChunkConfig, Chunker, HybridChunker
from codexlens.parsers.tokenizer import get_default_tokenizer


class TestTokenAwareChunking:
    """Tests for token counting integration in chunking."""

    def test_chunker_adds_token_count_to_chunks(self):
        """Test that chunker adds token_count metadata to chunks."""
        config = ChunkConfig(min_chunk_size=5)
        chunker = Chunker(config=config)

        content = '''def hello():
    return "world"

def goodbye():
    return "farewell"
'''
        symbols = [
            Symbol(name="hello", kind="function", range=(1, 2)),
            Symbol(name="goodbye", kind="function", range=(4, 5)),
        ]

        chunks = chunker.chunk_file(content, symbols, "test.py", "python")

        # All chunks should have token_count metadata
        assert all("token_count" in c.metadata for c in chunks)

        # Token counts should be positive integers
        for chunk in chunks:
            token_count = chunk.metadata["token_count"]
            assert isinstance(token_count, int)
            assert token_count > 0

    def test_chunker_accepts_precomputed_token_counts(self):
        """Test that chunker can accept precomputed token counts."""
        config = ChunkConfig(min_chunk_size=5)
        chunker = Chunker(config=config)

        content = '''def hello():
    return "world"
'''
        symbols = [Symbol(name="hello", kind="function", range=(1, 2))]

        # Provide precomputed token count
        symbol_token_counts = {"hello": 42}

        chunks = chunker.chunk_file(content, symbols, "test.py", "python", symbol_token_counts)

        assert len(chunks) == 1
        assert chunks[0].metadata["token_count"] == 42

    def test_sliding_window_includes_token_count(self):
        """Test that sliding window chunking includes token counts."""
        config = ChunkConfig(min_chunk_size=5, max_chunk_size=100)
        chunker = Chunker(config=config)

        # Create content without symbols to trigger sliding window
        content = "x = 1\ny = 2\nz = 3\n" * 20

        chunks = chunker.chunk_sliding_window(content, "test.py", "python")

        assert len(chunks) > 0
        for chunk in chunks:
            assert "token_count" in chunk.metadata
            assert chunk.metadata["token_count"] > 0

    def test_hybrid_chunker_adds_token_count(self):
        """Test that hybrid chunker adds token counts to all chunk types."""
        config = ChunkConfig(min_chunk_size=5)
        chunker = HybridChunker(config=config)

        content = '''"""Module docstring."""

def hello():
    """Function docstring."""
    return "world"
'''
        symbols = [Symbol(name="hello", kind="function", range=(3, 5))]

        chunks = chunker.chunk_file(content, symbols, "test.py", "python")

        # All chunks (docstrings and code) should have token_count
        assert all("token_count" in c.metadata for c in chunks)

        docstring_chunks = [c for c in chunks if c.metadata.get("chunk_type") == "docstring"]
        code_chunks = [c for c in chunks if c.metadata.get("chunk_type") == "code"]

        assert len(docstring_chunks) > 0
        assert len(code_chunks) > 0

        # Verify all have valid token counts
        for chunk in chunks:
            assert chunk.metadata["token_count"] > 0

    def test_token_count_matches_tiktoken(self):
        """Test that token counts match tiktoken output."""
        config = ChunkConfig(min_chunk_size=5)
        chunker = Chunker(config=config)
        tokenizer = get_default_tokenizer()

        content = '''def calculate(x, y):
    """Calculate sum of x and y."""
    return x + y
'''
        symbols = [Symbol(name="calculate", kind="function", range=(1, 3))]

        chunks = chunker.chunk_file(content, symbols, "test.py", "python")

        assert len(chunks) == 1
        chunk = chunks[0]

        # Manually count tokens for verification
        expected_count = tokenizer.count_tokens(chunk.content)
        assert chunk.metadata["token_count"] == expected_count

    def test_token_count_fallback_to_calculation(self):
        """Test that token count is calculated when not precomputed."""
        config = ChunkConfig(min_chunk_size=5)
        chunker = Chunker(config=config)

        content = '''def test():
    pass
'''
        symbols = [Symbol(name="test", kind="function", range=(1, 2))]

        # Don't provide symbol_token_counts - should calculate automatically
        chunks = chunker.chunk_file(content, symbols, "test.py", "python")

        assert len(chunks) == 1
        assert "token_count" in chunks[0].metadata
        assert chunks[0].metadata["token_count"] > 0


class TestTokenCountPerformance:
    """Tests for token counting performance optimization."""

    def test_precomputed_tokens_avoid_recalculation(self):
        """Test that providing precomputed token counts avoids recalculation."""
        import time

        config = ChunkConfig(min_chunk_size=5)
        chunker = Chunker(config=config)
        tokenizer = get_default_tokenizer()

        # Create larger content
        lines = []
        for i in range(100):
            lines.append(f'def func{i}(x):\n')
            lines.append(f'    return x * {i}\n')
            lines.append('\n')
        content = "".join(lines)

        symbols = [
            Symbol(name=f"func{i}", kind="function", range=(1 + i*3, 2 + i*3))
            for i in range(100)
        ]

        # Precompute token counts
        symbol_token_counts = {}
        for symbol in symbols:
            start_idx = symbol.range[0] - 1
            end_idx = symbol.range[1]
            chunk_content = "".join(content.splitlines(keepends=True)[start_idx:end_idx])
            symbol_token_counts[symbol.name] = tokenizer.count_tokens(chunk_content)

        # Time with precomputed counts (3 runs)
        precomputed_times = []
        for _ in range(3):
            start = time.perf_counter()
            chunker.chunk_file(content, symbols, "test.py", "python", symbol_token_counts)
            precomputed_times.append(time.perf_counter() - start)
        precomputed_time = sum(precomputed_times) / len(precomputed_times)

        # Time without precomputed counts (3 runs)
        computed_times = []
        for _ in range(3):
            start = time.perf_counter()
            chunker.chunk_file(content, symbols, "test.py", "python")
            computed_times.append(time.perf_counter() - start)
        computed_time = sum(computed_times) / len(computed_times)

        # Precomputed should be at least 10% faster
        speedup = ((computed_time - precomputed_time) / computed_time) * 100
        assert speedup >= 10.0, f"Speedup {speedup:.2f}% < 10% (computed={computed_time:.4f}s, precomputed={precomputed_time:.4f}s)"
