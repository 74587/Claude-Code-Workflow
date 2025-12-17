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
from codexlens.storage.dir_index import DirIndexStore
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
    force: bool = typer.Option(False, "--force", "-f", help="Force full reindex (skip incremental mode)."),
    no_embeddings: bool = typer.Option(False, "--no-embeddings", help="Skip automatic embedding generation (if semantic deps installed)."),
    embedding_model: str = typer.Option("code", "--embedding-model", help="Embedding model profile: fast, code, multilingual, balanced."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Initialize or rebuild the index for a directory.

    Indexes are stored in ~/.codexlens/indexes/ with mirrored directory structure.
    Set CODEXLENS_INDEX_DIR to customize the index location.

    By default, uses incremental indexing (skip unchanged files).
    Use --force to rebuild all files regardless of modification time.

    If semantic search dependencies are installed, automatically generates embeddings
    after indexing completes. Use --no-embeddings to skip this step.
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

        builder = IndexTreeBuilder(registry, mapper, config, incremental=not force)

        if force:
            console.print(f"[bold]Building index for:[/bold] {base_path} [yellow](FULL reindex)[/yellow]")
        else:
            console.print(f"[bold]Building index for:[/bold] {base_path} [dim](incremental)[/dim]")

        build_result = builder.build(
            source_root=base_path,
            languages=languages,
            workers=workers,
            force_full=force,
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

        # Auto-generate embeddings if semantic search is available
        if not no_embeddings:
            try:
                from codexlens.semantic import SEMANTIC_AVAILABLE
                from codexlens.cli.embedding_manager import generate_embeddings_recursive, get_embeddings_status

                if SEMANTIC_AVAILABLE:
                    # Use the index root directory (not the _index.db file)
                    index_root = Path(build_result.index_root)

                    if not json_mode:
                        console.print("\n[bold]Generating embeddings...[/bold]")
                        console.print(f"Model: [cyan]{embedding_model}[/cyan]")

                    # Progress callback for non-json mode
                    def progress_update(msg: str):
                        if not json_mode and verbose:
                            console.print(f"  {msg}")

                    embed_result = generate_embeddings_recursive(
                        index_root,
                        model_profile=embedding_model,
                        force=False,  # Don't force regenerate during init
                        chunk_size=2000,
                        progress_callback=progress_update if not json_mode else None,
                    )

                    if embed_result["success"]:
                        embed_data = embed_result["result"]
                        
                        # Get comprehensive coverage statistics
                        status_result = get_embeddings_status(index_root)
                        if status_result["success"]:
                            coverage = status_result["result"]
                            result["embeddings"] = {
                                "generated": True,
                                "total_indexes": coverage["total_indexes"],
                                "total_files": coverage["total_files"],
                                "files_with_embeddings": coverage["files_with_embeddings"],
                                "coverage_percent": coverage["coverage_percent"],
                                "total_chunks": coverage["total_chunks"],
                            }
                        else:
                            result["embeddings"] = {
                                "generated": True,
                                "total_chunks": embed_data["total_chunks_created"],
                                "files_processed": embed_data["total_files_processed"],
                            }

                        if not json_mode:
                            console.print(f"[green]✓[/green] Generated embeddings for [bold]{embed_data['total_files_processed']}[/bold] files")
                            console.print(f"  Total chunks: [bold]{embed_data['total_chunks_created']}[/bold]")
                            console.print(f"  Indexes processed: [bold]{embed_data['indexes_successful']}/{embed_data['indexes_processed']}[/bold]")
                    else:
                        if not json_mode:
                            console.print(f"[yellow]Warning:[/yellow] Embedding generation failed: {embed_result.get('error', 'Unknown error')}")
                        result["embeddings"] = {
                            "generated": False,
                            "error": embed_result.get("error"),
                        }
                else:
                    if not json_mode and verbose:
                        console.print("[dim]Semantic search not available. Skipping embeddings.[/dim]")
                    result["embeddings"] = {
                        "generated": False,
                        "error": "Semantic dependencies not installed",
                    }
            except Exception as e:
                if not json_mode and verbose:
                    console.print(f"[yellow]Warning:[/yellow] Could not generate embeddings: {e}")
                result["embeddings"] = {
                    "generated": False,
                    "error": str(e),
                }
        else:
            result["embeddings"] = {
                "generated": False,
                "error": "Skipped (--no-embeddings)",
            }

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
    mode: str = typer.Option("auto", "--mode", "-m", help="Search mode: auto, exact, fuzzy, hybrid, vector, pure-vector."),
    weights: Optional[str] = typer.Option(None, "--weights", help="Custom RRF weights as 'exact,fuzzy,vector' (e.g., '0.5,0.3,0.2')."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Search indexed file contents using SQLite FTS5 or semantic vectors.

    Uses chain search across directory indexes.
    Use --depth to limit search recursion (0 = current dir only).

    Search Modes:
      - auto: Auto-detect (hybrid if embeddings exist, exact otherwise) [default]
      - exact: Exact FTS using unicode61 tokenizer - for code identifiers
      - fuzzy: Fuzzy FTS using trigram tokenizer - for typo-tolerant search
      - hybrid: RRF fusion of exact + fuzzy + vector (recommended) - best recall
      - vector: Vector search with exact FTS fallback - semantic + keyword
      - pure-vector: Pure semantic vector search only - natural language queries

    Vector Search Requirements:
      Vector search modes require pre-generated embeddings.
      Use 'codexlens embeddings-generate' to create embeddings first.

    Hybrid Mode:
      Default weights: exact=0.4, fuzzy=0.3, vector=0.3
      Use --weights to customize (e.g., --weights 0.5,0.3,0.2)

    Examples:
      # Auto-detect mode (uses hybrid if embeddings available)
      codexlens search "authentication"

      # Explicit exact code search
      codexlens search "authenticate_user" --mode exact

      # Semantic search (requires embeddings)
      codexlens search "how to verify user credentials" --mode pure-vector

      # Force hybrid mode
      codexlens search "authentication" --mode hybrid
    """
    _configure_logging(verbose)
    search_path = path.expanduser().resolve()

    # Validate mode
    valid_modes = ["auto", "exact", "fuzzy", "hybrid", "vector", "pure-vector"]
    if mode not in valid_modes:
        if json_mode:
            print_json(success=False, error=f"Invalid mode: {mode}. Must be one of: {', '.join(valid_modes)}")
        else:
            console.print(f"[red]Invalid mode:[/red] {mode}")
            console.print(f"[dim]Valid modes: {', '.join(valid_modes)}[/dim]")
        raise typer.Exit(code=1)

    # Parse custom weights if provided
    hybrid_weights = None
    if weights:
        try:
            weight_parts = [float(w.strip()) for w in weights.split(",")]
            if len(weight_parts) == 3:
                weight_sum = sum(weight_parts)
                if abs(weight_sum - 1.0) > 0.01:
                    console.print(f"[yellow]Warning: Weights sum to {weight_sum:.2f}, should sum to 1.0. Normalizing...[/yellow]")
                    # Normalize weights
                    weight_parts = [w / weight_sum for w in weight_parts]
                hybrid_weights = {
                    "exact": weight_parts[0],
                    "fuzzy": weight_parts[1],
                    "vector": weight_parts[2],
                }
            else:
                console.print("[yellow]Warning: Invalid weights format (need 3 values). Using defaults.[/yellow]")
        except ValueError:
            console.print("[yellow]Warning: Invalid weights format. Using defaults.[/yellow]")

    registry: RegistryStore | None = None
    try:
        registry = RegistryStore()
        registry.initialize()
        mapper = PathMapper()

        engine = ChainSearchEngine(registry, mapper)

        # Auto-detect mode if set to "auto"
        actual_mode = mode
        if mode == "auto":
            # Check if embeddings are available by looking for project in registry
            project_record = registry.find_by_source_path(str(search_path))
            has_embeddings = False

            if project_record:
                # Check if index has embeddings
                index_path = Path(project_record["index_root"]) / "_index.db"
                try:
                    from codexlens.cli.embedding_manager import check_embeddings_status
                    embed_status = check_embeddings_status(index_path)
                    if embed_status["success"]:
                        embed_data = embed_status["result"]
                        has_embeddings = embed_data["has_embeddings"] and embed_data["chunks_count"] > 0
                except Exception:
                    pass

            # Choose mode based on embedding availability
            if has_embeddings:
                actual_mode = "hybrid"
                if not json_mode and verbose:
                    console.print("[dim]Auto-detected mode: hybrid (embeddings available)[/dim]")
            else:
                actual_mode = "exact"
                if not json_mode and verbose:
                    console.print("[dim]Auto-detected mode: exact (no embeddings)[/dim]")

        # Map mode to options
        if actual_mode == "exact":
            hybrid_mode, enable_fuzzy, enable_vector, pure_vector = False, False, False, False
        elif actual_mode == "fuzzy":
            hybrid_mode, enable_fuzzy, enable_vector, pure_vector = False, True, False, False
        elif actual_mode == "vector":
            hybrid_mode, enable_fuzzy, enable_vector, pure_vector = True, False, True, False  # Vector + exact fallback
        elif actual_mode == "pure-vector":
            hybrid_mode, enable_fuzzy, enable_vector, pure_vector = True, False, True, True  # Pure vector only
        elif actual_mode == "hybrid":
            hybrid_mode, enable_fuzzy, enable_vector, pure_vector = True, True, True, False
        else:
            raise ValueError(f"Invalid mode: {actual_mode}")

        options = SearchOptions(
            depth=depth,
            total_limit=limit,
            files_only=files_only,
            hybrid_mode=hybrid_mode,
            enable_fuzzy=enable_fuzzy,
            enable_vector=enable_vector,
            pure_vector=pure_vector,
            hybrid_weights=hybrid_weights,
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
                "mode": actual_mode,
                "count": len(result.results),
                "results": [
                    {
                        "path": r.path,
                        "score": r.score,
                        "excerpt": r.excerpt,
                        "source": getattr(r, "search_source", None),
                    }
                    for r in result.results
                ],
                "stats": {
                    "dirs_searched": result.stats.dirs_searched,
                    "files_matched": result.stats.files_matched,
                    "time_ms": result.stats.time_ms,
                },
            }
            if json_mode:
                print_json(success=True, result=payload)
            else:
                render_search_results(result.results, verbose=verbose)
                console.print(f"[dim]Mode: {actual_mode} | Searched {result.stats.dirs_searched} directories in {result.stats.time_ms:.1f}ms[/dim]")

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

        # Check schema version and enabled features
        schema_version = None
        has_dual_fts = False
        if projects and index_root.exists():
            # Check first index database for features
            index_files = list(index_root.rglob("_index.db"))
            if index_files:
                try:
                    with DirIndexStore(index_files[0]) as store:
                        with store._lock:
                            conn = store._get_connection()
                            schema_version = store._get_schema_version(conn)
                            # Check if dual FTS tables exist
                            cursor = conn.execute(
                                "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('search_fts_exact', 'search_fts_fuzzy')"
                            )
                            fts_tables = [row[0] for row in cursor.fetchall()]
                            has_dual_fts = len(fts_tables) == 2
                except Exception:
                    pass

        # Check embeddings coverage
        embeddings_info = None
        has_vector_search = False
        try:
            from codexlens.cli.embedding_manager import get_embeddings_status
            
            if index_root.exists():
                embed_status = get_embeddings_status(index_root)
                if embed_status["success"]:
                    embeddings_info = embed_status["result"]
                    # Enable vector search if coverage >= 50%
                    has_vector_search = embeddings_info["coverage_percent"] >= 50.0
        except ImportError:
            # Embedding manager not available
            pass
        except Exception as e:
            logger.debug(f"Failed to get embeddings status: {e}")

        stats = {
            "index_root": str(index_root),
            "registry_path": str(_get_registry_path()),
            "projects_count": len(projects),
            "total_files": total_files,
            "total_dirs": total_dirs,
            "index_size_bytes": index_size,
            "index_size_mb": round(index_size / (1024 * 1024), 2),
            "schema_version": schema_version,
            "features": {
                "exact_fts": True,  # Always available
                "fuzzy_fts": has_dual_fts,
                "hybrid_search": has_dual_fts,
                "vector_search": has_vector_search,
            },
        }
        
        # Add embeddings info if available
        if embeddings_info:
            stats["embeddings"] = embeddings_info

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
            if schema_version:
                console.print(f"  Schema Version: {schema_version}")
            console.print("\n[bold]Search Backends:[/bold]")
            console.print(f"  Exact FTS: ✓ (unicode61)")
            if has_dual_fts:
                console.print(f"  Fuzzy FTS: ✓ (trigram)")
                console.print(f"  Hybrid Search: ✓ (RRF fusion)")
            else:
                console.print(f"  Fuzzy FTS: ✗ (run 'migrate' to enable)")
                console.print(f"  Hybrid Search: ✗ (run 'migrate' to enable)")
            
            if has_vector_search:
                console.print(f"  Vector Search: ✓ (embeddings available)")
            else:
                console.print(f"  Vector Search: ✗ (no embeddings or coverage < 50%)")
            
            # Display embeddings statistics if available
            if embeddings_info:
                console.print("\n[bold]Embeddings Coverage:[/bold]")
                console.print(f"  Total Indexes: {embeddings_info['total_indexes']}")
                console.print(f"  Total Files: {embeddings_info['total_files']}")
                console.print(f"  Files with Embeddings: {embeddings_info['files_with_embeddings']}")
                console.print(f"  Coverage: {embeddings_info['coverage_percent']:.1f}%")
                console.print(f"  Total Chunks: {embeddings_info['total_chunks']}")

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
def migrate(
    path: Path = typer.Argument(Path("."), exists=True, file_okay=False, dir_okay=True, help="Project root to migrate."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Migrate project indexes to latest schema (Dual-FTS upgrade).

    Upgrades all _index.db files in the project to schema version 4, which includes:
    - Dual FTS tables (exact + fuzzy)
    - Encoding detection support
    - Incremental indexing metadata

    This is a safe operation that preserves all existing data.
    Progress is shown during migration.
    """
    _configure_logging(verbose)
    base_path = path.expanduser().resolve()

    registry: RegistryStore | None = None
    try:
        registry = RegistryStore()
        registry.initialize()
        mapper = PathMapper()

        # Find project
        project_info = registry.get_project(base_path)
        if not project_info:
            raise CodexLensError(f"No index found for: {base_path}. Run 'codex-lens init' first.")

        index_dir = mapper.source_to_index_dir(base_path)
        if not index_dir.exists():
            raise CodexLensError(f"Index directory not found: {index_dir}")

        # Find all _index.db files
        index_files = list(index_dir.rglob("_index.db"))

        if not index_files:
            if json_mode:
                print_json(success=True, result={"message": "No indexes to migrate", "migrated": 0})
            else:
                console.print("[yellow]No indexes found to migrate.[/yellow]")
            return

        migrated_count = 0
        error_count = 0
        already_migrated = 0

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
            TextColumn("({task.completed}/{task.total})"),
            TimeElapsedColumn(),
            console=console,
        ) as progress:
            task = progress.add_task(f"Migrating {len(index_files)} indexes...", total=len(index_files))

            for db_path in index_files:
                try:
                    store = DirIndexStore(db_path)

                    # Check current version
                    with store._lock:
                        conn = store._get_connection()
                        current_version = store._get_schema_version(conn)

                        if current_version >= DirIndexStore.SCHEMA_VERSION:
                            already_migrated += 1
                            if verbose:
                                progress.console.print(f"[dim]Already migrated: {db_path.parent.name}[/dim]")
                        elif current_version > 0:
                            # Apply migrations
                            store._apply_migrations(conn, current_version)
                            store._set_schema_version(conn, DirIndexStore.SCHEMA_VERSION)
                            conn.commit()
                            migrated_count += 1
                            if verbose:
                                progress.console.print(f"[green]Migrated: {db_path.parent.name} (v{current_version} → v{DirIndexStore.SCHEMA_VERSION})[/green]")
                        else:
                            # New database, initialize directly
                            store.initialize()
                            migrated_count += 1

                    store.close()

                except Exception as e:
                    error_count += 1
                    if verbose:
                        progress.console.print(f"[red]Error migrating {db_path}: {e}[/red]")

                progress.update(task, advance=1)

        result = {
            "path": str(base_path),
            "total_indexes": len(index_files),
            "migrated": migrated_count,
            "already_migrated": already_migrated,
            "errors": error_count,
        }

        if json_mode:
            print_json(success=True, result=result)
        else:
            console.print(f"[green]Migration complete:[/green]")
            console.print(f"  Total indexes: {len(index_files)}")
            console.print(f"  Migrated: {migrated_count}")
            console.print(f"  Already up-to-date: {already_migrated}")
            if error_count > 0:
                console.print(f"  [yellow]Errors: {error_count}[/yellow]")

    except StorageError as exc:
        if json_mode:
            print_json(success=False, error=f"Storage error: {exc}")
        else:
            console.print(f"[red]Migration failed (storage):[/red] {exc}")
            raise typer.Exit(code=1)
    except CodexLensError as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Migration failed:[/red] {exc}")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=f"Unexpected error: {exc}")
        else:
            console.print(f"[red]Migration failed (unexpected):[/red] {exc}")
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


@app.command()
def graph(
    query_type: str = typer.Argument(..., help="Query type: callers, callees, or inheritance"),
    symbol: str = typer.Argument(..., help="Symbol name to query"),
    path: Path = typer.Option(Path("."), "--path", "-p", help="Directory to search from."),
    limit: int = typer.Option(50, "--limit", "-n", min=1, max=500, help="Max results."),
    depth: int = typer.Option(-1, "--depth", "-d", help="Search depth (-1 = unlimited)."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable debug logging."),
) -> None:
    """Query semantic graph for code relationships.

    Supported query types:
    - callers: Find all functions/methods that call the given symbol
    - callees: Find all functions/methods called by the given symbol
    - inheritance: Find inheritance relationships for the given class

    Examples:
        codex-lens graph callers my_function
        codex-lens graph callees MyClass.method --path src/
        codex-lens graph inheritance BaseClass
    """
    _configure_logging(verbose)
    search_path = path.expanduser().resolve()

    # Validate query type
    valid_types = ["callers", "callees", "inheritance"]
    if query_type not in valid_types:
        if json_mode:
            print_json(success=False, error=f"Invalid query type: {query_type}. Must be one of: {', '.join(valid_types)}")
        else:
            console.print(f"[red]Invalid query type:[/red] {query_type}")
            console.print(f"[dim]Valid types: {', '.join(valid_types)}[/dim]")
            raise typer.Exit(code=1)

    registry: RegistryStore | None = None
    try:
        registry = RegistryStore()
        registry.initialize()
        mapper = PathMapper()

        engine = ChainSearchEngine(registry, mapper)
        options = SearchOptions(depth=depth, total_limit=limit)

        # Execute graph query based on type
        if query_type == "callers":
            results = engine.search_callers(symbol, search_path, options=options)
            result_type = "callers"
        elif query_type == "callees":
            results = engine.search_callees(symbol, search_path, options=options)
            result_type = "callees"
        else:  # inheritance
            results = engine.search_inheritance(symbol, search_path, options=options)
            result_type = "inheritance"

        payload = {
            "query_type": query_type,
            "symbol": symbol,
            "count": len(results),
            "relationships": results
        }

        if json_mode:
            print_json(success=True, result=payload)
        else:
            from .output import render_graph_results
            render_graph_results(results, query_type=query_type, symbol=symbol)

    except SearchError as exc:
        if json_mode:
            print_json(success=False, error=f"Graph search error: {exc}")
        else:
            console.print(f"[red]Graph query failed (search):[/red] {exc}")
            raise typer.Exit(code=1)
    except StorageError as exc:
        if json_mode:
            print_json(success=False, error=f"Storage error: {exc}")
        else:
            console.print(f"[red]Graph query failed (storage):[/red] {exc}")
            raise typer.Exit(code=1)
    except CodexLensError as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Graph query failed:[/red] {exc}")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=f"Unexpected error: {exc}")
        else:
            console.print(f"[red]Graph query failed (unexpected):[/red] {exc}")
            raise typer.Exit(code=1)
    finally:
        if registry is not None:
            registry.close()


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

        project_info = registry.get_project(base_path)
        if not project_info:
            raise CodexLensError(f"No index found for: {base_path}. Run 'codex-lens init' first.")

        index_dir = Path(project_info.index_root)
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


# ==================== Model Management Commands ====================

@app.command(name="model-list")
def model_list(
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
) -> None:
    """List available embedding models and their installation status.

    Shows 4 model profiles (fast, code, multilingual, balanced) with:
    - Installation status
    - Model size and dimensions
    - Use case recommendations
    """
    try:
        from codexlens.cli.model_manager import list_models

        result = list_models()

        if json_mode:
            print_json(**result)
        else:
            if not result["success"]:
                console.print(f"[red]Error:[/red] {result.get('error', 'Unknown error')}")
                raise typer.Exit(code=1)

            data = result["result"]
            models = data["models"]
            cache_dir = data["cache_dir"]
            cache_exists = data["cache_exists"]

            console.print("[bold]Available Embedding Models:[/bold]")
            console.print(f"Cache directory: [dim]{cache_dir}[/dim] {'(exists)' if cache_exists else '(not found)'}\n")

            table = Table(show_header=True, header_style="bold")
            table.add_column("Profile", style="cyan")
            table.add_column("Model Name", style="blue")
            table.add_column("Dims", justify="right")
            table.add_column("Size (MB)", justify="right")
            table.add_column("Status", justify="center")
            table.add_column("Use Case", style="dim")

            for model in models:
                status_icon = "[green]✓[/green]" if model["installed"] else "[dim]—[/dim]"
                size_display = (
                    f"{model['actual_size_mb']:.1f}" if model["installed"]
                    else f"~{model['estimated_size_mb']}"
                )
                table.add_row(
                    model["profile"],
                    model["model_name"],
                    str(model["dimensions"]),
                    size_display,
                    status_icon,
                    model["use_case"][:40] + "..." if len(model["use_case"]) > 40 else model["use_case"],
                )

            console.print(table)
            console.print("\n[dim]Use 'codexlens model-download <profile>' to download a model[/dim]")

    except ImportError:
        if json_mode:
            print_json(success=False, error="fastembed not installed. Install with: pip install codexlens[semantic]")
        else:
            console.print("[red]Error:[/red] fastembed not installed")
            console.print("[yellow]Install with:[/yellow] pip install codexlens[semantic]")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Model-list failed:[/red] {exc}")
            raise typer.Exit(code=1)


@app.command(name="model-download")
def model_download(
    profile: str = typer.Argument(..., help="Model profile to download (fast, code, multilingual, balanced)."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
) -> None:
    """Download an embedding model by profile name.

    Example:
        codexlens model-download code  # Download code-optimized model
    """
    try:
        from codexlens.cli.model_manager import download_model

        if not json_mode:
            console.print(f"[bold]Downloading model:[/bold] {profile}")
            console.print("[dim]This may take a few minutes depending on your internet connection...[/dim]\n")

        # Create progress callback for non-JSON mode
        progress_callback = None if json_mode else lambda msg: console.print(f"[cyan]{msg}[/cyan]")

        result = download_model(profile, progress_callback=progress_callback)

        if json_mode:
            print_json(**result)
        else:
            if not result["success"]:
                console.print(f"[red]Error:[/red] {result.get('error', 'Unknown error')}")
                raise typer.Exit(code=1)

            data = result["result"]
            console.print(f"[green]✓[/green] Model downloaded successfully!")
            console.print(f"  Profile: {data['profile']}")
            console.print(f"  Model: {data['model_name']}")
            console.print(f"  Cache size: {data['cache_size_mb']:.1f} MB")
            console.print(f"  Location: [dim]{data['cache_path']}[/dim]")

    except ImportError:
        if json_mode:
            print_json(success=False, error="fastembed not installed. Install with: pip install codexlens[semantic]")
        else:
            console.print("[red]Error:[/red] fastembed not installed")
            console.print("[yellow]Install with:[/yellow] pip install codexlens[semantic]")
            raise typer.Exit(code=1)
    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Model-download failed:[/red] {exc}")
            raise typer.Exit(code=1)


@app.command(name="model-delete")
def model_delete(
    profile: str = typer.Argument(..., help="Model profile to delete (fast, code, multilingual, balanced)."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
) -> None:
    """Delete a downloaded embedding model from cache.

    Example:
        codexlens model-delete fast  # Delete fast model
    """
    try:
        from codexlens.cli.model_manager import delete_model

        if not json_mode:
            console.print(f"[bold yellow]Deleting model:[/bold yellow] {profile}")

        result = delete_model(profile)

        if json_mode:
            print_json(**result)
        else:
            if not result["success"]:
                console.print(f"[red]Error:[/red] {result.get('error', 'Unknown error')}")
                raise typer.Exit(code=1)

            data = result["result"]
            console.print(f"[green]✓[/green] Model deleted successfully!")
            console.print(f"  Profile: {data['profile']}")
            console.print(f"  Model: {data['model_name']}")
            console.print(f"  Freed space: {data['deleted_size_mb']:.1f} MB")

    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Model-delete failed:[/red] {exc}")
            raise typer.Exit(code=1)


@app.command(name="model-info")
def model_info(
    profile: str = typer.Argument(..., help="Model profile to get info (fast, code, multilingual, balanced)."),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
) -> None:
    """Get detailed information about a model profile.

    Example:
        codexlens model-info code  # Get code model details
    """
    try:
        from codexlens.cli.model_manager import get_model_info

        result = get_model_info(profile)

        if json_mode:
            print_json(**result)
        else:
            if not result["success"]:
                console.print(f"[red]Error:[/red] {result.get('error', 'Unknown error')}")
                raise typer.Exit(code=1)

            data = result["result"]
            console.print(f"[bold]Model Profile:[/bold] {data['profile']}")
            console.print(f"  Model name: {data['model_name']}")
            console.print(f"  Dimensions: {data['dimensions']}")
            console.print(f"  Status: {'[green]Installed[/green]' if data['installed'] else '[dim]Not installed[/dim]'}")
            if data['installed'] and data['actual_size_mb']:
                console.print(f"  Cache size: {data['actual_size_mb']:.1f} MB")
                console.print(f"  Location: [dim]{data['cache_path']}[/dim]")
            else:
                console.print(f"  Estimated size: ~{data['estimated_size_mb']} MB")
            console.print(f"\n  Description: {data['description']}")
            console.print(f"  Use case: {data['use_case']}")

    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Model-info failed:[/red] {exc}")
            raise typer.Exit(code=1)


# ==================== Embedding Management Commands ====================

@app.command(name="embeddings-status")
def embeddings_status(
    path: Optional[Path] = typer.Argument(
        None,
        exists=True,
        help="Path to specific _index.db file or directory containing indexes. If not specified, uses default index root.",
    ),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
) -> None:
    """Check embedding status for one or all indexes.

    Shows embedding statistics including:
    - Number of chunks generated
    - File coverage percentage
    - Files missing embeddings

    Examples:
        codexlens embeddings-status                                    # Check all indexes
        codexlens embeddings-status ~/.codexlens/indexes/project/_index.db  # Check specific index
        codexlens embeddings-status ~/projects/my-app                  # Check project (auto-finds index)
    """
    try:
        from codexlens.cli.embedding_manager import check_index_embeddings, get_embedding_stats_summary

        # Determine what to check
        if path is None:
            # Check all indexes in default root
            index_root = _get_index_root()
            result = get_embedding_stats_summary(index_root)

            if json_mode:
                print_json(**result)
            else:
                if not result["success"]:
                    console.print(f"[red]Error:[/red] {result.get('error', 'Unknown error')}")
                    raise typer.Exit(code=1)

                data = result["result"]
                total = data["total_indexes"]
                with_emb = data["indexes_with_embeddings"]
                total_chunks = data["total_chunks"]

                console.print(f"[bold]Embedding Status Summary[/bold]")
                console.print(f"Index root: [dim]{index_root}[/dim]\n")
                console.print(f"Total indexes: {total}")
                console.print(f"Indexes with embeddings: [{'green' if with_emb > 0 else 'yellow'}]{with_emb}[/]/{total}")
                console.print(f"Total chunks: {total_chunks:,}\n")

                if data["indexes"]:
                    table = Table(show_header=True, header_style="bold")
                    table.add_column("Project", style="cyan")
                    table.add_column("Files", justify="right")
                    table.add_column("Chunks", justify="right")
                    table.add_column("Coverage", justify="right")
                    table.add_column("Status", justify="center")

                    for idx_stat in data["indexes"]:
                        status_icon = "[green]✓[/green]" if idx_stat["has_embeddings"] else "[dim]—[/dim]"
                        coverage = f"{idx_stat['coverage_percent']:.1f}%" if idx_stat["has_embeddings"] else "—"

                        table.add_row(
                            idx_stat["project"],
                            str(idx_stat["total_files"]),
                            f"{idx_stat['total_chunks']:,}" if idx_stat["has_embeddings"] else "0",
                            coverage,
                            status_icon,
                        )

                    console.print(table)

        else:
            # Check specific index or find index for project
            target_path = path.expanduser().resolve()

            if target_path.is_file() and target_path.name == "_index.db":
                # Direct index file
                index_path = target_path
            elif target_path.is_dir():
                # Try to find index for this project
                registry = RegistryStore()
                try:
                    registry.initialize()
                    mapper = PathMapper()
                    index_path = mapper.source_to_index_db(target_path)

                    if not index_path.exists():
                        console.print(f"[red]Error:[/red] No index found for {target_path}")
                        console.print("Run 'codexlens init' first to create an index")
                        raise typer.Exit(code=1)
                finally:
                    registry.close()
            else:
                console.print(f"[red]Error:[/red] Path must be _index.db file or directory")
                raise typer.Exit(code=1)

            result = check_index_embeddings(index_path)

            if json_mode:
                print_json(**result)
            else:
                if not result["success"]:
                    console.print(f"[red]Error:[/red] {result.get('error', 'Unknown error')}")
                    raise typer.Exit(code=1)

                data = result["result"]
                has_emb = data["has_embeddings"]

                console.print(f"[bold]Embedding Status[/bold]")
                console.print(f"Index: [dim]{data['index_path']}[/dim]\n")

                if has_emb:
                    console.print(f"[green]✓[/green] Embeddings available")
                    console.print(f"  Total chunks: {data['total_chunks']:,}")
                    console.print(f"  Total files: {data['total_files']:,}")
                    console.print(f"  Files with embeddings: {data['files_with_chunks']:,}/{data['total_files']}")
                    console.print(f"  Coverage: {data['coverage_percent']:.1f}%")

                    if data["files_without_chunks"] > 0:
                        console.print(f"\n[yellow]Warning:[/yellow] {data['files_without_chunks']} files missing embeddings")
                        if data["missing_files_sample"]:
                            console.print("  Sample missing files:")
                            for file in data["missing_files_sample"]:
                                console.print(f"    [dim]{file}[/dim]")
                else:
                    console.print(f"[yellow]—[/yellow] No embeddings found")
                    console.print(f"  Total files indexed: {data['total_files']:,}")
                    console.print("\n[dim]Generate embeddings with:[/dim]")
                    console.print(f"  [cyan]codexlens embeddings-generate {index_path}[/cyan]")

    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Embeddings-status failed:[/red] {exc}")
            raise typer.Exit(code=1)


@app.command(name="embeddings-generate")
def embeddings_generate(
    path: Path = typer.Argument(
        ...,
        exists=True,
        help="Path to _index.db file or project directory.",
    ),
    model: str = typer.Option(
        "code",
        "--model",
        "-m",
        help="Model profile: fast, code, multilingual, balanced.",
    ),
    force: bool = typer.Option(
        False,
        "--force",
        "-f",
        help="Force regeneration even if embeddings exist.",
    ),
    chunk_size: int = typer.Option(
        2000,
        "--chunk-size",
        help="Maximum chunk size in characters.",
    ),
    recursive: bool = typer.Option(
        False,
        "--recursive",
        "-r",
        help="Recursively process all _index.db files in directory tree.",
    ),
    json_mode: bool = typer.Option(False, "--json", help="Output JSON response."),
    verbose: bool = typer.Option(False, "--verbose", "-v", help="Enable verbose output."),
) -> None:
    """Generate semantic embeddings for code search.

    Creates vector embeddings for all files in an index to enable
    semantic search capabilities. Embeddings are stored in the same
    database as the FTS index.

    Model Profiles:
      - fast: BAAI/bge-small-en-v1.5 (384 dims, ~80MB)
      - code: jinaai/jina-embeddings-v2-base-code (768 dims, ~150MB) [recommended]
      - multilingual: intfloat/multilingual-e5-large (1024 dims, ~1GB)
      - balanced: mixedbread-ai/mxbai-embed-large-v1 (1024 dims, ~600MB)

    Examples:
        codexlens embeddings-generate ~/projects/my-app              # Auto-find index for project
        codexlens embeddings-generate ~/.codexlens/indexes/project/_index.db  # Specific index
        codexlens embeddings-generate ~/projects/my-app --model fast --force  # Regenerate with fast model
    """
    _configure_logging(verbose)

    try:
        from codexlens.cli.embedding_manager import generate_embeddings, generate_embeddings_recursive

        # Resolve path
        target_path = path.expanduser().resolve()

        # Determine if we should use recursive mode
        use_recursive = False
        index_path = None
        index_root = None

        if target_path.is_file() and target_path.name == "_index.db":
            # Direct index file
            index_path = target_path
            if recursive:
                # Use parent directory for recursive processing
                use_recursive = True
                index_root = target_path.parent
        elif target_path.is_dir():
            if recursive:
                # Recursive mode: process all _index.db files in directory tree
                use_recursive = True
                index_root = target_path
            else:
                # Non-recursive: Try to find index for this project
                registry = RegistryStore()
                try:
                    registry.initialize()
                    mapper = PathMapper()
                    index_path = mapper.source_to_index_db(target_path)

                    if not index_path.exists():
                        console.print(f"[red]Error:[/red] No index found for {target_path}")
                        console.print("Run 'codexlens init' first to create an index")
                        raise typer.Exit(code=1)
                finally:
                    registry.close()
        else:
            console.print(f"[red]Error:[/red] Path must be _index.db file or directory")
            raise typer.Exit(code=1)

        # Progress callback
        def progress_update(msg: str):
            if not json_mode and verbose:
                console.print(f"  {msg}")

        console.print(f"[bold]Generating embeddings[/bold]")
        if use_recursive:
            console.print(f"Index root: [dim]{index_root}[/dim]")
            console.print(f"Mode: [yellow]Recursive[/yellow]")
        else:
            console.print(f"Index: [dim]{index_path}[/dim]")
        console.print(f"Model: [cyan]{model}[/cyan]\n")

        if use_recursive:
            result = generate_embeddings_recursive(
                index_root,
                model_profile=model,
                force=force,
                chunk_size=chunk_size,
                progress_callback=progress_update,
            )
        else:
            result = generate_embeddings(
                index_path,
                model_profile=model,
                force=force,
                chunk_size=chunk_size,
                progress_callback=progress_update,
            )

        if json_mode:
            print_json(**result)
        else:
            if not result["success"]:
                error_msg = result.get("error", "Unknown error")
                console.print(f"[red]Error:[/red] {error_msg}")

                # Provide helpful hints
                if "already has" in error_msg:
                    console.print("\n[dim]Use --force to regenerate existing embeddings[/dim]")
                elif "Semantic search not available" in error_msg:
                    console.print("\n[dim]Install semantic dependencies:[/dim]")
                    console.print("  [cyan]pip install codexlens[semantic][/cyan]")

                raise typer.Exit(code=1)

            data = result["result"]

            if use_recursive:
                # Recursive mode output
                console.print(f"[green]✓[/green] Recursive embeddings generation complete!")
                console.print(f"  Indexes processed: {data['indexes_processed']}")
                console.print(f"  Indexes successful: {data['indexes_successful']}")
                if data['indexes_failed'] > 0:
                    console.print(f"  [yellow]Indexes failed: {data['indexes_failed']}[/yellow]")
                console.print(f"  Total chunks created: {data['total_chunks_created']:,}")
                console.print(f"  Total files processed: {data['total_files_processed']}")
                if data['total_files_failed'] > 0:
                    console.print(f"  [yellow]Total files failed: {data['total_files_failed']}[/yellow]")
                console.print(f"  Model profile: {data['model_profile']}")

                # Show details if verbose
                if verbose and data.get('details'):
                    console.print("\n[dim]Index details:[/dim]")
                    for detail in data['details']:
                        status_icon = "[green]✓[/green]" if detail['success'] else "[red]✗[/red]"
                        console.print(f"  {status_icon} {detail['path']}")
                        if not detail['success'] and detail.get('error'):
                            console.print(f"    [dim]Error: {detail['error']}[/dim]")
            else:
                # Single index mode output
                elapsed = data["elapsed_time"]

                console.print(f"[green]✓[/green] Embeddings generated successfully!")
                console.print(f"  Model: {data['model_name']}")
                console.print(f"  Chunks created: {data['chunks_created']:,}")
                console.print(f"  Files processed: {data['files_processed']}")

                if data["files_failed"] > 0:
                    console.print(f"  [yellow]Files failed: {data['files_failed']}[/yellow]")
                    if data["failed_files"]:
                        console.print("  [dim]First failures:[/dim]")
                        for file_path, error in data["failed_files"]:
                            console.print(f"    [dim]{file_path}: {error}[/dim]")

                console.print(f"  Time: {elapsed:.1f}s")

            console.print("\n[dim]Use vector search with:[/dim]")
            console.print("  [cyan]codexlens search 'your query' --mode pure-vector[/cyan]")

    except Exception as exc:
        if json_mode:
            print_json(success=False, error=str(exc))
        else:
            console.print(f"[red]Embeddings-generate failed:[/red] {exc}")
            raise typer.Exit(code=1)
