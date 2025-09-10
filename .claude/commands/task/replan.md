---
name: replan
description: Replan individual tasks with detailed user input and change tracking
usage: /task:replan <task-id> [input]
argument-hint: task-id ["text"|file.md|ISS-001]
examples:
  - /task:replan impl-1 "Add OAuth2 authentication support"
  - /task:replan impl-1 updated-specs.md
  - /task:replan impl-1 ISS-001
---

# Task Replan Command (/task:replan)

## Overview
Replans individual tasks based on detailed user input with comprehensive change tracking, version management, and document synchronization. Focuses exclusively on single-task modifications with rich input options.

## Core Principles
**Task Management:** @~/.claude/workflows/workflow-architecture.md

## Single-Task Focus
This command operates on **individual tasks only**. For workflow-wide changes, use `/workflow:action-plan` instead.

⚠️ **CRITICAL**: Before replanning, checks for existing active session to avoid conflicts.

## Input Sources for Replanning

### Direct Text Input (Default)
```bash
/task:replan impl-1 "Add OAuth2 authentication support"
```
**Processing**:
- Parse specific changes and requirements
- Extract new features or modifications needed
- Apply directly to target task structure

### File-based Requirements
```bash
/task:replan impl-1 --from-file updated-specs.md
/task:replan impl-1 --from-file requirements-change.txt
```
**Supported formats**: .md, .txt, .json, .yaml
**Processing**:
- Read detailed requirement changes from file
- Parse structured specifications and updates
- Apply file content to task replanning

### Issue-based Replanning
```bash
/task:replan impl-1 --from-issue ISS-001
/task:replan impl-1 --from-issue "bug-report"
```
**Processing**:
- Load issue description and requirements
- Extract necessary changes for task
- Apply issue resolution to task structure

### Detailed Mode
```bash
/task:replan impl-1 --detailed
```
**Guided Input**:
1. **New Requirements**: What needs to be added/changed?
2. **Scope Changes**: Expand/reduce task scope?
3. **Subtask Modifications**: Add/remove/modify subtasks?
4. **Dependencies**: Update task relationships?
5. **Success Criteria**: Modify completion conditions?
6. **Agent Assignment**: Change assigned agent?

### Interactive Mode
```bash
/task:replan impl-1 --interactive
```
**Step-by-Step Process**:
1. **Current Analysis**: Review existing task structure
2. **Change Identification**: What needs modification?
3. **Impact Assessment**: How changes affect task?
4. **Structure Updates**: Add/modify subtasks
5. **Validation**: Confirm changes before applying

## Replanning Flow with Change Tracking

### 1. Task Loading & Validation
```
Load Task → Read current task JSON file
Validate → Check task exists and can be modified
Session Check → Verify active workflow session
```

### 2. Input Processing
```
Detect Input Type → Identify source type
Extract Requirements → Parse change requirements
Analyze Impact → Determine modifications needed
```

### 3. Version Management
```
Create Version → Backup current task state
Update Version → Increment task version number
Archive → Store previous version in versions/
```

### 4. Task Structure Updates
```
Modify Task → Update task JSON structure
Update Subtasks → Add/remove/modify as needed
Update Relations → Fix dependencies and hierarchy
Update Context → Modify requirements and scope
```

### 5. Document Synchronization
```
Update IMPL_PLAN → Regenerate task section
Update TODO_LIST → Sync task hierarchy (if exists)
Update Session → Reflect changes in workflow state
```

### 6. Change Documentation
```
Create Change Log → Document all modifications
Generate Summary → Create replan report
Update History → Add to task replan history
```

## Version Management (Simplified)

### Version Tracking
Each replan creates a new version with complete history:

```json
{
  "id": "impl-1",
  "title": "Build authentication module",
  "version": "1.2",
  "replan_history": [
    {
      "version": "1.1",
      "reason": "Original plan",
      "input_source": "initial_creation"
    },
    {
      "version": "1.2", 
      "reason": "Add OAuth2 authentication support",
      "input_source": "direct_text",
      "changes": [
        "Added subtask impl-1.3: OAuth2 integration",
        "Added subtask impl-1.4: Token management",
        "Modified scope to include external auth"
      ],
      "backup_location": ".task/versions/impl-1-v1.1.json"
    }
  ],
  "context": {
    "requirements": ["Basic auth", "Session mgmt", "OAuth2 support"],
    "scope": ["src/auth/*", "tests/auth/*"],
    "acceptance": ["All auth methods work"]
  }
}
```

### File Structure After Replan
```
.task/
├── impl-1.json                    # Current version (1.2)
├── impl-1.3.json                  # New subtask
├── impl-1.4.json                  # New subtask  
├── versions/
│   └── impl-1-v1.1.json          # Previous version backup
└── summaries/
    └── replan-impl-1-20250908.md  # Change log
```

