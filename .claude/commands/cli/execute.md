---
name: execute
description: Auto-execution of implementation tasks with YOLO permissions and intelligent context inference
argument-hint: "[--agent] [--tool codex|gemini|qwen] [--enhance] description or task-id"
allowed-tools: SlashCommand(*), Bash(*), Task(*)
---

# CLI Execute Command (/cli:execute)

## Purpose

Execute implementation tasks with **YOLO permissions** (auto-approves all confirmations). **MODIFIES CODE**.

**Intent**: Autonomous code implementation, modification, and generation
**Supported Tools**: codex, gemini (default), qwen
**Key Feature**: Automatic context inference and file pattern detection

## Core Behavior

1. **Code Modification**: This command MODIFIES, CREATES, and DELETES code files
2. **Auto-Approval**: YOLO mode bypasses confirmation prompts for all operations
3. **Implementation Focus**: Executes actual code changes, not just recommendations
4. **Requires Explicit Intent**: Use only when implementation is intended

## Core Concepts

### YOLO Permissions
Auto-approves: file pattern inference, execution, **file modifications**, summary generation

**⚠️ WARNING**: This command will make actual code changes without manual confirmation

### Execution Modes

**1. Description Mode** (supports `--enhance`):
- Input: Natural language description
- Process: [Optional: Enhance] → Keyword analysis → Pattern inference → Execute

**2. Task ID Mode** (no `--enhance`):
- Input: Workflow task identifier (e.g., `IMPL-001`)
- Process: Task JSON parsing → Scope analysis → Execute

**3. Agent Mode** (`--agent` flag):
- Input: Description or task-id
- Process: 5-Phase Workflow → Context Discovery → Optimal Tool Selection → Execute

### Context Inference

Auto-selects files based on keywords and technology (each @ references one pattern):
- "auth" → `@**/*auth* @**/*user*`
- "React" → `@src/**/*.jsx @src/**/*.tsx`
- "api" → `@**/api/**/* @**/routes/**/*`
- Always includes: `@CLAUDE.md @**/*CLAUDE.md`

For precise file targeting, use `rg` or MCP tools to discover files first.

### Codex Session Continuity

**Resume Pattern** for related tasks:
```bash
# First task - establish session
codex -C [dir] --full-auto exec "[task]" --skip-git-repo-check -s danger-full-access

# Related task - continue session
codex --full-auto exec "[related-task]" resume --last --skip-git-repo-check -s danger-full-access
```

Use `resume --last` when current task extends/relates to previous execution. See intelligent-tools-strategy.md for auto-resume rules.

## Parameters

- `--agent` - Use cli-execution-agent for automated context discovery (5-phase intelligent mode)
- `--tool <codex|gemini|qwen>` - Select CLI tool (default: gemini, ignored in agent mode unless specified)
- `--enhance` - Enhance input with `/enhance-prompt` first (Description Mode only)
- `<description|task-id>` - Natural language description or task identifier
- `--debug` - Verbose logging
- `--save-session` - Save execution to workflow session

## Workflow Integration

**Session Management**: Auto-detects `.workflow/.active-*` marker
- Active session: Save to `.workflow/WFS-[id]/.chat/execute-[timestamp].md`
- No session: Create new session or save to scratchpad

**Task Integration**: Load from `.task/[TASK-ID].json`, update status, generate summary

## Output Routing

**Execution Log Destination**:
- **IF** active workflow session exists:
  - Save to `.workflow/WFS-[id]/.chat/execute-[timestamp].md`
  - Update task status in `.task/[TASK-ID].json` (if task ID provided)
  - Generate summary in `.workflow/WFS-[id]/.summaries/[TASK-ID]-summary.md`
- **ELSE** (no active session):
  - **Option 1**: Create new workflow session for task
  - **Option 2**: Save to `.workflow/.scratchpad/execute-[description]-[timestamp].md`

**Output Files** (when active session exists):
- Execution log: `.workflow/WFS-[id]/.chat/execute-[timestamp].md`
- Task summary: `.workflow/WFS-[id]/.summaries/[TASK-ID]-summary.md` (if task ID)
- Modified code: Project files per implementation

