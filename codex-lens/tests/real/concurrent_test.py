#!/usr/bin/env python
"""Test concurrent read loop behavior."""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

import logging
logging.basicConfig(level=logging.DEBUG, format='%(name)s - %(levelname)s - %(message)s')

from codexlens.lsp.standalone_manager import StandaloneLspManager

async def test():
    workspace = Path(__file__).parent.parent.parent
    manager = StandaloneLspManager(
        workspace_root=str(workspace),
        timeout=30.0
    )
    
    await manager.start()
    
    # Get server for a simple file
    simple_content = "def hello():\n    pass\n"
    simple_file = workspace / "test_simple.py"
    simple_file.write_text(simple_content)
    
    try:
        print("\n=== Getting server ===")
        state = await manager._get_server(str(simple_file))
        print(f"Server state: initialized={state.initialized if state else 'None'}")
        
        print("\n=== Sending didOpen ===")
        await manager._send_notification(state, "textDocument/didOpen", {
            "textDocument": {
                "uri": simple_file.as_uri(),
                "languageId": "python",
                "version": 1,
                "text": simple_content,
            }
        })
        
        print("\n=== Waiting 5 seconds - watch for server requests ===")
        for i in range(5):
            print(f"  Tick {i+1}...")
            await asyncio.sleep(1.0)
        
        print("\n=== Sending documentSymbol ===")
        result = await manager._send_request(
            state,
            "textDocument/documentSymbol",
            {"textDocument": {"uri": simple_file.as_uri()}},
            timeout=10.0
        )
        print(f"Result: {result}")
        
    finally:
        simple_file.unlink(missing_ok=True)
        await manager.stop()

if __name__ == "__main__":
    asyncio.run(test())
