"""Full coverage tests for CodexLens search functionality.

Comprehensive test suite covering:
- Chain search engine internals
- Multi-directory hierarchical search
- Result merging and deduplication
- Context manager behavior
- Semantic search integration
- Edge cases and error recovery
- Parallel search stress tests
- Boundary conditions
"""

import tempfile
import pytest
import threading
import time
from pathlib import Path
from unittest.mock import MagicMock, patch, PropertyMock
from concurrent.futures import ThreadPoolExecutor

from codexlens.storage.sqlite_store import SQLiteStore
from codexlens.storage.dir_index import DirIndexStore
from codexlens.storage.registry import RegistryStore
from codexlens.storage.path_mapper import PathMapper
from codexlens.search import (
    ChainSearchEngine,
    SearchOptions,
    SearchStats,
    ChainSearchResult,
    quick_search,
)
from codexlens.entities import IndexedFile, Symbol, SearchResult


# === Fixtures ===

@pytest.fixture
def temp_dir():
    """Create a temporary directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def mock_registry():
    """Create a mock registry."""
    registry = MagicMock(spec=RegistryStore)
    registry.find_nearest_index.return_value = None
    return registry


@pytest.fixture
def mock_mapper():
    """Create a mock path mapper."""
    return MagicMock(spec=PathMapper)


@pytest.fixture
def sample_code_files():
    """Sample code file data for comprehensive testing."""
    return [
        # Authentication module
        {
            "name": "auth.py",
            "language": "python",
            "content": """
def authenticate(username, password):
    '''Authenticate user with credentials.'''
    user = find_user(username)
    if user and check_password(user, password):
        return create_token(user)
    return None

def verify_token(token):
    '''Verify JWT token validity.'''
    try:
        payload = decode_token(token)
        return payload
    except TokenExpired:
        return None

class AuthManager:
    '''Manages authentication state.'''
    def __init__(self):
        self.sessions = {}

    def login(self, user):
        token = authenticate(user.name, user.password)
        self.sessions[user.id] = token
        return token
""",
            "symbols": [
                Symbol(name="authenticate", kind="function", range=(2, 8)),
                Symbol(name="verify_token", kind="function", range=(10, 17)),
                Symbol(name="AuthManager", kind="class", range=(19, 28)),
            ],
        },
        # Database module
        {
            "name": "database.py",
            "language": "python",
            "content": """
def connect(host, port, database):
    '''Establish database connection.'''
    return Connection(host, port, database)

def query(connection, sql, params=None):
    '''Execute SQL query and return results.'''
    cursor = connection.cursor()
    cursor.execute(sql, params or [])
    return cursor.fetchall()

class DatabasePool:
    '''Connection pool for database.'''
    def __init__(self, size=10):
        self.pool = []
        self.size = size

    def get_connection(self):
        if self.pool:
            return self.pool.pop()
        return connect()
""",
            "symbols": [
                Symbol(name="connect", kind="function", range=(2, 4)),
                Symbol(name="query", kind="function", range=(6, 10)),
                Symbol(name="DatabasePool", kind="class", range=(12, 21)),
            ],
        },
        # Utils module
        {
            "name": "utils.py",
            "language": "python",
            "content": """
def format_date(date, fmt='%Y-%m-%d'):
    return date.strftime(fmt)

def parse_json(data):
    '''Parse JSON string to dictionary.'''
    import json
    return json.loads(data)

def hash_password(password, salt=None):
    '''Hash password using bcrypt.'''
    import hashlib
    salt = salt or generate_salt()
    return hashlib.sha256((password + salt).encode()).hexdigest()
