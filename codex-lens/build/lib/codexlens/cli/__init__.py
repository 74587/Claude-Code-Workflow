"""CLI package for CodexLens."""

from __future__ import annotations

import sys
import os

# Force UTF-8 encoding for Windows console
# This ensures Chinese characters display correctly instead of GBK garbled text
if sys.platform == "win32":
    # Set environment variable for Python I/O encoding
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

    # Reconfigure stdout/stderr to use UTF-8 if possible
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        if hasattr(sys.stderr, "reconfigure"):
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        # Fallback: some environments don't support reconfigure
        pass

from .commands import app

__all__ = ["app"]

