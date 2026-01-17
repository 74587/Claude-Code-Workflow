"""Tests for MCP hooks module."""

import pytest
from unittest.mock import Mock, patch
from pathlib import Path

from codexlens.mcp.hooks import HookManager, create_context_for_prompt
from codexlens.mcp.schema import MCPContext, SymbolInfo


class TestHookManager:
    """Test HookManager class."""

    @pytest.fixture
    def mock_provider(self):
        """Create a mock MCP provider."""
        provider = Mock()
        provider.build_context.return_value = MCPContext(
            symbol=SymbolInfo("test_func", "function", "/test.py", 1, 10),
            context_type="symbol_explanation",
        )
        provider.build_context_for_file.return_value = MCPContext(
            context_type="file_overview",
        )
        return provider

    @pytest.fixture
    def hook_manager(self, mock_provider):
        """Create a HookManager with mocked provider."""
        return HookManager(mock_provider)

    def test_default_hooks_registered(self, hook_manager):
        """Default hooks are registered on initialization."""
        assert "explain" in hook_manager._pre_hooks
        assert "refactor" in hook_manager._pre_hooks
        assert "document" in hook_manager._pre_hooks

    def test_execute_pre_hook_returns_context(self, hook_manager, mock_provider):
        """execute_pre_hook returns MCPContext for registered hook."""
        result = hook_manager.execute_pre_hook("explain", {"symbol": "my_func"})

        assert result is not None
        assert isinstance(result, MCPContext)
        mock_provider.build_context.assert_called_once()

    def test_execute_pre_hook_returns_none_for_unknown_action(self, hook_manager):
        """execute_pre_hook returns None for unregistered action."""
        result = hook_manager.execute_pre_hook("unknown_action", {"symbol": "test"})

        assert result is None

    def test_execute_pre_hook_handles_exception(self, hook_manager, mock_provider):
        """execute_pre_hook handles provider exceptions gracefully."""
        mock_provider.build_context.side_effect = Exception("Provider failed")

        result = hook_manager.execute_pre_hook("explain", {"symbol": "my_func"})

        assert result is None

    def test_execute_post_hook_no_error_for_unregistered(self, hook_manager):
        """execute_post_hook doesn't error for unregistered action."""
        # Should not raise
        hook_manager.execute_post_hook("unknown", {"result": "data"})

    def test_pre_explain_hook_calls_build_context(self, hook_manager, mock_provider):
        """_pre_explain_hook calls build_context correctly."""
        hook_manager.execute_pre_hook("explain", {"symbol": "my_func"})

        mock_provider.build_context.assert_called_with(
            symbol_name="my_func",
            context_type="symbol_explanation",
            include_references=True,
            include_related=True,
        )

    def test_pre_explain_hook_returns_none_without_symbol(self, hook_manager, mock_provider):
        """_pre_explain_hook returns None when symbol param missing."""
        result = hook_manager.execute_pre_hook("explain", {})

        assert result is None
        mock_provider.build_context.assert_not_called()

    def test_pre_refactor_hook_calls_build_context(self, hook_manager, mock_provider):
        """_pre_refactor_hook calls build_context with refactor settings."""
        hook_manager.execute_pre_hook("refactor", {"symbol": "my_class"})

        mock_provider.build_context.assert_called_with(
            symbol_name="my_class",
            context_type="refactor_context",
            include_references=True,
            include_related=True,
            max_references=20,
        )

    def test_pre_refactor_hook_returns_none_without_symbol(self, hook_manager, mock_provider):
        """_pre_refactor_hook returns None when symbol param missing."""
        result = hook_manager.execute_pre_hook("refactor", {})

        assert result is None
        mock_provider.build_context.assert_not_called()

    def test_pre_document_hook_with_symbol(self, hook_manager, mock_provider):
        """_pre_document_hook uses build_context when symbol provided."""
        hook_manager.execute_pre_hook("document", {"symbol": "my_func"})

        mock_provider.build_context.assert_called_with(
            symbol_name="my_func",
            context_type="documentation_context",
            include_references=False,
            include_related=True,
        )

    def test_pre_document_hook_with_file_path(self, hook_manager, mock_provider):
        """_pre_document_hook uses build_context_for_file when file_path provided."""
        hook_manager.execute_pre_hook("document", {"file_path": "/src/module.py"})

        mock_provider.build_context_for_file.assert_called_once()
        call_args = mock_provider.build_context_for_file.call_args
        assert call_args[0][0] == Path("/src/module.py")
        assert call_args[1].get("context_type") == "file_documentation"

    def test_pre_document_hook_prefers_symbol_over_file(self, hook_manager, mock_provider):
        """_pre_document_hook prefers symbol when both provided."""
        hook_manager.execute_pre_hook(
            "document", {"symbol": "my_func", "file_path": "/src/module.py"}
        )

        mock_provider.build_context.assert_called_once()
        mock_provider.build_context_for_file.assert_not_called()

    def test_pre_document_hook_returns_none_without_params(self, hook_manager, mock_provider):
        """_pre_document_hook returns None when neither symbol nor file_path provided."""
        result = hook_manager.execute_pre_hook("document", {})

        assert result is None
        mock_provider.build_context.assert_not_called()
        mock_provider.build_context_for_file.assert_not_called()

    def test_register_pre_hook(self, hook_manager):
        """register_pre_hook adds custom hook."""
        custom_hook = Mock(return_value=MCPContext())

        hook_manager.register_pre_hook("custom_action", custom_hook)

        assert "custom_action" in hook_manager._pre_hooks
        hook_manager.execute_pre_hook("custom_action", {"data": "value"})
        custom_hook.assert_called_once_with({"data": "value"})

    def test_register_post_hook(self, hook_manager):
        """register_post_hook adds custom hook."""
        custom_hook = Mock()

        hook_manager.register_post_hook("custom_action", custom_hook)

        assert "custom_action" in hook_manager._post_hooks
        hook_manager.execute_post_hook("custom_action", {"result": "data"})
        custom_hook.assert_called_once_with({"result": "data"})

    def test_execute_post_hook_handles_exception(self, hook_manager):
        """execute_post_hook handles hook exceptions gracefully."""
        failing_hook = Mock(side_effect=Exception("Hook failed"))
        hook_manager.register_post_hook("failing", failing_hook)

        # Should not raise
        hook_manager.execute_post_hook("failing", {"data": "value"})


class TestCreateContextForPrompt:
    """Test create_context_for_prompt function."""

    def test_returns_prompt_injection_string(self):
        """create_context_for_prompt returns formatted string."""
        mock_provider = Mock()
        mock_provider.build_context.return_value = MCPContext(
            symbol=SymbolInfo("test_func", "function", "/test.py", 1, 10),
            definition="def test_func(): pass",
        )

        result = create_context_for_prompt(
            mock_provider, "explain", {"symbol": "test_func"}
        )

        assert isinstance(result, str)
        assert "<code_context>" in result
        assert "test_func" in result
        assert "</code_context>" in result

    def test_returns_empty_string_when_no_context(self):
        """create_context_for_prompt returns empty string when no context built."""
        mock_provider = Mock()
        mock_provider.build_context.return_value = None

        result = create_context_for_prompt(
            mock_provider, "explain", {"symbol": "nonexistent"}
        )

        assert result == ""

    def test_returns_empty_string_for_unknown_action(self):
        """create_context_for_prompt returns empty string for unregistered action."""
        mock_provider = Mock()

        result = create_context_for_prompt(
            mock_provider, "unknown_action", {"data": "value"}
        )

        assert result == ""
        mock_provider.build_context.assert_not_called()
