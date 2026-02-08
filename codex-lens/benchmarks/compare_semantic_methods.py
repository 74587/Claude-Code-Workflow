"""Compare Binary Cascade and Vector semantic search methods.

This script compares the two semantic retrieval approaches:
1. Binary Cascade: 256-bit binary vectors for coarse ranking
2. Vector Dense: Full semantic embeddings with cosine similarity
"""

import sys
import time
from pathlib import Path

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from codexlens.storage.dir_index import DirIndexStore
from codexlens.semantic.vector_store import VectorStore


def get_filename(path: str) -> str:
    """Extract filename from path."""
    if "\\" in path:
        return path.split("\\")[-1]
    elif "/" in path:
        return path.split("/")[-1]
    return path


def find_binary_indexes(index_root: Path):
    """Find all binary index files."""
    return list(index_root.rglob("_index_binary_vectors.bin"))


# Test queries for semantic search comparison
TEST_QUERIES = [
    "how to search code semantically",
    "embedding generation for files",
    "hybrid search with multiple backends",
    "parse python source code",
    "database storage for vectors",
]

# Index paths
INDEX_ROOT = Path(r"C:\Users\dyw\.codexlens\indexes\D\Claude_dms3\codex-lens")


def test_vector_search(query: str, limit: int = 10):
    """Test dense vector search."""
    try:
        from codexlens.semantic.factory import get_embedder

        # Find an index with embeddings
        all_results = []
        total_time = 0

        for index_db in INDEX_ROOT.rglob("_index.db"):
            vector_store = VectorStore(index_db)

            if vector_store.count_chunks() == 0:
                continue

            # Get embedder based on stored config
            model_config = vector_store.get_model_config()
            if model_config:
                backend = model_config.get("backend", "fastembed")
                model_name = model_config["model_name"]
                model_profile = model_config["model_profile"]
                if backend == "litellm":
                    embedder = get_embedder(backend="litellm", model=model_name)
                else:
                    embedder = get_embedder(backend="fastembed", profile=model_profile)
            else:
                embedder = get_embedder(backend="fastembed", profile="code")

            start = time.perf_counter()
            query_embedding = embedder.embed_single(query)
            results = vector_store.search_similar(
                query_embedding=query_embedding,
                top_k=limit,
                min_score=0.0,
                return_full_content=True,
            )
            total_time += (time.perf_counter() - start) * 1000
            all_results.extend(results)

            # Only need one successful search to get embedder initialized
            if results:
                break

        # Sort by score and limit
        all_results.sort(key=lambda x: x.score, reverse=True)
        return all_results[:limit], total_time, None
    except Exception as e:
        return [], 0, str(e)



