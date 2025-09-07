---
name: task-replan
description: Dynamically replan tasks based on changes, blockers, or new requirements
usage: /task:replan [task-id|--all] [--reason=<reason>] [--strategy=<adjust|rebuild>]
argument-hint: [task-id or --all] [optional: reason and strategy]
examples:
  - /task:replan IMPL-001 --reason="requirements changed"
  - /task:replan --all --reason="new security requirements"
  - /task:replan IMPL-003 --strategy=rebuild
---

# Task Replan Command (/task:replan)

## Overview
Dynamically adjusts task planning based on changes, new requirements, blockers, or execution results.

## Core Principles
**System Architecture:** @~/.claude/workflows/unified-workflow-system-principles.md  


## Replan Triggers

⚠️ **CRITICAL**: Before replanning, MUST check for existing active session to avoid creating duplicate sessions.

### Session Check Process
1. **Query Session Registry**: Check `.workflow/session_status.jsonl` for active sessions. If the file doesn't exist, create it.
2. **Session Validation**: Use existing active session containing the task to be replanned
3. **Context Integration**: Load existing session state and task hierarchy

### Automatic Detection
System detects replanning needs from file monitoring:
- Requirements changed in workflow-session.json
- Dependencies blocked in JSON task hierarchy  
- Task failed execution (logged in JSON execution history)
- New issues discovered and associated with tasks
- Scope modified in task context or IMPL_PLAN.md
- File structure complexity changes requiring reorganization

### Manual Triggers
```bash
/task:replan IMPL-001 --reason="API spec updated"
```

## Replan Strategies

### 1. Adjust Strategy (Default)
Minimal changes to existing plan:
```bash
/task:replan IMPL-001 --strategy=adjust

Adjustments for IMPL-001:
- Updated requirements
- Modified subtask IMPL-001.2
- Added validation step
- Kept 80% of original plan
```

### 2. Rebuild Strategy
Complete replanning from scratch:
```bash
/task:replan IMPL-001 --strategy=rebuild

Rebuilding IMPL-001:
- Analyzing new requirements
- Generating new breakdown
- Reassigning agents
- New execution plan created
```

## Usage Scenarios

### Scenario 1: Requirements Change
```bash
/task:replan IMPL-001 --reason="Added OAuth2 requirement"

Analyzing impact...
Current plan:
- IMPL-001.1: Basic login ✅ Complete
- IMPL-001.2: Session management (in progress)
- IMPL-001.3: Tests

Recommended changes:
+ Add IMPL-001.4: OAuth2 integration
~ Modify IMPL-001.2: Include OAuth session
~ Update IMPL-001.3: Add OAuth tests

Apply changes? (y/n): y
✅ Task replanned successfully
```

### Scenario 2: Blocked Task
```bash
/task:replan IMPL-003 --reason="API not ready"

Task blocked analysis:
- IMPL-003 depends on external API
- API delayed by 2 days
- 3 tasks depend on IMPL-003

Replan options:
1. Defer IMPL-003 and dependents
2. Create mock API for development
3. Reorder to work on independent tasks

Select option: 2

Creating new plan:
+ IMPL-003.0: Create API mock
~ IMPL-003.1: Use mock for development
~ Add note: Replace mock when API ready
```

### Scenario 3: Failed Execution
```bash
/task:replan IMPL-002 --reason="execution failed"

Failure analysis:
- Failed at: Testing phase
- Reason: Performance issues
- Impact: Blocks 2 downstream tasks

Replan approach:
1. Break down into smaller tasks
2. Add performance optimization task
3. Adjust testing approach

New structure:
IMPL-002 (failed) → 
├── IMPL-002.1: Core functionality (smaller scope)
├── IMPL-002.2: Performance optimization
├── IMPL-002.3: Load testing
└── IMPL-002.4: Integration

✅ Replanned with focus on incremental delivery
```

## Global Replanning

### Replan All Tasks
```bash
/task:replan --all --reason="Architecture change"

Global replan analysis:
- Total tasks: 8
- Completed: 3 (keep as-is)
- In progress: 2 (need adjustment)
- Pending: 3 (full replan)

Changes summary:
- 2 tasks modified
- 1 task removed (no longer needed)
- 2 new tasks added
- Dependencies reordered

Preview changes? (y/n): y
[Detailed change list]

Apply all changes? (y/n): y
✅ All tasks replanned
```

