---
name: code-analysis
description: Deep code analysis and debugging using CLI tools with specialized template
argument-hint: "[--agent] [--tool codex|gemini|qwen] [--enhance] [--cd path] analysis target"
allowed-tools: SlashCommand(*), Bash(*), Task(*)
---

# CLI Mode: Code Analysis (/cli:mode:code-analysis)

## Purpose

Systematic code analysis with execution path tracing template (`~/.claude/prompt-templates/code-analysis.md`).

**Supported Tools**: codex, gemini (default), qwen
**Key Feature**: `--cd` flag for directory-scoped analysis

## Parameters

- `--agent` - Use cli-execution-agent for automated context discovery (5-phase intelligent mode)
- `--tool <codex|gemini|qwen>` - Tool selection (default: gemini, ignored in agent mode)
- `--enhance` - Enhance analysis target with `/enhance-prompt` first
- `--cd "path"` - Target directory for focused analysis
- `<analysis-target>` (Required) - Code analysis target or question

## Execution Flow

### Standard Mode (Default)

1. **Parse tool selection**: Extract `--tool` flag (default: gemini)
2. **If `--enhance` flag present**: Execute `/enhance-prompt "[analysis-target]"` first
3. Parse analysis target (original or enhanced)
4. Detect target directory (from `--cd` or auto-infer)
5. Build command for selected tool with code-analysis template
6. Execute deep analysis (read-only, no code modification)
7. Save to `.workflow/WFS-[id]/.chat/code-analysis-[timestamp].md`

### Agent Mode (`--agent` flag)

Delegate code analysis to `cli-execution-agent` for intelligent execution path tracing with automated context discovery.

**Agent invocation**:
```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Analyze code execution paths with automated context discovery",
  prompt=`
    Task: ${analysis_target}
    Mode: code-analysis (execution tracing)
    Tool Preference: ${tool_flag || 'auto-select'}
    ${cd_flag ? `Directory Scope: ${cd_path}` : ''}
    Template: code-analysis

    Agent will autonomously:
    - Discover execution paths and call flows
    - Build analysis prompt with code-analysis template
    - Execute deep tracing analysis
    - Generate call diagrams and save log
  `
)
```

The agent handles all phases internally.

## Core Rules

1. **Analysis Only**: This command analyzes code and provides insights - it does NOT modify code
2. **Tool Selection**: Use `--tool` value or default to gemini
3. **Enhance First (if flagged)**: Execute `/enhance-prompt` before analysis
4. **Directory Context**: Use `cd` when `--cd` provided or auto-detected
5. **Template Required**: Always use code-analysis template
6. **Session Output**: Save analysis results to session chat

## Analysis Capabilities (via Template)

- **Systematic Code Analysis**: Break down complex code into manageable parts
- **Execution Path Tracing**: Track variable states and call stacks
- **Control & Data Flow**: Understand code logic and data transformations
- **Call Flow Visualization**: Diagram function calling sequences
- **Logical Reasoning**: Explain "why" behind code behavior
- **Debugging Insights**: Identify potential bugs or inefficiencies

## Command Template

```bash
cd [directory] && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: [analysis goal]
TASK: Systematic code analysis and execution path tracing
MODE: analysis
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} [entire codebase in directory]
EXPECTED: Execution trace, call flow diagram, debugging insights
RULES: $(cat ~/.claude/prompt-templates/code-analysis.md) | Focus on [aspect]
"
```

## Examples

**Basic Code Analysis (Standard Mode)**:
```bash
/cli:mode:code-analysis "trace authentication execution flow"
# Executes: Gemini with code-analysis template
# Returns: Execution trace, call diagram, debugging insights
```

**Intelligent Code Analysis (Agent Mode)**:
```bash
/cli:mode:code-analysis --agent "trace JWT token validation from request to database"
# Phase 1: Classifies as deep analysis, keywords ['jwt', 'token', 'validation', 'database']
# Phase 2: MCP discovers request handler → middleware → service → repository chain
# Phase 3: Builds analysis prompt with code-analysis template + complete call path
# Phase 4: Executes Gemini with traced execution paths
# Phase 5: Saves detailed analysis with call flow diagrams and variable states
# Returns: Complete execution trace + call diagram + data flow analysis
```

**Standard Template Example**:
```bash
cd . && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Trace authentication execution flow
TASK: Analyze complete auth flow from request to response
MODE: analysis
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Step-by-step execution trace with call diagram, variable states
RULES: $(cat ~/.claude/prompt-templates/code-analysis.md) | Focus on control flow
"
```

**Directory-Specific Analysis**:
```bash
cd src/auth && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Understand JWT token validation logic
TASK: Trace JWT validation from middleware to service layer
MODE: analysis
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Validation flow diagram, token lifecycle analysis
RULES: $(cat ~/.claude/prompt-templates/code-analysis.md) | Focus on security
"
```

## Code Tracing Workflow

```bash
# 1. Find entry points and related files
rg "function.*authenticate|class.*AuthService" --files-with-matches
mcp__code-index__search_code_advanced(pattern="authenticate|login", file_pattern="*.ts")

# 2. Build call graph understanding
# entry → middleware → service → repository

# 3. Execute deep analysis (analysis only, no code changes)
/cli:mode:code-analysis --cd "src" "trace execution from entry point"
```

## Output Routing

**Output Destination Logic**:
- **Active session exists AND analysis is session-relevant**:
  - Save to `.workflow/WFS-[id]/.chat/code-analysis-[timestamp].md`
- **No active session OR standalone analysis**:
  - Save to `.workflow/.scratchpad/code-analysis-[description]-[timestamp].md`

**Examples**:
- During active session `WFS-auth-refactor`, analyzing auth flow → `.chat/code-analysis-20250105-143022.md`
- No session, tracing request lifecycle → `.scratchpad/code-analysis-request-flow-20250105-143045.md`

## Notes

- Command templates and file patterns: see intelligent-tools-strategy.md (loaded in memory)
- Scratchpad directory details: see workflow-architecture.md
- Template path: `~/.claude/prompt-templates/code-analysis.md`
- Always uses `--all-files` for comprehensive code context