## IMPL_PLAN.md Updates

### Automatic Plan Regeneration
When task is replanned, the corresponding section in IMPL_PLAN.md is updated:

**Before Replan**:
```markdown
## Task Breakdown
- **IMPL-001**: Build authentication module
  - Basic login functionality
  - Session management
  - Password reset
```

**After Replan**:
```markdown
## Task Breakdown
- **IMPL-001**: Build authentication module (v1.2)
  - Basic login functionality
  - Session management  
  - OAuth2 integration (added)
  - Token management (added)
  - Password reset

*Last updated via task:replan*
```

### Plan Update Process
1. **Locate Task Section**: Find task in IMPL_PLAN.md by ID
2. **Update Description**: Modify task title if changed
3. **Update Subtasks**: Add/remove bullet points for subtasks
4. **Add Version Info**: Include version number and update timestamp
5. **Preserve Context**: Keep surrounding plan structure intact

## TODO_LIST.md Synchronization

### Automatic TODO List Updates
If TODO_LIST.md exists in workflow, synchronize task changes:

**Before Replan**:
```markdown
## Implementation Tasks
- [ ] impl-1: Build authentication module
  - [x] impl-1.1: Design schema
  - [ ] impl-1.2: Implement logic
```

**After Replan**:
```markdown
## Implementation Tasks
- [ ] impl-1: Build authentication module (updated v1.2)
  - [x] impl-1.1: Design schema
  - [ ] impl-1.2: Implement logic  
  - [ ] impl-1.3: OAuth2 integration (new)
  - [ ] impl-1.4: Token management (new)
```

### TODO Update Rules
- **Preserve Status**: Keep existing checkbox states [x] or [ ]
- **Add New Items**: New subtasks get [ ] checkbox
- **Mark Changes**: Add (updated), (new), (modified) indicators
- **Remove Items**: Delete subtasks that were removed
- **Update Hierarchy**: Maintain proper indentation structure

## Change Documentation

### Comprehensive Change Log
Every replan generates detailed documentation:

```markdown
# Task Replan Log: impl-1
*Date: 2025-09-08T14:00:00Z*
*Version: 1.1 → 1.2*
*Input: Direct text - "Add OAuth2 authentication support"*

## Changes Applied

### Task Structure Updates
- **Added Subtasks**:
  - impl-1.3: OAuth2 provider integration
  - impl-1.4: Token management system
- **Modified Subtasks**:
  - impl-1.2: Updated to include OAuth flow integration
- **Removed Subtasks**: None

### Context Modifications
- **Requirements**: Added OAuth2 external authentication
- **Scope**: Expanded to include third-party auth integration
- **Acceptance**: Include OAuth2 token validation
- **Dependencies**: No changes

### File System Updates
- **Updated**: .task/impl-1.json (version 1.2)
- **Created**: .task/impl-1.3.json, .task/impl-1.4.json
- **Backed Up**: .task/versions/impl-1-v1.1.json
- **Updated**: IMPL_PLAN.md (task section regenerated)
- **Updated**: TODO_LIST.md (2 new items added)

## Impact Analysis
- **Timeline**: +2 days for OAuth implementation
- **Complexity**: Increased (simple → medium)
- **Agent**: Remains code-developer, may need OAuth expertise
- **Dependencies**: Task impl-2 may need OAuth context

## Related Tasks Affected
- impl-2: May need OAuth integration context
- impl-5: Authentication dependency updated

## Rollback Information
- **Previous Version**: 1.1
- **Backup Location**: .task/versions/impl-1-v1.1.json
- **Rollback Command**: `/task:replan impl-1 --rollback v1.1`
```

## Session State Updates

### Workflow Integration
After task replanning, update session information:

```json
{
  "phases": {
    "IMPLEMENT": {
      "tasks": ["impl-1", "impl-2", "impl-3"],
      "completed_tasks": [],
      "modified_tasks": {
        "impl-1": {
          "version": "1.2", 
          "last_replan": "2025-09-08T14:00:00Z",
          "reason": "OAuth2 integration added"
        }
      },
      "task_count": {
        "total": 6,
        "added_today": 2
      }
    }
  },
  "documents": {
    "IMPL_PLAN.md": {
      "last_updated": "2025-09-08T14:00:00Z",
      "updated_sections": ["IMPL-001"]
    },
    "TODO_LIST.md": {
      "last_updated": "2025-09-08T14:00:00Z", 
      "items_added": 2
    }
  }
}
```

## Rollback Support (Simple)

