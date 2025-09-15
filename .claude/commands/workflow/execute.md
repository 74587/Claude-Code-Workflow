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

**Flow Control Execution**:
- **[FLOW_CONTROL]**: Indicates sequential flow control execution required
  - **Auto-trigger**: When task.flow_control.pre_analysis is an array (default format)
  - **Agent Action**: Execute flow control steps sequentially BEFORE implementation begins
    - Process each step with command execution and context accumulation
    - Load dependency summaries and parent task context
    - Execute CLI tools, scripts, and agent commands as specified
    - Pass context between steps via named variables
    - Handle errors according to per-step error strategies

**Flow Control Step Processing**:
- **Sequential Execution**: Steps processed in order with context flow
  - Each step can use outputs from previous steps via ${variable_name}
  - Dependency summaries loaded automatically from .summaries/
  - Context accumulates through the execution chain
  - Error handling per step (skip_optional, fail, retry_once, manual_intervention)

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
- **Task Inventory**: Load all IMPL-*.json files from .task/ directory
- **Status Analysis**: Check pending/active/completed/blocked states
- **Dependency Check**: Verify all task dependencies are met
- **Execution Queue**: Build list of ready-to-execute tasks

### 2. TodoWrite Coordination Setup
**Always First**: Create comprehensive TodoWrite based on discovered tasks

```markdown
# Workflow Execute Coordination
*Session: WFS-[topic-slug]*

## Execution Plan
- [ ] **TASK-001**: [Agent: planning-agent] [FLOW_CONTROL] Design auth schema (IMPL-1.1)
- [ ] **TASK-002**: [Agent: code-developer] [FLOW_CONTROL] Implement auth logic (IMPL-1.2)  
- [ ] **TASK-003**: [Agent: code-review-agent] Review implementations
- [ ] **TASK-004**: Update task statuses and session state

**Marker Legend**:
- [FLOW_CONTROL] = Agent must execute flow control steps with context accumulation
```

### 3. Agent Context Assignment
For each executable task:

```json
{
  "task": {
    "id": "IMPL-1.1",
    "title": "Design auth schema",
    "status": "pending",

    "meta": {
      "type": "feature",
      "agent": "code-developer"
    },

    "context": {
      "requirements": ["JWT authentication", "User model design"],
      "focus_paths": ["src/auth/models", "tests/auth"],
      "acceptance": ["Schema validates JWT tokens"],
      "parent": "IMPL-1",
      "depends_on": [],
      "inherited": {
        "from": "IMPL-1",
        "context": ["Authentication system architecture completed"]
      },
      "shared_context": {
        "auth_strategy": "JWT with refresh tokens"
      }
    },

    "flow_control": {
      "pre_analysis": [
        {
          "step": "gather_context",
          "action": "Load dependency summaries",
          "command": "bash(echo 'No dependencies for this initial task')",
          "output_to": "dependency_context",
          "on_error": "skip_optional"
        },
        {
          "step": "analyze_patterns",
          "action": "Analyze existing auth patterns",
          "command": "bash(~/.claude/scripts/gemini-wrapper -p '@{src/auth/**/*} analyze authentication patterns with context: [dependency_context]')",
          "output_to": "pattern_analysis",
          "on_error": "fail"
        },
        {
          "step": "implement",
          "action": "Design JWT schema based on analysis",
          "command": "bash(codex --full-auto exec 'Design JWT schema using analysis: [pattern_analysis] and context: [dependency_context]')",
          "on_error": "manual_intervention"
        }
      ],
      "implementation_approach": "Design flexible user schema supporting JWT and OAuth authentication",
      "target_files": [
        "src/auth/models/User.ts:UserSchema:10-50"
      ]
    }
  },
  "workflow": {
    "session": "WFS-user-auth",
    "phase": "IMPLEMENT",
    "plan_context": "Authentication system with OAuth2 support"
  }
}
```

