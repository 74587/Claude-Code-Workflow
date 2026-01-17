"""Tests for codexlens.api.references module."""

import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from codexlens.api.references import (
    find_references,
    _read_line_from_file,
    _proximity_score,
    _group_references_by_definition,
    _transform_to_reference_result,
)
from codexlens.api.models import (
    DefinitionResult,
    ReferenceResult,
    GroupedReferences,
)


class TestReadLineFromFile:
    """Tests for _read_line_from_file helper."""

    def test_read_existing_line(self, tmp_path):
        """Test reading an existing line from a file."""
        test_file = tmp_path / "test.py"
        test_file.write_text("line 1\nline 2\nline 3\n")

        assert _read_line_from_file(str(test_file), 1) == "line 1"
        assert _read_line_from_file(str(test_file), 2) == "line 2"
        assert _read_line_from_file(str(test_file), 3) == "line 3"

    def test_read_nonexistent_line(self, tmp_path):
        """Test reading a line that doesn't exist."""
        test_file = tmp_path / "test.py"
        test_file.write_text("line 1\nline 2\n")

        assert _read_line_from_file(str(test_file), 10) == ""

    def test_read_nonexistent_file(self):
        """Test reading from a file that doesn't exist."""
        assert _read_line_from_file("/nonexistent/path/file.py", 1) == ""

    def test_strips_trailing_whitespace(self, tmp_path):
        """Test that trailing whitespace is stripped."""
        test_file = tmp_path / "test.py"
        test_file.write_text("line with spaces   \n")

        assert _read_line_from_file(str(test_file), 1) == "line with spaces"


class TestProximityScore:
    """Tests for _proximity_score helper."""

    def test_same_file(self):
        """Same file should return highest score."""
        score = _proximity_score("/a/b/c.py", "/a/b/c.py")
        assert score == 1000

    def test_same_directory(self):
        """Same directory should return 100."""
        score = _proximity_score("/a/b/x.py", "/a/b/y.py")
        assert score == 100

    def test_different_directories(self):
        """Different directories should return common prefix length."""
        score = _proximity_score("/a/b/c/x.py", "/a/b/d/y.py")
        # Common path is /a/b
        assert score > 0

    def test_empty_paths(self):
        """Empty paths should return 0."""
        assert _proximity_score("", "/a/b/c.py") == 0
        assert _proximity_score("/a/b/c.py", "") == 0
        assert _proximity_score("", "") == 0


class TestGroupReferencesByDefinition:
    """Tests for _group_references_by_definition helper."""

    def test_single_definition(self):
        """Single definition should have all references."""
        definition = DefinitionResult(
            name="foo",
            kind="function",
            file_path="/a/b/c.py",
            line=10,
            end_line=20,
        )
        references = [
            ReferenceResult(
                file_path="/a/b/d.py",
                line=5,
                column=0,
                context_line="foo()",
                relationship="call",
            ),
            ReferenceResult(
                file_path="/a/x/y.py",
                line=10,
                column=0,
                context_line="foo()",
                relationship="call",
            ),
        ]

        result = _group_references_by_definition([definition], references)

        assert len(result) == 1
        assert result[0].definition == definition
        assert len(result[0].references) == 2

    def test_multiple_definitions(self):
        """Multiple definitions should group by proximity."""
        def1 = DefinitionResult(
            name="foo",
            kind="function",
            file_path="/a/b/c.py",
            line=10,
            end_line=20,
        )
        def2 = DefinitionResult(
            name="foo",
            kind="function",
            file_path="/x/y/z.py",
            line=10,
            end_line=20,
        )

        # Reference closer to def1
        ref1 = ReferenceResult(
            file_path="/a/b/d.py",
            line=5,
            column=0,
            context_line="foo()",
            relationship="call",
        )
        # Reference closer to def2
        ref2 = ReferenceResult(
            file_path="/x/y/w.py",
            line=10,
            column=0,
            context_line="foo()",
            relationship="call",
        )

        result = _group_references_by_definition(
            [def1, def2], [ref1, ref2], include_definition=True
        )

        assert len(result) == 2
        # Each definition should have the closer reference
        def1_refs = [g for g in result if g.definition == def1][0].references
        def2_refs = [g for g in result if g.definition == def2][0].references

        assert any(r.file_path == "/a/b/d.py" for r in def1_refs)
        assert any(r.file_path == "/x/y/w.py" for r in def2_refs)

    def test_empty_definitions(self):
        """Empty definitions should return empty result."""
        result = _group_references_by_definition([], [])
        assert result == []


