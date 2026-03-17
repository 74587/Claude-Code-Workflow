from __future__ import annotations
import logging
from dataclasses import dataclass, field

log = logging.getLogger(__name__)


@dataclass
class Config:
    # Embedding
    embed_model: str = "BAAI/bge-small-en-v1.5"
    embed_dim: int = 384
    embed_batch_size: int = 64

    # Model download / cache
    model_cache_dir: str = ""  # empty = fastembed default cache
    hf_mirror: str = ""  # HuggingFace mirror URL, e.g. "https://hf-mirror.com"

    # GPU / execution providers
    device: str = "auto"  # 'auto', 'cuda', 'cpu'
    embed_providers: list[str] | None = None  # explicit ONNX providers override

    # Backend selection: 'auto', 'faiss', 'hnswlib'
    ann_backend: str = "auto"
    binary_backend: str = "auto"

    # Indexing pipeline
    index_workers: int = 2  # number of parallel indexing workers

    # HNSW index (ANNIndex)
    hnsw_ef: int = 150
    hnsw_M: int = 32
    hnsw_ef_construction: int = 200

    # Binary coarse search (BinaryStore)
    binary_top_k: int = 200

    # ANN fine search
    ann_top_k: int = 50

    # Reranker
    reranker_model: str = "Xenova/ms-marco-MiniLM-L-6-v2"
    reranker_top_k: int = 20
    reranker_batch_size: int = 32

    # API reranker (optional)
    reranker_api_url: str = ""
    reranker_api_key: str = ""
    reranker_api_model: str = ""
    reranker_api_max_tokens_per_batch: int = 2048

    # Metadata store
    metadata_db_path: str = ""  # empty = no metadata tracking

    # FTS
    fts_top_k: int = 50

    # Fusion
    fusion_k: int = 60  # RRF k parameter
    fusion_weights: dict = field(default_factory=lambda: {
        "exact": 0.25,
        "fuzzy": 0.10,
        "vector": 0.50,
        "graph": 0.15,
    })

    def resolve_embed_providers(self) -> list[str]:
        """Return ONNX execution providers based on device config.

        Priority: explicit embed_providers > device setting > auto-detect.
        """
        if self.embed_providers is not None:
            return list(self.embed_providers)

        if self.device == "cuda":
            return ["CUDAExecutionProvider", "CPUExecutionProvider"]

        if self.device == "cpu":
            return ["CPUExecutionProvider"]

        # auto-detect
        try:
            import onnxruntime
            available = onnxruntime.get_available_providers()
            if "CUDAExecutionProvider" in available:
                log.info("CUDA detected via onnxruntime, using GPU for embedding")
                return ["CUDAExecutionProvider", "CPUExecutionProvider"]
        except ImportError:
            pass

        return ["CPUExecutionProvider"]

    @classmethod
    def defaults(cls) -> "Config":
        return cls()

    @classmethod
    def small(cls) -> "Config":
        """Smaller config for testing or small corpora."""
        return cls(
            hnsw_ef=50,
            hnsw_M=16,
            binary_top_k=50,
            ann_top_k=20,
            reranker_top_k=10,
        )
