# Task Management Principles

## Overview


This document provides complete technical implementation for the task system, including JSON schema, coordination rules, TodoWrite integration, and validation mechanisms.

## Unified Task JSON Schema

### Core Task Structure
All task files must conform to this schema with support for recursive decomposition:

```json
{
  "id": "impl-1",
  "parent_id": null,
  "title": "Task title describing the work",
  "type": "feature|bugfix|refactor|test|docs",
  "status": "pending|active|completed|blocked|failed",
  "priority": "low|normal|high|critical",
  "agent": "code-developer|planning-agent|test-agent|review-agent",
  "effort": "1h|2h|4h|1d|2d",
  
  "context": {
    "inherited_from": "WFS-user-auth-system",
    "requirements": ["Specific requirement 1", "Specific requirement 2"],
    "scope": ["src/module/*", "tests/module/*"],
    "acceptance": ["Success criteria 1", "Success criteria 2"]
  },
  
  "dependencies": {
    "upstream": ["impl-0"],
    "downstream": ["impl-2", "impl-3"]
  },
  
  "subtasks": ["impl-1.1", "impl-1.2", "impl-1.3"],
  
  "execution": {
    "attempts": 1,
    "current_attempt": {
      "started_at": "2025-09-05T10:35:00Z",
      "checkpoints": ["setup", "implement", "test", "validate"],
      "completed_checkpoints": ["setup", "implement"]
    },
    "history": []
  },
  
  "metadata": {
    "created_at": "2025-09-05T10:30:00Z",
    "started_at": "2025-09-05T10:35:00Z",
    "completed_at": "2025-09-05T13:15:00Z",
    "last_updated": "2025-09-05T13:15:00Z",
    "version": "1.0"
  }
}
```

### Status Enumeration
Standard status values across all systems:
- **pending**: Task created but not started
- **active**: Task currently being worked on
- **completed**: Task successfully finished
- **blocked**: Task cannot proceed due to dependencies
- **failed**: Task attempted but failed execution

### Type Classification
Standard task types:
- **feature**: New functionality implementation
- **bugfix**: Fixing existing issues
- **refactor**: Code improvement without functionality change
- **test**: Test implementation or testing tasks
- **docs**: Documentation creation or updates

### Priority Levels
Standard priority values:
- **low**: Can be deferred
- **normal**: Standard priority (default)
- **high**: Should be completed soon
- **critical**: Must be completed immediately

## TodoWrite Integration System

### TodoWrite Tool vs TODO_LIST.md File
**Clear Distinction**: TodoWrite is Claude's internal task tracking tool, TODO_LIST.md is the persistent workflow file

**TodoWrite Tool**:
- Claude's internal task management interface
- Real-time progress tracking during execution
- Temporary state for active workflow sessions
- Used by agents and commands for immediate task coordination

**TODO_LIST.md File**:
- Persistent task list stored in workflow session directory
- Cross-referenced with JSON task files
- Maintains task hierarchy and progress visualization
- Provides audit trail and resumable task state

### Synchronization Protocol

**TodoWrite → TODO_LIST.md**:
- TodoWrite task completion triggers TODO_LIST.md checkbox updates
- TodoWrite progress reflected in TODO_LIST.md progress calculations
- TodoWrite task status changes sync to JSON task files

**TODO_LIST.md → JSON Task Files**:
- Checkbox changes in TODO_LIST.md update JSON task status
- Manual task modifications propagate to JSON files
- Progress calculations derived from JSON task completion

**JSON Task Files → TodoWrite**:
- Task creation in JSON automatically creates TodoWrite entries when session is active
- JSON status changes reflect in TodoWrite display
- Agent task assignments sync to TodoWrite coordination

### Integration Rules
1. **Session Active**: TodoWrite automatically syncs with TODO_LIST.md
2. **Session Paused**: TodoWrite state preserved in TODO_LIST.md
3. **Session Resumed**: TodoWrite reconstructed from TODO_LIST.md and JSON files
4. **Cross-Session**: TODO_LIST.md provides continuity, TodoWrite provides active session interface

## Workflow Integration Schema

### Workflow Task Summary
Workflow session contains minimal task references with hierarchical support:

