"""Test LSP server capabilities."""

import asyncio
import json
from pathlib import Path
from codexlens.lsp.standalone_manager import StandaloneLspManager

async def test_capabilities():
    """Test what capabilities Pyright provides."""

    workspace_root = Path("D:/Claude_dms3/codex-lens/src")

    print("Testing LSP Capabilities")
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

        # Get server state for Python
        print("\n2. Getting Python server state...")
        test_file = str(workspace_root / "codexlens/search/hybrid_search.py")
        state = await manager._get_server(test_file)

        if not state:
            print("   [ERROR] Could not get server state!")
            return

        print(f"   [OK] Server state obtained")
        print(f"   Initialized: {state.initialized}")

        # Print capabilities
        print("\n3. Server Capabilities:")
        print("-"*80)
        caps = state.capabilities

        # Key capabilities to check
        important_caps = [
            "callHierarchyProvider",
            "definitionProvider",
            "referencesProvider",
            "documentSymbolProvider",
            "workspaceSymbolProvider",
            "hoverProvider",
            "completionProvider",
            "signatureHelpProvider",
        ]

        for cap in important_caps:
            value = caps.get(cap)
            status = "[YES]" if value else "[NO]"
            print(f"   {status} {cap}: {value}")

        # Print all capabilities as JSON for reference
        print("\n4. Full capabilities (formatted):")
        print("-"*80)
        print(json.dumps(caps, indent=2))

    except Exception as e:
        print(f"\n[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Cleanup
        print("\n5. Cleaning up...")
        await manager.stop()
        print("   [OK] LSP manager stopped")

if __name__ == "__main__":
    asyncio.run(test_capabilities())
