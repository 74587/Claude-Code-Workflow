"""Tests for LLM-based semantic enhancement functionality.

Tests cover:
- LLMConfig and data classes
- LLMEnhancer initialization and configuration
- Prompt building and JSON parsing
- Batch processing logic
- CCW CLI invocation (mocked)
- EnhancedSemanticIndexer integration
- Error handling and fallback behavior
"""

import json
import tempfile
from pathlib import Path
from typing import Dict, Any
from unittest.mock import MagicMock, patch, PropertyMock

import pytest

from codexlens.entities import SemanticChunk, Symbol
from codexlens.semantic.llm_enhancer import (
    SemanticMetadata,
    FileData,
    LLMConfig,
    LLMEnhancer,
    EnhancedSemanticIndexer,
    create_enhancer,
    create_enhanced_indexer,
)


# === Data Class Tests ===

class TestSemanticMetadata:
    """Tests for SemanticMetadata dataclass."""

    def test_basic_creation(self):
        """Test creating SemanticMetadata with required fields."""
        metadata = SemanticMetadata(
            summary="Authentication handler",
            keywords=["auth", "login", "jwt"],
            purpose="auth",
        )
        assert metadata.summary == "Authentication handler"
        assert metadata.keywords == ["auth", "login", "jwt"]
        assert metadata.purpose == "auth"
        assert metadata.file_path is None
        assert metadata.symbol_name is None
        assert metadata.llm_tool is None

    def test_full_creation(self):
        """Test creating SemanticMetadata with all fields."""
        metadata = SemanticMetadata(
            summary="User login function",
            keywords=["login", "user"],
            purpose="auth",
            file_path="/test/auth.py",
            symbol_name="login",
            llm_tool="gemini",
        )
        assert metadata.file_path == "/test/auth.py"
        assert metadata.symbol_name == "login"
        assert metadata.llm_tool == "gemini"

    def test_empty_keywords(self):
        """Test creating SemanticMetadata with empty keywords."""
        metadata = SemanticMetadata(
            summary="Empty",
            keywords=[],
            purpose="",
        )
        assert metadata.keywords == []


class TestFileData:
    """Tests for FileData dataclass."""

    def test_basic_creation(self):
        """Test creating FileData with required fields."""
        data = FileData(
            path="/test/file.py",
            content="def hello(): pass",
            language="python",
        )
        assert data.path == "/test/file.py"
        assert data.content == "def hello(): pass"
        assert data.language == "python"
        assert data.symbols == []

    def test_with_symbols(self):
        """Test creating FileData with symbols."""
        symbols = [
            Symbol(name="hello", kind="function", range=(1, 1)),
            Symbol(name="MyClass", kind="class", range=(3, 10)),
        ]
        data = FileData(
            path="/test/file.py",
            content="code",
            language="python",
            symbols=symbols,
        )
        assert len(data.symbols) == 2
        assert data.symbols[0].name == "hello"


class TestLLMConfig:
    """Tests for LLMConfig dataclass."""

    def test_default_values(self):
        """Test default configuration values."""
        config = LLMConfig()
        assert config.tool == "gemini"
        assert config.fallback_tool == "qwen"
        assert config.timeout_ms == 300000
        assert config.batch_size == 5
        assert config.max_content_chars == 8000
        assert config.enabled is True

    def test_custom_values(self):
        """Test custom configuration values."""
        config = LLMConfig(
            tool="qwen",
            fallback_tool="gemini",
            timeout_ms=600000,
            batch_size=10,
            max_content_chars=4000,
            enabled=False,
        )
        assert config.tool == "qwen"
        assert config.fallback_tool == "gemini"
        assert config.timeout_ms == 600000
        assert config.batch_size == 10
        assert config.max_content_chars == 4000
        assert config.enabled is False

    @patch.dict("os.environ", {"CCW_CLI_SECONDARY_TOOL": "codex", "CCW_CLI_FALLBACK_TOOL": "gemini"})
    def test_env_override(self):
        """Test environment variable override."""
        config = LLMConfig()
        assert config.tool == "codex"
        assert config.fallback_tool == "gemini"


# === LLMEnhancer Tests ===

