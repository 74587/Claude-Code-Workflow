"""Tests for CodexLens parsers."""

from pathlib import Path

import pytest

from codexlens.parsers.factory import (
    SimpleRegexParser,
    _parse_js_ts_symbols,
    _parse_python_symbols,
)


TREE_SITTER_JS_AVAILABLE = True
try:
    import tree_sitter_javascript  # type: ignore[import-not-found]  # noqa: F401
except Exception:
    TREE_SITTER_JS_AVAILABLE = False


class TestPythonParser:
    """Tests for Python symbol parsing."""

    def test_parse_function(self):
        code = "def hello():\n    pass"
        symbols = _parse_python_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "hello"
        assert symbols[0].kind == "function"

    def test_parse_async_function(self):
        code = "async def fetch_data():\n    pass"
        symbols = _parse_python_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "fetch_data"
        assert symbols[0].kind == "function"

    def test_parse_class(self):
        code = "class MyClass:\n    pass"
        symbols = _parse_python_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "MyClass"
        assert symbols[0].kind == "class"

    def test_parse_method(self):
        code = "class MyClass:\n    def method(self):\n        pass"
        symbols = _parse_python_symbols(code)
        assert len(symbols) == 2
        assert symbols[0].name == "MyClass"
        assert symbols[0].kind == "class"
        assert symbols[1].name == "method"
        assert symbols[1].kind == "method"

    def test_parse_async_method(self):
        code = "class MyClass:\n    async def async_method(self):\n        pass"
        symbols = _parse_python_symbols(code)
        assert len(symbols) == 2
        assert symbols[1].name == "async_method"
        assert symbols[1].kind == "method"


class TestJavaScriptParser:
    """Tests for JavaScript/TypeScript symbol parsing."""

    def test_parse_function(self):
        code = "function hello() {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "hello"
        assert symbols[0].kind == "function"

    def test_parse_async_function(self):
        code = "async function fetchData() {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "fetchData"
        assert symbols[0].kind == "function"

    def test_parse_arrow_function(self):
        code = "const hello = () => {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "hello"
        assert symbols[0].kind == "function"

    def test_parse_async_arrow_function(self):
        code = "const fetchData = async () => {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "fetchData"
        assert symbols[0].kind == "function"

    def test_parse_class(self):
        code = "class MyClass {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "MyClass"
        assert symbols[0].kind == "class"

    def test_parse_export_function(self):
        code = "export function hello() {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "hello"
        assert symbols[0].kind == "function"

    def test_parse_export_class(self):
        code = "export class MyClass {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "MyClass"
        assert symbols[0].kind == "class"

    def test_parse_export_arrow_function(self):
        code = "export const hello = () => {}"
        symbols = _parse_js_ts_symbols(code)
        assert len(symbols) == 1
        assert symbols[0].name == "hello"
        assert symbols[0].kind == "function"

    @pytest.mark.skipif(not TREE_SITTER_JS_AVAILABLE, reason="tree-sitter-javascript not installed")
    def test_parse_class_methods(self):
        code = (
            "class MyClass {\n"
            "  method() {}\n"
            "  async asyncMethod() {}\n"
            "  static staticMethod() {}\n"
            "  constructor() {}\n"
            "}"
        )
        symbols = _parse_js_ts_symbols(code)
        names_kinds = [(s.name, s.kind) for s in symbols]
        assert ("MyClass", "class") in names_kinds
        assert ("method", "method") in names_kinds
        assert ("asyncMethod", "method") in names_kinds
        assert ("staticMethod", "method") in names_kinds
        assert all(name != "constructor" for name, _ in names_kinds)


class TestParserInterface:
    """High-level interface tests."""

    def test_simple_parser_parse(self):
        parser = SimpleRegexParser("python")
        indexed = parser.parse("def hello():\n    pass", Path("test.py"))
        assert indexed.language == "python"
        assert len(indexed.symbols) == 1
        assert indexed.symbols[0].name == "hello"
