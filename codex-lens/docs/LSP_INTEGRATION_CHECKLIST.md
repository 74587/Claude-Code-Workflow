# codex-lens LSP Integration Execution Checklist

> Generated: 2026-01-15
> Based on: Gemini multi-round deep analysis
> Status: Ready for implementation

---

## Phase 1: LSP Server Foundation (Priority: HIGH)

### 1.1 Create LSP Server Entry Point
- [ ] **Install pygls dependency**
  ```bash
  pip install pygls
  ```
- [ ] **Create `src/codexlens/lsp/__init__.py`**
  - Export: `CodexLensServer`, `start_server`
- [ ] **Create `src/codexlens/lsp/server.py`**
  - Class: `CodexLensServer(LanguageServer)`
  - Initialize: `ChainSearchEngine`, `GlobalSymbolIndex`, `WatcherManager`
  - Lifecycle: Start `WatcherManager` on `initialize` request

### 1.2 Implement Core LSP Handlers
- [ ] **`textDocument/definition`** handler
  - Source: `GlobalSymbolIndex.search()` exact match
  - Reference: `storage/global_index.py:173`
  - Return: `Location(uri, Range)`

- [ ] **`textDocument/completion`** handler
  - Source: `GlobalSymbolIndex.search(prefix_mode=True)`
  - Reference: `storage/global_index.py:173`
  - Return: `CompletionItem[]`

- [ ] **`workspace/symbol`** handler
  - Source: `ChainSearchEngine.search_symbols()`
  - Reference: `search/chain_search.py:618`
  - Return: `SymbolInformation[]`

### 1.3 Wire File Watcher to LSP Events
- [ ] **`workspace/didChangeWatchedFiles`** handler
  - Delegate to: `WatcherManager.process_changes()`
  - Reference: `watcher/manager.py:53`

- [ ] **`textDocument/didSave`** handler
  - Trigger: `IncrementalIndexer` for single file
  - Reference: `watcher/incremental_indexer.py`

### 1.4 Deliverables
- [ ] Unit tests for LSP handlers
- [ ] Integration test: definition lookup
- [ ] Integration test: completion prefix search
- [ ] Benchmark: query latency < 50ms

---

## Phase 2: Find References Implementation (Priority: MEDIUM)

### 2.1 Create `search_references` Method
- [ ] **Add to `src/codexlens/search/chain_search.py`**
  ```python
  def search_references(
      self,
      symbol_name: str,
      source_path: Path,
      depth: int = -1
  ) -> List[ReferenceResult]:
      """Find all references to a symbol across the project."""
  ```

### 2.2 Implement Parallel Query Orchestration
- [ ] **Collect index paths**
  - Use: `_collect_index_paths()` existing method

- [ ] **Parallel query execution**
  - ThreadPoolExecutor across all `_index.db`
  - SQL: `SELECT * FROM code_relationships WHERE target_qualified_name = ?`
  - Reference: `storage/sqlite_store.py:348`

- [ ] **Result aggregation**
  - Deduplicate by file:line
  - Sort by file path, then line number

### 2.3 LSP Handler
- [ ] **`textDocument/references`** handler
  - Call: `ChainSearchEngine.search_references()`
  - Return: `Location[]`

### 2.4 Deliverables
- [ ] Unit test: single-index reference lookup
- [ ] Integration test: cross-directory references
- [ ] Benchmark: < 200ms for 10+ index files

---

## Phase 3: Enhanced Hover Information (Priority: MEDIUM)

### 3.1 Implement Hover Data Extraction
- [ ] **Create `src/codexlens/lsp/hover_provider.py`**
  ```python
  class HoverProvider:
      def get_hover_info(self, symbol: Symbol) -> HoverInfo:
          """Extract hover information for a symbol."""
  ```

### 3.2 Data Sources
- [ ] **Symbol metadata**
  - Source: `GlobalSymbolIndex.search()`
  - Fields: `kind`, `name`, `file_path`, `range`

- [ ] **Source code extraction**
  - Source: `SQLiteStore.files` table
  - Reference: `storage/sqlite_store.py:284`
  - Extract: Lines from `range[0]` to `range[1]`

### 3.3 LSP Handler
- [ ] **`textDocument/hover`** handler
  - Return: `Hover(contents=MarkupContent)`
  - Format: Markdown with code fence

### 3.4 Deliverables
- [ ] Unit test: hover for function/class/variable
- [ ] Integration test: multi-line function signature

---

## Phase 4: MCP Bridge for Claude Code (Priority: HIGH VALUE)

### 4.1 Define MCP Schema
- [ ] **Create `src/codexlens/mcp/__init__.py`**
- [ ] **Create `src/codexlens/mcp/schema.py`**
  ```python
  @dataclass
  class MCPContext:
      version: str = "1.0"
      context_type: str
      symbol: Optional[SymbolInfo]
      definition: Optional[str]
      references: List[ReferenceInfo]
      related_symbols: List[SymbolInfo]
  ```