class TestLLMEnhancerInit:
    """Tests for LLMEnhancer initialization."""

    def test_default_init(self):
        """Test default initialization."""
        enhancer = LLMEnhancer()
        assert enhancer.config is not None
        assert enhancer.config.tool == "gemini"
        assert enhancer._ccw_available is None

    def test_custom_config(self):
        """Test initialization with custom config."""
        config = LLMConfig(tool="qwen", batch_size=3)
        enhancer = LLMEnhancer(config)
        assert enhancer.config.tool == "qwen"
        assert enhancer.config.batch_size == 3


class TestLLMEnhancerAvailability:
    """Tests for CCW CLI availability check."""

    @patch("shutil.which")
    def test_ccw_available(self, mock_which):
        """Test CCW available returns True."""
        mock_which.return_value = "/usr/bin/ccw"
        enhancer = LLMEnhancer()

        result = enhancer.check_available()

        assert result is True
        assert enhancer._ccw_available is True
        mock_which.assert_called_with("ccw")

    @patch("shutil.which")
    def test_ccw_not_available(self, mock_which):
        """Test CCW not available returns False."""
        mock_which.return_value = None
        enhancer = LLMEnhancer()

        result = enhancer.check_available()

        assert result is False
        assert enhancer._ccw_available is False

    @patch("shutil.which")
    def test_ccw_availability_cached(self, mock_which):
        """Test availability result is cached."""
        mock_which.return_value = "/usr/bin/ccw"
        enhancer = LLMEnhancer()

        # First call
        enhancer.check_available()
        # Second call
        enhancer.check_available()

        # which should only be called once
        mock_which.assert_called_once()


class TestPromptBuilding:
    """Tests for prompt building."""

    def test_build_single_file_prompt(self):
        """Test prompt building with single file."""
        enhancer = LLMEnhancer()
        files = [
            FileData(
                path="/test/auth.py",
                content="def login(): pass",
                language="python",
            )
        ]

        prompt = enhancer._build_batch_prompt(files)

        assert "[FILE: /test/auth.py]" in prompt
        assert "```python" in prompt
        assert "def login(): pass" in prompt
        assert "PURPOSE:" in prompt
        assert "JSON format output" in prompt

    def test_build_multiple_files_prompt(self):
        """Test prompt building with multiple files."""
        enhancer = LLMEnhancer()
        files = [
            FileData(path="/test/a.py", content="def a(): pass", language="python"),
            FileData(path="/test/b.js", content="function b() {}", language="javascript"),
        ]

        prompt = enhancer._build_batch_prompt(files)

        assert "[FILE: /test/a.py]" in prompt
        assert "[FILE: /test/b.js]" in prompt
        assert "```python" in prompt
        assert "```javascript" in prompt

    def test_build_prompt_truncates_long_content(self):
        """Test prompt truncates long content."""
        config = LLMConfig(max_content_chars=100)
        enhancer = LLMEnhancer(config)

        long_content = "x" * 200
        files = [FileData(path="/test/long.py", content=long_content, language="python")]

        prompt = enhancer._build_batch_prompt(files)

        assert "... [truncated]" in prompt
        assert "x" * 200 not in prompt


class TestJSONParsing:
    """Tests for JSON response parsing."""

    def test_parse_valid_response(self):
        """Test parsing valid JSON response."""
        enhancer = LLMEnhancer()
        response = json.dumps({
            "files": {
                "/test/auth.py": {
                    "summary": "Authentication handler",
                    "keywords": ["auth", "login"],
                    "purpose": "auth",
                }
            }
        })

        result = enhancer._parse_response(response, "gemini")

        assert "/test/auth.py" in result
        assert result["/test/auth.py"].summary == "Authentication handler"
        assert result["/test/auth.py"].keywords == ["auth", "login"]
        assert result["/test/auth.py"].purpose == "auth"
        assert result["/test/auth.py"].llm_tool == "gemini"

    def test_parse_response_with_markdown(self):
        """Test parsing response wrapped in markdown."""
        enhancer = LLMEnhancer()
        response = '''```json
{
    "files": {
        "/test/file.py": {
            "summary": "Test file",
            "keywords": ["test"],
            "purpose": "test"
        }
    }
}
```'''

        result = enhancer._parse_response(response, "qwen")

        assert "/test/file.py" in result
        assert result["/test/file.py"].summary == "Test file"

    def test_parse_response_multiple_files(self):
        """Test parsing response with multiple files."""
        enhancer = LLMEnhancer()
        response = json.dumps({
            "files": {
                "/test/a.py": {"summary": "File A", "keywords": ["a"], "purpose": "util"},
                "/test/b.py": {"summary": "File B", "keywords": ["b"], "purpose": "api"},
            }
        })

        result = enhancer._parse_response(response, "gemini")

        assert len(result) == 2
        assert result["/test/a.py"].summary == "File A"
        assert result["/test/b.py"].summary == "File B"

    def test_parse_invalid_json(self):
        """Test parsing invalid JSON returns empty dict."""
        enhancer = LLMEnhancer()
        response = "not valid json at all"

        result = enhancer._parse_response(response, "gemini")

        assert result == {}

    def test_parse_empty_response(self):
        """Test parsing empty response returns empty dict."""
        enhancer = LLMEnhancer()

        result = enhancer._parse_response("", "gemini")

        assert result == {}


