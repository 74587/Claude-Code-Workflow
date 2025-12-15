# CodexLens Hybrid Search Architecture Design

> **Version**: 1.0  
> **Date**: 2025-12-15  
> **Authors**: Gemini + Qwen + Claude (Collaborative Design)  
> **Status**: Design Proposal

---

## Executive Summary

本设计方案针对 CodexLens 当前文本搜索效果差、乱码问题、无增量索引等痛点，综合借鉴 **Codanna** (Tantivy N-gram + 复合排序) 和 **Code-Index-MCP** (双重索引 + AST解析) 的设计思想，提出全新的 **Dual-FTS Hybrid Search** 架构。

### 核心改进
| 问题 | 现状 | 目标方案 |
|------|------|----------|
| 乱码 | `errors="ignore"` 丢弃字节 | chardet 编码检测 + `errors="replace"` |
| 搜索效果差 | 单一 unicode61 分词 | Dual-FTS (精确 + Trigram 模糊) |
| 无模糊搜索 | 仅BM25精确匹配 | 复合排序 (Exact + Fuzzy + Prefix) |
| 重复索引 | 全量重建 | mtime 增量检测 |
| 语义割裂 | FTS与向量独立 | RRF 混合融合 |

---

## Part 1: Architecture Overview

### 1.1 Target Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         User Query: "auth login"                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       Query Preprocessor (NEW)                          │
│  • CamelCase split: UserAuth → "UserAuth" OR "User Auth"                │
│  • snake_case split: user_auth → "user_auth" OR "user auth"             │
│  • Encoding normalization                                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
┌──────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│   FTS Exact Search   │ │   FTS Fuzzy Search   │ │   Vector Search      │
│   (files_fts_exact)  │ │   (files_fts_fuzzy)  │ │   (VectorStore)      │
│   unicode61 + '_'    │ │   trigram tokenizer  │ │   Cosine similarity  │
│   BM25 scoring       │ │   Substring match    │ │   0.0 - 1.0 range    │
└──────────────────────┘ └──────────────────────┘ └──────────────────────┘
            │                       │                       │
            │     Results E         │     Results F         │    Results V
            └───────────────────────┼───────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Ranking Fusion Engine (NEW)                          │
│  • Reciprocal Rank Fusion (RRF): score = Σ 1/(k + rank_i)               │
│  • Score normalization (BM25 unbounded → 0-1)                           │
│  • Weighted linear fusion: w1*exact + w2*fuzzy + w3*vector              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Final Sorted Results                            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Architecture

```
codexlens/
├── storage/
│   ├── schema.py          # (NEW) Centralized schema definitions
│   ├── dir_index.py       # (MODIFY) Add Dual-FTS, incremental indexing
│   ├── sqlite_store.py    # (MODIFY) Add encoding detection
│   └── migrations/
│       └── migration_004_dual_fts.py  # (NEW) Schema migration
│
├── search/
│   ├── hybrid_search.py   # (NEW) HybridSearchEngine
│   ├── ranking.py         # (NEW) RRF and fusion algorithms
│   ├── query_parser.py    # (NEW) Query preprocessing
│   └── chain_search.py    # (MODIFY) Integrate hybrid search
│
├── parsers/
│   └── encoding.py        # (NEW) Encoding detection utility
│
└── semantic/
    └── vector_store.py    # (MODIFY) Integration with hybrid search
```

---

## Part 2: Detailed Component Design

### 2.1 Encoding Detection Module

**File**: `codexlens/parsers/encoding.py` (NEW)

```python
"""Robust encoding detection for file content."""
from pathlib import Path
from typing import Tuple, Optional

# Optional: chardet or charset-normalizer
try:
    import chardet
    HAS_CHARDET = True
except ImportError:
    HAS_CHARDET = False


def detect_encoding(content: bytes, default: str = "utf-8") -> str:
    """Detect encoding of byte content with fallback."""
    if HAS_CHARDET:
        result = chardet.detect(content[:10000])  # Sample first 10KB
        if result and result.get("confidence", 0) > 0.7:
            return result["encoding"] or default
    return default


def read_file_safe(path: Path) -> Tuple[str, str]:
    """Read file with encoding detection.
    
    Returns:
        Tuple of (content, detected_encoding)
    """
    raw_bytes = path.read_bytes()
    encoding = detect_encoding(raw_bytes)
    
    try:
        content = raw_bytes.decode(encoding, errors="replace")
    except (UnicodeDecodeError, LookupError):
        content = raw_bytes.decode("utf-8", errors="replace")
        encoding = "utf-8"
    
    return content, encoding
```

