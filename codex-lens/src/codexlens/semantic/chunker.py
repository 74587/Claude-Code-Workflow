"""Code chunking strategies for semantic search.

This module provides various chunking strategies for breaking down source code
into semantic chunks suitable for embedding and search.

Lightweight Mode:
    The ChunkConfig supports a `skip_token_count` option for performance optimization.
    When enabled, token counting uses a fast character-based estimation (char/4)
    instead of expensive tiktoken encoding.

    Use cases for lightweight mode:
    - Large-scale indexing where speed is critical
    - Scenarios where approximate token counts are acceptable
    - Memory-constrained environments
    - Initial prototyping and development

    Example:
        # Default mode (accurate tiktoken encoding)
        config = ChunkConfig()
        chunker = Chunker(config)

        # Lightweight mode (fast char/4 estimation)
        config = ChunkConfig(skip_token_count=True)
        chunker = Chunker(config)
        chunks = chunker.chunk_file(content, symbols, path, language)
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

from codexlens.entities import SemanticChunk, Symbol
from codexlens.parsers.tokenizer import get_default_tokenizer


@dataclass
class ChunkConfig:
    """Configuration for chunking strategies."""
    max_chunk_size: int = 1000  # Max characters per chunk
    overlap: int = 200  # Overlap for sliding window (increased from 100 for better context)
    strategy: str = "auto"  # Chunking strategy: auto, symbol, sliding_window, hybrid
    min_chunk_size: int = 50  # Minimum chunk size
    skip_token_count: bool = False  # Skip expensive token counting (use char/4 estimate)


class Chunker:
    """Chunk code files for semantic embedding."""

    def __init__(self, config: ChunkConfig | None = None) -> None:
        self.config = config or ChunkConfig()
        self._tokenizer = get_default_tokenizer()

    def _estimate_token_count(self, text: str) -> int:
        """Estimate token count based on config.

        If skip_token_count is True, uses character-based estimation (char/4).
        Otherwise, uses accurate tiktoken encoding.

        Args:
            text: Text to count tokens for

        Returns:
            Estimated token count
        """
        if self.config.skip_token_count:
            # Fast character-based estimation: ~4 chars per token
            return max(1, len(text) // 4)
        return self._tokenizer.count_tokens(text)

    def chunk_by_symbol(
        self,
        content: str,
        symbols: List[Symbol],
        file_path: str | Path,
        language: str,
        symbol_token_counts: Optional[dict[str, int]] = None,
    ) -> List[SemanticChunk]:
        """Chunk code by extracted symbols (functions, classes).

        Each symbol becomes one chunk with its full content.
        Large symbols exceeding max_chunk_size are recursively split using sliding window.

        Args:
            content: Source code content
            symbols: List of extracted symbols
            file_path: Path to source file
            language: Programming language
            symbol_token_counts: Optional dict mapping symbol names to token counts
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

            # Check if symbol content exceeds max_chunk_size
            if len(chunk_content) > self.config.max_chunk_size:
                # Create line mapping for correct line number tracking
                line_mapping = list(range(start_line, end_line + 1))

                # Use sliding window to split large symbol
                sub_chunks = self.chunk_sliding_window(
                    chunk_content,
                    file_path=file_path,
                    language=language,
                    line_mapping=line_mapping
                )

                # Update sub_chunks with parent symbol metadata
                for sub_chunk in sub_chunks:
                    sub_chunk.metadata["symbol_name"] = symbol.name
                    sub_chunk.metadata["symbol_kind"] = symbol.kind
                    sub_chunk.metadata["strategy"] = "symbol_split"
                    sub_chunk.metadata["parent_symbol_range"] = (start_line, end_line)

                chunks.extend(sub_chunks)
            else:
                # Calculate token count if not provided
                token_count = None
                if symbol_token_counts and symbol.name in symbol_token_counts:
                    token_count = symbol_token_counts[symbol.name]
                else:
                    token_count = self._estimate_token_count(chunk_content)

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
                        "token_count": token_count,
                    }
                ))

        return chunks

    def chunk_sliding_window(
        self,
        content: str,
        file_path: str | Path,
        language: str,
        line_mapping: Optional[List[int]] = None,
    ) -> List[SemanticChunk]:
        """Chunk code using sliding window approach.

        Used for files without clear symbol boundaries or very long functions.

        Args:
            content: Source code content
            file_path: Path to source file
            language: Programming language
            line_mapping: Optional list mapping content line indices to original line numbers
                         (1-indexed). If provided, line_mapping[i] is the original line number
                         for the i-th line in content.
        """
        chunks: List[SemanticChunk] = []
        lines = content.splitlines(keepends=True)

        if not lines:
            return chunks

        # Calculate lines per chunk based on average line length
        avg_line_len = len(content) / max(len(lines), 1)
        lines_per_chunk = max(10, int(self.config.max_chunk_size / max(avg_line_len, 1)))
        overlap_lines = max(2, int(self.config.overlap / max(avg_line_len, 1)))
        # Ensure overlap is less than chunk size to prevent infinite loop
        overlap_lines = min(overlap_lines, lines_per_chunk - 1)

        start = 0
        chunk_idx = 0

        while start < len(lines):
            end = min(start + lines_per_chunk, len(lines))
            chunk_content = "".join(lines[start:end])

            if len(chunk_content.strip()) >= self.config.min_chunk_size:
                token_count = self._estimate_token_count(chunk_content)

                # Calculate correct line numbers
                if line_mapping:
                    # Use line mapping to get original line numbers
                    start_line = line_mapping[start]
                    end_line = line_mapping[end - 1]
                else:
                    # Default behavior: treat content as starting at line 1
                    start_line = start + 1
                    end_line = end

                chunks.append(SemanticChunk(
                    content=chunk_content,
                    embedding=None,
                    metadata={
                        "file": str(file_path),
                        "language": language,
                        "chunk_index": chunk_idx,
                        "start_line": start_line,
                        "end_line": end_line,
                        "strategy": "sliding_window",
                        "token_count": token_count,
                    }
                ))
                chunk_idx += 1

            # Move window, accounting for overlap
            step = lines_per_chunk - overlap_lines
            if step <= 0:
                step = 1  # Failsafe to prevent infinite loop
            start += step

            # Break if we've reached the end
            if end >= len(lines):
                break

        return chunks

    def chunk_file(
        self,
        content: str,
        symbols: List[Symbol],
        file_path: str | Path,
        language: str,
        symbol_token_counts: Optional[dict[str, int]] = None,
    ) -> List[SemanticChunk]:
        """Chunk a file using the best strategy.

        Uses symbol-based chunking if symbols available,
        falls back to sliding window for files without symbols.

        Args:
            content: Source code content
            symbols: List of extracted symbols
            file_path: Path to source file
            language: Programming language
            symbol_token_counts: Optional dict mapping symbol names to token counts
        """
        if symbols:
            return self.chunk_by_symbol(content, symbols, file_path, language, symbol_token_counts)
        return self.chunk_sliding_window(content, file_path, language)

