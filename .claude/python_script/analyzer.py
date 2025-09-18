#!/usr/bin/env python3
"""
Unified Path-Aware Analyzer
Main entry point for the refactored analyzer system.
Provides a clean, simple API for intelligent file analysis.
"""

import os
import sys
import argparse
import logging
import json
import time
from pathlib import Path
from typing import Dict, List, Optional, Any

# Add current directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from core.config import get_config
from core.file_indexer import FileIndexer, IndexStats
from core.context_analyzer import ContextAnalyzer, AnalysisResult
from core.path_matcher import PathMatcher, PathMatchingResult
from core.embedding_manager import EmbeddingManager
from utils.colors import Colors


class Analyzer:
    """Main analyzer class with simplified API."""

    def __init__(self, config_path: Optional[str] = None, root_path: str = "."):
        self.root_path = Path(root_path).resolve()
        self.config = get_config(config_path)

        # Setup logging
        logging.basicConfig(
            level=getattr(logging, self.config.get('logging.level', 'INFO')),
            format=self.config.get('logging.format', '%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        )
        self.logger = logging.getLogger(__name__)

        # Initialize core components
        self.indexer = FileIndexer(self.config, str(self.root_path))
        self.context_analyzer = ContextAnalyzer(self.config)
        self.path_matcher = PathMatcher(self.config)

        # Initialize embedding manager if enabled
        self.embedding_manager = None
        if self.config.is_embedding_enabled():
            try:
                self.embedding_manager = EmbeddingManager(self.config)
            except ImportError:
                self.logger.warning("Embedding dependencies not available. Install sentence-transformers for enhanced functionality.")

    def build_index(self) -> IndexStats:
        """Build or update the file index."""
        print(Colors.yellow("Building file index..."))
        start_time = time.time()

        self.indexer.build_index()
        stats = self.indexer.get_stats()

        elapsed = time.time() - start_time
        if stats:
            print(Colors.green(f"Index built: {stats.total_files} files, ~{stats.total_tokens:,} tokens ({elapsed:.2f}s)"))
        else:
            print(Colors.green(f"Index built successfully ({elapsed:.2f}s)"))

        return stats

    def analyze(self, prompt: str, mode: str = "auto", patterns: Optional[List[str]] = None,
               token_limit: Optional[int] = None, use_embeddings: Optional[bool] = None) -> Dict[str, Any]:
        """Analyze and return relevant file paths for a given prompt."""

        print(Colors.yellow("Analyzing project and prompt..."))
        start_time = time.time()

        # Load or build index
        index = self.indexer.load_index()
        if not index:
            self.build_index()
            index = self.indexer.load_index()

        stats = self.indexer.get_stats()
        print(Colors.cyan(f"Project stats: ~{stats.total_tokens:,} tokens across {stats.total_files} files"))
        print(Colors.cyan(f"Categories: {', '.join(f'{k}: {v}' for k, v in stats.categories.items())}"))

        # Determine project size
        project_size = self._classify_project_size(stats.total_tokens)
        print(Colors.cyan(f"Project size: {project_size}"))

        # Analyze prompt context
        print(Colors.yellow("Analyzing prompt context..."))
        context_result = self.context_analyzer.analyze(prompt)

        print(Colors.cyan(f"Identified: {len(context_result.domains)} domains, {len(context_result.languages)} languages"))
        if context_result.domains:
            print(Colors.cyan(f"Top domains: {', '.join(context_result.domains[:3])}"))

        # Determine if we should use embeddings
        should_use_embeddings = use_embeddings
        if should_use_embeddings is None:
            should_use_embeddings = (
                self.embedding_manager is not None and
                self.config.is_embedding_enabled() and
                len(context_result.keywords) < 5  # Use embeddings for vague queries
            )

        similar_files = []
        if should_use_embeddings and self.embedding_manager:
            print(Colors.yellow("Using semantic similarity search..."))
            # Update embeddings if needed
            if not self.embedding_manager.embeddings_exist():
                print(Colors.yellow("Building embeddings (first run)..."))
                self.embedding_manager.update_embeddings(index)

            similar_files = self.embedding_manager.find_similar_files(prompt, index)
            print(Colors.cyan(f"Found {len(similar_files)} semantically similar files"))

        # Match files to context
        print(Colors.yellow("Matching files to context..."))
        matching_result = self.path_matcher.match_files(
            index,
            context_result,
            token_limit=token_limit,
            explicit_patterns=patterns
        )

        elapsed = time.time() - start_time

        print(Colors.green(f"Analysis complete: {len(matching_result.matched_files)} files, ~{matching_result.total_tokens:,} tokens"))
        print(Colors.cyan(f"Confidence: {matching_result.confidence_score:.2f}"))
        print(Colors.cyan(f"Execution time: {elapsed:.2f}s"))

        return {
            'files': [match.file_info.relative_path for match in matching_result.matched_files],
            'total_tokens': matching_result.total_tokens,
            'confidence': matching_result.confidence_score,
            'context': {
                'domains': context_result.domains,
                'languages': context_result.languages,
                'keywords': context_result.keywords
            },
            'stats': {
                'project_size': project_size,
                'total_files': stats.total_files,
                'analysis_time': elapsed,
                'embeddings_used': should_use_embeddings
            }
        }

    def generate_command(self, prompt: str, tool: str = "gemini", **kwargs) -> str:
        """Generate a command for external tools (gemini/codex)."""
        analysis_result = self.analyze(prompt, **kwargs)

        # Format file patterns
        file_patterns = " ".join(f"@{{{file}}}" for file in analysis_result['files'])

        if tool == "gemini":
            if len(analysis_result['files']) > 50:  # Too many files for individual patterns
                return f'gemini --all-files -p "{prompt}"'
            else:
                return f'gemini -p "{file_patterns} {prompt}"'

        elif tool == "codex":
            workspace_flag = "-s workspace-write" if analysis_result['total_tokens'] > 100000 else "-s danger-full-access"
            return f'codex {workspace_flag} --full-auto exec "{file_patterns} {prompt}"'

        else:
            raise ValueError(f"Unsupported tool: {tool}")

    def _classify_project_size(self, tokens: int) -> str:
        """Classify project size based on token count."""
        small_limit = self.config.get('token_limits.small_project', 500000)
        medium_limit = self.config.get('token_limits.medium_project', 2000000)

        if tokens < small_limit:
            return "small"
        elif tokens < medium_limit:
            return "medium"
        else:
            return "large"

    def get_project_stats(self) -> Dict[str, Any]:
        """Get comprehensive project statistics."""
        stats = self.indexer.get_stats()
        embedding_stats = {}

        if self.embedding_manager:
            embedding_stats = {
                'embeddings_exist': self.embedding_manager.embeddings_exist(),
                'embedding_count': len(self.embedding_manager.load_embeddings()) if self.embedding_manager.embeddings_exist() else 0
            }

        return {
            'files': stats.total_files,
            'tokens': stats.total_tokens,
            'size_bytes': stats.total_size,
            'categories': stats.categories,
            'project_size': self._classify_project_size(stats.total_tokens),
            'last_updated': stats.last_updated,
            'embeddings': embedding_stats,
            'config': {
                'cache_dir': self.config.get_cache_dir(),
                'embedding_enabled': self.config.is_embedding_enabled(),
                'exclude_patterns_count': len(self.config.get_exclude_patterns())
            }
        }


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Path-Aware Analyzer - Intelligent file pattern detection",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python analyzer.py "analyze authentication flow"
  python analyzer.py "fix database connection" --patterns "src/**/*.py"
  python analyzer.py "review API endpoints" --tool gemini
  python analyzer.py --stats
        """
    )

    parser.add_argument('prompt', nargs='?', help='Analysis prompt or task description')
    parser.add_argument('--patterns', nargs='*', help='Explicit file patterns to include')
    parser.add_argument('--tool', choices=['gemini', 'codex'], help='Generate command for specific tool')
    parser.add_argument('--output', choices=['patterns', 'json'], default='patterns', help='Output format')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--stats', action='store_true', help='Show project statistics and exit')
    parser.add_argument('--build-index', action='store_true', help='Build file index and exit')

    args = parser.parse_args()

    # Create analyzer with default values
    analyzer = Analyzer(config_path=None, root_path=".")

    # Handle special commands
    if args.build_index:
        analyzer.build_index()
        return

    if args.stats:
        stats = analyzer.get_project_stats()
        if args.output == 'json':
            print(json.dumps(stats, indent=2, default=str))
        else:
            print(f"Total files: {stats['files']}")
            print(f"Total tokens: {stats['tokens']:,}")
            print(f"Categories: {stats['categories']}")
            if 'embeddings' in stats:
                print(f"Embeddings: {stats['embeddings']['embedding_count']}")
        return

    # Require prompt for analysis
    if not args.prompt:
        parser.error("Analysis prompt is required unless using --build-index or --stats")

    # Perform analysis
    try:
        result = analyzer.analyze(
            args.prompt,
            patterns=args.patterns,
            use_embeddings=False  # Disable embeddings by default for simplicity
        )

        # Generate output
        if args.tool:
            # Generate command using already computed result
            file_patterns = " ".join(f"@{{{file}}}" for file in result['files'])
            if args.tool == "gemini":
                if len(result['files']) > 50:
                    command = f'gemini --all-files -p "{args.prompt}"'
                else:
                    command = f'gemini -p "{file_patterns} {args.prompt}"'
            elif args.tool == "codex":
                workspace_flag = "-s workspace-write" if result['total_tokens'] > 100000 else "-s danger-full-access"
                command = f'codex {workspace_flag} --full-auto exec "{file_patterns} {args.prompt}"'
            print(command)
        elif args.output == 'json':
            print(json.dumps(result, indent=2, default=str))
        else:  # patterns output (default)
            for file_path in result['files']:
                print(f"@{{{file_path}}}")

        # Show verbose details
        if args.verbose:
            print(f"\n# Analysis Details:")
            print(f"# Matched files: {len(result['files'])}")
            print(f"# Total tokens: {result['total_tokens']:,}")
            print(f"# Confidence: {result['confidence']:.2f}")

    except KeyboardInterrupt:
        print(Colors.warning("\nAnalysis interrupted by user"))
        sys.exit(1)
    except Exception as e:
        print(Colors.error(f"Analysis failed: {e}"))
        if args.verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()