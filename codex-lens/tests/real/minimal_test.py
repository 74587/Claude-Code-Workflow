#!/usr/bin/env python
"""Minimal test that mimics the working direct test."""

import asyncio
import json
import sys
from pathlib import Path

# Add source to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))


async def test_minimal():
    """Minimal test using the standalone manager."""
    from codexlens.lsp.standalone_manager import StandaloneLspManager

    workspace = Path(__file__).parent.parent.parent
    manager = StandaloneLspManager(
        workspace_root=str(workspace),
        timeout=60.0
    )

    await manager.start()

    # Get server state
    server_state = await manager._get_server(str(workspace / "tests" / "real" / "minimal_test.py"))

    if not server_state:
        print("Failed to get server state")
        await manager.stop()
        return

    print(f"Server initialized: {server_state.initialized}")
    print(f"Server capabilities: {list(server_state.capabilities.keys())[:5]}...")

    # Wait for any background messages
    print("Waiting 5 seconds for background messages...")
    await asyncio.sleep(5)

    # Now send a documentSymbol request manually
    print("Sending documentSymbol request...")
    result = await manager._send_request(
        server_state,
        "textDocument/documentSymbol",
        {"textDocument": {"uri": (workspace / "tests" / "real" / "minimal_test.py").resolve().as_uri()}},
        timeout=30.0
    )

    print(f"Result: {result}")

    await manager.stop()


if __name__ == "__main__":
    import logging
    logging.basicConfig(level=logging.INFO, format='%(name)s - %(levelname)s - %(message)s')

    asyncio.run(test_minimal())
