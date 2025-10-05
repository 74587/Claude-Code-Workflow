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

Direct Q&A interaction with CLI tools for codebase analysis. **Analysis only - does NOT modify code**.

**Intent**: Ask questions, get explanations, understand codebase structure
**Supported Tools**: codex, gemini (default), qwen

## Core Behavior

1. **Conversational Analysis**: Direct question-answer interaction about codebase
2. **Read-Only**: This command ONLY provides information and analysis
3. **No Code Modification**: Results are explanations and insights
4. **Flexible Context**: Choose specific files or entire codebase

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
4. Execute CLI tool with assembled context (read-only, analysis mode)
5. Return explanations and insights (NO code changes)
6. Optionally save to workflow session

## Context Assembly

**Always included**: `@{CLAUDE.md,**/*CLAUDE.md}` (project guidelines)

**Optional**:
- User-explicit files from inquiry keywords
- `--all-files` flag includes entire codebase (`--all-files` wrapper parameter)

For targeted analysis, use `rg` or MCP tools to discover relevant files first, then build precise CONTEXT field.

## Command Template

```bash
cd . && ~/.claude/scripts/gemini-wrapper -p "
INQUIRY: [user question]
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} [inferred or --all-files]
MODE: analysis
RESPONSE: Direct answer, explanation, insights (NO code modification)
"
```

## Examples

**Basic Question**:
```bash
/cli:chat "analyze the authentication flow"
# Executes: Gemini analysis
# Returns: Explanation of auth flow, components involved, data flow
```

**Architecture Question**:
```bash
/cli:chat --tool qwen "how does React component optimization work here"
# Executes: Qwen architecture analysis
# Returns: Component structure explanation, optimization patterns used
```

**Security Analysis**:
```bash
/cli:chat --tool codex "review security vulnerabilities"
# Executes: Codex security analysis
# Returns: Vulnerability assessment, security recommendations (NO automatic fixes)
```

**Enhanced Inquiry**:
```bash
/cli:chat --enhance "explain the login issue"
# Step 1: Enhance to expand login context
# Step 2: Analysis with expanded understanding
# Returns: Detailed explanation of login flow and potential issues
```

**Broad Context**:
```bash
/cli:chat --all-files "find all API endpoints"
# Executes: Analysis across entire codebase
# Returns: List and explanation of API endpoints (NO code generation)
```

## Output Routing

**Output Destination Logic**:
- **Active session exists AND query is session-relevant**:
  - Save to `.workflow/WFS-[id]/.chat/chat-[timestamp].md`
- **No active session OR unrelated query**:
  - Save to `.workflow/.scratchpad/chat-[description]-[timestamp].md`

**Examples**:
- During active session `WFS-api-refactor`, asking about API structure → `.chat/chat-20250105-143022.md`
- No session, asking about build process → `.scratchpad/chat-build-process-20250105-143045.md`

## Notes

- Command templates and file patterns: see intelligent-tools-strategy.md (loaded in memory)
- Scratchpad directory details: see workflow-architecture.md
- Scratchpad conversations preserved for future reference
