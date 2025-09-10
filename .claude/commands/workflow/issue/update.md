---
name: update
description: Update an existing workflow issue
usage: /workflow:issue:update <issue-id> [changes]

examples:
  - /workflow:issue:update ISS-001
  - /workflow:issue:update ISS-001 --priority=critical
  - /workflow:issue:update ISS-001 --status=closed
---

# Update Workflow Issue (/workflow:issue:update)

## Purpose
Modify attributes and status of an existing workflow issue.

## Usage
```bash
/workflow:issue:update <issue-id> [options]
```

## Quick Updates
Simple attribute changes:
```bash
/workflow:issue:update ISS-001 --priority=critical
/workflow:issue:update ISS-001 --status=closed
/workflow:issue:update ISS-001 --blocking
/workflow:issue:update ISS-001 --type=bug
```

## Interactive Mode (Default)
Without options, opens interactive editor:
```
Issue ISS-001: Add OAuth2 social login support
Current Status: Open | Priority: High | Type: Feature

What would you like to update?
1. Status (open → closed/integrated)
2. Priority (high → critical/medium/low)  
3. Type (feature → bug/optimization/etc)
4. Description
5. Add comment
6. Toggle blocking status
7. Cancel

Choice: _
```

## Available Updates

### Status Changes
- **open** → **closed**: Issue resolved
- **open** → **integrated**: Linked to workflow task
- **closed** → **open**: Reopen issue
- **integrated** → **open**: Unlink from tasks

### Priority Levels
- **critical**: Urgent, blocking progress
- **high**: Important, should address soon
- **medium**: Standard priority
- **low**: Nice-to-have, can defer

### Issue Types  
- **bug**: Something broken that needs fixing
- **feature**: New functionality to implement
- **optimization**: Performance or efficiency improvement
- **refactor**: Code structure improvement
- **documentation**: Documentation updates

### Additional Options
- **blocking/non-blocking**: Whether issue blocks progress
- **description**: Update issue description
- **comments**: Add notes and updates

## Update Process

### Validation
- Verifies issue exists in current session
- Checks valid status transitions
- Validates priority and type values

### Change Tracking
- Records update details
- Tracks who made changes
- Maintains change history

### File Updates
- Updates ISS-XXX.json file
- Refreshes issue-registry.json
- Updates session statistics

## Change History
Maintains audit trail:
```json
{
  "changes": [
    {
      "field": "priority",
      "old_value": "high",
      "new_value": "critical",
      "reason": "Security implications discovered"
    }
  ]
}
```

## Integration Effects

### Task Integration
When status changes to "integrated":
- Links to workflow task (optional)
- Updates task context with issue reference
- Creates bidirectional linking

### Session Updates
- Updates session issue statistics
- Refreshes TodoWrite if applicable
- Updates workflow progress tracking

## Output
Shows:
- What was changed
- Before and after values
- Integration status
- Available next actions

## Error Handling
- **Issue not found**: Lists available issues
- **Invalid status**: Shows valid transitions
- **Permission errors**: Clear error messages
- **File corruption**: Validates and repairs

---

**Result**: Issue successfully updated with change tracking and integration