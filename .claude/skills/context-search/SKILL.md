---
name: Context Search
description: Strategic context search tool selection for both planning and execution phases. Use during PLANNING (analyzing architecture, understanding existing code structure, gathering context) and EXECUTION (searching files, discovering implementations, locating dependencies). Triggers include "search for", "find files", "locate code", "analyze structure", "understand codebase", or when planning/implementing features. MANDATORY before any planning or implementation tasks.
allowed-tools: Bash, Grep, Glob, Read, mcp__code-index__search_code_advanced, mcp__code-index__find_files
---

# Context Search

Strategic framework for selecting the right search tool based on task requirements.

## Execution Environment

**CRITICAL**: All commands execute in **Bash environment** (Git Bash on Windows, Bash on Linux/macOS)

**❌ Forbidden**: Windows-specific commands (`findstr`, `dir`, `where`, `type`, `copy`, `del`)
**✅ Required**: Use Bash equivalents (`grep`, `find`, `which`, `cat`, `cp`, `rm`)

## Tool Selection Framework

Use this decision tree to select the right search tool:

### 1. Semantic File Discovery
**Tool**: `codebase-retrieval` (Gemini CLI)
**When**: Need files relevant to a task/feature/concept
**Command**: `~/.claude/scripts/gemini-wrapper --all-files -p "List all files relevant to: [description]"`

### 2. Content Search
**Tool**: `rg` (ripgrep) - preferred
**When**: Searching code content with patterns
**Fallback**: `grep` (when rg unavailable)

### 3. File/Directory Location
**Tool**: `find`
**When**: Locating files by name patterns
**Alternative**: MCP Code Index for glob patterns

### 4. Program Architecture Analysis
**Tool**: `get_modules_by_depth.sh`
**When**: Understanding program structure (MANDATORY before planning)
**Command**: `~/.claude/scripts/get_modules_by_depth.sh`

## Decision Principles

- **Semantic discovery first** - Use codebase-retrieval for intelligent file discovery
- **Speed matters** - Prefer rg over grep for content search
- **Architecture before implementation** - Run get_modules_by_depth.sh before planning
- **No Windows commands** - Always use Bash equivalents

## Tool Selection Matrix

| Need | Primary Tool | Use Case |
|------|-------------|----------|
| **Semantic file discovery** | codebase-retrieval | Find files relevant to task/feature context |
| **Pattern matching** | rg (ripgrep) | Search code content with regex |
| **File name lookup** | find | Locate files by name patterns |
| **Architecture analysis** | get_modules_by_depth.sh | Understand program structure |

## Workflow Integration

Follow this recommended pattern for codebase exploration:

1. **Architecture Analysis** (if planning)
   ```bash
   ~/.claude/scripts/get_modules_by_depth.sh
   ```

2. **Semantic Discovery** (find relevant files)
   ```bash
   ~/.claude/scripts/gemini-wrapper --all-files -p "List all files relevant to: [task]"
   ```

3. **Content Search** (search within files)
   ```bash
   rg "[pattern]" --type [filetype]
   ```

4. **Deep Analysis** (understand found code)
   - Use Read tool for specific files
   - Use Gemini for architecture analysis

## Performance Tips

- **rg > grep** - Always prefer ripgrep for content search
- **Type filters** - Use `--type` to limit file types (e.g., `--type js`)
- **Exclude patterns** - Use appropriate glob patterns to filter search scope
- **Literal strings** - Use `-F` flag for exact matches (no regex overhead)

## Examples

For detailed command examples and workflow patterns, see [examples.md](examples.md).

For complete command reference and options, see [reference.md](reference.md).
