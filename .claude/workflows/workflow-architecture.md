# Workflow Architecture

## Overview

This document defines the complete workflow system architecture using a **JSON-only data model**, **marker-based session management**, and **unified file structure** with dynamic task decomposition.

## Core Architecture Principles

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

#### Detect Active Session
```bash
active_session=$(find .workflow -name ".active-*" | head -1)
if [ -n "$active_session" ]; then
  session_name=$(basename "$active_session" | sed 's/^\.active-//')
  echo "Active session: $session_name"
fi
```

#### Switch Session
```bash
find .workflow -name ".active-*" -delete && touch .workflow/.active-WFS-new-feature
```

### Individual Session Tracking
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

## Data Model

### JSON-Only Architecture
**JSON files (.task/IMPL-*.json) are the only authoritative source of task state. All markdown documents are read-only generated views.**

- **Task State**: Stored exclusively in JSON files
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
      },
      {
        "step": "analyze_patterns",
        "action": "Analyze existing auth patterns",
        "command": "bash(~/.claude/scripts/gemini-wrapper -p '@{src/auth/**/*} analyze authentication patterns using context: [auth_design_context]')",
        "output_to": "pattern_analysis",
        "on_error": "fail"
      },
      {
        "step": "implement",
        "action": "Implement JWT based on analysis",
        "command": "bash(codex --full-auto exec 'Implement JWT using analysis: [pattern_analysis] and dependency context: [auth_design_context]')",
        "on_error": "manual_intervention"
      }
    ],
    "implementation_approach": {
      "task_description": "Implement comprehensive JWT authentication system with secure token management and validation middleware. Reference [inherited.context] from parent task [parent] for architectural consistency. Apply [shared_context.auth_strategy] across authentication modules. Focus implementation on [focus_paths] directories following established patterns.",
      "modification_points": [
        "Add JWT token generation in login handler (src/auth/login.ts:handleLogin:75-120) following [shared_context.auth_strategy]",
        "Implement token validation middleware (src/middleware/auth.ts:validateToken) referencing [inherited.context] design patterns",
        "Add refresh token mechanism for session management using [shared_context] token strategy",
        "Update user authentication flow to support JWT tokens in [focus_paths] modules"
      ],
      "logic_flow": [
        "User login request → validate credentials → generate JWT token using [shared_context.auth_strategy] → store refresh token",
        "Protected route access → extract JWT from headers → validate token against [inherited.context] schema → allow/deny access",
        "Token expiry handling → use refresh token following [shared_context] strategy → generate new JWT → continue session",
        "Logout process → invalidate refresh token → clear client-side tokens in [focus_paths] components"
      ]
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

#### Example Flow Control
```json
{
  "pre_analysis": [
    {
      "step": "gather_dependencies",
      "action": "Load context from completed dependencies",
      "command": "bash(for dep in ${depends_on}; do cat .summaries/$dep-summary.md 2>/dev/null || echo \"No summary for $dep\"; done)",
      "output_to": "dependency_context",
      "on_error": "skip_optional"
    },
    {
      "step": "analyze_codebase",
      "action": "Understand current implementation",
      "command": "bash(gemini -p '@{[focus_paths]} analyze current patterns using context: [dependency_context]')",
      "output_to": "codebase_analysis",
      "on_error": "fail"
    },
    {
      "step": "implement",
      "action": "Execute implementation based on analysis",
      "command": "bash(codex --full-auto exec 'Implement based on: [codebase_analysis] with dependency context: [dependency_context]')",
      "on_error": "manual_intervention"
    }
  ],
  "implementation_approach": {
    "task_description": "Execute implementation following [codebase_analysis] patterns and [dependency_context] requirements",
    "modification_points": [
      "Update target files in [focus_paths] following established patterns",
      "Apply [dependency_context] insights to maintain consistency"
    ],
    "logic_flow": [
      "Analyze existing patterns → apply dependency context → implement changes → validate results"
    ]
  },
  "target_files": [
    "file:function:lines format for precise targeting"
  ]
}
```

#### Benefits of Flow Control
- **Universal Process Manager**: Handles any type of analysis or implementation flow
- **Context Accumulation**: Builds comprehensive context through step chain
- **Error Recovery**: Granular error handling at step level
- **Command Flexibility**: Supports any executable command or agent
- **Dependency Integration**: Automatic loading of prerequisite task results

### Hierarchical Task System
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

## File Structure

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
├── IMPL_PLAN.md                # Planning document (REQUIRED)
├── TODO_LIST.md                # Progress tracking (REQUIRED)
├── [.summaries/]               # Task completion summaries (created when tasks complete)
│   ├── IMPL-*.md              # Main task summaries
│   └── IMPL-*.*.md            # Subtask summaries
└── .task/                      # Task definitions (REQUIRED)
    ├── IMPL-*.json             # Main task definitions
    └── IMPL-*.*.json           # Subtask definitions (created dynamically)
```

#### Creation Strategy
- **Initial Setup**: Create only `workflow-session.json`, `IMPL_PLAN.md`, `TODO_LIST.md`, and `.task/` directory
- **On-Demand Creation**: Other directories created when first needed:
  - `.brainstorming/` → When brainstorming phase is initiated
  - `.chat/` → When CLI analysis commands are executed
  - `.summaries/` → When first task is completed
- **Dynamic Files**: Subtask JSON files created during task decomposition

### File Naming Conventions

#### Session Identifiers
**Format**: `WFS-[topic-slug]`
- Convert topic to lowercase with hyphens (e.g., "User Auth System" → `WFS-user-auth-system`)
- Add `-NNN` suffix only if conflicts exist (e.g., `WFS-payment-integration-002`)

#### Document Naming
- `workflow-session.json` - Session state (required)
- `IMPL_PLAN.md` - Planning document (required)
- `TODO_LIST.md` - Progress tracking (auto-generated when needed)
- Chat sessions: `chat-analysis-*.md`
- Task summaries: `IMPL-[task-id]-summary.md`

## Complexity Classification

### Task Complexity Rules
**Complexity is determined by task count and decomposition needs:**

| Complexity | Task Count | Hierarchy Depth | Decomposition Behavior |
|------------|------------|----------------|----------------------|
| **Simple** | <5 tasks | 1 level (IMPL-N) | Direct execution, minimal decomposition |
| **Medium** | 5-15 tasks | 2 levels (IMPL-N.M) | Moderate decomposition, context coordination |
| **Complex** | >15 tasks | 2 levels (IMPL-N.M) | Frequent decomposition, multi-agent orchestration |

### Simple Workflows
**Characteristics**: Direct implementation tasks with clear, limited scope
- **Examples**: Bug fixes, small feature additions, configuration changes
- **Task Decomposition**: Usually single-level tasks, minimal breakdown needed
- **Agent Coordination**: Direct execution without complex orchestration

### Medium Workflows  
**Characteristics**: Feature implementation requiring moderate task breakdown
- **Examples**: New features, API endpoints with integration, database schema changes
- **Task Decomposition**: Two-level hierarchy when decomposition is needed
- **Agent Coordination**: Context coordination between related tasks

### Complex Workflows
**Characteristics**: System-wide changes requiring detailed decomposition
- **Examples**: Major features, architecture refactoring, security implementations, multi-service deployments
- **Task Decomposition**: Frequent use of two-level hierarchy with dynamic subtask creation
- **Agent Coordination**: Multi-agent orchestration with deep context analysis

### Automatic Assessment & Upgrades
- **During Creation**: System evaluates requirements and assigns complexity
- **During Execution**: Can upgrade (Simple→Medium→Complex) but never downgrade
- **Override Allowed**: Users can specify higher complexity manually

## Document Templates

### IMPL_PLAN.md
Generated based on task complexity and requirements. Contains overview, requirements, and task structure.

## Notes for Future Tasks
[Any important considerations, limitations, or follow-up items]

#### Summary Document Purpose
- **Context Inheritance**: Provides structured context for dependent tasks
- **Integration Guidance**: Offers clear integration points and usage instructions
- **Quality Assurance**: Documents testing and validation performed
- **Decision History**: Preserves rationale for implementation choices
- **Dependency Chain**: Enables automatic context accumulation through task dependencies

### TODO_LIST.md Template
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

## Agent Integration

### Agent Assignment
Based on task type and title keywords:
- **Planning tasks** → planning-agent
- **Implementation** → code-developer  
- **Testing** → code-review-test-agent
- **Review** → review-agent

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


## Data Operations

### Session Initialization
```bash
# Create minimal required structure
mkdir -p .workflow/WFS-topic-slug/.task
echo '{"session_id":"WFS-topic-slug",...}' > .workflow/WFS-topic-slug/workflow-session.json
echo '# Implementation Plan' > .workflow/WFS-topic-slug/IMPL_PLAN.md
echo '# Tasks' > .workflow/WFS-topic-slug/TODO_LIST.md
```

### Task Creation
```bash
echo '{"id":"IMPL-1","title":"New task",...}' > .task/IMPL-1.json
```

### Directory Creation (On-Demand)
```bash
# Create directories only when needed
mkdir -p .brainstorming     # When brainstorming is initiated
mkdir -p .chat              # When analysis commands are run
mkdir -p .summaries         # When first task completes
```

### Task Updates
```bash
jq '.status = "active"' .task/IMPL-1.json > temp && mv temp .task/IMPL-1.json
```

### Document Generation
```bash
# Generate TODO_LIST.md from current JSON state
generate_todo_list_from_json .task/
```

## Validation and Error Handling

### Task Integrity Rules
1. **ID Uniqueness**: All task IDs must be unique
2. **Hierarchical Format**: Must follow IMPL-N[.M] pattern (maximum 2 levels)
3. **Parent References**: All parent IDs must exist as JSON files
4. **Depth Limits**: Maximum 2 levels deep
5. **Status Consistency**: Status values from defined enumeration
6. **Required Fields**: All 5 core fields must be present (id, title, status, meta, context, flow_control)
7. **Focus Paths Structure**: context.focus_paths array must contain valid project paths
8. **Flow Control Format**: flow_control.pre_analysis must be array with step, action, command fields
9. **Dependency Integrity**: All context.depends_on task IDs must exist as JSON files

### Session Consistency Checks
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

### Recovery Strategies
- **Missing Session Directory**: Remove orphaned active marker
- **Multiple Active Markers**: Keep newest, remove others
- **Corrupted Session File**: Recreate from template
- **Broken Task Hierarchy**: Reconstruct parent-child relationships

