---
name: workflow-session-start
description: Start a new workflow session
usage: /workflow:session:start "task description"
parent: /workflow:session
examples:
  - /workflow:session:start "implement OAuth2 authentication"
  - /workflow:session:start "fix login bug"
---

# Start Workflow Session (/workflow:session:start)

## Purpose
Initialize a new workflow session for the given task description.

## Usage
```bash
/workflow/session/start "task description"
```

## Automatic Behaviors

### Session Creation
- Generates unique session ID: WFS-[topic-slug]
- Creates `.workflow/.active-[session-name]` marker file
- Deactivates any existing active session

### Complexity Detection
Automatically determines complexity based on task description:
- **Simple**: Single module, <5 tasks
- **Medium**: Multiple modules, 5-15 tasks  
- **Complex**: Large scope, >15 tasks

### Directory Structure
Creates session directory with:
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json    # Session metadata
├── IMPL_PLAN.md            # Initial planning template
├── .task/                  # Task management
└── reports/                # Report generation
```

### Phase Initialization
- **Simple**: Ready for direct implementation
- **Medium/Complex**: Ready for planning phase

## Session State
Creates `workflow-session.json` with:
- Session ID and description
- Current phase: INIT → PLAN
- Document tracking
- Task system configuration
- Active marker reference

## Next Steps
After starting a session:
- Use `/workflow/plan` to create implementation plan
- Use `/workflow/execute` to begin implementation
- Use `/context` to view session status

## Error Handling
- **Duplicate session**: Warns if similar session exists
- **Invalid description**: Prompts for valid task description
- **Directory conflicts**: Handles existing directories gracefully

---

**Creates**: New active workflow session ready for planning and execution