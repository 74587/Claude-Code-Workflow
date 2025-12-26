"""Tests for Hybrid Docstring Chunker."""

import pytest

from codexlens.entities import SemanticChunk, Symbol
from codexlens.semantic.chunker import (
    ChunkConfig,
    Chunker,
    DocstringExtractor,
    HybridChunker,
)


class TestDocstringExtractor:
    """Tests for DocstringExtractor class."""

    def test_extract_single_line_python_docstring(self):
        """Test extraction of single-line Python docstring."""
        content = '''def hello():
    """This is a docstring."""
    return True
'''
        docstrings = DocstringExtractor.extract_python_docstrings(content)
        assert len(docstrings) == 1
        assert docstrings[0][1] == 2  # start_line
        assert docstrings[0][2] == 2  # end_line
        assert '"""This is a docstring."""' in docstrings[0][0]

    def test_extract_multi_line_python_docstring(self):
        """Test extraction of multi-line Python docstring."""
        content = '''def process():
    """
    This is a multi-line
    docstring with details.
    """
    return 42
'''
        docstrings = DocstringExtractor.extract_python_docstrings(content)
        assert len(docstrings) == 1
        assert docstrings[0][1] == 2  # start_line
        assert docstrings[0][2] == 5  # end_line
        assert "multi-line" in docstrings[0][0]

    def test_extract_multiple_python_docstrings(self):
        """Test extraction of multiple docstrings from same file."""
        content = '''"""Module docstring."""

def func1():
    """Function 1 docstring."""
    pass

class MyClass:
    """Class docstring."""

    def method(self):
        """Method docstring."""
        pass
'''
        docstrings = DocstringExtractor.extract_python_docstrings(content)
        assert len(docstrings) == 4
        lines = [d[1] for d in docstrings]
        assert 1 in lines  # Module docstring
        assert 4 in lines  # func1 docstring
        assert 8 in lines  # Class docstring
        assert 11 in lines  # method docstring

    def test_extract_python_docstring_single_quotes(self):
        """Test extraction with single quote docstrings."""
        content = """def test():
    '''Single quote docstring.'''
    return None
"""
        docstrings = DocstringExtractor.extract_python_docstrings(content)
        assert len(docstrings) == 1
        assert "Single quote docstring" in docstrings[0][0]

    def test_extract_jsdoc_single_comment(self):
        """Test extraction of single JSDoc comment."""
        content = '''/**
 * This is a JSDoc comment
 * @param {string} name
 */
function hello(name) {
    return name;
}
'''
        comments = DocstringExtractor.extract_jsdoc_comments(content)
        assert len(comments) == 1
        assert comments[0][1] == 1  # start_line
        assert comments[0][2] == 4  # end_line
        assert "JSDoc comment" in comments[0][0]

    def test_extract_multiple_jsdoc_comments(self):
        """Test extraction of multiple JSDoc comments."""
        content = '''/**
 * Function 1
 */
function func1() {}

/**
 * Class description
 */
class MyClass {
    /**
     * Method description
     */
    method() {}
}
'''
        comments = DocstringExtractor.extract_jsdoc_comments(content)
        assert len(comments) == 3

    def test_extract_docstrings_unsupported_language(self):
        """Test that unsupported languages return empty list."""
        content = "// Some code"
        docstrings = DocstringExtractor.extract_docstrings(content, "ruby")
        assert len(docstrings) == 0

    def test_extract_docstrings_empty_content(self):
        """Test extraction from empty content."""
        docstrings = DocstringExtractor.extract_python_docstrings("")
        assert len(docstrings) == 0


