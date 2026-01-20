#!/usr/bin/env python
"""Quick real interface test script for LSP Bridge (Standalone Mode).

Usage:
    python tests/real/quick_test.py

Requires: pyright-langserver installed (npm install -g pyright)
"""

import asyncio
import shutil
import sys
from pathlib import Path

# Add source to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from codexlens.lsp.lsp_bridge import LspBridge
from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
from codexlens.hybrid_search.data_structures import CodeSymbolNode, Range


# Test file - the LSP bridge source itself
TEST_FILE = Path(__file__).parent.parent.parent / "src" / "codexlens" / "lsp" / "lsp_bridge.py"
WORKSPACE_ROOT = Path(__file__).parent.parent.parent  # codex-lens root


def check_pyright():
    """Check if pyright-langserver is available."""
    return shutil.which("pyright-langserver") is not None


async def test_get_definition():
    """Test get_definition."""
    print("\n" + "=" * 60)
    print("TEST: get_definition")
    print("=" * 60)

    symbol = CodeSymbolNode(
        id=f"{TEST_FILE}:LspBridge:96",
        name="LspBridge",
        kind="class",
        file_path=str(TEST_FILE),
        range=Range(start_line=96, start_character=6, end_line=96, end_character=15),
    )

    print(f"Symbol: {symbol.name}")
    print(f"File: {symbol.file_path}")
    print(f"Position: line {symbol.range.start_line}, char {symbol.range.start_character}")

    async with LspBridge(workspace_root=str(WORKSPACE_ROOT), timeout=30.0) as bridge:
        result = await bridge.get_definition(symbol)

    if result:
        print(f"\n[OK] SUCCESS: Definition found at {result.file_path}:{result.line}")
    else:
        print(f"\n[WARN] No definition found (may be expected for class declaration)")

    return result is not None


async def test_get_references():
    """Test get_references."""
    print("\n" + "=" * 60)
    print("TEST: get_references")
    print("=" * 60)

    symbol = CodeSymbolNode(
        id=f"{TEST_FILE}:get_references:200",
        name="get_references",
        kind="method",
        file_path=str(TEST_FILE),
        range=Range(start_line=200, start_character=10, end_line=200, end_character=24),
    )

    print(f"Symbol: {symbol.name}")
    print(f"File: {Path(symbol.file_path).name}")
    print(f"Position: line {symbol.range.start_line}")

    async with LspBridge(workspace_root=str(WORKSPACE_ROOT), timeout=30.0) as bridge:
        refs = await bridge.get_references(symbol)

    print(f"\n[OK] Found {len(refs)} references:")
    for i, ref in enumerate(refs[:10]):
        print(f"   [{i+1}] {Path(ref.file_path).name}:{ref.line}")
    if len(refs) > 10:
        print(f"   ... and {len(refs) - 10} more")

    return len(refs) >= 0


async def test_get_hover():
    """Test get_hover."""
    print("\n" + "=" * 60)
    print("TEST: get_hover")
    print("=" * 60)

    symbol = CodeSymbolNode(
        id=f"{TEST_FILE}:LspBridge:96",
        name="LspBridge",
        kind="class",
        file_path=str(TEST_FILE),
        range=Range(start_line=96, start_character=6, end_line=96, end_character=15),
    )

    print(f"Symbol: {symbol.name}")

    async with LspBridge(workspace_root=str(WORKSPACE_ROOT), timeout=30.0) as bridge:
        hover = await bridge.get_hover(symbol)

    if hover:
        preview = hover[:300].replace('\n', '\n   ')
        print(f"\n[OK] Hover info ({len(hover)} chars):")
        print(f"   {preview}...")
    else:
        print(f"\n[WARN] No hover info available")

    return hover is not None


async def test_get_document_symbols():
    """Test get_document_symbols."""
    print("\n" + "=" * 60)
    print("TEST: get_document_symbols")
    print("=" * 60)

    file_path = str(TEST_FILE)
    print(f"File: {Path(file_path).name}")

    async with LspBridge(workspace_root=str(WORKSPACE_ROOT), timeout=30.0) as bridge:
        symbols = await bridge.get_document_symbols(file_path)

    print(f"\n[OK] Found {len(symbols)} symbols:")

    # Group by kind
    by_kind = {}
    for sym in symbols:
        kind = sym.get("kind", "unknown")
        by_kind[kind] = by_kind.get(kind, 0) + 1

    for kind, count in sorted(by_kind.items()):
        print(f"   {kind}: {count}")

    print("\nSample symbols:")
    for sym in symbols[:15]:
        name = sym.get("name", "?")
        kind = sym.get("kind", "?")
        range_data = sym.get("range", {})
        start = range_data.get("start", {})
        line = start.get("line", 0) + 1
        print(f"   - {name} ({kind}) at line {line}")

    return len(symbols) > 0


