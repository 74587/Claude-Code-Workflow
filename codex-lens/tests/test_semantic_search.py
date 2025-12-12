"""Comprehensive tests for semantic search functionality.

Tests embedding generation, vector storage, and semantic similarity search
across complex codebases with various file types and content patterns.
"""

import json
import os
import shutil
import tempfile
import time
from pathlib import Path
from typing import List, Dict, Any

import pytest

from codexlens.entities import SemanticChunk, Symbol
from codexlens.semantic import SEMANTIC_AVAILABLE, SEMANTIC_BACKEND, check_semantic_available

# Skip all tests if semantic search not available
pytestmark = pytest.mark.skipif(
    not SEMANTIC_AVAILABLE,
    reason="Semantic search dependencies not installed"
)


class TestEmbedderPerformance:
    """Test Embedder performance and quality."""

    @pytest.fixture
    def embedder(self):
        """Create embedder instance."""
        from codexlens.semantic.embedder import Embedder
        return Embedder()

    def test_single_embedding(self, embedder):
        """Test single text embedding."""
        text = "def calculate_sum(a, b): return a + b"
        
        start = time.time()
        embedding = embedder.embed_single(text)
        elapsed = time.time() - start
        
        assert len(embedding) == 384, "Embedding dimension should be 384"
        assert all(isinstance(x, float) for x in embedding)
        print(f"\nSingle embedding time: {elapsed*1000:.2f}ms")

    def test_batch_embedding_performance(self, embedder):
        """Test batch embedding performance."""
        texts = [
            "def hello(): print('world')",
            "class Calculator: def add(self, a, b): return a + b",
            "async def fetch_data(url): return await client.get(url)",
            "const processData = (data) => data.map(x => x * 2)",
            "function initializeApp() { console.log('Starting...'); }",
        ] * 10  # 50 texts total
        
        start = time.time()
        embeddings = embedder.embed(texts)
        elapsed = time.time() - start
        
        assert len(embeddings) == len(texts)
        print(f"\nBatch embedding ({len(texts)} texts): {elapsed*1000:.2f}ms")
        print(f"Per-text average: {elapsed/len(texts)*1000:.2f}ms")

    def test_embedding_similarity(self, embedder):
        """Test that similar code has similar embeddings."""
        from codexlens.semantic.vector_store import _cosine_similarity
        
        # Similar functions (should have high similarity)
        code1 = "def add(a, b): return a + b"
        code2 = "def sum_numbers(x, y): return x + y"
        
        # Different function (should have lower similarity)
        code3 = "class UserAuthentication: def login(self, user, password): pass"
        
        emb1 = embedder.embed_single(code1)
        emb2 = embedder.embed_single(code2)
        emb3 = embedder.embed_single(code3)
        
        sim_12 = _cosine_similarity(emb1, emb2)
        sim_13 = _cosine_similarity(emb1, emb3)
        
        print(f"\nSimilarity (add vs sum_numbers): {sim_12:.4f}")
        print(f"Similarity (add vs login): {sim_13:.4f}")
        
        assert sim_12 > sim_13, "Similar code should have higher similarity"
        assert sim_12 > 0.6, "Similar functions should have >0.6 similarity"


