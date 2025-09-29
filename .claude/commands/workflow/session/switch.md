---
name: switch
description: Switch to a different workflow session
usage: /workflow:session:switch <session-id>
argument-hint: session-id to switch to
examples:
  - /workflow:session:switch WFS-oauth-integration
  - /workflow:session:switch WFS-user-profile
---

# Switch Workflow Session (/workflow:session:switch)

## Overview
Switch the active session to a different workflow session.

## Usage
```bash
/workflow:session:switch WFS-session-name     # Switch to specific session
```

## Implementation Flow

### Step 1: Validate Target Session
```bash
test -d .workflow/WFS-target-session && echo "Session exists"
```

### Step 2: Pause Current Session
```bash
ls .workflow/.active-* 2>/dev/null | head -1
jq '.status = "paused"' .workflow/current-session/workflow-session.json > temp.json
```

### Step 3: Remove Current Active Marker
```bash
rm .workflow/.active-* 2>/dev/null
```

### Step 4: Activate Target Session
```bash
jq '.status = "active"' .workflow/WFS-target/workflow-session.json > temp.json
mv temp.json .workflow/WFS-target/workflow-session.json
```

### Step 5: Create New Active Marker
```bash
touch .workflow/.active-WFS-target-session
```

### Step 6: Add Switch Timestamp
```bash
jq '.switched_at = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"' .workflow/WFS-target/workflow-session.json > temp.json
mv temp.json .workflow/WFS-target/workflow-session.json
```

## Simple Bash Commands

### Basic Operations
- **Check session exists**: `test -d .workflow/WFS-session`
- **Find current active**: `ls .workflow/.active-*`
- **Pause current**: `jq '.status = "paused"' session.json > temp.json`
- **Remove marker**: `rm .workflow/.active-*`
- **Activate target**: `jq '.status = "active"' target.json > temp.json`
- **Create marker**: `touch .workflow/.active-target`

### Switch Result
```
Switched to session: WFS-oauth-integration
- Previous: WFS-user-auth (paused)
- Current: WFS-oauth-integration (active)
- Switched at: 2025-09-15T15:45:00Z
- Ready for: /workflow:execute
```

### Error Handling
```bash
# Session not found
test -d .workflow/WFS-nonexistent || echo "Error: Session not found"

# No sessions available
ls .workflow/WFS-* 2>/dev/null || echo "No sessions available"
```

## Related Commands
- `/workflow:session:list` - Show all available sessions
- `/workflow:session:pause` - Pause current before switching
- `/workflow:execute` - Continue with new active session