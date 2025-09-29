---
name: pause
description: Pause the active workflow session
usage: /workflow:session:pause
examples:
  - /workflow:session:pause
---

# Pause Workflow Session (/workflow:session:pause)

## Overview
Pause the currently active workflow session, saving all state for later resumption.

## Usage
```bash
/workflow:session:pause      # Pause current active session
```

## Implementation Flow

### Step 1: Find Active Session
```bash
ls .workflow/.active-* 2>/dev/null | head -1
```

### Step 2: Get Session Name
```bash
basename .workflow/.active-WFS-session-name | sed 's/^\.active-//'
```

### Step 3: Update Session Status
```bash
jq '.status = "paused"' .workflow/WFS-session/workflow-session.json > temp.json
mv temp.json .workflow/WFS-session/workflow-session.json
```

### Step 4: Add Pause Timestamp
```bash
jq '.paused_at = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"' .workflow/WFS-session/workflow-session.json > temp.json
mv temp.json .workflow/WFS-session/workflow-session.json
```

### Step 5: Remove Active Marker
```bash
rm .workflow/.active-WFS-session-name
```

## Simple Bash Commands

### Basic Operations
- **Find active session**: `ls .workflow/.active-*`
- **Get session name**: `basename marker | sed 's/^\.active-//'`
- **Update status**: `jq '.status = "paused"' session.json > temp.json`
- **Add timestamp**: `jq '.paused_at = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"'`
- **Remove marker**: `rm .workflow/.active-session`

### Pause Result
```
Session WFS-user-auth paused
- Status: paused
- Paused at: 2025-09-15T14:30:00Z
- Tasks preserved: 8 tasks
- Can resume with: /workflow:session:resume
```

## Related Commands
- `/workflow:session:resume` - Resume paused session
- `/workflow:session:list` - Show all sessions including paused
- `/workflow:session:status` - Check session state