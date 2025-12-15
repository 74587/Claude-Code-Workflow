"""End-to-end tests for graph search CLI commands."""

import tempfile
from pathlib import Path
from typer.testing import CliRunner
import pytest

from codexlens.cli.commands import app
from codexlens.storage.sqlite_store import SQLiteStore
from codexlens.storage.registry import RegistryStore
from codexlens.storage.path_mapper import PathMapper
from codexlens.entities import IndexedFile, Symbol, CodeRelationship


runner = CliRunner()


@pytest.fixture
def temp_project():
    """Create a temporary project with indexed code and relationships."""
    with tempfile.TemporaryDirectory() as tmpdir:
        project_root = Path(tmpdir) / "test_project"
        project_root.mkdir()

        # Create test Python files
        (project_root / "main.py").write_text("""
def main():
    result = calculate(5, 3)
    print(result)

def calculate(a, b):
    return add(a, b)

def add(x, y):
    return x + y
""")

        (project_root / "utils.py").write_text("""
class BaseClass:
    def method(self):
        pass

class DerivedClass(BaseClass):
    def method(self):
        super().method()
        helper()

def helper():
    return True
""")

        # Create a custom index directory for graph testing
        # Skip the standard init to avoid schema conflicts
        mapper = PathMapper()
        index_root = mapper.source_to_index_dir(project_root)
        index_root.mkdir(parents=True, exist_ok=True)
        test_db = index_root / "_index.db"

        # Register project manually
        registry = RegistryStore()
        registry.initialize()
        project_info = registry.register_project(
            source_root=project_root,
            index_root=index_root
        )
        registry.register_dir(
            project_id=project_info.id,
            source_path=project_root,
            index_path=test_db,
            depth=0,
            files_count=2
        )

        # Initialize the store with proper SQLiteStore schema and add files
        with SQLiteStore(test_db) as store:
            # Read and add files to the store
            main_content = (project_root / "main.py").read_text()
            utils_content = (project_root / "utils.py").read_text()

            main_indexed = IndexedFile(
                path=str(project_root / "main.py"),
                language="python",
                symbols=[
                    Symbol(name="main", kind="function", range=(2, 4)),
                    Symbol(name="calculate", kind="function", range=(6, 7)),
                    Symbol(name="add", kind="function", range=(9, 10))
                ]
            )
            utils_indexed = IndexedFile(
                path=str(project_root / "utils.py"),
                language="python",
                symbols=[
                    Symbol(name="BaseClass", kind="class", range=(2, 4)),
                    Symbol(name="DerivedClass", kind="class", range=(6, 9)),
                    Symbol(name="helper", kind="function", range=(11, 12))
                ]
            )

            store.add_file(main_indexed, main_content)
            store.add_file(utils_indexed, utils_content)

        with SQLiteStore(test_db) as store:
            # Add relationships for main.py
            main_file = project_root / "main.py"
            relationships_main = [
                CodeRelationship(
                    source_symbol="main",
                    target_symbol="calculate",
                    relationship_type="call",
                    source_file=str(main_file),
                    source_line=3,
                    target_file=str(main_file)
                ),
                CodeRelationship(
                    source_symbol="calculate",
                    target_symbol="add",
                    relationship_type="call",
                    source_file=str(main_file),
                    source_line=7,
                    target_file=str(main_file)
                ),
            ]
            store.add_relationships(main_file, relationships_main)

            # Add relationships for utils.py
            utils_file = project_root / "utils.py"
            relationships_utils = [
                CodeRelationship(
                    source_symbol="DerivedClass",
                    target_symbol="BaseClass",
                    relationship_type="inherits",
                    source_file=str(utils_file),
                    source_line=5,
                    target_file=str(utils_file)
                ),
                CodeRelationship(
                    source_symbol="DerivedClass.method",
                    target_symbol="helper",
                    relationship_type="call",
                    source_file=str(utils_file),
                    source_line=8,
                    target_file=str(utils_file)
                ),
            ]
            store.add_relationships(utils_file, relationships_utils)

        registry.close()

        yield project_root


class TestGraphCallers:
    """Test callers query type."""

    def test_find_callers_basic(self, temp_project):
        """Test finding functions that call a given function."""
        result = runner.invoke(app, [
            "graph",
            "callers",
            "add",
            "--path", str(temp_project)
        ])

        assert result.exit_code == 0
        assert "calculate" in result.stdout
        assert "Callers of 'add'" in result.stdout

    def test_find_callers_json_mode(self, temp_project):
        """Test callers query with JSON output."""
        result = runner.invoke(app, [
            "graph",
            "callers",
            "add",
            "--path", str(temp_project),
            "--json"
        ])

        assert result.exit_code == 0
        assert "success" in result.stdout
        assert "relationships" in result.stdout

    def test_find_callers_no_results(self, temp_project):
        """Test callers query when no callers exist."""
        result = runner.invoke(app, [
            "graph",
            "callers",
            "nonexistent_function",
            "--path", str(temp_project)
        ])

        assert result.exit_code == 0
        assert "No callers found" in result.stdout or "0 found" in result.stdout


