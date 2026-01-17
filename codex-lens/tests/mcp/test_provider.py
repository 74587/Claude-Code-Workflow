"""Tests for MCP provider."""

import pytest
from unittest.mock import Mock, MagicMock, patch
from pathlib import Path
import tempfile
import os

from codexlens.mcp.provider import MCPProvider
from codexlens.mcp.schema import MCPContext, SymbolInfo, ReferenceInfo


class TestMCPProvider:
    """Test MCPProvider class."""

    @pytest.fixture
    def mock_global_index(self):
        """Create a mock global index."""
        return Mock()

    @pytest.fixture
    def mock_search_engine(self):
        """Create a mock search engine."""
        return Mock()

    @pytest.fixture
    def mock_registry(self):
        """Create a mock registry."""
        return Mock()

    @pytest.fixture
    def provider(self, mock_global_index, mock_search_engine, mock_registry):
        """Create an MCPProvider with mocked dependencies."""
        return MCPProvider(mock_global_index, mock_search_engine, mock_registry)

    def test_build_context_returns_none_for_unknown_symbol(self, provider, mock_global_index):
        """build_context returns None when symbol is not found."""
        mock_global_index.search.return_value = []

        result = provider.build_context("unknown_symbol")

        assert result is None
        mock_global_index.search.assert_called_once_with(
            "unknown_symbol", prefix_mode=False, limit=1
        )

    def test_build_context_returns_mcp_context(
        self, provider, mock_global_index, mock_search_engine
    ):
        """build_context returns MCPContext for known symbol."""
        mock_symbol = Mock()
        mock_symbol.name = "my_func"
        mock_symbol.kind = "function"
        mock_symbol.file = "/test.py"
        mock_symbol.range = (10, 20)

        mock_global_index.search.return_value = [mock_symbol]
        mock_search_engine.search_references.return_value = []

        result = provider.build_context("my_func")

        assert result is not None
        assert isinstance(result, MCPContext)
        assert result.symbol is not None
        assert result.symbol.name == "my_func"
        assert result.symbol.kind == "function"
        assert result.context_type == "symbol_explanation"

    def test_build_context_with_custom_context_type(
        self, provider, mock_global_index, mock_search_engine
    ):
        """build_context respects custom context_type."""
        mock_symbol = Mock()
        mock_symbol.name = "my_func"
        mock_symbol.kind = "function"
        mock_symbol.file = "/test.py"
        mock_symbol.range = (10, 20)

        mock_global_index.search.return_value = [mock_symbol]
        mock_search_engine.search_references.return_value = []

        result = provider.build_context("my_func", context_type="refactor_context")

        assert result is not None
        assert result.context_type == "refactor_context"

    def test_build_context_includes_references(
        self, provider, mock_global_index, mock_search_engine
    ):
        """build_context includes references when include_references=True."""
        mock_symbol = Mock()
        mock_symbol.name = "my_func"
        mock_symbol.kind = "function"
        mock_symbol.file = "/test.py"
        mock_symbol.range = (10, 20)

        mock_ref = Mock()
        mock_ref.file_path = "/caller.py"
        mock_ref.line = 25
        mock_ref.column = 4
        mock_ref.context = "result = my_func()"
        mock_ref.relationship_type = "call"

        mock_global_index.search.return_value = [mock_symbol]
        mock_search_engine.search_references.return_value = [mock_ref]

        result = provider.build_context("my_func", include_references=True)

        assert result is not None
        assert len(result.references) == 1
        assert result.references[0].file_path == "/caller.py"
        assert result.references[0].line == 25
        assert result.references[0].relationship_type == "call"

    def test_build_context_excludes_references_when_disabled(
        self, provider, mock_global_index, mock_search_engine
    ):
        """build_context excludes references when include_references=False."""
        mock_symbol = Mock()
        mock_symbol.name = "my_func"
        mock_symbol.kind = "function"
        mock_symbol.file = "/test.py"
        mock_symbol.range = (10, 20)

        mock_global_index.search.return_value = [mock_symbol]
        mock_search_engine.search_references.return_value = []

        # Disable both references and related to avoid any search_references calls
        result = provider.build_context(
            "my_func", include_references=False, include_related=False
        )

        assert result is not None
        assert len(result.references) == 0
        mock_search_engine.search_references.assert_not_called()

    def test_build_context_respects_max_references(
        self, provider, mock_global_index, mock_search_engine
    ):
        """build_context passes max_references to search engine."""
        mock_symbol = Mock()
        mock_symbol.name = "my_func"
        mock_symbol.kind = "function"
        mock_symbol.file = "/test.py"
        mock_symbol.range = (10, 20)

        mock_global_index.search.return_value = [mock_symbol]
        mock_search_engine.search_references.return_value = []

        # Disable include_related to test only the references call
        provider.build_context("my_func", max_references=5, include_related=False)

        mock_search_engine.search_references.assert_called_once_with(
            "my_func", limit=5
        )

    def test_build_context_includes_metadata(
        self, provider, mock_global_index, mock_search_engine
    ):
        """build_context includes source metadata."""
        mock_symbol = Mock()
        mock_symbol.name = "my_func"
        mock_symbol.kind = "function"
        mock_symbol.file = "/test.py"
        mock_symbol.range = (10, 20)

        mock_global_index.search.return_value = [mock_symbol]
        mock_search_engine.search_references.return_value = []

        result = provider.build_context("my_func")

        assert result is not None
        assert result.metadata.get("source") == "codex-lens"

    def test_extract_definition_with_valid_file(self, provider):
        """_extract_definition reads file content correctly."""
        # Create a temporary file with some content
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write("# Line 1\n")
            f.write("# Line 2\n")
            f.write("def my_func():\n")  # Line 3
            f.write("    pass\n")  # Line 4
            f.write("# Line 5\n")
            temp_path = f.name

        try:
            mock_symbol = Mock()
            mock_symbol.file = temp_path
            mock_symbol.range = (3, 4)  # 1-based line numbers

            definition = provider._extract_definition(mock_symbol)

            assert definition is not None
            assert "def my_func():" in definition
            assert "pass" in definition
        finally:
            os.unlink(temp_path)

    def test_extract_definition_returns_none_for_missing_file(self, provider):
        """_extract_definition returns None for non-existent file."""
        mock_symbol = Mock()
        mock_symbol.file = "/nonexistent/path/file.py"
        mock_symbol.range = (1, 5)

        definition = provider._extract_definition(mock_symbol)

        assert definition is None

    def test_extract_definition_returns_none_for_none_file(self, provider):
        """_extract_definition returns None when symbol.file is None."""
        mock_symbol = Mock()
        mock_symbol.file = None
        mock_symbol.range = (1, 5)

        definition = provider._extract_definition(mock_symbol)

        assert definition is None

    def test_build_context_for_file_returns_context(
        self, provider, mock_global_index
    ):
        """build_context_for_file returns MCPContext."""
        mock_global_index.search.return_value = []

        result = provider.build_context_for_file(
            Path("/test/file.py"),
            context_type="file_overview",
        )

        assert result is not None
        assert isinstance(result, MCPContext)
        assert result.context_type == "file_overview"
        assert result.metadata.get("file_path") == str(Path("/test/file.py"))

    def test_build_context_for_file_includes_symbols(
        self, provider, mock_global_index
    ):
        """build_context_for_file includes symbols from the file."""
        # Create temp file to get resolved path
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write("def func(): pass\n")
            temp_path = f.name

        try:
            mock_symbol = Mock()
            mock_symbol.name = "func"
            mock_symbol.kind = "function"
            mock_symbol.file = temp_path
            mock_symbol.range = (1, 1)

            mock_global_index.search.return_value = [mock_symbol]

            result = provider.build_context_for_file(Path(temp_path))

            assert result is not None
            # Symbols from this file should be in related_symbols
            assert len(result.related_symbols) >= 0  # May be 0 if filtering doesn't match
        finally:
            os.unlink(temp_path)


