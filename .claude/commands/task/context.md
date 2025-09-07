---
name: task-context
description: Unified task context analysis, status management, and intelligent execution support
usage: /task:context [task-id|--filter=<filter>] [--analyze] [--update] [--sync] [--format=<tree|list|json>] [--detailed]
argument-hint: [task-id or filter] [optional: actions and format options]
examples:
  - /task:context
  - /task:context IMPL-001 --analyze --detailed
  - /task:context --filter="status:active" --format=tree
  - /task:context IMPL-001 --update
  - /task:context --sync
---

### 🚀 Command Overview: /task:context

- **Purpose**: Provides unified task context analysis, status visualization, progress tracking, and intelligent execution support.
- **Core Function**: Acts as a central hub for understanding and managing the state of tasks within a workflow.

### 📜 Core Principles

- **Task Management**: @~/.claude/workflows/task-management-principles.md
- **File Structure**: @~/.claude/workflows/file-structure-standards.md
- **Session Management**: @~/.claude/workflows/session-management-principles.md

### ✨ Core Capabilities

-   **Context Awareness**
    -   Analyzes current state and progress from JSON task files.
    -   Tracks hierarchical task dependencies.
    -   Detects changes in JSON files and status.
    -   Assesses the impact of changes across tasks and files.
    -   Suggests next actions based on current context.
    -   Monitors compliance with file structure standards.
-   **Status Management**
    -   Visualizes task status in `tree`, `list`, and `json` formats.
    -   Tracks hierarchical progress from task files.
    -   Performs batch operations on tasks using filters.
    -   Monitors file integrity and task health.
    -   Exports analysis and status data to various file formats.
    -   Generates status reports and analysis documents.

### 🧠 Primary Operations Logic

The command's behavior is determined by the provided arguments.

```pseudo
FUNCTION main(arguments):
  // Options like --filter and --format modify the behavior of display functions.

  IF --sync is present:
    // Corresponds to: /task:context --sync
    run_context_synchronization()
  ELSE IF --update is present AND task_id is given:
    // Corresponds to: /task:context <task-id> --update
    run_interactive_update_for(task_id)
  ELSE IF --analyze is present AND task_id is given:
    // Corresponds to: /task:context <task-id> --analyze
    run_detailed_analysis_for(task_id)
  ELSE IF --health, --progress, --timeline, etc. are present:
    // Corresponds to specific reporting sub-commands
    generate_specific_report(report_type)
  ELSE IF task_id is provided without other primary action flags:
    // Corresponds to: /task:context <task-id>
    display_task_context_and_quick_actions(task_id)
  ELSE:
    // Default action with no arguments or only filters/formatters
    // Corresponds to: /task:context
    display_global_context_view(filters, format)
END FUNCTION
```

### 🎯 Main Usage Modes & Examples

#### 1. Global Context View
- **Command**: `/task:context`
- **Description**: Provides a high-level overview of the entire workflow's task status.
- **Example Output**:
```
📊 Task Context Overview
━━━━━━━━━━━━━━━━━━━━━━
Workflow: WFS-[topic-slug]
Phase: IMPLEMENT
Progress: 45% (5/11 tasks)

Summary:
✅ Completed: 5
🔄 Active: 2
⏳ Pending: 3
🚫 Blocked: 1

Active Context:
- Current focus: IMPL-002 (In Progress)
- Dependencies clear: Yes
- Blockers: IMPL-004 blocked by IMPL-003

Critical Path:
IMPL-001 → IMPL-003 → IMPL-006

Next Actions:
1. Complete IMPL-002 (90% done)
2. Unblock IMPL-004
3. Start IMPL-005 (ready)
```

#### 2. Task-Specific Analysis
- **Command**: `/task:context IMPL-001 --analyze`
- **Description**: Shows a detailed breakdown of a single task's context, dependencies, and related changes.
- **Example Output**:
```
📋 Task Context: IMPL-001
━━━━━━━━━━━━━━━━━━━━

Status: In Progress
Started: 2h ago
Progress: 60% (2/3 subtasks complete)

Dependencies:
✅ No upstream dependencies
⬇️ Blocks: IMPL-003, IMPL-004

Context Data:
- Requirements: [inherited from workflow]
- Scope: src/auth/*, tests/auth/*
- Agent: code-developer
- Priority: high

Related Changes:
- src/auth/login.ts modified 30m ago
- New issue: "Login timeout too short"
- Workflow update: Security requirement added

Impact if delayed:
⚠️ Will block 2 downstream tasks
⚠️ Critical path - affects timeline
```

