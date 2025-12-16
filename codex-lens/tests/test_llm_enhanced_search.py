"""Test suite for comparing pure vector search vs LLM-enhanced vector search.

This test demonstrates the difference between:
1. Pure vector search: Raw code → fastembed → vector search
2. LLM-enhanced search: Code → LLM summary → fastembed → vector search

LLM-enhanced search should provide better semantic matches for natural language queries.
"""

import pytest
import sqlite3
import tempfile
from pathlib import Path
from typing import Dict, List

from codexlens.search.hybrid_search import HybridSearchEngine
from codexlens.storage.dir_index import DirIndexStore

# Check semantic dependencies
try:
    from codexlens.semantic import SEMANTIC_AVAILABLE
    from codexlens.semantic.embedder import Embedder
    from codexlens.semantic.vector_store import VectorStore
    from codexlens.semantic.chunker import Chunker, ChunkConfig
    from codexlens.semantic.llm_enhancer import (
        LLMEnhancer,
        LLMConfig,
        FileData,
        EnhancedSemanticIndexer,
        SemanticChunk,
    )
    from codexlens.entities import SearchResult
except ImportError:
    SEMANTIC_AVAILABLE = False


# Test code samples representing different functionality
TEST_CODE_SAMPLES = {
    "auth/password_hasher.py": '''"""Password hashing utilities using bcrypt."""
import bcrypt

def hash_password(password: str, salt_rounds: int = 12) -> str:
    """Hash a password using bcrypt with specified salt rounds.

    Args:
        password: Plain text password to hash
        salt_rounds: Number of salt rounds (default 12)

    Returns:
        Hashed password string
    """
    salt = bcrypt.gensalt(rounds=salt_rounds)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash.

    Args:
        password: Plain text password to verify
        hashed: Previously hashed password

    Returns:
        True if password matches hash
    """
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
''',

    "auth/jwt_handler.py": '''"""JWT token generation and validation."""
import jwt
from datetime import datetime, timedelta
from typing import Dict, Optional

SECRET_KEY = "your-secret-key-here"

def create_token(user_id: int, expires_in: int = 3600) -> str:
    """Generate a JWT access token for user authentication.

    Args:
        user_id: User ID to encode in token
        expires_in: Token expiration in seconds (default 1 hour)

    Returns:
        JWT token string
    """
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(seconds=expires_in),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def decode_token(token: str) -> Optional[Dict]:
    """Validate and decode JWT token to extract user information.

    Args:
        token: JWT token string to decode

    Returns:
        Decoded payload dict or None if invalid
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None
''',

    "api/user_endpoints.py": '''"""REST API endpoints for user management."""
from flask import Flask, request, jsonify
from typing import Dict

app = Flask(__name__)

@app.route('/api/users', methods=['POST'])
def create_user():
    """Create a new user account with email and password.

    Request JSON:
        email: User email address
        password: User password
        name: User full name

    Returns:
        JSON with user_id and success status
    """
    data = request.get_json()
    # Validate input
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400

    # Create user (simplified)
    user_id = 12345  # Would normally insert into database
    return jsonify({'user_id': user_id, 'success': True}), 201

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id: int):
    """Retrieve user profile information by user ID.

    Args:
        user_id: Unique user identifier

    Returns:
        JSON with user profile data
    """
    # Simplified user retrieval
    user = {
        'id': user_id,
        'email': 'user@example.com',
        'name': 'John Doe',
        'created_at': '2024-01-01'
    }
    return jsonify(user), 200
''',

    "utils/validation.py": '''"""Input validation and sanitization utilities."""
import re
from typing import Optional

def validate_email(email: str) -> bool:
    """Check if email address format is valid using regex pattern.

    Args:
        email: Email address string to validate

    Returns:
        True if email format is valid
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def sanitize_input(text: str, max_length: int = 255) -> str:
    """Clean user input by removing special characters and limiting length.

    Args:
        text: Input text to sanitize
        max_length: Maximum allowed length

    Returns:
        Sanitized text string
    """
    # Remove special characters
    text = re.sub(r'[<>\"\'&]', '', text)
    # Trim whitespace
    text = text.strip()
    # Limit length
    return text[:max_length]

def validate_password_strength(password: str) -> tuple[bool, Optional[str]]:
    """Validate password meets security requirements.

    Requirements:
        - At least 8 characters
        - Contains uppercase and lowercase
        - Contains numbers
        - Contains special characters

    Args:
        password: Password string to validate

    Returns:
        Tuple of (is_valid, error_message)
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain uppercase letter"
    if not re.search(r'[a-z]', password):
        return False, "Password must contain lowercase letter"
    if not re.search(r'[0-9]', password):
        return False, "Password must contain number"
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        return False, "Password must contain special character"
    return True, None
''',

    "database/connection.py": '''"""Database connection pooling and management."""
import psycopg2
from psycopg2 import pool
from typing import Optional
from contextlib import contextmanager

class DatabasePool:
    """PostgreSQL connection pool manager for handling multiple concurrent connections."""

    def __init__(self, min_conn: int = 1, max_conn: int = 10):
        """Initialize database connection pool.

        Args:
            min_conn: Minimum number of connections to maintain
            max_conn: Maximum number of connections allowed
        """
        self.pool = psycopg2.pool.SimpleConnectionPool(
            min_conn,
            max_conn,
            user='dbuser',
            password='dbpass',
            host='localhost',
            port='5432',
            database='myapp'
        )

    @contextmanager
    def get_connection(self):
        """Get a connection from pool as context manager.

        Yields:
            Database connection object
        """
        conn = self.pool.getconn()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            self.pool.putconn(conn)

    def close_all(self):
        """Close all connections in pool."""
        self.pool.closeall()
'''
}


