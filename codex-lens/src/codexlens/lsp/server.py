"""codex-lens LSP Server implementation using pygls.

This module provides the main Language Server class and entry point.
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Optional

try:
    from lsprotocol import types as lsp
    from pygls.lsp.server import LanguageServer
except ImportError as exc:
    raise ImportError(
        "LSP dependencies not installed. Install with: pip install codex-lens[lsp]"
    ) from exc

from codexlens.config import Config
from codexlens.search.chain_search import ChainSearchEngine
from codexlens.storage.global_index import GlobalSymbolIndex
from codexlens.storage.path_mapper import PathMapper
from codexlens.storage.registry import RegistryStore

logger = logging.getLogger(__name__)


class CodexLensLanguageServer(LanguageServer):
    """Language Server for codex-lens code indexing.

    Provides IDE features using codex-lens symbol index:
    - Go to Definition
    - Find References
    - Code Completion
    - Hover Information
    - Workspace Symbol Search

    Attributes:
        registry: Global project registry for path lookups
        mapper: Path mapper for source/index conversions
        global_index: Project-wide symbol index
        search_engine: Chain search engine for symbol search
        workspace_root: Current workspace root path
    """

    def __init__(self) -> None:
        super().__init__(name="codexlens-lsp", version="0.1.0")

        self.registry: Optional[RegistryStore] = None
        self.mapper: Optional[PathMapper] = None
        self.global_index: Optional[GlobalSymbolIndex] = None
        self.search_engine: Optional[ChainSearchEngine] = None
        self.workspace_root: Optional[Path] = None
        self._config: Optional[Config] = None

    def initialize_components(self, workspace_root: Path) -> bool:
        """Initialize codex-lens components for the workspace.

        Args:
            workspace_root: Root path of the workspace

        Returns:
            True if initialization succeeded, False otherwise
        """
        self.workspace_root = workspace_root.resolve()
        logger.info("Initializing codex-lens for workspace: %s", self.workspace_root)

        try:
            # Initialize registry
            self.registry = RegistryStore()
            self.registry.initialize()

            # Initialize path mapper
            self.mapper = PathMapper()

            # Try to find project in registry
            project_info = self.registry.find_by_source_path(str(self.workspace_root))

            if project_info:
                project_id = int(project_info["id"])
                index_root = Path(project_info["index_root"])

                # Initialize global symbol index
                global_db = index_root / GlobalSymbolIndex.DEFAULT_DB_NAME
                self.global_index = GlobalSymbolIndex(global_db, project_id)
                self.global_index.initialize()

                # Initialize search engine
                self._config = Config()
                self.search_engine = ChainSearchEngine(
                    registry=self.registry,
                    mapper=self.mapper,
                    config=self._config,
                )

                logger.info("codex-lens initialized for project: %s", project_info["source_root"])
                return True
            else:
                logger.warning(
                    "Workspace not indexed by codex-lens: %s. "
                    "Run 'codexlens index %s' to index first.",
                    self.workspace_root,
                    self.workspace_root,
                )
                return False

        except Exception as exc:
            logger.error("Failed to initialize codex-lens: %s", exc)
            return False

    def shutdown_components(self) -> None:
        """Clean up codex-lens components."""
        if self.global_index:
            try:
                self.global_index.close()
            except Exception as exc:
                logger.debug("Error closing global index: %s", exc)
            self.global_index = None

        if self.search_engine:
            try:
                self.search_engine.close()
            except Exception as exc:
                logger.debug("Error closing search engine: %s", exc)
            self.search_engine = None

        if self.registry:
            try:
                self.registry.close()
            except Exception as exc:
                logger.debug("Error closing registry: %s", exc)
            self.registry = None


# Create server instance
server = CodexLensLanguageServer()


@server.feature(lsp.INITIALIZE)
def lsp_initialize(params: lsp.InitializeParams) -> lsp.InitializeResult:
    """Handle LSP initialize request."""
    logger.info("LSP initialize request received")

    # Get workspace root
    workspace_root: Optional[Path] = None
    if params.root_uri:
        workspace_root = Path(params.root_uri.replace("file://", "").replace("file:", ""))
    elif params.root_path:
        workspace_root = Path(params.root_path)

    if workspace_root:
        server.initialize_components(workspace_root)

    # Declare server capabilities
    return lsp.InitializeResult(
        capabilities=lsp.ServerCapabilities(
            text_document_sync=lsp.TextDocumentSyncOptions(
                open_close=True,
                change=lsp.TextDocumentSyncKind.Incremental,
                save=lsp.SaveOptions(include_text=False),
            ),
            definition_provider=True,
            references_provider=True,
            completion_provider=lsp.CompletionOptions(
                trigger_characters=[".", ":"],
                resolve_provider=False,
            ),
            hover_provider=True,
            workspace_symbol_provider=True,
        ),
        server_info=lsp.ServerInfo(
            name="codexlens-lsp",
            version="0.1.0",
        ),
    )


@server.feature(lsp.SHUTDOWN)
def lsp_shutdown(params: None) -> None:
    """Handle LSP shutdown request."""
    logger.info("LSP shutdown request received")
    server.shutdown_components()


def main() -> int:
    """Entry point for codexlens-lsp command.

    Returns:
        Exit code (0 for success)
    """
    # Import handlers to register them with the server
    # This must be done before starting the server
    import codexlens.lsp.handlers  # noqa: F401

    parser = argparse.ArgumentParser(
        description="codex-lens Language Server",
        prog="codexlens-lsp",
    )
    parser.add_argument(
        "--stdio",
        action="store_true",
        default=True,
        help="Use stdio for communication (default)",
    )
    parser.add_argument(
        "--tcp",
        action="store_true",
        help="Use TCP for communication",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="TCP host (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=2087,
        help="TCP port (default: 2087)",
    )
    parser.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR"],
        default="INFO",
        help="Log level (default: INFO)",
    )
    parser.add_argument(
        "--log-file",
        help="Log file path (optional)",
    )

    args = parser.parse_args()

    # Configure logging
    log_handlers = []
    if args.log_file:
        log_handlers.append(logging.FileHandler(args.log_file))
    else:
        log_handlers.append(logging.StreamHandler(sys.stderr))

    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=log_handlers,
    )

    logger.info("Starting codexlens-lsp server")

    if args.tcp:
        logger.info("Starting TCP server on %s:%d", args.host, args.port)
        server.start_tcp(args.host, args.port)
    else:
        logger.info("Starting stdio server")
        server.start_io()

    return 0


if __name__ == "__main__":
    sys.exit(main())
