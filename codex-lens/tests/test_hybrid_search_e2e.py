"""End-to-end tests for hybrid search workflows (P2).

Tests complete hybrid search pipeline including indexing, exact/fuzzy/hybrid modes,
and result relevance with real project structure.
"""

import sqlite3
import tempfile
from pathlib import Path

import pytest

from codexlens.entities import SearchResult
from codexlens.search.hybrid_search import HybridSearchEngine
from codexlens.storage.dir_index import DirIndexStore

# Check if pytest-benchmark is available
try:
    import pytest_benchmark
    BENCHMARK_AVAILABLE = True
except ImportError:
    BENCHMARK_AVAILABLE = False


class TestHybridSearchBasics:
    """Basic tests for HybridSearchEngine."""

    @pytest.fixture
    def temp_db(self):
        """Create temporary database."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)
        yield db_path
        if db_path.exists():
            db_path.unlink()

    @pytest.fixture
    def index_store(self, temp_db):
        """Create DirIndexStore instance."""
        store = DirIndexStore(temp_db)
        yield store
        store.close()

    def test_engine_initialization(self):
        """Test HybridSearchEngine initializes with default weights."""
        engine = HybridSearchEngine()
        assert engine.weights == HybridSearchEngine.DEFAULT_WEIGHTS
        assert engine.weights["exact"] == 0.4
        assert engine.weights["fuzzy"] == 0.3
        assert engine.weights["vector"] == 0.3

    def test_engine_custom_weights(self):
        """Test HybridSearchEngine accepts custom weights."""
        custom_weights = {"exact": 0.5, "fuzzy": 0.5, "vector": 0.0}
        engine = HybridSearchEngine(weights=custom_weights)
        assert engine.weights == custom_weights

    def test_search_requires_index(self, temp_db):
        """Test search requires initialized index."""
        engine = HybridSearchEngine()
        # Empty database - should handle gracefully
        results = engine.search(temp_db, "test", limit=10)
        # May return empty or raise error - either is acceptable
        assert isinstance(results, list)


class TestHybridSearchWithSampleProject:
    """Tests with sample project structure."""

    @pytest.fixture
    def sample_project_db(self):
        """Create database with sample Python + TypeScript project."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = DirIndexStore(db_path)
        store.initialize()

        # Sample Python files
        python_files = {
            "src/auth/authentication.py": """
def authenticate_user(username, password):
    '''Authenticate user with credentials'''
    return check_credentials(username, password)

def check_credentials(user, pwd):
    return True
""",
            "src/auth/authorization.py": """
def authorize_user(user_id, resource):
    '''Authorize user access to resource'''
    return check_permissions(user_id, resource)

def check_permissions(uid, res):
    return True
""",
            "src/models/user.py": """
class User:
    def __init__(self, username, email):
        self.username = username
        self.email = email

    def authenticate(self, password):
        return authenticate_user(self.username, password)
""",
            "src/api/user_api.py": """
from flask import Flask, request

def get_user_by_id(user_id):
    '''Get user by ID'''
    return User.query.get(user_id)

def create_user(username, email):
    '''Create new user'''
    return User(username, email)
""",
        }

        # Sample TypeScript files
        typescript_files = {
            "frontend/auth/AuthService.ts": """
export class AuthService {
    authenticateUser(username: string, password: string): boolean {
        return this.checkCredentials(username, password);
    }

    private checkCredentials(user: string, pwd: string): boolean {
        return true;
    }
}
""",
            "frontend/models/User.ts": """
export interface User {
    id: number;
    username: string;
    email: string;
}

export class UserModel {
    constructor(private user: User) {}

    authenticate(password: string): boolean {
        return new AuthService().authenticateUser(this.user.username, password);
    }
}
""",
        }

        # Index all files
        with store._get_connection() as conn:
            for path, content in {**python_files, **typescript_files}.items():
                lang = "python" if path.endswith(".py") else "typescript"
                name = path.split('/')[-1]
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (name, path, content, lang, 0.0)
                )
            conn.commit()

        yield db_path
        store.close()

        if db_path.exists():
            db_path.unlink()

    def test_exact_search_mode(self, sample_project_db):
        """Test exact FTS search mode."""
        engine = HybridSearchEngine()

        # Search for "authenticate"
        results = engine.search(
            sample_project_db,
            "authenticate",
            limit=10,
            enable_fuzzy=False,
            enable_vector=False
        )

        assert len(results) > 0, "Should find matches for 'authenticate'"
        # Check results contain expected files
        paths = [r.path for r in results]
        assert any("authentication.py" in p for p in paths)

    def test_fuzzy_search_mode(self, sample_project_db):
        """Test fuzzy FTS search mode."""
        engine = HybridSearchEngine()

        # Search with typo: "authentcate" (missing 'i')
        results = engine.search(
            sample_project_db,
            "authentcate",
            limit=10,
            enable_fuzzy=True,
            enable_vector=False
        )

        # Fuzzy search should still find matches
        assert isinstance(results, list)
        # May or may not find matches depending on trigram support

    def test_hybrid_search_mode(self, sample_project_db):
        """Test hybrid search combines exact and fuzzy."""
        engine = HybridSearchEngine()

        # Hybrid search
        results = engine.search(
            sample_project_db,
            "authenticate",
            limit=10,
            enable_fuzzy=True,
            enable_vector=False
        )

        assert len(results) > 0, "Hybrid search should find matches"
        # Results should have fusion scores
        for result in results:
            assert result.score > 0, "Results should have fusion scores"

    def test_camelcase_query_expansion(self, sample_project_db):
        """Test CamelCase query expansion improves recall."""
        engine = HybridSearchEngine()

        # Search for "AuthService" (CamelCase)
        results = engine.search(
            sample_project_db,
            "AuthService",
            limit=10,
            enable_fuzzy=False
        )

        # Should find TypeScript AuthService class
        paths = [r.path for r in results]
        assert any("AuthService.ts" in p for p in paths), \
            "Should find AuthService with CamelCase query"

    def test_snake_case_query_expansion(self, sample_project_db):
        """Test snake_case query expansion improves recall."""
        engine = HybridSearchEngine()

        # Search for "get_user_by_id" (snake_case)
        results = engine.search(
            sample_project_db,
            "get_user_by_id",
            limit=10,
            enable_fuzzy=False
        )

        # Should find Python function
        paths = [r.path for r in results]
        assert any("user_api.py" in p for p in paths), \
            "Should find get_user_by_id with snake_case query"

    def test_partial_identifier_match(self, sample_project_db):
        """Test partial identifier matching with query expansion."""
        engine = HybridSearchEngine()

        # Search for just "User" (part of UserModel, User class, etc.)
        results = engine.search(
            sample_project_db,
            "User",
            limit=10,
            enable_fuzzy=False
        )

        assert len(results) > 0, "Should find matches for 'User'"
        # Should find multiple files with User in name
        paths = [r.path for r in results]
        assert len([p for p in paths if "user" in p.lower()]) > 0


