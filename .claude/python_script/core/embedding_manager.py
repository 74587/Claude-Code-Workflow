#!/usr/bin/env python3
"""
Embedding Manager Module for UltraThink Path-Aware Analyzer
Manages embeddings for semantic similarity search (RAG functionality).
"""

import os
import json
import hashlib
import logging
import pickle
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass
import time

# Optional imports for embedding functionality
try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False

from .file_indexer import FileInfo

@dataclass
class EmbeddingInfo:
    """Information about a file's embedding."""
    file_path: str
    content_hash: str
    embedding_hash: str
    created_time: float
    vector_size: int

@dataclass
class SimilarityResult:
    """Result of similarity search."""
    file_info: FileInfo
    similarity_score: float
    matching_content: str

class EmbeddingManager:
    """Manages embeddings for semantic file matching."""

    def __init__(self, config: Dict):
        self.config = config
        self.logger = logging.getLogger(__name__)

        # Check if embeddings are enabled
        self.enabled = config.get('embedding', {}).get('enabled', False)
        if not self.enabled:
            self.logger.info("Embeddings disabled in configuration")
            return

        # Check dependencies
        if not NUMPY_AVAILABLE:
            self.logger.warning("NumPy not available, disabling embeddings")
            self.enabled = False
            return

        if not SENTENCE_TRANSFORMERS_AVAILABLE:
            self.logger.warning("sentence-transformers not available, disabling embeddings")
            self.enabled = False
            return

        # Load configuration
        self.model_name = config.get('embedding', {}).get('model', 'all-MiniLM-L6-v2')
        self.cache_dir = Path(config.get('embedding', {}).get('cache_dir', '.claude/cache/embeddings'))
        self.similarity_threshold = config.get('embedding', {}).get('similarity_threshold', 0.6)
        self.max_context_length = config.get('embedding', {}).get('max_context_length', 512)
        self.batch_size = config.get('embedding', {}).get('batch_size', 32)
        self.trust_remote_code = config.get('embedding', {}).get('trust_remote_code', False)

        # Setup cache directories
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.embeddings_file = self.cache_dir / "embeddings.pkl"
        self.index_file = self.cache_dir / "embedding_index.json"

        # Initialize model lazily
        self._model = None
        self._embeddings_cache = None
        self._embedding_index = None

    @property
    def model(self):
        """Lazy load the embedding model."""
        if not self.enabled:
            return None

        if self._model is None:
            try:
                self.logger.info(f"Loading embedding model: {self.model_name}")
                # Initialize with trust_remote_code for CodeSage V2
                if self.trust_remote_code:
                    self._model = SentenceTransformer(self.model_name, trust_remote_code=True)
                else:
                    self._model = SentenceTransformer(self.model_name)
                self.logger.info(f"Model loaded successfully")
            except Exception as e:
                self.logger.error(f"Failed to load embedding model: {e}")
                self.enabled = False
                return None

        return self._model

    def embeddings_exist(self) -> bool:
        """Check if embeddings cache exists."""
        return self.embeddings_file.exists() and self.index_file.exists()

    def _load_embedding_cache(self) -> Dict[str, np.ndarray]:
        """Load embeddings from cache."""
        if self._embeddings_cache is not None:
            return self._embeddings_cache

        if not self.embeddings_file.exists():
            self._embeddings_cache = {}
            return self._embeddings_cache

        try:
            with open(self.embeddings_file, 'rb') as f:
                self._embeddings_cache = pickle.load(f)
            self.logger.debug(f"Loaded {len(self._embeddings_cache)} embeddings from cache")
        except Exception as e:
            self.logger.warning(f"Failed to load embeddings cache: {e}")
            self._embeddings_cache = {}

        return self._embeddings_cache

    def _save_embedding_cache(self):
        """Save embeddings to cache."""
        if self._embeddings_cache is None:
            return

        try:
            with open(self.embeddings_file, 'wb') as f:
                pickle.dump(self._embeddings_cache, f)
            self.logger.debug(f"Saved {len(self._embeddings_cache)} embeddings to cache")
        except Exception as e:
            self.logger.error(f"Failed to save embeddings cache: {e}")

    def _load_embedding_index(self) -> Dict[str, EmbeddingInfo]:
        """Load embedding index."""
        if self._embedding_index is not None:
            return self._embedding_index

        if not self.index_file.exists():
            self._embedding_index = {}
            return self._embedding_index

        try:
            with open(self.index_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self._embedding_index = {}
                for path, info_dict in data.items():
                    self._embedding_index[path] = EmbeddingInfo(**info_dict)
            self.logger.debug(f"Loaded embedding index with {len(self._embedding_index)} entries")
        except Exception as e:
            self.logger.warning(f"Failed to load embedding index: {e}")
            self._embedding_index = {}

        return self._embedding_index

    def _save_embedding_index(self):
        """Save embedding index."""
        if self._embedding_index is None:
            return

        try:
            data = {}
            for path, info in self._embedding_index.items():
                data[path] = {
                    'file_path': info.file_path,
                    'content_hash': info.content_hash,
                    'embedding_hash': info.embedding_hash,
                    'created_time': info.created_time,
                    'vector_size': info.vector_size
                }

            with open(self.index_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2)
            self.logger.debug(f"Saved embedding index with {len(self._embedding_index)} entries")
        except Exception as e:
            self.logger.error(f"Failed to save embedding index: {e}")

    def _extract_text_content(self, file_info: FileInfo) -> Optional[str]:
        """Extract text content from a file for embedding."""
        try:
            file_path = Path(file_info.path)

            # Skip binary files and very large files
            if file_info.size > self.config.get('performance', {}).get('max_file_size', 10485760):
                return None

            # Only process text-based files
            text_extensions = {'.py', '.js', '.ts', '.tsx', '.jsx', '.java', '.cpp', '.c', '.h',
                             '.rs', '.go', '.php', '.rb', '.sh', '.bash', '.md', '.txt', '.json',
                             '.yaml', '.yml', '.xml', '.html', '.css', '.scss', '.sass'}

            if file_info.extension.lower() not in text_extensions:
                return None

            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            # Truncate content if too long (CodeSage V2 supports longer contexts)
            if len(content) > self.max_context_length * 4:  # Approximate token limit
                content = content[:self.max_context_length * 4]

            return content

        except Exception as e:
            self.logger.debug(f"Could not extract content from {file_info.path}: {e}")
            return None

    def _create_embedding(self, text: str) -> Optional[np.ndarray]:
        """Create embedding for text content."""
        if not self.enabled or self.model is None:
            return None

        try:
            # Truncate text if needed
            if len(text) > self.max_context_length * 4:
                text = text[:self.max_context_length * 4]

            embedding = self.model.encode([text])[0]
            return embedding

        except Exception as e:
            self.logger.warning(f"Failed to create embedding: {e}")
            return None

    def _get_content_hash(self, content: str) -> str:
        """Get hash of content for caching."""
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def _get_embedding_hash(self, embedding: np.ndarray) -> str:
        """Get hash of embedding for verification."""
        return hashlib.md5(embedding.tobytes()).hexdigest()

    def update_embeddings(self, file_index: Dict[str, FileInfo], force_rebuild: bool = False) -> int:
        """Update embeddings for files in the index."""
        if not self.enabled:
            self.logger.info("Embeddings disabled, skipping update")
            return 0

        self.logger.info("Updating embeddings...")

        # Load caches
        embeddings_cache = self._load_embedding_cache()
        embedding_index = self._load_embedding_index()

        new_embeddings = 0
        batch_texts = []
        batch_paths = []

        for file_path, file_info in file_index.items():
            # Check if embedding exists and is current
            if not force_rebuild and file_path in embedding_index:
                cached_info = embedding_index[file_path]
                if cached_info.content_hash == file_info.content_hash:
                    continue  # Embedding is current

            # Extract content
            content = self._extract_text_content(file_info)
            if content is None:
                continue

            # Prepare for batch processing
            batch_texts.append(content)
            batch_paths.append(file_path)

            # Process batch when full
            if len(batch_texts) >= self.batch_size:
                self._process_batch(batch_texts, batch_paths, file_index, embeddings_cache, embedding_index)
                new_embeddings += len(batch_texts)
                batch_texts = []
                batch_paths = []

        # Process remaining batch
        if batch_texts:
            self._process_batch(batch_texts, batch_paths, file_index, embeddings_cache, embedding_index)
            new_embeddings += len(batch_texts)

        # Save caches
        self._save_embedding_cache()
        self._save_embedding_index()

        self.logger.info(f"Updated {new_embeddings} embeddings")
        return new_embeddings

    def _process_batch(self, texts: List[str], paths: List[str], file_index: Dict[str, FileInfo],
                      embeddings_cache: Dict[str, np.ndarray], embedding_index: Dict[str, EmbeddingInfo]):
        """Process a batch of texts for embedding."""
        try:
            # Create embeddings for batch
            embeddings = self.model.encode(texts)

            for i, (text, path) in enumerate(zip(texts, paths)):
                embedding = embeddings[i]
                file_info = file_index[path]

                # Store embedding
                content_hash = self._get_content_hash(text)
                embedding_hash = self._get_embedding_hash(embedding)

                embeddings_cache[path] = embedding
                embedding_index[path] = EmbeddingInfo(
                    file_path=path,
                    content_hash=content_hash,
                    embedding_hash=embedding_hash,
                    created_time=time.time(),
                    vector_size=len(embedding)
                )

        except Exception as e:
            self.logger.error(f"Failed to process embedding batch: {e}")

    def find_similar_files(self, query: str, file_index: Dict[str, FileInfo],
                          top_k: int = 20) -> List[SimilarityResult]:
        """Find files similar to the query using embeddings."""
        if not self.enabled:
            return []

        # Create query embedding
        query_embedding = self._create_embedding(query)
        if query_embedding is None:
            return []

        # Load embeddings
        embeddings_cache = self._load_embedding_cache()
        if not embeddings_cache:
            self.logger.warning("No embeddings available for similarity search")
            return []

        # Calculate similarities
        similarities = []
        for file_path, file_embedding in embeddings_cache.items():
            if file_path not in file_index:
                continue

            try:
                # Calculate cosine similarity
                similarity = np.dot(query_embedding, file_embedding) / (
                    np.linalg.norm(query_embedding) * np.linalg.norm(file_embedding)
                )

                if similarity >= self.similarity_threshold:
                    similarities.append((file_path, similarity))

            except Exception as e:
                self.logger.debug(f"Failed to calculate similarity for {file_path}: {e}")
                continue

        # Sort by similarity
        similarities.sort(key=lambda x: x[1], reverse=True)

        # Create results
        results = []
        for file_path, similarity in similarities[:top_k]:
            file_info = file_index[file_path]

            # Extract a snippet of matching content
            content = self._extract_text_content(file_info)
            snippet = content[:200] + "..." if content and len(content) > 200 else content or ""

            result = SimilarityResult(
                file_info=file_info,
                similarity_score=similarity,
                matching_content=snippet
            )
            results.append(result)

        self.logger.info(f"Found {len(results)} similar files for query")
        return results

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the embedding cache."""
        if not self.enabled:
            return {'enabled': False}

        embedding_index = self._load_embedding_index()
        embeddings_cache = self._load_embedding_cache()

        return {
            'enabled': True,
            'model_name': self.model_name,
            'total_embeddings': len(embedding_index),
            'cache_size_mb': os.path.getsize(self.embeddings_file) / 1024 / 1024 if self.embeddings_file.exists() else 0,
            'similarity_threshold': self.similarity_threshold,
            'vector_size': list(embedding_index.values())[0].vector_size if embedding_index else 0
        }

def main():
    """Command-line interface for embedding manager."""
    import yaml
    import argparse
    from .file_indexer import FileIndexer

    parser = argparse.ArgumentParser(description="Embedding Manager for UltraThink")
    parser.add_argument("--config", default="config.yaml", help="Configuration file path")
    parser.add_argument("--update", action="store_true", help="Update embeddings")
    parser.add_argument("--rebuild", action="store_true", help="Force rebuild all embeddings")
    parser.add_argument("--query", help="Search for similar files")
    parser.add_argument("--stats", action="store_true", help="Show embedding statistics")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    # Setup logging
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(level=level, format='%(levelname)s: %(message)s')

    # Load configuration
    config_path = Path(__file__).parent / args.config
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)

    # Create components
    indexer = FileIndexer(config)
    embedding_manager = EmbeddingManager(config)

    if not embedding_manager.enabled:
        print("Embeddings are disabled. Enable in config.yaml or install required dependencies.")
        return

    # Load file index
    file_index = indexer.load_index()
    if not file_index:
        print("Building file index...")
        file_index = indexer.build_index()

    if args.stats:
        stats = embedding_manager.get_stats()
        print("Embedding Statistics:")
        for key, value in stats.items():
            print(f"  {key}: {value}")
        return

    if args.update or args.rebuild:
        count = embedding_manager.update_embeddings(file_index, force_rebuild=args.rebuild)
        print(f"Updated {count} embeddings")

    if args.query:
        results = embedding_manager.find_similar_files(args.query, file_index)
        print(f"Found {len(results)} similar files:")
        for result in results:
            print(f"  {result.file_info.relative_path} (similarity: {result.similarity_score:.3f})")
            if args.verbose and result.matching_content:
                print(f"    Content: {result.matching_content[:100]}...")

if __name__ == "__main__":
    main()