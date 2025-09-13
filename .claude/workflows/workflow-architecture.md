# Workflow Architecture

## Overview

This document defines the complete workflow system architecture using a **JSON-only data model**, **marker-based session management**, and **unified file structure** with dynamic task decomposition.

## Core Architecture Principles

### Key Design Decisions
- **JSON files are the single source of truth** - All markdown documents are read-only generated views
- **Marker files for session tracking** - Ultra-simple active session management
- **Unified file structure** - Same structure for all workflows regardless of complexity
- **Dynamic task decomposition** - Subtasks created as needed during execution
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
active_session=$(ls .workflow/.active-* 2>/dev/null | head -1)
if [ -n "$active_session" ]; then
  session_name=$(basename "$active_session" | sed 's/^\.active-//')
  echo "Active session: $session_name"
fi
```

#### Switch Session
```bash
rm .workflow/.active-* 2>/dev/null && touch .workflow/.active-WFS-new-feature
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
    "current_tasks": ["impl-1", "impl-2"]
  }
}
```

## Data Model

### JSON-Only Architecture
**JSON files (.task/impl-*.json) are the only authoritative source of task state. All markdown documents are read-only generated views.**

- **Task State**: Stored exclusively in JSON files
- **Documents**: Generated on-demand from JSON data
- **No Synchronization**: Eliminates bidirectional sync complexity
- **Performance**: Direct JSON access without parsing overhead

### Task JSON Schema
All task files use this 10-field schema:

```json
{
  "id": "impl-1",
  "title": "Build authentication module",
  "status": "pending|active|completed|blocked|container",
  "type": "feature|bugfix|refactor|test|docs", 
  "agent": "code-developer|planning-agent|code-review-test-agent",
  "paths": "src/auth;tests/auth;config/auth.json;src/middleware/auth.ts",
  
  "context": {
    "requirements": ["JWT authentication", "OAuth2 support"],
    "scope": ["src/auth/*", "tests/auth/*"],
    "acceptance": ["Module handles JWT tokens", "OAuth2 flow implemented"],
    "inherited_from": "WFS-user-auth"
  },
  
  "relations": {
    "parent": null,
    "subtasks": ["impl-1.1", "impl-1.2"],
    "dependencies": ["impl-0"]
  },
  
  "execution": {
    "attempts": 0,
    "last_attempt": null
  },
  
  "implementation": {
    "files": [
      {
        "path": "src/auth/login.ts",
        "location": {
          "function": "handleLogin",
          "lines": "75-120",
          "description": "Core logic of login handler function"
        },
        "original_code": "// Related code not provided, requires gemini analysis",
        "modifications": {
          "current_state": "Currently using simple password validation",
          "proposed_changes": [
            "Add JWT token generation logic",
            "Integrate OAuth2 authentication flow", 
            "Enhance error handling mechanisms"
          ],
          "logic_flow": [
            "validateInput() ───► checkCredentials()",
            "◊─── if valid ───► generateJWT() ───► return token",
            "◊─── if OAuth ───► redirectToProvider() ───► handleCallback()",
            "◊─── if error ───► logError() ───► return errorResponse"
          ],
          "reason": "Meet JWT and OAuth2 authentication requirements, enhance security",
          "expected_outcome": "Flexible login system supporting multiple authentication methods"
        }
      }
    ],
    "context_notes": {
      "dependencies": ["jsonwebtoken", "passport-oauth2"],
      "affected_modules": ["user-profile", "session-manager"],
      "risks": [
        "Need to update authentication middleware for all API endpoints",
        "May affect existing user sessions",
        "Require database migration to add token storage table"
      ],
      "performance_considerations": "JWT validation will add approximately 5ms latency",
      "error_handling": "Ensure sensitive information is not leaked in error responses"
    },
    "analysis_source": "manual|gemini|codex|auto-detected"
  }
}
```

### Paths Field Details

The **paths** field specifies concrete project paths (folders and files) relevant to the task implementation:

#### Path Format
- **Semicolon-separated list**: `"folder1;folder2;specific_file.ts"`
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
"paths": "src/auth;tests/auth;config/auth.json;src/middleware/auth.ts"

// UI component task
"paths": "src/components/Button;src/styles;tests/components"

// Database migration task  
"paths": "migrations;src/models;config/database.json"
```

### Implementation Field Details

The **implementation** field provides detailed code implementation guidance with 4 core components:

#### files Array - Detailed File Information
- **path**: File path or filename
- **location**: Specific code location (function name, class name, line range)
- **original_code**: Original code snippet to be modified (mark as "requires gemini analysis" if not obtained)
- **modifications**: Modification details
  - **current_state**: Brief description of current code state
  - **proposed_changes**: Step-by-step list of modification points
  - **logic_flow**: Data flow and call relationship diagram
  - **reason**: Modification rationale and objectives
  - **expected_outcome**: Expected results