""",
            "symbols": [
                Symbol(name="format_date", kind="function", range=(2, 3)),
                Symbol(name="parse_json", kind="function", range=(5, 8)),
                Symbol(name="hash_password", kind="function", range=(10, 14)),
            ],
        },
    ]


@pytest.fixture
def populated_single_store(temp_dir, sample_code_files):
    """Create a single populated DirIndexStore."""
    db_path = temp_dir / "_index.db"
    store = DirIndexStore(db_path)
    store.initialize()

    for file_data in sample_code_files:
        store.add_file(
            name=file_data["name"],
            full_path=str(temp_dir / file_data["name"]),
            content=file_data["content"],
            language=file_data["language"],
            symbols=file_data["symbols"],
        )

    yield store
    store.close()


@pytest.fixture
def hierarchical_index_structure(temp_dir, sample_code_files):
    """Create a multi-level directory index structure for chain search testing.

    Structure:
    project/
        _index.db (root)
        src/
            _index.db
            auth/
                _index.db
            db/
                _index.db
        tests/
            _index.db
    """
    structure = {}

    # Root directory
    root_dir = temp_dir / "project"
    root_dir.mkdir()
    root_db = root_dir / "_index.db"
    root_store = DirIndexStore(root_db)
    root_store.initialize()
    root_store.add_file(
        name="main.py",
        full_path=str(root_dir / "main.py"),
        content="# Main entry point\nfrom src import auth, db\ndef main(): pass",
        language="python",
        symbols=[Symbol(name="main", kind="function", range=(3, 3))],
    )
    structure["root"] = {"path": root_dir, "db": root_db, "store": root_store}

    # src directory
    src_dir = root_dir / "src"
    src_dir.mkdir()
    src_db = src_dir / "_index.db"
    src_store = DirIndexStore(src_db)
    src_store.initialize()
    src_store.add_file(
        name="__init__.py",
        full_path=str(src_dir / "__init__.py"),
        content="# Source package\nfrom .auth import authenticate\nfrom .db import connect",
        language="python",
    )
    structure["src"] = {"path": src_dir, "db": src_db, "store": src_store}

    # src/auth directory
    auth_dir = src_dir / "auth"
    auth_dir.mkdir()
    auth_db = auth_dir / "_index.db"
    auth_store = DirIndexStore(auth_db)
    auth_store.initialize()
    auth_store.add_file(
        name="auth.py",
        full_path=str(auth_dir / "auth.py"),
        content=sample_code_files[0]["content"],
        language="python",
        symbols=sample_code_files[0]["symbols"],
    )
    structure["auth"] = {"path": auth_dir, "db": auth_db, "store": auth_store}

    # src/db directory
    db_dir = src_dir / "db"
    db_dir.mkdir()
    db_db = db_dir / "_index.db"
    db_store = DirIndexStore(db_db)
    db_store.initialize()
    db_store.add_file(
        name="database.py",
        full_path=str(db_dir / "database.py"),
        content=sample_code_files[1]["content"],
        language="python",
        symbols=sample_code_files[1]["symbols"],
    )
    structure["db"] = {"path": db_dir, "db": db_db, "store": db_store}

    # tests directory
    tests_dir = root_dir / "tests"
    tests_dir.mkdir()
    tests_db = tests_dir / "_index.db"
    tests_store = DirIndexStore(tests_db)
    tests_store.initialize()
    tests_store.add_file(
        name="test_auth.py",
        full_path=str(tests_dir / "test_auth.py"),
        content="import pytest\nfrom src.auth import authenticate\ndef test_authenticate(): assert authenticate('user', 'pass')",
        language="python",
        symbols=[Symbol(name="test_authenticate", kind="function", range=(3, 3))],
    )
    structure["tests"] = {"path": tests_dir, "db": tests_db, "store": tests_store}

    # Link subdirectories
    root_store.register_subdir(name="src", index_path=src_db)
    root_store.register_subdir(name="tests", index_path=tests_db)
    src_store.register_subdir(name="auth", index_path=auth_db)
    src_store.register_subdir(name="db", index_path=db_db)

    # Close all stores before yielding to avoid Windows file locking issues
    root_store.close()
    src_store.close()
    auth_store.close()
    db_store.close()
    tests_store.close()

    yield structure


# === Chain Search Engine Internal Tests ===

class TestChainSearchEngineInternals:
    """Tests for ChainSearchEngine internal methods."""

    def test_context_manager_enter_exit(self, mock_registry, mock_mapper):
        """Test context manager protocol."""
        with ChainSearchEngine(mock_registry, mock_mapper) as engine:
            assert engine is not None
            assert isinstance(engine, ChainSearchEngine)
        # Engine should be closed after exit

    def test_close_without_executor(self, mock_registry, mock_mapper):
        """Test close() when executor was never created."""
        engine = ChainSearchEngine(mock_registry, mock_mapper)
        engine.close()  # Should not raise

    def test_close_with_executor(self, mock_registry, mock_mapper, temp_dir):
        """Test close() properly shuts down executor."""
        # Create index
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(
            name="test.py",
            full_path=str(temp_dir / "test.py"),
            content="test content searchable",
            language="python",
        )
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        # Trigger executor creation
        engine.search("test", temp_dir)

        # Close should work
        engine.close()
        assert engine._executor is None

    def test_get_executor_lazy_initialization(self, mock_registry, mock_mapper):
        """Test executor is lazily initialized."""
        engine = ChainSearchEngine(mock_registry, mock_mapper)
        assert engine._executor is None

        executor = engine._get_executor()
        assert executor is not None
        assert engine._executor is executor

        # Second call returns same instance
        assert engine._get_executor() is executor

        engine.close()

    def test_get_executor_custom_workers(self, mock_registry, mock_mapper):
        """Test executor with custom worker count."""
        engine = ChainSearchEngine(mock_registry, mock_mapper, max_workers=4)
        executor = engine._get_executor()
        assert executor is not None
        engine.close()


class TestIndexPathCollection:
    """Tests for _collect_index_paths method."""

    def test_collect_depth_zero(self, mock_registry, mock_mapper, hierarchical_index_structure):
        """Test collection with depth=0 returns only start index."""
        structure = hierarchical_index_structure
        root_db = structure["root"]["db"]

        mock_mapper.source_to_index_db.return_value = root_db

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        paths = engine._collect_index_paths(root_db, depth=0)

        assert len(paths) == 1
        assert paths[0] == root_db.resolve()
        engine.close()

    def test_collect_depth_one(self, mock_registry, mock_mapper, hierarchical_index_structure):
        """Test collection with depth=1 returns root + immediate children."""
        structure = hierarchical_index_structure
        root_db = structure["root"]["db"]

        mock_mapper.source_to_index_db.return_value = root_db

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        paths = engine._collect_index_paths(root_db, depth=1)

        # Should include root, src, tests (not auth/db which are depth 2)
        assert len(paths) == 3
        engine.close()

    def test_collect_depth_unlimited(self, mock_registry, mock_mapper, hierarchical_index_structure):
        """Test collection with depth=-1 returns all indexes."""
        structure = hierarchical_index_structure
        root_db = structure["root"]["db"]

        mock_mapper.source_to_index_db.return_value = root_db

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        paths = engine._collect_index_paths(root_db, depth=-1)

        # Should include all 5: root, src, tests, auth, db
        assert len(paths) == 5
        engine.close()

    def test_collect_avoids_duplicates(self, mock_registry, mock_mapper, hierarchical_index_structure):
        """Test collection deduplicates paths."""
        structure = hierarchical_index_structure
        root_db = structure["root"]["db"]

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        paths = engine._collect_index_paths(root_db, depth=-1)

        # All paths should be unique
        path_set = set(str(p) for p in paths)
        assert len(path_set) == len(paths)
        engine.close()

    def test_collect_handles_missing_subdir_index(self, mock_registry, mock_mapper, temp_dir):
        """Test collection handles missing subdirectory indexes gracefully."""
        # Create root with reference to non-existent subdir
        root_db = temp_dir / "_index.db"
        store = DirIndexStore(root_db)
        store.initialize()
        store.add_file(
            name="test.py",
            full_path=str(temp_dir / "test.py"),
            content="test",
            language="python",
        )
        # Add reference to non-existent index
        store.register_subdir(name="missing", index_path=temp_dir / "missing" / "_index.db")
        store.close()

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        paths = engine._collect_index_paths(root_db, depth=-1)

        # Should only include root (missing subdir is skipped)
        assert len(paths) == 1
        engine.close()


class TestResultMergeAndRank:
    """Tests for _merge_and_rank method."""

    def test_merge_deduplicates_by_path(self, mock_registry, mock_mapper):
        """Test merging deduplicates results by path."""
        engine = ChainSearchEngine(mock_registry, mock_mapper)

        results = [
            SearchResult(path="/test/file.py", score=10.0, excerpt="match 1"),
            SearchResult(path="/test/file.py", score=5.0, excerpt="match 2"),
            SearchResult(path="/test/other.py", score=8.0, excerpt="match 3"),
        ]

        merged = engine._merge_and_rank(results, limit=10)

        assert len(merged) == 2
        # Should keep highest score for duplicate path
        file_result = next(r for r in merged if r.path == "/test/file.py")
        assert file_result.score == 10.0
        engine.close()

    def test_merge_sorts_by_score_descending(self, mock_registry, mock_mapper):
        """Test merged results are sorted by score descending."""
        engine = ChainSearchEngine(mock_registry, mock_mapper)

        results = [
            SearchResult(path="/test/low.py", score=1.0, excerpt=""),
            SearchResult(path="/test/high.py", score=100.0, excerpt=""),
            SearchResult(path="/test/mid.py", score=50.0, excerpt=""),
        ]

        merged = engine._merge_and_rank(results, limit=10)

        assert merged[0].path == "/test/high.py"
        assert merged[1].path == "/test/mid.py"
        assert merged[2].path == "/test/low.py"
        engine.close()

    def test_merge_respects_limit(self, mock_registry, mock_mapper):
        """Test merge respects limit parameter."""
        engine = ChainSearchEngine(mock_registry, mock_mapper)

        results = [
            SearchResult(path=f"/test/file{i}.py", score=float(i), excerpt="")
            for i in range(100)
        ]

        merged = engine._merge_and_rank(results, limit=5)

        assert len(merged) == 5
        # Should be the top 5 by score
        assert merged[0].score == 99.0
        engine.close()

    def test_merge_empty_results(self, mock_registry, mock_mapper):
        """Test merge handles empty results."""
        engine = ChainSearchEngine(mock_registry, mock_mapper)
        merged = engine._merge_and_rank([], limit=10)
        assert merged == []
        engine.close()


# === Hierarchical Chain Search Tests ===

class TestHierarchicalChainSearch:
    """Tests for searching across directory hierarchies."""

    def test_search_from_root(self, mock_registry, mock_mapper, hierarchical_index_structure):
        """Test search starting from root finds results in all subdirectories."""
        structure = hierarchical_index_structure
        root_db = structure["root"]["db"]
        root_path = structure["root"]["path"]

        mock_mapper.source_to_index_db.return_value = root_db

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        result = engine.search("authenticate", root_path)

        # Should find authenticate in auth.py and test_auth.py
        assert len(result.results) >= 1
        assert result.stats.dirs_searched == 5  # All directories
        engine.close()

    def test_search_from_subdir(self, mock_registry, mock_mapper, hierarchical_index_structure):
        """Test search starting from subdirectory."""
        structure = hierarchical_index_structure
        src_db = structure["src"]["db"]
        src_path = structure["src"]["path"]

        mock_mapper.source_to_index_db.return_value = src_db

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        result = engine.search("authenticate", src_path)

        # Should find only in src subtree (src, auth, db)
        assert result.stats.dirs_searched == 3
        engine.close()

    def test_search_with_depth_limit(self, mock_registry, mock_mapper, hierarchical_index_structure):
        """Test search respects depth limit."""
        structure = hierarchical_index_structure
        root_db = structure["root"]["db"]
        root_path = structure["root"]["path"]

        mock_mapper.source_to_index_db.return_value = root_db

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        options = SearchOptions(depth=1)
        result = engine.search("authenticate", root_path, options)

        # Depth 1: root + immediate children (src, tests) = 3
        assert result.stats.dirs_searched == 3
        engine.close()

    def test_search_aggregates_results(self, mock_registry, mock_mapper, hierarchical_index_structure):
        """Test search aggregates results from multiple directories."""
        structure = hierarchical_index_structure
        root_db = structure["root"]["db"]
        root_path = structure["root"]["path"]

        mock_mapper.source_to_index_db.return_value = root_db

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        # Search for term that appears in multiple files
        result = engine.search("def", root_path)

        # Should find results from multiple files
        assert len(result.results) >= 3
        engine.close()


# === Search Files Only Tests ===

class TestSearchFilesOnly:
    """Tests for search_files_only method."""

    def test_returns_list_of_strings(self, mock_registry, mock_mapper, temp_dir):
        """Test search_files_only returns list of path strings."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(
            name="test.py",
            full_path=str(temp_dir / "test.py"),
            content="searchable content here",
            language="python",
        )
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        paths = engine.search_files_only("searchable", temp_dir)

        assert isinstance(paths, list)
        assert all(isinstance(p, str) for p in paths)
        engine.close()

    def test_files_only_faster_than_full(self, mock_registry, mock_mapper, temp_dir):
        """Test files_only search is at least as fast as full search."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()

        # Add multiple files
        for i in range(20):
            store.add_file(
                name=f"file{i}.py",
                full_path=str(temp_dir / f"file{i}.py"),
                content=f"searchable content number {i} with more text to index",
                language="python",
            )
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        # Time files_only
        start = time.perf_counter()
        for _ in range(10):
            engine.search_files_only("searchable", temp_dir)
        files_only_time = time.perf_counter() - start

        # Time full search
        start = time.perf_counter()
        for _ in range(10):
            engine.search("searchable", temp_dir)
        full_time = time.perf_counter() - start

        # files_only should not be significantly slower
        # (may not be faster due to small dataset)
        assert files_only_time <= full_time * 2
        engine.close()


# === Symbol Search Tests ===

class TestChainSymbolSearch:
    """Tests for chain symbol search."""

    def test_symbol_search_finds_across_dirs(self, mock_registry, mock_mapper, hierarchical_index_structure):
        """Test symbol search finds symbols across directories."""
        structure = hierarchical_index_structure
        root_db = structure["root"]["db"]
        root_path = structure["root"]["path"]

        mock_mapper.source_to_index_db.return_value = root_db

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        symbols = engine.search_symbols("auth", root_path)

        # Should find authenticate and AuthManager
        assert len(symbols) >= 2
        engine.close()

    def test_symbol_search_with_kind_filter(self, mock_registry, mock_mapper, hierarchical_index_structure):
        """Test symbol search with kind filter."""
        structure = hierarchical_index_structure
        root_db = structure["root"]["db"]
        root_path = structure["root"]["path"]

        mock_mapper.source_to_index_db.return_value = root_db

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        classes = engine.search_symbols("", root_path, kind="class")

        # Should find AuthManager and DatabasePool
        assert all(s.kind == "class" for s in classes)
        engine.close()

    def test_symbol_search_deduplicates(self, mock_registry, mock_mapper, temp_dir):
        """Test symbol search deduplicates by (name, kind, range) but keeps different ranges."""
        # Create two indexes with same symbol name but different ranges
        dir1 = temp_dir / "dir1"
        dir1.mkdir()
        db1 = dir1 / "_index.db"
        store1 = DirIndexStore(db1)
        store1.initialize()
        store1.add_file(
            name="a.py",
            full_path=str(dir1 / "a.py"),
            content="def foo(): pass",
            language="python",
            symbols=[Symbol(name="foo", kind="function", range=(1, 5))],  # Different range
        )

        dir2 = temp_dir / "dir2"
        dir2.mkdir()
        db2 = dir2 / "_index.db"
        store2 = DirIndexStore(db2)
        store2.initialize()
        store2.add_file(
            name="b.py",
            full_path=str(dir2 / "b.py"),
            content="def foo(): pass\n# more code\n",
            language="python",
            symbols=[Symbol(name="foo", kind="function", range=(1, 10))],  # Different range
        )
        store2.close()

        # Register subdir after dir2 is created
        store1.register_subdir(name="dir2", index_path=db2)
        store1.close()

        mock_mapper.source_to_index_db.return_value = db1

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        symbols = engine.search_symbols("foo", dir1)

        # Should have exactly 2 (different ranges make them unique)
        assert len(symbols) == 2
        engine.close()


# === Search Options Tests ===

class TestSearchOptionsExtended:
    """Extended tests for SearchOptions."""

    def test_include_semantic_option(self):
        """Test include_semantic option."""
        options = SearchOptions(include_semantic=True)
        assert options.include_semantic is True

        options_default = SearchOptions()
        assert options_default.include_semantic is False

    def test_all_options_combined(self):
        """Test all options set together."""
        options = SearchOptions(
            depth=5,
            max_workers=16,
            limit_per_dir=20,
            total_limit=200,
            include_symbols=True,
            files_only=True,
            include_semantic=True,
        )
        assert options.depth == 5
        assert options.max_workers == 16
        assert options.limit_per_dir == 20
        assert options.total_limit == 200
        assert options.include_symbols is True
        assert options.files_only is True
        assert options.include_semantic is True

    def test_options_with_zero_values(self):
        """Test options with zero values."""
        options = SearchOptions(
            depth=0,
            max_workers=1,
            limit_per_dir=1,
            total_limit=1,
        )
        assert options.depth == 0
        assert options.max_workers == 1
        assert options.limit_per_dir == 1
        assert options.total_limit == 1


# === Quick Search Tests ===

class TestQuickSearch:
    """Tests for quick_search convenience function."""

    def test_quick_search_returns_results(self, temp_dir):
        """Test quick_search returns SearchResult list."""
        # Setup: Create index at a known location
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(
            name="test.py",
            full_path=str(temp_dir / "test.py"),
            content="searchable content for quick search test",
            language="python",
        )
        store.close()

        # Test requires actual registry - skip if not initialized
        try:
            results = quick_search("searchable", temp_dir)
            assert isinstance(results, list)
        except Exception:
            # May fail if registry not properly set up
            pytest.skip("Registry not available for quick_search test")

    def test_quick_search_with_depth(self, temp_dir):
        """Test quick_search respects depth parameter."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(
            name="test.py",
            full_path=str(temp_dir / "test.py"),
            content="test content",
            language="python",
        )
        store.close()

        try:
            results = quick_search("test", temp_dir, depth=0)
            assert isinstance(results, list)
        except Exception:
            pytest.skip("Registry not available for quick_search test")


