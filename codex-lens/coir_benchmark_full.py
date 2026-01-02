"""
CoIR Benchmark Evaluation Report Generator

Compares SPLADE with mainstream code retrieval models on CoIR benchmark tasks.
Generates comprehensive performance analysis report.
"""
import sys
import time
import json
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Tuple
import numpy as np

sys.path.insert(0, 'src')

# =============================================================================
# REFERENCE: Published CoIR Benchmark Scores (NDCG@10)
# Source: CoIR Paper (ACL 2025) - https://arxiv.org/abs/2407.02883
# =============================================================================

COIR_REFERENCE_SCORES = {
    # Model: {dataset: NDCG@10 score}
    "Voyage-Code-002": {
        "APPS": 26.52, "CosQA": 29.79, "Text2SQL": 69.26, "CodeSearchNet": 81.79,
        "CCR": 73.45, "Contest-DL": 72.77, "StackOverflow": 27.28,
        "FB-ST": 87.68, "FB-MT": 65.35, "Average": 56.26
    },
    "E5-Mistral-7B": {
        "APPS": 21.33, "CosQA": 31.27, "Text2SQL": 65.98, "CodeSearchNet": 54.25,
        "CCR": 65.27, "Contest-DL": 82.55, "StackOverflow": 33.24,
        "FB-ST": 91.54, "FB-MT": 72.71, "Average": 55.18
    },
    "E5-Base": {
        "APPS": 11.52, "CosQA": 32.59, "Text2SQL": 52.31, "CodeSearchNet": 67.99,
        "CCR": 56.87, "Contest-DL": 62.50, "StackOverflow": 21.87,
        "FB-ST": 86.86, "FB-MT": 74.52, "Average": 50.90
    },
    "OpenAI-Ada-002": {
        "APPS": 8.70, "CosQA": 28.88, "Text2SQL": 58.32, "CodeSearchNet": 74.21,
        "CCR": 69.13, "Contest-DL": 53.34, "StackOverflow": 26.04,
        "FB-ST": 72.40, "FB-MT": 47.12, "Average": 45.59
    },
    "BGE-Base": {
        "APPS": 4.05, "CosQA": 32.76, "Text2SQL": 45.59, "CodeSearchNet": 69.60,
        "CCR": 45.56, "Contest-DL": 38.50, "StackOverflow": 21.71,
        "FB-ST": 73.55, "FB-MT": 64.99, "Average": 42.77
    },
    "BGE-M3": {
        "APPS": 7.37, "CosQA": 22.73, "Text2SQL": 48.76, "CodeSearchNet": 43.23,
        "CCR": 47.55, "Contest-DL": 47.86, "StackOverflow": 31.16,
        "FB-ST": 61.04, "FB-MT": 49.94, "Average": 39.31
    },
    "UniXcoder": {
        "APPS": 1.36, "CosQA": 25.14, "Text2SQL": 50.45, "CodeSearchNet": 60.20,
        "CCR": 58.36, "Contest-DL": 41.82, "StackOverflow": 31.03,
        "FB-ST": 44.67, "FB-MT": 36.02, "Average": 37.33
    },
    "GTE-Base": {
        "APPS": 3.24, "CosQA": 30.24, "Text2SQL": 46.19, "CodeSearchNet": 43.35,
        "CCR": 35.50, "Contest-DL": 33.81, "StackOverflow": 28.80,
        "FB-ST": 62.71, "FB-MT": 55.19, "Average": 36.75
    },
    "Contriever": {
        "APPS": 5.14, "CosQA": 14.21, "Text2SQL": 45.46, "CodeSearchNet": 34.72,
        "CCR": 35.74, "Contest-DL": 44.16, "StackOverflow": 24.21,
        "FB-ST": 66.05, "FB-MT": 55.11, "Average": 36.40
    },
}

# Recent models (2025)
RECENT_MODELS = {
    "Voyage-Code-3": {"Average": 62.5, "note": "13.8% better than OpenAI-v3-large"},
    "SFR-Embedding-Code-7B": {"Average": 67.4, "note": "#1 on CoIR (Feb 2025)"},
    "Jina-Code-v2": {"CosQA": 41.0, "note": "Strong on CosQA"},
    "CodeSage-Large": {"Average": 53.5, "note": "Specialized code model"},
}


# =============================================================================
# TEST DATA: Synthetic CoIR-like datasets for local evaluation
# =============================================================================

