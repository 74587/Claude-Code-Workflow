"""Tests for search result enrichment with relationship data."""
import sqlite3
import tempfile
import time
from pathlib import Path

import pytest

from codexlens.search.enrichment import RelationshipEnricher


@pytest.fixture
def mock_db():
    """Create a mock database with symbols and relationships."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "_index.db"
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()

        # Create schema
        cursor.execute('''
            CREATE TABLE symbols (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                qualified_name TEXT NOT NULL,
                name TEXT NOT NULL,
                kind TEXT NOT NULL,
                file_path TEXT NOT NULL,
                start_line INTEGER NOT NULL,
                end_line INTEGER NOT NULL
            )
        ''')
        cursor.execute('''
            CREATE TABLE symbol_relationships (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_symbol_id INTEGER NOT NULL,
                target_symbol_fqn TEXT NOT NULL,
                relationship_type TEXT NOT NULL,
                file_path TEXT NOT NULL,
                line INTEGER,
                FOREIGN KEY (source_symbol_id) REFERENCES symbols(id)
            )
        ''')

        # Insert test data
        cursor.execute('''
            INSERT INTO symbols (qualified_name, name, kind, file_path, start_line, end_line)
            VALUES ('module.main', 'main', 'function', 'module.py', 1, 10)
        ''')
        main_id = cursor.lastrowid

        cursor.execute('''
            INSERT INTO symbols (qualified_name, name, kind, file_path, start_line, end_line)
            VALUES ('module.helper', 'helper', 'function', 'module.py', 12, 20)
        ''')
        helper_id = cursor.lastrowid

        cursor.execute('''
            INSERT INTO symbols (qualified_name, name, kind, file_path, start_line, end_line)
            VALUES ('utils.fetch', 'fetch', 'function', 'utils.py', 1, 5)
        ''')
        fetch_id = cursor.lastrowid

        # main calls helper
        cursor.execute('''
            INSERT INTO symbol_relationships (source_symbol_id, target_symbol_fqn, relationship_type, file_path, line)
            VALUES (?, 'helper', 'calls', 'module.py', 5)
        ''', (main_id,))

        # main calls fetch
        cursor.execute('''
            INSERT INTO symbol_relationships (source_symbol_id, target_symbol_fqn, relationship_type, file_path, line)
            VALUES (?, 'utils.fetch', 'calls', 'module.py', 6)
        ''', (main_id,))

        # helper imports os
        cursor.execute('''
            INSERT INTO symbol_relationships (source_symbol_id, target_symbol_fqn, relationship_type, file_path, line)
            VALUES (?, 'os', 'imports', 'module.py', 13)
        ''', (helper_id,))

        conn.commit()
        conn.close()

        yield db_path


class TestRelationshipEnricher:
    """Test suite for RelationshipEnricher."""

    def test_enrich_with_relationships(self, mock_db):
        """Test enriching results with valid relationships."""
        with RelationshipEnricher(mock_db) as enricher:
            results = [
                {"path": "module.py", "score": 0.9, "excerpt": "def main():", "symbol": "main"},
                {"path": "module.py", "score": 0.8, "excerpt": "def helper():", "symbol": "helper"},
            ]

            enriched = enricher.enrich(results, limit=10)

            # Check main's relationships
            main_result = enriched[0]
            assert "relationships" in main_result
            main_rels = main_result["relationships"]
            assert len(main_rels) >= 2

            # Verify outgoing relationships
            outgoing = [r for r in main_rels if r["direction"] == "outgoing"]
            targets = [r["target"] for r in outgoing]
            assert "helper" in targets or any("helper" in t for t in targets)

            # Check helper's relationships
            helper_result = enriched[1]
            assert "relationships" in helper_result
            helper_rels = helper_result["relationships"]
            assert len(helper_rels) >= 1

            # Verify incoming relationships (main calls helper)
            incoming = [r for r in helper_rels if r["direction"] == "incoming"]
            assert len(incoming) >= 1
            assert incoming[0]["type"] == "called_by"

    def test_enrich_missing_symbol(self, mock_db):
        """Test graceful handling of missing symbols."""
        with RelationshipEnricher(mock_db) as enricher:
            results = [
                {"path": "unknown.py", "score": 0.9, "excerpt": "code", "symbol": "nonexistent"},
            ]

            enriched = enricher.enrich(results, limit=10)

            # Should return empty relationships, not crash
            assert "relationships" in enriched[0]
            assert enriched[0]["relationships"] == []

    def test_enrich_no_symbol_name(self, mock_db):
        """Test handling results without symbol names."""
        with RelationshipEnricher(mock_db) as enricher:
            results = [
                {"path": "module.py", "score": 0.9, "excerpt": "code", "symbol": None},
            ]

            enriched = enricher.enrich(results, limit=10)

            assert "relationships" in enriched[0]
            assert enriched[0]["relationships"] == []

    def test_enrich_performance(self, mock_db):
        """Test that enrichment is fast (<100ms for 10 results)."""
        with RelationshipEnricher(mock_db) as enricher:
            results = [
                {"path": "module.py", "score": 0.9, "excerpt": f"code{i}", "symbol": "main"}
                for i in range(10)
            ]

            start = time.perf_counter()
            enricher.enrich(results, limit=10)
            elapsed_ms = (time.perf_counter() - start) * 1000

            assert elapsed_ms < 100, f"Enrichment took {elapsed_ms:.1f}ms, expected < 100ms"

    def test_enrich_limit(self, mock_db):
        """Test that limit parameter is respected."""
        with RelationshipEnricher(mock_db) as enricher:
            results = [
                {"path": "module.py", "score": 0.9, "symbol": "main"},
                {"path": "module.py", "score": 0.8, "symbol": "helper"},
                {"path": "utils.py", "score": 0.7, "symbol": "fetch"},
            ]

            # Only enrich first 2
            enriched = enricher.enrich(results, limit=2)

            assert "relationships" in enriched[0]
            assert "relationships" in enriched[1]
            # Third result should NOT have relationships key
            assert "relationships" not in enriched[2]

    def test_connection_failure_graceful(self):
        """Test graceful handling when database doesn't exist."""
        nonexistent = Path("/nonexistent/path/_index.db")
        with RelationshipEnricher(nonexistent) as enricher:
            results = [{"path": "test.py", "score": 0.9, "symbol": "test"}]
            enriched = enricher.enrich(results)

            # Should return original results without crashing
            assert len(enriched) == 1

    def test_incoming_type_conversion(self, mock_db):
        """Test that relationship types are correctly converted for incoming."""
        with RelationshipEnricher(mock_db) as enricher:
            results = [
                {"path": "module.py", "score": 0.9, "symbol": "helper"},
            ]

            enriched = enricher.enrich(results)
            rels = enriched[0]["relationships"]

            incoming = [r for r in rels if r["direction"] == "incoming"]
            if incoming:
                # calls should become called_by
                assert incoming[0]["type"] == "called_by"

    def test_context_manager(self, mock_db):
        """Test that context manager properly opens and closes connections."""
        enricher = RelationshipEnricher(mock_db)
        assert enricher.db_conn is not None

        enricher.close()
        assert enricher.db_conn is None

        # Using context manager
        with RelationshipEnricher(mock_db) as e:
            assert e.db_conn is not None
        assert e.db_conn is None

    def test_relationship_data_structure(self, mock_db):
        """Test that relationship data has correct structure."""
        with RelationshipEnricher(mock_db) as enricher:
            results = [{"path": "module.py", "score": 0.9, "symbol": "main"}]
            enriched = enricher.enrich(results)

            rels = enriched[0]["relationships"]
            for rel in rels:
                # All relationships should have required fields
                assert "type" in rel
                assert "direction" in rel
                assert "file" in rel
                assert rel["direction"] in ["outgoing", "incoming"]

                # Outgoing should have target, incoming should have source
                if rel["direction"] == "outgoing":
                    assert "target" in rel
                else:
                    assert "source" in rel
