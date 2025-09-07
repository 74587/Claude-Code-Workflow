# JSON-Document Coordination System

## Overview

This document provides technical implementation details for JSON file structures, synchronization mechanisms, conflict resolution, and performance optimization.

### JSON File Hierarchy
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json          # Master session state
├── IMPL_PLAN.md                   # Combined planning document
├── TODO_LIST.md                   # Progress tracking document
└── .task/
    ├── impl-1.json                # Main task
    ├── impl-1.1.json              # Level 2 subtask
    ├── impl-1.1.1.json            # Level 3 detailed subtask
    ├── impl-1.2.json              # Another level 2 subtask
    └── impl-2.json                # Another main task
```

## JSON File Structures

### 1. workflow-session.json (Master State)
```json
{
  "session_id": "WFS-user-auth-system",
  "project": "OAuth2 authentication system", 
  "type": "complex",
  "status": "active",
  "current_phase": "IMPLEMENT",
  "directory": ".workflow/WFS-user-auth-system",
  
  "documents": {
    "IMPL_PLAN.md": {
      "status": "generated",
      "path": ".workflow/WFS-user-auth-system/IMPL_PLAN.md",
      "last_updated": "2025-09-05T10:30:00Z",
      "sync_status": "synced"
    },
    "TODO_LIST.md": {
      "status": "generated",
      "path": ".workflow/WFS-user-auth-system/TODO_LIST.md", 
      "last_updated": "2025-09-05T11:20:00Z",
      "sync_status": "synced"
    }
  },
  
  "task_system": {
    "enabled": true,
    "directory": ".workflow/WFS-user-auth-system/.task",
    "next_main_task_id": 3,
    "max_depth": 3,
    "task_count": {
      "total": 8,
      "main_tasks": 2,
      "subtasks": 6,
      "pending": 3,
      "active": 2, 
      "completed": 2,
      "blocked": 1
    }
  },
  
  "coordination": {
    "last_sync": "2025-09-05T11:20:00Z",
    "sync_conflicts": 0,
    "auto_sync_enabled": true,
    "manual_sync_required": false
  },
  
  "metadata": {
    "created_at": "2025-09-05T10:00:00Z",
    "last_updated": "2025-09-05T11:20:00Z",
    "version": "2.1"
  }
}
```

### 2. TODO_LIST.md (Task Registry & Display)
TODO_LIST.md serves as both the task registry and progress display:

```markdown
# Implementation Progress

## Task Status Summary
- **Total Tasks**: 5
- **Completed**: 2 (40%)
- **Active**: 2
- **Pending**: 1

## Task Hierarchy

### ☐ impl-1: Build authentication module (75% complete)
- ☑ impl-1.1: Design authentication schema (100%)
  - ☑ impl-1.1.1: Create user model
  - ☑ impl-1.1.2: Design JWT structure
- ☐ impl-1.2: Implement OAuth2 flow (50%)

### ☐ impl-2: Setup user management (0%)
```

**Task Registry Data Extracted from TODO_LIST.md:**
  
  
  
  "last_updated": "2025-09-05T11:20:00Z"
}
```

### 3. Individual Task JSON (impl-*.json)
```json
{
  "id": "impl-1.1",
  "title": "Design authentication schema",
  "parent_id": "impl-1",
  "depth": 2,
  "status": "completed",
  "type": "design",
  "priority": "normal",
  "agent": "planning-agent",
  "effort": "1h",
  "subtasks": ["impl-1.1.1", "impl-1.1.2"],
  
  "context": {
    "inherited_from": "impl-1",
    "requirements": ["User model schema", "JWT token design", "OAuth2 integration points"],
    "scope": ["src/auth/models/*", "docs/auth-schema.md"],
    "acceptance": ["Schema validates JWT tokens", "User model complete", "OAuth2 flow documented"]
  },
  
  "document_refs": {
    "todo_section": "TODO_LIST.md#impl-1.1",
    "todo_items": [
      "TODO_LIST.md#impl-1.1",
      "TODO_LIST.md#impl-1.1.1",
      "TODO_LIST.md#impl-1.1.2"
    ],
    "impl_plan_ref": "IMPL_PLAN.md#authentication-schema-design"
  },
  
  "dependencies": {
    "upstream": [],
    "downstream": ["impl-1.2"],
    "blocking": [],
    "blocked_by": [],
    "parent_dependencies": ["impl-1"]
  },
  
  "execution": {
    "attempts": 1,
    "current_attempt": {
      "started_at": "2025-09-05T10:35:00Z",
      "completed_at": "2025-09-05T11:20:00Z",
      "duration": "45m",
      "checkpoints": ["setup", "design", "validate", "document"],
      "completed_checkpoints": ["setup", "design", "validate", "document"]
    },
    "history": [
      {
        "attempt": 1,
        "started_at": "2025-09-05T10:35:00Z",
        "completed_at": "2025-09-05T11:20:00Z",
        "result": "success",
        "outputs": ["src/auth/models/User.ts", "docs/auth-schema.md"]
      }
    ]
  },
  
  "sync_metadata": {
    "last_document_sync": "2025-09-05T11:20:00Z",
    "document_version": "1.2",
    "sync_conflicts": [],
    "pending_document_updates": []
  },
  
  "metadata": {
    "created_at": "2025-09-05T10:30:00Z",
    "started_at": "2025-09-05T10:35:00Z",
    "completed_at": "2025-09-05T11:20:00Z",
    "last_updated": "2025-09-05T11:20:00Z",
    "created_by": "task:breakdown IMPL-001",
    "version": "1.0"
  }
}
```

