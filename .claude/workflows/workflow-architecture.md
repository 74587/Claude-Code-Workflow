# Workflow Architecture

## Overview

This document defines the complete workflow system architecture using a **JSON-only data model**, **marker-based session management**, and **progressive file structures** that scale with task complexity.

## Core Architecture Principles

### Key Design Decisions
- **JSON files are the single source of truth** - All markdown documents are read-only generated views
- **Marker files for session tracking** - Ultra-simple active session management
- **Progressive complexity structure** - File organization scales from simple to complex workflows
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
    "current_tasks": ["impl-1", "impl-2"],
    "last_checkpoint": "2025-09-07T10:00:00Z"
  },
  "meta": {
    "created": "2025-09-05T10:00:00Z",
    "updated": "2025-09-07T10:00:00Z"
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
All task files use this 8-field schema:

```json
{
  "id": "impl-1",
  "title": "Build authentication module",
  "status": "pending|active|completed|blocked|container",
  "type": "feature|bugfix|refactor|test|docs", 
  "agent": "code-developer|planning-agent|test-agent|docs-agent",
  
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
  
  "meta": {
    "created": "2025-09-05T10:30:00Z",
    "updated": "2025-09-05T10:30:00Z"
  }
}
```

### Hierarchical Task System
**Maximum Depth**: 3 levels (impl-N.M.P format)

```
impl-1              # Main task
impl-1.1            # Subtask of impl-1
impl-1.1.1          # Detailed subtask of impl-1.1
impl-1.2            # Another subtask of impl-1
impl-2              # Another main task
```

**Task Status Rules**:
- **Container tasks**: Parent tasks with subtasks (cannot be directly executed)
- **Leaf tasks**: Only these can be executed directly
- **Status inheritance**: Parent status derived from subtask completion

## File Structure

### Progressive Structure System
File structure scales with task complexity to minimize overhead for simple tasks while providing comprehensive organization for complex workflows.

#### Level 0: Minimal Structure (<5 tasks)
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # Session metadata and state
├── [.brainstorming/]           # Optional brainstorming phase
├── [.chat/]                    # Gemini CLI interaction sessions
├── IMPL_PLAN.md                # Combined planning document
├── .summaries/                 # Task completion summaries
│   └── IMPL-*.md              # Individual task summaries
└── .task/
    └── impl-*.json             # Task definitions
```

#### Level 1: Enhanced Structure (5-15 tasks)
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # Session metadata and state
├── [.brainstorming/]          # Optional brainstorming phase
├── [.chat/]                   # Gemini CLI interaction sessions
├── IMPL_PLAN.md               # Combined planning document
├── TODO_LIST.md               # Auto-triggered progress tracking
├── .summaries/                # Task completion summaries
│   ├── IMPL-*.md             # Main task summaries
│   └── IMPL-*.*.md           # Subtask summaries
└── .task/
    ├── impl-*.json            # Main task definitions
    └── impl-*.*.json          # Subtask definitions (up to 3 levels)
```

#### Level 2: Complete Structure (>15 tasks)
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json        # Session metadata and state
├── [.brainstorming/]          # Optional brainstorming phase  
├── [.chat/]                   # Gemini CLI interaction sessions
│   ├── chat-*.md             # Saved chat sessions with timestamps
│   └── analysis-*.md         # Comprehensive analysis results
├── IMPL_PLAN.md               # Comprehensive planning document
├── TODO_LIST.md               # Progress tracking and monitoring
├── .summaries/                # Task completion summaries
│   ├── IMPL-*.md             # Main task summaries
│   ├── IMPL-*.*.md           # Subtask summaries
│   └── IMPL-*.*.*.md         # Detailed subtask summaries
└── .task/
    ├── impl-*.json            # Task hierarchy (max 3 levels deep)
    ├── impl-*.*.json          # Subtasks
    └── impl-*.*.*.json        # Detailed subtasks
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
- Chat sessions: `chat-YYYYMMDD-HHMMSS.md`
- Task summaries: `IMPL-[task-id]-summary.md`

## Complexity Classification

### Unified Classification Rules
**Consistent thresholds across all workflow components:**

| Complexity | Task Count | Hierarchy Depth | Structure Level | Behavior |
|------------|------------|----------------|-----------------|----------|
| **Simple** | <5 tasks | 1 level (impl-N) | Level 0 - Minimal | Direct execution, basic docs |
| **Medium** | 5-15 tasks | 2 levels (impl-N.M) | Level 1 - Enhanced | Context coordination, TODO tracking |
| **Complex** | >15 tasks | 3 levels (impl-N.M.P) | Level 2 - Complete | Multi-agent orchestration, full docs |

### Simple Workflows
**Characteristics**: Direct implementation tasks with clear, limited scope
- **Examples**: Bug fixes, small feature additions, configuration changes
- **System Behavior**: Minimal structure, single-level tasks, basic planning only
- **Agent Coordination**: Direct execution without complex orchestration

### Medium Workflows  
**Characteristics**: Feature implementation requiring task breakdown
- **Examples**: New features, API endpoints with integration, database schema changes
- **System Behavior**: Enhanced structure, two-level hierarchy, auto-triggered TODO_LIST.md
- **Auto-trigger Conditions**: Tasks >5 OR modules >3 OR effort >4h OR complex dependencies

### Complex Workflows
**Characteristics**: System-wide changes requiring detailed decomposition
- **Examples**: Major features, architecture refactoring, security implementations, multi-service deployments
- **System Behavior**: Complete structure, three-level hierarchy, comprehensive documentation
- **Agent Coordination**: Multi-agent orchestration with deep context analysis

### Automatic Assessment & Upgrades
- **During Creation**: System evaluates requirements and assigns complexity
- **During Execution**: Can upgrade (Simple→Medium→Complex) but never downgrade
- **Override Allowed**: Users can specify higher complexity manually

## Document Templates

### IMPL_PLAN.md Templates

#### Stage-Based Format (Simple Tasks)
```markdown
# Implementation Plan: [Task Name]

## Overview
[Brief description of the overall goal and approach]

## Requirements  
[Functional and non-functional requirements]

## Stage 1: [Name]
**Goal**: [Specific deliverable]
**Success Criteria**: 
- [Testable outcome 1]
**Tests**: 
- [Specific test case 1]
**Dependencies**: [Previous stages or external requirements]
**Status**: [Not Started]

## Risk Mitigation
[Identified risks and mitigation strategies]
```

#### Hierarchical Format (Complex Tasks)
```markdown
# Implementation Plan: [Project Name]

## Overview
[Brief description and strategic approach]

## Requirements
[Functional and non-functional requirements]

## Task Hierarchy

### Main Task: [IMPL-001] [Primary Goal]
**Description**: [Detailed description]
**Complexity**: [High/Medium/Low]
**Status**: [Not Started]

#### Subtask: [IMPL-001.1] [Subtask Name]
**Description**: [Specific deliverable]
**Assigned Agent**: [code-developer/code-review-agent/general-purpose]
**Acceptance Criteria**: 
- [Testable criteria 1]
**Status**: [Not Started]

##### Action Item: [IMPL-001.1.1] [Specific Action]
**Type**: [Code/Test/Documentation/Review]
**Description**: [Concrete action]
**Files Affected**: [List of files]
**Status**: [Not Started]
```

### TODO_LIST.md Template
```markdown
# Task Progress List: [Session Topic]

## Implementation Tasks

### Main Tasks
- [ ] **IMPL-001**: [Task Description] → [📋 Details](./.task/impl-001.json)
- [x] **IMPL-002**: [Completed Task] → [📋 Details](./.task/impl-002.json) | [✅ Summary](./.summaries/IMPL-002-summary.md)

### Subtasks (Auto-expanded when active)
- [ ] **IMPL-001.1**: [Subtask Description] → [📋 Details](./.task/impl-001.1.json)
```

## Agent Integration

### Agent Assignment
Based on task type and title keywords:
- **Planning tasks** → planning-agent
- **Implementation** → code-developer  
- **Testing** → test-agent
- **Documentation** → docs-agent
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
2. **Hierarchical Format**: Must follow impl-N[.M[.P]] pattern
3. **Parent References**: All parent IDs must exist as JSON files
4. **Depth Limits**: Maximum 3 levels deep
5. **Status Consistency**: Status values from defined enumeration
6. **Required Fields**: All 8 core fields must be present

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

## Performance Benefits

### Marker File System
- **Session Detection**: Single `ls` command (< 1ms)
- **Session Switching**: Two file operations (delete + create)
- **Status Check**: File existence test (instant)
- **No Parsing Overhead**: Zero JSON/text processing

### JSON-Only Architecture
- **Direct Access**: No document parsing overhead
- **Atomic Updates**: Single file operations
- **No Sync Conflicts**: Eliminates coordination complexity
- **Fast Queries**: Direct JSON traversal
- **Scalability**: Handles hundreds of tasks efficiently

### On-Demand Generation
- **Memory Efficient**: Documents created only when needed
- **Always Fresh**: Generated views reflect current state
- **No Stale Data**: Eliminates sync lag issues

---

**System ensures**: Unified workflow architecture with ultra-fast session management, JSON-only data model, and progressive file structures that scale from simple tasks to complex system-wide implementations.