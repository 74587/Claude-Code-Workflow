"""Tests for GraphAnalyzer - code relationship extraction."""

from pathlib import Path

import pytest

from codexlens.semantic.graph_analyzer import GraphAnalyzer


TREE_SITTER_PYTHON_AVAILABLE = True
try:
    import tree_sitter_python  # type: ignore[import-not-found]  # noqa: F401
except Exception:
    TREE_SITTER_PYTHON_AVAILABLE = False


TREE_SITTER_JS_AVAILABLE = True
try:
    import tree_sitter_javascript  # type: ignore[import-not-found]  # noqa: F401
except Exception:
    TREE_SITTER_JS_AVAILABLE = False


@pytest.mark.skipif(not TREE_SITTER_PYTHON_AVAILABLE, reason="tree-sitter-python not installed")
class TestPythonGraphAnalyzer:
    """Tests for Python relationship extraction."""

    def test_simple_function_call(self):
        """Test extraction of simple function call."""
        code = """def helper():
    pass

def main():
    helper()
"""
        analyzer = GraphAnalyzer("python")
        relationships = analyzer.analyze_file(code, Path("test.py"))

        # Should find main -> helper call
        assert len(relationships) == 1
        rel = relationships[0]
        assert rel.source_symbol == "main"
        assert rel.target_symbol == "helper"
        assert rel.relationship_type == "call"
        assert rel.source_line == 5

    def test_multiple_calls_in_function(self):
        """Test extraction of multiple calls from same function."""
        code = """def foo():
    pass

def bar():
    pass

def main():
    foo()
    bar()
"""
        analyzer = GraphAnalyzer("python")
        relationships = analyzer.analyze_file(code, Path("test.py"))

        # Should find main -> foo and main -> bar
        assert len(relationships) == 2
        targets = {rel.target_symbol for rel in relationships}
        assert targets == {"foo", "bar"}
        assert all(rel.source_symbol == "main" for rel in relationships)

    def test_nested_function_calls(self):
        """Test extraction of calls from nested functions."""
        code = """def inner_helper():
    pass

def outer():
    def inner():
        inner_helper()
    inner()
"""
        analyzer = GraphAnalyzer("python")
        relationships = analyzer.analyze_file(code, Path("test.py"))

        # Should find outer.inner -> inner_helper and outer -> inner (with fully qualified names)
        assert len(relationships) == 2
        call_pairs = {(rel.source_symbol, rel.target_symbol) for rel in relationships}
        assert ("outer.inner", "inner_helper") in call_pairs
        assert ("outer", "inner") in call_pairs

    def test_method_call_in_class(self):
        """Test extraction of method calls within class."""
        code = """class Calculator:
    def add(self, a, b):
        return a + b

    def compute(self, x, y):
        result = self.add(x, y)
        return result
"""
        analyzer = GraphAnalyzer("python")
        relationships = analyzer.analyze_file(code, Path("test.py"))

        # Should find Calculator.compute -> add (with fully qualified source)
        assert len(relationships) == 1
        rel = relationships[0]
        assert rel.source_symbol == "Calculator.compute"
        assert rel.target_symbol == "add"

    def test_module_level_call(self):
        """Test extraction of module-level function calls."""
        code = """def setup():
    pass

setup()
"""
        analyzer = GraphAnalyzer("python")
        relationships = analyzer.analyze_file(code, Path("test.py"))

        # Should find <module> -> setup
        assert len(relationships) == 1
        rel = relationships[0]
        assert rel.source_symbol == "<module>"
        assert rel.target_symbol == "setup"

    def test_async_function_call(self):
        """Test extraction of calls involving async functions."""
        code = """async def fetch_data():
    pass

async def process():
    await fetch_data()
"""
        analyzer = GraphAnalyzer("python")
        relationships = analyzer.analyze_file(code, Path("test.py"))

        # Should find process -> fetch_data
        assert len(relationships) == 1
        rel = relationships[0]
        assert rel.source_symbol == "process"
        assert rel.target_symbol == "fetch_data"

    def test_complex_python_file(self):
        """Test extraction from realistic Python file with multiple patterns."""
        code = """class DataProcessor:
    def __init__(self):
        self.data = []

    def load(self, filename):
        self.data = read_file(filename)

    def process(self):
        self.validate()
        self.transform()

    def validate(self):
        pass

    def transform(self):
        pass

def read_file(filename):
    pass

def main():
    processor = DataProcessor()
    processor.load("data.txt")
    processor.process()

main()
"""
        analyzer = GraphAnalyzer("python")
        relationships = analyzer.analyze_file(code, Path("test.py"))

        # Extract call pairs
        call_pairs = {(rel.source_symbol, rel.target_symbol) for rel in relationships}

        # Expected relationships (with fully qualified source symbols for methods)
        expected = {
            ("DataProcessor.load", "read_file"),
            ("DataProcessor.process", "validate"),
            ("DataProcessor.process", "transform"),
            ("main", "DataProcessor"),
            ("main", "load"),
            ("main", "process"),
            ("<module>", "main"),
        }

        # Should find all expected relationships
        assert call_pairs >= expected

    def test_empty_file(self):
        """Test handling of empty file."""
        code = ""
        analyzer = GraphAnalyzer("python")
        relationships = analyzer.analyze_file(code, Path("test.py"))
        assert len(relationships) == 0

    def test_file_with_no_calls(self):
        """Test handling of file with definitions but no calls."""
        code = """def func1():
    pass

def func2():
    pass
"""
        analyzer = GraphAnalyzer("python")
        relationships = analyzer.analyze_file(code, Path("test.py"))
        assert len(relationships) == 0


