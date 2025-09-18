#!/usr/bin/env python3
"""
Unified Module Analyzer
Combines functionality from detect_changed_modules.py and get_modules_by_depth.py
into a single, comprehensive module analysis tool.
"""

import os
import sys
import subprocess
import time
import json
from pathlib import Path
from typing import List, Dict, Optional, Set, Tuple
from dataclasses import dataclass, asdict

# Add parent directory for imports
sys.path.insert(0, str(Path(__file__).parent.parent))
from core.config import get_config
from core.gitignore_parser import GitignoreParser

@dataclass
class ModuleInfo:
    """Information about a module/directory."""
    depth: int
    path: str
    files: int
    types: List[str]
    has_claude: bool
    status: str = "normal"  # changed, normal, new, deleted
    last_modified: Optional[float] = None

    def to_dict(self) -> Dict:
        return asdict(self)

class ModuleAnalyzer:
    """Unified module analysis tool with change detection and depth analysis."""

    def __init__(self, root_path: str = ".", config_path: Optional[str] = None):
        self.root_path = Path(root_path).resolve()
        self.config = get_config(config_path)

        # Source file extensions for analysis
        self.source_extensions = {
            '.md', '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.rs',
            '.java', '.cpp', '.c', '.h', '.sh', '.ps1', '.json', '.yaml', '.yml',
            '.php', '.rb', '.swift', '.kt', '.scala', '.dart'
        }

        # Initialize gitignore parser for exclusions
        self.gitignore_parser = GitignoreParser(str(self.root_path))
        self.exclude_patterns = self._build_exclusion_patterns()

    def _build_exclusion_patterns(self) -> Set[str]:
        """Build exclusion patterns from config and gitignore."""
        exclusions = {
            '.git', '.history', '.vscode', '__pycache__', '.pytest_cache',
            'node_modules', 'dist', 'build', '.egg-info', '.env',
            '.cache', '.tmp', '.temp', '.DS_Store', 'Thumbs.db'
        }

        # Add patterns from config
        config_patterns = self.config.get('exclude_patterns', [])
        for pattern in config_patterns:
            # Extract directory names from patterns
            if '/' in pattern:
                parts = pattern.replace('*/', '').replace('/*', '').split('/')
                exclusions.update(part for part in parts if part and not part.startswith('*'))

        return exclusions

    def _should_exclude_directory(self, dir_path: Path) -> bool:
        """Check if directory should be excluded from analysis."""
        dir_name = dir_path.name

        # Check against exclusion patterns
        if dir_name in self.exclude_patterns:
            return True

        # Check if directory starts with . (hidden directories)
        if dir_name.startswith('.') and dir_name not in {'.github', '.vscode'}:
            return True

        return False

    def get_git_changed_files(self, since: str = "HEAD") -> Set[str]:
        """Get files changed in git."""
        changed_files = set()

        try:
            # Check if we're in a git repository
            subprocess.run(['git', 'rev-parse', '--git-dir'],
                         check=True, capture_output=True, cwd=self.root_path)

            # Get changes since specified reference
            commands = [
                ['git', 'diff', '--name-only', since],  # Changes since reference
                ['git', 'diff', '--name-only', '--staged'],  # Staged changes
                ['git', 'ls-files', '--others', '--exclude-standard']  # Untracked files
            ]

            for cmd in commands:
                try:
                    result = subprocess.run(cmd, capture_output=True, text=True,
                                          cwd=self.root_path, check=True)
                    if result.stdout.strip():
                        files = result.stdout.strip().split('\n')
                        changed_files.update(f for f in files if f)
                except subprocess.CalledProcessError:
                    continue

        except subprocess.CalledProcessError:
            # Not a git repository or git not available
            pass

        return changed_files

    def get_recently_modified_files(self, hours: int = 24) -> Set[str]:
        """Get files modified within the specified hours."""
        cutoff_time = time.time() - (hours * 3600)
        recent_files = set()

        try:
            for file_path in self.root_path.rglob('*'):
                if file_path.is_file():
                    try:
                        if file_path.stat().st_mtime > cutoff_time:
                            rel_path = file_path.relative_to(self.root_path)
                            recent_files.add(str(rel_path))
                    except (OSError, ValueError):
                        continue
        except Exception:
            pass

        return recent_files

    def analyze_directory(self, dir_path: Path) -> Optional[ModuleInfo]:
        """Analyze a single directory and return module information."""
        if self._should_exclude_directory(dir_path):
            return None

        try:
            # Count files by type
            file_types = set()
            file_count = 0
            has_claude = False
            last_modified = 0

            for item in dir_path.iterdir():
                if item.is_file():
                    file_count += 1

                    # Track file types
                    if item.suffix.lower() in self.source_extensions:
                        file_types.add(item.suffix.lower())

                    # Check for CLAUDE.md
                    if item.name.upper() == 'CLAUDE.MD':
                        has_claude = True

                    # Track latest modification
                    try:
                        mtime = item.stat().st_mtime
                        last_modified = max(last_modified, mtime)
                    except OSError:
                        continue

            # Calculate depth relative to root
            try:
                relative_path = dir_path.relative_to(self.root_path)
                depth = len(relative_path.parts)
            except ValueError:
                depth = 0

            return ModuleInfo(
                depth=depth,
                path=str(relative_path) if depth > 0 else ".",
                files=file_count,
                types=sorted(list(file_types)),
                has_claude=has_claude,
                last_modified=last_modified if last_modified > 0 else None
            )

        except (PermissionError, OSError):
            return None

    def detect_changed_modules(self, since: str = "HEAD") -> List[ModuleInfo]:
        """Detect modules affected by changes."""
        changed_files = self.get_git_changed_files(since)

        # If no git changes, fall back to recently modified files
        if not changed_files:
            changed_files = self.get_recently_modified_files(24)

        # Get affected directories
        affected_dirs = set()
        for file_path in changed_files:
            full_path = self.root_path / file_path
            if full_path.exists():
                # Add the file's directory and parent directories
                current_dir = full_path.parent
                while current_dir != self.root_path and current_dir.parent != current_dir:
                    affected_dirs.add(current_dir)
                    current_dir = current_dir.parent

        # Analyze affected directories
        modules = []
        for dir_path in affected_dirs:
            module_info = self.analyze_directory(dir_path)
            if module_info:
                module_info.status = "changed"
                modules.append(module_info)

        return sorted(modules, key=lambda m: (m.depth, m.path))

    def analyze_by_depth(self, max_depth: Optional[int] = None) -> List[ModuleInfo]:
        """Analyze all modules organized by depth (deepest first)."""
        modules = []

        def scan_directory(dir_path: Path, current_depth: int = 0):
            """Recursively scan directories."""
            if max_depth and current_depth > max_depth:
                return

            module_info = self.analyze_directory(dir_path)
            if module_info and module_info.files > 0:
                modules.append(module_info)

            # Recurse into subdirectories
            try:
                for item in dir_path.iterdir():
                    if item.is_dir() and not self._should_exclude_directory(item):
                        scan_directory(item, current_depth + 1)
            except (PermissionError, OSError):
                pass

        scan_directory(self.root_path)

        # Sort by depth (deepest first), then by path
        return sorted(modules, key=lambda m: (-m.depth, m.path))

    def get_dependencies(self, module_path: str) -> List[str]:
        """Get module dependencies (basic implementation)."""
        dependencies = []
        module_dir = self.root_path / module_path

        if not module_dir.exists() or not module_dir.is_dir():
            return dependencies

        # Look for common dependency files
        dependency_files = [
            'package.json',  # Node.js
            'requirements.txt',  # Python
            'Cargo.toml',  # Rust
            'go.mod',  # Go
            'pom.xml',  # Java Maven
            'build.gradle',  # Java Gradle
        ]

        for dep_file in dependency_files:
            dep_path = module_dir / dep_file
            if dep_path.exists():
                dependencies.append(str(dep_path.relative_to(self.root_path)))

        return dependencies

    def find_modules_with_pattern(self, pattern: str) -> List[ModuleInfo]:
        """Find modules matching a specific pattern in their path or files."""
        modules = self.analyze_by_depth()
        matching_modules = []

        for module in modules:
            # Check if pattern matches path
            if pattern.lower() in module.path.lower():
                matching_modules.append(module)
                continue

            # Check if pattern matches file types
            if any(pattern.lower() in ext.lower() for ext in module.types):
                matching_modules.append(module)

        return matching_modules

    def export_analysis(self, modules: List[ModuleInfo], format: str = "json") -> str:
        """Export module analysis in specified format."""
        if format == "json":
            return json.dumps([module.to_dict() for module in modules], indent=2)

        elif format == "list":
            lines = []
            for module in modules:
                status = f"[{module.status}]" if module.status != "normal" else ""
                claude_marker = "[CLAUDE]" if module.has_claude else ""
                lines.append(f"{module.path} (depth:{module.depth}, files:{module.files}) {status} {claude_marker}")
            return "\n".join(lines)

        elif format == "grouped":
            grouped = {}
            for module in modules:
                depth = module.depth
                if depth not in grouped:
                    grouped[depth] = []
                grouped[depth].append(module)

            lines = []
            for depth in sorted(grouped.keys()):
                lines.append(f"\n=== Depth {depth} ===")
                for module in grouped[depth]:
                    status = f"[{module.status}]" if module.status != "normal" else ""
                    claude_marker = "[CLAUDE]" if module.has_claude else ""
                    lines.append(f"  {module.path} (files:{module.files}) {status} {claude_marker}")
            return "\n".join(lines)

        elif format == "paths":
            return "\n".join(module.path for module in modules)

        else:
            raise ValueError(f"Unsupported format: {format}")


