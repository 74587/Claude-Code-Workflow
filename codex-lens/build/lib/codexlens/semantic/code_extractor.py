"""Smart code extraction for complete code blocks."""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional, Tuple

from codexlens.entities import SearchResult, Symbol


def extract_complete_code_block(
    result: SearchResult,
    source_file_path: Optional[str] = None,
    context_lines: int = 0,
) -> str:
    """Extract complete code block from a search result.
    
    Args:
        result: SearchResult from semantic search.
        source_file_path: Optional path to source file for re-reading.
        context_lines: Additional lines of context to include above/below.
    
    Returns:
        Complete code block as string.
    """
    # If we have full content stored, use it
    if result.content:
        if context_lines == 0:
            return result.content
        # Need to add context, read from file
        
    # Try to read from source file
    file_path = source_file_path or result.path
    if not file_path or not Path(file_path).exists():
        # Fall back to excerpt
        return result.excerpt or ""
    
    try:
        content = Path(file_path).read_text(encoding="utf-8", errors="ignore")
        lines = content.splitlines()
        
        # Get line range
        start_line = result.start_line or 1
        end_line = result.end_line or len(lines)
        
        # Add context
        start_idx = max(0, start_line - 1 - context_lines)
        end_idx = min(len(lines), end_line + context_lines)
        
        return "\n".join(lines[start_idx:end_idx])
    except Exception:
        return result.excerpt or result.content or ""


def extract_symbol_with_context(
    file_path: str,
    symbol: Symbol,
    include_docstring: bool = True,
    include_decorators: bool = True,
) -> str:
    """Extract a symbol (function/class) with its docstring and decorators.
    
    Args:
        file_path: Path to source file.
        symbol: Symbol to extract.
        include_docstring: Include docstring if present.
        include_decorators: Include decorators/annotations above symbol.
    
    Returns:
        Complete symbol code with context.
    """
    try:
        content = Path(file_path).read_text(encoding="utf-8", errors="ignore")
        lines = content.splitlines()
        
        start_line, end_line = symbol.range
        start_idx = start_line - 1
        end_idx = end_line
        
        # Look for decorators above the symbol
        if include_decorators and start_idx > 0:
            decorator_start = start_idx
            # Search backwards for decorators
            i = start_idx - 1
            while i >= 0 and i >= start_idx - 20:  # Look up to 20 lines back
                line = lines[i].strip()
                if line.startswith("@"):
                    decorator_start = i
                    i -= 1
                elif line == "" or line.startswith("#"):
                    # Skip empty lines and comments, continue looking
                    i -= 1
                elif line.startswith("//") or line.startswith("/*") or line.startswith("*"):
                    # JavaScript/Java style comments
                    decorator_start = i
                    i -= 1
                else:
                    # Found non-decorator, non-comment line, stop
                    break
            start_idx = decorator_start
        
        return "\n".join(lines[start_idx:end_idx])
    except Exception:
        return ""


def format_search_result_code(
    result: SearchResult,
    max_lines: Optional[int] = None,
    show_line_numbers: bool = True,
    highlight_match: bool = False,
) -> str:
    """Format search result code for display.
    
    Args:
        result: SearchResult to format.
        max_lines: Maximum lines to show (None for all).
        show_line_numbers: Include line numbers in output.
        highlight_match: Add markers for matched region.
    
    Returns:
        Formatted code string.
    """
    content = result.content or result.excerpt or ""
    if not content:
        return ""
    
    lines = content.splitlines()
    
    # Truncate if needed
    truncated = False
    if max_lines and len(lines) > max_lines:
        lines = lines[:max_lines]
        truncated = True
    
    # Format with line numbers
    if show_line_numbers:
        start = result.start_line or 1
        formatted_lines = []
        for i, line in enumerate(lines):
            line_num = start + i
            formatted_lines.append(f"{line_num:4d} | {line}")
        output = "\n".join(formatted_lines)
    else:
        output = "\n".join(lines)
    
    if truncated:
        output += "\n... (truncated)"
    
    return output


def get_code_block_summary(result: SearchResult) -> str:
    """Get a concise summary of a code block.
    
    Args:
        result: SearchResult to summarize.
    
    Returns:
        Summary string like "function hello_world (lines 10-25)"
    """
    parts = []
    
    if result.symbol_kind:
        parts.append(result.symbol_kind)
    
    if result.symbol_name:
        parts.append(f"`{result.symbol_name}`")
    elif result.excerpt:
        # Extract first meaningful identifier
        first_line = result.excerpt.split("\n")[0][:50]
        parts.append(f'"{first_line}..."')
    
    if result.start_line and result.end_line:
        if result.start_line == result.end_line:
            parts.append(f"(line {result.start_line})")
        else:
            parts.append(f"(lines {result.start_line}-{result.end_line})")
    
    if result.path:
        file_name = Path(result.path).name
        parts.append(f"in {file_name}")
    
    return " ".join(parts) if parts else "unknown code block"


class CodeBlockResult:
    """Enhanced search result with complete code block."""
    
    def __init__(self, result: SearchResult, source_path: Optional[str] = None):
        self.result = result
        self.source_path = source_path or result.path
        self._full_code: Optional[str] = None
    
    @property
    def score(self) -> float:
        return self.result.score
    
    @property
    def path(self) -> str:
        return self.result.path
    
    @property
    def file_name(self) -> str:
        return Path(self.result.path).name
    
    @property
    def symbol_name(self) -> Optional[str]:
        return self.result.symbol_name
    
    @property
    def symbol_kind(self) -> Optional[str]:
        return self.result.symbol_kind
    
    @property
    def line_range(self) -> Tuple[int, int]:
        return (
            self.result.start_line or 1,
            self.result.end_line or 1
        )
    
    @property
    def full_code(self) -> str:
        """Get full code block content."""
        if self._full_code is None:
            self._full_code = extract_complete_code_block(self.result, self.source_path)
        return self._full_code
    
    @property
    def excerpt(self) -> str:
        """Get short excerpt."""
        return self.result.excerpt or ""
    
    @property
    def summary(self) -> str:
        """Get code block summary."""
        return get_code_block_summary(self.result)
    
    def format(
        self,
        max_lines: Optional[int] = None,
        show_line_numbers: bool = True,
    ) -> str:
        """Format code for display."""
        # Use full code if available
        display_result = SearchResult(
            path=self.result.path,
            score=self.result.score,
            content=self.full_code,
            start_line=self.result.start_line,
            end_line=self.result.end_line,
        )
        return format_search_result_code(
            display_result,
            max_lines=max_lines,
            show_line_numbers=show_line_numbers
        )
    
    def __repr__(self) -> str:
        return f"<CodeBlockResult {self.summary} score={self.score:.3f}>"


def enhance_search_results(
    results: List[SearchResult],
) -> List[CodeBlockResult]:
    """Enhance search results with complete code block access.
    
    Args:
        results: List of SearchResult from semantic search.
    
    Returns:
        List of CodeBlockResult with full code access.
    """
    return [CodeBlockResult(r) for r in results]