## Impact Analysis

### Before Replanning
```bash
/task:replan IMPL-001 --preview

Impact Preview:
If IMPL-001 is replanned:
- Affected tasks: 4
- Timeline impact: +1 day
- Resource changes: Need planning-agent
- Risk level: Medium

Dependencies affected:
- IMPL-003: Will need adjustment
- IMPL-004: Delay expected
- IMPL-005: No impact

Continue? (y/n):
```

## Replan Operations

### Add Subtasks
```bash
/task:replan IMPL-001 --add-subtask

Current subtasks:
1. IMPL-001.1: Design
2. IMPL-001.2: Implement

Add new subtask:
Title: Add security layer
Position: After IMPL-001.2
Agent: code-developer

✅ Added IMPL-001.3: Add security layer
```

### Remove Subtasks
```bash
/task:replan IMPL-001 --remove-subtask=IMPL-001.3

⚠️ Remove IMPL-001.3?
This will:
- Delete subtask and its context
- Update parent progress
- Adjust dependencies

Confirm? (y/n): y
✅ Subtask removed
```

### Reorder Tasks
```bash
/task:replan --reorder

Current order:
1. IMPL-001: Auth
2. IMPL-002: Database
3. IMPL-003: API

Suggested reorder (based on dependencies):
1. IMPL-002: Database
2. IMPL-001: Auth  
3. IMPL-003: API

Apply reorder? (y/n): y
✅ Tasks reordered
```

## Smart Recommendations

### AI-Powered Suggestions
```bash
/task:replan IMPL-001 --suggest

Analysis complete. Suggestions:
1. 🔄 Split IMPL-001.2 (too complex)
2. ⏱️ Reduce scope to meet deadline
3. 🤝 Parallelize IMPL-001.1 and IMPL-001.3
4. 📝 Add documentation task
5. 🧪 Increase test coverage requirement

Apply suggestion: 1

Splitting IMPL-001.2:
→ IMPL-001.2.1: Core implementation
→ IMPL-001.2.2: Error handling
→ IMPL-001.2.3: Optimization
✅ Applied successfully
```

## Version Control & File Management

### JSON Task Version History
**File-Based Versioning**: Each replan creates version history in JSON metadata

```bash
/task:replan impl-001 --history

Plan versions for impl-001 (from JSON file):
v3 (current): 4 subtasks, 2 complete - JSON files: impl-001.1.json to impl-001.4.json
v2: 3 subtasks (archived) - Backup: .task/archive/impl-001-v2-backup.json
v1: 2 subtasks (initial) - Backup: .task/archive/impl-001-v1-backup.json

Version files available:
- Current: .task/impl-001.json
- Backups: .task/archive/impl-001-v[N]-backup.json
- Change log: .summaries/replan-history-impl-001.md

Rollback to version: 2
⚠️ This will:
- Restore JSON files from backup
- Regenerate TODO_LIST.md structure
- Update workflow-session.json
- Archive current version

Continue? (y/n):
```

### Replan Documentation Generation
**Change Tracking Files**: Auto-generated documentation of all changes

```bash
# Generates: .summaries/replan-[task-id]-[timestamp].md
/task:replan impl-001 --reason="API changes" --document

Creating replan documentation...

📝 Replan Report: impl-001
Generated: 2025-09-07 16:00:00
Reason: API changes
Version: v2 → v3

## Changes Made
- Added subtask impl-001.4: Handle new API endpoints
- Modified impl-001.2: Updated authentication flow
- Removed impl-001.3: No longer needed due to API changes

## File Changes
- Created: .task/impl-001.4.json
- Modified: .task/impl-001.2.json
- Archived: .task/impl-001.3.json → .task/archive/
- Updated: TODO_LIST.md hierarchy
- Updated: workflow-session.json task count

## Impact Analysis
- Timeline: +2 days (new subtask)
- Dependencies: impl-002 now depends on impl-001.4
- Resources: Need API specialist for impl-001.4

Report saved: .summaries/replan-impl-001-20250907-160000.md
```

### Enhanced JSON Change Tracking
**Complete Replan History**: All changes documented in JSON files and reports

