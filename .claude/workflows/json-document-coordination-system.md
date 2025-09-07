# JSON-Document Coordination System (Single Source of Truth)

## Overview

This document defines the **Single Source of Truth** architecture where JSON files are the authoritative state source and all markdown documents are read-only, generated views. This eliminates bidirectional synchronization complexity and data conflicts.

**Key Principle**: `.task/*.json` files are the **only** authoritative source of task state. All markdown documents (`TODO_LIST.md`, progress displays, etc.) are generated on-demand from JSON data.

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

## Single Source of Truth Architecture

### 1. Data Authority (Simplified)

#### JSON Files Own (ONLY Authoritative Source)
- **ALL Task State**: Complete task definitions, status, progress, metadata
- **Hierarchical Relationships**: Parent-child links, depth management  
- **Execution State**: pending/active/completed/blocked/failed
- **Progress Data**: Percentages, timing, checkpoints
- **Agent Assignment**: Current agent, execution history
- **Dependencies**: Task relationships across all hierarchy levels
- **Session Metadata**: Timestamps, versions, attempt counts
- **Runtime State**: Current attempt, active processes

#### Documents Are Read-Only Views (Generated Only)
- **IMPL_PLAN.md**: Static planning document (manually created, rarely changes)
- **TODO_LIST.md**: **Generated view** from JSON files (never manually edited)
- **Progress Reports**: **Generated views** from JSON data
- **Status Displays**: **Generated views** from JSON state

#### No Shared Responsibility (Eliminates Conflicts)
- **Single Direction Flow**: JSON → Markdown (never Markdown → JSON)
- **No Synchronization**: Documents are generated, not synchronized
- **No Conflicts**: Only one source of truth eliminates data conflicts

### 2. View Generation (Replaces Synchronization)

#### No Document → JSON Flow (Eliminated)
**Documents are read-only**: No parsing, no status updates from documents
**No bidirectional sync**: Documents cannot modify JSON state
**No conflict resolution needed**: Single direction eliminates conflicts

#### JSON → View Generation (On Demand)
**Trigger Events**:
- User requests context view (`/context`)
- Task status changed in JSON files  
- View generation requested by commands

**Actions**:
```javascript
// Pseudo-code for view generation process  
on_view_request(view_type, options) {
  const task_data = load_all_task_json_files();
  const session_data = load_workflow_session();
  
  if (view_type === 'todo_list') {
    const todo_view = generate_todo_list_view(task_data);
    return render_markdown_view(todo_view);
  }
  
  if (view_type === 'progress') {
    const progress = calculate_progress_from_json(task_data);
    return render_progress_view(progress, session_data);
  }
  
  if (view_type === 'status') {
    const status = compile_status_from_json(task_data, session_data);
    return render_status_view(status);
  }
}
```

### 3. View Generation Process (Replaces Real-Time Sync)

#### On-Demand View Process
```
1. Command Request → User requests view (`/context`)
2. JSON Loader → Reads all task JSON files  
3. Data Processor → Calculates progress, status, hierarchy
4. View Generator → Creates markdown representation
5. Display → Returns formatted view to user
```

#### Context Command (Replaces Sync Commands)
```bash
# Generate todo list view
/context

# Generate task-specific view  
/context IMPL-001

# Generate progress view
/context --format=progress

# Generate status view with health check
/context --health-check
```

## No Conflict Resolution Needed (Architecture Benefit)

### Eliminated Conflict Types

#### Conflicts That No Longer Exist
- **Timestamp Conflicts**: No bidirectional updates means no timestamp conflicts
- **Data Authority Conflicts**: Only JSON has authority, documents are read-only
- **Hierarchy Conflicts**: JSON defines structure, documents display it (no conflicts)
- **Sync State Conflicts**: No synchronization means no sync state issues

### Simplified Data Model Benefits
- **Zero Conflicts**: Single source of truth eliminates all data conflicts  
- **No Resolution Logic**: No complex conflict detection or resolution needed
- **Reduced Complexity**: Eliminates entire conflict resolution subsystem
- **Improved Reliability**: Cannot have data drift or inconsistency issues

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