```json
{
  "phases": {
    "IMPLEMENT": {
      "tasks": ["impl-1", "impl-2", "impl-3"],
      "completed_tasks": ["impl-1"],
      "blocked_tasks": [],
      "progress": 33,
      "task_depth": 2,
      "last_sync": "2025-09-05T13:15:00Z"
    }
  }
}
```

### Task Reference Format
Tasks referenced by hierarchical ID, full details in JSON files:

```json
{
  "task_summary": {
    "id": "impl-1",
    "parent_id": null,
    "title": "Task title",
    "status": "completed",
    "type": "feature",
    "depth": 1,
    "progress": 100
  }
}

// Subtask example
{
  "task_summary": {
    "id": "impl-1.2.1",
    "parent_id": "impl-1.2",
    "title": "Detailed subtask",
    "status": "active",
    "type": "implementation",
    "depth": 3,
    "progress": 45
  }
}
```

## Data Ownership Rules

### JSON Task Files Own
- Complete task details and context (all levels)
- Execution history and checkpoints
- Parent-child relationships (via parent_id)
- Requirements and acceptance criteria
- Agent assignment and progress tracking
- Hierarchical decomposition state

### Workflow Session Owns
- Top-level task ID lists per phase
- Overall progress calculations
- Phase transition triggers  
- Global context inheritance rules
- Task depth management (max 3 levels)
- Sync timestamps and validation

### Shared Responsibility
- Task status (JSON authoritative, TODO_LIST.md displays)
- Progress calculations (derived from JSON, shown in TODO_LIST.md)
- Hierarchical relationships (JSON defines, TODO_LIST.md visualizes)
- Dependency validation (cross-file consistency)

## Synchronization Principles

### Automatic Sync Triggers
- **Task Creation**: Add to workflow task list and TODO_LIST.md
- **Status Change**: Update TODO_LIST.md checkboxes and progress
- **Task Completion**: Update TODO_LIST.md and recalculate hierarchy progress
- **Task Decomposition**: Create child JSON files, update TODO_LIST.md structure
- **Context Update**: Propagate to child tasks in hierarchy
- **Dependency Change**: Validate across all hierarchy levels

### Sync Direction Rules
1. **JSON Task → TODO_LIST.md**: Status updates, progress changes, completion
2. **JSON Task → Workflow**: Task creation, hierarchy changes, phase completion
3. **IMPL_PLAN.md → JSON Task**: Context updates, requirement changes
4. **TODO_LIST.md → JSON Task**: Manual status changes via checkboxes
5. **Bidirectional**: Dependencies, timestamps, hierarchy validation

### Conflict Resolution
Priority order for conflicts:
1. **Most Recent**: Latest timestamp wins
2. **Task Authority**: Task files authoritative for task details
3. **Workflow Authority**: Workflow authoritative for phase management
4. **Manual Resolution**: User confirmation for complex conflicts

### Data Integrity Checks
- **ID Consistency**: All task IDs exist across JSON files and TODO_LIST.md
- **Hierarchy Validation**: Parent-child relationships are bidirectional and valid
- **Depth Limits**: No task exceeds 3 levels deep (impl-N.M.P max)
- **Status Validation**: Status values match enumeration across all files
- **Dependency Validation**: All dependencies exist and respect hierarchy
- **Progress Accuracy**: Calculated progress matches hierarchical task completion
- **Timestamp Ordering**: Created ≤ Started ≤ Completed across hierarchy

## Hierarchical Task Decomposition

### Decomposition Rules
**Maximum Depth**: 3 levels (impl-N.M.P)
- **Level 1** (impl-N): Main implementation tasks
- **Level 2** (impl-N.M): Subtasks with specific focus areas  
- **Level 3** (impl-N.M.P): Detailed implementation steps

### ID Format Standards
```
impl-1              # Main task
impl-1.1            # Subtask of impl-1
impl-1.1.1          # Detailed subtask of impl-1.1
impl-1.2            # Another subtask of impl-1
impl-2              # Another main task
```

### Parent-Child Relationships
```json
// Parent task (impl-1.json)
{
  "id": "impl-1",
  "parent_id": null,
  "subtasks": ["impl-1.1", "impl-1.2", "impl-1.3"]
}

// Child task (impl-1.1.json)  
{
  "id": "impl-1.1",
  "parent_id": "impl-1",
  "subtasks": ["impl-1.1.1", "impl-1.1.2"]
}

// Grandchild task (impl-1.1.1.json)
{
  "id": "impl-1.1.1", 
  "parent_id": "impl-1.1",
  "subtasks": []  // Leaf node - no further decomposition
}
```