## Coordination Mechanisms

### 1. Data Ownership Rules

#### Documents Own (Authoritative)
**IMPL_PLAN.md:**
- **Implementation Strategy**: Overall approach, phases, risk assessment
- **Requirements**: High-level functional requirements
- **Context**: Global project context, constraints

**TODO_LIST.md:**
- **Progress Visualization**: Task status display, completion tracking
- **Checklist Format**: Checkbox representation of task hierarchy

#### JSON Files Own (Authoritative)  
- **Complete Task Definitions**: Full task context, requirements, acceptance criteria
- **Hierarchical Relationships**: Parent-child links, depth management
- **Execution State**: pending/active/completed/blocked/failed
- **Progress Data**: Percentages, timing, checkpoints
- **Agent Assignment**: Current agent, execution history
- **Dependencies**: Task relationships across all hierarchy levels
- **Session Metadata**: Timestamps, versions, attempt counts
- **Runtime State**: Current attempt, active processes

#### Shared Responsibility (Synchronized)
- **Task Status**: JSON authoritative, TODO_LIST.md displays current state
- **Progress Calculations**: Derived from JSON hierarchy, shown in TODO_LIST.md
- **Cross-References**: JSON contains document refs, documents link to relevant tasks
- **Task Hierarchy**: JSON defines structure, TODO_LIST.md visualizes it

### 2. Synchronization Events

#### Document → JSON Synchronization
**Trigger Events**:
- IMPL_PLAN.md modified (strategy/context changes)
- TODO_LIST.md checkboxes changed (manual status updates)
- Document structure changes affecting task references

**Actions**:
```javascript
// Pseudo-code for document sync process
on_document_change(document_path) {
  if (document_path.includes('IMPL_PLAN.md')) {
    const context_changes = parse_context_updates(document_path);
    propagate_context_to_tasks(context_changes);
    log_sync_event('impl_plan_to_json', document_path);
  }
  
  if (document_path.includes('TODO_LIST.md')) {
    const status_changes = parse_checkbox_updates(document_path);
    update_task_status_from_todos(status_changes);
    recalculate_hierarchy_progress(status_changes);
    update_session_progress();
    log_sync_event('todo_list_to_json', document_path);
  }
}
```

#### JSON → Document Synchronization
**Trigger Events**:
- Task status changed in JSON files
- New task created via decomposition
- Task hierarchy modified (parent-child relationships)
- Progress checkpoint reached
- Task completion cascading up hierarchy

**Actions**:
```javascript
// Pseudo-code for JSON sync process  
on_task_change(task_id, change_type, data) {
  // Update TODO_LIST.md with current task status
  update_todo_list_display(task_id, data.status);
  
  if (change_type === 'status_change' && data.new_status === 'completed') {
    // Recalculate parent task progress
    update_parent_progress(task_id);
    check_dependency_unblocking(task_id);
  }
  
  if (change_type === 'task_decomposition') {
    // Add new subtasks to TODO_LIST.md
    add_subtasks_to_todo_list(data.subtasks);
    update_todo_list_hierarchy(task_id, data.subtasks);
  }
  
  update_session_coordination_metadata();
  log_sync_event('json_to_todo_list', task_id);
}
```

### 3. Real-Time Coordination Process

#### Automatic Sync Process
```
1. File System Watcher → Detects document changes
2. Change Parser → Extracts structured data from documents  
3. Conflict Detector → Identifies synchronization conflicts
4. Sync Engine → Applies changes based on ownership rules
5. Validation → Verifies consistency across all files
6. Audit Logger → Records all sync events
```

#### Manual Sync Triggers
```bash
# Force complete synchronization
/task:sync --all

# Sync specific task
/task:sync IMPL-001

# Validate and repair sync issues  
/task:sync --validate --repair

# View sync status
/task:sync --status
```

## Conflict Resolution

### Conflict Types and Resolution

#### 1. Timestamp Conflicts
**Scenario**: Both document and JSON modified simultaneously
**Resolution**: Most recent timestamp wins, with manual review option

```json
{
  "conflict_type": "timestamp",
  "document_timestamp": "2025-09-05T11:20:00Z",
  "json_timestamp": "2025-09-05T11:19:30Z", 
  "resolution": "document_wins",
  "manual_review_required": false
}
```