### Basic Version Rollback
```bash
/task:replan impl-1 --rollback v1.1

Rollback Analysis:
Current Version: 1.2
Target Version: 1.1
Changes to Revert:
- Remove subtasks: impl-1.3, impl-1.4
- Restore previous context
- Update IMPL_PLAN.md section
- Update TODO_LIST.md structure

Files Affected:
- Restore: .task/impl-1.json from backup
- Remove: .task/impl-1.3.json, .task/impl-1.4.json
- Update: IMPL_PLAN.md, TODO_LIST.md

Confirm rollback? (y/n): y

Rolling back...
✅ Task impl-1 rolled back to version 1.1
✅ Documents updated
✅ Change log created
```

## Practical Examples

### Example 1: Add Feature with Full Tracking
```bash
/task:replan impl-1 "Add two-factor authentication"

Loading task impl-1 (current version: 1.2)...

Processing request: "Add two-factor authentication"
Analyzing required changes...

Proposed Changes:
+ Add impl-1.5: Two-factor setup
+ Add impl-1.6: 2FA validation
~ Modify impl-1.2: Include 2FA in auth flow

Apply changes? (y/n): y

Executing replan...
✓ Version 1.3 created
✓ Added 2 new subtasks
✓ Modified 1 existing subtask
✓ IMPL_PLAN.md updated
✓ TODO_LIST.md synchronized
✓ Change log saved

Result:
- Task version: 1.2 → 1.3
- Subtasks: 4 → 6
- Documents updated: 2
- Backup: .task/versions/impl-1-v1.2.json
```

### Example 2: Issue-based Replanning
```bash
/task:replan impl-2 --from-issue ISS-001

Loading issue ISS-001...
Issue: "Database queries too slow - need caching"
Priority: High

Applying to task impl-2...

Required changes for performance fix:
+ Add impl-2.4: Implement Redis caching
+ Add impl-2.5: Query optimization
~ Modify impl-2.1: Add cache checks

Documents updating:
✓ Task JSON updated (v1.0 → v1.1)  
✓ IMPL_PLAN.md section regenerated
✓ TODO_LIST.md: 2 new items added
✓ Issue ISS-001 linked to task

Summary:
Performance improvements added to impl-2
Timeline impact: +1 day for caching setup
```

### Example 3: Interactive Replanning
```bash
/task:replan impl-3 --interactive

Interactive Replan for impl-3: API integration
Current version: 1.0

1. What needs to change? "API spec updated, need webhook support"
2. Add new requirements? "Webhook handling, signature validation"  
3. Add subtasks? "y"
   - New subtask 1: "Webhook receiver endpoint"
   - New subtask 2: "Signature validation"
   - Add more? "n"
4. Modify existing subtasks? "n"
5. Update dependencies? "Now depends on impl-1 (auth for webhooks)"
6. Change agent assignment? "n"

Applying interactive changes...
✓ Added 2 subtasks for webhook functionality
✓ Updated dependencies  
✓ Context expanded for webhook requirements
✓ Version 1.1 created
✓ All documents synchronized

Interactive replan complete!
```

## Error Handling

### Input Validation Errors
```bash
# Task not found
❌ Task impl-5 not found in current session
→ Check task ID with /context

# No input provided
❌ Please specify changes needed for replanning
→ Use descriptive text or --detailed/--interactive

# Task completed
⚠️ Task impl-1 is completed (cannot replan)
→ Create new task for additional work

# File not found
❌ File updated-specs.md not found
→ Check file path and try again
```

### Document Update Issues
```bash
# Missing IMPL_PLAN.md
⚠️ IMPL_PLAN.md not found in workflow
→ Task update proceeding, plan regeneration skipped

# TODO_LIST.md not writable
⚠️ Cannot update TODO_LIST.md (permissions)
→ Task updated, manual TODO sync needed

# Session conflict
⚠️ Task impl-1 being modified in another session
→ Complete other operation first
```

## Integration Points

### Command Workflow
```bash
# 1. Replan task with new requirements
/task:replan impl-1 "Add advanced security features"

# 2. View updated task structure  
/context impl-1
→ Shows new version with changes

# 3. Check updated planning documents
cat IMPL_PLAN.md
→ Task section shows v1.3 with new features

# 4. Verify TODO list synchronization
cat TODO_LIST.md
→ New subtasks appear with [ ] checkboxes

# 5. Execute replanned task
/task:execute impl-1
→ Works with updated task structure
```

### Session Integration
- **Task Count Updates**: Reflect additions/removals in session stats
- **Document Sync**: Keep IMPL_PLAN.md and TODO_LIST.md current
- **Version Tracking**: Complete audit trail in task JSON
- **Change Traceability**: Link replans to input sources

## Related Commands

- `/context` - View task structure and version history
- `/task:execute` - Execute replanned tasks with new structure  
- `/workflow:action-plan` - For workflow-wide replanning
- `/task:create` - Create new tasks for additional work

---

**System ensures**: Focused single-task replanning with comprehensive change tracking, document synchronization, and complete audit trail