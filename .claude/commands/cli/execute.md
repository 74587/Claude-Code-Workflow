---
name: execute
description: Auto-execution of implementation tasks with YOLO permissions and intelligent context inference
usage: /cli:execute [--tool <codex|gemini|qwen>] [--enhance] <description|task-id>
argument-hint: "[--tool codex|gemini|qwen] [--enhance] description or task-id"
examples:
  - /cli:execute "implement user authentication system"
  - /cli:execute --tool qwen --enhance "optimize React component"
  - /cli:execute --tool codex IMPL-001
  - /cli:execute --enhance "fix API performance issues"
allowed-tools: SlashCommand(*), Bash(*)
---

# CLI Execute Command (/cli:execute)

## Purpose

Execute implementation tasks with **YOLO permissions** (auto-approves all confirmations).

**Supported Tools**: codex, gemini (default), qwen
**Key Feature**: Automatic context inference and file pattern detection

## Core Concepts

### YOLO Permissions
Auto-approves: file pattern inference, execution, file modifications, summary generation

### Execution Modes

**1. Description Mode** (supports `--enhance`):
- Input: Natural language description
- Process: [Optional: Enhance] → Keyword analysis → Pattern inference → Execute

**2. Task ID Mode** (no `--enhance`):
- Input: Workflow task identifier (e.g., `IMPL-001`)
- Process: Task JSON parsing → Scope analysis → Execute

### Context Inference

Auto-selects files based on keywords and technology:
- "auth" → `@{**/*auth*,**/*user*}`
- "React" → `@{src/**/*.{jsx,tsx}}`
- "api" → `@{**/api/**/*,**/routes/**/*}`
- Always includes: `@{CLAUDE.md,**/*CLAUDE.md}`

For precise file targeting, use `rg` or MCP tools to discover files first.

### Codex Session Continuity

**Resume Pattern** for related tasks:
```bash
# First task - establish session
codex -C [dir] --full-auto exec "[task]" --skip-git-repo-check -s danger-full-access

# Related task - continue session
codex --full-auto exec "[related-task]" resume --last --skip-git-repo-check -s danger-full-access
```

Use `resume --last` when current task extends/relates to previous execution. See intelligent-tools-strategy.md for auto-resume rules.

## Parameters

- `--tool <codex|gemini|qwen>` - Select CLI tool (default: gemini)
- `--enhance` - Enhance input with `/enhance-prompt` first (Description Mode only)
- `<description|task-id>` - Natural language description or task identifier
- `--debug` - Verbose logging
- `--save-session` - Save execution to workflow session

## Workflow Integration

**Session Management**: Auto-detects `.workflow/.active-*` marker
- Active session: Save to `.workflow/WFS-[id]/.chat/execute-[timestamp].md`
- No session: Create new session

**Task Integration**: Load from `.task/[TASK-ID].json`, update status, generate summary

## Examples

```bash
# Description mode with auto-detection
/cli:execute "implement JWT authentication with middleware"

# Enhanced prompt
/cli:execute --enhance "implement JWT authentication"

# Task ID mode
/cli:execute IMPL-001

# Codex execution
/cli:execute --tool codex "optimize database queries"

# Qwen with enhancement
/cli:execute --tool qwen --enhance "refactor auth module"
```

## Notes

- Command templates, YOLO mode details, and session management: see intelligent-tools-strategy.md (loaded in memory)
- Auto-generated outputs: `.summaries/[TASK-ID]-summary.md`, `.chat/execute-[timestamp].md`