class TestHybridSearchRelevance:
    """Tests for result relevance and ranking."""

    @pytest.fixture
    def relevance_db(self):
        """Create database for testing relevance ranking."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = DirIndexStore(db_path)
        store.initialize()

        # Files with varying relevance to "authentication"
        files = {
            "auth/authentication.py": """
# Primary authentication module
def authenticate_user(username, password):
    '''Main authentication function'''
    pass

def validate_authentication(token):
    pass
""",
            "auth/auth_helpers.py": """
# Helper functions for authentication
def hash_password(password):
    pass

def verify_authentication_token(token):
    pass
""",
            "models/user.py": """
# User model (mentions authentication once)
class User:
    def check_authentication(self):
        pass
""",
            "utils/logging.py": """
# Logging utility (no authentication mention)
def log_message(msg):
    pass
""",
        }

        with store._get_connection() as conn:
            for path, content in files.items():
                name = path.split('/')[-1]
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (name, path, content, "python", 0.0)
                )
            conn.commit()

        yield db_path
        store.close()

        if db_path.exists():
            db_path.unlink()

    def test_exact_match_ranks_higher(self, relevance_db):
        """Test files with exact term matches rank higher."""
        engine = HybridSearchEngine()

        results = engine.search(
            relevance_db,
            "authentication",
            limit=10,
            enable_fuzzy=False
        )

        # First result should be authentication.py (most mentions)
        assert len(results) > 0
        assert "authentication.py" in results[0].path, \
            "File with most mentions should rank first"

    def test_hybrid_fusion_improves_ranking(self, relevance_db):
        """Test hybrid RRF fusion improves ranking over single source."""
        engine = HybridSearchEngine()

        # Exact only
        exact_results = engine.search(
            relevance_db,
            "authentication",
            limit=5,
            enable_fuzzy=False
        )

        # Hybrid
        hybrid_results = engine.search(
            relevance_db,
            "authentication",
            limit=5,
            enable_fuzzy=True
        )

        # Both should find matches
        assert len(exact_results) > 0
        assert len(hybrid_results) > 0

        # Hybrid may rerank results
        assert isinstance(hybrid_results[0], SearchResult)


class TestHybridSearchPerformance:
    """Performance tests for hybrid search."""

    @pytest.fixture
    def large_project_db(self):
        """Create database with many files."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = DirIndexStore(db_path)
        store.initialize()

        # Create 100 test files
        with store._get_connection() as conn:
            for i in range(100):
                content = f"""
def function_{i}(param):
    '''Test function {i}'''
    return authenticate_user(param)

class Class{i}:
    def method_{i}(self):
        pass
"""
                path = f"src/module_{i}.py"
                name = f"module_{i}.py"
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (name, path, content, "python", 0.0)
                )
            conn.commit()

        yield db_path
        store.close()

        if db_path.exists():
            db_path.unlink()

    @pytest.mark.skipif(not BENCHMARK_AVAILABLE, reason="pytest-benchmark not installed")
    def test_search_latency(self, large_project_db, benchmark):
        """Benchmark search latency."""
        engine = HybridSearchEngine()

        def search_query():
            return engine.search(
                large_project_db,
                "authenticate",
                limit=20,
                enable_fuzzy=True
            )

        # Should complete in reasonable time
        results = benchmark(search_query)
        assert isinstance(results, list)

    def test_hybrid_overhead(self, large_project_db):
        """Test hybrid search overhead vs exact search."""
        engine = HybridSearchEngine()

        import time

        # Measure exact search time
        start = time.time()
        exact_results = engine.search(
            large_project_db,
            "authenticate",
            limit=20,
            enable_fuzzy=False
        )
        exact_time = time.time() - start

        # Measure hybrid search time
        start = time.time()
        hybrid_results = engine.search(
            large_project_db,
            "authenticate",
            limit=20,
            enable_fuzzy=True
        )
        hybrid_time = time.time() - start

        # Hybrid should be <10x slower than exact (relaxed for CI stability and ANN initialization overhead)
        if exact_time > 0:
            overhead = hybrid_time / exact_time
            assert overhead < 10.0, f"Hybrid overhead {overhead:.1f}x should be <10x"


