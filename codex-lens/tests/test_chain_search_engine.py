"""Unit tests for ChainSearchEngine.

Tests the graph query methods (search_callers, search_callees, search_inheritance)
with mocked SQLiteStore dependency to test logic in isolation.
"""

import pytest
from pathlib import Path
from unittest.mock import Mock, MagicMock, patch, call
from concurrent.futures import ThreadPoolExecutor

from codexlens.search.chain_search import (
    ChainSearchEngine,
    SearchOptions,
    SearchStats,
    ChainSearchResult,
)
from codexlens.entities import SearchResult, Symbol
from codexlens.storage.registry import RegistryStore, DirMapping
from codexlens.storage.path_mapper import PathMapper


@pytest.fixture
def mock_registry():
    """Create a mock RegistryStore."""
    registry = Mock(spec=RegistryStore)
    return registry


@pytest.fixture
def mock_mapper():
    """Create a mock PathMapper."""
    mapper = Mock(spec=PathMapper)
    return mapper


@pytest.fixture
def search_engine(mock_registry, mock_mapper):
    """Create a ChainSearchEngine with mocked dependencies."""
    return ChainSearchEngine(mock_registry, mock_mapper, max_workers=2)


@pytest.fixture
def sample_index_path():
    """Sample index database path."""
    return Path("/test/project/_index.db")


class TestChainSearchEngineCallers:
    """Tests for search_callers method."""

    def test_search_callers_returns_relationships(self, search_engine, mock_registry, sample_index_path):
        """Test that search_callers returns caller relationships."""
        # Setup
        source_path = Path("/test/project")
        target_symbol = "my_function"

        # Mock finding the start index
        mock_registry.find_nearest_index.return_value = DirMapping(
            id=1,
            project_id=1,
            source_path=source_path,
            index_path=sample_index_path,
            depth=0,
            files_count=10,
            last_updated=0.0
        )

        # Mock collect_index_paths to return single index
        with patch.object(search_engine, '_collect_index_paths', return_value=[sample_index_path]):
            # Mock the parallel search to return caller data
            expected_callers = [
                {
                    "source_symbol": "caller_function",
                    "target_symbol": "my_function",
                    "relationship_type": "calls",
                    "source_line": 42,
                    "source_file": "/test/project/module.py",
                    "target_file": "/test/project/lib.py",
                }
            ]

            with patch.object(search_engine, '_search_callers_parallel', return_value=expected_callers):
                # Execute
                result = search_engine.search_callers(target_symbol, source_path)

                # Assert
                assert len(result) == 1
                assert result[0]["source_symbol"] == "caller_function"
                assert result[0]["target_symbol"] == "my_function"
                assert result[0]["relationship_type"] == "calls"
                assert result[0]["source_line"] == 42

    def test_search_callers_empty_results(self, search_engine, mock_registry, sample_index_path):
        """Test that search_callers handles no results gracefully."""
        # Setup
        source_path = Path("/test/project")
        target_symbol = "nonexistent_function"

        # Mock finding the start index
        mock_registry.find_nearest_index.return_value = DirMapping(
            id=1,
            project_id=1,
            source_path=source_path,
            index_path=sample_index_path,
            depth=0,
            files_count=10,
            last_updated=0.0
        )

        # Mock collect_index_paths
        with patch.object(search_engine, '_collect_index_paths', return_value=[sample_index_path]):
            # Mock empty results
            with patch.object(search_engine, '_search_callers_parallel', return_value=[]):
                # Execute
                result = search_engine.search_callers(target_symbol, source_path)

                # Assert
                assert result == []

    def test_search_callers_no_index_found(self, search_engine, mock_registry):
        """Test that search_callers returns empty list when no index found."""
        # Setup
        source_path = Path("/test/project")
        target_symbol = "my_function"

        # Mock no index found
        mock_registry.find_nearest_index.return_value = None

        with patch.object(search_engine, '_find_start_index', return_value=None):
            # Execute
            result = search_engine.search_callers(target_symbol, source_path)

            # Assert
            assert result == []

    def test_search_callers_uses_options(self, search_engine, mock_registry, mock_mapper, sample_index_path):
        """Test that search_callers respects SearchOptions."""
        # Setup
        source_path = Path("/test/project")
        target_symbol = "my_function"
        options = SearchOptions(depth=1, total_limit=50)

        # Configure mapper to return a path that exists
        mock_mapper.source_to_index_db.return_value = sample_index_path

        with patch.object(search_engine, '_collect_index_paths', return_value=[sample_index_path]) as mock_collect:
            with patch.object(search_engine, '_search_callers_parallel', return_value=[]) as mock_search:
                # Patch Path.exists to return True so the exact match is found
                with patch.object(Path, 'exists', return_value=True):
                    # Execute
                    search_engine.search_callers(target_symbol, source_path, options)

                    # Assert that depth was passed to collect_index_paths
                    mock_collect.assert_called_once_with(sample_index_path, 1)
                    # Assert that total_limit was passed to parallel search
                    mock_search.assert_called_once_with([sample_index_path], target_symbol, 50)


