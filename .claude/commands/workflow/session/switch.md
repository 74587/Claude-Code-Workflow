---
name: switch
description: Switch to a different workflow session
usage: /workflow:session:switch <session-id>

examples:
  - /workflow:session:switch WFS-oauth-integration
  - /workflow:session:switch WFS-user-profile
---

# Switch Workflow Session (/workflow:session:switch)

## Purpose
Switch the active session to a different workflow session.

## Usage
```bash
/workflow:session:switch <session-id>
```

## Session Switching Process

### Validation
- Verifies target session exists
- Checks session directory integrity
- Validates session state

### Active Session Handling
- Automatically pauses currently active session
- Saves current session state
- Removes current `.active-*` marker file

### Target Session Activation
- Creates `.active-[target-session]` marker file
- Updates session status to "active"
- Loads session context and state

### State Transition
```
Current Active → Paused (auto-saved)
Target Session → Active (context loaded)
```

## Context Loading
After switching:
- Loads target session's phase and progress
- Restores appropriate agent context
- Makes session's documents available
- Updates TodoWrite to target session's tasks

## Output
Displays:
- Previous active session (now paused)
- New active session details
- Current phase and progress
- Available next actions

## Session ID Formats
Accepts various formats:
- Full ID: `WFS-oauth-integration`
- Partial match: `oauth` (if unique)
- Index from list: `1` (from session list order)

## Error Handling
- **Session not found**: Lists available sessions
- **Invalid session**: Shows session validation errors
- **Already active**: No-op with confirmation message
- **Switch failure**: Maintains current session, shows error

## Quick Reference
After switching, shows:
- Session description and phase
- Recent activity and progress
- Suggested next commands
- Directory location

## Integration
Commands executed after switch will:
- Use new active session context
- Save artifacts to new session directory
- Update new session's state and progress

---

**Result**: Different session is now active and ready for work