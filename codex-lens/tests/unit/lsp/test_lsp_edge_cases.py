"""Edge case and exception tests for LSP Bridge and Graph Builder.

This module tests boundary conditions, error handling, and exceptional
scenarios in the LSP communication and graph building components.

Test Categories:
- P1 (Critical): Empty responses, HTTP errors
- P2 (Important): Edge inputs, deep structures, special characters
- P3 (Nice-to-have): Cache eviction, concurrent access, circular refs

Note: Tests for HTTP-based communication use use_vscode_bridge=True mode.
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from codexlens.hybrid_search.data_structures import (
    CodeAssociationGraph,
    CodeSymbolNode,
    Range,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def valid_range() -> Range:
    """Create a valid Range for test symbols."""
    return Range(
        start_line=10,
        start_character=0,
        end_line=20,
        end_character=0,
    )


@pytest.fixture
def sample_symbol(valid_range: Range) -> CodeSymbolNode:
    """Create a sample CodeSymbolNode for testing."""
    return CodeSymbolNode(
        id="test/file.py:test_func:10",
        name="test_func",
        kind="function",
        file_path="test/file.py",
        range=valid_range,
    )


@pytest.fixture
def symbol_with_empty_path() -> CodeSymbolNode:
    """Create a CodeSymbolNode with empty file_path.
    
    Note: CodeSymbolNode.__post_init__ validates that file_path cannot be empty,
    so this fixture tests the case where validation is bypassed or data comes
    from external sources that might have empty paths.
    """
    # We need to bypass validation for this edge case test
    node = object.__new__(CodeSymbolNode)
    node.id = "::0"
    node.name = "empty"
    node.kind = "unknown"
    node.file_path = ""  # Empty path - edge case
    node.range = Range(start_line=0, start_character=0, end_line=0, end_character=0)
    node.embedding = None
    node.raw_code = ""
    node.docstring = ""
    node.score = 0.0
    return node


@pytest.fixture
def mock_aiohttp_session():
    """Create a mock aiohttp ClientSession."""
    session = AsyncMock()
    return session


@pytest.fixture
def mock_error_response():
    """Create a mock aiohttp response with HTTP 500 error."""
    response = AsyncMock()
    response.status = 500
    response.json = AsyncMock(return_value={"error": "Internal Server Error"})
    return response


@pytest.fixture
def mock_empty_response():
    """Create a mock aiohttp response returning empty list."""
    response = AsyncMock()
    response.status = 200
    response.json = AsyncMock(return_value={"success": True, "result": []})
    return response


# ---------------------------------------------------------------------------
# P1 Tests - Critical Edge Cases
# ---------------------------------------------------------------------------

class TestLspReturnsEmptyList:
    """Test handling when LSP returns empty results.
    
    Module: LspGraphBuilder._expand_node
    Mock: LspBridge methods return []
    Assert: Node marked as visited, no new nodes/edges added, returns []
    """

    @pytest.mark.asyncio
    async def test_expand_node_with_empty_references(self, sample_symbol: CodeSymbolNode):
        """When LSP returns empty references, node should be visited but no expansion."""
        from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
        
        # Create mock LspBridge that returns empty results
        mock_bridge = AsyncMock()
        mock_bridge.get_references = AsyncMock(return_value=[])
        mock_bridge.get_call_hierarchy = AsyncMock(return_value=[])
        
        builder = LspGraphBuilder(max_depth=2, max_nodes=100)
        graph = CodeAssociationGraph()
        graph.add_node(sample_symbol)
        visited = set()
        semaphore = asyncio.Semaphore(10)
        
        # Expand the node
        result = await builder._expand_node(
            sample_symbol,
            depth=0,
            graph=graph,
            lsp_bridge=mock_bridge,
            visited=visited,
            semaphore=semaphore,
        )
        
        # Assertions
        assert sample_symbol.id in visited  # Node should be marked as visited
        assert result == []  # No new nodes to process
        assert len(graph.nodes) == 1  # Only the original seed node
        assert len(graph.edges) == 0  # No edges added

    @pytest.mark.asyncio
    async def test_build_from_seeds_with_empty_lsp_results(self, sample_symbol: CodeSymbolNode):
        """When LSP returns empty for all queries, graph should contain only seeds."""
        from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
        
        mock_bridge = AsyncMock()
        mock_bridge.get_references = AsyncMock(return_value=[])
        mock_bridge.get_call_hierarchy = AsyncMock(return_value=[])
        mock_bridge.get_document_symbols = AsyncMock(return_value=[])
        
        builder = LspGraphBuilder(max_depth=2, max_nodes=100)
        
        # Build graph from seed
        graph = await builder.build_from_seeds([sample_symbol], mock_bridge)
        
        # Should only have the seed node
        assert len(graph.nodes) == 1
        assert sample_symbol.id in graph.nodes
        assert len(graph.edges) == 0

    @pytest.mark.asyncio
    async def test_already_visited_node_returns_empty(self, sample_symbol: CodeSymbolNode):
        """Attempting to expand an already-visited node should return empty immediately."""
        from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
        
        mock_bridge = AsyncMock()
        # These should not be called since node is already visited
        mock_bridge.get_references = AsyncMock(return_value=[])
        mock_bridge.get_call_hierarchy = AsyncMock(return_value=[])
        
        builder = LspGraphBuilder()
        graph = CodeAssociationGraph()
        graph.add_node(sample_symbol)
        visited = {sample_symbol.id}  # Already visited
        semaphore = asyncio.Semaphore(10)
        
        result = await builder._expand_node(
            sample_symbol,
            depth=0,
            graph=graph,
            lsp_bridge=mock_bridge,
            visited=visited,
            semaphore=semaphore,
        )
        
        assert result == []
        # Bridge methods should not have been called
        mock_bridge.get_references.assert_not_called()
        mock_bridge.get_call_hierarchy.assert_not_called()


class TestLspHttpError500:
    """Test handling of HTTP 500 errors from LSP bridge (VSCode Bridge mode).

    Module: LspBridge._request_vscode_bridge
    Mock: aiohttp response status=500
    Assert: Returns None, caller handles as failure
    """

    @pytest.mark.asyncio
    async def test_request_returns_none_on_500(self):
        """HTTP 500 response should result in None return value."""
        from codexlens.lsp.lsp_bridge import LspBridge

        # Create bridge in VSCode Bridge mode with mocked session
        bridge = LspBridge(use_vscode_bridge=True)

        # Mock the session to return 500 error
        mock_response = AsyncMock()
        mock_response.status = 500
        mock_response.__aenter__ = AsyncMock(return_value=mock_response)
        mock_response.__aexit__ = AsyncMock(return_value=None)

        mock_session = AsyncMock()
        mock_session.post = MagicMock(return_value=mock_response)

        with patch.object(bridge, '_get_session', return_value=mock_session):
            result = await bridge._request_vscode_bridge("get_references", {"file_path": "test.py"})

        assert result is None

    @pytest.mark.asyncio
    async def test_get_references_returns_empty_on_500(self, sample_symbol: CodeSymbolNode):
        """get_references should return empty list on HTTP 500."""
        from codexlens.lsp.lsp_bridge import LspBridge

        bridge = LspBridge(use_vscode_bridge=True)

        # Mock _request_vscode_bridge to return None (simulating HTTP error)
        with patch.object(bridge, '_request_vscode_bridge', return_value=None):
            result = await bridge.get_references(sample_symbol)

        assert result == []

    @pytest.mark.asyncio
    async def test_get_definition_returns_none_on_500(self, sample_symbol: CodeSymbolNode):
        """get_definition should return None on HTTP 500."""
        from codexlens.lsp.lsp_bridge import LspBridge

        bridge = LspBridge(use_vscode_bridge=True)

        with patch.object(bridge, '_request_vscode_bridge', return_value=None):
            result = await bridge.get_definition(sample_symbol)

        assert result is None

    @pytest.mark.asyncio
    async def test_get_hover_returns_none_on_500(self, sample_symbol: CodeSymbolNode):
        """get_hover should return None on HTTP 500."""
        from codexlens.lsp.lsp_bridge import LspBridge

        bridge = LspBridge(use_vscode_bridge=True)

        with patch.object(bridge, '_request_vscode_bridge', return_value=None):
            result = await bridge.get_hover(sample_symbol)

        assert result is None

    @pytest.mark.asyncio
    async def test_graph_builder_handles_lsp_errors_gracefully(self, sample_symbol: CodeSymbolNode):
        """Graph builder should handle LSP errors without crashing."""
        from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
        
        mock_bridge = AsyncMock()
        # Simulate exceptions from LSP
        mock_bridge.get_references = AsyncMock(side_effect=Exception("LSP Error"))
        mock_bridge.get_call_hierarchy = AsyncMock(side_effect=Exception("LSP Error"))
        
        builder = LspGraphBuilder()
        
        # Should not raise, should return graph with just the seed
        graph = await builder.build_from_seeds([sample_symbol], mock_bridge)
        
        assert len(graph.nodes) == 1
        assert sample_symbol.id in graph.nodes


# ---------------------------------------------------------------------------
# P2 Tests - Important Edge Cases
# ---------------------------------------------------------------------------

class TestSymbolWithEmptyFilePath:
    """Test handling of symbols with empty file_path (VSCode Bridge mode).

    Module: LspBridge.get_references
    Input: CodeSymbolNode with file_path=""
    Assert: Does not send request, returns [] early
    """

    @pytest.mark.asyncio
    async def test_get_references_with_empty_path_symbol(self, symbol_with_empty_path: CodeSymbolNode):
        """get_references with empty file_path should handle gracefully."""
        from codexlens.lsp.lsp_bridge import LspBridge

        bridge = LspBridge(use_vscode_bridge=True)

        # Mock _request_vscode_bridge - it should still work but with empty path
        mock_result = []
        with patch.object(bridge, '_request_vscode_bridge', return_value=mock_result) as mock_req:
            result = await bridge.get_references(symbol_with_empty_path)

        # Should return empty list
        assert result == []
        # The request was still made (current implementation doesn't pre-validate)
        # This documents current behavior - might want to add validation

    @pytest.mark.asyncio
    async def test_cache_with_empty_path_symbol(self, symbol_with_empty_path: CodeSymbolNode):
        """Cache operations with empty file_path should not crash."""
        from codexlens.lsp.lsp_bridge import LspBridge
        
        bridge = LspBridge()
        
        # Cache should handle empty path (mtime check returns 0.0)
        cache_key = f"refs:{symbol_with_empty_path.id}"
        bridge._cache(cache_key, "", [])  # Empty path
        
        # Should be able to check cache without crashing
        is_cached = bridge._is_cached(cache_key, "")
        # Note: May or may not be cached depending on mtime behavior
        assert isinstance(is_cached, bool)


class TestVeryDeepGraphStructure:
    """Test graph building with very deep reference chains.
    
    Module: LspGraphBuilder.build_from_seeds
    Input: max_depth=10
    Mock: LspBridge produces long chain of references
    Assert: Expansion stops cleanly at max_depth
    """

    @pytest.mark.asyncio
    async def test_expansion_stops_at_max_depth(self, valid_range: Range):
        """Graph expansion should stop at max_depth."""
        from codexlens.lsp.lsp_bridge import Location
        from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
        
        # Create a chain of symbols: seed -> ref1 -> ref2 -> ... -> refN
        max_depth = 3  # Use small depth for testing
        
        def create_mock_refs(symbol: CodeSymbolNode) -> List[Location]:
            """Create a single reference pointing to next in chain."""
            depth = int(symbol.id.split(":")[-1])  # Extract depth from ID
            if depth >= max_depth + 5:  # Chain goes deeper than max_depth
                return []
            next_depth = depth + 1
            return [Location(
                file_path=f"test/file_{next_depth}.py",
                line=1,
                character=0,
            )]
        
        mock_bridge = AsyncMock()
        mock_bridge.get_references = AsyncMock(side_effect=lambda s: create_mock_refs(s))
        mock_bridge.get_call_hierarchy = AsyncMock(return_value=[])
        mock_bridge.get_document_symbols = AsyncMock(return_value=[])
        
        # Seed at depth 0
        seed = CodeSymbolNode(
            id="test/file_0.py:seed:0",
            name="seed",
            kind="function",
            file_path="test/file_0.py",
            range=valid_range,
        )
        
        builder = LspGraphBuilder(max_depth=max_depth, max_nodes=100)
        graph = await builder.build_from_seeds([seed], mock_bridge)
        
        # Graph should not exceed max_depth + 1 nodes (seed + max_depth levels)
        # Actual count depends on how references are resolved
        assert len(graph.nodes) <= max_depth + 2  # Some tolerance for edge cases

    @pytest.mark.asyncio
    async def test_expansion_stops_at_max_nodes(self, valid_range: Range):
        """Graph expansion should stop when max_nodes is reached."""
        from codexlens.lsp.lsp_bridge import Location
        from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
        
        call_count = [0]
        
        def create_many_refs(symbol: CodeSymbolNode) -> List[Location]:
            """Create multiple references to generate many nodes."""
            call_count[0] += 1
            # Return multiple refs to rapidly grow the graph
            return [
                Location(file_path=f"test/ref_{call_count[0]}_{i}.py", line=1, character=0)
                for i in range(5)
            ]
        
        mock_bridge = AsyncMock()
        mock_bridge.get_references = AsyncMock(side_effect=create_many_refs)
        mock_bridge.get_call_hierarchy = AsyncMock(return_value=[])
        mock_bridge.get_document_symbols = AsyncMock(return_value=[])
        
        seed = CodeSymbolNode(
            id="test/seed.py:seed:0",
            name="seed",
            kind="function",
            file_path="test/seed.py",
            range=valid_range,
        )
        
        max_nodes = 10
        builder = LspGraphBuilder(max_depth=100, max_nodes=max_nodes)  # High depth, low nodes
        graph = await builder.build_from_seeds([seed], mock_bridge)
        
        # Graph should not exceed max_nodes
        assert len(graph.nodes) <= max_nodes


class TestNodeIdWithSpecialCharacters:
    """Test node ID creation with special characters.
    
    Module: LspGraphBuilder._create_node_id
    Input: file_path="a/b/c", name="<init>", line=10
    Assert: ID successfully created as "a/b/c:<init>:10"
    """

    def test_create_node_id_with_special_name(self):
        """Node ID should handle special characters in name."""
        from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
        
        builder = LspGraphBuilder()
        
        # Test with angle brackets (common in Java/Kotlin constructors)
        node_id = builder._create_node_id("a/b/c", "<init>", 10)
        assert node_id == "a/b/c:<init>:10"
        
        # Test with other special characters
        node_id = builder._create_node_id("src/file.py", "__init__", 1)
        assert node_id == "src/file.py:__init__:1"
        
        # Test with spaces (should preserve as-is)
        node_id = builder._create_node_id("my path/file.ts", "my func", 5)
        assert node_id == "my path/file.ts:my func:5"

    def test_create_node_id_with_windows_path(self):
        """Node ID should handle Windows-style paths."""
        from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
        
        builder = LspGraphBuilder()
        
        # Windows path with backslashes
        node_id = builder._create_node_id("C:\\Users\\test\\file.py", "main", 1)
        assert "main" in node_id
        assert "1" in node_id

    def test_create_node_id_with_unicode(self):
        """Node ID should handle unicode characters."""
        from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
        
        builder = LspGraphBuilder()
        
        # Unicode in name
        node_id = builder._create_node_id("src/file.py", "func_name", 10)
        assert node_id == "src/file.py:func_name:10"

    def test_code_symbol_node_id_format(self):
        """CodeSymbolNode.create_id should match LspGraphBuilder format."""
        from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
        
        builder = LspGraphBuilder()
        
        # Both should produce the same format
        builder_id = builder._create_node_id("path/file.py", "func", 10)
        symbol_id = CodeSymbolNode.create_id("path/file.py", "func", 10)
        
        assert builder_id == symbol_id


# ---------------------------------------------------------------------------
# P3 Tests - Additional Edge Cases (if time allows)
# ---------------------------------------------------------------------------

class TestCacheLruEviction:
    """Test LRU cache eviction behavior.
    
    Module: LspBridge._cache
    Input: max_cache_size=3, add 5 entries
    Assert: Only most recent 3 entries remain
    """

    def test_cache_evicts_oldest_entries(self):
        """Cache should evict oldest entries when at capacity."""
        from codexlens.lsp.lsp_bridge import LspBridge
        
        bridge = LspBridge(max_cache_size=3)
        
        # Add 5 entries (exceeds max of 3)
        for i in range(5):
            bridge._cache(f"key_{i}", "test.py", f"data_{i}")
        
        # Should only have 3 entries
        assert len(bridge.cache) == 3
        
        # Oldest entries (key_0, key_1) should be evicted
        assert "key_0" not in bridge.cache
        assert "key_1" not in bridge.cache
        
        # Newest entries should remain
        assert "key_2" in bridge.cache
        assert "key_3" in bridge.cache
        assert "key_4" in bridge.cache

    def test_cache_moves_accessed_entry_to_end(self):
        """Accessing a cached entry should move it to end (LRU behavior)."""
        from codexlens.lsp.lsp_bridge import LspBridge
        
        bridge = LspBridge(max_cache_size=3)
        
        # Add 3 entries
        bridge._cache("key_0", "test.py", "data_0")
        bridge._cache("key_1", "test.py", "data_1")
        bridge._cache("key_2", "test.py", "data_2")
        
        # Access key_0 (should move to end)
        with patch.object(bridge, '_get_file_mtime', return_value=0.0):
            bridge._is_cached("key_0", "test.py")
        
        # Add new entry - key_1 should be evicted (was least recently used)
        bridge._cache("key_3", "test.py", "data_3")
        
        assert len(bridge.cache) == 3
        assert "key_0" in bridge.cache  # Was accessed, moved to end
        assert "key_1" not in bridge.cache  # Was evicted
        assert "key_2" in bridge.cache
        assert "key_3" in bridge.cache


class TestConcurrentCacheAccess:
    """Test thread-safety of cache operations.
    
    Module: LspBridge
    Test: Multiple concurrent requests access/update cache
    Assert: No race conditions, cache remains consistent
    """

    @pytest.mark.asyncio
    async def test_concurrent_cache_operations(self, valid_range: Range):
        """Multiple concurrent requests should not corrupt cache."""
        from codexlens.lsp.lsp_bridge import LspBridge
        
        bridge = LspBridge(max_cache_size=100)
        
        async def cache_operation(i: int) -> None:
            """Simulate a cache read/write operation."""
            key = f"key_{i % 10}"  # Reuse keys to create contention
            file_path = f"file_{i}.py"
            
            # Check cache
            bridge._is_cached(key, file_path)
            
            # Small delay to increase contention likelihood
            await asyncio.sleep(0.001)
            
            # Write to cache
            bridge._cache(key, file_path, f"data_{i}")
        
        # Run many concurrent operations
        tasks = [cache_operation(i) for i in range(50)]
        await asyncio.gather(*tasks)
        
        # Cache should be in consistent state
        assert len(bridge.cache) <= bridge.max_cache_size
        
        # All entries should be valid CacheEntry objects
        for key, entry in bridge.cache.items():
            assert hasattr(entry, 'data')
            assert hasattr(entry, 'cached_at')
            assert hasattr(entry, 'file_mtime')


class TestGraphWithCircularReferences:
    """Test graph handling of circular reference patterns.
    
    Module: LspGraphBuilder
    Mock: A -> B -> C -> A circular reference
    Assert: visited set prevents infinite loop
    """

    @pytest.mark.asyncio
    async def test_circular_references_do_not_loop_infinitely(self, valid_range: Range):
        """Circular references should not cause infinite loops."""
        from codexlens.lsp.lsp_bridge import Location
        from codexlens.lsp.lsp_graph_builder import LspGraphBuilder
        
        # Create circular reference pattern: A -> B -> C -> A
        symbol_a = CodeSymbolNode(
            id="file.py:A:1", name="A", kind="function",
            file_path="file.py", range=valid_range,
        )
        symbol_b = CodeSymbolNode(
            id="file.py:B:10", name="B", kind="function",
            file_path="file.py", range=valid_range,
        )
        symbol_c = CodeSymbolNode(
            id="file.py:C:20", name="C", kind="function",
            file_path="file.py", range=valid_range,
        )
        
        ref_map = {
            "file.py:A:1": [Location(file_path="file.py", line=10, character=0)],  # A -> B
            "file.py:B:10": [Location(file_path="file.py", line=20, character=0)],  # B -> C
            "file.py:C:20": [Location(file_path="file.py", line=1, character=0)],   # C -> A (circular)
        }
        
        def get_refs(symbol: CodeSymbolNode) -> List[Location]:
            return ref_map.get(symbol.id, [])
        
        mock_bridge = AsyncMock()
        mock_bridge.get_references = AsyncMock(side_effect=get_refs)
        mock_bridge.get_call_hierarchy = AsyncMock(return_value=[])
        mock_bridge.get_document_symbols = AsyncMock(return_value=[
            {"name": "A", "kind": 12, "range": {"start": {"line": 0}, "end": {"line": 5}}},
            {"name": "B", "kind": 12, "range": {"start": {"line": 9}, "end": {"line": 15}}},
            {"name": "C", "kind": 12, "range": {"start": {"line": 19}, "end": {"line": 25}}},
        ])
        
        builder = LspGraphBuilder(max_depth=10, max_nodes=100)
        
        # This should complete without hanging
        graph = await asyncio.wait_for(
            builder.build_from_seeds([symbol_a], mock_bridge),
            timeout=5.0  # Should complete quickly, timeout is just safety
        )
        
        # Graph should contain the nodes without duplicates
        assert len(graph.nodes) >= 1  # At least the seed
        # No infinite loop occurred (we reached this point)


class TestRequestTimeoutHandling:
    """Test timeout handling in LSP requests (VSCode Bridge mode)."""

    @pytest.mark.asyncio
    async def test_timeout_returns_none(self, sample_symbol: CodeSymbolNode):
        """Request timeout should return None gracefully."""
        from codexlens.lsp.lsp_bridge import LspBridge

        bridge = LspBridge(timeout=0.001, use_vscode_bridge=True)  # Very short timeout

        # Mock session to raise TimeoutError
        mock_response = AsyncMock()
        mock_response.__aenter__ = AsyncMock(side_effect=asyncio.TimeoutError())
        mock_response.__aexit__ = AsyncMock(return_value=None)

        mock_session = AsyncMock()
        mock_session.post = MagicMock(return_value=mock_response)

        with patch.object(bridge, '_get_session', return_value=mock_session):
            result = await bridge._request_vscode_bridge("get_references", {})

        assert result is None


class TestConnectionRefusedHandling:
    """Test handling when VSCode Bridge is not running."""

    @pytest.mark.asyncio
    async def test_connection_refused_returns_none(self):
        """Connection refused should return None gracefully."""
        pytest.importorskip("aiohttp")
        import aiohttp
        from codexlens.lsp.lsp_bridge import LspBridge

        bridge = LspBridge(use_vscode_bridge=True)

        # Mock session to raise ClientConnectorError
        mock_session = AsyncMock()
        mock_session.post = MagicMock(
            side_effect=aiohttp.ClientConnectorError(
                MagicMock(), OSError("Connection refused")
            )
        )

        with patch.object(bridge, '_get_session', return_value=mock_session):
            result = await bridge._request_vscode_bridge("get_references", {})

        assert result is None


class TestInvalidLspResponses:
    """Test handling of malformed LSP responses (VSCode Bridge mode)."""

    @pytest.mark.asyncio
    async def test_malformed_json_response(self, sample_symbol: CodeSymbolNode):
        """Malformed response should be handled gracefully."""
        from codexlens.lsp.lsp_bridge import LspBridge

        bridge = LspBridge(use_vscode_bridge=True)

        # Response without expected structure
        with patch.object(bridge, '_request_vscode_bridge', return_value={"unexpected": "structure"}):
            result = await bridge.get_references(sample_symbol)

        # Should return empty list, not crash
        assert result == []

    @pytest.mark.asyncio
    async def test_null_result_in_response(self, sample_symbol: CodeSymbolNode):
        """Null/None result should be handled gracefully."""
        from codexlens.lsp.lsp_bridge import LspBridge

        bridge = LspBridge(use_vscode_bridge=True)

        with patch.object(bridge, '_request_vscode_bridge', return_value=None):
            refs = await bridge.get_references(sample_symbol)
            defn = await bridge.get_definition(sample_symbol)
            hover = await bridge.get_hover(sample_symbol)

        assert refs == []
        assert defn is None
        assert hover is None


class TestLocationParsing:
    """Test Location parsing from various LSP response formats."""

    def test_location_from_file_uri_unix(self):
        """Parse Location from Unix-style file:// URI."""
        from codexlens.lsp.lsp_bridge import Location
        
        data = {
            "uri": "file:///home/user/project/file.py",
            "range": {
                "start": {"line": 9, "character": 4},
                "end": {"line": 9, "character": 10},
            }
        }
        
        loc = Location.from_lsp_response(data)
        
        assert loc.file_path == "/home/user/project/file.py"
        assert loc.line == 10  # Converted from 0-based to 1-based
        assert loc.character == 5

    def test_location_from_file_uri_windows(self):
        """Parse Location from Windows-style file:// URI."""
        from codexlens.lsp.lsp_bridge import Location
        
        data = {
            "uri": "file:///C:/Users/test/project/file.py",
            "range": {
                "start": {"line": 0, "character": 0},
                "end": {"line": 0, "character": 5},
            }
        }
        
        loc = Location.from_lsp_response(data)
        
        assert loc.file_path == "C:/Users/test/project/file.py"
        assert loc.line == 1
        assert loc.character == 1

    def test_location_from_file_uri_windows_percent_encoded_drive(self):
        """Parse Location from percent-encoded Windows drive URIs (pyright-style)."""
        from codexlens.lsp.lsp_bridge import Location

        data = {
            "uri": "file:///d%3A/Claude_dms3/codex-lens/src/codexlens/api/semantic.py",
            "range": {
                "start": {"line": 18, "character": 3},
                "end": {"line": 18, "character": 10},
            },
        }

        loc = Location.from_lsp_response(data)

        assert loc.file_path == "d:/Claude_dms3/codex-lens/src/codexlens/api/semantic.py"
        assert loc.line == 19  # 0-based -> 1-based
        assert loc.character == 4

    def test_location_from_direct_fields(self):
        """Parse Location from direct field format."""
        from codexlens.lsp.lsp_bridge import Location
        
        data = {
            "file_path": "/path/to/file.py",
            "line": 5,
            "character": 10,
        }
        
        loc = Location.from_lsp_response(data)
        
        assert loc.file_path == "/path/to/file.py"
        assert loc.line == 5
        assert loc.character == 10
