# Workflow Session Management Principles

## Overview

This document provides simplified session state management with minimal overhead, phase-level tracking, and streamlined coordination.

## Multi-Session Architecture

### Session Registry System
**Lightweight Global Registry**: `.workflow/session_status.jsonl`

The system supports multiple concurrent sessions with a single active session:
```jsonl
{"id":"WFS-oauth-integration","status":"paused","description":"OAuth2 authentication implementation","created":"2025-09-07T10:00:00Z","directory":".workflow/WFS-oauth-integration"}
{"id":"WFS-user-profile","status":"active","description":"User profile feature","created":"2025-09-07T11:00:00Z","directory":".workflow/WFS-user-profile"}
{"id":"WFS-bug-fix-123","status":"completed","description":"Fix login timeout issue","created":"2025-09-06T14:00:00Z","directory":".workflow/WFS-bug-fix-123"}
```

**Registry Management**:
- **Single Active Rule**: Only one session can have `status="active"` 
- **Automatic Registration**: Sessions auto-register on creation
- **Session Discovery**: Commands query registry for active session context
- **Context Inheritance**: Active session provides default workspace and documents

### Command Pre-execution Protocol
**Universal Session Awareness**: All commands automatically check for active session context before execution

```pseudo
FUNCTION execute_command(command, args):
  active_session = get_active_session_from_registry()
  
  IF active_session EXISTS:
    context = load_session_context(active_session.directory)
    workspace = active_session.directory
    inherit_task_context(context)
  ELSE:
    context = create_temporary_workspace()
    workspace = temporary_directory
  
  execute_with_context(command, args, context, workspace)
END FUNCTION
```

**Protocol Benefits**:
- **Active Session Discovery**: Query `.workflow/session_status.jsonl` for active session
- **Context Inheritance**: Use active session directory and documents for command execution
- **Fallback Mode**: Commands can operate without active session (creates temporary workspace)
- **Output Location**: Active session determines where files are created/modified
- **Task Context**: Active session provides current task purpose and requirements

## Individual Session Tracking

All workflow state for each session managed through `workflow-session.json` with comprehensive structure:

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

## Simplified Recovery

### Basic Recovery Logic
```python
def resume_workflow():
    session = load_session()
    
    if session.current_phase == "PLAN":
        check_plan_document_exists()
    elif session.current_phase == "IMPLEMENT":
        load_active_tasks()
    elif session.current_phase == "REVIEW":
        check_implementation_complete()
```

### Minimal State Validation
- Check current phase is valid
- Verify session directory exists
- Confirm basic file structure

### Simple Recovery Strategy
- **Phase Restart**: If unclear state, restart current phase
- **User Confirmation**: Ask user to confirm resume point
- **Minimal Recovery**: Restore basic session info only

## Simplified Agent Integration

### Minimal Agent Requirements
- Report task completion status
- Update task JSON files
- No complex checkpoint management needed

### Phase Integration
- **Planning Agents**: Create planning documents
- **Implementation Agents**: Update task status to completed
- **Review Agents**: Mark review as complete

## Error Handling

### Common Scenarios
1. **Session File Missing**: Create new session file with defaults
2. **Invalid Phase State**: Reset to last known valid phase  
3. **Multi-Session Conflicts**: Auto-resolve by latest timestamp

## Session Lifecycle

### Simple Lifecycle
1. **Create**: Generate session ID and directory
2. **Activate**: Set as current active session
3. **Execute**: Track phase completion only  
4. **Complete**: Mark as finished

### State Transitions
```
INACTIVE → ACTIVE → COMPLETED
    ↑         ↓         ↓
  CREATE    WORK    FINISH
```

## Implementation Guidelines

### Key Principles
- **Minimal State**: Only track essential information
- **Phase-Level Updates**: Avoid frequent micro-updates
- **Simple Recovery**: Basic session restoration only
- **User Control**: Manual checkpoint requests

### Success Metrics
- Fast session resume (< 1 second)
- Minimal file I/O operations
- Clear session state understanding
- No complex synchronization needed