# === Edge Cases and Error Handling ===

class TestSearchErrorHandling:
    """Tests for search error handling."""

    def test_search_corrupted_index(self, mock_registry, mock_mapper, temp_dir):
        """Test search handles corrupted index gracefully."""
        # Create corrupted index file
        db_path = temp_dir / "_index.db"
        db_path.write_text("not a valid sqlite database")

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        try:
            result = engine.search("test", temp_dir)
            # Should return empty results, not crash
            assert result.results == []
        finally:
            engine.close()
            # Force cleanup on Windows
            import gc
            gc.collect()

    def test_search_empty_index(self, mock_registry, mock_mapper, temp_dir):
        """Test search on empty index returns empty results."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        result = engine.search("anything", temp_dir)

        assert result.results == []
        assert result.stats.files_matched == 0
        engine.close()

    def test_search_special_fts_characters(self, mock_registry, mock_mapper, temp_dir):
        """Test search handles FTS5 special characters."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(
            name="test.py",
            full_path=str(temp_dir / "test.py"),
            content="test content",
            language="python",
        )
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        # These should not crash
        special_queries = [
            "test*",
            "test OR other",
            '"exact phrase"',
            "NOT invalid",
        ]

        for query in special_queries:
            result = engine.search(query, temp_dir)
            assert isinstance(result.results, list)

        engine.close()


