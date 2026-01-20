# Association Tree Quick Start

## Installation

No additional dependencies needed - uses existing CodexLens LSP infrastructure.

## Basic Usage

### 1. Import Components

```python
from codexlens.lsp.standalone_manager import StandaloneLspManager
from codexlens.search.association_tree import (
    AssociationTreeBuilder,
    ResultDeduplicator,
)
```

### 2. Build a Tree

```python
import asyncio

async def build_tree_example():
    # Initialize LSP manager
    async with StandaloneLspManager(workspace_root="/path/to/project") as lsp:
        # Create builder
        builder = AssociationTreeBuilder(lsp, timeout=5.0)

        # Build tree from seed location
        tree = await builder.build_tree(
            seed_file_path="src/main.py",
            seed_line=42,              # 1-based line number
            seed_character=1,          # 1-based character position
            max_depth=5,               # Maximum recursion depth
            expand_callers=True,       # Find who calls this
            expand_callees=True,       # Find what this calls
        )

        return tree

tree = asyncio.run(build_tree_example())
print(f"Found {len(tree.all_nodes)} unique nodes")
```

### 3. Deduplicate and Score

```python
# Create deduplicator
deduplicator = ResultDeduplicator(
    depth_weight=0.4,        # Weight for depth score (0-1)
    frequency_weight=0.3,    # Weight for frequency score (0-1)
    kind_weight=0.3,         # Weight for symbol kind score (0-1)
)

# Extract unique nodes
unique_nodes = deduplicator.deduplicate(tree, max_results=20)

# Print results
for node in unique_nodes:
    print(f"{node.name} @ {node.file_path}:{node.range.start_line}")
    print(f"  Score: {node.score:.2f}, Depth: {node.min_depth}, Occurs: {node.occurrences}")
```

### 4. Filter Results

```python
# Filter by symbol kind
functions = deduplicator.filter_by_kind(unique_nodes, ["function", "method"])

# Filter by file pattern
core_modules = deduplicator.filter_by_file(unique_nodes, ["src/core/"])

# Convert to JSON
json_data = deduplicator.to_dict_list(unique_nodes)
```

## Common Patterns

### Pattern 1: Find All Callers

```python
tree = await builder.build_tree(
    seed_file_path=target_file,
    seed_line=target_line,
    max_depth=3,
    expand_callers=True,   # Only expand callers
    expand_callees=False,  # Don't expand callees
)
```

### Pattern 2: Find Call Chain

```python
tree = await builder.build_tree(
    seed_file_path=entry_point,
    seed_line=main_line,
    max_depth=10,
    expand_callers=False,  # Don't expand callers
    expand_callees=True,   # Only expand callees (call chain)
)
```

### Pattern 3: Full Relationship Map

```python
tree = await builder.build_tree(
    seed_file_path=target_file,
    seed_line=target_line,
    max_depth=5,
    expand_callers=True,   # Expand both directions
    expand_callees=True,
)
```

## Configuration Tips

### Max Depth Guidelines

- **Depth 1-2**: Direct callers/callees only (fast, focused)
- **Depth 3-5**: Good balance of coverage and performance (recommended)
- **Depth 6-10**: Deep exploration (slower, may hit cycles)

### Timeout Settings

```python
builder = AssociationTreeBuilder(
    lsp,
    timeout=5.0,  # 5 seconds per LSP request
)

# For slower language servers
builder = AssociationTreeBuilder(lsp, timeout=10.0)
```

### Score Weight Tuning

```python
# Emphasize proximity to seed
deduplicator = ResultDeduplicator(
    depth_weight=0.7,      # High weight for depth
    frequency_weight=0.2,
    kind_weight=0.1,
)

# Emphasize frequently-called functions
deduplicator = ResultDeduplicator(
    depth_weight=0.2,
    frequency_weight=0.7,  # High weight for frequency
    kind_weight=0.1,
)
```

## Error Handling

```python
try:
    tree = await builder.build_tree(...)

    if not tree.all_nodes:
        print("No call hierarchy found - LSP may not support this file type")

except asyncio.TimeoutError:
    print("LSP request timed out - try increasing timeout")

except Exception as e:
    print(f"Error building tree: {e}")
```

## Performance Optimization

### 1. Limit Depth

```python
# Fast: max_depth=3
tree = await builder.build_tree(..., max_depth=3)
```

### 2. Filter Early

```python
# Get all nodes
unique_nodes = deduplicator.deduplicate(tree)

# Filter to relevant kinds immediately
functions = deduplicator.filter_by_kind(unique_nodes, ["function", "method"])
```

### 3. Use Timeouts

```python
# Set aggressive timeouts for fast iteration
builder = AssociationTreeBuilder(lsp, timeout=3.0)
```

## Common Issues

### Issue: Empty Tree Returned

**Causes**:
- File not supported by LSP server
- No call hierarchy at that position
- Position is not on a function/method

**Solutions**:
- Verify LSP server supports the language
- Check that position is on a function definition
- Try different seed locations

### Issue: Timeout Errors

**Causes**:
- LSP server slow or overloaded
- Network/connection issues
- Max depth too high

**Solutions**:
- Increase timeout value
- Reduce max_depth
- Check LSP server health

### Issue: Cycle Detected

**Behavior**: Cycles are automatically detected and marked

**Example**:
```python
for node in tree.node_list:
    if node.is_cycle:
        print(f"Cycle detected at {node.item.name}")
```

## Testing

Run the test suite:

```bash
# All tests
pytest tests/test_association_tree.py -v

# Specific test
pytest tests/test_association_tree.py::test_simple_tree_building -v
```

## Demo Script

Run the demo:

```bash
python examples/association_tree_demo.py
```

## Further Reading

- [Full Documentation](README.md)
- [Implementation Summary](../../ASSOCIATION_TREE_IMPLEMENTATION.md)
- [LSP Manager Documentation](../../lsp/standalone_manager.py)