def test_binary_cascade_search(query: str, limit: int = 10):
    """Test binary cascade search (binary coarse + dense fine ranking)."""
    try:
        from codexlens.semantic.ann_index import BinaryANNIndex
        from codexlens.indexing.embedding import CascadeEmbeddingBackend
        import numpy as np
        import sqlite3

        # Find binary indexes
        binary_indexes = find_binary_indexes(INDEX_ROOT)
        if not binary_indexes:
            return [], 0, "No binary indexes found. Run 'codexlens cascade-index' first."

        start = time.perf_counter()

        # Initialize cascade backend for query encoding
        cascade_backend = CascadeEmbeddingBackend()

        # Encode query to binary and dense
        binary_embeddings, dense_embeddings = cascade_backend.encode_cascade([query], batch_size=1)
        query_binary = binary_embeddings[0]
        query_dense = dense_embeddings[0]

        all_results = []

        for binary_index_path in binary_indexes:
            # Find corresponding index.db
            index_db = binary_index_path.parent / "_index.db"
            if not index_db.exists():
                continue

            # Check if cascade embeddings exist
            conn = sqlite3.connect(index_db)
            conn.row_factory = sqlite3.Row
            try:
                cursor = conn.execute(
                    "SELECT COUNT(*) FROM semantic_chunks WHERE embedding_binary IS NOT NULL"
                )
                binary_count = cursor.fetchone()[0]
                if binary_count == 0:
                    conn.close()
                    continue
            except Exception:
                conn.close()
                continue

            # Stage 1: Binary coarse search
            binary_index = BinaryANNIndex(index_db, dim=256)
            try:
                binary_index.load()
            except Exception:
                conn.close()
                continue

            # Pack query for binary search
            from codexlens.indexing.embedding import pack_binary_embedding
            query_binary_packed = pack_binary_embedding(query_binary)

            # Get top candidates
            coarse_limit = min(limit * 10, 100)
            # search returns (ids, distances) tuple
            coarse_ids, coarse_distances = binary_index.search(query_binary_packed, top_k=coarse_limit)

            if not coarse_ids:
                conn.close()
                continue

            # Stage 2: Dense reranking
            chunk_ids = coarse_ids
            placeholders = ",".join("?" * len(chunk_ids))

            cursor = conn.execute(
                f"""
                SELECT id, file_path, content, embedding_dense
                FROM semantic_chunks
                WHERE id IN ({placeholders}) AND embedding_dense IS NOT NULL
                """,
                chunk_ids
            )
            rows = cursor.fetchall()

            # Compute dense scores
            for row in rows:
                chunk_id = row["id"]
                file_path = row["file_path"]
                content = row["content"]
                dense_blob = row["embedding_dense"]

                if dense_blob:
                    dense_vec = np.frombuffer(dense_blob, dtype=np.float32)
                    # Cosine similarity
                    score = float(np.dot(query_dense, dense_vec) / (
                        np.linalg.norm(query_dense) * np.linalg.norm(dense_vec) + 1e-8
                    ))
                else:
                    score = 0.0

                all_results.append({
                    "path": file_path,
                    "score": score,
                    "content": content[:200] + "..." if len(content) > 200 else content,
                })

            conn.close()

        # Sort by dense score and limit
        all_results.sort(key=lambda x: x["score"], reverse=True)
        final_results = all_results[:limit]

        elapsed = (time.perf_counter() - start) * 1000

        return final_results, elapsed, None
    except ImportError as e:
        return [], 0, f"Import error: {e}"
    except Exception as e:
        import traceback
        return [], 0, f"{str(e)}\n{traceback.format_exc()}"


def print_results(method_name: str, results, elapsed: float, error: str = None):
    """Print search results in a formatted way."""
    print(f"\n{'='*60}")
    print(f"Method: {method_name}")
    print(f"{'='*60}")

    if error:
        print(f"ERROR: {error}")
        return

    print(f"Results: {len(results)}, Time: {elapsed:.1f}ms")
    print("-" * 60)

    for i, r in enumerate(results[:5], 1):
        if isinstance(r, dict):
            path = r.get("path", "?")
            score = r.get("score", 0)
            content = r.get("content", "")[:80]
        else:
            path = getattr(r, "path", "?")
            score = getattr(r, "score", 0)
            content = getattr(r, "content", "")[:80] if hasattr(r, "content") else ""

        filename = get_filename(path)
        print(f"  {i}. [{score:.4f}] {filename}")
        if content:
            # Sanitize content for console output
            safe_content = content.encode('ascii', 'replace').decode('ascii')
            print(f"     {safe_content}...")


def compare_overlap(results1, results2, name1: str, name2: str):
    """Compare result overlap between two methods."""
    def get_paths(results):
        paths = set()
        for r in results[:10]:
            if isinstance(r, dict):
                paths.add(r.get("path", ""))
            else:
                paths.add(getattr(r, "path", ""))
        return paths

    paths1 = get_paths(results1)
    paths2 = get_paths(results2)

    if not paths1 or not paths2:
        return 0.0

    overlap = len(paths1 & paths2)
    union = len(paths1 | paths2)
    jaccard = overlap / union if union > 0 else 0.0

    print(f"  {name1} vs {name2}: {overlap} common files (Jaccard: {jaccard:.2f})")
    return jaccard


