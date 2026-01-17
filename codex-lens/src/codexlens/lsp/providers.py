"""LSP feature providers."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from codexlens.storage.global_index import GlobalSymbolIndex
    from codexlens.storage.registry import RegistryStore

logger = logging.getLogger(__name__)


@dataclass
class HoverInfo:
    """Hover information for a symbol."""

    name: str
    kind: str
    signature: str
    documentation: Optional[str]
    file_path: str
    line_range: tuple  # (start_line, end_line)


class HoverProvider:
    """Provides hover information for symbols."""

    def __init__(
        self,
        global_index: "GlobalSymbolIndex",
        registry: Optional["RegistryStore"] = None,
    ) -> None:
        """Initialize hover provider.

        Args:
            global_index: Global symbol index for lookups
            registry: Optional registry store for index path resolution
        """
        self.global_index = global_index
        self.registry = registry

    def get_hover_info(self, symbol_name: str) -> Optional[HoverInfo]:
        """Get hover information for a symbol.

        Args:
            symbol_name: Name of the symbol to look up

        Returns:
            HoverInfo or None if symbol not found
        """
        # Look up symbol in global index using exact match
        symbols = self.global_index.search(
            name=symbol_name,
            limit=1,
            prefix_mode=False,
        )

        # Filter for exact name match
        exact_matches = [s for s in symbols if s.name == symbol_name]

        if not exact_matches:
            return None

        symbol = exact_matches[0]

        # Extract signature from source file
        signature = self._extract_signature(symbol)

        # Symbol uses 'file' attribute and 'range' tuple
        file_path = symbol.file or ""
        start_line, end_line = symbol.range

        return HoverInfo(
            name=symbol.name,
            kind=symbol.kind,
            signature=signature,
            documentation=None,  # Symbol doesn't have docstring field
            file_path=file_path,
            line_range=(start_line, end_line),
        )

    def _extract_signature(self, symbol) -> str:
        """Extract function/class signature from source file.

        Args:
            symbol: Symbol object with file and range information

        Returns:
            Extracted signature string or fallback kind + name
        """
        try:
            file_path = Path(symbol.file) if symbol.file else None
            if not file_path or not file_path.exists():
                return f"{symbol.kind} {symbol.name}"

            content = file_path.read_text(encoding="utf-8", errors="ignore")
            lines = content.split("\n")

            # Extract signature lines (first line of definition + continuation)
            start_line = symbol.range[0] - 1  # Convert 1-based to 0-based
            if start_line >= len(lines) or start_line < 0:
                return f"{symbol.kind} {symbol.name}"

            signature_lines = []
            first_line = lines[start_line]
            signature_lines.append(first_line)

            # Continue if multiline signature (no closing paren + colon yet)
            # Look for patterns like "def func(", "class Foo(", etc.
            i = start_line + 1
            max_lines = min(start_line + 5, len(lines))
            while i < max_lines:
                line = signature_lines[-1]
                # Stop if we see closing pattern
                if "):" in line or line.rstrip().endswith(":"):
                    break
                signature_lines.append(lines[i])
                i += 1

            return "\n".join(signature_lines)

        except Exception as e:
            logger.debug(f"Failed to extract signature for {symbol.name}: {e}")
            return f"{symbol.kind} {symbol.name}"

    def format_hover_markdown(self, info: HoverInfo) -> str:
        """Format hover info as Markdown.

        Args:
            info: HoverInfo object to format

        Returns:
            Markdown-formatted hover content
        """
        parts = []

        # Detect language for code fence based on file extension
        ext = Path(info.file_path).suffix.lower() if info.file_path else ""
        lang_map = {
            ".py": "python",
            ".js": "javascript",
            ".ts": "typescript",
            ".tsx": "typescript",
            ".jsx": "javascript",
            ".java": "java",
            ".go": "go",
            ".rs": "rust",
            ".c": "c",
            ".cpp": "cpp",
            ".h": "c",
            ".hpp": "cpp",
            ".cs": "csharp",
            ".rb": "ruby",
            ".php": "php",
        }
        lang = lang_map.get(ext, "")

        # Code block with signature
        parts.append(f"```{lang}\n{info.signature}\n```")

        # Documentation if available
        if info.documentation:
            parts.append(f"\n---\n\n{info.documentation}")

        # Location info
        file_name = Path(info.file_path).name if info.file_path else "unknown"
        parts.append(
            f"\n---\n\n*{info.kind}* defined in "
            f"`{file_name}` "
            f"(line {info.line_range[0]})"
        )

        return "\n".join(parts)
