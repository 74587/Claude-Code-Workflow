# SPLADE Encoder Implementation

## Overview

Created `splade_encoder.py` - A complete ONNX-optimized SPLADE sparse encoder for code search.

## File Location

`src/codexlens/semantic/splade_encoder.py` (474 lines)

## Key Components

### 1. Dependency Checking

**Function**: `check_splade_available() -> Tuple[bool, Optional[str]]`
- Validates numpy, onnxruntime, optimum, transformers availability
- Returns (True, None) if all dependencies present
- Returns (False, error_message) with install instructions if missing

### 2. Caching System

**Global Cache**: Thread-safe singleton pattern
- `_splade_cache: Dict[str, SpladeEncoder]` - Global encoder cache
- `_cache_lock: threading.RLock()` - Thread safety lock

**Factory Function**: `get_splade_encoder(...) -> SpladeEncoder`
- Cache key includes: model_name, gpu/cpu, max_length, sparsity_threshold
- Pre-loads model on first access
- Returns cached instance on subsequent calls

**Cleanup Function**: `clear_splade_cache() -> None`
- Releases ONNX resources
- Clears model and tokenizer references
- Prevents memory leaks

### 3. SpladeEncoder Class

#### Initialization Parameters
- `model_name: str` - Default: "naver/splade-cocondenser-ensembledistil"
- `use_gpu: bool` - Enable GPU acceleration (default: True)
- `max_length: int` - Max sequence length (default: 512)
- `sparsity_threshold: float` - Min weight threshold (default: 0.01)
- `providers: Optional[List]` - Explicit ONNX providers (overrides use_gpu)

#### Core Methods

**`_load_model()`**: Lazy loading with GPU support
- Uses `optimum.onnxruntime.ORTModelForMaskedLM`
- Falls back to CPU if GPU unavailable
- Integrates with `gpu_support.get_optimal_providers()`
- Handles device_id options for DirectML/CUDA

**`_splade_activation(logits, attention_mask)`**: Static method
- Formula: `log(1 + ReLU(logits)) * attention_mask`
- Input: (batch, seq_len, vocab_size)
- Output: (batch, seq_len, vocab_size)

**`_max_pooling(splade_repr)`**: Static method
- Max pooling over sequence dimension
- Input: (batch, seq_len, vocab_size)
- Output: (batch, vocab_size)

**`_to_sparse_dict(dense_vec)`**: Conversion helper
- Filters by sparsity_threshold
- Returns: `Dict[int, float]` mapping token_id to weight

**`encode_text(text: str) -> Dict[int, float]`**: Single text encoding
- Tokenizes input with truncation/padding
- Forward pass through ONNX model
- Applies SPLADE activation + max pooling
- Returns sparse vector

**`encode_batch(texts: List[str], batch_size: int = 32) -> List[Dict[int, float]]`**: Batch encoding
- Processes in batches for memory efficiency
- Returns list of sparse vectors

#### Properties

**`vocab_size: int`**: Vocabulary size (~30k for BERT)
- Cached after first model load
- Returns tokenizer length

#### Debugging Methods

**`get_token(token_id: int) -> str`**
- Converts token_id to human-readable string
- Uses tokenizer.decode()

**`get_top_tokens(sparse_vec: Dict[int, float], top_k: int = 10) -> List[Tuple[str, float]]`**
- Extracts top-k highest-weight tokens
- Returns (token_string, weight) pairs
- Useful for understanding model focus

## Design Patterns Followed

### 1. From `onnx_reranker.py`
✓ ONNX loading with provider detection
✓ Lazy model initialization
✓ Thread-safe loading with RLock
✓ Signature inspection for backward compatibility
✓ Fallback for older Optimum versions
✓ Static helper methods for numerical operations

### 2. From `embedder.py`
✓ Global cache with thread safety
✓ Factory function pattern (get_splade_encoder)
✓ Cache cleanup function (clear_splade_cache)
✓ GPU provider configuration
✓ Batch processing support

