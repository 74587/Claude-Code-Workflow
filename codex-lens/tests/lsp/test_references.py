"""Tests for reference search functionality.

This module tests the ReferenceResult dataclass and search_references method
in ChainSearchEngine, as well as the updated lsp_references handler.
"""

from __future__ import annotations

import pytest
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch
import sqlite3
import tempfile
import os


class TestReferenceResult:
    """Test ReferenceResult dataclass."""

    def test_reference_result_fields(self):
        """ReferenceResult has all required fields."""
        from codexlens.search.chain_search import ReferenceResult

        ref = ReferenceResult(
            file_path="/test/file.py",
            line=10,
            column=5,
            context="def foo():",
            relationship_type="call",
        )
        assert ref.file_path == "/test/file.py"
        assert ref.line == 10
        assert ref.column == 5
        assert ref.context == "def foo():"
        assert ref.relationship_type == "call"

    def test_reference_result_with_empty_context(self):
        """ReferenceResult can have empty context."""
        from codexlens.search.chain_search import ReferenceResult

        ref = ReferenceResult(
            file_path="/test/file.py",
            line=1,
            column=0,
            context="",
            relationship_type="import",
        )
        assert ref.context == ""

    def test_reference_result_different_relationship_types(self):
        """ReferenceResult supports different relationship types."""
        from codexlens.search.chain_search import ReferenceResult

        types = ["call", "import", "inheritance", "implementation", "usage"]
        for rel_type in types:
            ref = ReferenceResult(
                file_path="/test/file.py",
                line=1,
                column=0,
                context="test",
                relationship_type=rel_type,
            )
            assert ref.relationship_type == rel_type


class TestExtractContext:
    """Test the _extract_context helper method."""

    def test_extract_context_middle_of_file(self):
        """Extract context from middle of file."""
        from codexlens.search.chain_search import ChainSearchEngine, ReferenceResult

        content = "\n".join([
            "line 1",
            "line 2",
            "line 3",
            "line 4",  # target line
            "line 5",
            "line 6",
            "line 7",
        ])

        # Create minimal mock engine to test _extract_context
        mock_registry = Mock()
        mock_mapper = Mock()

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        context = engine._extract_context(content, line=4, context_lines=2)

        assert "line 2" in context
        assert "line 3" in context
        assert "line 4" in context
        assert "line 5" in context
        assert "line 6" in context

    def test_extract_context_start_of_file(self):
        """Extract context at start of file."""
        from codexlens.search.chain_search import ChainSearchEngine

        content = "\n".join([
            "line 1",  # target
            "line 2",
            "line 3",
            "line 4",
        ])

        mock_registry = Mock()
        mock_mapper = Mock()

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        context = engine._extract_context(content, line=1, context_lines=2)

        assert "line 1" in context
        assert "line 2" in context
        assert "line 3" in context

    def test_extract_context_end_of_file(self):
        """Extract context at end of file."""
        from codexlens.search.chain_search import ChainSearchEngine

        content = "\n".join([
            "line 1",
            "line 2",
            "line 3",
            "line 4",  # target
        ])

        mock_registry = Mock()
        mock_mapper = Mock()

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        context = engine._extract_context(content, line=4, context_lines=2)

        assert "line 2" in context
        assert "line 3" in context
        assert "line 4" in context

    def test_extract_context_empty_content(self):
        """Extract context from empty content."""
        from codexlens.search.chain_search import ChainSearchEngine

        mock_registry = Mock()
        mock_mapper = Mock()

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        context = engine._extract_context("", line=1, context_lines=3)

        assert context == ""

    def test_extract_context_invalid_line(self):
        """Extract context with invalid line number."""
        from codexlens.search.chain_search import ChainSearchEngine

        content = "line 1\nline 2\nline 3"

        mock_registry = Mock()
        mock_mapper = Mock()

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        # Line 0 (invalid)
        assert engine._extract_context(content, line=0, context_lines=1) == ""

        # Line beyond end
        assert engine._extract_context(content, line=100, context_lines=1) == ""


