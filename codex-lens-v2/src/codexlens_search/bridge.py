"""CLI bridge for ccw integration.

Argparse-based CLI with JSON output protocol.
Each subcommand outputs a single JSON object to stdout.
Watch command outputs JSONL (one JSON per line).
All errors are JSON {"error": string} to stdout with non-zero exit code.
"""
from __future__ import annotations

import argparse
import glob
import json
import logging
import os
import sys
import time
from pathlib import Path

log = logging.getLogger("codexlens_search.bridge")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _json_output(data: dict | list) -> None:
    """Print JSON to stdout with flush."""
    print(json.dumps(data, ensure_ascii=False), flush=True)


def _error_exit(message: str, code: int = 1) -> None:
    """Print JSON error to stdout and exit."""
    _json_output({"error": message})
    sys.exit(code)


def _resolve_db_path(args: argparse.Namespace) -> Path:
    """Return the --db-path as a resolved Path, creating parent dirs."""
    db_path = Path(args.db_path).resolve()
    db_path.mkdir(parents=True, exist_ok=True)
    return db_path


def _create_config(args: argparse.Namespace) -> "Config":
    """Build Config from CLI args."""
    from codexlens_search.config import Config

    kwargs: dict = {}
    if hasattr(args, "embed_model") and args.embed_model:
        kwargs["embed_model"] = args.embed_model
    db_path = Path(args.db_path).resolve()
    kwargs["metadata_db_path"] = str(db_path / "metadata.db")
    return Config(**kwargs)


def _create_pipeline(
    args: argparse.Namespace,
) -> tuple:
    """Lazily construct pipeline components from CLI args.

    Returns (indexing_pipeline, search_pipeline, config).
    Only loads embedder/reranker models when needed.
    """
    from codexlens_search.config import Config
    from codexlens_search.core.factory import create_ann_index, create_binary_index
    from codexlens_search.embed.local import FastEmbedEmbedder
    from codexlens_search.indexing.metadata import MetadataStore
    from codexlens_search.indexing.pipeline import IndexingPipeline
    from codexlens_search.rerank.local import FastEmbedReranker
    from codexlens_search.search.fts import FTSEngine
    from codexlens_search.search.pipeline import SearchPipeline

    config = _create_config(args)
    db_path = _resolve_db_path(args)

    embedder = FastEmbedEmbedder(config)
    binary_store = create_binary_index(db_path, config.embed_dim, config)
    ann_index = create_ann_index(db_path, config.embed_dim, config)
    fts = FTSEngine(db_path / "fts.db")
    metadata = MetadataStore(db_path / "metadata.db")
    reranker = FastEmbedReranker(config)

    indexing = IndexingPipeline(
        embedder=embedder,
        binary_store=binary_store,
        ann_index=ann_index,
        fts=fts,
        config=config,
        metadata=metadata,
    )

    search = SearchPipeline(
        embedder=embedder,
        binary_store=binary_store,
        ann_index=ann_index,
        reranker=reranker,
        fts=fts,
        config=config,
        metadata_store=metadata,
    )

    return indexing, search, config


# ---------------------------------------------------------------------------
# Subcommand handlers
# ---------------------------------------------------------------------------

def cmd_init(args: argparse.Namespace) -> None:
    """Initialize an empty index at --db-path."""
    from codexlens_search.indexing.metadata import MetadataStore
    from codexlens_search.search.fts import FTSEngine

    db_path = _resolve_db_path(args)

    # Create empty stores - just touch the metadata and FTS databases
    MetadataStore(db_path / "metadata.db")
    FTSEngine(db_path / "fts.db")

    _json_output({
        "status": "initialized",
        "db_path": str(db_path),
    })


def cmd_search(args: argparse.Namespace) -> None:
    """Run search query, output JSON array of results."""
    _, search, _ = _create_pipeline(args)

    results = search.search(args.query, top_k=args.top_k)
    _json_output([
        {
            "path": r.path,
            "score": r.score,
            "line": r.line,
            "end_line": r.end_line,
            "snippet": r.snippet,
            "content": r.content,
        }
        for r in results
    ])


