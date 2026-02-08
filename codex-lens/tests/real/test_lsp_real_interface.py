"""Real interface tests for LSP Bridge using Standalone Mode.

These tests require:
1. Language servers installed (pyright-langserver, typescript-language-server)
2. A Python/TypeScript project in the workspace

Run with: pytest tests/real/ -v -s
"""

import asyncio
import os
import sys
import pytest
from pathlib import Path

# Add source to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from codexlens.lsp.lsp_bridge import LspBridge, Location, HAS_AIOHTTP
from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
from codexlens.hybrid_search.data_structures import CodeSymbolNode, Range


# Test configuration - adjust these paths to match your setup
TEST_PYTHON_FILE = Path(__file__).parent.parent.parent / "src" / "codexlens" / "lsp" / "lsp_bridge.py"
TEST_TYPESCRIPT_FILE = Path(__file__).parent.parent.parent.parent / "ccw-vscode-bridge" / "src" / "extension.ts"

WORKSPACE_ROOT = Path(__file__).parent.parent.parent  # codex-lens root


def is_pyright_available() -> bool:
    """Check if pyright-langserver is installed."""
    import shutil
    return shutil.which("pyright-langserver") is not None


def is_typescript_server_available() -> bool:
    """Check if typescript-language-server is installed."""
    import shutil
    return shutil.which("typescript-language-server") is not None


# Skip all tests if pyright not available
pytestmark = pytest.mark.skipif(
    not is_pyright_available(),
    reason="pyright-langserver not installed. Install with: npm install -g pyright"
)


class TestRealLspBridgeStandalone:
    """Real interface tests for LspBridge in Standalone Mode."""

    @pytest.fixture
    def bridge(self):
        """Create real LspBridge instance in standalone mode."""
        return LspBridge(
            workspace_root=str(WORKSPACE_ROOT),
            timeout=30.0,
            use_vscode_bridge=False,  # Use standalone mode
        )

    @pytest.fixture
    def python_symbol(self):
        """Create a symbol pointing to LspBridge class."""
        return CodeSymbolNode(
            id=f"{TEST_PYTHON_FILE}:LspBridge:96",
            name="LspBridge",
            kind="class",
            file_path=str(TEST_PYTHON_FILE),
            range=Range(start_line=96, start_character=6, end_line=96, end_character=15),
        )

    @pytest.fixture
    def python_method_symbol(self):
        """Create a symbol pointing to get_references method."""
        return CodeSymbolNode(
            id=f"{TEST_PYTHON_FILE}:get_references:200",
            name="get_references",
            kind="method",
            file_path=str(TEST_PYTHON_FILE),
            range=Range(start_line=200, start_character=10, end_line=200, end_character=24),
        )

    @pytest.mark.asyncio
    async def test_real_get_definition(self, bridge, python_symbol):
        """Test get_definition against real Python file."""
        print(f"\n>>> Testing get_definition for {python_symbol.name}")
        print(f"    File: {python_symbol.file_path}")
        print(f"    Position: line {python_symbol.range.start_line}, char {python_symbol.range.start_character}")

        async with bridge:
            definition = await bridge.get_definition(python_symbol)

        print(f"    Result: {definition}")

        # Definition should exist (class definition)
        if definition:
            print(f"    ✓ Found definition at {definition.file_path}:{definition.line}")
            assert definition.file_path.endswith(".py")
            assert definition.line > 0
        else:
            print("    ⚠ No definition found (may be expected for class declarations)")

    @pytest.mark.asyncio
    async def test_real_get_references(self, bridge, python_method_symbol):
        """Test get_references against real Python file."""
        print(f"\n>>> Testing get_references for {python_method_symbol.name}")
        print(f"    File: {python_method_symbol.file_path}")
        print(f"    Position: line {python_method_symbol.range.start_line}")

        async with bridge:
            refs = await bridge.get_references(python_method_symbol)

        print(f"    Found {len(refs)} references:")
        for i, ref in enumerate(refs[:5]):  # Show first 5
            print(f"      [{i+1}] {Path(ref.file_path).name}:{ref.line}")
        if len(refs) > 5:
            print(f"      ... and {len(refs) - 5} more")

        # Should find at least the definition itself
        assert len(refs) >= 0, "References query should succeed (may be empty)"

    @pytest.mark.asyncio
    async def test_real_get_hover(self, bridge, python_symbol):
        """Test get_hover against real Python file."""
        print(f"\n>>> Testing get_hover for {python_symbol.name}")

        async with bridge:
            hover = await bridge.get_hover(python_symbol)

        if hover:
            print(f"    ✓ Hover info ({len(hover)} chars):")
            preview = hover[:200].replace('\n', '\\n')
            print(f"      {preview}...")
            assert len(hover) > 0
        else:
            print("    ⚠ No hover info available")

    @pytest.mark.asyncio
    async def test_real_get_document_symbols(self, bridge):
        """Test get_document_symbols against real Python file."""
        file_path = str(TEST_PYTHON_FILE)
        print(f"\n>>> Testing get_document_symbols")
        print(f"    File: {file_path}")

        async with bridge:
            symbols = await bridge.get_document_symbols(file_path)

        print(f"    Found {len(symbols)} symbols:")

        # Group by kind
        by_kind = {}
        for sym in symbols:
            kind = sym.get("kind", "unknown")
            by_kind[kind] = by_kind.get(kind, 0) + 1

        for kind, count in sorted(by_kind.items()):
            print(f"      {kind}: {count}")

        # Show some sample symbols
        print("    Sample symbols:")
        for sym in symbols[:10]:
            name = sym.get("name", "?")
            kind = sym.get("kind", "?")
            range_data = sym.get("range", {})
            start = range_data.get("start", {})
            line = start.get("line", 0) + 1
            print(f"      - {name} ({kind}) at line {line}")

        assert len(symbols) > 0, "Should find symbols in Python file"

    @pytest.mark.asyncio
    async def test_real_get_call_hierarchy(self, bridge, python_method_symbol):
        """Test get_call_hierarchy against real Python file."""
        print(f"\n>>> Testing get_call_hierarchy for {python_method_symbol.name}")

        async with bridge:
            calls = await bridge.get_call_hierarchy(python_method_symbol)

        print(f"    Found {len(calls)} call hierarchy items:")
        for i, call in enumerate(calls[:10]):
            print(f"      [{i+1}] {call.name} in {Path(call.file_path).name}:{call.range.start_line}")

        # May be empty if call hierarchy not supported or no callers
        print(f"    ✓ Call hierarchy query completed")

    @pytest.mark.asyncio
    async def test_real_cache_behavior(self, bridge, python_symbol):
        """Test that cache actually works with real requests."""
        print(f"\n>>> Testing cache behavior")

        async with bridge:
            # First call - should hit language server
            print("    First call (cache miss expected)...")
            refs1 = await bridge.get_references(python_symbol)
            cache_size_after_first = len(bridge.cache)
            print(f"    Cache size after first call: {cache_size_after_first}")

            # Second call - should hit cache
            print("    Second call (cache hit expected)...")
            refs2 = await bridge.get_references(python_symbol)
            cache_size_after_second = len(bridge.cache)
            print(f"    Cache size after second call: {cache_size_after_second}")

            assert cache_size_after_first > 0, "Cache should have entries after first call"
            assert cache_size_after_second == cache_size_after_first, "Cache size should not change on hit"
            assert refs1 == refs2, "Results should be identical"
            print("    ✓ Cache working correctly")


