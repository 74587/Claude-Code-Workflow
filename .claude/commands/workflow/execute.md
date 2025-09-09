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
  
**Session Management:** @~/.claude/workflows/session-management-principles.md
**Agent Orchestration:** @~/.claude/workflows/agent-orchestration-patterns.md

## Execution Philosophy

The intelligent execution approach focuses on:
- **Discovery-first execution** - Automatically discover existing plans and tasks
- **Status-aware coordination** - Execute only tasks that are ready
- **Context-rich agent assignment** - Use complete task JSON data for agent context  
- **Dynamic task orchestration** - Coordinate based on discovered task relationships
- **Progress tracking** - Update task status after agent completion

**IMPORTANT**: Gemini context analysis is automatically applied based on discovered task scope and requirements.

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
- **Complete Context**: Use full task JSON context for agent execution
- **Workflow Integration**: Include session state and IMPL_PLAN.md context
- **Scope Focus**: Direct agents to specific files from task.context.scope
- **Gemini Flags**: Automatically add [GEMINI_CLI_REQUIRED] for multi-file tasks

### 4. Agent Execution & Progress Tracking

```bash
Task(subagent_type="code-developer",
     prompt="[GEMINI_CLI_REQUIRED] Implement authentication logic based on schema",
     description="Execute impl-1.2 with full workflow context and status tracking")
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
  - "test" → test-agent  
  - "docs" → docs-agent
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
     - Workflow: WFS-user-auth authentication system",
     
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