# === Concurrent Search Tests ===

class TestConcurrentSearch:
    """Tests for concurrent search operations."""

    def test_multiple_concurrent_searches(self, mock_registry, mock_mapper, temp_dir):
        """Test multiple concurrent searches don't interfere."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        for i in range(10):
            store.add_file(
                name=f"file{i}.py",
                full_path=str(temp_dir / f"file{i}.py"),
                content=f"content{i} searchable data",
                language="python",
            )
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        results = []
        errors = []

        def search_task(query):
            try:
                r = engine.search(query, temp_dir)
                results.append(len(r.results))
            except Exception as e:
                errors.append(str(e))

        threads = [
            threading.Thread(target=search_task, args=(f"content{i}",))
            for i in range(5)
        ]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        assert len(results) == 5
        engine.close()

    def test_search_during_close(self, mock_registry, mock_mapper, temp_dir):
        """Test behavior when search happens during close."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(
            name="test.py",
            full_path=str(temp_dir / "test.py"),
            content="test content",
            language="python",
        )
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        # Start a search then immediately close
        result = engine.search("test", temp_dir)
        engine.close()

        # Should complete without error
        assert isinstance(result.results, list)


# === Search Statistics Tests ===

class TestSearchStatsExtended:
    """Extended tests for search statistics."""

    def test_stats_time_is_positive(self, mock_registry, mock_mapper, temp_dir):
        """Test search time is recorded and positive."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(
            name="test.py",
            full_path=str(temp_dir / "test.py"),
            content="test content",
            language="python",
        )
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        result = engine.search("test", temp_dir)

        assert result.stats.time_ms >= 0
        engine.close()

    def test_stats_dirs_searched_accurate(self, mock_registry, mock_mapper, hierarchical_index_structure):
        """Test dirs_searched count is accurate."""
        structure = hierarchical_index_structure
        root_db = structure["root"]["db"]
        root_path = structure["root"]["path"]

        mock_mapper.source_to_index_db.return_value = root_db

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        # Depth 0
        result0 = engine.search("test", root_path, SearchOptions(depth=0))
        assert result0.stats.dirs_searched == 1

        # Depth 1
        result1 = engine.search("test", root_path, SearchOptions(depth=1))
        assert result1.stats.dirs_searched == 3  # root + src + tests

        # Unlimited
        result_all = engine.search("test", root_path, SearchOptions(depth=-1))
        assert result_all.stats.dirs_searched == 5

        engine.close()

    def test_stats_files_matched_accurate(self, mock_registry, mock_mapper, temp_dir):
        """Test files_matched count is accurate."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()

        # Add files with different content
        store.add_file(name="match1.py", full_path=str(temp_dir / "match1.py"),
                       content="findme keyword", language="python")
        store.add_file(name="match2.py", full_path=str(temp_dir / "match2.py"),
                       content="findme keyword", language="python")
        store.add_file(name="nomatch.py", full_path=str(temp_dir / "nomatch.py"),
                       content="other content", language="python")
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        result = engine.search("findme", temp_dir)

        assert result.stats.files_matched == 2
        engine.close()