def main():
    print("=" * 70)
    print("SEMANTIC SEARCH METHODS COMPARISON")
    print("Binary Cascade vs Vector Dense")
    print("=" * 70)

    # Check prerequisites
    print("\n[Prerequisites Check]")
    print(f"  Index Root: {INDEX_ROOT}")

    binary_indexes = find_binary_indexes(INDEX_ROOT)
    print(f"  Binary Indexes: {len(binary_indexes)} found")
    for bi in binary_indexes[:3]:
        print(f"    - {bi.parent.name}/{bi.name}")
    if len(binary_indexes) > 3:
        print(f"    ... and {len(binary_indexes) - 3} more")

    # Aggregate statistics
    all_results = {
        "binary": {"total_results": 0, "total_time": 0, "queries": 0, "errors": []},
        "vector": {"total_results": 0, "total_time": 0, "queries": 0, "errors": []},
    }

    overlap_scores = {"binary_vector": []}

    for query in TEST_QUERIES:
        print(f"\n{'#'*70}")
        print(f"QUERY: \"{query}\"")
        print("#" * 70)

        # Test each method
        binary_results, binary_time, binary_err = test_binary_cascade_search(query)
        vector_results, vector_time, vector_err = test_vector_search(query)

        # Print results
        print_results("Binary Cascade (256-bit + Dense Rerank)", binary_results, binary_time, binary_err)
        print_results("Vector Dense (Semantic Embeddings)", vector_results, vector_time, vector_err)

        # Update statistics
        if not binary_err:
            all_results["binary"]["total_results"] += len(binary_results)
            all_results["binary"]["total_time"] += binary_time
            all_results["binary"]["queries"] += 1
        else:
            all_results["binary"]["errors"].append(binary_err)

        if not vector_err:
            all_results["vector"]["total_results"] += len(vector_results)
            all_results["vector"]["total_time"] += vector_time
            all_results["vector"]["queries"] += 1
        else:
            all_results["vector"]["errors"].append(vector_err)

        # Compare overlap
        print("\n[Result Overlap Analysis]")
        if binary_results and vector_results:
            j = compare_overlap(binary_results, vector_results, "Binary", "Vector")
            overlap_scores["binary_vector"].append(j)

    # Print summary
    print("\n" + "=" * 70)
    print("SUMMARY STATISTICS")
    print("=" * 70)

    for method, stats in all_results.items():
        queries = stats["queries"]
        if queries > 0:
            avg_results = stats["total_results"] / queries
            avg_time = stats["total_time"] / queries
            print(f"\n{method.upper()}:")
            print(f"  Successful queries: {queries}/{len(TEST_QUERIES)}")
            print(f"  Avg results: {avg_results:.1f}")
            print(f"  Avg time: {avg_time:.1f}ms")
        else:
            print(f"\n{method.upper()}: No successful queries")
            if stats["errors"]:
                # Show truncated error
                err = stats["errors"][0]
                if len(err) > 200:
                    err = err[:200] + "..."
                print(f"  Error: {err}")

    print("\n[Average Overlap Scores]")
    for pair, scores in overlap_scores.items():
        if scores:
            avg = sum(scores) / len(scores)
            print(f"  {pair}: {avg:.3f}")

    print("\n" + "=" * 70)
    print("ANALYSIS")
    print("=" * 70)

    # Analyze working methods
    working_methods = [m for m, s in all_results.items() if s["queries"] > 0]

    if len(working_methods) == 2:
        # All methods working - compare quality
        print("\nBoth methods working. Quality comparison:")

        # Compare avg results
        print("\n  Result Coverage (higher = more recall):")
        for m in ["vector", "binary"]:
            stats = all_results[m]
            if stats["queries"] > 0:
                avg = stats["total_results"] / stats["queries"]
                print(f"    {m.upper()}: {avg:.1f} results/query")

        # Compare speed
        print("\n  Speed (lower = faster):")
        for m in ["binary", "vector"]:
            stats = all_results[m]
            if stats["queries"] > 0:
                avg = stats["total_time"] / stats["queries"]
                print(f"    {m.upper()}: {avg:.1f}ms")

        # Recommend fusion strategy
        print("\n  Recommended Fusion Strategy:")
        print("    For quality-focused hybrid search:")
        print("    1. Run both methods in parallel")
        print("    2. Use RRF fusion with weights:")
        print("       - Vector: 0.6 (best semantic understanding)")
        print("       - Binary: 0.4 (fast coarse filtering)")
        print("    3. Apply CrossEncoder reranking on top-50")

    elif len(working_methods) >= 2:
        print(f"\n{len(working_methods)} methods working: {', '.join(working_methods)}")
        print("Consider fixing missing method for complete hybrid search.")
    else:
        print(f"\nOnly {working_methods[0] if working_methods else 'no'} method(s) working.")
        print("Check your index setup.")


if __name__ == "__main__":
    main()
