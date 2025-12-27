---
name: manage
description: Interactive issue management (CRUD) via ccw cli endpoints with menu-driven interface
argument-hint: "[issue-id] [--action list|view|edit|delete|bulk]"
allowed-tools: TodoWrite(*), Bash(*), Read(*), Write(*), AskUserQuestion(*), Task(*)
---

# Issue Manage Command (/issue:manage)

## Overview

Interactive menu-driven interface for issue management using `ccw issue` CLI endpoints:
- **List**: Browse and filter issues
- **View**: Detailed issue inspection
- **Edit**: Modify issue fields
- **Delete**: Remove issues
- **Bulk**: Batch operations on multiple issues

## CLI Endpoints Reference

```bash
# Core endpoints (ccw issue)
ccw issue list                      # List all issues
ccw issue list <id> --json          # Get issue details
ccw issue status <id>               # Detailed status
ccw issue init <id> --title "..."   # Create issue
ccw issue task <id> --title "..."   # Add task
ccw issue bind <id> <solution-id>   # Bind solution

# Queue management
ccw issue queue                     # List current queue
ccw issue queue add <id>            # Add to queue
ccw issue queue list                # Queue history
ccw issue queue switch <queue-id>   # Switch queue
ccw issue queue archive             # Archive queue
ccw issue queue delete <queue-id>   # Delete queue
ccw issue next                      # Get next task
ccw issue done <queue-id>           # Mark completed
ccw issue complete <item-id>        # (legacy alias for done)
```

## Usage

```bash
# Interactive mode (menu-driven)
/issue:manage

# Direct to specific issue
/issue:manage GH-123

# Direct action
/issue:manage --action list
/issue:manage GH-123 --action edit
```

## Implementation

This command delegates to the `issue-manage` skill for detailed implementation.

### Entry Point

```javascript
const issueId = parseIssueId(userInput);
const action = flags.action;

// Show main menu if no action specified
if (!action) {
  await showMainMenu(issueId);
} else {
  await executeAction(action, issueId);
}
```

### Main Menu Flow

1. **Dashboard**: Fetch issues summary via `ccw issue list --json`
2. **Menu**: Present action options via AskUserQuestion
3. **Route**: Execute selected action (List/View/Edit/Delete/Bulk)
4. **Loop**: Return to menu after each action

### Available Actions

| Action | Description | CLI Command |
|--------|-------------|-------------|
| List | Browse with filters | `ccw issue list --json` |
| View | Detail view | `ccw issue status <id> --json` |
| Edit | Modify fields | Update `issues.jsonl` |
| Delete | Remove issue | Clean up all related files |
| Bulk | Batch operations | Multi-select + batch update |

## Data Files

| File | Purpose |
|------|---------|
| `.workflow/issues/issues.jsonl` | Issue records |
| `.workflow/issues/solutions/<id>.jsonl` | Solutions per issue |
| `.workflow/issues/queue.json` | Execution queue |

## Error Handling

| Error | Resolution |
|-------|------------|
| No issues found | Suggest creating with /issue:new |
| Issue not found | Show available issues, ask for correction |
| Invalid selection | Show error, re-prompt |
| Write failure | Check permissions, show error |

## Related Commands

- `/issue:new` - Create structured issue
- `/issue:plan` - Plan solution for issue
- `/issue:queue` - Form execution queue
- `/issue:execute` - Execute queued tasks