**Integration Point**: `dir_index.py:add_file()`, `index_tree.py:_build_single_dir()`

---

### 2.2 Dual-FTS Schema Design

**File**: `codexlens/storage/schema.py` (NEW)

```python
"""Centralized database schema definitions for Dual-FTS architecture."""

# Schema version for migration tracking
SCHEMA_VERSION = 4

# Standard FTS5 for exact matching (code symbols, identifiers)
FTS_EXACT_SCHEMA = """
CREATE VIRTUAL TABLE IF NOT EXISTS files_fts_exact USING fts5(
    name, full_path UNINDEXED, content,
    content='files',
    content_rowid='id',
    tokenize="unicode61 tokenchars '_-'"
)
"""

# Trigram FTS5 for fuzzy/substring matching (requires SQLite 3.34+)
FTS_FUZZY_SCHEMA = """
CREATE VIRTUAL TABLE IF NOT EXISTS files_fts_fuzzy USING fts5(
    name, full_path UNINDEXED, content,
    content='files',
    content_rowid='id',
    tokenize="trigram"
)
"""

# Fallback if trigram not available
FTS_FUZZY_FALLBACK = """
CREATE VIRTUAL TABLE IF NOT EXISTS files_fts_fuzzy USING fts5(
    name, full_path UNINDEXED, content,
    content='files',
    content_rowid='id',
    tokenize="unicode61 tokenchars '_-' separators '.'"
)
"""

def check_trigram_support(conn) -> bool:
    """Check if SQLite supports trigram tokenizer."""
    try:
        conn.execute("CREATE VIRTUAL TABLE _test_trigram USING fts5(x, tokenize='trigram')")
        conn.execute("DROP TABLE _test_trigram")
        return True
    except Exception:
        return False


def create_dual_fts_schema(conn) -> dict:
    """Create Dual-FTS tables with fallback.
    
    Returns:
        dict with 'exact_table', 'fuzzy_table', 'trigram_enabled' keys
    """
    result = {"exact_table": "files_fts_exact", "fuzzy_table": "files_fts_fuzzy"}
    
    # Create exact FTS (always available)
    conn.execute(FTS_EXACT_SCHEMA)
    
    # Create fuzzy FTS (with trigram if supported)
    if check_trigram_support(conn):
        conn.execute(FTS_FUZZY_SCHEMA)
        result["trigram_enabled"] = True
    else:
        conn.execute(FTS_FUZZY_FALLBACK)
        result["trigram_enabled"] = False
    
    # Create triggers for dual-table sync
    conn.execute("""
        CREATE TRIGGER IF NOT EXISTS files_ai_exact AFTER INSERT ON files BEGIN
            INSERT INTO files_fts_exact(rowid, name, full_path, content) 
            VALUES (new.id, new.name, new.full_path, new.content);
        END
    """)
    conn.execute("""
        CREATE TRIGGER IF NOT EXISTS files_ai_fuzzy AFTER INSERT ON files BEGIN
            INSERT INTO files_fts_fuzzy(rowid, name, full_path, content) 
            VALUES (new.id, new.name, new.full_path, new.content);
        END
    """)
    # ... similar triggers for UPDATE and DELETE
    
    return result
```

---

### 2.3 Hybrid Search Engine

**File**: `codexlens/search/hybrid_search.py` (NEW)

