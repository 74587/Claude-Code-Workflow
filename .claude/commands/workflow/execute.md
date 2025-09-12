---
name: execute
description: Coordinate agents for existing workflow tasks with automatic discovery
usage: /workflow:execute
argument-hint: none
examples:
  - /workflow:execute
---

# Workflow Execute Command (/workflow:execute)

## Overview
Coordinates multiple agents for executing existing workflow tasks through automatic discovery and intelligent task orchestration. Analyzes workflow folders, checks task statuses, and coordinates agent execution based on discovered plans.

## Core Principles

## Execution Philosophy

The intelligent execution approach focuses on:
- **Discovery-first execution** - Automatically discover existing plans and tasks
- **Status-aware coordination** - Execute only tasks that are ready
- **Context-rich agent assignment** - Use complete task JSON data for agent context  
- **Dynamic task orchestration** - Coordinate based on discovered task relationships
- **Progress tracking** - Update task status after agent completion

**GEMINI_CLI_REQUIRED Marker**:
- **Purpose**: Forces agent to analyze existing codebase before implementation
- **Auto-trigger**: When task.analysis_source = "gemini" OR scope > 3 files
- **Agent Action**: MUST execute Gemini CLI as first step

**analysis_source 到标记的映射**:
- **"gemini"** → 添加 [GEMINI_CLI_REQUIRED]
- **"auto-detected"** + scope > 3 files → 添加 [GEMINI_CLI_REQUIRED]
- **"manual"** → 不添加标记

## Execution Flow

### 1. Discovery & Analysis Phase
```
Workflow Discovery:
├── Locate workflow folder (provided or current session)
├── Load workflow-session.json for session state  
├── Scan .task/ directory for all task JSON files
├── Read IMPL_PLAN.md for workflow context
├── Analyze task statuses and dependencies
└── Determine executable tasks
```

**Discovery Logic:**
- **Folder Detection**: Use provided folder or find current active session
- **Task Inventory**: Load all impl-*.json files from .task/ directory
- **Status Analysis**: Check pending/active/completed/blocked states
- **Dependency Check**: Verify all task dependencies are met
- **Execution Queue**: Build list of ready-to-execute tasks

### 2. TodoWrite Coordination Setup
**Always First**: Create comprehensive TodoWrite based on discovered tasks

```markdown
# Workflow Execute Coordination
*Session: WFS-[topic-slug]*

## Execution Plan
- [ ] **TASK-001**: [Agent: planning-agent] [GEMINI_CLI_REQUIRED] Design auth schema (impl-1.1)
- [ ] **TASK-002**: [Agent: code-developer] [GEMINI_CLI_REQUIRED] Implement auth logic (impl-1.2)  
- [ ] **TASK-003**: [Agent: code-review-agent] Review implementations
- [ ] **TASK-004**: Update task statuses and session state

**Marker Legend**: [GEMINI_CLI_REQUIRED] = Agent must analyze codebase context first
```

### 3. Agent Context Assignment
For each executable task:

```json
{
  "task": {
    "id": "impl-1.1",
    "title": "Design auth schema",
    "context": {
      "requirements": ["JWT authentication", "User model design"],
      "scope": ["src/auth/models/*"],
      "acceptance": ["Schema validates JWT tokens"]
    },
    "implementation": {
      "files": [
        {
          "path": "src/auth/models/User.ts",
          "location": {
            "function": "UserSchema",
            "lines": "10-50",
            "description": "User model definition"
          },
          "original_code": "// Requires gemini analysis for current schema",
          "modifications": {
            "current_state": "Basic user model without auth fields",
            "proposed_changes": [
              "Add JWT token fields to schema",
              "Include OAuth provider fields"
            ],
            "logic_flow": [
              "createUser() ───► validateSchema() ───► generateJWT()",
              "◊─── if OAuth ───► linkProvider() ───► storeTokens()"
            ],
            "reason": "Support modern authentication patterns",
            "expected_outcome": "Flexible user schema supporting multiple auth methods"
          }
        }
      ],
      "context_notes": {
        "dependencies": ["mongoose", "jsonwebtoken"],
        "affected_modules": ["auth-middleware", "user-service"],
        "risks": [
          "Schema changes require database migration",
          "Existing user data compatibility"
        ],
        "performance_considerations": "Index JWT fields for faster lookups",
        "error_handling": "Graceful schema validation errors"
      },
      "analysis_source": "auto-detected"
    }
  },
  "workflow": {
    "session": "WFS-user-auth", 
    "phase": "IMPLEMENT",
    "plan_context": "Authentication system with OAuth2 support"
  },
  "focus_modules": ["src/auth/", "tests/auth/"],
  "gemini_required": true
}
```

**Context Assignment Rules:**
- **Complete Context**: Use full task JSON context including implementation field for agent execution
- **Implementation Details**: Pass complete implementation.files array to agents for precise execution
- **Code Context**: Include original_code snippets and logic_flow diagrams in agent prompts
- **Risk Awareness**: Alert agents to implementation.context_notes.risks before execution
- **Workflow Integration**: Include session state and IMPL_PLAN.md context
- **Scope Focus**: Direct agents to specific files from implementation.files[].path
- **Gemini Marker**: Auto-add [GEMINI_CLI_REQUIRED] when analysis_source = "gemini"

### 4. Agent Execution & Progress Tracking

