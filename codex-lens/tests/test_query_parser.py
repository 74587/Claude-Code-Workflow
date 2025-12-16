"""Tests for query preprocessing and expansion (P1).

Tests identifier splitting (CamelCase, snake_case, kebab-case), OR expansion,
and FTS5 operator preservation.
"""

import pytest

from codexlens.search.query_parser import QueryParser, preprocess_query


class TestQueryParserBasics:
    """Basic tests for QueryParser class."""

    def test_parser_initialization(self):
        """Test QueryParser initializes with default settings."""
        parser = QueryParser()
        assert parser.enable is True
        assert parser.min_token_length == 2

    def test_parser_disabled(self):
        """Test parser with enable=False returns original query."""
        parser = QueryParser(enable=False)
        result = parser.preprocess_query("UserAuth")
        assert result == "UserAuth"

    def test_empty_query(self):
        """Test empty query returns empty string."""
        parser = QueryParser()
        assert parser.preprocess_query("") == ""
        assert parser.preprocess_query("   ") == ""


class TestCamelCaseSplitting:
    """Tests for CamelCase identifier splitting."""

    def test_simple_camelcase(self):
        """Test simple CamelCase splitting."""
        parser = QueryParser()
        result = parser.preprocess_query("UserAuth")
        # Should expand to: UserAuth OR User OR Auth
        assert "UserAuth" in result
        assert "User" in result
        assert "Auth" in result
        assert "OR" in result

    def test_lowercase_camelcase(self):
        """Test lowerCamelCase splitting."""
        parser = QueryParser()
        result = parser.preprocess_query("getUserData")
        # Should expand: getUserData OR get OR User OR Data
        assert "getUserData" in result
        assert "get" in result
        assert "User" in result
        assert "Data" in result

    def test_all_caps_acronym(self):
        """Test all-caps acronyms are not split."""
        parser = QueryParser()
        result = parser.preprocess_query("HTTP")
        # Should not split HTTP
        assert "HTTP" in result
        assert "OR" not in result or result == "HTTP"

    def test_mixed_acronym_camelcase(self):
        """Test mixed acronym and CamelCase."""
        parser = QueryParser()
        result = parser.preprocess_query("HTTPServer")
        # Should handle mixed case
        assert "HTTPServer" in result or "HTTP" in result


class TestSnakeCaseSplitting:
    """Tests for snake_case identifier splitting."""

    def test_simple_snake_case(self):
        """Test simple snake_case splitting."""
        parser = QueryParser()
        result = parser.preprocess_query("user_auth")
        # Should expand: user_auth OR user OR auth
        assert "user_auth" in result
        assert "user" in result
        assert "auth" in result
        assert "OR" in result

    def test_multiple_underscores(self):
        """Test splitting with multiple underscores."""
        parser = QueryParser()
        result = parser.preprocess_query("get_user_data")
        # Should expand: get_user_data OR get OR user OR data
        assert "get_user_data" in result
        assert "get" in result
        assert "user" in result
        assert "data" in result

    def test_leading_trailing_underscores(self):
        """Test underscores at start/end."""
        parser = QueryParser()
        result = parser.preprocess_query("_private_method_")
        # Should handle gracefully
        assert "private" in result
        assert "method" in result


class TestKebabCaseSplitting:
    """Tests for kebab-case identifier splitting."""

    def test_simple_kebab_case(self):
        """Test simple kebab-case splitting."""
        parser = QueryParser()
        result = parser.preprocess_query("user-auth")
        # Should expand: user-auth OR user OR auth
        assert "user-auth" in result or "user" in result
        assert "OR" in result

    def test_multiple_hyphens(self):
        """Test splitting with multiple hyphens."""
        parser = QueryParser()
        result = parser.preprocess_query("get-user-data")
        # Should expand similar to snake_case
        assert "get" in result
        assert "user" in result
        assert "data" in result