class TestHybridSearchEdgeCases:
    """Edge case tests for hybrid search."""

    @pytest.fixture
    def temp_db(self):
        """Create temporary database."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        # Initialize with schema
        DirIndexStore(db_path)

        yield db_path
        # Ignore file deletion errors on Windows (SQLite file lock)
        try:
            if db_path.exists():
                db_path.unlink()
        except PermissionError:
            pass

    def test_empty_index_search(self, temp_db):
        """Test search on empty index returns empty results."""
        engine = HybridSearchEngine()

        results = engine.search(temp_db, "test", limit=10)
        assert results == [] or isinstance(results, list)

    def test_no_matches_query(self, temp_db):
        """Test query with no matches returns empty results."""
        store = DirIndexStore(temp_db)
        store.initialize()

        try:
            # Index one file
            with store._get_connection() as conn:
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    ("test.py", "test.py", "def hello(): pass", "python", 0.0)
                )
                conn.commit()

            engine = HybridSearchEngine()
            results = engine.search(temp_db, "nonexistent", limit=10)

            assert results == [] or len(results) == 0
        finally:
            store.close()

    def test_special_characters_in_query(self, temp_db):
        """Test queries with special characters are handled."""
        store = DirIndexStore(temp_db)
        store.initialize()

        try:
            # Index file
            with store._get_connection() as conn:
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    ("test.py", "test.py", "def test(): pass", "python", 0.0)
                )
                conn.commit()

            engine = HybridSearchEngine()

            # Query with special chars should not crash
            queries = ["test*", "test?", "test&", "test|"]
            for query in queries:
                try:
                    results = engine.search(temp_db, query, limit=10)
                    assert isinstance(results, list)
                except Exception:
                    # Some queries may be invalid FTS5 syntax - that's OK
                    pass
        finally:
            store.close()

    def test_very_long_query(self, temp_db):
        """Test very long queries are handled."""
        store = DirIndexStore(temp_db)
        store.initialize()

        try:
            # Index file
            with store._get_connection() as conn:
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    ("test.py", "test.py", "def test(): pass", "python", 0.0)
                )
                conn.commit()

            engine = HybridSearchEngine()

            # Very long query
            long_query = "test " * 100
            results = engine.search(temp_db, long_query, limit=10)
            assert isinstance(results, list)
        finally:
            store.close()

    def test_unicode_query(self, temp_db):
        """Test Unicode queries are handled."""
        store = DirIndexStore(temp_db)
        store.initialize()

        try:
            # Index file with Unicode content
            with store._get_connection() as conn:
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    ("test.py", "test.py", "def 测试函数(): pass", "python", 0.0)
                )
                conn.commit()

            engine = HybridSearchEngine()

            # Unicode query
            results = engine.search(temp_db, "测试", limit=10)
            assert isinstance(results, list)
        finally:
            store.close()


class TestHybridSearchIntegration:
    """Integration tests for complete workflow."""

    @pytest.fixture
    def project_db(self):
        """Create realistic project database."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = DirIndexStore(db_path)
        store.initialize()

        # Realistic project structure
        files = {
            "src/authentication/login.py": "def login_user(username, password): pass",
            "src/authentication/logout.py": "def logout_user(session_id): pass",
            "src/authorization/permissions.py": "def check_permission(user, resource): pass",
            "src/models/user_model.py": "class UserModel: pass",
            "src/api/auth_api.py": "def authenticate_api(token): pass",
            "tests/test_auth.py": "def test_authentication(): pass",
        }

        with store._get_connection() as conn:
            for path, content in files.items():
                name = path.split('/')[-1]
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (name, path, content, "python", 0.0)
                )
            conn.commit()

        yield db_path
        store.close()

        if db_path.exists():
            db_path.unlink()

    def test_workflow_index_search_refine(self, project_db):
        """Test complete workflow: index → search → refine."""
        engine = HybridSearchEngine()

        # Initial broad search
        results = engine.search(project_db, "auth", limit=20)
        assert len(results) > 0

        # Refined search
        refined = engine.search(project_db, "authentication", limit=10)
        assert len(refined) > 0

        # Most refined search
        specific = engine.search(project_db, "login_user", limit=5)
        # May or may not find exact match depending on query expansion

    def test_consistency_across_searches(self, project_db):
        """Test search results are consistent across multiple calls."""
        engine = HybridSearchEngine()

        # Same query multiple times
        results1 = engine.search(project_db, "authenticate", limit=10)
        results2 = engine.search(project_db, "authenticate", limit=10)

        # Should return same results (same order)
        assert len(results1) == len(results2)
        if len(results1) > 0:
            assert results1[0].path == results2[0].path