```json
{
  "task_id": "impl-001",
  "title": "Build authentication module",
  "status": "active",
  "version": "1.2",
  
  "replan_history": [
    {
      "version": "1.2",
      "timestamp": "2025-09-07T16:00:00Z",
      "reason": "API changes",
      "changes_summary": "Added API endpoint handling, removed deprecated auth flow",
      "backup_location": ".task/archive/impl-001-v1.1-backup.json",
      "documentation": ".summaries/replan-impl-001-20250907-160000.md",
      "files_affected": [
        {
          "action": "created",
          "file": ".task/impl-001.4.json",
          "description": "New API endpoint handling subtask"
        },
        {
          "action": "modified", 
          "file": ".task/impl-001.2.json",
          "description": "Updated authentication flow"
        },
        {
          "action": "archived",
          "file": ".task/impl-001.3.json",
          "location": ".task/archive/impl-001.3-deprecated.json"
        }
      ],
      "todo_list_regenerated": true,
      "session_updated": true
    }
  ],
  
  "subtasks": ["impl-001.1", "impl-001.2", "impl-001.4"],
  
  "metadata": {
    "version": "1.2",
    "last_updated": "2025-09-07T16:00:00Z",
    "last_replan": "2025-09-07T16:00:00Z",
    "replan_count": 2
  }
}
```

## File System Integration

### Comprehensive File Updates
**Multi-File Synchronization**: Ensures consistency across all workflow files

#### JSON Task File Management
- **Version Backups**: Automatic backup before major changes
- **Hierarchical Updates**: Cascading changes through parent-child relationships
- **Archive Management**: Deprecated task files moved to `.task/archive/`
- **Metadata Tracking**: Complete change history in JSON metadata

#### TODO_LIST.md Regeneration
**Smart Regeneration**: Updates based on structural changes

```bash
/task:replan impl-001 --regenerate-todo

Analyzing structural changes from replan...
Current TODO_LIST.md: 8 tasks displayed
New task structure: 9 tasks (1 added, 1 removed, 2 modified)

Regenerating TODO_LIST.md...
✅ Updated task hierarchy display
✅ Recalculated progress percentages
✅ Updated cross-references to JSON files
✅ Added links to new summary files

TODO_LIST.md updated with new structure
```

#### Workflow Session Updates
- **Task Count Updates**: Reflect additions/removals in session
- **Progress Recalculation**: Update completion percentages
- **Complexity Assessment**: Re-evaluate structure level if needed
- **Dependency Validation**: Check all task dependencies remain valid

### Documentation Generation
**Automatic Report Creation**: Every replan generates documentation

- **Replan Report**: `.summaries/replan-[task-id]-[timestamp].md`
- **Change Summary**: Detailed before/after comparison
- **Impact Analysis**: Effects on timeline, dependencies, resources
- **File Change Log**: Complete list of affected files
- **Rollback Instructions**: How to revert changes if needed

### Issue Integration
```bash
/task:replan IMPL-001 --from-issue=ISS-001

Loading issue ISS-001...
Issue: "Login timeout too short"
Type: Bug
Priority: High

Suggested replan:
+ Add IMPL-001.4: Fix login timeout
~ Adjust IMPL-001.3: Include timeout tests

Apply? (y/n): y
```

## Error Handling

```bash
# Cannot replan completed task
❌ Task IMPL-001 is completed
→ Create new task instead

# No reason provided
⚠️ Please provide reason for replanning
→ Use --reason="explanation"

# Conflicts detected
⚠️ Replan conflicts with IMPL-002
→ Resolve with --force or adjust plan
```

## File Output Summary

### Generated Files
- **Backup Files**: `.task/archive/[task-id]-v[N]-backup.json`
- **Replan Reports**: `.summaries/replan-[task-id]-[timestamp].md`
- **Change Logs**: Embedded in JSON task file metadata
- **Updated TODO_LIST.md**: Reflects new task structure
- **Archive Directory**: `.task/archive/` for deprecated files

### File System Maintenance
- **Automatic Cleanup**: Archive old versions after 30 days
- **Integrity Validation**: Ensure all references remain valid after changes
- **Rollback Support**: Complete restoration capability from backups
- **Cross-Reference Updates**: Maintain links between all workflow files

## Related Commands

- `/task:breakdown` - Initial task breakdown with JSON file creation
- `/task:context` - Analyze current state from file system
- `/task:execute` - Execute replanned tasks with new structure
- `/task:sync` - Validate file consistency after replanning
- `/workflow:replan` - Replan entire workflow with session updates