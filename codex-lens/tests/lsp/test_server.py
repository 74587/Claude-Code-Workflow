"""Tests for codex-lens LSP server."""

from __future__ import annotations

import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

from codexlens.entities import Symbol


class TestCodexLensLanguageServer:
    """Tests for CodexLensLanguageServer."""

    def test_server_import(self):
        """Test that server module can be imported."""
        pytest.importorskip("pygls")
        pytest.importorskip("lsprotocol")

        from codexlens.lsp.server import CodexLensLanguageServer, server

        assert CodexLensLanguageServer is not None
        assert server is not None
        assert server.name == "codexlens-lsp"

    def test_server_initialization(self):
        """Test server instance creation."""
        pytest.importorskip("pygls")

        from codexlens.lsp.server import CodexLensLanguageServer

        ls = CodexLensLanguageServer()
        assert ls.registry is None
        assert ls.mapper is None
        assert ls.global_index is None
        assert ls.search_engine is None
        assert ls.workspace_root is None


class TestDefinitionHandler:
    """Tests for definition handler."""

    def test_definition_lookup(self):
        """Test definition lookup returns location for known symbol."""
        pytest.importorskip("pygls")
        pytest.importorskip("lsprotocol")

        from lsprotocol import types as lsp
        from codexlens.lsp.handlers import symbol_to_location

        symbol = Symbol(
            name="test_function",
            kind="function",
            range=(10, 15),
            file="/path/to/file.py",
        )

        location = symbol_to_location(symbol)

        assert location is not None
        assert isinstance(location, lsp.Location)
        # LSP uses 0-based lines
        assert location.range.start.line == 9
        assert location.range.end.line == 14

    def test_definition_no_file(self):
        """Test definition lookup returns None for symbol without file."""
        pytest.importorskip("pygls")

        from codexlens.lsp.handlers import symbol_to_location

        symbol = Symbol(
            name="test_function",
            kind="function",
            range=(10, 15),
            file=None,
        )

        location = symbol_to_location(symbol)
        assert location is None


class TestCompletionHandler:
    """Tests for completion handler."""

    def test_get_prefix_at_position(self):
        """Test extracting prefix at cursor position."""
        pytest.importorskip("pygls")

        from codexlens.lsp.handlers import _get_prefix_at_position

        document_text = "def hello_world():\n    print(hel"

        # Cursor at end of "hel"
        prefix = _get_prefix_at_position(document_text, 1, 14)
        assert prefix == "hel"

        # Cursor at beginning of line (after whitespace)
        prefix = _get_prefix_at_position(document_text, 1, 4)
        assert prefix == ""

        # Cursor after "he" in "hello_world" - returns text before cursor
        prefix = _get_prefix_at_position(document_text, 0, 6)
        assert prefix == "he"

        # Cursor at end of "hello_world"
        prefix = _get_prefix_at_position(document_text, 0, 15)
        assert prefix == "hello_world"

    def test_get_word_at_position(self):
        """Test extracting word at cursor position."""
        pytest.importorskip("pygls")

        from codexlens.lsp.handlers import _get_word_at_position

        document_text = "def hello_world():\n    print(msg)"

        # Cursor on "hello_world"
        word = _get_word_at_position(document_text, 0, 6)
        assert word == "hello_world"

        # Cursor on "print"
        word = _get_word_at_position(document_text, 1, 6)
        assert word == "print"

        # Cursor on "msg"
        word = _get_word_at_position(document_text, 1, 11)
        assert word == "msg"

    def test_symbol_kind_mapping(self):
        """Test symbol kind to completion kind mapping."""
        pytest.importorskip("pygls")
        pytest.importorskip("lsprotocol")

        from lsprotocol import types as lsp
        from codexlens.lsp.handlers import _symbol_kind_to_completion_kind

        assert _symbol_kind_to_completion_kind("function") == lsp.CompletionItemKind.Function
        assert _symbol_kind_to_completion_kind("class") == lsp.CompletionItemKind.Class
        assert _symbol_kind_to_completion_kind("method") == lsp.CompletionItemKind.Method
        assert _symbol_kind_to_completion_kind("variable") == lsp.CompletionItemKind.Variable

        # Unknown kind should default to Text
        assert _symbol_kind_to_completion_kind("unknown") == lsp.CompletionItemKind.Text


class TestWorkspaceSymbolHandler:
    """Tests for workspace symbol handler."""

    def test_symbol_kind_to_lsp(self):
        """Test symbol kind to LSP SymbolKind mapping."""
        pytest.importorskip("pygls")
        pytest.importorskip("lsprotocol")

        from lsprotocol import types as lsp
        from codexlens.lsp.handlers import _symbol_kind_to_lsp

        assert _symbol_kind_to_lsp("function") == lsp.SymbolKind.Function
        assert _symbol_kind_to_lsp("class") == lsp.SymbolKind.Class
        assert _symbol_kind_to_lsp("method") == lsp.SymbolKind.Method
        assert _symbol_kind_to_lsp("interface") == lsp.SymbolKind.Interface

        # Unknown kind should default to Variable
        assert _symbol_kind_to_lsp("unknown") == lsp.SymbolKind.Variable


class TestUriConversion:
    """Tests for URI path conversion."""

    def test_path_to_uri(self):
        """Test path to URI conversion."""
        pytest.importorskip("pygls")

        from codexlens.lsp.handlers import _path_to_uri

        # Unix path
        uri = _path_to_uri("/home/user/file.py")
        assert uri.startswith("file://")
        assert "file.py" in uri

    def test_uri_to_path(self):
        """Test URI to path conversion."""
        pytest.importorskip("pygls")

        from codexlens.lsp.handlers import _uri_to_path

        # Basic URI
        path = _uri_to_path("file:///home/user/file.py")
        assert path.name == "file.py"


class TestMainEntryPoint:
    """Tests for main entry point."""

    def test_main_help(self):
        """Test that main shows help without errors."""
        pytest.importorskip("pygls")

        import sys
        from unittest.mock import patch

        # Patch sys.argv to show help
        with patch.object(sys, 'argv', ['codexlens-lsp', '--help']):
            from codexlens.lsp.server import main

            with pytest.raises(SystemExit) as exc_info:
                main()

            # Help exits with 0
            assert exc_info.value.code == 0
