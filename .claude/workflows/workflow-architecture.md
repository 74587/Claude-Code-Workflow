# Workflow Architecture

## Overview

This document defines the complete workflow system architecture using a **JSON-only data model**, **marker-based session management**, and **unified file structure** with dynamic task decomposition.

## Core Architecture

### JSON-Only Data Model
**JSON files (.task/IMPL-*.json) are the only authoritative source of task state. All markdown documents are read-only generated views.**

- **Task State**: Stored exclusively in JSON files
- **Documents**: Generated on-demand from JSON data
- **No Synchronization**: Eliminates bidirectional sync complexity
- **Performance**: Direct JSON access without parsing overhead

### Key Design Decisions
- **JSON files are the single source of truth** - All markdown documents are read-only generated views
- **Marker files for session tracking** - Ultra-simple active session management
- **Unified file structure definition** - Same structure template for all workflows, created on-demand
- **Dynamic task decomposition** - Subtasks created as needed during execution
- **On-demand file creation** - Directories and files created only when required
- **Agent-agnostic task definitions** - Complete context preserved for autonomous execution

## Session Management

### Active Session Marker System
**Ultra-Simple Active Tracking**: `.workflow/.active-[session-name]`

```bash
.workflow/
├── WFS-oauth-integration/         # Session directory (paused)
├── WFS-user-profile/             # Session directory (paused)
├── WFS-bug-fix-123/              # Session directory (completed)
└── .active-WFS-user-profile      # Marker file (indicates active session)
```

**Marker File Benefits**:
- **Zero Parsing**: File existence check is atomic and instant
- **Atomic Operations**: File creation/deletion is naturally atomic
- **Visual Discovery**: `ls .workflow/.active-*` shows active session immediately
- **Simple Switching**: Delete old marker + create new marker = session switch

### Session Operations

#### Detect Active Session(s)
```bash
active_sessions=$(find .workflow -name ".active-*" 2>/dev/null)
count=$(echo "$active_sessions" | wc -l)

if [ -z "$active_sessions" ]; then
  echo "No active session"
elif [ "$count" -eq 1 ]; then
  session_name=$(basename "$active_sessions" | sed 's/^\.active-//')
  echo "Active session: $session_name"
else
  echo "Multiple active sessions found:"
  echo "$active_sessions" | while read marker; do
    session=$(basename "$marker" | sed 's/^\.active-//')
    echo "  - $session"
  done
  echo "Please specify which session to work with"
fi
```

#### Switch Session
```bash
find .workflow -name ".active-*" -delete && touch .workflow/.active-WFS-new-feature
```

### Session State Tracking
Each session directory contains `workflow-session.json`:

```json
{
  "session_id": "WFS-[topic-slug]",
  "project": "feature description",
  "type": "simple|medium|complex",
  "current_phase": "PLAN|IMPLEMENT|REVIEW",
  "status": "active|paused|completed",
  "progress": {
    "completed_phases": ["PLAN"],
    "current_tasks": ["IMPL-1", "IMPL-2"]
  }
}
```

## Task System

### Hierarchical Task Structure
**Maximum Depth**: 2 levels (IMPL-N.M format)

```
IMPL-1              # Main task
IMPL-1.1            # Subtask of IMPL-1 (dynamically created)
IMPL-1.2            # Another subtask of IMPL-1
IMPL-2              # Another main task
IMPL-2.1            # Subtask of IMPL-2 (dynamically created)
```

**Task Status Rules**:
- **Container tasks**: Parent tasks with subtasks (cannot be directly executed)
- **Leaf tasks**: Only these can be executed directly
- **Status inheritance**: Parent status derived from subtask completion

### Enhanced Task JSON Schema
All task files use this unified 5-field schema with optional artifacts enhancement:

