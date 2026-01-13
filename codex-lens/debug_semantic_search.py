#!/usr/bin/env python
"""Debug script to trace semantic search (dense_rerank) flow step by step."""

import json
import logging
import sqlite3
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Configure detailed logging
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)

# Enable debug for specific modules
for name in ["codexlens.search", "codexlens.semantic", "codexlens.indexing"]:
    logging.getLogger(name).setLevel(logging.DEBUG)

logger = logging.getLogger("debug_semantic")


def load_config() -> Dict[str, Any]:
    """Load config from codexlens settings."""
    config_path = Path.home() / ".codexlens" / "config.json"
    if config_path.exists():
        with open(config_path) as f:
            return json.load(f)
    return {}


def inspect_hnsw_index(index_root: Path) -> Dict[str, Any]:
    """Inspect centralized HNSW index metadata."""
    hnsw_path = index_root / "_vectors.hnsw"
    meta_path = index_root / "_vectors_meta.db"
    
    result = {
        "hnsw_exists": hnsw_path.exists(),
        "meta_exists": meta_path.exists(),
        "hnsw_size_mb": round(hnsw_path.stat().st_size / (1024*1024), 2) if hnsw_path.exists() else 0,
    }
    
    if meta_path.exists():
        conn = sqlite3.connect(str(meta_path))
        cursor = conn.execute("SELECT COUNT(*) FROM chunk_metadata")
        result["total_chunks"] = cursor.fetchone()[0]
        
        # Sample file paths
        cursor = conn.execute("""
            SELECT DISTINCT file_path FROM chunk_metadata 
            ORDER BY file_path LIMIT 20
        """)
        result["sample_files"] = [row[0] for row in cursor.fetchall()]
        
        # Check if tests vs src
        cursor = conn.execute("""
            SELECT 
                CASE 
                    WHEN file_path LIKE '%tests%' OR file_path LIKE '%test_%' THEN 'test'
                    ELSE 'src'
                END as category,
                COUNT(*) as count
            FROM chunk_metadata
            GROUP BY category
        """)
        result["category_distribution"] = {row[0]: row[1] for row in cursor.fetchall()}
        
        conn.close()
    
    return result


def run_dense_search(query: str, index_root: Path, top_k: int = 50) -> List[Tuple[int, float, str]]:
    """Execute dense vector search and return candidates with details."""
    from codexlens.semantic.ann_index import ANNIndex
    from codexlens.semantic.factory import get_embedder
    from codexlens.semantic.vector_store import VectorStore
    
    logger.info("=" * 60)
    logger.info("STAGE 1: Dense Embedding Generation")
    logger.info("=" * 60)
    
    # Read model config from index
    index_db = index_root / "_index.db"
    embedding_model = "qwen3-embedding-sf"
    embedding_backend = "litellm"
    
    if index_db.exists():
        try:
            with VectorStore(index_db) as vs:
                model_config = vs.get_model_config()
                if model_config:
                    embedding_backend = model_config.get("backend", embedding_backend)
                    embedding_model = model_config.get("model_name", embedding_model)
                    logger.info(f"Model config from index: {embedding_backend}/{embedding_model}")
        except Exception as e:
            logger.warning(f"Failed to read model config: {e}")
    
    # Generate query embedding
    embedder = get_embedder(backend=embedding_backend, model=embedding_model)
    query_embedding = embedder.embed_to_numpy([query])[0]
    logger.info(f"Query: {query!r}")
    logger.info(f"Query embedding dim: {query_embedding.shape[0]}")
    logger.info(f"Query embedding norm: {(query_embedding**2).sum()**0.5:.4f}")
    
    # Load HNSW index
    logger.info("=" * 60)
    logger.info("STAGE 2: HNSW Vector Search (Coarse)")
    logger.info("=" * 60)
    
    ann_index = ANNIndex.create_central(
        index_root=index_root,
        dim=query_embedding.shape[0],
    )
    if not ann_index.load():
        logger.error("Failed to load HNSW index")
        return []
    
    logger.info(f"HNSW index count: {ann_index.count()}")
    
    # Execute search
    ids, distances = ann_index.search(query_embedding, top_k=top_k)
    logger.info(f"Found {len(ids)} candidates")
    
    # Get chunk details
    candidates = []
    meta_path = index_root / "_vectors_meta.db"
    if meta_path.exists():
        conn = sqlite3.connect(str(meta_path))
        conn.row_factory = sqlite3.Row
        
        for chunk_id, distance in zip(ids, distances):
            cursor = conn.execute("""
                SELECT file_path, content, start_line, end_line
                FROM chunk_metadata WHERE chunk_id = ?
            """, (int(chunk_id),))
            row = cursor.fetchone()
            if row:
                candidates.append((
                    int(chunk_id),
                    float(distance),
                    row["file_path"],
                    row["content"][:200] if row["content"] else "",
                    row["start_line"],
                    row["end_line"],
                ))
        conn.close()
    
    # Print top candidates
    logger.info("\nTop 20 Dense Search Candidates:")
    logger.info("-" * 80)
    for i, (cid, dist, path, content, start, end) in enumerate(candidates[:20]):
        score = max(0, 1 - dist)
        is_test = "tests/" in path or "test_" in Path(path).name
        marker = "[TEST]" if is_test else "[SRC]"
        logger.info(f"{i+1:2d}. {marker} dist={dist:.4f} score={score:.4f}")
        logger.info(f"    {path}:{start}-{end}")
        logger.info(f"    {content[:100]}...")
        logger.info("")
    
    return candidates


