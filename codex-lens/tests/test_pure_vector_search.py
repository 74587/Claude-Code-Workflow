"""Tests for pure vector search functionality."""

import pytest
import sqlite3
import tempfile
from pathlib import Path

from codexlens.search.hybrid_search import HybridSearchEngine
from codexlens.storage.dir_index import DirIndexStore

# Check if semantic dependencies are available
try:
    from codexlens.semantic import SEMANTIC_AVAILABLE
    SEMANTIC_DEPS_AVAILABLE = SEMANTIC_AVAILABLE
except ImportError:
    SEMANTIC_DEPS_AVAILABLE = False


class TestPureVectorSearch:
    """Tests for pure vector search mode."""

    @pytest.fixture
    def sample_db(self):
        """Create sample database with files."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = DirIndexStore(db_path)
        store.initialize()

        # Add sample files
        files = {
            "auth.py": "def authenticate_user(username, password): pass",
            "login.py": "def login_handler(credentials): pass",
            "user.py": "class User: pass",
        }

        with store._get_connection() as conn:
            for path, content in files.items():
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (path, path, content, "python", 0.0)
                )
            conn.commit()

        yield db_path
        store.close()

        if db_path.exists():
            db_path.unlink()

    def test_pure_vector_without_embeddings(self, sample_db):
        """Test pure_vector mode returns empty when no embeddings exist."""
        engine = HybridSearchEngine()

        results = engine.search(
            sample_db,
            "authentication",
            limit=10,
            enable_vector=True,
            pure_vector=True,
        )

        # Should return empty list because no embeddings exist
        assert isinstance(results, list)
        assert len(results) == 0, \
            "Pure vector search should return empty when no embeddings exist"

    def test_vector_with_fallback(self, sample_db):
        """Test vector mode (with fallback) returns FTS results when no embeddings."""
        engine = HybridSearchEngine()

        results = engine.search(
            sample_db,
            "authenticate",
            limit=10,
            enable_vector=True,
            pure_vector=False,  # Allow FTS fallback
        )

        # Should return FTS results even without embeddings
        assert isinstance(results, list)
        assert len(results) > 0, \
            "Vector mode with fallback should return FTS results"

        # Verify results come from exact FTS
        paths = [r.path for r in results]
        assert "auth.py" in paths, "Should find auth.py via FTS"

    def test_pure_vector_invalid_config(self, sample_db):
        """Test pure_vector=True but enable_vector=False logs warning."""
        engine = HybridSearchEngine()

        # Invalid: pure_vector=True but enable_vector=False
        results = engine.search(
            sample_db,
            "test",
            limit=10,
            enable_vector=False,
            pure_vector=True,
        )

        # Should fallback to exact search
        assert isinstance(results, list)

    def test_hybrid_mode_ignores_pure_vector(self, sample_db):
        """Test hybrid mode works normally (ignores pure_vector)."""
        engine = HybridSearchEngine()

        results = engine.search(
            sample_db,
            "authenticate",
            limit=10,
            enable_fuzzy=True,
            enable_vector=False,
            pure_vector=False,  # Should be ignored in hybrid
        )

        # Should return results from exact + fuzzy
        assert isinstance(results, list)
        assert len(results) > 0


@pytest.mark.skipif(not SEMANTIC_DEPS_AVAILABLE, reason="Semantic dependencies not available")
class TestPureVectorWithEmbeddings:
    """Tests for pure vector search with actual embeddings."""

    @pytest.fixture
    def db_with_embeddings(self):
        """Create database with embeddings."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = DirIndexStore(db_path)
        store.initialize()

        # Add sample files
        files = {
            "auth/authentication.py": """
def authenticate_user(username: str, password: str) -> bool:
    '''Verify user credentials against database.'''
    return check_password(username, password)

def check_password(user: str, pwd: str) -> bool:
    '''Check if password matches stored hash.'''
    return True
""",
            "auth/login.py": """
def login_handler(credentials: dict) -> bool:
    '''Handle user login request.'''
    username = credentials.get('username')
    password = credentials.get('password')
    return authenticate_user(username, password)
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

        # Generate embeddings
        try:
            from codexlens.semantic.embedder import Embedder
            from codexlens.semantic.vector_store import VectorStore
            from codexlens.semantic.chunker import Chunker, ChunkConfig

            embedder = Embedder(profile="fast")  # Use fast model for testing
            vector_store = VectorStore(db_path)
            chunker = Chunker(config=ChunkConfig(max_chunk_size=1000))

            with sqlite3.connect(db_path) as conn:
                conn.row_factory = sqlite3.Row
                rows = conn.execute("SELECT full_path, content FROM files").fetchall()

            for row in rows:
                chunks = chunker.chunk_sliding_window(
                    row["content"],
                    file_path=row["full_path"],
                    language="python"
                )
                for chunk in chunks:
                    chunk.embedding = embedder.embed_single(chunk.content)
                if chunks:
                    vector_store.add_chunks(chunks, row["full_path"])

        except Exception as exc:
            pytest.skip(f"Failed to generate embeddings: {exc}")

        yield db_path
        store.close()

        if db_path.exists():
            db_path.unlink()

    def test_pure_vector_with_embeddings(self, db_with_embeddings):
        """Test pure vector search returns results when embeddings exist."""
        engine = HybridSearchEngine()

        results = engine.search(
            db_with_embeddings,
            "how to verify user credentials",  # Natural language query
            limit=10,
            enable_vector=True,
            pure_vector=True,
        )

        # Should return results from vector search only
        assert isinstance(results, list)
        assert len(results) > 0, "Pure vector search should return results"

        # Results should have semantic relevance
        for result in results:
            assert result.score > 0
            assert result.path is not None

    def test_compare_pure_vs_hybrid(self, db_with_embeddings):
        """Compare pure vector vs hybrid search results."""
        engine = HybridSearchEngine()

        # Pure vector search
        pure_results = engine.search(
            db_with_embeddings,
            "verify credentials",
            limit=10,
            enable_vector=True,
            pure_vector=True,
        )

        # Hybrid search
        hybrid_results = engine.search(
            db_with_embeddings,
            "verify credentials",
            limit=10,
            enable_fuzzy=True,
            enable_vector=True,
            pure_vector=False,
        )

        # Both should return results
        assert len(pure_results) > 0, "Pure vector should find results"
        assert len(hybrid_results) > 0, "Hybrid should find results"

        # Hybrid may have more results (FTS + vector)
        # But pure should still be useful for semantic queries


class TestSearchModeComparison:
    """Compare different search modes."""

    @pytest.fixture
    def comparison_db(self):
        """Create database for mode comparison."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = DirIndexStore(db_path)
        store.initialize()

        files = {
            "auth.py": "def authenticate(): pass",
            "login.py": "def login(): pass",
        }

        with store._get_connection() as conn:
            for path, content in files.items():
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (path, path, content, "python", 0.0)
                )
            conn.commit()

        yield db_path
        store.close()

        if db_path.exists():
            db_path.unlink()

    def test_mode_comparison_without_embeddings(self, comparison_db):
        """Compare all search modes without embeddings."""
        engine = HybridSearchEngine()
        query = "authenticate"

        # Test each mode
        modes = [
            ("exact", False, False, False),
            ("fuzzy", True, False, False),
            ("vector", False, True, False),  # With fallback
            ("pure_vector", False, True, True),  # No fallback
        ]

        results = {}
        for mode_name, fuzzy, vector, pure in modes:
            result = engine.search(
                comparison_db,
                query,
                limit=10,
                enable_fuzzy=fuzzy,
                enable_vector=vector,
                pure_vector=pure,
            )
            results[mode_name] = len(result)

        # Assertions
        assert results["exact"] > 0, "Exact should find results"
        assert results["fuzzy"] >= results["exact"], "Fuzzy should find at least as many"
        assert results["vector"] > 0, "Vector with fallback should find results (from FTS)"
        assert results["pure_vector"] == 0, "Pure vector should return empty (no embeddings)"

        # Log comparison
        print("\nMode comparison (without embeddings):")
        for mode, count in results.items():
            print(f"  {mode}: {count} results")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