#### 2. Data Authority Conflicts
**Scenario**: Task status changed directly in TODO_LIST.md vs JSON file
**Resolution**: Determine if change is authorized checkbox update or unauthorized edit

```json
{
  "conflict_type": "data_authority",
  "field": "task_status",
  "document_value": "completed", 
  "json_value": "active",
  "change_source": "checkbox|direct_edit",
  "resolution": "checkbox_authorized|json_authority",
  "action": "accept_checkbox_change|revert_document_change"
}
```

#### 3. Hierarchy Conflicts
**Scenario**: Task decomposition modified in JSON but TODO_LIST.md structure differs
**Resolution**: JSON hierarchy is authoritative, TODO_LIST.md updated

```json
{
  "conflict_type": "hierarchy",
  "conflict_description": "Task impl-1 subtasks differ between JSON and TODO display",
  "json_subtasks": ["impl-1.1", "impl-1.2", "impl-1.3"],
  "todo_display": ["impl-1.1", "impl-1.2"],
  "resolution": "json_authority",
  "action": "update_todo_list_structure",
  "manual_validation_required": false
}
```

### Conflict Resolution Priority
1. **Data Ownership Rules**: Respect authoritative source
2. **Recent Timestamp**: When ownership is shared  
3. **User Intent**: Manual resolution for complex conflicts
4. **System Consistency**: Maintain cross-file integrity

## Validation and Integrity

### Consistency Checks
```bash
/task:validate --consistency

Running consistency checks:
✅ Task IDs consistent across JSON files and TODO_LIST.md
✅ Hierarchical relationships valid (parent-child links)
✅ Task depth within limits (max 3 levels)
✅ Progress calculations accurate across hierarchy
⚠️ impl-2.1 missing from TODO_LIST.md display
❌ impl-1.1 status mismatch (JSON: completed, TODO: pending)
❌ Orphaned task: impl-3.2.1 has non-existent parent

Issues found: 3
Auto-fix available: 2 
Manual review required: 1
```

### Cross-Reference Validation
- Task IDs exist in all referenced documents
- Document sections referenced in JSON exist
- Progress percentages mathematically consistent
- Dependency relationships bidirectional

### Data Integrity Checks
- JSON schema validation
- Document structure validation  
- Cross-file referential integrity
- Timeline consistency validation

## Performance and Scalability

### Optimization Strategies
- **Incremental Sync**: Only sync changed sections
- **Batch Updates**: Group related changes
- **Async Processing**: Non-blocking synchronization
- **Caching**: Cache parsed document structures

### Scalability Considerations
- **File Size Limits**: Split large task sets across multiple files
- **Memory Usage**: Stream processing for large document parsing
- **I/O Optimization**: Minimize file reads/writes through batching

## Error Handling and Recovery

### Common Error Scenarios
```bash
# Document parsing error
❌ Failed to parse TODO_LIST.md
→ Syntax error in checkbox format at line 23
→ Restore from JSON task data? (y/n)

# JSON corruption
❌ Invalid JSON in impl-1.2.json  
→ Reconstruct from parent task and TODO_LIST.md? (y/n)

# Hierarchy errors
❌ Circular parent-child relationship detected: impl-1.1 → impl-1.1.1 → impl-1.1
→ Break circular dependency? (y/n)

# Missing files
❌ TODO_LIST.md not found
→ Regenerate from JSON task hierarchy? (y/n)

# Depth violations  
⚠️ Task impl-1.2.3.1 exceeds maximum depth (3 levels)
→ Flatten hierarchy or promote task? (flatten/promote)
```

### Recovery Mechanisms
- **Automatic Backup**: Git-based document versioning
- **Rollback Options**: Restore from previous sync point
- **Reconstruction**: Rebuild JSON from documents or vice versa
- **Partial Recovery**: Fix individual files without full reset

## Monitoring and Auditing

### Sync Event Logging
```json
{
  "timestamp": "2025-09-05T11:20:00Z",
  "event_type": "json_to_todo_list_sync",
  "source": "impl-1.1.json",
  "target": ["TODO_LIST.md"],
  "changes": [
    {
      "type": "hierarchical_status_update",
      "task_id": "impl-1.1", 
      "old_value": "active",
      "new_value": "completed",
      "propagation": {
        "parent_progress": {
          "task_id": "impl-1",
          "old_progress": 45,
          "new_progress": 67
        }
      }
    }
  ],
  "hierarchy_effects": [
    "impl-1 progress recalculated",
    "impl-1.2 unblocked due to impl-1.1 completion"
  ],
  "conflicts": 0,
  "duration_ms": 89,
  "status": "success"
}
```

### Performance Metrics
- Sync frequency and duration
- Conflict rate and resolution time  
- File size growth over time
- Error rate and recovery success

This JSON-document coordination system ensures reliable, consistent, and performant integration between state management and planning documentation while maintaining clear data ownership and providing robust error handling.