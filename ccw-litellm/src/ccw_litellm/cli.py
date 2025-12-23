"""CLI entry point for ccw-litellm."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def main() -> int:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        prog="ccw-litellm",
        description="Unified LiteLLM interface for ccw and codex-lens",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # config command
    config_parser = subparsers.add_parser("config", help="Show configuration")
    config_parser.add_argument(
        "--path",
        type=Path,
        help="Configuration file path",
    )

    # embed command
    embed_parser = subparsers.add_parser("embed", help="Generate embeddings")
    embed_parser.add_argument("texts", nargs="+", help="Texts to embed")
    embed_parser.add_argument(
        "--model",
        default="default",
        help="Embedding model name (default: default)",
    )
    embed_parser.add_argument(
        "--output",
        choices=["json", "shape"],
        default="shape",
        help="Output format (default: shape)",
    )

    # chat command
    chat_parser = subparsers.add_parser("chat", help="Chat with LLM")
    chat_parser.add_argument("message", help="Message to send")
    chat_parser.add_argument(
        "--model",
        default="default",
        help="LLM model name (default: default)",
    )

    # version command
    subparsers.add_parser("version", help="Show version")

    args = parser.parse_args()

    if args.command == "version":
        from . import __version__

        print(f"ccw-litellm {__version__}")
        return 0

    if args.command == "config":
        from .config import get_config

        try:
            config = get_config(config_path=args.path if hasattr(args, "path") else None)
            print(config.model_dump_json(indent=2))
        except Exception as e:
            print(f"Error loading config: {e}", file=sys.stderr)
            return 1
        return 0

    if args.command == "embed":
        from .clients import LiteLLMEmbedder

        try:
            embedder = LiteLLMEmbedder(model=args.model)
            vectors = embedder.embed(args.texts)

            if args.output == "json":
                print(json.dumps(vectors.tolist()))
            else:
                print(f"Shape: {vectors.shape}")
                print(f"Dimensions: {embedder.dimensions}")
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            return 1
        return 0

    if args.command == "chat":
        from .clients import LiteLLMClient
        from .interfaces import ChatMessage

        try:
            client = LiteLLMClient(model=args.model)
            response = client.chat([ChatMessage(role="user", content=args.message)])
            print(response.content)
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            return 1
        return 0

    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
