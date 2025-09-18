#!/usr/bin/env python3
"""
CLI Interface for Path-Aware Analysis
Provides command-line interface for intelligent file analysis and pattern matching.
"""

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
from core.file_indexer import FileIndexer
from core.context_analyzer import ContextAnalyzer
from core.path_matcher import PathMatcher
from utils.colors import Colors


class AnalysisCLI:
    """Command-line interface for file analysis and pattern matching."""

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

    def analyze(self, prompt: str, patterns: Optional[List[str]] = None) -> Dict[str, Any]:
        """Analyze and return relevant file paths for a given prompt."""
        print(Colors.yellow("Analyzing project and prompt..."))
        start_time = time.time()

        # Load index (build if not exists)
        index = self.indexer.load_index()
        if not index:
            print(Colors.warning("No file index found. Run 'python indexer.py --build' first or use --auto-build"))
            return {}

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

        # Match files to context
        print(Colors.yellow("Matching files to context..."))
        matching_result = self.path_matcher.match_files(
            index,
            context_result,
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
                'analysis_time': elapsed
            }
        }

    def generate_command(self, prompt: str, tool: str, files: List[str]) -> str:
        """Generate a command for external tools (gemini/codex)."""
        file_patterns = " ".join(f"@{{{file}}}" for file in files)

        if tool == "gemini":
            if len(files) > 50:
                return f'gemini --all-files -p "{prompt}"'
            else:
                return f'gemini -p "{file_patterns} {prompt}"'
        elif tool == "codex":
            # Estimate tokens for workspace selection
            total_tokens = sum(len(file) * 50 for file in files)  # Rough estimate
            workspace_flag = "-s workspace-write" if total_tokens > 100000 else "-s danger-full-access"
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

    def auto_build_index(self):
        """Auto-build index if it doesn't exist."""
        from indexer import ProjectIndexer
        indexer = ProjectIndexer(root_path=str(self.root_path))
        indexer.build_index()


def main():
    """CLI entry point for analysis."""
    parser = argparse.ArgumentParser(
        description="Path-Aware Analysis CLI - Intelligent file pattern detection",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python cli.py "analyze authentication flow"
  python cli.py "fix database connection" --patterns "src/**/*.py"
  python cli.py "review API endpoints" --tool gemini
        """
    )

    parser.add_argument('prompt', help='Analysis prompt or task description')
    parser.add_argument('--patterns', nargs='*', help='Explicit file patterns to include')
    parser.add_argument('--tool', choices=['gemini', 'codex'], help='Generate command for specific tool')
    parser.add_argument('--output', choices=['patterns', 'json'], default='patterns', help='Output format')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--auto-build', action='store_true', help='Auto-build index if missing')
    parser.add_argument('--config', help='Configuration file path')
    parser.add_argument('--root', default='.', help='Root directory to analyze')

    args = parser.parse_args()

    # Create CLI interface
    cli = AnalysisCLI(args.config, args.root)

    try:
        # Auto-build index if requested and missing
        if args.auto_build:
            index = cli.indexer.load_index()
            if not index:
                print(Colors.yellow("Auto-building missing index..."))
                cli.auto_build_index()

        # Perform analysis
        result = cli.analyze(args.prompt, patterns=args.patterns)

        if not result:
            sys.exit(1)

        # Generate output
        if args.tool:
            command = cli.generate_command(args.prompt, args.tool, result['files'])
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