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

## Purpose

Direct interaction with CLI tools for codebase analysis and Q&A.

**Supported Tools**: codex, gemini (default), qwen

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

### File Pattern Reference
- All files: `@{**/*}`
- Source files: `@{src/**/*}`
- TypeScript: `@{*.ts,*.tsx}`
- JavaScript: `@{*.js,*.jsx}`
- With docs: `@{CLAUDE.md,**/*CLAUDE.md}`
- Tests: `@{**/*.test.*,**/*.spec.*}`
- Config files: `@{*.config.*,**/config/**/*}`

### Complex Pattern Discovery
For targeted analysis, use semantic discovery BEFORE CLI execution:

```bash
# Step 1: Discover relevant files
rg "specific_pattern" --files-with-matches --type ts
mcp__code-index__search_code_advanced(pattern="target_code", file_pattern="*.ts")

# Step 2: Build CONTEXT with discovered files
CONTEXT: @{CLAUDE.md} @{src/file1.ts,src/file2.ts}

# Step 3: Execute chat command
cd src && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Answer specific inquiry
CONTEXT: @{CLAUDE.md,file1.ts,file2.ts}
EXPECTED: Detailed response
"
```

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