**Examples**:
- During session `WFS-auth-system`, executing `IMPL-001`:
  - Log: `.workflow/WFS-auth-system/.chat/execute-20250105-143022.md`
  - Summary: `.workflow/WFS-auth-system/.summaries/IMPL-001-summary.md`
- No session, ad-hoc implementation:
  - Log: `.workflow/.scratchpad/execute-jwt-auth-20250105-143045.md`

## Execution Modes

### Standard Mode (Default)
```bash
# Gemini/Qwen: MODE=write with --approval-mode yolo
cd . && gemini --approval-mode yolo "
PURPOSE: [implementation goal]
TASK: [specific implementation]
MODE: write
CONTEXT: @CLAUDE.md [auto-detected files]
EXPECTED: Working implementation with code changes
RULES: [constraints] | Auto-approve all changes
"

# Codex: MODE=auto with danger-full-access
codex -C . --full-auto exec "
PURPOSE: [implementation goal]
TASK: [specific implementation]
MODE: auto
CONTEXT: [auto-detected files]
EXPECTED: Complete implementation with tests
" --skip-git-repo-check -s danger-full-access
```

### Agent Mode (`--agent` flag)

Delegate implementation to `cli-execution-agent` for intelligent execution with automated context discovery.

**Agent invocation**:
```javascript
Task(
  subagent_type="cli-execution-agent",
  description="Implement with automated context discovery and optimal tool selection",
  prompt=`
    Task: ${description_or_task_id}
    Mode: execute
    Tool Preference: ${tool_flag || 'auto-select'}
    ${enhance_flag ? 'Enhance: true' : ''}

    Agent will autonomously:
    - Discover implementation files and dependencies
    - Assess complexity and select optimal tool
    - Execute with YOLO permissions (auto-approve)
    - Generate task summary if task-id provided
  `
)
```

The agent handles all phases internally, including complexity-based tool selection.

## Examples

**Basic Implementation (Standard Mode)** (⚠️ modifies code):
```bash
/cli:execute "implement JWT authentication with middleware"
# Executes: Creates auth middleware, updates routes, modifies config
# Result: NEW/MODIFIED code files with JWT implementation
```

**Intelligent Implementation (Agent Mode)** (⚠️ modifies code):
```bash
/cli:execute --agent "implement OAuth2 authentication with token refresh"
# Phase 1: Classifies intent=execute, complexity=complex, keywords=['oauth2', 'auth', 'token', 'refresh']
# Phase 2: MCP discovers auth patterns, existing middleware, JWT dependencies
# Phase 3: Enhances prompt with discovered patterns and best practices
# Phase 4: Selects Codex (complex task), executes with comprehensive context
# Phase 5: Saves execution log + generates implementation summary
# Result: Complete OAuth2 implementation + detailed execution log
```

**Enhanced Implementation** (⚠️ modifies code):
```bash
/cli:execute --enhance "implement JWT authentication"
# Step 1: Enhance to expand requirements
# Step 2: Execute implementation with auto-approval
# Result: Complete auth system with MODIFIED code files
```

**Task Execution** (⚠️ modifies code):
```bash
/cli:execute IMPL-001
# Reads: .task/IMPL-001.json for requirements
# Executes: Implementation based on task spec
# Result: Code changes per task definition
```

**Codex Implementation** (⚠️ modifies code):
```bash
/cli:execute --tool codex "optimize database queries"
# Executes: Codex with full file access
# Result: MODIFIED query code, new indexes, updated tests
```

**Qwen Code Generation** (⚠️ modifies code):
```bash
/cli:execute --tool qwen --enhance "refactor auth module"
# Step 1: Enhanced refactoring plan
# Step 2: Execute with MODE=write
# Result: REFACTORED auth code with structural changes
```

## Comparison with Analysis Commands

| Command | Intent | Code Changes | Auto-Approve |
|---------|--------|--------------|--------------|
| `/cli:analyze` | Understand code | ❌ NO | N/A |
| `/cli:chat` | Ask questions | ❌ NO | N/A |
| `/cli:execute` | **Implement** | ✅ **YES** | ✅ **YES** |

## Notes

- Command templates, YOLO mode details, and session management: see intelligent-tools-strategy.md (loaded in memory)
- Output routing and scratchpad details: see workflow-architecture.md
- **⚠️ Code Modification**: This command modifies code - execution logs document changes made
