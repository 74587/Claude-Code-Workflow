#!/usr/bin/env python
"""Debug script to test StandaloneLspManager directly."""

import asyncio
import logging
import sys
from pathlib import Path

# Add source to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

# Enable debug logging
logging.basicConfig(level=logging.DEBUG, format="%(levelname)s: %(name)s: %(message)s")

from codexlens.lsp.standalone_manager import StandaloneLspManager


async def test_standalone_manager():
    """Test StandaloneLspManager directly."""
    workspace = Path(__file__).parent.parent.parent
    test_file = workspace / "src" / "codexlens" / "lsp" / "lsp_bridge.py"

    print(f"Workspace: {workspace}")
    print(f"Test file: {test_file}")
    print()

    manager = StandaloneLspManager(workspace_root=str(workspace), timeout=30.0)

    print("Starting manager...")
    await manager.start()

    print(f"Configs loaded: {list(manager._configs.keys())}")
    print(f"Servers running: {list(manager._servers.keys())}")

    # Try to get the server for the test file
    print(f"\nGetting server for {test_file.name}...")
    server = await manager._get_server(str(test_file))

    if server:
        print(f"Server: {server.config.display_name}")
        print(f"Initialized: {server.initialized}")
        print(f"Capabilities: {list(server.capabilities.keys())}")
    else:
        print("Failed to get server!")

    # Try to get document symbols
    print(f"\nGetting document symbols for {test_file.name}...")
    try:
        symbols = await manager.get_document_symbols(str(test_file))
        print(f"Found {len(symbols)} symbols")
        for sym in symbols[:5]:
            print(f"  - {sym.get('name', '?')} ({sym.get('kind', '?')})")
    except Exception as e:
        print(f"Error getting symbols: {e}")

    print("\nStopping manager...")
    await manager.stop()

    print("Done!")


if __name__ == "__main__":
    asyncio.run(test_standalone_manager())
