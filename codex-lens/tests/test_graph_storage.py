"""Tests for code relationship storage."""

import sqlite3
import tempfile
from pathlib import Path

import pytest

from codexlens.entities import CodeRelationship, IndexedFile, Symbol
from codexlens.storage.migration_manager import MigrationManager
from codexlens.storage.sqlite_store import SQLiteStore


@pytest.fixture
def temp_db():
    """Create a temporary database for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        yield db_path


@pytest.fixture
def store(temp_db):
    """Create a SQLiteStore with migrations applied."""
    store = SQLiteStore(temp_db)
    store.initialize()

    # Manually apply migration_003 (code_relationships table)
    conn = store._get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS code_relationships (
            id INTEGER PRIMARY KEY,
            source_symbol_id INTEGER NOT NULL,
            target_qualified_name TEXT NOT NULL,
            relationship_type TEXT NOT NULL,
            source_line INTEGER NOT NULL,
            target_file TEXT,
            FOREIGN KEY (source_symbol_id) REFERENCES symbols (id) ON DELETE CASCADE
        )
        """
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_relationships_source ON code_relationships (source_symbol_id)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_relationships_target ON code_relationships (target_qualified_name)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_relationships_type ON code_relationships (relationship_type)"
    )
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_relationships_source_line ON code_relationships (source_line)"
    )
    conn.commit()

    yield store

    # Cleanup
    store.close()


def test_relationship_table_created(store):
    """Test that the code_relationships table is created by migration."""
    conn = store._get_connection()
    cursor = conn.cursor()

    # Check table exists
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='code_relationships'"
    )
    result = cursor.fetchone()
    assert result is not None, "code_relationships table should exist"

    # Check indexes exist
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='code_relationships'"
    )
    indexes = [row[0] for row in cursor.fetchall()]
    assert "idx_relationships_source" in indexes
    assert "idx_relationships_target" in indexes
    assert "idx_relationships_type" in indexes


def test_add_relationships(store):
    """Test storing code relationships."""
    # First add a file with symbols
    indexed_file = IndexedFile(
        path=str(Path(__file__).parent / "sample.py"),
        language="python",
        symbols=[
            Symbol(name="foo", kind="function", range=(1, 5)),
            Symbol(name="bar", kind="function", range=(7, 10)),
        ]
    )

    content = """def foo():
    bar()
    baz()

def bar():
    print("hello")
"""

    store.add_file(indexed_file, content)

    # Add relationships
    relationships = [
        CodeRelationship(
            source_symbol="foo",
            target_symbol="bar",
            relationship_type="call",
            source_file=indexed_file.path,
            target_file=None,
            source_line=2
        ),
        CodeRelationship(
            source_symbol="foo",
            target_symbol="baz",
            relationship_type="call",
            source_file=indexed_file.path,
            target_file=None,
            source_line=3
        ),
    ]

    store.add_relationships(indexed_file.path, relationships)

    # Verify relationships were stored
    conn = store._get_connection()
    count = conn.execute("SELECT COUNT(*) FROM code_relationships").fetchone()[0]
    assert count == 2, "Should have stored 2 relationships"


def test_query_relationships_by_target(store):
    """Test querying relationships by target symbol (find callers)."""
    # Setup: Add file and relationships
    file_path = str(Path(__file__).parent / "sample.py")
    # Content: Line 1-2: foo(), Line 4-5: bar(), Line 7-8: main()
    indexed_file = IndexedFile(
        path=file_path,
        language="python",
        symbols=[
            Symbol(name="foo", kind="function", range=(1, 2)),
            Symbol(name="bar", kind="function", range=(4, 5)),
            Symbol(name="main", kind="function", range=(7, 8)),
        ]
    )

    content = "def foo():\n    bar()\n\ndef bar():\n    pass\n\ndef main():\n    bar()\n"
    store.add_file(indexed_file, content)

    relationships = [
        CodeRelationship(
            source_symbol="foo",
            target_symbol="bar",
            relationship_type="call",
            source_file=file_path,
            target_file=None,
            source_line=2  # Call inside foo (line 2)
        ),
        CodeRelationship(
            source_symbol="main",
            target_symbol="bar",
            relationship_type="call",
            source_file=file_path,
            target_file=None,
            source_line=8  # Call inside main (line 8)
        ),
    ]

    store.add_relationships(file_path, relationships)

    # Query: Find all callers of "bar"
    callers = store.query_relationships_by_target("bar")

    assert len(callers) == 2, "Should find 2 callers of bar"
    assert any(r["source_symbol"] == "foo" for r in callers)
    assert any(r["source_symbol"] == "main" for r in callers)
    assert all(r["target_symbol"] == "bar" for r in callers)
    assert all(r["relationship_type"] == "call" for r in callers)