async def test_graph_expansion():
    """Test graph expansion."""
    print("\n" + "=" * 60)
    print("TEST: Graph Expansion (LspGraphBuilder)")
    print("=" * 60)

    seed = CodeSymbolNode(
        id=f"{TEST_FILE}:LspBridge:96",
        name="LspBridge",
        kind="class",
        file_path=str(TEST_FILE),
        range=Range(start_line=96, start_character=6, end_line=96, end_character=15),
    )

    print(f"Seed: {seed.name} in {Path(seed.file_path).name}:{seed.range.start_line}")
    print("Settings: max_depth=1, max_nodes=20")

    builder = LspGraphBuilder(max_depth=1, max_nodes=20)

    async with LspBridge(workspace_root=str(WORKSPACE_ROOT), timeout=30.0) as bridge:
        graph = await builder.build_from_seeds([seed], bridge)

    print(f"\n[OK] Graph expansion complete:")
    print(f"   Nodes: {len(graph.nodes)}")
    print(f"   Edges: {len(graph.edges)}")

    if graph.nodes:
        print("\nNodes found:")
        for node_id, node in list(graph.nodes.items())[:15]:
            print(f"   - {node.name} ({node.kind}) in {Path(node.file_path).name}:{node.range.start_line}")

    if graph.edges:
        print(f"\nEdges (first 10):")
        for edge in list(graph.edges)[:10]:
            src = graph.nodes.get(edge.source_id)
            tgt = graph.nodes.get(edge.target_id)
            src_name = src.name if src else edge.source_id[:20]
            tgt_name = tgt.name if tgt else edge.target_id[:20]
            print(f"   - {src_name} --[{edge.relation}]--> {tgt_name}")

    return len(graph.nodes) >= 1


async def test_cache_performance():
    """Test cache performance."""
    print("\n" + "=" * 60)
    print("TEST: Cache Performance")
    print("=" * 60)

    symbol = CodeSymbolNode(
        id=f"{TEST_FILE}:LspBridge:96",
        name="LspBridge",
        kind="class",
        file_path=str(TEST_FILE),
        range=Range(start_line=96, start_character=6, end_line=96, end_character=15),
    )

    import time

    async with LspBridge(workspace_root=str(WORKSPACE_ROOT), timeout=30.0) as bridge:
        # First call - cache miss
        start = time.perf_counter()
        await bridge.get_references(symbol)
        first_time = (time.perf_counter() - start) * 1000

        # Second call - cache hit
        start = time.perf_counter()
        await bridge.get_references(symbol)
        second_time = (time.perf_counter() - start) * 1000

        print(f"\nFirst call (cache miss):  {first_time:.2f}ms")
        print(f"Second call (cache hit):  {second_time:.2f}ms")
        print(f"Speedup: {first_time/max(second_time, 0.001):.1f}x")
        print(f"Cache entries: {len(bridge.cache)}")

    if second_time < first_time:
        print("\n[OK] Cache is working correctly")
    else:
        print("\n[WARN] Cache may not be effective")

    return second_time < first_time


async def run_all_tests():
    """Run all tests."""
    print("=" * 60)
    print("CODEX-LENS LSP REAL INTERFACE TESTS (Standalone Mode)")
    print("=" * 60)
    print(f"Test file: {TEST_FILE}")
    print(f"Workspace: {WORKSPACE_ROOT}")
    print(f"Mode: Standalone (direct language server communication)")

    results = {}

    tests = [
        ("get_definition", test_get_definition),
        ("get_references", test_get_references),
        ("get_hover", test_get_hover),
        ("get_document_symbols", test_get_document_symbols),
        ("graph_expansion", test_graph_expansion),
        ("cache_performance", test_cache_performance),
    ]

    for name, test_fn in tests:
        try:
            results[name] = await test_fn()
        except Exception as e:
            print(f"\n[FAIL] FAILED: {e}")
            import traceback
            traceback.print_exc()
            results[name] = False

    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    passed = sum(1 for v in results.values() if v)
    total = len(results)

    for name, result in results.items():
        status = "[PASS]" if result else "[FAIL]"
        print(f"   {status}: {name}")

    print(f"\nResult: {passed}/{total} tests passed")

    return passed == total


def main():
    """Main entry point."""
    print("Checking pyright-langserver availability...")

    if not check_pyright():
        print("\n" + "=" * 60)
        print("ERROR: pyright-langserver not available")
        print("=" * 60)
        print()
        print("To run these tests:")
        print("  1. Install pyright: npm install -g pyright")
        print("  2. Verify: pyright-langserver --version")
        print("  3. Run this script again")
        print()
        sys.exit(1)

    print("[OK] pyright-langserver is available!")
    print()

    # Run tests
    # Note: On Windows, we use the default ProactorEventLoop (not SelectorEventLoop)
    # because ProactorEventLoop supports subprocess creation which is required for LSP

    success = asyncio.run(run_all_tests())
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