#### context_notes - Implementation Context Information
- **dependencies**: Required dependency packages or modules
- **affected_modules**: Other modules that will be affected
- **risks**: Potential risk points and cascading effects
- **performance_considerations**: Performance impact assessment
- **error_handling**: Error handling requirements

#### analysis_source - Information Source Identifier
- **manual**: Detailed information manually provided by user
- **gemini**: Automatically obtained through Gemini CLI analysis
- **codex**: Automatically obtained through Codex CLI analysis
- **auto-detected**: Auto-detected based on task type and context

### Hierarchical Task System
**Maximum Depth**: 2 levels (impl-N.M format)

```
impl-1              # Main task
impl-1.1            # Subtask of impl-1 (dynamically created)
impl-1.2            # Another subtask of impl-1
impl-2              # Another main task
impl-2.1            # Subtask of impl-2 (dynamically created)
```

**Task Status Rules**:
- **Container tasks**: Parent tasks with subtasks (cannot be directly executed)
- **Leaf tasks**: Only these can be executed directly
- **Status inheritance**: Parent status derived from subtask completion

## File Structure

### Unified File Structure
All workflows use the same file structure regardless of complexity. Task complexity is expressed through dynamic task decomposition, not file structure variations.

```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # Session metadata and state
├── [.brainstorming/]           # Optional brainstorming phase  
├── .chat/                      # CLI interaction sessions
│   ├── chat-*.md              # Saved chat sessions
│   └── analysis-*.md          # Analysis results
├── IMPL_PLAN.md                # Planning document
├── TODO_LIST.md                # Progress tracking
├── .summaries/                 # Task completion summaries
│   ├── IMPL-*.md              # Main task summaries
│   └── IMPL-*.*.md            # Subtask summaries
└── .task/
    ├── impl-*.json             # Main task definitions
    └── impl-*.*.json           # Subtask definitions (dynamic)
```

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
| **Simple** | <5 tasks | 1 level (impl-N) | Direct execution, minimal decomposition |
| **Medium** | 5-15 tasks | 2 levels (impl-N.M) | Moderate decomposition, context coordination |
| **Complex** | >15 tasks | 2 levels (impl-N.M) | Frequent decomposition, multi-agent orchestration |

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

### TODO_LIST.md Template
```markdown
# Tasks: [Session Topic]

## Task Progress
▸ **IMPL-001**: [Main Task Group] → [📋](./.task/impl-001.json)
  - [ ] **IMPL-001.1**: [Subtask] → [📋](./.task/impl-001.1.json)
  - [x] **IMPL-001.2**: [Subtask] → [📋](./.task/impl-001.2.json) | [✅](./.summaries/IMPL-001.2.md)
  
- [x] **IMPL-002**: [Simple Task] → [📋](./.task/impl-002.json) | [✅](./.summaries/IMPL-002.md)

▸ **IMPL-003**: [Main Task Group] → [📋](./.task/impl-003.json)
  - [ ] **IMPL-003.1**: [Subtask] → [📋](./.task/impl-003.1.json)
  - [ ] **IMPL-003.2**: [Subtask] → [📋](./.task/impl-003.2.json)

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

### Task Creation
```bash
echo '{"id":"impl-1","title":"New task",...}' > .task/impl-1.json
```

### Task Updates
```bash
jq '.status = "active"' .task/impl-1.json > temp && mv temp .task/impl-1.json
```

### Document Generation
```bash
# Generate TODO_LIST.md from current JSON state
generate_todo_list_from_json .task/
```

## Validation and Error Handling

### Task Integrity Rules
1. **ID Uniqueness**: All task IDs must be unique
2. **Hierarchical Format**: Must follow impl-N[.M] pattern (maximum 2 levels)
3. **Parent References**: All parent IDs must exist as JSON files
4. **Depth Limits**: Maximum 2 levels deep
5. **Status Consistency**: Status values from defined enumeration
6. **Required Fields**: All 9 core fields must be present
7. **Implementation Structure**: implementation.files array must contain valid file paths
8. **Analysis Source**: analysis_source must be one of: manual|gemini|codex|auto-detected

### Session Consistency Checks
```bash
# Validate active session integrity
active_marker=$(ls .workflow/.active-* 2>/dev/null | head -1)
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

---

**System ensures**: Unified workflow architecture with ultra-fast session management, JSON-only data model, and unified file structure for all workflows regardless of complexity.