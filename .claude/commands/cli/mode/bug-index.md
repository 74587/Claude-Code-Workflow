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

1. **Parse tool selection**: Extract `--tool` flag (default: gemini)
2. **If `--enhance` flag present**: Execute `/enhance-prompt "[bug-description]"` first
3. Parse bug description (original or enhanced)
4. Detect target directory (from `--cd` or auto-infer)
5. Build command for selected tool with bug-fix template
6. Execute analysis (read-only, provides fix recommendations)
7. Save to `.workflow/WFS-[id]/.chat/bug-index-[timestamp].md`

## Core Rules

1. **Analysis Only**: This command analyzes bugs and suggests fixes - it does NOT modify code
2. **Enhance First (if flagged)**: Execute `/enhance-prompt` before analysis
3. **Directory Context**: Use `cd` when `--cd` provided or auto-detected
4. **Template Required**: Always use bug-fix template
5. **Session Output**: Save analysis results and fix recommendations to session chat

## Analysis Focus (via Template)

- Root cause investigation and diagnosis
- Code path tracing to locate issues
- Targeted minimal fix recommendations
- Impact assessment of proposed changes

## Command Template

```bash
cd [directory] && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: [bug analysis goal]
TASK: Systematic bug analysis and fix recommendations
MODE: analysis
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} [entire codebase in directory]
EXPECTED: Root cause analysis, code path tracing, targeted fix suggestions
RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Bug: [description]
"
```

## Examples

**Basic Bug Analysis**:
```bash
cd . && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Debug authentication null pointer error
TASK: Identify root cause and provide fix recommendations
MODE: analysis
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Root cause, code path, minimal fix suggestion, impact assessment
RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Bug: null pointer in login flow
"
```

**Directory-Specific**:
```bash
cd src/auth && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Fix token validation failure
TASK: Analyze token validation bug in auth module
MODE: analysis
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Validation logic analysis, fix recommendation with minimal changes
RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Bug: token validation fails intermittently
"
```

## Bug Investigation Workflow

```bash
# 1. Find bug-related files
rg "error_keyword" --files-with-matches
mcp__code-index__search_code_advanced(pattern="error|exception", file_pattern="*.ts")

# 2. Execute bug analysis with focused context (analysis only, no code changes)
/cli:mode:bug-index --cd "src/module" "specific error description"
```

## Output Routing

**Output Destination Logic**:
- **Active session exists AND bug is session-relevant**:
  - Save to `.workflow/WFS-[id]/.chat/bug-index-[timestamp].md`
- **No active session OR quick debugging**:
  - Save to `.workflow/.scratchpad/bug-index-[description]-[timestamp].md`

**Examples**:
- During active session `WFS-payment-fix`, analyzing payment bug → `.chat/bug-index-20250105-143022.md`
- No session, quick null pointer investigation → `.scratchpad/bug-index-null-pointer-20250105-143045.md`

## Notes

- Command templates and file patterns: see intelligent-tools-strategy.md (loaded in memory)
- Scratchpad directory details: see workflow-architecture.md
- Template path: `~/.claude/prompt-templates/bug-fix.md`
- Always uses `--all-files` for comprehensive codebase context
