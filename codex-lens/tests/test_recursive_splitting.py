"""Tests for recursive splitting of large symbols in chunker."""

import pytest
from codexlens.entities import Symbol
from codexlens.semantic.chunker import Chunker, ChunkConfig


class TestRecursiveSplitting:
    """Test cases for recursive splitting of large symbols."""

    def test_small_symbol_no_split(self):
        """Test that small symbols are not split."""
        config = ChunkConfig(max_chunk_size=1000, overlap=100)
        chunker = Chunker(config)

        content = '''def small_function():
    # This is a small function
    x = 1
    y = 2
    return x + y
'''
        symbols = [Symbol(name='small_function', kind='function', range=(1, 5))]

        chunks = chunker.chunk_by_symbol(content, symbols, 'test.py', 'python')

        assert len(chunks) == 1
        assert chunks[0].metadata['strategy'] == 'symbol'
        assert chunks[0].metadata['symbol_name'] == 'small_function'
        assert chunks[0].metadata['symbol_kind'] == 'function'
        assert 'parent_symbol_range' not in chunks[0].metadata

    def test_large_symbol_splits(self):
        """Test that large symbols are recursively split."""
        config = ChunkConfig(max_chunk_size=100, overlap=20)
        chunker = Chunker(config)

        content = '''def large_function():
    # Line 1
    # Line 2
    # Line 3
    # Line 4
    # Line 5
    # Line 6
    # Line 7
    # Line 8
    # Line 9
    # Line 10
    # Line 11
    # Line 12
    # Line 13
    # Line 14
    # Line 15
    pass
'''
        symbols = [Symbol(name='large_function', kind='function', range=(1, 18))]

        chunks = chunker.chunk_by_symbol(content, symbols, 'test.py', 'python')

        # Should be split into multiple chunks
        assert len(chunks) > 1

        # All chunks should have symbol metadata
        for chunk in chunks:
            assert chunk.metadata['strategy'] == 'symbol_split'
            assert chunk.metadata['symbol_name'] == 'large_function'
            assert chunk.metadata['symbol_kind'] == 'function'
            assert chunk.metadata['parent_symbol_range'] == (1, 18)

    def test_boundary_condition(self):
        """Test symbol exactly at max_chunk_size boundary."""
        config = ChunkConfig(max_chunk_size=90, overlap=20)
        chunker = Chunker(config)

        content = '''def boundary_function():
    # This function is exactly at boundary
    x = 1
    y = 2
    return x + y
'''
        symbols = [Symbol(name='boundary_function', kind='function', range=(1, 5))]

        chunks = chunker.chunk_by_symbol(content, symbols, 'test.py', 'python')

        # Content is slightly over 90 chars, should be split
        assert len(chunks) >= 1
        assert chunks[0].metadata['strategy'] == 'symbol_split'

    def test_multiple_symbols_mixed_sizes(self):
        """Test chunking with multiple symbols of different sizes."""
        config = ChunkConfig(max_chunk_size=150, overlap=30)
        chunker = Chunker(config)

        content = '''def small():
    return 1

def medium():
    # Medium function
    x = 1
    y = 2
    z = 3
    return x + y + z

def very_large():
    # Line 1
    # Line 2
    # Line 3
    # Line 4
    # Line 5
    # Line 6
    # Line 7
    # Line 8
    # Line 9
    # Line 10
    # Line 11
    # Line 12
    # Line 13
    # Line 14
    # Line 15
    pass
'''
        symbols = [
            Symbol(name='small', kind='function', range=(1, 2)),
            Symbol(name='medium', kind='function', range=(4, 9)),
            Symbol(name='very_large', kind='function', range=(11, 28)),
        ]

        chunks = chunker.chunk_by_symbol(content, symbols, 'test.py', 'python')

        # Find chunks for each symbol
        small_chunks = [c for c in chunks if c.metadata['symbol_name'] == 'small']
        medium_chunks = [c for c in chunks if c.metadata['symbol_name'] == 'medium']
        large_chunks = [c for c in chunks if c.metadata['symbol_name'] == 'very_large']

        # Small should be filtered (< min_chunk_size)
        assert len(small_chunks) == 0

        # Medium should not be split
        assert len(medium_chunks) == 1
        assert medium_chunks[0].metadata['strategy'] == 'symbol'

        # Large should be split
        assert len(large_chunks) > 1
        for chunk in large_chunks:
            assert chunk.metadata['strategy'] == 'symbol_split'

    def test_line_numbers_preserved(self):
        """Test that line numbers are correctly preserved in sub-chunks."""
        config = ChunkConfig(max_chunk_size=100, overlap=20)
        chunker = Chunker(config)

        content = '''def large_function():
    # Line 1 with some extra content to make it longer
    # Line 2 with some extra content to make it longer
    # Line 3 with some extra content to make it longer
    # Line 4 with some extra content to make it longer
    # Line 5 with some extra content to make it longer
    # Line 6 with some extra content to make it longer
    # Line 7 with some extra content to make it longer
    # Line 8 with some extra content to make it longer
    # Line 9 with some extra content to make it longer
    # Line 10 with some extra content to make it longer
    pass
'''
        symbols = [Symbol(name='large_function', kind='function', range=(1, 13))]

        chunks = chunker.chunk_by_symbol(content, symbols, 'test.py', 'python')

        # Verify line numbers are correct and sequential
        assert len(chunks) > 1
        assert chunks[0].metadata['start_line'] == 1

        # Each chunk should have valid line numbers
        for chunk in chunks:
            assert chunk.metadata['start_line'] >= 1
            assert chunk.metadata['end_line'] <= 13
            assert chunk.metadata['start_line'] <= chunk.metadata['end_line']

    def test_overlap_in_split_chunks(self):
        """Test that overlap is applied when splitting large symbols."""
        config = ChunkConfig(max_chunk_size=100, overlap=30)
        chunker = Chunker(config)

        content = '''def large_function():
    # Line 1
    # Line 2
    # Line 3
    # Line 4
    # Line 5
    # Line 6
    # Line 7
    # Line 8
    # Line 9
    # Line 10
    # Line 11
    # Line 12
    pass
'''
        symbols = [Symbol(name='large_function', kind='function', range=(1, 14))]

        chunks = chunker.chunk_by_symbol(content, symbols, 'test.py', 'python')

        # With overlap, consecutive chunks should overlap
        if len(chunks) > 1:
            for i in range(len(chunks) - 1):
                # Next chunk should start before current chunk ends (overlap)
                current_end = chunks[i].metadata['end_line']
                next_start = chunks[i + 1].metadata['start_line']
                # Overlap should exist
                assert next_start <= current_end

    def test_empty_symbol_filtered(self):
        """Test that symbols smaller than min_chunk_size are filtered."""
        config = ChunkConfig(max_chunk_size=1000, min_chunk_size=50)
        chunker = Chunker(config)

        content = '''def tiny():
    pass
'''
        symbols = [Symbol(name='tiny', kind='function', range=(1, 2))]

        chunks = chunker.chunk_by_symbol(content, symbols, 'test.py', 'python')

        # Should be filtered due to min_chunk_size
        assert len(chunks) == 0

    def test_class_symbol_splits(self):
        """Test that large class symbols are also split correctly."""
        config = ChunkConfig(max_chunk_size=120, overlap=25)
        chunker = Chunker(config)

        content = '''class LargeClass:
    """A large class with many methods."""

    def method1(self):
        return 1

    def method2(self):
        return 2

    def method3(self):
        return 3

    def method4(self):
        return 4
'''
        symbols = [Symbol(name='LargeClass', kind='class', range=(1, 14))]

        chunks = chunker.chunk_by_symbol(content, symbols, 'test.py', 'python')

        # Should be split
        assert len(chunks) > 1

        # All chunks should preserve class metadata
        for chunk in chunks:
            assert chunk.metadata['symbol_name'] == 'LargeClass'
            assert chunk.metadata['symbol_kind'] == 'class'
            assert chunk.metadata['strategy'] == 'symbol_split'


class TestLightweightMode:
    """Test recursive splitting with lightweight token counting."""

    def test_large_symbol_splits_lightweight_mode(self):
        """Test that large symbols split correctly in lightweight mode."""
        config = ChunkConfig(max_chunk_size=100, overlap=20, skip_token_count=True)
        chunker = Chunker(config)

        content = '''def large_function():
    # Line 1 with some extra content to make it longer
    # Line 2 with some extra content to make it longer
    # Line 3 with some extra content to make it longer
    # Line 4 with some extra content to make it longer
    # Line 5 with some extra content to make it longer
    # Line 6 with some extra content to make it longer
    # Line 7 with some extra content to make it longer
    # Line 8 with some extra content to make it longer
    # Line 9 with some extra content to make it longer
    # Line 10 with some extra content to make it longer
    pass
'''
        symbols = [Symbol(name='large_function', kind='function', range=(1, 13))]

        chunks = chunker.chunk_by_symbol(content, symbols, 'test.py', 'python')

        # Should split even in lightweight mode
        assert len(chunks) > 1

        # All chunks should have token_count (estimated)
        for chunk in chunks:
            assert 'token_count' in chunk.metadata
            assert chunk.metadata['token_count'] > 0
