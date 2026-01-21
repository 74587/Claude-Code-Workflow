"""Raw LSP test with debug logging."""

import asyncio
import json
import logging
from pathlib import Path
from codexlens.lsp.standalone_manager import StandaloneLspManager

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("codexlens.lsp")
logger.setLevel(logging.DEBUG)

async def test_raw_lsp():
    """Test LSP with debug logging enabled."""

    workspace_root = Path("D:/Claude_dms3/codex-lens")
    test_file = workspace_root / "test_simple_function.py"

    print("Testing Raw LSP Call Hierarchy")
    print("="*80)

    # Create LSP manager
    manager = StandaloneLspManager(
        workspace_root=str(workspace_root),
        timeout=30.0,
    )

    try:
        # Start LSP manager
        print("\n1. Starting LSP manager...")
        await manager.start()
        print("   [OK] Started")

        # Get server state
        state = await manager._get_server(str(test_file))
        if not state:
            print("   [ERROR] No server state!")
            return

        print(f"   Server initialized: {state.initialized}")
        print(f"   Call hierarchy supported: {state.capabilities.get('callHierarchyProvider')}")

        # Open document
        print("\n2. Opening document...")
        await manager._open_document(state, str(test_file))
        print("   [OK] Document opened")

        # Wait a bit for Pyright to analyze
        print("\n3. Waiting for analysis...")
        await asyncio.sleep(2)
        print("   [OK] Waited 2 seconds")

        # Try call hierarchy on main function (line 12)
        print("\n4. Sending prepareCallHierarchy request...")

        # Direct request using _send_request
        params = {
            "textDocument": {"uri": test_file.as_uri()},
            "position": {"line": 11, "character": 4}  # 0-indexed, "main" function
        }
        print(f"   Params: {json.dumps(params, indent=2)}")

        result = await manager._send_request(
            state,
            "textDocument/prepareCallHierarchy",
            params,
        )

        print(f"\n5. Result: {result}")
        print(f"   Type: {type(result)}")

        if result:
            print(f"   Items: {len(result)}")
            for item in result:
                print(f"   - {item.get('name')}")
        else:
            print("   [WARN] No items returned")
            print("   This could mean:")
            print("   - Position doesn't point to a symbol")
            print("   - Pyright hasn't finished analyzing")
            print("   - Some other issue")

        # Try with the higher-level API
        print("\n6. Testing with get_call_hierarchy_items API...")
        items = await manager.get_call_hierarchy_items(
            file_path=str(test_file),
            line=12,
            character=5,
        )
        print(f"   Result: {len(items)} items")

    except Exception as e:
        print(f"\n[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        print("\n7. Cleanup...")
        await manager.stop()
        print("   [OK] Done")

if __name__ == "__main__":
    asyncio.run(test_raw_lsp())