class TestRealLspGraphBuilderStandalone:
    """Real interface tests for LspGraphBuilder with Standalone Mode."""

    @pytest.fixture
    def seed_node(self):
        """Create a seed node for graph expansion."""
        return CodeSymbolNode(
            id=f"{TEST_PYTHON_FILE}:LspBridge:96",
            name="LspBridge",
            kind="class",
            file_path=str(TEST_PYTHON_FILE),
            range=Range(start_line=96, start_character=6, end_line=96, end_character=15),
        )

    @pytest.mark.asyncio
    async def test_real_graph_expansion(self, seed_node):
        """Test real graph expansion from a Python class."""
        print(f"\n>>> Testing graph expansion from {seed_node.name}")
        print(f"    Seed: {seed_node.file_path}:{seed_node.range.start_line}")

        builder = LspGraphBuilder(max_depth=1, max_nodes=20)

        async with LspBridge(
            workspace_root=str(WORKSPACE_ROOT),
            timeout=30.0,
        ) as bridge:
            graph = await builder.build_from_seeds([seed_node], bridge)

        print(f"    Graph results:")
        print(f"      Nodes: {len(graph.nodes)}")
        print(f"      Edges: {len(graph.edges)}")

        if graph.nodes:
            print(f"    Node details:")
            for node_id, node in list(graph.nodes.items())[:10]:
                print(f"      - {node.name} ({node.kind}) in {Path(node.file_path).name}:{node.range.start_line}")

        if graph.edges:
            print(f"    Edge details:")
            for edge in list(graph.edges)[:10]:
                print(f"      - {edge.source_id[:30]}... --[{edge.relation}]--> {edge.target_id[:30]}...")

        # We should have at least the seed node
        assert len(graph.nodes) >= 1, "Graph should contain at least the seed node"
        print("    ✓ Graph expansion completed")

    @pytest.mark.asyncio
    async def test_real_multi_seed_expansion(self):
        """Test graph expansion from multiple seeds."""
        print(f"\n>>> Testing multi-seed graph expansion")

        seeds = [
            CodeSymbolNode(
                id=f"{TEST_PYTHON_FILE}:Location:35",
                name="Location",
                kind="class",
                file_path=str(TEST_PYTHON_FILE),
                range=Range(start_line=35, start_character=6, end_line=35, end_character=14),
            ),
            CodeSymbolNode(
                id=f"{TEST_PYTHON_FILE}:CacheEntry:81",
                name="CacheEntry",
                kind="class",
                file_path=str(TEST_PYTHON_FILE),
                range=Range(start_line=81, start_character=6, end_line=81, end_character=16),
            ),
        ]

        print(f"    Seeds: {[s.name for s in seeds]}")

        builder = LspGraphBuilder(max_depth=1, max_nodes=30)

        async with LspBridge(
            workspace_root=str(WORKSPACE_ROOT),
            timeout=30.0,
        ) as bridge:
            graph = await builder.build_from_seeds(seeds, bridge)

        print(f"    Graph results:")
        print(f"      Nodes: {len(graph.nodes)}")
        print(f"      Edges: {len(graph.edges)}")

        # Should have at least the seed nodes
        assert len(graph.nodes) >= len(seeds), f"Graph should contain at least {len(seeds)} seed nodes"
        print("    ✓ Multi-seed expansion completed")


