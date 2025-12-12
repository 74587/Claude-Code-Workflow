"""Parser factory for CodexLens.

The project currently ships lightweight regex-based parsers per language.
They can be swapped for tree-sitter based parsers later without changing
CLI or storage interfaces.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Protocol

from codexlens.config import Config
from codexlens.entities import IndexedFile, Symbol


class Parser(Protocol):
    def parse(self, text: str, path: Path) -> IndexedFile: ...


@dataclass
class SimpleRegexParser:
    language_id: str

    def parse(self, text: str, path: Path) -> IndexedFile:
        symbols: List[Symbol] = []
        if self.language_id == "python":
            symbols = _parse_python_symbols(text)
        elif self.language_id in {"javascript", "typescript"}:
            symbols = _parse_js_ts_symbols(text)
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
_PY_DEF_RE = re.compile(r"^\s*def\s+([A-Za-z_]\w*)\s*\(")


def _parse_python_symbols(text: str) -> List[Symbol]:
    symbols: List[Symbol] = []
    current_class_indent: Optional[int] = None
    for i, line in enumerate(text.splitlines(), start=1):
        if _PY_CLASS_RE.match(line):
            name = _PY_CLASS_RE.match(line).group(1)
            current_class_indent = len(line) - len(line.lstrip(" "))
            symbols.append(Symbol(name=name, kind="class", range=(i, i)))
            continue
        def_match = _PY_DEF_RE.match(line)
        if def_match:
            name = def_match.group(1)
            indent = len(line) - len(line.lstrip(" "))
            kind = "method" if current_class_indent is not None and indent > current_class_indent else "function"
            symbols.append(Symbol(name=name, kind=kind, range=(i, i)))
            continue
        if current_class_indent is not None:
            indent = len(line) - len(line.lstrip(" "))
            if line.strip() and indent <= current_class_indent:
                current_class_indent = None
    return symbols


_JS_FUNC_RE = re.compile(r"^\s*(?:export\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(")
_JS_CLASS_RE = re.compile(r"^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)\b")


def _parse_js_ts_symbols(text: str) -> List[Symbol]:
    symbols: List[Symbol] = []
    for i, line in enumerate(text.splitlines(), start=1):
        func_match = _JS_FUNC_RE.match(line)
        if func_match:
            symbols.append(Symbol(name=func_match.group(1), kind="function", range=(i, i)))
            continue
        class_match = _JS_CLASS_RE.match(line)
        if class_match:
            symbols.append(Symbol(name=class_match.group(1), kind="class", range=(i, i)))
    return symbols


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