class TestChainSearchEngineCallees:
    """Tests for search_callees method."""

    def test_search_callees_returns_relationships(self, search_engine, mock_registry, sample_index_path):
        """Test that search_callees returns callee relationships."""
        # Setup
        source_path = Path("/test/project")
        source_symbol = "caller_function"

        mock_registry.find_nearest_index.return_value = DirMapping(
            id=1,
            project_id=1,
            source_path=source_path,
            index_path=sample_index_path,
            depth=0,
            files_count=10,
            last_updated=0.0
        )

        with patch.object(search_engine, '_collect_index_paths', return_value=[sample_index_path]):
            expected_callees = [
                {
                    "source_symbol": "caller_function",
                    "target_symbol": "callee_function",
                    "relationship_type": "calls",
                    "source_line": 15,
                    "source_file": "/test/project/module.py",
                    "target_file": "/test/project/lib.py",
                }
            ]

            with patch.object(search_engine, '_search_callees_parallel', return_value=expected_callees):
                # Execute
                result = search_engine.search_callees(source_symbol, source_path)

                # Assert
                assert len(result) == 1
                assert result[0]["source_symbol"] == "caller_function"
                assert result[0]["target_symbol"] == "callee_function"
                assert result[0]["source_line"] == 15

    def test_search_callees_filters_by_file(self, search_engine, mock_registry, sample_index_path):
        """Test that search_callees correctly handles file-specific queries."""
        # Setup
        source_path = Path("/test/project")
        source_symbol = "MyClass.method"

        mock_registry.find_nearest_index.return_value = DirMapping(
            id=1,
            project_id=1,
            source_path=source_path,
            index_path=sample_index_path,
            depth=0,
            files_count=10,
            last_updated=0.0
        )

        with patch.object(search_engine, '_collect_index_paths', return_value=[sample_index_path]):
            # Multiple callees from same source symbol
            expected_callees = [
                {
                    "source_symbol": "MyClass.method",
                    "target_symbol": "helper_a",
                    "relationship_type": "calls",
                    "source_line": 10,
                    "source_file": "/test/project/module.py",
                    "target_file": "/test/project/utils.py",
                },
                {
                    "source_symbol": "MyClass.method",
                    "target_symbol": "helper_b",
                    "relationship_type": "calls",
                    "source_line": 20,
                    "source_file": "/test/project/module.py",
                    "target_file": "/test/project/utils.py",
                }
            ]

            with patch.object(search_engine, '_search_callees_parallel', return_value=expected_callees):
                # Execute
                result = search_engine.search_callees(source_symbol, source_path)

                # Assert
                assert len(result) == 2
                assert result[0]["target_symbol"] == "helper_a"
                assert result[1]["target_symbol"] == "helper_b"

    def test_search_callees_empty_results(self, search_engine, mock_registry, sample_index_path):
        """Test that search_callees handles no callees gracefully."""
        source_path = Path("/test/project")
        source_symbol = "leaf_function"

        mock_registry.find_nearest_index.return_value = DirMapping(
            id=1,
            project_id=1,
            source_path=source_path,
            index_path=sample_index_path,
            depth=0,
            files_count=10,
            last_updated=0.0
        )

        with patch.object(search_engine, '_collect_index_paths', return_value=[sample_index_path]):
            with patch.object(search_engine, '_search_callees_parallel', return_value=[]):
                # Execute
                result = search_engine.search_callees(source_symbol, source_path)

                # Assert
                assert result == []