### 3. From `gpu_support.py`
✓ `get_optimal_providers(use_gpu, with_device_options=True)`
✓ Device ID options for DirectML/CUDA
✓ Provider tuple format: (provider_name, options_dict)

## SPLADE Algorithm

### Activation Formula
```python
# Step 1: ReLU activation
relu_logits = max(0, logits)

# Step 2: Log(1 + x) transformation
log_relu = log(1 + relu_logits)

# Step 3: Apply attention mask
splade_repr = log_relu * attention_mask

# Step 4: Max pooling over sequence
splade_vec = max(splade_repr, axis=sequence_length)

# Step 5: Sparsification by threshold
sparse_dict = {token_id: weight for token_id, weight in enumerate(splade_vec) if weight > threshold}
```

### Output Format
- Sparse dictionary: `{token_id: weight}`
- Token IDs: 0 to vocab_size-1 (typically ~30,000)
- Weights: Float values > sparsity_threshold
- Interpretable: Can decode token_ids to strings

## Integration Points

### With `splade_index.py`
- `SpladeIndex.add_posting(chunk_id, sparse_vec: Dict[int, float])`
- `SpladeIndex.search(query_sparse: Dict[int, float])`
- Encoder produces the sparse vectors consumed by index

### With Indexing Pipeline
```python
encoder = get_splade_encoder(use_gpu=True)

# Single document
sparse_vec = encoder.encode_text("def main():\n    print('hello')")
index.add_posting(chunk_id=1, sparse_vec=sparse_vec)

# Batch indexing
texts = ["code chunk 1", "code chunk 2", ...]
sparse_vecs = encoder.encode_batch(texts, batch_size=64)
postings = [(chunk_id, vec) for chunk_id, vec in enumerate(sparse_vecs)]
index.add_postings_batch(postings)
```

### With Search Pipeline
```python
encoder = get_splade_encoder(use_gpu=True)
query_sparse = encoder.encode_text("authentication function")
results = index.search(query_sparse, limit=50, min_score=0.5)
```

## Dependencies

Required packages:
- `numpy` - Numerical operations
- `onnxruntime` - ONNX model execution (CPU)
- `onnxruntime-gpu` - ONNX with GPU support (optional)
- `optimum[onnxruntime]` - Hugging Face ONNX optimization
- `transformers` - Tokenizer and model loading

Install command:
```bash
# CPU only
pip install numpy onnxruntime optimum[onnxruntime] transformers

# With GPU support
pip install numpy onnxruntime-gpu optimum[onnxruntime-gpu] transformers
```

## Testing Status

✓ Python syntax validation passed
✓ Module import successful
✓ Dependency checking works correctly
✗ Full functional test pending (requires optimum installation)

## Next Steps

1. Install dependencies for functional testing
2. Create unit tests in `tests/semantic/test_splade_encoder.py`
3. Benchmark encoding performance (CPU vs GPU)
4. Integrate with codex-lens indexing pipeline
5. Add SPLADE option to semantic search configuration

## Performance Considerations

### Memory Usage
- Model size: ~100MB (ONNX optimized)
- Sparse vectors: ~100-500 non-zero entries per document
- Batch size: 32 recommended (adjust based on GPU memory)

### Speed Benchmarks (Expected)
- CPU encoding: ~10-20 docs/sec
- GPU encoding (CUDA): ~100-200 docs/sec
- GPU encoding (DirectML): ~50-100 docs/sec

### Sparsity Analysis
- Threshold 0.01: ~200-400 tokens per document
- Threshold 0.05: ~100-200 tokens per document
- Threshold 0.10: ~50-100 tokens per document

## References

- SPLADE paper: https://arxiv.org/abs/2107.05720
- SPLADE v2: https://arxiv.org/abs/2109.10086
- Naver model: https://huggingface.co/naver/splade-cocondenser-ensembledistil
