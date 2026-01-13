#!/usr/bin/env python
"""Debug script v2: Trace the full semantic search flow with detailed logging."""

import json
import logging
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, List, Tuple

# Add src to path
sys.path.insert(0, str(Path(__file__).parent / "src"))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-5s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("debug")


def count_chunks_by_category(index_root: Path) -> Dict[str, int]:
    """Count chunks by category (src vs test) across all indexes."""
    counts = defaultdict(int)
    
    for db_path in index_root.rglob("_index.db"):
        try:
            conn = sqlite3.connect(str(db_path))
            cursor = conn.execute("""
                SELECT file_path FROM semantic_chunks
            """)
            for row in cursor:
                path = row[0]
                if "tests" in path or "test_" in Path(path).name:
                    counts["test"] += 1
                else:
                    counts["src"] += 1
            conn.close()
        except:
            pass
    
    return dict(counts)


def run_dense_search_with_trace(query: str, source_path: Path) -> List[Dict]:
    """Run dense search with detailed tracing."""
    from codexlens.config import Config
    from codexlens.search.chain_search import ChainSearchEngine, SearchOptions
    from codexlens.storage.registry import Registry
    from codexlens.storage.path_mapper import PathMapper
    
    # Load config
    config = Config.load()
    registry = Registry(config.data_dir)
    mapper = PathMapper(config.data_dir)
    
    # Create search engine with verbose logging
    engine = ChainSearchEngine(registry, mapper, config=config)
    engine.logger.setLevel(logging.DEBUG)
    
    # Set up handler to capture all log output
    handler = logging.StreamHandler()
    handler.setLevel(logging.DEBUG)
    engine.logger.addHandler(handler)
    
    # Execute cascade search with dense_rerank strategy
    options = SearchOptions(depth=-1)  # Search all subdirectories
    
    logger.info("=" * 70)
    logger.info("Executing dense_rerank cascade search...")
    logger.info(f"Query: {query}")
    logger.info(f"Source: {source_path}")
    logger.info("=" * 70)
    
    result = engine.cascade_search(
        query=query,
        source_path=source_path,
        k=20,
        coarse_k=100,
        options=options,
        strategy="dense_rerank"
    )
    
    # Analyze results
    logger.info("\n" + "=" * 70)
    logger.info("SEARCH RESULTS ANALYSIS")
    logger.info("=" * 70)
    
    test_count = 0
    src_count = 0
    results_detail = []
    
    for i, r in enumerate(result.results):
        is_test = "tests" in r.path or "test_" in Path(r.path).name
        if is_test:
            test_count += 1
            category = "TEST"
        else:
            src_count += 1
            category = "SRC"
        
        # Get metadata scores if available
        pre_ce_score = r.metadata.get("pre_cross_encoder_score", r.score)
        ce_score = r.metadata.get("cross_encoder_score", 0)
        ce_prob = r.metadata.get("cross_encoder_prob", 0)
        
        results_detail.append({
            "rank": i + 1,
            "category": category,
            "path": r.path,
            "score": r.score,
            "pre_ce_score": pre_ce_score,
            "ce_score": ce_score,
            "ce_prob": ce_prob,
            "excerpt": r.excerpt[:100] if r.excerpt else "",
        })
        
        logger.info(f"{i+1:2d}. [{category:4s}] score={r.score:.4f} pre_ce={pre_ce_score:.4f} ce={ce_score:.4f}")
        logger.info(f"    {r.path}")
        if r.excerpt:
            logger.info(f"    {r.excerpt[:80]}...")
        logger.info("")
    
    logger.info(f"\nSummary: {src_count} SRC files, {test_count} TEST files in top {len(result.results)}")
    logger.info(f"Search time: {result.stats.time_ms:.2f}ms")
    
    return results_detail


