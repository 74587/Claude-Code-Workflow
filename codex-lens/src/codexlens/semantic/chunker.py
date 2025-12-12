"""Code chunking strategies for semantic search."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional

from codexlens.entities import SemanticChunk, Symbol


@dataclass
class ChunkConfig:
    """Configuration for chunking strategies."""
    max_chunk_size: int = 1000  # Max characters per chunk
    overlap: int = 100  # Overlap for sliding window
    min_chunk_size: int = 50  # Minimum chunk size


class Chunker:
    """Chunk code files for semantic embedding."""

    def __init__(self, config: ChunkConfig | None = None) -> None:
        self.config = config or ChunkConfig()

    def chunk_by_symbol(
        self,
        content: str,
        symbols: List[Symbol],
        file_path: str | Path,
        language: str,
    ) -> List[SemanticChunk]:
        """Chunk code by extracted symbols (functions, classes).

        Each symbol becomes one chunk with its full content.
        """
        chunks: List[SemanticChunk] = []
        lines = content.splitlines(keepends=True)

        for symbol in symbols:
            start_line, end_line = symbol.range
            # Convert to 0-indexed
            start_idx = max(0, start_line - 1)
            end_idx = min(len(lines), end_line)

            chunk_content = "".join(lines[start_idx:end_idx])
            if len(chunk_content.strip()) < self.config.min_chunk_size:
                continue

            chunks.append(SemanticChunk(
                content=chunk_content,
                embedding=None,
                metadata={
                    "file": str(file_path),
                    "language": language,
                    "symbol_name": symbol.name,
                    "symbol_kind": symbol.kind,
                    "start_line": start_line,
                    "end_line": end_line,
                    "strategy": "symbol",
                }
            ))

        return chunks

    def chunk_sliding_window(
        self,
        content: str,
        file_path: str | Path,
        language: str,
    ) -> List[SemanticChunk]:
        """Chunk code using sliding window approach.

        Used for files without clear symbol boundaries or very long functions.
        """
        chunks: List[SemanticChunk] = []
        lines = content.splitlines(keepends=True)

        if not lines:
            return chunks

        # Calculate lines per chunk based on average line length
        avg_line_len = len(content) / max(len(lines), 1)
        lines_per_chunk = max(10, int(self.config.max_chunk_size / max(avg_line_len, 1)))
        overlap_lines = max(2, int(self.config.overlap / max(avg_line_len, 1)))

        start = 0
        chunk_idx = 0

        while start < len(lines):
            end = min(start + lines_per_chunk, len(lines))
            chunk_content = "".join(lines[start:end])

            if len(chunk_content.strip()) >= self.config.min_chunk_size:
                chunks.append(SemanticChunk(
                    content=chunk_content,
                    embedding=None,
                    metadata={
                        "file": str(file_path),
                        "language": language,
                        "chunk_index": chunk_idx,
                        "start_line": start + 1,
                        "end_line": end,
                        "strategy": "sliding_window",
                    }
                ))
                chunk_idx += 1

            # Move window, accounting for overlap
            start = end - overlap_lines
            if start >= len(lines) - overlap_lines:
                break

        return chunks

    def chunk_file(
        self,
        content: str,
        symbols: List[Symbol],
        file_path: str | Path,
        language: str,
    ) -> List[SemanticChunk]:
        """Chunk a file using the best strategy.

        Uses symbol-based chunking if symbols available,
        falls back to sliding window for files without symbols.
        """
        if symbols:
            return self.chunk_by_symbol(content, symbols, file_path, language)
        return self.chunk_sliding_window(content, file_path, language)
