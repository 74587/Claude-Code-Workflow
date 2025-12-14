"""Performance benchmarks for CodexLens search functionality.

Measures:
- FTS5 search speed at various scales
- Chain search traversal performance
- Semantic search latency
- Memory usage during search operations
"""

import gc
import sys
import tempfile
import time
from pathlib import Path
from typing import List, Tuple
from dataclasses import dataclass
from contextlib import contextmanager

import pytest

from codexlens.storage.sqlite_store import SQLiteStore
from codexlens.storage.dir_index import DirIndexStore
from codexlens.storage.registry import RegistryStore
from codexlens.storage.path_mapper import PathMapper
from codexlens.search import ChainSearchEngine, SearchOptions
from codexlens.entities import IndexedFile, Symbol


@dataclass
class BenchmarkResult:
    """Benchmark result container."""
    name: str
    iterations: int
    total_time_ms: float
    avg_time_ms: float
    min_time_ms: float
    max_time_ms: float
    ops_per_sec: float

    def __str__(self):
        return (
            f"{self.name}:\n"
            f"  Iterations: {self.iterations}\n"
            f"  Total: {self.total_time_ms:.2f}ms\n"
            f"  Avg: {self.avg_time_ms:.2f}ms\n"
            f"  Min: {self.min_time_ms:.2f}ms\n"
            f"  Max: {self.max_time_ms:.2f}ms\n"
            f"  Ops/sec: {self.ops_per_sec:.1f}"
        )


def benchmark(func, iterations=10, warmup=2):
    """Run benchmark with warmup iterations."""
    # Warmup
    for _ in range(warmup):
        func()

    # Measure
    times = []
    for _ in range(iterations):
        gc.collect()
        start = time.perf_counter()
        func()
        elapsed = (time.perf_counter() - start) * 1000
        times.append(elapsed)

    total = sum(times)
    return BenchmarkResult(
        name=func.__name__ if hasattr(func, '__name__') else 'benchmark',
        iterations=iterations,
        total_time_ms=total,
        avg_time_ms=total / iterations,
        min_time_ms=min(times),
        max_time_ms=max(times),
        ops_per_sec=1000 / (total / iterations) if total > 0 else 0
    )


@contextmanager
def timer(name: str):
    """Context manager for timing code blocks."""
    start = time.perf_counter()
    yield
    elapsed = (time.perf_counter() - start) * 1000
    print(f"  {name}: {elapsed:.2f}ms")


# === Test Fixtures ===

@pytest.fixture(scope="module")
def temp_dir():
    """Create a temporary directory for all tests."""
    tmpdir = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
    yield Path(tmpdir.name)
    # Explicit cleanup with error handling for Windows file locking
    try:
        tmpdir.cleanup()
    except (PermissionError, OSError):
        pass  # Ignore Windows file locking errors


