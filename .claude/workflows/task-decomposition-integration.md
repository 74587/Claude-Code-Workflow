# Task Decomposition Integration Principles

## Overview

This document defines simplified complexity classification and task hierarchy rules for the JSON-only workflow system.

## Simplified Complexity Classification

### Simple Workflows
**Criteria**: Direct implementation tasks with clear scope
**Structure**: Single-level tasks (impl-N format)
**Task Files**: impl-*.json only
**Max Depth**: 1 level

### Medium Workflows  
**Criteria**: Feature implementation requiring task breakdown
**Structure**: Two-level hierarchy (impl-N.M format)
**Task Files**: Parent and child JSON files
**Max Depth**: 2 levels

### Complex Workflows
**Criteria**: System-wide changes requiring detailed decomposition
**Structure**: Three-level hierarchy (impl-N.M.P format)
**Task Files**: Multi-level JSON hierarchy
**Max Depth**: 3 levels (maximum allowed)

## Task Hierarchy Rules

### Hierarchical ID Format
- **Level 1**: impl-N (main tasks)
- **Level 2**: impl-N.M (subtasks)  
- **Level 3**: impl-N.M.P (detailed subtasks)
- **Maximum**: 3 levels deep

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

## Decomposition Triggers

### Automatic Decomposition When:
- Task title indicates multiple distinct activities
- Implementation scope spans multiple modules
- Clear sub-components can be identified
- Task complexity exceeds single-agent execution

### Skip Decomposition For:
- Single file modifications
- Simple bug fixes
- Clear, atomic tasks
- Documentation updates

## Task Status Rules

### Container Task Rules
- Parent tasks become "container" status when broken down
- Cannot be directly executed (must execute subtasks)
- Status derived from subtask completion

### Leaf Task Rules
- Only leaf tasks can be executed directly
- Status reflects actual execution state
- Progress tracked at leaf level only

## Validation Rules

### Hierarchy Validation
1. **Depth Limit**: Maximum 3 levels (impl-N.M.P)
2. **ID Format**: Must follow hierarchical naming
3. **Parent References**: All parent IDs must exist
4. **Circular Dependencies**: Not allowed in hierarchy

### Task Integrity
- All referenced tasks must exist as JSON files
- Parent-child relationships must be bidirectional
- Container tasks cannot have "completed" status until all children complete
- Leaf tasks must have valid execution status

---

**System ensures**: Consistent hierarchical decomposition within depth limits using JSON-only data model