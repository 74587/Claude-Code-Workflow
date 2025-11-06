---
name: code-analysis
description: Read-only execution path tracing using Gemini/Qwen/Codex with specialized analysis template for call flow and optimization
argument-hint: "[--agent] [--tool codex|gemini|qwen] [--enhance] [--cd path] analysis target"
allowed-tools: SlashCommand(*), Bash(*), Task(*)
---

# CLI Mode: Code Analysis (/cli:mode:code-analysis)

## Purpose

Systematic code analysis with execution path tracing template (`~/.claude/workflows/cli-templates/prompts/analysis/01-trace-code-execution.txt`).

**Tool Selection**:
- **gemini** (default) - Best for code analysis and tracing
- **qwen** - Fallback when Gemini unavailable
- **codex** - Alternative for complex analysis tasks

**Key Feature**: `--cd` flag for directory-scoped analysis

## Parameters

- `--tool <gemini|qwen|codex>` - Tool selection (default: gemini)
- `--agent` - Use cli-execution-agent for automated context discovery
- `--enhance` - Enhance analysis target with `/enhance-prompt` first
- `--cd "path"` - Target directory for focused analysis
- `<analysis-target>` (Required) - Code analysis target or question

## Tool Usage

**Gemini** (Primary):
```bash
/cli:mode:code-analysis --tool gemini "trace auth flow"
# OR (default)
/cli:mode:code-analysis "trace auth flow"
```

**Qwen** (Fallback):
```bash
/cli:mode:code-analysis --tool qwen "trace auth flow"
```

**Codex** (Alternative):
```bash
/cli:mode:code-analysis --tool codex "trace auth flow"
```

## Execution Flow

### Standard Mode (Default)

1. Parse tool selection (default: gemini)
2. Optional: enhance analysis target with `/enhance-prompt`
3. Detect target directory from `--cd` or auto-infer
4. Build command with template
5. Execute analysis (read-only)
6. Save to `.workflow/WFS-[id]/.chat/code-analysis-[timestamp].md`

### Agent Mode (`--agent` flag)

Delegates to `cli-execution-agent` for intelligent context discovery and analysis.

## Core Rules

- **Read-only**: Analyzes code, does NOT modify files
- **Template**: Uses `~/.claude/workflows/cli-templates/prompts/analysis/01-trace-code-execution.txt` for systematic analysis
- **Output**: Saves to `.workflow/WFS-[id]/.chat/`

## CLI Command Templates

**Gemini/Qwen** (default, read-only analysis):
```bash
cd [dir] && gemini -p "
PURPOSE: [goal]
TASK: Execution path tracing
MODE: analysis
CONTEXT: @**/*
EXPECTED: Trace, call diagram
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/01-trace-code-execution.txt)
"
# Qwen: Replace 'gemini' with 'qwen'
```

**Codex** (analysis + optimization suggestions):
```bash
codex -C [dir] --full-auto exec "
PURPOSE: [goal]
TASK: Path analysis
MODE: analysis
CONTEXT: @**/*
EXPECTED: Trace, optimization
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/01-trace-code-execution.txt)
" -m gpt-5 --skip-git-repo-check -s danger-full-access
```

## Agent Execution Context

When `--agent` flag is used, delegate to agent:

```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Code execution path analysis",
  prompt=`
    Task: ${analysis_target}
    Mode: code-analysis
    Tool: ${tool_flag || 'auto-select'}  // gemini|qwen|codex
    Directory: ${cd_path || 'auto-detect'}
    Template: ~/.claude/workflows/cli-templates/prompts/analysis/01-trace-code-execution.txt

    Agent responsibilities:
    1. Context Discovery:
       - Identify entry points and call chains
       - Discover related files (MCP/ripgrep)
       - Map execution flow paths

    2. CLI Command Generation:
       - Build Gemini/Qwen/Codex command
       - Include discovered context
       - Apply ~/.claude/workflows/cli-templates/prompts/analysis/01-trace-code-execution.txt template

    3. Execution & Output:
       - Execute analysis with selected tool
       - Save to .workflow/WFS-[id]/.chat/
  `
)
```

## Output

- **With session**: `.workflow/WFS-[id]/.chat/code-analysis-[timestamp].md`
- **No session**: `.workflow/.scratchpad/code-analysis-[desc]-[timestamp].md`

## Notes

- Template: `~/.claude/workflows/cli-templates/prompts/analysis/01-trace-code-execution.txt`
- See `intelligent-tools-strategy.md` for detailed tool usage
