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

Execute implementation tasks with YOLO permissions (auto-approves all confirmations).

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

Auto-selects files based on:
- **Keywords**: "auth" → `@{**/*auth*,**/*user*}`
- **Technology**: "React" → `@{src/**/*.{jsx,tsx}}`
- **Task Type**: "api" → `@{**/api/**/*,**/routes/**/*}`
- **Always**: `@{CLAUDE.md,**/*CLAUDE.md}`

### File Pattern Reference
- All files: `@{**/*}`
- Source files: `@{src/**/*}`
- TypeScript: `@{*.ts,*.tsx}`
- JavaScript: `@{*.js,*.jsx}`
- Python: `@{*.py}`
- Tests: `@{**/*.test.*,**/*.spec.*}`
- Config files: `@{*.config.*,**/config/**/*}`

### Complex Pattern Discovery
For precise file targeting, use semantic discovery BEFORE CLI execution:

**Workflow**: Discover → Extract precise paths → Build CONTEXT field

```bash
# Step 1: Discover files semantically
rg "target_pattern" --files-with-matches --type ts
mcp__code-index__find_files(pattern="*auth*")

# Step 2: Build precise CONTEXT from discovery results
CONTEXT: @{src/auth/module.ts,src/middleware/auth.ts,CLAUDE.md}

# Step 3: Execute with precise file references
codex -C src --full-auto exec "
PURPOSE: Implement authentication
TASK: Add JWT validation
MODE: auto
CONTEXT: @{auth/module.ts,middleware/auth.ts,CLAUDE.md}
EXPECTED: Complete implementation
RULES: Follow security best practices
" --skip-git-repo-check -s danger-full-access
```

## Command Templates

### Gemini/Qwen (with YOLO approval)
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

### Codex
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

### Codex with Resume (for related tasks)
```bash
# First task - establish session
codex -C [dir] --full-auto exec "
PURPOSE: [implementation goal]
TASK: [specific task]
MODE: auto
CONTEXT: @{inferred_patterns} @{CLAUDE.md}
EXPECTED: Implementation with file:line references
RULES: [constraints]
" --skip-git-repo-check -s danger-full-access

# Related follow-up task - continue session
codex --full-auto exec "
PURPOSE: [continuation goal]
TASK: [related task]
MODE: auto
CONTEXT: Previous implementation from session
EXPECTED: Enhanced/extended implementation
RULES: Maintain consistency with previous work
" resume --last --skip-git-repo-check -s danger-full-access
```

**Resume Decision**: Use `resume --last` when current task extends/relates to previous execution in conversation memory. See intelligent-tools-strategy.md for auto-resume rules.

## Enhancement Integration

**When `--enhance` flag present** (Description Mode only):
1. Execute `/enhance-prompt "[description]"` first
2. Use enhanced output (INTENT/CONTEXT/ACTION) for execution
3. Build command with enhanced context

**Note**: Task ID Mode uses task JSON directly (no enhancement).

## Options

- `--tool <codex|gemini|qwen>`: Select CLI tool (default: gemini)
- `--enhance`: Enhance input with `/enhance-prompt` first
- `--debug`: Verbose logging
- `--save-session`: Save execution to workflow session

## Workflow Integration

**Session Management**: Auto-detects `.workflow/.active-*` marker
- **Active**: Save to `.workflow/WFS-[id]/.chat/execute-[timestamp].md`
- **None**: Create new session

**Task Integration**: Load from `.task/[TASK-ID].json`, update status, generate summary

**Auto-Generated Outputs**:
- **Summary**: `.summaries/[TASK-ID]-summary.md`
- **Session**: `.chat/execute-[timestamp].md`

## Examples

```bash
# Description mode (default: gemini)
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

