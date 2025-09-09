---
name: pause
description: Pause the active workflow session
usage: /workflow:session:pause

---

# Pause Workflow Session (/workflow:session:pause)

## Purpose
Pause the currently active workflow session, saving all state for later resumption.

## Usage
```bash
/workflow:session:pause
```

## Behavior

### State Preservation
- Saves complete session state to `workflow-session.json`
- Preserves context across all phases
- Maintains TodoWrite synchronization
- Creates checkpoint timestamp

### Active Session Handling
- Removes `.workflow/.active-[session-name]` marker file
- Session becomes paused (no longer active)
- Other commands will work in temporary mode

### Context Saved
- Current phase and progress
- Generated documents and artifacts
- Task execution state
- Agent context and history

## Status Update
Updates session status to:
- **status**: "paused"
- **paused_at**: Current timestamp
- **resumable**: true

## Output
Displays:
- Session ID that was paused
- Current phase and progress
- Resume instructions
- Session directory location

## Resume Instructions
Shows how to resume:
```bash
/workflow:session:resume        # Resume this session
/workflow:session:list          # View all sessions
/workflow:session:switch <id>   # Switch to different session
```

## Error Handling
- **No active session**: Clear message that no session is active
- **Save errors**: Handles file system issues gracefully
- **State corruption**: Validates session state before saving

---

**Result**: Active session is safely paused and can be resumed later