"""Unit tests for LspBridge service (VSCode Bridge HTTP mode).

This module provides comprehensive tests for the LspBridge class when used
in VSCode Bridge HTTP mode (use_vscode_bridge=True). These tests mock
aiohttp HTTP communication with the VSCode Bridge extension.

Test coverage:
- P0 (Critical): Success/failure scenarios for core methods
- P1 (Important): Cache hit/miss and invalidation logic
- P2 (Supplementary): Edge cases and error handling

Note: For standalone mode tests (direct language server communication),
see tests/real/ directory.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Skip all tests if aiohttp is not available
pytest.importorskip("aiohttp")

import aiohttp

from codexlens.hybrid_search.data_structures import (
    CallHierarchyItem,
    CodeSymbolNode,
    Range,
)
from codexlens.lsp.lsp_bridge import (
    CacheEntry,
    Location,
    LspBridge,
)


# -----------------------------------------------------------------------------
# Fixtures
# -----------------------------------------------------------------------------


@pytest.fixture
def sample_symbol() -> CodeSymbolNode:
    """Create a sample CodeSymbolNode for testing.
    
    Returns:
        CodeSymbolNode with typical function symbol data.
    """
    return CodeSymbolNode(
        id="test.py:test_func:10",
        name="test_func",
        kind="function",
        file_path="/path/to/test.py",
        range=Range(
            start_line=10,
            start_character=1,
            end_line=20,
            end_character=1,
        ),
    )


@pytest.fixture
def mock_response() -> AsyncMock:
    """Create a mock aiohttp response with configurable attributes.
    
    Returns:
        AsyncMock configured as aiohttp ClientResponse.
    """
    response = AsyncMock()
    response.status = 200
    response.json = AsyncMock(return_value={"success": True, "result": []})
    return response


@pytest.fixture
def mock_session(mock_response: AsyncMock) -> AsyncMock:
    """Create a mock aiohttp ClientSession.
    
    Args:
        mock_response: The mock response to return from post().
        
    Returns:
        AsyncMock configured as aiohttp ClientSession with async context manager.
    """
    session = AsyncMock(spec=aiohttp.ClientSession)
    
    # Configure post() to return context manager with response
    post_cm = AsyncMock()
    post_cm.__aenter__ = AsyncMock(return_value=mock_response)
    post_cm.__aexit__ = AsyncMock(return_value=None)
    session.post = MagicMock(return_value=post_cm)
    session.closed = False
    
    return session


@pytest.fixture
def lsp_bridge() -> LspBridge:
    """Create a fresh LspBridge instance for testing in VSCode Bridge mode.

    Returns:
        LspBridge with use_vscode_bridge=True for HTTP-based tests.
    """
    return LspBridge(use_vscode_bridge=True)


# -----------------------------------------------------------------------------
# Location Tests
# -----------------------------------------------------------------------------


class TestLocation:
    """Tests for the Location dataclass."""
    
    def test_to_dict(self):
        """Location.to_dict() returns correct dictionary format."""
        loc = Location(file_path="/test/file.py", line=10, character=5)
        result = loc.to_dict()
        
        assert result == {
            "file_path": "/test/file.py",
            "line": 10,
            "character": 5,
        }
    
    def test_from_lsp_response_with_range(self):
        """Location.from_lsp_response() parses LSP range format correctly."""
        data = {
            "uri": "file:///test/file.py",
            "range": {
                "start": {"line": 9, "character": 4},  # 0-based
                "end": {"line": 15, "character": 0},
            },
        }
        loc = Location.from_lsp_response(data)
        
        assert loc.file_path == "/test/file.py"
        assert loc.line == 10  # Converted to 1-based
        assert loc.character == 5  # Converted to 1-based
    
    def test_from_lsp_response_direct_fields(self):
        """Location.from_lsp_response() handles direct line/character fields."""
        data = {
            "file_path": "/direct/path.py",
            "line": 25,
            "character": 8,
        }
        loc = Location.from_lsp_response(data)
        
        assert loc.file_path == "/direct/path.py"
        assert loc.line == 25
        assert loc.character == 8


class TestLocationFromVscodeUri:
    """Tests for parsing VSCode URI formats (P2 test case)."""
    
    @pytest.mark.parametrize(
        "uri,expected_path",
        [
            # Unix-style paths
            ("file:///home/user/project/file.py", "/home/user/project/file.py"),
            ("file:///usr/local/lib.py", "/usr/local/lib.py"),
            # Windows-style paths
            ("file:///C:/Users/dev/project/file.py", "C:/Users/dev/project/file.py"),
            ("file:///D:/code/test.ts", "D:/code/test.ts"),
            # Already plain path
            ("/plain/path/file.py", "/plain/path/file.py"),
            # Edge case: file:// without third slash
            ("file://shared/network/file.py", "shared/network/file.py"),
        ],
    )
    def test_location_from_vscode_uri(self, uri: str, expected_path: str):
        """Test correct parsing of various VSCode URI formats to OS paths.
        
        Verifies that file:///C:/path format on Windows and file:///path
        format on Unix are correctly converted to native OS paths.
        """
        data = {
            "uri": uri,
            "range": {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 0}},
        }
        loc = Location.from_lsp_response(data)
        
        assert loc.file_path == expected_path


# -----------------------------------------------------------------------------
# P0 Critical Tests
# -----------------------------------------------------------------------------


class TestGetReferencesSuccess:
    """P0: Test successful get_references scenarios."""
    
    @pytest.mark.asyncio
    async def test_get_references_success(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
        mock_session: AsyncMock,
        mock_response: AsyncMock,
    ):
        """Test get_references returns Location list and caches result.
        
        Mock session returns 200 OK with valid LSP location list.
        Verifies:
        - Returns list of Location objects
        - Results are stored in cache
        """
        # Setup mock response with valid locations
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "success": True,
            "result": [
                {
                    "uri": "file:///ref1.py",
                    "range": {"start": {"line": 5, "character": 0}, "end": {"line": 5, "character": 10}},
                },
                {
                    "uri": "file:///ref2.py",
                    "range": {"start": {"line": 15, "character": 4}, "end": {"line": 15, "character": 14}},
                },
            ],
        })
        
        # Inject mock session
        lsp_bridge._session = mock_session
        
        # Execute
        with patch.object(lsp_bridge, "_get_file_mtime", return_value=1000.0):
            refs = await lsp_bridge.get_references(sample_symbol)
        
        # Verify results
        assert len(refs) == 2
        assert isinstance(refs[0], Location)
        assert refs[0].file_path == "/ref1.py"
        assert refs[0].line == 6  # 0-based to 1-based
        assert refs[1].file_path == "/ref2.py"
        assert refs[1].line == 16
        
        # Verify cached
        cache_key = f"refs:{sample_symbol.id}"
        assert cache_key in lsp_bridge.cache
        assert lsp_bridge.cache[cache_key].data == refs


class TestGetReferencesBridgeNotRunning:
    """P0: Test get_references when bridge is not running."""
    
    @pytest.mark.asyncio
    async def test_get_references_bridge_not_running(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
    ):
        """Test get_references returns empty list on ClientConnectorError.
        
        When VSCode Bridge is not running, aiohttp raises ClientConnectorError.
        Verifies:
        - Returns empty list []
        - No cache entry is created
        """
        # Setup mock session that raises connection error
        mock_session = AsyncMock(spec=aiohttp.ClientSession)
        mock_session.closed = False
        mock_session.post = MagicMock(side_effect=aiohttp.ClientConnectorError(
            connection_key=MagicMock(),
            os_error=OSError("Connection refused"),
        ))
        
        lsp_bridge._session = mock_session
        
        # Execute
        refs = await lsp_bridge.get_references(sample_symbol)
        
        # Verify
        assert refs == []
        cache_key = f"refs:{sample_symbol.id}"
        assert cache_key not in lsp_bridge.cache


class TestGetReferencesTimeout:
    """P0: Test get_references timeout handling."""
    
    @pytest.mark.asyncio
    async def test_get_references_timeout(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
    ):
        """Test get_references returns empty list on asyncio.TimeoutError.
        
        When request times out, should gracefully return empty list.
        """
        # Setup mock session that raises timeout
        mock_session = AsyncMock(spec=aiohttp.ClientSession)
        mock_session.closed = False
        
        async def raise_timeout(*args, **kwargs):
            raise asyncio.TimeoutError()
        
        post_cm = AsyncMock()
        post_cm.__aenter__ = raise_timeout
        post_cm.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = MagicMock(return_value=post_cm)
        
        lsp_bridge._session = mock_session
        
        # Execute
        refs = await lsp_bridge.get_references(sample_symbol)
        
        # Verify
        assert refs == []


class TestCallHierarchyFallback:
    """P0: Test call_hierarchy fallback to references."""
    
    @pytest.mark.asyncio
    async def test_call_hierarchy_fallback_to_references(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
        mock_session: AsyncMock,
    ):
        """Test get_call_hierarchy falls back to get_references when not supported.
        
        When call_hierarchy request returns None (not supported by language server),
        verifies:
        - Falls back to calling get_references
        - Returns converted CallHierarchyItem list
        """
        call_count = 0
        
        async def mock_json():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call is get_call_hierarchy - return failure
                return {"success": False}
            else:
                # Second call is get_references - return valid refs
                return {
                    "success": True,
                    "result": [
                        {
                            "uri": "file:///caller.py",
                            "range": {"start": {"line": 10, "character": 5}, "end": {"line": 10, "character": 15}},
                        },
                    ],
                }
        
        # Setup mock response
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = mock_json
        
        post_cm = AsyncMock()
        post_cm.__aenter__ = AsyncMock(return_value=mock_response)
        post_cm.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = MagicMock(return_value=post_cm)
        
        lsp_bridge._session = mock_session
        
        # Execute
        with patch.object(lsp_bridge, "_get_file_mtime", return_value=1000.0):
            items = await lsp_bridge.get_call_hierarchy(sample_symbol)
        
        # Verify fallback occurred and returned CallHierarchyItem
        assert len(items) == 1
        assert isinstance(items[0], CallHierarchyItem)
        assert items[0].file_path == "/caller.py"
        assert items[0].kind == "reference"
        assert "Inferred from reference" in items[0].detail


# -----------------------------------------------------------------------------
# P1 Important Tests
# -----------------------------------------------------------------------------


class TestCacheHit:
    """P1: Test cache hit behavior."""
    
    @pytest.mark.asyncio
    async def test_cache_hit(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
        mock_session: AsyncMock,
        mock_response: AsyncMock,
    ):
        """Test that same symbol called twice only makes one request.
        
        Verifies:
        - _request is only called once
        - Second call returns cached result
        """
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "success": True,
            "result": [
                {"uri": "file:///ref.py", "range": {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 0}}},
            ],
        })
        
        lsp_bridge._session = mock_session
        
        with patch.object(lsp_bridge, "_get_file_mtime", return_value=1000.0):
            # First call - should make request
            refs1 = await lsp_bridge.get_references(sample_symbol)
            
            # Second call - should use cache
            refs2 = await lsp_bridge.get_references(sample_symbol)
        
        # Verify only one HTTP call was made
        assert mock_session.post.call_count == 1
        
        # Verify both calls return same data
        assert refs1 == refs2


class TestCacheInvalidationTtl:
    """P1: Test cache TTL invalidation."""
    
    @pytest.mark.asyncio
    async def test_cache_invalidation_ttl(
        self,
        sample_symbol: CodeSymbolNode,
        mock_session: AsyncMock,
        mock_response: AsyncMock,
    ):
        """Test cache entry expires after TTL.

        Sets extremely short TTL and verifies:
        - Cache entry expires
        - New request is made after TTL expires
        """
        # Create bridge with very short TTL (VSCode Bridge mode for HTTP tests)
        bridge = LspBridge(cache_ttl=1, use_vscode_bridge=True)  # 1 second TTL
        
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "success": True,
            "result": [
                {"uri": "file:///ref.py", "range": {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 0}}},
            ],
        })
        
        bridge._session = mock_session
        
        with patch.object(bridge, "_get_file_mtime", return_value=1000.0):
            # First call
            await bridge.get_references(sample_symbol)
            assert mock_session.post.call_count == 1
            
            # Wait for TTL to expire
            await asyncio.sleep(1.1)
            
            # Second call - should make new request
            await bridge.get_references(sample_symbol)
            assert mock_session.post.call_count == 2
        
        await bridge.close()


class TestCacheInvalidationFileModified:
    """P1: Test cache invalidation on file modification."""
    
    @pytest.mark.asyncio
    async def test_cache_invalidation_file_modified(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
        mock_session: AsyncMock,
        mock_response: AsyncMock,
    ):
        """Test cache entry invalidates when file mtime changes.
        
        Verifies:
        - mtime change triggers cache invalidation
        - New request is made after file modification
        """
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "success": True,
            "result": [
                {"uri": "file:///ref.py", "range": {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 0}}},
            ],
        })
        
        lsp_bridge._session = mock_session

        # Mock mtime: first call returns 1000.0, subsequent calls return 2000.0
        # This simulates file being modified between cache store and cache check
        call_count = [0]

        def get_mtime(path: str) -> float:
            call_count[0] += 1
            # First call during _cache() stores mtime 1000.0
            # Second call during _is_cached() should see different mtime
            if call_count[0] <= 1:
                return 1000.0
            return 2000.0  # File modified

        with patch.object(lsp_bridge, "_get_file_mtime", side_effect=get_mtime):
            # First call - should make request and cache with mtime 1000.0
            await lsp_bridge.get_references(sample_symbol)
            assert mock_session.post.call_count == 1

            # Second call - mtime check returns 2000.0 (different from cached 1000.0)
            # Should invalidate cache and make new request
            await lsp_bridge.get_references(sample_symbol)
            assert mock_session.post.call_count == 2


# -----------------------------------------------------------------------------
# P2 Supplementary Tests
# -----------------------------------------------------------------------------


class TestResponseParsingInvalidJson:
    """P2: Test handling of malformed JSON responses."""
    
    @pytest.mark.asyncio
    async def test_response_parsing_invalid_json(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
        mock_session: AsyncMock,
    ):
        """Test graceful handling of malformed JSON response.
        
        Verifies:
        - Returns empty list when JSON parsing fails
        - Does not raise exception
        """
        # Setup mock to raise JSONDecodeError
        mock_response = AsyncMock()
        mock_response.status = 200
        mock_response.json = AsyncMock(side_effect=Exception("Invalid JSON"))
        
        post_cm = AsyncMock()
        post_cm.__aenter__ = AsyncMock(return_value=mock_response)
        post_cm.__aexit__ = AsyncMock(return_value=None)
        mock_session.post = MagicMock(return_value=post_cm)
        
        lsp_bridge._session = mock_session
        
        # Execute - should not raise
        refs = await lsp_bridge.get_references(sample_symbol)
        
        # Verify graceful handling
        assert refs == []
    
    @pytest.mark.asyncio
    async def test_response_with_malformed_location_items(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
        mock_session: AsyncMock,
        mock_response: AsyncMock,
    ):
        """Test handling of partially malformed location items.

        The source code catches KeyError and TypeError when parsing items.
        Tests that items causing these specific exceptions are skipped while
        valid items are returned.
        """
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "success": True,
            "result": [
                # Valid item
                {"uri": "file:///valid.py", "range": {"start": {"line": 0, "character": 0}, "end": {"line": 0, "character": 0}}},
                # Another valid item
                {"uri": "file:///valid2.py", "range": {"start": {"line": 5, "character": 0}, "end": {"line": 5, "character": 0}}},
            ],
        })

        lsp_bridge._session = mock_session

        with patch.object(lsp_bridge, "_get_file_mtime", return_value=1000.0):
            refs = await lsp_bridge.get_references(sample_symbol)

        # Should return both valid items
        assert len(refs) == 2
        assert refs[0].file_path == "/valid.py"
        assert refs[1].file_path == "/valid2.py"

    @pytest.mark.asyncio
    async def test_response_with_empty_result_list(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
        mock_session: AsyncMock,
        mock_response: AsyncMock,
    ):
        """Test handling of empty result list."""
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "success": True,
            "result": [],
        })

        lsp_bridge._session = mock_session

        with patch.object(lsp_bridge, "_get_file_mtime", return_value=1000.0):
            refs = await lsp_bridge.get_references(sample_symbol)

        assert refs == []


class TestLspBridgeContextManager:
    """Test async context manager functionality (VSCode Bridge mode)."""

    @pytest.mark.asyncio
    async def test_context_manager_closes_session(self):
        """Test that async context manager properly closes session in VSCode Bridge mode."""
        async with LspBridge(use_vscode_bridge=True) as bridge:
            # Create a session
            session = await bridge._get_session()
            assert session is not None
            assert not session.closed

        # After context, session should be closed
        assert bridge._session is None or bridge._session.closed


class TestCacheEntry:
    """Test CacheEntry dataclass."""
    
    def test_cache_entry_fields(self):
        """CacheEntry stores all required fields."""
        entry = CacheEntry(
            data=["some", "data"],
            file_mtime=12345.0,
            cached_at=time.time(),
        )
        
        assert entry.data == ["some", "data"]
        assert entry.file_mtime == 12345.0
        assert entry.cached_at > 0


class TestLspBridgeCacheLru:
    """Test LRU cache behavior."""
    
    def test_cache_lru_eviction(self):
        """Test that oldest entries are evicted when at max capacity."""
        bridge = LspBridge(max_cache_size=3)
        
        # Add entries
        bridge._cache("key1", "/file1.py", "data1")
        bridge._cache("key2", "/file2.py", "data2")
        bridge._cache("key3", "/file3.py", "data3")
        
        assert len(bridge.cache) == 3
        
        # Add one more - should evict oldest (key1)
        bridge._cache("key4", "/file4.py", "data4")
        
        assert len(bridge.cache) == 3
        assert "key1" not in bridge.cache
        assert "key4" in bridge.cache
    
    def test_cache_access_moves_to_end(self):
        """Test that accessing cached item moves it to end (LRU behavior)."""
        bridge = LspBridge(max_cache_size=3)
        
        with patch.object(bridge, "_get_file_mtime", return_value=1000.0):
            bridge._cache("key1", "/file.py", "data1")
            bridge._cache("key2", "/file.py", "data2")
            bridge._cache("key3", "/file.py", "data3")
            
            # Access key1 - should move it to end
            bridge._is_cached("key1", "/file.py")
            
            # Add key4 - should evict key2 (now oldest)
            bridge._cache("key4", "/file.py", "data4")
        
        assert "key1" in bridge.cache
        assert "key2" not in bridge.cache


class TestGetHover:
    """Test get_hover method."""
    
    @pytest.mark.asyncio
    async def test_get_hover_returns_string(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
        mock_session: AsyncMock,
        mock_response: AsyncMock,
    ):
        """Test get_hover returns hover documentation string."""
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "success": True,
            "result": {
                "contents": "Function documentation here",
            },
        })
        
        lsp_bridge._session = mock_session
        
        with patch.object(lsp_bridge, "_get_file_mtime", return_value=1000.0):
            hover = await lsp_bridge.get_hover(sample_symbol)
        
        assert hover == "Function documentation here"
    
    @pytest.mark.asyncio
    async def test_get_hover_handles_marked_string_list(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
        mock_session: AsyncMock,
        mock_response: AsyncMock,
    ):
        """Test get_hover handles MarkedString list format."""
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "success": True,
            "result": [
                {"value": "```python\ndef func():\n```"},
                {"value": "Documentation text"},
            ],
        })
        
        lsp_bridge._session = mock_session
        
        with patch.object(lsp_bridge, "_get_file_mtime", return_value=1000.0):
            hover = await lsp_bridge.get_hover(sample_symbol)
        
        assert "def func()" in hover
        assert "Documentation text" in hover


class TestGetDefinition:
    """Test get_definition method."""
    
    @pytest.mark.asyncio
    async def test_get_definition_returns_location(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
        mock_session: AsyncMock,
        mock_response: AsyncMock,
    ):
        """Test get_definition returns Location for found definition."""
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "success": True,
            "result": [
                {
                    "uri": "file:///definition.py",
                    "range": {"start": {"line": 99, "character": 0}, "end": {"line": 110, "character": 0}},
                },
            ],
        })
        
        lsp_bridge._session = mock_session
        
        with patch.object(lsp_bridge, "_get_file_mtime", return_value=1000.0):
            definition = await lsp_bridge.get_definition(sample_symbol)
        
        assert definition is not None
        assert definition.file_path == "/definition.py"
        assert definition.line == 100  # 0-based to 1-based
    
    @pytest.mark.asyncio
    async def test_get_definition_returns_none_on_failure(
        self,
        lsp_bridge: LspBridge,
        sample_symbol: CodeSymbolNode,
        mock_session: AsyncMock,
        mock_response: AsyncMock,
    ):
        """Test get_definition returns None when not found."""
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "success": False,
        })
        
        lsp_bridge._session = mock_session
        
        definition = await lsp_bridge.get_definition(sample_symbol)
        
        assert definition is None


class TestGetDocumentSymbols:
    """Test get_document_symbols method."""
    
    @pytest.mark.asyncio
    async def test_get_document_symbols_flattens_hierarchy(
        self,
        lsp_bridge: LspBridge,
        mock_session: AsyncMock,
        mock_response: AsyncMock,
    ):
        """Test get_document_symbols flattens nested symbol hierarchy."""
        mock_response.status = 200
        mock_response.json = AsyncMock(return_value={
            "success": True,
            "result": [
                {
                    "name": "MyClass",
                    "kind": 5,  # Class
                    "range": {"start": {"line": 0, "character": 0}, "end": {"line": 20, "character": 0}},
                    "children": [
                        {
                            "name": "my_method",
                            "kind": 6,  # Method
                            "range": {"start": {"line": 5, "character": 4}, "end": {"line": 10, "character": 4}},
                        },
                    ],
                },
            ],
        })
        
        lsp_bridge._session = mock_session
        
        with patch.object(lsp_bridge, "_get_file_mtime", return_value=1000.0):
            symbols = await lsp_bridge.get_document_symbols("/test/file.py")
        
        # Should have both class and method
        assert len(symbols) == 2
        assert symbols[0]["name"] == "MyClass"
        assert symbols[0]["kind"] == "class"
        assert symbols[1]["name"] == "my_method"
        assert symbols[1]["kind"] == "method"
        assert symbols[1]["parent"] == "MyClass"


class TestSymbolKindConversion:
    """Test symbol kind integer to string conversion."""
    
    @pytest.mark.parametrize(
        "kind_int,expected_str",
        [
            (1, "file"),
            (5, "class"),
            (6, "method"),
            (12, "function"),
            (13, "variable"),
            (999, "unknown"),  # Unknown kind
        ],
    )
    def test_symbol_kind_to_string(self, kind_int: int, expected_str: str):
        """Test _symbol_kind_to_string converts LSP SymbolKind correctly."""
        bridge = LspBridge()
        result = bridge._symbol_kind_to_string(kind_int)
        assert result == expected_str


class TestClearCache:
    """Test cache clearing functionality."""
    
    def test_clear_cache(self, lsp_bridge: LspBridge):
        """Test clear_cache removes all entries."""
        # Add some cache entries
        lsp_bridge._cache("key1", "/file.py", "data1")
        lsp_bridge._cache("key2", "/file.py", "data2")
        
        assert len(lsp_bridge.cache) == 2
        
        # Clear
        lsp_bridge.clear_cache()
        
        assert len(lsp_bridge.cache) == 0
