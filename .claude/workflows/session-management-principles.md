# Workflow Session Management Principles

## Overview


This document provides complete technical implementation details for session state management, multi-session registry, command pre-execution protocol, and recovery mechanisms.

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
  "session_version": "2.0",
  "project": "feature description",
  "type": "simple|medium|complex",
  "current_phase": "PLAN|IMPLEMENT|REVIEW",
  "status": "active|paused|completed",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  
  "checkpoints": {
    "plan": {
      "status": "completed|in_progress|pending",
      "documents": ["IMPL_PLAN.md", "TASK_BREAKDOWN.md"],
      "timestamp": "timestamp"
    },
    "implement": {
      "status": "completed|in_progress|pending",
      "agents_completed": ["code-developer"],
      "current_agent": "code-review-agent",
      "todos": {
        "total": 12,
        "completed": 8,
        "in_progress": 1
      },
      "timestamp": "timestamp"
    },
    "review": {
      "status": "completed|in_progress|pending",
      "quality_checks": {
        "code_quality": "passed",
        "test_coverage": "pending"
      }
    }
  },
  
  "context_chain": [],
  "state_transitions": []
}
```

## Phase-Aware Session Management

### Conceptual/Planning Phase
- Tracks planning document generation
- Monitors task decomposition progress
- Preserves planning context and decisions
- Safe interruption at document boundaries

### Implementation Phase
- Integrates with existing TodoWrite system
- Tracks agent progression and outputs
- Maintains file modification history
- Supports multi-agent coordination

### Review Phase
- Tracks validation and quality gates
- Preserves review comments and decisions
- Maintains compliance check status

## Automatic Checkpoints

### Checkpoint Triggers
- **Planning Phase**:
  - After planning document completion
  - After task breakdown generation
  - On user interrupt request

- **Implementation Phase**:
  - After agent completion
  - At TodoWrite milestones
  - After significant file changes
  - On phase transitions

- **Review Phase**:
  - After quality check completion
  - On validation milestones
  - At review agent boundaries

### Checkpoint Strategy
```json
{
  "save_triggers": ["agent_complete", "todo_milestone", "user_interrupt"],
  "save_data": ["agent_outputs", "file_changes", "todo_state"],
  "resume_logic": "skip_completed_continue_sequence"
}
```

## Cross-Phase Context Preservation

### Context Chain Maintenance
- All phase outputs preserved in session
- Context automatically transferred between phases
- Planning documents bridge PLAN → IMPLEMENT phases
- Implementation artifacts bridge IMPLEMENT → REVIEW
- Full audit trail maintained for decisions

### State Transitions
```json
{
  "from": "PLAN",
  "to": "IMPLEMENT",
  "timestamp": "timestamp",
  "trigger": "planning completion",
  "handoff_data": {
    "plan_path": ".workflow/WFS-[topic-slug]/IMPL_PLAN.md",
    "tasks": ["task1", "task2"],
    "complexity": "medium"
  }
}
```

## Recovery Mechanisms

### Automatic Recovery Logic
```python
def resume_workflow():
    session = load_session()
    
    if session.current_phase == "PLAN":
        resume_planning(session.checkpoints.plan)
    elif session.current_phase == "IMPLEMENT":
        resume_implementation(session.checkpoints.implement)
    elif session.current_phase == "REVIEW":
        resume_review(session.checkpoints.review)
```

### State Validation
- Verify required artifacts exist for resumption
- Check file system consistency with session state
- Validate TodoWrite synchronization
- Ensure agent context completeness
- Confirm phase prerequisites met

### Recovery Strategies
- **Complete Recovery**: Full state restoration when possible
- **Partial Recovery**: Resume with warning when some data missing
- **Graceful Degradation**: Restart phase with maximum retained context
- **Manual Intervention**: Request user guidance for complex conflicts

## Agent Integration Protocol

### Required Agent Capabilities
All agents must support:
- Checkpoint save/load functionality
- State validation for resumption
- Context preservation across interrupts
- Progress reporting to session manager

### Phase-Specific Integration
- **Planning Agents**: Auto-save planning outputs
- **Implementation Agents**: Track code changes and test results
- **Review Agents**: Preserve validation outcomes

## Error Handling

### Common Scenarios
1. **Session File Corruption**:
   - Automatic backup before each save
   - Rollback to last known good state
   - Recovery from planning documents

2. **Version Incompatibility**:
   - Automatic migration for minor versions
   - Manual intervention for major changes
   - Backward compatibility for essential fields

3. **Missing Dependencies**:
   - Graceful handling of missing files
   - Regeneration of recoverable artifacts
   - Clear error messages for resolution

4. **Multi-Session Conflicts**:
   - Registry integrity validation
   - Active session collision detection
   - Automatic session status correction

## Session Lifecycle Management

### Complete Session Lifecycle
**1. Registration Phase**
- Add session to global registry (`.workflow/session_status.jsonl`)
- Generate unique session ID in WFS-[topic-slug] format
- Create session directory structure

**2. Activation Phase**  
- Set session as active (deactivates any other active session)
- Initialize session state file (`workflow-session.json`)
- Create base directory structure based on complexity level

**3. Execution Phase**
- Track progress through workflow phases (PLAN → IMPLEMENT → REVIEW)
- Maintain checkpoints at natural boundaries
- Update session state with phase transitions and progress

**4. State Management Phase**
- **Active**: Session is currently being worked on
- **Paused**: Session temporarily suspended, can be resumed
- **Completed**: Session finished successfully

**5. Session Operations**
- **Switching**: Change active session (preserves state of previous)
- **Resumption**: Intelligent recovery from saved state and checkpoints
- **Interruption**: Graceful pause with complete state preservation

### Session State Transitions
```
INACTIVE → ACTIVE → PAUSED → ACTIVE → COMPLETED
    ↑         ↓         ↓         ↑         ↓
  CREATE    PAUSE    SWITCH    RESUME   ARCHIVE
```

## Implementation Guidelines

### Session Management Operations

### Testing Requirements
- Single-phase interruption/resumption
- Multi-phase workflow continuity
- Context preservation validation
- Error recovery scenarios
- Multi-session registry operations
- Session switching without data loss
- Active session inheritance in commands
- Registry integrity validation
- Version migration testing

### Success Metrics
- Zero data loss on resume or session switch
- Context continuity maintained across sessions
- No duplicate work performed
- Full workflow completion capability
- Seamless multi-session management
- Registry integrity maintained
- Commands automatically inherit active session context
- Minimal performance overhead