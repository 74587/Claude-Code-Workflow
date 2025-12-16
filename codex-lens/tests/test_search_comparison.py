"""Comprehensive comparison test for vector search vs hybrid search.

This test diagnoses why vector search returns empty results and compares
performance between different search modes.
"""

import json
import sqlite3
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Any

import pytest

from codexlens.entities import SearchResult
from codexlens.search.hybrid_search import HybridSearchEngine
from codexlens.storage.dir_index import DirIndexStore

# Check semantic search availability
try:
    from codexlens.semantic.embedder import Embedder
    from codexlens.semantic.vector_store import VectorStore
    from codexlens.semantic import SEMANTIC_AVAILABLE
    SEMANTIC_DEPS_AVAILABLE = SEMANTIC_AVAILABLE
except ImportError:
    SEMANTIC_DEPS_AVAILABLE = False


class TestSearchComparison:
    """Comprehensive comparison of search modes."""

    @pytest.fixture
    def sample_project_db(self):
        """Create sample project database with semantic chunks."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = DirIndexStore(db_path)
        store.initialize()

        # Sample files with varied content for testing
        sample_files = {
            "src/auth/authentication.py": """
def authenticate_user(username: str, password: str) -> bool:
    '''Authenticate user with credentials using bcrypt hashing.

    This function validates user credentials against the database
    and returns True if authentication succeeds.
    '''
    hashed = hash_password(password)
    return verify_credentials(username, hashed)

def hash_password(password: str) -> str:
    '''Hash password using bcrypt algorithm.'''
    import bcrypt
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_credentials(user: str, pwd_hash: str) -> bool:
    '''Verify user credentials against database.'''
    # Database verification logic
    return True
""",
            "src/auth/authorization.py": """
def authorize_action(user_id: int, resource: str, action: str) -> bool:
    '''Authorize user action on resource using role-based access control.

    Checks if user has permission to perform action on resource
    based on their assigned roles.
    '''
    roles = get_user_roles(user_id)
    permissions = get_role_permissions(roles)
    return has_permission(permissions, resource, action)

def get_user_roles(user_id: int) -> List[str]:
    '''Fetch user roles from database.'''
    return ["user", "admin"]

def has_permission(permissions, resource, action) -> bool:
    '''Check if permissions allow action on resource.'''
    return True
""",
            "src/models/user.py": """
from dataclasses import dataclass
from typing import Optional

@dataclass
class User:
    '''User model representing application users.

    Stores user profile information and authentication state.
    '''
    id: int
    username: str
    email: str
    password_hash: str
    is_active: bool = True

    def authenticate(self, password: str) -> bool:
        '''Authenticate this user with password.'''
        from auth.authentication import verify_credentials
        return verify_credentials(self.username, password)

    def has_role(self, role: str) -> bool:
        '''Check if user has specific role.'''
        return True
""",
            "src/api/user_api.py": """
from flask import Flask, request, jsonify
from models.user import User

app = Flask(__name__)

@app.route('/api/user/<int:user_id>', methods=['GET'])
def get_user(user_id: int):
    '''Get user by ID from database.

    Returns user profile information as JSON.
    '''
    user = User.query.get(user_id)
    return jsonify(user.to_dict())

@app.route('/api/user/login', methods=['POST'])
def login():
    '''User login endpoint using username and password.

    Authenticates user and returns session token.
    '''
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if authenticate_user(username, password):
        token = generate_session_token(username)
        return jsonify({'token': token})
    return jsonify({'error': 'Invalid credentials'}), 401
""",
            "tests/test_auth.py": """
import pytest
from auth.authentication import authenticate_user, hash_password

class TestAuthentication:
    '''Test authentication functionality.'''

    def test_authenticate_valid_user(self):
        '''Test authentication with valid credentials.'''
        assert authenticate_user("testuser", "password123") == True

    def test_authenticate_invalid_user(self):
        '''Test authentication with invalid credentials.'''
        assert authenticate_user("invalid", "wrong") == False

    def test_password_hashing(self):
        '''Test password hashing produces unique hashes.'''
        hash1 = hash_password("password")
        hash2 = hash_password("password")
        assert hash1 != hash2  # Salts should differ