```json
{
  "id": "IMPL-1.2",
  "title": "Implement JWT authentication",
  "status": "pending|active|completed|blocked|container",

  "meta": {
    "type": "feature|bugfix|refactor|test|docs",
    "agent": "code-developer|planning-agent|code-review-test-agent"
  },

  "context": {
    "requirements": ["JWT authentication", "OAuth2 support"],
    "focus_paths": ["src/auth", "tests/auth", "config/auth.json"],
    "acceptance": ["JWT validation works", "OAuth flow complete"],
    "parent": "IMPL-1",
    "depends_on": ["IMPL-1.1"],
    "inherited": {
      "from": "IMPL-1",
      "context": ["Authentication system design completed"]
    },
    "shared_context": {
      "auth_strategy": "JWT with refresh tokens"
    },
    "artifacts": [
      {
        "type": "synthesis_specification",
        "source": "brainstorm_synthesis",
        "path": ".workflow/WFS-session/.brainstorming/synthesis-specification.md",
        "priority": "highest",
        "contains": "complete_integrated_specification"
      }
    ]
  },

  "flow_control": {
    "pre_analysis": [
      {
        "step": "check_patterns",
        "action": "Analyze existing patterns",
        "command": "bash(rg 'auth' [focus_paths] | head -10)",
        "output_to": "patterns"
      },
      {
        "step": "analyze_architecture",
        "action": "Review system architecture",
        "command": "~/.claude/scripts/gemini-wrapper -p \"analyze patterns: [patterns]\"",
        "output_to": "design"
      },
      {
        "step": "check_deps",
        "action": "Check dependencies",
        "command": "bash(echo [depends_on] | xargs cat)",
        "output_to": "context"
      }
    ],
    "implementation_approach": {
      "task_description": "Implement JWT authentication following [design]",
      "modification_points": [
        "Add JWT generation using [parent] patterns",
        "Implement validation middleware from [context]"
      ],
      "logic_flow": [
        "User login → validate with [inherited] → generate JWT",
        "Protected route → extract JWT → validate using [shared] rules"
      ]
    },
    "target_files": [
      "src/auth/login.ts:handleLogin:75-120",
      "src/middleware/auth.ts:validateToken"
    ]
  }
}
```

### Focus Paths & Context Management

#### Focus Paths Format
The **focus_paths** field specifies concrete project paths for task implementation:
- **Array of strings**: `["folder1", "folder2", "specific_file.ts"]`
- **Concrete paths**: Use actual directory/file names without wildcards
- **Mixed types**: Can include both directories and specific files
- **Relative paths**: From project root (e.g., `src/auth`, not `./src/auth`)

#### Artifacts Field ⚠️ NEW FIELD
Optional field referencing brainstorming outputs for task execution:

```json
"artifacts": [
  {
    "type": "synthesis_specification|topic_framework|individual_role_analysis",
    "source": "brainstorm_synthesis|brainstorm_framework|brainstorm_roles",
    "path": ".workflow/WFS-session/.brainstorming/document.md",
    "priority": "highest|high|medium|low"
  }
]
```

**Types & Priority**: synthesis_specification (highest) → topic_framework (medium) → individual_role_analysis (low)

#### Flow Control Configuration
The **flow_control** field manages task execution with two main components:

**pre_analysis** - Context gathering phase:
- **Flexible commands**: Supports multiple tool types (see Tool Reference below)
- **Step structure**: Each step has `step`, `action`, `command` fields
- **Variable accumulation**: Steps can reference previous outputs via `[variable_name]`
- **Error handling**: `skip_optional`, `fail`, `retry_once`, `manual_intervention`

**implementation_approach** - Implementation definition:
- **task_description**: Comprehensive implementation description
- **modification_points**: Specific code modification targets
- **logic_flow**: Business logic execution sequence
- **target_files**: Target file list in `file:function:lines` format

#### Tool Reference
**Command Types Available**:
- **Gemini CLI**: `~/.claude/scripts/gemini-wrapper -p "prompt"`
- **Codex CLI**: `codex --full-auto exec "task" -s danger-full-access`
- **Built-in Tools**: `grep(pattern)`, `glob(pattern)`, `search(query)`
- **Bash Commands**: `bash(rg 'pattern' src/)`, `bash(find . -name "*.ts")`

#### Variable System & Context Flow
**Flow Control Variables**: Use `[variable_name]` format for dynamic content:
- **Step outputs**: `[step_output_name]` - Reference any pre_analysis step output
- **Task properties**: `[task_property]` - Reference any task context field
- **Previous results**: `[analysis_result]` - Reference accumulated context
- **Commands**: All commands wrapped with appropriate error handling

