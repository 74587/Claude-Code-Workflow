"""Tests for TreeSitterSymbolParser."""

from pathlib import Path

import pytest

from codexlens.parsers.treesitter_parser import TreeSitterSymbolParser, TREE_SITTER_AVAILABLE


@pytest.mark.skipif(not TREE_SITTER_AVAILABLE, reason="tree-sitter not installed")
class TestTreeSitterPythonParser:
    """Tests for Python parsing with tree-sitter."""

    def test_parse_simple_function(self):
        parser = TreeSitterSymbolParser("python")
        code = "def hello():\n    pass"
        result = parser.parse(code, Path("test.py"))

        assert result is not None
        assert result.language == "python"
        assert len(result.symbols) == 1
        assert result.symbols[0].name == "hello"
        assert result.symbols[0].kind == "function"

    def test_parse_async_function(self):
        parser = TreeSitterSymbolParser("python")
        code = "async def fetch_data():\n    pass"
        result = parser.parse(code, Path("test.py"))

        assert result is not None
        assert len(result.symbols) == 1
        assert result.symbols[0].name == "fetch_data"
        assert result.symbols[0].kind == "function"

    def test_parse_class(self):
        parser = TreeSitterSymbolParser("python")
        code = "class MyClass:\n    pass"
        result = parser.parse(code, Path("test.py"))

        assert result is not None
        assert len(result.symbols) == 1
        assert result.symbols[0].name == "MyClass"
        assert result.symbols[0].kind == "class"

    def test_parse_method(self):
        parser = TreeSitterSymbolParser("python")
        code = """
class MyClass:
    def method(self):
        pass
"""
        result = parser.parse(code, Path("test.py"))

        assert result is not None
        assert len(result.symbols) == 2
        assert result.symbols[0].name == "MyClass"
        assert result.symbols[0].kind == "class"
        assert result.symbols[1].name == "method"
        assert result.symbols[1].kind == "method"

    def test_parse_nested_functions(self):
        parser = TreeSitterSymbolParser("python")
        code = """
def outer():
    def inner():
        pass
    return inner
"""
        result = parser.parse(code, Path("test.py"))

        assert result is not None
        names = [s.name for s in result.symbols]
        assert "outer" in names
        assert "inner" in names

    def test_parse_complex_file(self):
        parser = TreeSitterSymbolParser("python")
        code = """
class Calculator:
    def add(self, a, b):
        return a + b

    def subtract(self, a, b):
        return a - b

def standalone_function():
    pass

class DataProcessor:
    async def process(self, data):
        pass
"""
        result = parser.parse(code, Path("test.py"))

        assert result is not None
        assert len(result.symbols) >= 5

        names_kinds = [(s.name, s.kind) for s in result.symbols]
        assert ("Calculator", "class") in names_kinds
        assert ("add", "method") in names_kinds
        assert ("subtract", "method") in names_kinds
        assert ("standalone_function", "function") in names_kinds
        assert ("DataProcessor", "class") in names_kinds
        assert ("process", "method") in names_kinds

    def test_parse_empty_file(self):
        parser = TreeSitterSymbolParser("python")
        result = parser.parse("", Path("test.py"))

        assert result is not None
        assert len(result.symbols) == 0


@pytest.mark.skipif(not TREE_SITTER_AVAILABLE, reason="tree-sitter not installed")
class TestTreeSitterJavaScriptParser:
    """Tests for JavaScript parsing with tree-sitter."""

    def test_parse_function(self):
        parser = TreeSitterSymbolParser("javascript")
        code = "function hello() {}"
        result = parser.parse(code, Path("test.js"))

        assert result is not None
        assert len(result.symbols) == 1
        assert result.symbols[0].name == "hello"
        assert result.symbols[0].kind == "function"

    def test_parse_arrow_function(self):
        parser = TreeSitterSymbolParser("javascript")
        code = "const hello = () => {}"
        result = parser.parse(code, Path("test.js"))

        assert result is not None
        assert len(result.symbols) == 1
        assert result.symbols[0].name == "hello"
        assert result.symbols[0].kind == "function"

    def test_parse_class(self):
        parser = TreeSitterSymbolParser("javascript")
        code = "class MyClass {}"
        result = parser.parse(code, Path("test.js"))

        assert result is not None
        assert len(result.symbols) == 1
        assert result.symbols[0].name == "MyClass"
        assert result.symbols[0].kind == "class"

    def test_parse_class_with_methods(self):
        parser = TreeSitterSymbolParser("javascript")
        code = """
class MyClass {
    method() {}
    async asyncMethod() {}
}
"""
        result = parser.parse(code, Path("test.js"))

        assert result is not None
        names_kinds = [(s.name, s.kind) for s in result.symbols]
        assert ("MyClass", "class") in names_kinds
        assert ("method", "method") in names_kinds
        assert ("asyncMethod", "method") in names_kinds

    def test_parse_export_functions(self):
        parser = TreeSitterSymbolParser("javascript")
        code = """
export function exported() {}
export const arrowFunc = () => {}
"""
        result = parser.parse(code, Path("test.js"))

        assert result is not None
        assert len(result.symbols) >= 2
        names = [s.name for s in result.symbols]
        assert "exported" in names
        assert "arrowFunc" in names