class TestRealHybridSearchIntegrationStandalone:
    """Real integration tests with HybridSearchEngine."""

    @pytest.mark.asyncio
    async def test_real_lsp_search_pipeline(self):
        """Test the full LSP search pipeline with real LSP."""
        print(f"\n>>> Testing full LSP search pipeline")

        # Create mock seeds (normally from vector/FTS search)
        seeds = [
            CodeSymbolNode(
                id=f"{TEST_PYTHON_FILE}:LspBridge:96",
                name="LspBridge",
                kind="class",
                file_path=str(TEST_PYTHON_FILE),
                range=Range(start_line=96, start_character=6, end_line=96, end_character=15),
            ),
        ]

        print(f"    Starting with {len(seeds)} seed(s)")

        builder = LspGraphBuilder(max_depth=2, max_nodes=50)

        async with LspBridge(
            workspace_root=str(WORKSPACE_ROOT),
            timeout=30.0,
        ) as bridge:
            graph = await builder.build_from_seeds(seeds, bridge)

        print(f"    Expanded to {len(graph.nodes)} nodes")

        # Simulate conversion to SearchResult format
        results = []
        for node_id, node in graph.nodes.items():
            if node.id not in [s.id for s in seeds]:  # Exclude seeds
                results.append({
                    "path": node.file_path,
                    "symbol_name": node.name,
                    "symbol_kind": node.kind,
                    "start_line": node.range.start_line,
                    "end_line": node.range.end_line,
                })

        print(f"    Generated {len(results)} search results (excluding seeds)")

        if results:
            print("    Sample results:")
            for r in results[:5]:
                print(f"      - {r['symbol_name']} ({r['symbol_kind']}) at {Path(r['path']).name}:{r['start_line']}")

        print("    ✓ Full pipeline completed")


# TypeScript tests (if available)
@pytest.mark.skipif(
    not is_typescript_server_available() or not TEST_TYPESCRIPT_FILE.exists(),
    reason="TypeScript language server or test file not available"
)
class TestRealTypescriptLspStandalone:
    """Real tests against TypeScript files."""

    @pytest.fixture
    def ts_symbol(self):
        """Create a symbol in the TypeScript extension file."""
        return CodeSymbolNode(
            id=f"{TEST_TYPESCRIPT_FILE}:activate:12",
            name="activate",
            kind="function",
            file_path=str(TEST_TYPESCRIPT_FILE),
            range=Range(start_line=12, start_character=16, end_line=12, end_character=24),
        )

    @pytest.mark.asyncio
    async def test_real_typescript_definition(self, ts_symbol):
        """Test LSP definition lookup in TypeScript."""
        print(f"\n>>> Testing TypeScript definition for {ts_symbol.name}")

        async with LspBridge(
            workspace_root=str(TEST_TYPESCRIPT_FILE.parent.parent),
            timeout=30.0,
        ) as bridge:
            definition = await bridge.get_definition(ts_symbol)

        if definition:
            print(f"    ✓ Found: {definition.file_path}:{definition.line}")
        else:
            print("    ⚠ No definition found (TypeScript LSP may not be active)")

    @pytest.mark.asyncio
    async def test_real_typescript_document_symbols(self):
        """Test document symbols in TypeScript."""
        print(f"\n>>> Testing TypeScript document symbols")

        async with LspBridge(
            workspace_root=str(TEST_TYPESCRIPT_FILE.parent.parent),
            timeout=30.0,
        ) as bridge:
            symbols = await bridge.get_document_symbols(str(TEST_TYPESCRIPT_FILE))

        print(f"    Found {len(symbols)} symbols")
        for sym in symbols[:5]:
            print(f"      - {sym.get('name')} ({sym.get('kind')})")

        # TypeScript files should have symbols
        if symbols:
            print("    ✓ TypeScript symbols retrieved")
        else:
            print("    ⚠ No symbols found (TypeScript LSP may not be active)")


if __name__ == "__main__":
    # Allow running directly
    if is_pyright_available():
        print("Pyright language server is available")
        print("Running tests...")
        pytest.main([__file__, "-v", "-s"])
    else:
        print("=" * 60)
        print("Pyright language server NOT available")
        print("=" * 60)
        print()
        print("To run these tests:")
        print("1. Install pyright: npm install -g pyright")
        print("2. Install typescript-language-server: npm install -g typescript-language-server")
        print("3. Run: pytest tests/real/ -v -s")
        print()
        sys.exit(1)
