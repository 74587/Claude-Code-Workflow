"""Integration tests for multi-level parser system.

Verifies:
1. Tree-sitter primary, regex fallback
2. Tiktoken integration with character count fallback
3. >99% symbol extraction accuracy
4. Graceful degradation when dependencies unavailable
"""

from pathlib import Path

import pytest

from codexlens.parsers.factory import SimpleRegexParser
from codexlens.parsers.tokenizer import Tokenizer, TIKTOKEN_AVAILABLE
from codexlens.parsers.treesitter_parser import TreeSitterSymbolParser, TREE_SITTER_AVAILABLE


class TestMultiLevelFallback:
    """Tests for multi-tier fallback pattern."""

    def test_treesitter_available_uses_ast(self):
        """Verify tree-sitter is used when available."""
        parser = TreeSitterSymbolParser("python")
        assert parser.is_available() == TREE_SITTER_AVAILABLE

    def test_regex_fallback_always_works(self):
        """Verify regex parser always works."""
        parser = SimpleRegexParser("python")
        code = "def hello():\n    pass"
        result = parser.parse(code, Path("test.py"))

        assert result is not None
        assert len(result.symbols) == 1
        assert result.symbols[0].name == "hello"

    def test_unsupported_language_uses_generic(self):
        """Verify generic parser for unsupported languages."""
        parser = SimpleRegexParser("rust")
        code = "fn main() {}"
        result = parser.parse(code, Path("test.rs"))

        # Should use generic parser
        assert result is not None
        # May or may not find symbols depending on generic patterns


