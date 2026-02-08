"""LspBridge service for real-time LSP communication with caching.

This module provides a bridge to communicate with language servers either via:
1. Standalone LSP Manager (direct subprocess communication - default)
2. VSCode Bridge extension (HTTP-based, legacy mode)

Features:
- Direct communication with language servers (no VSCode dependency)
- Cache with TTL and file modification time invalidation
- Graceful error handling with empty results on failure
- Support for definition, references, hover, and call hierarchy
"""

from __future__ import annotations

import asyncio
import os
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, TYPE_CHECKING
from urllib.parse import unquote

if TYPE_CHECKING:
    from codexlens.lsp.standalone_manager import StandaloneLspManager

# Check for optional dependencies
try:
    import aiohttp
    HAS_AIOHTTP = True
except ImportError:
    HAS_AIOHTTP = False

from codexlens.hybrid_search.data_structures import (
    CallHierarchyItem,
    CodeSymbolNode,
    Range,
)


@dataclass
class Location:
    """A location in a source file (LSP response format)."""
    
    file_path: str
    line: int
    character: int
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary format."""
        return {
            "file_path": self.file_path,
            "line": self.line,
            "character": self.character,
        }
    
    @classmethod
    def from_lsp_response(cls, data: Dict[str, Any]) -> "Location":
        """Create Location from LSP response format.
        
        Handles both direct format and VSCode URI format.
        """
        # Handle VSCode URI format (file:///path/to/file)
        uri = data.get("uri", data.get("file_path", ""))
        if uri.startswith("file://"):
            # Strip scheme and decode percent-encoding (e.g. file:///d%3A/...).
            # Keep behavior compatible with both Windows and Unix paths.
            raw = unquote(uri[7:])  # keep leading slash for Unix paths
            # Windows: file:///C:/... or file:///c%3A/... -> C:/...
            if raw.startswith("/") and len(raw) > 2 and raw[2] == ":":
                raw = raw[1:]
            file_path = raw
        else:
            file_path = uri
        
        # Get position from range or direct fields
        if "range" in data:
            range_data = data["range"]
            start = range_data.get("start", {})
            line = start.get("line", 0) + 1  # LSP is 0-based, convert to 1-based
            character = start.get("character", 0) + 1
        else:
            line = data.get("line", 1)
            character = data.get("character", 1)
        
        return cls(file_path=file_path, line=line, character=character)


@dataclass
class CacheEntry:
    """A cached LSP response with expiration metadata.
    
    Attributes:
        data: The cached response data
        file_mtime: File modification time when cached (for invalidation)
        cached_at: Unix timestamp when entry was cached
    """
    
    data: Any
    file_mtime: float
    cached_at: float


class LspBridge:
    """Bridge for real-time LSP communication with language servers.
    
    By default, uses StandaloneLspManager to directly spawn and communicate
    with language servers via JSON-RPC over stdio. No VSCode dependency required.
    
    For legacy mode, can use VSCode Bridge HTTP server (set use_vscode_bridge=True).
    
    Features:
    - Direct language server communication (default)
    - Response caching with TTL and file modification invalidation
    - Timeout handling
    - Graceful error handling returning empty results
    
    Example:
        # Default: standalone mode (no VSCode needed)
        async with LspBridge() as bridge:
            refs = await bridge.get_references(symbol)
            definition = await bridge.get_definition(symbol)
        
        # Legacy: VSCode Bridge mode
        async with LspBridge(use_vscode_bridge=True) as bridge:
            refs = await bridge.get_references(symbol)
    """
    
    DEFAULT_BRIDGE_URL = "http://127.0.0.1:3457"
    DEFAULT_TIMEOUT = 30.0  # seconds (increased for standalone mode)
    DEFAULT_CACHE_TTL = 300  # 5 minutes
    DEFAULT_MAX_CACHE_SIZE = 1000  # Maximum cache entries

    def __init__(
        self,
        bridge_url: str = DEFAULT_BRIDGE_URL,
        timeout: float = DEFAULT_TIMEOUT,
        cache_ttl: int = DEFAULT_CACHE_TTL,
        max_cache_size: int = DEFAULT_MAX_CACHE_SIZE,
        use_vscode_bridge: bool = False,
        workspace_root: Optional[str] = None,
        config_file: Optional[str] = None,
    ):
        """Initialize LspBridge.

        Args:
            bridge_url: URL of the VSCode Bridge HTTP server (legacy mode only)
            timeout: Request timeout in seconds
            cache_ttl: Cache time-to-live in seconds
            max_cache_size: Maximum number of cache entries (LRU eviction)
            use_vscode_bridge: If True, use VSCode Bridge HTTP mode (requires aiohttp)
            workspace_root: Root directory for standalone LSP manager
            config_file: Path to lsp-servers.json configuration file
        """
        self.bridge_url = bridge_url
        self.timeout = timeout
        self.cache_ttl = cache_ttl
        self.max_cache_size = max_cache_size
        self.use_vscode_bridge = use_vscode_bridge
        self.workspace_root = workspace_root
        self.config_file = config_file
        
        self.cache: OrderedDict[str, CacheEntry] = OrderedDict()
        
        # VSCode Bridge mode (legacy)
        self._session: Optional["aiohttp.ClientSession"] = None
        
        # Standalone mode (default)
        self._manager: Optional["StandaloneLspManager"] = None
        self._manager_started = False
        
        # Validate dependencies
        if use_vscode_bridge and not HAS_AIOHTTP:
            raise ImportError(
                "aiohttp is required for VSCode Bridge mode: pip install aiohttp"
            )
    
    async def _ensure_manager(self) -> "StandaloneLspManager":
        """Ensure standalone LSP manager is started."""
        if self._manager is None:
            from codexlens.lsp.standalone_manager import StandaloneLspManager
            self._manager = StandaloneLspManager(
                workspace_root=self.workspace_root,
                config_file=self.config_file,
                timeout=self.timeout,
            )
        
        if not self._manager_started:
            await self._manager.start()
            self._manager_started = True
        
        return self._manager
    
    async def _get_session(self) -> "aiohttp.ClientSession":
        """Get or create the aiohttp session (VSCode Bridge mode only)."""
        if not HAS_AIOHTTP:
            raise ImportError("aiohttp required for VSCode Bridge mode")
        
        if self._session is None or self._session.closed:
            timeout = aiohttp.ClientTimeout(total=self.timeout)
            self._session = aiohttp.ClientSession(timeout=timeout)
        return self._session
    
    async def close(self) -> None:
        """Close connections and cleanup resources."""
        # Close VSCode Bridge session
        if self._session and not self._session.closed:
            await self._session.close()
            self._session = None
        
        # Stop standalone manager
        if self._manager and self._manager_started:
            await self._manager.stop()
            self._manager_started = False
    
    def _get_file_mtime(self, file_path: str) -> float:
        """Get file modification time, or 0 if file doesn't exist."""
        try:
            return os.path.getmtime(file_path)
        except OSError:
            return 0.0
    
    def _is_cached(self, cache_key: str, file_path: str) -> bool:
        """Check if cache entry is valid.

        Cache is invalid if:
        - Entry doesn't exist
        - TTL has expired
        - File has been modified since caching

        Args:
            cache_key: The cache key to check
            file_path: Path to source file for mtime check

        Returns:
            True if cache is valid and can be used
        """
        if cache_key not in self.cache:
            return False

        entry = self.cache[cache_key]
        now = time.time()

        # Check TTL
        if now - entry.cached_at > self.cache_ttl:
            del self.cache[cache_key]
            return False

        # Check file modification time
        current_mtime = self._get_file_mtime(file_path)
        if current_mtime != entry.file_mtime:
            del self.cache[cache_key]
            return False

        # Move to end on access (LRU behavior)
        self.cache.move_to_end(cache_key)
        return True
    
    def _cache(self, key: str, file_path: str, data: Any) -> None:
        """Store data in cache with LRU eviction.

        Args:
            key: Cache key
            file_path: Path to source file (for mtime tracking)
            data: Data to cache
        """
        # Remove oldest entries if at capacity
        while len(self.cache) >= self.max_cache_size:
            self.cache.popitem(last=False)  # Remove oldest (FIFO order)

        # Move to end if key exists (update access order)
        if key in self.cache:
            self.cache.move_to_end(key)

        self.cache[key] = CacheEntry(
            data=data,
            file_mtime=self._get_file_mtime(file_path),
            cached_at=time.time(),
        )
    
    def clear_cache(self) -> None:
        """Clear all cached entries."""
        self.cache.clear()
    
    async def _request_vscode_bridge(self, action: str, params: Dict[str, Any]) -> Any:
        """Make HTTP request to VSCode Bridge (legacy mode).
        
        Args:
            action: The endpoint/action name (e.g., "get_definition")
            params: Request parameters
            
        Returns:
            Response data on success, None on failure
        """
        url = f"{self.bridge_url}/{action}"
        
        try:
            session = await self._get_session()
            async with session.post(url, json=params) as response:
                if response.status != 200:
                    return None
                
                data = await response.json()
                if data.get("success") is False:
                    return None
                
                return data.get("result")
        
        except asyncio.TimeoutError:
            return None
        except Exception:
            return None
    
    async def get_references(self, symbol: CodeSymbolNode) -> List[Location]:
        """Get all references to a symbol via real-time LSP.

        Args:
            symbol: The code symbol to find references for

        Returns:
            List of Location objects where the symbol is referenced.
            Returns empty list on error or timeout.
        """
        cache_key = f"refs:{symbol.id}"

        if self._is_cached(cache_key, symbol.file_path):
            return self.cache[cache_key].data

        locations: List[Location] = []

        if self.use_vscode_bridge:
            # Legacy: VSCode Bridge HTTP mode
            result = await self._request_vscode_bridge("get_references", {
                "file_path": symbol.file_path,
                "line": symbol.range.start_line,
                "character": symbol.range.start_character,
            })

            # Don't cache on connection error (result is None)
            if result is None:
                return locations

            if isinstance(result, list):
                for item in result:
                    try:
                        locations.append(Location.from_lsp_response(item))
                    except (KeyError, TypeError):
                        continue
        else:
            # Default: Standalone mode
            manager = await self._ensure_manager()
            result = await manager.get_references(
                file_path=symbol.file_path,
                line=symbol.range.start_line,
                character=symbol.range.start_character,
            )

            for item in result:
                try:
                    locations.append(Location.from_lsp_response(item))
                except (KeyError, TypeError):
                    continue

        self._cache(cache_key, symbol.file_path, locations)
        return locations
    
    async def get_definition(self, symbol: CodeSymbolNode) -> Optional[Location]:
        """Get symbol definition location.
        
        Args:
            symbol: The code symbol to find definition for
            
        Returns:
            Location of the definition, or None if not found
        """
        cache_key = f"def:{symbol.id}"
        
        if self._is_cached(cache_key, symbol.file_path):
            return self.cache[cache_key].data
        
        location: Optional[Location] = None
        
        if self.use_vscode_bridge:
            # Legacy: VSCode Bridge HTTP mode
            result = await self._request_vscode_bridge("get_definition", {
                "file_path": symbol.file_path,
                "line": symbol.range.start_line,
                "character": symbol.range.start_character,
            })
            
            if result:
                if isinstance(result, list) and len(result) > 0:
                    try:
                        location = Location.from_lsp_response(result[0])
                    except (KeyError, TypeError):
                        pass
                elif isinstance(result, dict):
                    try:
                        location = Location.from_lsp_response(result)
                    except (KeyError, TypeError):
                        pass
        else:
            # Default: Standalone mode
            manager = await self._ensure_manager()
            result = await manager.get_definition(
                file_path=symbol.file_path,
                line=symbol.range.start_line,
                character=symbol.range.start_character,
            )
            
            if result:
                try:
                    location = Location.from_lsp_response(result)
                except (KeyError, TypeError):
                    pass
        
        self._cache(cache_key, symbol.file_path, location)
        return location
    
    async def get_call_hierarchy(self, symbol: CodeSymbolNode) -> List[CallHierarchyItem]:
        """Get incoming/outgoing calls for a symbol.
        
        If call hierarchy is not supported by the language server,
        falls back to using references.
        
        Args:
            symbol: The code symbol to get call hierarchy for
            
        Returns:
            List of CallHierarchyItem representing callers/callees.
            Returns empty list on error or if not supported.
        """
        cache_key = f"calls:{symbol.id}"
        
        if self._is_cached(cache_key, symbol.file_path):
            return self.cache[cache_key].data
        
        items: List[CallHierarchyItem] = []
        
        if self.use_vscode_bridge:
            # Legacy: VSCode Bridge HTTP mode
            result = await self._request_vscode_bridge("get_call_hierarchy", {
                "file_path": symbol.file_path,
                "line": symbol.range.start_line,
                "character": symbol.range.start_character,
            })
            
            if result is None:
                # Fallback: use references
                refs = await self.get_references(symbol)
                for ref in refs:
                    items.append(CallHierarchyItem(
                        name=f"caller@{ref.line}",
                        kind="reference",
                        file_path=ref.file_path,
                        range=Range(
                            start_line=ref.line,
                            start_character=ref.character,
                            end_line=ref.line,
                            end_character=ref.character,
                        ),
                        detail="Inferred from reference",
                    ))
            elif isinstance(result, list):
                for item in result:
                    try:
                        range_data = item.get("range", {})
                        start = range_data.get("start", {})
                        end = range_data.get("end", {})
                        
                        items.append(CallHierarchyItem(
                            name=item.get("name", "unknown"),
                            kind=item.get("kind", "unknown"),
                            file_path=item.get("file_path", item.get("uri", "")),
                            range=Range(
                                start_line=start.get("line", 0) + 1,
                                start_character=start.get("character", 0) + 1,
                                end_line=end.get("line", 0) + 1,
                                end_character=end.get("character", 0) + 1,
                            ),
                            detail=item.get("detail"),
                        ))
                    except (KeyError, TypeError):
                        continue
        else:
            # Default: Standalone mode
            manager = await self._ensure_manager()
            
            # Try to get call hierarchy items
            hierarchy_items = await manager.get_call_hierarchy_items(
                file_path=symbol.file_path,
                line=symbol.range.start_line,
                character=symbol.range.start_character,
            )
            
            if hierarchy_items:
                # Get incoming calls for each item
                for h_item in hierarchy_items:
                    incoming = await manager.get_incoming_calls(h_item)
                    for call in incoming:
                        from_item = call.get("from", {})
                        range_data = from_item.get("range", {})
                        start = range_data.get("start", {})
                        end = range_data.get("end", {})
                        
                        # Parse URI
                        uri = from_item.get("uri", "")
                        if uri.startswith("file:///"):
                            fp = uri[8:] if uri[8:9].isalpha() and uri[9:10] == ":" else uri[7:]
                        elif uri.startswith("file://"):
                            fp = uri[7:]
                        else:
                            fp = uri
                        
                        items.append(CallHierarchyItem(
                            name=from_item.get("name", "unknown"),
                            kind=str(from_item.get("kind", "unknown")),
                            file_path=fp,
                            range=Range(
                                start_line=start.get("line", 0) + 1,
                                start_character=start.get("character", 0) + 1,
                                end_line=end.get("line", 0) + 1,
                                end_character=end.get("character", 0) + 1,
                            ),
                            detail=from_item.get("detail"),
                        ))
            else:
                # Fallback: use references
                refs = await self.get_references(symbol)
                for ref in refs:
                    items.append(CallHierarchyItem(
                        name=f"caller@{ref.line}",
                        kind="reference",
                        file_path=ref.file_path,
                        range=Range(
                            start_line=ref.line,
                            start_character=ref.character,
                            end_line=ref.line,
                            end_character=ref.character,
                        ),
                        detail="Inferred from reference",
                    ))
        
        self._cache(cache_key, symbol.file_path, items)
        return items
    
    async def get_document_symbols(self, file_path: str) -> List[Dict[str, Any]]:
        """Get all symbols in a document (batch operation).

        This is more efficient than individual hover queries when processing
        multiple locations in the same file.

        Args:
            file_path: Path to the source file

        Returns:
            List of symbol dictionaries with name, kind, range, etc.
            Returns empty list on error or timeout.
        """
        cache_key = f"symbols:{file_path}"

        if self._is_cached(cache_key, file_path):
            return self.cache[cache_key].data

        symbols: List[Dict[str, Any]] = []

        if self.use_vscode_bridge:
            # Legacy: VSCode Bridge HTTP mode
            result = await self._request_vscode_bridge("get_document_symbols", {
                "file_path": file_path,
            })

            if isinstance(result, list):
                symbols = self._flatten_document_symbols(result)
        else:
            # Default: Standalone mode
            manager = await self._ensure_manager()
            result = await manager.get_document_symbols(file_path)
            
            if result:
                symbols = self._flatten_document_symbols(result)

        self._cache(cache_key, file_path, symbols)
        return symbols

    def _flatten_document_symbols(
        self, symbols: List[Dict[str, Any]], parent_name: str = ""
    ) -> List[Dict[str, Any]]:
        """Flatten nested document symbols into a flat list.

        Document symbols can be nested (e.g., methods inside classes).
        This flattens them for easier lookup by line number.

        Args:
            symbols: List of symbol dictionaries (may be nested)
            parent_name: Name of parent symbol for qualification

        Returns:
            Flat list of all symbols with their ranges
        """
        flat: List[Dict[str, Any]] = []

        for sym in symbols:
            # Add the symbol itself
            symbol_entry = {
                "name": sym.get("name", "unknown"),
                "kind": self._symbol_kind_to_string(sym.get("kind", 0)),
                "range": sym.get("range", sym.get("location", {}).get("range", {})),
                "selection_range": sym.get("selectionRange", {}),
                "detail": sym.get("detail", ""),
                "parent": parent_name,
            }
            flat.append(symbol_entry)

            # Recursively process children
            children = sym.get("children", [])
            if children:
                qualified_name = sym.get("name", "")
                if parent_name:
                    qualified_name = f"{parent_name}.{qualified_name}"
                flat.extend(self._flatten_document_symbols(children, qualified_name))

        return flat

    def _symbol_kind_to_string(self, kind: int) -> str:
        """Convert LSP SymbolKind integer to string.

        Args:
            kind: LSP SymbolKind enum value

        Returns:
            Human-readable string representation
        """
        # LSP SymbolKind enum (1-indexed)
        kinds = {
            1: "file",
            2: "module",
            3: "namespace",
            4: "package",
            5: "class",
            6: "method",
            7: "property",
            8: "field",
            9: "constructor",
            10: "enum",
            11: "interface",
            12: "function",
            13: "variable",
            14: "constant",
            15: "string",
            16: "number",
            17: "boolean",
            18: "array",
            19: "object",
            20: "key",
            21: "null",
            22: "enum_member",
            23: "struct",
            24: "event",
            25: "operator",
            26: "type_parameter",
        }
        return kinds.get(kind, "unknown")

    async def get_hover(self, symbol: CodeSymbolNode) -> Optional[str]:
        """Get hover documentation for a symbol.

        Args:
            symbol: The code symbol to get hover info for

        Returns:
            Hover documentation as string, or None if not available
        """
        cache_key = f"hover:{symbol.id}"
        
        if self._is_cached(cache_key, symbol.file_path):
            return self.cache[cache_key].data
        
        hover_text: Optional[str] = None
        
        if self.use_vscode_bridge:
            # Legacy: VSCode Bridge HTTP mode
            result = await self._request_vscode_bridge("get_hover", {
                "file_path": symbol.file_path,
                "line": symbol.range.start_line,
                "character": symbol.range.start_character,
            })
            
            if result:
                hover_text = self._parse_hover_result(result)
        else:
            # Default: Standalone mode
            manager = await self._ensure_manager()
            hover_text = await manager.get_hover(
                file_path=symbol.file_path,
                line=symbol.range.start_line,
                character=symbol.range.start_character,
            )
        
        self._cache(cache_key, symbol.file_path, hover_text)
        return hover_text
    
    def _parse_hover_result(self, result: Any) -> Optional[str]:
        """Parse hover result into string."""
        if isinstance(result, str):
            return result
        elif isinstance(result, list):
            parts = []
            for item in result:
                if isinstance(item, str):
                    parts.append(item)
                elif isinstance(item, dict):
                    value = item.get("value", item.get("contents", ""))
                    if value:
                        parts.append(str(value))
            return "\n\n".join(parts) if parts else None
        elif isinstance(result, dict):
            contents = result.get("contents", result.get("value", ""))
            if isinstance(contents, str):
                return contents
            elif isinstance(contents, list):
                parts = []
                for c in contents:
                    if isinstance(c, str):
                        parts.append(c)
                    elif isinstance(c, dict):
                        parts.append(str(c.get("value", "")))
                return "\n\n".join(parts) if parts else None
        return None
    
    async def __aenter__(self) -> "LspBridge":
        """Async context manager entry."""
        return self
    
    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Async context manager exit - close connections."""
        await self.close()


# Simple test
if __name__ == "__main__":
    import sys
    
    async def test_lsp_bridge():
        """Simple test of LspBridge functionality."""
        print("Testing LspBridge (Standalone Mode)...")
        print(f"Timeout: {LspBridge.DEFAULT_TIMEOUT}s")
        print(f"Cache TTL: {LspBridge.DEFAULT_CACHE_TTL}s")
        print()
        
        # Create a test symbol pointing to this file
        test_file = os.path.abspath(__file__)
        test_symbol = CodeSymbolNode(
            id=f"{test_file}:LspBridge:96",
            name="LspBridge",
            kind="class",
            file_path=test_file,
            range=Range(
                start_line=96,
                start_character=1,
                end_line=200,
                end_character=1,
            ),
        )
        
        print(f"Test symbol: {test_symbol.name} in {os.path.basename(test_symbol.file_path)}")
        print()
        
        # Use standalone mode (default)
        async with LspBridge(
            workspace_root=str(Path(__file__).parent.parent.parent.parent),
        ) as bridge:
            print("1. Testing get_document_symbols...")
            try:
                symbols = await bridge.get_document_symbols(test_file)
                print(f"   Found {len(symbols)} symbols")
                for sym in symbols[:5]:
                    print(f"   - {sym.get('name')} ({sym.get('kind')})")
            except Exception as e:
                print(f"   Error: {e}")
            
            print()
            print("2. Testing get_definition...")
            try:
                definition = await bridge.get_definition(test_symbol)
                if definition:
                    print(f"   Definition: {os.path.basename(definition.file_path)}:{definition.line}")
                else:
                    print("   No definition found")
            except Exception as e:
                print(f"   Error: {e}")
            
            print()
            print("3. Testing get_references...")
            try:
                refs = await bridge.get_references(test_symbol)
                print(f"   Found {len(refs)} references")
                for ref in refs[:3]:
                    print(f"   - {os.path.basename(ref.file_path)}:{ref.line}")
            except Exception as e:
                print(f"   Error: {e}")
            
            print()
            print("4. Testing get_hover...")
            try:
                hover = await bridge.get_hover(test_symbol)
                if hover:
                    print(f"   Hover: {hover[:100]}...")
                else:
                    print("   No hover info found")
            except Exception as e:
                print(f"   Error: {e}")
            
            print()
            print("5. Testing get_call_hierarchy...")
            try:
                calls = await bridge.get_call_hierarchy(test_symbol)
                print(f"   Found {len(calls)} call hierarchy items")
                for call in calls[:3]:
                    print(f"   - {call.name} in {os.path.basename(call.file_path)}")
            except Exception as e:
                print(f"   Error: {e}")
            
            print()
            print("6. Testing cache...")
            print(f"   Cache entries: {len(bridge.cache)}")
            for key in list(bridge.cache.keys())[:5]:
                print(f"   - {key}")
        
        print()
        print("Test complete!")

    # Run the test
    # Note: On Windows, use default ProactorEventLoop (supports subprocess creation)

    asyncio.run(test_lsp_bridge())