class TestJSONExtraction:
    """Tests for JSON extraction from mixed text."""

    def test_extract_json_from_plain(self):
        """Test extracting JSON from plain text."""
        enhancer = LLMEnhancer()
        text = '{"key": "value"}'

        result = enhancer._extract_json(text)

        assert result == '{"key": "value"}'

    def test_extract_json_from_markdown(self):
        """Test extracting JSON from markdown code block."""
        enhancer = LLMEnhancer()
        text = '''```json
{"key": "value"}
```'''

        result = enhancer._extract_json(text)

        assert result == '{"key": "value"}'

    def test_extract_json_with_surrounding_text(self):
        """Test extracting JSON with surrounding text."""
        enhancer = LLMEnhancer()
        text = 'Here is the result: {"key": "value"} That is all.'

        result = enhancer._extract_json(text)

        assert result == '{"key": "value"}'

    def test_extract_nested_json(self):
        """Test extracting nested JSON."""
        enhancer = LLMEnhancer()
        text = '{"outer": {"inner": "value"}}'

        result = enhancer._extract_json(text)

        assert '"outer"' in result
        assert '"inner"' in result

    def test_extract_no_json(self):
        """Test extracting from text without JSON."""
        enhancer = LLMEnhancer()
        text = "No JSON here at all"

        result = enhancer._extract_json(text)

        assert result is None

    def test_extract_malformed_json(self):
        """Test extracting malformed JSON returns None."""
        enhancer = LLMEnhancer()
        text = '{"key": "value"'  # Missing closing brace

        result = enhancer._extract_json(text)

        assert result is None


class TestEnhanceFiles:
    """Tests for enhance_files method."""

    @patch.object(LLMEnhancer, "check_available", return_value=False)
    def test_enhance_files_ccw_not_available(self, mock_check):
        """Test enhance_files returns empty when CCW not available."""
        enhancer = LLMEnhancer()
        files = [FileData(path="/test/a.py", content="code", language="python")]

        result = enhancer.enhance_files(files)

        assert result == {}

    def test_enhance_files_disabled(self):
        """Test enhance_files returns empty when disabled."""
        config = LLMConfig(enabled=False)
        enhancer = LLMEnhancer(config)
        files = [FileData(path="/test/a.py", content="code", language="python")]

        result = enhancer.enhance_files(files)

        assert result == {}

    @patch.object(LLMEnhancer, "check_available", return_value=True)
    def test_enhance_files_empty_list(self, mock_check):
        """Test enhance_files with empty list returns empty dict."""
        enhancer = LLMEnhancer()

        result = enhancer.enhance_files([])

        assert result == {}

    @patch.object(LLMEnhancer, "check_available", return_value=True)
    @patch.object(LLMEnhancer, "_invoke_ccw_cli")
    def test_enhance_files_success(self, mock_invoke, mock_check):
        """Test enhance_files successful processing."""
        mock_invoke.return_value = {
            "success": True,
            "stdout": json.dumps({
                "files": {
                    "/test/auth.py": {
                        "summary": "Auth module",
                        "keywords": ["auth"],
                        "purpose": "auth",
                    }
                }
            }),
            "stderr": "",
            "exit_code": 0,
        }

        enhancer = LLMEnhancer()
        files = [FileData(path="/test/auth.py", content="def login(): pass", language="python")]

        result = enhancer.enhance_files(files)

        assert "/test/auth.py" in result
        assert result["/test/auth.py"].summary == "Auth module"

    @patch.object(LLMEnhancer, "check_available", return_value=True)
    @patch.object(LLMEnhancer, "_invoke_ccw_cli")
    def test_enhance_files_fallback(self, mock_invoke, mock_check):
        """Test enhance_files falls back to secondary tool."""
        # First call fails, second succeeds
        mock_invoke.side_effect = [
            {"success": False, "stdout": "", "stderr": "error", "exit_code": 1},
            {
                "success": True,
                "stdout": json.dumps({
                    "files": {
                        "/test/file.py": {
                            "summary": "Fallback result",
                            "keywords": ["fallback"],
                            "purpose": "util",
                        }
                    }
                }),
                "stderr": "",
                "exit_code": 0,
            },
        ]

        enhancer = LLMEnhancer()
        files = [FileData(path="/test/file.py", content="code", language="python")]

        result = enhancer.enhance_files(files)

        assert "/test/file.py" in result
        assert result["/test/file.py"].summary == "Fallback result"
        assert mock_invoke.call_count == 2