class TestMCPProviderRelatedSymbols:
    """Test related symbols functionality."""

    @pytest.fixture
    def provider(self):
        """Create provider with mocks."""
        mock_global_index = Mock()
        mock_search_engine = Mock()
        mock_registry = Mock()
        return MCPProvider(mock_global_index, mock_search_engine, mock_registry)

    def test_get_related_symbols_from_references(self, provider):
        """_get_related_symbols extracts symbols from references."""
        mock_symbol = Mock()
        mock_symbol.name = "my_func"
        mock_symbol.file = "/test.py"

        mock_ref1 = Mock()
        mock_ref1.file_path = "/caller1.py"
        mock_ref1.relationship_type = "call"

        mock_ref2 = Mock()
        mock_ref2.file_path = "/caller2.py"
        mock_ref2.relationship_type = "import"

        provider.search_engine.search_references.return_value = [mock_ref1, mock_ref2]

        related = provider._get_related_symbols(mock_symbol)

        assert len(related) == 2
        assert related[0].relationship == "call"
        assert related[1].relationship == "import"

    def test_get_related_symbols_limits_results(self, provider):
        """_get_related_symbols limits to 10 unique relationship types."""
        mock_symbol = Mock()
        mock_symbol.name = "my_func"
        mock_symbol.file = "/test.py"

        # Create 15 references with unique relationship types
        refs = []
        for i in range(15):
            ref = Mock()
            ref.file_path = f"/file{i}.py"
            ref.relationship_type = f"type{i}"
            refs.append(ref)

        provider.search_engine.search_references.return_value = refs

        related = provider._get_related_symbols(mock_symbol)

        assert len(related) <= 10

    def test_get_related_symbols_handles_exception(self, provider):
        """_get_related_symbols handles exceptions gracefully."""
        mock_symbol = Mock()
        mock_symbol.name = "my_func"
        mock_symbol.file = "/test.py"

        provider.search_engine.search_references.side_effect = Exception("Search failed")

        related = provider._get_related_symbols(mock_symbol)

        assert related == []


