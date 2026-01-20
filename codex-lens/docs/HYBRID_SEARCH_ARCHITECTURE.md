# Hybrid Search Architecture for CodexLens

> Embedding + Real-time LSP + Clustering + Reranking Pipeline

## Overview

This document describes the architecture for a hybrid intelligent code search system that combines:
1. **Low-dimensional embedding model** for semantic search
2. **Real-time LSP integration** for code structure analysis
3. **Graph-based clustering** for result organization
4. **Multi-factor reranking** for intelligent sorting

**Key Constraint**: Must use real-time LSP servers, NOT pre-indexed data.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         HybridSearchEngine                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     5-Stage Search Pipeline                          │   │
│  │                                                                      │   │
│  │  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌────┐│   │
│  │  │ Stage 1  │──▶│ Stage 2  │──▶│ Stage 3  │──▶│ Stage 4  │──▶│ S5 ││   │
│  │  │ Vector   │   │   LSP    │   │  Graph   │   │Clustering│   │Rank││   │
│  │  │ Search   │   │Expansion │   │ Building │   │ +Filter  │   │    ││   │
│  │  └──────────┘   └──────────┘   └──────────┘   └──────────┘   └────┘│   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐ │
│  │VectorSearchSvc  │  │   LspBridge     │  │      GraphBuilder           │ │
│  │                 │  │                 │  │                             │ │
│  │ • Embedding     │  │ • get_refs()    │  │ • build_from_seeds()        │ │
│  │ • FAISS/HNSW    │  │ • get_def()     │  │ • add_relationships()       │ │
│  │ • search()      │  │ • get_calls()   │  │ • CodeAssociationGraph      │ │
│  └────────┬────────┘  └────────┬────────┘  └─────────────────────────────┘ │
│           │                    │                                            │
└───────────┼────────────────────┼────────────────────────────────────────────┘
            │                    │
            ▼                    ▼
    ┌───────────────┐    ┌───────────────────────────────────────┐
    │ Embedding     │    │     LanguageServerMultiplexer         │
    │ Model (local) │    │  (from REAL_LSP_SERVER_PLAN.md)       │
    │               │    │                                       │
    │ sentence-     │    │  ┌─────┐ ┌─────┐ ┌─────┐ ┌──────────┐│
    │ transformers  │    │  │pylsp│ │gopls│ │tssvr│ │rust-anlzr││
    │               │    │  └─────┘ └─────┘ └─────┘ └──────────┘│
    └───────────────┘    └───────────────────────────────────────┘
```

## Core Components

### 1. HybridSearchEngine (`hybrid_search/engine.py`)

**Role**: Main orchestrator coordinating all services

```python
class HybridSearchEngine:
    def __init__(self):
        self.vector_service: VectorSearchService
        self.lsp_bridge: LspBridge
        self.graph_builder: GraphBuilder
        self.clustering_service: ClusteringService
        self.ranking_service: RankingService
    
    async def search(self, query: str, top_k: int = 10) -> List[SearchResultCluster]:
        # Stage 1: Vector search for seeds
        seeds = await self.vector_service.search(query, top_k=top_k * 2)
        
        # Stage 2-3: LSP expansion + Graph building
        graph = await self.graph_builder.build_from_seeds(seeds, self.lsp_bridge)
        
        # Stage 4: Clustering + Filtering
        clusters = self.clustering_service.cluster(graph)
        clusters = self.clustering_service.filter_noise(clusters)
        
        # Stage 5: Reranking
        ranked = self.ranking_service.rerank(clusters, seeds, query)
        
        return ranked[:top_k]
```

### 2. Data Structures (`hybrid_search/data_structures.py`)

```python
@dataclass
class CodeSymbolNode:
    """Graph node representing a code symbol"""
    id: str                    # Unique: file_path:name:line
    name: str                  # Symbol name
    kind: str                  # function, class, method, variable
    file_path: str             # Absolute file path
    range: Range               # Start/end line and character
    embedding: Optional[List[float]] = None
    raw_code: str = ""
    docstring: str = ""
    
@dataclass  
class CodeAssociationGraph:
    """Graph of code relationships"""
    nodes: Dict[str, CodeSymbolNode]
    edges: List[Tuple[str, str, str]]  # (from_id, to_id, relationship_type)
    # relationship_type: 'calls', 'references', 'inherits', 'imports'
    
    def to_networkx(self) -> nx.DiGraph:
        """Convert to NetworkX for algorithms"""
        ...

@dataclass
class SearchResultCluster:
    """Clustered search result"""
    cluster_id: str
    score: float
    title: str                 # AI-generated summary (optional)
    symbols: List[CodeSymbolNode]
    metadata: Dict[str, Any]