# Natural language queries to test semantic understanding
TEST_QUERIES = [
    {
        "query": "How do I securely hash passwords?",
        "expected_file": "auth/password_hasher.py",
        "description": "Should find password hashing implementation",
    },
    {
        "query": "Generate JWT token for user authentication",
        "expected_file": "auth/jwt_handler.py",
        "description": "Should find JWT token creation logic",
    },
    {
        "query": "Create new user account via REST API",
        "expected_file": "api/user_endpoints.py",
        "description": "Should find user registration endpoint",
    },
    {
        "query": "Validate email address format",
        "expected_file": "utils/validation.py",
        "description": "Should find email validation function",
    },
    {
        "query": "Connect to PostgreSQL database",
        "expected_file": "database/connection.py",
        "description": "Should find database connection management",
    },
    {
        "query": "Check password complexity requirements",
        "expected_file": "utils/validation.py",
        "description": "Should find password strength validation",
    },
]


@pytest.mark.skipif(not SEMANTIC_AVAILABLE, reason="Semantic dependencies not available")
class TestPureVectorSearch:
    """Test pure vector search (code → fastembed → search)."""

    @pytest.fixture
    def pure_vector_db(self):
        """Create database with pure vector embeddings (no LLM)."""
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        # Initialize database
        store = DirIndexStore(db_path)
        store.initialize()

        # Add test files
        with store._get_connection() as conn:
            for path, content in TEST_CODE_SAMPLES.items():
                name = path.split('/')[-1]
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (name, path, content, "python", 0.0)
                )
            conn.commit()

        # Generate embeddings using pure vector approach (raw code)
        embedder = Embedder(profile="code")
        vector_store = VectorStore(db_path)
        chunker = Chunker(config=ChunkConfig(max_chunk_size=2000))

        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute("SELECT full_path, content FROM files").fetchall()

        for row in rows:
            # Pure vector: directly chunk and embed raw code
            chunks = chunker.chunk_sliding_window(
                row["content"],
                file_path=row["full_path"],
                language="python"
            )
            for chunk in chunks:
                chunk.embedding = embedder.embed_single(chunk.content)
                chunk.metadata["strategy"] = "pure_vector"
            if chunks:
                vector_store.add_chunks(chunks, row["full_path"])

        yield db_path
        store.close()
        if db_path.exists():
            db_path.unlink()

    def test_pure_vector_queries(self, pure_vector_db):
        """Test natural language queries with pure vector search."""
        engine = HybridSearchEngine()
        results = {}

        for test_case in TEST_QUERIES:
            query = test_case["query"]
            expected_file = test_case["expected_file"]

            search_results = engine.search(
                pure_vector_db,
                query,
                limit=5,
                enable_vector=True,
                pure_vector=True,
            )

            # Check if expected file is in top 3 results
            top_files = [r.path for r in search_results[:3]]
            found = expected_file in top_files
            rank = top_files.index(expected_file) + 1 if found else None

            results[query] = {
                "found": found,
                "rank": rank,
                "top_result": search_results[0].path if search_results else None,
                "top_score": search_results[0].score if search_results else 0.0,
            }

        return results