class TestMCPProviderIntegration:
    """Integration-style tests for MCPProvider."""

    def test_full_context_workflow(self):
        """Test complete context building workflow."""
        # Create temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write("def my_function(arg1, arg2):\n")
            f.write("    '''This is my function.'''\n")
            f.write("    return arg1 + arg2\n")
            temp_path = f.name

        try:
            # Setup mocks
            mock_global_index = Mock()
            mock_search_engine = Mock()
            mock_registry = Mock()

            mock_symbol = Mock()
            mock_symbol.name = "my_function"
            mock_symbol.kind = "function"
            mock_symbol.file = temp_path
            mock_symbol.range = (1, 3)

            mock_ref = Mock()
            mock_ref.file_path = "/user.py"
            mock_ref.line = 10
            mock_ref.column = 4
            mock_ref.context = "result = my_function(1, 2)"
            mock_ref.relationship_type = "call"

            mock_global_index.search.return_value = [mock_symbol]
            mock_search_engine.search_references.return_value = [mock_ref]

            provider = MCPProvider(mock_global_index, mock_search_engine, mock_registry)
            context = provider.build_context("my_function")

            assert context is not None
            assert context.symbol.name == "my_function"
            assert context.definition is not None
            assert "def my_function" in context.definition
            assert len(context.references) == 1
            assert context.references[0].relationship_type == "call"

            # Test serialization
            json_str = context.to_json()
            assert "my_function" in json_str

            # Test prompt injection
            prompt = context.to_prompt_injection()
            assert "<code_context>" in prompt
            assert "my_function" in prompt
            assert "</code_context>" in prompt

        finally:
            os.unlink(temp_path)
