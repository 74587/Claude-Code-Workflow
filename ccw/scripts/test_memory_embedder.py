#!/usr/bin/env python3
"""
Test script for memory_embedder.py

Creates a temporary database with test data and verifies all commands work.
"""

import json
import sqlite3
import tempfile
import subprocess
from pathlib import Path
from datetime import datetime


def create_test_database():
    """Create a temporary database with test chunks."""
    # Create temp file
    temp_db = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
    temp_db.close()

    conn = sqlite3.connect(temp_db.name)
    cursor = conn.cursor()

    # Create schema
    cursor.execute("""
        CREATE TABLE memory_chunks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_id TEXT NOT NULL,
            source_type TEXT NOT NULL,
            chunk_index INTEGER NOT NULL,
            content TEXT NOT NULL,
            embedding BLOB,
            metadata TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(source_id, chunk_index)
        )
    """)

    # Insert test data
    test_chunks = [
        ("CMEM-20250101-001", "core_memory", 0, "Implemented authentication using JWT tokens with refresh mechanism"),
        ("CMEM-20250101-001", "core_memory", 1, "Added rate limiting to API endpoints using Redis"),
        ("WFS-20250101-auth", "workflow", 0, "Created login endpoint with password hashing"),
        ("WFS-20250101-auth", "workflow", 1, "Implemented session management with token rotation"),
        ("CLI-20250101-001", "cli_history", 0, "Executed database migration for user table"),
    ]

    now = datetime.now().isoformat()
    for source_id, source_type, chunk_index, content in test_chunks:
        cursor.execute(
            """
            INSERT INTO memory_chunks (source_id, source_type, chunk_index, content, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (source_id, source_type, chunk_index, content, now)
        )

    conn.commit()
    conn.close()

    return temp_db.name


def run_command(args):
    """Run memory_embedder.py with given arguments."""
    script = Path(__file__).parent / "memory_embedder.py"
    cmd = ["python", str(script)] + args

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True
    )

    return result.returncode, result.stdout, result.stderr


def test_status(db_path):
    """Test status command."""
    print("Testing status command...")
    returncode, stdout, stderr = run_command(["status", db_path])

    if returncode != 0:
        print(f"[FAIL] Status failed: {stderr}")
        return False

    result = json.loads(stdout)
    expected_total = 5

    if result["total_chunks"] != expected_total:
        print(f"[FAIL] Expected {expected_total} chunks, got {result['total_chunks']}")
        return False

    if result["embedded_chunks"] != 0:
        print(f"[FAIL] Expected 0 embedded chunks, got {result['embedded_chunks']}")
        return False

    print(f"[PASS] Status OK: {result['total_chunks']} total, {result['embedded_chunks']} embedded")
    return True


def test_embed(db_path):
    """Test embed command."""
    print("\nTesting embed command...")
    returncode, stdout, stderr = run_command(["embed", db_path, "--batch-size", "2"])

    if returncode != 0:
        print(f"[FAIL] Embed failed: {stderr}")
        return False

    result = json.loads(stdout)

    if not result["success"]:
        print(f"[FAIL] Embed unsuccessful")
        return False

    if result["chunks_processed"] != 5:
        print(f"[FAIL] Expected 5 processed, got {result['chunks_processed']}")
        return False

    if result["chunks_failed"] != 0:
        print(f"[FAIL] Expected 0 failed, got {result['chunks_failed']}")
        return False

    print(f"[PASS] Embed OK: {result['chunks_processed']} processed in {result['elapsed_time']}s")
    return True


def test_search(db_path):
    """Test search command."""
    print("\nTesting search command...")
    returncode, stdout, stderr = run_command([
        "search", db_path, "authentication JWT",
        "--top-k", "3",
        "--min-score", "0.3"
    ])

    if returncode != 0:
        print(f"[FAIL] Search failed: {stderr}")
        return False

    result = json.loads(stdout)

    if not result["success"]:
        print(f"[FAIL] Search unsuccessful: {result.get('error', 'Unknown error')}")
        return False

    if len(result["matches"]) == 0:
        print(f"[FAIL] Expected at least 1 match, got 0")
        return False

    print(f"[PASS] Search OK: {len(result['matches'])} matches found")

    # Show top match
    top_match = result["matches"][0]
    print(f"   Top match: {top_match['source_id']} (score: {top_match['score']})")
    print(f"   Content: {top_match['content'][:60]}...")

    return True


def test_source_filter(db_path):
    """Test search with source type filter."""
    print("\nTesting source type filter...")
    returncode, stdout, stderr = run_command([
        "search", db_path, "authentication",
        "--type", "workflow"
    ])

    if returncode != 0:
        print(f"[FAIL] Filtered search failed: {stderr}")
        return False

    result = json.loads(stdout)

    if not result["success"]:
        print(f"[FAIL] Filtered search unsuccessful")
        return False

    # Verify all matches are workflow type
    for match in result["matches"]:
        if match["source_type"] != "workflow":
            print(f"[FAIL] Expected workflow type, got {match['source_type']}")
            return False

    print(f"[PASS] Filter OK: {len(result['matches'])} workflow matches")
    return True


def main():
    """Run all tests."""
    print("Memory Embedder Test Suite")
    print("=" * 60)

    # Create test database
    print("\nCreating test database...")
    db_path = create_test_database()
    print(f"[PASS] Database created: {db_path}")

    try:
        # Run tests
        tests = [
            ("Status", test_status),
            ("Embed", test_embed),
            ("Search", test_search),
            ("Source Filter", test_source_filter),
        ]

        passed = 0
        failed = 0

        for name, test_func in tests:
            try:
                if test_func(db_path):
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"[FAIL] {name} crashed: {e}")
                failed += 1

        # Summary
        print("\n" + "=" * 60)
        print(f"Results: {passed} passed, {failed} failed")

        if failed == 0:
            print("[PASS] All tests passed!")
            return 0
        else:
            print("[FAIL] Some tests failed")
            return 1

    finally:
        # Cleanup
        import os
        try:
            os.unlink(db_path)
            print(f"\n[PASS] Cleaned up test database")
        except:
            pass


if __name__ == "__main__":
    exit(main())