class TestVectorStore:
    """Test VectorStore functionality."""

    @pytest.fixture
    def temp_db(self, tmp_path):
        """Create temporary database."""
        return tmp_path / "semantic.db"

    @pytest.fixture
    def vector_store(self, temp_db):
        """Create vector store instance."""
        from codexlens.semantic.vector_store import VectorStore
        return VectorStore(temp_db)

    @pytest.fixture
    def embedder(self):
        """Create embedder instance."""
        from codexlens.semantic.embedder import Embedder
        return Embedder()

    def test_add_and_search_chunks(self, vector_store, embedder):
        """Test adding chunks and searching."""
        # Create test chunks with embeddings
        chunks = [
            SemanticChunk(
                content="def calculate_sum(a, b): return a + b",
                metadata={"symbol": "calculate_sum", "language": "python"}
            ),
            SemanticChunk(
                content="class UserManager: def create_user(self): pass",
                metadata={"symbol": "UserManager", "language": "python"}
            ),
            SemanticChunk(
                content="async function fetchData(url) { return await fetch(url); }",
                metadata={"symbol": "fetchData", "language": "javascript"}
            ),
        ]
        
        # Add embeddings
        for chunk in chunks:
            chunk.embedding = embedder.embed_single(chunk.content)
            vector_store.add_chunk(chunk, "/test/file.py")
        
        # Search for similar code
        query = "function to add two numbers together"
        query_embedding = embedder.embed_single(query)
        
        results = vector_store.search_similar(query_embedding, top_k=3)
        
        assert len(results) > 0, "Should find results"
        assert "calculate_sum" in results[0].excerpt or "sum" in results[0].excerpt.lower()
        
        print(f"\nQuery: '{query}'")
        for i, r in enumerate(results):
            print(f"  {i+1}. Score: {r.score:.4f} - {r.excerpt[:50]}...")

    def test_min_score_filtering(self, vector_store, embedder):
        """Test minimum score filtering."""
        # Add a chunk
        chunk = SemanticChunk(
            content="def hello_world(): print('Hello, World!')",
            metadata={}
        )
        chunk.embedding = embedder.embed_single(chunk.content)
        vector_store.add_chunk(chunk, "/test/hello.py")
        
        # Search with unrelated query
        query = "database connection pool management"
        query_embedding = embedder.embed_single(query)
        
        # Low threshold - should find result
        results_low = vector_store.search_similar(query_embedding, min_score=0.0)
        
        # High threshold - might filter out
        results_high = vector_store.search_similar(query_embedding, min_score=0.8)
        
        print(f"\nResults with min_score=0.0: {len(results_low)}")
        print(f"Results with min_score=0.8: {len(results_high)}")
        
        assert len(results_low) >= len(results_high)


