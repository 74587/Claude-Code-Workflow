#!/usr/bin/env python3
"""
GitIgnore Parser Module
Parses .gitignore files and converts rules to fnmatch patterns for file exclusion.
"""

import os
import fnmatch
from pathlib import Path
from typing import List, Set, Optional


class GitignoreParser:
    """Parser for .gitignore files that converts rules to fnmatch patterns."""

    def __init__(self, root_path: str = "."):
        self.root_path = Path(root_path).resolve()
        self.patterns: List[str] = []
        self.negation_patterns: List[str] = []

    def parse_file(self, gitignore_path: str) -> List[str]:
        """Parse a .gitignore file and return exclude patterns."""
        gitignore_file = Path(gitignore_path)
        if not gitignore_file.exists():
            return []

        patterns = []
        try:
            with open(gitignore_file, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    pattern = self._parse_line(line.strip())
                    if pattern:
                        patterns.append(pattern)
        except (UnicodeDecodeError, IOError):
            # Fallback to system encoding if UTF-8 fails
            try:
                with open(gitignore_file, 'r') as f:
                    for line_num, line in enumerate(f, 1):
                        pattern = self._parse_line(line.strip())
                        if pattern:
                            patterns.append(pattern)
            except IOError:
                # If file can't be read, return empty list
                return []

        return patterns

    def _parse_line(self, line: str) -> Optional[str]:
        """Parse a single line from .gitignore file."""
        # Skip empty lines and comments
        if not line or line.startswith('#'):
            return None

        # Handle negation patterns (starting with !)
        if line.startswith('!'):
            # For now, we'll skip negation patterns as they require
            # more complex logic to implement correctly
            return None

        # Convert gitignore pattern to fnmatch pattern
        return self._convert_to_fnmatch(line)

    def _convert_to_fnmatch(self, pattern: str) -> str:
        """Convert gitignore pattern to fnmatch pattern."""
        # Remove trailing slash (directory indicator)
        if pattern.endswith('/'):
            pattern = pattern[:-1]

        # Handle absolute paths (starting with /)
        if pattern.startswith('/'):
            pattern = pattern[1:]
            # Make it match from root
            return pattern

        # Handle patterns that should match anywhere in the tree
        # If pattern doesn't contain '/', it matches files/dirs at any level
        if '/' not in pattern:
            return f"*/{pattern}"

        # Pattern contains '/', so it's relative to the gitignore location
        return pattern

    def parse_all_gitignores(self, root_path: Optional[str] = None) -> List[str]:
        """Parse all .gitignore files in the repository hierarchy."""
        if root_path:
            self.root_path = Path(root_path).resolve()

        all_patterns = []

        # Find all .gitignore files in the repository
        gitignore_files = self._find_gitignore_files()

        for gitignore_file in gitignore_files:
            patterns = self.parse_file(gitignore_file)
            all_patterns.extend(patterns)

        return all_patterns

    def _find_gitignore_files(self) -> List[Path]:
        """Find all .gitignore files in the repository."""
        gitignore_files = []

        # Start with root .gitignore
        root_gitignore = self.root_path / '.gitignore'
        if root_gitignore.exists():
            gitignore_files.append(root_gitignore)

        # Find .gitignore files in subdirectories
        try:
            for gitignore_file in self.root_path.rglob('.gitignore'):
                if gitignore_file != root_gitignore:
                    gitignore_files.append(gitignore_file)
        except (PermissionError, OSError):
            # Skip directories we can't access
            pass

        return gitignore_files

    def should_exclude(self, file_path: str, gitignore_patterns: List[str]) -> bool:
        """Check if a file should be excluded based on gitignore patterns."""
        # Convert to relative path from root
        try:
            rel_path = str(Path(file_path).relative_to(self.root_path))
        except ValueError:
            # File is not under root path
            return False

        # Normalize path separators for consistent matching
        rel_path = rel_path.replace(os.sep, '/')

        for pattern in gitignore_patterns:
            if self._matches_pattern(rel_path, pattern):
                return True

        return False

    def _matches_pattern(self, file_path: str, pattern: str) -> bool:
        """Check if a file path matches a gitignore pattern."""
        # Normalize pattern separators
        pattern = pattern.replace(os.sep, '/')

        # Handle different pattern types
        if pattern.startswith('*/'):
            # Pattern like */pattern - matches at any level
            sub_pattern = pattern[2:]
            return fnmatch.fnmatch(file_path, f"*/{sub_pattern}") or fnmatch.fnmatch(file_path, sub_pattern)
        elif '/' in pattern:
            # Pattern contains slash - match exact path
            return fnmatch.fnmatch(file_path, pattern)
        else:
            # Simple pattern - match filename or directory at any level
            parts = file_path.split('/')
            return any(fnmatch.fnmatch(part, pattern) for part in parts)


def parse_gitignore(gitignore_path: str) -> List[str]:
    """Convenience function to parse a single .gitignore file."""
    parser = GitignoreParser()
    return parser.parse_file(gitignore_path)


def get_all_gitignore_patterns(root_path: str = ".") -> List[str]:
    """Convenience function to get all gitignore patterns in a repository."""
    parser = GitignoreParser(root_path)
    return parser.parse_all_gitignores()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1:
        gitignore_path = sys.argv[1]
        patterns = parse_gitignore(gitignore_path)
        print(f"Parsed {len(patterns)} patterns from {gitignore_path}:")
        for pattern in patterns:
            print(f"  {pattern}")
    else:
        # Parse all .gitignore files in current directory
        patterns = get_all_gitignore_patterns()
        print(f"Found {len(patterns)} gitignore patterns:")
        for pattern in patterns:
            print(f"  {pattern}")