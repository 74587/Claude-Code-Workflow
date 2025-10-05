---
name: code-analysis
description: Deep code analysis and debugging using CLI tools with specialized template
usage: /cli:mode:code-analysis [--tool <codex|gemini|qwen>] [--enhance] [--cd "path"] "analysis target"
argument-hint: "[--tool codex|gemini|qwen] [--enhance] [--cd path] analysis target"
examples:
  - /cli:mode:code-analysis "analyze authentication flow logic"
  - /cli:mode:code-analysis --tool qwen --enhance "explain data transformation pipeline"
  - /cli:mode:code-analysis --tool codex --cd "src/core" "trace execution path for user registration"
allowed-tools: SlashCommand(*), Bash(*)
---

# CLI Mode: Code Analysis (/cli:mode:code-analysis)

## Purpose

Systematic code analysis with execution path tracing template (`~/.claude/prompt-templates/code-analysis.md`).

**Supported Tools**: codex, gemini (default), qwen
**Key Feature**: `--cd` flag for directory-scoped analysis

## Parameters

- `--tool <codex|gemini|qwen>` - Tool selection (default: gemini)
- `--enhance` - Enhance analysis target with `/enhance-prompt` first
- `--cd "path"` - Target directory for focused analysis
- `<analysis-target>` (Required) - Code analysis target or question

## Execution Flow

1. Parse tool and directory options
2. If `--enhance`: Execute `/enhance-prompt` to expand analysis intent
3. Use code-analysis template: `~/.claude/prompt-templates/code-analysis.md`
4. Execute with `--all-files` in target directory
5. Save to `.workflow/WFS-[id]/.chat/code-analysis-[timestamp].md`

## Analysis Capabilities (via Template)

- Execution path tracing with variable states
- Call flow visualization and diagrams
- Control & data flow analysis
- Logical reasoning ("why" behind code behavior)
- Debugging insights and inefficiency detection

## Examples

```bash
# Basic code analysis
/cli:mode:code-analysis "trace authentication flow"

# Directory-specific with enhancement
/cli:mode:code-analysis --cd "src/auth" --enhance "how does JWT work"

# Qwen for architecture analysis
/cli:mode:code-analysis --tool qwen "explain microservices communication"

# Codex for deep tracing
/cli:mode:code-analysis --tool codex --cd "src/api" "trace request lifecycle"
```

## Code Tracing Workflow

```bash
# 1. Find entry points
rg "function.*main|export.*handler" --files-with-matches

# 2. Execute deep analysis
/cli:mode:code-analysis --cd "src" "trace execution from entry point"
```

## Notes

- Command templates and file patterns: see intelligent-tools-strategy.md (loaded in memory)
- Template path: `~/.claude/prompt-templates/code-analysis.md`
- Always uses `--all-files` for comprehensive code context
