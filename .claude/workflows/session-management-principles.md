# Workflow Session Management Principles

## Overview

This document provides simplified session state management using marker files for active session tracking. 

## Multi-Session Architecture

### Active Session Marker System
**Ultra-Simple Active Tracking**: `.workflow/.active-[session-name]`

The system supports multiple concurrent sessions with a single active session marked by file presence:
```bash
.workflow/
├── WFS-oauth-integration/         # Session directory (paused)
├── WFS-user-profile/             # Session directory (paused)
├── WFS-bug-fix-123/              # Session directory (completed)
└── .active-WFS-user-profile      # Marker file (indicates active session)
```

**Marker File Benefits**:
- **Zero Parsing**: File existence check is atomic and instant
- **Atomic Operations**: File creation/deletion is naturally atomic  
- **Visual Discovery**: `ls .workflow/.active-*` shows active session immediately
- **No Corruption Risk**: No JSON parsing, no file format issues
- **Simple Switching**: Delete old marker + create new marker = session switch

### Command Pre-execution Protocol
**Universal Session Awareness**: All commands automatically detect active session through marker file

```pseudo
FUNCTION execute_command(command, args):
  active_marker = find_file(".workflow/.active-*")
  
  IF active_marker EXISTS:
    session_name = extract_name_from_marker(active_marker)
    session_dir = ".workflow/" + session_name
    context = load_session_context(session_dir + "/workflow-session.json")
    workspace = session_dir
  ELSE:
    context = create_temporary_workspace()
    workspace = temporary_directory
  
  execute_with_context(command, args, context, workspace)
END FUNCTION
```

**Protocol Benefits**:
- **Instant Discovery**: No file parsing, just check file existence
- **Context Inheritance**: Use active session directory for all operations  
- **Fallback Mode**: Commands work without any active session
- **Output Location**: Active session determines file creation location
- **Task Context**: Active session provides current workflow context

### Session State Management

#### Active Session Detection
```bash
# Check for active session
active_session=$(ls .workflow/.active-* 2>/dev/null | head -1)
if [ -n "$active_session" ]; then
  session_name=$(basename "$active_session" | sed 's/^\.active-//')
  echo "Active session: $session_name"
else
  echo "No active session"
fi
```

#### Session Activation
```bash
# Switch to different session
rm .workflow/.active-* 2>/dev/null  # Remove any existing active marker
touch .workflow/.active-WFS-new-feature  # Mark new session as active
```

#### Session Discovery
```bash
# List all available sessions
ls -d .workflow/WFS-*/ 2>/dev/null | sed 's|.workflow/||;s|/$||'

# Show active session status
if ls .workflow/.active-* >/dev/null 2>&1; then
  active=$(ls .workflow/.active-* | sed 's|.workflow/.active-||')
  echo "✅ Active: $active"
else  
  echo "⏸️ No active session"
fi
```

## Individual Session Tracking

All workflow state for each session managed through `workflow-session.json` in each session directory:

### Session State Structure
```json
{
  "session_id": "WFS-[topic-slug]",
  "project": "feature description",
  "type": "simple|medium|complex", 
  "current_phase": "PLAN|IMPLEMENT|REVIEW",
  "status": "active|paused|completed",
  
  "progress": {
    "completed_phases": ["PLAN"],
    "current_tasks": ["impl-1", "impl-2"],
    "last_checkpoint": "2025-09-07T10:00:00Z"
  },
  
  "meta": {
    "created": "2025-09-05T10:00:00Z",
    "updated": "2025-09-07T10:00:00Z"
  }
}
```

**Note**: The `status` field in individual session files is informational only. The actual active status is determined by the presence of `.active-[session-name]` marker file.

## Session Lifecycle Operations

### Create New Session
```bash
# 1. Create session directory
mkdir .workflow/WFS-new-feature

# 2. Initialize workflow-session.json
echo '{"session_id":"WFS-new-feature","status":"active",...}' > .workflow/WFS-new-feature/workflow-session.json

# 3. Set as active (deactivate others automatically)
rm .workflow/.active-* 2>/dev/null
touch .workflow/.active-WFS-new-feature
```

### Switch Session
```bash
# Atomic session switching
rm .workflow/.active-* 2>/dev/null && touch .workflow/.active-WFS-different-feature
```