**Context Accumulation Process**:
1. **Structure Analysis**: `get_modules_by_depth.sh` → project hierarchy
2. **Pattern Analysis**: Tool-specific commands → existing patterns
3. **Dependency Mapping**: Previous task summaries → inheritance context
4. **Task Context Generation**: Combined analysis → task.context fields

**Context Inheritance Rules**:
- **Parent → Child**: Container tasks pass context via `context.inherited`
- **Dependency → Dependent**: Previous task summaries via `context.depends_on`
- **Session → Task**: Global session context included in all tasks
- **Module → Feature**: Module patterns inform feature implementation

### Task Validation Rules
1. **ID Uniqueness**: All task IDs must be unique
2. **Hierarchical Format**: Must follow IMPL-N[.M] pattern (maximum 2 levels)
3. **Parent References**: All parent IDs must exist as JSON files
4. **Status Consistency**: Status values from defined enumeration
5. **Required Fields**: All 5 core fields must be present
6. **Focus Paths Structure**: context.focus_paths must contain concrete paths (no wildcards)
7. **Flow Control Format**: pre_analysis must be array with required fields
8. **Dependency Integrity**: All depends_on task IDs must exist as JSON files
9. **Artifacts Structure**: context.artifacts (optional) must use valid type, priority, and path format

## Workflow Structure

### Unified File Structure
All workflows use the same file structure definition regardless of complexity. **Directories and files are created on-demand as needed**, not all at once during initialization.

#### Complete Structure Reference
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # Session metadata and state (REQUIRED)
├── [.brainstorming/]           # Optional brainstorming phase (created when needed)
├── [.chat/]                    # CLI interaction sessions (created when analysis is run)
│   ├── chat-*.md              # Saved chat sessions
│   └── analysis-*.md          # Analysis results
├── [.process/]                 # Planning analysis results (created by /workflow:plan)
│   └── ANALYSIS_RESULTS.md    # Analysis results and planning artifacts
├── IMPL_PLAN.md                # Planning document (REQUIRED)
├── TODO_LIST.md                # Progress tracking (REQUIRED)
├── [.summaries/]               # Task completion summaries (created when tasks complete)
│   ├── IMPL-*-summary.md      # Main task summaries
│   └── IMPL-*.*-summary.md    # Subtask summaries
└── .task/                      # Task definitions (REQUIRED)
    ├── IMPL-*.json             # Main task definitions
    └── IMPL-*.*.json           # Subtask definitions (created dynamically)
```

#### Creation Strategy
- **Initial Setup**: Create only `workflow-session.json`, `IMPL_PLAN.md`, `TODO_LIST.md`, and `.task/` directory
- **On-Demand Creation**: Other directories created when first needed
- **Dynamic Files**: Subtask JSON files created during task decomposition

### File Naming Conventions

#### Session Identifiers
**Format**: `WFS-[topic-slug]`

**WFS Prefix Meaning**:
- `WFS` = **W**ork**F**low **S**ession
- Identifies directories as workflow session containers
- Distinguishes workflow sessions from other project directories

**Naming Rules**:
- Convert topic to lowercase with hyphens (e.g., "User Auth System" → `WFS-user-auth-system`)
- Add `-NNN` suffix only if conflicts exist (e.g., `WFS-payment-integration-002`)
- Maximum length: 50 characters including WFS- prefix

#### Document Naming
- `workflow-session.json` - Session state (required)
- `IMPL_PLAN.md` - Planning document (required)
- `TODO_LIST.md` - Progress tracking (auto-generated when needed)
- Chat sessions: `chat-analysis-*.md`
- Task summaries: `IMPL-[task-id]-summary.md`

### Document Templates

#### TODO_LIST.md Template
```markdown
# Tasks: [Session Topic]

## Task Progress
▸ **IMPL-001**: [Main Task Group] → [📋](./.task/IMPL-001.json)
  - [ ] **IMPL-001.1**: [Subtask] → [📋](./.task/IMPL-001.1.json)
  - [x] **IMPL-001.2**: [Subtask] → [📋](./.task/IMPL-001.2.json) | [✅](./.summaries/IMPL-001.2-summary.md)

- [x] **IMPL-002**: [Simple Task] → [📋](./.task/IMPL-002.json) | [✅](./.summaries/IMPL-002-summary.md)

