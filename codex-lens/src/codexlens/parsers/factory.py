"""Parser factory for CodexLens.

Python and JavaScript/TypeScript parsing use Tree-Sitter grammars when
available. Regex fallbacks are retained to preserve the existing parser
interface and behavior in minimal environments.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Protocol

try:
    from tree_sitter import Language as TreeSitterLanguage
    from tree_sitter import Node as TreeSitterNode
    from tree_sitter import Parser as TreeSitterParser
except Exception:  # pragma: no cover
    TreeSitterLanguage = None  # type: ignore[assignment]
    TreeSitterNode = None  # type: ignore[assignment]
    TreeSitterParser = None  # type: ignore[assignment]

from codexlens.config import Config
from codexlens.entities import IndexedFile, Symbol


class Parser(Protocol):
    def parse(self, text: str, path: Path) -> IndexedFile: ...


@dataclass
class SimpleRegexParser:
    language_id: str

    def parse(self, text: str, path: Path) -> IndexedFile:
        if self.language_id == "python":
            symbols = _parse_python_symbols(text)
        elif self.language_id in {"javascript", "typescript"}:
            symbols = _parse_js_ts_symbols(text, self.language_id, path)
        elif self.language_id == "java":
            symbols = _parse_java_symbols(text)
        elif self.language_id == "go":
            symbols = _parse_go_symbols(text)
        else:
            symbols = _parse_generic_symbols(text)

        return IndexedFile(
            path=str(path.resolve()),
            language=self.language_id,
            symbols=symbols,
            chunks=[],
        )


class ParserFactory:
    def __init__(self, config: Config) -> None:
        self.config = config
        self._parsers: Dict[str, Parser] = {}

    def get_parser(self, language_id: str) -> Parser:
        if language_id not in self._parsers:
            self._parsers[language_id] = SimpleRegexParser(language_id)
        return self._parsers[language_id]


_PY_CLASS_RE = re.compile(r"^\s*class\s+([A-Za-z_]\w*)\b")
_PY_DEF_RE = re.compile(r"^\s*(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(")

_TREE_SITTER_LANGUAGE_CACHE: Dict[str, TreeSitterLanguage] = {}


def _get_tree_sitter_language(language_id: str, path: Path | None = None) -> TreeSitterLanguage | None:
    if TreeSitterLanguage is None:
        return None

    cache_key = language_id
    if language_id == "typescript" and path is not None and path.suffix.lower() == ".tsx":
        cache_key = "tsx"

    cached = _TREE_SITTER_LANGUAGE_CACHE.get(cache_key)
    if cached is not None:
        return cached

    try:
        if cache_key == "python":
            import tree_sitter_python  # type: ignore[import-not-found]

            language = TreeSitterLanguage(tree_sitter_python.language())
        elif cache_key == "javascript":
            import tree_sitter_javascript  # type: ignore[import-not-found]

            language = TreeSitterLanguage(tree_sitter_javascript.language())
        elif cache_key == "typescript":
            import tree_sitter_typescript  # type: ignore[import-not-found]

            language = TreeSitterLanguage(tree_sitter_typescript.language_typescript())
        elif cache_key == "tsx":
            import tree_sitter_typescript  # type: ignore[import-not-found]

            language = TreeSitterLanguage(tree_sitter_typescript.language_tsx())
        else:
            return None
    except Exception:
        return None

    _TREE_SITTER_LANGUAGE_CACHE[cache_key] = language
    return language


def _iter_tree_sitter_nodes(root: TreeSitterNode) -> Iterable[TreeSitterNode]:
    stack: List[TreeSitterNode] = [root]
    while stack:
        node = stack.pop()
        yield node
        for child in reversed(node.children):
            stack.append(child)


def _node_text(source_bytes: bytes, node: TreeSitterNode) -> str:
    return source_bytes[node.start_byte:node.end_byte].decode("utf8")


def _node_range(node: TreeSitterNode) -> tuple[int, int]:
    start_line = node.start_point[0] + 1
    end_line = node.end_point[0] + 1
    return (start_line, max(start_line, end_line))


def _python_kind_for_function_node(node: TreeSitterNode) -> str:
    parent = node.parent
    while parent is not None:
        if parent.type in {"function_definition", "async_function_definition"}:
            return "function"
        if parent.type == "class_definition":
            return "method"
        parent = parent.parent
    return "function"


def _parse_python_symbols_tree_sitter(text: str) -> List[Symbol] | None:
    if TreeSitterParser is None:
        return None

    language = _get_tree_sitter_language("python")
    if language is None:
        return None

    parser = TreeSitterParser()
    if hasattr(parser, "set_language"):
        parser.set_language(language)  # type: ignore[attr-defined]
    else:
        parser.language = language  # type: ignore[assignment]

    source_bytes = text.encode("utf8")
    tree = parser.parse(source_bytes)
    root = tree.root_node

    symbols: List[Symbol] = []
    for node in _iter_tree_sitter_nodes(root):
        if node.type == "class_definition":
            name_node = node.child_by_field_name("name")
            if name_node is None:
                continue
            symbols.append(Symbol(
                name=_node_text(source_bytes, name_node),
                kind="class",
                range=_node_range(node),
            ))
        elif node.type in {"function_definition", "async_function_definition"}:
            name_node = node.child_by_field_name("name")
            if name_node is None:
                continue
            symbols.append(Symbol(
                name=_node_text(source_bytes, name_node),
                kind=_python_kind_for_function_node(node),
                range=_node_range(node),
            ))

    return symbols


def _parse_python_symbols_regex(text: str) -> List[Symbol]:
    symbols: List[Symbol] = []
    current_class_indent: Optional[int] = None
    for i, line in enumerate(text.splitlines(), start=1):
        class_match = _PY_CLASS_RE.match(line)
        if class_match:
            current_class_indent = len(line) - len(line.lstrip(" "))
            symbols.append(Symbol(name=class_match.group(1), kind="class", range=(i, i)))
            continue
        def_match = _PY_DEF_RE.match(line)
        if def_match:
            indent = len(line) - len(line.lstrip(" "))
            kind = "method" if current_class_indent is not None and indent > current_class_indent else "function"
            symbols.append(Symbol(name=def_match.group(1), kind=kind, range=(i, i)))
            continue
        if current_class_indent is not None:
            indent = len(line) - len(line.lstrip(" "))
            if line.strip() and indent <= current_class_indent:
                current_class_indent = None
    return symbols


def _parse_python_symbols(text: str) -> List[Symbol]:
    symbols = _parse_python_symbols_tree_sitter(text)
    if symbols is not None:
        return symbols
    return _parse_python_symbols_regex(text)


_JS_FUNC_RE = re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(")
_JS_CLASS_RE = re.compile(r"^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b")
_JS_ARROW_RE = re.compile(
    r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(?[^)]*\)?\s*=>"
)
_JS_METHOD_RE = re.compile(r"^\s+(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{")


def _js_has_class_ancestor(node: TreeSitterNode) -> bool:
    parent = node.parent
    while parent is not None:
        if parent.type in {"class_declaration", "class"}:
            return True
        parent = parent.parent
    return False


def _parse_js_ts_symbols_tree_sitter(
    text: str,
    language_id: str,
    path: Path | None = None,
) -> List[Symbol] | None:
    if TreeSitterParser is None:
        return None

    language = _get_tree_sitter_language(language_id, path)
    if language is None:
        return None

    parser = TreeSitterParser()
    if hasattr(parser, "set_language"):
        parser.set_language(language)  # type: ignore[attr-defined]
    else:
        parser.language = language  # type: ignore[assignment]

    source_bytes = text.encode("utf8")
    tree = parser.parse(source_bytes)
    root = tree.root_node

    symbols: List[Symbol] = []
    for node in _iter_tree_sitter_nodes(root):
        if node.type in {"class_declaration", "class"}:
            name_node = node.child_by_field_name("name")
            if name_node is None:
                continue
            symbols.append(Symbol(
                name=_node_text(source_bytes, name_node),
                kind="class",
                range=_node_range(node),
            ))
        elif node.type in {"function_declaration", "generator_function_declaration"}:
            name_node = node.child_by_field_name("name")
            if name_node is None:
                continue
            symbols.append(Symbol(
                name=_node_text(source_bytes, name_node),
                kind="function",
                range=_node_range(node),
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
                name=_node_text(source_bytes, name_node),
                kind="function",
                range=_node_range(node),
            ))
        elif node.type == "method_definition" and _js_has_class_ancestor(node):
            name_node = node.child_by_field_name("name")
            if name_node is None:
                continue
            name = _node_text(source_bytes, name_node)
            if name == "constructor":
                continue
            symbols.append(Symbol(
                name=name,
                kind="method",
                range=_node_range(node),
            ))

    return symbols


def _parse_js_ts_symbols_regex(text: str) -> List[Symbol]:
    symbols: List[Symbol] = []
    in_class = False
    class_brace_depth = 0
    brace_depth = 0

    for i, line in enumerate(text.splitlines(), start=1):
        brace_depth += line.count("{") - line.count("}")

        class_match = _JS_CLASS_RE.match(line)
        if class_match:
            symbols.append(Symbol(name=class_match.group(1), kind="class", range=(i, i)))
            in_class = True
            class_brace_depth = brace_depth
            continue

        if in_class and brace_depth < class_brace_depth:
            in_class = False

        func_match = _JS_FUNC_RE.match(line)
        if func_match:
            symbols.append(Symbol(name=func_match.group(1), kind="function", range=(i, i)))
            continue

        arrow_match = _JS_ARROW_RE.match(line)
        if arrow_match:
            symbols.append(Symbol(name=arrow_match.group(1), kind="function", range=(i, i)))
            continue

        if in_class:
            method_match = _JS_METHOD_RE.match(line)
            if method_match:
                name = method_match.group(1)
                if name != "constructor":
                    symbols.append(Symbol(name=name, kind="method", range=(i, i)))

    return symbols


def _parse_js_ts_symbols(
    text: str,
    language_id: str = "javascript",
    path: Path | None = None,
) -> List[Symbol]:
    symbols = _parse_js_ts_symbols_tree_sitter(text, language_id, path)
    if symbols is not None:
        return symbols
    return _parse_js_ts_symbols_regex(text)


_JAVA_CLASS_RE = re.compile(r"^\s*(?:public\s+)?class\s+([A-Za-z_]\w*)\b")
_JAVA_METHOD_RE = re.compile(
    r"^\s*(?:public|private|protected|static|\s)+[\w<>\[\]]+\s+([A-Za-z_]\w*)\s*\("
)


def _parse_java_symbols(text: str) -> List[Symbol]:
    symbols: List[Symbol] = []
    for i, line in enumerate(text.splitlines(), start=1):
        class_match = _JAVA_CLASS_RE.match(line)
        if class_match:
            symbols.append(Symbol(name=class_match.group(1), kind="class", range=(i, i)))
            continue
        method_match = _JAVA_METHOD_RE.match(line)
        if method_match:
            symbols.append(Symbol(name=method_match.group(1), kind="method", range=(i, i)))
    return symbols


_GO_FUNC_RE = re.compile(r"^\s*func\s+(?:\([^)]+\)\s+)?([A-Za-z_]\w*)\s*\(")
_GO_TYPE_RE = re.compile(r"^\s*type\s+([A-Za-z_]\w*)\s+(?:struct|interface)\b")


def _parse_go_symbols(text: str) -> List[Symbol]:
    symbols: List[Symbol] = []
    for i, line in enumerate(text.splitlines(), start=1):
        type_match = _GO_TYPE_RE.match(line)
        if type_match:
            symbols.append(Symbol(name=type_match.group(1), kind="class", range=(i, i)))
            continue
        func_match = _GO_FUNC_RE.match(line)
        if func_match:
            symbols.append(Symbol(name=func_match.group(1), kind="function", range=(i, i)))
    return symbols


_GENERIC_DEF_RE = re.compile(r"^\s*(?:def|function|func)\s+([A-Za-z_]\w*)\b")
_GENERIC_CLASS_RE = re.compile(r"^\s*(?:class|struct|interface)\s+([A-Za-z_]\w*)\b")


def _parse_generic_symbols(text: str) -> List[Symbol]:
    symbols: List[Symbol] = []
    for i, line in enumerate(text.splitlines(), start=1):
        class_match = _GENERIC_CLASS_RE.match(line)
        if class_match:
            symbols.append(Symbol(name=class_match.group(1), kind="class", range=(i, i)))
            continue
        def_match = _GENERIC_DEF_RE.match(line)
        if def_match:
            symbols.append(Symbol(name=def_match.group(1), kind="function", range=(i, i)))
    return symbols
