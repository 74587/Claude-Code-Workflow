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
model: sonnet
---

# CLI Mode: Plan (/cli:mode:plan)

## Purpose

Execute planning and architecture analysis using CLI tools with specialized template.

**Supported Tools**: codex, gemini (default), qwen

## Execution Flow

1. **Parse tool selection**: Extract `--tool` flag (default: gemini)
2. **If `--enhance` flag present**: Execute `/enhance-prompt "[topic]"` first
3. Parse topic (original or enhanced)
4. Detect target directory (from `--cd` or auto-infer)
5. Build command for selected tool with planning template
6. Execute analysis
7. Save to session (if active)

## Core Rules

1. **Enhance First (if flagged)**: Execute `/enhance-prompt` before planning
2. **Directory Context**: Use `cd` when `--cd` provided or auto-detected
3. **Template Required**: Always use planning template
4. **Session Output**: Save to `.workflow/WFS-[id]/.chat/plan-[timestamp].md`

## Command Template

**Core Guidelines**: @~/.claude/workflows/intelligent-tools-strategy.md

```bash
cd [directory] && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: [planning goal from topic]
TASK: Comprehensive planning and architecture analysis
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} [entire codebase in directory]
EXPECTED: Strategic insights, implementation roadmap, key decisions
RULES: $(cat ~/.claude/prompt-templates/plan.md) | Focus on [topic area]
"
```

## Examples

**Basic Planning**:
```bash
cd . && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Design user dashboard feature architecture
TASK: Comprehensive architecture planning for dashboard
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Architecture design, component structure, implementation roadmap
RULES: $(cat ~/.claude/prompt-templates/plan.md) | Focus on scalability and UX
"
```

**Directory-Specific**:
```bash
cd src/auth && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Plan authentication system redesign
TASK: Analyze current auth and plan improvements
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Migration strategy, security improvements, timeline
RULES: $(cat ~/.claude/prompt-templates/plan.md) | Focus on security and backward compatibility
"
```

**With Enhancement**:
```bash
# User: /gemini:mode:plan --enhance "fix auth issues"

# Step 1: Enhance
/enhance-prompt "fix auth issues"
# Returns structured planning context

# Step 2: Plan with enhanced input
cd . && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: [enhanced goal]
TASK: [enhanced task description]
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} [enhanced context]
EXPECTED: Strategic plan with enhanced requirements
RULES: $(cat ~/.claude/prompt-templates/plan.md) | [enhanced constraints]
"
```

## Session Output

**Location**: `.workflow/WFS-[topic]/.chat/plan-[timestamp].md`

**Includes**:
- Planning topic
- Template used
- Analysis results
- Implementation roadmap
- Key decisions