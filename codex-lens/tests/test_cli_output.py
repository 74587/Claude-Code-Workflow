"""Tests for CodexLens CLI output functions."""

import json
from dataclasses import dataclass
from io import StringIO
from pathlib import Path
from unittest.mock import patch

import pytest
from rich.console import Console

from codexlens.cli.output import (
    _to_jsonable,
    print_json,
    render_file_inspect,
    render_search_results,
    render_status,
    render_symbols,
)
from codexlens.entities import SearchResult, Symbol


class TestToJsonable:
    """Tests for _to_jsonable helper function."""

    def test_none_value(self):
        """Test converting None."""
        assert _to_jsonable(None) is None

    def test_primitive_values(self):
        """Test converting primitive values."""
        assert _to_jsonable("string") == "string"
        assert _to_jsonable(42) == 42
        assert _to_jsonable(3.14) == 3.14
        assert _to_jsonable(True) is True

    def test_path_conversion(self):
        """Test converting Path to string."""
        path = Path("/test/file.py")
        result = _to_jsonable(path)
        assert result == str(path)

    def test_dict_conversion(self):
        """Test converting dict with nested values."""
        data = {"key": "value", "path": Path("/test.py"), "nested": {"a": 1}}
        result = _to_jsonable(data)
        assert result["key"] == "value"
        # Path conversion uses str(), which may differ by OS
        assert result["path"] == str(Path("/test.py"))
        assert result["nested"]["a"] == 1

    def test_list_conversion(self):
        """Test converting list with various items."""
        data = ["string", 42, Path("/test.py")]
        result = _to_jsonable(data)
        assert result == ["string", 42, str(Path("/test.py"))]

    def test_tuple_conversion(self):
        """Test converting tuple."""
        data = ("a", "b", Path("/test.py"))
        result = _to_jsonable(data)
        assert result == ["a", "b", str(Path("/test.py"))]

    def test_set_conversion(self):
        """Test converting set."""
        data = {1, 2, 3}
        result = _to_jsonable(data)
        assert set(result) == {1, 2, 3}

    def test_pydantic_model_conversion(self):
        """Test converting Pydantic model."""
        symbol = Symbol(name="test", kind="function", range=(1, 5))
        result = _to_jsonable(symbol)
        assert result["name"] == "test"
        assert result["kind"] == "function"
        assert result["range"] == (1, 5)

    def test_dataclass_conversion(self):
        """Test converting dataclass."""
        @dataclass
        class TestData:
            name: str
            value: int

        data = TestData(name="test", value=42)
        result = _to_jsonable(data)
        assert result["name"] == "test"
        assert result["value"] == 42


class TestPrintJson:
    """Tests for print_json function."""

    def test_print_success_json(self, capsys):
        """Test printing success JSON."""
        with patch("codexlens.cli.output.console") as mock_console:
            captured_output = []
            mock_console.print_json = lambda x: captured_output.append(x)

            print_json(success=True, result={"key": "value"})

            output = json.loads(captured_output[0])
            assert output["success"] is True
            assert output["result"]["key"] == "value"

    def test_print_error_json(self, capsys):
        """Test printing error JSON."""
        with patch("codexlens.cli.output.console") as mock_console:
            captured_output = []
            mock_console.print_json = lambda x: captured_output.append(x)

            print_json(success=False, error="Something went wrong")

            output = json.loads(captured_output[0])
            assert output["success"] is False
            assert output["error"] == "Something went wrong"

    def test_print_error_default_message(self, capsys):
        """Test printing error with default message."""
        with patch("codexlens.cli.output.console") as mock_console:
            captured_output = []
            mock_console.print_json = lambda x: captured_output.append(x)

            print_json(success=False)

            output = json.loads(captured_output[0])
            assert output["error"] == "Unknown error"


