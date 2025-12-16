# LLM-Enhanced Semantic Search Guide

**Last Updated**: 2025-12-16
**Status**: Experimental Feature

---

## Overview

CodexLens supports two approaches for semantic vector search:

| Approach | Pipeline | Best For |
|----------|----------|----------|
| **Pure Vector** | Code → fastembed → search | Code pattern matching, exact functionality |
| **LLM-Enhanced** | Code → LLM summary → fastembed → search | Natural language queries, conceptual search |

### Why LLM Enhancement?

**Problem**: Raw code embeddings don't match natural language well.

```
Query: "How do I hash passwords securely?"
Raw code: def hash_password(password: str) -> str: ...
Mismatch: Low semantic similarity
```

**Solution**: LLM generates natural language summaries.

```
Query: "How do I hash passwords securely?"
LLM Summary: "Hash a password using bcrypt with specified salt rounds for secure storage"
Match: High semantic similarity ✓
```

## Architecture

### Pure Vector Search Flow

```
1. Code File
   └→ "def hash_password(password: str): ..."

2. Chunking
   └→ Split into semantic chunks (500-2000 chars)

3. Embedding (fastembed)
   └→ Generate 768-dim vector from raw code

4. Storage
   └→ Store vector in semantic_chunks table

5. Query
   └→ "How to hash passwords"
   └→ Generate query vector
   └→ Find similar vectors (cosine similarity)
```

**Pros**: Fast, no external dependencies, good for code patterns
**Cons**: Poor semantic match for natural language queries

### LLM-Enhanced Search Flow

```
1. Code File
   └→ "def hash_password(password: str): ..."

2. LLM Analysis (Gemini/Qwen via CCW)
   └→ Generate summary: "Hash a password using bcrypt..."
   └→ Extract keywords: ["password", "hash", "bcrypt", "security"]
   └→ Identify purpose: "auth"

3. Embeddable Text Creation
   └→ Combine: summary + keywords + purpose + filename

4. Embedding (fastembed)
   └→ Generate 768-dim vector from LLM text

5. Storage
   └→ Store vector with metadata

6. Query
   └→ "How to hash passwords"
   └→ Generate query vector
   └→ Find similar vectors → Better match! ✓
```

**Pros**: Excellent semantic match for natural language
**Cons**: Slower, requires CCW CLI and LLM access

## Setup Requirements

### 1. Install Dependencies

```bash
# Install semantic search dependencies
pip install codexlens[semantic]

# Install CCW CLI for LLM enhancement
npm install -g ccw
```

### 2. Configure LLM Tools

```bash
# Set primary LLM tool (default: gemini)
export CCW_CLI_SECONDARY_TOOL=gemini

# Set fallback tool (default: qwen)
export CCW_CLI_FALLBACK_TOOL=qwen

# Configure API keys (see CCW documentation)
ccw config set gemini.apiKey YOUR_API_KEY
```

### 3. Verify Setup

```bash
# Check CCW availability
ccw --version

# Check semantic dependencies
python -c "from codexlens.semantic import SEMANTIC_AVAILABLE; print(SEMANTIC_AVAILABLE)"
```

## Running Comparison Tests

### Method 1: Standalone Script (Recommended)

```bash
# Run full comparison (pure vector + LLM-enhanced)
python scripts/compare_search_methods.py

# Use specific LLM tool
python scripts/compare_search_methods.py --tool gemini
python scripts/compare_search_methods.py --tool qwen

# Skip LLM test (only pure vector)
python scripts/compare_search_methods.py --skip-llm
```

**Output Example**:

