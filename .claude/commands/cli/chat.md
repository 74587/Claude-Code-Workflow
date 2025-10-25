---
name: chat
description: Simple CLI interaction command for direct codebase analysis
argument-hint: "[--agent] [--tool codex|gemini|qwen] [--enhance] inquiry"
allowed-tools: SlashCommand(*), Bash(*), Task(*)
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
- `--agent` - Use cli-execution-agent for automated context discovery (5-phase intelligent mode)
- `--tool <codex|gemini|qwen>` - Select CLI tool (default: gemini, ignored in agent mode)
- `--enhance` - Enhance inquiry with `/enhance-prompt` first
- `--save-session` - Save interaction to workflow session

## Execution Flow

### Standard Mode (Default)

1. Parse tool selection (default: gemini)
2. If `--enhance`: Execute `/enhance-prompt` to expand user intent
3. Assemble context: `@CLAUDE.md` + user-specified files or `@**/*` for entire codebase
4. Execute CLI tool with assembled context (read-only, analysis mode)
5. Return explanations and insights (NO code changes)
6. Optionally save to workflow session

### Agent Mode (`--agent` flag)

Delegate inquiry to `cli-execution-agent` for intelligent Q&A with automated context discovery.

**Agent invocation**:
```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Answer question with automated context discovery",
  prompt=`
    Task: ${inquiry}
    Mode: analyze (Q&A)
    Tool Preference: ${tool_flag || 'auto-select'}

    Agent will autonomously:
    - Discover files relevant to the question
    - Build Q&A prompt with precise context
    - Execute and generate comprehensive answer
    - Save conversation log
  `
)
```

The agent handles all phases internally.

## Context Assembly

**Always included**: `@CLAUDE.md @**/*CLAUDE.md` (project guidelines, space-separated)

**Optional**:
- User-explicit files from inquiry keywords
- Use `@**/*` in CONTEXT for entire codebase

For targeted analysis, use `rg` or MCP tools to discover relevant files first, then build precise CONTEXT field.

## Command Template

```bash
cd . && gemini -p "
PURPOSE: Answer user inquiry about codebase
TASK: [user question]
MODE: analysis
CONTEXT: @CLAUDE.md @**/*CLAUDE.md [inferred files or @**/* for all files]
EXPECTED: Direct answer, explanation, insights (NO code modification)
RULES: Focus on clarity and accuracy
"
```

## Examples

**Basic Question (Standard Mode)**:
```bash
/cli:chat "analyze the authentication flow"
# Executes: Gemini analysis
# Returns: Explanation of auth flow, components involved, data flow
```

**Intelligent Q&A (Agent Mode)**:
```bash
/cli:chat --agent "how does JWT token refresh work in this codebase"
# Phase 1: Understands inquiry = JWT refresh mechanism
# Phase 2: Discovers JWT files, refresh logic, middleware patterns
# Phase 3: Builds Q&A prompt with discovered implementation details
# Phase 4: Executes Gemini with precise context for accurate answer
# Phase 5: Saves conversation log with discovered context
# Returns: Detailed answer with code references + execution log
```

**Architecture Question**:
```bash
/cli:chat --tool qwen -p "how does React component optimization work here"
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
- Scratchpad conversations preserved for future reference