def main():
    """Main CLI entry point."""
    import argparse

    parser = argparse.ArgumentParser(description="Module Analysis Tool")
    parser.add_argument("command", choices=["changed", "depth", "dependencies", "find"],
                       help="Analysis command to run")
    parser.add_argument("--format", choices=["json", "list", "grouped", "paths"],
                       default="list", help="Output format")
    parser.add_argument("--since", default="HEAD~1",
                       help="Git reference for change detection (default: HEAD~1)")
    parser.add_argument("--max-depth", type=int,
                       help="Maximum directory depth to analyze")
    parser.add_argument("--pattern", help="Pattern to search for (for find command)")
    parser.add_argument("--module", help="Module path for dependency analysis")
    parser.add_argument("--config", help="Configuration file path")

    args = parser.parse_args()

    analyzer = ModuleAnalyzer(config_path=args.config)

    if args.command == "changed":
        modules = analyzer.detect_changed_modules(args.since)
        print(analyzer.export_analysis(modules, args.format))

    elif args.command == "depth":
        modules = analyzer.analyze_by_depth(args.max_depth)
        print(analyzer.export_analysis(modules, args.format))

    elif args.command == "dependencies":
        if not args.module:
            print("Error: --module required for dependencies command", file=sys.stderr)
            sys.exit(1)
        deps = analyzer.get_dependencies(args.module)
        if args.format == "json":
            print(json.dumps(deps, indent=2))
        else:
            print("\n".join(deps))

    elif args.command == "find":
        if not args.pattern:
            print("Error: --pattern required for find command", file=sys.stderr)
            sys.exit(1)
        modules = analyzer.find_modules_with_pattern(args.pattern)
        print(analyzer.export_analysis(modules, args.format))


if __name__ == "__main__":
    main()