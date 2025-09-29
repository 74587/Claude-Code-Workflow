---
name: resume
description: Resume the most recently paused workflow session
usage: /workflow:session:resume
examples:
  - /workflow:session:resume
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
ls .workflow/WFS-* 2>/dev/null
```

### Step 2: Check Session Status
```bash
jq -r '.status' .workflow/WFS-session/workflow-session.json
```

### Step 3: Find Most Recent Paused
```bash
ls -t .workflow/WFS-*/workflow-session.json | head -1
```

### Step 4: Update Session Status
```bash
jq '.status = "active"' .workflow/WFS-session/workflow-session.json > temp.json
mv temp.json .workflow/WFS-session/workflow-session.json
```

### Step 5: Add Resume Timestamp
```bash
jq '.resumed_at = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"' .workflow/WFS-session/workflow-session.json > temp.json
mv temp.json .workflow/WFS-session/workflow-session.json
```

### Step 6: Create Active Marker
```bash
touch .workflow/.active-WFS-session-name
```

## Simple Bash Commands

### Basic Operations
- **List sessions**: `ls .workflow/WFS-*`
- **Check status**: `jq -r '.status' session.json`
- **Find recent**: `ls -t .workflow/*/workflow-session.json | head -1`
- **Update status**: `jq '.status = "active"' session.json > temp.json`
- **Add timestamp**: `jq '.resumed_at = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"'`
- **Create marker**: `touch .workflow/.active-session`

### Resume Result
```
Session WFS-user-auth resumed
- Status: active
- Paused at: 2025-09-15T14:30:00Z
- Resumed at: 2025-09-15T15:45:00Z
- Ready for: /workflow:execute
```

## Related Commands
- `/workflow:session:pause` - Pause current session
- `/workflow:execute` - Continue workflow execution
- `/workflow:session:list` - Show all sessions