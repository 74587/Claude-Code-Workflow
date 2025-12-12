"""Tests for code extractor functionality."""

import tempfile
from pathlib import Path

import pytest

from codexlens.entities import SearchResult, Symbol
from codexlens.semantic.code_extractor import (
    CodeBlockResult,
    extract_complete_code_block,
    extract_symbol_with_context,
    format_search_result_code,
    get_code_block_summary,
    enhance_search_results,
)


class TestExtractCompleteCodeBlock:
    """Test extract_complete_code_block function."""

    def test_returns_stored_content(self):
        """Test returns content when available in result."""
        result = SearchResult(
            path="/test.py",
            score=0.9,
            content="def hello():\n    return 'world'",
            start_line=1,
            end_line=2,
        )
        
        code = extract_complete_code_block(result)
        assert code == "def hello():\n    return 'world'"

    def test_reads_from_file_when_no_content(self, tmp_path):
        """Test reads from file when content not in result."""
        test_file = tmp_path / "test.py"
        test_file.write_text("""# Header comment
def hello():
    '''Docstring'''
    return 'world'

def goodbye():
    pass
""")
        
        result = SearchResult(
            path=str(test_file),
            score=0.9,
            excerpt="def hello():",
            start_line=2,
            end_line=4,
        )
        
        code = extract_complete_code_block(result)
        assert "def hello():" in code
        assert "return 'world'" in code

    def test_adds_context_lines(self, tmp_path):
        """Test adding context lines."""
        test_file = tmp_path / "test.py"
        test_file.write_text("""# Line 1
# Line 2
def hello():
    return 'world'
# Line 5
# Line 6
""")
        
        result = SearchResult(
            path=str(test_file),
            score=0.9,
            start_line=3,
            end_line=4,
        )
        
        code = extract_complete_code_block(result, context_lines=1)
        assert "# Line 2" in code
        assert "# Line 5" in code


class TestExtractSymbolWithContext:
    """Test extract_symbol_with_context function."""

    def test_extracts_with_decorators(self, tmp_path):
        """Test extracting symbol with decorators."""
        test_file = tmp_path / "test.py"
        # Line 1: @decorator
        # Line 2: @another_decorator
        # Line 3: def hello():
        # Line 4:     return 'world'
        test_file.write_text("@decorator\n@another_decorator\ndef hello():\n    return 'world'\n")
        
        symbol = Symbol(name="hello", kind="function", range=(3, 4))
        code = extract_symbol_with_context(str(test_file), symbol)
        
        assert "@decorator" in code
        assert "@another_decorator" in code
        assert "def hello():" in code


class TestFormatSearchResultCode:
    """Test format_search_result_code function."""

    def test_format_with_line_numbers(self):
        """Test formatting with line numbers."""
        result = SearchResult(
            path="/test.py",
            score=0.9,
            content="def hello():\n    return 'world'",
            start_line=10,
            end_line=11,
        )
        
        formatted = format_search_result_code(result, show_line_numbers=True)
        assert "  10 |" in formatted
        assert "  11 |" in formatted

    def test_format_truncation(self):
        """Test max_lines truncation."""
        result = SearchResult(
            path="/test.py",
            score=0.9,
            content="line1\nline2\nline3\nline4\nline5",
            start_line=1,
            end_line=5,
        )
        
        formatted = format_search_result_code(result, max_lines=2)
        assert "(truncated)" in formatted

    def test_format_without_line_numbers(self):
        """Test formatting without line numbers."""
        result = SearchResult(
            path="/test.py",
            score=0.9,
            content="def hello():\n    pass",
            start_line=1,
            end_line=2,
        )
        
        formatted = format_search_result_code(result, show_line_numbers=False)
        assert "def hello():" in formatted
        assert " | " not in formatted


class TestGetCodeBlockSummary:
    """Test get_code_block_summary function."""

    def test_summary_with_symbol(self):
        """Test summary with symbol info."""
        result = SearchResult(
            path="/test.py",
            score=0.9,
            symbol_name="hello",
            symbol_kind="function",
            start_line=10,
            end_line=20,
        )
        
        summary = get_code_block_summary(result)
        assert "function" in summary
        assert "hello" in summary
        assert "10-20" in summary
        assert "test.py" in summary

    def test_summary_single_line(self):
        """Test summary for single line."""
        result = SearchResult(
            path="/test.py",
            score=0.9,
            start_line=5,
            end_line=5,
        )
        
        summary = get_code_block_summary(result)
        assert "line 5" in summary


