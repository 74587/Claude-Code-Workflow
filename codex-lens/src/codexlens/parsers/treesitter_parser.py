"""Tree-sitter based parser for CodexLens.

Provides precise AST-level parsing with fallback to regex-based parsing.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

try:
    from tree_sitter import Language as TreeSitterLanguage
    from tree_sitter import Node as TreeSitterNode
    from tree_sitter import Parser as TreeSitterParser
    TREE_SITTER_AVAILABLE = True
except ImportError:
    TreeSitterLanguage = None  # type: ignore[assignment]
    TreeSitterNode = None  # type: ignore[assignment]
    TreeSitterParser = None  # type: ignore[assignment]
    TREE_SITTER_AVAILABLE = False

from codexlens.entities import IndexedFile, Symbol
from codexlens.parsers.tokenizer import get_default_tokenizer


class TreeSitterSymbolParser:
    """Parser using tree-sitter for AST-level symbol extraction."""

    def __init__(self, language_id: str, path: Optional[Path] = None) -> None:
        """Initialize tree-sitter parser for a language.

        Args:
            language_id: Language identifier (python, javascript, typescript, etc.)
            path: Optional file path for language variant detection (e.g., .tsx)
        """
        self.language_id = language_id
        self.path = path
        self._parser: Optional[object] = None
        self._language: Optional[TreeSitterLanguage] = None
        self._tokenizer = get_default_tokenizer()

        if TREE_SITTER_AVAILABLE:
            self._initialize_parser()

    def _initialize_parser(self) -> None:
        """Initialize tree-sitter parser and language."""
        if TreeSitterParser is None or TreeSitterLanguage is None:
            return

        try:
            # Load language grammar
            if self.language_id == "python":
                import tree_sitter_python
                self._language = TreeSitterLanguage(tree_sitter_python.language())
            elif self.language_id == "javascript":
                import tree_sitter_javascript
                self._language = TreeSitterLanguage(tree_sitter_javascript.language())
            elif self.language_id == "typescript":
                import tree_sitter_typescript
                # Detect TSX files by extension
                if self.path is not None and self.path.suffix.lower() == ".tsx":
                    self._language = TreeSitterLanguage(tree_sitter_typescript.language_tsx())
                else:
                    self._language = TreeSitterLanguage(tree_sitter_typescript.language_typescript())
            else:
                return

            # Create parser
            self._parser = TreeSitterParser()
            if hasattr(self._parser, "set_language"):
                self._parser.set_language(self._language)  # type: ignore[attr-defined]
            else:
                self._parser.language = self._language  # type: ignore[assignment]

        except Exception:
            # Gracefully handle missing language bindings
            self._parser = None
            self._language = None

    def is_available(self) -> bool:
        """Check if tree-sitter parser is available.

        Returns:
            True if parser is initialized and ready
        """
        return self._parser is not None and self._language is not None


    def parse_symbols(self, text: str) -> Optional[List[Symbol]]:
        """Parse source code and extract symbols without creating IndexedFile.

        Args:
            text: Source code text

        Returns:
            List of symbols if parsing succeeds, None if tree-sitter unavailable
        """
        if not self.is_available() or self._parser is None:
            return None

        try:
            source_bytes = text.encode("utf8")
            tree = self._parser.parse(source_bytes)  # type: ignore[attr-defined]
            root = tree.root_node

            return self._extract_symbols(source_bytes, root)
        except Exception:
            # Gracefully handle parsing errors
            return None

    def parse(self, text: str, path: Path) -> Optional[IndexedFile]:
        """Parse source code and extract symbols.

        Args:
            text: Source code text
            path: File path

        Returns:
            IndexedFile if parsing succeeds, None if tree-sitter unavailable
        """
        if not self.is_available() or self._parser is None:
            return None

        try:
            symbols = self.parse_symbols(text)
            if symbols is None:
                return None

            return IndexedFile(
                path=str(path.resolve()),
                language=self.language_id,
                symbols=symbols,
                chunks=[],
            )
        except Exception:
            # Gracefully handle parsing errors
            return None

    def _extract_symbols(self, source_bytes: bytes, root: TreeSitterNode) -> List[Symbol]:
        """Extract symbols from AST.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node

        Returns:
            List of extracted symbols
        """
        if self.language_id == "python":
            return self._extract_python_symbols(source_bytes, root)
        elif self.language_id in {"javascript", "typescript"}:
            return self._extract_js_ts_symbols(source_bytes, root)
        else:
            return []

    def _extract_python_symbols(self, source_bytes: bytes, root: TreeSitterNode) -> List[Symbol]:
        """Extract Python symbols from AST.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node

        Returns:
            List of Python symbols (classes, functions, methods)
        """
        symbols: List[Symbol] = []

        for node in self._iter_nodes(root):
            if node.type == "class_definition":
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    continue
                symbols.append(Symbol(
                    name=self._node_text(source_bytes, name_node),
                    kind="class",
                    range=self._node_range(node),
                ))
            elif node.type in {"function_definition", "async_function_definition"}:
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    continue
                symbols.append(Symbol(
                    name=self._node_text(source_bytes, name_node),
                    kind=self._python_function_kind(node),
                    range=self._node_range(node),
                ))

        return symbols

    def _extract_js_ts_symbols(self, source_bytes: bytes, root: TreeSitterNode) -> List[Symbol]:
        """Extract JavaScript/TypeScript symbols from AST.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node

        Returns:
            List of JS/TS symbols (classes, functions, methods)
        """
        symbols: List[Symbol] = []

        for node in self._iter_nodes(root):
            if node.type in {"class_declaration", "class"}:
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    continue
                symbols.append(Symbol(
                    name=self._node_text(source_bytes, name_node),
                    kind="class",
                    range=self._node_range(node),
                ))
            elif node.type in {"function_declaration", "generator_function_declaration"}:
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    continue
                symbols.append(Symbol(
                    name=self._node_text(source_bytes, name_node),
                    kind="function",
                    range=self._node_range(node),
                ))
            elif node.type == "variable_declarator":
                name_node = node.child_by_field_name("name")
                value_node = node.child_by_field_name("value")
                if (
                    name_node is None
                    or value_node is None
                    or name_node.type not in {"identifier", "property_identifier"}
                    or value_node.type != "arrow_function"
                ):
                    continue
                symbols.append(Symbol(
                    name=self._node_text(source_bytes, name_node),
                    kind="function",
                    range=self._node_range(node),
                ))
            elif node.type == "method_definition" and self._has_class_ancestor(node):
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    continue
                name = self._node_text(source_bytes, name_node)
                if name == "constructor":
                    continue
                symbols.append(Symbol(
                    name=name,
                    kind="method",
                    range=self._node_range(node),
                ))

        return symbols

    def _python_function_kind(self, node: TreeSitterNode) -> str:
        """Determine if Python function is a method or standalone function.

        Args:
            node: Function definition node

        Returns:
            'method' if inside a class, 'function' otherwise
        """
        parent = node.parent
        while parent is not None:
            if parent.type in {"function_definition", "async_function_definition"}:
                return "function"
            if parent.type == "class_definition":
                return "method"
            parent = parent.parent
        return "function"

    def _has_class_ancestor(self, node: TreeSitterNode) -> bool:
        """Check if node has a class ancestor.

        Args:
            node: AST node to check

        Returns:
            True if node is inside a class
        """
        parent = node.parent
        while parent is not None:
            if parent.type in {"class_declaration", "class"}:
                return True
            parent = parent.parent
        return False

    def _iter_nodes(self, root: TreeSitterNode):
        """Iterate over all nodes in AST.

        Args:
            root: Root node to start iteration

        Yields:
            AST nodes in depth-first order
        """
        stack = [root]
        while stack:
            node = stack.pop()
            yield node
            for child in reversed(node.children):
                stack.append(child)

    def _node_text(self, source_bytes: bytes, node: TreeSitterNode) -> str:
        """Extract text for a node.

        Args:
            source_bytes: Source code as bytes
            node: AST node

        Returns:
            Text content of node
        """
        return source_bytes[node.start_byte:node.end_byte].decode("utf8")

    def _node_range(self, node: TreeSitterNode) -> tuple[int, int]:
        """Get line range for a node.

        Args:
            node: AST node

        Returns:
            (start_line, end_line) tuple, 1-based inclusive
        """
        start_line = node.start_point[0] + 1
        end_line = node.end_point[0] + 1
        return (start_line, max(start_line, end_line))

    def count_tokens(self, text: str) -> int:
        """Count tokens in text.

        Args:
            text: Text to count tokens for

        Returns:
            Token count
        """
        return self._tokenizer.count_tokens(text)