## Status Legend
- `▸` = Container task (has subtasks)
- `- [ ]` = Pending leaf task
- `- [x]` = Completed leaf task
- Maximum 2 levels: Main tasks and subtasks only
```

## Operations Guide

### Session Management
```bash
# Create minimal required structure
mkdir -p .workflow/WFS-topic-slug/.task
echo '{"session_id":"WFS-topic-slug",...}' > .workflow/WFS-topic-slug/workflow-session.json
echo '# Implementation Plan' > .workflow/WFS-topic-slug/IMPL_PLAN.md
echo '# Tasks' > .workflow/WFS-topic-slug/TODO_LIST.md
```

### Task Operations
```bash
# Create task
echo '{"id":"IMPL-1","title":"New task",...}' > .task/IMPL-1.json

# Update task status
jq '.status = "active"' .task/IMPL-1.json > temp && mv temp .task/IMPL-1.json

# Generate TODO list from JSON state
generate_todo_list_from_json .task/
```

### Directory Creation (On-Demand)
```bash
mkdir -p .brainstorming     # When brainstorming is initiated
mkdir -p .chat              # When analysis commands are run
mkdir -p .summaries         # When first task completes
```

### Session Consistency Checks & Recovery
```bash
# Validate active session integrity
active_marker=$(find .workflow -name ".active-*" | head -1)
if [ -n "$active_marker" ]; then
  session_name=$(basename "$active_marker" | sed 's/^\.active-//')
  session_dir=".workflow/$session_name"
  if [ ! -d "$session_dir" ]; then
    echo "⚠️ Orphaned active marker, removing..."
    rm "$active_marker"
  fi
fi
```

**Recovery Strategies**:
- **Missing Session Directory**: Remove orphaned active marker
- **Multiple Active Markers**: Keep newest, remove others
- **Corrupted Session File**: Recreate from template
- **Broken Task Hierarchy**: Reconstruct parent-child relationships

## Complexity Classification

### Task Complexity Rules
**Complexity is determined by task count and decomposition needs:**

| Complexity | Task Count | Hierarchy Depth | Decomposition Behavior |
|------------|------------|----------------|----------------------|
| **Simple** | <5 tasks | 1 level (IMPL-N) | Direct execution, minimal decomposition |
| **Medium** | 5-15 tasks | 2 levels (IMPL-N.M) | Moderate decomposition, context coordination |
| **Complex** | >15 tasks | 2 levels (IMPL-N.M) | Frequent decomposition, multi-agent orchestration |

### Workflow Characteristics & Tool Guidance

#### Simple Workflows
- **Examples**: Bug fixes, small feature additions, configuration changes
- **Task Decomposition**: Usually single-level tasks, minimal breakdown needed
- **Agent Coordination**: Direct execution without complex orchestration
- **Tool Strategy**: `bash()` commands, `grep()` for pattern matching

#### Medium Workflows
- **Examples**: New features, API endpoints with integration, database schema changes
- **Task Decomposition**: Two-level hierarchy when decomposition is needed
- **Agent Coordination**: Context coordination between related tasks
- **Tool Strategy**: `gemini-wrapper` for pattern analysis, `codex --full-auto` for implementation

#### Complex Workflows
- **Examples**: Major features, architecture refactoring, security implementations, multi-service deployments
- **Task Decomposition**: Frequent use of two-level hierarchy with dynamic subtask creation
- **Agent Coordination**: Multi-agent orchestration with deep context analysis
- **Tool Strategy**: `gemini-wrapper` for architecture analysis, `codex --full-auto` for complex problem solving, `bash()` commands for flexible analysis

### Assessment & Upgrades
- **During Creation**: System evaluates requirements and assigns complexity
- **During Execution**: Can upgrade (Simple→Medium→Complex) but never downgrade
- **Override Allowed**: Users can specify higher complexity manually

## Agent Integration

### Agent Assignment
Based on task type and title keywords:
- **Planning tasks** → @planning-agent
- **Implementation** → @code-developer
- **Testing** → @code-review-test-agent
- **Review** → @review-agent

### Execution Context
Agents receive complete task JSON plus workflow context:
```json
{
  "task": { /* complete task JSON */ },
  "workflow": {
    "session": "WFS-user-auth",
    "phase": "IMPLEMENT"
  }
}
```

