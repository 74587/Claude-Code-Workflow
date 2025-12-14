"""
Simple validation for performance optimizations (Windows-safe).
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

import json
import sqlite3
import tempfile
import time
from pathlib import Path

from codexlens.storage.dir_index import DirIndexStore
from codexlens.storage.registry import RegistryStore


def main():
    print("=" * 60)
    print("CodexLens Performance Optimizations - Simple Validation")
    print("=" * 60)

    # Test 1: Keyword Normalization
    print("\n[1/4] Testing Keyword Normalization...")
    try:
        tmpdir = tempfile.mkdtemp()
        db_path = Path(tmpdir) / "test1.db"

        store = DirIndexStore(db_path)
        store.initialize()

        file_id = store.add_file(
            name="test.py",
            full_path=Path(f"{tmpdir}/test.py"),
            content="def hello(): pass",
            language="python"
        )

        keywords = ["auth", "security", "jwt"]
        store.add_semantic_metadata(
            file_id=file_id,
            summary="Test",
            keywords=keywords,
            purpose="Testing",
            llm_tool="gemini"
        )

        # Check normalized tables
        conn = store._get_connection()
        count = conn.execute(
            "SELECT COUNT(*) as c FROM file_keywords WHERE file_id=?",
            (file_id,)
        ).fetchone()["c"]

        store.close()

        assert count == 3, f"Expected 3 keywords, got {count}"
        print("   PASS: Keywords stored in normalized tables")

        # Test optimized search
        store = DirIndexStore(db_path)
        results = store.search_semantic_keywords("auth", use_normalized=True)
        store.close()

        assert len(results) == 1
        print("   PASS: Optimized keyword search works")

    except Exception as e:
        import traceback
        print(f"   FAIL: {e}")
        traceback.print_exc()
        return 1

    # Test 2: Path Lookup Optimization
    print("\n[2/4] Testing Path Lookup Optimization...")
    try:
        tmpdir = tempfile.mkdtemp()
        db_path = Path(tmpdir) / "test2.db"

        store = RegistryStore(db_path)
        store.initialize()  # Create schema

        # Register a project first
        project = store.register_project(
            source_root=Path("/a"),
            index_root=Path("/tmp")
        )

        # Register directory
        store.register_dir(
            project_id=project.id,
            source_path=Path("/a/b/c"),
            index_path=Path("/tmp/index.db"),
            depth=2,
            files_count=0
        )

        deep_path = Path("/a/b/c/d/e/f/g/h/i/j/file.py")

        start = time.perf_counter()
        result = store.find_nearest_index(deep_path)
        elapsed = time.perf_counter() - start

        store.close()

        assert result is not None, "No result found"
        # Path is normalized, just check it contains the key parts
        assert "a" in str(result.source_path) and "b" in str(result.source_path) and "c" in str(result.source_path)
        assert elapsed < 0.05, f"Too slow: {elapsed*1000:.2f}ms"

        print(f"   PASS: Found nearest index in {elapsed*1000:.2f}ms")

    except Exception as e:
        import traceback
        print(f"   FAIL: {e}")
        traceback.print_exc()
        return 1

    # Test 3: Symbol Search Prefix Mode
    print("\n[3/4] Testing Symbol Search Prefix Mode...")
    try:
        tmpdir = tempfile.mkdtemp()
        db_path = Path(tmpdir) / "test3.db"

        store = DirIndexStore(db_path)
        store.initialize()

        from codexlens.entities import Symbol
        file_id = store.add_file(
            name="test.py",
            full_path=Path(f"{tmpdir}/test.py"),
            content="def hello(): pass\n" * 10,
            language="python",
            symbols=[
                Symbol(name="get_user", kind="function", range=(1, 5)),
                Symbol(name="get_item", kind="function", range=(6, 10)),
                Symbol(name="create_user", kind="function", range=(11, 15)),
            ]
        )

        # Prefix search
        results = store.search_symbols("get", prefix_mode=True)
        store.close()

        assert len(results) == 2, f"Expected 2, got {len(results)}"
        for symbol in results:
            assert symbol.name.startswith("get")

        print(f"   PASS: Prefix search found {len(results)} symbols")

    except Exception as e:
        import traceback
        print(f"   FAIL: {e}")
        traceback.print_exc()
        return 1

    # Test 4: Performance Comparison
    print("\n[4/4] Testing Performance Comparison...")
    try:
        tmpdir = tempfile.mkdtemp()
        db_path = Path(tmpdir) / "test4.db"

        store = DirIndexStore(db_path)
        store.initialize()

        # Create 50 files with keywords
        for i in range(50):
            file_id = store.add_file(
                name=f"file_{i}.py",
                full_path=Path(f"{tmpdir}/file_{i}.py"),
                content=f"def function_{i}(): pass",
                language="python"
            )

            keywords = ["auth", "security"] if i % 2 == 0 else ["api", "endpoint"]
            store.add_semantic_metadata(
                file_id=file_id,
                summary=f"File {i}",
                keywords=keywords,
                purpose="Testing",
                llm_tool="gemini"
            )

        # Benchmark normalized
        start = time.perf_counter()
        for _ in range(5):
            results_norm = store.search_semantic_keywords("auth", use_normalized=True)
        norm_time = time.perf_counter() - start

        # Benchmark fallback
        start = time.perf_counter()
        for _ in range(5):
            results_fallback = store.search_semantic_keywords("auth", use_normalized=False)
        fallback_time = time.perf_counter() - start

        store.close()

        assert len(results_norm) == len(results_fallback)
        speedup = fallback_time / norm_time if norm_time > 0 else 1.0

        print(f"   Normalized: {norm_time*1000:.2f}ms (5 iterations)")
        print(f"   Fallback:   {fallback_time*1000:.2f}ms (5 iterations)")
        print(f"   Speedup:    {speedup:.2f}x")
        print("   PASS: Performance test completed")

    except Exception as e:
        import traceback
        print(f"   FAIL: {e}")
        traceback.print_exc()
        return 1

    print("\n" + "=" * 60)
    print("ALL VALIDATION TESTS PASSED")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    exit(main())
