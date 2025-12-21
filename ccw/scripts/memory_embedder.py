#!/usr/bin/env python3
"""
Memory Embedder - Bridge CCW to CodexLens semantic search

This script generates and searches embeddings for memory chunks stored in CCW's
SQLite database using CodexLens's embedder.

Usage:
    python memory_embedder.py embed <db_path> [--source-id ID] [--batch-size N] [--force]
    python memory_embedder.py search <db_path> <query> [--top-k N] [--min-score F] [--type TYPE]
    python memory_embedder.py status <db_path>
"""

import argparse
import json
import sqlite3
import sys
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

try:
    import numpy as np
except ImportError:
    print("Error: numpy is required. Install with: pip install numpy", file=sys.stderr)
    sys.exit(1)

try:
    from codexlens.semantic.embedder import get_embedder, clear_embedder_cache
except ImportError:
    print("Error: CodexLens not found. Install with: pip install codexlens[semantic]", file=sys.stderr)
    sys.exit(1)


class MemoryEmbedder:
    """Generate and search embeddings for memory chunks."""

    EMBEDDING_DIM = 768  # jina-embeddings-v2-base-code dimension

    def __init__(self, db_path: str):
        """Initialize embedder with database path."""
        self.db_path = Path(db_path)
        if not self.db_path.exists():
            raise FileNotFoundError(f"Database not found: {db_path}")

        self.conn = sqlite3.connect(str(self.db_path))
        self.conn.row_factory = sqlite3.Row

        # Lazy-load embedder to avoid ~0.8s model loading for status command
        self._embedder = None

    @property
    def embedder(self):
        """Lazy-load the embedder on first access."""
        if self._embedder is None:
            self._embedder = get_embedder(profile="code")
        return self._embedder

    def close(self):
        """Close database connection."""
        if self.conn:
            self.conn.close()

    def embed_chunks(
        self,
        source_id: Optional[str] = None,
        batch_size: int = 8,
        force: bool = False
    ) -> Dict[str, Any]:
        """
        Generate embeddings for unembedded chunks.

        Args:
            source_id: Only process chunks from this source
            batch_size: Number of chunks to process in each batch
            force: Re-embed chunks that already have embeddings

        Returns:
            Result dict with success, chunks_processed, chunks_failed, elapsed_time
        """
        start_time = time.time()

        # Build query
        query = "SELECT id, source_id, source_type, chunk_index, content FROM memory_chunks"
        params = []

        if force:
            # Process all chunks (with optional source filter)
            if source_id:
                query += " WHERE source_id = ?"
                params.append(source_id)
        else:
            # Only process chunks without embeddings
            query += " WHERE embedding IS NULL"
            if source_id:
                query += " AND source_id = ?"
                params.append(source_id)

        query += " ORDER BY id"

        cursor = self.conn.cursor()
        cursor.execute(query, params)

        chunks_processed = 0
        chunks_failed = 0
        batch = []
        batch_ids = []

        for row in cursor:
            batch.append(row["content"])
            batch_ids.append(row["id"])

            # Process batch when full
            if len(batch) >= batch_size:
                processed, failed = self._process_batch(batch, batch_ids)
                chunks_processed += processed
                chunks_failed += failed
                batch = []
                batch_ids = []

        # Process remaining chunks
        if batch:
            processed, failed = self._process_batch(batch, batch_ids)
            chunks_processed += processed
            chunks_failed += failed

        elapsed_time = time.time() - start_time

        return {
            "success": chunks_failed == 0,
            "chunks_processed": chunks_processed,
            "chunks_failed": chunks_failed,
            "elapsed_time": round(elapsed_time, 2)
        }

    def _process_batch(self, texts: List[str], ids: List[int]) -> Tuple[int, int]:
        """Process a batch of texts and update embeddings."""
        try:
            # Generate embeddings for batch
            embeddings = self.embedder.embed(texts)

            processed = 0
            failed = 0

            # Update database
            cursor = self.conn.cursor()
            for chunk_id, embedding in zip(ids, embeddings):
                try:
                    # Convert to numpy array and store as bytes
                    emb_array = np.array(embedding, dtype=np.float32)
                    emb_bytes = emb_array.tobytes()

                    cursor.execute(
                        "UPDATE memory_chunks SET embedding = ? WHERE id = ?",
                        (emb_bytes, chunk_id)
                    )
                    processed += 1
                except Exception as e:
                    print(f"Error updating chunk {chunk_id}: {e}", file=sys.stderr)
                    failed += 1

            self.conn.commit()
            return processed, failed

        except Exception as e:
            print(f"Error processing batch: {e}", file=sys.stderr)
            return 0, len(ids)

    def search(
        self,
        query: str,
        top_k: int = 10,
        min_score: float = 0.3,
        source_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Perform semantic search on memory chunks.

        Args:
            query: Search query text
            top_k: Number of results to return
            min_score: Minimum similarity score (0-1)
            source_type: Filter by source type (core_memory, workflow, cli_history)

        Returns:
            Result dict with success and matches list
        """
        try:
            # Generate query embedding
            query_embedding = self.embedder.embed_single(query)
            query_array = np.array(query_embedding, dtype=np.float32)

            # Build database query
            sql = """
                SELECT id, source_id, source_type, chunk_index, content, embedding
                FROM memory_chunks
                WHERE embedding IS NOT NULL
            """
            params = []

            if source_type:
                sql += " AND source_type = ?"
                params.append(source_type)

            cursor = self.conn.cursor()
            cursor.execute(sql, params)

            # Calculate similarities
            matches = []
            for row in cursor:
                # Load embedding from bytes
                emb_bytes = row["embedding"]
                emb_array = np.frombuffer(emb_bytes, dtype=np.float32)

                # Cosine similarity
                score = float(
                    np.dot(query_array, emb_array) /
                    (np.linalg.norm(query_array) * np.linalg.norm(emb_array))
                )

                if score >= min_score:
                    # Generate restore command
                    restore_command = self._get_restore_command(
                        row["source_id"],
                        row["source_type"]
                    )

                    matches.append({
                        "source_id": row["source_id"],
                        "source_type": row["source_type"],
                        "chunk_index": row["chunk_index"],
                        "content": row["content"],
                        "score": round(score, 4),
                        "restore_command": restore_command
                    })

            # Sort by score and limit
            matches.sort(key=lambda x: x["score"], reverse=True)
            matches = matches[:top_k]

            return {
                "success": True,
                "matches": matches
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "matches": []
            }

    def _get_restore_command(self, source_id: str, source_type: str) -> str:
        """Generate restore command for a source."""
        if source_type in ("core_memory", "cli_history"):
            return f"ccw memory export {source_id}"
        elif source_type == "workflow":
            return f"ccw session resume {source_id}"
        else:
            return f"# Unknown source type: {source_type}"

    def get_status(self) -> Dict[str, Any]:
        """Get embedding status statistics."""
        cursor = self.conn.cursor()

        # Total chunks
        cursor.execute("SELECT COUNT(*) as count FROM memory_chunks")
        total_chunks = cursor.fetchone()["count"]

        # Embedded chunks
        cursor.execute("SELECT COUNT(*) as count FROM memory_chunks WHERE embedding IS NOT NULL")
        embedded_chunks = cursor.fetchone()["count"]

        # By type
        cursor.execute("""
            SELECT
                source_type,
                COUNT(*) as total,
                SUM(CASE WHEN embedding IS NOT NULL THEN 1 ELSE 0 END) as embedded
            FROM memory_chunks
            GROUP BY source_type
        """)

        by_type = {}
        for row in cursor:
            by_type[row["source_type"]] = {
                "total": row["total"],
                "embedded": row["embedded"],
                "pending": row["total"] - row["embedded"]
            }

        return {
            "total_chunks": total_chunks,
            "embedded_chunks": embedded_chunks,
            "pending_chunks": total_chunks - embedded_chunks,
            "by_type": by_type
        }


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Memory Embedder - Bridge CCW to CodexLens semantic search"
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")
    subparsers.required = True

    # Embed command
    embed_parser = subparsers.add_parser("embed", help="Generate embeddings for chunks")
    embed_parser.add_argument("db_path", help="Path to SQLite database")
    embed_parser.add_argument("--source-id", help="Only process chunks from this source")
    embed_parser.add_argument("--batch-size", type=int, default=8, help="Batch size (default: 8)")
    embed_parser.add_argument("--force", action="store_true", help="Re-embed existing chunks")

    # Search command
    search_parser = subparsers.add_parser("search", help="Semantic search")
    search_parser.add_argument("db_path", help="Path to SQLite database")
    search_parser.add_argument("query", help="Search query")
    search_parser.add_argument("--top-k", type=int, default=10, help="Number of results (default: 10)")
    search_parser.add_argument("--min-score", type=float, default=0.3, help="Minimum score (default: 0.3)")
    search_parser.add_argument("--type", dest="source_type", help="Filter by source type")

    # Status command
    status_parser = subparsers.add_parser("status", help="Get embedding status")
    status_parser.add_argument("db_path", help="Path to SQLite database")

    args = parser.parse_args()

    try:
        embedder = MemoryEmbedder(args.db_path)

        if args.command == "embed":
            result = embedder.embed_chunks(
                source_id=args.source_id,
                batch_size=args.batch_size,
                force=args.force
            )
            print(json.dumps(result, indent=2))

        elif args.command == "search":
            result = embedder.search(
                query=args.query,
                top_k=args.top_k,
                min_score=args.min_score,
                source_type=args.source_type
            )
            print(json.dumps(result, indent=2))

        elif args.command == "status":
            result = embedder.get_status()
            print(json.dumps(result, indent=2))

        embedder.close()

        # Exit with error code if operation failed
        if "success" in result and not result["success"]:
            # Clean up ONNX resources before exit
            clear_embedder_cache()
            sys.exit(1)

        # Clean up ONNX resources to ensure process can exit cleanly
        # This releases fastembed/ONNX Runtime threads that would otherwise
        # prevent the Python interpreter from shutting down
        clear_embedder_cache()

    except Exception as e:
        # Clean up ONNX resources even on error
        try:
            clear_embedder_cache()
        except Exception:
            pass
        print(json.dumps({
            "success": False,
            "error": str(e)
        }, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