### 4.2 Create MCP Provider
- [ ] **Create `src/codexlens/mcp/provider.py`**
  ```python
  class MCPProvider:
      def build_context(
          self,
          symbol_name: str,
          context_type: str = "symbol_explanation"
      ) -> MCPContext:
          """Build structured context for LLM consumption."""
  ```

### 4.3 Context Building Logic
- [ ] **Symbol lookup**
  - Use: `GlobalSymbolIndex.search()`

- [ ] **Definition extraction**
  - Use: `SQLiteStore` file content

- [ ] **References collection**
  - Use: `ChainSearchEngine.search_references()`

- [ ] **Related symbols**
  - Use: `code_relationships` for imports/calls

### 4.4 Hook Integration Points
- [ ] **Document `pre-tool` hook interface**
  ```python
  def pre_tool_hook(action: str, params: dict) -> MCPContext:
      """Called before LLM action to gather context."""
  ```

- [ ] **Document `post-tool` hook interface**
  ```python
  def post_tool_hook(action: str, result: Any) -> None:
      """Called after LSP action for proactive caching."""
  ```

### 4.5 Deliverables
- [ ] MCP schema JSON documentation
- [ ] Unit test: context building
- [ ] Integration test: hook → MCP → JSON output

---

## Phase 5: Advanced Features (Priority: LOW)

### 5.1 Custom LSP Commands
- [ ] **`codexlens/hybridSearch`**
  - Expose: `HybridSearchEngine.search()`
  - Reference: `search/hybrid_search.py`

- [ ] **`codexlens/symbolGraph`**
  - Return: Symbol relationship graph
  - Source: `code_relationships` table

### 5.2 Proactive Context Caching
- [ ] **Implement `post-tool` hook caching**
  - After `go-to-definition`: pre-fetch references
  - Cache TTL: 5 minutes
  - Storage: In-memory LRU

### 5.3 Performance Optimizations
- [ ] **Connection pooling**
  - Reference: `storage/sqlite_store.py` thread-local

- [ ] **Result caching**
  - LRU cache for frequent queries
  - Invalidate on file change

---

## File Structure After Implementation

```
src/codexlens/
├── lsp/                          # NEW
│   ├── __init__.py
│   ├── server.py                 # Main LSP server
│   ├── handlers.py               # LSP request handlers
│   ├── hover_provider.py         # Hover information
│   └── utils.py                  # LSP utilities
│
├── mcp/                          # NEW
│   ├── __init__.py
│   ├── schema.py                 # MCP data models
│   ├── provider.py               # Context builder
│   └── hooks.py                  # Hook interfaces
│
├── search/
│   ├── chain_search.py           # MODIFY: add search_references()
│   └── ...
│
└── ...
```

---

## Dependencies to Add

```toml
# pyproject.toml
[project.optional-dependencies]
lsp = [
    "pygls>=1.3.0",
]
```

---

## Testing Strategy

### Unit Tests
```
tests/
├── lsp/
│   ├── test_definition.py
│   ├── test_completion.py
│   ├── test_references.py
│   └── test_hover.py
│
└── mcp/
    ├── test_schema.py
    └── test_provider.py
```

### Integration Tests
- [ ] Full LSP handshake test
- [ ] Multi-file project navigation
- [ ] Incremental index update via didSave

### Performance Benchmarks
| Operation | Target | Acceptable |
|-----------|--------|------------|
| Definition lookup | < 30ms | < 50ms |
| Completion (100 items) | < 50ms | < 100ms |
| Find references (10 files) | < 150ms | < 200ms |
| Initial indexing (1000 files) | < 60s | < 120s |

---

## Execution Order

```
Week 1: Phase 1.1 → 1.2 → 1.3 → 1.4
Week 2: Phase 2.1 → 2.2 → 2.3 → 2.4
Week 3: Phase 3 + Phase 4.1 → 4.2
Week 4: Phase 4.3 → 4.4 → 4.5
Week 5: Phase 5 (optional) + Polish
```

---

## Quick Start Commands

```bash
# Install LSP dependencies
pip install pygls

# Run LSP server (after implementation)
python -m codexlens.lsp --stdio

# Test LSP connection
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | python -m codexlens.lsp --stdio
```

---

## Reference Links

- pygls Documentation: https://pygls.readthedocs.io/
- LSP Specification: https://microsoft.github.io/language-server-protocol/
- codex-lens GlobalSymbolIndex: `storage/global_index.py:173`
- codex-lens ChainSearchEngine: `search/chain_search.py:618`
- codex-lens WatcherManager: `watcher/manager.py:53`