class TestSemanticSearchIntegration:
    """Integration tests for semantic search on real-like codebases."""

    @pytest.fixture
    def complex_codebase(self, tmp_path):
        """Create a complex test codebase."""
        # Python files
        (tmp_path / "src").mkdir()
        (tmp_path / "src" / "auth.py").write_text('''
"""Authentication module."""

class AuthenticationService:
    """Handle user authentication and authorization."""
    
    def __init__(self, secret_key: str):
        self.secret_key = secret_key
        self.token_expiry = 3600
    
    def login(self, username: str, password: str) -> dict:
        """Authenticate user and return JWT token."""
        user = self._validate_credentials(username, password)
        if user:
            return self._generate_token(user)
        raise AuthError("Invalid credentials")
    
    def logout(self, token: str) -> bool:
        """Invalidate user session."""
        return self._revoke_token(token)
    
    def verify_token(self, token: str) -> dict:
        """Verify JWT token and return user claims."""
        pass

def hash_password(password: str) -> str:
    """Hash password using bcrypt."""
    import hashlib
    return hashlib.sha256(password.encode()).hexdigest()
''')

        (tmp_path / "src" / "database.py").write_text('''
"""Database connection and ORM."""

from typing import List, Optional

class DatabaseConnection:
    """Manage database connections with pooling."""
    
    def __init__(self, connection_string: str, pool_size: int = 5):
        self.connection_string = connection_string
        self.pool_size = pool_size
        self._pool = []
    
    def connect(self) -> "Connection":
        """Get connection from pool."""
        if self._pool:
            return self._pool.pop()
        return self._create_connection()
    
    def release(self, conn: "Connection"):
        """Return connection to pool."""
        if len(self._pool) < self.pool_size:
            self._pool.append(conn)

class QueryBuilder:
    """SQL query builder with fluent interface."""
    
    def select(self, *columns) -> "QueryBuilder":
        pass
    
    def where(self, condition: str) -> "QueryBuilder":
        pass
    
    def execute(self) -> List[dict]:
        pass
''')

        (tmp_path / "src" / "api.py").write_text('''
"""REST API endpoints."""

from typing import List, Dict, Any

class APIRouter:
    """Route HTTP requests to handlers."""
    
    def __init__(self):
        self.routes = {}
    
    def get(self, path: str):
        """Register GET endpoint."""
        def decorator(func):
            self.routes[("GET", path)] = func
            return func
        return decorator
    
    def post(self, path: str):
        """Register POST endpoint."""
        def decorator(func):
            self.routes[("POST", path)] = func
            return func
        return decorator

async def handle_request(method: str, path: str, body: Dict) -> Dict:
    """Process incoming HTTP request."""
    pass

def validate_json_schema(data: Dict, schema: Dict) -> bool:
    """Validate request data against JSON schema."""
    pass
''')

        # JavaScript files
        (tmp_path / "frontend").mkdir()
        (tmp_path / "frontend" / "components.js").write_text('''
/**
 * React UI Components
 */

class UserProfile extends Component {
    constructor(props) {
        super(props);
        this.state = { user: null, loading: true };
    }
    
    async componentDidMount() {
        const user = await fetchUserData(this.props.userId);
        this.setState({ user, loading: false });
    }
    
    render() {
        if (this.state.loading) return <Spinner />;
        return <ProfileCard user={this.state.user} />;
    }
}

function Button({ onClick, children, variant = "primary" }) {
    return (
        <button className={`btn btn-${variant}`} onClick={onClick}>
            {children}
        </button>
    );
}

const FormInput = ({ label, value, onChange, type = "text" }) => {
    return (
        <div className="form-group">
            <label>{label}</label>
            <input type={type} value={value} onChange={onChange} />
        </div>
    );
};
''')

        (tmp_path / "frontend" / "api.js").write_text('''
/**
 * API Client for backend communication
 */

const API_BASE = "/api/v1";

async function fetchUserData(userId) {
    const response = await fetch(`${API_BASE}/users/${userId}`);
    if (!response.ok) throw new Error("Failed to fetch user");
    return response.json();
}

async function createUser(userData) {
    const response = await fetch(`${API_BASE}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData)
    });
    return response.json();
}

async function updateUserProfile(userId, updates) {
    const response = await fetch(`${API_BASE}/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates)
    });
    return response.json();
}

class WebSocketClient {
    constructor(url) {
        this.url = url;
        this.ws = null;
        this.handlers = {};
    }
    
    connect() {
        this.ws = new WebSocket(this.url);
        this.ws.onmessage = (event) => this._handleMessage(event);
    }
    
    on(eventType, handler) {
        this.handlers[eventType] = handler;
    }
}
''')

        return tmp_path

    @pytest.fixture
    def indexed_codebase(self, complex_codebase, tmp_path):
        """Index the complex codebase with semantic embeddings."""
        from codexlens.semantic.embedder import Embedder
        from codexlens.semantic.vector_store import VectorStore
        from codexlens.semantic.chunker import Chunker, ChunkConfig
        from codexlens.parsers.factory import ParserFactory
        from codexlens.config import Config
        
        db_path = tmp_path / "semantic.db"
        vector_store = VectorStore(db_path)
        embedder = Embedder()
        config = Config()
        factory = ParserFactory(config)
        chunker = Chunker(ChunkConfig(min_chunk_size=20, max_chunk_size=500))
        
        # Index all source files
        indexed_files = []
        for ext in ["*.py", "*.js"]:
            for file_path in complex_codebase.rglob(ext):
                content = file_path.read_text()
                language = "python" if file_path.suffix == ".py" else "javascript"
                
                # Parse symbols
                parser = factory.get_parser(language)
                indexed_file = parser.parse(content, file_path)
                
                # Create chunks
                chunks = chunker.chunk_file(
                    content,
                    indexed_file.symbols,
                    str(file_path),
                    language
                )
                
                # Add embeddings and store
                for chunk in chunks:
                    chunk.embedding = embedder.embed_single(chunk.content)
                    vector_store.add_chunk(chunk, str(file_path))
                
                indexed_files.append(str(file_path))
        
        return {
            "vector_store": vector_store,
            "embedder": embedder,
            "files": indexed_files,
            "codebase_path": complex_codebase
        }

    def test_semantic_search_accuracy(self, indexed_codebase):
        """Test semantic search accuracy on complex queries."""
        vector_store = indexed_codebase["vector_store"]
        embedder = indexed_codebase["embedder"]
        
        test_queries = [
            {
                "query": "user authentication login function",
                "expected_contains": ["login", "auth", "credential"],
                "expected_not_contains": ["database", "button"]
            },
            {
                "query": "database connection pooling",
                "expected_contains": ["connect", "pool", "database"],
                "expected_not_contains": ["login", "button"]
            },
            {
                "query": "React component for user profile",
                "expected_contains": ["UserProfile", "component", "render"],
                "expected_not_contains": ["database", "auth"]
            },
            {
                "query": "HTTP API endpoint handler",
                "expected_contains": ["API", "request", "handle"],
                "expected_not_contains": ["UserProfile", "button"]
            },
            {
                "query": "form input UI element",
                "expected_contains": ["input", "form", "label"],
                "expected_not_contains": ["database", "auth"]
            }
        ]
        
        print("\n" + "="*60)
        print("SEMANTIC SEARCH ACCURACY TEST")
        print("="*60)
        
        for test in test_queries:
            query = test["query"]
            query_embedding = embedder.embed_single(query)
            
            results = vector_store.search_similar(query_embedding, top_k=5, min_score=0.3)
            
            print(f"\nQuery: '{query}'")
            print("-" * 40)
            
            # Check results
            all_excerpts = " ".join([r.excerpt.lower() for r in results])
            
            found_expected = []
            for expected in test["expected_contains"]:
                if expected.lower() in all_excerpts:
                    found_expected.append(expected)
            
            found_unexpected = []
            for unexpected in test["expected_not_contains"]:
                if unexpected.lower() in all_excerpts:
                    found_unexpected.append(unexpected)
            
            for i, r in enumerate(results[:3]):
                print(f"  {i+1}. Score: {r.score:.4f}")
                print(f"     File: {Path(r.path).name}")
                print(f"     Excerpt: {r.excerpt[:80]}...")
            
            print(f"\n  [OK] Found expected: {found_expected}")
            if found_unexpected:
                print(f"  [WARN] Found unexpected: {found_unexpected}")

    def test_search_performance(self, indexed_codebase):
        """Test search performance with various parameters."""
        vector_store = indexed_codebase["vector_store"]
        embedder = indexed_codebase["embedder"]
        
        query = "function to handle user data"
        query_embedding = embedder.embed_single(query)
        
        print("\n" + "="*60)
        print("SEARCH PERFORMANCE TEST")
        print("="*60)
        
        # Test different top_k values
        for top_k in [5, 10, 20, 50]:
            start = time.time()
            results = vector_store.search_similar(query_embedding, top_k=top_k)
            elapsed = time.time() - start
            
            print(f"top_k={top_k}: {elapsed*1000:.2f}ms ({len(results)} results)")
        
        # Test different min_score values
        print("\nMin score filtering:")
        for min_score in [0.0, 0.3, 0.5, 0.7]:
            start = time.time()
            results = vector_store.search_similar(query_embedding, top_k=50, min_score=min_score)
            elapsed = time.time() - start
            
            print(f"min_score={min_score}: {elapsed*1000:.2f}ms ({len(results)} results)")


