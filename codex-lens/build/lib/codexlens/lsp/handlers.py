"""LSP request handlers for codex-lens.

This module contains handlers for LSP requests:
- textDocument/definition
- textDocument/completion
- workspace/symbol
- textDocument/didSave
- textDocument/hover
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import List, Optional, Union
from urllib.parse import quote, unquote

try:
    from lsprotocol import types as lsp
except ImportError as exc:
    raise ImportError(
        "LSP dependencies not installed. Install with: pip install codex-lens[lsp]"
    ) from exc

from codexlens.entities import Symbol
from codexlens.lsp.server import server

logger = logging.getLogger(__name__)

# Symbol kind mapping from codex-lens to LSP
SYMBOL_KIND_MAP = {
    "class": lsp.SymbolKind.Class,
    "function": lsp.SymbolKind.Function,
    "method": lsp.SymbolKind.Method,
    "variable": lsp.SymbolKind.Variable,
    "constant": lsp.SymbolKind.Constant,
    "property": lsp.SymbolKind.Property,
    "field": lsp.SymbolKind.Field,
    "interface": lsp.SymbolKind.Interface,
    "module": lsp.SymbolKind.Module,
    "namespace": lsp.SymbolKind.Namespace,
    "package": lsp.SymbolKind.Package,
    "enum": lsp.SymbolKind.Enum,
    "enum_member": lsp.SymbolKind.EnumMember,
    "struct": lsp.SymbolKind.Struct,
    "type": lsp.SymbolKind.TypeParameter,
    "type_alias": lsp.SymbolKind.TypeParameter,
}

# Completion kind mapping from codex-lens to LSP
COMPLETION_KIND_MAP = {
    "class": lsp.CompletionItemKind.Class,
    "function": lsp.CompletionItemKind.Function,
    "method": lsp.CompletionItemKind.Method,
    "variable": lsp.CompletionItemKind.Variable,
    "constant": lsp.CompletionItemKind.Constant,
    "property": lsp.CompletionItemKind.Property,
    "field": lsp.CompletionItemKind.Field,
    "interface": lsp.CompletionItemKind.Interface,
    "module": lsp.CompletionItemKind.Module,
    "enum": lsp.CompletionItemKind.Enum,
    "enum_member": lsp.CompletionItemKind.EnumMember,
    "struct": lsp.CompletionItemKind.Struct,
    "type": lsp.CompletionItemKind.TypeParameter,
    "type_alias": lsp.CompletionItemKind.TypeParameter,
}


def _path_to_uri(path: Union[str, Path]) -> str:
    """Convert a file path to a URI.

    Args:
        path: File path (string or Path object)

    Returns:
        File URI string
    """
    path_str = str(Path(path).resolve())
    # Handle Windows paths
    if path_str.startswith("/"):
        return f"file://{quote(path_str)}"
    else:
        return f"file:///{quote(path_str.replace(chr(92), '/'))}"


def _uri_to_path(uri: str) -> Path:
    """Convert a URI to a file path.

    Args:
        uri: File URI string

    Returns:
        Path object
    """
    path = uri.replace("file:///", "").replace("file://", "")
    return Path(unquote(path))


def _get_word_at_position(document_text: str, line: int, character: int) -> Optional[str]:
    """Extract the word at the given position in the document.

    Args:
        document_text: Full document text
        line: 0-based line number
        character: 0-based character position

    Returns:
        Word at position, or None if no word found
    """
    lines = document_text.splitlines()
    if line >= len(lines):
        return None

    line_text = lines[line]
    if character > len(line_text):
        return None

    # Find word boundaries
    word_pattern = re.compile(r"[a-zA-Z_][a-zA-Z0-9_]*")
    for match in word_pattern.finditer(line_text):
        if match.start() <= character <= match.end():
            return match.group()

    return None


def _get_prefix_at_position(document_text: str, line: int, character: int) -> str:
    """Extract the incomplete word prefix at the given position.

    Args:
        document_text: Full document text
        line: 0-based line number
        character: 0-based character position

    Returns:
        Prefix string (may be empty)
    """
    lines = document_text.splitlines()
    if line >= len(lines):
        return ""

    line_text = lines[line]
    if character > len(line_text):
        character = len(line_text)

    # Extract text before cursor
    before_cursor = line_text[:character]

    # Find the start of the current word
    match = re.search(r"[a-zA-Z_][a-zA-Z0-9_]*$", before_cursor)
    if match:
        return match.group()

    return ""


def symbol_to_location(symbol: Symbol) -> Optional[lsp.Location]:
    """Convert a codex-lens Symbol to an LSP Location.

    Args:
        symbol: codex-lens Symbol object

    Returns:
        LSP Location, or None if symbol has no file
    """
    if not symbol.file:
        return None

    # LSP uses 0-based lines, codex-lens uses 1-based
    start_line = max(0, symbol.range[0] - 1)
    end_line = max(0, symbol.range[1] - 1)

    return lsp.Location(
        uri=_path_to_uri(symbol.file),
        range=lsp.Range(
            start=lsp.Position(line=start_line, character=0),
            end=lsp.Position(line=end_line, character=0),
        ),
    )


def _symbol_kind_to_lsp(kind: str) -> lsp.SymbolKind:
    """Map codex-lens symbol kind to LSP SymbolKind.

    Args:
        kind: codex-lens symbol kind string

    Returns:
        LSP SymbolKind
    """
    return SYMBOL_KIND_MAP.get(kind.lower(), lsp.SymbolKind.Variable)


def _symbol_kind_to_completion_kind(kind: str) -> lsp.CompletionItemKind:
    """Map codex-lens symbol kind to LSP CompletionItemKind.

    Args:
        kind: codex-lens symbol kind string

    Returns:
        LSP CompletionItemKind
    """
    return COMPLETION_KIND_MAP.get(kind.lower(), lsp.CompletionItemKind.Text)


# -----------------------------------------------------------------------------
# LSP Request Handlers
# -----------------------------------------------------------------------------


@server.feature(lsp.TEXT_DOCUMENT_DEFINITION)
def lsp_definition(
    params: lsp.DefinitionParams,
) -> Optional[Union[lsp.Location, List[lsp.Location]]]:
    """Handle textDocument/definition request.

    Finds the definition of the symbol at the cursor position.
    """
    if not server.global_index:
        logger.debug("No global index available for definition lookup")
        return None

    # Get document
    document = server.workspace.get_text_document(params.text_document.uri)
    if not document:
        return None

    # Get word at position
    word = _get_word_at_position(
        document.source,
        params.position.line,
        params.position.character,
    )

    if not word:
        logger.debug("No word found at position")
        return None

    logger.debug("Looking up definition for: %s", word)

    # Search for exact symbol match
    try:
        symbols = server.global_index.search(
            name=word,
            limit=10,
            prefix_mode=False,  # Exact match preferred
        )

        # Filter for exact name match
        exact_matches = [s for s in symbols if s.name == word]
        if not exact_matches:
            # Fall back to prefix search
            symbols = server.global_index.search(
                name=word,
                limit=10,
                prefix_mode=True,
            )
            exact_matches = [s for s in symbols if s.name == word]

        if not exact_matches:
            logger.debug("No definition found for: %s", word)
            return None

        # Convert to LSP locations
        locations = []
        for sym in exact_matches:
            loc = symbol_to_location(sym)
            if loc:
                locations.append(loc)

        if len(locations) == 1:
            return locations[0]
        elif locations:
            return locations
        else:
            return None

    except Exception as exc:
        logger.error("Error looking up definition: %s", exc)
        return None


@server.feature(lsp.TEXT_DOCUMENT_REFERENCES)
def lsp_references(params: lsp.ReferenceParams) -> Optional[List[lsp.Location]]:
    """Handle textDocument/references request.

    Finds all references to the symbol at the cursor position using
    the code_relationships table for accurate call-site tracking.
    Falls back to same-name symbol search if search_engine is unavailable.
    """
    document = server.workspace.get_text_document(params.text_document.uri)
    if not document:
        return None

    word = _get_word_at_position(
        document.source,
        params.position.line,
        params.position.character,
    )

    if not word:
        return None

    logger.debug("Finding references for: %s", word)

    try:
        # Try using search_engine.search_references() for accurate reference tracking
        if server.search_engine and server.workspace_root:
            references = server.search_engine.search_references(
                symbol_name=word,
                source_path=server.workspace_root,
                limit=200,
            )

            if references:
                locations = []
                for ref in references:
                    locations.append(
                        lsp.Location(
                            uri=_path_to_uri(ref.file_path),
                            range=lsp.Range(
                                start=lsp.Position(
                                    line=max(0, ref.line - 1),
                                    character=ref.column,
                                ),
                                end=lsp.Position(
                                    line=max(0, ref.line - 1),
                                    character=ref.column + len(word),
                                ),
                            ),
                        )
                    )
                return locations if locations else None

        # Fallback: search for symbols with same name using global_index
        if server.global_index:
            symbols = server.global_index.search(
                name=word,
                limit=100,
                prefix_mode=False,
            )

            # Filter for exact matches
            exact_matches = [s for s in symbols if s.name == word]

            locations = []
            for sym in exact_matches:
                loc = symbol_to_location(sym)
                if loc:
                    locations.append(loc)

            return locations if locations else None

        return None

    except Exception as exc:
        logger.error("Error finding references: %s", exc)
        return None


@server.feature(lsp.TEXT_DOCUMENT_COMPLETION)
def lsp_completion(params: lsp.CompletionParams) -> Optional[lsp.CompletionList]:
    """Handle textDocument/completion request.

    Provides code completion suggestions based on indexed symbols.
    """
    if not server.global_index:
        return None

    document = server.workspace.get_text_document(params.text_document.uri)
    if not document:
        return None

    prefix = _get_prefix_at_position(
        document.source,
        params.position.line,
        params.position.character,
    )

    if not prefix or len(prefix) < 2:
        # Require at least 2 characters for completion
        return None

    logger.debug("Completing prefix: %s", prefix)

    try:
        symbols = server.global_index.search(
            name=prefix,
            limit=50,
            prefix_mode=True,
        )

        if not symbols:
            return None

        # Convert to completion items
        items = []
        seen_names = set()

        for sym in symbols:
            if sym.name in seen_names:
                continue
            seen_names.add(sym.name)

            items.append(
                lsp.CompletionItem(
                    label=sym.name,
                    kind=_symbol_kind_to_completion_kind(sym.kind),
                    detail=f"{sym.kind} - {Path(sym.file).name if sym.file else 'unknown'}",
                    sort_text=sym.name.lower(),
                )
            )

        return lsp.CompletionList(
            is_incomplete=len(symbols) >= 50,
            items=items,
        )

    except Exception as exc:
        logger.error("Error getting completions: %s", exc)
        return None


@server.feature(lsp.TEXT_DOCUMENT_HOVER)
def lsp_hover(params: lsp.HoverParams) -> Optional[lsp.Hover]:
    """Handle textDocument/hover request.

    Provides hover information for the symbol at the cursor position
    using HoverProvider for rich symbol information including
    signature, documentation, and location.
    """
    if not server.global_index:
        return None

    document = server.workspace.get_text_document(params.text_document.uri)
    if not document:
        return None

    word = _get_word_at_position(
        document.source,
        params.position.line,
        params.position.character,
    )

    if not word:
        return None

    logger.debug("Hover for: %s", word)

    try:
        # Use HoverProvider for rich symbol information
        from codexlens.lsp.providers import HoverProvider

        provider = HoverProvider(server.global_index, server.registry)
        info = provider.get_hover_info(word)

        if not info:
            return None

        # Format as markdown with signature and location
        content = provider.format_hover_markdown(info)

        return lsp.Hover(
            contents=lsp.MarkupContent(
                kind=lsp.MarkupKind.Markdown,
                value=content,
            ),
        )

    except Exception as exc:
        logger.error("Error getting hover info: %s", exc)
        return None


@server.feature(lsp.WORKSPACE_SYMBOL)
def lsp_workspace_symbol(
    params: lsp.WorkspaceSymbolParams,
) -> Optional[List[lsp.SymbolInformation]]:
    """Handle workspace/symbol request.

    Searches for symbols across the workspace.
    """
    if not server.global_index:
        return None

    query = params.query
    if not query or len(query) < 2:
        return None

    logger.debug("Workspace symbol search: %s", query)

    try:
        symbols = server.global_index.search(
            name=query,
            limit=100,
            prefix_mode=True,
        )

        if not symbols:
            return None

        result = []
        for sym in symbols:
            loc = symbol_to_location(sym)
            if loc:
                result.append(
                    lsp.SymbolInformation(
                        name=sym.name,
                        kind=_symbol_kind_to_lsp(sym.kind),
                        location=loc,
                        container_name=Path(sym.file).parent.name if sym.file else None,
                    )
                )

        return result if result else None

    except Exception as exc:
        logger.error("Error searching workspace symbols: %s", exc)
        return None


@server.feature(lsp.TEXT_DOCUMENT_DID_SAVE)
def lsp_did_save(params: lsp.DidSaveTextDocumentParams) -> None:
    """Handle textDocument/didSave notification.

    Triggers incremental re-indexing of the saved file.
    Note: Full incremental indexing requires WatcherManager integration,
    which is planned for Phase 2.
    """
    file_path = _uri_to_path(params.text_document.uri)
    logger.info("File saved: %s", file_path)

    # Phase 1: Just log the save event
    # Phase 2 will integrate with WatcherManager for incremental indexing
    # if server.watcher_manager:
    #     server.watcher_manager.trigger_reindex(file_path)


@server.feature(lsp.TEXT_DOCUMENT_DID_OPEN)
def lsp_did_open(params: lsp.DidOpenTextDocumentParams) -> None:
    """Handle textDocument/didOpen notification."""
    file_path = _uri_to_path(params.text_document.uri)
    logger.debug("File opened: %s", file_path)


@server.feature(lsp.TEXT_DOCUMENT_DID_CLOSE)
def lsp_did_close(params: lsp.DidCloseTextDocumentParams) -> None:
    """Handle textDocument/didClose notification."""
    file_path = _uri_to_path(params.text_document.uri)
    logger.debug("File closed: %s", file_path)