```python
"""Hybrid search engine combining FTS and semantic search with RRF fusion."""
from dataclasses import dataclass
from typing import List, Optional
from concurrent.futures import ThreadPoolExecutor

from codexlens.entities import SearchResult
from codexlens.search.ranking import reciprocal_rank_fusion, normalize_scores


@dataclass
class HybridSearchConfig:
    """Configuration for hybrid search."""
    enable_exact: bool = True
    enable_fuzzy: bool = True
    enable_vector: bool = True
    exact_weight: float = 0.4
    fuzzy_weight: float = 0.3
    vector_weight: float = 0.3
    rrf_k: int = 60  # RRF constant
    max_results: int = 20


class HybridSearchEngine:
    """Multi-modal search with RRF fusion."""
    
    def __init__(self, dir_index_store, vector_store=None, config: HybridSearchConfig = None):
        self.store = dir_index_store
        self.vector_store = vector_store
        self.config = config or HybridSearchConfig()
    
    def search(self, query: str, limit: int = 20) -> List[SearchResult]:
        """Execute hybrid search with parallel retrieval and RRF fusion."""
        results_map = {}
        
        # Parallel retrieval
        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {}
            
            if self.config.enable_exact:
                futures["exact"] = executor.submit(
                    self._search_exact, query, limit * 2
                )
            if self.config.enable_fuzzy:
                futures["fuzzy"] = executor.submit(
                    self._search_fuzzy, query, limit * 2
                )
            if self.config.enable_vector and self.vector_store:
                futures["vector"] = executor.submit(
                    self._search_vector, query, limit * 2
                )
            
            for name, future in futures.items():
                try:
                    results_map[name] = future.result(timeout=10)
                except Exception:
                    results_map[name] = []
        
        # Apply RRF fusion
        fused = reciprocal_rank_fusion(
            results_map,
            weights={
                "exact": self.config.exact_weight,
                "fuzzy": self.config.fuzzy_weight,
                "vector": self.config.vector_weight,
            },
            k=self.config.rrf_k
        )
        
        return fused[:limit]
    
    def _search_exact(self, query: str, limit: int) -> List[SearchResult]:
        """Exact FTS search with BM25."""
        return self.store.search_fts_exact(query, limit)
    
    def _search_fuzzy(self, query: str, limit: int) -> List[SearchResult]:
        """Fuzzy FTS search with trigram."""
        return self.store.search_fts_fuzzy(query, limit)
    
    def _search_vector(self, query: str, limit: int) -> List[SearchResult]:
        """Semantic vector search."""
        if not self.vector_store:
            return []
        return self.vector_store.search_similar(query, limit)
```

---

### 2.4 RRF Ranking Fusion

**File**: `codexlens/search/ranking.py` (NEW)

```python
"""Ranking fusion algorithms for hybrid search."""
from typing import Dict, List
from collections import defaultdict

from codexlens.entities import SearchResult


def reciprocal_rank_fusion(
    results_map: Dict[str, List[SearchResult]],
    weights: Dict[str, float] = None,
    k: int = 60
) -> List[SearchResult]:
    """Reciprocal Rank Fusion (RRF) algorithm.
    
    Formula: score(d) = Σ weight_i / (k + rank_i(d))
    
    Args:
        results_map: Dict mapping source name to ranked results
        weights: Optional weights per source (default equal)
        k: RRF constant (default 60)
    
    Returns:
        Fused and re-ranked results
    """
    if weights is None:
        weights = {name: 1.0 for name in results_map}
    
    # Normalize weights
    total_weight = sum(weights.values())
    weights = {k: v / total_weight for k, v in weights.items()}
    
    # Calculate RRF scores
    rrf_scores = defaultdict(float)
    path_to_result = {}
    
    for source_name, results in results_map.items():
        weight = weights.get(source_name, 1.0)
        for rank, result in enumerate(results, start=1):
            rrf_scores[result.path] += weight / (k + rank)
            if result.path not in path_to_result:
                path_to_result[result.path] = result
    
    # Sort by RRF score
    sorted_paths = sorted(rrf_scores.keys(), key=lambda p: rrf_scores[p], reverse=True)
    
    # Build final results with updated scores
    fused_results = []
    for path in sorted_paths:
        result = path_to_result[path]
        fused_results.append(SearchResult(
            path=result.path,
            score=rrf_scores[path],
            excerpt=result.excerpt,
        ))
    
    return fused_results


def normalize_bm25_score(score: float, max_score: float = 100.0) -> float:
    """Normalize BM25 score to 0-1 range.
    
    BM25 scores are unbounded and typically negative in SQLite FTS5.
    This normalizes them for fusion with other score types.
    """
    if score >= 0:
        return 0.0
    # BM25 in SQLite is negative; more negative = better match
    return min(1.0, abs(score) / max_score)
```

---

### 2.5 Incremental Indexing

**File**: `codexlens/storage/dir_index.py` (MODIFY)