class TestEnhanceFile:
    """Tests for enhance_file single file method."""

    @patch.object(LLMEnhancer, "enhance_files")
    def test_enhance_file_success(self, mock_enhance_files):
        """Test enhance_file returns metadata on success."""
        mock_enhance_files.return_value = {
            "/test/auth.py": SemanticMetadata(
                summary="Auth module",
                keywords=["auth", "login"],
                purpose="auth",
                file_path="/test/auth.py",
                llm_tool="gemini",
            )
        }

        enhancer = LLMEnhancer()
        result = enhancer.enhance_file("/test/auth.py", "def login(): pass", "python")

        assert result.summary == "Auth module"
        assert result.keywords == ["auth", "login"]

    @patch.object(LLMEnhancer, "enhance_files")
    def test_enhance_file_fallback_on_failure(self, mock_enhance_files):
        """Test enhance_file returns default metadata on failure."""
        mock_enhance_files.return_value = {}  # Enhancement failed

        enhancer = LLMEnhancer()
        result = enhancer.enhance_file("/test/file.py", "code", "python")

        assert "python" in result.summary.lower()
        assert "python" in result.keywords
        assert result.purpose == "unknown"


class TestBatchProcessing:
    """Tests for batch processing."""

    @patch.object(LLMEnhancer, "check_available", return_value=True)
    @patch.object(LLMEnhancer, "_process_batch")
    def test_batch_processing(self, mock_process, mock_check):
        """Test files are processed in batches."""
        mock_process.return_value = {}

        config = LLMConfig(batch_size=2)
        enhancer = LLMEnhancer(config)

        files = [
            FileData(path=f"/test/file{i}.py", content="code", language="python")
            for i in range(5)
        ]

        enhancer.enhance_files(files)

        # 5 files with batch_size=2 should result in 3 batches
        assert mock_process.call_count == 3

    @patch.object(LLMEnhancer, "check_available", return_value=True)
    @patch.object(LLMEnhancer, "_process_batch")
    def test_batch_continues_on_error(self, mock_process, mock_check):
        """Test batch processing continues on error."""
        # First batch fails, second succeeds
        mock_process.side_effect = [
            Exception("Batch 1 failed"),
            {"/test/file2.py": SemanticMetadata(summary="OK", keywords=[], purpose="")},
        ]

        config = LLMConfig(batch_size=1)
        enhancer = LLMEnhancer(config)

        files = [
            FileData(path="/test/file1.py", content="code", language="python"),
            FileData(path="/test/file2.py", content="code", language="python"),
        ]

        result = enhancer.enhance_files(files)

        # Should still get results from second batch
        assert "/test/file2.py" in result


# === CCW CLI Invocation Tests ===

