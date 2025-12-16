"""Rich and JSON output helpers for CodexLens CLI."""

from __future__ import annotations

import json
import sys
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from rich.console import Console
from rich.table import Table
from rich.text import Text

from codexlens.entities import SearchResult, Symbol

# Force UTF-8 encoding for Windows console to properly display Chinese text
# Use force_terminal=True and legacy_windows=False to avoid GBK encoding issues
console = Console(force_terminal=True, legacy_windows=False)


def _to_jsonable(value: Any) -> Any:
    if value is None:
        return None
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, Mapping):
        return {k: _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_jsonable(v) for v in value]
    return value


def print_json(*, success: bool, result: Any = None, error: str | None = None) -> None:
    payload: dict[str, Any] = {"success": success}
    if success:
        payload["result"] = _to_jsonable(result)
    else:
        payload["error"] = error or "Unknown error"
    console.print_json(json.dumps(payload, ensure_ascii=False))


def render_search_results(
    results: Sequence[SearchResult], *, title: str = "Search Results", verbose: bool = False
) -> None:
    """Render search results with optional source tags in verbose mode.

    Args:
        results: Search results to display
        title: Table title
        verbose: If True, show search source tags ([E], [F], [V]) and fusion scores
    """
    table = Table(title=title, show_lines=False)

    if verbose:
        # Verbose mode: show source tags
        table.add_column("Source", style="dim", width=6, justify="center")

    table.add_column("Path", style="cyan", no_wrap=True)
    table.add_column("Score", style="magenta", justify="right")
    table.add_column("Excerpt", style="white")

    for res in results:
        excerpt = res.excerpt or ""
        score_str = f"{res.score:.3f}"

        if verbose:
            # Extract search source tag if available
            source = getattr(res, "search_source", None)
            source_tag = ""
            if source == "exact":
                source_tag = "[E]"
            elif source == "fuzzy":
                source_tag = "[F]"
            elif source == "vector":
                source_tag = "[V]"
            elif source == "fusion":
                source_tag = "[RRF]"
            table.add_row(source_tag, res.path, score_str, excerpt)
        else:
            table.add_row(res.path, score_str, excerpt)

    console.print(table)


def render_symbols(symbols: Sequence[Symbol], *, title: str = "Symbols") -> None:
    table = Table(title=title)
    table.add_column("Name", style="green")
    table.add_column("Kind", style="yellow")
    table.add_column("Range", style="white", justify="right")

    for sym in symbols:
        start, end = sym.range
        table.add_row(sym.name, sym.kind, f"{start}-{end}")

    console.print(table)


def render_status(stats: Mapping[str, Any]) -> None:
    table = Table(title="Index Status")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="white")

    for key, value in stats.items():
        if isinstance(value, Mapping):
            value_text = ", ".join(f"{k}:{v}" for k, v in value.items())
        elif isinstance(value, (list, tuple)):
            value_text = ", ".join(str(v) for v in value)
        else:
            value_text = str(value)
        table.add_row(str(key), value_text)

    console.print(table)


def render_file_inspect(path: str, language: str, symbols: Iterable[Symbol]) -> None:
    header = Text.assemble(("File: ", "bold"), (path, "cyan"), ("  Language: ", "bold"), (language, "green"))
    console.print(header)
    render_symbols(list(symbols), title="Discovered Symbols")


def render_graph_results(results: list[dict[str, Any]], *, query_type: str, symbol: str) -> None:
    """Render semantic graph query results.

    Args:
        results: List of relationship dicts
        query_type: Type of query (callers, callees, inheritance)
        symbol: Symbol name that was queried
    """
    if not results:
        console.print(f"[yellow]No {query_type} found for symbol:[/yellow] {symbol}")
        return

    title_map = {
        "callers": f"Callers of '{symbol}' ({len(results)} found)",
        "callees": f"Callees of '{symbol}' ({len(results)} found)",
        "inheritance": f"Inheritance relationships for '{symbol}' ({len(results)} found)"
    }

    table = Table(title=title_map.get(query_type, f"Graph Results ({len(results)})"))

    if query_type == "callers":
        table.add_column("Caller", style="green")
        table.add_column("File", style="cyan", no_wrap=False, max_width=40)
        table.add_column("Line", justify="right", style="yellow")
        table.add_column("Type", style="dim")

        for rel in results:
            table.add_row(
                rel.get("source_symbol", "-"),
                rel.get("source_file", "-"),
                str(rel.get("source_line", "-")),
                rel.get("relationship_type", "-")
            )

    elif query_type == "callees":
        table.add_column("Target", style="green")
        table.add_column("File", style="cyan", no_wrap=False, max_width=40)
        table.add_column("Line", justify="right", style="yellow")
        table.add_column("Type", style="dim")

        for rel in results:
            table.add_row(
                rel.get("target_symbol", "-"),
                rel.get("target_file", "-") if rel.get("target_file") else rel.get("source_file", "-"),
                str(rel.get("source_line", "-")),
                rel.get("relationship_type", "-")
            )

    else:  # inheritance
        table.add_column("Derived Class", style="green")
        table.add_column("Base Class", style="magenta")
        table.add_column("File", style="cyan", no_wrap=False, max_width=40)
        table.add_column("Line", justify="right", style="yellow")

        for rel in results:
            table.add_row(
                rel.get("source_symbol", "-"),
                rel.get("target_symbol", "-"),
                rel.get("source_file", "-"),
                str(rel.get("source_line", "-"))
            )

    console.print(table)

