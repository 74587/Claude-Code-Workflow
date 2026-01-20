#!/usr/bin/env python
"""Debug script to check pyright LSP configuration requests."""

import asyncio
import logging
import sys
from pathlib import Path

# Enable DEBUG logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)

# Add source to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from codexlens.lsp.standalone_manager import StandaloneLspManager

async def test():
    workspace = Path(__file__).parent.parent.parent
    manager = StandaloneLspManager(
        workspace_root=str(workspace),
        timeout=60.0
    )
    await manager.start()

    # Wait a bit after start to see if any requests come in
    print("Waiting 3 seconds after start to see server requests...")
    await asyncio.sleep(3)

    # Try to get symbols for a simpler file
    test_file = str(workspace / "tests" / "real" / "debug_lsp.py")
    print(f"Testing with: {test_file}")

    # Let's see if we can check what pyright sees
    print("Checking server state...")
    state = manager._servers.get("python")
    if state:
        print(f"  - Process running: {state.process.returncode is None}")
        print(f"  - Initialized: {state.initialized}")
        print(f"  - Pending requests: {list(state.pending_requests.keys())}")

    try:
        symbols = await manager.get_document_symbols(test_file)
        print(f"Got {len(symbols)} symbols")
        for s in symbols[:5]:
            print(f"  - {s}")
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

    await manager.stop()

if __name__ == "__main__":
    asyncio.run(test())