@pytest.mark.skipif(not TREE_SITTER_JS_AVAILABLE, reason="tree-sitter-javascript not installed")
class TestJavaScriptGraphAnalyzer:
    """Tests for JavaScript relationship extraction."""

    def test_simple_function_call(self):
        """Test extraction of simple JavaScript function call."""
        code = """function helper() {}

function main() {
    helper();
}
"""
        analyzer = GraphAnalyzer("javascript")
        relationships = analyzer.analyze_file(code, Path("test.js"))

        # Should find main -> helper call
        assert len(relationships) == 1
        rel = relationships[0]
        assert rel.source_symbol == "main"
        assert rel.target_symbol == "helper"
        assert rel.relationship_type == "call"

    def test_arrow_function_call(self):
        """Test extraction of calls from arrow functions."""
        code = """const helper = () => {};

const main = () => {
    helper();
};
"""
        analyzer = GraphAnalyzer("javascript")
        relationships = analyzer.analyze_file(code, Path("test.js"))

        # Should find main -> helper call
        assert len(relationships) == 1
        rel = relationships[0]
        assert rel.source_symbol == "main"
        assert rel.target_symbol == "helper"

    def test_class_method_call(self):
        """Test extraction of method calls in JavaScript class."""
        code = """class Calculator {
    add(a, b) {
        return a + b;
    }

    compute(x, y) {
        return this.add(x, y);
    }
}
"""
        analyzer = GraphAnalyzer("javascript")
        relationships = analyzer.analyze_file(code, Path("test.js"))

        # Should find Calculator.compute -> add (with fully qualified source)
        assert len(relationships) == 1
        rel = relationships[0]
        assert rel.source_symbol == "Calculator.compute"
        assert rel.target_symbol == "add"

    def test_complex_javascript_file(self):
        """Test extraction from realistic JavaScript file."""
        code = """function readFile(filename) {
    return "";
}

class DataProcessor {
    constructor() {
        this.data = [];
    }

    load(filename) {
        this.data = readFile(filename);
    }

    process() {
        this.validate();
        this.transform();
    }

    validate() {}

    transform() {}
}

function main() {
    const processor = new DataProcessor();
    processor.load("data.txt");
    processor.process();
}

main();
"""
        analyzer = GraphAnalyzer("javascript")
        relationships = analyzer.analyze_file(code, Path("test.js"))

        # Extract call pairs
        call_pairs = {(rel.source_symbol, rel.target_symbol) for rel in relationships}

        # Expected relationships (with fully qualified source symbols for methods)
        # Note: constructor calls like "new DataProcessor()" are not tracked
        expected = {
            ("DataProcessor.load", "readFile"),
            ("DataProcessor.process", "validate"),
            ("DataProcessor.process", "transform"),
            ("main", "load"),
            ("main", "process"),
            ("<module>", "main"),
        }

        # Should find all expected relationships
        assert call_pairs >= expected