class TestRenderSearchResults:
    """Tests for render_search_results function."""

    def test_render_empty_results(self):
        """Test rendering empty results."""
        with patch("codexlens.cli.output.console") as mock_console:
            render_search_results([])
            mock_console.print.assert_called_once()

    def test_render_results_with_data(self):
        """Test rendering results with data."""
        results = [
            SearchResult(path="/test/a.py", score=0.95, excerpt="test excerpt"),
            SearchResult(path="/test/b.py", score=0.85, excerpt="another excerpt"),
        ]

        with patch("codexlens.cli.output.console") as mock_console:
            render_search_results(results)
            mock_console.print.assert_called_once()

    def test_render_results_custom_title(self):
        """Test rendering results with custom title."""
        results = [SearchResult(path="/test.py", score=0.5)]

        with patch("codexlens.cli.output.console") as mock_console:
            render_search_results(results, title="Custom Title")
            mock_console.print.assert_called_once()


class TestRenderSymbols:
    """Tests for render_symbols function."""

    def test_render_empty_symbols(self):
        """Test rendering empty symbols list."""
        with patch("codexlens.cli.output.console") as mock_console:
            render_symbols([])
            mock_console.print.assert_called_once()

    def test_render_symbols_with_data(self):
        """Test rendering symbols with data."""
        symbols = [
            Symbol(name="MyClass", kind="class", range=(1, 10)),
            Symbol(name="my_func", kind="function", range=(12, 20)),
        ]

        with patch("codexlens.cli.output.console") as mock_console:
            render_symbols(symbols)
            mock_console.print.assert_called_once()

    def test_render_symbols_custom_title(self):
        """Test rendering symbols with custom title."""
        symbols = [Symbol(name="test", kind="function", range=(1, 1))]

        with patch("codexlens.cli.output.console") as mock_console:
            render_symbols(symbols, title="Functions Found")
            mock_console.print.assert_called_once()


class TestRenderStatus:
    """Tests for render_status function."""

    def test_render_basic_stats(self):
        """Test rendering basic stats."""
        stats = {"files": 100, "symbols": 500}

        with patch("codexlens.cli.output.console") as mock_console:
            render_status(stats)
            mock_console.print.assert_called_once()

    def test_render_stats_with_nested_dict(self):
        """Test rendering stats with nested dict."""
        stats = {
            "files": 100,
            "languages": {"python": 50, "javascript": 30, "go": 20},
        }

        with patch("codexlens.cli.output.console") as mock_console:
            render_status(stats)
            mock_console.print.assert_called_once()

    def test_render_stats_with_list(self):
        """Test rendering stats with list value."""
        stats = {
            "files": 100,
            "recent_files": ["/a.py", "/b.py", "/c.py"],
        }

        with patch("codexlens.cli.output.console") as mock_console:
            render_status(stats)
            mock_console.print.assert_called_once()


class TestRenderFileInspect:
    """Tests for render_file_inspect function."""

    def test_render_file_with_symbols(self):
        """Test rendering file inspection with symbols."""
        symbols = [
            Symbol(name="hello", kind="function", range=(1, 5)),
            Symbol(name="MyClass", kind="class", range=(7, 20)),
        ]

        with patch("codexlens.cli.output.console") as mock_console:
            render_file_inspect("/test/file.py", "python", symbols)
            # Should be called twice: once for header, once for symbols table
            assert mock_console.print.call_count == 2

    def test_render_file_without_symbols(self):
        """Test rendering file inspection without symbols."""
        with patch("codexlens.cli.output.console") as mock_console:
            render_file_inspect("/test/file.py", "python", [])
            assert mock_console.print.call_count == 2


class TestJsonOutputIntegration:
    """Integration tests for JSON output."""

    def test_search_result_to_json(self):
        """Test converting SearchResult to JSON."""
        result = SearchResult(
            path="/test.py",
            score=0.95,
            excerpt="test code here",
            metadata={"line": 10},
        )

        jsonable = _to_jsonable(result)
        # Verify it can be JSON serialized
        json_str = json.dumps(jsonable)
        parsed = json.loads(json_str)

        assert parsed["path"] == "/test.py"
        assert parsed["score"] == 0.95
        assert parsed["excerpt"] == "test code here"

    def test_nested_results_to_json(self):
        """Test converting nested structure to JSON."""
        data = {
            "query": "test",
            "results": [
                SearchResult(path="/a.py", score=0.9),
                SearchResult(path="/b.py", score=0.8),
            ],
        }

        jsonable = _to_jsonable(data)
        json_str = json.dumps(jsonable)
        parsed = json.loads(json_str)

        assert parsed["query"] == "test"
        assert len(parsed["results"]) == 2
