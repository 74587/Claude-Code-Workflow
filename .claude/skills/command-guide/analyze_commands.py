#!/usr/bin/env python3
"""
Analyze all command files and generate index files for command-guide skill.
"""

import os
import re
import json
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Any

# Base paths
COMMANDS_DIR = Path("D:/Claude_dms3/.claude/commands")
INDEX_DIR = Path("D:/Claude_dms3/.claude/skills/command-guide/index")

def parse_frontmatter(content: str) -> Dict[str, Any]:
    """Extract YAML frontmatter from markdown content."""
    frontmatter = {}
    if content.startswith('---'):
        lines = content.split('\n')
        in_frontmatter = False
        for i, line in enumerate(lines[1:], 1):
            if line.strip() == '---':
                break
            if ':' in line:
                key, value = line.split(':', 1)
                frontmatter[key.strip()] = value.strip().strip('"')
    return frontmatter

def categorize_command(file_path: Path) -> tuple:
    """Determine category and subcategory from file path."""
    parts = file_path.relative_to(COMMANDS_DIR).parts

    if len(parts) == 1:
        return "general", None

    category = parts[0]  # cli, memory, task, workflow
    subcategory = parts[1].replace('.md', '') if len(parts) > 2 else None

    return category, subcategory

def determine_usage_scenario(name: str, description: str, category: str) -> str:
    """Determine primary usage scenario for command."""
    name_lower = name.lower()
    desc_lower = description.lower()

    # Planning indicators
    if any(word in name_lower for word in ['plan', 'design', 'breakdown', 'brainstorm']):
        return "planning"

    # Implementation indicators
    if any(word in name_lower for word in ['implement', 'execute', 'generate', 'create', 'write']):
        return "implementation"

    # Testing indicators
    if any(word in name_lower for word in ['test', 'tdd', 'verify', 'coverage']):
        return "testing"

    # Documentation indicators
    if any(word in name_lower for word in ['docs', 'documentation', 'memory']):
        return "documentation"

    # Session management indicators
    if any(word in name_lower for word in ['session', 'resume', 'status', 'complete']):
        return "session-management"

    # Analysis indicators
    if any(word in name_lower for word in ['analyze', 'review', 'diagnosis']):
        return "analysis"

    return "general"

def determine_difficulty(name: str, description: str, category: str) -> str:
    """Determine difficulty level."""
    name_lower = name.lower()

    # Beginner commands
    beginner_keywords = ['status', 'list', 'chat', 'analyze', 'version']
    if any(word in name_lower for word in beginner_keywords):
        return "Beginner"

    # Advanced commands
    advanced_keywords = ['tdd', 'conflict', 'agent', 'auto-parallel', 'coverage', 'synthesis']
    if any(word in name_lower for word in advanced_keywords):
        return "Advanced"

    # Intermediate by default
    return "Intermediate"