class TestGraphAnalyzerEdgeCases:
    """Edge case tests for GraphAnalyzer."""

    @pytest.mark.skipif(not TREE_SITTER_PYTHON_AVAILABLE, reason="tree-sitter-python not installed")
    def test_unavailable_language(self):
        """Test handling of unsupported language."""
        code = "some code"
        analyzer = GraphAnalyzer("rust")
        relationships = analyzer.analyze_file(code, Path("test.rs"))
        assert len(relationships) == 0

    @pytest.mark.skipif(not TREE_SITTER_PYTHON_AVAILABLE, reason="tree-sitter-python not installed")
    def test_malformed_python_code(self):
        """Test handling of malformed Python code."""
        code = "def broken(\n    pass"
        analyzer = GraphAnalyzer("python")
        # Should not crash
        relationships = analyzer.analyze_file(code, Path("test.py"))
        assert isinstance(relationships, list)

    @pytest.mark.skipif(not TREE_SITTER_PYTHON_AVAILABLE, reason="tree-sitter-python not installed")
    def test_file_path_in_relationship(self):
        """Test that file path is correctly set in relationships."""
        code = """def foo():
    pass

def bar():
    foo()
"""
        test_path = Path("test.py")
        analyzer = GraphAnalyzer("python")
        relationships = analyzer.analyze_file(code, test_path)

        assert len(relationships) == 1
        rel = relationships[0]
        assert rel.source_file == str(test_path.resolve())
        assert rel.target_file is None  # Intra-file

    @pytest.mark.skipif(not TREE_SITTER_PYTHON_AVAILABLE, reason="tree-sitter-python not installed")
    def test_performance_large_file(self):
        """Test performance on larger file (1000 lines)."""
        import time

        # Generate file with many functions and calls
        lines = []
        for i in range(100):
            lines.append(f"def func_{i}():")
            if i > 0:
                lines.append(f"    func_{i-1}()")
            else:
                lines.append("    pass")

        code = "\n".join(lines)

        analyzer = GraphAnalyzer("python")
        start_time = time.time()
        relationships = analyzer.analyze_file(code, Path("test.py"))
        elapsed_ms = (time.time() - start_time) * 1000

        # Should complete in under 500ms
        assert elapsed_ms < 500

        # Should find 99 calls (func_1 -> func_0, func_2 -> func_1, ...)
        assert len(relationships) == 99

    @pytest.mark.skipif(not TREE_SITTER_PYTHON_AVAILABLE, reason="tree-sitter-python not installed")
    def test_call_accuracy_rate(self):
        """Test >95% accuracy on known call graph."""
        code = """def a(): pass
def b(): pass
def c(): pass
def d(): pass
def e(): pass

def test1():
    a()
    b()

def test2():
    c()
    d()

def test3():
    e()

def main():
    test1()
    test2()
    test3()
"""
        analyzer = GraphAnalyzer("python")
        relationships = analyzer.analyze_file(code, Path("test.py"))

        # Expected calls: test1->a, test1->b, test2->c, test2->d, test3->e, main->test1, main->test2, main->test3
        expected_calls = {
            ("test1", "a"),
            ("test1", "b"),
            ("test2", "c"),
            ("test2", "d"),
            ("test3", "e"),
            ("main", "test1"),
            ("main", "test2"),
            ("main", "test3"),
        }

        found_calls = {(rel.source_symbol, rel.target_symbol) for rel in relationships}

        # Calculate accuracy
        correct = len(expected_calls & found_calls)
        total = len(expected_calls)
        accuracy = (correct / total) * 100 if total > 0 else 0

        # Should have >95% accuracy
        assert accuracy >= 95.0
        assert correct == total  # Should be 100% for this simple case
