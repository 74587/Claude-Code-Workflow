"""Test LSP references as alternative to call hierarchy."""

import asyncio
from pathlib import Path
from codexlens.lsp.standalone_manager import StandaloneLspManager

async def test_references():
    """Test using references as alternative to call hierarchy."""

    workspace_root = Path("D:/Claude_dms3/codex-lens")
    test_file = workspace_root / "test_simple_function.py"

    print("Testing LSP References (Alternative)")
    print("="*80)

    manager = StandaloneLspManager(
        workspace_root=str(workspace_root),
        timeout=30.0,
    )

    try:
        print("\n1. Starting LSP manager...")
        await manager.start()
        print("   [OK] Started")

        # Wait for analysis
        await asyncio.sleep(2)

        # Test references for hello_world function
        print("\n2. Testing references for 'hello_world' (line 4)...")
        refs = await manager.get_references(
            file_path=str(test_file),
            line=4,
            character=5,
            include_declaration=True,
        )
        print(f"   Found: {len(refs)} references")
        for ref in refs[:5]:
            uri = ref.get('uri', '')
            range_obj = ref.get('range', {})
            start = range_obj.get('start', {})
            print(f"   - {uri.split('/')[-1]}:{start.get('line', 0)+1}")

        # Test definition
        print("\n3. Testing definition for 'hello_world' call (line 13)...")
        defs = await manager.get_definition(
            file_path=str(test_file),
            line=13,
            character=11,
        )
        print(f"   Found: {len(defs)} definitions")
        for d in defs:
            uri = d.get('uri', '')
            range_obj = d.get('range', {})
            start = range_obj.get('start', {})
            print(f"   - {uri.split('/')[-1]}:{start.get('line', 0)+1}")

        # Test document symbols
        print("\n4. Testing document symbols...")
        symbols = await manager.get_document_symbols(str(test_file))
        print(f"   Found: {len(symbols)} symbols")
        for sym in symbols:
            print(f"   - {sym.get('name')} ({sym.get('kind')})")

    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()

    finally:
        print("\n5. Cleanup...")
        await manager.stop()
        print("   [OK] Done")

if __name__ == "__main__":
    asyncio.run(test_references())