def create_test_datasets():
    """Create synthetic test datasets mimicking CoIR task types."""

    # Text-to-Code (like CosQA, CodeSearchNet)
    text_to_code = {
        "name": "Text-to-Code",
        "description": "Natural language queries to code snippets",
        "corpus": [
            {"id": "c1", "text": "def authenticate_user(username: str, password: str) -> bool:\n    user = db.get_user(username)\n    if user and verify_hash(password, user.password_hash):\n        return True\n    return False"},
            {"id": "c2", "text": "async function fetchUserData(userId) {\n    const response = await fetch(`/api/users/${userId}`);\n    if (!response.ok) throw new Error('User not found');\n    return response.json();\n}"},
            {"id": "c3", "text": "def calculate_statistics(data: List[float]) -> Dict[str, float]:\n    return {\n        'mean': np.mean(data),\n        'std': np.std(data),\n        'median': np.median(data)\n    }"},
            {"id": "c4", "text": "SELECT u.id, u.name, u.email, COUNT(o.id) as order_count\nFROM users u LEFT JOIN orders o ON u.id = o.user_id\nWHERE u.status = 'active'\nGROUP BY u.id, u.name, u.email"},
            {"id": "c5", "text": "def merge_sort(arr: List[int]) -> List[int]:\n    if len(arr) <= 1:\n        return arr\n    mid = len(arr) // 2\n    left = merge_sort(arr[:mid])\n    right = merge_sort(arr[mid:])\n    return merge(left, right)"},
            {"id": "c6", "text": "app.post('/api/auth/login', async (req, res) => {\n    const { email, password } = req.body;\n    const user = await User.findByEmail(email);\n    if (!user || !await bcrypt.compare(password, user.password)) {\n        return res.status(401).json({ error: 'Invalid credentials' });\n    }\n    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);\n    res.json({ token });\n});"},
            {"id": "c7", "text": "CREATE TABLE products (\n    id SERIAL PRIMARY KEY,\n    name VARCHAR(255) NOT NULL,\n    price DECIMAL(10, 2) NOT NULL,\n    category_id INTEGER REFERENCES categories(id),\n    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n);"},
            {"id": "c8", "text": "def read_json_file(filepath: str) -> Dict:\n    with open(filepath, 'r', encoding='utf-8') as f:\n        return json.load(f)"},
            {"id": "c9", "text": "class UserRepository:\n    def __init__(self, session):\n        self.session = session\n    \n    def find_by_email(self, email: str) -> Optional[User]:\n        return self.session.query(User).filter(User.email == email).first()"},
            {"id": "c10", "text": "try:\n    result = await process_data(input_data)\nexcept ValidationError as e:\n    logger.error(f'Validation failed: {e}')\n    raise HTTPException(status_code=400, detail=str(e))\nexcept DatabaseError as e:\n    logger.critical(f'Database error: {e}')\n    raise HTTPException(status_code=500, detail='Internal server error')"},
        ],
        "queries": [
            {"id": "q1", "text": "function to verify user password and authenticate", "relevant": ["c1", "c6"]},
            {"id": "q2", "text": "async http request to fetch user data", "relevant": ["c2"]},
            {"id": "q3", "text": "calculate mean median standard deviation statistics", "relevant": ["c3"]},
            {"id": "q4", "text": "SQL query join users and orders count", "relevant": ["c4", "c7"]},
            {"id": "q5", "text": "recursive sorting algorithm implementation", "relevant": ["c5"]},
            {"id": "q6", "text": "REST API login endpoint with JWT token", "relevant": ["c6", "c1"]},
            {"id": "q7", "text": "create database table with foreign key", "relevant": ["c7"]},
            {"id": "q8", "text": "read and parse JSON file python", "relevant": ["c8"]},
            {"id": "q9", "text": "repository pattern find user by email", "relevant": ["c9", "c1"]},
            {"id": "q10", "text": "exception handling with logging", "relevant": ["c10"]},
        ]
    }

    # Code-to-Code (like CCR)
    code_to_code = {
        "name": "Code-to-Code",
        "description": "Find similar code implementations",
        "corpus": [
            {"id": "c1", "text": "def add(a, b): return a + b"},
            {"id": "c2", "text": "function sum(x, y) { return x + y; }"},
            {"id": "c3", "text": "func add(a int, b int) int { return a + b }"},
            {"id": "c4", "text": "def subtract(a, b): return a - b"},
            {"id": "c5", "text": "def multiply(a, b): return a * b"},
            {"id": "c6", "text": "const add = (a, b) => a + b;"},
            {"id": "c7", "text": "fn add(a: i32, b: i32) -> i32 { a + b }"},
            {"id": "c8", "text": "public int add(int a, int b) { return a + b; }"},
        ],
        "queries": [
            {"id": "q1", "text": "def add(a, b): return a + b", "relevant": ["c1", "c2", "c3", "c6", "c7", "c8"]},
            {"id": "q2", "text": "def subtract(x, y): return x - y", "relevant": ["c4"]},
            {"id": "q3", "text": "def mult(x, y): return x * y", "relevant": ["c5"]},
        ]
    }

    # Text2SQL
    text2sql = {
        "name": "Text2SQL",
        "description": "Natural language to SQL queries",
        "corpus": [
            {"id": "c1", "text": "SELECT * FROM users WHERE active = 1"},
            {"id": "c2", "text": "SELECT COUNT(*) FROM orders WHERE status = 'pending'"},
            {"id": "c3", "text": "SELECT u.name, SUM(o.total) FROM users u JOIN orders o ON u.id = o.user_id GROUP BY u.name"},
            {"id": "c4", "text": "UPDATE products SET price = price * 1.1 WHERE category = 'electronics'"},
            {"id": "c5", "text": "DELETE FROM sessions WHERE expires_at < NOW()"},
            {"id": "c6", "text": "INSERT INTO users (name, email) VALUES ('John', 'john@example.com')"},
        ],
        "queries": [
            {"id": "q1", "text": "get all active users", "relevant": ["c1"]},
            {"id": "q2", "text": "count pending orders", "relevant": ["c2"]},
            {"id": "q3", "text": "total order amount by user", "relevant": ["c3"]},
            {"id": "q4", "text": "increase electronics prices by 10%", "relevant": ["c4"]},
            {"id": "q5", "text": "remove expired sessions", "relevant": ["c5"]},
            {"id": "q6", "text": "add new user", "relevant": ["c6"]},
        ]
    }

    return [text_to_code, code_to_code, text2sql]