@pytest.mark.skipif(not SEMANTIC_AVAILABLE, reason="Semantic dependencies not available")
class TestLLMEnhancedSearch:
    """Test LLM-enhanced vector search (code → LLM → fastembed → search)."""

    @pytest.fixture
    def llm_enhanced_db(self):
        """Create database with LLM-enhanced embeddings."""
        # Skip if CCW not available
        llm_config = LLMConfig(enabled=True, tool="gemini")
        enhancer = LLMEnhancer(llm_config)
        if not enhancer.check_available():
            pytest.skip("CCW CLI not available for LLM enhancement")

        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            db_path = Path(f.name)

        # Initialize database
        store = DirIndexStore(db_path)
        store.initialize()

        # Add test files
        with store._get_connection() as conn:
            for path, content in TEST_CODE_SAMPLES.items():
                name = path.split('/')[-1]
                conn.execute(
                    """INSERT INTO files (name, full_path, content, language, mtime)
                       VALUES (?, ?, ?, ?, ?)""",
                    (name, path, content, "python", 0.0)
                )
            conn.commit()

        # Generate embeddings using LLM-enhanced approach
        embedder = Embedder(profile="code")
        vector_store = VectorStore(db_path)

        # Create enhanced indexer
        indexer = EnhancedSemanticIndexer(enhancer, embedder, vector_store)

        # Prepare file data
        file_data_list = [
            FileData(path=path, content=content, language="python")
            for path, content in TEST_CODE_SAMPLES.items()
        ]

        # Index with LLM enhancement
        indexed = indexer.index_files(file_data_list)
        print(f"\nLLM-enhanced indexing: {indexed}/{len(file_data_list)} files")

        yield db_path
        store.close()
        if db_path.exists():
            db_path.unlink()

    def test_llm_enhanced_queries(self, llm_enhanced_db):
        """Test natural language queries with LLM-enhanced search."""
        engine = HybridSearchEngine()
        results = {}

        for test_case in TEST_QUERIES:
            query = test_case["query"]
            expected_file = test_case["expected_file"]

            search_results = engine.search(
                llm_enhanced_db,
                query,
                limit=5,
                enable_vector=True,
                pure_vector=True,
            )

            # Check if expected file is in top 3 results
            top_files = [r.path for r in search_results[:3]]
            found = expected_file in top_files
            rank = top_files.index(expected_file) + 1 if found else None

            results[query] = {
                "found": found,
                "rank": rank,
                "top_result": search_results[0].path if search_results else None,
                "top_score": search_results[0].score if search_results else 0.0,
            }

        return results


@pytest.mark.skipif(not SEMANTIC_AVAILABLE, reason="Semantic dependencies not available")
class TestSearchComparison:
    """Compare pure vector vs LLM-enhanced search side-by-side."""

    def test_comparison(self):
        """Run comprehensive comparison of both approaches."""
        # This test runs both approaches and compares results
        print("\n" + "="*70)
        print("SEMANTIC SEARCH COMPARISON TEST")
        print("="*70)

        try:
            # Test pure vector search
            print("\n1. Testing Pure Vector Search (Code → fastembed)")
            print("-" * 70)
            pure_test = TestPureVectorSearch()
            pure_db = next(pure_test.pure_vector_db())
            pure_results = pure_test.test_pure_vector_queries(pure_db)

            # Test LLM-enhanced search
            print("\n2. Testing LLM-Enhanced Search (Code → LLM → fastembed)")
            print("-" * 70)
            llm_test = TestLLMEnhancedSearch()
            llm_db = next(llm_test.llm_enhanced_db())
            llm_results = llm_test.test_llm_enhanced_queries(llm_db)

            # Compare results
            print("\n3. COMPARISON RESULTS")
            print("="*70)
            print(f"{'Query':<50} {'Pure Vec':<12} {'LLM Enhanced':<12}")
            print("-" * 70)

            pure_score = 0
            llm_score = 0

            for test_case in TEST_QUERIES:
                query = test_case["query"][:47] + "..." if len(test_case["query"]) > 50 else test_case["query"]

                pure_res = pure_results.get(test_case["query"], {})
                llm_res = llm_results.get(test_case["query"], {})

                pure_status = f"[OK] Rank {pure_res.get('rank', '?')}" if pure_res.get('found') else "[X] Not found"
                llm_status = f"[OK] Rank {llm_res.get('rank', '?')}" if llm_res.get('found') else "[X] Not found"

                print(f"{query:<50} {pure_status:<12} {llm_status:<12}")

                if pure_res.get('found'):
                    pure_score += (4 - pure_res['rank'])  # 3 points for rank 1, 2 for rank 2, etc
                if llm_res.get('found'):
                    llm_score += (4 - llm_res['rank'])

            print("-" * 70)
            print(f"{'TOTAL SCORE':<50} {pure_score:<12} {llm_score:<12}")
            print("="*70)

            # Interpretation
            print("\nINTERPRETATION:")
            if llm_score > pure_score:
                improvement = ((llm_score - pure_score) / max(pure_score, 1)) * 100
                print(f"[OK] LLM enhancement improves results by {improvement:.1f}%")
                print("  LLM summaries match natural language queries better than raw code")
            elif pure_score > llm_score:
                print("[X] Pure vector search performed better (unexpected)")
                print("  This may indicate LLM summaries are too generic")
            else:
                print("= Both approaches performed equally")

        except Exception as e:
            pytest.fail(f"Comparison test failed: {e}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