class TestCCWInvocation:
    """Tests for CCW CLI invocation."""

    @patch("subprocess.run")
    @patch("shutil.which", return_value="/usr/bin/ccw")
    def test_invoke_success(self, mock_which, mock_run):
        """Test successful CCW CLI invocation."""
        mock_run.return_value = MagicMock(
            returncode=0,
            stdout='{"files": {}}',
            stderr="",
        )

        enhancer = LLMEnhancer()
        result = enhancer._invoke_ccw_cli("test prompt", tool="gemini")

        assert result["success"] is True
        assert result["exit_code"] == 0

    @patch("subprocess.run")
    @patch("shutil.which", return_value="/usr/bin/ccw")
    def test_invoke_failure(self, mock_which, mock_run):
        """Test failed CCW CLI invocation."""
        mock_run.return_value = MagicMock(
            returncode=1,
            stdout="",
            stderr="Error occurred",
        )

        enhancer = LLMEnhancer()
        result = enhancer._invoke_ccw_cli("test prompt", tool="gemini")

        assert result["success"] is False
        assert result["exit_code"] == 1

    @patch("subprocess.run")
    @patch("shutil.which", return_value="/usr/bin/ccw")
    def test_invoke_timeout(self, mock_which, mock_run):
        """Test CCW CLI timeout handling."""
        import subprocess
        mock_run.side_effect = subprocess.TimeoutExpired(cmd="ccw", timeout=300)

        enhancer = LLMEnhancer()
        result = enhancer._invoke_ccw_cli("test prompt", tool="gemini")

        assert result["success"] is False
        assert "timeout" in result["stderr"]

    @patch("subprocess.run")
    @patch("shutil.which", return_value=None)
    def test_invoke_ccw_not_found(self, mock_which, mock_run):
        """Test CCW CLI not found handling."""
        mock_run.side_effect = FileNotFoundError()

        enhancer = LLMEnhancer()
        result = enhancer._invoke_ccw_cli("test prompt", tool="gemini")

        assert result["success"] is False
        assert "not found" in result["stderr"]


# === EnhancedSemanticIndexer Tests ===

class TestEnhancedSemanticIndexer:
    """Tests for EnhancedSemanticIndexer integration."""

    @pytest.fixture
    def mock_enhancer(self):
        """Create mock LLM enhancer."""
        enhancer = MagicMock(spec=LLMEnhancer)
        enhancer.enhance_files.return_value = {
            "/test/auth.py": SemanticMetadata(
                summary="Authentication handler",
                keywords=["auth", "login", "jwt"],
                purpose="auth",
                file_path="/test/auth.py",
                llm_tool="gemini",
            )
        }
        return enhancer

    @pytest.fixture
    def mock_embedder(self):
        """Create mock embedder."""
        embedder = MagicMock()
        embedder.embed.return_value = [[0.1] * 384]
        embedder.embed_single.return_value = [0.1] * 384
        return embedder

    @pytest.fixture
    def mock_vector_store(self):
        """Create mock vector store."""
        store = MagicMock()
        store.add_chunk.return_value = 1
        return store

    def test_index_files_empty_list(self, mock_enhancer, mock_embedder, mock_vector_store):
        """Test indexing empty file list."""
        indexer = EnhancedSemanticIndexer(mock_enhancer, mock_embedder, mock_vector_store)

        result = indexer.index_files([])

        assert result == 0
        mock_enhancer.enhance_files.assert_not_called()

    def test_index_files_with_llm_enhancement(self, mock_enhancer, mock_embedder, mock_vector_store):
        """Test indexing with LLM enhancement."""
        indexer = EnhancedSemanticIndexer(mock_enhancer, mock_embedder, mock_vector_store)
        files = [FileData(path="/test/auth.py", content="def login(): pass", language="python")]

        result = indexer.index_files(files)

        assert result == 1
        mock_enhancer.enhance_files.assert_called_once()
        mock_embedder.embed.assert_called_once()
        mock_vector_store.add_chunk.assert_called_once()

    def test_index_files_fallback_to_raw_code(self, mock_embedder, mock_vector_store):
        """Test indexing falls back to raw code when LLM fails."""
        mock_enhancer = MagicMock(spec=LLMEnhancer)
        mock_enhancer.enhance_files.return_value = {}  # No enhancement

        indexer = EnhancedSemanticIndexer(mock_enhancer, mock_embedder, mock_vector_store)
        files = [FileData(path="/test/file.py", content="code", language="python")]

        result = indexer.index_files(files)

        assert result == 1
        mock_embedder.embed_single.assert_called()

    def test_create_embeddable_text(self, mock_enhancer, mock_embedder, mock_vector_store):
        """Test embeddable text creation."""
        indexer = EnhancedSemanticIndexer(mock_enhancer, mock_embedder, mock_vector_store)

        metadata = SemanticMetadata(
            summary="Handles user authentication",
            keywords=["auth", "login", "user"],
            purpose="auth",
        )
        file_data = FileData(path="/test/auth.py", content="code", language="python")

        text = indexer._create_embeddable_text(metadata, file_data)

        assert "Handles user authentication" in text
        assert "auth" in text.lower()
        assert "Keywords:" in text
        assert "auth.py" in text