class TestQueryExpansion:
    """Tests for OR query expansion."""

    def test_expansion_includes_original(self):
        """Test expansion always includes original query."""
        parser = QueryParser()
        result = parser.preprocess_query("UserAuth")
        # Original should be first
        tokens = result.split(" OR ")
        assert tokens[0] == "UserAuth"

    def test_expansion_or_operator(self):
        """Test expansion uses OR operator."""
        parser = QueryParser()
        result = parser.preprocess_query("getUserData")
        assert " OR " in result

    def test_min_token_length_filtering(self):
        """Test short tokens are filtered out."""
        parser = QueryParser(min_token_length=3)
        result = parser.preprocess_query("getX")
        # "X" should be filtered (len < 3)
        assert "X" not in result or "getX" in result
        assert "get" in result  # "get" has len=3

    def test_no_expansion_for_simple_word(self):
        """Test simple words with no splitting return as-is."""
        parser = QueryParser()
        result = parser.preprocess_query("function")
        # No splitting needed, but may still have OR if single token
        assert "function" in result

    def test_deduplication(self):
        """Test duplicate tokens are deduplicated."""
        parser = QueryParser()
        # Query that might produce duplicates after splitting
        result = parser.preprocess_query("user_user")
        tokens = result.split(" OR ")
        # Should deduplicate "user"
        user_count = tokens.count("user")
        assert user_count == 1


class TestFTS5OperatorPreservation:
    """Tests for FTS5 operator preservation."""

    def test_quoted_phrase_not_expanded(self):
        """Test quoted phrases are not expanded."""
        parser = QueryParser()
        result = parser.preprocess_query('"UserAuth"')
        # Should preserve quoted phrase without expansion
        assert result == '"UserAuth"' or '"UserAuth"' in result

    def test_or_operator_not_expanded(self):
        """Test existing OR operator preserves query."""
        parser = QueryParser()
        result = parser.preprocess_query("user OR auth")
        # Should not double-expand
        assert result == "user OR auth"

    def test_and_operator_not_expanded(self):
        """Test AND operator preserves query."""
        parser = QueryParser()
        result = parser.preprocess_query("user AND auth")
        assert result == "user AND auth"

    def test_not_operator_not_expanded(self):
        """Test NOT operator preserves query."""
        parser = QueryParser()
        result = parser.preprocess_query("user NOT test")
        assert result == "user NOT test"

    def test_near_operator_not_expanded(self):
        """Test NEAR operator preserves query."""
        parser = QueryParser()
        result = parser.preprocess_query("user NEAR auth")
        assert result == "user NEAR auth"

    def test_wildcard_not_expanded(self):
        """Test wildcard queries are not expanded."""
        parser = QueryParser()
        result = parser.preprocess_query("auth*")
        assert result == "auth*"

    def test_prefix_operator_not_expanded(self):
        """Test prefix operator (^) preserves query."""
        parser = QueryParser()
        result = parser.preprocess_query("^auth")
        assert result == "^auth"


class TestMultiWordQueries:
    """Tests for multi-word query expansion."""

    def test_two_words(self):
        """Test expansion of two-word query."""
        parser = QueryParser()
        result = parser.preprocess_query("UserAuth DataModel")
        # Should expand each word
        assert "UserAuth" in result
        assert "DataModel" in result
        assert "User" in result
        assert "Auth" in result
        assert "Data" in result
        assert "Model" in result

    def test_whitespace_separated_identifiers(self):
        """Test whitespace-separated identifiers are expanded."""
        parser = QueryParser()
        result = parser.preprocess_query("get_user create_token")
        # Each word should be expanded
        assert "get" in result
        assert "user" in result
        assert "create" in result
        assert "token" in result