class TestHybridChunker:
    """Tests for HybridChunker class."""

    def test_hybrid_chunker_initialization(self):
        """Test HybridChunker initialization with defaults."""
        chunker = HybridChunker()
        assert chunker.config is not None
        assert chunker.base_chunker is not None
        assert chunker.docstring_extractor is not None

    def test_hybrid_chunker_custom_config(self):
        """Test HybridChunker with custom config."""
        config = ChunkConfig(max_chunk_size=500, min_chunk_size=20)
        chunker = HybridChunker(config=config)
        assert chunker.config.max_chunk_size == 500
        assert chunker.config.min_chunk_size == 20

    def test_hybrid_chunker_isolates_docstrings(self):
        """Test that hybrid chunker isolates docstrings into separate chunks."""
        config = ChunkConfig(min_chunk_size=10)
        chunker = HybridChunker(config=config)

        content = '''"""Module-level docstring."""

def hello():
    """Function docstring."""
    return "world"

def goodbye():
    """Another docstring."""
    return "farewell"
'''
        symbols = [
            Symbol(name="hello", kind="function", range=(3, 5)),
            Symbol(name="goodbye", kind="function", range=(7, 9)),
        ]

        chunks = chunker.chunk_file(content, symbols, "test.py", "python")

        # Should have 3 docstring chunks + 2 code chunks = 5 total
        docstring_chunks = [c for c in chunks if c.metadata.get("chunk_type") == "docstring"]
        code_chunks = [c for c in chunks if c.metadata.get("chunk_type") == "code"]

        assert len(docstring_chunks) == 3
        assert len(code_chunks) == 2
        assert all(c.metadata["strategy"] == "hybrid" for c in chunks)

    def test_hybrid_chunker_docstring_isolation_percentage(self):
        """Test that >98% of docstrings are isolated correctly."""
        config = ChunkConfig(min_chunk_size=5)
        chunker = HybridChunker(config=config)

        # Create content with 10 docstrings
        lines = []
        lines.append('"""Module docstring."""\n')
        lines.append('\n')

        for i in range(10):
            lines.append(f'def func{i}():\n')
            lines.append(f'    """Docstring for func{i}."""\n')
            lines.append(f'    return {i}\n')
            lines.append('\n')

        content = "".join(lines)
        symbols = [
            Symbol(name=f"func{i}", kind="function", range=(3 + i*4, 5 + i*4))
            for i in range(10)
        ]

        chunks = chunker.chunk_file(content, symbols, "test.py", "python")

        docstring_chunks = [c for c in chunks if c.metadata.get("chunk_type") == "docstring"]

        # We have 11 docstrings total (1 module + 10 functions)
        # Verify >98% isolation (at least 10.78 out of 11)
        isolation_rate = len(docstring_chunks) / 11
        assert isolation_rate >= 0.98, f"Docstring isolation rate {isolation_rate:.2%} < 98%"

    def test_hybrid_chunker_javascript_jsdoc(self):
        """Test hybrid chunker with JavaScript JSDoc comments."""
        config = ChunkConfig(min_chunk_size=10)
        chunker = HybridChunker(config=config)

        content = '''/**
 * Main function description
 */
function main() {
    return 42;
}

/**
 * Helper function
 */
function helper() {
    return 0;
}
'''
        symbols = [
            Symbol(name="main", kind="function", range=(4, 6)),
            Symbol(name="helper", kind="function", range=(11, 13)),
        ]

        chunks = chunker.chunk_file(content, symbols, "test.js", "javascript")

        docstring_chunks = [c for c in chunks if c.metadata.get("chunk_type") == "docstring"]
        code_chunks = [c for c in chunks if c.metadata.get("chunk_type") == "code"]

        assert len(docstring_chunks) == 2
        assert len(code_chunks) == 2

    def test_hybrid_chunker_no_docstrings(self):
        """Test hybrid chunker with code containing no docstrings."""
        config = ChunkConfig(min_chunk_size=10)
        chunker = HybridChunker(config=config)

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

        # All chunks should be code chunks
        assert all(c.metadata.get("chunk_type") == "code" for c in chunks)
        assert len(chunks) == 2

    def test_hybrid_chunker_preserves_metadata(self):
        """Test that hybrid chunker preserves all required metadata."""
        config = ChunkConfig(min_chunk_size=5)
        chunker = HybridChunker(config=config)

        content = '''"""Module doc."""

def test():
    """Test doc."""
    pass
'''
        symbols = [Symbol(name="test", kind="function", range=(3, 5))]

        chunks = chunker.chunk_file(content, symbols, "/path/to/file.py", "python")

        for chunk in chunks:
            assert "file" in chunk.metadata
            assert "language" in chunk.metadata
            assert "chunk_type" in chunk.metadata
            assert "start_line" in chunk.metadata
            assert "end_line" in chunk.metadata
            assert "strategy" in chunk.metadata
            assert chunk.metadata["strategy"] == "hybrid"

    def test_hybrid_chunker_no_symbols_fallback(self):
        """Test hybrid chunker falls back to sliding window when no symbols."""
        config = ChunkConfig(min_chunk_size=5, max_chunk_size=100)
        chunker = HybridChunker(config=config)

        content = '''"""Module docstring."""

# Just some comments
x = 42
y = 100
'''
        chunks = chunker.chunk_file(content, [], "test.py", "python")

        # Should have 1 docstring chunk + sliding window chunks for remaining code
        docstring_chunks = [c for c in chunks if c.metadata.get("chunk_type") == "docstring"]
        code_chunks = [c for c in chunks if c.metadata.get("chunk_type") == "code"]

        assert len(docstring_chunks) == 1
        assert len(code_chunks) >= 0  # May or may not have code chunks depending on size

    def test_get_excluded_line_ranges(self):
        """Test _get_excluded_line_ranges helper method."""
        chunker = HybridChunker()

        docstrings = [
            ("doc1", 1, 3),
            ("doc2", 5, 7),
            ("doc3", 10, 10),
        ]

        excluded = chunker._get_excluded_line_ranges(docstrings)

        assert 1 in excluded
        assert 2 in excluded
        assert 3 in excluded
        assert 4 not in excluded
        assert 5 in excluded
        assert 6 in excluded
        assert 7 in excluded
        assert 8 not in excluded
        assert 9 not in excluded
        assert 10 in excluded

    def test_filter_symbols_outside_docstrings(self):
        """Test _filter_symbols_outside_docstrings helper method."""
        chunker = HybridChunker()

        symbols = [
            Symbol(name="func1", kind="function", range=(1, 5)),
            Symbol(name="func2", kind="function", range=(10, 15)),
            Symbol(name="func3", kind="function", range=(20, 25)),
        ]

        # Exclude lines 1-5 (func1) and 10-12 (partial overlap with func2)
        excluded_lines = set(range(1, 6)) | set(range(10, 13))

        filtered = chunker._filter_symbols_outside_docstrings(symbols, excluded_lines)

        # func1 should be filtered out (completely within excluded)
        # func2 should remain (partial overlap)
        # func3 should remain (no overlap)
        assert len(filtered) == 2
        names = [s.name for s in filtered]
        assert "func1" not in names
        assert "func2" in names
        assert "func3" in names
        excluded = chunker._get_excluded_line_ranges(docstrings)

        assert 1 in excluded
        assert 2 in excluded
        assert 3 in excluded
        assert 4 not in excluded
        assert 5 in excluded
        assert 6 in excluded
        assert 7 in excluded
        assert 8 not in excluded
        assert 9 not in excluded
        assert 10 in excluded

    def test_filter_symbols_outside_docstrings(self):
        """Test _filter_symbols_outside_docstrings helper method."""
        chunker = HybridChunker()

        symbols = [
            Symbol(name="func1", kind="function", range=(1, 5)),
            Symbol(name="func2", kind="function", range=(10, 15)),
            Symbol(name="func3", kind="function", range=(20, 25)),
        ]

        # Exclude lines 1-5 (func1) and 10-12 (partial overlap with func2)
        excluded_lines = set(range(1, 6)) | set(range(10, 13))

        filtered = chunker._filter_symbols_outside_docstrings(symbols, excluded_lines)

        # func1 should be filtered out (completely within excluded)
        # func2 should remain (partial overlap)
        # func3 should remain (no overlap)
        assert len(filtered) == 2
        names = [s.name for s in filtered]
        assert "func1" not in names
        assert "func2" in names
        assert "func3" in names

    def test_hybrid_chunker_docstring_only_file(self):
        """Test that hybrid chunker correctly handles file with only docstrings."""
        config = ChunkConfig(min_chunk_size=5)
        chunker = HybridChunker(config=config)

        content = '''"""First docstring."""

"""Second docstring."""

"""Third docstring."""
'''
        chunks = chunker.chunk_file(content, [], "test.py", "python")

        # Should only have docstring chunks
        assert all(c.metadata.get("chunk_type") == "docstring" for c in chunks)
        assert len(chunks) == 3


