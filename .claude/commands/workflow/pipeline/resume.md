---
name: resume
description: Intelligent workflow resumption with automatic interruption point detection
usage: /workflow:resume [options]
argument-hint: [--from TASK-ID] [--retry] [--skip TASK-ID] [--force]
examples:
  - /workflow:resume
  - /workflow:resume --from impl-1.2
  - /workflow:resume --retry impl-1.1
  - /workflow:resume --skip impl-2.1 --from impl-2.2
---

# Workflow Resume Command (/workflow:resume)

## Overview
Intelligently resumes interrupted workflows with automatic detection of interruption points, context restoration, and flexible recovery strategies. Maintains execution continuity while adapting to various interruption scenarios.

## Core Principles
**File Structure:** @~/.claude/workflows/workflow-architecture.md

**Dependency Context Rules:**
- **For tasks with dependencies**: MUST read previous task summary documents before resuming
- **Context inheritance**: Use dependency summaries to maintain consistency and avoid duplicate work

## Usage
```bash
/workflow:resume [--from TASK-ID] [--retry] [--skip TASK-ID] [--force]
```

### Recovery Options

#### Automatic Recovery (Default)
```bash
/workflow:resume
```
**Behavior**:
- Auto-detects interruption point from task statuses
- Resumes from first incomplete task in dependency order
- Rebuilds agent context automatically

#### Targeted Recovery
```bash
/workflow:resume --from impl-1.2
```
**Behavior**:
- Resumes from specific task ID
- Validates dependencies are met
- Updates subsequent task readiness

#### Retry Failed Tasks
```bash
/workflow:resume --retry impl-1.1
```
**Behavior**:
- Retries previously failed task
- Analyzes failure context
- Applies enhanced error handling

#### Skip Blocked Tasks
```bash
/workflow:resume --skip impl-2.1 --from impl-2.2
```
**Behavior**:
- Marks specified task as skipped
- Continues execution from target task
- Adjusts dependency chain

#### Force Recovery
```bash
/workflow:resume --force
```
**Behavior**:
- Bypasses dependency validation
- Forces execution regardless of task states
- For emergency recovery scenarios

## Interruption Detection Logic

### Session State Analysis
```
Interruption Analysis:
├── Load active session from .workflow/.active-* marker
├── Read workflow-session.json for last execution state
├── Scan .task/ directory for task statuses
├── Analyze TODO_LIST.md progress markers
├── Check .summaries/ for completion records
└── Detect interruption point and failure patterns
```

**Detection Criteria**:
- **Normal Interruption**: Last task marked as "in_progress" without completion
- **Failure Interruption**: Task marked as "failed" with error context
- **Dependency Interruption**: Tasks blocked due to failed dependencies
- **Agent Interruption**: Agent execution terminated without status update

### Context Restoration Process
```json
{
  "interruption_analysis": {
    "session_id": "WFS-user-auth",
    "last_active_task": "impl-1.2",
    "interruption_type": "agent_timeout",
    "interruption_time": "2025-09-15T14:30:00Z",
    "affected_tasks": ["impl-1.2", "impl-1.3"],
    "pending_dependencies": [],
    "recovery_strategy": "retry_with_enhanced_context"
  },
  "execution_state": {
    "completed_tasks": ["impl-1.1"],
    "failed_tasks": [],
    "in_progress_tasks": ["impl-1.2"],
    "pending_tasks": ["impl-1.3", "impl-2.1"],
    "skipped_tasks": [],
    "blocked_tasks": []
  }
}
```

## Resume Execution Flow

### 1. Session Discovery & Validation
```
Session Validation:
├── Verify active session exists (.workflow/.active-*)
├── Load session metadata (workflow-session.json)
├── Validate task files integrity (.task/*.json)
├── Check IMPL_PLAN.md consistency
└── Rebuild execution context
```

**Validation Checks**:
- **Session Integrity**: All required files present and readable
- **Task Consistency**: Task JSON files match TODO_LIST.md entries
- **Dependency Chain**: Task dependencies are logically consistent
- **Agent Context**: Previous agent outputs available in .summaries/

### 2. Interruption Point Analysis
```pseudo
function detect_interruption():
  last_execution = read_session_state()
  task_statuses = scan_task_files()

  for task in dependency_order:
    if task.status == "in_progress" and no_completion_summary():
      return InterruptionPoint(task, "agent_interruption")
    elif task.status == "failed":
      return InterruptionPoint(task, "task_failure")
    elif task.status == "pending" and dependencies_met(task):
      return InterruptionPoint(task, "ready_to_execute")

  return InterruptionPoint(null, "workflow_complete")
```