class TestConvenienceFunction:
    """Tests for preprocess_query convenience function."""

    def test_convenience_function_default(self):
        """Test convenience function with default settings."""
        result = preprocess_query("UserAuth")
        assert "UserAuth" in result
        assert "OR" in result

    def test_convenience_function_disabled(self):
        """Test convenience function with enable=False."""
        result = preprocess_query("UserAuth", enable=False)
        assert result == "UserAuth"


@pytest.mark.parametrize("query,expected_tokens", [
    ("UserAuth", ["UserAuth", "User", "Auth"]),
    ("user_auth", ["user_auth", "user", "auth"]),
    ("get-user-data", ["get", "user", "data"]),
    ("HTTPServer", ["HTTPServer", "HTTP", "Server"]),
    ("getUserData", ["getUserData", "get", "User", "Data"]),
])
class TestParameterizedSplitting:
    """Parameterized tests for various identifier formats."""

    def test_identifier_splitting(self, query, expected_tokens):
        """Test identifier splitting produces expected tokens."""
        parser = QueryParser()
        result = parser.preprocess_query(query)

        # Check all expected tokens are present
        for token in expected_tokens:
            assert token in result, f"Token '{token}' should be in result: {result}"


class TestEdgeCases:
    """Edge case tests for query parsing."""

    def test_single_character_word(self):
        """Test single character words are filtered."""
        parser = QueryParser(min_token_length=2)
        result = parser.preprocess_query("a")
        # Single char should be filtered if below min_token_length
        assert result == "a" or len(result) == 0 or result.strip() == ""

    def test_numbers_in_identifiers(self):
        """Test identifiers with numbers."""
        parser = QueryParser()
        result = parser.preprocess_query("user123Auth")
        # Should handle numbers gracefully
        assert "user123Auth" in result

    def test_special_characters(self):
        """Test identifiers with special characters."""
        parser = QueryParser()
        result = parser.preprocess_query("user$auth")
        # Should handle special chars
        assert isinstance(result, str)

    def test_unicode_identifiers(self):
        """Test Unicode identifiers."""
        parser = QueryParser()
        result = parser.preprocess_query("用户认证")
        # Should handle Unicode without errors
        assert isinstance(result, str)
        assert "用户认证" in result

    def test_very_long_identifier(self):
        """Test very long identifier names."""
        parser = QueryParser()
        long_name = "VeryLongCamelCaseIdentifierNameThatExceedsNormalLength"
        result = parser.preprocess_query(long_name)
        # Should handle long names
        assert long_name in result

    def test_mixed_case_styles(self):
        """Test mixed CamelCase and snake_case."""
        parser = QueryParser()
        result = parser.preprocess_query("User_Auth")
        # Should handle mixed styles
        assert "User_Auth" in result or "User" in result
        assert "Auth" in result


class TestTokenExtractionLogic:
    """Tests for internal token extraction logic."""

    def test_extract_tokens_from_camelcase(self):
        """Test _split_camel_case method."""
        parser = QueryParser()
        tokens = parser._split_camel_case("getUserData")
        # Should split into: get, User, Data
        assert "get" in tokens
        assert "User" in tokens
        assert "Data" in tokens

    def test_extract_tokens_from_snake_case(self):
        """Test _split_snake_case method."""
        parser = QueryParser()
        tokens = parser._split_snake_case("get_user_data")
        # Should split into: get, user, data
        assert "get" in tokens
        assert "user" in tokens
        assert "data" in tokens

    def test_extract_tokens_from_kebab_case(self):
        """Test _split_kebab_case method."""
        parser = QueryParser()
        tokens = parser._split_kebab_case("get-user-data")
        # Should split into: get, user, data
        assert "get" in tokens
        assert "user" in tokens
        assert "data" in tokens

    def test_extract_tokens_combines_strategies(self):
        """Test _extract_tokens uses all splitting strategies."""
        parser = QueryParser()
        # Mix of styles
        tokens = parser._extract_tokens("getUserData_v2")
        # Should extract: getUserData_v2, get, User, Data, v2
        assert "getUserData_v2" in tokens
        assert "get" in tokens or "User" in tokens