# === Factory Function Tests ===

class TestFactoryFunctions:
    """Tests for factory functions."""

    def test_create_enhancer_default(self):
        """Test create_enhancer with defaults."""
        enhancer = create_enhancer()

        assert enhancer.config.tool == "gemini"
        assert enhancer.config.enabled is True

    def test_create_enhancer_custom(self):
        """Test create_enhancer with custom params."""
        enhancer = create_enhancer(
            tool="qwen",
            timeout_ms=600000,
            batch_size=10,
            enabled=False,
        )

        assert enhancer.config.tool == "qwen"
        assert enhancer.config.timeout_ms == 600000
        assert enhancer.config.batch_size == 10
        assert enhancer.config.enabled is False

    @pytest.mark.skipif(
        not pytest.importorskip("codexlens.semantic", reason="semantic not available"),
        reason="Semantic dependencies not installed"
    )
    def test_create_enhanced_indexer(self, tmp_path):
        """Test create_enhanced_indexer factory."""
        try:
            from codexlens.semantic import SEMANTIC_AVAILABLE
            if not SEMANTIC_AVAILABLE:
                pytest.skip("Semantic dependencies not installed")

            db_path = tmp_path / "semantic.db"
            indexer = create_enhanced_indexer(db_path, llm_tool="gemini", llm_enabled=False)

            assert indexer.enhancer is not None
            assert indexer.embedder is not None
            assert indexer.vector_store is not None
        except ImportError:
            pytest.skip("Semantic dependencies not installed")


# === Edge Cases ===

class TestEdgeCases:
    """Tests for edge cases."""

    def test_semantic_metadata_with_special_chars(self):
        """Test metadata with special characters."""
        metadata = SemanticMetadata(
            summary='Test "quoted" and \'single\' quotes',
            keywords=["special", "chars", "test's"],
            purpose="test",
        )
        assert '"quoted"' in metadata.summary
        assert "test's" in metadata.keywords

    def test_file_data_with_unicode(self):
        """Test FileData with unicode content."""
        data = FileData(
            path="/test/中文.py",
            content="def 你好(): return '世界'",
            language="python",
        )
        assert "中文" in data.path
        assert "你好" in data.content

    @patch.object(LLMEnhancer, "check_available", return_value=True)
    @patch.object(LLMEnhancer, "_invoke_ccw_cli")
    def test_enhance_with_very_long_content(self, mock_invoke, mock_check):
        """Test enhancement with very long content."""
        mock_invoke.return_value = {
            "success": True,
            "stdout": json.dumps({"files": {}}),
            "stderr": "",
            "exit_code": 0,
        }

        config = LLMConfig(max_content_chars=100)
        enhancer = LLMEnhancer(config)

        long_content = "x" * 10000
        files = [FileData(path="/test/long.py", content=long_content, language="python")]

        enhancer.enhance_files(files)

        # Should not crash, content should be truncated in prompt
        mock_invoke.assert_called_once()

    def test_parse_response_with_missing_fields(self):
        """Test parsing response with missing fields."""
        enhancer = LLMEnhancer()
        response = json.dumps({
            "files": {
                "/test/file.py": {
                    "summary": "Only summary provided",
                    # keywords and purpose missing
                }
            }
        })

        result = enhancer._parse_response(response, "gemini")

        assert "/test/file.py" in result
        assert result["/test/file.py"].summary == "Only summary provided"
        assert result["/test/file.py"].keywords == []
        assert result["/test/file.py"].purpose == ""
