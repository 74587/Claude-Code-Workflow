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
Replans individual tasks with multiple input options, change tracking, and version management.

## Core Principles
**Task System:** @~/.claude/workflows/task-core.md

## Key Features
- **Single-Task Focus**: Operates on individual tasks only
- **Multiple Input Sources**: Text, files, or issue references
- **Version Tracking**: Backup previous versions
- **Change Documentation**: Track all modifications

⚠️ **CRITICAL**: Validates active session before replanning

## Input Sources

### Direct Text (Default)
```bash
/task:replan impl-1 "Add OAuth2 authentication support"
```

### File-based Input
```bash
/task:replan impl-1 updated-specs.md
```
Supports: .md, .txt, .json, .yaml

### Issue Reference
```bash
/task:replan impl-1 ISS-001
```
Loads issue description and requirements

### Interactive Mode
```bash
/task:replan impl-1 --interactive
```
Guided step-by-step modification process with validation

## Replanning Process

1. **Load & Validate**: Read task JSON and validate session
2. **Parse Input**: Process changes from input source
3. **Backup Version**: Create previous version backup
4. **Update Task**: Modify JSON structure and relationships
5. **Save Changes**: Write updated task and increment version
6. **Update Session**: Reflect changes in workflow stats

## Version Management

### Version Tracking
Tasks maintain version history:
```json
{
  "id": "impl-1",
  "version": "1.2",
  "replan_history": [
    {
      "version": "1.2",
      "reason": "Add OAuth2 support",
      "input_source": "direct_text",
      "backup_location": ".task/versions/impl-1-v1.1.json"
    }
  ]
}
```

**Complete schema**: See @~/.claude/workflows/task-core.md

### File Structure
```
.task/
├── impl-1.json                    # Current version
├── versions/
│   └── impl-1-v1.1.json          # Previous backup
└── [new subtasks as needed]
```

## Implementation Updates

### Change Detection
Tracks modifications to:
- Files in implementation.files array
- Dependencies and affected modules
- Risk assessments and performance notes
- Logic flows and code locations

### Analysis Triggers
May require gemini re-analysis when:
- New files need code extraction
- Function locations change
- Dependencies require re-evaluation

## Document Updates

### Planning Document
May update IMPL_PLAN.md sections when task structure changes significantly

### TODO List Sync
If TODO_LIST.md exists, synchronizes:
- New subtasks (with [ ] checkbox)
- Modified tasks (marked as updated)
- Removed subtasks (deleted from list)

## Change Documentation

### Change Summary
Generates brief change log with:
- Version increment (1.1 → 1.2)
- Input source and reason
- Key modifications made
- Files updated/created
- Backup location

## Session Updates

Updates workflow-session.json with:
- Modified task tracking
- Task count changes (if subtasks added/removed)
- Last modification timestamps

## Rollback Support

```bash
/task:replan impl-1 --rollback v1.1

Rollback to version 1.1:
- Restore task from backup
- Remove new subtasks if any
- Update session stats

Confirm rollback? (y/n): y

✅ Task rolled back to version 1.1
```

## Examples

### Text Input
```bash
/task:replan impl-1 "Add OAuth2 authentication support"

Processing changes...
Proposed updates:
+ Add OAuth2 integration
+ Update authentication flow

Apply changes? (y/n): y

✓ Version 1.2 created
✓ Context updated
✓ Backup saved
```

### File Input
```bash
/task:replan impl-2 requirements.md

Loading requirements.md...
Applying specification changes...

✓ Task updated with new requirements
✓ Version 1.1 created
```

## Error Handling

```bash
# Task not found
❌ Task impl-5 not found
→ Check task ID with /context

# Task completed
⚠️ Task impl-1 is completed (cannot replan)
→ Create new task for additional work

# File not found
❌ File requirements.md not found
→ Check file path

# No input provided
❌ Please specify changes needed
→ Provide text, file, or issue reference
```

## Related Commands

- `/context` - View updated task structure
- `/task:execute` - Execute replanned task
- `/task:create` - Create new tasks
- `/workflow:action-plan` - For workflow-wide changes