### 3. Context Reconstruction
**Agent Context Rebuilding**:
```bash
# Reconstruct complete agent context from interruption point
Task(subagent_type="code-developer",
     prompt="[RESUME_CONTEXT] [FLOW_CONTROL] Resume impl-1.2: Implement JWT authentication

     RESUMPTION CONTEXT:
     - Interruption Type: agent_timeout
     - Previous Attempt: 2025-09-15T14:30:00Z
     - Completed Tasks: impl-1.1 (auth schema design)
     - Current Task State: in_progress
     - Recovery Strategy: retry_with_enhanced_context
     - Interrupted at Flow Step: analyze_patterns

     AVAILABLE CONTEXT:
     - Completed Task Summaries: .workflow/WFS-user-auth/.summaries/impl-1.1-summary.md
     - Previous Progress: Check .workflow/WFS-user-auth/TODO_LIST.md for partial completion
     - Task Definition: .workflow/WFS-user-auth/.task/impl-1.2.json
     - Session State: .workflow/WFS-user-auth/workflow-session.json

     FLOW CONTROL RECOVERY:
     Resume from step: analyze_patterns
     $(cat .workflow/WFS-user-auth/.task/impl-1.2.json | jq -r '.flow_control.pre_analysis[] | "- Step: " + .step + " | Action: " + .action + " | Command: " + .command')

     CONTEXT RECOVERY STEPS:
     1. MANDATORY: Read previous task summary documents for all dependencies
     2. Load dependency summaries from context.depends_on
     3. Restore previous step outputs if available
     4. Resume from interrupted flow control step
     5. Execute remaining steps with accumulated context
     6. Generate comprehensive summary with dependency outputs

     Focus Paths: $(cat .workflow/WFS-user-auth/.task/impl-1.2.json | jq -r '.context.focus_paths[]')
     Target Files: $(cat .workflow/WFS-user-auth/.task/impl-1.2.json | jq -r '.flow_control.target_files[]')

     IMPORTANT:
     1. Resume flow control from interrupted step with error recovery
     2. Ensure context continuity through step chain
     3. Create enhanced summary for dependent tasks
     4. Update progress tracking upon successful completion",

     description="Resume interrupted task with flow control step recovery")
```

### 4. Resume Coordination with TodoWrite
**Always First**: Update TodoWrite with resumption plan
```markdown
# Workflow Resume Coordination
*Session: WFS-[topic-slug] - RESUMPTION*

## Interruption Analysis
- **Interruption Point**: impl-1.2 (JWT implementation)
- **Interruption Type**: agent_timeout
- **Last Activity**: 2025-09-15T14:30:00Z
- **Recovery Strategy**: retry_with_enhanced_context

## Resume Execution Plan
- [x] **TASK-001**: [Completed] Design auth schema (impl-1.1)
- [ ] **TASK-002**: [RESUME] [Agent: code-developer] [FLOW_CONTROL] Implement JWT authentication (impl-1.2)
- [ ] **TASK-003**: [Pending] [Agent: code-review-agent] Review implementations (impl-1.3)
- [ ] **TASK-004**: Update session state and mark workflow complete

**Resume Markers**:
- [RESUME] = Task being resumed from interruption point
- [RETRY] = Task being retried after failure
- [SKIP] = Task marked as skipped in recovery
```

## Recovery Strategies

### Strategy Selection Matrix
| Interruption Type | Default Strategy | Alternative Options |
|------------------|------------------|-------------------|
| Agent Timeout | retry_with_enhanced_context | skip_and_continue, manual_review |
| Task Failure | analyze_and_retry | skip_task, force_continue |
| Dependency Block | resolve_dependencies | skip_blockers, manual_intervention |
| Context Loss | rebuild_full_context | partial_recovery, restart_from_checkpoint |

### Enhanced Context Recovery
```bash
# For agent timeout or context loss scenarios
1. Load all completion summaries
2. Analyze current codebase state
3. Compare against expected task progress
4. Rebuild comprehensive agent context
5. Resume with enhanced error handling
```

### Failure Analysis Recovery
```bash
# For task failure scenarios
1. Parse failure logs and error context
2. Identify root cause (code, dependency, logic)
3. Apply targeted recovery strategy
4. Retry with failure-specific enhancements
5. Escalate to manual review if repeated failures
```

### Dependency Resolution Recovery
```bash
# For dependency block scenarios
1. Analyze blocked dependency chain
2. Identify minimum viable completion set
3. Offer skip options for non-critical dependencies
4. Resume with adjusted execution plan
```

## Status Synchronization

