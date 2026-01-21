"""Test LSP Association Tree building directly."""

import asyncio
from pathlib import Path
from codexlens.lsp.standalone_manager import StandaloneLspManager
from codexlens.search.association_tree import AssociationTreeBuilder

async def test_lsp_tree():
    """Test building LSP association tree for a known Python file."""

    # Setup - use simple test file
    workspace_root = Path("D:/Claude_dms3/codex-lens")
    test_file = "test_simple_function.py"
    test_line = 11  # main() function definition (1-based)
    test_char = 5   # Points to 'm' in 'main' (1-based, becomes 4 in 0-based)

    print(f"Testing LSP tree for: {test_file}:{test_line}")
    print("="*80)

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

        # Test get_call_hierarchy_items directly
        print(f"\n2. Testing get_call_hierarchy_items for {test_file}:{test_line}:{test_char}...")
        items = await manager.get_call_hierarchy_items(
            file_path=str(workspace_root / test_file),
            line=test_line,
            character=test_char,
        )
        print(f"   Result: {len(items)} items")
        if items:
            for i, item in enumerate(items, 1):
                print(f"   {i}. {item.get('name')} ({item.get('kind')})")
                print(f"      URI: {item.get('uri')}")
                print(f"      Range: {item.get('range')}")
        else:
            print("   [WARN] No call hierarchy items returned!")
            print("   This means either:")
            print("     - The file/line doesn't contain a symbol")
            print("     - LSP server doesn't support call hierarchy")
            print("     - Pyright isn't running correctly")

        # If we got items, try building a tree
        if items:
            print(f"\n3. Building association tree...")
            builder = AssociationTreeBuilder(
                lsp_manager=manager,
                timeout=10.0,
            )

            tree = await builder.build_tree(
                seed_file_path=str(workspace_root / test_file),
                seed_line=test_line,
                seed_character=test_char,
                max_depth=2,
                expand_callers=True,
                expand_callees=True,
            )

            print(f"   Tree built successfully!")
            print(f"   - Roots: {len(tree.roots)}")
            print(f"   - Total nodes: {len(tree.node_list)}")
            print(f"   - Depth reached: {tree.depth_reached}")

            if tree.node_list:
                print(f"\n   First 5 nodes:")
                for i, node in enumerate(tree.node_list[:5], 1):
                    print(f"   {i}. {node.item.name} @ {node.item.file_path}:{node.item.range.start_line}")
                    print(f"      Depth: {node.depth}, Is cycle: {node.is_cycle}")

    except Exception as e:
        print(f"\n[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Cleanup
        print("\n4. Cleaning up...")
        await manager.stop()
        print("   [OK] LSP manager stopped")

if __name__ == "__main__":
    asyncio.run(test_lsp_tree())
