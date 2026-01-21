"""Debug URI format issues."""

import asyncio
from pathlib import Path
from urllib.parse import quote

def test_uri_formats():
    """Compare different URI formats."""
    file_path = Path("D:/Claude_dms3/codex-lens/test_simple_function.py")

    print("URI Format Comparison")
    print("="*80)

    # Method 1: Path.as_uri()
    uri1 = file_path.resolve().as_uri()
    print(f"1. Path.as_uri():        {uri1}")

    # Method 2: Manual construction
    uri2 = f"file:///{str(file_path.resolve()).replace(chr(92), '/')}"
    print(f"2. Manual (forward /):   {uri2}")

    # Method 3: With quote
    path_str = str(file_path.resolve()).replace(chr(92), '/')
    uri3 = f"file:///{quote(path_str, safe='/:')}"
    print(f"3. With quote:           {uri3}")

    # Method 4: Lowercase drive
    path_lower = str(file_path.resolve()).replace(chr(92), '/')
    if len(path_lower) > 1 and path_lower[1] == ':':
        path_lower = path_lower[0].lower() + path_lower[1:]
    uri4 = f"file:///{path_lower}"
    print(f"4. Lowercase drive:      {uri4}")

    # What Pyright shows in logs
    print(f"\n5. Pyright log format:   file:///d%3A/Claude_dms3/codex-lens/...")

    return uri1, uri4

if __name__ == "__main__":
    test_uri_formats()