# =============================================================================
# EVALUATION FUNCTIONS
# =============================================================================

def ndcg_at_k(ranked_list: List[str], relevant: List[str], k: int = 10) -> float:
    """Calculate NDCG@k."""
    dcg = 0.0
    for i, doc_id in enumerate(ranked_list[:k]):
        if doc_id in relevant:
            dcg += 1.0 / np.log2(i + 2)

    # Ideal DCG
    ideal_k = min(len(relevant), k)
    idcg = sum(1.0 / np.log2(i + 2) for i in range(ideal_k))

    return dcg / idcg if idcg > 0 else 0.0


def precision_at_k(ranked_list: List[str], relevant: List[str], k: int = 10) -> float:
    """Calculate Precision@k."""
    retrieved = set(ranked_list[:k])
    relevant_set = set(relevant)
    return len(retrieved & relevant_set) / k


def recall_at_k(ranked_list: List[str], relevant: List[str], k: int = 10) -> float:
    """Calculate Recall@k."""
    retrieved = set(ranked_list[:k])
    relevant_set = set(relevant)
    return len(retrieved & relevant_set) / len(relevant_set) if relevant_set else 0.0


def mrr(ranked_list: List[str], relevant: List[str]) -> float:
    """Calculate Mean Reciprocal Rank."""
    for i, doc_id in enumerate(ranked_list):
        if doc_id in relevant:
            return 1.0 / (i + 1)
    return 0.0


def evaluate_model(model_name: str, encode_fn, datasets: List[Dict]) -> Dict:
    """Evaluate a model on all datasets."""
    results = {}

    for dataset in datasets:
        corpus = dataset["corpus"]
        queries = dataset["queries"]

        corpus_ids = [doc["id"] for doc in corpus]
        corpus_texts = [doc["text"] for doc in corpus]
        corpus_embs = encode_fn(corpus_texts)

        metrics = {"ndcg@10": [], "precision@10": [], "recall@10": [], "mrr": []}

        for query in queries:
            query_emb = encode_fn([query["text"]])[0]

            # Compute similarity scores
            if hasattr(corpus_embs, 'shape') and len(corpus_embs.shape) == 2:
                # Dense vectors - cosine similarity
                q_norm = query_emb / (np.linalg.norm(query_emb) + 1e-8)
                c_norm = corpus_embs / (np.linalg.norm(corpus_embs, axis=1, keepdims=True) + 1e-8)
                scores = np.dot(c_norm, q_norm)
            else:
                # Sparse - dot product
                scores = np.array([np.dot(c, query_emb) for c in corpus_embs])

            ranked_indices = np.argsort(scores)[::-1]
            ranked_ids = [corpus_ids[i] for i in ranked_indices]
            relevant = query["relevant"]

            metrics["ndcg@10"].append(ndcg_at_k(ranked_ids, relevant, 10))
            metrics["precision@10"].append(precision_at_k(ranked_ids, relevant, 10))
            metrics["recall@10"].append(recall_at_k(ranked_ids, relevant, 10))
            metrics["mrr"].append(mrr(ranked_ids, relevant))

        results[dataset["name"]] = {k: np.mean(v) * 100 for k, v in metrics.items()}

    # Calculate average
    all_ndcg = [results[d["name"]]["ndcg@10"] for d in datasets]
    results["Average"] = {
        "ndcg@10": np.mean(all_ndcg),
        "note": "Average across all datasets"
    }

    return results


