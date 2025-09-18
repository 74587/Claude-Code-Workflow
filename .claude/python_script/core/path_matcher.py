#!/usr/bin/env python3
"""
Path Matcher Module for UltraThink Path-Aware Analyzer
Matches files to analysis context and ranks them by relevance.
"""

import re
import logging
import fnmatch
from typing import Dict, List, Tuple, Optional, Set
from dataclasses import dataclass
from pathlib import Path
import math

from .file_indexer import FileInfo
from .context_analyzer import AnalysisResult

@dataclass
class MatchResult:
    """Result of path matching with relevance score."""
    file_info: FileInfo
    relevance_score: float
    match_reasons: List[str]
    category_bonus: float

@dataclass
class PathMatchingResult:
    """Complete result of path matching operation."""
    matched_files: List[MatchResult]
    total_tokens: int
    categories: Dict[str, int]
    patterns_used: List[str]
    confidence_score: float

class PathMatcher:
    """Matches files to analysis context using various algorithms."""

    def __init__(self, config: Dict):
        self.config = config
        self.logger = logging.getLogger(__name__)

        # Load scoring weights
        self.weights = config.get('path_matching', {}).get('weights', {
            'keyword_match': 0.4,
            'extension_match': 0.2,
            'directory_context': 0.2,
            'file_size_penalty': 0.1,
            'recency_bonus': 0.1
        })

        # Load limits
        self.max_files_per_category = config.get('path_matching', {}).get('max_files_per_category', 20)
        self.min_relevance_score = config.get('path_matching', {}).get('min_relevance_score', 0.1)
        self.max_total_files = config.get('output', {}).get('max_total_files', 50)

        # Load always include patterns
        self.always_include = config.get('output', {}).get('always_include', [])

        # Category priorities
        self.category_priorities = {
            'code': 1.0,
            'config': 0.8,
            'docs': 0.6,
            'web': 0.4,
            'other': 0.2
        }

    def _calculate_keyword_score(self, file_info: FileInfo, keywords: List[str]) -> Tuple[float, List[str]]:
        """Calculate score based on keyword matches in file path."""
        if not keywords:
            return 0.0, []

        path_lower = file_info.relative_path.lower()
        filename_lower = Path(file_info.relative_path).name.lower()

        matches = []
        score = 0.0

        for keyword in keywords:
            keyword_lower = keyword.lower()

            # Exact filename match (highest weight)
            if keyword_lower in filename_lower:
                score += 2.0
                matches.append(f"filename:{keyword}")
                continue

            # Directory name match
            if keyword_lower in path_lower:
                score += 1.0
                matches.append(f"path:{keyword}")
                continue

            # Partial match in path components
            path_parts = path_lower.split('/')
            for part in path_parts:
                if keyword_lower in part:
                    score += 0.5
                    matches.append(f"partial:{keyword}")
                    break

        # Normalize by number of keywords
        normalized_score = score / len(keywords) if keywords else 0.0
        return min(normalized_score, 1.0), matches

    def _calculate_extension_score(self, file_info: FileInfo, languages: List[str]) -> float:
        """Calculate score based on file extension relevance."""
        if not languages:
            return 0.5  # Neutral score

        extension = file_info.extension.lower()

        # Language-specific extension mapping
        lang_extensions = {
            'python': ['.py', '.pyx', '.pyi'],
            'javascript': ['.js', '.jsx', '.mjs'],
            'typescript': ['.ts', '.tsx'],
            'java': ['.java'],
            'go': ['.go'],
            'rust': ['.rs'],
            'cpp': ['.cpp', '.cc', '.cxx', '.c', '.h', '.hpp'],
            'csharp': ['.cs'],
            'php': ['.php'],
            'ruby': ['.rb'],
            'shell': ['.sh', '.bash', '.zsh']
        }

        score = 0.0
        for language in languages:
            if language in lang_extensions:
                if extension in lang_extensions[language]:
                    score = 1.0
                    break

        # Fallback to category-based scoring
        if score == 0.0:
            category_scores = {
                'code': 1.0,
                'config': 0.8,
                'docs': 0.6,
                'web': 0.4,
                'other': 0.2
            }
            score = category_scores.get(file_info.category, 0.2)

        return score

    def _calculate_directory_score(self, file_info: FileInfo, domains: List[str]) -> Tuple[float, List[str]]:
        """Calculate score based on directory context."""
        if not domains:
            return 0.0, []

        path_parts = file_info.relative_path.lower().split('/')
        matches = []
        score = 0.0

        # Domain-specific directory patterns
        domain_patterns = {
            'auth': ['auth', 'authentication', 'login', 'user', 'account'],
            'authentication': ['auth', 'authentication', 'login', 'user', 'account'],
            'database': ['db', 'database', 'model', 'entity', 'migration', 'schema'],
            'api': ['api', 'rest', 'graphql', 'route', 'controller', 'handler'],
            'frontend': ['ui', 'component', 'view', 'template', 'client', 'web'],
            'backend': ['service', 'server', 'core', 'business', 'logic'],
            'test': ['test', 'spec', 'tests', '__tests__', 'testing'],
            'testing': ['test', 'spec', 'tests', '__tests__', 'testing'],
            'config': ['config', 'configuration', 'env', 'settings'],
            'configuration': ['config', 'configuration', 'env', 'settings'],
            'util': ['util', 'utils', 'helper', 'common', 'shared', 'lib'],
            'utility': ['util', 'utils', 'helper', 'common', 'shared', 'lib']
        }

        for domain in domains:
            if domain in domain_patterns:
                patterns = domain_patterns[domain]
                for pattern in patterns:
                    for part in path_parts:
                        if pattern in part:
                            score += 1.0
                            matches.append(f"dir:{domain}->{pattern}")
                            break

        # Normalize by number of domains
        normalized_score = score / len(domains) if domains else 0.0
        return min(normalized_score, 1.0), matches

    def _calculate_size_penalty(self, file_info: FileInfo) -> float:
        """Calculate penalty for very large files."""
        max_size = self.config.get('performance', {}).get('max_file_size', 10485760)  # 10MB

        if file_info.size > max_size:
            # Heavy penalty for oversized files
            return -0.5
        elif file_info.size > max_size * 0.5:
            # Light penalty for large files
            return -0.2
        else:
            return 0.0

    def _calculate_recency_bonus(self, file_info: FileInfo) -> float:
        """Calculate bonus for recently modified files."""
        import time

        current_time = time.time()
        file_age = current_time - file_info.modified_time

        # Files modified in last day get bonus
        if file_age < 86400:  # 1 day
            return 0.3
        elif file_age < 604800:  # 1 week
            return 0.1
        else:
            return 0.0

    def calculate_relevance_score(self, file_info: FileInfo, analysis: AnalysisResult) -> MatchResult:
        """Calculate overall relevance score for a file."""
        # Calculate individual scores
        keyword_score, keyword_matches = self._calculate_keyword_score(file_info, analysis.keywords)
        extension_score = self._calculate_extension_score(file_info, analysis.languages)
        directory_score, dir_matches = self._calculate_directory_score(file_info, analysis.domains)
        size_penalty = self._calculate_size_penalty(file_info)
        recency_bonus = self._calculate_recency_bonus(file_info)

        # Apply weights
        weighted_score = (
            keyword_score * self.weights.get('keyword_match', 0.4) +
            extension_score * self.weights.get('extension_match', 0.2) +
            directory_score * self.weights.get('directory_context', 0.2) +
            size_penalty * self.weights.get('file_size_penalty', 0.1) +
            recency_bonus * self.weights.get('recency_bonus', 0.1)
        )

        # Category bonus
        category_bonus = self.category_priorities.get(file_info.category, 0.2)

        # Final score with category bonus
        final_score = weighted_score + (category_bonus * 0.1)

        # Collect match reasons
        match_reasons = keyword_matches + dir_matches
        if extension_score > 0.5:
            match_reasons.append(f"extension:{file_info.extension}")
        if recency_bonus > 0:
            match_reasons.append("recent")

        return MatchResult(
            file_info=file_info,
            relevance_score=max(0.0, final_score),
            match_reasons=match_reasons,
            category_bonus=category_bonus
        )

    def match_by_patterns(self, file_index: Dict[str, FileInfo], patterns: List[str]) -> List[FileInfo]:
        """Match files using explicit glob patterns."""
        matched_files = []

        for pattern in patterns:
            for path, file_info in file_index.items():
                # Try matching both relative path and full path
                if (fnmatch.fnmatch(path, pattern) or
                    fnmatch.fnmatch(file_info.path, pattern) or
                    fnmatch.fnmatch(Path(path).name, pattern)):
                    matched_files.append(file_info)

        # Remove duplicates based on path
        seen_paths = set()
        unique_files = []
        for file_info in matched_files:
            if file_info.relative_path not in seen_paths:
                seen_paths.add(file_info.relative_path)
                unique_files.append(file_info)
        return unique_files

    def match_always_include(self, file_index: Dict[str, FileInfo]) -> List[FileInfo]:
        """Match files that should always be included."""
        return self.match_by_patterns(file_index, self.always_include)

    def rank_files(self, files: List[FileInfo], analysis: AnalysisResult) -> List[MatchResult]:
        """Rank files by relevance score."""
        match_results = []

        for file_info in files:
            match_result = self.calculate_relevance_score(file_info, analysis)
            if match_result.relevance_score >= self.min_relevance_score:
                match_results.append(match_result)

        # Sort by relevance score (descending)
        match_results.sort(key=lambda x: x.relevance_score, reverse=True)

        return match_results

    def select_best_files(self, ranked_files: List[MatchResult], token_limit: Optional[int] = None) -> List[MatchResult]:
        """Select the best files within token limits and category constraints."""
        if not ranked_files:
            return []

        selected_files = []
        total_tokens = 0
        category_counts = {}

        for match_result in ranked_files:
            file_info = match_result.file_info
            category = file_info.category

            # Check category limit
            if category_counts.get(category, 0) >= self.max_files_per_category:
                continue

            # Check token limit
            if token_limit and total_tokens + file_info.estimated_tokens > token_limit:
                continue

            # Check total file limit
            if len(selected_files) >= self.max_total_files:
                break

            # Add file
            selected_files.append(match_result)
            total_tokens += file_info.estimated_tokens
            category_counts[category] = category_counts.get(category, 0) + 1

        return selected_files

    def match_files(self, file_index: Dict[str, FileInfo], analysis: AnalysisResult,
                   token_limit: Optional[int] = None, explicit_patterns: Optional[List[str]] = None) -> PathMatchingResult:
        """Main file matching function."""
        self.logger.info(f"Matching files for analysis with {len(analysis.keywords)} keywords and {len(analysis.domains)} domains")

        # Start with always-include files
        always_include_files = self.match_always_include(file_index)
        self.logger.debug(f"Always include: {len(always_include_files)} files")

        # Add explicit pattern matches
        pattern_files = []
        patterns_used = []
        if explicit_patterns:
            pattern_files = self.match_by_patterns(file_index, explicit_patterns)
            patterns_used.extend(explicit_patterns)
            self.logger.debug(f"Explicit patterns: {len(pattern_files)} files")

        # Add suggested pattern matches
        if analysis.file_patterns:
            suggested_files = self.match_by_patterns(file_index, analysis.file_patterns)
            pattern_files.extend(suggested_files)
            patterns_used.extend(analysis.file_patterns)
            self.logger.debug(f"Suggested patterns: {len(suggested_files)} files")

        # Combine all candidate files and remove duplicates
        all_files = always_include_files + pattern_files + list(file_index.values())
        seen_paths = set()
        all_candidates = []
        for file_info in all_files:
            if file_info.relative_path not in seen_paths:
                seen_paths.add(file_info.relative_path)
                all_candidates.append(file_info)
        self.logger.debug(f"Total candidates: {len(all_candidates)} files")

        # Rank all candidates
        ranked_files = self.rank_files(all_candidates, analysis)
        self.logger.debug(f"Files above threshold: {len(ranked_files)}")

        # Select best files within limits
        selected_files = self.select_best_files(ranked_files, token_limit)
        self.logger.info(f"Selected {len(selected_files)} files")

        # Calculate statistics
        total_tokens = sum(match.file_info.estimated_tokens for match in selected_files)
        categories = {}
        for match in selected_files:
            category = match.file_info.category
            categories[category] = categories.get(category, 0) + 1

        # Calculate confidence score
        confidence_score = self._calculate_confidence(selected_files, analysis)

        return PathMatchingResult(
            matched_files=selected_files,
            total_tokens=total_tokens,
            categories=categories,
            patterns_used=patterns_used,
            confidence_score=confidence_score
        )

    def _calculate_confidence(self, selected_files: List[MatchResult], analysis: AnalysisResult) -> float:
        """Calculate confidence score for the matching result."""
        if not selected_files:
            return 0.0

        # Average relevance score
        avg_relevance = sum(match.relevance_score for match in selected_files) / len(selected_files)

        # Keyword coverage (how many keywords are represented)
        keyword_coverage = 0.0
        if analysis.keywords:
            covered_keywords = set()
            for match in selected_files:
                for reason in match.match_reasons:
                    if reason.startswith('filename:') or reason.startswith('path:'):
                        keyword = reason.split(':', 1)[1]
                        covered_keywords.add(keyword)
            keyword_coverage = len(covered_keywords) / len(analysis.keywords)

        # Domain coverage
        domain_coverage = 0.0
        if analysis.domains:
            covered_domains = set()
            for match in selected_files:
                for reason in match.match_reasons:
                    if reason.startswith('dir:'):
                        domain = reason.split('->', 1)[0].split(':', 1)[1]
                        covered_domains.add(domain)
            domain_coverage = len(covered_domains) / len(analysis.domains)

        # Weighted confidence score
        confidence = (
            avg_relevance * 0.5 +
            keyword_coverage * 0.3 +
            domain_coverage * 0.2
        )

        return min(confidence, 1.0)

    def format_patterns(self, selected_files: List[MatchResult]) -> List[str]:
        """Format selected files as @{pattern} strings."""
        pattern_format = self.config.get('output', {}).get('pattern_format', '@{{{path}}}')

        patterns = []
        for match in selected_files:
            pattern = pattern_format.format(path=match.file_info.relative_path)
            patterns.append(pattern)

        return patterns

