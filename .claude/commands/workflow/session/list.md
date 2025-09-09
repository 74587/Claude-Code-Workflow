---
name: list
description: List all workflow sessions with status
usage: /workflow:session:list

---

# List Workflow Sessions (/workflow/session/list)

## Purpose
Display all workflow sessions with their current status, progress, and metadata.

## Usage
```bash
/workflow/session/list
```

## Output Format

### Active Session (Highlighted)
```
✅ WFS-oauth-integration (ACTIVE)
   Description: Implement OAuth2 authentication
   Phase: IMPLEMENTATION
   Created: 2025-09-07 14:30:00
   Directory: .workflow/WFS-oauth-integration/
   Progress: 3/5 tasks completed
```

### Paused Sessions
```
⏸️  WFS-user-profile (PAUSED)
   Description: Build user profile management
   Phase: PLANNING  
   Created: 2025-09-06 10:15:00
   Last active: 2025-09-07 09:20:00
   Directory: .workflow/WFS-user-profile/
```

### Completed Sessions
```
✅ WFS-bug-fix-123 (COMPLETED)
   Description: Fix login security vulnerability
   Completed: 2025-09-05 16:45:00
   Directory: .workflow/WFS-bug-fix-123/
```

## Status Indicators
- **✅ ACTIVE**: Currently active session (has marker file)
- **⏸️ PAUSED**: Session paused, can be resumed
- **✅ COMPLETED**: Session finished successfully
- **❌ FAILED**: Session ended with errors
- **🔄 INTERRUPTED**: Session was interrupted unexpectedly

## Session Discovery
Searches for:
- `.workflow/WFS-*` directories
- Reads `workflow-session.json` from each
- Checks for `.active-*` marker files
- Sorts by last activity date

## Quick Actions
For each session, shows available actions:
- **Resume**: `/workflow/session/resume` (paused sessions)
- **Switch**: `/workflow/session/switch <session-id>`
- **View**: `/context <session-id>`

## Empty State
If no sessions exist:
```
No workflow sessions found.

Create a new session:
/workflow/session/start "your task description"
```

## Error Handling
- **Directory access**: Handles permission issues
- **Corrupted sessions**: Shows warning but continues listing
- **Missing metadata**: Shows partial info with warnings

---

**Result**: Complete overview of all workflow sessions and their current state