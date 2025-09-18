#!/usr/bin/env python3
"""
Python equivalent of update_module_claude.sh
Update CLAUDE.md for a specific module with automatic layer detection

Usage: python update_module_claude.py <module_path> [update_type]
  module_path: Path to the module directory
  update_type: full|related (default: full)
  Script automatically detects layer depth and selects appropriate template
"""

import os
import sys
import subprocess
import time
import argparse
from pathlib import Path
from typing import Optional, Tuple, Dict
from dataclasses import dataclass

@dataclass
class LayerInfo:
    """Information about a documentation layer."""
    name: str
    template_path: str
    analysis_strategy: str

class ModuleClaudeUpdater:
    """Update CLAUDE.md documentation for modules with layer detection."""

    def __init__(self, home_dir: Optional[str] = None):
        self.home_dir = Path(home_dir) if home_dir else Path.home()
        self.template_base = self.home_dir / ".claude/workflows/cli-templates/prompts/dms"

    def detect_layer(self, module_path: str) -> LayerInfo:
        """Determine documentation layer based on path patterns."""
        clean_path = module_path.replace('./', '') if module_path.startswith('./') else module_path

        if module_path == ".":
            # Root directory
            return LayerInfo(
                name="Layer 1 (Root)",
                template_path=str(self.template_base / "claude-layer1-root.txt"),
                analysis_strategy="--all-files"
            )
        elif '/' not in clean_path:
            # Top-level directories (e.g., .claude, src, tests)
            return LayerInfo(
                name="Layer 2 (Domain)",
                template_path=str(self.template_base / "claude-layer2-domain.txt"),
                analysis_strategy="@{*/CLAUDE.md}"
            )
        elif clean_path.count('/') == 1:
            # Second-level directories (e.g., .claude/scripts, src/components)
            return LayerInfo(
                name="Layer 3 (Module)",
                template_path=str(self.template_base / "claude-layer3-module.txt"),
                analysis_strategy="@{*/CLAUDE.md}"
            )
        else:
            # Deeper directories (e.g., .claude/workflows/cli-templates/prompts)
            return LayerInfo(
                name="Layer 4 (Sub-Module)",
                template_path=str(self.template_base / "claude-layer4-submodule.txt"),
                analysis_strategy="--all-files"
            )

    def load_template(self, template_path: str) -> str:
        """Load template content from file."""
        try:
            with open(template_path, 'r', encoding='utf-8') as f:
                return f.read()
        except FileNotFoundError:
            print(f"   [WARN] Template not found: {template_path}, using fallback")
            return "Update CLAUDE.md documentation for this module following hierarchy standards."
        except Exception as e:
            print(f"   [WARN] Error reading template: {e}, using fallback")
            return "Update CLAUDE.md documentation for this module following hierarchy standards."

    def build_prompt(self, layer_info: LayerInfo, module_path: str, update_type: str) -> str:
        """Build the prompt for gemini."""
        template_content = self.load_template(layer_info.template_path)
        module_name = os.path.basename(module_path)

        if update_type == "full":
            update_context = """
        Update Mode: Complete refresh
        - Perform comprehensive analysis of all content
        - Document patterns, architecture, and purpose
        - Consider existing documentation hierarchy
        - Follow template guidelines strictly"""
        else:
            update_context = """
        Update Mode: Context-aware update
        - Focus on recent changes and affected areas
        - Maintain consistency with existing documentation
        - Update only relevant sections
        - Follow template guidelines for updated content"""

        base_prompt = f"""
    [CRITICAL] RULES - MUST FOLLOW:
    1. ONLY modify CLAUDE.md files at any hierarchy level
    2. NEVER modify source code files
    3. Focus exclusively on updating documentation
    4. Follow the template guidelines exactly

    {template_content}

    {update_context}

    Module Information:
    - Name: {module_name}
    - Path: {module_path}
    - Layer: {layer_info.name}
    - Analysis Strategy: {layer_info.analysis_strategy}"""

        return base_prompt

    def execute_gemini_command(self, prompt: str, analysis_strategy: str, module_path: str) -> bool:
        """Execute gemini command with the appropriate strategy."""
        original_dir = os.getcwd()

        try:
            os.chdir(module_path)

            if analysis_strategy == "--all-files":
                cmd = ["gemini", "--all-files", "--yolo", "-p", prompt]
            else:
                cmd = ["gemini", "--yolo", "-p", f"{analysis_strategy} {prompt}"]

            result = subprocess.run(cmd, capture_output=True, text=True)

            if result.returncode == 0:
                return True
            else:
                print(f"   [ERROR] Gemini command failed: {result.stderr}")
                return False

        except subprocess.CalledProcessError as e:
            print(f"   [ERROR] Error executing gemini: {e}")
            return False
        except FileNotFoundError:
            print(f"   [ERROR] Gemini command not found. Make sure gemini is installed and in PATH.")
            return False
        finally:
            os.chdir(original_dir)

    def update_module_claude(self, module_path: str, update_type: str = "full") -> bool:
        """Main function to update CLAUDE.md for a module."""
        # Validate parameters
        if not module_path:
            print("[ERROR] Module path is required")
            print("Usage: update_module_claude.py <module_path> [update_type]")
            return False

        path_obj = Path(module_path)
        if not path_obj.exists() or not path_obj.is_dir():
            print(f"[ERROR] Directory '{module_path}' does not exist")
            return False

        # Check if directory has files
        files = list(path_obj.glob('*'))
        file_count = len([f for f in files if f.is_file()])
        if file_count == 0:
            print(f"[SKIP] Skipping '{module_path}' - no files found")
            return True

        # Detect layer and get configuration
        layer_info = self.detect_layer(module_path)

        print(f"[UPDATE] Updating: {module_path}")
        print(f"   Layer: {layer_info.name} | Type: {update_type} | Files: {file_count}")
        print(f"   Template: {os.path.basename(layer_info.template_path)} | Strategy: {layer_info.analysis_strategy}")

        # Build prompt
        prompt = self.build_prompt(layer_info, module_path, update_type)

        # Execute update
        start_time = time.time()
        print("   [PROGRESS] Starting update...")

        success = self.execute_gemini_command(prompt, layer_info.analysis_strategy, module_path)

        if success:
            duration = int(time.time() - start_time)
            print(f"   [OK] Completed in {duration}s")
            return True
        else:
            print(f"   [ERROR] Update failed for {module_path}")
            return False