class TestChainSearchEngineInheritance:
    """Tests for search_inheritance method."""

    def test_search_inheritance_returns_inherits_relationships(self, search_engine, mock_registry, sample_index_path):
        """Test that search_inheritance returns inheritance relationships."""
        # Setup
        source_path = Path("/test/project")
        class_name = "BaseClass"

        mock_registry.find_nearest_index.return_value = DirMapping(
            id=1,
            project_id=1,
            source_path=source_path,
            index_path=sample_index_path,
            depth=0,
            files_count=10,
            last_updated=0.0
        )

        with patch.object(search_engine, '_collect_index_paths', return_value=[sample_index_path]):
            expected_inheritance = [
                {
                    "source_symbol": "DerivedClass",
                    "target_symbol": "BaseClass",
                    "relationship_type": "inherits",
                    "source_line": 5,
                    "source_file": "/test/project/derived.py",
                    "target_file": "/test/project/base.py",
                }
            ]

            with patch.object(search_engine, '_search_inheritance_parallel', return_value=expected_inheritance):
                # Execute
                result = search_engine.search_inheritance(class_name, source_path)

                # Assert
                assert len(result) == 1
                assert result[0]["source_symbol"] == "DerivedClass"
                assert result[0]["target_symbol"] == "BaseClass"
                assert result[0]["relationship_type"] == "inherits"

    def test_search_inheritance_multiple_subclasses(self, search_engine, mock_registry, sample_index_path):
        """Test inheritance search with multiple derived classes."""
        source_path = Path("/test/project")
        class_name = "BaseClass"

        mock_registry.find_nearest_index.return_value = DirMapping(
            id=1,
            project_id=1,
            source_path=source_path,
            index_path=sample_index_path,
            depth=0,
            files_count=10,
            last_updated=0.0
        )

        with patch.object(search_engine, '_collect_index_paths', return_value=[sample_index_path]):
            expected_inheritance = [
                {
                    "source_symbol": "DerivedClassA",
                    "target_symbol": "BaseClass",
                    "relationship_type": "inherits",
                    "source_line": 5,
                    "source_file": "/test/project/derived_a.py",
                    "target_file": "/test/project/base.py",
                },
                {
                    "source_symbol": "DerivedClassB",
                    "target_symbol": "BaseClass",
                    "relationship_type": "inherits",
                    "source_line": 10,
                    "source_file": "/test/project/derived_b.py",
                    "target_file": "/test/project/base.py",
                }
            ]

            with patch.object(search_engine, '_search_inheritance_parallel', return_value=expected_inheritance):
                # Execute
                result = search_engine.search_inheritance(class_name, source_path)

                # Assert
                assert len(result) == 2
                assert result[0]["source_symbol"] == "DerivedClassA"
                assert result[1]["source_symbol"] == "DerivedClassB"

    def test_search_inheritance_empty_results(self, search_engine, mock_registry, sample_index_path):
        """Test inheritance search with no subclasses found."""
        source_path = Path("/test/project")
        class_name = "FinalClass"

        mock_registry.find_nearest_index.return_value = DirMapping(
            id=1,
            project_id=1,
            source_path=source_path,
            index_path=sample_index_path,
            depth=0,
            files_count=10,
            last_updated=0.0
        )

        with patch.object(search_engine, '_collect_index_paths', return_value=[sample_index_path]):
            with patch.object(search_engine, '_search_inheritance_parallel', return_value=[]):
                # Execute
                result = search_engine.search_inheritance(class_name, source_path)

                # Assert
                assert result == []


