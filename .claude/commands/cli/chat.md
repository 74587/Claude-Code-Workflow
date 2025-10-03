---
name: chat

description: Simple CLI interaction command for direct codebase analysis
usage: /cli:chat [--tool <codex|gemini|qwen>] [--enhance] "inquiry"
argument-hint: "[--tool codex|gemini|qwen] [--enhance] inquiry"
examples:
  - /cli:chat "analyze the authentication flow"
  - /cli:chat --tool qwen --enhance "optimize React component"
  - /cli:chat --tool codex "review security vulnerabilities"
allowed-tools: SlashCommand(*), Bash(*)
model: sonnet
---

## Purpose

Direct interaction with CLI tools for codebase analysis and Q&A.

**Supported Tools**: codex, gemini (default), qwen
**Reference**: @~/.claude/workflows/intelligent-tools-strategy.md for complete tool details

## Parameters

- `<inquiry>` (Required): Question or analysis request
- `--tool <codex|gemini|qwen>` (Optional): Select CLI tool (default: gemini)
- `--enhance` (Optional): Enhance inquiry with `/enhance-prompt` first
- `--all-files` (Optional): Include entire codebase in context
- `--save-session` (Optional): Save interaction to workflow session

## Execution Flow

1. Parse tool selection (default: gemini)
2. If `--enhance`: Execute `/enhance-prompt` first
3. Assemble context (files + CLAUDE.md)
4. Execute CLI tool
5. Optional: Save to session

## Enhancement Integration

**When `--enhance` flag present**: Execute `/enhance-prompt "[inquiry]"` first, then use enhanced output (INTENT/CONTEXT/ACTION) to build the chat command.

## Context Assembly

Context gathered from:
1. **Project Guidelines**: `@{CLAUDE.md,**/*CLAUDE.md}` (always)
2. **User-Explicit Files**: Files specified by user
3. **All Files Flag**: `--all-files` includes entire codebase

## Command Template

**Gemini/Qwen**:
```bash
cd [dir] && ~/.claude/scripts/[gemini|qwen]-wrapper -p "
PURPOSE: [inquiry goal]
TASK: [specific question]
CONTEXT: @{CLAUDE.md} @{target_files}
EXPECTED: [response format]
RULES: [constraints]
"

# With --all-files
cd [dir] && ~/.claude/scripts/[gemini|qwen]-wrapper --all-files -p "..."
```

**Codex**:
```bash
codex -C [dir] --full-auto exec "
PURPOSE: [inquiry goal]
TASK: [specific question]
CONTEXT: @{CLAUDE.md} @{target_files}
EXPECTED: [response format]
RULES: [constraints]
" --skip-git-repo-check -s danger-full-access

# With image attachment
codex -C [dir] -i screenshot.png --full-auto exec "..." --skip-git-repo-check -s danger-full-access
```

## Examples

```bash
/cli:chat "analyze the authentication flow"              # Gemini (default)
/cli:chat --tool qwen "optimize React component"         # Qwen
/cli:chat --tool codex "review security vulnerabilities" # Codex
/cli:chat --enhance "fix the login"                      # Enhanced prompt
/cli:chat --all-files "find all API endpoints"           # Full codebase
```

## Session Persistence

- **Active Session**: Save to `.workflow/WFS-[id]/.chat/chat-[timestamp].md`
- **No Session**: Return results directly