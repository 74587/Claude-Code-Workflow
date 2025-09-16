---
name: execute
description: Auto-execution of implementation tasks with YOLO permissions and intelligent context inference using Codex CLI
usage: /codex:execute <description|task-id>
argument-hint: "implementation description or task-id"
examples:
  - /codex:execute "implement user authentication system" 
  - /codex:execute "optimize React component performance"
  - /codex:execute IMPL-001 
  - /codex:execute "fix API performance issues"
allowed-tools: Bash(codex:*)
model: sonnet
---

# Codex Execute Command (/codex:execute)

## Overview

**⚡ YOLO-enabled execution**: Auto-approves all confirmations for streamlined implementation workflow.

**Purpose**: Execute implementation tasks using intelligent context inference and Codex CLI with full permissions.

**Core Guidelines**: @~/.claude/workflows/tools-implementation-guide.md

⚠️ **Critical Difference**: Codex has **NO `--all-files` flag** - you MUST use `@` patterns to reference files.

## 🚨 YOLO Permissions

**All confirmations auto-approved by default:**
- ✅ File pattern inference confirmation
- ✅ Codex execution confirmation  
- ✅ File modification confirmation
- ✅ Implementation summary generation

## Execution Modes

### 1. Description Mode
**Input**: Natural language description
```bash
/codex:execute "implement JWT authentication with middleware"
```
**Process**: Keyword analysis → Pattern inference → Context collection → Execution

### 2. Task ID Mode  
**Input**: Workflow task identifier
```bash
/codex:execute IMPL-001
```
**Process**: Task JSON parsing → Scope analysis → Context integration → Execution

### 3. Full Auto Mode
**Input**: Complex development tasks
```bash
/codex:execute "create complete todo application with React and TypeScript"
```
**Process**: Uses `codex --full-auto ... -s danger-full-access` for autonomous implementation

## Context Inference Logic

**Auto-selects relevant files based on:**
- **Keywords**: "auth" → `@{**/*auth*,**/*user*}`
- **Technology**: "React" → `@{src/**/*.{jsx,tsx}}`
- **Task Type**: "api" → `@{**/api/**/*,**/routes/**/*}`
- **Always includes**: `@{CLAUDE.md,**/*CLAUDE.md}`

## Essential Codex Patterns

**Required File Patterns** (No --all-files available):
```bash
@{**/*}                    # All files recursively (equivalent to --all-files)
@{src/**/*}               # All source files
@{*.ts,*.js}              # Specific file types
@{CLAUDE.md,**/*CLAUDE.md} # Documentation hierarchy
@{package.json,*.config.*} # Configuration files
```

## Command Options

| Option | Purpose |
|--------|---------|
| `--debug` | Verbose execution logging |
| `--save-session` | Save complete execution session to workflow |
| `--full-auto` | Enable autonomous development mode |

## Workflow Integration

### Session Management
⚠️ **Auto-detects active session**: Checks `.workflow/.active-*` marker file

**Session storage:**
- **Active session exists**: Saves to `.workflow/WFS-[topic]/.chat/execute-[timestamp].md`
- **No active session**: Creates new session directory

### Task Integration
```bash
# Execute specific workflow task
/codex:execute IMPL-001

# Loads from: .task/impl-001.json
# Uses: task context, brainstorming refs, scope definitions
# Updates: workflow status, generates summary
```

## Execution Templates

### User Description Template
```bash
codex --full-auto exec "@{inferred_patterns} @{CLAUDE.md,**/*CLAUDE.md}

Implementation Task: [user_description]

Provide:
- Specific implementation code
- File modification locations (file:line)
- Test cases
- Integration guidance" -s danger-full-access
```

### Task ID Template
```bash
codex --full-auto exec "@{task_files} @{brainstorming_refs} @{CLAUDE.md,**/*CLAUDE.md}

Task: [task_title] (ID: [task-id])
Type: [task_type]
Scope: [task_scope]

Execute implementation following task acceptance criteria." -s danger-full-access
```

### Full Auto Template
```bash
codex --full-auto exec "@{**/*} @{CLAUDE.md,**/*CLAUDE.md}

Development Task: [user_description]

Autonomous implementation with:
- Architecture decisions
- Code generation
- Testing
- Documentation" -s danger-full-access
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

## Development Templates Used

Based on task type, automatically selects:
- **Feature Development**: `~/.claude/workflows/cli-templates/prompts/development/feature.txt`
- **Component Creation**: `~/.claude/workflows/cli-templates/prompts/development/component.txt`
- **Code Refactoring**: `~/.claude/workflows/cli-templates/prompts/development/refactor.txt`
- **Bug Fixing**: `~/.claude/workflows/cli-templates/prompts/development/debugging.txt`
- **Test Generation**: `~/.claude/workflows/cli-templates/prompts/development/testing.txt`

## Error Handling

- **Task ID not found**: Lists available tasks
- **Pattern inference failure**: Uses generic `@{src/**/*}` pattern
- **Execution failure**: Attempts fallback with simplified context
- **File modification errors**: Reports specific file/permission issues
- **Missing @ patterns**: Auto-adds `@{**/*}` for comprehensive context

## Performance Features

- **Smart caching**: Frequently used pattern mappings
- **Progressive inference**: Precise → broad pattern fallback
- **Parallel execution**: When multiple contexts needed
- **Directory optimization**: Uses `--cd` flag when beneficial

## Integration Workflow

**Typical sequence:**
1. `workflow:plan` → Creates tasks
2. `/codex:execute IMPL-001` → Executes with YOLO permissions
3. Auto-updates workflow status and generates summaries
4. `workflow:review` → Final validation

**vs. `/codex:analyze`**: Execute performs analysis **and implementation**, analyze is read-only.

## Codex vs Gemini Execution

| Feature | Codex | Gemini |
|---------|-------|--------|
| File Loading | `@` patterns **required** | `--all-files` available |
| Automation Level | Full autonomous with `--full-auto` | Manual implementation |
| Command Structure | `codex exec "@{patterns}"` | `gemini --all-files -p` |
| Development Focus | Code generation & implementation | Analysis & planning |

For detailed patterns, syntax, and templates see:
**@~/.claude/workflows/tools-implementation-guide.md**