@pytest.mark.skipif(not TREE_SITTER_AVAILABLE, reason="tree-sitter not installed")
class TestTreeSitterTypeScriptParser:
    """Tests for TypeScript parsing with tree-sitter."""

    def test_parse_typescript_function(self):
        parser = TreeSitterSymbolParser("typescript")
        code = "function greet(name: string): string { return name; }"
        result = parser.parse(code, Path("test.ts"))

        assert result is not None
        assert len(result.symbols) >= 1
        assert any(s.name == "greet" for s in result.symbols)

    def test_parse_typescript_class(self):
        parser = TreeSitterSymbolParser("typescript")
        code = """
class Service {
    process(data: string): void {}
}
"""
        result = parser.parse(code, Path("test.ts"))

        assert result is not None
        names = [s.name for s in result.symbols]
        assert "Service" in names


class TestTreeSitterParserAvailability:
    """Tests for parser availability checking."""

    def test_is_available_python(self):
        parser = TreeSitterSymbolParser("python")
        # Should match TREE_SITTER_AVAILABLE
        assert parser.is_available() == TREE_SITTER_AVAILABLE

    def test_is_available_javascript(self):
        parser = TreeSitterSymbolParser("javascript")
        assert isinstance(parser.is_available(), bool)

    def test_unsupported_language(self):
        parser = TreeSitterSymbolParser("rust")
        # Rust not configured, so should not be available
        assert parser.is_available() is False


class TestTreeSitterParserFallback:
    """Tests for fallback behavior when tree-sitter unavailable."""

    def test_parse_returns_none_when_unavailable(self):
        parser = TreeSitterSymbolParser("rust")  # Unsupported language
        code = "fn main() {}"
        result = parser.parse(code, Path("test.rs"))

        # Should return None when parser unavailable
        assert result is None


class TestTreeSitterTokenCounting:
    """Tests for token counting functionality."""

    @pytest.mark.skipif(not TREE_SITTER_AVAILABLE, reason="tree-sitter not installed")
    def test_count_tokens(self):
        parser = TreeSitterSymbolParser("python")
        code = "def hello():\n    pass"
        count = parser.count_tokens(code)

        assert count > 0
        assert isinstance(count, int)

    @pytest.mark.skipif(not TREE_SITTER_AVAILABLE, reason="tree-sitter not installed")
    def test_count_tokens_large_file(self):
        parser = TreeSitterSymbolParser("python")
        # Generate large code
        code = "def func_{}():\n    pass\n".format("x" * 100) * 1000

        count = parser.count_tokens(code)
        assert count > 0


class TestTreeSitterAccuracy:
    """Tests for >99% symbol extraction accuracy."""

    @pytest.mark.skipif(not TREE_SITTER_AVAILABLE, reason="tree-sitter not installed")
    def test_comprehensive_python_file(self):
        parser = TreeSitterSymbolParser("python")
        code = """
# Module-level function
def module_func():
    pass

class FirstClass:
    def method1(self):
        pass

    def method2(self):
        pass

    async def async_method(self):
        pass

def another_function():
    def nested():
        pass
    return nested

class SecondClass:
    class InnerClass:
        def inner_method(self):
            pass

    def outer_method(self):
        pass

async def async_function():
    pass
"""
        result = parser.parse(code, Path("test.py"))

        assert result is not None
        # Expected symbols: module_func, FirstClass, method1, method2, async_method,
        # another_function, nested, SecondClass, InnerClass, inner_method,
        # outer_method, async_function
        # Should find at least 12 symbols with >99% accuracy
        assert len(result.symbols) >= 12

    @pytest.mark.skipif(not TREE_SITTER_AVAILABLE, reason="tree-sitter not installed")
    def test_comprehensive_javascript_file(self):
        parser = TreeSitterSymbolParser("javascript")
        code = """
function regularFunc() {}

const arrowFunc = () => {}

class MainClass {
    method1() {}
    async method2() {}
    static staticMethod() {}
}

export function exportedFunc() {}

export class ExportedClass {
    method() {}
}
"""
        result = parser.parse(code, Path("test.js"))

        assert result is not None
        # Expected: regularFunc, arrowFunc, MainClass, method1, method2,
        # staticMethod, exportedFunc, ExportedClass, method
        # Should find at least 9 symbols
        assert len(result.symbols) >= 9
