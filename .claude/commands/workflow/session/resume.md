---
name: workflow-session-resume
description: Resume the most recently paused workflow session
usage: /workflow/session/resume
parent: /workflow/session
---

# Resume Workflow Session (/workflow/session/resume)

## Purpose
Resume the most recently paused workflow session, restoring all context and state.

## Usage
```bash
/workflow/session/resume
```

## Resume Logic

### Session Detection
- Finds most recently paused session
- Loads session state from `workflow-session.json`
- Validates session integrity

### State Restoration
- Creates `.workflow/.active-[session-name]` marker file
- Loads current phase from session state
- Restores appropriate agent context
- Continues from exact interruption point

### Context Continuity
- Restores TodoWrite state
- Loads phase-specific context
- Maintains full audit trail
- Preserves document references

## Phase-Specific Resume

### Planning Phase
- Resumes planning document generation
- Maintains requirement analysis progress
- Continues task breakdown where left off

### Implementation Phase  
- Resumes task execution state
- Maintains agent coordination
- Continues from current task

### Review Phase
- Resumes validation process
- Maintains quality checks
- Continues review workflow

## Session Validation
Before resuming, validates:
- Session directory exists
- Required documents present
- State consistency
- No corruption detected

## Output
Displays:
- Resumed session ID and description
- Current phase and progress
- Available next actions
- Session directory location

## Error Handling
- **No paused sessions**: Lists available sessions to switch to
- **Corrupted session**: Attempts recovery or suggests manual repair
- **Directory missing**: Clear error with recovery options
- **State inconsistency**: Validates and repairs where possible

## Next Actions
After resuming:
- Use `/context` to view current session state
- Continue with phase-appropriate commands
- Check TodoWrite status for next steps

---

**Result**: Previously paused session is now active and ready to continue