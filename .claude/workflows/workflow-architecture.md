# Workflow Architecture

## Overview & Core Principles

This document defines a streamlined workflow system architecture featuring **JSON-only data model**, **marker-based session management**, and **unified file structure** with dynamic task decomposition.

### Design Philosophy
- **JSON-first data model** - JSON files are single source of truth; markdown is generated views
- **Marker-based sessions** - Ultra-simple active session tracking via marker files
- **Unified structure** - Same file template for all workflows, created on-demand
- **Dynamic decomposition** - Tasks break down as needed during execution
- **On-demand creation** - Files and directories created only when required
- **Agent autonomy** - Complete context preserved for independent execution

## Data Architecture

### JSON-Only Data Model
**Core Principle**: JSON files are the authoritative source; markdown documents are read-only generated views.

- **Task State**: Stored exclusively in `.task/IMPL-*.json` files
- **Documents**: Generated on-demand from JSON data
- **No Synchronization**: Eliminates bidirectional sync complexity
- **Performance**: Direct JSON access without parsing overhead

### Task JSON Schema
All task files use this simplified 5-field schema:

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
    }
  },

  "flow_control": {
    "pre_analysis": [
      {
        "step": "gather_context",
        "action": "Read dependency summaries",
        "command": "bash(cat .workflow/*/summaries/IMPL-1.1-summary.md)",
        "output_to": "auth_design_context",
        "on_error": "skip_optional"
      }
    ],
    "implementation_approach": {
      "task_description": "Implement comprehensive JWT authentication system...",
      "modification_points": ["Add JWT token generation...", "..."],
      "logic_flow": ["User login request → validate credentials...", "..."]
    },
    "target_files": [
      "src/auth/login.ts:handleLogin:75-120",
      "src/middleware/auth.ts:validateToken"
    ]
  }
}
```

### Focus Paths Field Details

The **focus_paths** field within **context** specifies concrete project paths relevant to the task implementation:

#### Focus Paths Format
- **Array of strings**: `["folder1", "folder2", "specific_file.ts"]`
- **Concrete paths**: Use actual directory/file names without wildcards
- **Mixed types**: Can include both directories and specific files
- **Relative paths**: From project root (e.g., `src/auth`, not `./src/auth`)

#### Path Selection Strategy
- **Directories**: Include relevant module directories (e.g., `src/auth`, `tests/auth`)
- **Specific files**: Include files explicitly mentioned in requirements (e.g., `config/auth.json`)
- **Avoid wildcards**: Use concrete paths discovered via `get_modules_by_depth.sh`
- **Focus scope**: Only include paths directly related to task implementation

#### Examples
```json
// Authentication system task
"focus_paths": ["src/auth", "tests/auth", "config/auth.json", "src/middleware/auth.ts"]

// UI component task
"focus_paths": ["src/components/Button", "src/styles", "tests/components"]