```python
# Add to DirIndexStore class:

def needs_reindex(self, path: Path) -> bool:
    """Check if file needs re-indexing based on mtime.
    
    Returns:
        True if file should be reindexed, False to skip
    """
    with self._lock:
        conn = self._get_connection()
        row = conn.execute(
            "SELECT mtime FROM files WHERE full_path = ?",
            (str(path.resolve()),)
        ).fetchone()
        
        if row is None:
            return True  # New file
        
        stored_mtime = row["mtime"]
        if stored_mtime is None:
            return True
        
        try:
            current_mtime = path.stat().st_mtime
            # Allow 1ms tolerance for floating point comparison
            return abs(current_mtime - stored_mtime) > 0.001
        except OSError:
            return False  # File doesn't exist anymore


def add_file_incremental(
    self,
    file_path: Path,
    content: str,
    indexed_file: IndexedFile,
) -> Optional[int]:
    """Add file to index only if changed.
    
    Returns:
        file_id if indexed, None if skipped
    """
    if not self.needs_reindex(file_path):
        # Return existing file_id without re-indexing
        with self._lock:
            conn = self._get_connection()
            row = conn.execute(
                "SELECT id FROM files WHERE full_path = ?",
                (str(file_path.resolve()),)
            ).fetchone()
            return int(row["id"]) if row else None
    
    # Proceed with full indexing
    return self.add_file(file_path, content, indexed_file)
```

---

### 2.6 Query Preprocessor

**File**: `codexlens/search/query_parser.py` (NEW)

```python
"""Query preprocessing for improved search recall."""
import re
from typing import List


def split_camel_case(text: str) -> List[str]:
    """Split CamelCase into words: UserAuth -> ['User', 'Auth']"""
    return re.findall(r'[A-Z]?[a-z]+|[A-Z]+(?=[A-Z]|$)', text)


def split_snake_case(text: str) -> List[str]:
    """Split snake_case into words: user_auth -> ['user', 'auth']"""
    return text.split('_')


def preprocess_query(query: str) -> str:
    """Preprocess query for better recall.
    
    Transforms:
    - UserAuth -> "UserAuth" OR "User Auth"
    - user_auth -> "user_auth" OR "user auth"
    """
    terms = []
    
    for word in query.split():
        # Handle CamelCase
        if re.match(r'^[A-Z][a-z]+[A-Z]', word):
            parts = split_camel_case(word)
            terms.append(f'"{word}"')  # Original
            terms.append(f'"{" ".join(parts)}"')  # Split
        
        # Handle snake_case
        elif '_' in word:
            parts = split_snake_case(word)
            terms.append(f'"{word}"')  # Original
            terms.append(f'"{" ".join(parts)}"')  # Split
        
        else:
            terms.append(word)
    
    # Combine with OR for recall
    return " OR ".join(terms) if len(terms) > 1 else terms[0]
```

---

## Part 3: Database Schema Changes

### 3.1 New Tables

```sql
-- Exact FTS table (code-friendly tokenizer)
CREATE VIRTUAL TABLE files_fts_exact USING fts5(
    name, full_path UNINDEXED, content,
    content='files',
    content_rowid='id',
    tokenize="unicode61 tokenchars '_-'"
);

-- Fuzzy FTS table (trigram for substring matching)
CREATE VIRTUAL TABLE files_fts_fuzzy USING fts5(
    name, full_path UNINDEXED, content,
    content='files',
    content_rowid='id',
    tokenize="trigram"
);

-- File hash for robust change detection (optional enhancement)
ALTER TABLE files ADD COLUMN content_hash TEXT;
CREATE INDEX idx_files_hash ON files(content_hash);
```

### 3.2 Migration Script

**File**: `codexlens/storage/migrations/migration_004_dual_fts.py` (NEW)

```python
"""Migration 004: Dual-FTS architecture."""

def upgrade(db_conn):
    """Upgrade to Dual-FTS schema."""
    cursor = db_conn.cursor()
    
    # Check current schema
    tables = cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'files_fts%'"
    ).fetchall()
    existing = {t[0] for t in tables}
    
    # Drop legacy single FTS table
    if "files_fts" in existing and "files_fts_exact" not in existing:
        cursor.execute("DROP TABLE IF EXISTS files_fts")
    
    # Create new Dual-FTS tables
    from codexlens.storage.schema import create_dual_fts_schema
    result = create_dual_fts_schema(db_conn)
    
    # Rebuild indexes from existing content
    cursor.execute("""
        INSERT INTO files_fts_exact(rowid, name, full_path, content)
        SELECT id, name, full_path, content FROM files
    """)
    cursor.execute("""
        INSERT INTO files_fts_fuzzy(rowid, name, full_path, content)
        SELECT id, name, full_path, content FROM files
    """)
    
    db_conn.commit()
    return result
```

