---
name: complete
description: Mark the active workflow session as complete and remove active flag
examples:
  - /workflow:session:complete
  - /workflow:session:complete --detailed
---

# Complete Workflow Session (/workflow:session:complete)

## Overview
Mark the currently active workflow session as complete, update its status, and remove the active flag marker.

## Usage
```bash
/workflow:session:complete           # Complete current active session
/workflow:session:complete --detailed # Show detailed completion summary
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
jq '.status = "completed"' .workflow/WFS-session/workflow-session.json > temp.json
mv temp.json .workflow/WFS-session/workflow-session.json
```

### Step 4: Add Completion Timestamp
```bash
jq '.completed_at = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"' .workflow/WFS-session/workflow-session.json > temp.json
mv temp.json .workflow/WFS-session/workflow-session.json
```

### Step 5: Count Final Statistics
```bash
find .workflow/WFS-session/.task/ -name "*.json" -type f 2>/dev/null | wc -l
find .workflow/WFS-session/.summaries/ -name "*.md" -type f 2>/dev/null | wc -l
```

### Step 6: Remove Active Marker
```bash
rm .workflow/.active-WFS-session-name
```

## Simple Bash Commands

### Basic Operations
- **Find active session**: `find .workflow/ -name ".active-*" -type f`
- **Get session name**: `basename marker | sed 's/^\.active-//'`
- **Update status**: `jq '.status = "completed"' session.json > temp.json`
- **Add timestamp**: `jq '.completed_at = "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"'`
- **Count tasks**: `find .task/ -name "*.json" -type f | wc -l`
- **Count completed**: `find .summaries/ -name "*.md" -type f 2>/dev/null | wc -l`
- **Remove marker**: `rm .workflow/.active-session`

### Completion Result
```
Session WFS-user-auth completed
- Status: completed
- Started: 2025-09-15T10:00:00Z
- Completed: 2025-09-15T16:30:00Z
- Duration: 6h 30m
- Total tasks: 8
- Completed tasks: 8
- Success rate: 100%
```

### Detailed Summary (--detailed flag)
```
Session Completion Summary:
├── Session: WFS-user-auth
├── Project: User authentication system
├── Total time: 6h 30m
├── Tasks completed: 8/8 (100%)
├── Files generated: 24 files
├── Summaries created: 8 summaries
├── Status: All tasks completed successfully
└── Location: .workflow/WFS-user-auth/
```

### Error Handling
```bash
# No active session
find .workflow/ -name ".active-*" -type f 2>/dev/null || echo "No active session found"

# Incomplete tasks
task_count=$(find .task/ -name "*.json" -type f | wc -l)
summary_count=$(find .summaries/ -name "*.md" -type f 2>/dev/null | wc -l)
test $task_count -eq $summary_count || echo "Warning: Not all tasks completed"
```

## Related Commands
- `/workflow:session:list` - View all sessions including completed
- `/workflow:session:start` - Start new session
- `/workflow:status` - Check completion status before completing