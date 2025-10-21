---
name: analyze
description: Quick codebase analysis using CLI tools (codex/gemini/qwen)
argument-hint: "[--agent] [--tool codex|gemini|qwen] [--enhance] analysis target"
allowed-tools: SlashCommand(*), Bash(*), TodoWrite(*), Read(*), Glob(*), Task(*)
---

# CLI Analyze Command (/cli:analyze)

## Purpose

Quick codebase analysis using CLI tools. **Analysis only - does NOT modify code**.

**Intent**: Understand code patterns, architecture, and provide insights/recommendations
**Supported Tools**: codex, gemini (default), qwen

## Core Behavior

1. **Read-Only Analysis**: This command ONLY analyzes code and provides insights
2. **No Code Modification**: Results are recommendations and analysis reports
3. **Template-Based**: Automatically selects appropriate analysis template
4. **Smart Pattern Detection**: Infers relevant files based on analysis target

## Parameters

- `--agent` - Use cli-execution-agent for automated context discovery (5-phase intelligent mode)
- `--tool <codex|gemini|qwen>` - Tool selection (default: gemini, ignored in agent mode)
- `--enhance` - Use `/enhance-prompt` for context-aware enhancement
- `<analysis-target>` - Description of what to analyze

## Execution Flow

### Standard Mode (Default)

1. Parse tool selection (default: gemini)
2. If `--enhance`: Execute `/enhance-prompt` first to expand user intent
3. Auto-detect analysis type from keywords → select template
4. Build command with auto-detected file patterns and `MODE: analysis`
5. Execute analysis (read-only, no code changes)
6. Return analysis report with insights and recommendations

### Agent Mode (`--agent` flag)

Delegate task to `cli-execution-agent` for intelligent execution with automated context discovery.

**Agent invocation**:
```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Analyze codebase with automated context discovery",
  prompt=`
    Task: ${analysis_target}
    Mode: analyze
    Tool Preference: ${tool_flag || 'auto-select'}
    ${enhance_flag ? 'Enhance: true' : ''}

    Agent will autonomously:
    - Discover relevant files and patterns
    - Build enhanced analysis prompt
    - Select optimal tool and execute
    - Route output to session/scratchpad
  `
)
```

The agent handles all phases internally (understanding, discovery, enhancement, execution, routing).

## File Pattern Auto-Detection

Keywords trigger specific file patterns (each @ references one pattern):
- "auth" → `@**/*auth* @**/*user*`
- "component" → `@src/components/**/* @**/*.component.*`
- "API" → `@**/api/**/* @**/routes/**/*`
- "test" → `@**/*.test.* @**/*.spec.*`
- "config" → `@*.config.* @**/config/**/*`
- Generic → `@src/**/*`

For complex patterns, use `rg` or MCP tools to discover files first, then execute CLI with precise file references.

## Command Template

```bash
cd . && gemini -p "
PURPOSE: [analysis goal from target]
TASK: [auto-detected analysis type]
MODE: analysis
CONTEXT: @CLAUDE.md [auto-detected file patterns]
EXPECTED: Insights, patterns, recommendations (NO code modification)
RULES: [auto-selected template] | Focus on [analysis aspect]
"
```

## Examples

**Basic Analysis (Standard Mode)**:
```bash
/cli:analyze "authentication patterns"
# Executes: Gemini analysis with auth file patterns
# Returns: Pattern analysis, architecture insights, recommendations
```

**Intelligent Analysis (Agent Mode)**:
```bash
/cli:analyze --agent "authentication patterns"
# Phase 1: Classifies intent=analyze, complexity=simple, keywords=['auth', 'patterns']
# Phase 2: MCP discovers 12 auth files, identifies patterns
# Phase 3: Builds enhanced prompt with discovered context
# Phase 4: Executes Gemini with comprehensive file references
# Phase 5: Saves execution log with all 5 phases documented
# Returns: Comprehensive analysis + detailed execution log
```

**Architecture Analysis**:
```bash
/cli:analyze --tool qwen -p "component architecture"
# Executes: Qwen with component file patterns
# Returns: Architecture review, design patterns, improvement suggestions
```

**Performance Analysis**:
```bash
/cli:analyze --tool codex "performance bottlenecks"
# Executes: Codex deep analysis with performance focus
# Returns: Bottleneck identification, optimization recommendations
```

**Enhanced Analysis**:
```bash
/cli:analyze --enhance "fix auth issues"
# Step 1: Enhance prompt to expand context
# Step 2: Analysis with expanded context
# Returns: Root cause analysis, fix recommendations (NO automatic fixes)
```

## Output Routing

**Output Destination Logic**:
- **Active session exists AND analysis is session-relevant**:
  - Save to `.workflow/WFS-[id]/.chat/analyze-[timestamp].md`
- **No active session OR one-off analysis**:
  - Save to `.workflow/.scratchpad/analyze-[description]-[timestamp].md`

**Examples**:
- During active session `WFS-auth-system`, analyzing auth patterns → `.chat/analyze-20250105-143022.md`
- No session, quick security check → `.scratchpad/analyze-security-20250105-143045.md`

## Notes

- Command templates, file patterns, and best practices: see intelligent-tools-strategy.md (loaded in memory)
- Scratchpad directory details: see workflow-architecture.md
- Scratchpad files can be promoted to workflow sessions if analysis proves valuable