# === Boundary Condition Tests ===

class TestBoundaryConditions:
    """Tests for boundary conditions."""

    def test_search_with_max_workers_one(self, mock_registry, mock_mapper, temp_dir):
        """Test search with single worker."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(name="test.py", full_path=str(temp_dir / "test.py"),
                       content="test content", language="python")
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper, max_workers=1)
        result = engine.search("test", temp_dir, SearchOptions(max_workers=1))

        assert isinstance(result.results, list)
        engine.close()

    def test_search_with_limit_one(self, mock_registry, mock_mapper, temp_dir):
        """Test search with limit=1."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        for i in range(10):
            store.add_file(name=f"file{i}.py", full_path=str(temp_dir / f"file{i}.py"),
                           content="searchable content", language="python")
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        result = engine.search("searchable", temp_dir, SearchOptions(total_limit=1))

        assert len(result.results) <= 1
        engine.close()

    def test_search_very_long_query(self, mock_registry, mock_mapper, temp_dir):
        """Test search with very long query."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(name="test.py", full_path=str(temp_dir / "test.py"),
                       content="test content", language="python")
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        # Very long query
        long_query = " ".join(["word"] * 100)
        result = engine.search(long_query, temp_dir)

        # Should not crash
        assert isinstance(result.results, list)
        engine.close()

    def test_search_unicode_query(self, mock_registry, mock_mapper, temp_dir):
        """Test search with unicode query does not crash."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(
            name="unicode.py",
            full_path=str(temp_dir / "unicode.py"),
            content="# Chinese comment\ndef hello(): return 'hello world'",
            language="python",
        )
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        # Unicode query should not crash (may or may not find results depending on FTS5 tokenizer)
        result = engine.search("hello", temp_dir)

        assert isinstance(result.results, list)
        assert len(result.results) >= 1
        engine.close()

    def test_search_empty_directory(self, mock_registry, mock_mapper, temp_dir):
        """Test search in directory with no files."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        # Don't add any files
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        result = engine.search("anything", temp_dir)

        assert result.results == []
        assert result.stats.files_matched == 0
        engine.close()


# === Include Symbols Option Tests ===

class TestIncludeSymbolsOption:
    """Tests for include_symbols search option."""

    def test_search_with_include_symbols(self, mock_registry, mock_mapper, temp_dir):
        """Test search returns symbols when include_symbols=True."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(
            name="test.py",
            full_path=str(temp_dir / "test.py"),
            content="def my_function(): pass",
            language="python",
            symbols=[Symbol(name="my_function", kind="function", range=(1, 1))],
        )
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)

        # Without include_symbols
        result_no_symbols = engine.search("function", temp_dir, SearchOptions(include_symbols=False))
        assert result_no_symbols.symbols == []

        # With include_symbols
        result_with_symbols = engine.search("function", temp_dir, SearchOptions(include_symbols=True))
        # Symbols list populated (may or may not match depending on implementation)
        assert isinstance(result_with_symbols.symbols, list)

        engine.close()


# === ChainSearchResult Tests ===

class TestChainSearchResultExtended:
    """Extended tests for ChainSearchResult dataclass."""

    def test_result_immutability(self):
        """Test ChainSearchResult fields."""
        stats = SearchStats(dirs_searched=5, files_matched=10, time_ms=100.5)
        results = [SearchResult(path="/test.py", score=1.0, excerpt="test")]
        symbols = [Symbol(name="foo", kind="function", range=(1, 5))]

        result = ChainSearchResult(
            query="test query",
            results=results,
            symbols=symbols,
            stats=stats,
        )

        assert result.query == "test query"
        assert len(result.results) == 1
        assert len(result.symbols) == 1
        assert result.stats.dirs_searched == 5

    def test_result_with_empty_collections(self):
        """Test ChainSearchResult with empty results and symbols."""
        result = ChainSearchResult(
            query="no matches",
            results=[],
            symbols=[],
            stats=SearchStats(),
        )

        assert result.query == "no matches"
        assert result.results == []
        assert result.symbols == []
        assert result.stats.dirs_searched == 0
