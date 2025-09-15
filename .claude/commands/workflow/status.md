---
name: workflow:status
description: Generate on-demand views from JSON task data
usage: /workflow:status [task-id] [--format=<format>] [--validate]
argument-hint: [optional: task-id, format, validation]
examples:
  - /workflow:status
  - /workflow:status impl-1
  - /workflow:status --format=hierarchy
  - /workflow:status --validate
---

# Workflow Status Command (/workflow:status)

## Overview
Generates on-demand views from JSON task data. No synchronization needed - all views are calculated from the current state of JSON files.

## Core Principles
**Data Source:** @~/.claude/workflows/workflow-architecture.md

## Key Features

### Pure View Generation
- **No Sync**: Views are generated, not synchronized
- **Always Current**: Reads latest JSON data every time
- **No Persistence**: Views are temporary, not saved
- **Single Source**: All data comes from JSON files only

### Multiple View Formats
- **Overview** (default): Current tasks and status
- **Hierarchy**: Task relationships and structure
- **Details**: Specific task information

## Usage

### Default Overview
```bash
/workflow:status
```

Generates current workflow overview:
```markdown
# Workflow Overview
**Session**: WFS-user-auth
**Phase**: IMPLEMENT
**Type**: medium

## Active Tasks
- [⚠️] impl-1: Build authentication module (code-developer)
- [⚠️] impl-2: Setup user management (code-developer)

## Completed Tasks
- [✅] impl-0: Project setup

## Stats
- **Total**: 8 tasks
- **Completed**: 3
- **Active**: 2
- **Remaining**: 3
```

### Specific Task View
```bash
/workflow:status impl-1
```

Shows detailed task information:
```markdown
# Task: impl-1

**Title**: Build authentication module
**Status**: active
**Agent**: code-developer
**Type**: feature

## Context
- **Requirements**: JWT authentication, OAuth2 support
- **Scope**: src/auth/*, tests/auth/*
- **Acceptance**: Module handles JWT tokens, OAuth2 flow implemented
- **Inherited From**: WFS-user-auth

## Relations
- **Parent**: none
- **Subtasks**: impl-1.1, impl-1.2
- **Dependencies**: impl-0

## Execution
- **Attempts**: 0
- **Last Attempt**: never

## Metadata
- **Created**: 2025-09-05T10:30:00Z
- **Updated**: 2025-09-05T10:35:00Z
```

### Hierarchy View
```bash
/workflow:status --format=hierarchy
```

Shows task relationships:
```markdown
# Task Hierarchy

## Main Tasks
- impl-0: Project setup ✅
- impl-1: Build authentication module ⚠️
  - impl-1.1: Design auth schema
  - impl-1.2: Implement auth logic
- impl-2: Setup user management ⚠️

## Dependencies
- impl-1 → depends on → impl-0
- impl-2 → depends on → impl-1
```

## View Generation Process

### Data Loading
```pseudo
function generate_workflow_status(task_id, format):
  // Load all current data
  session = load_workflow_session()
  all_tasks = load_all_task_json_files()

  // Filter if specific task requested
  if task_id:
    target_task = find_task(all_tasks, task_id)
    return generate_task_detail_view(target_task)

  // Generate requested format
  switch format:
    case 'hierarchy':
      return generate_hierarchy_view(all_tasks)
    default:
      return generate_overview(session, all_tasks)
```

### Real-Time Calculation
- **Task Counts**: Calculated from JSON file status fields
- **Relationships**: Built from JSON relations fields
- **Status**: Read directly from current JSON state

## Validation Mode

### Basic Validation
```bash
/workflow:status --validate
```

Performs integrity checks:
```markdown
# Validation Results

## JSON File Validation
✅ All task JSON files are valid
✅ Session file is valid and readable

## Relationship Validation
✅ All parent-child relationships are valid
✅ All dependencies reference existing tasks
✅ No circular dependencies detected

## Hierarchy Validation
✅ Task hierarchy within depth limits (max 3 levels)
✅ All subtask references are bidirectional

## Issues Found
⚠️ impl-3: No subtasks defined (expected for leaf task)

**Status**: All systems operational
```

### Validation Checks
- **JSON Schema**: All files parse correctly
- **References**: All task IDs exist
- **Hierarchy**: Parent-child relationships are valid
- **Dependencies**: No circular dependencies
- **Depth**: Task hierarchy within limits

## Error Handling

### Missing Files
```bash
❌ Session file not found
→ Initialize new workflow session? (y/n)

❌ Task impl-5 not found
→ Available tasks: impl-1, impl-2, impl-3, impl-4
```

### Invalid Data
```bash
❌ Invalid JSON in impl-2.json
→ Cannot generate view for impl-2
→ Repair file manually or recreate task

⚠️ Circular dependency detected: impl-1 → impl-2 → impl-1
→ Task relationships may be incorrect
```

## Performance Benefits

### Fast Generation
- **No File Writes**: Only reads JSON files
- **No Sync Logic**: No complex synchronization
- **Instant Results**: Generate views on demand
- **No Conflicts**: No state consistency issues

### Scalability
- **Large Task Sets**: Handles hundreds of tasks efficiently
- **Complex Hierarchies**: No performance degradation
- **Concurrent Access**: Multiple views can be generated simultaneously

## Integration

### Workflow Integration
- Use after task creation to see current state
- Use for debugging task relationships

### Command Integration
```bash
# Common workflow
/task:create "New feature"
/workflow:status                    # Check current state
/task:breakdown impl-1
/workflow:status --format=hierarchy # View new structure
/task:execute impl-1.1
```

## Output Formats

### Supported Formats
- `overview` (default): General workflow status
- `hierarchy`: Task relationships
- `tasks`: Simple task list
- `details`: Comprehensive information

### Custom Filtering
```bash
# Show only active tasks
/workflow:status --format=tasks --filter=active

# Show completed tasks only
/workflow:status --format=tasks --filter=completed

# Show tasks for specific agent
/workflow:status --format=tasks --agent=code-developer
```

## Related Commands

- `/task:create` - Create tasks (generates JSON data)
- `/task:execute` - Execute tasks (updates JSON data)
- `/task:breakdown` - Create subtasks (generates more JSON data)
- `/workflow:vibe` - Coordinate agents (uses workflow status for coordination)

This workflow status system provides instant, accurate views of workflow state without any synchronization complexity or performance overhead.