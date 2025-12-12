"""Tests for CodexLens error classes."""

import pytest

from codexlens.errors import (
    CodexLensError,
    ConfigError,
    ParseError,
    SearchError,
    StorageError,
)


class TestErrorHierarchy:
    """Tests for error class hierarchy."""

    def test_codexlens_error_is_exception(self):
        """Test that CodexLensError is an Exception."""
        assert issubclass(CodexLensError, Exception)

    def test_config_error_inherits_from_base(self):
        """Test ConfigError inherits from CodexLensError."""
        assert issubclass(ConfigError, CodexLensError)

    def test_parse_error_inherits_from_base(self):
        """Test ParseError inherits from CodexLensError."""
        assert issubclass(ParseError, CodexLensError)

    def test_storage_error_inherits_from_base(self):
        """Test StorageError inherits from CodexLensError."""
        assert issubclass(StorageError, CodexLensError)

    def test_search_error_inherits_from_base(self):
        """Test SearchError inherits from CodexLensError."""
        assert issubclass(SearchError, CodexLensError)


class TestErrorMessages:
    """Tests for error message handling."""

    def test_codexlens_error_with_message(self):
        """Test creating CodexLensError with message."""
        error = CodexLensError("Something went wrong")
        assert str(error) == "Something went wrong"

    def test_config_error_with_message(self):
        """Test creating ConfigError with message."""
        error = ConfigError("Invalid configuration")
        assert str(error) == "Invalid configuration"

    def test_parse_error_with_message(self):
        """Test creating ParseError with message."""
        error = ParseError("Failed to parse file.py")
        assert str(error) == "Failed to parse file.py"

    def test_storage_error_with_message(self):
        """Test creating StorageError with message."""
        error = StorageError("Database connection failed")
        assert str(error) == "Database connection failed"

    def test_search_error_with_message(self):
        """Test creating SearchError with message."""
        error = SearchError("FTS query syntax error")
        assert str(error) == "FTS query syntax error"


class TestErrorRaising:
    """Tests for raising and catching errors."""

    def test_catch_specific_error(self):
        """Test catching specific error type."""
        with pytest.raises(ConfigError):
            raise ConfigError("test")

    def test_catch_base_error(self):
        """Test catching base error type catches all subtypes."""
        with pytest.raises(CodexLensError):
            raise ConfigError("test")

        with pytest.raises(CodexLensError):
            raise ParseError("test")

        with pytest.raises(CodexLensError):
            raise StorageError("test")

        with pytest.raises(CodexLensError):
            raise SearchError("test")

    def test_error_not_caught_as_wrong_type(self):
        """Test that errors aren't caught as wrong type."""
        with pytest.raises(ConfigError):
            try:
                raise ConfigError("config issue")
            except ParseError:
                pass  # This should not catch ConfigError


class TestErrorChaining:
    """Tests for error chaining."""

    def test_error_with_cause(self):
        """Test error chaining with __cause__."""
        original = ValueError("original error")
        try:
            raise StorageError("storage failed") from original
        except StorageError as e:
            assert e.__cause__ is original

    def test_nested_error_handling(self):
        """Test nested error handling pattern."""
        def inner_function():
            raise ValueError("inner error")

        def outer_function():
            try:
                inner_function()
            except ValueError as e:
                raise ParseError("outer error") from e

        with pytest.raises(ParseError) as exc_info:
            outer_function()

        assert exc_info.value.__cause__ is not None
        assert isinstance(exc_info.value.__cause__, ValueError)


class TestErrorUsagePatterns:
    """Tests for common error usage patterns."""

    def test_error_in_context_manager(self):
        """Test error handling in context manager."""
        class FakeStore:
            def __enter__(self):
                return self

            def __exit__(self, exc_type, exc_val, exc_tb):
                return False  # Don't suppress exceptions

            def query(self):
                raise StorageError("query failed")

        with pytest.raises(StorageError):
            with FakeStore() as store:
                store.query()

    def test_error_comparison(self):
        """Test error instance comparison."""
        error1 = ConfigError("test")
        error2 = ConfigError("test")
        # Different instances, even with same message
        assert error1 is not error2
        # But same string representation
        assert str(error1) == str(error2)

    def test_empty_error_message(self):
        """Test error with empty message."""
        error = CodexLensError("")
        assert str(error) == ""

    def test_error_with_format_args(self):
        """Test error with formatted message."""
        path = "/test/file.py"
        error = ParseError(f"Failed to parse {path}: syntax error on line 10")
        assert "/test/file.py" in str(error)
        assert "line 10" in str(error)