```
======================================================================
SEMANTIC SEARCH COMPARISON TEST
Pure Vector vs LLM-Enhanced Vector Search
======================================================================

Test dataset: 5 Python files
Test queries: 5 natural language questions

======================================================================
PURE VECTOR SEARCH (Code → fastembed)
======================================================================
Setup: 5 files, 23 chunks in 2.3s

Query                                        Top Result                     Score
----------------------------------------------------------------------
✓ How do I securely hash passwords?         password_hasher.py             0.723
✗ Generate JWT token for authentication      user_endpoints.py              0.645
✓ Create new user account via API            user_endpoints.py              0.812
✓ Validate email address format              validation.py                  0.756
~ Connect to PostgreSQL database             connection.py                  0.689

======================================================================
LLM-ENHANCED SEARCH (Code → GEMINI → fastembed)
======================================================================
Generating LLM summaries for 5 files...
Setup: 5/5 files indexed in 8.7s

Query                                        Top Result                     Score
----------------------------------------------------------------------
✓ How do I securely hash passwords?         password_hasher.py             0.891
✓ Generate JWT token for authentication      jwt_handler.py                 0.867
✓ Create new user account via API            user_endpoints.py              0.923
✓ Validate email address format              validation.py                  0.845
✓ Connect to PostgreSQL database             connection.py                  0.801

======================================================================
COMPARISON SUMMARY
======================================================================

Query                                        Pure       LLM
----------------------------------------------------------------------
How do I securely hash passwords?           ✓ Rank 1   ✓ Rank 1
Generate JWT token for authentication        ✗ Miss     ✓ Rank 1
Create new user account via API              ✓ Rank 1   ✓ Rank 1
Validate email address format                ✓ Rank 1   ✓ Rank 1
Connect to PostgreSQL database               ~ Rank 2   ✓ Rank 1
----------------------------------------------------------------------
TOTAL SCORE                                  11         15
======================================================================

ANALYSIS:
✓ LLM enhancement improves results by 36.4%
  Natural language summaries match queries better than raw code
```

### Method 2: Pytest Test Suite

```bash
# Run full test suite
pytest tests/test_llm_enhanced_search.py -v -s

# Run specific test
pytest tests/test_llm_enhanced_search.py::TestSearchComparison::test_comparison -v -s

# Skip LLM tests if CCW not available
pytest tests/test_llm_enhanced_search.py -v -s -k "not llm_enhanced"
```

## Using LLM Enhancement in Production

### Option 1: Enhanced Embeddings Generation (Recommended)

Create embeddings with LLM enhancement during indexing:

```python
from pathlib import Path
from codexlens.semantic.llm_enhancer import create_enhanced_indexer, FileData

# Create enhanced indexer
indexer = create_enhanced_indexer(
    vector_store_path=Path("~/.codexlens/indexes/project/_index.db"),
    llm_tool="gemini",
    llm_enabled=True,
)

# Prepare file data
files = [
    FileData(
        path="auth/password_hasher.py",
        content=open("auth/password_hasher.py").read(),
        language="python"
    ),
    # ... more files
]

# Index with LLM enhancement
indexed_count = indexer.index_files(files)
print(f"Indexed {indexed_count} files with LLM enhancement")
```

### Option 2: CLI Integration (Coming Soon)

```bash
# Generate embeddings with LLM enhancement
codexlens embeddings-generate ~/projects/my-app --llm-enhanced --tool gemini

# Check which strategy was used
codexlens embeddings-status ~/projects/my-app --show-strategies
```

**Note**: CLI integration is planned but not yet implemented. Currently use Option 1 (Python API).

### Option 3: Hybrid Approach

Combine both strategies for best results:

```python
# Generate both pure and LLM-enhanced embeddings
# 1. Pure vector for exact code matching
generate_pure_embeddings(files)

# 2. LLM-enhanced for semantic matching
generate_llm_embeddings(files)

# Search uses both and ranks by best match
```

## Performance Considerations

### Speed Comparison

| Approach | Indexing Time (100 files) | Query Time | Cost |
|----------|---------------------------|------------|------|
| Pure Vector | ~30s | ~50ms | Free |
| LLM-Enhanced | ~5-10 min | ~50ms | LLM API costs |

**LLM indexing is slower** because:
- Calls external LLM API (gemini/qwen)
- Processes files in batches (default: 5 files/batch)
- Waits for LLM response (~2-5s per batch)

**Query speed is identical** because:
- Both use fastembed for similarity search
- Vector lookup is same speed
- Difference is only in what was embedded

### Cost Estimation

**Gemini Flash (via CCW)**:
- ~$0.10 per 1M input tokens
- Average: ~500 tokens per file
- 100 files = ~$0.005 (half a cent)

**Qwen (local)**:
- Free if running locally
- Slower than Gemini Flash

### When to Use Each Approach

