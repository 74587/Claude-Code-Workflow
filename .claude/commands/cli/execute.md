---
name: execute
description: Auto-execution of implementation tasks with YOLO permissions and intelligent context inference
usage: /cli:execute [--tool <codex|gemini|qwen>] [--enhance] <description|task-id>
argument-hint: "[--tool codex|gemini|qwen] [--enhance] description or task-id"
examples:
  - /cli:execute "implement user authentication system"
  - /cli:execute --tool qwen --enhance "optimize React component"
  - /cli:execute --tool codex IMPL-001
  - /cli:execute --enhance "fix API performance issues"
allowed-tools: SlashCommand(*), Bash(*)
model: sonnet
---

# CLI Execute Command (/cli:execute)

## Overview

**⚡ YOLO-enabled execution**: Auto-approves all confirmations for streamlined implementation workflow.

**Purpose**: Execute implementation tasks using intelligent context inference and CLI tools with full permissions.

**Supported Tools**: codex, gemini (default), qwen

**Core Guidelines**: @~/.claude/workflows/intelligent-tools-strategy.md

## 🚨 YOLO Permissions

**All confirmations auto-approved by default:**
- ✅ File pattern inference confirmation
- ✅ Gemini execution confirmation
- ✅ File modification confirmation
- ✅ Implementation summary generation

## 🎯 Enhancement Integration

**When `--enhance` flag present** (for Description Mode only):
```bash
# Step 1: Enhance the description
SlashCommand(command="/enhance-prompt \"[description]\"")

# Step 2: Use enhanced output for execution
# Enhanced output provides:
# - INTENT: Clear technical goal
# - CONTEXT: Session memory + codebase patterns
# - ACTION: Specific implementation steps
# - ATTENTION: Critical constraints
```

**Example**:
```bash
# User: /gemini:execute --enhance "fix login"

# Step 1: Enhance
/enhance-prompt "fix login"
# Returns:
# INTENT: Debug authentication failure in login flow
# CONTEXT: JWT auth in src/auth/, known token expiry issue
# ACTION: Fix token validation → update refresh logic → test flow
# ATTENTION: Preserve existing session management

# Step 2: Execute with enhanced context
gemini --all-files -p "@{src/auth/**/*} @{CLAUDE.md}
Implementation: Debug authentication failure in login flow
Focus: Token validation, refresh logic, test flow
Constraints: Preserve existing session management"
```

**Note**: `--enhance` only applies to Description Mode. Task ID Mode uses task JSON directly.

## Execution Modes

### 1. Description Mode (supports --enhance)
**Input**: Natural language description
```bash
/gemini:execute "implement JWT authentication with middleware"
/gemini:execute --enhance "implement JWT authentication with middleware"
```
**Process**: [Optional: Enhance] → Keyword analysis → Pattern inference → Context collection → Execution

### 2. Task ID Mode (no --enhance)
**Input**: Workflow task identifier
```bash
/gemini:execute IMPL-001
```
**Process**: Task JSON parsing → Scope analysis → Context integration → Execution

## Context Inference Logic

**Auto-selects relevant files based on:**
- **Keywords**: "auth" → `@{**/*auth*,**/*user*}`
- **Technology**: "React" → `@{src/**/*.{jsx,tsx}}`
- **Task Type**: "api" → `@{**/api/**/*,**/routes/**/*}`
- **Always includes**: `@{CLAUDE.md,**/*CLAUDE.md}`

## Command Options

| Option | Purpose |
|--------|---------|
| `--debug` | Verbose execution logging |
| `--save-session` | Save complete execution session to workflow |

## Workflow Integration

### Session Management
⚠️ **Auto-detects active session**: Checks `.workflow/.active-*` marker file

**Session storage:**
- **Active session exists**: Saves to `.workflow/WFS-[topic]/.chat/execute-[timestamp].md`
- **No active session**: Creates new session directory

### Task Integration
```bash
# Execute specific workflow task
/gemini:execute IMPL-001

# Loads from: .task/IMPL-001.json
# Uses: task context, brainstorming refs, scope definitions
# Updates: workflow status, generates summary
```

## Execution Templates

**Core Guidelines**: @~/.claude/workflows/intelligent-tools-strategy.md

### Permission Requirements

**Gemini Write Access** (when file modifications needed):
- Add `--approval-mode yolo` flag for auto-approval
- Required for: file creation, modification, deletion

### User Description Template
```bash
cd [target-directory] && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: [clear implementation goal from description]
TASK: [specific implementation task]
CONTEXT: @{inferred_patterns} @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Implementation code with file:line locations, test cases, integration guidance
RULES: [template reference if applicable] | [constraints]
"
```

**Example**:
```bash
cd . && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: Implement JWT authentication with middleware
TASK: Create authentication system with token validation
CONTEXT: @{**/*auth*,**/*middleware*} @{CLAUDE.md}
EXPECTED: Auth service, middleware, tests with file modifications
RULES: Follow existing auth patterns | Security best practices
"
```

### Task ID Template
```bash
cd [task-directory] && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: [task_title]
TASK: Execute [task-id] implementation
CONTEXT: @{task_files} @{brainstorming_refs} @{CLAUDE.md,**/*CLAUDE.md}
EXPECTED: Complete implementation following acceptance criteria
RULES: $(cat [task_template]) | Task type: [task_type], Scope: [task_scope]
"
```

**Example**:
```bash
cd .workflow/WFS-123 && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: Implement user profile editing
TASK: Execute IMPL-001 implementation
CONTEXT: @{src/user/**/*} @{.brainstorming/product-owner/analysis.md} @{CLAUDE.md}
EXPECTED: Profile edit API, UI components, validation, tests
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt) | Type: feature, Scope: user module
"
```

## Auto-Generated Outputs

### 1. Implementation Summary
**Location**: `.summaries/[TASK-ID]-summary.md` or auto-generated ID

```markdown
# Task Summary: [Task-ID] [Description]

## Implementation
- **Files Modified**: [file:line references]
- **Features Added**: [specific functionality]
- **Context Used**: [inferred patterns]

## Integration
- [Links to workflow documents]
```

### 2. Execution Session
**Location**: `.chat/execute-[timestamp].md`

```markdown
# Execution Session: [Timestamp]

## Input
[User description or Task ID]

## Context Inference
[File patterns used with rationale]

## Implementation Results
[Generated code and modifications]

## Status Updates
[Workflow integration updates]
```

## Error Handling

- **Task ID not found**: Lists available tasks
- **Pattern inference failure**: Uses generic `src/**/*` pattern
- **Execution failure**: Attempts fallback with simplified context
- **File modification errors**: Reports specific file/permission issues

## Performance Features

- **Smart caching**: Frequently used pattern mappings
- **Progressive inference**: Precise → broad pattern fallback
- **Parallel execution**: When multiple contexts needed
- **Directory optimization**: Switches to optimal execution path

## Integration Workflow

**Typical sequence:**
1. `workflow:plan` → Creates tasks
2. `/gemini:execute IMPL-001` → Executes with YOLO permissions
3. Auto-updates workflow status and generates summaries
4. `workflow:review` → Final validation

**vs. `/gemini:analyze`**: Execute performs analysis **and implementation**, analyze is read-only.