def analyze_command_file(file_path: Path) -> Dict[str, Any]:
    """Analyze a single command file and extract metadata."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Parse frontmatter
    frontmatter = parse_frontmatter(content)

    # Extract data
    name = frontmatter.get('name', file_path.stem)
    description = frontmatter.get('description', '')
    argument_hint = frontmatter.get('argument-hint', '')

    # Determine categorization
    category, subcategory = categorize_command(file_path)
    usage_scenario = determine_usage_scenario(name, description, category)
    difficulty = determine_difficulty(name, description, category)

    # Build relative path
    rel_path = str(file_path.relative_to(COMMANDS_DIR))

    # Build full command name
    if category == "general":
        command_name = f"/{name}"
    else:
        if subcategory and subcategory not in name:
            command_name = f"/{category}:{subcategory}:{name}"
        else:
            command_name = f"/{category}:{name}"

    return {
        "name": name,
        "command": command_name,
        "description": description,
        "arguments": argument_hint,
        "category": category,
        "subcategory": subcategory,
        "usage_scenario": usage_scenario,
        "difficulty": difficulty,
        "file_path": rel_path
    }

def build_command_relationships() -> Dict[str, Any]:
    """Build command relationship mappings."""
    relationships = {
        # Workflow planning commands
        "plan": {
            "calls_internally": [
                "session:start",
                "tools:context-gather",
                "tools:conflict-resolution",
                "tools:task-generate",
                "tools:task-generate-agent"
            ],
            "next_steps": ["action-plan-verify", "status", "execute"],
            "alternatives": ["tdd-plan"]
        },
        "tdd-plan": {
            "calls_internally": [
                "session:start",
                "tools:context-gather",
                "tools:task-generate-tdd"
            ],
            "next_steps": ["tdd-verify", "status", "execute"],
            "alternatives": ["plan"]
        },

        # Execution commands
        "execute": {
            "prerequisites": ["plan", "tdd-plan"],
            "related": ["status", "resume"],
            "next_steps": ["review", "tdd-verify"]
        },

        # Verification commands
        "action-plan-verify": {
            "prerequisites": ["plan"],
            "next_steps": ["execute"],
            "related": ["status"]
        },
        "tdd-verify": {
            "prerequisites": ["execute"],
            "related": ["tools:tdd-coverage-analysis"]
        },

        # Session management
        "session:start": {
            "next_steps": ["plan", "execute"],
            "related": ["session:list", "session:resume"]
        },
        "session:resume": {
            "alternatives": ["resume"],
            "related": ["session:list", "status"]
        },

        # Task management
        "task:create": {
            "next_steps": ["task:execute"],
            "related": ["task:breakdown"]
        },
        "task:breakdown": {
            "next_steps": ["task:execute"],
            "related": ["task:create"]
        },
        "task:replan": {
            "prerequisites": ["plan"],
            "related": ["action-plan-verify"]
        },

        # Memory/Documentation
        "memory:docs": {
            "calls_internally": [
                "session:start",
                "tools:context-gather"
            ],
            "next_steps": ["execute"]
        },

        # CLI modes
        "cli:execute": {
            "alternatives": ["cli:codex-execute"],
            "related": ["cli:analyze", "cli:chat"]
        },

        # Brainstorming
        "brainstorm:artifacts": {
            "next_steps": ["brainstorm:synthesis", "plan"],
            "related": ["brainstorm:auto-parallel"]
        },
        "brainstorm:synthesis": {
            "prerequisites": ["brainstorm:artifacts"],
            "next_steps": ["plan"]
        }
    }

    return relationships

def identify_essential_commands(all_commands: List[Dict]) -> List[Dict]:
    """Identify the most essential commands for beginners."""
    # Essential command names (14 most important)
    essential_names = [
        "plan",
        "execute",
        "status",
        "session:start",
        "task:execute",
        "cli:analyze",
        "cli:chat",
        "memory:docs",
        "brainstorm:artifacts",
        "action-plan-verify",
        "resume",
        "review",
        "version",
        "enhance-prompt"
    ]

    essential = []
    for cmd in all_commands:
        # Check both command name and simple name
        cmd_simple = cmd['command'].lstrip('/')
        if cmd_simple in essential_names or cmd['name'] in essential_names:
            essential.append(cmd)

    return essential[:14]  # Limit to 14

def main():
    """Main analysis function."""
    import sys
    import io

    # Fix Windows console encoding
    if sys.platform == 'win32':
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("Analyzing command files...")

    # Find all command files
    command_files = list(COMMANDS_DIR.rglob("*.md"))
    print(f"Found {len(command_files)} command files")

    # Analyze each command
    all_commands = []
    for cmd_file in sorted(command_files):
        try:
            metadata = analyze_command_file(cmd_file)
            all_commands.append(metadata)
            print(f"  OK {metadata['command']}")
        except Exception as e:
            print(f"  ERROR analyzing {cmd_file}: {e}")

    print(f"\nAnalyzed {len(all_commands)} commands")

    # Generate index files
    INDEX_DIR.mkdir(parents=True, exist_ok=True)

    # 1. all-commands.json
    all_commands_path = INDEX_DIR / "all-commands.json"
    with open(all_commands_path, 'w', encoding='utf-8') as f:
        json.dump(all_commands, f, indent=2, ensure_ascii=False)
    print(f"\nOK Generated {all_commands_path} ({os.path.getsize(all_commands_path)} bytes)")

    # 2. by-category.json
    by_category = defaultdict(lambda: defaultdict(list))
    for cmd in all_commands:
        cat = cmd['category']
        subcat = cmd['subcategory'] or '_root'
        by_category[cat][subcat].append(cmd)

    by_category_path = INDEX_DIR / "by-category.json"
    with open(by_category_path, 'w', encoding='utf-8') as f:
        json.dump(dict(by_category), f, indent=2, ensure_ascii=False)
    print(f"OK Generated {by_category_path} ({os.path.getsize(by_category_path)} bytes)")

    # 3. by-use-case.json
    by_use_case = defaultdict(list)
    for cmd in all_commands:
        by_use_case[cmd['usage_scenario']].append(cmd)

    by_use_case_path = INDEX_DIR / "by-use-case.json"
    with open(by_use_case_path, 'w', encoding='utf-8') as f:
        json.dump(dict(by_use_case), f, indent=2, ensure_ascii=False)
    print(f"OK Generated {by_use_case_path} ({os.path.getsize(by_use_case_path)} bytes)")

    # 4. essential-commands.json
    essential = identify_essential_commands(all_commands)
    essential_path = INDEX_DIR / "essential-commands.json"
    with open(essential_path, 'w', encoding='utf-8') as f:
        json.dump(essential, f, indent=2, ensure_ascii=False)
    print(f"OK Generated {essential_path} ({os.path.getsize(essential_path)} bytes)")

    # 5. command-relationships.json
    relationships = build_command_relationships()
    relationships_path = INDEX_DIR / "command-relationships.json"
    with open(relationships_path, 'w', encoding='utf-8') as f:
        json.dump(relationships, f, indent=2, ensure_ascii=False)
    print(f"OK Generated {relationships_path} ({os.path.getsize(relationships_path)} bytes)")

    # Print summary statistics
    print("\n=== Summary Statistics ===")
    print(f"Total commands: {len(all_commands)}")
    print(f"\nBy category:")
    for cat in sorted(by_category.keys()):
        total = sum(len(cmds) for cmds in by_category[cat].values())
        print(f"  {cat}: {total}")
        for subcat in sorted(by_category[cat].keys()):
            if subcat != '_root':
                print(f"    - {subcat}: {len(by_category[cat][subcat])}")

    print(f"\nBy usage scenario:")
    for scenario in sorted(by_use_case.keys()):
        print(f"  {scenario}: {len(by_use_case[scenario])}")

    print(f"\nBy difficulty:")
    difficulty_counts = defaultdict(int)
    for cmd in all_commands:
        difficulty_counts[cmd['difficulty']] += 1
    for difficulty in ['Beginner', 'Intermediate', 'Advanced']:
        print(f"  {difficulty}: {difficulty_counts[difficulty]}")

    print(f"\nEssential commands: {len(essential)}")

if __name__ == '__main__':
    main()