def cmd_index_file(args: argparse.Namespace) -> None:
    """Index a single file."""
    indexing, _, _ = _create_pipeline(args)

    file_path = Path(args.file).resolve()
    if not file_path.is_file():
        _error_exit(f"File not found: {file_path}")

    root = Path(args.root).resolve() if args.root else None

    stats = indexing.index_file(file_path, root=root)
    _json_output({
        "status": "indexed",
        "file": str(file_path),
        "files_processed": stats.files_processed,
        "chunks_created": stats.chunks_created,
        "duration_seconds": stats.duration_seconds,
    })


def cmd_remove_file(args: argparse.Namespace) -> None:
    """Remove a file from the index."""
    indexing, _, _ = _create_pipeline(args)

    indexing.remove_file(args.file)
    _json_output({
        "status": "removed",
        "file": args.file,
    })


def cmd_sync(args: argparse.Namespace) -> None:
    """Sync index with files under --root matching --glob pattern."""
    indexing, _, _ = _create_pipeline(args)

    root = Path(args.root).resolve()
    if not root.is_dir():
        _error_exit(f"Root directory not found: {root}")

    pattern = args.glob or "**/*"
    file_paths = [
        p for p in root.glob(pattern)
        if p.is_file()
    ]

    stats = indexing.sync(file_paths, root=root)
    _json_output({
        "status": "synced",
        "root": str(root),
        "files_processed": stats.files_processed,
        "chunks_created": stats.chunks_created,
        "duration_seconds": stats.duration_seconds,
    })


def cmd_watch(args: argparse.Namespace) -> None:
    """Watch --root for changes, output JSONL events."""
    root = Path(args.root).resolve()
    if not root.is_dir():
        _error_exit(f"Root directory not found: {root}")

    debounce_ms = args.debounce_ms

    try:
        from watchdog.observers import Observer
        from watchdog.events import FileSystemEventHandler, FileSystemEvent
    except ImportError:
        _error_exit(
            "watchdog is required for watch mode. "
            "Install with: pip install watchdog"
        )

    class _JsonEventHandler(FileSystemEventHandler):
        """Emit JSONL for file events."""

        def _emit(self, event_type: str, path: str) -> None:
            _json_output({
                "event": event_type,
                "path": path,
                "timestamp": time.time(),
            })

        def on_created(self, event: FileSystemEvent) -> None:
            if not event.is_directory:
                self._emit("created", event.src_path)

        def on_modified(self, event: FileSystemEvent) -> None:
            if not event.is_directory:
                self._emit("modified", event.src_path)

        def on_deleted(self, event: FileSystemEvent) -> None:
            if not event.is_directory:
                self._emit("deleted", event.src_path)

        def on_moved(self, event: FileSystemEvent) -> None:
            if not event.is_directory:
                self._emit("moved", event.dest_path)

    observer = Observer()
    observer.schedule(_JsonEventHandler(), str(root), recursive=True)
    observer.start()

    _json_output({
        "status": "watching",
        "root": str(root),
        "debounce_ms": debounce_ms,
    })

    try:
        while True:
            time.sleep(debounce_ms / 1000.0)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()


def cmd_download_models(args: argparse.Namespace) -> None:
    """Download embed + reranker models."""
    from codexlens_search import model_manager

    config = _create_config(args)

    model_manager.ensure_model(config.embed_model, config)
    model_manager.ensure_model(config.reranker_model, config)

    _json_output({
        "status": "downloaded",
        "embed_model": config.embed_model,
        "reranker_model": config.reranker_model,
    })


