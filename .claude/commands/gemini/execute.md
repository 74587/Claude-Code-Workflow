---
name: execute
description: Auto-execution of implementation tasks with YOLO permissions and intelligent context inference
usage: /gemini:execute <description|task-id>
argument-hint: "implementation description or task-id"
examples:
  - /gemini:execute "implement user authentication system" 
  - /gemini:execute "optimize React component performance"
  - /gemini:execute IMPL-001 
  - /gemini:execute "fix API performance issues"
allowed-tools: Bash(gemini:*)
model: sonnet
---

# Gemini Execute Command (/gemini:execute)

## Overview

**⚡ YOLO-enabled execution**: Auto-approves all confirmations for streamlined implementation workflow.

**Purpose**: Execute implementation tasks using intelligent context inference and Gemini CLI with full permissions.

**Core Guidelines**: @~/.claude/workflows/tools-implementation-guide.md

## 🚨 YOLO Permissions

**All confirmations auto-approved by default:**
- ✅ File pattern inference confirmation
- ✅ Gemini execution confirmation  
- ✅ File modification confirmation
- ✅ Implementation summary generation

## Execution Modes

### 1. Description Mode
**Input**: Natural language description
```bash
/gemini:execute "implement JWT authentication with middleware"
```
**Process**: Keyword analysis → Pattern inference → Context collection → Execution

### 2. Task ID Mode  
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

# Loads from: .task/impl-001.json
# Uses: task context, brainstorming refs, scope definitions
# Updates: workflow status, generates summary
```

## Execution Templates

### User Description Template
```bash
gemini --all-files -p "@{inferred_patterns} @{CLAUDE.md,**/*CLAUDE.md}

Implementation Task: [user_description]

Provide:
- Specific implementation code
- File modification locations (file:line)
- Test cases
- Integration guidance"
```

### Task ID Template
```bash
gemini --all-files -p "@{task_files} @{brainstorming_refs} @{CLAUDE.md,**/*CLAUDE.md}

Task: [task_title] (ID: [task-id])
Type: [task_type]
Scope: [task_scope]

Execute implementation following task acceptance criteria."
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

For detailed patterns, syntax, and templates see:
**@~/.claude/workflows/tools-implementation-guide.md**