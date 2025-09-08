# Workflow Data Model

## Overview

This document defines the complete data model for the workflow system using a **JSON-only architecture**. JSON task files are the single source of truth, with all documents generated on-demand as read-only views.

## Core Data Architecture

### Key Principle: JSON-Only Data Model
**JSON files (.task/impl-*.json) are the only authoritative source of task state. All markdown documents are read-only generated views that never persist state.**

- **Task State**: Stored exclusively in JSON files
- **Documents**: Generated on-demand from JSON data
- **No Synchronization**: Eliminates bidirectional sync complexity
- **Performance**: Direct JSON access without parsing overhead

## Task JSON Schema

### Core Task Structure
All task files use this simplified 8-field schema:

```json
{
  "id": "impl-1",
  "title": "Build authentication module",
  "status": "pending",
  "type": "feature", 
  "agent": "code-developer",
  
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

### Status Values
- **pending**: Task created but not started
- **active**: Task currently being worked on  
- **completed**: Task successfully finished
- **blocked**: Task cannot proceed due to dependencies
- **container**: Parent task with subtasks (not directly executable)

### Task Types
- **feature**: New functionality implementation
- **bugfix**: Fixing existing issues
- **refactor**: Code improvement without functionality change
- **test**: Test implementation or testing tasks
- **docs**: Documentation creation or updates

## Hierarchical Task System

### Task Hierarchy Rules
**Maximum Depth**: 3 levels (impl-N.M.P format)

```
impl-1              # Main task
impl-1.1            # Subtask of impl-1
impl-1.1.1          # Detailed subtask of impl-1.1
impl-1.2            # Another subtask of impl-1
impl-2              # Another main task
```

### Parent-Child Relationships
```json
// Parent task
{
  "id": "impl-1",
  "title": "Build authentication module",
  "status": "pending",
  "relations": {
    "parent": null,
    "subtasks": ["impl-1.1", "impl-1.2"],
    "dependencies": []
  }
}

// Child task
{
  "id": "impl-1.1",
  "title": "Design auth schema", 
  "status": "pending",
  "relations": {
    "parent": "impl-1",
    "subtasks": [],
    "dependencies": []
  }
}
```

### Task Status Rules

#### Container Task Rules
- Parent tasks become "container" status when broken down
- Cannot be directly executed (must execute subtasks)
- Status derived from subtask completion

#### Leaf Task Rules
- Only leaf tasks can be executed directly
- Status reflects actual execution state
- Progress tracked at leaf level only

## Context Management

### Context Structure
Context provides complete information for agent execution:

- **requirements**: Specific functional requirements
- **scope**: File patterns and modules affected  
- **acceptance**: Success criteria and completion definition
- **inherited_from**: Source workflow or parent task

### Context Inheritance
- **Workflow → Task**: Global requirements and constraints
- **Parent → Subtask**: Refined scope and specific requirements
- **Context Preservation**: All fields maintained for agent execution

## Complexity Classification

### Simple Workflows
**Criteria**: Direct implementation tasks with clear scope
- **Structure**: Single-level tasks (impl-N format)
- **Task Files**: impl-*.json only
- **Max Depth**: 1 level
- **Task Count**: <5 tasks

### Medium Workflows  
**Criteria**: Feature implementation requiring task breakdown
- **Structure**: Two-level hierarchy (impl-N.M format)
- **Task Files**: Parent and child JSON files
- **Max Depth**: 2 levels
- **Task Count**: 5-15 tasks

### Complex Workflows
**Criteria**: System-wide changes requiring detailed decomposition
- **Structure**: Three-level hierarchy (impl-N.M.P format)
- **Task Files**: Multi-level JSON hierarchy
- **Max Depth**: 3 levels (maximum allowed)
- **Task Count**: >15 tasks

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

## File Organization

### JSON Task Files
**Location**: `.task/impl-[id].json`
**Naming**: Follows hierarchical ID format
**Content**: Complete task definition

### Document Generation
**On-Demand**: Documents generated from JSON when requested
**Read-Only**: Documents never store state
**Templates**: Standard templates for consistent output

#### Generated Documents
- `TODO_LIST.md`: Task progress view generated from JSON
- `IMPL_PLAN.md`: Planning document with task references
- Task summaries: Generated from completed task JSON

## Data Operations

### Task Creation
```bash
# Create new task JSON file
echo '{"id":"impl-1","title":"New task",...}' > .task/impl-1.json
```

### Task Updates
```bash
# Update task status directly in JSON
jq '.status = "active"' .task/impl-1.json > temp && mv temp .task/impl-1.json
```

### Document Generation
```bash
# Generate TODO_LIST.md from current JSON state
generate_todo_list_from_json .task/
```

## Validation Rules

### Task Integrity
1. **ID Uniqueness**: All task IDs must be unique
2. **Hierarchical Format**: Must follow impl-N[.M[.P]] pattern
3. **Parent References**: All parent IDs must exist as JSON files
4. **Depth Limits**: Maximum 3 levels deep
5. **Status Consistency**: Status values from defined enumeration
6. **Required Fields**: All 8 core fields must be present

### Relationship Validation  
- Parent-child relationships must be bidirectional
- Dependencies must reference existing tasks
- Container tasks cannot be completed until all subtasks complete
- No circular dependencies allowed

## Error Handling

### Common Scenarios
1. **Missing JSON File**: Indicates broken reference - must repair
2. **Invalid Status**: Update to valid status value
3. **Broken Hierarchy**: Reconstruct parent-child relationships  
4. **Orphaned Task**: Reassign to proper parent or workflow

### Recovery Strategy
- **JSON Authoritative**: Task JSON files are source of truth
- **Validation Warnings**: For non-critical inconsistencies
- **Manual Resolution**: For complex relationship conflicts
- **Document Regeneration**: Recreate documents from JSON when corrupted

## Performance Benefits

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

**System ensures**: Consistent task management using simplified JSON-only data model with complete context preservation for agent execution and on-demand document generation for human readability