### Pause Session (Deactivate)
```bash
# Remove active marker (session becomes paused)
rm .workflow/.active-WFS-current-feature
```

### Resume Session
```bash
# Reactivate paused session
rm .workflow/.active-* 2>/dev/null  # Clear any active session
touch .workflow/.active-WFS-paused-session  # Activate target session
```

### Complete Session
```bash
# 1. Update session status
echo '{"session_id":"WFS-feature","status":"completed",...}' > .workflow/WFS-feature/workflow-session.json

# 2. Remove active marker
rm .workflow/.active-WFS-feature

# 3. Optional: Archive session directory
mv .workflow/WFS-feature .workflow/completed/WFS-feature
```

## Simplified Phase Management

### Phase-Level Tracking Only
- **Planning Phase**: Track completion status only
- **Implementation Phase**: Track active tasks, not detailed progress
- **Review Phase**: Track completion status only

### Minimal Checkpoint Strategy  
- **Phase Transitions**: Save state when moving between phases
- **User Request**: Manual checkpoint on explicit user action
- **Session End**: Final state save before closing

### Checkpoint Data (Minimal)
```json
{
  "save_triggers": ["phase_complete", "user_request", "session_end"],
  "save_data": ["phase_status", "active_tasks", "session_meta"],
  "resume_logic": "resume_from_last_phase_checkpoint"
}
```

## Simplified Context Preservation

### Essential Context Only
- Planning documents available to implementation phase
- Implementation results available to review phase
- Minimal handoff data between phases

### Simple State Transitions
```json
{
  "phase_completed": "PLAN", 
  "next_phase": "IMPLEMENT",
  "completed_at": "2025-09-07T10:00:00Z",
  "artifacts": {
    "plan_document": "IMPL_PLAN.md"
  }
}
```

## Error Recovery and Validation

### Session Consistency Checks
```bash
# Validate active session integrity
active_marker=$(ls .workflow/.active-* 2>/dev/null | head -1)
if [ -n "$active_marker" ]; then
  session_name=$(basename "$active_marker" | sed 's/^\.active-//')
  session_dir=".workflow/$session_name"
  
  if [ ! -d "$session_dir" ]; then
    echo "⚠️ Orphaned active marker: $active_marker"
    echo "   Session directory missing: $session_dir"
    echo "   Removing orphaned marker..."
    rm "$active_marker"
  fi
fi
```

### Multi-Active Session Detection
```bash
# Detect multiple active markers (error condition)
active_count=$(ls .workflow/.active-* 2>/dev/null | wc -l)
if [ "$active_count" -gt 1 ]; then
  echo "❌ Multiple active sessions detected:"
  ls .workflow/.active-* | sed 's|.workflow/.active-|  - |'
  echo "   Keeping most recent, removing others..."
  
  # Keep newest, remove others
  newest=$(ls -t .workflow/.active-* 2>/dev/null | head -1)
  ls .workflow/.active-* 2>/dev/null | grep -v "$newest" | xargs rm -f
  echo "   ✅ Resolved: $(basename "$newest" | sed 's/^\.active-//')"
fi
```

### Recovery Strategies
- **Missing Session Directory**: Remove orphaned active marker
- **Multiple Active Markers**: Keep newest, remove others
- **Corrupted Session File**: Recreate from template with session name
- **No Active Session**: Commands work in temporary mode

## Performance Benefits

### Ultra-Fast Operations
- **Session Detection**: Single `ls` command (< 1ms)
- **Session Switching**: Two file operations (delete + create)
- **Status Check**: File existence test (instant)
- **No Parsing Overhead**: Zero JSON/text processing

### Scalability
- **Hundreds of Sessions**: No performance degradation
- **Concurrent Access**: File system handles locking automatically
- **Atomic Operations**: No race conditions or corruption risk

## Implementation Guidelines

### Key Principles
- **File Existence = Truth**: Marker file presence is the single source of truth
- **Atomic State Changes**: All session operations are atomic file operations
- **Visual Management**: Users can see and manage active sessions directly
- **Zero Configuration**: No registry files to maintain or repair
- **Self-Healing**: Automatic detection and resolution of inconsistent states



### Success Metrics
- Fast session resume (< 100ms)
- Zero parsing overhead
- Visual session management
- Self-healing consistency
- No registry maintenance needed

---

**System ensures**: Ultra-simple session management using marker files for instant, atomic, and visually manageable session state tracking.