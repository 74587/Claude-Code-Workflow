#!/usr/bin/env python3
"""Standalone script to compare pure vector vs LLM-enhanced semantic search.

Usage:
    python compare_search_methods.py [--tool gemini|qwen] [--skip-llm]

This script:
1. Creates a test dataset with sample code
2. Tests pure vector search (code → fastembed → search)
3. Tests LLM-enhanced search (code → LLM summary → fastembed → search)
4. Compares results across natural language queries
"""

import argparse
import sqlite3
import sys
import tempfile
import time
from pathlib import Path
from typing import Dict, List, Tuple

# Check dependencies
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
    )
    from codexlens.storage.dir_index import DirIndexStore
    from codexlens.search.hybrid_search import HybridSearchEngine
except ImportError as e:
    print(f"Error: Missing dependencies - {e}")
    print("Install with: pip install codexlens[semantic]")
    sys.exit(1)

if not SEMANTIC_AVAILABLE:
    print("Error: Semantic search dependencies not available")
    print("Install with: pip install codexlens[semantic]")
    sys.exit(1)


# Test dataset with realistic code samples
TEST_DATASET = {
    "auth/password_hasher.py": '''"""Password hashing utilities using bcrypt."""
import bcrypt

def hash_password(password: str, salt_rounds: int = 12) -> str:
    """Hash a password using bcrypt with specified salt rounds."""
    salt = bcrypt.gensalt(rounds=salt_rounds)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
''',

    "auth/jwt_handler.py": '''"""JWT token generation and validation."""
import jwt
from datetime import datetime, timedelta

SECRET_KEY = "your-secret-key"

def create_token(user_id: int, expires_in: int = 3600) -> str:
    """Generate a JWT access token for user authentication."""
    payload = {
        'user_id': user_id,
        'exp': datetime.utcnow() + timedelta(seconds=expires_in),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def decode_token(token: str) -> dict:
    """Validate and decode JWT token."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
''',

    "api/user_endpoints.py": '''"""REST API endpoints for user management."""
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/users', methods=['POST'])
def create_user():
    """Create a new user account with email and password."""
    data = request.get_json()
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Email and password required'}), 400
    user_id = 12345  # Database insert
    return jsonify({'user_id': user_id, 'success': True}), 201

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id: int):
    """Retrieve user profile information by user ID."""
    user = {
        'id': user_id,
        'email': 'user@example.com',
        'name': 'John Doe'
    }
    return jsonify(user), 200
''',

    "utils/validation.py": '''"""Input validation utilities."""
import re

def validate_email(email: str) -> bool:
    """Check if email address format is valid using regex."""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def sanitize_input(text: str, max_length: int = 255) -> str:
    """Clean user input by removing special characters."""
    text = re.sub(r'[<>\"\'&]', '', text)
    return text.strip()[:max_length]

def validate_password_strength(password: str) -> tuple:
    """Validate password meets security requirements."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    if not re.search(r'[A-Z]', password):
        return False, "Must contain uppercase letter"
    return True, None
''',

    "database/connection.py": '''"""Database connection pooling."""
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager

class DatabasePool:
    """PostgreSQL connection pool manager."""

    def __init__(self, min_conn: int = 1, max_conn: int = 10):
        """Initialize database connection pool."""
        self.pool = psycopg2.pool.SimpleConnectionPool(
            min_conn, max_conn,
            user='dbuser', host='localhost', database='myapp'
        )

    @contextmanager
    def get_connection(self):
        """Get a connection from pool as context manager."""
        conn = self.pool.getconn()
        try:
            yield conn
            conn.commit()
        finally:
            self.pool.putconn(conn)
''',
}


# Natural language test queries
TEST_QUERIES = [
    ("How do I securely hash passwords?", "auth/password_hasher.py"),
    ("Generate JWT token for authentication", "auth/jwt_handler.py"),
    ("Create new user account via API", "api/user_endpoints.py"),
    ("Validate email address format", "utils/validation.py"),
    ("Connect to PostgreSQL database", "database/connection.py"),
]


def create_test_database(db_path: Path) -> None:
    """Create and populate test database."""
    store = DirIndexStore(db_path)
    store.initialize()

    with store._get_connection() as conn:
        for path, content in TEST_DATASET.items():
            name = path.split('/')[-1]
            conn.execute(
                """INSERT INTO files (name, full_path, content, language, mtime)
                   VALUES (?, ?, ?, ?, ?)""",
                (name, path, content, "python", 0.0)
            )
        conn.commit()

    store.close()


