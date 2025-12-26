# CodexLens – Optimization Plan Changelog

This changelog tracks the **CodexLens optimization plan** milestones (not the Python package version in `pyproject.toml`).

## v1.0 (Optimization) – 2025-12-26

### Optimizations

1. **P0: Context-aware hybrid chunking**
   - Docstrings are extracted into dedicated chunks and excluded from code chunks.
   - Docstring chunks include `parent_symbol` metadata when the docstring belongs to a function/class/method.
   - Sliding-window chunk boundaries are deterministic for identical input.

2. **P1: Adaptive RRF weights (QueryIntent)**
   - Query intent is classified as `keyword` / `semantic` / `mixed`.
   - RRF weights adapt to intent:
     - `keyword`: exact-heavy (favors lexical matches)
     - `semantic`: vector-heavy (favors semantic matches)
     - `mixed`: keeps base/default weights

3. **P2: Symbol boost**
   - Fused results with an explicit symbol match (`symbol_name`) receive a multiplicative boost (default `1.5x`).

4. **P2: Embedding-based re-ranking (optional)**
   - A second-stage ranker can reorder top results by semantic similarity.
   - Re-ranking runs only when `Config.enable_reranking=True`.

5. **P3: Global symbol index (incremental + fast path)**
   - `GlobalSymbolIndex` stores project-wide symbols in one SQLite DB for fast symbol lookups.
   - `ChainSearchEngine.search_symbols()` uses the global index fast path when enabled.

### Migration Notes
- **Reindexing (recommended)**: deterministic chunking and docstring metadata affect stored chunks. For best results, regenerate indexes/embeddings after upgrading:
  - Rebuild indexes and/or re-run embedding generation for existing projects.
- **New config flags**:
  - `Config.enable_reranking` (default `False`)
  - `Config.reranking_top_k` (default `50`)
  - `Config.symbol_boost_factor` (default `1.5`)
  - `Config.global_symbol_index_enabled` (default `True`)
- **Breaking changes**: none (behavioral improvements only).