def cmd_status(args: argparse.Namespace) -> None:
    """Report index statistics."""
    from codexlens_search.indexing.metadata import MetadataStore

    db_path = _resolve_db_path(args)
    meta_path = db_path / "metadata.db"

    if not meta_path.exists():
        _json_output({
            "status": "not_initialized",
            "db_path": str(db_path),
        })
        return

    metadata = MetadataStore(meta_path)
    all_files = metadata.get_all_files()
    deleted_ids = metadata.get_deleted_ids()
    max_chunk = metadata.max_chunk_id()

    _json_output({
        "status": "ok",
        "db_path": str(db_path),
        "files_tracked": len(all_files),
        "max_chunk_id": max_chunk,
        "total_chunks_approx": max_chunk + 1 if max_chunk >= 0 else 0,
        "deleted_chunks": len(deleted_ids),
    })


# ---------------------------------------------------------------------------
# CLI parser
# ---------------------------------------------------------------------------

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="codexlens-search",
        description="Lightweight semantic code search - CLI bridge",
    )
    parser.add_argument(
        "--db-path",
        default=os.environ.get("CODEXLENS_DB_PATH", ".codexlens"),
        help="Path to index database directory (default: .codexlens or $CODEXLENS_DB_PATH)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Enable debug logging to stderr",
    )

    sub = parser.add_subparsers(dest="command")

    # init
    sub.add_parser("init", help="Initialize empty index")

    # search
    p_search = sub.add_parser("search", help="Search the index")
    p_search.add_argument("--query", "-q", required=True, help="Search query")
    p_search.add_argument("--top-k", "-k", type=int, default=10, help="Number of results")

    # index-file
    p_index = sub.add_parser("index-file", help="Index a single file")
    p_index.add_argument("--file", "-f", required=True, help="File path to index")
    p_index.add_argument("--root", "-r", help="Root directory for relative paths")

    # remove-file
    p_remove = sub.add_parser("remove-file", help="Remove a file from index")
    p_remove.add_argument("--file", "-f", required=True, help="Relative file path to remove")

    # sync
    p_sync = sub.add_parser("sync", help="Sync index with directory")
    p_sync.add_argument("--root", "-r", required=True, help="Root directory to sync")
    p_sync.add_argument("--glob", "-g", default="**/*", help="Glob pattern (default: **/*)")

    # watch
    p_watch = sub.add_parser("watch", help="Watch directory for changes (JSONL output)")
    p_watch.add_argument("--root", "-r", required=True, help="Root directory to watch")
    p_watch.add_argument("--debounce-ms", type=int, default=500, help="Debounce interval in ms")

    # download-models
    p_dl = sub.add_parser("download-models", help="Download embed + reranker models")
    p_dl.add_argument("--embed-model", help="Override embed model name")

    # status
    sub.add_parser("status", help="Report index statistics")

    return parser


def main() -> None:
    """CLI entry point."""
    parser = _build_parser()
    args = parser.parse_args()

    # Configure logging
    if args.verbose:
        logging.basicConfig(
            level=logging.DEBUG,
            format="%(levelname)s %(name)s: %(message)s",
            stream=sys.stderr,
        )
    else:
        logging.basicConfig(
            level=logging.WARNING,
            format="%(levelname)s: %(message)s",
            stream=sys.stderr,
        )

    if not args.command:
        parser.print_help(sys.stderr)
        sys.exit(1)

    dispatch = {
        "init": cmd_init,
        "search": cmd_search,
        "index-file": cmd_index_file,
        "remove-file": cmd_remove_file,
        "sync": cmd_sync,
        "watch": cmd_watch,
        "download-models": cmd_download_models,
        "status": cmd_status,
    }

    handler = dispatch.get(args.command)
    if handler is None:
        _error_exit(f"Unknown command: {args.command}")

    try:
        handler(args)
    except KeyboardInterrupt:
        sys.exit(130)
    except SystemExit:
        raise
    except Exception as exc:
        log.debug("Command failed", exc_info=True)
        _error_exit(str(exc))


if __name__ == "__main__":
    main()