def run_reranking(query: str, candidates: List[Tuple], top_k: int = 10) -> List[Tuple[str, float, float]]:
    """Execute cross-encoder reranking on candidates."""
    from codexlens.semantic.reranker import get_reranker, check_reranker_available
    
    logger.info("=" * 60)
    logger.info("STAGE 3: Cross-Encoder Reranking")
    logger.info("=" * 60)
    
    # Check reranker availability
    config = load_config()
    backend = config.get("reranker_backend", "api")
    model = config.get("reranker_model", "Qwen/Qwen3-Reranker-8B")
    
    logger.info(f"Reranker backend: {backend}")
    logger.info(f"Reranker model: {model}")
    
    ok, err = check_reranker_available(backend)
    if not ok:
        logger.error(f"Reranker not available: {err}")
        return []
    
    reranker = get_reranker(backend=backend, model_name=model)
    
    # Prepare pairs for reranking
    pairs = []
    for cid, dist, path, content, start, end in candidates[:50]:  # Top 50 for reranking
        doc_text = content if content else path
        pairs.append((query, doc_text))
    
    logger.info(f"Reranking {len(pairs)} candidates...")
    
    # Execute reranking
    scores = reranker.score_pairs(pairs, batch_size=32)
    
    # Combine scores
    results = []
    for i, (cid, dist, path, content, start, end) in enumerate(candidates[:len(scores)]):
        dense_score = max(0, 1 - dist)
        rerank_score = scores[i]
        combined = 0.5 * dense_score + 0.5 * rerank_score
        is_test = "tests/" in path or "test_" in Path(path).name
        results.append((path, dense_score, rerank_score, combined, is_test, content[:100]))
    
    # Sort by combined score
    results.sort(key=lambda x: x[3], reverse=True)
    
    logger.info("\nTop 20 Reranked Results:")
    logger.info("-" * 100)
    logger.info(f"{'Rank':>4} {'Type':^6} {'Dense':^8} {'Rerank':^8} {'Combined':^8} Path")
    logger.info("-" * 100)
    for i, (path, dense, rerank, combined, is_test, content) in enumerate(results[:20]):
        marker = "TEST" if is_test else "SRC"
        logger.info(f"{i+1:4d} [{marker:^4}] {dense:8.4f} {rerank:8.4f} {combined:8.4f} {path}")
    
    return results[:top_k]


