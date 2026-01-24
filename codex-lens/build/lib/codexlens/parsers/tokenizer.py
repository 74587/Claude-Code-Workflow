"""Token counting utilities for CodexLens.

Provides accurate token counting using tiktoken with character count fallback.
"""

from __future__ import annotations

from typing import Optional

try:
    import tiktoken
    TIKTOKEN_AVAILABLE = True
except ImportError:
    TIKTOKEN_AVAILABLE = False


class Tokenizer:
    """Token counter with tiktoken primary and character count fallback."""

    def __init__(self, encoding_name: str = "cl100k_base") -> None:
        """Initialize tokenizer.

        Args:
            encoding_name: Tiktoken encoding name (default: cl100k_base for GPT-4)
        """
        self._encoding: Optional[object] = None
        self._encoding_name = encoding_name

        if TIKTOKEN_AVAILABLE:
            try:
                self._encoding = tiktoken.get_encoding(encoding_name)
            except Exception:
                # Fallback to character counting if encoding fails
                self._encoding = None

    def count_tokens(self, text: str) -> int:
        """Count tokens in text.

        Uses tiktoken if available, otherwise falls back to character count / 4.

        Args:
            text: Text to count tokens for

        Returns:
            Estimated token count
        """
        if not text:
            return 0

        if self._encoding is not None:
            try:
                return len(self._encoding.encode(text))  # type: ignore[attr-defined]
            except Exception:
                # Fall through to character count fallback
                pass

        # Fallback: rough estimate using character count
        # Average of ~4 characters per token for English text
        return max(1, len(text) // 4)

    def is_using_tiktoken(self) -> bool:
        """Check if tiktoken is being used.

        Returns:
            True if tiktoken is available and initialized
        """
        return self._encoding is not None


# Global default tokenizer instance
_default_tokenizer: Optional[Tokenizer] = None


def get_default_tokenizer() -> Tokenizer:
    """Get the global default tokenizer instance.

    Returns:
        Shared Tokenizer instance
    """
    global _default_tokenizer
    if _default_tokenizer is None:
        _default_tokenizer = Tokenizer()
    return _default_tokenizer


def count_tokens(text: str, tokenizer: Optional[Tokenizer] = None) -> int:
    """Count tokens in text using default or provided tokenizer.

    Args:
        text: Text to count tokens for
        tokenizer: Optional tokenizer instance (uses default if None)

    Returns:
        Estimated token count
    """
    if tokenizer is None:
        tokenizer = get_default_tokenizer()
    return tokenizer.count_tokens(text)
