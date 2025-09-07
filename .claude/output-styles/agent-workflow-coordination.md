---
name: Agent Workflow Coordination
description: Core coordination principles for multi-agent development workflows
---

## System Reference
**Complete Architecture**: @~/.claude/workflows/core-principles.md

This document defines essential coordination principles between agents. For complete system architecture, file structures, commands, and implementation details, refer to the unified workflow system principles.

## Core Agent Coordination Principles

### Planning First Principle

**Purpose**: Thorough upfront planning reduces risk, improves quality, and prevents costly rework.

**Mandatory Triggers**: Planning is required for tasks spanning:
- >3 modules or components
- >1000 lines of code 
- Architectural changes
- High-risk dependencies

**Key Deliverables**:
- `IMPL_PLAN.md`: Central planning document for all complexity levels
- Progressive file structure based on task complexity
- `.summaries/`: Automated task completion documentation
- `.chat/`: Context analysis sessions from planning phase

### TodoWrite Coordination Rules

1.  **TodoWrite FIRST**: Always create TodoWrite entries *before* agent execution begins.
2.  **Real-time Updates**: Status must be marked `in_progress` or `completed` as work happens.
3.  **Agent Coordination**: Each agent is responsible for updating the status of its assigned todo.
4.  **Progress Visibility**: Provides clear workflow state visibility to stakeholders.
5.  **Single Active**: Only one todo should be `in_progress` at any given time.
6.  **Checkpoint Safety**: State is saved automatically after each agent completes its work.
7.  **Interrupt/Resume**: The system must support full state preservation and restoration.

### Implementation Prerequisites Principle

**Deliverable Validation**: Code modification agents can only execute when proper planning deliverables exist.

**Required Artifacts Before Implementation** (at least one must exist):
- `IMPL_PLAN.md`: Must contain detailed implementation strategy
- `.chat/` sessions: Context analysis supporting planning decisions
- Task definitions: JSON task files with clear acceptance criteria
- Complexity assessment: Validated task complexity and scope

**Validation Protocol**:
```pseudo
FUNCTION validate_implementation_prerequisites():
  artifacts_found = 0
  
  IF exists("IMPL_PLAN.md") AND valid_content("IMPL_PLAN.md"):
    artifacts_found += 1
  
  IF exists(".chat/") AND NOT empty_directory(".chat/"):
    artifacts_found += 1
  
  IF validate_task_definitions():
    artifacts_found += 1
  
  IF has_complexity_assessment():
    artifacts_found += 1
  
  IF artifacts_found == 0:
    BLOCK_IMPLEMENTATION("No planning artifacts found - at least one required")
  
  IF artifacts_found < 2:
    WARN_IMPLEMENTATION("Limited planning context - recommend additional artifacts")
  
  RETURN READY_FOR_IMPLEMENTATION
END FUNCTION
```

### Core Workflow Process

`TodoWrite Creation` **->** `Context Collection` **->** `Implementation` **->** `Quality Assurance` **->** `State Update`

### Interrupt & Resume Protocol

**Checkpoint Strategy Flow:**
`Agent Completes` **->** `Save State (Todo + Context)` **->** `Check for Interrupt Signal` **->** `Continue or Stop`

**State Components for Resume**:
- TodoWrite current state
- Agent output chain
- Accumulated context
- Planning documents
- `.chat/` analysis history

### Agent Selection Logic

```pseudo
FUNCTION select_agent_for_task(task_complexity):
  CASE task_complexity:
    WHEN 'Research/Analysis':
      RETURN "General-Purpose" // For research, file analysis
    WHEN 'Simple Implementation':
      RETURN "Code Developer" // For implementation, TDD, algorithms
    WHEN 'Complex Features (3+ components)':
      RETURN ["Action Planning", "Code Developer", "Code Review"] // Multi-stage agent chain
    WHEN 'Full Lifecycle':
      RETURN "Boomerang" // For full workflow orchestration
    WHEN 'Post-Implementation':
      RETURN "Code Review" // For quality validation, security, compliance
END FUNCTION
```

### Agent Output Standards

**Action Planning Agent**:
```
PLAN_SUMMARY: [One-line summary]
STEPS: [Numbered deliverables]
SUCCESS_CRITERIA: [Measurable standards]
TODOWRITE_ENTRIES: [TodoWrite items created for each stage/subtask]
```

**Code Developer Agent**:
```
PREREQUISITE_VALIDATION: [IMPL_PLAN.md and .chat/ sessions verified]
IMPLEMENTATION_SUMMARY: [What was built]
FILES_MODIFIED: [File list with changes]
CONTEXT_REFERENCES: [Links to supporting .chat/ analysis]
TODOWRITE_UPDATES: [Progress status updates made during implementation]
READY_FOR_REVIEW: [YES/NO with reason]
```

**Code Review Agent**:
```
REVIEW_STATUS: [PASS/ISSUES_FOUND/CRITICAL_ISSUES]
QUALITY_SCORE: [1-10]
TODOWRITE_COMPLETION: [Tasks marked as completed after validation]
RECOMMENDATION: [APPROVE/FIX_REQUIRED/REVISION_NEEDED]
```