def analyze_problem(candidates: List[Tuple], results: List[Tuple]):
    """Analyze why tests might rank higher than src files."""
    logger.info("=" * 60)
    logger.info("ANALYSIS: Why Tests Rank Higher?")
    logger.info("=" * 60)
    
    # Count test vs src in dense candidates
    test_in_dense = sum(1 for c in candidates[:50] if "tests/" in c[2] or "test_" in Path(c[2]).name)
    src_in_dense = 50 - test_in_dense
    
    logger.info(f"\nDense Search (top 50):")
    logger.info(f"  - Test files: {test_in_dense} ({test_in_dense*2}%)")
    logger.info(f"  - Src files:  {src_in_dense} ({src_in_dense*2}%)")
    
    # Average scores by category
    test_dense_scores = [max(0, 1-c[1]) for c in candidates[:50] if "tests/" in c[2] or "test_" in Path(c[2]).name]
    src_dense_scores = [max(0, 1-c[1]) for c in candidates[:50] if not ("tests/" in c[2] or "test_" in Path(c[2]).name)]
    
    if test_dense_scores:
        logger.info(f"\nDense Score Averages:")
        logger.info(f"  - Test files: {sum(test_dense_scores)/len(test_dense_scores):.4f}")
    if src_dense_scores:
        logger.info(f"  - Src files:  {sum(src_dense_scores)/len(src_dense_scores):.4f}")
    
    # Check rerank score distribution
    test_results = [r for r in results if r[4]]
    src_results = [r for r in results if not r[4]]
    
    if test_results and src_results:
        logger.info(f"\nRerank Score Averages:")
        logger.info(f"  - Test files: {sum(r[2] for r in test_results)/len(test_results):.4f}")
        logger.info(f"  - Src files:  {sum(r[2] for r in src_results)/len(src_results):.4f}")
    
    logger.info("\n" + "=" * 60)
    logger.info("HYPOTHESIS:")
    logger.info("=" * 60)
    
    if test_in_dense > src_in_dense:
        logger.info("→ Problem is at DENSE SEARCH stage")
        logger.info("  Test files have embeddings closer to query")
        logger.info("  Possible causes:")
        logger.info("    1. Test files mention implementation concepts in comments/docstrings")
        logger.info("    2. Embedding model doesn't distinguish between tests and implementation")
        logger.info("    3. Test file chunks are more frequent in the index")
    else:
        logger.info("→ Problem may be at RERANKING stage")
        logger.info("  Reranker gives higher scores to test content")


def main():
    query = "文件索引和嵌入向量生成的实现逻辑"
    index_root = Path(r"C:\Users\dyw\.codexlens\indexes\D\Claude_dms3")
    
    logger.info("=" * 60)
    logger.info("DEBUG: Semantic Search Analysis")
    logger.info("=" * 60)
    logger.info(f"Query: {query}")
    logger.info(f"Index root: {index_root}")
    logger.info("")
    
    # Step 1: Inspect index
    logger.info("STEP 0: Index Inspection")
    logger.info("-" * 60)
    index_info = inspect_hnsw_index(index_root)
    for k, v in index_info.items():
        if k == "sample_files":
            logger.info(f"  {k}:")
            for f in v[:10]:
                logger.info(f"    - {f}")
        elif k == "category_distribution":
            logger.info(f"  {k}:")
            for cat, count in v.items():
                logger.info(f"    - {cat}: {count}")
        else:
            logger.info(f"  {k}: {v}")
    logger.info("")
    
    # Step 2: Dense search
    candidates = run_dense_search(query, index_root, top_k=100)
    
    if not candidates:
        logger.error("No candidates from dense search")
        return
    
    # Step 3: Reranking
    results = run_reranking(query, candidates, top_k=20)
    
    # Step 4: Analyze
    analyze_problem(candidates, results)


if __name__ == "__main__":
    main()