def test_query_relationships_by_source(store):
    """Test querying relationships by source symbol (find callees)."""
    # Setup
    file_path = str(Path(__file__).parent / "sample.py")
    indexed_file = IndexedFile(
        path=file_path,
        language="python",
        symbols=[
            Symbol(name="foo", kind="function", range=(1, 6)),
        ]
    )

    content = "def foo():\n    bar()\n    baz()\n    qux()\n"
    store.add_file(indexed_file, content)

    relationships = [
        CodeRelationship(
            source_symbol="foo",
            target_symbol="bar",
            relationship_type="call",
            source_file=file_path,
            target_file=None,
            source_line=2
        ),
        CodeRelationship(
            source_symbol="foo",
            target_symbol="baz",
            relationship_type="call",
            source_file=file_path,
            target_file=None,
            source_line=3
        ),
        CodeRelationship(
            source_symbol="foo",
            target_symbol="qux",
            relationship_type="call",
            source_file=file_path,
            target_file=None,
            source_line=4
        ),
    ]

    store.add_relationships(file_path, relationships)

    # Query: Find all functions called by foo
    callees = store.query_relationships_by_source("foo", file_path)

    assert len(callees) == 3, "Should find 3 functions called by foo"
    targets = {r["target_symbol"] for r in callees}
    assert targets == {"bar", "baz", "qux"}
    assert all(r["source_symbol"] == "foo" for r in callees)


def test_query_performance(store):
    """Test that relationship queries execute within performance threshold."""
    import time

    # Setup: Create a file with many relationships
    file_path = str(Path(__file__).parent / "large_file.py")
    symbols = [Symbol(name=f"func_{i}", kind="function", range=(i*10+1, i*10+5)) for i in range(100)]

    indexed_file = IndexedFile(
        path=file_path,
        language="python",
        symbols=symbols
    )

    content = "\n".join([f"def func_{i}():\n    pass\n" for i in range(100)])
    store.add_file(indexed_file, content)

    # Create many relationships
    relationships = []
    for i in range(100):
        for j in range(10):
            relationships.append(
                CodeRelationship(
                    source_symbol=f"func_{i}",
                    target_symbol=f"target_{j}",
                    relationship_type="call",
                    source_file=file_path,
                    target_file=None,
                    source_line=i*10 + 1
                )
            )

    store.add_relationships(file_path, relationships)

    # Query and measure time
    start = time.time()
    results = store.query_relationships_by_target("target_5")
    elapsed_ms = (time.time() - start) * 1000

    assert len(results) == 100, "Should find 100 callers"
    assert elapsed_ms < 50, f"Query took {elapsed_ms:.1f}ms, should be <50ms"


def test_stats_includes_relationships(store):
    """Test that stats() includes relationship count."""
    # Add a file with relationships
    file_path = str(Path(__file__).parent / "sample.py")
    indexed_file = IndexedFile(
        path=file_path,
        language="python",
        symbols=[Symbol(name="foo", kind="function", range=(1, 5))]
    )

    store.add_file(indexed_file, "def foo():\n    bar()\n")

    relationships = [
        CodeRelationship(
            source_symbol="foo",
            target_symbol="bar",
            relationship_type="call",
            source_file=file_path,
            target_file=None,
            source_line=2
        )
    ]

    store.add_relationships(file_path, relationships)

    # Check stats
    stats = store.stats()

    assert "relationships" in stats
    assert stats["relationships"] == 1
    assert stats["files"] == 1
    assert stats["symbols"] == 1


def test_update_relationships_on_file_reindex(store):
    """Test that relationships are updated when file is re-indexed."""
    file_path = str(Path(__file__).parent / "sample.py")

    # Initial index
    indexed_file = IndexedFile(
        path=file_path,
        language="python",
        symbols=[Symbol(name="foo", kind="function", range=(1, 3))]
    )
    store.add_file(indexed_file, "def foo():\n    bar()\n")

    relationships = [
        CodeRelationship(
            source_symbol="foo",
            target_symbol="bar",
            relationship_type="call",
            source_file=file_path,
            target_file=None,
            source_line=2
        )
    ]
    store.add_relationships(file_path, relationships)

    # Re-index with different relationships
    new_relationships = [
        CodeRelationship(
            source_symbol="foo",
            target_symbol="baz",
            relationship_type="call",
            source_file=file_path,
            target_file=None,
            source_line=2
        )
    ]
    store.add_relationships(file_path, new_relationships)

    # Verify old relationships are replaced
    all_rels = store.query_relationships_by_source("foo", file_path)
    assert len(all_rels) == 1
    assert all_rels[0]["target_symbol"] == "baz"
