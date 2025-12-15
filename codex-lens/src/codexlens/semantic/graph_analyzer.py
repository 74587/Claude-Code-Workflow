"""Graph analyzer for extracting code relationships using tree-sitter.

Provides AST-based analysis to identify function calls, method invocations,
and class inheritance relationships within source files.
"""

from __future__ import annotations

from pathlib import Path
from typing import List, Optional

try:
    from tree_sitter import Node as TreeSitterNode
    TREE_SITTER_AVAILABLE = True
except ImportError:
    TreeSitterNode = None  # type: ignore[assignment]
    TREE_SITTER_AVAILABLE = False

from codexlens.entities import CodeRelationship, Symbol
from codexlens.parsers.treesitter_parser import TreeSitterSymbolParser


class GraphAnalyzer:
    """Analyzer for extracting semantic relationships from code using AST traversal."""

    def __init__(self, language_id: str, parser: Optional[TreeSitterSymbolParser] = None) -> None:
        """Initialize graph analyzer for a language.

        Args:
            language_id: Language identifier (python, javascript, typescript, etc.)
            parser: Optional TreeSitterSymbolParser instance for dependency injection.
                   If None, creates a new parser instance (backward compatibility).
        """
        self.language_id = language_id
        self._parser = parser if parser is not None else TreeSitterSymbolParser(language_id)

    def is_available(self) -> bool:
        """Check if graph analyzer is available.

        Returns:
            True if tree-sitter parser is initialized and ready
        """
        return self._parser.is_available()

    def analyze_file(self, text: str, file_path: Path) -> List[CodeRelationship]:
        """Analyze source code and extract relationships.

        Args:
            text: Source code text
            file_path: File path for relationship context

        Returns:
            List of CodeRelationship objects representing intra-file relationships
        """
        if not self.is_available() or self._parser._parser is None:
            return []

        try:
            source_bytes = text.encode("utf8")
            tree = self._parser._parser.parse(source_bytes)  # type: ignore[attr-defined]
            root = tree.root_node

            relationships = self._extract_relationships(source_bytes, root, str(file_path.resolve()))

            return relationships
        except Exception:
            # Gracefully handle parsing errors
            return []

    def analyze_with_symbols(
        self, text: str, file_path: Path, symbols: List[Symbol]
    ) -> List[CodeRelationship]:
        """Analyze source code using pre-parsed symbols to avoid duplicate parsing.

        Args:
            text: Source code text
            file_path: File path for relationship context
            symbols: Pre-parsed Symbol objects from TreeSitterSymbolParser

        Returns:
            List of CodeRelationship objects representing intra-file relationships
        """
        if not self.is_available() or self._parser._parser is None:
            return []

        try:
            source_bytes = text.encode("utf8")
            tree = self._parser._parser.parse(source_bytes)  # type: ignore[attr-defined]
            root = tree.root_node

            # Convert Symbol objects to internal symbol format
            defined_symbols = self._convert_symbols_to_dict(source_bytes, root, symbols)

            # Extract relationships using provided symbols
            relationships = self._extract_relationships_with_symbols(
                source_bytes, root, str(file_path.resolve()), defined_symbols
            )

            return relationships
        except Exception:
            # Gracefully handle parsing errors
            return []

    def _convert_symbols_to_dict(
        self, source_bytes: bytes, root: TreeSitterNode, symbols: List[Symbol]
    ) -> List[dict]:
        """Convert Symbol objects to internal dict format for relationship extraction.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node
            symbols: Pre-parsed Symbol objects

        Returns:
            List of symbol info dicts with name, node, and type
        """
        symbol_dicts = []
        symbol_names = {s.name for s in symbols}

        # Find AST nodes corresponding to symbols
        for node in self._iter_nodes(root):
            node_type = node.type

            # Check if this node matches any of our symbols
            if node_type in {"function_definition", "async_function_definition"}:
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(source_bytes, name_node)
                    if name in symbol_names:
                        symbol_dicts.append({
                            "name": name,
                            "node": node,
                            "type": "function"
                        })
            elif node_type == "class_definition":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(source_bytes, name_node)
                    if name in symbol_names:
                        symbol_dicts.append({
                            "name": name,
                            "node": node,
                            "type": "class"
                        })
            elif node_type in {"function_declaration", "generator_function_declaration"}:
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(source_bytes, name_node)
                    if name in symbol_names:
                        symbol_dicts.append({
                            "name": name,
                            "node": node,
                            "type": "function"
                        })
            elif node_type == "method_definition":
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(source_bytes, name_node)
                    if name in symbol_names:
                        symbol_dicts.append({
                            "name": name,
                            "node": node,
                            "type": "method"
                        })
            elif node_type in {"class_declaration", "class"}:
                name_node = node.child_by_field_name("name")
                if name_node:
                    name = self._node_text(source_bytes, name_node)
                    if name in symbol_names:
                        symbol_dicts.append({
                            "name": name,
                            "node": node,
                            "type": "class"
                        })
            elif node_type == "variable_declarator":
                name_node = node.child_by_field_name("name")
                value_node = node.child_by_field_name("value")
                if name_node and value_node and value_node.type == "arrow_function":
                    name = self._node_text(source_bytes, name_node)
                    if name in symbol_names:
                        symbol_dicts.append({
                            "name": name,
                            "node": node,
                            "type": "function"
                        })

        return symbol_dicts

    def _extract_relationships_with_symbols(
        self, source_bytes: bytes, root: TreeSitterNode, file_path: str, defined_symbols: List[dict]
    ) -> List[CodeRelationship]:
        """Extract relationships from AST using pre-parsed symbols.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node
            file_path: Absolute file path
            defined_symbols: Pre-parsed symbol dicts

        Returns:
            List of extracted relationships
        """
        relationships: List[CodeRelationship] = []

        # Determine call node type based on language
        if self.language_id == "python":
            call_node_type = "call"
            extract_target = self._extract_call_target
        elif self.language_id in {"javascript", "typescript"}:
            call_node_type = "call_expression"
            extract_target = self._extract_js_call_target
        else:
            return []

        # Find call expressions and match to defined symbols
        for node in self._iter_nodes(root):
            if node.type == call_node_type:
                # Extract caller context (enclosing function/method/class)
                source_symbol = self._find_enclosing_symbol(node, defined_symbols)
                if source_symbol is None:
                    # Call at module level, use "<module>" as source
                    source_symbol = "<module>"

                # Extract callee (function/method being called)
                target_symbol = extract_target(source_bytes, node)
                if target_symbol is None:
                    continue

                # Create relationship
                line_number = node.start_point[0] + 1
                relationships.append(
                    CodeRelationship(
                        source_symbol=source_symbol,
                        target_symbol=target_symbol,
                        relationship_type="call",
                        source_file=file_path,
                        target_file=None,  # Intra-file only
                        source_line=line_number,
                    )
                )

        return relationships

    def _extract_relationships(
        self, source_bytes: bytes, root: TreeSitterNode, file_path: str
    ) -> List[CodeRelationship]:
        """Extract relationships from AST.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node
            file_path: Absolute file path

        Returns:
            List of extracted relationships
        """
        if self.language_id == "python":
            return self._extract_python_relationships(source_bytes, root, file_path)
        elif self.language_id in {"javascript", "typescript"}:
            return self._extract_js_ts_relationships(source_bytes, root, file_path)
        else:
            return []

    def _extract_python_relationships(
        self, source_bytes: bytes, root: TreeSitterNode, file_path: str
    ) -> List[CodeRelationship]:
        """Extract Python relationships from AST.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node
            file_path: Absolute file path

        Returns:
            List of Python relationships (function/method calls)
        """
        relationships: List[CodeRelationship] = []

        # First pass: collect all defined symbols with their scopes
        defined_symbols = self._collect_python_symbols(source_bytes, root)

        # Second pass: find call expressions and match to defined symbols
        for node in self._iter_nodes(root):
            if node.type == "call":
                # Extract caller context (enclosing function/method/class)
                source_symbol = self._find_enclosing_symbol(node, defined_symbols)
                if source_symbol is None:
                    # Call at module level, use "<module>" as source
                    source_symbol = "<module>"

                # Extract callee (function/method being called)
                target_symbol = self._extract_call_target(source_bytes, node)
                if target_symbol is None:
                    continue

                # Create relationship
                line_number = node.start_point[0] + 1
                relationships.append(
                    CodeRelationship(
                        source_symbol=source_symbol,
                        target_symbol=target_symbol,
                        relationship_type="call",
                        source_file=file_path,
                        target_file=None,  # Intra-file only
                        source_line=line_number,
                    )
                )

        return relationships

    def _extract_js_ts_relationships(
        self, source_bytes: bytes, root: TreeSitterNode, file_path: str
    ) -> List[CodeRelationship]:
        """Extract JavaScript/TypeScript relationships from AST.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node
            file_path: Absolute file path

        Returns:
            List of JS/TS relationships (function/method calls)
        """
        relationships: List[CodeRelationship] = []

        # First pass: collect all defined symbols
        defined_symbols = self._collect_js_ts_symbols(source_bytes, root)

        # Second pass: find call expressions
        for node in self._iter_nodes(root):
            if node.type == "call_expression":
                # Extract caller context
                source_symbol = self._find_enclosing_symbol(node, defined_symbols)
                if source_symbol is None:
                    source_symbol = "<module>"

                # Extract callee
                target_symbol = self._extract_js_call_target(source_bytes, node)
                if target_symbol is None:
                    continue

                # Create relationship
                line_number = node.start_point[0] + 1
                relationships.append(
                    CodeRelationship(
                        source_symbol=source_symbol,
                        target_symbol=target_symbol,
                        relationship_type="call",
                        source_file=file_path,
                        target_file=None,
                        source_line=line_number,
                    )
                )

        return relationships

    def _collect_python_symbols(self, source_bytes: bytes, root: TreeSitterNode) -> List[dict]:
        """Collect all Python function/method/class definitions.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node

        Returns:
            List of symbol info dicts with name, node, and type
        """
        symbols = []
        for node in self._iter_nodes(root):
            if node.type in {"function_definition", "async_function_definition"}:
                name_node = node.child_by_field_name("name")
                if name_node:
                    symbols.append({
                        "name": self._node_text(source_bytes, name_node),
                        "node": node,
                        "type": "function"
                    })
            elif node.type == "class_definition":
                name_node = node.child_by_field_name("name")
                if name_node:
                    symbols.append({
                        "name": self._node_text(source_bytes, name_node),
                        "node": node,
                        "type": "class"
                    })
        return symbols

    def _collect_js_ts_symbols(self, source_bytes: bytes, root: TreeSitterNode) -> List[dict]:
        """Collect all JS/TS function/method/class definitions.

        Args:
            source_bytes: Source code as bytes
            root: Root AST node

        Returns:
            List of symbol info dicts with name, node, and type
        """
        symbols = []
        for node in self._iter_nodes(root):
            if node.type in {"function_declaration", "generator_function_declaration"}:
                name_node = node.child_by_field_name("name")
                if name_node:
                    symbols.append({
                        "name": self._node_text(source_bytes, name_node),
                        "node": node,
                        "type": "function"
                    })
            elif node.type == "method_definition":
                name_node = node.child_by_field_name("name")
                if name_node:
                    symbols.append({
                        "name": self._node_text(source_bytes, name_node),
                        "node": node,
                        "type": "method"
                    })
            elif node.type in {"class_declaration", "class"}:
                name_node = node.child_by_field_name("name")
                if name_node:
                    symbols.append({
                        "name": self._node_text(source_bytes, name_node),
                        "node": node,
                        "type": "class"
                    })
            elif node.type == "variable_declarator":
                name_node = node.child_by_field_name("name")
                value_node = node.child_by_field_name("value")
                if name_node and value_node and value_node.type == "arrow_function":
                    symbols.append({
                        "name": self._node_text(source_bytes, name_node),
                        "node": node,
                        "type": "function"
                    })
        return symbols

    def _find_enclosing_symbol(self, node: TreeSitterNode, symbols: List[dict]) -> Optional[str]:
        """Find the enclosing function/method/class for a node.

        Args:
            node: AST node to find enclosure for
            symbols: List of defined symbols

        Returns:
            Name of enclosing symbol, or None if at module level
        """
        # Walk up the tree to find enclosing symbol
        parent = node.parent
        while parent is not None:
            for symbol in symbols:
                if symbol["node"] == parent:
                    return symbol["name"]
            parent = parent.parent
        return None

    def _extract_call_target(self, source_bytes: bytes, node: TreeSitterNode) -> Optional[str]:
        """Extract the target function name from a Python call expression.

        Args:
            source_bytes: Source code as bytes
            node: Call expression node

        Returns:
            Target function name, or None if cannot be determined
        """
        function_node = node.child_by_field_name("function")
        if function_node is None:
            return None

        # Handle simple identifiers (e.g., "foo()")
        if function_node.type == "identifier":
            return self._node_text(source_bytes, function_node)

        # Handle attribute access (e.g., "obj.method()")
        if function_node.type == "attribute":
            attr_node = function_node.child_by_field_name("attribute")
            if attr_node:
                return self._node_text(source_bytes, attr_node)

        return None

    def _extract_js_call_target(self, source_bytes: bytes, node: TreeSitterNode) -> Optional[str]:
        """Extract the target function name from a JS/TS call expression.

        Args:
            source_bytes: Source code as bytes
            node: Call expression node

        Returns:
            Target function name, or None if cannot be determined
        """
        function_node = node.child_by_field_name("function")
        if function_node is None:
            return None

        # Handle simple identifiers
        if function_node.type == "identifier":
            return self._node_text(source_bytes, function_node)

        # Handle member expressions (e.g., "obj.method()")
        if function_node.type == "member_expression":
            property_node = function_node.child_by_field_name("property")
            if property_node:
                return self._node_text(source_bytes, property_node)

        return None

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
