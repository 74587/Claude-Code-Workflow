---
name: status
description: Show detailed status of active workflow session
usage: /workflow:session:status

---

# Workflow Session Status (/workflow:session:status)

## Purpose
Display comprehensive status information for the currently active workflow session.

## Usage
```bash
/workflow:session:status
```

## Status Display

### Active Session Overview
```
🚀 Active Session: WFS-oauth-integration
   Description: Implement OAuth2 authentication
   Created: 2025-09-07 14:30:00
   Last updated: 2025-09-08 09:15:00
   Directory: .workflow/WFS-oauth-integration/
```

### Phase Information
```
📋 Current Phase: IMPLEMENTATION
   Status: In Progress
   Started: 2025-09-07 15:00:00
   Progress: 60% complete
   
   Completed Phases: ✅ INIT ✅ PLAN
   Current Phase: 🔄 IMPLEMENT  
   Pending Phases: ⏳ REVIEW
```

### Task Progress
```
📝 Task Status (3/5 completed):
   ✅ IMPL-001: Setup OAuth2 client configuration
   ✅ IMPL-002: Implement Google OAuth integration  
   🔄 IMPL-003: Add Facebook OAuth support (IN PROGRESS)
   ⏳ IMPL-004: Create user profile mapping
   ⏳ IMPL-005: Add OAuth security validation
```

### Document Status
```
📄 Generated Documents:
   ✅ IMPL_PLAN.md (Complete)
   ✅ TODO_LIST.md (Auto-updated)
   📝 .task/impl-*.json (5 tasks)
   📊 reports/ (Ready for generation)
```

### Session Health
```
🔍 Session Health: ✅ HEALTHY
   - Marker file: ✅ Present
   - Directory: ✅ Accessible  
   - State file: ✅ Valid
   - Task files: ✅ Consistent
   - Last checkpoint: 2025-09-08 09:10:00
```

## No Active Session
If no session is active:
```
⚠️  No Active Session

Available Sessions:
- WFS-user-profile (PAUSED) - Use: /workflow/session/switch WFS-user-profile
- WFS-bug-fix-123 (COMPLETED) - Use: /context WFS-bug-fix-123

Create New Session:
/workflow:session:start "your task description"
```

## Quick Actions
Shows contextual next steps:
```
🎯 Suggested Actions:
- Continue current task: /task/execute IMPL-003
- View full context: /context  
- Execute workflow: /workflow/execute
- Plan next steps: /workflow/plan
```

## Error Detection
Identifies common issues:
- Missing marker file
- Corrupted session state
- Inconsistent task files
- Directory permission problems

## Performance Info
```
⚡ Session Performance:
   - Tasks completed: 3/5 (60%)
   - Average task time: 2.5 hours
   - Estimated completion: 2025-09-08 14:00:00
   - Files modified: 12
   - Tests passing: 98%
```

---

**Result**: Comprehensive view of active session status and health