---
name: list
description: List all workflow sessions with status filtering, shows session metadata and progress information
examples:
  - /workflow:session:list
---

# List Workflow Sessions (/workflow:session:list)

## Overview
Display all workflow sessions with their current status, progress, and metadata.

## Usage
```bash
/workflow:session:list       # Show all sessions with status
```

## Implementation Flow

### Step 1: List All Sessions
```bash
ccw session list --location both
```

### Step 2: Get Session Statistics
```bash
ccw session stats WFS-session
# Returns: tasks count by status, summaries count, has_plan
```

### Step 3: Read Session Metadata
```bash
ccw session read WFS-session --type session
# Returns: session_id, status, project, created_at, etc.
```

## Simple Commands

### Basic Operations
- **List all sessions**: `ccw session list`
- **List active only**: `ccw session list --location active`
- **Read session data**: `ccw session read WFS-xxx --type session`
- **Get task stats**: `ccw session stats WFS-xxx`

## Simple Output Format

### Session List Display
```
Workflow Sessions:

[ACTIVE] WFS-oauth-integration
   Project: OAuth2 authentication system
   Status: active
   Progress: 3/8 tasks completed
   Created: 2025-09-15T10:30:00Z

[PAUSED] WFS-user-profile
   Project: User profile management
   Status: paused
   Progress: 1/5 tasks completed
   Created: 2025-09-14T14:15:00Z

[COMPLETED] WFS-database-migration
   Project: Database schema migration
   Status: completed
   Progress: 4/4 tasks completed
   Created: 2025-09-13T09:00:00Z

Total: 3 sessions (1 active, 1 paused, 1 completed)
```

### Status Indicators
- **[ACTIVE]**: Active session
- **[PAUSED]**: Paused session
- **[COMPLETED]**: Completed session
- **[ERROR]**: Error/corrupted session

### Quick Commands
```bash
# Count all sessions
ls .workflow/active/WFS-* | wc -l

# Show recent sessions
ls -t .workflow/active/WFS-*/workflow-session.json | head -3
```
## session_manager Tool Alternative

Use `ccw tool exec session_manager` for simplified session listing:

### List All Sessions (Active + Archived)
```bash
ccw tool exec session_manager '{"operation":"list","location":"both","include_metadata":true}'

# Response:
# {
#   "success": true,
#   "result": {
#     "active": [{"session_id":"WFS-xxx","metadata":{...}}],
#     "archived": [{"session_id":"WFS-yyy","metadata":{...}}],
#     "total": 2
#   }
# }
```

### List Active Sessions Only
```bash
ccw tool exec session_manager '{"operation":"list","location":"active","include_metadata":true}'
```

### Read Specific Session
```bash
ccw tool exec session_manager '{"operation":"read","session_id":"WFS-xxx","content_type":"session"}'
```

### Operation Reference
| Old Pattern | session_manager |
|------------|-----------------|
| `ls .workflow/active/WFS-*` | `{"operation":"list","location":"active"}` |
| `find ... -type d` | `{"operation":"list"}` returns session_id list |
| `jq -r '.status' session.json` | `{"operation":"read","content_type":"session"}` |
| `cat workflow-session.json` | `{"operation":"read","content_type":"session"}` |
