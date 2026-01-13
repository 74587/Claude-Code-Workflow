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
    strip_comments: bool = True  # Remove comments from chunk content for embedding
    strip_docstrings: bool = True  # Remove docstrings from chunk content for embedding
    preserve_original: bool = True  # Store original content in metadata when stripping


class CommentStripper:
    """Remove comments from source code while preserving structure."""

    @staticmethod
    def strip_python_comments(content: str) -> str:
        """Strip Python comments (# style) but preserve docstrings.

        Args:
            content: Python source code

        Returns:
            Code with comments removed
        """
        lines = content.splitlines(keepends=True)
        result_lines: List[str] = []
        in_string = False
        string_char = None

        for line in lines:
            new_line = []
            i = 0
            while i < len(line):
                char = line[i]

                # Handle string literals
                if char in ('"', "'") and not in_string:
                    # Check for triple quotes
                    if line[i:i+3] in ('"""', "'''"):
                        in_string = True
                        string_char = line[i:i+3]
                        new_line.append(line[i:i+3])
                        i += 3
                        continue
                    else:
                        in_string = True
                        string_char = char
                elif in_string:
                    if string_char and len(string_char) == 3:
                        if line[i:i+3] == string_char:
                            in_string = False
                            new_line.append(line[i:i+3])
                            i += 3
                            string_char = None
                            continue
                    elif char == string_char:
                        # Check for escape
                        if i > 0 and line[i-1] != '\\':
                            in_string = False
                            string_char = None

                # Handle comments (only outside strings)
                if char == '#' and not in_string:
                    # Rest of line is comment, skip it
                    new_line.append('\n' if line.endswith('\n') else '')
                    break

                new_line.append(char)
                i += 1

            result_lines.append(''.join(new_line))

        return ''.join(result_lines)

    @staticmethod
    def strip_c_style_comments(content: str) -> str:
        """Strip C-style comments (// and /* */) from code.

        Args:
            content: Source code with C-style comments

        Returns:
            Code with comments removed
        """
        result = []
        i = 0
        in_string = False
        string_char = None
        in_multiline_comment = False

        while i < len(content):
            # Handle multi-line comment end
            if in_multiline_comment:
                if content[i:i+2] == '*/':
                    in_multiline_comment = False
                    i += 2
                    continue
                i += 1
                continue

            char = content[i]

            # Handle string literals
            if char in ('"', "'", '`') and not in_string:
                in_string = True
                string_char = char
                result.append(char)
                i += 1
                continue
            elif in_string:
                result.append(char)
                if char == string_char and (i == 0 or content[i-1] != '\\'):
                    in_string = False
                    string_char = None
                i += 1
                continue

            # Handle comments
            if content[i:i+2] == '//':
                # Single line comment - skip to end of line
                while i < len(content) and content[i] != '\n':
                    i += 1
                if i < len(content):
                    result.append('\n')
                    i += 1
                continue

            if content[i:i+2] == '/*':
                in_multiline_comment = True
                i += 2
                continue

            result.append(char)
            i += 1

        return ''.join(result)

    @classmethod
    def strip_comments(cls, content: str, language: str) -> str:
        """Strip comments based on language.

        Args:
            content: Source code content
            language: Programming language

        Returns:
            Code with comments removed
        """
        if language == "python":
            return cls.strip_python_comments(content)
        elif language in {"javascript", "typescript", "java", "c", "cpp", "go", "rust"}:
            return cls.strip_c_style_comments(content)
        return content


