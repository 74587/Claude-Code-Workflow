---
name: context-search-strategy
description: Strategic guidelines for context search commands
type: search-guideline
---

# Context Search Strategy

## ⚡ Execution Environment

**CRITICAL**: All commands execute in **Bash environment** (Git Bash on Windows, Bash on Linux/macOS)

**❌ Forbidden**: Windows-specific commands (`findstr`, `dir`, `where`, `type`, `copy`, `del`) - Use Bash equivalents (`grep`, `find`, `which`, `cat`, `cp`, `rm`)

## ⚡ Core Search Tools

**codebase-retrieval**: Semantic file discovery via Gemini CLI with all files analysis
**rg (ripgrep)**: Fast content search with regex support
**find**: File/directory location by name patterns
**grep**: Built-in pattern matching in files
**get_modules_by_depth.sh**: Program architecture analysis and structural discovery

### Decision Principles
- **Use codebase-retrieval for semantic discovery** - Intelligent file discovery based on task context
- **Use rg for content** - Fastest for searching within files
- **Use find for files** - Locate files/directories by name
- **Use grep sparingly** - Only when rg unavailable
- **Use get_modules_by_depth.sh first** - MANDATORY for program architecture analysis before planning
- **Always use Bash commands** - NEVER use Windows cmd/PowerShell commands

### Tool Selection Matrix

| Need | Tool | Use Case |
|------|------|----------|
| **Semantic file discovery** | codebase-retrieval | Find files relevant to task/feature context |
| **Pattern matching** | rg | Search code content with regex |
| **File name lookup** | find | Locate files by name patterns |
| **Architecture analysis** | get_modules_by_depth.sh | Understand program structure |

### Quick Command Reference
```bash
# Semantic File Discovery (codebase-retrieval)
~/.claude/scripts/gemini-wrapper --all-files -p "List all files relevant to: [task/feature description]"
bash(~/.claude/scripts/gemini-wrapper --all-files -p "List all files relevant to: [task/feature description]")

# Program Architecture Analysis (MANDATORY FIRST)
~/.claude/scripts/get_modules_by_depth.sh  # Discover program architecture
bash(~/.claude/scripts/get_modules_by_depth.sh)  # Analyze structural hierarchy

# Content Search (rg preferred)
rg "pattern" --type js          # Search in JS files
rg -i "case-insensitive"        # Ignore case
rg -n "show-line-numbers"       # Show line numbers
rg -A 3 -B 3 "context-lines"    # Show 3 lines before/after

# File Search (find)
find . -name "*.ts" -type f     # Find TypeScript files
find . -path "*/node_modules" -prune -o -name "*.js" -print

# Built-in alternatives
grep -r "pattern" .             # Recursive search (slower)
grep -n -i "pattern" file.txt   # Line numbers, case-insensitive
```

### Workflow Integration Examples
```bash
# Semantic Discovery → Content Search → Analysis (Recommended Pattern)
~/.claude/scripts/gemini-wrapper --all-files -p "List all files relevant to: [task/feature]"  # Get relevant files
rg "[pattern]" --type [filetype]  # Then search within discovered files

# Program Architecture Analysis (MANDATORY BEFORE PLANNING)
~/.claude/scripts/get_modules_by_depth.sh  # Discover program architecture
bash(~/.claude/scripts/get_modules_by_depth.sh)  # Analyze structural hierarchy

# Search for task definitions
rg "IMPL-\d+" .workflow/ --type json        # Find task IDs
find .workflow/ -name "*.json" -path "*/.task/*"  # Locate task files

# Analyze workflow structure
rg "status.*pending" .workflow/.task/      # Find pending tasks
rg "depends_on" .workflow/.task/ -A 2      # Show dependencies

# Find workflow sessions
find .workflow/ -name ".active-*"          # Active sessions
rg "WFS-" .workflow/ --type json           # Session references

# Content analysis for planning
rg "flow_control" .workflow/ -B 2 -A 5     # Flow control patterns
find . -name "IMPL_PLAN.md" -exec grep -l "requirements" {} \;
```

### Performance Tips
- **rg > grep** for content search
- **Use --type filters** to limit file types
- **Exclude common dirs**: `--glob '!node_modules'`
- **Use -F for literal** strings (no regex)