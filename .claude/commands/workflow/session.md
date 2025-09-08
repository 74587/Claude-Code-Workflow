---
name: workflow-session
description: Workflow session management with multi-session registry support
usage: /workflow:session <start|pause|resume|list|switch|status> [complexity] ["task description"]
argument-hint: start|pause|resume|list|switch|status [simple|medium|complex] ["task description or session ID"]
examples:
  - /workflow:session start complex "implement OAuth2 authentication"
  - /workflow:session start simple "fix login bug"  
  - /workflow:session pause
  - /workflow:session resume
  - /workflow:session list
  - /workflow:session switch WFS-oauth-integration
  - /workflow:session status
---

# Workflow Session Management Commands

## Overview
Enhanced session management with marker file-based active session tracking. Provides unified state tracking through `workflow-session.json` (individual sessions) and `.active-[session-name]` marker files (active status).

## Core Principles

**Session Management:** @~/.claude/workflows/session-management-principles.md

## Session Registry System

### Multi-Session Management
The system uses marker files to track active sessions:
```bash
.workflow/
├── WFS-oauth-integration/         # Session directory (paused)
├── WFS-user-profile/             # Session directory (paused)
├── WFS-bug-fix-123/              # Session directory (completed)
└── .active-WFS-user-profile      # Marker file (indicates active session)
```

### Registry Rules
- **Single Active Session**: Only one session can be active at a time
- **Automatic Registration**: New sessions auto-register on creation
- **Session Discovery**: Commands query registry to find active session
- **Context Inheritance**: Active session provides default context for all commands

## Commands

### Start Workflow Session (初始化)
```bash
/workflow:session start <complexity> "task description"
```
**Session Initialization Process:**
- **Replaces /workflow:init** - Initializes new workflow session
- Generates unique session ID (WFS-[topic-slug] format)
- **Sets active marker** - Creates `.workflow/.active-[session-name]` marker file
- **Sets as active session** - Deactivates other sessions automatically
- Creates comprehensive directory structure
- Determines complexity (auto-detect if not specified)
- Sets initial phase based on complexity

**Directory Structure Creation:**
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json          # Session state and metadata  
├── IMPL_PLAN.md                    # Combined planning document (always created)
├── [.brainstorming/]               # Optional brainstorming phase
├── [TODO_LIST.md]                  # Progress tracking (auto-triggered)
├── reports/                        # Generated reports directory
└── .task/                          # Task management directory
    ├── impl-*.json                 # Hierarchical task definitions
    ├── impl-*.*.json               # Subtasks (up to 3 levels deep)
    └── impl-*.*.*.json             # Detailed subtasks
```

**File Generation Standards:**
- **workflow-session.json**: Core session state with comprehensive document tracking
- **IMPL_PLAN.md**: Initial planning document template (all complexity levels)
- **reports/ directory**: Created for future report generation by other workflow commands
- **.task/ directory**: Hierarchical task management system setup
- **Automatic backups**: Session state backups created during critical operations

**Phase Initialization:**
- **Simple**: Ready for direct IMPLEMENT (minimal documentation)
- **Medium/Complex**: Ready for PLAN phase (document generation enabled)

**Session State Setup:**
- Creates workflow-session.json with simplified document tracking
- Initializes hierarchical task management system (max 3 levels)
- Creates IMPL_PLAN.md for all complexity levels
- Auto-triggers TODO_LIST.md for Medium/Complex workflows
- **NOTE:** Does NOT execute workflow - only sets up infrastructure

**Next Steps After Initialization:**
- Use `/workflow:plan` to populate IMPL_PLAN.md (all workflows)
- Use `/workflow:implement` for task execution (all workflows)
- Use `/workflow:review` for validation phase

## File Generation and State Management

### Initial File Creation
When starting a new session, the following files are automatically generated:

#### workflow-session.json Structure
```json
{
  "session_id": "WFS-[topic-slug]",
  "created_at": "2025-09-07T14:00:00Z",
  "type": "simple|medium|complex",
  "description": "[user task description]",
  "current_phase": "INIT",
  "status": "active",
  "phases": {
    "INIT": {
      "status": "completed",
      "completed_at": "2025-09-07T14:00:00Z",
      "files_created": ["IMPL_PLAN.md", "workflow-session.json"],
      "directories_created": [".task", "reports"]
    },
    "BRAINSTORM": {
      "status": "pending",
      "enabled": false
    },
    "PLAN": {
      "status": "pending", 
      "enabled": true
    },
    "IMPLEMENT": {
      "status": "pending",
      "enabled": true
    },
    "REVIEW": {
      "status": "pending",
      "enabled": true
    }
  },
  "documents": {
    "planning": {
      "IMPL_PLAN.md": {
        "status": "template_created",
        "path": ".workflow/WFS-[topic-slug]/IMPL_PLAN.md",
        "created_at": "2025-09-07T14:00:00Z",
        "type": "planning_document"
      }
    }
  },
  "task_system": {
    "enabled": true,
    "max_depth": 3,
    "task_count": 0,
    "directory": ".task"
  },
  "registry": {
    "active_marker": ".workflow/.active-[session-name]",
    "active_session": true
  }
}
```

#### Initial IMPL_PLAN.md Template
```markdown
# Implementation Plan
*Session: WFS-[topic-slug] | Created: 2025-09-07 14:00:00*