---

## Part 4: API Contracts

### 4.1 Search API

```python
# New unified search interface
class SearchOptions:
    query: str
    limit: int = 20
    offset: int = 0
    enable_exact: bool = True      # FTS exact matching
    enable_fuzzy: bool = True      # Trigram fuzzy matching  
    enable_vector: bool = False    # Semantic vector search
    exact_weight: float = 0.4
    fuzzy_weight: float = 0.3
    vector_weight: float = 0.3

# API endpoint signature
def search(options: SearchOptions) -> SearchResponse:
    """Unified hybrid search."""
    pass

class SearchResponse:
    results: List[SearchResult]
    total: int
    search_modes: List[str]  # ["exact", "fuzzy", "vector"]
    trigram_available: bool
```

### 4.2 Indexing API

```python
# Enhanced indexing with incremental support
class IndexOptions:
    path: Path
    incremental: bool = True     # Skip unchanged files
    force: bool = False          # Force reindex all
    detect_encoding: bool = True # Auto-detect file encoding

def index_directory(options: IndexOptions) -> IndexResult:
    """Index directory with incremental support."""
    pass

class IndexResult:
    total_files: int
    indexed_files: int
    skipped_files: int  # Unchanged files skipped
    encoding_errors: int
```

---

## Part 5: Implementation Roadmap

### Phase 1: Foundation (Week 1)
- [ ] Implement encoding detection module
- [ ] Update file reading in `dir_index.py` and `index_tree.py`
- [ ] Add chardet/charset-normalizer dependency
- [ ] Write unit tests for encoding detection

### Phase 2: Dual-FTS (Week 2)
- [ ] Create `schema.py` with Dual-FTS definitions
- [ ] Implement trigram compatibility check
- [ ] Write migration script
- [ ] Update `DirIndexStore` with dual search methods
- [ ] Test FTS5 trigram on target platforms

### Phase 3: Hybrid Search (Week 3)
- [ ] Implement `HybridSearchEngine`
- [ ] Implement `ranking.py` with RRF
- [ ] Create `query_parser.py`
- [ ] Integrate with `ChainSearchEngine`
- [ ] Write integration tests

### Phase 4: Incremental Indexing (Week 4)
- [ ] Add `needs_reindex()` method
- [ ] Implement `add_file_incremental()`
- [ ] Update `IndexTreeBuilder` to use incremental API
- [ ] Add optional content hash column
- [ ] Performance benchmarking

### Phase 5: Vector Integration (Week 5)
- [ ] Update `VectorStore` for hybrid integration
- [ ] Implement vector search in `HybridSearchEngine`
- [ ] Tune RRF weights for optimal results
- [ ] End-to-end testing

---

## Part 6: Performance Considerations

### 6.1 Indexing Performance
- **Incremental indexing**: Skip ~90% of files on re-index
- **Parallel file processing**: ThreadPoolExecutor for parsing
- **Batch commits**: Commit every 100 files to reduce I/O

### 6.2 Search Performance
- **Parallel retrieval**: Execute FTS + Vector searches concurrently
- **Early termination**: Stop after finding enough high-confidence matches
- **Result caching**: LRU cache for frequent queries

### 6.3 Storage Overhead
- **Dual-FTS**: ~2x FTS index size (exact + fuzzy)
- **Trigram**: ~3-5x content size (due to trigram expansion)
- **Mitigation**: Optional fuzzy index, configurable per project

---

## Part 7: Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| SQLite trigram not available | Medium | High | Fallback to extended unicode61 |
| Performance degradation | Low | Medium | Parallel search, caching |
| Migration data loss | Low | High | Backup before migration |
| Encoding detection false positives | Medium | Low | Use replace mode, log warnings |

---

## Appendix: Reference Project Learnings

### From Codanna (Rust)
- **N-gram tokenizer (3-10)**: Enables partial matching for code symbols
- **Compound BooleanQuery**: Combines exact + fuzzy + prefix in single query
- **File hash change detection**: More robust than mtime alone

### From Code-Index-MCP (Python)
- **Dual-index architecture**: Fast shallow index + rich deep index
- **External tool integration**: Wrap ripgrep for performance
- **AST-based parsing**: Single-pass symbol extraction
- **ReDoS protection**: Validate regex patterns before execution
