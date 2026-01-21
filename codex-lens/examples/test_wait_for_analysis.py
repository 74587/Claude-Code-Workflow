"""Test with longer wait time for Pyright analysis."""

import asyncio
import json
from pathlib import Path
from codexlens.lsp.standalone_manager import StandaloneLspManager

async def test_with_wait():
    """Test prepareCallHierarchy with longer wait for analysis."""

    workspace_root = Path("D:/Claude_dms3/codex-lens")
    test_file = workspace_root / "test_simple_function.py"

    print("Testing with Wait for Analysis")
    print("="*80)

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
        print(f"   Workspace: {manager.workspace_root}")

        # Open document
        print("\n2. Opening document...")
        await manager._open_document(state, str(test_file))
        print("   [OK] Document opened")

        # Wait longer for analysis
        print("\n3. Waiting for Pyright to analyze (5 seconds)...")
        await asyncio.sleep(5)
        print("   [OK] Wait complete")

        # Check diagnostics first to verify file is analyzed
        print("\n4. Checking if document symbols work (to verify analysis)...")
        symbols = await manager._send_request(
            state,
            "textDocument/documentSymbol",
            {"textDocument": {"uri": test_file.resolve().as_uri()}}
        )
        if symbols:
            print(f"   [OK] Found {len(symbols)} symbols:")
            for s in symbols:
                name = s.get('name', 'unknown')
                kind = s.get('kind', 0)
                range_info = s.get('range', {}).get('start', {})
                line = range_info.get('line', 0) + 1
                print(f"       - {name} (kind={kind}) at line {line}")
        else:
            print("   [WARN] No symbols found!")

        # Now try call hierarchy on different lines
        print("\n5. Testing prepareCallHierarchy on each symbol...")
        if symbols:
            for s in symbols:
                name = s.get('name', 'unknown')
                range_info = s.get('range', {}).get('start', {})
                line = range_info.get('line', 0)
                char = range_info.get('character', 0)

                params = {
                    "textDocument": {"uri": test_file.resolve().as_uri()},
                    "position": {"line": line, "character": char + 4}  # offset into name
                }

                result = await manager._send_request(
                    state,
                    "textDocument/prepareCallHierarchy",
                    params
                )

                status = f"[OK] {len(result)} items" if result else "[NONE]"
                print(f"   {name} (line {line+1}, char {char+4}): {status}")
                if result:
                    for item in result:
                        print(f"       - {item.get('name')}")

    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()

    finally:
        print("\n6. Cleanup...")
        await manager.stop()
        print("   [OK]")

if __name__ == "__main__":
    asyncio.run(test_with_wait())
