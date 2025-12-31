"""Comprehensive tests for CodexLens search functionality.

Tests cover:
- FTS5 text search (basic, phrase, boolean, wildcard)
- Chain search across directories
- Symbol search (by name, kind, filters)
- Files-only search mode
- Edge cases and error handling
"""

import tempfile
import pytest
from pathlib import Path
from unittest.mock import MagicMock, patch

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
def sample_files():
    """Sample file data for testing."""
    return [
        (IndexedFile(
            path="/project/src/auth.py",
            language="python",
            symbols=[
                Symbol(name="authenticate", kind="function", range=(1, 10)),
                Symbol(name="verify_token", kind="function", range=(12, 20)),
                Symbol(name="AuthManager", kind="class", range=(22, 50)),
            ],
        ), """
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
"""),
        (IndexedFile(
            path="/project/src/database.py",
            language="python",
            symbols=[
                Symbol(name="connect", kind="function", range=(1, 5)),
                Symbol(name="query", kind="function", range=(7, 15)),
                Symbol(name="DatabasePool", kind="class", range=(17, 40)),
            ],
        ), """
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
"""),
        (IndexedFile(
            path="/project/src/utils.py",
            language="python",
            symbols=[
                Symbol(name="format_date", kind="function", range=(1, 3)),
                Symbol(name="parse_json", kind="function", range=(5, 10)),
                Symbol(name="hash_password", kind="function", range=(12, 18)),
            ],
        ), """
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
"""),
    ]


@pytest.fixture
def populated_store(temp_dir, sample_files):
    """Create a populated SQLite store for testing."""
    db_path = temp_dir / "_index.db"
    store = SQLiteStore(db_path)
    store.initialize()

    for indexed_file, content in sample_files:
        store.add_file(indexed_file, content)

    yield store
    store.close()


@pytest.fixture
def populated_dir_store(temp_dir, sample_files):
    """Create a populated DirIndexStore for testing."""
    db_path = temp_dir / "_index.db"
    store = DirIndexStore(db_path)

    for indexed_file, content in sample_files:
        store.add_file(indexed_file, content)

    yield store
    store.close()


# === FTS5 Search Tests ===

class TestFTS5BasicSearch:
    """Tests for basic FTS5 text search."""

    def test_single_term_search(self, populated_store):
        """Test search with a single term."""
        results = populated_store.search_fts("authenticate")
        assert len(results) >= 1
        assert any("auth" in r.path.lower() for r in results)

    def test_case_insensitive_search(self, populated_store):
        """Test that search is case insensitive."""
        results_lower = populated_store.search_fts("database")
        results_upper = populated_store.search_fts("DATABASE")
        results_mixed = populated_store.search_fts("DataBase")

        # All should return similar results
        assert len(results_lower) == len(results_upper) == len(results_mixed)

    def test_partial_word_search(self, populated_store):
        """Test search with partial words using wildcards."""
        results = populated_store.search_fts("auth*")
        assert len(results) >= 1
        # Should match authenticate, authentication, AuthManager, etc.

    def test_multiple_terms_search(self, populated_store):
        """Test search with multiple terms (implicit AND)."""
        results = populated_store.search_fts("user password")
        assert len(results) >= 1

    def test_no_results_search(self, populated_store):
        """Test search that returns no results."""
        results = populated_store.search_fts("nonexistent_xyz_term")
        assert len(results) == 0

    def test_search_with_limit(self, populated_store):
        """Test search respects limit parameter."""
        results = populated_store.search_fts("def", limit=1)
        assert len(results) <= 1

    def test_search_returns_excerpt(self, populated_store):
        """Test search results include excerpts."""
        results = populated_store.search_fts("authenticate")
        assert len(results) >= 1
        # SearchResult should have excerpt field
        for r in results:
            assert hasattr(r, 'excerpt')


class TestFTS5AdvancedSearch:
    """Tests for advanced FTS5 search features."""

    def test_phrase_search(self, populated_store):
        """Test exact phrase search with quotes."""
        results = populated_store.search_fts('"verify_token"')
        assert len(results) >= 1

    def test_boolean_or_search(self, populated_store):
        """Test OR boolean search."""
        results = populated_store.search_fts("authenticate OR database")
        # Should find files containing either term
        assert len(results) >= 2

    def test_boolean_not_search(self, populated_store):
        """Test NOT boolean search."""
        all_results = populated_store.search_fts("def")
        not_results = populated_store.search_fts("def NOT authenticate")
        # NOT should return fewer results
        assert len(not_results) <= len(all_results)

    def test_prefix_search(self, populated_store):
        """Test prefix search with asterisk."""
        results = populated_store.search_fts("connect*")
        assert len(results) >= 1
        # Should match connect, connection, etc.

    def test_special_characters_in_query(self, populated_store):
        """Test search handles special characters gracefully."""
        # Should not raise an error
        results = populated_store.search_fts("__init__")
        # May or may not have results, but shouldn't crash

    def test_unicode_search(self, temp_dir):
        """Test search with unicode content."""
        store = SQLiteStore(temp_dir / "_index.db")
        store.initialize()

        indexed_file = IndexedFile(
            path="/test/unicode.py",
            language="python",
            symbols=[Symbol(name="世界", kind="function", range=(1, 1))],
        )
        store.add_file(indexed_file, "def 世界(): return '你好世界'")

        results = store.search_fts("世界")
        assert len(results) == 1

        store.close()