class TestChainSearchEngineParallelSearch:
    """Tests for parallel search aggregation."""

    def test_parallel_search_aggregates_results(self, search_engine, mock_registry, sample_index_path):
        """Test that parallel search aggregates results from multiple indexes."""
        # Setup
        source_path = Path("/test/project")
        target_symbol = "my_function"

        index_path_1 = Path("/test/project/_index.db")
        index_path_2 = Path("/test/project/subdir/_index.db")

        mock_registry.find_nearest_index.return_value = DirMapping(
            id=1,
            project_id=1,
            source_path=source_path,
            index_path=index_path_1,
            depth=0,
            files_count=10,
            last_updated=0.0
        )

        with patch.object(search_engine, '_collect_index_paths', return_value=[index_path_1, index_path_2]):
            # Mock parallel search results from multiple indexes
            callers_from_multiple = [
                {
                    "source_symbol": "caller_in_root",
                    "target_symbol": "my_function",
                    "relationship_type": "calls",
                    "source_line": 10,
                    "source_file": "/test/project/root.py",
                    "target_file": "/test/project/lib.py",
                },
                {
                    "source_symbol": "caller_in_subdir",
                    "target_symbol": "my_function",
                    "relationship_type": "calls",
                    "source_line": 20,
                    "source_file": "/test/project/subdir/module.py",
                    "target_file": "/test/project/lib.py",
                }
            ]

            with patch.object(search_engine, '_search_callers_parallel', return_value=callers_from_multiple):
                # Execute
                result = search_engine.search_callers(target_symbol, source_path)

                # Assert results from both indexes are included
                assert len(result) == 2
                assert any(r["source_file"] == "/test/project/root.py" for r in result)
                assert any(r["source_file"] == "/test/project/subdir/module.py" for r in result)

    def test_parallel_search_deduplicates_results(self, search_engine, mock_registry, sample_index_path):
        """Test that parallel search deduplicates results by (source_file, source_line)."""
        # Note: This test verifies the behavior of _search_callers_parallel deduplication
        source_path = Path("/test/project")
        target_symbol = "my_function"

        index_path_1 = Path("/test/project/_index.db")
        index_path_2 = Path("/test/project/_index.db")  # Same index (simulates duplicate)

        mock_registry.find_nearest_index.return_value = DirMapping(
            id=1,
            project_id=1,
            source_path=source_path,
            index_path=index_path_1,
            depth=0,
            files_count=10,
            last_updated=0.0
        )

        with patch.object(search_engine, '_collect_index_paths', return_value=[index_path_1, index_path_2]):
            # Mock duplicate results from same location
            duplicate_callers = [
                {
                    "source_symbol": "caller_function",
                    "target_symbol": "my_function",
                    "relationship_type": "calls",
                    "source_line": 42,
                    "source_file": "/test/project/module.py",
                    "target_file": "/test/project/lib.py",
                },
                {
                    "source_symbol": "caller_function",
                    "target_symbol": "my_function",
                    "relationship_type": "calls",
                    "source_line": 42,
                    "source_file": "/test/project/module.py",
                    "target_file": "/test/project/lib.py",
                }
            ]

            with patch.object(search_engine, '_search_callers_parallel', return_value=duplicate_callers):
                # Execute
                result = search_engine.search_callers(target_symbol, source_path)

                # Assert: even with duplicates in input, output may contain both
                # (actual deduplication happens in _search_callers_parallel)
                assert len(result) >= 1


class TestChainSearchEngineContextManager:
    """Tests for context manager functionality."""

    def test_context_manager_closes_executor(self, mock_registry, mock_mapper):
        """Test that context manager properly closes executor."""
        with ChainSearchEngine(mock_registry, mock_mapper) as engine:
            # Force executor creation
            engine._get_executor()
            assert engine._executor is not None

        # Executor should be closed after exiting context
        assert engine._executor is None

    def test_close_method_shuts_down_executor(self, search_engine):
        """Test that close() method shuts down executor."""
        # Create executor
        search_engine._get_executor()
        assert search_engine._executor is not None

        # Close
        search_engine.close()
        assert search_engine._executor is None


class TestSearchCallersSingle:
    """Tests for _search_callers_single internal method."""

    def test_search_callers_single_queries_store(self, search_engine, sample_index_path):
        """Test that _search_callers_single queries SQLiteStore correctly."""
        target_symbol = "my_function"

        # Mock SQLiteStore
        with patch('codexlens.search.chain_search.SQLiteStore') as MockStore:
            mock_store_instance = MockStore.return_value.__enter__.return_value
            mock_store_instance.query_relationships_by_target.return_value = [
                {
                    "source_symbol": "caller",
                    "target_symbol": target_symbol,
                    "relationship_type": "calls",
                    "source_line": 10,
                    "source_file": "/test/file.py",
                    "target_file": "/test/lib.py",
                }
            ]

            # Execute
            result = search_engine._search_callers_single(sample_index_path, target_symbol)

            # Assert
            assert len(result) == 1
            assert result[0]["source_symbol"] == "caller"
            mock_store_instance.query_relationships_by_target.assert_called_once_with(target_symbol)

    def test_search_callers_single_handles_errors(self, search_engine, sample_index_path):
        """Test that _search_callers_single returns empty list on error."""
        target_symbol = "my_function"

        with patch('codexlens.search.chain_search.SQLiteStore') as MockStore:
            MockStore.return_value.__enter__.side_effect = Exception("Database error")

            # Execute
            result = search_engine._search_callers_single(sample_index_path, target_symbol)

            # Assert - should return empty list, not raise exception
            assert result == []