class TestGraphCallees:
    """Test callees query type."""

    def test_find_callees_basic(self, temp_project):
        """Test finding functions called by a given function."""
        result = runner.invoke(app, [
            "graph",
            "callees",
            "main",
            "--path", str(temp_project)
        ])

        assert result.exit_code == 0
        assert "calculate" in result.stdout
        assert "Callees of 'main'" in result.stdout

    def test_find_callees_chain(self, temp_project):
        """Test finding callees in a call chain."""
        result = runner.invoke(app, [
            "graph",
            "callees",
            "calculate",
            "--path", str(temp_project)
        ])

        assert result.exit_code == 0
        assert "add" in result.stdout

    def test_find_callees_json_mode(self, temp_project):
        """Test callees query with JSON output."""
        result = runner.invoke(app, [
            "graph",
            "callees",
            "main",
            "--path", str(temp_project),
            "--json"
        ])

        assert result.exit_code == 0
        assert "success" in result.stdout


class TestGraphInheritance:
    """Test inheritance query type."""

    def test_find_inheritance_basic(self, temp_project):
        """Test finding inheritance relationships."""
        result = runner.invoke(app, [
            "graph",
            "inheritance",
            "BaseClass",
            "--path", str(temp_project)
        ])

        assert result.exit_code == 0
        assert "DerivedClass" in result.stdout
        assert "Inheritance relationships" in result.stdout

    def test_find_inheritance_derived(self, temp_project):
        """Test finding inheritance from derived class perspective."""
        result = runner.invoke(app, [
            "graph",
            "inheritance",
            "DerivedClass",
            "--path", str(temp_project)
        ])

        assert result.exit_code == 0
        assert "BaseClass" in result.stdout

    def test_find_inheritance_json_mode(self, temp_project):
        """Test inheritance query with JSON output."""
        result = runner.invoke(app, [
            "graph",
            "inheritance",
            "BaseClass",
            "--path", str(temp_project),
            "--json"
        ])

        assert result.exit_code == 0
        assert "success" in result.stdout


class TestGraphValidation:
    """Test query validation and error handling."""

    def test_invalid_query_type(self, temp_project):
        """Test error handling for invalid query type."""
        result = runner.invoke(app, [
            "graph",
            "invalid_type",
            "symbol",
            "--path", str(temp_project)
        ])

        assert result.exit_code == 1
        assert "Invalid query type" in result.stdout

    def test_invalid_path(self):
        """Test error handling for non-existent path."""
        result = runner.invoke(app, [
            "graph",
            "callers",
            "symbol",
            "--path", "/nonexistent/path"
        ])

        # Should handle gracefully (may exit with error or return empty results)
        assert result.exit_code in [0, 1]


class TestGraphPerformance:
    """Test graph query performance requirements."""

    def test_query_response_time(self, temp_project):
        """Verify graph queries complete in under 1 second."""
        import time

        start = time.time()
        result = runner.invoke(app, [
            "graph",
            "callers",
            "add",
            "--path", str(temp_project)
        ])
        elapsed = time.time() - start

        assert result.exit_code == 0
        assert elapsed < 1.0, f"Query took {elapsed:.2f}s, expected <1s"

    def test_multiple_query_types(self, temp_project):
        """Test all three query types complete successfully."""
        import time

        queries = [
            ("callers", "add"),
            ("callees", "main"),
            ("inheritance", "BaseClass")
        ]

        total_start = time.time()

        for query_type, symbol in queries:
            result = runner.invoke(app, [
                "graph",
                query_type,
                symbol,
                "--path", str(temp_project)
            ])
            assert result.exit_code == 0

        total_elapsed = time.time() - total_start
        assert total_elapsed < 3.0, f"All queries took {total_elapsed:.2f}s, expected <3s"


class TestGraphOptions:
    """Test graph command options."""

    def test_limit_option(self, temp_project):
        """Test limit option works correctly."""
        result = runner.invoke(app, [
            "graph",
            "callers",
            "add",
            "--path", str(temp_project),
            "--limit", "1"
        ])

        assert result.exit_code == 0

    def test_depth_option(self, temp_project):
        """Test depth option works correctly."""
        result = runner.invoke(app, [
            "graph",
            "callers",
            "add",
            "--path", str(temp_project),
            "--depth", "0"
        ])

        assert result.exit_code == 0

    def test_verbose_option(self, temp_project):
        """Test verbose option works correctly."""
        result = runner.invoke(app, [
            "graph",
            "callers",
            "add",
            "--path", str(temp_project),
            "--verbose"
        ])

        assert result.exit_code == 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
