"""Tests for tokenizer module."""

import pytest

from codexlens.parsers.tokenizer import (
    Tokenizer,
    count_tokens,
    get_default_tokenizer,
)


class TestTokenizer:
    """Tests for Tokenizer class."""

    def test_empty_text(self):
        tokenizer = Tokenizer()
        assert tokenizer.count_tokens("") == 0

    def test_simple_text(self):
        tokenizer = Tokenizer()
        text = "Hello world"
        count = tokenizer.count_tokens(text)
        assert count > 0
        # Should be roughly text length / 4 for fallback
        assert count >= len(text) // 5

    def test_long_text(self):
        tokenizer = Tokenizer()
        text = "def hello():\n    pass\n" * 100
        count = tokenizer.count_tokens(text)
        assert count > 0
        # Verify it's proportional to length
        assert count >= len(text) // 5

    def test_code_text(self):
        tokenizer = Tokenizer()
        code = """
def calculate_fibonacci(n):
    if n <= 1:
        return n
    return calculate_fibonacci(n-1) + calculate_fibonacci(n-2)

class MathHelper:
    def factorial(self, n):
        if n <= 1:
            return 1
        return n * self.factorial(n - 1)
"""
        count = tokenizer.count_tokens(code)
        assert count > 0

    def test_unicode_text(self):
        tokenizer = Tokenizer()
        text = "你好世界 Hello World"
        count = tokenizer.count_tokens(text)
        assert count > 0

    def test_special_characters(self):
        tokenizer = Tokenizer()
        text = "!@#$%^&*()_+-=[]{}|;':\",./<>?"
        count = tokenizer.count_tokens(text)
        assert count > 0

    def test_is_using_tiktoken_check(self):
        tokenizer = Tokenizer()
        # Should return bool indicating if tiktoken is available
        result = tokenizer.is_using_tiktoken()
        assert isinstance(result, bool)


class TestTokenizerFallback:
    """Tests for character count fallback."""

    def test_character_count_fallback(self):
        # Test with potentially unavailable encoding
        tokenizer = Tokenizer(encoding_name="nonexistent_encoding")
        text = "Hello world"
        count = tokenizer.count_tokens(text)
        # Should fall back to character counting
        assert count == max(1, len(text) // 4)

    def test_fallback_minimum_count(self):
        tokenizer = Tokenizer(encoding_name="nonexistent_encoding")
        # Very short text should still return at least 1
        assert tokenizer.count_tokens("hi") >= 1


class TestGlobalTokenizer:
    """Tests for global tokenizer functions."""

    def test_get_default_tokenizer(self):
        tokenizer1 = get_default_tokenizer()
        tokenizer2 = get_default_tokenizer()
        # Should return the same instance
        assert tokenizer1 is tokenizer2

    def test_count_tokens_default(self):
        text = "Hello world"
        count = count_tokens(text)
        assert count > 0

    def test_count_tokens_custom_tokenizer(self):
        custom_tokenizer = Tokenizer()
        text = "Hello world"
        count = count_tokens(text, tokenizer=custom_tokenizer)
        assert count > 0


class TestTokenizerPerformance:
    """Performance-related tests."""

    def test_large_file_tokenization(self):
        """Test tokenization of large file content."""
        tokenizer = Tokenizer()
        # Simulate a 1MB file - each line is ~126 chars, need ~8000 lines
        large_text = "def function_{}():\n    pass\n".format("x" * 100) * 8000
        assert len(large_text) > 1_000_000

        count = tokenizer.count_tokens(large_text)
        assert count > 0
        # Verify reasonable token count
        assert count >= len(large_text) // 5

    def test_multiple_tokenizations(self):
        """Test multiple tokenization calls."""
        tokenizer = Tokenizer()
        text = "def hello(): pass"

        # Multiple calls should return same result
        count1 = tokenizer.count_tokens(text)
        count2 = tokenizer.count_tokens(text)
        assert count1 == count2


class TestTokenizerEdgeCases:
    """Edge case tests."""

    def test_only_whitespace(self):
        tokenizer = Tokenizer()
        count = tokenizer.count_tokens("   \n\t  ")
        assert count >= 0

    def test_very_long_line(self):
        tokenizer = Tokenizer()
        long_line = "a" * 10000
        count = tokenizer.count_tokens(long_line)
        assert count > 0

    def test_mixed_content(self):
        tokenizer = Tokenizer()
        mixed = """
# Comment
def func():
    '''Docstring'''
    pass

123.456
"string"
"""
        count = tokenizer.count_tokens(mixed)
        assert count > 0