#### 3. Interactive Context Update
- **Command**: `/task:context IMPL-001 --update`
- **Description**: Initiates an interactive prompt to modify a task's context data.
- **Example Interaction**:
```
Current context for IMPL-001:
1. Requirements: [JWT, OAuth2]
2. Scope: [src/auth/*]
3. Priority: normal

What to update?
1. Add requirement
2. Modify scope
3. Change priority
4. Add note
> 1

Enter new requirement: Add 2FA support
✅ Context updated
```

#### 4. Context Synchronization
- **Command**: `/task:context --sync`
- **Description**: Reconciles context across the entire task hierarchy, propagating changes and resolving conflicts.
- **Example Output**:
```
🔄 Synchronizing task contexts...
- Workflow → Tasks: Updated 3 tasks
- Parent → Children: Propagated 2 changes
- Dependencies: Resolved 1 conflict
✅ All contexts synchronized
```

### 🖥️ Display Formats (`--format`)

#### Tree Format (`--format=tree`)
```
📁 IMPLEMENT Tasks
├── ✅ IMPL-001: Authentication [Complete]
│   ├── ✅ IMPL-001.1: Design schema
│   ├── ✅ IMPL-001.2: Core implementation
│   └── ✅ IMPL-001.3: Tests
├── 🔄 IMPL-002: Database layer [60%]
│   ├── ✅ IMPL-002.1: Models
│   ├── 🔄 IMPL-002.2: Migrations
│   └── ⏳ IMPL-002.3: Seeds
├── ⏳ IMPL-003: API endpoints [Pending]
└── 🚫 IMPL-004: Integration [Blocked by IMPL-003]
```

#### List Format (`--format=list`)
```
ID       | Title                    | Status    | Progress | Agent           | Priority
---------|--------------------------|-----------|----------|-----------------|----------
IMPL-001 | Authentication          | completed | 100%     | code-developer  | normal
IMPL-002 | Database layer          | active    | 60%      | code-developer  | high
IMPL-003 | API endpoints           | pending   | 0%       | planning-agent  | normal
IMPL-004 | Integration             | blocked   | 0%       | -               | low
```

#### JSON Format (`--format=json`)
- **Description**: Outputs machine-readable JSON, suitable for scripting and tool integration.

### 🔍 Filtering (`--filter`)

- **By Status**:
  - `status:active`
  - `status:pending`
  - `status:blocked`
  - `status:completed`
- **By Other Attributes**:
  - `type:feature`
  - `priority:high`
- **Combining Filters**:
  - `status:active,priority:high`

### 🧠 Context Intelligence Features

- **Change Detection**: Automatically detects file modifications, new issues, workflow updates, and dependency status changes.
- **Impact Analysis**: Assesses the effect of delays or failures on downstream tasks and the overall timeline (`--impact`).
- **Smart Recommendations**: Provides actionable suggestions like which task to focus on, what can be parallelized, or which tasks need breaking down (`--recommend`).

### 📄 Context Data Structure (JSON Schema)

This is the standard schema for a task's context data stored in JSON files.

```json
{
  "task_id": "IMPL-001",
  "title": "Build authentication module",
  "type": "feature",
  "status": "active",
  "priority": "high",
  "agent": "code-developer",

  "context": {
    "inherited_from": "WFS-[topic-slug]",
    "requirements": ["JWT authentication", "OAuth2 support", "2FA support"],
    "scope": ["src/auth/*", "tests/auth/*"],
    "acceptance": ["Module handles JWT tokens", "OAuth2 flow implemented", "2FA integration works"]
  },

  "dependencies": {
    "upstream": [],
    "downstream": ["IMPL-003", "IMPL-004"]
  },

  "execution": {
    "attempts": 1,
    "current_attempt": {
      "started_at": "2025-09-05T10:35:00Z",
      "checkpoints": ["setup", "implement", "test", "validate"],
      "completed_checkpoints": ["setup", "implement"]
    },
    "history": []
  },

  "environment": {
    "files_modified": ["src/auth/login.ts", "src/auth/middleware.ts"],
    "issues": ["ISS-001"],
    "last_activity": "2025-09-05T12:15:00Z"
  },

  "recommendations": {
    "next_action": "Complete test checkpoint",
    "risk": "low",
    "priority_adjustment": "none"
  }
}
```