class DocstringExtractor:
    """Extract docstrings from source code."""

    @staticmethod
    def extract_python_docstrings(content: str) -> List[Tuple[str, int, int]]:
        """Extract Python docstrings with their line ranges.

        Returns: List of (docstring_content, start_line, end_line) tuples
        """
        docstrings: List[Tuple[str, int, int]] = []
        lines = content.splitlines(keepends=True)

        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()
            if stripped.startswith('"""') or stripped.startswith("'''"):
                quote_type = '"""' if stripped.startswith('"""') else "'''"
                start_line = i + 1

                if stripped.count(quote_type) >= 2:
                    docstring_content = line
                    end_line = i + 1
                    docstrings.append((docstring_content, start_line, end_line))
                    i += 1
                    continue

                docstring_lines = [line]
                i += 1
                while i < len(lines):
                    docstring_lines.append(lines[i])
                    if quote_type in lines[i]:
                        break
                    i += 1

                end_line = i + 1
                docstring_content = "".join(docstring_lines)
                docstrings.append((docstring_content, start_line, end_line))

            i += 1

        return docstrings

    @staticmethod
    def extract_jsdoc_comments(content: str) -> List[Tuple[str, int, int]]:
        """Extract JSDoc comments with their line ranges.

        Returns: List of (comment_content, start_line, end_line) tuples
        """
        comments: List[Tuple[str, int, int]] = []
        lines = content.splitlines(keepends=True)

        i = 0
        while i < len(lines):
            line = lines[i]
            stripped = line.strip()

            if stripped.startswith('/**'):
                start_line = i + 1
                comment_lines = [line]
                i += 1

                while i < len(lines):
                    comment_lines.append(lines[i])
                    if '*/' in lines[i]:
                        break
                    i += 1

                end_line = i + 1
                comment_content = "".join(comment_lines)
                comments.append((comment_content, start_line, end_line))

            i += 1

        return comments

    @classmethod
    def extract_docstrings(
        cls,
        content: str,
        language: str
    ) -> List[Tuple[str, int, int]]:
        """Extract docstrings based on language.

        Returns: List of (docstring_content, start_line, end_line) tuples
        """
        if language == "python":
            return cls.extract_python_docstrings(content)
        elif language in {"javascript", "typescript"}:
            return cls.extract_jsdoc_comments(content)
        return []


