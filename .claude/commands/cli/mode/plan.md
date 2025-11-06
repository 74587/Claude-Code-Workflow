---
name: plan
description: Project planning and architecture analysis using CLI tools
argument-hint: "[--agent] [--tool codex|gemini|qwen] [--enhance] [--cd path] topic"
allowed-tools: SlashCommand(*), Bash(*), Task(*)
---

# CLI Mode: Plan (/cli:mode:plan)

## Purpose

Strategic software architecture planning template (`~/.claude/workflows/cli-templates/prompts/planning/01-plan-architecture-design.txt`).

**Tool Selection**:
- **gemini** (default) - Best for architecture planning
- **qwen** - Fallback when Gemini unavailable
- **codex** - Alternative for implementation planning

## Parameters

- `--tool <gemini|qwen|codex>` - Tool selection (default: gemini)
- `--agent` - Use cli-execution-agent for automated context discovery
- `--enhance` - Enhance task with `/enhance-prompt`
- `--cd "path"` - Target directory for focused planning
- `<planning-task>` (Required) - Architecture planning task or modification requirements

## Tool Usage

**Gemini** (Primary):
```bash
--tool gemini  # or omit (default)
```

**Qwen** (Fallback):
```bash
--tool qwen
```

**Codex** (Alternative):
```bash
--tool codex
```

## Execution Flow

### Standard Mode
1. Parse tool selection (default: gemini)
2. Optional: enhance with `/enhance-prompt`
3. Detect directory from `--cd` or auto-infer
4. Build command with template
5. Execute planning (read-only, no code generation)
6. Save to `.workflow/WFS-[id]/.chat/`

### Agent Mode (`--agent`)

Delegates to agent for intelligent planning:

```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Architecture modification planning",
  prompt=`
    Task: ${planning_task}
    Mode: architecture-planning
    Tool: ${tool_flag || 'auto-select'}  // gemini|qwen|codex
    Directory: ${cd_path || 'auto-detect'}
    Template: ~/.claude/workflows/cli-templates/prompts/planning/01-plan-architecture-design.txt

    Agent responsibilities:
    1. Context Discovery:
       - Analyze current architecture
       - Identify affected components
       - Map dependencies and impacts

    2. CLI Command Generation:
       - Build Gemini/Qwen/Codex command
       - Include architecture context
       - Apply ~/.claude/workflows/cli-templates/prompts/planning/01-plan-architecture-design.txt template

    3. Execution & Output:
       - Execute strategic planning
       - Generate modification plan
       - Save to .workflow/.chat/
  `
)
```

## Core Rules

- **Planning only**: Creates modification plans, does NOT generate code
- **Template**: Uses `~/.claude/workflows/cli-templates/prompts/planning/01-plan-architecture-design.txt` for strategic planning
- **Output**: Saves to `.workflow/WFS-[id]/.chat/`

## CLI Command Templates

**Gemini/Qwen** (default, planning only):
```bash
cd [dir] && gemini -p "
PURPOSE: [goal]
TASK: Architecture planning
MODE: analysis
CONTEXT: @**/*
EXPECTED: Modification plan, impact analysis
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/planning/01-plan-architecture-design.txt)
"
# Qwen: Replace 'gemini' with 'qwen'
```

**Codex** (planning + implementation guidance):
```bash
codex -C [dir] --full-auto exec "
PURPOSE: [goal]
TASK: Architecture planning
MODE: analysis
CONTEXT: @**/*
EXPECTED: Plan, implementation roadmap
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/planning/01-plan-architecture-design.txt)
" -m gpt-5 --skip-git-repo-check -s danger-full-access
```

## Output

- **With session**: `.workflow/WFS-[id]/.chat/plan-[timestamp].md`
- **No session**: `.workflow/.scratchpad/plan-[desc]-[timestamp].md`

## Notes

- Template: `~/.claude/workflows/cli-templates/prompts/planning/01-plan-architecture-design.txt`
- See `intelligent-tools-strategy.md` for detailed tool usage