```bash
Task(subagent_type="code-developer",
     prompt="[GEMINI_CLI_REQUIRED] Implement authentication logic based on schema
     
     Task Context: impl-1.2 - Implement auth logic
     Session Context:
     - Workflow Directory: .workflow/WFS-user-auth/
     - TODO_LIST Location: .workflow/WFS-user-auth/TODO_LIST.md
     - Summaries Directory: .workflow/WFS-user-auth/.summaries/
     - Task JSON Location: .workflow/WFS-user-auth/.task/impl-1.2.json
     
     Implementation Details:
     - Target File: src/auth/models/User.ts
     - Function: UserSchema (lines 10-50)
     - Current State: Basic user model without auth fields
     - Required Changes: Add JWT token fields, Include OAuth provider fields
     - Logic Flow: createUser() ───► validateSchema() ───► generateJWT()
     - Dependencies: mongoose, jsonwebtoken
     - Risks: Schema changes require database migration, Existing user data compatibility
     - Performance: Index JWT fields for faster lookups
     
     IMPORTANT: Update TODO_LIST.md and create summary in provided directories upon completion.
     Use implementation details above for precise, targeted development.",
     description="Execute impl-1.2 with full workflow context and implementation details")
```

**Execution Protocol:**
- **Sequential Execution**: Respect task dependencies and execution order
- **Progress Monitoring**: Track through TodoWrite updates
- **Status Updates**: Update task JSON status after each completion
- **Cross-Agent Handoffs**: Coordinate results between related tasks

## Discovery & Analysis Process

### File Structure Analysis
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json     # Session state and stats
├── IMPL_PLAN.md             # Workflow context and requirements  
├── .task/                   # Task definitions
│   ├── impl-1.json         # Main tasks
│   ├── impl-1.1.json       # Subtasks
│   └── impl-1.2.json       # Detailed tasks
└── .summaries/             # Completed task summaries
```

### Task Status Assessment
```pseudo
function analyze_tasks(task_files):
  executable_tasks = []
  
  for task in task_files:
    if task.status == "pending" and dependencies_met(task):
      if task.subtasks.length == 0:  // leaf task
        executable_tasks.append(task)
      else:  // container task - check subtasks
        if all_subtasks_ready(task):
          executable_tasks.extend(task.subtasks)
  
  return executable_tasks
```

### Automatic Agent Assignment
Based on discovered task data:
- **task.agent field**: Use specified agent from task JSON
- **task.type analysis**: 
  - "feature" → code-developer
  - "test" → code-review-test-agent  
  - "docs" → code-developer
  - "review" → code-review-agent
- **Gemini context**: Auto-assign based on task.context.scope and requirements

## Agent Task Assignment Patterns

### Discovery-Based Assignment
```bash
# Agent receives complete discovered context
Task(subagent_type="code-developer",
     prompt="[GEMINI_CLI_REQUIRED] Execute impl-1.2: Implement auth logic
     
     Context from discovery:
     - Requirements: JWT authentication, OAuth2 support
     - Scope: src/auth/*, tests/auth/*
     - Dependencies: impl-1.1 (completed)
     - Workflow: WFS-user-auth authentication system
     
     Session Context:
     - Workflow Directory: .workflow/WFS-user-auth/
     - TODO_LIST Location: .workflow/WFS-user-auth/TODO_LIST.md
     - Summaries Directory: .workflow/WFS-user-auth/.summaries/
     
     CRITICAL: Update TODO_LIST.md and create completion summary using provided paths.",
     
     description="Agent executes with full discovered context")
```

### Status Tracking Integration
```bash  
# After agent completion, update discovered task status
update_task_status("impl-1.2", "completed")
mark_dependent_tasks_ready(task_dependencies)
```

## Coordination Strategies

### Automatic Coordination
- **Task Dependencies**: Execute in dependency order from discovered relationships
- **Agent Handoffs**: Pass results between agents based on task hierarchy  
- **Progress Updates**: Update TodoWrite and JSON files after each completion

### Context Distribution
- **Rich Context**: Each agent gets complete task JSON + workflow context
- **Focus Areas**: Direct agents to specific files from task.context.scope
- **Inheritance**: Subtasks inherit parent context automatically
- **Session Integration**: Include workflow-session.json state in agent context

## Status Management

### Task Status Updates
```json
// Before execution
{
  "id": "impl-1.2",
  "status": "pending",
  "execution": {
    "attempts": 0,
    "last_attempt": null
  }
}

// After execution  
{
  "id": "impl-1.2", 
  "status": "completed",
  "execution": {
    "attempts": 1,
    "last_attempt": "2025-09-08T14:30:00Z"
  }
}
```

### Session State Updates
```json
{
  "current_phase": "EXECUTE",
  "last_execute_run": "2025-09-08T14:30:00Z"
}
```

## Error Handling & Recovery

### Discovery Issues
```bash
# No active session found
❌ No active workflow session found
→ Use: /workflow:session:start "project name" first

# No executable tasks  
⚠️ All tasks completed or blocked
→ Check: /context for task status overview

# Missing task files
❌ Task impl-1.2 referenced but JSON file missing
→ Fix: /task/create or repair task references
```

### Execution Recovery
- **Failed Agent**: Retry with adjusted context or different agent
- **Blocked Dependencies**: Skip and continue with available tasks
- **Context Issues**: Reload from JSON files and session state

## Integration Points

### Automatic Behaviors
- **Discovery on start** - Analyze workflow folder structure
- **TodoWrite coordination** - Generate based on discovered tasks  
- **Agent context preparation** - Use complete task JSON data
- **Status synchronization** - Update JSON files after completion

### Next Actions
```bash  
# After /workflow:execute completion
/context                  # View updated task status
/task:execute impl-X      # Execute specific remaining tasks  
/workflow:review          # Move to review phase when complete
```

## Related Commands

- `/context` - View discovered tasks and current status
- `/task:execute` - Execute individual tasks (user-controlled)
- `/workflow:session:status` - Check session progress and dependencies
- `/workflow:review` - Move to review phase after completion

---

**System ensures**: Intelligent task discovery with context-rich agent coordination and automatic progress tracking