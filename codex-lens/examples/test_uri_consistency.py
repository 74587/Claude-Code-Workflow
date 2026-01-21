"""Test if URI inconsistency causes the issue."""

import asyncio
import json
from pathlib import Path
from codexlens.lsp.standalone_manager import StandaloneLspManager

async def test_with_consistent_uri():
    """Test prepareCallHierarchy with different URI formats."""

    workspace_root = Path("D:/Claude_dms3/codex-lens")
    test_file = workspace_root / "test_simple_function.py"
    resolved = test_file.resolve()

    print("Testing URI Consistency")
    print("="*80)

    # Different URI formats to try
    uri_standard = resolved.as_uri()
    uri_lowercase = uri_standard.replace("file:///D:", "file:///d:")

    print(f"Standard URI:  {uri_standard}")
    print(f"Lowercase URI: {uri_lowercase}")

    manager = StandaloneLspManager(
        workspace_root=str(workspace_root),
        timeout=30.0,
    )

    try:
        print("\n1. Starting LSP manager...")
        await manager.start()

        state = await manager._get_server(str(test_file))
        if not state:
            print("   [ERROR] No server state")
            return

        print("   [OK] Server ready")

        # Open document
        print("\n2. Opening document...")
        await manager._open_document(state, str(test_file))
        await asyncio.sleep(2)
        print("   [OK] Document opened, waited 2s")

        # Test 1: Standard URI (as_uri)
        print("\n3. Test with standard URI...")
        params1 = {
            "textDocument": {"uri": uri_standard},
            "position": {"line": 11, "character": 4}  # main function
        }
        print(f"   Params: {json.dumps(params1)}")
        result1 = await manager._send_request(state, "textDocument/prepareCallHierarchy", params1)
        print(f"   Result: {result1}")

        # Test 2: Lowercase drive letter
        print("\n4. Test with lowercase drive letter URI...")
        params2 = {
            "textDocument": {"uri": uri_lowercase},
            "position": {"line": 11, "character": 4}
        }
        print(f"   Params: {json.dumps(params2)}")
        result2 = await manager._send_request(state, "textDocument/prepareCallHierarchy", params2)
        print(f"   Result: {result2}")

        # Test 3: Position at function name start
        print("\n5. Test with position at 'def' keyword (char 0)...")
        params3 = {
            "textDocument": {"uri": uri_lowercase},
            "position": {"line": 11, "character": 0}
        }
        result3 = await manager._send_request(state, "textDocument/prepareCallHierarchy", params3)
        print(f"   Result: {result3}")

        # Test 4: Different positions on line 12 (1-indexed = line 11 0-indexed)
        print("\n6. Testing different character positions on 'def main():'...")
        for char in [0, 4, 5, 6, 7, 8]:
            params = {
                "textDocument": {"uri": uri_lowercase},
                "position": {"line": 11, "character": char}
            }
            result = await manager._send_request(state, "textDocument/prepareCallHierarchy", params)
            status = "OK" if result else "None"
            print(f"   char={char}: {status} - {result[:1] if result else '[]'}")

    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()

    finally:
        print("\n7. Cleanup...")
        await manager.stop()
        print("   [OK]")

if __name__ == "__main__":
    asyncio.run(test_with_consistent_uri())