class TestChunkerOptimization:
    """Test chunker parameters for optimal semantic search."""

    @pytest.fixture
    def sample_code(self):
        """Long Python file for chunking tests."""
        return '''
"""Large module with multiple classes and functions."""

import os
import sys
from typing import List, Dict, Any, Optional

# Constants
MAX_RETRIES = 3
DEFAULT_TIMEOUT = 30

class ConfigManager:
    """Manage application configuration."""
    
    def __init__(self, config_path: str):
        self.config_path = config_path
        self._config: Dict[str, Any] = {}
    
    def load(self) -> Dict[str, Any]:
        """Load configuration from file."""
        with open(self.config_path) as f:
            self._config = json.load(f)
        return self._config
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get configuration value."""
        return self._config.get(key, default)
    
    def set(self, key: str, value: Any) -> None:
        """Set configuration value."""
        self._config[key] = value

class DataProcessor:
    """Process and transform data."""
    
    def __init__(self, source: str):
        self.source = source
        self.data: List[Dict] = []
    
    def load_data(self) -> List[Dict]:
        """Load data from source."""
        # Implementation here
        pass
    
    def transform(self, transformers: List[callable]) -> List[Dict]:
        """Apply transformations to data."""
        result = self.data
        for transformer in transformers:
            result = [transformer(item) for item in result]
        return result
    
    def filter(self, predicate: callable) -> List[Dict]:
        """Filter data by predicate."""
        return [item for item in self.data if predicate(item)]
    
    def aggregate(self, key: str, aggregator: callable) -> Dict:
        """Aggregate data by key."""
        groups: Dict[str, List] = {}
        for item in self.data:
            k = item.get(key)
            if k not in groups:
                groups[k] = []
            groups[k].append(item)
        return {k: aggregator(v) for k, v in groups.items()}

def validate_input(data: Dict, schema: Dict) -> bool:
    """Validate input data against schema."""
    for field, rules in schema.items():
        if rules.get("required") and field not in data:
            return False
        if field in data:
            value = data[field]
            if "type" in rules and not isinstance(value, rules["type"]):
                return False
    return True

def format_output(data: Any, format_type: str = "json") -> str:
    """Format output data."""
    if format_type == "json":
        return json.dumps(data, indent=2)
    elif format_type == "csv":
        # CSV formatting
        pass
    return str(data)

async def fetch_remote_data(url: str, timeout: int = DEFAULT_TIMEOUT) -> Dict:
    """Fetch data from remote URL."""
    async with aiohttp.ClientSession() as session:
        async with session.get(url, timeout=timeout) as response:
            return await response.json()

class CacheManager:
    """Manage caching with TTL support."""
    
    def __init__(self, default_ttl: int = 300):
        self.default_ttl = default_ttl
        self._cache: Dict[str, tuple] = {}
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached value if not expired."""
        if key in self._cache:
            value, expiry = self._cache[key]
            if time.time() < expiry:
                return value
            del self._cache[key]
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set cached value with TTL."""
        expiry = time.time() + (ttl or self.default_ttl)
        self._cache[key] = (value, expiry)
    
    def invalidate(self, pattern: str) -> int:
        """Invalidate cache entries matching pattern."""
        keys_to_delete = [k for k in self._cache if pattern in k]
        for k in keys_to_delete:
            del self._cache[k]
        return len(keys_to_delete)
'''

    def test_chunk_size_comparison(self, sample_code):
        """Compare different chunk sizes for search quality."""
        from codexlens.semantic.chunker import Chunker, ChunkConfig
        from codexlens.semantic.embedder import Embedder
        from codexlens.semantic.vector_store import _cosine_similarity
        from codexlens.parsers.factory import ParserFactory
        from codexlens.config import Config
        
        config = Config()
        factory = ParserFactory(config)
        parser = factory.get_parser("python")
        indexed_file = parser.parse(sample_code, Path("/test.py"))
        embedder = Embedder()
        
        print("\n" + "="*60)
        print("CHUNK SIZE OPTIMIZATION TEST")
        print("="*60)
        
        # Test different chunk configurations
        configs = [
            ChunkConfig(min_chunk_size=20, max_chunk_size=200, overlap=20),
            ChunkConfig(min_chunk_size=50, max_chunk_size=500, overlap=50),
            ChunkConfig(min_chunk_size=100, max_chunk_size=1000, overlap=100),
        ]
        
        test_query = "cache management with TTL expiration"
        query_embedding = embedder.embed_single(test_query)
        
        for cfg in configs:
            chunker = Chunker(cfg)
            chunks = chunker.chunk_file(
                sample_code,
                indexed_file.symbols,
                "/test.py",
                "python"
            )
            
            print(f"\nConfig: min={cfg.min_chunk_size}, max={cfg.max_chunk_size}, overlap={cfg.overlap}")
            print(f"  Chunks generated: {len(chunks)}")
            
            if chunks:
                # Find best matching chunk
                best_score = 0
                best_chunk = None
                
                for chunk in chunks:
                    chunk.embedding = embedder.embed_single(chunk.content)
                    score = _cosine_similarity(query_embedding, chunk.embedding)
                    if score > best_score:
                        best_score = score
                        best_chunk = chunk
                
                if best_chunk:
                    print(f"  Best match score: {best_score:.4f}")
                    print(f"  Best chunk preview: {best_chunk.content[:100]}...")

    def test_symbol_vs_sliding_window(self, sample_code):
        """Compare symbol-based vs sliding window chunking."""
        from codexlens.semantic.chunker import Chunker, ChunkConfig
        from codexlens.parsers.factory import ParserFactory
        from codexlens.config import Config
        
        config = Config()
        factory = ParserFactory(config)
        parser = factory.get_parser("python")
        indexed_file = parser.parse(sample_code, Path("/test.py"))
        
        chunker = Chunker(ChunkConfig(min_chunk_size=20))
        
        print("\n" + "="*60)
        print("CHUNKING STRATEGY COMPARISON")
        print("="*60)
        
        # Symbol-based chunking
        symbol_chunks = chunker.chunk_by_symbol(
            sample_code,
            indexed_file.symbols,
            "/test.py",
            "python"
        )
        
        # Sliding window chunking
        window_chunks = chunker.chunk_sliding_window(
            sample_code,
            "/test.py",
            "python"
        )
        
        print(f"\nSymbol-based chunks: {len(symbol_chunks)}")
        for i, chunk in enumerate(symbol_chunks[:5]):
            symbol_name = chunk.metadata.get("symbol_name", "unknown")
            print(f"  {i+1}. {symbol_name}: {len(chunk.content)} chars")
        
        print(f"\nSliding window chunks: {len(window_chunks)}")
        for i, chunk in enumerate(window_chunks[:5]):
            lines = f"{chunk.metadata.get('start_line', '?')}-{chunk.metadata.get('end_line', '?')}"
            print(f"  {i+1}. Lines {lines}: {len(chunk.content)} chars")


