---
name: resume
description: Resume the most recently paused workflow session with automatic session discovery and status update
---

# Resume Workflow Session (/workflow:session:resume)

## Overview
Resume the most recently paused workflow session, restoring all context and state.

## Usage
```bash
/workflow:session:resume     # Resume most recent paused session
```

## Implementation Flow

### Step 1: Find Paused Sessions
```bash
ccw session list --location active
# Filter for sessions with status="paused"
```

### Step 2: Check Session Status
```bash
ccw session WFS-session read workflow-session.json
# Check .status field in response
```

### Step 3: Find Most Recent Paused
```bash
ccw session list --location active
# Sort by created_at, filter for paused status
```

### Step 4: Update Session Status to Active
```bash
ccw session WFS-session status active
```

## Simple Commands

### Basic Operations
- **List sessions**: `ccw session list --location active`
- **Check status**: `ccw session WFS-xxx read workflow-session.json`
- **Update status**: `ccw session WFS-xxx status active`

### Resume Result
```
Session WFS-user-auth resumed
- Status: active
- Paused at: 2025-09-15T14:30:00Z
- Resumed at: 2025-09-15T15:45:00Z
- Ready for: /workflow:execute
```
## session_manager Tool Alternative

Use `ccw tool exec session_manager` for session resume:

### Update Session Status
```bash
# Update status to active
ccw tool exec session_manager '{
  "operation": "update",
  "session_id": "WFS-xxx",
  "content_type": "session",
  "content": {
    "status": "active",
    "resumed_at": "2025-12-10T08:00:00Z"
  }
}'
```

### Read Session Status
```bash
ccw tool exec session_manager '{"operation":"read","session_id":"WFS-xxx","content_type":"session"}'
```
