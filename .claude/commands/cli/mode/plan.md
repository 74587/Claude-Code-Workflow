---
name: plan
description: Project planning and architecture analysis using CLI tools
usage: /cli:mode:plan [--tool <codex|gemini|qwen>] [--enhance] [--cd "path"] "topic"
argument-hint: "[--tool codex|gemini|qwen] [--enhance] [--cd path] topic"
examples:
  - /cli:mode:plan "design user dashboard"
  - /cli:mode:plan --tool qwen --enhance "plan microservices migration"
  - /cli:mode:plan --tool codex --cd "src/auth" "authentication system"
allowed-tools: SlashCommand(*), Bash(*)
---

# CLI Mode: Plan (/cli:mode:plan)

## Purpose

Comprehensive planning and architecture analysis with strategic planning template (`~/.claude/prompt-templates/plan.md`).

**Supported Tools**: codex, gemini (default), qwen
**Key Feature**: `--cd` flag for directory-scoped planning

## Parameters

- `--tool <codex|gemini|qwen>` - Tool selection (default: gemini)
- `--enhance` - Enhance topic with `/enhance-prompt` first
- `--cd "path"` - Target directory for focused planning
- `<topic>` (Required) - Planning topic or architectural question

## Execution Flow

1. Parse tool and directory options
2. If `--enhance`: Execute `/enhance-prompt` to expand planning context
3. Use planning template: `~/.claude/prompt-templates/plan.md`
4. Execute with `--all-files` in target directory
5. Save to `.workflow/WFS-[id]/.chat/plan-[timestamp].md`

## Planning Capabilities (via Template)

- Strategic architecture insights
- Implementation roadmaps
- Key technical decisions
- Risk assessment
- Resource planning

## Examples

```bash
# Basic planning
/cli:mode:plan "design user dashboard"

# Enhanced with directory scope
/cli:mode:plan --cd "src/api" --enhance "plan API refactoring"

# Qwen for architecture planning
/cli:mode:plan --tool qwen "plan microservices migration"

# Codex for technical planning
/cli:mode:plan --tool codex "plan testing strategy"
```

## Planning Workflow

```bash
# 1. Gather existing architecture info
rg "architecture|design" --files-with-matches

# 2. Execute planning analysis
/cli:mode:plan "topic for strategic planning"
```

## Notes

- Command templates and file patterns: see intelligent-tools-strategy.md (loaded in memory)
- Template path: `~/.claude/prompt-templates/plan.md`
- Always uses `--all-files` for comprehensive project context
