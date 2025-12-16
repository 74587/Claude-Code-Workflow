#!/usr/bin/env python3
"""Test pure vector vs LLM-enhanced search with misleading/missing comments.

This test demonstrates how LLM enhancement can overcome:
1. Missing comments/docstrings
2. Misleading or incorrect comments
3. Outdated documentation

Usage:
    python test_misleading_comments.py --tool gemini
"""

import argparse
import sqlite3
import sys
import tempfile
import time
from pathlib import Path
from typing import Dict, List

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
    sys.exit(1)


# Test dataset with MISLEADING or MISSING comments
MISLEADING_DATASET = {
    "crypto/hasher.py": '''"""Simple string utilities."""
import bcrypt

def process_string(s: str, rounds: int = 12) -> str:
    """Convert string to uppercase."""
    salt = bcrypt.gensalt(rounds=rounds)
    hashed = bcrypt.hashpw(s.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def check_string(s: str, target: str) -> bool:
    """Check if two strings are equal."""
    return bcrypt.checkpw(s.encode('utf-8'), target.encode('utf-8'))
''',

    "auth/token.py": '''import jwt
from datetime import datetime, timedelta

SECRET_KEY = "key123"

def make_thing(uid: int, exp: int = 3600) -> str:
    payload = {
        'user_id': uid,
        'exp': datetime.utcnow() + timedelta(seconds=exp),
        'iat': datetime.utcnow()
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def parse_thing(thing: str) -> dict:
    try:
        return jwt.decode(thing, SECRET_KEY, algorithms=['HS256'])
    except jwt.ExpiredSignatureError:
        return None
''',

    "api/handlers.py": '''"""Database connection utilities."""
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/items', methods=['POST'])
def create_item():
    """Delete an existing item."""
    data = request.get_json()
    if not data.get('email') or not data.get('password'):
        return jsonify({'error': 'Missing data'}), 400
    item_id = 12345
    return jsonify({'item_id': item_id, 'success': True}), 201

@app.route('/api/items/<int:item_id>', methods=['GET'])
def get_item(item_id: int):
    """Update item configuration."""
    item = {
        'id': item_id,
        'email': 'user@example.com',
        'name': 'John Doe'
    }
    return jsonify(item), 200
''',

    "utils/checker.py": '''"""Math calculation functions."""
import re

def calc_sum(email: str) -> bool:
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def format_text(text: str, max_len: int = 255) -> str:
    text = re.sub(r'[<>"\\'&]', '', text)
    return text.strip()[:max_len]
''',

    "db/pool.py": '''"""Email sending service."""
import psycopg2
from psycopg2 import pool
from contextlib import contextmanager

class EmailSender:
    """SMTP email sender with retry logic."""

    def __init__(self, min_conn: int = 1, max_conn: int = 10):
        """Initialize email sender."""
        self.pool = psycopg2.pool.SimpleConnectionPool(
            min_conn, max_conn,
            user='dbuser', host='localhost', database='myapp'
        )

    @contextmanager
    def send_email(self):
        """Send email message."""
        conn = self.pool.getconn()
        try:
            yield conn
            conn.commit()
        finally:
            self.pool.putconn(conn)
''',
}


# Test queries - natural language based on ACTUAL functionality (not misleading comments)
TEST_QUERIES = [
    ("How to hash passwords securely with bcrypt?", "crypto/hasher.py"),
    ("Generate JWT authentication token", "auth/token.py"),
    ("Create user account REST API endpoint", "api/handlers.py"),
    ("Validate email address format", "utils/checker.py"),
    ("PostgreSQL database connection pool", "db/pool.py"),
]


def create_test_database(db_path: Path) -> None:
    """Create and populate test database."""
    store = DirIndexStore(db_path)
    store.initialize()

    with store._get_connection() as conn:
        for path, content in MISLEADING_DATASET.items():
            name = path.split('/')[-1]
            conn.execute(
                """INSERT INTO files (name, full_path, content, language, mtime)
                   VALUES (?, ?, ?, ?, ?)""",
                (name, path, content, "python", 0.0)
            )
        conn.commit()

    store.close()


