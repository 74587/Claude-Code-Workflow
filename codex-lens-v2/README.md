# codexlens-search

Lightweight semantic code search engine with 2-stage vector search, full-text search, and Reciprocal Rank Fusion.

## Overview

codexlens-search provides fast, accurate code search through a multi-stage retrieval pipeline:

1. **Binary coarse search** - Hamming-distance filtering narrows candidates quickly
2. **ANN fine search** - HNSW or FAISS refines the candidate set with float vectors
3. **Full-text search** - SQLite FTS5 handles exact and fuzzy keyword matching
4. **RRF fusion** - Reciprocal Rank Fusion merges vector and text results
5. **Reranking** - Optional cross-encoder or API-based reranker for final ordering

The core library has **zero required dependencies**. Install optional extras to enable semantic search, GPU acceleration, or FAISS backends.

## Installation

```bash
# Core only (FTS search, no vector search)
pip install codexlens-search

# With semantic search (recommended)
pip install codexlens-search[semantic]

# Semantic search + GPU acceleration
pip install codexlens-search[semantic-gpu]

# With FAISS backend (CPU)
pip install codexlens-search[faiss-cpu]

# With API-based reranker
pip install codexlens-search[reranker-api]

# Everything (semantic + GPU + FAISS + reranker)
pip install codexlens-search[semantic-gpu,faiss-gpu,reranker-api]
```

## Quick Start

```python
from codexlens_search import Config, IndexingPipeline, SearchPipeline
from codexlens_search.core import create_ann_index, create_binary_index
from codexlens_search.embed.local import FastEmbedEmbedder
from codexlens_search.rerank.local import LocalReranker
from codexlens_search.search.fts import FTSEngine

# 1. Configure
config = Config(embed_model="BAAI/bge-small-en-v1.5", embed_dim=384)

# 2. Create components
embedder = FastEmbedEmbedder(config)
binary_store = create_binary_index(config, db_path="index/binary.db")
ann_index = create_ann_index(config, index_path="index/ann.bin")
fts = FTSEngine("index/fts.db")
reranker = LocalReranker()

# 3. Index files
indexer = IndexingPipeline(embedder, binary_store, ann_index, fts, config)
stats = indexer.index_directory("./src")
print(f"Indexed {stats.files_processed} files, {stats.chunks_created} chunks")

# 4. Search
pipeline = SearchPipeline(embedder, binary_store, ann_index, reranker, fts, config)
results = pipeline.search("authentication handler", top_k=10)
for r in results:
    print(f"  {r.path} (score={r.score:.3f})")
```

## Extras

| Extra | Dependencies | Description |
|-------|-------------|-------------|
| `semantic` | hnswlib, numpy, fastembed | Vector search with local embeddings |
| `gpu` | onnxruntime-gpu | GPU-accelerated embedding inference |
| `semantic-gpu` | semantic + gpu combined | Vector search with GPU acceleration |
| `faiss-cpu` | faiss-cpu | FAISS ANN backend (CPU) |
| `faiss-gpu` | faiss-gpu | FAISS ANN backend (GPU) |
| `reranker-api` | httpx | Remote reranker API client |
| `dev` | pytest, pytest-cov | Development and testing |

## Architecture

```
Query
  |
  v
[Embedder] --> query vector
  |
  +---> [BinaryStore.coarse_search] --> candidate IDs (Hamming distance)
  |         |
  |         v
  +---> [ANNIndex.fine_search] ------> ranked IDs (cosine/L2)
  |         |
  |         v  (intersect)
  |     vector_results
  |
  +---> [FTSEngine.exact_search] ----> exact text matches
  +---> [FTSEngine.fuzzy_search] ----> fuzzy text matches
  |
  v
[RRF Fusion] --> merged ranking (adaptive weights by query intent)
  |
  v
[Reranker] --> final top-k results
```

### Key Design Decisions

- **2-stage vector search**: Binary coarse search (fast Hamming distance on binarized vectors) filters candidates before the more expensive ANN search. This keeps memory usage low and search fast even on large corpora.
- **Parallel retrieval**: Vector search and FTS run concurrently via ThreadPoolExecutor.
- **Adaptive fusion weights**: Query intent detection adjusts RRF weights between vector and text signals.
- **Backend abstraction**: ANN index supports both hnswlib and FAISS backends via a factory function.
- **Zero core dependencies**: The base package requires only Python 3.10+. All heavy dependencies are optional.

## Configuration

The `Config` dataclass controls all pipeline parameters:

```python
from codexlens_search import Config

config = Config(
    embed_model="BAAI/bge-small-en-v1.5",  # embedding model name
    embed_dim=384,                           # embedding dimension
    embed_batch_size=64,                     # batch size for embedding
    ann_backend="auto",                      # 'auto', 'faiss', 'hnswlib'
    binary_top_k=200,                        # binary coarse search candidates
    ann_top_k=50,                            # ANN fine search candidates
    fts_top_k=50,                            # FTS results per method
    device="auto",                           # 'auto', 'cuda', 'cpu'
)
```

## Development

```bash
git clone https://github.com/nicepkg/codexlens-search.git
cd codexlens-search
pip install -e ".[dev,semantic]"
pytest
```

## License

MIT
