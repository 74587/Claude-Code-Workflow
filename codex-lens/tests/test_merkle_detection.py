import time
from pathlib import Path

from codexlens.config import Config
from codexlens.storage.dir_index import DirIndexStore


def _make_merkle_config(tmp_path: Path) -> Config:
    data_dir = tmp_path / "data"
    return Config(
        data_dir=data_dir,
        venv_path=data_dir / "venv",
        enable_merkle_detection=True,
    )


class TestMerkleDetection:
    def test_needs_reindex_touch_updates_mtime(self, tmp_path: Path) -> None:
        config = _make_merkle_config(tmp_path)
        source_dir = tmp_path / "src"
        source_dir.mkdir(parents=True, exist_ok=True)

        file_path = source_dir / "a.py"
        file_path.write_text("print('hi')\n", encoding="utf-8")
        original_content = file_path.read_text(encoding="utf-8")

        index_db = tmp_path / "_index.db"
        with DirIndexStore(index_db, config=config) as store:
            store.add_file(
                name=file_path.name,
                full_path=file_path,
                content=original_content,
                language="python",
                symbols=[],
            )

            stored_mtime_before = store.get_file_mtime(file_path)
            assert stored_mtime_before is not None

            # Touch file without changing content
            time.sleep(0.02)
            file_path.write_text(original_content, encoding="utf-8")

            assert store.needs_reindex(file_path) is False

            stored_mtime_after = store.get_file_mtime(file_path)
            assert stored_mtime_after is not None
            assert stored_mtime_after != stored_mtime_before

            current_mtime = file_path.stat().st_mtime
            assert abs(stored_mtime_after - current_mtime) <= 0.001

    def test_parent_root_changes_when_child_changes(self, tmp_path: Path) -> None:
        config = _make_merkle_config(tmp_path)

        source_root = tmp_path / "project"
        child_dir = source_root / "child"
        child_dir.mkdir(parents=True, exist_ok=True)

        child_file = child_dir / "child.py"
        child_file.write_text("x = 1\n", encoding="utf-8")

        child_db = tmp_path / "child_index.db"
        parent_db = tmp_path / "parent_index.db"

        with DirIndexStore(child_db, config=config) as child_store:
            child_store.add_file(
                name=child_file.name,
                full_path=child_file,
                content=child_file.read_text(encoding="utf-8"),
                language="python",
                symbols=[],
            )
            child_root_1 = child_store.update_merkle_root()
            assert child_root_1

        with DirIndexStore(parent_db, config=config) as parent_store:
            parent_store.register_subdir(name="child", index_path=child_db, files_count=1)
            parent_root_1 = parent_store.update_merkle_root()
            assert parent_root_1

        time.sleep(0.02)
        child_file.write_text("x = 2\n", encoding="utf-8")

        with DirIndexStore(child_db, config=config) as child_store:
            child_store.add_file(
                name=child_file.name,
                full_path=child_file,
                content=child_file.read_text(encoding="utf-8"),
                language="python",
                symbols=[],
            )
            child_root_2 = child_store.update_merkle_root()
            assert child_root_2
            assert child_root_2 != child_root_1

        with DirIndexStore(parent_db, config=config) as parent_store:
            parent_root_2 = parent_store.update_merkle_root()
            assert parent_root_2
            assert parent_root_2 != parent_root_1