def test_pure_vector_search(db_path: Path) -> Dict:
    """Test pure vector search (raw code embeddings)."""
    print("\n" + "="*70)
    print("PURE VECTOR SEARCH (Code → fastembed)")
    print("="*70)

    start_time = time.time()

    # Generate pure vector embeddings
    embedder = Embedder(profile="code")
    vector_store = VectorStore(db_path)
    chunker = Chunker(config=ChunkConfig(max_chunk_size=2000))

    with sqlite3.connect(db_path) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT full_path, content FROM files").fetchall()

    chunk_count = 0
    for row in rows:
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
            chunk_count += len(chunks)

    setup_time = time.time() - start_time
    print(f"Setup: {len(rows)} files, {chunk_count} chunks in {setup_time:.1f}s")

    # Test queries
    engine = HybridSearchEngine()
    results = {}

    print(f"\n{'Query':<45} {'Top Result':<30} {'Score':<8}")
    print("-" * 70)

    for query, expected_file in TEST_QUERIES:
        search_results = engine.search(
            db_path,
            query,
            limit=3,
            enable_vector=True,
            pure_vector=True,
        )

        top_file = search_results[0].path if search_results else "No results"
        top_score = search_results[0].score if search_results else 0.0
        found = expected_file in [r.path for r in search_results]
        rank = None
        if found:
            for i, r in enumerate(search_results):
                if r.path == expected_file:
                    rank = i + 1
                    break

        status = "[OK]" if found and rank == 1 else ("[~]" if found else "[X]")
        display_query = query[:42] + "..." if len(query) > 45 else query
        display_file = top_file.split('/')[-1] if '/' in top_file else top_file

        print(f"{status} {display_query:<43} {display_file:<30} {top_score:.3f}")

        results[query] = {
            "found": found,
            "rank": rank,
            "top_file": top_file,
            "score": top_score,
        }

    return results


def test_llm_enhanced_search(db_path: Path, llm_tool: str = "gemini") -> Dict:
    """Test LLM-enhanced search (LLM summaries → fastembed)."""
    print("\n" + "="*70)
    print(f"LLM-ENHANCED SEARCH (Code → {llm_tool.upper()} → fastembed)")
    print("="*70)

    # Check CCW availability
    llm_config = LLMConfig(enabled=True, tool=llm_tool, batch_size=2)
    enhancer = LLMEnhancer(llm_config)

    if not enhancer.check_available():
        print("[X] CCW CLI not available - skipping LLM-enhanced test")
        print("  Install CCW: npm install -g ccw")
        return {}

    start_time = time.time()

    # Generate LLM-enhanced embeddings
    embedder = Embedder(profile="code")
    vector_store = VectorStore(db_path)
    indexer = EnhancedSemanticIndexer(enhancer, embedder, vector_store)

    # Prepare file data
    file_data_list = [
        FileData(path=path, content=content, language="python")
        for path, content in TEST_DATASET.items()
    ]

    # Index with LLM enhancement
    print(f"Generating LLM summaries for {len(file_data_list)} files...")
    indexed = indexer.index_files(file_data_list)
    setup_time = time.time() - start_time

    print(f"Setup: {indexed}/{len(file_data_list)} files indexed in {setup_time:.1f}s")

    # Test queries
    engine = HybridSearchEngine()
    results = {}

    print(f"\n{'Query':<45} {'Top Result':<30} {'Score':<8}")
    print("-" * 70)

    for query, expected_file in TEST_QUERIES:
        search_results = engine.search(
            db_path,
            query,
            limit=3,
            enable_vector=True,
            pure_vector=True,
        )

        top_file = search_results[0].path if search_results else "No results"
        top_score = search_results[0].score if search_results else 0.0
        found = expected_file in [r.path for r in search_results]
        rank = None
        if found:
            for i, r in enumerate(search_results):
                if r.path == expected_file:
                    rank = i + 1
                    break

        status = "[OK]" if found and rank == 1 else ("[~]" if found else "[X]")
        display_query = query[:42] + "..." if len(query) > 45 else query
        display_file = top_file.split('/')[-1] if '/' in top_file else top_file

        print(f"{status} {display_query:<43} {display_file:<30} {top_score:.3f}")

        results[query] = {
            "found": found,
            "rank": rank,
            "top_file": top_file,
            "score": top_score,
        }

    return results


