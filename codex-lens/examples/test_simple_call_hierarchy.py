"""Test call hierarchy on a simple Python file."""

import asyncio
from pathlib import Path
from codexlens.lsp.standalone_manager import StandaloneLspManager

async def test_simple_call_hierarchy():
    """Test call hierarchy on test_simple_function.py."""

    workspace_root = Path("D:/Claude_dms3/codex-lens")
    test_file = workspace_root / "test_simple_function.py"

    print("Testing Call Hierarchy on Simple Function")
    print("="*80)
    print(f"File: {test_file}")

    # Create LSP manager
    manager = StandaloneLspManager(
        workspace_root=str(workspace_root),
        timeout=10.0,
    )

    try:
        # Start LSP manager
        print("\n1. Starting LSP manager...")
        await manager.start()
        print("   [OK] LSP manager started")

        # Test different function positions
        test_cases = [
            ("hello_world", 4, 5, "def hello_world():"),
            ("greet", 8, 5, "def greet(name: str):"),
            ("main", 12, 5, "def main():"),
        ]

        for func_name, line, char, expected in test_cases:
            print(f"\n2. Testing {func_name} at line {line}:")
            print(f"   Expected: {expected}")

            items = await manager.get_call_hierarchy_items(
                file_path=str(test_file),
                line=line,
                character=char,
            )

            print(f"   Result: {len(items)} items")
            if items:
                for i, item in enumerate(items, 1):
                    print(f"   {i}. Name: {item.get('name')}")
                    print(f"      Kind: {item.get('kind')}")
                    print(f"      URI: {item.get('uri')}")
                    range_obj = item.get('range', {})
                    start = range_obj.get('start', {})
                    print(f"      Line: {start.get('line', 0) + 1}")

                # If we got items, try getting incoming/outgoing calls
                print(f"\n   Testing incoming/outgoing calls for {func_name}:")
                first_item = items[0]

                incoming = await manager.get_incoming_calls(first_item)
                print(f"   - Incoming calls: {len(incoming)}")
                for call in incoming:
                    caller = call.get('from', {})
                    print(f"     Called by: {caller.get('name')}")

                outgoing = await manager.get_outgoing_calls(first_item)
                print(f"   - Outgoing calls: {len(outgoing)}")
                for call in outgoing:
                    callee = call.get('to', {})
                    print(f"     Calls: {callee.get('name')}")

            else:
                print(f"   [WARN] No call hierarchy items for {func_name}!")

    except Exception as e:
        print(f"\n[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Cleanup
        print("\n3. Cleaning up...")
        await manager.stop()
        print("   [OK] LSP manager stopped")

if __name__ == "__main__":
    asyncio.run(test_simple_call_hierarchy())
