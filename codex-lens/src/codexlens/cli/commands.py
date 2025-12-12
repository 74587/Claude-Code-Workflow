"""Typer commands for CodexLens."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import typer
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn

from codexlens.config import Config, WorkspaceConfig, find_workspace_root
from codexlens.entities import IndexedFile, SearchResult, Symbol
from codexlens.errors import CodexLensError
from codexlens.parsers.factory import ParserFactory
from codexlens.storage.sqlite_store import SQLiteStore

from .output import (
    console,
    print_json,
    render_file_inspect,
    render_search_results,
    render_status,
    render_symbols,
)

app = typer.Typer(help="CodexLens CLI — local code indexing and search.")


def _configure_logging(verbose: bool) -> None:
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(level=level, format="%(levelname)s %(message)s")


def _parse_languages(raw: Optional[List[str]]) -> Optional[List[str]]:
    if not raw:
        return None
    langs: List[str] = []
    for item in raw:
        for part in item.split(","):
            part = part.strip()
            if part:
                langs.append(part)
    return langs or None


def _load_gitignore(base_path: Path) -> List[str]:
    gitignore = base_path / ".gitignore"
    if not gitignore.exists():
        return []
    try:
        return [line.strip() for line in gitignore.read_text(encoding="utf-8").splitlines() if line.strip()]
    except OSError:
        return []


def _iter_source_files(
    base_path: Path,
    config: Config,
    languages: Optional[List[str]] = None,
) -> Iterable[Path]:
    ignore_dirs = {".git", ".venv", "venv", "node_modules", "__pycache__", ".codexlens"}
    ignore_patterns = _load_gitignore(base_path)
    pathspec = None
    if ignore_patterns:
        try:
            from pathspec import PathSpec
            from pathspec.patterns.gitwildmatch import GitWildMatchPattern

            pathspec = PathSpec.from_lines(GitWildMatchPattern, ignore_patterns)
        except Exception:
            pathspec = None

    for root, dirs, files in os.walk(base_path):
        dirs[:] = [d for d in dirs if d not in ignore_dirs and not d.startswith(".")]
        root_path = Path(root)
        for file in files:
            if file.startswith("."):
                continue
            full_path = root_path / file
            rel = full_path.relative_to(base_path)
            if pathspec and pathspec.match_file(str(rel)):
                continue
            language_id = config.language_for_path(full_path)
            if not language_id:
                continue
            if languages and language_id not in languages:
                continue
            yield full_path


def _get_store_for_path(path: Path, use_global: bool = False) -> tuple[SQLiteStore, Path]:
    """Get SQLiteStore for a path, using workspace-local or global database.

    Returns (store, db_path) tuple.
    """
    if use_global:
        config = Config()
        config.ensure_runtime_dirs()
        return SQLiteStore(config.db_path), config.db_path

    # Try to find existing workspace
    workspace = WorkspaceConfig.from_path(path)
    if workspace:
        return SQLiteStore(workspace.db_path), workspace.db_path

    # Fall back to global config
    config = Config()
    config.ensure_runtime_dirs()
    return SQLiteStore(config.db_path), config.db_path


@app.command()
def init(
    path: Path = typer.Argument(Path("."), exists=True, file_okay=False, dir_okay=True, help="Project root to index."),
    language: Optional[List[str]] = typer.Option(
        None,
        "--language",
        "-l",
        help="Limit indexing to specific languages (repeat or comma-separated).",
    ),
    use_global: bool = typer.Option(False, "--global", "-g", help="Use global database instead of workspace-local."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Initialize or rebuild the index for a directory.

    Creates a .codexlens/ directory in the project root to store index data.
    Use --global to use the global database at ~/.codexlens/ instead.
    """
    _configure_logging(verbose)
    config = Config()
    factory = ParserFactory(config)

    languages = _parse_languages(language)
    base_path = path.expanduser().resolve()

    store: SQLiteStore | None = None
    try:
        # Determine database location
        if use_global:
            config.ensure_runtime_dirs()
            db_path = config.db_path
            workspace_root = None
        else:
            # Create workspace-local .codexlens directory
            workspace = WorkspaceConfig.create_at(base_path)
            db_path = workspace.db_path
            workspace_root = workspace.workspace_root

        store = SQLiteStore(db_path)
        store.initialize()

        files = list(_iter_source_files(base_path, config, languages))
        indexed_count = 0
        symbol_count = 0

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("{task.completed}/{task.total} files"),
            TimeElapsedColumn(),
            console=console,
        ) as progress:
            task = progress.add_task("Indexing", total=len(files))
            for file_path in files:
                progress.advance(task)
                try:
                    text = file_path.read_text(encoding="utf-8", errors="ignore")
                    lang_id = config.language_for_path(file_path) or "unknown"
                    parser = factory.get_parser(lang_id)
                    indexed_file = parser.parse(text, file_path)
                    store.add_file(indexed_file, text)
                    indexed_count += 1
                    symbol_count += len(indexed_file.symbols)
                except Exception as exc:
                    logging.debug("Failed to index %s: %s", file_path, exc)
                    continue

        result = {
            "path": str(base_path),
            "files_indexed": indexed_count,
            "symbols_indexed": symbol_count,
            "languages": languages or sorted(config.supported_languages.keys()),
            "db_path": str(db_path),
            "workspace_root": str(workspace_root) if workspace_root else None,
        }

        if json_mode:
            print_json(success=True, result=result)
        else:
            render_status(result)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            raise typer.Exit(code=1)
    finally:
        if store is not None:
            store.close()


