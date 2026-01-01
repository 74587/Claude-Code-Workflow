"""Fixtures for watcher tests."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Generator

import pytest


@pytest.fixture
def temp_project() -> Generator[Path, None, None]:
    """Create a temporary project directory with sample files."""
    with tempfile.TemporaryDirectory() as tmpdir:
        project = Path(tmpdir)
        
        # Create sample Python file
        py_file = project / "main.py"
        py_file.write_text("def hello():\n    print('Hello')\n")
        
        # Create sample JavaScript file
        js_file = project / "app.js"
        js_file.write_text("function greet() {\n  console.log('Hi');\n}\n")
        
        # Create subdirectory with file
        sub_dir = project / "src"
        sub_dir.mkdir()
        (sub_dir / "utils.py").write_text("def add(a, b):\n    return a + b\n")
        
        # Create ignored directory
        git_dir = project / ".git"
        git_dir.mkdir()
        (git_dir / "config").write_text("[core]\n")
        
        yield project


@pytest.fixture
def watcher_config():
    """Create default watcher configuration."""
    from codexlens.watcher import WatcherConfig
    return WatcherConfig(debounce_ms=100)  # Short debounce for tests