```

### 3. VectorSearchService (`services/vector_search.py`)

**Role**: Semantic search using embeddings

```python
class VectorSearchService:
    def __init__(self, model_name: str = "all-MiniLM-L6-v2"):
        self.model = SentenceTransformer(model_name)  # 384-dim, fast
        self.index: faiss.IndexFlatIP  # or hnswlib for larger scale
        self.id_to_symbol: Dict[str, CodeSymbolNode]
    
    async def index_codebase(self, symbols: List[CodeSymbolNode]):
        """Build/update vector index from symbols"""
        texts = [f"{s.name} {s.docstring} {s.raw_code[:500]}" for s in symbols]
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        self.index.add(embeddings)
        
    async def search(self, query: str, top_k: int) -> List[CodeSymbolNode]:
        """Find semantically similar symbols"""
        query_vec = self.model.encode([query], normalize_embeddings=True)
        scores, indices = self.index.search(query_vec, top_k)
        return [self.id_to_symbol[i] for i in indices[0]]
```

**Embedding Model Selection**:
| Model | Dimensions | Speed | Quality |
|-------|-----------|-------|---------|
| all-MiniLM-L6-v2 | 384 | Fast | Good |
| all-mpnet-base-v2 | 768 | Medium | Better |
| CodeBERT | 768 | Medium | Code-optimized |

### 4. LspBridge (`services/lsp_bridge.py`)

**Role**: Interface to real-time language servers via LanguageServerMultiplexer

```python
class LspBridge:
    def __init__(self, multiplexer_url: str = "http://localhost:3458"):
        self.multiplexer_url = multiplexer_url
        self.cache: Dict[str, CacheEntry] = {}  # file_path -> (mtime, data)
        self.session = aiohttp.ClientSession()
    
    async def get_references(self, symbol: CodeSymbolNode) -> List[Location]:
        """Get all references to a symbol (real-time LSP)"""
        cache_key = f"refs:{symbol.id}"
        if self._is_cached(cache_key, symbol.file_path):
            return self.cache[cache_key].data
            
        response = await self._lsp_request("textDocument/references", {
            "textDocument": {"uri": f"file://{symbol.file_path}"},
            "position": {"line": symbol.range.start.line, 
                        "character": symbol.range.start.character},
            "context": {"includeDeclaration": True}
        })
        
        locations = self._parse_locations(response)
        self._cache(cache_key, symbol.file_path, locations)
        return locations
    
    async def get_call_hierarchy(self, symbol: CodeSymbolNode) -> List[CallHierarchyItem]:
        """Get incoming/outgoing calls (if supported by language server)"""
        try:
            # Prepare call hierarchy
            items = await self._lsp_request("textDocument/prepareCallHierarchy", {...})
            if not items:
                # Fallback to references if callHierarchy not supported
                return await self._fallback_to_references(symbol)
            
            # Get incoming calls
            incoming = await self._lsp_request("callHierarchy/incomingCalls", 
                                               {"item": items[0]})
            return incoming
        except LspCapabilityNotSupported:
            return await self._fallback_to_references(symbol)
    
    async def get_definition(self, symbol: CodeSymbolNode) -> Optional[Location]:
        """Get symbol definition location"""
        ...
    
    async def get_hover(self, symbol: CodeSymbolNode) -> Optional[str]:
        """Get hover documentation"""
        ...
```

**Caching Strategy**:
- Cache key: `{operation}:{symbol_id}`
- Invalidation: Check file modification time
- TTL: 5 minutes for frequently accessed files

**Concurrency Control**:
- Max concurrent LSP requests: 10
- Request timeout: 2 seconds
- Batch requests where possible

### 5. GraphBuilder (`graph/builder.py`)

**Role**: Build code association graph from seeds using LSP

```python
class GraphBuilder:
    def __init__(self, max_depth: int = 2, max_nodes: int = 100):
        self.max_depth = max_depth
        self.max_nodes = max_nodes
    
    async def build_from_seeds(
        self, 
        seeds: List[CodeSymbolNode],
        lsp_bridge: LspBridge
    ) -> CodeAssociationGraph:
        """Build association graph by expanding from seed nodes"""
        graph = CodeAssociationGraph()
        visited: Set[str] = set()
        queue: List[Tuple[CodeSymbolNode, int]] = [(s, 0) for s in seeds]
        
        # Parallel expansion with semaphore
        sem = asyncio.Semaphore(10)
        
        async def expand_node(node: CodeSymbolNode, depth: int):
            if node.id in visited or depth > self.max_depth:
                return
            if len(graph.nodes) >= self.max_nodes:
                return
                
            visited.add(node.id)
            graph.add_node(node)
            
            async with sem:
                # Get relationships in parallel
                refs, calls = await asyncio.gather(
                    lsp_bridge.get_references(node),
                    lsp_bridge.get_call_hierarchy(node),
                    return_exceptions=True
                )
                
                # Add edges
                for ref in refs:
                    ref_node = await self._location_to_node(ref, lsp_bridge)
                    graph.add_edge(node.id, ref_node.id, "references")
                    queue.append((ref_node, depth + 1))
                    
                for call in calls:
                    call_node = await self._call_to_node(call, lsp_bridge)
                    graph.add_edge(call_node.id, node.id, "calls")
                    queue.append((call_node, depth + 1))
        
        # BFS expansion
        while queue and len(graph.nodes) < self.max_nodes:
            batch = queue[:10]
            queue = queue[10:]
            await asyncio.gather(*[expand_node(n, d) for n, d in batch])
        
        return graph
