# CodexLens Embeddings Statistics Improvements

## Summary

Improved the CodexLens `init` and `status` commands to return comprehensive embeddings statistics, making it easy for users to understand embeddings coverage.

## Changes Made

### 1. Updated `init` command (Task 1)

**File**: `codex-lens/src/codexlens/cli/commands.py` (lines 142-219)

**Key Changes**:
- Changed from `generate_embeddings()` to `generate_embeddings_recursive()`
- Now processes all `_index.db` files recursively in the index tree
- Passes `index_root` (directory) instead of `index_path` (file)
- Returns comprehensive coverage statistics after generation

**Imports Added**:
```python
from codexlens.cli.embedding_manager import generate_embeddings_recursive, get_embeddings_status
```

**Result Structure**:
```json
{
  "embeddings": {
    "generated": true,
    "total_indexes": 26,
    "total_files": 303,
    "files_with_embeddings": 303,
    "coverage_percent": 100.0,
    "total_chunks": 500
  }
}
```

**Console Output**:
- Shows files processed count
- Shows total chunks created
- Shows indexes processed (successful/total)

### 2. Updated `status` command (Task 2)

**File**: `codex-lens/src/codexlens/cli/commands.py` (lines 642-713)

**Key Changes**:
- Added embeddings coverage check using `get_embeddings_status()`
- Updates `vector_search` feature flag based on coverage (>= 50%)
- Includes embeddings data in JSON output
- Displays embeddings statistics in console output

**Imports Added**:
```python
from codexlens.cli.embedding_manager import get_embeddings_status
```

**Result Structure**:
```json
{
  "embeddings": {
    "total_indexes": 26,
    "total_files": 303,
    "files_with_embeddings": 303,
    "files_without_embeddings": 0,
    "coverage_percent": 100.0,
    "total_chunks": 500,
    "indexes_with_embeddings": 26,
    "indexes_without_embeddings": 0
  },
  "features": {
    "exact_fts": true,
    "fuzzy_fts": true,
    "hybrid_search": true,
    "vector_search": true  // true when coverage >= 50%
  }
}
```

**Console Output**:
```
Search Backends:
  Exact FTS: ✓ (unicode61)
  Fuzzy FTS: ✓ (trigram)
  Hybrid Search: ✓ (RRF fusion)
  Vector Search: ✓ (embeddings available)

Embeddings Coverage:
  Total Indexes: 26
  Total Files: 303
  Files with Embeddings: 303
  Coverage: 100.0%
  Total Chunks: 500
```

## Benefits

1. **Transparency**: Users can now see exactly what embeddings were generated
2. **Coverage Visibility**: Clear percentage showing embeddings coverage across all files
3. **Recursive Processing**: All index databases in the tree are processed, not just the root
4. **Feature Detection**: Vector search is automatically enabled when coverage is sufficient (>= 50%)
5. **Comprehensive Stats**: Shows total indexes, files, chunks, and coverage percentage

## Backward Compatibility

- All changes are backward compatible
- Gracefully handles cases where embeddings are not available
- ImportError handling for when embedding_manager is not available
- Existing JSON output structure is extended, not changed

## Testing

Created test script: `test_embeddings_improvements.py`

Tests verify:
- Init command reports embeddings statistics correctly
- Status command shows embeddings coverage
- JSON output includes all required fields
- Console output displays statistics properly

## Usage Examples

### Init with embeddings
```bash
codexlens init /path/to/project --json
# Returns comprehensive embeddings statistics
```

### Check status
```bash
codexlens status --json
# Shows embeddings coverage and feature availability
```

### Init without embeddings
```bash
codexlens init /path/to/project --no-embeddings --json
# Returns embeddings: {"generated": false, "error": "Skipped (--no-embeddings)"}
```

## Files Modified

1. `codex-lens/src/codexlens/cli/commands.py` - Updated init and status commands

## Implementation Details

### Init Command Flow
1. Build index tree as before
2. If `--no-embeddings` not set:
   - Call `generate_embeddings_recursive(index_root)` instead of `generate_embeddings(index_path)`
   - After generation, call `get_embeddings_status(index_root)` to get coverage stats
   - Include comprehensive statistics in result
3. Return result with embeddings coverage data

### Status Command Flow
1. Collect index statistics as before
2. Call `get_embeddings_status(index_root)` to check embeddings
3. Set `vector_search` feature flag based on coverage >= 50%
4. Include embeddings info in JSON output
5. Display embeddings statistics in console output

## Error Handling

- Handles ImportError when embedding_manager not available
- Handles cases where embeddings don't exist (returns 0% coverage)
- Graceful fallback if get_embeddings_status fails
- Debug logging for failed operations