class TestRealWorldScenarios:
    """Test real-world semantic search scenarios."""

    @pytest.fixture
    def embedder(self):
        from codexlens.semantic.embedder import Embedder
        return Embedder()

    def test_natural_language_queries(self, embedder):
        """Test various natural language query patterns."""
        from codexlens.semantic.vector_store import _cosine_similarity
        
        code_samples = {
            "auth": "def authenticate_user(username, password): verify credentials and create session",
            "db": "class DatabasePool: manage connection pooling for efficient database access",
            "api": "async def handle_http_request(req): process incoming REST API calls",
            "ui": "function Button({ onClick }) { return <button onClick={onClick}>Click</button> }",
            "cache": "class LRUCache: implements least recently used caching strategy with TTL",
        }
        
        # Generate embeddings for code
        code_embeddings = {k: embedder.embed_single(v) for k, v in code_samples.items()}
        
        # Test queries
        queries = [
            ("How do I log in a user?", "auth"),
            ("Database connection management", "db"),
            ("REST endpoint handler", "api"),
            ("Button component React", "ui"),
            ("Caching with expiration", "cache"),
        ]
        
        print("\n" + "="*60)
        print("NATURAL LANGUAGE QUERY TEST")
        print("="*60)
        
        correct = 0
        for query, expected_best in queries:
            query_embedding = embedder.embed_single(query)
            
            scores = {k: _cosine_similarity(query_embedding, v) 
                     for k, v in code_embeddings.items()}
            
            best_match = max(scores.items(), key=lambda x: x[1])
            is_correct = best_match[0] == expected_best
            correct += is_correct
            
            status = "[OK]" if is_correct else "[FAIL]"
            print(f"\n{status} Query: '{query}'")
            print(f"  Expected: {expected_best}, Got: {best_match[0]} (score: {best_match[1]:.4f})")
        
        accuracy = correct / len(queries) * 100
        print(f"\n\nAccuracy: {accuracy:.1f}% ({correct}/{len(queries)})")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "-s"])