// Database migration task
"focus_paths": ["migrations", "src/models", "config/database.json"]
```

### Flow Control Field Details

The **flow_control** field serves as a universal process manager for task execution with comprehensive flow orchestration:

#### pre_analysis Array - Sequential Process Steps
Each step contains:
- **step**: Unique identifier for the step
- **action**: Human-readable description of what the step does
- **command**: Executable command wrapped in `bash()` with embedded context variables (e.g., `bash(command with [variable_name])`)
- **output_to**: Variable name to store step results (optional for final steps)
- **on_error**: Error handling strategy (`skip_optional`, `fail`, `retry_once`, `manual_intervention`)
- **success_criteria**: Optional validation criteria (e.g., `exit_code:0`)

#### Context Flow Management
- **Variable Accumulation**: Each step can reference outputs from previous steps via `[variable_name]`
- **Context Inheritance**: Steps can use dependency summaries and parent task context
- **Pipeline Processing**: Results flow sequentially through the analysis chain

#### Variable Reference Format
- **Context Variables**: Use `[variable_name]` to reference step outputs
- **Task Properties**: Use `[depends_on]`, `[focus_paths]` to reference task JSON properties
- **Bash Compatibility**: Avoids conflicts with bash `${}` variable expansion

#### Command Types Supported
- **CLI Analysis**: `bash(~/.claude/scripts/gemini-wrapper -p 'prompt')`
- **Agent Execution**: `bash(codex --full-auto exec 'task description')`
- **Shell Commands**: `bash(cat)`, `bash(grep)`, `bash(find)`, `bash(custom scripts)`
- **Context Processing**: `bash(file reading)`, `bash(dependency loading)`, `bash(context merging)`

#### Error Handling Strategies
- **skip_optional**: Continue execution, step result is empty
- **fail**: Stop execution, mark task as failed
- **retry_once**: Retry step once, then fail if still unsuccessful
- **manual_intervention**: Pause execution for manual review

#### Example Flow Control Patterns

**Pattern 1: Multi-Step Analysis**
```json
"pre_analysis": [
  {
    "step": "gather_dependencies",
    "command": "bash(for dep in ${depends_on}; do cat .summaries/$dep-summary.md; done)",
    "output_to": "dependency_context"
  },
  {
    "step": "analyze_codebase",
    "command": "bash(gemini -p '@{[focus_paths]} using context: [dependency_context]')",
    "output_to": "codebase_analysis"
  }
]
```

**Pattern 2: Direct Implementation**
```json
"pre_analysis": [
  {
    "step": "implement",
    "command": "bash(codex --full-auto exec 'Implement [title] in [focus_paths]')"
  }
]
```

#### Benefits of Flow Control
- **Universal Process Manager**: Handles any type of analysis or implementation flow
- **Context Accumulation**: Builds comprehensive context through step chain
- **Error Recovery**: Granular error handling at step level
- **Command Flexibility**: Supports any executable command or agent
- **Dependency Integration**: Automatic loading of prerequisite task results

### Task Hierarchy
**Structure**: Maximum 2 levels (IMPL-N.M format)

```
IMPL-1              # Main task
IMPL-1.1            # Subtask (dynamically created)
IMPL-1.2            # Another subtask
IMPL-2              # Another main task
IMPL-2.1            # Subtask (dynamically created)
```

**Rules**:
- **Container tasks**: Parent tasks with subtasks (cannot execute directly)
- **Leaf tasks**: Only executable tasks
- **Status inheritance**: Parent status derived from subtask completion

## Session Management

### Active Session Marker System
**Ultra-Simple Tracking**: `.workflow/.active-[session-name]`

```bash
.workflow/
├── WFS-oauth-integration/         # Session directory (paused)
├── WFS-user-profile/             # Session directory (paused)
├── WFS-bug-fix-123/              # Session directory (completed)
└── .active-WFS-user-profile      # Marker file (active session)
```

**Benefits**:
- **Zero Parsing**: File existence check is atomic
- **Atomic Operations**: File creation/deletion is naturally atomic
- **Visual Discovery**: `ls .workflow/.active-*` shows active session
- **Simple Switching**: Delete old + create new marker

### Session Operations

```bash
# Detect active session
active_session=$(find .workflow -name ".active-*" | head -1)
if [ -n "$active_session" ]; then
  session_name=$(basename "$active_session" | sed 's/^\.active-//')
  echo "Active session: $session_name"
fi

# Switch session
find .workflow -name ".active-*" -delete && touch .workflow/.active-WFS-new-feature
```

### Session State
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

## File Organization

### Unified Structure
All workflows use the same structure regardless of complexity. **Files created on-demand only.**

```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # Session state (REQUIRED)
├── IMPL_PLAN.md                # Planning document (REQUIRED)
├── TODO_LIST.md                # Progress tracking (REQUIRED)
├── .task/                      # Task definitions (REQUIRED)
│   ├── IMPL-*.json             # Main task definitions
│   └── IMPL-*.*.json           # Subtask definitions (dynamic)
├── [.brainstorming/]           # Brainstorming phase (on-demand)
├── [.chat/]                    # CLI sessions (on-demand)
│   ├── chat-*.md              # Saved chat sessions
│   └── analysis-*.md          # Analysis results
└── [.summaries/]               # Task summaries (on-demand)
    ├── IMPL-*.md              # Main task summaries
    └── IMPL-*.*.md            # Subtask summaries