```

### 6. ClusteringService (`clustering/algorithms.py`)

**Role**: Group related code symbols and filter noise

```python
class ClusteringService:
    def __init__(self, resolution: float = 1.0):
        self.resolution = resolution  # Higher = smaller clusters
    
    def cluster(self, graph: CodeAssociationGraph) -> List[SearchResultCluster]:
        """Apply Louvain community detection"""
        nx_graph = graph.to_networkx()
        
        # Louvain algorithm
        communities = community_louvain.best_partition(
            nx_graph, 
            resolution=self.resolution
        )
        
        # Group nodes by community
        clusters: Dict[int, List[CodeSymbolNode]] = defaultdict(list)
        for node_id, community_id in communities.items():
            clusters[community_id].append(graph.nodes[node_id])
        
        return [
            SearchResultCluster(
                cluster_id=f"cluster_{cid}",
                symbols=nodes,
                score=0.0,  # Will be set by RankingService
                title="",
                metadata={"size": len(nodes)}
            )
            for cid, nodes in clusters.items()
        ]
    
    def filter_noise(self, clusters: List[SearchResultCluster]) -> List[SearchResultCluster]:
        """Remove noisy clusters and symbols"""
        filtered = []
        for cluster in clusters:
            # Filter high-degree generic nodes
            cluster.symbols = [
                s for s in cluster.symbols 
                if not self._is_generic_symbol(s)
            ]
            
            # Keep clusters with minimum size
            if len(cluster.symbols) >= 2:
                filtered.append(cluster)
        
        return filtered
    
    def _is_generic_symbol(self, symbol: CodeSymbolNode) -> bool:
        """Check if symbol is too generic (log, print, etc.)"""
        generic_names = {'log', 'print', 'debug', 'error', 'warn', 
                        'get', 'set', 'init', '__init__', 'toString'}
        return symbol.name.lower() in generic_names
```

### 7. RankingService (`ranking/service.py`)

**Role**: Multi-factor intelligent reranking

```python
@dataclass
class RankingWeights:
    text_relevance: float = 0.4    # w1
    graph_centrality: float = 0.35  # w2
    structural_proximity: float = 0.25  # w3

class RankingService:
    def __init__(self, weights: RankingWeights = None):
        self.weights = weights or RankingWeights()
    
    def rerank(
        self,
        clusters: List[SearchResultCluster],
        seeds: List[CodeSymbolNode],
        query: str
    ) -> List[SearchResultCluster]:
        """Rerank clusters using multi-factor scoring"""
        seed_ids = {s.id for s in seeds}
        
        for cluster in clusters:
            # Build cluster subgraph for centrality
            subgraph = self._build_subgraph(cluster)
            pagerank = nx.pagerank(subgraph)
            
            for symbol in cluster.symbols:
                # Factor 1: Text relevance (from vector search)
                text_score = self._compute_text_relevance(symbol, query)
                
                # Factor 2: Graph centrality (PageRank in cluster)
                centrality_score = pagerank.get(symbol.id, 0.0)
                
                # Factor 3: Structural proximity to seeds
                proximity_score = self._compute_proximity(symbol, seed_ids, subgraph)
                
                # Combined score
                symbol.score = (
                    self.weights.text_relevance * text_score +
                    self.weights.graph_centrality * centrality_score +
                    self.weights.structural_proximity * proximity_score
                )
            
            # Cluster score = max symbol score
            cluster.score = max(s.score for s in cluster.symbols)
            cluster.symbols.sort(key=lambda s: s.score, reverse=True)
        
        # Sort clusters by score
        clusters.sort(key=lambda c: c.score, reverse=True)
        return clusters
    
    def _compute_proximity(
        self, 
        symbol: CodeSymbolNode, 
        seed_ids: Set[str],
        graph: nx.DiGraph
    ) -> float:
        """Compute proximity score based on shortest path to seeds"""
        if symbol.id in seed_ids:
            return 1.0
        
        min_distance = float('inf')
        for seed_id in seed_ids:
            try:
                distance = nx.shortest_path_length(graph, seed_id, symbol.id)
                min_distance = min(min_distance, distance)
            except nx.NetworkXNoPath:
                continue
        
        if min_distance == float('inf'):
            return 0.0
        
        # Inverse distance scoring (closer = higher)
        return 1.0 / (1.0 + min_distance)