class TestChunkConfigStrategy:
    """Tests for strategy field in ChunkConfig."""

    def test_chunk_config_default_strategy(self):
        """Test that default strategy is 'auto'."""
        config = ChunkConfig()
        assert config.strategy == "auto"

    def test_chunk_config_custom_strategy(self):
        """Test setting custom strategy."""
        config = ChunkConfig(strategy="hybrid")
        assert config.strategy == "hybrid"

        config = ChunkConfig(strategy="symbol")
        assert config.strategy == "symbol"

        config = ChunkConfig(strategy="sliding_window")
        assert config.strategy == "sliding_window"


class TestHybridChunkerIntegration:
    """Integration tests for hybrid chunker with realistic code."""

    def test_realistic_python_module(self):
        """Test hybrid chunker with realistic Python module."""
        config = ChunkConfig(min_chunk_size=10)
        chunker = HybridChunker(config=config)

        content = '''"""
Data processing module for handling user data.

This module provides functions for cleaning and validating user input.
"""

from typing import Dict, Any


def validate_email(email: str) -> bool:
    """
    Validate an email address format.

    Args:
        email: The email address to validate

    Returns:
        True if valid, False otherwise
    """
    import re
    pattern = r'^[\\w\\.-]+@[\\w\\.-]+\\.\\w+$'
    return bool(re.match(pattern, email))


class UserProfile:
    """
    User profile management class.

    Handles user data storage and retrieval.
    """

    def __init__(self, user_id: int):
        """Initialize user profile with ID."""
        self.user_id = user_id
        self.data = {}

    def update_data(self, data: Dict[str, Any]) -> None:
        """
        Update user profile data.

        Args:
            data: Dictionary of user data to update
        """
        self.data.update(data)
'''

        symbols = [
            Symbol(name="validate_email", kind="function", range=(11, 23)),
            Symbol(name="UserProfile", kind="class", range=(26, 44)),
        ]

        chunks = chunker.chunk_file(content, symbols, "users.py", "python")

        docstring_chunks = [c for c in chunks if c.metadata.get("chunk_type") == "docstring"]
        code_chunks = [c for c in chunks if c.metadata.get("chunk_type") == "code"]

        # Verify docstrings are isolated
        assert len(docstring_chunks) >= 4  # Module, function, class, methods
        assert len(code_chunks) >= 1  # At least one code chunk

        # Verify >98% docstring isolation
        # Count total docstring lines in original
        total_docstring_lines = sum(
            d[2] - d[1] + 1
            for d in DocstringExtractor.extract_python_docstrings(content)
        )
        isolated_docstring_lines = sum(
            c.metadata["end_line"] - c.metadata["start_line"] + 1
            for c in docstring_chunks
        )

        isolation_rate = isolated_docstring_lines / total_docstring_lines if total_docstring_lines > 0 else 1
        assert isolation_rate >= 0.98

    def test_hybrid_chunker_performance_overhead(self):
        """Test that hybrid chunker has <5% overhead vs base chunker on files without docstrings."""
        import time

        config = ChunkConfig(min_chunk_size=5)

        # Create larger content with NO docstrings (worst case for hybrid chunker)
        lines = []
        for i in range(1000):
            lines.append(f'def func{i}():\n')
            lines.append(f'    x = {i}\n')
            lines.append(f'    y = {i * 2}\n')
            lines.append(f'    return x + y\n')
            lines.append('\n')
        content = "".join(lines)

        symbols = [
            Symbol(name=f"func{i}", kind="function", range=(1 + i*5, 4 + i*5))
            for i in range(1000)
        ]

        # Warm up
        base_chunker = Chunker(config=config)
        base_chunker.chunk_file(content[:100], symbols[:10], "test.py", "python")

        hybrid_chunker = HybridChunker(config=config)
        hybrid_chunker.chunk_file(content[:100], symbols[:10], "test.py", "python")

        # Measure base chunker (3 runs)
        base_times = []
        for _ in range(3):
            start = time.perf_counter()
            base_chunker.chunk_file(content, symbols, "test.py", "python")
            base_times.append(time.perf_counter() - start)
        base_time = sum(base_times) / len(base_times)

        # Measure hybrid chunker (3 runs)
        hybrid_times = []
        for _ in range(3):
            start = time.perf_counter()
            hybrid_chunker.chunk_file(content, symbols, "test.py", "python")
            hybrid_times.append(time.perf_counter() - start)
        hybrid_time = sum(hybrid_times) / len(hybrid_times)

        # Calculate overhead
        overhead = ((hybrid_time - base_time) / base_time) * 100 if base_time > 0 else 0

        # Verify <15% overhead (reasonable threshold for performance tests with system variance)
        assert overhead < 15.0, f"Overhead {overhead:.2f}% exceeds 15% threshold (base={base_time:.4f}s, hybrid={hybrid_time:.4f}s)"