class HybridChunker:
    """Hybrid chunker that prioritizes docstrings before symbol-based chunking.

    Composition-based strategy that:
    1. Extracts docstrings as dedicated chunks
    2. For remaining code, uses base chunker (symbol or sliding window)
    """

    def __init__(
        self,
        base_chunker: Chunker | None = None,
        config: ChunkConfig | None = None
    ) -> None:
        """Initialize hybrid chunker.

        Args:
            base_chunker: Chunker to use for non-docstring content
            config: Configuration for chunking
        """
        self.config = config or ChunkConfig()
        self.base_chunker = base_chunker or Chunker(self.config)
        self.docstring_extractor = DocstringExtractor()

    def _get_excluded_line_ranges(
        self,
        docstrings: List[Tuple[str, int, int]]
    ) -> set[int]:
        """Get set of line numbers that are part of docstrings."""
        excluded_lines: set[int] = set()
        for _, start_line, end_line in docstrings:
            for line_num in range(start_line, end_line + 1):
                excluded_lines.add(line_num)
        return excluded_lines

    def _filter_symbols_outside_docstrings(
        self,
        symbols: List[Symbol],
        excluded_lines: set[int]
    ) -> List[Symbol]:
        """Filter symbols to exclude those completely within docstrings."""
        filtered: List[Symbol] = []
        for symbol in symbols:
            start_line, end_line = symbol.range
            symbol_lines = set(range(start_line, end_line + 1))
            if not symbol_lines.issubset(excluded_lines):
                filtered.append(symbol)
        return filtered

    def _find_parent_symbol(
        self,
        start_line: int,
        end_line: int,
        symbols: List[Symbol],
    ) -> Optional[Symbol]:
        """Find the smallest symbol range that fully contains a docstring span."""
        candidates: List[Symbol] = []
        for symbol in symbols:
            sym_start, sym_end = symbol.range
            if sym_start <= start_line and end_line <= sym_end:
                candidates.append(symbol)
        if not candidates:
            return None
        return min(candidates, key=lambda s: (s.range[1] - s.range[0], s.range[0]))

    def chunk_file(
        self,
        content: str,
        symbols: List[Symbol],
        file_path: str | Path,
        language: str,
        symbol_token_counts: Optional[dict[str, int]] = None,
    ) -> List[SemanticChunk]:
        """Chunk file using hybrid strategy.

        Extracts docstrings first, then chunks remaining code.

        Args:
            content: Source code content
            symbols: List of extracted symbols
            file_path: Path to source file
            language: Programming language
            symbol_token_counts: Optional dict mapping symbol names to token counts
        """
        chunks: List[SemanticChunk] = []

        # Step 1: Extract docstrings as dedicated chunks
        docstrings: List[Tuple[str, int, int]] = []
        if language == "python":
            # Fast path: avoid expensive docstring extraction if delimiters are absent.
            if '"""' in content or "'''" in content:
                docstrings = self.docstring_extractor.extract_docstrings(content, language)
        elif language in {"javascript", "typescript"}:
            if "/**" in content:
                docstrings = self.docstring_extractor.extract_docstrings(content, language)
        else:
            docstrings = self.docstring_extractor.extract_docstrings(content, language)

        # Fast path: no docstrings -> delegate to base chunker directly.
        if not docstrings:
            if symbols:
                base_chunks = self.base_chunker.chunk_by_symbol(
                    content, symbols, file_path, language, symbol_token_counts
                )
            else:
                base_chunks = self.base_chunker.chunk_sliding_window(content, file_path, language)

            for chunk in base_chunks:
                chunk.metadata["strategy"] = "hybrid"
                chunk.metadata["chunk_type"] = "code"
            return base_chunks

        for docstring_content, start_line, end_line in docstrings:
            if len(docstring_content.strip()) >= self.config.min_chunk_size:
                parent_symbol = self._find_parent_symbol(start_line, end_line, symbols)
                # Use base chunker's token estimation method
                token_count = self.base_chunker._estimate_token_count(docstring_content)
                metadata = {
                    "file": str(file_path),
                    "language": language,
                    "chunk_type": "docstring",
                    "start_line": start_line,
                    "end_line": end_line,
                    "strategy": "hybrid",
                    "token_count": token_count,
                }
                if parent_symbol is not None:
                    metadata["parent_symbol"] = parent_symbol.name
                    metadata["parent_symbol_kind"] = parent_symbol.kind
                    metadata["parent_symbol_range"] = parent_symbol.range
                chunks.append(SemanticChunk(
                    content=docstring_content,
                    embedding=None,
                    metadata=metadata
                ))

        # Step 2: Get line ranges occupied by docstrings
        excluded_lines = self._get_excluded_line_ranges(docstrings)

        # Step 3: Filter symbols to exclude docstring-only ranges
        filtered_symbols = self._filter_symbols_outside_docstrings(symbols, excluded_lines)

        # Step 4: Chunk remaining content using base chunker
        if filtered_symbols:
            base_chunks = self.base_chunker.chunk_by_symbol(
                content, filtered_symbols, file_path, language, symbol_token_counts
            )
            for chunk in base_chunks:
                chunk.metadata["strategy"] = "hybrid"
                chunk.metadata["chunk_type"] = "code"
                chunks.append(chunk)
        else:
            lines = content.splitlines(keepends=True)
            remaining_lines: List[str] = []

            for i, line in enumerate(lines, start=1):
                if i not in excluded_lines:
                    remaining_lines.append(line)

            if remaining_lines:
                remaining_content = "".join(remaining_lines)
                if len(remaining_content.strip()) >= self.config.min_chunk_size:
                    base_chunks = self.base_chunker.chunk_sliding_window(
                        remaining_content, file_path, language
                    )
                    for chunk in base_chunks:
                        chunk.metadata["strategy"] = "hybrid"
                        chunk.metadata["chunk_type"] = "code"
                        chunks.append(chunk)

        return chunks
