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

### Priority Levels
- `low` - Can be deferred
- `normal` - Standard priority (default)
- `high` - Should be done soon
- `critical` - Must be done immediately

## Task Structure

```json
{
  "id": "impl-1",
  "parent_id": null,
  "title": "Build authentication module",
  "type": "feature",
  "priority": "normal",
  "status": "pending",
  "depth": 1,
  "agent": "code-developer",
  "effort": "4h",
  
  "context": {
    "inherited_from": "WFS-user-auth-system",
    "requirements": ["JWT authentication", "OAuth2 support"],
    "scope": ["src/auth/*", "tests/auth/*"],
    "acceptance": ["Module handles JWT tokens", "OAuth2 flow implemented"]
  },
  
  "dependencies": {
    "upstream": [],
    "downstream": [],
    "parent_dependencies": []
  },
  
  "subtasks": [],
  
  "execution": {
    "attempts": 0,
    "current_attempt": null,
    "history": []
  },
  
  "metadata": {
    "created_at": "2025-09-05T10:30:00Z",
    "started_at": null,
    "completed_at": null,
    "last_updated": "2025-09-05T10:30:00Z",
    "version": "1.0"
  }
}
```

## Document Integration Features

### JSON Task File Generation
**File Location**: `.workflow/WFS-[topic-slug]/.task/impl-[N].json`
**Hierarchical Naming**: Follows impl-N.M.P format for nested tasks
**Schema Compliance**: All JSON files follow unified task schema from task-management-principles.md

### Import from IMPL_PLAN.md
```bash
/task:create --from-plan
```
- Reads existing IMPL_PLAN.md implementation strategy
- Creates JSON task files based on planned structure
- Maintains hierarchical relationships in JSON format
- Preserves acceptance criteria from plan in task context

### Progressive Document Creation
Based on complexity analysis triggers:

#### Level 0 Structure (<5 tasks)
- Creates individual JSON task files in `.task/`
- No TODO_LIST.md generation (minimal overhead)
- Updates workflow-session.json with task references

#### Level 1 Structure (5-15 tasks)
- Creates hierarchical JSON task files (impl-N.M format)
- **Auto-generates TODO_LIST.md** when complexity threshold reached
- Creates `.summaries/` directory structure
- Enhanced cross-referencing between files

#### Level 2 Structure (>15 tasks)
- Creates complete hierarchical JSON files (impl-N.M.P format)
- Always maintains TODO_LIST.md with progress tracking
- Full `.summaries/` directory with detailed task documentation
- Comprehensive cross-references and validation

### Document Creation Triggers
TODO_LIST.md auto-generation conditions:
- **Task count > 5** OR **modules > 3** OR **estimated effort > 4h** OR **complex dependencies detected**
- **Always** for workflows with >15 tasks (Level 2 structure)

### Cross-Reference Management
- All JSON files contain proper parent_id relationships
- TODO_LIST.md links to individual JSON task files
- workflow-session.json maintains task list with hierarchy depth
- Automatic validation of cross-file references

## Dynamic Complexity Escalation (NEW FEATURE)

### Automatic Workflow Upgrade System
After each task creation, the system automatically evaluates current workflow complexity and upgrades structure when thresholds are exceeded.

### Escalation Process
```
1. Create New Task → Generate JSON file
2. Count All Tasks → Read all .task/*.json files  
3. Calculate Metrics → Tasks, modules, dependencies, effort
4. Check Thresholds → Compare against complexity criteria
5. Trigger Upgrade → If threshold exceeded, escalate complexity
6. Generate Documents → Auto-create missing structure documents
7. Update Session → Record complexity change in workflow-session.json
8. Notify User → Inform about automatic upgrade
```

### Escalation Triggers

#### Simple → Medium Escalation
**Triggered when ANY condition met:**
- Task count reaches 5 (primary trigger)
- Module count exceeds 3 
- Total estimated effort > 4 hours
- Complex dependencies detected
- Cross-component changes required

**Actions taken:**
```bash
✅ Task created: impl-5
⚠️ Complexity threshold reached: 5 tasks (exceeds Simple limit)
🔄 Escalating workflow: Simple → Medium

Auto-generating enhanced structure:
✅ Created TODO_LIST.md with hierarchical task display
✅ Created .summaries/ directory for task completion tracking  
✅ Updated workflow-session.json complexity level
✅ Enabled 2-level task hierarchy (impl-N.M)

Workflow now supports:
- Progress tracking via TODO_LIST.md
- Task decomposition up to 2 levels
- Summary generation for completed tasks
```

