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
---

# CLI Chat Command (/cli:chat)

## Purpose

Direct Q&A interaction with CLI tools for codebase analysis.

**Supported Tools**: codex, gemini (default), qwen

## Parameters

- `<inquiry>` (Required) - Question or analysis request
- `--tool <codex|gemini|qwen>` - Select CLI tool (default: gemini)
- `--enhance` - Enhance inquiry with `/enhance-prompt` first
- `--all-files` - Include entire codebase in context
- `--save-session` - Save interaction to workflow session

## Execution Flow

1. Parse tool selection (default: gemini)
2. If `--enhance`: Execute `/enhance-prompt` to expand user intent
3. Assemble context: `@{CLAUDE.md}` + user-specified files or `--all-files`
4. Execute CLI tool with assembled context
5. Optionally save to workflow session

## Context Assembly

**Always included**: `@{CLAUDE.md,**/*CLAUDE.md}` (project guidelines)

**Optional**:
- User-explicit files from inquiry keywords
- `--all-files` flag includes entire codebase (`--all-files` wrapper parameter)

For targeted analysis, use `rg` or MCP tools to discover relevant files first, then build precise CONTEXT field.

## Examples

```bash
/cli:chat "analyze the authentication flow"              # Gemini (default)
/cli:chat --tool qwen "optimize React component"         # Qwen
/cli:chat --tool codex "review security vulnerabilities" # Codex
/cli:chat --enhance "fix the login"                      # Enhanced prompt first
/cli:chat --all-files "find all API endpoints"           # Full codebase context
```

## Notes

- Command templates and file patterns: see intelligent-tools-strategy.md (loaded in memory)
- Active workflow session: results saved to `.workflow/WFS-[id]/.chat/`
- No session: results returned directly