```

### Creation Strategy
- **Initial**: Only `workflow-session.json`, `IMPL_PLAN.md`, `TODO_LIST.md`, `.task/`
- **On-Demand**:
  - `.brainstorming/` → When brainstorming initiated
  - `.chat/` → When analysis commands executed
  - `.summaries/` → When first task completed

### Naming Conventions
- **Sessions**: `WFS-[topic-slug]` (lowercase with hyphens)
- **Conflicts**: Add `-NNN` suffix if needed
- **Documents**: Standard names (`workflow-session.json`, `IMPL_PLAN.md`, etc.)
- **Chat**: `chat-analysis-*.md`
- **Summaries**: `IMPL-[task-id]-summary.md`

## Workflow Classification

### Complexity Types
**Based on task count and decomposition needs:**

| Type | Tasks | Depth | Behavior |
|------|-------|-------|----------|
| **Simple** | ≤5 | 1 level | Direct execution, minimal decomposition |
| **Medium** | 6-10 | 2 levels | Moderate decomposition, context coordination |
| **Over-scope** | >10 | Re-scope | Requires project re-scoping into iterations |

### Characteristics

**Simple**: Bug fixes, small features, config changes
- Single-level tasks, direct execution, ≤5 tasks

**Medium**: New features, API endpoints, schema changes
- Two-level hierarchy, context coordination, 6-10 tasks

**Over-scope**: Major features exceeding 10 tasks
- Requires re-scoping into smaller iterations, never >10 tasks

### Assessment Rules
- **Creation**: System evaluates and assigns complexity
- **10-task limit**: Hard limit enforced - exceeding requires re-scoping
- **Execution**: Can upgrade (Simple→Medium→Over-scope), triggers re-scoping
- **Override**: Users can manually specify complexity within 10-task limit

## Task Execution Framework

### Agent Integration

**Assignment Rules** (based on task type/keywords):
- **Planning** → planning-agent
- **Implementation** → code-developer
- **Testing** → code-review-test-agent
- **Review** → review-agent

**Execution Context** (agents receive):
```json
{
  "task": { /* complete task JSON */ },
  "workflow": {
    "session": "WFS-user-auth",
    "phase": "IMPLEMENT"
  }
}
```
## Operations Guide

### Basic Operations

```bash
# Session initialization
mkdir -p .workflow/WFS-topic-slug/.task
echo '{"session_id":"WFS-topic-slug",...}' > .workflow/WFS-topic-slug/workflow-session.json
echo '# Implementation Plan' > .workflow/WFS-topic-slug/IMPL_PLAN.md
echo '# Tasks' > .workflow/WFS-topic-slug/TODO_LIST.md

# Task creation
echo '{"id":"IMPL-1","title":"New task",...}' > .task/IMPL-1.json

# Task updates
jq '.status = "active"' .task/IMPL-1.json > temp && mv temp .task/IMPL-1.json

# Document generation
generate_todo_list_from_json .task/
```

### Validation Rules
1. **ID Uniqueness**: All task IDs must be unique
2. **Format**: IMPL-N[.M] pattern (max 2 levels)
3. **References**: Parent IDs must exist as JSON files
4. **Fields**: All 5 core fields required (id, title, status, meta, context, flow_control)
5. **Paths**: context.focus_paths must contain valid project paths
6. **Dependencies**: context.depends_on task IDs must exist

### Error Recovery
- **Missing Session**: Remove orphaned active marker
- **Multiple Active**: Keep newest, remove others
- **Corrupted Session**: Recreate from template
- **Broken Hierarchy**: Reconstruct parent-child relationships

```bash
# Session consistency check
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

## Reference Templates

### Integration Points
- **[Component Name]**: [how to use/integrate]
- **[API Endpoint]**: [usage details]
- **[Configuration]**: [location and format]

## Testing Verification
- [Test type]: [location/results]
- [Validation]: [confirmation method]
- [Quality checks]: [what was verified]

## Notes for Future Tasks
[Any important considerations, limitations, or follow-up items]
```
### TODO List (TODO_LIST.md)
```markdown
# Tasks: [Session Topic]

## Task Progress
▸ **IMPL-001**: [Main Task Group] → [📋](./.task/IMPL-001.json)
  - [ ] **IMPL-001.1**: [Subtask] → [📋](./.task/IMPL-001.1.json)
  - [x] **IMPL-001.2**: [Subtask] → [📋](./.task/IMPL-001.2.json) | [✅](./.summaries/IMPL-001.2.md)

- [x] **IMPL-002**: [Simple Task] → [📋](./.task/IMPL-002.json) | [✅](./.summaries/IMPL-002.md)

▸ **IMPL-003**: [Main Task Group] → [📋](./.task/IMPL-003.json)
  - [ ] **IMPL-003.1**: [Subtask] → [📋](./.task/IMPL-003.1.json)
  - [ ] **IMPL-003.2**: [Subtask] → [📋](./.task/IMPL-003.2.json)

## Status Legend
- `▸` = Container task (has subtasks)
- `- [ ]` = Pending leaf task
- `- [x]` = Completed leaf task
- Maximum 2 levels: Main tasks and subtasks only

## Notes
[Optional notes]
```

---

**System Design**: Unified workflow architecture featuring ultra-fast session management, JSON-only data model, and consistent file structure across all workflow types.