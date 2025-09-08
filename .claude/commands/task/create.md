---
name: task-create
description: Create implementation tasks with automatic context awareness
usage: /task:create "<title>" [--type=<type>] [--priority=<level>]
argument-hint: "task title" [optional: type and priority]
examples:
  - /task:create "Implement user authentication"
  - /task:create "Build REST API endpoints" --type=feature
  - /task:create "Fix login validation bug" --type=bugfix --priority=high
---

# Task Create Command (/task:create)

## Overview
Creates new implementation tasks during IMPLEMENT phase with automatic context awareness and ID generation.

## Core Principles
**System:** @~/.claude/workflows/core-principles.md  
**Task Management:** @~/.claude/workflows/task-management-principles.md

## Features

### Automatic Behaviors
- **ID Generation**: Auto-generates impl-N hierarchical format (impl-N.M.P max depth)
- **Context Inheritance**: Inherits from workflow session and IMPL_PLAN.md
- **JSON File Creation**: Generates task JSON in `.workflow/WFS-[topic-slug]/.task/`
- **Document Integration**: Creates/updates TODO_LIST.md based on complexity triggers
- **Status Setting**: Initial status = "pending"
- **Workflow Sync**: Updates workflow-session.json task list automatically
- **Agent Assignment**: Suggests agent based on task type
- **Hierarchy Support**: Creates parent-child relationships up to 3 levels
- **Progressive Structure**: Auto-triggers enhanced structure at complexity thresholds
- **Dynamic Complexity Escalation**: Automatically upgrades workflow complexity when thresholds are exceeded

### Context Awareness
- Detects current workflow phase (must be IMPLEMENT)
- Reads existing tasks from `.task/` directory to avoid duplicates
- Inherits requirements and scope from workflow-session.json
- Suggests related tasks based on existing JSON task hierarchy
- Analyzes complexity for structure level determination (Level 0-2)

## Usage

### Basic Creation
```bash
/task:create "Build authentication module"
```

Output:
```
✅ Task created: impl-1
Title: Build authentication module
Type: feature
Status: pending
Depth: 1 (main task)
Context inherited from workflow
```

### With Options
```bash
/task:create "Fix security vulnerability" --type=bugfix --priority=critical
```

### Task Types
- `feature` - New functionality (default)
- `bugfix` - Bug fixes
- `refactor` - Code improvements
- `test` - Test implementation
- `docs` - Documentation

### Priority Levels (Optional - moved to context)
- `low` - Can be deferred  
- `normal` - Standard priority (default)
- `high` - Should be done soon
- `critical` - Must be done immediately

**Note**: Priority is now stored in `context.priority` if needed, removed from top level for simplification.

## Simplified Task Structure

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
    "subtasks": [],
    "dependencies": []
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

## Simplified File Generation

### JSON Task File Only
**File Location**: `.task/impl-[N].json`
**Naming**: Follows impl-N.M.P format for nested tasks  
**Content**: Contains all task data (no document coordination needed)

### No Document Synchronization
- Creates JSON task file only
- Updates workflow-session.json stats only  
- No automatic TODO_LIST.md generation
- No complex cross-referencing needed

### View Generation On-Demand
- Use `/context` to generate views when needed
- No persistent markdown files created
- All data stored in JSON only

## Simplified Task Management

### Basic Task Statistics
- Task count tracked in workflow-session.json
- No automatic complexity escalation
- Manual workflow type selection during init

### Simple Creation Process
```
1. Create New Task → Generate JSON file only
2. Update Session Stats → Increment task count  
3. Notify User → Confirm task created
```

### Benefits of Simplification
- **No Overhead**: Just create tasks, no complex logic
- **Predictable**: Same process every time
- **Fast**: Minimal processing needed
- **Clear**: User controls complexity level

## Context Inheritance

Tasks automatically inherit:
1. **Requirements** - From workflow-session.json and IMPL_PLAN.md
2. **Scope** - File patterns from workflow context  
3. **Parent Context** - When created as subtasks, inherit from parent
4. **Session Context** - Global workflow context from active session

## Smart Suggestions

Based on title analysis:
```bash
/task:create "Write unit tests for auth module"

Suggestions:
- Related task: impl-1 (Build authentication module)
- Suggested agent: test-agent
- Estimated effort: 2h
- Dependencies: [impl-1]
- Suggested hierarchy: impl-1.3 (as subtask of impl-1)
```

## Validation Rules

1. **Phase Check** - Must be in IMPLEMENT phase (from workflow-session.json)
2. **Duplicate Check** - Title similarity detection across existing JSON files
3. **Session Validation** - Active workflow session must exist in `.workflow/`
4. **ID Uniqueness** - Auto-increment to avoid conflicts in `.task/` directory
5. **Hierarchy Validation** - Parent-child relationships must be valid (max 3 levels)
6. **File System Validation** - Proper directory structure and naming conventions
7. **JSON Schema Validation** - All task files conform to unified schema

## Error Handling

```bash
# Not in IMPLEMENT phase
❌ Cannot create tasks in PLAN phase
→ Use: /workflow implement

# No workflow session
❌ No active workflow found
→ Use: /workflow init "project name"

# Duplicate task
⚠️ Similar task exists: impl-3
→ Continue anyway? (y/n)

# Maximum depth exceeded
❌ Cannot create impl-1.2.3.1 (exceeds 3-level limit)
→ Suggest: impl-1.2.4 or promote to impl-2?
```

## Batch Creation

Create multiple tasks at once:
```bash
/task:create --batch
> Enter tasks (empty line to finish):
> Build login endpoint
> Add session management
> Write authentication tests
>

Created 3 tasks:
- impl-1: Build login endpoint
- impl-2: Add session management  
- impl-3: Write authentication tests
```

## File Output

### JSON Task File
**Location**: `.task/impl-[id].json`
**Schema**: Simplified task JSON schema  
**Contents**: Complete task definition with context

### Session Updates
**File**: `workflow-session.json`
**Updates**: Basic task count and active task list only

## Integration

### Simple Integration
- Updates workflow-session.json stats
- Creates JSON task file
- No complex file coordination needed

### Next Steps
After creation, use:
- `/task:breakdown` - Split into subtasks  
- `/task:execute` - Run the task
- `/context` - View task details and status

## Examples

### Feature Development
```bash
/task:create "Implement shopping cart functionality" --type=feature
```

### Bug Fix
```bash
/task:create "Fix memory leak in data processor" --type=bugfix --priority=high
```

### Refactoring
```bash
/task:create "Refactor database connection pool" --type=refactor
```

## Related Commands

- `/task:breakdown` - Break task into hierarchical subtasks
- `/task:context` - View/modify task context
- `/task:execute` - Execute task with agent
- `/task:status` - View task status and hierarchy