### 📊 Analysis & Monitoring

- **Progress Report (`--progress`)**: Shows overall progress broken down by type, priority, and velocity.
- **Health Checks (`--health`)**: Reports on task health, highlighting issues like blockers, delays, and repeated failures.
- **Timeline View (`--timeline`)**: Displays a chronological view of recent and upcoming task activities.

### 🛠️ Advanced Features

- **Conflict Detection (`--conflicts`)**: Identifies potential conflicts, such as multiple tasks modifying the same file.
- **Historical Context (`--history`)**: Shows the version history of a task's context data.
- **Context Validation (`--validate`)**: Checks a task's context for completeness and validity against defined rules.

### 🚦 Status Management

- **Update Status**: Change a single task's status using `--set`. Example: `/task:context IMPL-002 --set=active`
- **Bulk Update**: Update multiple tasks matching a filter. Example: `/task:context --filter="status:pending" --set=blocked --reason="Waiting for API"`

- **Valid Status Transitions**:
  `pending` -> `active` -> `completed`
  `pending` -> `blocked`
  `active` -> `blocked`
  `active` -> `failed` -> `pending`

### 💾 File Output Generation

- **Analysis Report (`--report --save`)**:
  - Generates a comprehensive markdown report.
  - **Output**: `.workflow/WFS-[topic-slug]/.summaries/analysis-[timestamp].md`
- **Data Export (`--export=<format>`)**:
  - Exports task data to various formats (`markdown`, `json`, `csv`).
  - **Output**: `.summaries/[output-name]-[timestamp].[format]`
- **Validation Report (`--validate --save`)**:
  - Saves the output of context validation to a file.
  - **Output**: `.summaries/validation-report-[timestamp].md`
- **TODO_LIST.md Generation (`--generate-todo-list`)**:
  - Creates a `TODO_LIST.md` file from the current state of JSON task files.
  - **Output**: `.workflow/WFS-[topic-slug]/TODO_LIST.md`

### 🔗 Integration Points

- **Workflow**: Inherits context from the main workflow and updates `session.json`.
- **Task Relationships**: Manages parent-child and sibling dependencies, including circular dependency detection.
- **Agent Context**: Prepares and optimizes context data for execution by different agent types.
- **TodoWrite Tool**: Coordinates bidirectionally with the TodoWrite tool and `TODO_LIST.md` for seamless status updates (`--sync-todos`).

### ⚠️ Error Handling Examples

- **No Active Workflow**:
  - `❌ No workflow context found`
  - `→ Initialize with: /workflow init`
- **Task Not Found**:
  - `❌ Task IMPL-999 does not exist`
  - `→ View tasks with: /task:status`
- **Context Conflict**:
  - `⚠️ Context conflict detected`
  - `→ Resolve with: /task:context --resolve`

### ⚡ Quick Actions

- **Description**: When viewing a single task, an interactive menu of relevant actions is presented.
- **Example Interaction**:
```bash
/task:context IMPL-002

Quick actions available:
1. Execute task (/task:execute IMPL-002)
2. Analyze context (/task:context IMPL-002 --analyze)
3. Replan task (/task:replan IMPL-002)
4. Break down (/task:breakdown IMPL-002)

Select action: 1
→ Executing IMPL-002...
```

### 🤝 Related Commands

- `/task:create`: Creates new tasks.
- `/task:execute`: Executes a specific task.
- `/task:replan`: Replans a task.
- `/task:breakdown`: Breaks a task into subtasks.
- `/task:sync`: Synchronizes all file systems.
- `/workflow:context`: Provides overall workflow status.
