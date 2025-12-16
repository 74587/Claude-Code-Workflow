"""Query preprocessing for CodexLens search.

Provides query expansion for better identifier matching:
- CamelCase splitting: UserAuth → User OR Auth
- snake_case splitting: user_auth → user OR auth
- Preserves original query for exact matching
"""

from __future__ import annotations

import logging
import re
from typing import Set, List

log = logging.getLogger(__name__)


class QueryParser:
    """Parser for preprocessing search queries before FTS5 execution.

    Expands identifier-style queries (CamelCase, snake_case) into OR queries
    to improve recall when searching for code symbols.

    Example transformations:
        - 'UserAuth' → 'UserAuth OR User OR Auth'
        - 'user_auth' → 'user_auth OR user OR auth'
        - 'getUserData' → 'getUserData OR get OR User OR Data'
    """

    # Patterns for identifier splitting
    CAMEL_CASE_PATTERN = re.compile(r'([a-z])([A-Z])')
    SNAKE_CASE_PATTERN = re.compile(r'_+')
    KEBAB_CASE_PATTERN = re.compile(r'-+')

    # Minimum token length to include in expansion (avoid noise from single chars)
    MIN_TOKEN_LENGTH = 2

    # All-caps acronyms pattern (e.g., HTTP, SQL, API)
    ALL_CAPS_PATTERN = re.compile(r'^[A-Z]{2,}$')

    def __init__(self, enable: bool = True, min_token_length: int = 2):
        """Initialize query parser.

        Args:
            enable: Whether to enable query preprocessing
            min_token_length: Minimum token length to include in expansion
        """
        self.enable = enable
        self.min_token_length = min_token_length

    def preprocess_query(self, query: str) -> str:
        """Preprocess query with identifier expansion.

        Args:
            query: Original search query

        Returns:
            Expanded query with OR operator connecting original and split tokens

        Example:
            >>> parser = QueryParser()
            >>> parser.preprocess_query('UserAuth')
            'UserAuth OR User OR Auth'
            >>> parser.preprocess_query('get_user_data')
            'get_user_data OR get OR user OR data'
        """
        if not self.enable:
            return query

        query = query.strip()
        if not query:
            return query

        # Extract tokens from query (handle multiple words/terms)
        # For simple queries, just process the whole thing
        # For complex FTS5 queries with operators, preserve structure
        if self._is_simple_query(query):
            return self._expand_simple_query(query)
        else:
            # Complex query with FTS5 operators, don't expand
            log.debug(f"Skipping expansion for complex FTS5 query: {query}")
            return query

    def _is_simple_query(self, query: str) -> bool:
        """Check if query is simple (no FTS5 operators).

        Args:
            query: Search query

        Returns:
            True if query is simple (safe to expand), False otherwise
        """
        # Check for FTS5 operators that indicate complex query
        fts5_operators = ['OR', 'AND', 'NOT', 'NEAR', '*', '^', '"']
        return not any(op in query for op in fts5_operators)

    def _expand_simple_query(self, query: str) -> str:
        """Expand a simple query with identifier splitting.

        Args:
            query: Simple search query

        Returns:
            Expanded query with OR operators
        """
        tokens: Set[str] = set()

        # Always include original query
        tokens.add(query)

        # Split on whitespace first
        words = query.split()

        for word in words:
            # Extract tokens from this word
            word_tokens = self._extract_tokens(word)
            tokens.update(word_tokens)

        # Filter out short tokens and duplicates
        filtered_tokens = [
            t for t in tokens
            if len(t) >= self.min_token_length
        ]

        # Remove duplicates while preserving original query first
        unique_tokens: List[str] = []
        seen: Set[str] = set()

        # Always put original query first
        if query not in seen and len(query) >= self.min_token_length:
            unique_tokens.append(query)
            seen.add(query)

        # Add other tokens
        for token in filtered_tokens:
            if token not in seen:
                unique_tokens.append(token)
                seen.add(token)

        # Join with OR operator (only if we have multiple tokens)
        if len(unique_tokens) > 1:
            expanded = ' OR '.join(unique_tokens)
            log.debug(f"Expanded query: '{query}' → '{expanded}'")
            return expanded
        else:
            return query

    def _extract_tokens(self, word: str) -> Set[str]:
        """Extract tokens from a single word using various splitting strategies.

        Args:
            word: Single word/identifier to split

        Returns:
            Set of extracted tokens
        """
        tokens: Set[str] = set()

        # Add original word
        tokens.add(word)

        # Handle all-caps acronyms (don't split)
        if self.ALL_CAPS_PATTERN.match(word):
            return tokens

        # CamelCase splitting
        camel_tokens = self._split_camel_case(word)
        tokens.update(camel_tokens)

        # snake_case splitting
        snake_tokens = self._split_snake_case(word)
        tokens.update(snake_tokens)

        # kebab-case splitting
        kebab_tokens = self._split_kebab_case(word)
        tokens.update(kebab_tokens)

        return tokens

    def _split_camel_case(self, word: str) -> List[str]:
        """Split CamelCase identifier into tokens.

        Args:
            word: CamelCase identifier (e.g., 'getUserData')

        Returns:
            List of tokens (e.g., ['get', 'User', 'Data'])
        """
        # Insert space before uppercase letters preceded by lowercase
        spaced = self.CAMEL_CASE_PATTERN.sub(r'\1 \2', word)
        # Split on spaces and filter empty
        return [t for t in spaced.split() if t]

    def _split_snake_case(self, word: str) -> List[str]:
        """Split snake_case identifier into tokens.

        Args:
            word: snake_case identifier (e.g., 'get_user_data')

        Returns:
            List of tokens (e.g., ['get', 'user', 'data'])
        """
        # Split on underscores
        return [t for t in self.SNAKE_CASE_PATTERN.split(word) if t]

    def _split_kebab_case(self, word: str) -> List[str]:
        """Split kebab-case identifier into tokens.

        Args:
            word: kebab-case identifier (e.g., 'get-user-data')

        Returns:
            List of tokens (e.g., ['get', 'user', 'data'])
        """
        # Split on hyphens
        return [t for t in self.KEBAB_CASE_PATTERN.split(word) if t]


# Global default parser instance
_default_parser = QueryParser(enable=True)


def preprocess_query(query: str, enable: bool = True) -> str:
    """Convenience function for query preprocessing.

    Args:
        query: Original search query
        enable: Whether to enable preprocessing

    Returns:
        Preprocessed query with identifier expansion
    """
    if not enable:
        return query

    return _default_parser.preprocess_query(query)


__all__ = [
    "QueryParser",
    "preprocess_query",
]