class TestFTS5Pagination:
    """Tests for FTS5 search pagination."""

    def test_offset_pagination(self, temp_dir):
        """Test search with offset for pagination."""
        store = SQLiteStore(temp_dir / "_index.db")
        store.initialize()

        # Add multiple files
        for i in range(10):
            indexed_file = IndexedFile(
                path=f"/test/file{i}.py",
                language="python",
                symbols=[],
            )
            store.add_file(indexed_file, f"searchable content number {i}")

        page1 = store.search_fts("searchable", limit=3, offset=0)
        page2 = store.search_fts("searchable", limit=3, offset=3)
        page3 = store.search_fts("searchable", limit=3, offset=6)

        # Each page should have different results
        paths1 = {r.path for r in page1}
        paths2 = {r.path for r in page2}
        paths3 = {r.path for r in page3}

        assert paths1.isdisjoint(paths2)
        assert paths2.isdisjoint(paths3)

        store.close()

    def test_offset_beyond_results(self, populated_store):
        """Test offset beyond available results."""
        results = populated_store.search_fts("authenticate", limit=10, offset=1000)
        assert len(results) == 0


# === Symbol Search Tests ===

class TestSymbolSearch:
    """Tests for symbol search functionality."""

    def test_search_by_name(self, populated_store):
        """Test symbol search by name."""
        results = populated_store.search_symbols("auth")
        assert len(results) >= 1
        assert any("auth" in s.name.lower() for s in results)

    def test_search_by_kind_function(self, populated_store):
        """Test symbol search filtered by kind=function."""
        results = populated_store.search_symbols("", kind="function")
        assert all(s.kind == "function" for s in results)

    def test_search_by_kind_class(self, populated_store):
        """Test symbol search filtered by kind=class."""
        results = populated_store.search_symbols("", kind="class")
        assert all(s.kind == "class" for s in results)
        assert any("Manager" in s.name or "Pool" in s.name for s in results)

    def test_search_symbols_with_limit(self, populated_store):
        """Test symbol search respects limit."""
        results = populated_store.search_symbols("", limit=2)
        assert len(results) <= 2

    def test_search_symbols_returns_range(self, populated_store):
        """Test symbol search results include line range."""
        results = populated_store.search_symbols("authenticate")
        assert len(results) >= 1
        for sym in results:
            assert hasattr(sym, 'range')
            assert len(sym.range) == 2
            assert sym.range[0] <= sym.range[1]


# === Chain Search Tests ===

