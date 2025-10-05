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

Execute systematic bug analysis and fix suggestions using CLI tools with diagnostic template.

**Supported Tools**: codex, gemini (default), qwen

## Execution Flow

1. **Parse tool selection**: Extract `--tool` flag (default: gemini)
2. **If `--enhance` flag present**: Execute `/enhance-prompt "[bug-description]"` first
3. Parse bug description (original or enhanced)
4. Detect target directory (from `--cd` or auto-infer)
5. Build command for selected tool with bug-fix template
6. Execute analysis
7. Save to session (if active)

## Core Rules

1. **Enhance First (if flagged)**: Execute `/enhance-prompt` before analysis
2. **Directory Context**: Use `cd` when `--cd` provided or auto-detected
3. **Template Required**: Always use bug-fix template
4. **Session Output**: Save to `.workflow/WFS-[id]/.chat/bug-index-[timestamp].md`

## Command Template

```bash
cd [directory] && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: [bug analysis goal]
TASK: Systematic bug analysis and fix recommendations
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} [entire codebase in directory]
EXPECTED: Root cause analysis, code path tracing, targeted fixes
RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Bug: [description]
"
```

## Examples

**Basic Bug Analysis**:
```bash
cd . && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Debug authentication null pointer error
TASK: Identify root cause and provide fix
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Root cause, code path, minimal fix, impact assessment
RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Bug: null pointer in login flow
"
```

**Directory-Specific**:
```bash
cd src/auth && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Fix token validation failure
TASK: Analyze token validation bug in auth module
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Validation logic analysis, fix recommendation
RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Bug: token validation fails intermittently
"
```

**With Enhancement**:
```bash
# User: /gemini:mode:bug-index --enhance "login broken"

# Step 1: Enhance
/enhance-prompt "login broken"
# Returns:
# INTENT: Debug login authentication failure
# CONTEXT: Known session state issue
# ACTION: Check session management → verify token → test flow

# Step 2: Analyze with enhanced context
cd . && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Debug login authentication failure
TASK: Analyze session management, token handling, auth flow
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} Known: session state issue
EXPECTED: Root cause in session/token, targeted fix
RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Focus on session management
"
```

## Analysis Focus

**Template provides**:
- **Root Cause Analysis**: Systematic investigation
- **Code Path Tracing**: Execution flow analysis
- **Targeted Solutions**: Minimal, specific fixes
- **Impact Assessment**: Side effect evaluation

## File Pattern Reference

### Common Patterns
- All files: `@{**/*}`
- Source files: `@{src/**/*}`
- TypeScript: `@{*.ts,*.tsx}`
- JavaScript: `@{*.js,*.jsx}`
- Python: `@{*.py}`
- With docs: `@{CLAUDE.md,**/*CLAUDE.md}`
- Tests: `@{**/*.test.*,**/*.spec.*}`

### Complex Pattern Discovery
For bug investigation, use semantic discovery to find relevant code:

```bash
# Step 1: Find bug-related files
rg "error_keyword|exception_pattern" --files-with-matches
mcp__code-index__search_code_advanced(pattern="throw|catch|error", file_pattern="*.ts")

# Step 2: Trace error propagation path
# Identify: origin → propagation → handler

# Step 3: Execute bug analysis with focused context
cd src && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Debug null pointer error in authentication
TASK: Identify root cause and provide fix
MODE: analysis
CONTEXT: @{CLAUDE.md,auth/service.ts,middleware/auth.ts}
EXPECTED: Root cause, execution trace, minimal fix
RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Bug: null pointer in token validation
"
```

## Session Output

**Location**: `.workflow/WFS-[topic]/.chat/bug-index-[timestamp].md`

**Includes**:
- Bug description
- Template used
- Analysis results
- Recommended actions