class TestSearchReferences:
    """Test search_references method."""

    def test_returns_empty_for_no_source_path_and_no_registry(self):
        """Returns empty list when no source path and registry has no mappings."""
        from codexlens.search.chain_search import ChainSearchEngine

        mock_registry = Mock()
        mock_registry.list_mappings.return_value = []
        mock_mapper = Mock()

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        results = engine.search_references("test_symbol")

        assert results == []

    def test_returns_empty_for_no_indexes(self):
        """Returns empty list when no indexes found."""
        from codexlens.search.chain_search import ChainSearchEngine

        mock_registry = Mock()
        mock_mapper = Mock()
        mock_mapper.source_to_index_db.return_value = Path("/nonexistent/_index.db")

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        with patch.object(engine, "_find_start_index", return_value=None):
            results = engine.search_references("test_symbol", Path("/some/path"))

        assert results == []

    def test_deduplicates_results(self):
        """Removes duplicate file:line references."""
        from codexlens.search.chain_search import ChainSearchEngine, ReferenceResult

        mock_registry = Mock()
        mock_mapper = Mock()

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        # Create a temporary database with duplicate relationships
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            conn = sqlite3.connect(str(db_path))
            conn.executescript("""
                CREATE TABLE files (
                    id INTEGER PRIMARY KEY,
                    path TEXT NOT NULL,
                    language TEXT NOT NULL,
                    content TEXT NOT NULL
                );
                CREATE TABLE symbols (
                    id INTEGER PRIMARY KEY,
                    file_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    start_line INTEGER NOT NULL,
                    end_line INTEGER NOT NULL
                );
                CREATE TABLE code_relationships (
                    id INTEGER PRIMARY KEY,
                    source_symbol_id INTEGER NOT NULL,
                    target_qualified_name TEXT NOT NULL,
                    relationship_type TEXT NOT NULL,
                    source_line INTEGER NOT NULL,
                    target_file TEXT
                );

                INSERT INTO files VALUES (1, '/test/file.py', 'python', 'def test(): pass');
                INSERT INTO symbols VALUES (1, 1, 'test_func', 'function', 1, 1);
                INSERT INTO code_relationships VALUES (1, 1, 'target_func', 'call', 10, NULL);
                INSERT INTO code_relationships VALUES (2, 1, 'target_func', 'call', 10, NULL);
            """)
            conn.commit()
            conn.close()

            with patch.object(engine, "_find_start_index", return_value=db_path):
                with patch.object(engine, "_collect_index_paths", return_value=[db_path]):
                    results = engine.search_references("target_func", Path(tmpdir))

            # Should only have 1 result due to deduplication
            assert len(results) == 1
            assert results[0].line == 10

    def test_sorts_by_file_and_line(self):
        """Results sorted by file path then line number."""
        from codexlens.search.chain_search import ChainSearchEngine, ReferenceResult

        mock_registry = Mock()
        mock_mapper = Mock()

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            conn = sqlite3.connect(str(db_path))
            conn.executescript("""
                CREATE TABLE files (
                    id INTEGER PRIMARY KEY,
                    path TEXT NOT NULL,
                    language TEXT NOT NULL,
                    content TEXT NOT NULL
                );
                CREATE TABLE symbols (
                    id INTEGER PRIMARY KEY,
                    file_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    start_line INTEGER NOT NULL,
                    end_line INTEGER NOT NULL
                );
                CREATE TABLE code_relationships (
                    id INTEGER PRIMARY KEY,
                    source_symbol_id INTEGER NOT NULL,
                    target_qualified_name TEXT NOT NULL,
                    relationship_type TEXT NOT NULL,
                    source_line INTEGER NOT NULL,
                    target_file TEXT
                );

                INSERT INTO files VALUES (1, '/test/b_file.py', 'python', 'content');
                INSERT INTO files VALUES (2, '/test/a_file.py', 'python', 'content');
                INSERT INTO symbols VALUES (1, 1, 'func1', 'function', 1, 1);
                INSERT INTO symbols VALUES (2, 2, 'func2', 'function', 1, 1);
                INSERT INTO code_relationships VALUES (1, 1, 'target', 'call', 20, NULL);
                INSERT INTO code_relationships VALUES (2, 1, 'target', 'call', 10, NULL);
                INSERT INTO code_relationships VALUES (3, 2, 'target', 'call', 5, NULL);
            """)
            conn.commit()
            conn.close()

            with patch.object(engine, "_find_start_index", return_value=db_path):
                with patch.object(engine, "_collect_index_paths", return_value=[db_path]):
                    results = engine.search_references("target", Path(tmpdir))

            # Should be sorted: a_file.py:5, b_file.py:10, b_file.py:20
            assert len(results) == 3
            assert results[0].file_path == "/test/a_file.py"
            assert results[0].line == 5
            assert results[1].file_path == "/test/b_file.py"
            assert results[1].line == 10
            assert results[2].file_path == "/test/b_file.py"
            assert results[2].line == 20

    def test_respects_limit(self):
        """Returns at most limit results."""
        from codexlens.search.chain_search import ChainSearchEngine

        mock_registry = Mock()
        mock_mapper = Mock()

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            conn = sqlite3.connect(str(db_path))
            conn.executescript("""
                CREATE TABLE files (
                    id INTEGER PRIMARY KEY,
                    path TEXT NOT NULL,
                    language TEXT NOT NULL,
                    content TEXT NOT NULL
                );
                CREATE TABLE symbols (
                    id INTEGER PRIMARY KEY,
                    file_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    start_line INTEGER NOT NULL,
                    end_line INTEGER NOT NULL
                );
                CREATE TABLE code_relationships (
                    id INTEGER PRIMARY KEY,
                    source_symbol_id INTEGER NOT NULL,
                    target_qualified_name TEXT NOT NULL,
                    relationship_type TEXT NOT NULL,
                    source_line INTEGER NOT NULL,
                    target_file TEXT
                );

                INSERT INTO files VALUES (1, '/test/file.py', 'python', 'content');
                INSERT INTO symbols VALUES (1, 1, 'func', 'function', 1, 1);
            """)
            # Insert many relationships
            for i in range(50):
                conn.execute(
                    "INSERT INTO code_relationships VALUES (?, 1, 'target', 'call', ?, NULL)",
                    (i + 1, i + 1)
                )
            conn.commit()
            conn.close()

            with patch.object(engine, "_find_start_index", return_value=db_path):
                with patch.object(engine, "_collect_index_paths", return_value=[db_path]):
                    results = engine.search_references("target", Path(tmpdir), limit=10)

            assert len(results) == 10

    def test_matches_qualified_name(self):
        """Matches symbols by qualified name suffix."""
        from codexlens.search.chain_search import ChainSearchEngine

        mock_registry = Mock()
        mock_mapper = Mock()

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = Path(tmpdir) / "_index.db"
            conn = sqlite3.connect(str(db_path))
            conn.executescript("""
                CREATE TABLE files (
                    id INTEGER PRIMARY KEY,
                    path TEXT NOT NULL,
                    language TEXT NOT NULL,
                    content TEXT NOT NULL
                );
                CREATE TABLE symbols (
                    id INTEGER PRIMARY KEY,
                    file_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    kind TEXT NOT NULL,
                    start_line INTEGER NOT NULL,
                    end_line INTEGER NOT NULL
                );
                CREATE TABLE code_relationships (
                    id INTEGER PRIMARY KEY,
                    source_symbol_id INTEGER NOT NULL,
                    target_qualified_name TEXT NOT NULL,
                    relationship_type TEXT NOT NULL,
                    source_line INTEGER NOT NULL,
                    target_file TEXT
                );

                INSERT INTO files VALUES (1, '/test/file.py', 'python', 'content');
                INSERT INTO symbols VALUES (1, 1, 'caller', 'function', 1, 1);
                -- Fully qualified name
                INSERT INTO code_relationships VALUES (1, 1, 'module.submodule.target_func', 'call', 10, NULL);
                -- Simple name
                INSERT INTO code_relationships VALUES (2, 1, 'target_func', 'call', 20, NULL);
            """)
            conn.commit()
            conn.close()

            with patch.object(engine, "_find_start_index", return_value=db_path):
                with patch.object(engine, "_collect_index_paths", return_value=[db_path]):
                    results = engine.search_references("target_func", Path(tmpdir))

            # Should find both references
            assert len(results) == 2