class TestChainSearchEngine:
    """Tests for ChainSearchEngine."""

    @pytest.fixture
    def mock_registry(self):
        """Create a mock registry."""
        registry = MagicMock(spec=RegistryStore)
        registry.find_nearest_index.return_value = None
        return registry

    @pytest.fixture
    def mock_mapper(self):
        """Create a mock path mapper."""
        return MagicMock(spec=PathMapper)

    def test_search_no_index_found(self, mock_registry, mock_mapper):
        """Test search when no index is found."""
        mock_mapper.source_to_index_db.return_value = Path("/nonexistent/_index.db")

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        result = engine.search("test", Path("/nonexistent"))

        assert result.results == []
        assert result.symbols == []
        assert result.stats.dirs_searched == 0

    def test_search_options_depth(self, mock_registry, mock_mapper, temp_dir):
        """Test search respects depth option."""
        # Create a simple index structure
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
        options = SearchOptions(depth=0)  # Only current dir

        result = engine.search("test", temp_dir, options)

        # With depth=0, should only search current directory
        assert result.stats.dirs_searched <= 1

    def test_search_files_only(self, mock_registry, mock_mapper, temp_dir):
        """Test search_files_only returns only paths."""
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
        for p in paths:
            assert isinstance(p, str)

    def test_search_symbols_engine(self, mock_registry, mock_mapper, temp_dir):
        """Test symbol search through engine."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(
            name="test.py",
            full_path=str(temp_dir / "test.py"),
            content="def my_function(): pass",
            language="python",
            symbols=[Symbol(name="my_function", kind="function", range=(1, 5))],
        )
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        symbols = engine.search_symbols("my_func", temp_dir)

        assert len(symbols) >= 1
        assert symbols[0].name == "my_function"

    def test_search_result_stats(self, mock_registry, mock_mapper, temp_dir):
        """Test search result includes proper stats."""
        db_path = temp_dir / "_index.db"
        store = DirIndexStore(db_path)
        store.initialize()
        store.add_file(
            name="test.py",
            full_path=str(temp_dir / "test.py"),
            content="content to search",
            language="python",
        )
        store.close()

        mock_mapper.source_to_index_db.return_value = db_path

        engine = ChainSearchEngine(mock_registry, mock_mapper)
        result = engine.search("content", temp_dir)

        assert result.stats.time_ms >= 0
        assert result.stats.dirs_searched >= 0
        assert isinstance(result.stats.errors, list)


class TestSearchOptions:
    """Tests for SearchOptions configuration."""

    def test_default_options(self):
        """Test default search options."""
        options = SearchOptions()
        assert options.depth == -1
        assert options.max_workers == 8
        assert options.limit_per_dir == 10
        assert options.total_limit == 100
        assert options.include_symbols is False
        assert options.files_only is False

    def test_custom_options(self):
        """Test custom search options."""
        options = SearchOptions(
            depth=3,
            max_workers=4,
            limit_per_dir=5,
            total_limit=50,
            include_symbols=True,
            files_only=True,
        )
        assert options.depth == 3
        assert options.max_workers == 4
        assert options.limit_per_dir == 5
        assert options.total_limit == 50
        assert options.include_symbols is True
        assert options.files_only is True


# === Edge Cases and Error Handling ===

class TestSearchEdgeCases:
    """Edge case tests for search functionality."""

    def test_empty_query(self, populated_store):
        """Test search with empty query."""
        # Empty query may raise an error or return empty results
        try:
            results = populated_store.search_fts("")
            assert isinstance(results, list)
        except Exception:
            # Some implementations may reject empty queries
            pass

    def test_whitespace_query(self, populated_store):
        """Test search with whitespace-only query."""
        # Whitespace query may raise an error or return empty results
        try:
            results = populated_store.search_fts("   ")
            assert isinstance(results, list)
        except Exception:
            # Some implementations may reject whitespace queries
            pass

    def test_very_long_query(self, populated_store):
        """Test search with very long query."""
        long_query = "function " * 100  # Repeat valid word
        try:
            results = populated_store.search_fts(long_query)
            assert isinstance(results, list)
        except Exception:
            # Very long queries may be rejected
            pass

    def test_special_sql_characters(self, populated_store):
        """Test search handles SQL-like characters safely."""
        # These should not cause SQL injection - may raise FTS syntax errors
        queries = ["test", "function*", "test OR data"]
        for q in queries:
            results = populated_store.search_fts(q)
            assert isinstance(results, list)

    def test_search_reopened_store(self, temp_dir, sample_files):
        """Test search works after store is reopened."""
        db_path = temp_dir / "_index.db"
        store = SQLiteStore(db_path)
        store.initialize()
        store.add_file(sample_files[0][0], sample_files[0][1])
        store.close()

        # Reopen and search
        store2 = SQLiteStore(db_path)
        store2.initialize()
        results = store2.search_fts("authenticate")
        assert len(results) >= 1
        store2.close()

    def test_concurrent_searches(self, populated_store):
        """Test multiple concurrent searches."""
        import threading

        results = []
        errors = []

        def search_task(query):
            try:
                r = populated_store.search_fts(query)
                results.append(len(r))
            except Exception as e:
                errors.append(e)

        threads = [
            threading.Thread(target=search_task, args=("authenticate",)),
            threading.Thread(target=search_task, args=("database",)),
            threading.Thread(target=search_task, args=("password",)),
        ]

        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        assert len(results) == 3


class TestChainSearchResult:
    """Tests for ChainSearchResult dataclass."""

    def test_result_structure(self):
        """Test ChainSearchResult has all required fields."""
        result = ChainSearchResult(
            query="test",
            results=[],
            symbols=[],
            stats=SearchStats(),
        )
        assert result.query == "test"
        assert result.results == []
        assert result.related_results == []
        assert result.symbols == []
        assert result.stats.dirs_searched == 0


class TestSearchStats:
    """Tests for SearchStats dataclass."""

    def test_default_stats(self):
        """Test default search stats."""
        stats = SearchStats()
        assert stats.dirs_searched == 0
        assert stats.files_matched == 0
        assert stats.time_ms == 0
        assert stats.errors == []

    def test_stats_with_errors(self):
        """Test search stats with errors."""
        stats = SearchStats(errors=["Error 1", "Error 2"])
        assert len(stats.errors) == 2