def generate_code_file(index: int, lines: int = 100) -> Tuple[IndexedFile, str]:
    """Generate a synthetic code file for testing."""
    symbols = [
        Symbol(name=f"function_{index}_{i}", kind="function", range=(i*10+1, i*10+9))
        for i in range(lines // 10)
    ]

    content_lines = []
    for i in range(lines):
        if i % 10 == 0:
            content_lines.append(f"def function_{index}_{i//10}(param_{i}, data_{i}):")
        else:
            content_lines.append(f"    # Line {i}: processing data with param_{i % 5}")
            content_lines.append(f"    result_{i} = compute(data_{i})")

    return (
        IndexedFile(
            path=f"/project/src/module_{index}/file_{index}.py",
            language="python",
            symbols=symbols,
        ),
        "\n".join(content_lines)
    )


@pytest.fixture(scope="module")
def small_store(temp_dir):
    """Small store with 10 files (~100 lines each)."""
    db_path = temp_dir / "small_index.db"
    store = SQLiteStore(db_path)
    store.initialize()

    for i in range(10):
        indexed_file, content = generate_code_file(i, lines=100)
        store.add_file(indexed_file, content)

    yield store
    store.close()


@pytest.fixture(scope="module")
def medium_store(temp_dir):
    """Medium store with 100 files (~100 lines each)."""
    db_path = temp_dir / "medium_index.db"
    store = SQLiteStore(db_path)
    store.initialize()

    for i in range(100):
        indexed_file, content = generate_code_file(i, lines=100)
        store.add_file(indexed_file, content)

    yield store
    store.close()


@pytest.fixture(scope="module")
def large_store(temp_dir):
    """Large store with 500 files (~200 lines each)."""
    db_path = temp_dir / "large_index.db"
    store = SQLiteStore(db_path)
    store.initialize()

    for i in range(500):
        indexed_file, content = generate_code_file(i, lines=200)
        store.add_file(indexed_file, content)

    yield store
    store.close()


# === FTS5 Performance Tests ===

class TestFTS5Performance:
    """FTS5 search performance benchmarks."""

    def test_small_store_search(self, small_store):
        """Benchmark FTS5 search on small store (10 files)."""
        print("\n" + "="*60)
        print("FTS5 SEARCH - SMALL STORE (10 files)")
        print("="*60)

        queries = ["function", "data", "compute", "result", "param"]

        for query in queries:
            result = benchmark(
                lambda q=query: small_store.search_fts(q, limit=20),
                iterations=50
            )
            result.name = f"search '{query}'"
            print(f"\n{result}")

    def test_medium_store_search(self, medium_store):
        """Benchmark FTS5 search on medium store (100 files)."""
        print("\n" + "="*60)
        print("FTS5 SEARCH - MEDIUM STORE (100 files)")
        print("="*60)

        queries = ["function", "data", "compute", "result", "param"]

        for query in queries:
            result = benchmark(
                lambda q=query: medium_store.search_fts(q, limit=20),
                iterations=30
            )
            result.name = f"search '{query}'"
            print(f"\n{result}")

    def test_large_store_search(self, large_store):
        """Benchmark FTS5 search on large store (500 files)."""
        print("\n" + "="*60)
        print("FTS5 SEARCH - LARGE STORE (500 files)")
        print("="*60)

        queries = ["function", "data", "compute", "result", "param"]

        for query in queries:
            result = benchmark(
                lambda q=query: large_store.search_fts(q, limit=20),
                iterations=20
            )
            result.name = f"search '{query}'"
            print(f"\n{result}")

    def test_search_limit_scaling(self, medium_store):
        """Test how search time scales with result limit."""
        print("\n" + "="*60)
        print("FTS5 SEARCH - LIMIT SCALING")
        print("="*60)

        limits = [5, 10, 20, 50, 100, 200]

        for limit in limits:
            result = benchmark(
                lambda l=limit: medium_store.search_fts("function", limit=l),
                iterations=20
            )
            result.name = f"limit={limit}"
            print(f"\n{result}")

    def test_complex_query_performance(self, medium_store):
        """Test performance of complex FTS5 queries."""
        print("\n" + "="*60)
        print("FTS5 SEARCH - COMPLEX QUERIES")
        print("="*60)

        queries = [
            ("single term", "function"),
            ("two terms", "function data"),
            ("phrase", '"def function"'),
            ("OR query", "function OR result"),
            ("wildcard", "func*"),
            ("NOT query", "function NOT data"),
        ]

        for name, query in queries:
            result = benchmark(
                lambda q=query: medium_store.search_fts(q, limit=20),
                iterations=20
            )
            result.name = name
            print(f"\n{result}")


class TestSymbolSearchPerformance:
    """Symbol search performance benchmarks."""

    def test_symbol_search_scaling(self, small_store, medium_store, large_store):
        """Test symbol search performance at different scales."""
        print("\n" + "="*60)
        print("SYMBOL SEARCH - SCALING")
        print("="*60)

        stores = [
            ("small (10 files)", small_store),
            ("medium (100 files)", medium_store),
            ("large (500 files)", large_store),
        ]

        for name, store in stores:
            result = benchmark(
                lambda s=store: s.search_symbols("function", limit=50),
                iterations=20
            )
            result.name = name
            print(f"\n{result}")

    def test_symbol_search_with_kind_filter(self, medium_store):
        """Test symbol search with kind filtering."""
        print("\n" + "="*60)
        print("SYMBOL SEARCH - KIND FILTER")
        print("="*60)

        # Without filter
        result_no_filter = benchmark(
            lambda: medium_store.search_symbols("function", limit=50),
            iterations=20
        )
        result_no_filter.name = "no filter"
        print(f"\n{result_no_filter}")

        # With filter
        result_with_filter = benchmark(
            lambda: medium_store.search_symbols("function", kind="function", limit=50),
            iterations=20
        )
        result_with_filter.name = "kind=function"
        print(f"\n{result_with_filter}")


# === Chain Search Performance Tests ===

class TestChainSearchPerformance:
    """Chain search engine performance benchmarks."""

    @pytest.fixture
    def chain_engine_setup(self, temp_dir):
        """Setup chain search engine with directory hierarchy."""
        # Create directory hierarchy
        root = temp_dir / "project"
        root.mkdir(exist_ok=True)

        registry = RegistryStore(temp_dir / "registry.db")
        registry.initialize()
        mapper = PathMapper(temp_dir / "indexes")

        # Create indexes at different depths
        dirs = [
            root,
            root / "src",
            root / "src" / "core",
            root / "src" / "utils",
            root / "tests",
        ]

        for i, dir_path in enumerate(dirs):
            dir_path.mkdir(exist_ok=True)
            index_path = mapper.source_to_index_db(dir_path)
            index_path.parent.mkdir(parents=True, exist_ok=True)

            store = DirIndexStore(index_path)
            store.initialize()
            for j in range(20):  # 20 files per directory
                indexed_file, content = generate_code_file(i * 100 + j, lines=50)
                file_path = str(dir_path / f"file_{j}.py")
                store.add_file(
                    name=f"file_{j}.py",
                    full_path=file_path,
                    content=content,
                    language="python",
                    symbols=indexed_file.symbols,
                )
            store.close()

            # Register directory
            project = registry.register_project(root, mapper.source_to_index_dir(root))
            registry.register_dir(project.id, dir_path, index_path, i, 20)

        engine = ChainSearchEngine(registry, mapper)

        yield {
            "engine": engine,
            "registry": registry,
            "root": root,
        }

        registry.close()

    def test_chain_search_depth(self, chain_engine_setup):
        """Test chain search at different depths."""
        print("\n" + "="*60)
        print("CHAIN SEARCH - DEPTH VARIATION")
        print("="*60)

        engine = chain_engine_setup["engine"]
        root = chain_engine_setup["root"]

        depths = [0, 1, 2, -1]  # -1 = unlimited

        for depth in depths:
            options = SearchOptions(depth=depth, max_workers=4, total_limit=50)
            result = benchmark(
                lambda d=depth, o=options: engine.search("function", root, o),
                iterations=10
            )
            result.name = f"depth={depth}"
            print(f"\n{result}")

    def test_chain_search_parallelism(self, chain_engine_setup):
        """Test chain search with different worker counts."""
        print("\n" + "="*60)
        print("CHAIN SEARCH - PARALLELISM")
        print("="*60)

        engine = chain_engine_setup["engine"]
        root = chain_engine_setup["root"]

        worker_counts = [1, 2, 4, 8]

        for workers in worker_counts:
            options = SearchOptions(depth=-1, max_workers=workers, total_limit=50)
            result = benchmark(
                lambda w=workers, o=options: engine.search("function", root, o),
                iterations=10
            )
            result.name = f"workers={workers}"
            print(f"\n{result}")


# === Semantic Search Performance Tests ===

class TestSemanticSearchPerformance:
    """Semantic search performance benchmarks."""

    @pytest.fixture
    def semantic_setup(self, temp_dir):
        """Setup semantic search with embeddings."""
        try:
            from codexlens.semantic import SEMANTIC_AVAILABLE
            if not SEMANTIC_AVAILABLE:
                pytest.skip("Semantic search dependencies not installed")

            from codexlens.semantic.embedder import Embedder
            from codexlens.semantic.vector_store import VectorStore
            from codexlens.entities import SemanticChunk

            embedder = Embedder()
            db_path = temp_dir / "semantic.db"
            vector_store = VectorStore(db_path)

            # Add test chunks
            code_samples = [
                "def authenticate_user(username, password): verify user credentials",
                "class DatabaseConnection: manage database connections with pooling",
                "async def fetch_api_data(url): make HTTP request and return JSON",
                "function renderComponent(props): render React UI component",
                "def process_data(input): transform and validate input data",
            ] * 50  # 250 chunks

            for i, content in enumerate(code_samples):
                chunk = SemanticChunk(
                    content=content,
                    metadata={"index": i, "language": "python"}
                )
                chunk.embedding = embedder.embed_single(content)
                vector_store.add_chunk(chunk, f"/test/file_{i}.py")

            yield {
                "embedder": embedder,
                "vector_store": vector_store,
            }

            # Clean up vector store cache
            vector_store.clear_cache()

        except ImportError:
            pytest.skip("Semantic search dependencies not installed")

    def test_embedding_generation_speed(self, semantic_setup):
        """Benchmark embedding generation speed."""
        print("\n" + "="*60)
        print("SEMANTIC SEARCH - EMBEDDING GENERATION")
        print("="*60)

        embedder = semantic_setup["embedder"]

        # Single embedding
        result = benchmark(
            lambda: embedder.embed_single("def example_function(): return 42"),
            iterations=50
        )
        result.name = "single embedding"
        print(f"\n{result}")

        # Batch embedding
        texts = ["def func{}(): return {}".format(i, i) for i in range(10)]
        result = benchmark(
            lambda: embedder.embed(texts),
            iterations=20
        )
        result.name = "batch embedding (10 texts)"
        print(f"\n{result}")

    def test_vector_search_speed(self, semantic_setup):
        """Benchmark vector similarity search speed."""
        print("\n" + "="*60)
        print("SEMANTIC SEARCH - VECTOR SEARCH")
        print("="*60)

        embedder = semantic_setup["embedder"]
        vector_store = semantic_setup["vector_store"]

        query_embedding = embedder.embed_single("user authentication login")

        # Different top_k values
        for top_k in [5, 10, 20, 50]:
            result = benchmark(
                lambda k=top_k: vector_store.search_similar(query_embedding, top_k=k),
                iterations=30
            )
            result.name = f"top_k={top_k}"
            print(f"\n{result}")

    def test_full_semantic_search_latency(self, semantic_setup):
        """Benchmark full semantic search (embed + search)."""
        print("\n" + "="*60)
        print("SEMANTIC SEARCH - FULL LATENCY")
        print("="*60)

        embedder = semantic_setup["embedder"]
        vector_store = semantic_setup["vector_store"]

        queries = [
            "user authentication",
            "database connection",
            "API request handler",
            "React component",
            "data processing",
        ]

        for query in queries:
            def full_search(q=query):
                embedding = embedder.embed_single(q)
                return vector_store.search_similar(embedding, top_k=10)

            result = benchmark(full_search, iterations=20)
            result.name = f"'{query}'"
            print(f"\n{result}")


# === Comparative Benchmarks ===

class TestComparativeBenchmarks:
    """Compare FTS5 vs Semantic search performance."""

    @pytest.fixture
    def comparison_setup(self, temp_dir):
        """Setup both FTS5 and semantic stores with same content."""
        # FTS5 store
        fts_store = SQLiteStore(temp_dir / "fts_compare.db")
        fts_store.initialize()

        code_samples = [
            ("auth.py", "def authenticate_user(username, password): verify credentials"),
            ("db.py", "class DatabasePool: manage database connection pooling"),
            ("api.py", "async def handle_request(req): process API request"),
            ("ui.py", "function Button({ onClick }): render button component"),
            ("utils.py", "def process_data(input): transform and validate data"),
        ] * 20

        for i, (filename, content) in enumerate(code_samples):
            indexed_file = IndexedFile(
                path=f"/project/{filename.replace('.py', '')}_{i}.py",
                language="python",
                symbols=[Symbol(name=f"func_{i}", kind="function", range=(1, 5))],
            )
            fts_store.add_file(indexed_file, content)

        # Semantic store (if available)
        try:
            from codexlens.semantic import SEMANTIC_AVAILABLE
            if SEMANTIC_AVAILABLE:
                from codexlens.semantic.embedder import Embedder
                from codexlens.semantic.vector_store import VectorStore
                from codexlens.entities import SemanticChunk

                embedder = Embedder()
                semantic_store = VectorStore(temp_dir / "semantic_compare.db")

                for i, (filename, content) in enumerate(code_samples):
                    chunk = SemanticChunk(content=content, metadata={"index": i})
                    chunk.embedding = embedder.embed_single(content)
                    semantic_store.add_chunk(chunk, f"/project/{filename}")

                yield {
                    "fts_store": fts_store,
                    "semantic_store": semantic_store,
                    "embedder": embedder,
                    "has_semantic": True,
                }
                # Close semantic store connection
                semantic_store.clear_cache()
            else:
                yield {"fts_store": fts_store, "has_semantic": False}
        except ImportError:
            yield {"fts_store": fts_store, "has_semantic": False}

        fts_store.close()

    def test_fts_vs_semantic_latency(self, comparison_setup):
        """Compare FTS5 vs Semantic search latency."""
        print("\n" + "="*60)
        print("FTS5 vs SEMANTIC - LATENCY COMPARISON")
        print("="*60)

        fts_store = comparison_setup["fts_store"]

        queries = [
            "authenticate",
            "database",
            "request",
            "button",
            "process",
        ]

        print("\nFTS5 Search:")
        for query in queries:
            result = benchmark(
                lambda q=query: fts_store.search_fts(q, limit=10),
                iterations=30
            )
            result.name = f"'{query}'"
            print(f"  {result.name}: avg={result.avg_time_ms:.2f}ms")

        if comparison_setup.get("has_semantic"):
            semantic_store = comparison_setup["semantic_store"]
            embedder = comparison_setup["embedder"]

            print("\nSemantic Search (embed + search):")
            for query in queries:
                def semantic_search(q=query):
                    emb = embedder.embed_single(q)
                    return semantic_store.search_similar(emb, top_k=10)

                result = benchmark(semantic_search, iterations=20)
                result.name = f"'{query}'"
                print(f"  {result.name}: avg={result.avg_time_ms:.2f}ms")
        else:
            print("\n(Semantic search not available)")


# === Memory Usage Tests ===

class TestMemoryUsage:
    """Memory usage during search operations."""

    def test_search_memory_footprint(self, medium_store):
        """Measure memory footprint during search."""
        print("\n" + "="*60)
        print("MEMORY USAGE - SEARCH OPERATIONS")
        print("="*60)

        import tracemalloc

        tracemalloc.start()

        # Run multiple searches
        for _ in range(100):
            medium_store.search_fts("function", limit=20)

        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        print(f"\nAfter 100 FTS5 searches:")
        print(f"  Current memory: {current / 1024 / 1024:.2f} MB")
        print(f"  Peak memory: {peak / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s", "--tb=short"])
