"""Test script for chain search engine functionality."""

from pathlib import Path
from codexlens.search import ChainSearchEngine, SearchOptions, quick_search
from codexlens.storage.registry import RegistryStore
from codexlens.storage.path_mapper import PathMapper


def test_basic_search():
    """Test basic chain search functionality."""
    print("=== Testing Chain Search Engine ===\n")

    # Initialize components
    registry = RegistryStore()
    registry.initialize()
    mapper = PathMapper()

    # Create engine
    engine = ChainSearchEngine(registry, mapper)
    print(f"[OK] ChainSearchEngine initialized")

    # Test search options
    options = SearchOptions(
        depth=-1,
        max_workers=4,
        limit_per_dir=10,
        total_limit=50,
        include_symbols=False,
        files_only=False
    )
    print(f"[OK] SearchOptions configured: depth={options.depth}, workers={options.max_workers}")

    # Test path that exists in the current project
    test_path = Path("D:/Claude_dms3/codex-lens/src/codexlens")

    if test_path.exists():
        print(f"\n[OK] Test path exists: {test_path}")

        # Perform search
        result = engine.search("search", test_path, options)

        print(f"\n=== Search Results ===")
        print(f"Query: '{result.query}'")
        print(f"Directories searched: {result.stats.dirs_searched}")
        print(f"Files matched: {result.stats.files_matched}")
        print(f"Time: {result.stats.time_ms:.2f}ms")

        if result.stats.errors:
            print(f"Errors: {len(result.stats.errors)}")
            for err in result.stats.errors[:3]:
                print(f"  - {err}")

        print(f"\nTop Results (showing first 5):")
        for i, res in enumerate(result.results[:5], 1):
            print(f"{i}. {res.path}")
            print(f"   Score: {res.score:.2f}")
            if res.excerpt:
                excerpt = res.excerpt.replace('\n', ' ')[:100]
                print(f"   Excerpt: {excerpt}...")
    else:
        print(f"\n[SKIP] Test path does not exist: {test_path}")
        print("  (Index may not be built yet)")

    registry.close()
    print("\n[OK] Test completed")


def test_quick_search():
    """Test quick_search convenience function."""
    print("\n\n=== Testing Quick Search ===\n")

    test_path = Path("D:/Claude_dms3/codex-lens/src")

    if test_path.exists():
        results = quick_search("index", test_path, depth=2)
        print(f"[OK] Quick search completed")
        print(f"  Found {len(results)} results")
        if results:
            print(f"  Top result: {results[0].path}")
    else:
        print(f"[SKIP] Test path does not exist: {test_path}")

    print("\n[OK] Quick search test completed")


def test_symbol_search():
    """Test symbol search functionality."""
    print("\n\n=== Testing Symbol Search ===\n")

    registry = RegistryStore()
    registry.initialize()
    mapper = PathMapper()
    engine = ChainSearchEngine(registry, mapper)

    test_path = Path("D:/Claude_dms3/codex-lens/src/codexlens")

    if test_path.exists():
        symbols = engine.search_symbols("search", test_path, kind=None)
        print(f"[OK] Symbol search completed")
        print(f"  Found {len(symbols)} symbols")
        for i, sym in enumerate(symbols[:5], 1):
            print(f"  {i}. {sym.name} ({sym.kind}) - lines {sym.range[0]}-{sym.range[1]}")
    else:
        print(f"[SKIP] Test path does not exist: {test_path}")

    registry.close()
    print("\n[OK] Symbol search test completed")


def test_files_only_search():
    """Test files-only search mode."""
    print("\n\n=== Testing Files-Only Search ===\n")

    registry = RegistryStore()
    registry.initialize()
    mapper = PathMapper()
    engine = ChainSearchEngine(registry, mapper)

    test_path = Path("D:/Claude_dms3/codex-lens/src")

    if test_path.exists():
        file_paths = engine.search_files_only("class", test_path)
        print(f"[OK] Files-only search completed")
        print(f"  Found {len(file_paths)} files")
        for i, path in enumerate(file_paths[:5], 1):
            print(f"  {i}. {path}")
    else:
        print(f"[SKIP] Test path does not exist: {test_path}")

    registry.close()
    print("\n[OK] Files-only search test completed")


if __name__ == "__main__":
    try:
        test_basic_search()
        test_quick_search()
        test_symbol_search()
        test_files_only_search()
        print("\n" + "=" * 50)
        print("All tests completed successfully!")
        print("=" * 50)
    except Exception as e:
        print(f"\n[ERROR] Test failed with error: {e}")
        import traceback
        traceback.print_exc()
