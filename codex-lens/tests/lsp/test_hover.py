"""Tests for hover provider."""

from __future__ import annotations

import pytest
from pathlib import Path
from unittest.mock import Mock, MagicMock
import tempfile

from codexlens.entities import Symbol


class TestHoverInfo:
    """Test HoverInfo dataclass."""

    def test_hover_info_import(self):
        """HoverInfo can be imported."""
        pytest.importorskip("pygls")
        pytest.importorskip("lsprotocol")

        from codexlens.lsp.providers import HoverInfo

        assert HoverInfo is not None

    def test_hover_info_fields(self):
        """HoverInfo has all required fields."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverInfo

        info = HoverInfo(
            name="my_function",
            kind="function",
            signature="def my_function(x: int) -> str:",
            documentation="A test function.",
            file_path="/test/file.py",
            line_range=(10, 15),
        )
        assert info.name == "my_function"
        assert info.kind == "function"
        assert info.signature == "def my_function(x: int) -> str:"
        assert info.documentation == "A test function."
        assert info.file_path == "/test/file.py"
        assert info.line_range == (10, 15)

    def test_hover_info_optional_documentation(self):
        """Documentation can be None."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverInfo

        info = HoverInfo(
            name="func",
            kind="function",
            signature="def func():",
            documentation=None,
            file_path="/test.py",
            line_range=(1, 2),
        )
        assert info.documentation is None


class TestHoverProvider:
    """Test HoverProvider class."""

    def test_provider_import(self):
        """HoverProvider can be imported."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverProvider

        assert HoverProvider is not None

    def test_returns_none_for_unknown_symbol(self):
        """Returns None when symbol not found."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverProvider

        mock_index = Mock()
        mock_index.search.return_value = []
        mock_registry = Mock()

        provider = HoverProvider(mock_index, mock_registry)
        result = provider.get_hover_info("unknown_symbol")

        assert result is None
        mock_index.search.assert_called_once_with(
            name="unknown_symbol", limit=1, prefix_mode=False
        )

    def test_returns_none_for_non_exact_match(self):
        """Returns None when search returns non-exact matches."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverProvider

        # Return a symbol with different name (prefix match but not exact)
        mock_symbol = Mock()
        mock_symbol.name = "my_function_extended"
        mock_symbol.kind = "function"
        mock_symbol.file = "/test/file.py"
        mock_symbol.range = (10, 15)

        mock_index = Mock()
        mock_index.search.return_value = [mock_symbol]
        mock_registry = Mock()

        provider = HoverProvider(mock_index, mock_registry)
        result = provider.get_hover_info("my_function")

        assert result is None

    def test_returns_hover_info_for_known_symbol(self):
        """Returns HoverInfo for found symbol."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverProvider

        mock_symbol = Mock()
        mock_symbol.name = "my_func"
        mock_symbol.kind = "function"
        mock_symbol.file = None  # No file, will use fallback signature
        mock_symbol.range = (10, 15)

        mock_index = Mock()
        mock_index.search.return_value = [mock_symbol]
        mock_registry = Mock()

        provider = HoverProvider(mock_index, mock_registry)
        result = provider.get_hover_info("my_func")

        assert result is not None
        assert result.name == "my_func"
        assert result.kind == "function"
        assert result.line_range == (10, 15)
        assert result.signature == "function my_func"

    def test_extracts_signature_from_file(self):
        """Extracts signature from actual file content."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverProvider

        # Create a temporary file with Python content
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False, encoding="utf-8"
        ) as f:
            f.write("# comment\n")
            f.write("def test_function(x: int, y: str) -> bool:\n")
            f.write("    return True\n")
            temp_path = f.name

        try:
            mock_symbol = Mock()
            mock_symbol.name = "test_function"
            mock_symbol.kind = "function"
            mock_symbol.file = temp_path
            mock_symbol.range = (2, 3)  # Line 2 (1-based)

            mock_index = Mock()
            mock_index.search.return_value = [mock_symbol]

            provider = HoverProvider(mock_index, None)
            result = provider.get_hover_info("test_function")

            assert result is not None
            assert "def test_function(x: int, y: str) -> bool:" in result.signature
        finally:
            Path(temp_path).unlink(missing_ok=True)

    def test_extracts_multiline_signature(self):
        """Extracts multiline function signature."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverProvider

        # Create a temporary file with multiline signature
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False, encoding="utf-8"
        ) as f:
            f.write("def complex_function(\n")
            f.write("    arg1: int,\n")
            f.write("    arg2: str,\n")
            f.write(") -> bool:\n")
            f.write("    return True\n")
            temp_path = f.name

        try:
            mock_symbol = Mock()
            mock_symbol.name = "complex_function"
            mock_symbol.kind = "function"
            mock_symbol.file = temp_path
            mock_symbol.range = (1, 5)  # Line 1 (1-based)

            mock_index = Mock()
            mock_index.search.return_value = [mock_symbol]

            provider = HoverProvider(mock_index, None)
            result = provider.get_hover_info("complex_function")

            assert result is not None
            assert "def complex_function(" in result.signature
            # Should capture multiline signature
            assert "arg1: int" in result.signature
        finally:
            Path(temp_path).unlink(missing_ok=True)

    def test_handles_nonexistent_file_gracefully(self):
        """Returns fallback signature when file doesn't exist."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverProvider

        mock_symbol = Mock()
        mock_symbol.name = "my_func"
        mock_symbol.kind = "function"
        mock_symbol.file = "/nonexistent/path/file.py"
        mock_symbol.range = (10, 15)

        mock_index = Mock()
        mock_index.search.return_value = [mock_symbol]

        provider = HoverProvider(mock_index, None)
        result = provider.get_hover_info("my_func")

        assert result is not None
        assert result.signature == "function my_func"

    def test_handles_invalid_line_range(self):
        """Returns fallback signature when line range is invalid."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverProvider

        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".py", delete=False, encoding="utf-8"
        ) as f:
            f.write("def test():\n")
            f.write("    pass\n")
            temp_path = f.name

        try:
            mock_symbol = Mock()
            mock_symbol.name = "test"
            mock_symbol.kind = "function"
            mock_symbol.file = temp_path
            mock_symbol.range = (100, 105)  # Line beyond file length

            mock_index = Mock()
            mock_index.search.return_value = [mock_symbol]

            provider = HoverProvider(mock_index, None)
            result = provider.get_hover_info("test")

            assert result is not None
            assert result.signature == "function test"
        finally:
            Path(temp_path).unlink(missing_ok=True)


