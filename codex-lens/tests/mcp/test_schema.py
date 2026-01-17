"""Tests for MCP schema."""

import pytest
import json

from codexlens.mcp.schema import (
    MCPContext,
    SymbolInfo,
    ReferenceInfo,
    RelatedSymbol,
)


class TestSymbolInfo:
    """Test SymbolInfo dataclass."""

    def test_to_dict_includes_all_fields(self):
        """SymbolInfo.to_dict() includes all non-None fields."""
        info = SymbolInfo(
            name="func",
            kind="function",
            file_path="/test.py",
            line_start=10,
            line_end=20,
            signature="def func():",
            documentation="Test doc",
        )
        d = info.to_dict()
        assert d["name"] == "func"
        assert d["kind"] == "function"
        assert d["file_path"] == "/test.py"
        assert d["line_start"] == 10
        assert d["line_end"] == 20
        assert d["signature"] == "def func():"
        assert d["documentation"] == "Test doc"

    def test_to_dict_excludes_none(self):
        """SymbolInfo.to_dict() excludes None fields."""
        info = SymbolInfo(
            name="func",
            kind="function",
            file_path="/test.py",
            line_start=10,
            line_end=20,
        )
        d = info.to_dict()
        assert "signature" not in d
        assert "documentation" not in d
        assert "name" in d
        assert "kind" in d

    def test_basic_creation(self):
        """SymbolInfo can be created with required fields only."""
        info = SymbolInfo(
            name="MyClass",
            kind="class",
            file_path="/src/module.py",
            line_start=1,
            line_end=50,
        )
        assert info.name == "MyClass"
        assert info.kind == "class"
        assert info.signature is None
        assert info.documentation is None


class TestReferenceInfo:
    """Test ReferenceInfo dataclass."""

    def test_to_dict(self):
        """ReferenceInfo.to_dict() returns all fields."""
        ref = ReferenceInfo(
            file_path="/src/main.py",
            line=25,
            column=4,
            context="result = func()",
            relationship_type="call",
        )
        d = ref.to_dict()
        assert d["file_path"] == "/src/main.py"
        assert d["line"] == 25
        assert d["column"] == 4
        assert d["context"] == "result = func()"
        assert d["relationship_type"] == "call"

    def test_all_fields_required(self):
        """ReferenceInfo requires all fields."""
        ref = ReferenceInfo(
            file_path="/test.py",
            line=10,
            column=0,
            context="import module",
            relationship_type="import",
        )
        assert ref.file_path == "/test.py"
        assert ref.relationship_type == "import"


class TestRelatedSymbol:
    """Test RelatedSymbol dataclass."""

    def test_to_dict_includes_all_fields(self):
        """RelatedSymbol.to_dict() includes all non-None fields."""
        sym = RelatedSymbol(
            name="BaseClass",
            kind="class",
            relationship="inherits",
            file_path="/src/base.py",
        )
        d = sym.to_dict()
        assert d["name"] == "BaseClass"
        assert d["kind"] == "class"
        assert d["relationship"] == "inherits"
        assert d["file_path"] == "/src/base.py"

    def test_to_dict_excludes_none(self):
        """RelatedSymbol.to_dict() excludes None file_path."""
        sym = RelatedSymbol(
            name="helper",
            kind="function",
            relationship="calls",
        )
        d = sym.to_dict()
        assert "file_path" not in d
        assert d["name"] == "helper"
        assert d["relationship"] == "calls"


