"""Typer commands for CodexLens."""

from __future__ import annotations

import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

import typer
from rich.progress import BarColumn, Progress, SpinnerColumn, TextColumn, TimeElapsedColumn
from rich.table import Table

from codexlens.config import Config
from codexlens.entities import IndexedFile, SearchResult, Symbol
from codexlens.errors import CodexLensError, ConfigError, ParseError, StorageError, SearchError
from codexlens.parsers.factory import ParserFactory
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore, ProjectInfo
from codexlens.storage.index_tree import IndexTreeBuilder
from codexlens.search.chain_search import ChainSearchEngine, SearchOptions

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


def _get_index_root() -> Path:
    """Get the index root directory from config or default."""
    env_override = os.getenv("CODEXLENS_INDEX_DIR")
    if env_override:
        return Path(env_override).expanduser().resolve()
    return Path.home() / ".codexlens" / "indexes"


def _get_registry_path() -> Path:
    """Get the registry database path."""
    env_override = os.getenv("CODEXLENS_DATA_DIR")
    if env_override:
        return Path(env_override).expanduser().resolve() / "registry.db"
    return Path.home() / ".codexlens" / "registry.db"


@app.command()
def init(
    path: Path = typer.Argument(Path("."), exists=True, file_okay=False, dir_okay=True, help="Project root to index."),
    language: Optional[List[str]] = typer.Option(
        None,
        "--language",
        "-l",
        help="Limit indexing to specific languages (repeat or comma-separated).",
    ),
    workers: int = typer.Option(4, "--workers", "-w", min=1, max=16, help="Parallel worker processes."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Initialize or rebuild the index for a directory.

    Indexes are stored in ~/.codexlens/indexes/ with mirrored directory structure.
    Set CODEXLENS_INDEX_DIR to customize the index location.
    """
    _configure_logging(verbose)
    config = Config()
    languages = _parse_languages(language)
    base_path = path.expanduser().resolve()

    registry: RegistryStore | None = None
    try:
        registry = RegistryStore()
        registry.initialize()
        mapper = PathMapper()

        builder = IndexTreeBuilder(registry, mapper, config)

        console.print(f"[bold]Building index for:[/bold] {base_path}")

        build_result = builder.build(
            source_root=base_path,
            languages=languages,
            workers=workers,
        )

        result = {
            "path": str(base_path),
            "files_indexed": build_result.total_files,
            "dirs_indexed": build_result.total_dirs,
            "index_root": str(build_result.index_root),
            "project_id": build_result.project_id,
            "languages": languages or sorted(config.supported_languages.keys()),
            "errors": len(build_result.errors),
        }

        if json_mode:
            print_json(success=True, result=result)
        else:
            console.print(f"[green]OK[/green] Indexed [bold]{build_result.total_files}[/bold] files in [bold]{build_result.total_dirs}[/bold] directories")
            console.print(f"  Index root: {build_result.index_root}")
            if build_result.errors:
                console.print(f"  [yellow]Warnings:[/yellow] {len(build_result.errors)} errors")

    except StorageError as exc:
        if json_mode:
            print_json(success=False, error=f"Storage error: {exc}")
        else:
            console.print(f"[red]Init failed (storage):[/red] {exc}")
            raise typer.Exit(code=1)
    except ConfigError as exc:
        if json_mode:
            print_json(success=False, error=f"Configuration error: {exc}")
        else:
            console.print(f"[red]Init failed (config):[/red] {exc}")
            raise typer.Exit(code=1)
    except ParseError as exc:
        if json_mode:
            print_json(success=False, error=f"Parse error: {exc}")
        else:
            console.print(f"[red]Init failed (parse):[/red] {exc}")
            raise typer.Exit(code=1)
    except PermissionError as exc:
        if json_mode:
            print_json(success=False, error=f"Permission denied: {exc}")
        else:
            console.print(f"[red]Init failed (permission denied):[/red] {exc}")
            raise typer.Exit(code=1)
    except CodexLensError as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Init failed:[/red] {exc}")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=f"Unexpected error: {exc}")
        else:
            console.print(f"[red]Init failed (unexpected):[/red] {exc}")
            raise typer.Exit(code=1)
    finally:
        if registry is not None:
            registry.close()


@app.command()
def search(
    query: str = typer.Argument(..., help="FTS query to run."),
    path: Path = typer.Option(Path("."), "--path", "-p", help="Directory to search from."),
    limit: int = typer.Option(20, "--limit", "-n", min=1, max=500, help="Max results."),
    depth: int = typer.Option(-1, "--depth", "-d", help="Search depth (-1 = unlimited, 0 = current only)."),
    files_only: bool = typer.Option(False, "--files-only", "-f", help="Return only file paths without content snippets."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Search indexed file contents using SQLite FTS5.

    Uses chain search across directory indexes.
    Use --depth to limit search recursion (0 = current dir only).
    """
    _configure_logging(verbose)
    search_path = path.expanduser().resolve()

    registry: RegistryStore | None = None
    try:
        registry = RegistryStore()
        registry.initialize()
        mapper = PathMapper()

        engine = ChainSearchEngine(registry, mapper)
        options = SearchOptions(
            depth=depth,
            total_limit=limit,
            files_only=files_only,
        )

        if files_only:
            file_paths = engine.search_files_only(query, search_path, options)
            payload = {"query": query, "count": len(file_paths), "files": file_paths}
            if json_mode:
                print_json(success=True, result=payload)
            else:
                for fp in file_paths:
                    console.print(fp)
        else:
            result = engine.search(query, search_path, options)
            payload = {
                "query": query,
                "count": len(result.results),
                "results": [{"path": r.path, "score": r.score, "excerpt": r.excerpt} for r in result.results],
                "stats": {
                    "dirs_searched": result.stats.dirs_searched,
                    "files_matched": result.stats.files_matched,
                    "time_ms": result.stats.time_ms,
                },
            }
            if json_mode:
                print_json(success=True, result=payload)
            else:
                render_search_results(result.results)
                if verbose:
                    console.print(f"[dim]Searched {result.stats.dirs_searched} directories in {result.stats.time_ms:.1f}ms[/dim]")

    except SearchError as exc:
        if json_mode:
            print_json(success=False, error=f"Search error: {exc}")
        else:
            console.print(f"[red]Search failed (query):[/red] {exc}")
            raise typer.Exit(code=1)
    except StorageError as exc:
        if json_mode:
            print_json(success=False, error=f"Storage error: {exc}")
        else:
            console.print(f"[red]Search failed (storage):[/red] {exc}")
            raise typer.Exit(code=1)
    except CodexLensError as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Search failed:[/red] {exc}")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=f"Unexpected error: {exc}")
        else:
            console.print(f"[red]Search failed (unexpected):[/red] {exc}")
            raise typer.Exit(code=1)
    finally:
        if registry is not None:
            registry.close()


@app.command()
def symbol(
    name: str = typer.Argument(..., help="Symbol name to look up."),
    path: Path = typer.Option(Path("."), "--path", "-p", help="Directory to search from."),
    kind: Optional[str] = typer.Option(
        None,
        "--kind",
        "-k",
        help="Filter by kind (function|class|method).",
    ),
    limit: int = typer.Option(50, "--limit", "-n", min=1, max=500, help="Max symbols."),
    depth: int = typer.Option(-1, "--depth", "-d", help="Search depth (-1 = unlimited)."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Look up symbols by name and optional kind."""
    _configure_logging(verbose)
    search_path = path.expanduser().resolve()

    registry: RegistryStore | None = None
    try:
        registry = RegistryStore()
        registry.initialize()
        mapper = PathMapper()

        engine = ChainSearchEngine(registry, mapper)
        options = SearchOptions(depth=depth, total_limit=limit)

        syms = engine.search_symbols(name, search_path, kind=kind, options=options)

        payload = {"name": name, "kind": kind, "count": len(syms), "symbols": syms}
        if json_mode:
            print_json(success=True, result=payload)
        else:
            render_symbols(syms)

    except SearchError as exc:
        if json_mode:
            print_json(success=False, error=f"Search error: {exc}")
        else:
            console.print(f"[red]Symbol lookup failed (search):[/red] {exc}")
            raise typer.Exit(code=1)
    except StorageError as exc:
        if json_mode:
            print_json(success=False, error=f"Storage error: {exc}")
        else:
            console.print(f"[red]Symbol lookup failed (storage):[/red] {exc}")
            raise typer.Exit(code=1)
    except CodexLensError as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Symbol lookup failed:[/red] {exc}")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=f"Unexpected error: {exc}")
        else:
            console.print(f"[red]Symbol lookup failed (unexpected):[/red] {exc}")
            raise typer.Exit(code=1)
    finally:
        if registry is not None:
            registry.close()


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
    except ParseError as exc:
        if json_mode:
            print_json(success=False, error=f"Parse error: {exc}")
        else:
            console.print(f"[red]Inspect failed (parse):[/red] {exc}")
            raise typer.Exit(code=1)
    except FileNotFoundError as exc:
        if json_mode:
            print_json(success=False, error=f"File not found: {exc}")
        else:
            console.print(f"[red]Inspect failed (file not found):[/red] {exc}")
            raise typer.Exit(code=1)
    except PermissionError as exc:
        if json_mode:
            print_json(success=False, error=f"Permission denied: {exc}")
        else:
            console.print(f"[red]Inspect failed (permission denied):[/red] {exc}")
            raise typer.Exit(code=1)
    except CodexLensError as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Inspect failed:[/red] {exc}")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=f"Unexpected error: {exc}")
        else:
            console.print(f"[red]Inspect failed (unexpected):[/red] {exc}")
            raise typer.Exit(code=1)


@app.command()
def status(
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Show index status and configuration."""
    _configure_logging(verbose)

    registry: RegistryStore | None = None
    try:
        registry = RegistryStore()
        registry.initialize()
        mapper = PathMapper()

        # Get all projects
        projects = registry.list_projects()

        # Calculate total stats
        total_files = sum(p.total_files for p in projects)
        total_dirs = sum(p.total_dirs for p in projects)

        # Get index root size
        index_root = mapper.index_root
        index_size = 0
        if index_root.exists():
            for f in index_root.rglob("*"):
                if f.is_file():
                    index_size += f.stat().st_size

        stats = {
            "index_root": str(index_root),
            "registry_path": str(_get_registry_path()),
            "projects_count": len(projects),
            "total_files": total_files,
            "total_dirs": total_dirs,
            "index_size_bytes": index_size,
            "index_size_mb": round(index_size / (1024 * 1024), 2),
        }

        if json_mode:
            print_json(success=True, result=stats)
        else:
            console.print("[bold]CodexLens Status[/bold]")
            console.print(f"  Index Root: {stats['index_root']}")
            console.print(f"  Registry: {stats['registry_path']}")
            console.print(f"  Projects: {stats['projects_count']}")
            console.print(f"  Total Files: {stats['total_files']}")
            console.print(f"  Total Directories: {stats['total_dirs']}")
            console.print(f"  Index Size: {stats['index_size_mb']} MB")

    except StorageError as exc:
        if json_mode:
            print_json(success=False, error=f"Storage error: {exc}")
        else:
            console.print(f"[red]Status failed (storage):[/red] {exc}")
            raise typer.Exit(code=1)
    except CodexLensError as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Status failed:[/red] {exc}")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=f"Unexpected error: {exc}")
        else:
            console.print(f"[red]Status failed (unexpected):[/red] {exc}")
            raise typer.Exit(code=1)
    finally:
        if registry is not None:
            registry.close()


@app.command()
def projects(
    action: str = typer.Argument("list", help="Action: list, show, remove"),
    project_path: Optional[Path] = typer.Argument(None, help="Project path (for show/remove)."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Manage registered projects in the global registry.

    Actions:
    - list: Show all registered projects
    - show <path>: Show details for a specific project
    - remove <path>: Remove a project from the registry
    """
    _configure_logging(verbose)

    registry: RegistryStore | None = None
    try:
        registry = RegistryStore()
        registry.initialize()

        if action == "list":
            project_list = registry.list_projects()
            if json_mode:
                result = [
                    {
                        "id": p.id,
                        "source_root": str(p.source_root),
                        "index_root": str(p.index_root),
                        "total_files": p.total_files,
                        "total_dirs": p.total_dirs,
                        "status": p.status,
                    }
                    for p in project_list
                ]
                print_json(success=True, result=result)
            else:
                if not project_list:
                    console.print("[yellow]No projects registered.[/yellow]")
                else:
                    table = Table(title="Registered Projects")
                    table.add_column("ID", style="dim")
                    table.add_column("Source Root")
                    table.add_column("Files", justify="right")
                    table.add_column("Dirs", justify="right")
                    table.add_column("Status")

                    for p in project_list:
                        table.add_row(
                            str(p.id),
                            str(p.source_root),
                            str(p.total_files),
                            str(p.total_dirs),
                            p.status,
                        )
                    console.print(table)

        elif action == "show":
            if not project_path:
                raise typer.BadParameter("Project path required for 'show' action")

            project_path = project_path.expanduser().resolve()
            project_info = registry.get_project(project_path)

            if not project_info:
                if json_mode:
                    print_json(success=False, error=f"Project not found: {project_path}")
                else:
                    console.print(f"[red]Project not found:[/red] {project_path}")
                raise typer.Exit(code=1)

            if json_mode:
                result = {
                    "id": project_info.id,
                    "source_root": str(project_info.source_root),
                    "index_root": str(project_info.index_root),
                    "total_files": project_info.total_files,
                    "total_dirs": project_info.total_dirs,
                    "status": project_info.status,
                    "created_at": project_info.created_at,
                    "last_indexed": project_info.last_indexed,
                }
                print_json(success=True, result=result)
            else:
                console.print(f"[bold]Project:[/bold] {project_info.source_root}")
                console.print(f"  ID: {project_info.id}")
                console.print(f"  Index Root: {project_info.index_root}")
                console.print(f"  Files: {project_info.total_files}")
                console.print(f"  Directories: {project_info.total_dirs}")
                console.print(f"  Status: {project_info.status}")

                # Show directory breakdown
                dirs = registry.get_project_dirs(project_info.id)
                if dirs:
                    console.print(f"\n  [bold]Indexed Directories:[/bold] {len(dirs)}")
                    for d in dirs[:10]:
                        console.print(f"    - {d.source_path.name}/ ({d.files_count} files)")
                    if len(dirs) > 10:
                        console.print(f"    ... and {len(dirs) - 10} more")

        elif action == "remove":
            if not project_path:
                raise typer.BadParameter("Project path required for 'remove' action")

            project_path = project_path.expanduser().resolve()
            removed = registry.unregister_project(project_path)

            if removed:
                mapper = PathMapper()
                index_root = mapper.source_to_index_dir(project_path)
                if index_root.exists():
                    shutil.rmtree(index_root)

                if json_mode:
                    print_json(success=True, result={"removed": str(project_path)})
                else:
                    console.print(f"[green]Removed:[/green] {project_path}")
            else:
                if json_mode:
                    print_json(success=False, error=f"Project not found: {project_path}")
                else:
                    console.print(f"[yellow]Project not found:[/yellow] {project_path}")

        else:
            raise typer.BadParameter(f"Unknown action: {action}. Use list, show, or remove.")

    except typer.BadParameter:
        raise
    except StorageError as exc:
        if json_mode:
            print_json(success=False, error=f"Storage error: {exc}")
        else:
            console.print(f"[red]Projects command failed (storage):[/red] {exc}")
            raise typer.Exit(code=1)
    except PermissionError as exc:
        if json_mode:
            print_json(success=False, error=f"Permission denied: {exc}")
        else:
            console.print(f"[red]Projects command failed (permission denied):[/red] {exc}")
            raise typer.Exit(code=1)
    except CodexLensError as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Projects command failed:[/red] {exc}")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=f"Unexpected error: {exc}")
        else:
            console.print(f"[red]Projects command failed (unexpected):[/red] {exc}")
            raise typer.Exit(code=1)
    finally:
        if registry is not None:
            registry.close()


@app.command()
def config(
    action: str = typer.Argument("show", help="Action: show, set, migrate"),
    key: Optional[str] = typer.Argument(None, help="Config key (for set action)."),
    value: Optional[str] = typer.Argument(None, help="Config value (for set action)."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Manage CodexLens configuration.

    Actions:
    - show: Display current configuration
    - set <key> <value>: Set configuration value
    - migrate <new_path>: Migrate indexes to new location

    Config keys:
    - index_dir: Directory to store indexes (default: ~/.codexlens/indexes)
    """
    _configure_logging(verbose)

    config_file = Path.home() / ".codexlens" / "config.json"

    def load_config() -> Dict[str, Any]:
        if config_file.exists():
            return json.loads(config_file.read_text(encoding="utf-8"))
        return {}

    def save_config(cfg: Dict[str, Any]) -> None:
        config_file.parent.mkdir(parents=True, exist_ok=True)
        config_file.write_text(json.dumps(cfg, indent=2), encoding="utf-8")

    try:
        if action == "show":
            cfg = load_config()
            current_index_dir = os.getenv("CODEXLENS_INDEX_DIR") or cfg.get("index_dir") or str(Path.home() / ".codexlens" / "indexes")

            result = {
                "config_file": str(config_file),
                "index_dir": current_index_dir,
                "env_override": os.getenv("CODEXLENS_INDEX_DIR"),
            }

            if json_mode:
                print_json(success=True, result=result)
            else:
                console.print("[bold]CodexLens Configuration[/bold]")
                console.print(f"  Config File: {result['config_file']}")
                console.print(f"  Index Directory: {result['index_dir']}")
                if result['env_override']:
                    console.print(f"  [dim](Override via CODEXLENS_INDEX_DIR)[/dim]")

        elif action == "set":
            if not key:
                raise typer.BadParameter("Config key required for 'set' action")
            if not value:
                raise typer.BadParameter("Config value required for 'set' action")

            cfg = load_config()

            if key == "index_dir":
                new_path = Path(value).expanduser().resolve()
                cfg["index_dir"] = str(new_path)
                save_config(cfg)

                if json_mode:
                    print_json(success=True, result={"key": key, "value": str(new_path)})
                else:
                    console.print(f"[green]Set {key}=[/green] {new_path}")
                    console.print("[yellow]Note: Existing indexes remain at old location. Use 'config migrate' to move them.[/yellow]")
            else:
                raise typer.BadParameter(f"Unknown config key: {key}")

        elif action == "migrate":
            if not key:
                raise typer.BadParameter("New path required for 'migrate' action")

            new_path = Path(key).expanduser().resolve()
            mapper = PathMapper()
            old_path = mapper.index_root

            if not old_path.exists():
                if json_mode:
                    print_json(success=False, error="No indexes to migrate")
                else:
                    console.print("[yellow]No indexes to migrate.[/yellow]")
                return

            # Create new directory
            new_path.mkdir(parents=True, exist_ok=True)

            # Count items to migrate
            items = list(old_path.iterdir())
            migrated = 0

            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("{task.completed}/{task.total}"),
                TimeElapsedColumn(),
                console=console,
            ) as progress:
                task = progress.add_task("Migrating indexes", total=len(items))

                for item in items:
                    dest = new_path / item.name
                    if item.is_dir():
                        shutil.copytree(item, dest, dirs_exist_ok=True)
                    else:
                        shutil.copy2(item, dest)
                    migrated += 1
                    progress.advance(task)

            # Update config
            cfg = load_config()
            cfg["index_dir"] = str(new_path)
            save_config(cfg)

            # Update registry paths
            registry = RegistryStore()
            registry.initialize()
            registry.update_index_paths(old_path, new_path)
            registry.close()

            result = {
                "migrated_from": str(old_path),
                "migrated_to": str(new_path),
                "items_migrated": migrated,
            }

            if json_mode:
                print_json(success=True, result=result)
            else:
                console.print(f"[green]Migrated {migrated} items to:[/green] {new_path}")
                console.print("[dim]Old indexes can be manually deleted after verifying migration.[/dim]")

        else:
            raise typer.BadParameter(f"Unknown action: {action}. Use show, set, or migrate.")

    except typer.BadParameter:
        raise
    except ConfigError as exc:
        if json_mode:
            print_json(success=False, error=f"Configuration error: {exc}")
        else:
            console.print(f"[red]Config command failed (config):[/red] {exc}")
            raise typer.Exit(code=1)
    except StorageError as exc:
        if json_mode:
            print_json(success=False, error=f"Storage error: {exc}")
        else:
            console.print(f"[red]Config command failed (storage):[/red] {exc}")
            raise typer.Exit(code=1)
    except PermissionError as exc:
        if json_mode:
            print_json(success=False, error=f"Permission denied: {exc}")
        else:
            console.print(f"[red]Config command failed (permission denied):[/red] {exc}")
            raise typer.Exit(code=1)
    except CodexLensError as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Config command failed:[/red] {exc}")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=f"Unexpected error: {exc}")
        else:
            console.print(f"[red]Config command failed (unexpected):[/red] {exc}")
            raise typer.Exit(code=1)




@app.command()
def enhance(
    path: Path = typer.Argument(Path("."), exists=True, file_okay=False, dir_okay=True, help="Project root to enhance."),
    tool: str = typer.Option("gemini", "--tool", "-t", help="LLM tool to use (gemini or qwen)."),
    batch_size: int = typer.Option(5, "--batch-size", "-b", min=1, max=20, help="Number of files to process per batch."),
    force: bool = typer.Option(False, "--force", "-f", help="Regenerate metadata for all files, even if already exists."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Generate LLM-enhanced semantic metadata for indexed files.

    Uses CCW CLI to generate summaries, keywords, and purpose descriptions.
    Requires ccw to be installed and accessible in PATH.
    """
    _configure_logging(verbose)
    base_path = path.expanduser().resolve()

    registry: RegistryStore | None = None
    try:
        # Check if ccw is available
        import subprocess
        try:
            subprocess.run(["ccw", "--version"], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            raise CodexLensError("ccw CLI not found. Please install ccw first.")

        # Validate tool
        if tool not in ("gemini", "qwen"):
            raise CodexLensError(f"Invalid tool: {tool}. Must be 'gemini' or 'qwen'.")

        registry = RegistryStore()
        registry.initialize()
        mapper = PathMapper()

        # Find project
        project_info = registry.find_project(base_path)
        if not project_info:
            raise CodexLensError(f"No index found for: {base_path}. Run 'codex-lens init' first.")

        # Import LLM enhancer
        try:
            from codexlens.semantic.llm_enhancer import LLMEnhancer, LLMConfig
        except ImportError as e:
            raise CodexLensError(f"Semantic enhancement requires additional dependencies: {e}")

        # Create enhancer with config
        config = LLMConfig(tool=tool, batch_size=batch_size)
        enhancer = LLMEnhancer(config=config)

        # Get index directory
        index_dir = mapper.source_to_index_dir(base_path)
        if not index_dir.exists():
            raise CodexLensError(f"Index directory not found: {index_dir}")

        # Process all index databases recursively
        from codexlens.storage.dir_index import DirIndexStore
        from pathlib import Path

        total_processed = 0
        total_errors = 0

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TimeElapsedColumn(),
            console=console,
        ) as progress:
            # Find all _index.db files
            index_files = list(index_dir.rglob("_index.db"))
            task = progress.add_task(f"Enhancing {len(index_files)} directories...", total=len(index_files))

            for db_path in index_files:
                try:
                    store = DirIndexStore(db_path)
                    store.initialize()

                    # Get files to process
                    if force:
                        files_to_process = store.list_files()
                    else:
                        files_to_process = store.get_files_without_semantic()

                    if not files_to_process:
                        progress.update(task, advance=1)
                        continue

                    # Process files
                    for file_entry in files_to_process:
                        try:
                            # Read file content
                            with open(file_entry.full_path, "r", encoding="utf-8", errors="ignore") as f:
                                content = f.read()

                            # Generate metadata
                            metadata = enhancer.enhance_file(
                                path=str(file_entry.full_path),
                                content=content,
                                language=file_entry.language or "unknown"
                            )

                            # Store metadata
                            store.add_semantic_metadata(
                                file_id=file_entry.id,
                                summary=metadata.summary,
                                keywords=metadata.keywords,
                                purpose=metadata.purpose,
                                llm_tool=tool
                            )

                            total_processed += 1

                        except Exception as e:
                            total_errors += 1
                            if verbose:
                                console.print(f"[yellow]Error processing {file_entry.full_path}: {e}[/yellow]")

                    store.close()

                except Exception as e:
                    total_errors += 1
                    if verbose:
                        console.print(f"[yellow]Error processing {db_path}: {e}[/yellow]")

                progress.update(task, advance=1)

        result = {
            "path": str(base_path),
            "tool": tool,
            "files_processed": total_processed,
            "errors": total_errors,
        }

        if json_mode:
            print_json(success=True, result=result)
        else:
            console.print(f"[green]Enhanced {total_processed} files using {tool}[/green]")
            if total_errors > 0:
                console.print(f"  [yellow]Errors: {total_errors}[/yellow]")

    except StorageError as exc:
        if json_mode:
            print_json(success=False, error=f"Storage error: {exc}")
        else:
            console.print(f"[red]Enhancement failed (storage):[/red] {exc}")
            raise typer.Exit(code=1)
    except PermissionError as exc:
        if json_mode:
            print_json(success=False, error=f"Permission denied: {exc}")
        else:
            console.print(f"[red]Enhancement failed (permission denied):[/red] {exc}")
            raise typer.Exit(code=1)
    except CodexLensError as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Enhancement failed:[/red] {exc}")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=f"Unexpected error: {exc}")
        else:
            console.print(f"[red]Enhancement failed (unexpected):[/red] {exc}")
            raise typer.Exit(code=1)
    finally:
        if registry is not None:
            registry.close()

@app.command()
def clean(
    path: Optional[Path] = typer.Argument(None, help="Project path to clean (removes project index)."),
    all_indexes: bool = typer.Option(False, "--all", "-a", help="Remove all indexes."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Remove CodexLens index data.

    Without arguments, shows current index size.
    With path, removes that project's indexes.
    With --all, removes all indexes (use with caution).
    """
    _configure_logging(verbose)

    try:
        mapper = PathMapper()
        index_root = mapper.index_root

        if all_indexes:
            # Remove everything
            if not index_root.exists():
                if json_mode:
                    print_json(success=True, result={"cleaned": None, "message": "No indexes to clean"})
                else:
                    console.print("[yellow]No indexes to clean.[/yellow]")
                return

            # Calculate size before removal
            total_size = 0
            for f in index_root.rglob("*"):
                if f.is_file():
                    total_size += f.stat().st_size

            # Remove registry first
            registry_path = _get_registry_path()
            if registry_path.exists():
                registry_path.unlink()

            # Remove all indexes
            shutil.rmtree(index_root)

            result = {
                "cleaned": str(index_root),
                "size_freed_mb": round(total_size / (1024 * 1024), 2),
            }

            if json_mode:
                print_json(success=True, result=result)
            else:
                console.print(f"[green]Removed all indexes:[/green] {result['size_freed_mb']} MB freed")

        elif path:
            # Remove specific project
            project_path = path.expanduser().resolve()
            project_index = mapper.source_to_index_dir(project_path)

            if not project_index.exists():
                if json_mode:
                    print_json(success=False, error=f"No index found for: {project_path}")
                else:
                    console.print(f"[yellow]No index found for:[/yellow] {project_path}")
                return

            # Calculate size
            total_size = 0
            for f in project_index.rglob("*"):
                if f.is_file():
                    total_size += f.stat().st_size

            # Remove from registry
            registry = RegistryStore()
            registry.initialize()
            registry.unregister_project(project_path)
            registry.close()

            # Remove indexes
            shutil.rmtree(project_index)

            result = {
                "cleaned": str(project_path),
                "index_path": str(project_index),
                "size_freed_mb": round(total_size / (1024 * 1024), 2),
            }

            if json_mode:
                print_json(success=True, result=result)
            else:
                console.print(f"[green]Removed indexes for:[/green] {project_path}")
                console.print(f"  Freed: {result['size_freed_mb']} MB")

        else:
            # Show current status
            if not index_root.exists():
                if json_mode:
                    print_json(success=True, result={"index_root": str(index_root), "exists": False})
                else:
                    console.print("[yellow]No indexes found.[/yellow]")
                return

            total_size = 0
            for f in index_root.rglob("*"):
                if f.is_file():
                    total_size += f.stat().st_size

            registry = RegistryStore()
            registry.initialize()
            projects = registry.list_projects()
            registry.close()

            result = {
                "index_root": str(index_root),
                "projects_count": len(projects),
                "total_size_mb": round(total_size / (1024 * 1024), 2),
            }

            if json_mode:
                print_json(success=True, result=result)
            else:
                console.print("[bold]Index Status[/bold]")
                console.print(f"  Location: {result['index_root']}")
                console.print(f"  Projects: {result['projects_count']}")
                console.print(f"  Total Size: {result['total_size_mb']} MB")
                console.print("\n[dim]Use 'clean <path>' to remove a specific project or 'clean --all' to remove everything.[/dim]")

    except StorageError as exc:
        if json_mode:
            print_json(success=False, error=f"Storage error: {exc}")
        else:
            console.print(f"[red]Clean failed (storage):[/red] {exc}")
            raise typer.Exit(code=1)
    except PermissionError as exc:
        if json_mode:
            print_json(success=False, error=f"Permission denied: {exc}")
        else:
            console.print(f"[red]Clean failed (permission denied):[/red] {exc}")
            raise typer.Exit(code=1)
    except CodexLensError as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Clean failed:[/red] {exc}")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=f"Unexpected error: {exc}")
        else:
            console.print(f"[red]Clean failed (unexpected):[/red] {exc}")
            raise typer.Exit(code=1)


@app.command("semantic-list")
def semantic_list(
    path: Path = typer.Option(Path("."), "--path", "-p", help="Project path to list metadata from."),
    offset: int = typer.Option(0, "--offset", "-o", min=0, help="Number of records to skip."),
    limit: int = typer.Option(50, "--limit", "-n", min=1, max=100, help="Maximum records to return."),
    tool_filter: Optional[str] = typer.Option(None, "--tool", "-t", help="Filter by LLM tool (gemini/qwen)."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """List semantic metadata entries for indexed files.

    Shows files that have LLM-generated summaries and keywords.
    Results are aggregated from all index databases in the project.
    """
    _configure_logging(verbose)
    base_path = path.expanduser().resolve()

    registry: Optional[RegistryStore] = None
    try:
        registry = RegistryStore()
        registry.initialize()
        mapper = PathMapper()

        project_info = registry.find_project(base_path)
        if not project_info:
            raise CodexLensError(f"No index found for: {base_path}. Run 'codex-lens init' first.")

        index_dir = mapper.source_to_index_dir(base_path)
        if not index_dir.exists():
            raise CodexLensError(f"Index directory not found: {index_dir}")

        all_results: list = []
        total_count = 0

        index_files = sorted(index_dir.rglob("_index.db"))

        for db_path in index_files:
            try:
                store = DirIndexStore(db_path)
                store.initialize()

                results, count = store.list_semantic_metadata(
                    offset=0,
                    limit=1000,
                    llm_tool=tool_filter,
                )

                source_dir = mapper.index_to_source(db_path.parent)
                for r in results:
                    r["source_dir"] = str(source_dir)

                all_results.extend(results)
                total_count += count

                store.close()
            except Exception as e:
                if verbose:
                    console.print(f"[yellow]Warning: Error reading {db_path}: {e}[/yellow]")

        all_results.sort(key=lambda x: x["generated_at"], reverse=True)
        paginated = all_results[offset : offset + limit]

        result = {
            "path": str(base_path),
            "total": total_count,
            "offset": offset,
            "limit": limit,
            "count": len(paginated),
            "entries": paginated,
        }

        if json_mode:
            print_json(success=True, result=result)
        else:
            if not paginated:
                console.print("[yellow]No semantic metadata found.[/yellow]")
                console.print("Run 'codex-lens enhance' to generate metadata for indexed files.")
            else:
                table = Table(title=f"Semantic Metadata ({total_count} total)")
                table.add_column("File", style="cyan", max_width=40)
                table.add_column("Language", style="dim")
                table.add_column("Purpose", max_width=30)
                table.add_column("Keywords", max_width=25)
                table.add_column("Tool")

                for entry in paginated:
                    keywords_str = ", ".join(entry["keywords"][:3])
                    if len(entry["keywords"]) > 3:
                        keywords_str += f" (+{len(entry['keywords']) - 3})"

                    table.add_row(
                        entry["file_name"],
                        entry["language"] or "-",
                        (entry["purpose"] or "-")[:30],
                        keywords_str or "-",
                        entry["llm_tool"] or "-",
                    )

                console.print(table)

                if total_count > len(paginated):
                    console.print(
                        f"[dim]Showing {offset + 1}-{offset + len(paginated)} of {total_count}. "
                        "Use --offset and --limit for pagination.[/dim]"
                    )

    except StorageError as exc:
        if json_mode:
            print_json(success=False, error=f"Storage error: {exc}")
        else:
            console.print(f"[red]Semantic-list failed (storage):[/red] {exc}")
            raise typer.Exit(code=1)
    except CodexLensError as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Semantic-list failed:[/red] {exc}")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=f"Unexpected error: {exc}")
        else:
            console.print(f"[red]Semantic-list failed (unexpected):[/red] {exc}")
            raise typer.Exit(code=1)
    finally:
        if registry is not None:
            registry.close()
