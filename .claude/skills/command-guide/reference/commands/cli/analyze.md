---
name: analyze
description: Read-only codebase analysis using Gemini (default), Qwen, or Codex with auto-pattern detection and template selection
argument-hint: "[--agent] [--tool codex|gemini|qwen] [--enhance] analysis target"
allowed-tools: SlashCommand(*), Bash(*), TodoWrite(*), Read(*), Glob(*), Task(*)
---

# CLI Analyze Command (/cli:analyze)

## Purpose

Quick codebase analysis using CLI tools. **Read-only - does NOT modify code**.

**Tool Selection**:
- **gemini** (default) - Best for code analysis
- **qwen** - Fallback when Gemini unavailable
- **codex** - Alternative for deep analysis

## Parameters

- `--tool <gemini|qwen|codex>` - Tool selection (default: gemini)
- `--agent` - Use cli-execution-agent for automated context discovery
- `--enhance` - Use `/enhance-prompt` for context-aware enhancement
- `<analysis-target>` - Description of what to analyze

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
3. Auto-detect file patterns from keywords
4. Build command with analysis template
5. Execute analysis (read-only)
6. Save results

### Agent Mode (`--agent`)

Delegates to agent for intelligent analysis:

```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Codebase analysis",
  prompt=`
    Task: ${analysis_target}
    Mode: analyze
    Tool: ${tool_flag || 'auto-select'}  // gemini|qwen|codex
    Enhance: ${enhance_flag || false}

    Agent responsibilities:
    1. Context Discovery:
       - Discover relevant files/patterns
       - Identify analysis scope
       - Build file context

    2. CLI Command Generation:
       - Build Gemini/Qwen/Codex command
       - Apply analysis template
       - Include discovered files

    3. Execution & Output:
       - Execute analysis
       - Generate insights report
       - Save to .workflow/.chat/ or .scratchpad/
  `
)
```

## Core Rules

- **Read-only**: Analyzes code, does NOT modify files
- **Auto-pattern**: Detects file patterns from keywords
- **Template-based**: Auto-selects analysis template
- **Output**: Saves to `.workflow/WFS-[id]/.chat/` or `.scratchpad/`

## File Pattern Auto-Detection

Keywords → file patterns:
- "auth" → `@**/*auth* @**/*user*`
- "component" → `@src/components/**/*`
- "API" → `@**/api/**/* @**/routes/**/*`
- "test" → `@**/*.test.* @**/*.spec.*`
- Generic → `@src/**/*`

## CLI Command Templates

**Gemini/Qwen**:
```bash
cd . && gemini -p "
PURPOSE: [goal]
TASK: [analysis type]
MODE: analysis
CONTEXT: @CLAUDE.md [auto-detected patterns]
EXPECTED: Insights, recommendations
RULES: [auto-selected template]
"
# Qwen: Replace 'gemini' with 'qwen'
```

**Codex**:
```bash
codex -C . --full-auto exec "
PURPOSE: [goal]
TASK: [analysis type]
MODE: analysis
CONTEXT: @CLAUDE.md [patterns]
EXPECTED: Deep insights
RULES: [template]
" -m gpt-5 --skip-git-repo-check -s danger-full-access
```

## Output

- **With session**: `.workflow/WFS-[id]/.chat/analyze-[timestamp].md`
- **No session**: `.workflow/.scratchpad/analyze-[desc]-[timestamp].md`

## Notes

- See `intelligent-tools-strategy.md` for detailed tool usage and templates