class TestTransformToReferenceResult:
    """Tests for _transform_to_reference_result helper."""

    def test_normalizes_relationship_type(self, tmp_path):
        """Test that relationship type is normalized."""
        test_file = tmp_path / "test.py"
        test_file.write_text("def foo(): pass\n")

        # Create a mock raw reference
        raw_ref = MagicMock()
        raw_ref.file_path = str(test_file)
        raw_ref.line = 1
        raw_ref.column = 0
        raw_ref.relationship_type = "calls"  # Plural form

        result = _transform_to_reference_result(raw_ref)

        assert result.relationship == "call"  # Normalized form
        assert result.context_line == "def foo(): pass"


class TestFindReferences:
    """Tests for find_references API function."""

    def test_raises_for_invalid_project_root(self):
        """Test that ValueError is raised for invalid project root."""
        with pytest.raises(ValueError, match="does not exist"):
            find_references("/nonexistent/path", "some_symbol")

    @patch("codexlens.search.chain_search.ChainSearchEngine")
    @patch("codexlens.storage.registry.RegistryStore")
    @patch("codexlens.storage.path_mapper.PathMapper")
    @patch("codexlens.config.Config")
    def test_returns_grouped_references(
        self, mock_config, mock_mapper, mock_registry, mock_engine_class, tmp_path
    ):
        """Test that find_references returns GroupedReferences."""
        # Setup mocks
        mock_engine = MagicMock()
        mock_engine_class.return_value = mock_engine

        # Mock symbol search (for definitions)
        mock_symbol = MagicMock()
        mock_symbol.name = "test_func"
        mock_symbol.kind = "function"
        mock_symbol.file = str(tmp_path / "test.py")
        mock_symbol.range = (10, 20)
        mock_engine.search_symbols.return_value = [mock_symbol]

        # Mock reference search
        mock_ref = MagicMock()
        mock_ref.file_path = str(tmp_path / "caller.py")
        mock_ref.line = 5
        mock_ref.column = 0
        mock_ref.relationship_type = "call"
        mock_engine.search_references.return_value = [mock_ref]

        # Create test files
        test_file = tmp_path / "test.py"
        test_file.write_text("def test_func():\n    pass\n")
        caller_file = tmp_path / "caller.py"
        caller_file.write_text("test_func()\n")

        # Call find_references
        result = find_references(str(tmp_path), "test_func")

        # Verify result structure
        assert isinstance(result, list)
        assert len(result) == 1
        assert isinstance(result[0], GroupedReferences)
        assert result[0].definition.name == "test_func"
        assert len(result[0].references) == 1

    @patch("codexlens.search.chain_search.ChainSearchEngine")
    @patch("codexlens.storage.registry.RegistryStore")
    @patch("codexlens.storage.path_mapper.PathMapper")
    @patch("codexlens.config.Config")
    def test_respects_include_definition_false(
        self, mock_config, mock_mapper, mock_registry, mock_engine_class, tmp_path
    ):
        """Test include_definition=False behavior."""
        mock_engine = MagicMock()
        mock_engine_class.return_value = mock_engine
        mock_engine.search_symbols.return_value = []
        mock_engine.search_references.return_value = []

        result = find_references(
            str(tmp_path), "test_func", include_definition=False
        )

        # Should still return a result with placeholder definition
        assert len(result) == 1
        assert result[0].definition.name == "test_func"


class TestImports:
    """Tests for module imports and exports."""

    def test_find_references_exported_from_api(self):
        """Test that find_references is exported from codexlens.api."""
        from codexlens.api import find_references as api_find_references

        assert callable(api_find_references)

    def test_models_exported_from_api(self):
        """Test that result models are exported from codexlens.api."""
        from codexlens.api import (
            GroupedReferences,
            ReferenceResult,
            DefinitionResult,
        )

        assert GroupedReferences is not None
        assert ReferenceResult is not None
        assert DefinitionResult is not None