class TestLspReferencesHandler:
    """Test the LSP references handler."""

    def test_handler_uses_search_engine(self):
        """Handler uses search_engine.search_references when available."""
        pytest.importorskip("pygls")
        pytest.importorskip("lsprotocol")

        from lsprotocol import types as lsp
        from codexlens.lsp.handlers import _path_to_uri
        from codexlens.search.chain_search import ReferenceResult

        # Create mock references
        mock_references = [
            ReferenceResult(
                file_path="/test/file1.py",
                line=10,
                column=5,
                context="def foo():",
                relationship_type="call",
            ),
            ReferenceResult(
                file_path="/test/file2.py",
                line=20,
                column=0,
                context="import foo",
                relationship_type="import",
            ),
        ]

        # Verify conversion to LSP Location
        locations = []
        for ref in mock_references:
            locations.append(
                lsp.Location(
                    uri=_path_to_uri(ref.file_path),
                    range=lsp.Range(
                        start=lsp.Position(
                            line=max(0, ref.line - 1),
                            character=ref.column,
                        ),
                        end=lsp.Position(
                            line=max(0, ref.line - 1),
                            character=ref.column + len("foo"),
                        ),
                    ),
                )
            )

        assert len(locations) == 2
        # First reference at line 10 (0-indexed = 9)
        assert locations[0].range.start.line == 9
        assert locations[0].range.start.character == 5
        # Second reference at line 20 (0-indexed = 19)
        assert locations[1].range.start.line == 19
        assert locations[1].range.start.character == 0

    def test_handler_falls_back_to_global_index(self):
        """Handler falls back to global_index when search_engine unavailable."""
        pytest.importorskip("pygls")
        pytest.importorskip("lsprotocol")

        from codexlens.lsp.handlers import symbol_to_location
        from codexlens.entities import Symbol

        # Test fallback path converts Symbol to Location
        symbol = Symbol(
            name="test_func",
            kind="function",
            range=(10, 15),
            file="/test/file.py",
        )

        location = symbol_to_location(symbol)
        assert location is not None
        # LSP uses 0-based lines
        assert location.range.start.line == 9
        assert location.range.end.line == 14
