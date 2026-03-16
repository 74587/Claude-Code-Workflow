import gc
import gc
import shutil
import sqlite3
import tempfile
import time
from pathlib import Path

import pytest

import codexlens.cli.embedding_manager as embedding_manager
from codexlens.cli.embedding_manager import get_embedding_stats_summary, get_embeddings_status


@pytest.fixture
def status_temp_dir() -> Path:
    temp_path = Path(tempfile.mkdtemp())
    try:
        yield temp_path
    finally:
        gc.collect()
        for _ in range(5):
            try:
                if temp_path.exists():
                    shutil.rmtree(temp_path)
                break
            except PermissionError:
                time.sleep(0.1)


def _create_index_db(index_path: Path, files: list[str], embedded_files: list[str] | None = None) -> None:
    index_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(index_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE files (
                id INTEGER PRIMARY KEY,
                path TEXT NOT NULL UNIQUE,
                content TEXT,
                language TEXT,
                hash TEXT
            )
            """
        )
        cursor.executemany(
            "INSERT INTO files (path, content, language, hash) VALUES (?, ?, ?, ?)",
            [(file_path, "", "python", f"hash-{idx}") for idx, file_path in enumerate(files)],
        )

        if embedded_files is not None:
            cursor.execute(
                """
                CREATE TABLE semantic_chunks (
                    id INTEGER PRIMARY KEY,
                    file_path TEXT NOT NULL,
                    content TEXT,
                    embedding BLOB,
                    metadata TEXT,
                    category TEXT
                )
                """
            )
            cursor.executemany(
                "INSERT INTO semantic_chunks (file_path, content, embedding, metadata, category) VALUES (?, ?, ?, ?, ?)",
                [(file_path, "chunk", b"vec", "{}", "code") for file_path in embedded_files],
            )
        conn.commit()


def _create_vectors_meta_db(meta_path: Path, embedded_files: list[str], binary_vector_count: int = 0) -> None:
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(meta_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE chunk_metadata (
                chunk_id INTEGER PRIMARY KEY,
                file_path TEXT NOT NULL,
                content TEXT,
                start_line INTEGER,
                end_line INTEGER,
                category TEXT,
                metadata TEXT,
                source_index_db TEXT
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE binary_vectors (
                chunk_id INTEGER PRIMARY KEY,
                vector BLOB NOT NULL
            )
            """
        )
        cursor.executemany(
            """
            INSERT INTO chunk_metadata (
                chunk_id, file_path, content, start_line, end_line, category, metadata, source_index_db
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (idx, file_path, "chunk", 1, 1, "code", "{}", str(meta_path.parent / "_index.db"))
                for idx, file_path in enumerate(embedded_files, start=1)
            ],
        )
        cursor.executemany(
            "INSERT INTO binary_vectors (chunk_id, vector) VALUES (?, ?)",
            [(idx, b"\x01") for idx in range(1, binary_vector_count + 1)],
        )
        conn.commit()


def test_root_status_does_not_inherit_child_embeddings(
    monkeypatch: pytest.MonkeyPatch, status_temp_dir: Path
) -> None:
    workspace = status_temp_dir / "workspace"
    workspace.mkdir()
    _create_index_db(workspace / "_index.db", ["a.py", "b.py"])
    _create_index_db(workspace / "child" / "_index.db", ["child.py"], embedded_files=["child.py"])

    monkeypatch.setattr(
        embedding_manager,
        "_get_model_info_from_index",
        lambda index_path: {
            "model_profile": "fast",
            "model_name": "unit-test-model",
            "embedding_dim": 384,
            "backend": "fastembed",
            "created_at": "2026-03-13T00:00:00Z",
            "updated_at": "2026-03-13T00:00:00Z",
        } if index_path.parent.name == "child" else None,
    )

    status = get_embeddings_status(workspace)
    assert status["success"] is True

    result = status["result"]
    assert result["coverage_percent"] == 0.0
    assert result["files_with_embeddings"] == 0
    assert result["root"]["has_embeddings"] is False
    assert result["model_info"] is None
    assert result["subtree"]["indexes_with_embeddings"] == 1
    assert result["subtree"]["coverage_percent"] > 0


def test_root_status_uses_validated_centralized_metadata(status_temp_dir: Path) -> None:
    workspace = status_temp_dir / "workspace"
    workspace.mkdir()
    _create_index_db(workspace / "_index.db", ["a.py", "b.py"])
    _create_vectors_meta_db(workspace / "_vectors_meta.db", ["a.py"])
    (workspace / "_vectors.hnsw").write_bytes(b"hnsw")

    status = get_embeddings_status(workspace)
    assert status["success"] is True

    result = status["result"]
    assert result["coverage_percent"] == 50.0
    assert result["files_with_embeddings"] == 1
    assert result["total_chunks"] == 1
    assert result["root"]["has_embeddings"] is True
    assert result["root"]["storage_mode"] == "centralized"
    assert result["centralized"]["dense_ready"] is True
    assert result["centralized"]["usable"] is True


def test_embedding_stats_summary_skips_ignored_artifact_indexes(status_temp_dir: Path) -> None:
    workspace = status_temp_dir / "workspace"
    workspace.mkdir()
    _create_index_db(workspace / "_index.db", ["root.py"])
    _create_index_db(workspace / "src" / "_index.db", ["src.py"])
    _create_index_db(workspace / "dist" / "_index.db", ["bundle.py"], embedded_files=["bundle.py"])
    _create_index_db(workspace / ".workflow" / "_index.db", ["trace.py"], embedded_files=["trace.py"])

    summary = get_embedding_stats_summary(workspace)

    assert summary["success"] is True
    result = summary["result"]
    assert result["total_indexes"] == 2
    assert {Path(item["path"]).relative_to(workspace).as_posix() for item in result["indexes"]} == {
        "_index.db",
        "src/_index.db",
    }


def test_root_status_ignores_empty_centralized_artifacts(status_temp_dir: Path) -> None:
    workspace = status_temp_dir / "workspace"
    workspace.mkdir()
    _create_index_db(workspace / "_index.db", ["a.py", "b.py"])
    _create_vectors_meta_db(workspace / "_vectors_meta.db", [])
    (workspace / "_vectors.hnsw").write_bytes(b"hnsw")
    (workspace / "_binary_vectors.mmap").write_bytes(b"mmap")

    status = get_embeddings_status(workspace)
    assert status["success"] is True

    result = status["result"]
    assert result["coverage_percent"] == 0.0
    assert result["files_with_embeddings"] == 0
    assert result["root"]["has_embeddings"] is False
    assert result["centralized"]["chunk_metadata_rows"] == 0
    assert result["centralized"]["binary_vector_rows"] == 0
    assert result["centralized"]["usable"] is False
