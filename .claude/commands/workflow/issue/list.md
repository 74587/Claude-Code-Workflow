---
name: workflow-issue-list
description: List and filter workflow issues
usage: /workflow:issue:list
parent: /workflow:issue
examples:
  - /workflow:issue:list
  - /workflow:issue:list --open
  - /workflow:issue:list --priority=high
---

# List Workflow Issues (/workflow:issue:list)

## Purpose
Display all issues and change requests within the current workflow session.

## Usage
```bash
/workflow:issue:list [filter]
```

## Optional Filters
Simple keyword-based filtering:
```bash
/workflow:issue:list --open           # Only open issues
/workflow:issue:list --closed         # Only closed issues
/workflow:issue:list --critical       # Critical priority
/workflow:issue:list --high           # High priority
/workflow:issue:list --bug            # Bug type issues
/workflow:issue:list --feature        # Feature type issues
/workflow:issue:list --blocking       # Blocking issues only
```

## Display Format

### Open Issues
```
🔴 ISS-001: Add OAuth2 social login support
   Type: Feature | Priority: High | Created: 2025-09-07
   Status: Open | Impact: Medium
   
🔴 ISS-002: Fix user avatar security vulnerability  
   Type: Bug | Priority: Critical | Created: 2025-09-08
   Status: Open | Impact: High | 🚫 BLOCKING
```

### Closed Issues
```
✅ ISS-003: Update authentication documentation
   Type: Documentation | Priority: Low
   Status: Closed | Completed: 2025-09-05
   Reason: Documentation updated in PR #45
```

### Integrated Issues
```
🔗 ISS-004: Implement rate limiting
   Type: Feature | Priority: Medium
   Status: Integrated → IMPL-003
   Integrated: 2025-09-06 | Task: impl-3.json
```

## Summary Stats
```
📊 Issue Summary for WFS-oauth-integration:
   Total: 4 issues
   🔴 Open: 2 | ✅ Closed: 1 | 🔗 Integrated: 1
   🚫 Blocking: 1 | ⚡ Critical: 1 | 📈 High: 1
```

## Empty State
If no issues exist:
```
No issues found for current session.

Create your first issue:
/workflow:issue:create "describe the issue or request"
```

## Quick Actions
For each issue, shows available actions:
- **Update**: `/workflow:issue:update ISS-001`
- **Integrate**: Link to workflow tasks  
- **Close**: `/workflow:issue:close ISS-001`
- **View Details**: Full issue information

## Session Context
- Lists issues from current active session
- Shows session name and directory
- Indicates if .issues/ directory exists

## Sorting
Issues are sorted by:
1. Blocking status (blocking first)
2. Priority (critical → high → medium → low)
3. Creation date (newest first)

## Performance
- Fast loading from JSON files
- Cached issue registry
- Efficient filtering

---

**Result**: Complete overview of all workflow issues with their current status