class TestMCPContext:
    """Test MCPContext dataclass."""

    def test_to_dict_basic(self):
        """MCPContext.to_dict() returns basic structure."""
        ctx = MCPContext(context_type="test")
        d = ctx.to_dict()
        assert d["version"] == "1.0"
        assert d["context_type"] == "test"
        assert d["metadata"] == {}

    def test_to_dict_with_symbol(self):
        """MCPContext.to_dict() includes symbol when present."""
        ctx = MCPContext(
            context_type="test",
            symbol=SymbolInfo("f", "function", "/t.py", 1, 2),
        )
        d = ctx.to_dict()
        assert "symbol" in d
        assert d["symbol"]["name"] == "f"
        assert d["symbol"]["kind"] == "function"

    def test_to_dict_with_references(self):
        """MCPContext.to_dict() includes references when present."""
        ctx = MCPContext(
            context_type="test",
            references=[
                ReferenceInfo("/a.py", 10, 0, "call()", "call"),
                ReferenceInfo("/b.py", 20, 5, "import x", "import"),
            ],
        )
        d = ctx.to_dict()
        assert "references" in d
        assert len(d["references"]) == 2
        assert d["references"][0]["line"] == 10

    def test_to_dict_with_related_symbols(self):
        """MCPContext.to_dict() includes related_symbols when present."""
        ctx = MCPContext(
            context_type="test",
            related_symbols=[
                RelatedSymbol("Base", "class", "inherits"),
                RelatedSymbol("helper", "function", "calls"),
            ],
        )
        d = ctx.to_dict()
        assert "related_symbols" in d
        assert len(d["related_symbols"]) == 2

    def test_to_json(self):
        """MCPContext.to_json() returns valid JSON."""
        ctx = MCPContext(context_type="test")
        j = ctx.to_json()
        parsed = json.loads(j)
        assert parsed["version"] == "1.0"
        assert parsed["context_type"] == "test"

    def test_to_json_with_indent(self):
        """MCPContext.to_json() respects indent parameter."""
        ctx = MCPContext(context_type="test")
        j = ctx.to_json(indent=4)
        # Check it's properly indented
        assert "    " in j

    def test_to_prompt_injection_basic(self):
        """MCPContext.to_prompt_injection() returns formatted string."""
        ctx = MCPContext(
            symbol=SymbolInfo("my_func", "function", "/test.py", 10, 20),
            definition="def my_func(): pass",
        )
        prompt = ctx.to_prompt_injection()
        assert "<code_context>" in prompt
        assert "my_func" in prompt
        assert "def my_func()" in prompt
        assert "</code_context>" in prompt

    def test_to_prompt_injection_with_references(self):
        """MCPContext.to_prompt_injection() includes references."""
        ctx = MCPContext(
            symbol=SymbolInfo("func", "function", "/test.py", 1, 5),
            references=[
                ReferenceInfo("/a.py", 10, 0, "func()", "call"),
                ReferenceInfo("/b.py", 20, 0, "from x import func", "import"),
            ],
        )
        prompt = ctx.to_prompt_injection()
        assert "References (2 found)" in prompt
        assert "/a.py:10" in prompt
        assert "call" in prompt

    def test_to_prompt_injection_limits_references(self):
        """MCPContext.to_prompt_injection() limits references to 5."""
        refs = [
            ReferenceInfo(f"/file{i}.py", i, 0, f"ref{i}", "call")
            for i in range(10)
        ]
        ctx = MCPContext(
            symbol=SymbolInfo("func", "function", "/test.py", 1, 5),
            references=refs,
        )
        prompt = ctx.to_prompt_injection()
        # Should show "10 found" but only include 5
        assert "References (10 found)" in prompt
        assert "/file0.py" in prompt
        assert "/file4.py" in prompt
        assert "/file5.py" not in prompt

    def test_to_prompt_injection_with_related_symbols(self):
        """MCPContext.to_prompt_injection() includes related symbols."""
        ctx = MCPContext(
            symbol=SymbolInfo("MyClass", "class", "/test.py", 1, 50),
            related_symbols=[
                RelatedSymbol("BaseClass", "class", "inherits"),
                RelatedSymbol("helper", "function", "calls"),
            ],
        )
        prompt = ctx.to_prompt_injection()
        assert "Related Symbols" in prompt
        assert "BaseClass (inherits)" in prompt
        assert "helper (calls)" in prompt

    def test_to_prompt_injection_limits_related_symbols(self):
        """MCPContext.to_prompt_injection() limits related symbols to 10."""
        related = [
            RelatedSymbol(f"sym{i}", "function", "calls")
            for i in range(15)
        ]
        ctx = MCPContext(
            symbol=SymbolInfo("func", "function", "/test.py", 1, 5),
            related_symbols=related,
        )
        prompt = ctx.to_prompt_injection()
        assert "sym0 (calls)" in prompt
        assert "sym9 (calls)" in prompt
        assert "sym10 (calls)" not in prompt

    def test_empty_context(self):
        """MCPContext works with minimal data."""
        ctx = MCPContext()
        d = ctx.to_dict()
        assert d["version"] == "1.0"
        assert d["context_type"] == "code_context"

        prompt = ctx.to_prompt_injection()
        assert "<code_context>" in prompt
        assert "</code_context>" in prompt

    def test_metadata_preserved(self):
        """MCPContext preserves custom metadata."""
        ctx = MCPContext(
            context_type="custom",
            metadata={
                "source": "codex-lens",
                "indexed_at": "2024-01-01",
                "custom_key": "custom_value",
            },
        )
        d = ctx.to_dict()
        assert d["metadata"]["source"] == "codex-lens"
        assert d["metadata"]["custom_key"] == "custom_value"
