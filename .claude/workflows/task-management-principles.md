# Task Management Principles

## Overview

This document defines the simplified task system using JSON-only data storage with minimal structure and essential fields only.

## Simplified Task JSON Schema

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

## Task Relationships

### Hierarchical Structure
- **Parent-Child**: Uses `relations.parent` and `relations.subtasks`
- **Dependencies**: Uses `relations.dependencies` for task ordering
- **Maximum Depth**: 3 levels (impl-N.M.P format)

### ID Format Standards
```
impl-1              # Main task
impl-1.1            # Subtask of impl-1  
impl-1.1.1          # Detailed subtask of impl-1.1
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

## File Organization

### JSON Task Files
**Location**: `.task/impl-[id].json`
**Naming**: Follows hierarchical ID format
**Content**: Complete task definition

### Single Source of Truth
- JSON files contain all task data
- No document synchronization needed
- Views generated on-demand from JSON only

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

---

**System ensures**: Consistent task management using simplified JSON-only data model with complete context preservation for agent execution