def compare_coarse_candidates():
    """Compare coarse candidates before and after reranking."""
    from codexlens.config import Config
    from codexlens.semantic.factory import get_embedder
    from codexlens.semantic.ann_index import ANNIndex
    
    query = "文件索引和嵌入向量生成的实现逻辑"
    config = Config.load()
    
    # Generate query embedding
    embedder = get_embedder(backend="litellm", model="qwen3-embedding-sf")
    query_embedding = embedder.embed_to_numpy([query])[0]
    
    logger.info("=" * 70)
    logger.info("COARSE CANDIDATE ANALYSIS (per directory)")
    logger.info("=" * 70)
    
    # Scan all HNSW indexes
    index_root = Path(r"C:\Users\dyw\.codexlens\indexes\D\Claude_dms3\codex-lens")
    
    all_candidates = []
    
    for hnsw_path in index_root.rglob("_index_vectors.hnsw"):
        db_path = hnsw_path.parent / "_index.db"
        if not db_path.exists():
            continue
        
        try:
            ann_index = ANNIndex(db_path, dim=query_embedding.shape[0])
            if not ann_index.load() or ann_index.count() == 0:
                continue
            
            ids, distances = ann_index.search(query_embedding, top_k=10)
            
            # Get file paths from chunks
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            
            dir_name = hnsw_path.parent.relative_to(index_root)
            
            for chunk_id, dist in zip(ids, distances):
                cursor = conn.execute("""
                    SELECT file_path, content FROM semantic_chunks WHERE id = ?
                """, (int(chunk_id),))
                row = cursor.fetchone()
                if row:
                    is_test = "tests" in row["file_path"] or "test_" in Path(row["file_path"]).name
                    all_candidates.append({
                        "dir": str(dir_name),
                        "chunk_id": int(chunk_id),
                        "distance": float(dist),
                        "score": max(0, 1 - float(dist)),
                        "is_test": is_test,
                        "file_path": row["file_path"],
                        "content_preview": row["content"][:100] if row["content"] else ""
                    })
            conn.close()
            
        except Exception as e:
            logger.warning(f"Error processing {hnsw_path}: {e}")
    
    # Sort by distance (closest first)
    all_candidates.sort(key=lambda x: x["distance"])
    
    logger.info(f"\nTotal coarse candidates across all directories: {len(all_candidates)}")
    
    # Analyze distribution
    test_candidates = [c for c in all_candidates if c["is_test"]]
    src_candidates = [c for c in all_candidates if not c["is_test"]]
    
    logger.info(f"Test files: {len(test_candidates)}")
    logger.info(f"Src files: {len(src_candidates)}")
    
    if test_candidates:
        avg_test_dist = sum(c["distance"] for c in test_candidates) / len(test_candidates)
        logger.info(f"Avg test distance: {avg_test_dist:.4f}")
    if src_candidates:
        avg_src_dist = sum(c["distance"] for c in src_candidates) / len(src_candidates)
        logger.info(f"Avg src distance: {avg_src_dist:.4f}")
    
    logger.info("\nTop 30 candidates (combined from all directories):")
    logger.info("-" * 90)
    for i, c in enumerate(all_candidates[:30]):
        cat = "TEST" if c["is_test"] else "SRC"
        logger.info(f"{i+1:2d}. [{cat:4s}] dist={c['distance']:.4f} score={c['score']:.4f} dir={c['dir']}")
        logger.info(f"    {Path(c['file_path']).name}")
    
    return all_candidates


def main():
    logger.info("=" * 70)
    logger.info("SEMANTIC SEARCH DEBUG SESSION")
    logger.info("=" * 70)
    
    # Step 1: Count chunks distribution
    index_root = Path(r"C:\Users\dyw\.codexlens\indexes\D\Claude_dms3\codex-lens")
    counts = count_chunks_by_category(index_root)
    logger.info(f"\nChunk distribution in index:")
    logger.info(f"  - Test chunks: {counts.get('test', 0)}")
    logger.info(f"  - Src chunks: {counts.get('src', 0)}")
    
    # Step 2: Compare coarse candidates
    logger.info("\n")
    candidates = compare_coarse_candidates()
    
    # Step 3: Run full search
    logger.info("\n")
    query = "文件索引和嵌入向量生成的实现逻辑"
    source_path = Path(r"D:\Claude_dms3\codex-lens")
    results = run_dense_search_with_trace(query, source_path)
    
    # Summary
    logger.info("\n" + "=" * 70)
    logger.info("ROOT CAUSE ANALYSIS")
    logger.info("=" * 70)
    
    test_in_top10 = sum(1 for r in results[:10] if r["category"] == "TEST")
    src_in_top10 = 10 - test_in_top10
    
    logger.info(f"\nTop 10 results: {src_in_top10} SRC, {test_in_top10} TEST")
    
    if test_in_top10 > src_in_top10:
        logger.info("\nPROBLEM: Test files dominate top results")
        logger.info("\nPossible causes:")
        logger.info("  1. Test files mention implementation concepts explicitly")
        logger.info("     (e.g., docstrings describe what they test)")
        logger.info("  2. Embedding model treats test descriptions as similar to")
        logger.info("     implementation descriptions")
        logger.info("  3. Cross-encoder reranker gives higher scores to")
        logger.info("     descriptive test content over implementation code")
        
        # Check if coarse candidates already favor tests
        test_in_coarse_top30 = sum(1 for c in candidates[:30] if c["is_test"])
        if test_in_coarse_top30 > 15:
            logger.info(f"\n  → Dense coarse search already favors tests")
            logger.info(f"     ({test_in_coarse_top30}/30 test files in coarse top-30)")
            logger.info(f"     Problem is at EMBEDDING/DENSE SEARCH stage")
        else:
            logger.info(f"\n  → Coarse search is balanced ({test_in_coarse_top30}/30 tests)")
            logger.info(f"     Problem is at CROSS-ENCODER RERANKING stage")


if __name__ == "__main__":
    main()