# =============================================================================
# MODEL IMPLEMENTATIONS
# =============================================================================

def get_splade_encoder():
    """Get SPLADE encoding function."""
    from codexlens.semantic.splade_encoder import get_splade_encoder as _get_splade
    encoder = _get_splade()

    def encode(texts):
        sparse_vecs = encoder.encode_batch(texts) if len(texts) > 1 else [encoder.encode_text(texts[0])]
        # Convert to dense for comparison
        vocab_size = encoder.vocab_size
        dense = np.zeros((len(sparse_vecs), vocab_size), dtype=np.float32)
        for i, sv in enumerate(sparse_vecs):
            for tid, w in sv.items():
                dense[i, tid] = w
        return dense

    return encode


def get_dense_encoder(model_name: str = "all-MiniLM-L6-v2"):
    """Get dense embedding encoding function."""
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(model_name)

    def encode(texts):
        return model.encode(texts, show_progress_bar=False)

    return encode


# =============================================================================
# REPORT GENERATION
# =============================================================================

def generate_report(local_results: Dict, output_path: str = None):
    """Generate comprehensive benchmark report."""

    report = []
    report.append("=" * 80)
    report.append("CODE RETRIEVAL BENCHMARK REPORT")
    report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report.append("=" * 80)

    # Section 1: Reference Benchmark Scores
    report.append("\n## 1. CoIR Benchmark Reference Scores (Published)")
    report.append("\nSource: CoIR Paper (ACL 2025) - https://arxiv.org/abs/2407.02883")
    report.append("\n### NDCG@10 Scores by Model and Dataset\n")

    # Header
    datasets = ["APPS", "CosQA", "Text2SQL", "CodeSearchNet", "CCR", "Contest-DL", "StackOverflow", "FB-ST", "FB-MT", "Average"]
    header = "| Model | " + " | ".join(datasets) + " |"
    separator = "|" + "|".join(["---"] * (len(datasets) + 1)) + "|"
    report.append(header)
    report.append(separator)

    # Data rows
    for model, scores in COIR_REFERENCE_SCORES.items():
        row = f"| {model} | " + " | ".join([f"{scores.get(d, '-'):.2f}" if isinstance(scores.get(d), (int, float)) else str(scores.get(d, '-')) for d in datasets]) + " |"
        report.append(row)

    # Section 2: Recent Models
    report.append("\n### Recent Top Performers (2025)\n")
    report.append("| Model | Average NDCG@10 | Notes |")
    report.append("|-------|-----------------|-------|")
    for model, info in RECENT_MODELS.items():
        avg = info.get("Average", "-")
        note = info.get("note", "")
        report.append(f"| {model} | {avg} | {note} |")

    # Section 3: Local Evaluation Results
    report.append("\n## 2. Local Evaluation Results\n")
    report.append("Evaluated on synthetic CoIR-like datasets\n")

    for model_name, results in local_results.items():
        report.append(f"\n### {model_name}\n")
        report.append("| Dataset | NDCG@10 | Precision@10 | Recall@10 | MRR |")
        report.append("|---------|---------|--------------|-----------|-----|")
        for dataset_name, metrics in results.items():
            if dataset_name == "Average":
                continue
            ndcg = metrics.get("ndcg@10", 0)
            prec = metrics.get("precision@10", 0)
            rec = metrics.get("recall@10", 0)
            m = metrics.get("mrr", 0)
            report.append(f"| {dataset_name} | {ndcg:.2f} | {prec:.2f} | {rec:.2f} | {m:.2f} |")

        if "Average" in results:
            avg = results["Average"]["ndcg@10"]
            report.append(f"| **Average** | **{avg:.2f}** | - | - | - |")

    # Section 4: Comparison Analysis
    report.append("\n## 3. Comparison Analysis\n")

    if "SPLADE" in local_results and "Dense (MiniLM)" in local_results:
        splade_avg = local_results["SPLADE"]["Average"]["ndcg@10"]
        dense_avg = local_results["Dense (MiniLM)"]["Average"]["ndcg@10"]

        report.append("### SPLADE vs Dense Embedding\n")
        report.append(f"- SPLADE Average NDCG@10: {splade_avg:.2f}")
        report.append(f"- Dense (MiniLM) Average NDCG@10: {dense_avg:.2f}")

        if splade_avg > dense_avg:
            diff = ((splade_avg - dense_avg) / dense_avg) * 100
            report.append(f"- SPLADE outperforms by {diff:.1f}%")
        else:
            diff = ((dense_avg - splade_avg) / splade_avg) * 100
            report.append(f"- Dense outperforms by {diff:.1f}%")

    # Section 5: Key Insights
    report.append("\n## 4. Key Insights\n")
    report.append("""
1. **Voyage-Code-002** achieved highest mean score (56.26) on original CoIR benchmark
2. **SFR-Embedding-Code-7B** (Salesforce) reached #1 in Feb 2025 with 67.4 average
3. **SPLADE** provides good balance of:
   - Interpretability (visible token activations)
   - Query expansion (learned synonyms)
   - Efficient sparse retrieval

4. **Task-specific performance varies significantly**:
   - E5-Mistral excels at Contest-DL (82.55) but median on APPS
   - Voyage-Code-002 excels at CodeSearchNet (81.79)
   - No single model dominates all tasks

5. **Hybrid approaches recommended**:
   - Combine sparse (SPLADE/BM25) with dense for best results
   - Use RRF (Reciprocal Rank Fusion) for score combination
""")

    # Section 6: Recommendations
    report.append("\n## 5. Recommendations for Codex-lens\n")
    report.append("""
| Use Case | Recommended Approach |
|----------|---------------------|
| General code search | SPLADE + Dense hybrid |
| Exact keyword match | FTS (BM25) |
| Semantic understanding | Dense embedding |
| Interpretable results | SPLADE only |
| Maximum accuracy | SFR-Embedding-Code + SPLADE fusion |
""")

    report_text = "\n".join(report)

    if output_path:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report_text)
        print(f"Report saved to: {output_path}")

    return report_text


