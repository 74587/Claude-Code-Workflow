"""
Manual validation script for performance optimizations.

This script verifies that the optimization implementations are working correctly.
Run with: python tests/validate_optimizations.py
"""

import json
import sqlite3
import tempfile
import time
from pathlib import Path

from codexlens.storage.dir_index import DirIndexStore
from codexlens.storage.registry import RegistryStore
from codexlens.storage.migration_manager import MigrationManager
from codexlens.storage.migrations import migration_001_normalize_keywords


def test_keyword_normalization():
    """Test normalized keywords functionality."""
    print("\n=== Testing Keyword Normalization ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_index.db"
        store = DirIndexStore(db_path)
        store.initialize()  # Create schema

        # Add a test file
        # Note: add_file automatically calculates mtime and line_count
        file_id = store.add_file(
            name="test.py",
            full_path=Path("/test/test.py"),
            content="def hello(): pass",
            language="python"
        )

        # Add semantic metadata with keywords
        keywords = ["auth", "security", "jwt"]
        store.add_semantic_metadata(
            file_id=file_id,
            summary="Test summary",
            keywords=keywords,
            purpose="Testing",
            llm_tool="gemini"
        )

        conn = store._get_connection()

        # Verify keywords table populated
        keyword_rows = conn.execute("""
            SELECT k.keyword
            FROM file_keywords fk
            JOIN keywords k ON fk.keyword_id = k.id
            WHERE fk.file_id = ?
        """, (file_id,)).fetchall()

        normalized_keywords = [row["keyword"] for row in keyword_rows]
        print(f"✓ Keywords stored in normalized tables: {normalized_keywords}")
        assert set(normalized_keywords) == set(keywords), "Keywords mismatch!"

        # Test optimized search
        results = store.search_semantic_keywords("auth", use_normalized=True)
        print(f"✓ Found {len(results)} file(s) with keyword 'auth'")
        assert len(results) > 0, "No results found!"

        # Test fallback search
        results_fallback = store.search_semantic_keywords("auth", use_normalized=False)
        print(f"✓ Fallback search found {len(results_fallback)} file(s)")
        assert len(results) == len(results_fallback), "Result count mismatch!"

        store.close()
        print("✓ Keyword normalization tests PASSED")


def test_path_lookup_optimization():
    """Test optimized path lookup."""
    print("\n=== Testing Path Lookup Optimization ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_registry.db"
        store = RegistryStore(db_path)

        # Add directory mapping
        store.add_dir_mapping(
            source_path=Path("/a/b/c"),
            index_path=Path("/tmp/index.db"),
            project_id=None
        )

        # Test deep path lookup
        deep_path = Path("/a/b/c/d/e/f/g/h/i/j/file.py")

        start = time.perf_counter()
        result = store.find_nearest_index(deep_path)
        elapsed = time.perf_counter() - start

        print(f"✓ Found nearest index in {elapsed*1000:.2f}ms")
        assert result is not None, "No result found!"
        assert result.source_path == Path("/a/b/c"), "Wrong path found!"
        assert elapsed < 0.05, f"Too slow: {elapsed*1000:.2f}ms"

        store.close()
        print("✓ Path lookup optimization tests PASSED")


def test_symbol_search_prefix_mode():
    """Test symbol search with prefix mode."""
    print("\n=== Testing Symbol Search Prefix Mode ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_index.db"
        store = DirIndexStore(db_path)
        store.initialize()  # Create schema

        # Add a test file
        file_id = store.add_file(
            name="test.py",
            full_path=Path("/test/test.py"),
            content="def hello(): pass\n" * 10,  # 10 lines
            language="python"
        )

        # Add symbols
        store.add_symbols(
            file_id=file_id,
            symbols=[
                ("get_user", "function", 1, 5),
                ("get_item", "function", 6, 10),
                ("create_user", "function", 11, 15),
                ("UserClass", "class", 16, 25),
            ]
        )

        # Test prefix search
        results = store.search_symbols("get", prefix_mode=True)
        print(f"✓ Prefix search for 'get' found {len(results)} symbol(s)")
        assert len(results) == 2, f"Expected 2 symbols, got {len(results)}"
        for symbol in results:
            assert symbol.name.startswith("get"), f"Symbol {symbol.name} doesn't start with 'get'"
        print(f"  Symbols: {[s.name for s in results]}")

        # Test substring search
        results_sub = store.search_symbols("user", prefix_mode=False)
        print(f"✓ Substring search for 'user' found {len(results_sub)} symbol(s)")
        assert len(results_sub) == 3, f"Expected 3 symbols, got {len(results_sub)}"
        print(f"  Symbols: {[s.name for s in results_sub]}")

        store.close()
        print("✓ Symbol search optimization tests PASSED")


def test_migration_001():
    """Test migration_001 execution."""
    print("\n=== Testing Migration 001 ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_index.db"
        store = DirIndexStore(db_path)
        store.initialize()  # Create schema
        conn = store._get_connection()

        # Add test data to semantic_metadata
        conn.execute("""
            INSERT INTO files(id, name, full_path, language, mtime, line_count)
            VALUES(1, 'test.py', '/test.py', 'python', 0, 10)
        """)
        conn.execute("""
            INSERT INTO semantic_metadata(file_id, keywords)
            VALUES(1, ?)
        """, (json.dumps(["test", "migration", "keyword"]),))
        conn.commit()

        # Run migration
        print("  Running migration_001...")
        migration_001_normalize_keywords.upgrade(conn)
        print("  Migration completed successfully")

        # Verify migration results
        keyword_count = conn.execute("""
            SELECT COUNT(*) as c FROM file_keywords WHERE file_id=1
        """).fetchone()["c"]

        print(f"✓ Migrated {keyword_count} keywords for file_id=1")
        assert keyword_count == 3, f"Expected 3 keywords, got {keyword_count}"

        # Verify keywords table
        keywords = conn.execute("""
            SELECT k.keyword FROM keywords k
            JOIN file_keywords fk ON k.id = fk.keyword_id
            WHERE fk.file_id = 1
        """).fetchall()
        keyword_list = [row["keyword"] for row in keywords]
        print(f"  Keywords: {keyword_list}")

        store.close()
        print("✓ Migration 001 tests PASSED")


def test_performance_comparison():
    """Compare performance of optimized vs fallback implementations."""
    print("\n=== Performance Comparison ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_index.db"
        store = DirIndexStore(db_path)
        store.initialize()  # Create schema

        # Create test data
        print("  Creating test data...")
        for i in range(100):
            file_id = store.add_file(
                name=f"file_{i}.py",
                full_path=Path(f"/test/file_{i}.py"),
                content=f"def function_{i}(): pass",
                language="python"
            )

            # Vary keywords
            if i % 3 == 0:
                keywords = ["auth", "security"]
            elif i % 3 == 1:
                keywords = ["database", "query"]
            else:
                keywords = ["api", "endpoint"]

            store.add_semantic_metadata(
                file_id=file_id,
                summary=f"File {i}",
                keywords=keywords,
                purpose="Testing",
                llm_tool="gemini"
            )

        # Benchmark normalized search
        print("  Benchmarking normalized search...")
        start = time.perf_counter()
        for _ in range(10):
            results_norm = store.search_semantic_keywords("auth", use_normalized=True)
        norm_time = time.perf_counter() - start

        # Benchmark fallback search
        print("  Benchmarking fallback search...")
        start = time.perf_counter()
        for _ in range(10):
            results_fallback = store.search_semantic_keywords("auth", use_normalized=False)
        fallback_time = time.perf_counter() - start

        print(f"\n  Results:")
        print(f"  - Normalized search: {norm_time*1000:.2f}ms (10 iterations)")
        print(f"  - Fallback search:   {fallback_time*1000:.2f}ms (10 iterations)")
        print(f"  - Speedup factor:    {fallback_time/norm_time:.2f}x")
        print(f"  - Both found {len(results_norm)} files")

        assert len(results_norm) == len(results_fallback), "Result count mismatch!"

        store.close()
        print("✓ Performance comparison PASSED")


def main():
    """Run all validation tests."""
    print("=" * 60)
    print("CodexLens Performance Optimizations Validation")
    print("=" * 60)

    try:
        test_keyword_normalization()
        test_path_lookup_optimization()
        test_symbol_search_prefix_mode()
        test_migration_001()
        test_performance_comparison()

        print("\n" + "=" * 60)
        print("✓✓✓ ALL VALIDATION TESTS PASSED ✓✓✓")
        print("=" * 60)
        return 0

    except Exception as e:
        print(f"\nX VALIDATION FAILED: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
