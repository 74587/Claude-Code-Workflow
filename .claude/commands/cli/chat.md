---
name: chat
description: Read-only Q&A interaction with Gemini/Qwen/Codex for codebase questions with automatic context inference
argument-hint: "[--agent] [--tool codex|gemini|qwen] [--enhance] inquiry"
allowed-tools: SlashCommand(*), Bash(*), Task(*)
---

# CLI Chat Command (/cli:chat)

## Purpose

Direct Q&A interaction with CLI tools for codebase analysis. **Read-only - does NOT modify code**.

**Tool Selection**:
- **gemini** (default) - Best for Q&A and explanations
- **qwen** - Fallback when Gemini unavailable
- **codex** - Alternative for technical deep-dives

## Parameters

- `--tool <gemini|qwen|codex>` - Tool selection (default: gemini)
- `--agent` - Use cli-execution-agent for automated context discovery
- `--enhance` - Enhance inquiry with `/enhance-prompt`
- `<inquiry>` (Required) - Question or analysis request

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
3. Assemble context: `@CLAUDE.md` + inferred files
4. Execute Q&A (read-only)
5. Return answer

### Agent Mode (`--agent`)

Delegates to agent for intelligent Q&A:

```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Codebase Q&A",
  prompt=`
    Task: ${inquiry}
    Mode: chat (Q&A)
    Tool: ${tool_flag || 'auto-select'}  // gemini|qwen|codex
    Enhance: ${enhance_flag || false}

    Agent responsibilities:
    1. Context Discovery:
       - Discover files relevant to question
       - Identify key code sections
       - Build precise context

    2. CLI Command Generation:
       - Build Gemini/Qwen/Codex command
       - Include discovered context
       - Apply Q&A template

    3. Execution & Output:
       - Execute Q&A analysis
       - Generate detailed answer
       - Save to .workflow/.chat/ or .scratchpad/
  `
)
```

## Core Rules

- **Read-only**: Provides answers, does NOT modify code
- **Context**: `@CLAUDE.md` + inferred or all files (`@**/*`)
- **Output**: Saves to `.workflow/WFS-[id]/.chat/` or `.scratchpad/`

## CLI Command Templates

**Gemini/Qwen**:
```bash
cd . && gemini -p "
PURPOSE: Answer question
TASK: [inquiry]
MODE: analysis
CONTEXT: @CLAUDE.md [inferred or @**/*]
EXPECTED: Clear answer
RULES: Focus on accuracy
"
# Qwen: Replace 'gemini' with 'qwen'
```

**Codex**:
```bash
codex -C . --full-auto exec "
PURPOSE: Answer question
TASK: [inquiry]
MODE: analysis
CONTEXT: @CLAUDE.md [inferred or @**/*]
EXPECTED: Detailed answer
RULES: Technical depth
" -m gpt-5 --skip-git-repo-check -s danger-full-access
```

## Output

- **With session**: `.workflow/WFS-[id]/.chat/chat-[timestamp].md`
- **No session**: `.workflow/.scratchpad/chat-[desc]-[timestamp].md`

## Notes

- See `intelligent-tools-strategy.md` for detailed tool usage and templates
