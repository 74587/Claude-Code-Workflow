"""Module entrypoint for `python -m codexlens`."""

from __future__ import annotations

from codexlens.cli import app


def main() -> None:
    app()


if __name__ == "__main__":
    main()

