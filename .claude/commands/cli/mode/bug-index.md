---
name: bug-index
description: Bug analysis and fix suggestions using CLI tools
usage: /cli:mode:bug-index [--tool <codex|gemini|qwen>] [--enhance] [--cd "path"] "bug description"
argument-hint: "[--tool codex|gemini|qwen] [--enhance] [--cd path] bug description"
examples:
  - /cli:mode:bug-index "authentication null pointer error"
  - /cli:mode:bug-index --tool qwen --enhance "login not working"
  - /cli:mode:bug-index --tool codex --cd "src/auth" "token validation fails"
allowed-tools: SlashCommand(*), Bash(*)
---

# CLI Mode: Bug Index (/cli:mode:bug-index)

## Purpose

Systematic bug analysis with diagnostic template (`~/.claude/prompt-templates/bug-fix.md`).

**Supported Tools**: codex, gemini (default), qwen
**Key Feature**: `--cd` flag for directory-scoped analysis

## Parameters

- `--tool <codex|gemini|qwen>` - Tool selection (default: gemini)
- `--enhance` - Enhance bug description with `/enhance-prompt` first
- `--cd "path"` - Target directory for focused analysis
- `<bug-description>` (Required) - Bug description or error message

## Execution Flow

1. Parse tool and directory options
2. If `--enhance`: Execute `/enhance-prompt` to expand bug context
3. Use bug-fix template: `~/.claude/prompt-templates/bug-fix.md`
4. Execute with `--all-files` in target directory
5. Save to `.workflow/WFS-[id]/.chat/bug-index-[timestamp].md`

## Analysis Focus (via Template)

- Root cause investigation
- Code path tracing
- Targeted minimal fixes
- Impact assessment

## Examples

```bash
# Basic bug analysis
/cli:mode:bug-index "null pointer in authentication"

# Directory-specific
/cli:mode:bug-index --cd "src/auth" "token validation fails"

# Enhanced description
/cli:mode:bug-index --enhance "login broken"

# Qwen for architecture-related bugs
/cli:mode:bug-index --tool qwen "circular dependency in modules"
```

## Bug Investigation Workflow

```bash
# 1. Find bug-related files
rg "error_keyword" --files-with-matches

# 2. Execute bug analysis with focused context
/cli:mode:bug-index --cd "src/module" "specific error description"
```

## Notes

- Command templates and file patterns: see intelligent-tools-strategy.md (loaded in memory)
- Template path: `~/.claude/prompt-templates/bug-fix.md`
- Always uses `--all-files` for comprehensive codebase context
