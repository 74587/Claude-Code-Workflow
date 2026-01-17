"""Hook interfaces for Claude Code integration."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, Optional, Callable, TYPE_CHECKING

from codexlens.mcp.schema import MCPContext

if TYPE_CHECKING:
    from codexlens.mcp.provider import MCPProvider

logger = logging.getLogger(__name__)


class HookManager:
    """Manages hook registration and execution."""

    def __init__(self, mcp_provider: "MCPProvider") -> None:
        self.mcp_provider = mcp_provider
        self._pre_hooks: Dict[str, Callable] = {}
        self._post_hooks: Dict[str, Callable] = {}

        # Register default hooks
        self._register_default_hooks()

    def _register_default_hooks(self) -> None:
        """Register built-in hooks."""
        self._pre_hooks["explain"] = self._pre_explain_hook
        self._pre_hooks["refactor"] = self._pre_refactor_hook
        self._pre_hooks["document"] = self._pre_document_hook

    def execute_pre_hook(
        self,
        action: str,
        params: Dict[str, Any],
    ) -> Optional[MCPContext]:
        """Execute pre-tool hook to gather context.

        Args:
            action: The action being performed (e.g., "explain", "refactor")
            params: Parameters for the action

        Returns:
            MCPContext to inject into prompt, or None
        """
        hook = self._pre_hooks.get(action)

        if not hook:
            logger.debug(f"No pre-hook for action: {action}")
            return None

        try:
            return hook(params)
        except Exception as e:
            logger.error(f"Pre-hook failed for {action}: {e}")
            return None

    def execute_post_hook(
        self,
        action: str,
        result: Any,
    ) -> None:
        """Execute post-tool hook for proactive caching.

        Args:
            action: The action that was performed
            result: Result of the action
        """
        hook = self._post_hooks.get(action)

        if not hook:
            return

        try:
            hook(result)
        except Exception as e:
            logger.error(f"Post-hook failed for {action}: {e}")

    def _pre_explain_hook(self, params: Dict[str, Any]) -> Optional[MCPContext]:
        """Pre-hook for 'explain' action."""
        symbol_name = params.get("symbol")

        if not symbol_name:
            return None

        return self.mcp_provider.build_context(
            symbol_name=symbol_name,
            context_type="symbol_explanation",
            include_references=True,
            include_related=True,
        )

    def _pre_refactor_hook(self, params: Dict[str, Any]) -> Optional[MCPContext]:
        """Pre-hook for 'refactor' action."""
        symbol_name = params.get("symbol")

        if not symbol_name:
            return None

        return self.mcp_provider.build_context(
            symbol_name=symbol_name,
            context_type="refactor_context",
            include_references=True,
            include_related=True,
            max_references=20,
        )

    def _pre_document_hook(self, params: Dict[str, Any]) -> Optional[MCPContext]:
        """Pre-hook for 'document' action."""
        symbol_name = params.get("symbol")
        file_path = params.get("file_path")

        if symbol_name:
            return self.mcp_provider.build_context(
                symbol_name=symbol_name,
                context_type="documentation_context",
                include_references=False,
                include_related=True,
            )
        elif file_path:
            return self.mcp_provider.build_context_for_file(
                Path(file_path),
                context_type="file_documentation",
            )

        return None

    def register_pre_hook(
        self,
        action: str,
        hook: Callable[[Dict[str, Any]], Optional[MCPContext]],
    ) -> None:
        """Register a custom pre-tool hook."""
        self._pre_hooks[action] = hook

    def register_post_hook(
        self,
        action: str,
        hook: Callable[[Any], None],
    ) -> None:
        """Register a custom post-tool hook."""
        self._post_hooks[action] = hook


def create_context_for_prompt(
    mcp_provider: "MCPProvider",
    action: str,
    params: Dict[str, Any],
) -> str:
    """Create context string for prompt injection.

    This is the main entry point for Claude Code hook integration.

    Args:
        mcp_provider: The MCP provider instance
        action: Action being performed
        params: Action parameters

    Returns:
        Formatted context string for prompt injection
    """
    manager = HookManager(mcp_provider)
    context = manager.execute_pre_hook(action, params)

    if context:
        return context.to_prompt_injection()

    return ""