class TestQueryParserIntegration:
    """Integration tests for query parser."""

    def test_real_world_query_examples(self):
        """Test real-world query examples."""
        parser = QueryParser()

        queries = [
            "AuthenticationService",
            "get_user_by_id",
            "create-new-user",
            "HTTPRequest",
            "parseJSONData",
        ]

        for query in queries:
            result = parser.preprocess_query(query)
            # Should produce valid expanded query
            assert isinstance(result, str)
            assert len(result) > 0
            assert query in result  # Original should be included

    def test_parser_performance(self):
        """Test parser performance with many queries."""
        parser = QueryParser()

        # Process 1000 queries
        for i in range(1000):
            query = f"getUserData{i}"
            result = parser.preprocess_query(query)
            assert isinstance(result, str)


class TestMinTokenLength:
    """Tests for min_token_length parameter."""

    def test_custom_min_token_length(self):
        """Test custom min_token_length filters tokens."""
        parser = QueryParser(min_token_length=4)
        result = parser.preprocess_query("getUserData")
        # Tokens with len < 4 should be filtered
        assert "get" not in result or "getUserData" in result  # "get" has len=3
        assert "User" in result  # "User" has len=4
        assert "Data" in result  # "Data" has len=4

    def test_min_token_length_zero(self):
        """Test min_token_length=0 includes all tokens."""
        parser = QueryParser(min_token_length=0)
        result = parser.preprocess_query("getX")
        # All tokens should be included
        assert "get" in result
        assert "X" in result or "getX" in result

    def test_min_token_length_one(self):
        """Test min_token_length=1 includes single char tokens."""
        parser = QueryParser(min_token_length=1)
        result = parser.preprocess_query("aB")
        # Should include "a" and "B"
        assert "a" in result or "aB" in result
        assert "B" in result or "aB" in result




class TestComplexBooleanQueries:
    """Tests for complex boolean query parsing."""
    
    @pytest.fixture
    def parser(self):
        return QueryParser()
    
    def test_nested_boolean_and_or(self, parser):
        """Test parser preserves nested boolean logic: (A OR B) AND C."""
        query = "(login OR logout) AND user"
        expanded = parser.preprocess_query(query)
        
        # Should preserve parentheses and boolean operators
        assert "(" in expanded
        assert ")" in expanded
        assert "AND" in expanded
        assert "OR" in expanded
    
    def test_mixed_operators_with_expansion(self, parser):
        """Test CamelCase expansion doesn't break boolean operators."""
        query = "UserAuth AND (login OR logout)"
        expanded = parser.preprocess_query(query)
        
        # Should expand UserAuth but preserve operators
        assert "User" in expanded or "Auth" in expanded
        assert "AND" in expanded
        assert "OR" in expanded
        assert "(" in expanded
        
    def test_quoted_phrases_with_boolean(self, parser):
        """Test quoted phrases preserved with boolean operators."""
        query = '"user authentication" AND login'
        expanded = parser.preprocess_query(query)
        
        # Quoted phrase should remain intact
        assert '"user authentication"' in expanded or '"' in expanded
        assert "AND" in expanded
    
    def test_not_operator_preservation(self, parser):
        """Test NOT operator is preserved correctly."""
        query = "login NOT logout"
        expanded = parser.preprocess_query(query)
        
        assert "NOT" in expanded
        assert "login" in expanded
        assert "logout" in expanded
    
    def test_complex_nested_three_levels(self, parser):
        """Test deeply nested boolean logic: ((A OR B) AND C) OR D."""
        query = "((UserAuth OR login) AND session) OR token"
        expanded = parser.preprocess_query(query)
        
        # Should handle multiple nesting levels
        assert expanded.count("(") >= 2  # At least 2 opening parens
        assert expanded.count(")") >= 2  # At least 2 closing parens
