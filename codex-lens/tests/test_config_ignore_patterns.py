from __future__ import annotations

import json
from pathlib import Path

from codexlens.config import Config


def test_load_settings_reads_ignore_patterns_and_extension_filters(tmp_path: Path) -> None:
    settings_path = tmp_path / "settings.json"
    settings_path.write_text(
        json.dumps(
            {
                "ignore_patterns": ["frontend/dist", "coverage"],
                "extension_filters": ["*.min.js", "*.map"],
            }
        ),
        encoding="utf-8",
    )

    config = Config(data_dir=tmp_path)
    config.load_settings()

    assert config.ignore_patterns == ["frontend/dist", "coverage"]
    assert config.extension_filters == ["*.min.js", "*.map"]