## Project Overview
- **Description**: [user task description]
- **Complexity**: [simple|medium|complex]
- **Estimated Effort**: [TBD]
- **Target Completion**: [TBD]

## Requirements Analysis
*To be populated by planning phase*

## Task Breakdown  
*To be populated by planning phase*

## Implementation Strategy
*To be populated by planning phase*

## Success Criteria
*To be populated by planning phase*

---
*Template created by /workflow:session start*
*Use /workflow:plan to populate this document*
```

#### Recovery Operations
- **Auto-recovery**: On session corruption or inconsistency
- **Manual recovery**: Via `/workflow:session recover --from-backup`
- **Integrity checks**: Automatic validation on session load

### Session Registry Management

#### Active Session Marker (.workflow/.active-[session-name])
```bash
# Active session is indicated by presence of marker file
ls .workflow/.active-* 2>/dev/null
# Output: .workflow/.active-WFS-oauth-integration
```

#### Registry Operations
- **Registration**: Automatic on session creation
- **Status Updates**: Real-time status synchronization
- **Cleanup**: Automatic removal of completed sessions (optional)
- **Discovery**: Used by all workflow commands for session context

### Pause Workflow
```bash
/workflow:session pause
```
- Immediately saves complete session state
- Preserves context across all phases (conceptual/action/implementation)
- Sets status to "interrupted" with timestamp
- Shows resume instructions
- Maintains TodoWrite synchronization

### Resume Workflow
```bash
/workflow:session resume
```
- Detects current phase from workflow-session.json
- Loads appropriate agent context and state
- Continues from exact interruption point
- Maintains full context continuity
- Restores TodoWrite state

### List Sessions
```bash
/workflow:session list
```
- Displays all sessions from registry with status
- Shows session ID, status, description, and creation date
- Highlights currently active session
- Provides quick overview of all workflow sessions

### Switch Active Session
```bash
/workflow:session switch <session-id>
```
- Switches the active session to the specified session ID
- Automatically pauses the currently active session
- Updates registry to set new session as active
- Validates that target session exists and is valid
- Commands executed after switch will use new active session context

### Session Status
```bash
/workflow:session status
```
- Shows current active session details
- Displays session phase, progress, and document status
- Lists available sessions from registry
- Provides quick session health check

### Session State
Session state is tracked through two complementary systems:

#### Active Session Marker (`.workflow/.active-[session-name]`)
Lightweight active session tracking:
```bash
# Check for active session
if ls .workflow/.active-* >/dev/null 2>&1; then
  active_session=$(ls .workflow/.active-* | sed 's|.workflow/.active-||')
  echo "Active session: $active_session"
else
  echo "No active session"
fi
```

#### Individual Session State (`workflow-session.json`)
Detailed session state with document management:
```json
{
  "session_id": "WFS-user-auth-system", 
  "project": "OAuth2 authentication",
  "type": "complex",
  "status": "active|paused|completed",
  "current_phase": "PLAN|IMPLEMENT|REVIEW",
  "created": "2025-09-05T10:30:00Z",
  "directory": ".workflow/WFS-user-auth-system",
  "documents": {
    "IMPL_PLAN.md": {
      "status": "generated", 
      "path": ".workflow/WFS-user-auth-system/IMPL_PLAN.md",
      "last_updated": "2025-09-05T10:30:00Z"
    },
    "TODO_LIST.md": {
      "status": "auto_triggered", 
      "path": ".workflow/WFS-user-auth-system/TODO_LIST.md",
      "last_updated": "2025-09-05T11:20:00Z"
    }
  },
  "task_system": {
    "enabled": true,
    "directory": ".workflow/WFS-user-auth-system/.task",
    "next_main_task_id": 1,
    "max_depth": 3,
    "task_count": {
      "total": 0,
      "main_tasks": 0,
      "subtasks": 0
    }
  }
}
```

To check status, use: `/workflow:status`
To mark complete: Simply finish all tasks and review phase

## Session State Management

### Session Responsibilities
- **Lifecycle Management**: Start, pause, resume sessions
- **State Persistence**: Save and restore workflow state
- **Phase Tracking**: Monitor current phase (PLAN/IMPLEMENT/REVIEW)
- **Context Preservation**: Maintain context across interruptions

### What Session Does NOT Do
- **No Execution**: Does not run agents or execute tasks
- **No Planning**: Does not generate planning documents
- **No Implementation**: Does not run code development
- **Execution Delegation**: All execution via appropriate phase commands:
  - `/workflow:plan` - Planning execution
  - `/workflow:implement` - Implementation execution
  - `/workflow:review` - Review execution

## Automatic Checkpoints
@~/.claude/workflows/session-management-principles.md

Checkpoints created by phase commands:
- `/workflow:plan` creates checkpoints during planning
- `/workflow:implement` creates checkpoints after agents
- `/workflow:review` creates final validation checkpoint
- Session commands only manage checkpoint restoration

## Cross-Phase Context Preservation
- All phase outputs preserved in session
- Context automatically transferred between phases
- PRD documents bridge conceptual → action planning
- Implementation plans bridge action → implementation
- Full audit trail maintained for decisions

## State Validation
- Verify required artifacts exist for resumption
- Check file system consistency with session state
- Validate TodoWrite synchronization
- Ensure agent context completeness