class TestCodeBlockResult:
    """Test CodeBlockResult class."""

    def test_properties(self):
        """Test CodeBlockResult properties."""
        result = SearchResult(
            path="/path/to/test.py",
            score=0.85,
            content="def hello(): pass",
            symbol_name="hello",
            symbol_kind="function",
            start_line=1,
            end_line=1,
        )
        
        block = CodeBlockResult(result)
        
        assert block.score == 0.85
        assert block.path == "/path/to/test.py"
        assert block.file_name == "test.py"
        assert block.symbol_name == "hello"
        assert block.symbol_kind == "function"
        assert block.line_range == (1, 1)
        assert block.full_code == "def hello(): pass"

    def test_summary(self):
        """Test CodeBlockResult summary."""
        result = SearchResult(
            path="/test.py",
            score=0.9,
            symbol_name="Calculator",
            symbol_kind="class",
            start_line=10,
            end_line=50,
        )
        
        block = CodeBlockResult(result)
        summary = block.summary
        
        assert "class" in summary
        assert "Calculator" in summary

    def test_format(self):
        """Test CodeBlockResult format."""
        result = SearchResult(
            path="/test.py",
            score=0.9,
            content="def hello():\n    return 42",
            start_line=1,
            end_line=2,
        )
        
        block = CodeBlockResult(result)
        formatted = block.format(show_line_numbers=True)
        
        assert "   1 |" in formatted
        assert "def hello():" in formatted


class TestEnhanceSearchResults:
    """Test enhance_search_results function."""

    def test_enhances_results(self):
        """Test enhancing search results."""
        results = [
            SearchResult(path="/a.py", score=0.9, content="def a(): pass"),
            SearchResult(path="/b.py", score=0.8, content="def b(): pass"),
        ]
        
        enhanced = enhance_search_results(results)
        
        assert len(enhanced) == 2
        assert all(isinstance(r, CodeBlockResult) for r in enhanced)
        assert enhanced[0].score == 0.9
        assert enhanced[1].score == 0.8


class TestIntegration:
    """Integration tests for code extraction."""

    def test_full_workflow(self, tmp_path):
        """Test complete code extraction workflow."""
        # Create test file
        test_file = tmp_path / "calculator.py"
        test_file.write_text('''"""Calculator module."""

@staticmethod
def add(a: int, b: int) -> int:
    """Add two numbers.
    
    Args:
        a: First number
        b: Second number
    
    Returns:
        Sum of a and b
    """
    return a + b

class Calculator:
    """A simple calculator."""
    
    def __init__(self):
        self.result = 0
    
    def compute(self, operation: str, value: int) -> int:
        """Perform computation."""
        if operation == "add":
            self.result += value
        elif operation == "sub":
            self.result -= value
        return self.result
''')

        # Simulate search result for 'add' function
        result = SearchResult(
            path=str(test_file),
            score=0.92,
            content='''@staticmethod
def add(a: int, b: int) -> int:
    """Add two numbers.
    
    Args:
        a: First number
        b: Second number
    
    Returns:
        Sum of a and b
    """
    return a + b''',
            symbol_name="add",
            symbol_kind="function",
            start_line=3,
            end_line=14,
        )
        
        block = CodeBlockResult(result)
        
        # Test properties
        assert block.symbol_name == "add"
        assert block.symbol_kind == "function"
        assert block.line_range == (3, 14)
        
        # Test full code
        assert "@staticmethod" in block.full_code
        assert "def add(" in block.full_code
        assert "return a + b" in block.full_code
        
        # Test summary
        summary = block.summary
        assert "function" in summary
        assert "add" in summary
        
        # Test format
        formatted = block.format(show_line_numbers=True)
        assert "   3 |" in formatted or "3 |" in formatted
        
        print("\n--- Full Code Block ---")
        print(block.full_code)
        print("\n--- Formatted Output ---")
        print(formatted)
        print("\n--- Summary ---")
        print(summary)