### Progress Calculation
- **Leaf tasks**: Progress based on execution checkpoints
- **Container tasks**: Progress = average of all subtask progress
- **Workflow progress**: Weighted average of all top-level tasks

### Status Propagation Rules
- **Child → Parent**: Parent cannot be "completed" until all children complete
- **Parent → Child**: Parent "blocked" status may propagate to children
- **Sibling Independence**: Subtasks at same level operate independently

## Context Management

### Context Inheritance Chain
```
Workflow Context
    ↓ (inherits requirements, constraints)
Task Context
    ↓ (distributes scope, specific requirements)
Subtask Context
```

### Context Distribution Rules
- **Requirements**: Flow from workflow to tasks
- **Scope**: Refined at each level (workflow → task → subtask)
- **Constraints**: Apply globally from workflow
- **Acceptance Criteria**: Specific to each task level

### Dynamic Context Updates
- Changes in workflow context propagate to tasks
- Task-specific context remains isolated
- Subtask context inherits from parent task
- Context versioning tracks changes

## Agent Integration

### Agent Assignment Logic
Based on task type and complexity:
- **Planning tasks** → planning-agent
- **Implementation** → code-developer
- **Testing** → test-agent
- **Documentation** → docs-agent
- **Review** → review-agent

### Execution Context Preparation
```json
{
  "execution_context": {
    "task": {
      "id": "IMPL-001",
      "requirements": ["from task context"],
      "scope": ["from task context"]
    },
    "workflow": {
      "session": "WFS-2025-001",
      "phase": "IMPLEMENT",
      "global_context": ["from workflow"]
    },
    "agent": {
      "type": "code-developer",
      "capabilities": ["coding", "testing"],
      "context_optimizations": ["code_patterns"]
    }
  }
}
```

## Error Handling

### Common Error Scenarios
1. **JSON Task File Missing**: Recreate from TODO_LIST.md or parent task data
2. **Status Mismatch**: JSON files are authoritative, update TODO_LIST.md
3. **Hierarchy Broken**: Reconstruct parent-child relationships from IDs
4. **Invalid Dependencies**: Validate across all hierarchy levels
5. **Schema Version Mismatch**: Migrate to current hierarchical schema
6. **Orphaned Tasks**: Clean up or reassign to proper parent/workflow
7. **Depth Violation**: Flatten excessive hierarchy to 3 levels max

### Recovery Strategies
- **Automatic Recovery**: For common, well-defined conflicts
- **Validation Warnings**: For non-critical inconsistencies
- **Manual Intervention**: For complex or ambiguous conflicts
- **Graceful Degradation**: Continue with best available data

### Validation Rules
- All task IDs must be unique and follow impl-N[.M[.P]] format
- Hierarchical IDs must have valid parent relationships
- Maximum depth of 3 levels (impl-N.M.P)
- Status values must be from defined enumeration
- Dependencies must reference existing tasks at appropriate levels
- Parent tasks cannot be completed until all subtasks complete
- Timestamps must be chronologically ordered
- Required fields cannot be null or empty

## Implementation Guidelines

### File Organization
```
.task/
├── impl-1.json            # Main task
├── impl-1.1.json          # Level 2 subtask
├── impl-1.1.1.json        # Level 3 detailed subtask
├── impl-1.2.json          # Level 2 subtask
└── impl-2.json            # Another main task

.workflow/WFS-[topic-slug]/
├── workflow-session.json   # Master session
├── IMPL_PLAN.md           # Planning document
└── TODO_LIST.md           # Progress tracking and task registry
```

### Performance Considerations
- **Lazy Loading**: Load task details only when needed
- **Batch Operations**: Group sync operations for efficiency
- **Incremental Updates**: Only sync changed data
- **Cache Management**: Cache frequently accessed task data

### Testing Requirements
- Schema validation for all task operations
- Sync consistency across workflow/task boundaries
- Error recovery scenario testing
- Performance testing with multiple tasks
- Concurrent access handling

### Success Metrics
- Zero data loss during sync operations
- Consistent task status across systems
- Fast task operations (< 100ms for single task)
- Reliable error recovery
- Complete audit trail of changes