def main():
    """Command-line interface for path matcher."""
    import yaml
    import argparse
    import json
    from .file_indexer import FileIndexer
    from .context_analyzer import ContextAnalyzer

    parser = argparse.ArgumentParser(description="Path Matcher for UltraThink")
    parser.add_argument("prompt", help="Prompt to analyze and match")
    parser.add_argument("--config", default="config.yaml", help="Configuration file path")
    parser.add_argument("--token-limit", type=int, help="Token limit for selection")
    parser.add_argument("--patterns", nargs="*", help="Explicit patterns to include")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")

    args = parser.parse_args()

    # Setup logging
    level = logging.DEBUG if args.verbose else logging.INFO
    logging.basicConfig(level=level, format='%(levelname)s: %(message)s')

    # Load configuration
    config_path = Path(__file__).parent / args.config
    with open(config_path, 'r', encoding='utf-8') as f:
        config = yaml.safe_load(f)

    # Create components
    indexer = FileIndexer(config)
    analyzer = ContextAnalyzer(config)
    matcher = PathMatcher(config)

    # Build file index
    file_index = indexer.load_index()
    if not file_index:
        print("Building file index...")
        file_index = indexer.build_index()

    # Analyze prompt
    analysis = analyzer.analyze(args.prompt)

    # Match files
    result = matcher.match_files(
        file_index=file_index,
        analysis=analysis,
        token_limit=args.token_limit,
        explicit_patterns=args.patterns
    )

    # Output results
    print(f"Matched {len(result.matched_files)} files (~{result.total_tokens:,} tokens)")
    print(f"Categories: {result.categories}")
    print(f"Confidence: {result.confidence_score:.2f}")
    print()

    patterns = matcher.format_patterns(result.matched_files)
    print("Patterns:")
    for pattern in patterns[:20]:  # Limit output
        print(f"  {pattern}")

    if args.verbose:
        print("\nDetailed matches:")
        for match in result.matched_files[:10]:
            print(f"  {match.file_info.relative_path} (score: {match.relevance_score:.3f})")
            print(f"    Reasons: {', '.join(match.match_reasons)}")

if __name__ == "__main__":
    main()