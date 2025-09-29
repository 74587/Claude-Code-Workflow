---
name: list
description: List all workflow sessions with status
usage: /workflow:session:list
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

### Step 1: Find All Sessions
```bash
ls .workflow/WFS-* 2>/dev/null
```

### Step 2: Check Active Session
```bash
ls .workflow/.active-* 2>/dev/null | head -1
```

### Step 3: Read Session Metadata
```bash
jq -r '.session_id, .status, .project' .workflow/WFS-session/workflow-session.json
```

### Step 4: Count Task Progress
```bash
ls .workflow/WFS-session/.task/*.json 2>/dev/null | wc -l
ls .workflow/WFS-session/.summaries/*.md 2>/dev/null | wc -l
```

### Step 5: Get Creation Time
```bash
jq -r '.created_at // "unknown"' .workflow/WFS-session/workflow-session.json
```

## Simple Bash Commands

### Basic Operations
- **List sessions**: `ls .workflow/WFS-*`
- **Find active**: `ls .workflow/.active-*`
- **Read session data**: `jq -r '.session_id, .status' session.json`
- **Count tasks**: `ls .task/*.json | wc -l`
- **Count completed**: `ls .summaries/*.md | wc -l`
- **Get timestamp**: `jq -r '.created_at' session.json`

## Simple Output Format

### Session List Display
```
Workflow Sessions:

✅ WFS-oauth-integration (ACTIVE)
   Project: OAuth2 authentication system
   Status: active
   Progress: 3/8 tasks completed
   Created: 2025-09-15T10:30:00Z

⏸️ WFS-user-profile (PAUSED)
   Project: User profile management
   Status: paused
   Progress: 1/5 tasks completed
   Created: 2025-09-14T14:15:00Z

📁 WFS-database-migration (COMPLETED)
   Project: Database schema migration
   Status: completed
   Progress: 4/4 tasks completed
   Created: 2025-09-13T09:00:00Z

Total: 3 sessions (1 active, 1 paused, 1 completed)
```

### Status Indicators
- **✅**: Active session
- **⏸️**: Paused session
- **📁**: Completed session
- **❌**: Error/corrupted session

### Quick Commands
```bash
# Count all sessions
ls .workflow/WFS-* | wc -l

# Show only active
ls .workflow/.active-* | basename | sed 's/^\.active-//'

# Show recent sessions
ls -t .workflow/WFS-*/workflow-session.json | head -3
```

## Related Commands
- `/workflow:session:start` - Create new session
- `/workflow:session:switch` - Switch to different session
- `/workflow:session:status` - Detailed session info