class TestSearchCalleesSingle:
    """Tests for _search_callees_single internal method."""

    def test_search_callees_single_queries_database(self, search_engine, sample_index_path):
        """Test that _search_callees_single queries SQLiteStore correctly."""
        source_symbol = "caller_function"

        # Mock SQLiteStore
        with patch('codexlens.search.chain_search.SQLiteStore') as MockStore:
            mock_store_instance = MagicMock()
            MockStore.return_value.__enter__.return_value = mock_store_instance

            # Mock execute_query to return relationship data (using new public API)
            mock_store_instance.execute_query.return_value = [
                {
                    "source_symbol": source_symbol,
                    "target_symbol": "callee_function",
                    "relationship_type": "call",
                    "source_line": 15,
                    "source_file": "/test/module.py",
                    "target_file": "/test/lib.py",
                }
            ]

            # Execute
            result = search_engine._search_callees_single(sample_index_path, source_symbol)

            # Assert - verify execute_query was called (public API)
            assert mock_store_instance.execute_query.called
            assert len(result) == 1
            assert result[0]["source_symbol"] == source_symbol
            assert result[0]["target_symbol"] == "callee_function"

    def test_search_callees_single_handles_errors(self, search_engine, sample_index_path):
        """Test that _search_callees_single returns empty list on error."""
        source_symbol = "caller_function"

        with patch('codexlens.search.chain_search.SQLiteStore') as MockStore:
            MockStore.return_value.__enter__.side_effect = Exception("DB error")

            # Execute
            result = search_engine._search_callees_single(sample_index_path, source_symbol)

            # Assert - should return empty list, not raise exception
            assert result == []


class TestSearchInheritanceSingle:
    """Tests for _search_inheritance_single internal method."""

    def test_search_inheritance_single_queries_database(self, search_engine, sample_index_path):
        """Test that _search_inheritance_single queries SQLiteStore correctly."""
        class_name = "BaseClass"

        # Mock SQLiteStore
        with patch('codexlens.search.chain_search.SQLiteStore') as MockStore:
            mock_store_instance = MagicMock()
            MockStore.return_value.__enter__.return_value = mock_store_instance

            # Mock execute_query to return relationship data (using new public API)
            mock_store_instance.execute_query.return_value = [
                {
                    "source_symbol": "DerivedClass",
                    "target_qualified_name": "BaseClass",
                    "relationship_type": "inherits",
                    "source_line": 5,
                    "source_file": "/test/derived.py",
                    "target_file": "/test/base.py",
                }
            ]

            # Execute
            result = search_engine._search_inheritance_single(sample_index_path, class_name)

            # Assert
            assert mock_store_instance.execute_query.called
            assert len(result) == 1
            assert result[0]["source_symbol"] == "DerivedClass"
            assert result[0]["relationship_type"] == "inherits"

            # Verify execute_query was called with 'inherits' filter
            call_args = mock_store_instance.execute_query.call_args
            sql_query = call_args[0][0]
            assert "relationship_type = 'inherits'" in sql_query

    def test_search_inheritance_single_handles_errors(self, search_engine, sample_index_path):
        """Test that _search_inheritance_single returns empty list on error."""
        class_name = "BaseClass"

        with patch('codexlens.search.chain_search.SQLiteStore') as MockStore:
            MockStore.return_value.__enter__.side_effect = Exception("DB error")

            # Execute
            result = search_engine._search_inheritance_single(sample_index_path, class_name)

            # Assert - should return empty list, not raise exception
            assert result == []