def compare_results(pure_results: Dict, llm_results: Dict) -> None:
    """Compare and analyze results from both approaches."""
    print("\n" + "="*70)
    print("COMPARISON SUMMARY")
    print("="*70)

    if not llm_results:
        print("Cannot compare - LLM-enhanced test was skipped")
        return

    pure_score = 0
    llm_score = 0

    print(f"\n{'Query':<45} {'Pure':<10} {'LLM':<10}")
    print("-" * 70)

    for query, expected_file in TEST_QUERIES:
        pure_res = pure_results.get(query, {})
        llm_res = llm_results.get(query, {})

        pure_status = f"[OK] Rank {pure_res.get('rank', '?')}" if pure_res.get('found') else "[X] Miss"
        llm_status = f"[OK] Rank {llm_res.get('rank', '?')}" if llm_res.get('found') else "[X] Miss"

        # Scoring: Rank 1 = 3 points, Rank 2 = 2 points, Rank 3 = 1 point
        if pure_res.get('found') and pure_res.get('rank'):
            pure_score += max(0, 4 - pure_res['rank'])
        if llm_res.get('found') and llm_res.get('rank'):
            llm_score += max(0, 4 - llm_res['rank'])

        display_query = query[:42] + "..." if len(query) > 45 else query
        print(f"{display_query:<45} {pure_status:<10} {llm_status:<10}")

    print("-" * 70)
    print(f"{'TOTAL SCORE':<45} {pure_score:<10} {llm_score:<10}")
    print("="*70)

    # Analysis
    print("\nANALYSIS:")
    if llm_score > pure_score:
        improvement = ((llm_score - pure_score) / max(pure_score, 1)) * 100
        print(f"[OK] LLM enhancement improves results by {improvement:.1f}%")
        print("  Natural language summaries match queries better than raw code")
    elif pure_score > llm_score:
        degradation = ((pure_score - llm_score) / max(pure_score, 1)) * 100
        print(f"[X] Pure vector performed {degradation:.1f}% better")
        print("  LLM summaries may be too generic or missing key details")
    else:
        print("= Both approaches performed equally on this test set")

    print("\nKEY FINDINGS:")
    print("- Pure Vector: Direct code embeddings, fast but may miss semantic intent")
    print("- LLM Enhanced: Natural language summaries, better for human-like queries")
    print("- Best Use: Combine both - LLM for natural language, vector for code patterns")


def main():
    parser = argparse.ArgumentParser(
        description="Compare pure vector vs LLM-enhanced semantic search"
    )
    parser.add_argument(
        "--tool",
        choices=["gemini", "qwen"],
        default="gemini",
        help="LLM tool to use for enhancement (default: gemini)"
    )
    parser.add_argument(
        "--skip-llm",
        action="store_true",
        help="Skip LLM-enhanced test (only run pure vector)"
    )
    args = parser.parse_args()

    print("\n" + "="*70)
    print("SEMANTIC SEARCH COMPARISON TEST")
    print("Pure Vector vs LLM-Enhanced Vector Search")
    print("="*70)

    # Create test database
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = Path(f.name)

    try:
        print(f"\nTest dataset: {len(TEST_DATASET)} Python files")
        print(f"Test queries: {len(TEST_QUERIES)} natural language questions")

        create_test_database(db_path)

        # Test pure vector search
        pure_results = test_pure_vector_search(db_path)

        # Test LLM-enhanced search
        if not args.skip_llm:
            # Clear semantic_chunks table for LLM test
            with sqlite3.connect(db_path) as conn:
                conn.execute("DELETE FROM semantic_chunks")
                conn.commit()

            llm_results = test_llm_enhanced_search(db_path, args.tool)
        else:
            llm_results = {}
            print("\n[X] LLM-enhanced test skipped (--skip-llm flag)")

        # Compare results
        compare_results(pure_results, llm_results)

    finally:
        # Cleanup - ensure all connections are closed
        try:
            import gc
            gc.collect()  # Force garbage collection to close any lingering connections
            time.sleep(0.1)  # Small delay for Windows to release file handle
            if db_path.exists():
                db_path.unlink()
        except PermissionError:
            print(f"\nWarning: Could not delete temporary database: {db_path}")
            print("It will be cleaned up on next system restart.")

    print("\n" + "="*70)
    print("Test completed successfully!")
    print("="*70)


if __name__ == "__main__":
    main()