def main():
    """Command-line interface."""
    parser = argparse.ArgumentParser(
        description="Update CLAUDE.md for a specific module with automatic layer detection",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""Examples:
  python update_module_claude.py .
  python update_module_claude.py src/components full
  python update_module_claude.py .claude/scripts related"""
    )

    parser.add_argument("module_path", help="Path to the module directory")
    parser.add_argument("update_type", nargs="?", choices=["full", "related"],
                       default="full", help="Update type (default: full)")
    parser.add_argument("--home", help="Override home directory path")
    parser.add_argument("--dry-run", action="store_true",
                       help="Show what would be done without executing")

    args = parser.parse_args()

    try:
        updater = ModuleClaudeUpdater(args.home)

        if args.dry_run:
            layer_info = updater.detect_layer(args.module_path)
            prompt = updater.build_prompt(layer_info, args.module_path, args.update_type)

            print("[DRY-RUN] Dry run mode - showing configuration:")
            print(f"Module Path: {args.module_path}")
            print(f"Update Type: {args.update_type}")
            print(f"Layer: {layer_info.name}")
            print(f"Template: {layer_info.template_path}")
            print(f"Strategy: {layer_info.analysis_strategy}")
            print("\nPrompt preview:")
            print("-" * 50)
            print(prompt[:500] + "..." if len(prompt) > 500 else prompt)
            return

        success = updater.update_module_claude(args.module_path, args.update_type)
        sys.exit(0 if success else 1)

    except KeyboardInterrupt:
        print("\n[ERROR] Operation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()