| Use Case | Recommendation |
|----------|----------------|
| **Code pattern search** | Pure vector (e.g., "find all REST endpoints") |
| **Natural language queries** | LLM-enhanced (e.g., "how to authenticate users") |
| **Large codebase** | Pure vector first, LLM for important modules |
| **Personal projects** | LLM-enhanced (cost is minimal) |
| **Enterprise** | Hybrid approach |

## Configuration Options

### LLM Config

```python
from codexlens.semantic.llm_enhancer import LLMConfig, LLMEnhancer

config = LLMConfig(
    tool="gemini",              # Primary LLM tool
    fallback_tool="qwen",       # Fallback if primary fails
    timeout_ms=300000,          # 5 minute timeout
    batch_size=5,               # Files per batch
    max_content_chars=8000,     # Max chars per file in prompt
    enabled=True,               # Enable/disable LLM
)

enhancer = LLMEnhancer(config)
```

### Environment Variables

```bash
# Override default LLM tool
export CCW_CLI_SECONDARY_TOOL=gemini

# Override fallback tool
export CCW_CLI_FALLBACK_TOOL=qwen

# Disable LLM enhancement (fall back to pure vector)
export CODEXLENS_LLM_ENABLED=false
```

## Troubleshooting

### Issue 1: CCW CLI Not Found

**Error**: `CCW CLI not found in PATH, LLM enhancement disabled`

**Solution**:
```bash
# Install CCW globally
npm install -g ccw

# Verify installation
ccw --version

# Check PATH
which ccw  # Unix
where ccw  # Windows
```

### Issue 2: LLM API Errors

**Error**: `LLM call failed: HTTP 429 Too Many Requests`

**Solution**:
- Reduce batch size in LLMConfig
- Add delay between batches
- Check API quota/limits
- Try fallback tool (qwen)

### Issue 3: Poor LLM Summaries

**Symptom**: LLM summaries are too generic or inaccurate

**Solution**:
- Try different LLM tool (gemini vs qwen)
- Increase max_content_chars (default 8000)
- Manually review and refine summaries
- Fall back to pure vector for code-heavy files

### Issue 4: Slow Indexing

**Symptom**: Indexing takes too long with LLM enhancement

**Solution**:
```python
# Reduce batch size for faster feedback
config = LLMConfig(batch_size=2)  # Default is 5

# Or use pure vector for large files
if file_size > 10000:
    use_pure_vector()
else:
    use_llm_enhanced()
```

## Example Test Queries

### Good for LLM-Enhanced Search

```python
# Natural language, conceptual queries
"How do I authenticate users with JWT?"
"Validate email addresses before saving to database"
"Secure password storage with hashing"
"Create REST API endpoint for user registration"
"Connect to PostgreSQL with connection pooling"
```

### Good for Pure Vector Search

```python
# Code-specific, pattern-matching queries
"bcrypt.hashpw"
"jwt.encode"
"@app.route POST"
"re.match email"
"psycopg2.pool.SimpleConnectionPool"
```

### Best: Combine Both

Use LLM-enhanced for high-level search, then pure vector for refinement:

```python
# Step 1: LLM-enhanced for semantic search
results = search_llm_enhanced("user authentication with tokens")
# Returns: jwt_handler.py, password_hasher.py, user_endpoints.py

# Step 2: Pure vector for exact code pattern
results = search_pure_vector("jwt.encode")
# Returns: jwt_handler.py (exact match)
```

## Future Improvements

- [ ] CLI integration for `--llm-enhanced` flag
- [ ] Incremental LLM summary updates
- [ ] Caching LLM summaries to reduce API calls
- [ ] Hybrid search combining both approaches
- [ ] Custom prompt templates for specific domains
- [ ] Local LLM support (ollama, llama.cpp)

## Related Documentation

- `PURE_VECTOR_SEARCH_GUIDE.md` - Pure vector search usage
- `IMPLEMENTATION_SUMMARY.md` - Technical implementation details
- `scripts/compare_search_methods.py` - Comparison test script
- `tests/test_llm_enhanced_search.py` - Test suite

## References

- **LLM Enhancer Implementation**: `src/codexlens/semantic/llm_enhancer.py`
- **CCW CLI Documentation**: https://github.com/anthropics/ccw
- **Fastembed**: https://github.com/qdrant/fastembed

---

**Questions?** Run the comparison script to see LLM enhancement in action:
```bash
python scripts/compare_search_methods.py
```
