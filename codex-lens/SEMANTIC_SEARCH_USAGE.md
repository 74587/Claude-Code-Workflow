# Semantic Search Integration

## Overview
The ChainSearchEngine now supports semantic keyword search in addition to FTS5 full-text search.

## Usage

### Enable Semantic Search

```python
from pathlib import Path
from codexlens.search.chain_search import ChainSearchEngine, SearchOptions
from codexlens.storage.registry import RegistryStore
from codexlens.storage.path_mapper import PathMapper

# Initialize
registry = RegistryStore()
registry.initialize()
mapper = PathMapper()
engine = ChainSearchEngine(registry, mapper)

# Create options with semantic search enabled
options = SearchOptions(
    include_semantic=True,  # Enable semantic keyword search
    total_limit=50
)

# Execute search
result = engine.search("authentication", Path("./src"), options)

# Results include both FTS and semantic matches
for r in result.results:
    print(f"{r.path}: {r.score:.2f} - {r.excerpt}")
```

### How It Works

1. **FTS Search**: Traditional full-text search using SQLite FTS5
2. **Semantic Search**: Searches the `semantic_metadata.keywords` field
3. **Result Merging**: Semantic results are added with 0.8x weight
   - FTS results: BM25 score from SQLite
   - Semantic results: Base score of 10.0 * 0.8 = 8.0
4. **Deduplication**: `_merge_and_rank()` deduplicates by path, keeping highest score

### Result Format

- **FTS results**: Regular excerpt from matched content
- **Semantic results**: `Keywords: keyword1, keyword2, keyword3, ...`

### Prerequisites

Files must have semantic metadata generated via:

```bash
codex-lens enhance . --tool gemini
```

This uses CCW CLI to generate summaries, keywords, and purpose descriptions.

## Implementation Details

### Changes Made

1. **SearchOptions**: Added `include_semantic: bool = False` parameter
2. **_search_parallel()**: Passes `include_semantic` to worker threads
3. **_search_single_index()**: 
   - Accepts `include_semantic` parameter
   - Calls `DirIndexStore.search_semantic_keywords()` when enabled
   - Converts semantic matches to `SearchResult` objects
   - Applies 0.8x weight to semantic scores

### Score Weighting

```python
# FTS result (from BM25)
SearchResult(path="...", score=12.5, excerpt="...")

# Semantic result (fixed weighted score)
SearchResult(path="...", score=8.0, excerpt="Keywords: ...")
```

The 0.8x weight ensures semantic matches rank slightly lower than direct FTS matches
but still appear in relevant results.