### Task Status Updates
```json
// Before resumption
{
  "id": "impl-1.2",
  "status": "in_progress",
  "execution": {
    "attempts": 1,
    "last_attempt": "2025-09-15T14:30:00Z",
    "interruption_reason": "agent_timeout"
  }
}

// After successful resumption
{
  "id": "impl-1.2",
  "status": "completed",
  "execution": {
    "attempts": 2,
    "last_attempt": "2025-09-15T15:45:00Z",
    "completion_time": "2025-09-15T15:45:00Z",
    "recovery_strategy": "retry_with_enhanced_context"
  }
}
```

### Session State Updates
```json
{
  "current_phase": "EXECUTE",
  "last_execute_run": "2025-09-15T15:45:00Z",
  "resume_count": 1,
  "interruption_history": [
    {
      "timestamp": "2025-09-15T14:30:00Z",
      "reason": "agent_timeout",
      "affected_task": "impl-1.2",
      "recovery_strategy": "retry_with_enhanced_context"
    }
  ]
}
```

## Error Handling & Recovery

### Detection Failures
```bash
# No active session
❌ No active workflow session found
→ Use: /workflow:session:start or /workflow:plan first

# Corrupted session state
⚠️ Session state corrupted or inconsistent
→ Use: /workflow:resume --force for emergency recovery

# Task dependency conflicts
❌ Task dependency chain has conflicts
→ Use: /workflow:resume --skip [task-id] to bypass blockers
```

### Recovery Failures
```bash
# Repeated task failures
❌ Task impl-1.2 failed 3 times
→ Manual Review Required: Check .summaries/impl-1.2-failure-analysis.md
→ Use: /workflow:resume --skip impl-1.2 to continue

# Agent context reconstruction failures
⚠️ Cannot rebuild agent context for impl-1.2
→ Use: /workflow:resume --force --from impl-1.3 to skip problematic task

# Critical dependency failures
❌ Critical dependency impl-1.1 failed validation
→ Use: /workflow:plan to regenerate tasks or manual intervention required
```

## Advanced Resume Features

### Step-Level Recovery
- **Flow Control Interruption Detection**: Identify which flow control step was interrupted
- **Step Context Restoration**: Restore accumulated context up to interruption point
- **Partial Step Recovery**: Resume from specific flow control step
- **Context Chain Validation**: Verify context continuity through step sequence

#### Step-Level Resume Options
```bash
# Resume from specific flow control step
/workflow:resume --from-step analyze_patterns impl-1.2

# Retry specific step with enhanced context
/workflow:resume --retry-step gather_context impl-1.2

# Skip failing step and continue with next
/workflow:resume --skip-step analyze_patterns impl-1.2
```

### Enhanced Context Recovery
- **Dependency Summary Integration**: Automatic loading of prerequisite task summaries
- **Variable State Restoration**: Restore step output variables from previous execution
- **Command State Recovery**: Detect partial command execution and resume appropriately
- **Error Context Preservation**: Maintain error information for improved retry strategies

### Checkpoint System
- **Step-Level Checkpoints**: Created after each successful flow control step
- **Context State Snapshots**: Save variable states at each checkpoint
- **Rollback Capability**: Option to resume from previous valid step checkpoint

### Parallel Task Recovery
```bash
# Resume multiple independent tasks simultaneously
/workflow:resume --parallel --from impl-2.1,impl-3.1
```

### Resume with Analysis Refresh
```bash
# Resume with updated project analysis
/workflow:resume --refresh-analysis --from impl-1.2
```

### Conditional Resume
```bash
# Resume only if specific conditions are met
/workflow:resume --if-dependencies-met --from impl-1.3
```

## Integration Points

### Automatic Behaviors
- **Interruption Detection**: Continuous monitoring during execution
- **Context Preservation**: Automatic context saving at task boundaries
- **Recovery Planning**: Dynamic strategy selection based on interruption type
- **Progress Restoration**: Seamless continuation of TodoWrite coordination

### Next Actions
```bash
# After successful resumption
/context                     # View updated workflow status
/workflow:execute           # Continue normal execution
/workflow:review            # Move to review phase when complete
```

## Resume Command Workflow Integration

```mermaid
graph TD
    A[/workflow:resume] --> B[Detect Active Session]
    B --> C[Analyze Interruption Point]
    C --> D[Select Recovery Strategy]
    D --> E[Rebuild Agent Context]
    E --> F[Update TodoWrite Plan]
    F --> G[Execute Resume Coordination]
    G --> H[Monitor & Update Status]
    H --> I[Continue Normal Workflow]
```

**System ensures**: Robust workflow continuity with intelligent interruption handling and seamless recovery integration.