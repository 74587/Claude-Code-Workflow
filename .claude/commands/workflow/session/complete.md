---
name: complete
description: Mark the active workflow session as complete and remove active flag
usage: /workflow:session:complete

examples:
  - /workflow:session:complete
---

# Complete Workflow Session (/workflow:session:complete)

## Purpose
Mark the currently active workflow session as complete, update its status, and remove the active flag marker.

## Usage
```bash
/workflow:session:complete
```

## Behavior

### Session Completion Process
1. **Locate Active Session**: Find current active session via `.workflow/.active-*` marker file
2. **Update Session Status**: Modify `workflow-session.json` with completion data
3. **Remove Active Flag**: Delete `.workflow/.active-[session-name]` marker file
4. **Generate Summary**: Display completion report and statistics

### Status Updates
Updates `workflow-session.json` with:
- **status**: "completed"
- **completed_at**: Current timestamp
- **final_phase**: Current phase at completion
- **completion_type**: "manual" (distinguishes from automatic completion)

### State Preservation
Preserves all session data:
- Implementation plans and documents
- Task execution history
- Generated artifacts and reports
- Session configuration and metadata

## Completion Summary Display

### Session Overview
```
✅ Session Completed: WFS-oauth-integration
   Description: Implement OAuth2 authentication
   Created: 2025-09-07 14:30:00
   Completed: 2025-09-12 16:45:00
   Duration: 5 days, 2 hours, 15 minutes
   Final Phase: IMPLEMENTATION
```

### Progress Summary
```
📊 Session Statistics:
   - Tasks completed: 5/5 (100%)
   - Files modified: 12
   - Tests created: 8
   - Documentation updated: 3 files
   - Average task duration: 2.5 hours
```

### Generated Artifacts
```
📄 Session Artifacts:
   ✅ IMPL_PLAN.md (Complete implementation plan)
   ✅ TODO_LIST.md (Final task status)
   ✅ .task/ (5 completed task files)
   📊 reports/ (Session reports available)
```

### Archive Information
```
🗂️  Session Archive:
   Directory: .workflow/WFS-oauth-integration/
   Status: Completed and archived
   Access: Use /context WFS-oauth-integration for review
```

## No Active Session
If no active session exists:
```
⚠️  No Active Session to Complete

Available Options:
- View all sessions: /workflow:session:list
- Start new session: /workflow:session:start "task description"
- Resume paused session: /workflow:session:resume
```

## Next Steps Suggestions
After completion, displays contextual actions:
```
🎯 What's Next:
- View session archive: /context WFS-oauth-integration
- Start related session: /workflow:session:start "build on OAuth work"
- Review all sessions: /workflow:session:list
- Create project report: /workflow/report
```

## Error Handling

### Common Error Scenarios
- **No active session**: Clear message with alternatives
- **Corrupted session state**: Validates before completion, offers recovery
- **File system issues**: Handles permissions and access problems
- **Incomplete tasks**: Warns about unfinished work, allows forced completion

### Validation Checks
Before completing, verifies:
- Session directory exists and is accessible
- `workflow-session.json` is valid and readable
- Marker file exists and matches session
- No critical errors in session state

### Forced Completion
For problematic sessions:
```bash
# Option to force completion despite issues
/workflow:session:complete --force
```

## Integration with Workflow System

### Session Lifecycle
Completes the session workflow:
- INIT → PLAN → IMPLEMENT → **COMPLETE**
- Maintains session history for reference
- Preserves all artifacts and documentation

### TodoWrite Integration
- Synchronizes final TODO state
- Marks all remaining tasks as archived
- Preserves task history in session directory

### Context System
- Session remains accessible via `/context <session-id>`
- All documents and reports remain available
- Can be referenced for future sessions

## Command Variations

### Basic Completion
```bash
/workflow:session:complete
```

### With Summary Options
```bash
/workflow:session:complete --detailed    # Show detailed statistics
/workflow:session:complete --quiet       # Minimal output
/workflow:session:complete --force       # Force completion despite issues
```

## Session State After Completion

### Directory Structure Preserved
```
.workflow/WFS-[session-name]/
├── workflow-session.json    # Updated with completion data
├── IMPL_PLAN.md            # Preserved
├── TODO_LIST.md            # Final state preserved
├── .task/                  # All task files preserved
└── reports/                # Generated reports preserved
```

### Session JSON Example
```json
{
  "id": "WFS-oauth-integration",
  "description": "Implement OAuth2 authentication",
  "status": "completed",
  "created_at": "2025-09-07T14:30:00Z",
  "completed_at": "2025-09-12T16:45:00Z",
  "completion_type": "manual",
  "final_phase": "IMPLEMENTATION",
  "tasks_completed": 5,
  "tasks_total": 5
}
```

---

**Result**: Current active session is marked as complete, archived, and no longer active. All session data is preserved for future reference.