#### Medium → Complex Escalation  
**Triggered when ANY condition met:**
- Task count reaches 15 (primary trigger)
- Module count exceeds 5
- Total estimated effort > 2 days
- Multi-repository impacts detected
- Architecture pattern changes required

**Actions taken:**
```bash
✅ Task created: impl-15
⚠️ Complexity threshold reached: 15 tasks (exceeds Medium limit)  
🔄 Escalating workflow: Medium → Complex

Auto-generating comprehensive structure:
✅ Enhanced IMPL_PLAN.md with detailed phases and risk assessment
✅ Expanded TODO_LIST.md with progress monitoring
✅ Created comprehensive .summaries/ structure
✅ Updated workflow-session.json complexity level
✅ Enabled 3-level task hierarchy (impl-N.M.P maximum)

Workflow now supports:
- Comprehensive progress tracking and monitoring
- Full 3-level task decomposition
- Enhanced documentation and audit trails
- Advanced dependency management
```

### Complexity Calculation Algorithm
```javascript
function calculateComplexity(tasks, modules, effort, dependencies) {
  // Primary thresholds (hard limits)
  if (tasks >= 15 || modules > 5 || effort > 48) return 'complex';
  if (tasks >= 5 || modules > 3 || effort > 4) return 'medium';
  
  // Override factors (can force higher complexity)
  if (dependencies.includes('multi-repo') || 
      dependencies.includes('architecture-change')) return 'complex';
  if (dependencies.includes('cross-component') ||
      dependencies.includes('complex-integration')) return 'medium';
      
  return 'simple';
}
```

### Session State Updates During Escalation
```json
{
  "complexity": "medium",
  "escalation_history": [
    {
      "from": "simple",
      "to": "medium", 
      "triggered_at": "2025-09-07T16:45:00Z",
      "trigger_reason": "task_count_threshold",
      "task_count_at_escalation": 5,
      "auto_generated_documents": ["TODO_LIST.md", ".summaries/"],
      "task_hierarchy_enabled": 2
    }
  ],
  "task_system": {
    "max_depth": 2,
    "structure_level": "enhanced",
    "documents_generated": ["TODO_LIST.md"],
    "auto_escalation_enabled": true
  }
}
```

### Benefits of Dynamic Escalation
- **Seamless Growth**: Workflows grow naturally without user intervention
- **No Overhead for Simple Tasks**: Simple workflows remain minimal
- **Automatic Structure**: Enhanced documentation appears when needed
- **Progressive Enhancement**: Users get appropriate tooling for current complexity
- **Transparent Process**: All escalations logged and reversible

## Context Inheritance

Tasks automatically inherit:
1. **Requirements** - From workflow-session.json context and IMPL_PLAN.md
2. **Scope** - File patterns from workflow and IMPL_PLAN.md strategy
3. **Standards** - Quality standards from workflow session
4. **Dependencies** - Related tasks from existing JSON task hierarchy in `.task/`
5. **Parent Context** - When created as subtasks, inherit from parent JSON file
6. **Session Context** - Global workflow context from active session

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

## File Output Management

### JSON Task Files
**Output Location**: `.workflow/WFS-[topic-slug]/.task/impl-[id].json`
**Schema**: Follows unified task JSON schema with hierarchical support
**Contents**: Complete task definition including context, dependencies, and metadata

### TODO_LIST.md Generation
**Trigger Logic**: Auto-created based on complexity thresholds
**Location**: `.workflow/WFS-[topic-slug]/TODO_LIST.md`
**Format**: Hierarchical task display with checkboxes and progress tracking

### Summary Directory Structure
**Location**: `.workflow/WFS-[topic-slug]/.summaries/`
**Purpose**: Ready for task completion summaries
**Structure**: Created when Level 1+ complexity detected

### Workflow Session Updates
**File**: `.workflow/WFS-[topic-slug]/workflow-session.json`
**Updates**: Task list, counters, progress calculations, hierarchy depth

## Integration

### Workflow Integration
- Updates workflow-session.json with new task references
- Increments task counter and updates complexity assessment
- Updates IMPLEMENT phase progress and task hierarchy depth
- Maintains bidirectional sync with TodoWrite tool

### File System Coordination
- Validates and creates required directory structure
- Maintains cross-references between all generated files
- Ensures proper naming conventions and hierarchy limits
- Provides rollback capability for failed operations

### Next Steps
After creation, use:
- `/task:breakdown` - Split into hierarchical subtasks with JSON files
- `/task:execute` - Run the task with summary generation
- `/task:context` - View task details and file references
- `/task:sync` - Validate file consistency across system

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