""",
        }

        # Insert files into database
        with store._get_connection() as conn:
            for file_path, content in sample_files.items():
                name = file_path.split('/')[-1]
                lang = "python"
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (name, file_path, content, lang, time.time())
                )
            conn.commit()

        yield db_path
        store.close()

        if db_path.exists():
            db_path.unlink()

    def _check_semantic_chunks_table(self, db_path: Path) -> Dict[str, Any]:
        """Check if semantic_chunks table exists and has data."""
        with sqlite3.connect(db_path) as conn:
            cursor = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='semantic_chunks'"
            )
            table_exists = cursor.fetchone() is not None

            chunk_count = 0
            if table_exists:
                cursor = conn.execute("SELECT COUNT(*) FROM semantic_chunks")
                chunk_count = cursor.fetchone()[0]

            return {
                "table_exists": table_exists,
                "chunk_count": chunk_count,
            }

    def _create_vector_index(self, db_path: Path) -> Dict[str, Any]:
        """Create vector embeddings for indexed files."""
        if not SEMANTIC_DEPS_AVAILABLE:
            return {
                "success": False,
                "error": "Semantic dependencies not available",
                "chunks_created": 0,
            }

        try:
            from codexlens.semantic.chunker import Chunker, ChunkConfig

            # Initialize embedder and vector store
            embedder = Embedder(profile="code")
            vector_store = VectorStore(db_path)
            chunker = Chunker(config=ChunkConfig(max_chunk_size=2000))

            # Read files from database
            with sqlite3.connect(db_path) as conn:
                conn.row_factory = sqlite3.Row
                cursor = conn.execute("SELECT full_path, content FROM files")
                files = cursor.fetchall()

            chunks_created = 0
            for file_row in files:
                file_path = file_row["full_path"]
                content = file_row["content"]

                # Create semantic chunks using sliding window
                chunks = chunker.chunk_sliding_window(
                    content,
                    file_path=file_path,
                    language="python"
                )

                # Generate embeddings
                for chunk in chunks:
                    embedding = embedder.embed_single(chunk.content)
                    chunk.embedding = embedding

                # Store chunks
                if chunks:  # Only store if we have chunks
                    vector_store.add_chunks(chunks, file_path)
                    chunks_created += len(chunks)

            return {
                "success": True,
                "chunks_created": chunks_created,
                "files_processed": len(files),
            }
        except Exception as exc:
            return {
                "success": False,
                "error": str(exc),
                "chunks_created": 0,
            }

    def _run_search_mode(
        self,
        db_path: Path,
        query: str,
        mode: str,
        limit: int = 10,
    ) -> Dict[str, Any]:
        """Run search in specified mode and collect metrics."""
        engine = HybridSearchEngine()

        # Map mode to parameters
        if mode == "exact":
            enable_fuzzy, enable_vector = False, False
        elif mode == "fuzzy":
            enable_fuzzy, enable_vector = True, False
        elif mode == "vector":
            enable_fuzzy, enable_vector = False, True
        elif mode == "hybrid":
            enable_fuzzy, enable_vector = True, True
        else:
            raise ValueError(f"Invalid mode: {mode}")

        # Measure search time
        start_time = time.time()
        try:
            results = engine.search(
                db_path,
                query,
                limit=limit,
                enable_fuzzy=enable_fuzzy,
                enable_vector=enable_vector,
            )
            elapsed_ms = (time.time() - start_time) * 1000

            return {
                "success": True,
                "mode": mode,
                "query": query,
                "result_count": len(results),
                "elapsed_ms": elapsed_ms,
                "results": [
                    {
                        "path": r.path,
                        "score": r.score,
                        "excerpt": r.excerpt[:100] if r.excerpt else "",
                        "source": getattr(r, "search_source", None),
                    }
                    for r in results[:5]  # Top 5 results
                ],
            }
        except Exception as exc:
            elapsed_ms = (time.time() - start_time) * 1000
            return {
                "success": False,
                "mode": mode,
                "query": query,
                "error": str(exc),
                "elapsed_ms": elapsed_ms,
                "result_count": 0,
            }

    @pytest.mark.skipif(not SEMANTIC_DEPS_AVAILABLE, reason="Semantic dependencies not available")
    def test_full_search_comparison_with_vectors(self, sample_project_db):
        """Complete search comparison test with vector embeddings."""
        db_path = sample_project_db

        # Step 1: Check initial state
        print("\n=== Step 1: Checking initial database state ===")
        initial_state = self._check_semantic_chunks_table(db_path)
        print(f"Table exists: {initial_state['table_exists']}")
        print(f"Chunk count: {initial_state['chunk_count']}")

        # Step 2: Create vector index
        print("\n=== Step 2: Creating vector embeddings ===")
        vector_result = self._create_vector_index(db_path)
        print(f"Success: {vector_result['success']}")
        if vector_result['success']:
            print(f"Chunks created: {vector_result['chunks_created']}")
            print(f"Files processed: {vector_result['files_processed']}")
        else:
            print(f"Error: {vector_result.get('error', 'Unknown')}")

        # Step 3: Verify vector index was created
        print("\n=== Step 3: Verifying vector index ===")
        final_state = self._check_semantic_chunks_table(db_path)
        print(f"Table exists: {final_state['table_exists']}")
        print(f"Chunk count: {final_state['chunk_count']}")

        # Step 4: Run comparison tests
        print("\n=== Step 4: Running search mode comparison ===")
        test_queries = [
            "authenticate user credentials",  # Semantic query
            "authentication",                  # Keyword query
            "password hashing bcrypt",         # Multi-term query
        ]

        comparison_results = []
        for query in test_queries:
            print(f"\n--- Query: '{query}' ---")
            for mode in ["exact", "fuzzy", "vector", "hybrid"]:
                result = self._run_search_mode(db_path, query, mode, limit=10)
                comparison_results.append(result)

                print(f"\n{mode.upper()} mode:")
                print(f"  Success: {result['success']}")
                print(f"  Results: {result['result_count']}")
                print(f"  Time: {result['elapsed_ms']:.2f}ms")
                if result['success'] and result['result_count'] > 0:
                    print(f"  Top result: {result['results'][0]['path']}")
                    print(f"    Score: {result['results'][0]['score']:.3f}")
                    print(f"    Source: {result['results'][0]['source']}")
                elif not result['success']:
                    print(f"  Error: {result.get('error', 'Unknown')}")

        # Step 5: Generate comparison report
        print("\n=== Step 5: Comparison Summary ===")

        # Group by mode
        mode_stats = {}
        for result in comparison_results:
            mode = result['mode']
            if mode not in mode_stats:
                mode_stats[mode] = {
                    "total_searches": 0,
                    "successful_searches": 0,
                    "total_results": 0,
                    "total_time_ms": 0,
                    "empty_results": 0,
                }

            stats = mode_stats[mode]
            stats["total_searches"] += 1
            if result['success']:
                stats["successful_searches"] += 1
                stats["total_results"] += result['result_count']
                if result['result_count'] == 0:
                    stats["empty_results"] += 1
            stats["total_time_ms"] += result['elapsed_ms']

        # Print summary table
        print("\nMode      | Queries | Success | Avg Results | Avg Time | Empty Results")
        print("-" * 75)
        for mode in ["exact", "fuzzy", "vector", "hybrid"]:
            if mode in mode_stats:
                stats = mode_stats[mode]
                avg_results = stats["total_results"] / stats["total_searches"]
                avg_time = stats["total_time_ms"] / stats["total_searches"]
                print(
                    f"{mode:9} | {stats['total_searches']:7} | "
                    f"{stats['successful_searches']:7} | {avg_results:11.1f} | "
                    f"{avg_time:8.1f}ms | {stats['empty_results']:13}"
                )

        # Assertions
        assert initial_state is not None
        if vector_result['success']:
            assert final_state['chunk_count'] > 0, "Vector index should contain chunks"

            # Find vector search results
            vector_results = [r for r in comparison_results if r['mode'] == 'vector']
            if vector_results:
                # At least one vector search should return results if index was created
                has_vector_results = any(r.get('result_count', 0) > 0 for r in vector_results)
                if not has_vector_results:
                    print("\n⚠️ WARNING: Vector index created but vector search returned no results!")
                    print("This indicates a potential issue with vector search implementation.")

    def test_search_comparison_without_vectors(self, sample_project_db):
        """Search comparison test without vector embeddings (baseline)."""
        db_path = sample_project_db

        print("\n=== Testing search without vector embeddings ===")

        # Check state
        state = self._check_semantic_chunks_table(db_path)
        print(f"Semantic chunks table exists: {state['table_exists']}")
        print(f"Chunk count: {state['chunk_count']}")

        # Run exact and fuzzy searches only
        test_queries = ["authentication", "user password", "bcrypt hash"]

        for query in test_queries:
            print(f"\n--- Query: '{query}' ---")
            for mode in ["exact", "fuzzy"]:
                result = self._run_search_mode(db_path, query, mode, limit=10)

                print(f"{mode.upper()}: {result['result_count']} results in {result['elapsed_ms']:.2f}ms")
                if result['success'] and result['result_count'] > 0:
                    print(f"  Top: {result['results'][0]['path']} (score: {result['results'][0]['score']:.3f})")

        # Test vector search without embeddings (should return empty)
        print(f"\n--- Testing vector search without embeddings ---")
        vector_result = self._run_search_mode(db_path, "authentication", "vector", limit=10)
        print(f"Vector search result count: {vector_result['result_count']}")
        print(f"This is expected to be 0 without embeddings: {vector_result['result_count'] == 0}")

        assert vector_result['result_count'] == 0, \
            "Vector search should return empty results when no embeddings exist"


class TestDiagnostics:
    """Diagnostic tests to identify specific issues."""

    @pytest.fixture
    def empty_db(self):
        """Create empty database."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        store = DirIndexStore(db_path)
        store.initialize()
        store.close()

        yield db_path
        if db_path.exists():
            db_path.unlink()

    def test_diagnose_empty_database(self, empty_db):
        """Diagnose behavior with empty database."""
        engine = HybridSearchEngine()

        print("\n=== Diagnosing empty database ===")

        # Test all modes
        for mode_config in [
            ("exact", False, False),
            ("fuzzy", True, False),
            ("vector", False, True),
            ("hybrid", True, True),
        ]:
            mode, enable_fuzzy, enable_vector = mode_config

            try:
                results = engine.search(
                    empty_db,
                    "test",
                    limit=10,
                    enable_fuzzy=enable_fuzzy,
                    enable_vector=enable_vector,
                )
                print(f"{mode}: {len(results)} results (OK)")
                assert isinstance(results, list)
                assert len(results) == 0
            except Exception as exc:
                print(f"{mode}: ERROR - {exc}")
                # Should not raise errors, should return empty list
                pytest.fail(f"Search mode '{mode}' raised exception on empty database: {exc}")

    @pytest.mark.skipif(not SEMANTIC_DEPS_AVAILABLE, reason="Semantic dependencies not available")
    def test_diagnose_embedder_initialization(self):
        """Test embedder initialization and embedding generation."""
        print("\n=== Diagnosing embedder ===")

        try:
            embedder = Embedder(profile="code")
            print(f"✓ Embedder initialized (model: {embedder.model_name})")
            print(f"  Embedding dimension: {embedder.embedding_dim}")

            # Test embedding generation
            test_text = "def authenticate_user(username, password):"
            embedding = embedder.embed_single(test_text)

            print(f"✓ Generated embedding (length: {len(embedding)})")
            print(f"  Sample values: {embedding[:5]}")

            assert len(embedding) == embedder.embedding_dim
            assert all(isinstance(v, float) for v in embedding)

        except Exception as exc:
            print(f"✗ Embedder error: {exc}")
            raise


if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v", "-s"])