class TestFormatHoverMarkdown:
    """Test markdown formatting."""

    def test_format_python_signature(self):
        """Formats Python signature with python code fence."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverInfo, HoverProvider

        info = HoverInfo(
            name="func",
            kind="function",
            signature="def func(x: int) -> str:",
            documentation=None,
            file_path="/test/file.py",
            line_range=(10, 15),
        )
        mock_index = Mock()
        provider = HoverProvider(mock_index, None)

        result = provider.format_hover_markdown(info)

        assert "```python" in result
        assert "def func(x: int) -> str:" in result
        assert "function" in result
        assert "file.py" in result
        assert "line 10" in result

    def test_format_javascript_signature(self):
        """Formats JavaScript signature with javascript code fence."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverInfo, HoverProvider

        info = HoverInfo(
            name="myFunc",
            kind="function",
            signature="function myFunc(x) {",
            documentation=None,
            file_path="/test/file.js",
            line_range=(5, 10),
        )
        mock_index = Mock()
        provider = HoverProvider(mock_index, None)

        result = provider.format_hover_markdown(info)

        assert "```javascript" in result
        assert "function myFunc(x) {" in result

    def test_format_typescript_signature(self):
        """Formats TypeScript signature with typescript code fence."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverInfo, HoverProvider

        info = HoverInfo(
            name="myFunc",
            kind="function",
            signature="function myFunc(x: number): string {",
            documentation=None,
            file_path="/test/file.ts",
            line_range=(5, 10),
        )
        mock_index = Mock()
        provider = HoverProvider(mock_index, None)

        result = provider.format_hover_markdown(info)

        assert "```typescript" in result

    def test_format_with_documentation(self):
        """Includes documentation when available."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverInfo, HoverProvider

        info = HoverInfo(
            name="func",
            kind="function",
            signature="def func():",
            documentation="This is a test function.",
            file_path="/test/file.py",
            line_range=(10, 15),
        )
        mock_index = Mock()
        provider = HoverProvider(mock_index, None)

        result = provider.format_hover_markdown(info)

        assert "This is a test function." in result
        assert "---" in result  # Separator before docs

    def test_format_without_documentation(self):
        """Does not include documentation section when None."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverInfo, HoverProvider

        info = HoverInfo(
            name="func",
            kind="function",
            signature="def func():",
            documentation=None,
            file_path="/test/file.py",
            line_range=(10, 15),
        )
        mock_index = Mock()
        provider = HoverProvider(mock_index, None)

        result = provider.format_hover_markdown(info)

        # Should have one separator for location, not two
        # The result should not have duplicate doc separator
        lines = result.split("\n")
        separator_count = sum(1 for line in lines if line.strip() == "---")
        assert separator_count == 1  # Only location separator

    def test_format_unknown_extension(self):
        """Uses empty code fence for unknown file extensions."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverInfo, HoverProvider

        info = HoverInfo(
            name="func",
            kind="function",
            signature="func code here",
            documentation=None,
            file_path="/test/file.xyz",
            line_range=(1, 2),
        )
        mock_index = Mock()
        provider = HoverProvider(mock_index, None)

        result = provider.format_hover_markdown(info)

        # Should have code fence without language specifier
        assert "```\n" in result or "```xyz" not in result

    def test_format_class_symbol(self):
        """Formats class symbol correctly."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverInfo, HoverProvider

        info = HoverInfo(
            name="MyClass",
            kind="class",
            signature="class MyClass:",
            documentation=None,
            file_path="/test/file.py",
            line_range=(1, 20),
        )
        mock_index = Mock()
        provider = HoverProvider(mock_index, None)

        result = provider.format_hover_markdown(info)

        assert "class MyClass:" in result
        assert "*class*" in result
        assert "line 1" in result

    def test_format_empty_file_path(self):
        """Handles empty file path gracefully."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverInfo, HoverProvider

        info = HoverInfo(
            name="func",
            kind="function",
            signature="def func():",
            documentation=None,
            file_path="",
            line_range=(1, 2),
        )
        mock_index = Mock()
        provider = HoverProvider(mock_index, None)

        result = provider.format_hover_markdown(info)

        assert "unknown" in result or "```" in result


class TestHoverProviderRegistry:
    """Test HoverProvider with registry integration."""

    def test_provider_accepts_none_registry(self):
        """HoverProvider works without registry."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverProvider

        mock_index = Mock()
        mock_index.search.return_value = []

        provider = HoverProvider(mock_index, None)
        result = provider.get_hover_info("test")

        assert result is None
        assert provider.registry is None

    def test_provider_stores_registry(self):
        """HoverProvider stores registry reference."""
        pytest.importorskip("pygls")

        from codexlens.lsp.providers import HoverProvider

        mock_index = Mock()
        mock_registry = Mock()

        provider = HoverProvider(mock_index, mock_registry)

        assert provider.global_index is mock_index
        assert provider.registry is mock_registry
