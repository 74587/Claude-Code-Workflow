# JSON-Only Data System (Single Source of Truth)

## Overview

This document defines a **pure JSON data model** where JSON files are the only data source and all markdown documents are generated on-demand views. This eliminates all synchronization complexity and ensures data consistency.

**Key Principle**: `.task/*.json` files are the **only** authoritative source of task state. All markdown documents are **read-only generated views** that never persist state.

## File Structure

```
.workflow/WFS-[topic-slug]/
├── workflow-session.json          # Session state (simplified)
├── IMPL_PLAN.md                   # Static planning document
└── .task/
    ├── impl-1.json                # Task data (only data source)
    ├── impl-1.1.json              # Subtask data
    └── impl-2.json                # Another task
```

## JSON Data Structures

### 1. Simplified workflow-session.json

```json
{
  "session_id": "WFS-user-auth",
  "project": "OAuth2 authentication system", 
  "status": "active",
  "phase": "IMPLEMENT",
  
  "progress": {
    "completed_phases": ["PLAN"],
    "current_tasks": ["impl-1", "impl-2"],
    "last_checkpoint": "2025-09-07T10:00:00Z"
  },
  
  "stats": {
    "total_tasks": 8,
    "completed": 3,
    "active": 2
  },
  
  "meta": {
    "created": "2025-09-05T10:00:00Z",
    "updated": "2025-09-07T10:00:00Z"
  }
}
```

### 2. Simplified Task JSON (impl-*.json)

```json
{
  "id": "impl-1",
  "title": "Build authentication module",
  "status": "active",
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
    "last_attempt": "2025-09-05T10:35:00Z"
  },
  
  "meta": {
    "created": "2025-09-05T10:30:00Z",
    "updated": "2025-09-05T10:35:00Z"
  }
}
```

## Pure Generation Architecture

### JSON as Single Source of Truth

**JSON Files Own Everything:**
- All task state and metadata
- All relationships and dependencies  
- All execution history
- All progress information

**Documents Are Temporary Views:**
- Generated only when requested
- Never stored permanently
- Never parsed back to JSON
- No state persistence in markdown

### No Synchronization Needed

**Eliminated Concepts:**
- Bidirectional sync
- Document parsing
- Conflict resolution
- Sync state tracking
- Update coordination

**Single Flow Only:**
```
JSON Files → On-Demand Generation → Temporary Views → Display
```


### Generation Process

```pseudo
function generate_view(format, filters):
  // Load all JSON data
  tasks = load_all_task_json_files()
  session = load_workflow_session()
  
  // Generate requested view
  switch format:
    case 'tasks':
      return generate_task_list_view(tasks)
    case 'progress':
      return generate_progress_view(tasks, session)
    case 'hierarchy':
      return generate_hierarchy_view(tasks)
    default:
      return generate_overview(tasks, session)
```

### View Examples

#### Task List View (Generated)
```markdown
# Current Tasks

## Active Tasks
- [⚠️] impl-1: Build authentication module (code-developer)
- [⚠️] impl-2: Setup user management (code-developer)

## Completed Tasks  
- [✅] impl-0: Project setup

## Task Dependencies
- impl-2 → depends on → impl-1
```


## Data Operations

### Task Updates (JSON Only)

```javascript
// Update task status
function update_task_status(task_id, new_status) {
  const task_file = `.task/${task_id}.json`
  const task = load_json(task_file)
  task.status = new_status
  task.meta.updated = current_timestamp()
  save_json(task_file, task)
  // No document updates needed - views generated on demand
}
```

### Session Updates (Minimal)

```javascript
// Update session stats
function update_session_stats() {
  const session = load_workflow_session()
  const tasks = load_all_tasks()
  
  session.stats.completed = count_completed_tasks(tasks)
  session.stats.active = count_active_tasks(tasks)
  session.meta.updated = current_timestamp()
  
  save_json('workflow-session.json', session)
  // No document coordination needed
}
```

## Benefits of Pure Generation

### Performance Benefits
- **No Sync Overhead**: Zero synchronization operations
- **Faster Updates**: Direct JSON updates only
- **Reduced I/O**: No document file writes
- **Instant Views**: Generate views only when needed

### Reliability Benefits
- **No Data Conflicts**: Single source of truth
- **No Sync Failures**: No synchronization to fail
- **Consistent State**: JSON always authoritative
- **Simple Recovery**: Restore from JSON only

### Maintenance Benefits
- **Simpler Code**: No sync logic needed
- **Easier Debugging**: Check JSON files only
- **Clear Data Flow**: Always JSON → View
- **No Edge Cases**: No sync conflict scenarios

## Validation (Simplified)

### JSON Schema Validation
```bash
/context --validate

Validation Results:
✅ All task JSON files valid
✅ Task relationships consistent
✅ No circular dependencies
⚠️ impl-3 has no subtasks (expected for leaf task)

Status: All systems operational
```

### Basic Integrity Checks
- Task IDs are unique
- Parent-child relationships valid
- Dependencies exist
- Required fields present

## Error Handling

### Simple Error Scenarios
```bash
# Missing task file
❌ Task impl-5 not found
→ Check .task/impl-5.json exists

# Invalid JSON
❌ Parse error in impl-2.json
→ Restore from backup or recreate task

# Circular dependency  
❌ Circular dependency: impl-1 → impl-2 → impl-1
→ Fix dependency chain manually
```

### Recovery Strategy
- **JSON First**: Always repair JSON files
- **Regenerate Views**: Views are disposable, regenerate as needed
- **Simple Rollback**: Use git to restore JSON files
- **Manual Repair**: Direct JSON editing for complex issues

## Migration from Complex System

### Removed Features
- All document parsing
- Bidirectional synchronization  
- Conflict resolution
- Real-time document updates
- Sync state tracking
- Document metadata
- Cross-file reference validation
- Automated document repairs

### Simplified Workflows
1. **Task Creation**: Create JSON file only
2. **Status Updates**: Update JSON file only  
3. **View Request**: Generate from JSON on demand
4. **Progress Check**: Calculate from JSON data
5. **Completion**: Mark JSON as completed

This pure generation system provides all the functionality of the previous complex system while eliminating synchronization overhead, conflicts, and maintenance complexity.