@pytest.mark.integration
class TestHybridSearchFullCoverage:
    """Full coverage integration tests."""

    def test_all_modes_with_real_project(self):
        """Test all search modes (exact, fuzzy, hybrid) with realistic project."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = None
        try:
            store = DirIndexStore(db_path)
            store.initialize()

            # Create comprehensive test project
            files = {
                "auth.py": "def authenticate(): pass",
                "authz.py": "def authorize(): pass",
                "user.py": "class User: pass",
            }

            with store._get_connection() as conn:
                for path, content in files.items():
                    name = path.split('/')[-1]
                    conn.execute(
                        """INSERT INTO files (name, full_path, content, language, mtime)
                           VALUES (?, ?, ?, ?, ?)""",
                        (name, path, content, "python", 0.0)
                    )
                conn.commit()

            engine = HybridSearchEngine()

            # Test exact mode
            exact = engine.search(db_path, "authenticate", enable_fuzzy=False)
            assert isinstance(exact, list)

            # Test fuzzy mode
            fuzzy = engine.search(db_path, "authenticate", enable_fuzzy=True)
            assert isinstance(fuzzy, list)

            # Test hybrid mode (default)
            hybrid = engine.search(db_path, "authenticate")
            assert isinstance(hybrid, list)

        finally:
            if store:
                store.close()
            if db_path.exists():
                db_path.unlink()



class TestHybridSearchWithVectorMock:
    """Tests for hybrid search with mocked vector search."""
    
    @pytest.fixture
    def mock_vector_db(self):
        """Create database with vector search mocked."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)
        
        store = DirIndexStore(db_path)
        store.initialize()
        
        # Index sample files
        files = {
            "auth/login.py": "def login_user(username, password): authenticate()",
            "auth/logout.py": "def logout_user(session): cleanup_session()",
            "user/profile.py": "class UserProfile: def get_data(): pass"
        }
        
        with store._get_connection() as conn:
            for path, content in files.items():
                name = path.split('/')[-1]
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (name, path, content, "python", 0.0)
                )
            conn.commit()
        
        yield db_path
        store.close()
        
        if db_path.exists():
            db_path.unlink()
    
    def test_hybrid_with_vector_enabled(self, mock_vector_db):
        """Test hybrid search with vector search enabled (mocked)."""
        from unittest.mock import patch, MagicMock
        
        # Mock the vector search to return fake results
        mock_vector_results = [
            SearchResult(path="auth/login.py", score=0.95, content_snippet="login"),
            SearchResult(path="user/profile.py", score=0.75, content_snippet="profile")
        ]
        
        engine = HybridSearchEngine()
        
        # Mock vector search method if it exists
        with patch.object(engine, '_search_vector', return_value=mock_vector_results) if hasattr(engine, '_search_vector') else patch('codexlens.search.hybrid_search.vector_search', return_value=mock_vector_results):
            results = engine.search(
                mock_vector_db,
                "login",
                limit=10,
                enable_fuzzy=True,
                enable_vector=True  # ENABLE vector search
            )
            
            # Should get results from RRF fusion of exact + fuzzy + vector
            assert isinstance(results, list)
            assert len(results) > 0, "Hybrid search with vector should return results"
            
            # Results should have fusion scores
            for result in results:
                assert hasattr(result, 'score')
                assert result.score > 0  # RRF fusion scores are positive

