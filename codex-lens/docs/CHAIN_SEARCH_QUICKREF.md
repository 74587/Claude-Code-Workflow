# Chain Search Quick Reference

## Import

```python
from pathlib import Path
from codexlens.search import (
    ChainSearchEngine,
    SearchOptions,
    quick_search
)
from codexlens.storage.registry import RegistryStore
from codexlens.storage.path_mapper import PathMapper
```

## One-Line Search

```python
results = quick_search("query", Path("/path/to/search"), depth=-1)
```

## Full Engine Usage

### 1. Initialize Engine
```python
registry = RegistryStore()
registry.initialize()
mapper = PathMapper()
engine = ChainSearchEngine(registry, mapper)
```

### 2. Configure Search
```python
options = SearchOptions(
    depth=-1,              # -1 = unlimited, 0 = current dir only
    max_workers=8,         # Parallel threads
    limit_per_dir=10,      # Max results per directory
    total_limit=100,       # Total result limit
    include_symbols=False, # Include symbol search
    files_only=False       # Return only paths
)
```

### 3. Execute Search
```python
result = engine.search("query", Path("/path"), options)

# Access results
for r in result.results:
    print(f"{r.path}: score={r.score:.2f}")
    print(f"  {r.excerpt}")

# Check statistics
print(f"Searched {result.stats.dirs_searched} directories")
print(f"Found {result.stats.files_matched} files")
print(f"Time: {result.stats.time_ms:.2f}ms")
```

### 4. Symbol Search
```python
symbols = engine.search_symbols(
    "function_name",
    Path("/path"),
    kind="function"  # Optional: 'function', 'class', 'method', etc.
)

for sym in symbols:
    print(f"{sym.name} ({sym.kind}) at lines {sym.range[0]}-{sym.range[1]}")
```

### 5. Files-Only Mode
```python
paths = engine.search_files_only("query", Path("/path"))
for path in paths:
    print(path)
```

## SearchOptions Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `depth` | int | -1 | Search depth (-1 = unlimited) |
| `max_workers` | int | 8 | Parallel worker threads |
| `limit_per_dir` | int | 10 | Max results per directory |
| `total_limit` | int | 100 | Total result limit |
| `include_symbols` | bool | False | Include symbol search |
| `files_only` | bool | False | Return only file paths |

## SearchResult Fields

| Field | Type | Description |
|-------|------|-------------|
| `path` | str | File path |
| `score` | float | BM25 relevance score |
| `excerpt` | str | Highlighted text snippet |
| `content` | str | Full matched content (optional) |
| `symbol` | Symbol | Matched symbol (optional) |

## SearchStats Fields

| Field | Type | Description |
|-------|------|-------------|
| `dirs_searched` | int | Number of directories searched |
| `files_matched` | int | Number of files with matches |
| `time_ms` | float | Total search time (milliseconds) |
| `errors` | List[str] | Error messages |

## Common Patterns

### Search Current Project
```python
result = engine.search("authentication", Path.cwd())
```

### Limit Depth for Speed
```python
options = SearchOptions(depth=2)  # Only 2 levels deep
result = engine.search("TODO", Path("/project"), options)
```

### Find All Implementations
```python
symbols = engine.search_symbols("__init__", Path("/project"), kind="function")
```

### Quick File List
```python
files = engine.search_files_only("config", Path("/project"))
```

### Comprehensive Search
```python
options = SearchOptions(
    depth=-1,
    total_limit=500,
    include_symbols=True
)
result = engine.search("api", Path("/project"), options)
print(f"Files: {len(result.results)}")
print(f"Symbols: {len(result.symbols)}")
```

## Performance Tips

1. **Use depth limits** for faster searches in large codebases
2. **Use files_only** when you don't need excerpts
3. **Reuse ChainSearchEngine** instance for multiple searches
4. **Adjust max_workers** based on CPU cores
5. **Use limit_per_dir** to reduce memory usage

## Error Handling

```python
result = engine.search("query", Path("/path"))

if result.stats.errors:
    print("Errors occurred:")
    for error in result.stats.errors:
        print(f"  - {error}")

if not result.results:
    print("No results found")
else:
    print(f"Found {len(result.results)} results")
```

## Cleanup

```python
registry.close()  # Close when done
```