@app.command()
def search(
    query: str = typer.Argument(..., help="FTS query to run."),
    limit: int = typer.Option(20, "--limit", "-n", min=1, max=500, help="Max results."),
    use_global: bool = typer.Option(False, "--global", "-g", help="Use global database instead of workspace-local."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Search indexed file contents using SQLite FTS5.

    Searches the workspace-local .codexlens/index.db by default.
    Use --global to search the global database at ~/.codexlens/.
    """
    _configure_logging(verbose)

    store: SQLiteStore | None = None
    try:
        store, db_path = _get_store_for_path(Path.cwd(), use_global)
        store.initialize()
        results = store.search_fts(query, limit=limit)
        payload = {"query": query, "count": len(results), "results": results}
        if json_mode:
            print_json(success=True, result=payload)
        else:
            render_search_results(results)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Search failed:[/red] {exc}")
            raise typer.Exit(code=1)
    finally:
        if store is not None:
            store.close()


@app.command()
def symbol(
    name: str = typer.Argument(..., help="Symbol name to look up."),
    kind: Optional[str] = typer.Option(
        None,
        "--kind",
        "-k",
        help="Filter by kind (function|class|method).",
    ),
    limit: int = typer.Option(50, "--limit", "-n", min=1, max=500, help="Max symbols."),
    use_global: bool = typer.Option(False, "--global", "-g", help="Use global database instead of workspace-local."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Look up symbols by name and optional kind.

    Searches the workspace-local .codexlens/index.db by default.
    Use --global to search the global database at ~/.codexlens/.
    """
    _configure_logging(verbose)

    store: SQLiteStore | None = None
    try:
        store, db_path = _get_store_for_path(Path.cwd(), use_global)
        store.initialize()
        syms = store.search_symbols(name, kind=kind, limit=limit)
        payload = {"name": name, "kind": kind, "count": len(syms), "symbols": syms}
        if json_mode:
            print_json(success=True, result=payload)
        else:
            render_symbols(syms)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Symbol lookup failed:[/red] {exc}")
            raise typer.Exit(code=1)
    finally:
        if store is not None:
            store.close()


@app.command()
def inspect(
    file: Path = typer.Argument(..., exists=True, dir_okay=False, help="File to analyze."),
    symbols: bool = typer.Option(True, "--symbols/--no-symbols", help="Show discovered symbols."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Analyze a single file and display symbols."""
    _configure_logging(verbose)
    config = Config()
    factory = ParserFactory(config)

    file_path = file.expanduser().resolve()
    try:
        text = file_path.read_text(encoding="utf-8", errors="ignore")
        language_id = config.language_for_path(file_path) or "unknown"
        parser = factory.get_parser(language_id)
        indexed = parser.parse(text, file_path)
        payload = {"file": indexed, "content_lines": len(text.splitlines())}
        if json_mode:
            print_json(success=True, result=payload)
        else:
            if symbols:
                render_file_inspect(indexed.path, indexed.language, indexed.symbols)
            else:
                render_status({"file": indexed.path, "language": indexed.language})
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Inspect failed:[/red] {exc}")
            raise typer.Exit(code=1)


@app.command()
def status(
    use_global: bool = typer.Option(False, "--global", "-g", help="Use global database instead of workspace-local."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Show index statistics.

    Shows statistics for the workspace-local .codexlens/index.db by default.
    Use --global to show the global database at ~/.codexlens/.
    """
    _configure_logging(verbose)

    store: SQLiteStore | None = None
    try:
        store, db_path = _get_store_for_path(Path.cwd(), use_global)
        store.initialize()
        stats = store.stats()
        if json_mode:
            print_json(success=True, result=stats)
        else:
            render_status(stats)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Status failed:[/red] {exc}")
            raise typer.Exit(code=1)
    finally:
        if store is not None:
            store.close()


@app.command()
def update(
    files: List[str] = typer.Argument(..., help="File paths to update in the index."),
    use_global: bool = typer.Option(False, "--global", "-g", help="Use global database instead of workspace-local."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Incrementally update specific files in the index.

    Pass one or more file paths to update. Files that no longer exist
    will be removed from the index. New or modified files will be re-indexed.

    This is much faster than re-running init for large codebases when
    only a few files have changed.
    """
    _configure_logging(verbose)
    config = Config()
    factory = ParserFactory(config)

    store: SQLiteStore | None = None
    try:
        store, db_path = _get_store_for_path(Path.cwd(), use_global)
        store.initialize()

        updated = 0
        removed = 0
        skipped = 0
        errors = []

        for file_str in files:
            file_path = Path(file_str).resolve()

            # Check if file exists on disk
            if not file_path.exists():
                # File was deleted - remove from index
                if store.remove_file(file_path):
                    removed += 1
                    logging.debug("Removed deleted file: %s", file_path)
                else:
                    skipped += 1
                    logging.debug("File not in index: %s", file_path)
                continue

            # Check if file is supported
            language_id = config.language_for_path(file_path)
            if not language_id:
                skipped += 1
                logging.debug("Unsupported file type: %s", file_path)
                continue

            # Check if file needs update (compare mtime)
            current_mtime = file_path.stat().st_mtime
            stored_mtime = store.get_file_mtime(file_path)

            if stored_mtime is not None and abs(current_mtime - stored_mtime) < 0.001:
                skipped += 1
                logging.debug("File unchanged: %s", file_path)
                continue

            # Re-index the file
            try:
                text = file_path.read_text(encoding="utf-8", errors="ignore")
                parser = factory.get_parser(language_id)
                indexed_file = parser.parse(text, file_path)
                store.add_file(indexed_file, text)
                updated += 1
                logging.debug("Updated file: %s", file_path)
            except Exception as exc:
                errors.append({"file": str(file_path), "error": str(exc)})
                logging.debug("Failed to update %s: %s", file_path, exc)

        result = {
            "updated": updated,
            "removed": removed,
            "skipped": skipped,
            "errors": errors,
            "db_path": str(db_path),
        }

        if json_mode:
            print_json(success=True, result=result)
        else:
            console.print(f"[green]Updated:[/green] {updated} files")
            console.print(f"[yellow]Removed:[/yellow] {removed} files")
            console.print(f"[dim]Skipped:[/dim] {skipped} files")
            if errors:
                console.print(f"[red]Errors:[/red] {len(errors)}")
                for err in errors[:5]:
                    console.print(f"  - {err['file']}: {err['error']}")

    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Update failed:[/red] {exc}")
            raise typer.Exit(code=1)
    finally:
        if store is not None:
            store.close()


@app.command()
def clean(
    path: Path = typer.Argument(Path("."), exists=True, file_okay=False, dir_okay=True, help="Project root to clean."),
    use_global: bool = typer.Option(False, "--global", "-g", help="Clean global database instead of workspace-local."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Remove CodexLens index data.

    Removes the .codexlens/ directory from the project root.
    Use --global to clean the global database at ~/.codexlens/.
    """
    _configure_logging(verbose)
    base_path = path.expanduser().resolve()

    try:
        if use_global:
            config = Config()
            import shutil
            if config.index_dir.exists():
                shutil.rmtree(config.index_dir)
            result = {"cleaned": str(config.index_dir), "type": "global"}
        else:
            workspace = WorkspaceConfig.from_path(base_path)
            if workspace and workspace.codexlens_dir.exists():
                import shutil
                shutil.rmtree(workspace.codexlens_dir)
                result = {"cleaned": str(workspace.codexlens_dir), "type": "workspace"}
            else:
                result = {"cleaned": None, "type": "workspace", "message": "No workspace found"}

        if json_mode:
            print_json(success=True, result=result)
        else:
            if result.get("cleaned"):
                console.print(f"[green]Cleaned:[/green] {result['cleaned']}")
            else:
                console.print("[yellow]No workspace index found to clean.[/yellow]")
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Clean failed:[/red] {exc}")
            raise typer.Exit(code=1)
