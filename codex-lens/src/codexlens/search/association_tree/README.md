# Association Tree Module

LSP-based code relationship discovery using call hierarchy.

## Overview

This module provides components for building and analyzing call relationship trees using Language Server Protocol (LSP) call hierarchy capabilities. It consists of three main components:

1. **Data Structures** (`data_structures.py`) - Core data classes
2. **Association Tree Builder** (`builder.py`) - Tree construction via LSP
3. **Result Deduplicator** (`deduplicator.py`) - Node extraction and scoring

## Components

### 1. Data Structures

**TreeNode**: Represents a single node in the call tree.
- Contains LSP CallHierarchyItem
- Tracks depth, parents, children
- Detects and marks cycles

**CallTree**: Complete tree structure with roots and edges.
- Stores all discovered nodes
- Tracks edges (call relationships)
- Provides lookup by node_id

**UniqueNode**: Deduplicated code symbol with metadata.
- Aggregates multiple occurrences
- Tracks minimum depth
- Contains relevance score

### 2. AssociationTreeBuilder

Builds call trees using LSP call hierarchy:

**Strategy**:
- Depth-first recursive expansion
- Supports expanding callers (incoming calls) and callees (outgoing calls)
- Detects and marks circular references
- Respects max_depth limit

**Key Features**:
- Async/await for concurrent LSP requests
- Timeout handling (5s per node)
- Graceful error handling
- Cycle detection via visited set

### 3. ResultDeduplicator

Extracts unique nodes from trees and assigns scores:

**Scoring Factors**:
- **Depth** (40%): Shallower = more relevant
- **Frequency** (30%): More occurrences = more important
- **Kind** (30%): function/method > class > variable

**Features**:
- Merges duplicate nodes by (file_path, start_line, end_line)
- Tracks all paths to each node
- Supports filtering by kind or file pattern
- Configurable score weights

## Usage Example

```python
import asyncio
from codexlens.lsp.standalone_manager import StandaloneLspManager
from codexlens.search.association_tree import (
    AssociationTreeBuilder,
    ResultDeduplicator,
)

async def main():
    # Initialize LSP manager
    async with StandaloneLspManager(workspace_root="/path/to/project") as lsp:
        # Create tree builder
        builder = AssociationTreeBuilder(lsp, timeout=5.0)

        # Build tree from seed location
        tree = await builder.build_tree(
            seed_file_path="src/main.py",
            seed_line=42,
            seed_character=1,
            max_depth=5,
            expand_callers=True,   # Find who calls this
            expand_callees=True,   # Find what this calls
        )

        print(f"Tree: {tree}")
        print(f"  Roots: {len(tree.roots)}")
        print(f"  Total nodes: {len(tree.all_nodes)}")
        print(f"  Edges: {len(tree.edges)}")

        # Deduplicate and score
        deduplicator = ResultDeduplicator(
            depth_weight=0.4,
            frequency_weight=0.3,
            kind_weight=0.3,
        )

        unique_nodes = deduplicator.deduplicate(tree, max_results=20)

        print(f"\nTop unique nodes:")
        for node in unique_nodes[:10]:
            print(f"  {node.name} ({node.file_path}:{node.range.start_line})")
            print(f"    Depth: {node.min_depth}, Occurrences: {node.occurrences}, Score: {node.score:.2f}")

        # Filter by kind
        functions_only = deduplicator.filter_by_kind(unique_nodes, ["function", "method"])
        print(f"\nFunctions/methods: {len(functions_only)}")

asyncio.run(main())
```

## Integration with Hybrid Search

The association tree can be integrated with the hybrid search engine:

```python
from codexlens.search.hybrid_search import HybridSearchEngine

async def search_with_association_tree(query: str):
    # 1. Get seed results from vector search
    search_engine = HybridSearchEngine()
    seed_results = await search_engine.search(query, limit=5)

    # 2. Build association trees from top results
    builder = AssociationTreeBuilder(lsp_manager)
    trees = []

    for result in seed_results:
        tree = await builder.build_tree(
            seed_file_path=result.file_path,
            seed_line=result.line,
            max_depth=3,
        )
        trees.append(tree)

    # 3. Merge and deduplicate
    merged_tree = merge_trees(trees)  # Custom merge logic
    deduplicator = ResultDeduplicator()
    unique_nodes = deduplicator.deduplicate(merged_tree, max_results=50)

    # 4. Convert to search results
    final_results = convert_to_search_results(unique_nodes)

    return final_results
```

## Testing

Run the test suite:

```bash
pytest tests/test_association_tree.py -v
```

Test coverage includes:
- Simple tree building
- Cycle detection
- Max depth limits
- Empty trees
- Deduplication logic
- Scoring algorithms
- Filtering operations

## Performance Considerations

1. **LSP Timeouts**: Set appropriate timeout values (default 5s)
2. **Max Depth**: Limit depth to avoid exponential expansion (recommended: 3-5)
3. **Caching**: LSP manager caches open documents
4. **Parallel Expansion**: Incoming/outgoing calls fetched in parallel

## Error Handling

The builder gracefully handles:
- LSP timeout errors (logs warning, continues)
- Missing call hierarchy support (returns empty)
- Network/connection failures (skips node)
- Invalid LSP responses (logs error, skips)

## Future Enhancements

- [ ] Multi-root tree building from multiple seeds
- [ ] Custom scoring functions
- [ ] Graph visualization export
- [ ] Incremental tree updates
- [ ] Cross-file relationship analysis