**Context Assignment Rules:**
- **Complete Context**: Use full task JSON context including flow_control field for agent execution
- **Flow Control Processing**: Execute flow_control.pre_analysis steps sequentially with context accumulation
- **Dependency Integration**: Load summaries from context.depends_on automatically
- **Mandatory Dependency Reading**: For tasks with dependencies, MUST read previous task summary documents
- **Context Inheritance**: Use dependency summaries to maintain consistency and include context.inherited data from parent tasks
- **Workflow Integration**: Include session state and IMPL_PLAN.md context
- **Focus Scope**: Direct agents to specific paths from context.focus_paths array
- **Flow Control Marker**: Auto-add [FLOW_CONTROL] when flow_control.pre_analysis exists
- **Target File Guidance**: Use flow_control.target_files for precise file targeting

### 4. Agent Execution & Progress Tracking

```bash
Task(subagent_type="code-developer",
     prompt="[FLOW_CONTROL] Execute IMPL-1.2: Implement JWT authentication system with flow control

     Task Context: IMPL-1.2 - Flow control managed execution

     FLOW CONTROL EXECUTION:
     Execute the following steps sequentially with context accumulation:

     Step 1 (gather_context): Load dependency summaries
     Command: for dep in ${depends_on}; do cat .summaries/$dep-summary.md 2>/dev/null || echo "No summary for $dep"; done
     Output: dependency_context

     Step 2 (analyze_patterns): Analyze existing auth patterns
     Command: ~/.claude/scripts/gemini-wrapper -p '@{src/auth/**/*} analyze authentication patterns with context: [dependency_context]'
     Output: pattern_analysis

     Step 3 (implement): Implement JWT based on analysis
     Command: codex --full-auto exec 'Implement JWT using analysis: [pattern_analysis] and context: [dependency_context]'

     Session Context:
     - Workflow Directory: .workflow/WFS-user-auth/
     - TODO_LIST Location: .workflow/WFS-user-auth/TODO_LIST.md
     - Summaries Directory: .workflow/WFS-user-auth/.summaries/
     - Task JSON Location: .workflow/WFS-user-auth/.task/IMPL-1.2.json

     Implementation Guidance:
     - Approach: Design flexible user schema supporting JWT and OAuth authentication
     - Target Files: src/auth/models/User.ts:UserSchema:10-50
     - Focus Paths: src/auth/models, tests/auth
     - Dependencies: From context.depends_on
     - Inherited Context: [context.inherited]

     IMPORTANT:
     1. Execute flow control steps in sequence with error handling
     2. Accumulate context through step chain
     3. Create comprehensive summary with 'Outputs for Dependent Tasks' section
     4. Update TODO_LIST.md upon completion",
     description="Execute task with flow control step processing")
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
│   ├── IMPL-1.json         # Main tasks
│   ├── IMPL-1.1.json       # Subtasks
│   └── IMPL-1.2.json       # Detailed tasks
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
     prompt="[FLOW_CONTROL] Execute IMPL-1.2: Analyze and implement auth logic

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
     - Dependencies: IMPL-1.1 (completed)
     - Workflow: WFS-user-auth authentication system

     Session Context:
     - Workflow Directory: .workflow/WFS-user-auth/
     - TODO_LIST Location: .workflow/WFS-user-auth/TODO_LIST.md
     - Summaries Directory: .workflow/WFS-user-auth/.summaries/
     - Task JSON: .workflow/WFS-user-auth/.task/IMPL-1.2.json

     Focus Paths: $(~/.claude/scripts/read-task-paths.sh .workflow/WFS-user-auth/.task/IMPL-1.2.json)
     Analysis Command: Use ~/.claude/scripts/gemini-wrapper -p \"$(~/.claude/scripts/read-task-paths.sh .workflow/WFS-user-auth/.task/IMPL-1.2.json) @{CLAUDE.md}\"

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
update_task_status("IMPL-1.2", "completed")
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
  "id": "IMPL-1.2",
  "status": "pending",
  "execution": {
    "attempts": 0,
    "last_attempt": null
  }
}

// After execution  
{
  "id": "IMPL-1.2", 
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
❌ Task IMPL-1.2 referenced but JSON file missing
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
/task:execute IMPL-X      # Execute specific remaining tasks  
/workflow:review          # Move to review phase when complete
```

