---
name: workflow-issue-close
description: Close a completed or obsolete workflow issue
usage: /workflow/issue/close <issue-id> [reason]
parent: /workflow/issue
examples:
  - /workflow/issue/close ISS-001
  - /workflow/issue/close ISS-001 "Feature implemented in PR #42"
  - /workflow/issue/close ISS-002 "Duplicate of ISS-001"
---

# Close Workflow Issue (/workflow/issue/close)

## Purpose
Mark an issue as closed/resolved with optional reason documentation.

## Usage
```bash
/workflow/issue/close <issue-id> ["reason"]
```

## Closing Process

### Quick Close
Simple closure without reason:
```bash
/workflow/issue/close ISS-001
```

### Close with Reason
Include closure reason:
```bash
/workflow/issue/close ISS-001 "Feature implemented in PR #42"
/workflow/issue/close ISS-002 "Duplicate of ISS-001"  
/workflow/issue/close ISS-003 "No longer relevant"
```

### Interactive Close (Default)
Without reason, prompts for details:
```
Closing Issue ISS-001: Add OAuth2 social login support
Current Status: Open | Priority: High | Type: Feature

Why is this issue being closed?
1. ✅ Completed - Issue resolved successfully
2. 🔄 Duplicate - Duplicate of another issue
3. ❌ Invalid - Issue is invalid or not applicable  
4. 🚫 Won't Fix - Decided not to implement
5. 📝 Custom reason

Choice: _
```

## Closure Categories

### Completed (Default)
- Issue was successfully resolved
- Implementation finished
- Requirements met
- Ready for review/testing

### Duplicate
- Same as existing issue
- Consolidated into another issue
- Reference to primary issue provided

### Invalid
- Issue description unclear
- Not a valid problem/request
- Outside project scope
- Misunderstanding resolved

### Won't Fix
- Decided not to implement
- Business decision to decline
- Technical constraints prevent
- Priority too low

### Custom Reason
- Specific project context
- Detailed explanation needed
- Complex closure scenario

## Closure Effects

### Status Update
- Changes status from "open" to "closed"
- Records closure timestamp
- Saves closure reason and category

### Integration Cleanup
- Unlinks from workflow tasks (if integrated)
- Removes from active TodoWrite items
- Updates session statistics

### History Preservation
- Maintains full issue history
- Records closure details
- Preserves for future reference

## Session Updates

### Statistics
Updates session issue counts:
- Decrements open issues
- Increments closed issues
- Updates completion metrics

### Progress Tracking
- Updates workflow progress
- Refreshes TodoWrite status
- Updates session health metrics

## Output
Displays:
- Issue closure confirmation
- Closure reason and category
- Updated session statistics  
- Related actions taken

## Reopening
Closed issues can be reopened:
```bash
/workflow/issue/update ISS-001 --status=open
```

## Error Handling
- **Issue not found**: Lists available open issues
- **Already closed**: Shows current status and closure info
- **Integration conflicts**: Handles task unlinking gracefully
- **File errors**: Validates and repairs issue files

## Archive Management
Closed issues:
- Remain in .issues/ directory
- Are excluded from default listings
- Can be viewed with `/workflow/issue/list --closed`
- Maintain full searchability

---

**Result**: Issue properly closed with documented reason and session cleanup