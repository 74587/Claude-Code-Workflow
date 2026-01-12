"""LiteLLM client implementation for LLM operations."""

from __future__ import annotations

import logging
from typing import Any, Sequence

import litellm

from ..config import LiteLLMConfig, get_config
from ..interfaces.llm import AbstractLLMClient, ChatMessage, LLMResponse

logger = logging.getLogger(__name__)


class LiteLLMClient(AbstractLLMClient):
    """LiteLLM client implementation.

    Supports multiple providers (OpenAI, Anthropic, etc.) through LiteLLM's unified interface.

    Example:
        client = LiteLLMClient(model="default")
        response = client.chat([
            ChatMessage(role="user", content="Hello!")
        ])
        print(response.content)
    """

    def __init__(
        self,
        model: str = "default",
        config: LiteLLMConfig | None = None,
        **litellm_kwargs: Any,
    ) -> None:
        """Initialize LiteLLM client.

        Args:
            model: Model name from configuration (default: "default")
            config: Configuration instance (default: use global config)
            **litellm_kwargs: Additional arguments to pass to litellm.completion()
        """
        self._config = config or get_config()
        self._model_name = model
        self._litellm_kwargs = litellm_kwargs

        # Get model configuration
        try:
            self._model_config = self._config.get_llm_model(model)
        except ValueError as e:
            logger.error(f"Failed to get model configuration: {e}")
            raise

        # Get provider configuration
        try:
            self._provider_config = self._config.get_provider(self._model_config.provider)
        except ValueError as e:
            logger.error(f"Failed to get provider configuration: {e}")
            raise

        # Set up LiteLLM environment
        self._setup_litellm()

    def _setup_litellm(self) -> None:
        """Configure LiteLLM with provider settings."""
        provider = self._model_config.provider

        # Set API key
        if self._provider_config.api_key:
            env_var = f"{provider.upper()}_API_KEY"
            litellm.api_key = self._provider_config.api_key
            # Also set environment-specific keys
            if provider == "openai":
                litellm.openai_key = self._provider_config.api_key
            elif provider == "anthropic":
                litellm.anthropic_key = self._provider_config.api_key

        # Set API base
        if self._provider_config.api_base:
            litellm.api_base = self._provider_config.api_base

    def _format_model_name(self) -> str:
        """Format model name for LiteLLM.

        Returns:
            Formatted model name (e.g., "gpt-4", "claude-3-opus-20240229")
        """
        # LiteLLM expects model names in format: "provider/model" or just "model"
        # If provider is explicit, use provider/model format
        provider = self._model_config.provider
        model = self._model_config.model

        # For some providers, LiteLLM expects explicit prefix
        if provider in ["anthropic", "azure", "vertex_ai", "bedrock"]:
            return f"{provider}/{model}"

        # If there's a custom api_base, use openai/ prefix to force OpenAI-compatible routing
        # This prevents LiteLLM from auto-detecting model provider from name
        # (e.g., "gemini-2.5-pro" would otherwise trigger Vertex AI auth)
        if self._provider_config.api_base:
            # Check if it's not the default OpenAI endpoint
            default_openai_bases = [
                "https://api.openai.com/v1",
                "https://api.openai.com",
            ]
            if self._provider_config.api_base not in default_openai_bases:
                return f"openai/{model}"

        return model

    def chat(
        self,
        messages: Sequence[ChatMessage],
        **kwargs: Any,
    ) -> LLMResponse:
        """Chat completion for a sequence of messages.

        Args:
            messages: Sequence of chat messages
            **kwargs: Additional arguments for litellm.completion()

        Returns:
            LLM response with content and raw response

        Raises:
            Exception: If LiteLLM completion fails
        """
        # Convert messages to LiteLLM format
        litellm_messages = [
            {"role": msg.role, "content": msg.content} for msg in messages
        ]

        # Merge kwargs
        completion_kwargs = {**self._litellm_kwargs, **kwargs}

        # Override User-Agent to avoid being blocked by some API proxies
        # that detect and block OpenAI SDK's default User-Agent
        if "extra_headers" not in completion_kwargs:
            completion_kwargs["extra_headers"] = {}
        if "User-Agent" not in completion_kwargs["extra_headers"]:
            completion_kwargs["extra_headers"]["User-Agent"] = "python-httpx/0.27"

        try:
            # Call LiteLLM
            response = litellm.completion(
                model=self._format_model_name(),
                messages=litellm_messages,
                **completion_kwargs,
            )

            # Extract content
            content = response.choices[0].message.content or ""

            return LLMResponse(content=content, raw=response)

        except Exception as e:
            logger.error(f"LiteLLM completion failed: {e}")
            raise

    def complete(self, prompt: str, **kwargs: Any) -> LLMResponse:
        """Text completion for a prompt.

        Args:
            prompt: Input prompt
            **kwargs: Additional arguments for litellm.completion()

        Returns:
            LLM response with content and raw response

        Raises:
            Exception: If LiteLLM completion fails
        """
        # Convert to chat format (most modern models use chat interface)
        messages = [ChatMessage(role="user", content=prompt)]
        return self.chat(messages, **kwargs)

    @property
    def model_name(self) -> str:
        """Get configured model name."""
        return self._model_name

    @property
    def provider(self) -> str:
        """Get configured provider name."""
        return self._model_config.provider
