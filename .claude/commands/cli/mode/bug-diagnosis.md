---
name: bug-diagnosis
description: Bug diagnosis and fix suggestions using CLI tools with specialized template
argument-hint: "[--agent] [--tool codex|gemini|qwen] [--enhance] [--cd path] bug description"
allowed-tools: SlashCommand(*), Bash(*), Task(*)
---

# CLI Mode: Bug Diagnosis (/cli:mode:bug-diagnosis)

## Purpose

Systematic bug diagnosis with root cause analysis template (`~/.claude/workflows/cli-templates/prompts/development/bug-diagnosis.txt`).

**Tool Selection**:
- **gemini** (default) - Best for bug diagnosis
- **qwen** - Fallback when Gemini unavailable
- **codex** - Alternative for complex bug analysis

## Parameters

- `--tool <gemini|qwen|codex>` - Tool selection (default: gemini)
- `--agent` - Use cli-execution-agent for automated context discovery
- `--enhance` - Enhance bug description with `/enhance-prompt`
- `--cd "path"` - Target directory for focused diagnosis
- `<bug-description>` (Required) - Bug description or error details

## Tool Usage

**Gemini** (Primary):
```bash
# Uses gemini by default, or specify explicitly
--tool gemini
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
4. Build command with bug-diagnosis template
5. Execute diagnosis (read-only)
6. Save to `.workflow/WFS-[id]/.chat/`

### Agent Mode (`--agent`)

Delegates to agent for intelligent diagnosis:

```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Bug root cause diagnosis",
  prompt=`
    Task: ${bug_description}
    Mode: bug-diagnosis
    Tool: ${tool_flag || 'auto-select'}  // gemini|qwen|codex
    Directory: ${cd_path || 'auto-detect'}
    Template: bug-diagnosis

    Agent responsibilities:
    1. Context Discovery:
       - Locate error traces and logs
       - Find related code sections
       - Identify data flow paths

    2. CLI Command Generation:
       - Build Gemini/Qwen/Codex command
       - Include diagnostic context
       - Apply bug-diagnosis.txt template

    3. Execution & Output:
       - Execute root cause analysis
       - Generate fix suggestions
       - Save to .workflow/.chat/
  `
)
```

## Core Rules

- **Read-only**: Diagnoses bugs, does NOT modify code
- **Template**: Uses `bug-diagnosis.txt` for root cause analysis
- **Output**: Saves to `.workflow/WFS-[id]/.chat/`

## CLI Command Templates

**Gemini/Qwen** (default, diagnosis only):
```bash
cd [dir] && gemini -p "
PURPOSE: [goal]
TASK: Root cause analysis
MODE: analysis
CONTEXT: @**/*
EXPECTED: Diagnosis, fix plan
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/bug-diagnosis.txt)
"
# Qwen: Replace 'gemini' with 'qwen'
```

**Codex** (diagnosis + potential fixes):
```bash
codex -C [dir] --full-auto exec "
PURPOSE: [goal]
TASK: Bug diagnosis
MODE: analysis
CONTEXT: @**/*
EXPECTED: Diagnosis, fix suggestions
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/bug-diagnosis.txt)
" -m gpt-5 --skip-git-repo-check -s danger-full-access
```

## Output

- **With session**: `.workflow/WFS-[id]/.chat/bug-diagnosis-[timestamp].md`
- **No session**: `.workflow/.scratchpad/bug-diagnosis-[desc]-[timestamp].md`

## Notes

- Template: `~/.claude/workflows/cli-templates/prompts/development/bug-diagnosis.txt`
- See `intelligent-tools-strategy.md` for detailed tool usage