# =============================================================================
# MAIN
# =============================================================================

def main():
    print("=" * 80)
    print("CODE RETRIEVAL BENCHMARK EVALUATION")
    print("=" * 80)

    # Create test datasets
    print("\nCreating test datasets...")
    datasets = create_test_datasets()
    print(f"  Created {len(datasets)} datasets")

    local_results = {}

    # Evaluate SPLADE
    print("\nEvaluating SPLADE...")
    try:
        from codexlens.semantic.splade_encoder import check_splade_available
        ok, err = check_splade_available()
        if ok:
            start = time.perf_counter()
            splade_encode = get_splade_encoder()
            splade_results = evaluate_model("SPLADE", splade_encode, datasets)
            elapsed = time.perf_counter() - start
            local_results["SPLADE"] = splade_results
            print(f"  SPLADE evaluated in {elapsed:.2f}s")
            print(f"  Average NDCG@10: {splade_results['Average']['ndcg@10']:.2f}")
        else:
            print(f"  SPLADE not available: {err}")
    except Exception as e:
        print(f"  SPLADE evaluation failed: {e}")

    # Evaluate Dense (MiniLM)
    print("\nEvaluating Dense (all-MiniLM-L6-v2)...")
    try:
        start = time.perf_counter()
        dense_encode = get_dense_encoder("all-MiniLM-L6-v2")
        dense_results = evaluate_model("Dense (MiniLM)", dense_encode, datasets)
        elapsed = time.perf_counter() - start
        local_results["Dense (MiniLM)"] = dense_results
        print(f"  Dense evaluated in {elapsed:.2f}s")
        print(f"  Average NDCG@10: {dense_results['Average']['ndcg@10']:.2f}")
    except Exception as e:
        print(f"  Dense evaluation failed: {e}")

    # Generate report
    print("\nGenerating report...")
    report = generate_report(local_results, "benchmark_report.md")

    print("\n" + "=" * 80)
    print("BENCHMARK COMPLETE")
    print("=" * 80)
    print("\nReport preview:\n")
    print(report[:3000] + "\n...[truncated]...")

    return local_results


if __name__ == "__main__":
    main()