```

## API Design

### Endpoint: `POST /api/v1/hybrid-search`

**Request**:
```json
{
  "query": "user authentication flow",
  "top_k": 10,
  "config_overrides": {
    "ranking_weights": {"w1": 0.5, "w2": 0.3, "w3": 0.2},
    "max_graph_depth": 2,
    "clustering_resolution": 1.0
  }
}
```

**Response**:
```json
{
  "query_id": "hs-20250120-001",
  "execution_time_ms": 1250,
  "results": [
    {
      "cluster_id": "cluster_0",
      "score": 0.92,
      "title": "User Authentication Handler",
      "symbols": [
        {
          "id": "src/auth/handler.py:authenticate:45",
          "name": "authenticate",
          "kind": "function",
          "file_path": "src/auth/handler.py",
          "range": {"start": {"line": 45, "char": 0}, "end": {"line": 78, "char": 0}},
          "score": 0.95,
          "raw_code": "async def authenticate(request: Request):\n    ..."
        },
        {
          "id": "src/auth/handler.py:validate_token:80",
          "name": "validate_token",
          "kind": "function",
          "file_path": "src/auth/handler.py",
          "score": 0.88,
          "raw_code": "def validate_token(token: str) -> bool:\n    ..."
        }
      ]
    }
  ]
}
```

## Implementation Priorities

### P0 - Core Infrastructure (Week 1-2)
1. **HybridSearchEngine skeleton** - Basic orchestration without all features
2. **LspBridge with caching** - Connect to LanguageServerMultiplexer
3. **GraphBuilder basic** - Seed expansion with references only
4. **Integration test** - Verify LSP communication works

### P1 - Search Pipeline (Week 2-3)
1. **VectorSearchService** - Embedding model + FAISS index
2. **ClusteringService** - Louvain algorithm + noise filtering
3. **End-to-end pipeline** - Query to clustered results

### P2 - Ranking & API (Week 3-4)
1. **RankingService** - Multi-factor scoring
2. **API endpoint** - FastAPI integration
3. **Performance optimization** - Caching, parallelization, timeouts
4. **Configuration system** - Dynamic weight adjustment

## Performance Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| End-to-end latency | < 2s | Parallel LSP calls, aggressive caching |
| Vector search | < 100ms | FAISS with GPU (optional) |
| LSP expansion | < 1s | Max 10 concurrent requests, 2s timeout |
| Clustering | < 200ms | Limit graph size to 100 nodes |
| Reranking | < 100ms | Pre-computed embeddings |

## Dependencies

### External
- LanguageServerMultiplexer (from REAL_LSP_SERVER_PLAN.md)
- Language servers: pylsp, tsserver, gopls, rust-analyzer

### Python Libraries
- `sentence-transformers` - Embedding models
- `faiss-cpu` or `hnswlib` - Vector indexing
- `networkx` - Graph algorithms
- `python-louvain` - Community detection
- `aiohttp` - Async HTTP client

## File Structure

```
src/codexlens/
├── hybrid_search/
│   ├── __init__.py
│   ├── engine.py           # HybridSearchEngine
│   ├── pipeline.py         # Pipeline stage definitions
│   └── data_structures.py  # CodeSymbolNode, Graph, Cluster
├── services/
│   ├── vector_search.py    # VectorSearchService
│   └── lsp_bridge.py       # LspBridge
├── graph/
│   └── builder.py          # GraphBuilder
├── clustering/
│   └── algorithms.py       # ClusteringService
├── ranking/
│   └── service.py          # RankingService
├── api/
│   └── endpoints.py        # API routes
└── configs/
    └── hybrid_search_config.py
```

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| LSP timeout | High | Fallback to vector-only results |
| LSP not available | High | Graceful degradation to CodexLens index |
| Large codebases | Medium | Limit graph expansion, pagination |
| Language server crash | Medium | Auto-restart, circuit breaker |
| Clustering quality | Low | Tunable resolution parameter |

---

*Generated from Gemini analysis (Session: 1768836775699-gemini)*
*Date: 2025-01-20*
