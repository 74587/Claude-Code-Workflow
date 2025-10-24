---
name: bug-index
description: Bug analysis and fix suggestions using CLI tools
argument-hint: "[--agent] [--tool codex|gemini|qwen] [--enhance] [--cd path] bug description"
allowed-tools: SlashCommand(*), Bash(*), Task(*)
---

# CLI Mode: Bug Index (/cli:mode:bug-index)

## Purpose

Systematic bug analysis with diagnostic template (`~/.claude/prompt-templates/bug-fix.md`).

**Supported Tools**: codex, gemini (default), qwen
**Key Feature**: `--cd` flag for directory-scoped analysis

## Parameters

- `--agent` - Use cli-execution-agent for automated context discovery (5-phase intelligent mode)
- `--tool <codex|gemini|qwen>` - Tool selection (default: gemini, ignored in agent mode)
- `--enhance` - Enhance bug description with `/enhance-prompt` first
- `--cd "path"` - Target directory for focused analysis
- `<bug-description>` (Required) - Bug description or error message

## Execution Flow

### Standard Mode (Default)

1. **Parse tool selection**: Extract `--tool` flag (default: gemini)
2. **If `--enhance` flag present**: Execute `/enhance-prompt "[bug-description]"` first
3. Parse bug description (original or enhanced)
4. Detect target directory (from `--cd` or auto-infer)
5. Build command for selected tool with bug-fix template
6. Execute analysis (read-only, provides fix recommendations)
7. Save to `.workflow/WFS-[id]/.chat/bug-index-[timestamp].md`

### Agent Mode (`--agent` flag)

Delegate bug analysis to `cli-execution-agent` for intelligent debugging with automated context discovery.

**Agent invocation**:
```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Analyze bug with automated context discovery",
  prompt=`
    Task: ${bug_description}
    Mode: debug (bug analysis)
    Tool Preference: ${tool_flag || 'auto-select'}
    ${cd_flag ? `Directory Scope: ${cd_path}` : ''}
    Template: bug-fix

    Agent will autonomously:
    - Discover bug-related files and error traces
    - Build debug prompt with bug-fix template
    - Execute analysis and provide fix recommendations
    - Save analysis log
  `
)
```

The agent handles all phases internally.

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
cd [directory] && gemini -p "
PURPOSE: [bug analysis goal]
TASK: Systematic bug analysis and fix recommendations
MODE: analysis
CONTEXT: @CLAUDE.md @**/*CLAUDE.md [entire codebase in directory]
EXPECTED: Root cause analysis, code path tracing, targeted fix suggestions
RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Bug: [description]
"
```

## Examples

**Basic Bug Analysis (Standard Mode)**:
```bash
/cli:mode:bug-index "null pointer error in login flow"
# Executes: Gemini with bug-fix template
# Returns: Root cause analysis, fix recommendations
```

**Intelligent Bug Analysis (Agent Mode)**:
```bash
/cli:mode:bug-index --agent "intermittent token validation failure"
# Phase 1: Classifies as debug task, extracts keywords ['token', 'validation', 'failure']
# Phase 2: MCP discovers token validation code, middleware, test files with errors
# Phase 3: Builds debug prompt with bug-fix template + discovered error patterns
# Phase 4: Executes Gemini with comprehensive bug context
# Phase 5: Saves analysis log with detailed fix recommendations
# Returns: Root cause analysis + code path traces + minimal fix suggestions
```

**Standard Template Example**:
```bash
cd . && gemini -p "
PURPOSE: Debug authentication null pointer error
TASK: Identify root cause and provide fix recommendations
MODE: analysis
CONTEXT: @CLAUDE.md @**/*CLAUDE.md
EXPECTED: Root cause, code path, minimal fix suggestion, impact assessment
RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Bug: null pointer in login flow
"
```

**Directory-Specific**:
```bash
cd src/auth && gemini -p "
PURPOSE: Fix token validation failure
TASK: Analyze token validation bug in auth module
MODE: analysis
CONTEXT: @CLAUDE.md @**/*CLAUDE.md
EXPECTED: Validation logic analysis, fix recommendation with minimal changes
RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Bug: token validation fails intermittently
"
```

## Bug Investigation Workflow

```bash
# 1. Find bug-related files
rg "error_keyword" --files-with-matches
rg "error|exception" -g "*.ts"

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
- Uses `@**/*` for in CONTEXT field for comprehensive codebase context