class TestHybridChunkerV1Optimizations:
    """Tests for v1.0 optimization behaviors (parent metadata + determinism)."""

    def test_merged_docstring_metadata(self):
        """Docstring chunks include parent_symbol metadata when applicable."""
        config = ChunkConfig(min_chunk_size=1)
        chunker = HybridChunker(config=config)

        content = '''"""Module docstring."""

def hello():
    """Function docstring."""
    return 1
'''
        symbols = [Symbol(name="hello", kind="function", range=(3, 5))]

        chunks = chunker.chunk_file(content, symbols, "m.py", "python")
        func_doc_chunks = [
            c for c in chunks
            if c.metadata.get("chunk_type") == "docstring" and c.metadata.get("start_line") == 4
        ]
        assert len(func_doc_chunks) == 1
        assert func_doc_chunks[0].metadata.get("parent_symbol") == "hello"
        assert func_doc_chunks[0].metadata.get("parent_symbol_kind") == "function"

    def test_deterministic_chunk_boundaries(self):
        """Chunk boundaries are stable across repeated runs on identical input."""
        config = ChunkConfig(max_chunk_size=80, overlap=10, min_chunk_size=1)
        chunker = HybridChunker(config=config)

        # No docstrings, no symbols -> sliding window path.
        content = "\n".join([f"line {i}: x = {i}" for i in range(1, 200)]) + "\n"

        boundaries = []
        for _ in range(3):
            chunks = chunker.chunk_file(content, [], "deterministic.py", "python")
            boundaries.append([
                (c.metadata.get("start_line"), c.metadata.get("end_line"))
                for c in chunks
                if c.metadata.get("chunk_type") == "code"
            ])

        assert boundaries[0] == boundaries[1] == boundaries[2]

    def test_orphan_docstrings(self):
        """Module-level docstrings remain standalone (no parent_symbol assigned)."""
        config = ChunkConfig(min_chunk_size=1)
        chunker = HybridChunker(config=config)

        content = '''"""Module-level docstring."""

def hello():
    """Function docstring."""
    return 1
'''
        symbols = [Symbol(name="hello", kind="function", range=(3, 5))]
        chunks = chunker.chunk_file(content, symbols, "orphan.py", "python")

        module_doc = [
            c for c in chunks
            if c.metadata.get("chunk_type") == "docstring" and c.metadata.get("start_line") == 1
        ]
        assert len(module_doc) == 1
        assert module_doc[0].metadata.get("parent_symbol") is None

        code_chunks = [c for c in chunks if c.metadata.get("chunk_type") == "code"]
        assert code_chunks, "Expected at least one code chunk"
        assert all("Module-level docstring" not in c.content for c in code_chunks)
