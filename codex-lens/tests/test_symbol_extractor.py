"""Tests for symbol extraction and relationship tracking."""
import tempfile
from pathlib import Path

import pytest

from codexlens.indexing.symbol_extractor import SymbolExtractor


@pytest.fixture
def extractor():
    """Create a temporary symbol extractor for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test.db"
        ext = SymbolExtractor(db_path)
        ext.connect()
        yield ext
        ext.close()


class TestSymbolExtractor:
    """Test suite for SymbolExtractor."""

    def test_database_schema_creation(self, extractor):
        """Test that database tables and indexes are created correctly."""
        cursor = extractor.db_conn.cursor()

        # Check symbols table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='symbols'"
        )
        assert cursor.fetchone() is not None

        # Check symbol_relationships table exists
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='symbol_relationships'"
        )
        assert cursor.fetchone() is not None

        # Check indexes exist
        cursor.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'"
        )
        idx_count = cursor.fetchone()[0]
        assert idx_count == 5

    def test_python_function_extraction(self, extractor):
        """Test extracting functions from Python code."""
        code = """
def hello():
    pass

async def world():
    pass
"""
        symbols, _ = extractor.extract_from_file(Path("test.py"), code)

        assert len(symbols) == 2
        assert symbols[0]["name"] == "hello"
        assert symbols[0]["kind"] == "function"
        assert symbols[1]["name"] == "world"
        assert symbols[1]["kind"] == "function"

    def test_python_class_extraction(self, extractor):
        """Test extracting classes from Python code."""
        code = """
class MyClass:
    pass

class AnotherClass(BaseClass):
    pass
"""
        symbols, _ = extractor.extract_from_file(Path("test.py"), code)

        assert len(symbols) == 2
        assert symbols[0]["name"] == "MyClass"
        assert symbols[0]["kind"] == "class"
        assert symbols[1]["name"] == "AnotherClass"
        assert symbols[1]["kind"] == "class"

    def test_typescript_extraction(self, extractor):
        """Test extracting symbols from TypeScript code."""
        code = """
export function calculateSum(a: number, b: number): number {
    return a + b;
}

export class Calculator {
    multiply(x: number, y: number) {
        return x * y;
    }
}
"""
        symbols, _ = extractor.extract_from_file(Path("test.ts"), code)

        assert len(symbols) == 2
        assert symbols[0]["name"] == "calculateSum"
        assert symbols[0]["kind"] == "function"
        assert symbols[1]["name"] == "Calculator"
        assert symbols[1]["kind"] == "class"

    def test_javascript_extraction(self, extractor):
        """Test extracting symbols from JavaScript code."""
        code = """
function processData(data) {
    return data;
}

class DataProcessor {
    transform(input) {
        return input;
    }
}
"""
        symbols, _ = extractor.extract_from_file(Path("test.js"), code)

        assert len(symbols) == 2
        assert symbols[0]["name"] == "processData"
        assert symbols[1]["name"] == "DataProcessor"

    def test_relationship_extraction(self, extractor):
        """Test extracting relationships between symbols."""
        code = """
def helper():
    pass

def main():
    helper()
    print("done")
"""
        _, relationships = extractor.extract_from_file(Path("test.py"), code)

        # Should find calls to helper and print
        call_targets = [r["target"] for r in relationships if r["type"] == "calls"]
        assert "helper" in call_targets

    def test_save_and_query_symbols(self, extractor):
        """Test saving symbols to database and querying them."""
        code = """
def test_func():
    pass

class TestClass:
    pass
"""
        symbols, _ = extractor.extract_from_file(Path("test.py"), code)
        name_to_id = extractor.save_symbols(symbols)

        assert len(name_to_id) == 2
        assert "test_func" in name_to_id
        assert "TestClass" in name_to_id

        # Query database
        cursor = extractor.db_conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM symbols")
        count = cursor.fetchone()[0]
        assert count == 2

    def test_save_relationships(self, extractor):
        """Test saving relationships to database."""
        code = """
def caller():
    callee()

def callee():
    pass
"""
        symbols, relationships = extractor.extract_from_file(Path("test.py"), code)
        name_to_id = extractor.save_symbols(symbols)
        extractor.save_relationships(relationships, name_to_id)

        # Query database
        cursor = extractor.db_conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM symbol_relationships")
        count = cursor.fetchone()[0]
        assert count > 0

    def test_qualified_name_generation(self, extractor):
        """Test that qualified names are generated correctly."""
        code = """
class MyClass:
    pass
"""
        symbols, _ = extractor.extract_from_file(Path("module.py"), code)

        assert symbols[0]["qualified_name"] == "module.MyClass"

    def test_unsupported_language(self, extractor):
        """Test that unsupported languages return empty results."""
        code = "some random code"
        symbols, relationships = extractor.extract_from_file(Path("test.txt"), code)

        assert len(symbols) == 0
        assert len(relationships) == 0

    def test_empty_file(self, extractor):
        """Test handling empty files."""
        symbols, relationships = extractor.extract_from_file(Path("test.py"), "")

        assert len(symbols) == 0
        assert len(relationships) == 0

    def test_complete_workflow(self, extractor):
        """Test complete workflow: extract, save, and verify."""
        code = """
class UserService:
    def get_user(self, user_id):
        return fetch_user(user_id)

def main():
    service = UserService()
    service.get_user(1)
"""
        file_path = Path("service.py")
        symbols, relationships = extractor.extract_from_file(file_path, code)

        # Save to database
        name_to_id = extractor.save_symbols(symbols)
        extractor.save_relationships(relationships, name_to_id)

        # Verify symbols
        cursor = extractor.db_conn.cursor()
        cursor.execute("SELECT name, kind FROM symbols ORDER BY start_line")
        db_symbols = cursor.fetchall()
        assert len(db_symbols) == 2
        assert db_symbols[0][0] == "UserService"
        assert db_symbols[1][0] == "main"

        # Verify relationships
        cursor.execute(
            """
            SELECT s.name, r.target_symbol_fqn, r.relationship_type
            FROM symbol_relationships r
            JOIN symbols s ON r.source_symbol_id = s.id
            """
        )
        db_rels = cursor.fetchall()
        assert len(db_rels) > 0
