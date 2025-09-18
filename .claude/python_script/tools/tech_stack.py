#!/usr/bin/env python3
"""
Python equivalent of tech-stack-loader.sh
DMSFlow Tech Stack Guidelines Loader
Returns tech stack specific coding guidelines and best practices for Claude processing

Usage: python tech_stack_loader.py [command] [tech_stack]
"""

import sys
import argparse
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

class TechStackLoader:
    """Load tech stack specific development guidelines."""

    def __init__(self, script_dir: Optional[str] = None):
        if script_dir:
            self.script_dir = Path(script_dir)
        else:
            self.script_dir = Path(__file__).parent

        # Look for template directory in multiple locations
        possible_template_dirs = [
            self.script_dir / "../tech-stack-templates",
            self.script_dir / "../workflows/cli-templates/tech-stacks",
            self.script_dir / "tech-stack-templates",
            self.script_dir / "templates",
        ]

        self.template_dir = None
        for template_dir in possible_template_dirs:
            if template_dir.exists():
                self.template_dir = template_dir.resolve()
                break

        if not self.template_dir:
            # Create a default template directory
            self.template_dir = self.script_dir / "tech-stack-templates"
            self.template_dir.mkdir(exist_ok=True)

    def parse_yaml_frontmatter(self, content: str) -> Tuple[Dict[str, str], str]:
        """Parse YAML frontmatter from markdown content."""
        frontmatter = {}
        content_start = 0

        lines = content.split('\n')
        if lines and lines[0].strip() == '---':
            # Find the closing ---
            for i, line in enumerate(lines[1:], 1):
                if line.strip() == '---':
                    content_start = i + 1
                    break
                elif ':' in line:
                    key, value = line.split(':', 1)
                    frontmatter[key.strip()] = value.strip()

        # Return frontmatter and content without YAML
        remaining_content = '\n'.join(lines[content_start:])
        return frontmatter, remaining_content

    def list_available_guidelines(self) -> str:
        """List all available development guidelines."""
        output = ["Available Development Guidelines:", "=" * 33]

        if not self.template_dir.exists():
            output.append("No template directory found.")
            return '\n'.join(output)

        for file_path in self.template_dir.glob("*.md"):
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                frontmatter, _ = self.parse_yaml_frontmatter(content)
                name = frontmatter.get('name', file_path.stem)
                description = frontmatter.get('description', 'No description available')

                output.append(f"{name:<20} - {description}")

            except Exception as e:
                output.append(f"{file_path.stem:<20} - Error reading file: {e}")

        return '\n'.join(output)

    def load_guidelines(self, tech_stack: str) -> str:
        """Load specific development guidelines."""
        template_path = self.template_dir / f"{tech_stack}.md"

        if not template_path.exists():
            # Try with different naming conventions
            alternatives = [
                f"{tech_stack}-dev.md",
                f"{tech_stack}_dev.md",
                f"{tech_stack.replace('-', '_')}.md",
                f"{tech_stack.replace('_', '-')}.md"
            ]

            for alt in alternatives:
                alt_path = self.template_dir / alt
                if alt_path.exists():
                    template_path = alt_path
                    break
            else:
                raise FileNotFoundError(
                    f"Error: Development guidelines '{tech_stack}' not found\n"
                    f"Use --list to see available guidelines"
                )

        try:
            with open(template_path, 'r', encoding='utf-8') as f:
                content = f.read()

            # Parse and return content without YAML frontmatter
            _, content_without_yaml = self.parse_yaml_frontmatter(content)
            return content_without_yaml.strip()

        except Exception as e:
            raise RuntimeError(f"Error reading guidelines file: {e}")

    def get_version(self) -> str:
        """Get version information."""
        return "DMSFlow tech-stack-loader v2.0 (Python)\nSemantic-based development guidelines system"

    def get_help(self) -> str:
        """Get help message."""
        return """Usage:
  tech_stack_loader.py --list              List all available guidelines with descriptions
  tech_stack_loader.py --load <name>       Load specific development guidelines
  tech_stack_loader.py <name>              Load specific guidelines (legacy format)
  tech_stack_loader.py --help              Show this help message
  tech_stack_loader.py --version           Show version information

Examples:
  tech_stack_loader.py --list
  tech_stack_loader.py --load javascript-dev
  tech_stack_loader.py python-dev"""

def main():
    """Command-line interface."""
    parser = argparse.ArgumentParser(
        description="DMSFlow Tech Stack Guidelines Loader",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  python tech_stack_loader.py --list
  python tech_stack_loader.py --load javascript-dev
  python tech_stack_loader.py python-dev"""
    )

    parser.add_argument("command", nargs="?", help="Command or tech stack name")
    parser.add_argument("tech_stack", nargs="?", help="Tech stack name (when using --load)")
    parser.add_argument("--list", action="store_true", help="List all available guidelines")
    parser.add_argument("--load", metavar="TECH_STACK", help="Load specific development guidelines")
    parser.add_argument("--version", "-v", action="store_true", help="Show version information")
    parser.add_argument("--template-dir", help="Override template directory path")

    args = parser.parse_args()

    try:
        loader = TechStackLoader(args.template_dir)

        # Handle version check
        if args.version or args.command == "--version":
            print(loader.get_version())
            return

        # Handle list command
        if args.list or args.command == "--list":
            print(loader.list_available_guidelines())
            return

        # Handle load command
        if args.load:
            result = loader.load_guidelines(args.load)
            print(result)
            return

        if args.command == "--load" and args.tech_stack:
            result = loader.load_guidelines(args.tech_stack)
            print(result)
            return

        # Handle legacy usage (direct tech stack name)
        if args.command and args.command not in ["--help", "--list", "--load"]:
            result = loader.load_guidelines(args.command)
            print(result)
            return

        # Show help
        print(loader.get_help())

    except (FileNotFoundError, RuntimeError) as e:
        print(str(e), file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()