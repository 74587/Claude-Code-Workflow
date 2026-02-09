"""Tests for StandaloneLspManager path normalization (Windows URI handling)."""

from __future__ import annotations

import platform

from codexlens.lsp.standalone_manager import StandaloneLspManager


def test_normalize_file_uri_percent_encoded_windows_drive() -> None:
    if platform.system() != "Windows":
        return

    manager = StandaloneLspManager(workspace_root="D:/Claude_dms3/codex-lens")

    raw = "file:///d%3A/Claude_dms3/codex-lens/src/codexlens/lsp/standalone_manager.py"
    normalized = manager._normalize_file_path(raw)

    assert normalized.lower().startswith("d:/")
    assert "%3a" not in normalized.lower()
    assert "d%3a" not in normalized.lower()
    assert "/d%3a" not in normalized.lower()


def test_normalize_uri_path_percent_encoded_windows_drive() -> None:
    if platform.system() != "Windows":
        return

    manager = StandaloneLspManager(workspace_root="D:/Claude_dms3/codex-lens")

    raw = "/d%3A/Claude_dms3/codex-lens/src/codexlens/lsp/standalone_manager.py"
    normalized = manager._normalize_file_path(raw)

    assert normalized.lower().startswith("d:/")
    assert "%3a" not in normalized.lower()


def test_normalize_plain_windows_path_is_unchanged() -> None:
    if platform.system() != "Windows":
        return

    manager = StandaloneLspManager(workspace_root="D:/Claude_dms3/codex-lens")

    raw = r"D:\Claude_dms3\codex-lens\src\codexlens\lsp\standalone_manager.py"
    normalized = manager._normalize_file_path(raw)

    assert normalized == raw