def test_pure_vector_search(db_path: Path) -> Dict:
    """Test pure vector search (relies on code + misleading comments)."""
    print("\n" + "="*70)
    print("PURE VECTOR SEARCH (Code + Misleading Comments -> fastembed)")
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
    print("Note: Embeddings include misleading comments")

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
    """Test LLM-enhanced search (LLM reads code and generates accurate summary)."""
    print("\n" + "="*70)
    print(f"LLM-ENHANCED SEARCH (Code -> {llm_tool.upper()} Analysis -> fastembed)")
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
        for path, content in MISLEADING_DATASET.items()
    ]

    # Index with LLM enhancement
    print(f"LLM analyzing code (ignoring misleading comments)...")
    indexed = indexer.index_files(file_data_list)
    setup_time = time.time() - start_time

    print(f"Setup: {indexed}/{len(file_data_list)} files indexed in {setup_time:.1f}s")
    print("Note: LLM generates summaries based on actual code logic")

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
    print("COMPARISON SUMMARY - MISLEADING COMMENTS TEST")
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
        print("  LLM understands actual code logic despite misleading comments")
        print("  Pure vector search misled by incorrect documentation")
    elif pure_score > llm_score:
        degradation = ((pure_score - llm_score) / max(pure_score, 1)) * 100
        print(f"[X] Pure vector performed {degradation:.1f}% better")
        print("  Unexpected: Pure vector wasn't affected by misleading comments")
    else:
        print("= Both approaches performed equally")
        print("  Test dataset may still be too simple to show differences")

    print("\nKEY INSIGHTS:")
    print("- Pure Vector: Embeds code + comments together, can be misled")
    print("- LLM Enhanced: Analyzes actual code behavior, ignores bad comments")
    print("- Best Use: LLM enhancement crucial for poorly documented codebases")

    print("\nMISLEADING COMMENTS IN TEST:")
    print("1. 'hasher.py' claims 'string utilities' but does bcrypt hashing")
    print("2. 'token.py' has no docstrings, unclear function names")
    print("3. 'handlers.py' says 'database utilities' but is REST API")
    print("4. 'handlers.py' docstrings opposite (create says delete, etc)")
    print("5. 'checker.py' claims 'math functions' but validates emails")
    print("6. 'pool.py' claims 'email sender' but is database pool")


def main():
    parser = argparse.ArgumentParser(
        description="Test pure vector vs LLM-enhanced with misleading comments"
    )
    parser.add_argument(
        "--tool",
        choices=["gemini", "qwen"],
        default="gemini",
        help="LLM tool to use (default: gemini)"
    )
    parser.add_argument(
        "--skip-llm",
        action="store_true",
        help="Skip LLM-enhanced test"
    )
    parser.add_argument(
        "--keep-db",
        type=str,
        help="Save database to specified path for inspection (e.g., ./test_results.db)"
    )
    args = parser.parse_args()

    print("\n" + "="*70)
    print("MISLEADING COMMENTS TEST")
    print("Pure Vector vs LLM-Enhanced with Incorrect Documentation")
    print("="*70)

    # Create test database
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = Path(f.name)

    try:
        print(f"\nTest dataset: {len(MISLEADING_DATASET)} Python files")
        print(f"Test queries: {len(TEST_QUERIES)} natural language questions")
        print("\nChallenges:")
        print("- Misleading module docstrings")
        print("- Incorrect function docstrings")
        print("- Missing documentation")
        print("- Unclear function names")

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
        # Save or cleanup database
        if args.keep_db:
            import shutil
            save_path = Path(args.keep_db)
            try:
                import gc
                gc.collect()
                time.sleep(0.2)
                shutil.copy2(db_path, save_path)
                print(f"\n[OK] Database saved to: {save_path}")
                print(f"Inspect with: python scripts/inspect_llm_summaries.py {save_path}")
            except Exception as e:
                print(f"\n[X] Failed to save database: {e}")
            finally:
                try:
                    if db_path.exists():
                        db_path.unlink()
                except:
                    pass
        else:
            # Cleanup
            try:
                import gc
                gc.collect()
                time.sleep(0.1)
                if db_path.exists():
                    db_path.unlink()
            except PermissionError:
                print(f"\nWarning: Could not delete temporary database: {db_path}")

    print("\n" + "="*70)
    print("Test completed!")
    print("="*70)


if __name__ == "__main__":
    main()
