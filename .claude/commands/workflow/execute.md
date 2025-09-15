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

**Analysis Marker**:
- **[MULTI_STEP_ANALYSIS]**: Indicates sequential pre-execution analysis required
  - **Auto-trigger**: When task.pre_analysis is an array (default format)
  - **Agent Action**: Execute comprehensive pre-analysis BEFORE implementation begins
    - Process each step sequentially with specified templates and methods
    - Expand brief actions into full analysis tasks
    - Gather context, understand patterns, identify requirements
    - Use method specified in each step (gemini/codex/manual/auto-detected)

**pre_analysis to Marker Mapping**:
- **Array format (multi-step pre-analysis)**:
  - Add [MULTI_STEP_ANALYSIS] - triggers comprehensive pre-execution analysis
  - Agent processes each step with specified method (gemini/codex/manual/auto-detected)
  - Agent expands each action into comprehensive analysis based on template

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
- [ ] **TASK-001**: [Agent: planning-agent] [MULTI_STEP_ANALYSIS] Design auth schema (impl-1.1)
- [ ] **TASK-002**: [Agent: code-developer] [MULTI_STEP_ANALYSIS] Implement auth logic (impl-1.2)  
- [ ] **TASK-003**: [Agent: code-review-agent] Review implementations
- [ ] **TASK-004**: Update task statuses and session state

**Marker Legend**:
- [MULTI_STEP_ANALYSIS] = Agent must execute multi-step pre-execution analysis
- [PREPARATION_INCLUDED] = Task includes preparation phase (analyze then implement)
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
      "pre_analysis": [
        {
          "action": "analyze auth",
          "template": "~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt",
          "method": "gemini"
        },
        {
          "action": "security review",
          "template": "~/.claude/workflows/cli-templates/prompts/analysis/security.txt",
          "method": "gemini"
        },
        {
          "action": "implement feature",
          "template": "~/.claude/workflows/cli-templates/prompts/development/feature.txt",
          "method": "codex"
        }
      ]
    }
  },
  "workflow": {
    "session": "WFS-user-auth", 
    "phase": "IMPLEMENT",
    "plan_context": "Authentication system with OAuth2 support"
  },
  "focus_modules": ["src/auth/", "tests/auth/"]
}
```

**Context Assignment Rules:**
- **Complete Context**: Use full task JSON context including implementation field for agent execution
- **Implementation Details**: Pass complete implementation.files array to agents for precise execution
- **Code Context**: Include original_code snippets and logic_flow diagrams in agent prompts
- **Risk Awareness**: Alert agents to implementation.context_notes.risks before execution
- **Workflow Integration**: Include session state and IMPL_PLAN.md context
- **Scope Focus**: Direct agents to specific files from implementation.files[].path
- **Analysis Marker**: Auto-add [MULTI_STEP_ANALYSIS] when pre_analysis is array format
- **Merged Task Handling**: Add [PREPARATION_INCLUDED] marker when preparation_complexity exists

### 4. Agent Execution & Progress Tracking

```bash
Task(subagent_type="code-developer",
     prompt="[PREPARATION_INCLUDED] [MULTI_STEP_ANALYSIS] Analyze auth patterns and implement JWT authentication system

     Task Context: impl-1.2 - Saturated task with merged preparation and execution

     PREPARATION PHASE (preparation_complexity: simple, estimated_prep_time: 20min):
     1. Review existing auth patterns in the codebase
     2. Check JWT library compatibility with current stack
     3. Analyze current session management approach

     EXECUTION PHASE:
     Based on preparation findings, implement JWT authentication system

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

     Focus Paths (from task JSON): $(~/.claude/scripts/read-task-paths.sh .workflow/WFS-user-auth/.task/impl-1.2.json)
     Gemini Command: ~/.claude/scripts/gemini-wrapper -p "$(~/.claude/scripts/read-task-paths.sh .workflow/WFS-user-auth/.task/impl-1.2.json) @{CLAUDE.md}"

     IMPORTANT:
     1. Document both preparation analysis results and implementation in summary
     2. Update TODO_LIST.md and create summary in provided directories upon completion
     3. Use preparation findings to inform implementation decisions",
     description="Execute saturated task with preparation and implementation phases")
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
# Agent receives complete discovered context with saturation handling
Task(subagent_type="code-developer",
     prompt="[PREPARATION_INCLUDED] [MULTI_STEP_ANALYSIS] Execute impl-1.2: Analyze and implement auth logic

     TASK TYPE: Saturated task (preparation_complexity: simple)

     PREPARATION PHASE:
     - Review existing auth patterns and conventions
     - Check JWT library compatibility
     - Analyze current session management

     EXECUTION PHASE:
     Implement JWT authentication based on preparation findings

     Context from discovery:
     - Requirements: JWT authentication, OAuth2 support
     - Scope: src/auth/*, tests/auth/*
     - Dependencies: impl-1.1 (completed)
     - Workflow: WFS-user-auth authentication system

     Session Context:
     - Workflow Directory: .workflow/WFS-user-auth/
     - TODO_LIST Location: .workflow/WFS-user-auth/TODO_LIST.md
     - Summaries Directory: .workflow/WFS-user-auth/.summaries/
     - Task JSON: .workflow/WFS-user-auth/.task/impl-1.2.json

     Focus Paths: $(~/.claude/scripts/read-task-paths.sh .workflow/WFS-user-auth/.task/impl-1.2.json)
     Analysis Command: Use ~/.claude/scripts/gemini-wrapper -p \"$(~/.claude/scripts/read-task-paths.sh .workflow/WFS-user-auth/.task/impl-1.2.json) @{CLAUDE.md}\"

     CRITICAL:
     1. Execute preparation phase first, then use findings for implementation
     2. Use task-specific paths for focused analysis
     3. Document both phases in completion summary
     4. Update TODO_LIST.md and create completion summary using provided paths.",

     description="Agent executes saturated task with preparation and implementation phases")
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

