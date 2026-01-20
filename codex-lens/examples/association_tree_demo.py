"""Demo script for association tree building.

This script demonstrates how to use the AssociationTreeBuilder and
ResultDeduplicator to explore code relationships via LSP call hierarchy.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from codexlens.lsp.standalone_manager import StandaloneLspManager
from codexlens.search.association_tree import (
    AssociationTreeBuilder,
    ResultDeduplicator,
)


async def demo_simple_tree():
    """Build a simple call tree from a Python file."""
    print("=" * 70)
    print("Association Tree Demo")
    print("=" * 70)
    print()

    # Use this file as the test subject
    test_file = Path(__file__).resolve()
    workspace_root = test_file.parent.parent

    print(f"Workspace: {workspace_root}")
    print(f"Test file: {test_file.name}")
    print()

    # Initialize LSP manager
    async with StandaloneLspManager(
        workspace_root=str(workspace_root),
        timeout=10.0,
    ) as lsp:
        print("LSP manager initialized")
        print()

        # Create tree builder
        builder = AssociationTreeBuilder(lsp, timeout=5.0)

        # Build tree from a function in this file
        # Using line 50 as an example (adjust based on actual file)
        print(f"Building call tree from {test_file.name}:50...")
        tree = await builder.build_tree(
            seed_file_path=str(test_file),
            seed_line=50,
            seed_character=1,
            max_depth=3,
            expand_callers=True,
            expand_callees=True,
        )

        print(f"Tree built: {tree}")
        print(f"  Roots: {len(tree.roots)}")
        print(f"  Total unique nodes: {len(tree.all_nodes)}")
        print(f"  Total node instances: {len(tree.node_list)}")
        print(f"  Edges: {len(tree.edges)}")
        print()

        if tree.roots:
            print("Root nodes:")
            for root in tree.roots:
                print(f"  - {root.item.name} ({root.item.kind})")
                print(f"    {root.item.file_path}:{root.item.range.start_line}")
            print()

        # Deduplicate and score
        print("Deduplicating and scoring nodes...")
        deduplicator = ResultDeduplicator(
            depth_weight=0.4,
            frequency_weight=0.3,
            kind_weight=0.3,
        )

        unique_nodes = deduplicator.deduplicate(tree, max_results=20)
        print(f"Found {len(unique_nodes)} unique nodes")
        print()

        if unique_nodes:
            print("Top 10 nodes by score:")
            print("-" * 70)
            for i, node in enumerate(unique_nodes[:10], 1):
                print(f"{i:2}. {node.name} ({node.kind})")
                print(f"    Location: {Path(node.file_path).name}:{node.range.start_line}")
                print(
                    f"    Depth: {node.min_depth}, "
                    f"Occurrences: {node.occurrences}, "
                    f"Score: {node.score:.3f}"
                )
                if node.paths:
                    print(f"    Paths: {len(node.paths)}")
                print()

            # Show filtering capabilities
            functions = deduplicator.filter_by_kind(
                unique_nodes, ["function", "method"]
            )
            print(f"Functions/methods only: {len(functions)} nodes")

            if functions:
                print("Top 5 functions:")
                for i, node in enumerate(functions[:5], 1):
                    print(f"  {i}. {node.name} (score: {node.score:.3f})")

        else:
            print("No nodes found. Try a different seed location.")

    print()
    print("Demo complete!")


async def demo_cycle_detection():
    """Demonstrate cycle detection in call trees."""
    print("\n" + "=" * 70)
    print("Cycle Detection Demo")
    print("=" * 70)
    print()

    # Create a simple Python file with circular calls for testing
    test_code = '''
def func_a():
    """Function A calls B."""
    func_b()

def func_b():
    """Function B calls A (creates a cycle)."""
    func_a()
'''

    print("This demo would detect cycles in:")
    print(test_code)
    print("The tree builder automatically marks cycle nodes to prevent infinite expansion.")


def main():
    """Run the demo."""
    try:
        asyncio.run(demo_simple_tree())
        demo_cycle_detection()
    except KeyboardInterrupt:
        print("\nDemo interrupted by user")
    except Exception as e:
        print(f"\nError running demo: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    main()
