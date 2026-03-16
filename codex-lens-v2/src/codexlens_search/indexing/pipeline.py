"""Three-stage parallel indexing pipeline: chunk -> embed -> index.

Uses threading.Thread with queue.Queue for producer-consumer handoff.
The GIL is acceptable because embedding (onnxruntime) releases it in C extensions.
"""
from __future__ import annotations

import logging
import queue
import threading
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from codexlens_search.config import Config
from codexlens_search.core.binary import BinaryStore
from codexlens_search.core.index import ANNIndex
from codexlens_search.embed.base import BaseEmbedder
from codexlens_search.search.fts import FTSEngine

logger = logging.getLogger(__name__)

# Sentinel value to signal worker shutdown
_SENTINEL = None

# Defaults for chunking (can be overridden via index_files kwargs)
_DEFAULT_MAX_CHUNK_CHARS = 800
_DEFAULT_CHUNK_OVERLAP = 100


@dataclass
class IndexStats:
    """Statistics returned after indexing completes."""
    files_processed: int = 0
    chunks_created: int = 0
    duration_seconds: float = 0.0


class IndexingPipeline:
    """Parallel 3-stage indexing pipeline with queue-based handoff.

    Stage 1 (main thread): Read files, chunk text, push to embed_queue.
    Stage 2 (embed worker): Pull text batches, call embed_batch(), push vectors to index_queue.
    Stage 3 (index worker): Pull vectors+ids, call BinaryStore.add(), ANNIndex.add(), FTS.add_documents().

    After all stages complete, save() is called on BinaryStore and ANNIndex exactly once.
    """

    def __init__(
        self,
        embedder: BaseEmbedder,
        binary_store: BinaryStore,
        ann_index: ANNIndex,
        fts: FTSEngine,
        config: Config,
    ) -> None:
        self._embedder = embedder
        self._binary_store = binary_store
        self._ann_index = ann_index
        self._fts = fts
        self._config = config

    def index_files(
        self,
        files: list[Path],
        *,
        root: Path | None = None,
        max_chunk_chars: int = _DEFAULT_MAX_CHUNK_CHARS,
        chunk_overlap: int = _DEFAULT_CHUNK_OVERLAP,
        max_file_size: int = 50_000,
    ) -> IndexStats:
        """Run the 3-stage pipeline on the given files.

        Args:
            files: List of file paths to index.
            root: Optional root for computing relative paths. If None, uses
                  each file's absolute path as its identifier.
            max_chunk_chars: Maximum characters per chunk.
            chunk_overlap: Character overlap between consecutive chunks.
            max_file_size: Skip files larger than this (bytes).

        Returns:
            IndexStats with counts and timing.
        """
        if not files:
            return IndexStats()

        t0 = time.monotonic()

        embed_queue: queue.Queue = queue.Queue(maxsize=4)
        index_queue: queue.Queue = queue.Queue(maxsize=4)

        # Track errors from workers
        worker_errors: list[Exception] = []
        error_lock = threading.Lock()

        def _record_error(exc: Exception) -> None:
            with error_lock:
                worker_errors.append(exc)

        # --- Start workers ---
        embed_thread = threading.Thread(
            target=self._embed_worker,
            args=(embed_queue, index_queue, _record_error),
            daemon=True,
            name="indexing-embed",
        )
        index_thread = threading.Thread(
            target=self._index_worker,
            args=(index_queue, _record_error),
            daemon=True,
            name="indexing-index",
        )
        embed_thread.start()
        index_thread.start()

        # --- Stage 1: chunk files (main thread) ---
        chunk_id = 0
        files_processed = 0
        chunks_created = 0

        for fpath in files:
            try:
                if fpath.stat().st_size > max_file_size:
                    continue
                text = fpath.read_text(encoding="utf-8", errors="replace")
            except Exception as exc:
                logger.debug("Skipping %s: %s", fpath, exc)
                continue

            rel_path = str(fpath.relative_to(root)) if root else str(fpath)
            file_chunks = self._chunk_text(text, rel_path, max_chunk_chars, chunk_overlap)

            if not file_chunks:
                continue

            files_processed += 1

            # Assign sequential IDs and push batch to embed queue
            batch_ids = []
            batch_texts = []
            batch_paths = []
            for chunk_text, path in file_chunks:
                batch_ids.append(chunk_id)
                batch_texts.append(chunk_text)
                batch_paths.append(path)
                chunk_id += 1

            chunks_created += len(batch_ids)
            embed_queue.put((batch_ids, batch_texts, batch_paths))

        # Signal embed worker: no more data
        embed_queue.put(_SENTINEL)

        # Wait for workers to finish
        embed_thread.join()
        index_thread.join()

        # --- Final flush ---
        self._binary_store.save()
        self._ann_index.save()

        duration = time.monotonic() - t0
        stats = IndexStats(
            files_processed=files_processed,
            chunks_created=chunks_created,
            duration_seconds=round(duration, 2),
        )

        logger.info(
            "Indexing complete: %d files, %d chunks in %.1fs",
            stats.files_processed,
            stats.chunks_created,
            stats.duration_seconds,
        )

        # Raise first worker error if any occurred
        if worker_errors:
            raise worker_errors[0]

        return stats

    # ------------------------------------------------------------------
    # Workers
    # ------------------------------------------------------------------

    def _embed_worker(
        self,
        in_q: queue.Queue,
        out_q: queue.Queue,
        on_error: callable,
    ) -> None:
        """Stage 2: Pull chunk batches, embed, push (ids, vecs, docs) to index queue."""
        try:
            while True:
                item = in_q.get()
                if item is _SENTINEL:
                    break

                batch_ids, batch_texts, batch_paths = item
                try:
                    vecs = self._embedder.embed_batch(batch_texts)
                    vec_array = np.array(vecs, dtype=np.float32)
                    id_array = np.array(batch_ids, dtype=np.int64)
                    out_q.put((id_array, vec_array, batch_texts, batch_paths))
                except Exception as exc:
                    logger.error("Embed worker error: %s", exc)
                    on_error(exc)
        finally:
            # Signal index worker: no more data
            out_q.put(_SENTINEL)

    def _index_worker(
        self,
        in_q: queue.Queue,
        on_error: callable,
    ) -> None:
        """Stage 3: Pull (ids, vecs, texts, paths), write to stores."""
        while True:
            item = in_q.get()
            if item is _SENTINEL:
                break

            id_array, vec_array, texts, paths = item
            try:
                self._binary_store.add(id_array, vec_array)
                self._ann_index.add(id_array, vec_array)

                fts_docs = [
                    (int(id_array[i]), paths[i], texts[i])
                    for i in range(len(id_array))
                ]
                self._fts.add_documents(fts_docs)
            except Exception as exc:
                logger.error("Index worker error: %s", exc)
                on_error(exc)

    # ------------------------------------------------------------------
    # Chunking
    # ------------------------------------------------------------------

    @staticmethod
    def _chunk_text(
        text: str,
        path: str,
        max_chars: int,
        overlap: int,
    ) -> list[tuple[str, str]]:
        """Split file text into overlapping chunks.

        Returns list of (chunk_text, path) tuples.
        """
        if not text.strip():
            return []

        chunks: list[tuple[str, str]] = []
        lines = text.splitlines(keepends=True)
        current: list[str] = []
        current_len = 0

        for line in lines:
            if current_len + len(line) > max_chars and current:
                chunk = "".join(current)
                chunks.append((chunk, path))
                # overlap: keep last N characters
                tail = "".join(current)[-overlap:]
                current = [tail] if tail else []
                current_len = len(tail)
            current.append(line)
            current_len += len(line)

        if current:
            chunks.append(("".join(current), path))

        return chunks
