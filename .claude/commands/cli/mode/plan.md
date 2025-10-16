---
name: plan
description: Project planning and architecture analysis using CLI tools
argument-hint: "[--agent] [--tool codex|gemini|qwen] [--enhance] [--cd path] topic"
allowed-tools: SlashCommand(*), Bash(*), Task(*)
---

# CLI Mode: Plan (/cli:mode:plan)

## Purpose

Comprehensive planning and architecture analysis with strategic planning template (`~/.claude/prompt-templates/plan.md`).

**Supported Tools**: codex, gemini (default), qwen
**Key Feature**: `--cd` flag for directory-scoped planning

## Parameters

- `--agent` - Use cli-execution-agent for automated context discovery (5-phase intelligent mode)
- `--tool <codex|gemini|qwen>` - Tool selection (default: gemini, ignored in agent mode)
- `--enhance` - Enhance topic with `/enhance-prompt` first
- `--cd "path"` - Target directory for focused planning
- `<topic>` (Required) - Planning topic or architectural question

## Execution Flow

### Standard Mode (Default)

1. **Parse tool selection**: Extract `--tool` flag (default: gemini)
2. **If `--enhance` flag present**: Execute `/enhance-prompt "[topic]"` first
3. Parse topic (original or enhanced)
4. Detect target directory (from `--cd` or auto-infer)
5. Build command for selected tool with planning template
6. Execute analysis (read-only, no code modification)
7. Save to `.workflow/WFS-[id]/.chat/plan-[timestamp].md`

### Agent Mode (`--agent` flag)

Delegate planning to `cli-execution-agent` for intelligent strategic planning with automated architecture discovery.

**Agent invocation**:
```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Create strategic plan with automated architecture discovery",
  prompt=`
    Task: ${planning_topic}
    Mode: plan (strategic planning)
    Tool Preference: ${tool_flag || 'auto-select'}
    ${cd_flag ? `Directory Scope: ${cd_path}` : ''}
    Template: plan

    Agent will autonomously:
    - Discover project structure and existing architecture
    - Build planning prompt with plan template
    - Execute strategic planning analysis
    - Generate implementation roadmap and save
  `
)
```

The agent handles all phases internally.

## Core Rules

1. **Analysis Only**: This command provides planning recommendations and insights - it does NOT modify code
2. **Enhance First (if flagged)**: Execute `/enhance-prompt` before planning
3. **Directory Context**: Use `cd` when `--cd` provided or auto-detected
4. **Template Required**: Always use planning template
5. **Session Output**: Save analysis results to session chat

## Planning Capabilities (via Template)

- Strategic architecture insights and recommendations
- Implementation roadmaps and suggestions
- Key technical decisions analysis
- Risk assessment
- Resource planning

## Command Template

```bash
cd [directory] && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: [planning goal from topic]
TASK: Comprehensive planning and architecture analysis
MODE: analysis
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md} [entire codebase in directory]
EXPECTED: Strategic insights, implementation recommendations, key decisions
RULES: $(cat ~/.claude/prompt-templates/plan.md) | Focus on [topic area]
"
```

## Examples

**Basic Planning Analysis (Standard Mode)**:
```bash
/cli:mode:plan "design user dashboard architecture"
# Executes: Gemini with planning template
# Returns: Architecture recommendations, component design, roadmap
```

**Intelligent Planning (Agent Mode)**:
```bash
/cli:mode:plan --agent "design microservices architecture for payment system"
# Phase 1: Classifies as architectural planning, keywords ['microservices', 'payment', 'architecture']
# Phase 2: MCP discovers existing services, payment flows, integration patterns
# Phase 3: Builds planning prompt with plan template + current architecture context
# Phase 4: Executes Gemini with comprehensive project understanding
# Phase 5: Saves planning document with implementation roadmap and migration strategy
# Returns: Strategic architecture plan + implementation roadmap + risk assessment
```

**Standard Template Example**:
```bash
cd . && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Design user dashboard architecture
TASK: Plan dashboard component structure and data flow
MODE: analysis
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Architecture recommendations, component design, data flow diagram
RULES: $(cat ~/.claude/prompt-templates/plan.md) | Focus on scalability
"
```

**Directory-Specific Planning**:
```bash
cd src/api && ~/.claude/scripts/gemini-wrapper --all-files -p "
PURPOSE: Plan API refactoring strategy
TASK: Analyze current API structure and recommend improvements
MODE: analysis
CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Refactoring roadmap, breaking change analysis, migration plan
RULES: $(cat ~/.claude/prompt-templates/plan.md) | Maintain backward compatibility
"
```

## Planning Workflow

```bash
# 1. Discover project structure
~/.claude/scripts/get_modules_by_depth.sh
mcp__code-index__find_files(pattern="*.ts")

# 2. Gather existing architecture info
rg "architecture|design" --files-with-matches

# 3. Execute planning analysis (analysis only, no code changes)
/cli:mode:plan "topic for strategic planning"
```

## Output Routing

**Output Destination Logic**:
- **Active session exists AND planning is session-relevant**:
  - Save to `.workflow/WFS-[id]/.chat/plan-[timestamp].md`
- **No active session OR exploratory planning**:
  - Save to `.workflow/.scratchpad/plan-[description]-[timestamp].md`

**Examples**:
- During active session `WFS-dashboard`, planning dashboard architecture → `.chat/plan-20250105-143022.md`
- No session, exploring new feature idea → `.scratchpad/plan-feature-idea-20250105-143045.md`

## Notes

- Command templates and file patterns: see intelligent-tools-strategy.md (loaded in memory)
- Scratchpad directory details: see workflow-architecture.md
- Template path: `~/.claude/prompt-templates/plan.md`
- Always uses `--all-files` for comprehensive project context
