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
model: sonnet
---

# CLI Execute Command (/cli:execute)

## Purpose

Execute implementation tasks with YOLO permissions (auto-approves all confirmations).

**Supported Tools**: codex, gemini (default), qwen
**Reference**: @~/.claude/workflows/intelligent-tools-strategy.md for complete tool details

## YOLO Permissions

Auto-approves: file pattern inference, execution, file modifications, summary generation

## Enhancement Integration

**When `--enhance` flag present** (Description Mode only): Execute `/enhance-prompt "[description]"` first, then use enhanced output (INTENT/CONTEXT/ACTION) for execution.

**Note**: Task ID Mode uses task JSON directly (no enhancement).

## Execution Modes

**1. Description Mode** (supports `--enhance`):
- Input: Natural language description
- Process: [Optional: Enhance] → Keyword analysis → Pattern inference → Execute

**2. Task ID Mode** (no `--enhance`):
- Input: Workflow task identifier (e.g., `IMPL-001`)
- Process: Task JSON parsing → Scope analysis → Execute

## Context Inference

Auto-selects files based on:
- **Keywords**: "auth" → `@{**/*auth*,**/*user*}`
- **Technology**: "React" → `@{src/**/*.{jsx,tsx}}`
- **Task Type**: "api" → `@{**/api/**/*,**/routes/**/*}`
- **Always**: `@{CLAUDE.md,**/*CLAUDE.md}`

## Options

- `--debug`: Verbose logging
- `--save-session`: Save execution to workflow session

## Workflow Integration

**Session Management**: Auto-detects `.workflow/.active-*` marker
- **Active**: Save to `.workflow/WFS-[id]/.chat/execute-[timestamp].md`
- **None**: Create new session

**Task Integration**: Load from `.task/[TASK-ID].json`, update status, generate summary

## Command Template

**Gemini/Qwen** (with YOLO approval):
```bash
cd [dir] && ~/.claude/scripts/[gemini|qwen]-wrapper --approval-mode yolo -p "
PURPOSE: [implementation goal]
TASK: [specific task]
MODE: write
CONTEXT: @{inferred_patterns} @{CLAUDE.md}
EXPECTED: Implementation with file:line references
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints]
"
```

**Codex**:
```bash
codex -C [dir] --full-auto exec "
PURPOSE: [implementation goal]
TASK: [specific task]
MODE: auto
CONTEXT: @{inferred_patterns} @{CLAUDE.md}
EXPECTED: Implementation with file:line references
RULES: [constraints]
" --skip-git-repo-check -s danger-full-access

# With image attachment
codex -C [dir] -i design.png --full-auto exec "..." --skip-git-repo-check -s danger-full-access
```

## Examples

```bash
/cli:execute "implement JWT authentication with middleware"  # Description mode
/cli:execute --enhance "implement JWT authentication"        # Enhanced
/cli:execute IMPL-001                                        # Task ID mode
/cli:execute --tool codex "optimize database queries"        # Codex execution
```

## Auto-Generated Outputs

- **Summary**: `.summaries/[TASK-ID]-summary.md`
- **Session**: `.chat/execute-[timestamp].md`

## Notes

**vs. `/cli:analyze`**: Execute performs implementation, analyze is read-only.