class TestTokenizerFallback:
    """Tests for tokenizer fallback behavior."""

    def test_character_fallback_when_tiktoken_unavailable(self):
        """Verify character counting works without tiktoken."""
        # Use invalid encoding to force fallback
        tokenizer = Tokenizer(encoding_name="invalid_encoding")
        text = "Hello world"

        count = tokenizer.count_tokens(text)
        assert count == max(1, len(text) // 4)
        assert not tokenizer.is_using_tiktoken()

    def test_tiktoken_used_when_available(self):
        """Verify tiktoken is used when available."""
        tokenizer = Tokenizer()
        # Should match TIKTOKEN_AVAILABLE
        assert tokenizer.is_using_tiktoken() == TIKTOKEN_AVAILABLE


class TestSymbolExtractionAccuracy:
    """Tests for >99% symbol extraction accuracy requirement."""

    @pytest.mark.skipif(not TREE_SITTER_AVAILABLE, reason="tree-sitter not installed")
    def test_python_comprehensive_accuracy(self):
        """Test comprehensive Python symbol extraction."""
        parser = TreeSitterSymbolParser("python")
        code = """
# Test comprehensive symbol extraction
import os

CONSTANT = 42

def top_level_function():
    pass

async def async_top_level():
    pass

class FirstClass:
    class_var = 10

    def __init__(self):
        pass

    def method_one(self):
        pass

    def method_two(self):
        pass

    @staticmethod
    def static_method():
        pass

    @classmethod
    def class_method(cls):
        pass

    async def async_method(self):
        pass

def outer_function():
    def inner_function():
        pass
    return inner_function

class SecondClass:
    def another_method(self):
        pass

async def final_async_function():
    pass
"""
        result = parser.parse(code, Path("test.py"))

        assert result is not None

        # Expected symbols (excluding CONSTANT, comments, decorators):
        # top_level_function, async_top_level, FirstClass, __init__,
        # method_one, method_two, static_method, class_method, async_method,
        # outer_function, inner_function, SecondClass, another_method,
        # final_async_function

        expected_names = {
            "top_level_function", "async_top_level", "FirstClass",
            "__init__", "method_one", "method_two", "static_method",
            "class_method", "async_method", "outer_function",
            "inner_function", "SecondClass", "another_method",
            "final_async_function"
        }

        found_names = {s.name for s in result.symbols}

        # Calculate accuracy
        matches = expected_names & found_names
        accuracy = len(matches) / len(expected_names) * 100

        print(f"\nSymbol extraction accuracy: {accuracy:.1f}%")
        print(f"Expected: {len(expected_names)}, Found: {len(found_names)}, Matched: {len(matches)}")
        print(f"Missing: {expected_names - found_names}")
        print(f"Extra: {found_names - expected_names}")

        # Require >99% accuracy
        assert accuracy > 99.0, f"Accuracy {accuracy:.1f}% below 99% threshold"

    @pytest.mark.skipif(not TREE_SITTER_AVAILABLE, reason="tree-sitter not installed")
    def test_javascript_comprehensive_accuracy(self):
        """Test comprehensive JavaScript symbol extraction."""
        parser = TreeSitterSymbolParser("javascript")
        code = """
function regularFunction() {}

const arrowFunc = () => {}

async function asyncFunc() {}

const asyncArrow = async () => {}

class MainClass {
    constructor() {}

    method() {}

    async asyncMethod() {}

    static staticMethod() {}
}

export function exportedFunc() {}

export const exportedArrow = () => {}

export class ExportedClass {
    method() {}
}

function outer() {
    function inner() {}
}
"""
        result = parser.parse(code, Path("test.js"))

        assert result is not None

        # Expected symbols (excluding constructor):
        # regularFunction, arrowFunc, asyncFunc, asyncArrow, MainClass,
        # method, asyncMethod, staticMethod, exportedFunc, exportedArrow,
        # ExportedClass, method (from ExportedClass), outer, inner

        expected_names = {
            "regularFunction", "arrowFunc", "asyncFunc", "asyncArrow",
            "MainClass", "method", "asyncMethod", "staticMethod",
            "exportedFunc", "exportedArrow", "ExportedClass", "outer", "inner"
        }

        found_names = {s.name for s in result.symbols}

        # Calculate accuracy
        matches = expected_names & found_names
        accuracy = len(matches) / len(expected_names) * 100

        print(f"\nJavaScript symbol extraction accuracy: {accuracy:.1f}%")
        print(f"Expected: {len(expected_names)}, Found: {len(found_names)}, Matched: {len(matches)}")

        # Require >99% accuracy
        assert accuracy > 99.0, f"Accuracy {accuracy:.1f}% below 99% threshold"


class TestGracefulDegradation:
    """Tests for graceful degradation when dependencies missing."""

    def test_system_functional_without_tiktoken(self):
        """Verify system works without tiktoken."""
        # Force fallback
        tokenizer = Tokenizer(encoding_name="invalid")
        assert not tokenizer.is_using_tiktoken()

        # Should still work
        count = tokenizer.count_tokens("def hello(): pass")
        assert count > 0

    def test_system_functional_without_treesitter(self):
        """Verify system works without tree-sitter."""
        # Use regex parser directly
        parser = SimpleRegexParser("python")
        code = "def hello():\n    pass"
        result = parser.parse(code, Path("test.py"))

        assert result is not None
        assert len(result.symbols) == 1

    def test_treesitter_parser_returns_none_for_unsupported(self):
        """Verify TreeSitterParser returns None for unsupported languages."""
        parser = TreeSitterSymbolParser("rust")  # Not supported
        assert not parser.is_available()

        result = parser.parse("fn main() {}", Path("test.rs"))
        assert result is None


class TestRealWorldFiles:
    """Tests with real-world code examples."""

    @pytest.mark.skipif(not TREE_SITTER_AVAILABLE, reason="tree-sitter not installed")
    def test_parser_on_own_source(self):
        """Test parser on its own source code."""
        parser = TreeSitterSymbolParser("python")

        # Read the parser module itself
        parser_file = Path(__file__).parent.parent / "src" / "codexlens" / "parsers" / "treesitter_parser.py"
        if parser_file.exists():
            code = parser_file.read_text(encoding="utf-8")
            result = parser.parse(code, parser_file)

            assert result is not None
            # Should find the TreeSitterSymbolParser class and its methods
            names = {s.name for s in result.symbols}
            assert "TreeSitterSymbolParser" in names

    def test_tokenizer_on_own_source(self):
        """Test tokenizer on its own source code."""
        tokenizer = Tokenizer()

        # Read the tokenizer module itself
        tokenizer_file = Path(__file__).parent.parent / "src" / "codexlens" / "parsers" / "tokenizer.py"
        if tokenizer_file.exists():
            code = tokenizer_file.read_text(encoding="utf-8")
            count = tokenizer.count_tokens(code)

            # Should get reasonable token count
            assert count > 0
            # File is several hundred characters, should be 50+ tokens
            assert count > 50