class DocstringStripper:
    """Remove docstrings from source code."""

    @staticmethod
    def strip_python_docstrings(content: str) -> str:
        """Strip Python docstrings (triple-quoted strings at module/class/function level).

        Args:
            content: Python source code

        Returns:
            Code with docstrings removed
        """
        lines = content.splitlines(keepends=True)
        result_lines: List[str] = []
        i = 0

        while i < len(lines):
            line = lines[i]
            stripped = line.strip()

            # Check for docstring start
            if stripped.startswith('"""') or stripped.startswith("'''"):
                quote_type = '"""' if stripped.startswith('"""') else "'''"

                # Single line docstring
                if stripped.count(quote_type) >= 2:
                    # Skip this line (docstring)
                    i += 1
                    continue

                # Multi-line docstring - skip until closing
                i += 1
                while i < len(lines):
                    if quote_type in lines[i]:
                        i += 1
                        break
                    i += 1
                continue

            result_lines.append(line)
            i += 1

        return ''.join(result_lines)

    @staticmethod
    def strip_jsdoc_comments(content: str) -> str:
        """Strip JSDoc comments (/** ... */) from code.

        Args:
            content: JavaScript/TypeScript source code

        Returns:
            Code with JSDoc comments removed
        """
        result = []
        i = 0
        in_jsdoc = False

        while i < len(content):
            if in_jsdoc:
                if content[i:i+2] == '*/':
                    in_jsdoc = False
                    i += 2
                    continue
                i += 1
                continue

            # Check for JSDoc start (/** but not /*)
            if content[i:i+3] == '/**':
                in_jsdoc = True
                i += 3
                continue

            result.append(content[i])
            i += 1

        return ''.join(result)

    @classmethod
    def strip_docstrings(cls, content: str, language: str) -> str:
        """Strip docstrings based on language.

        Args:
            content: Source code content
            language: Programming language

        Returns:
            Code with docstrings removed
        """
        if language == "python":
            return cls.strip_python_docstrings(content)
        elif language in {"javascript", "typescript"}:
            return cls.strip_jsdoc_comments(content)
        return content


class Chunker:
    """Chunk code files for semantic embedding."""

    def __init__(self, config: ChunkConfig | None = None) -> None:
        self.config = config or ChunkConfig()
        self._tokenizer = get_default_tokenizer()
        self._comment_stripper = CommentStripper()
        self._docstring_stripper = DocstringStripper()

    def _process_content(self, content: str, language: str) -> Tuple[str, Optional[str]]:
        """Process chunk content by stripping comments/docstrings if configured.

        Args:
            content: Original chunk content
            language: Programming language

        Returns:
            Tuple of (processed_content, original_content_if_preserved)
        """
        original = content if self.config.preserve_original else None
        processed = content

        if self.config.strip_comments:
            processed = self._comment_stripper.strip_comments(processed, language)

        if self.config.strip_docstrings:
            processed = self._docstring_stripper.strip_docstrings(processed, language)

        # If nothing changed, don't store original
        if processed == content:
            original = None

        return processed, original

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
                    sub_chunk.metadata["chunk_type"] = "code"
                    sub_chunk.metadata["parent_symbol_range"] = (start_line, end_line)

                chunks.extend(sub_chunks)
            else:
                # Process content (strip comments/docstrings if configured)
                processed_content, original_content = self._process_content(chunk_content, language)

                # Skip if processed content is too small
                if len(processed_content.strip()) < self.config.min_chunk_size:
                    continue

                # Calculate token count if not provided
                token_count = None
                if symbol_token_counts and symbol.name in symbol_token_counts:
                    token_count = symbol_token_counts[symbol.name]
                else:
                    token_count = self._estimate_token_count(processed_content)

                metadata = {
                    "file": str(file_path),
                    "language": language,
                    "symbol_name": symbol.name,
                    "symbol_kind": symbol.kind,
                    "start_line": start_line,
                    "end_line": end_line,
                    "strategy": "symbol",
                    "chunk_type": "code",
                    "token_count": token_count,
                }

                # Store original content if it was modified
                if original_content is not None:
                    metadata["original_content"] = original_content

                chunks.append(SemanticChunk(
                    content=processed_content,
                    embedding=None,
                    metadata=metadata
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
                # Process content (strip comments/docstrings if configured)
                processed_content, original_content = self._process_content(chunk_content, language)

                # Skip if processed content is too small
                if len(processed_content.strip()) < self.config.min_chunk_size:
                    # Move window forward
                    step = lines_per_chunk - overlap_lines
                    if step <= 0:
                        step = 1
                    start += step
                    continue

                token_count = self._estimate_token_count(processed_content)

                # Calculate correct line numbers
                if line_mapping:
                    # Use line mapping to get original line numbers
                    start_line = line_mapping[start]
                    end_line = line_mapping[end - 1]
                else:
                    # Default behavior: treat content as starting at line 1
                    start_line = start + 1
                    end_line = end

                metadata = {
                    "file": str(file_path),
                    "language": language,
                    "chunk_index": chunk_idx,
                    "start_line": start_line,
                    "end_line": end_line,
                    "strategy": "sliding_window",
                    "chunk_type": "code",
                    "token_count": token_count,
                }

                # Store original content if it was modified
                if original_content is not None:
                    metadata["original_content"] = original_content

                chunks.append(SemanticChunk(
                    content=processed_content,
                    embedding=None,
                    metadata=metadata
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
