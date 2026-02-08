# Phase 4: Execution (Conditional)

Execute implementation tasks using agent orchestration with lazy loading, progress tracking, and optional auto-commit. This phase is triggered conditionally after Phase 3 completes.

## Trigger Conditions

- **User Selection**: User chooses "Start Execution" in Phase 3 User Decision
- **Auto Mode** (`--yes`): Automatically enters Phase 4 after Phase 3 completes

## Auto Mode

When `--yes` or `-y`:
- **Completion Choice**: Automatically completes session (runs `workflow:session:complete --yes`)

When `--with-commit`:
- **Auto-Commit**: After each agent task completes, commit changes based on summary document
- **Commit Principle**: Minimal commits - only commit files modified by the completed task
- **Commit Message**: Generated from task summary with format: "feat/fix/refactor: {task-title} - {summary}"

## Key Design Principles

1. **No Redundant Discovery**: Session ID and planning docs already available from Phase 1-3
2. **Autonomous Execution**: Complete entire workflow without user interruption
3. **Lazy Loading**: Task JSONs read on-demand during execution, not upfront
4. **ONE AGENT = ONE TASK JSON**: Each agent instance executes exactly one task JSON file
5. **IMPL_PLAN-Driven Strategy**: Execution model derived from planning document
6. **Continuous Progress Tracking**: TodoWrite updates throughout entire workflow
7. **Subagent Lifecycle**: Explicit lifecycle management with spawn_agent → wait → close_agent

## Execution Flow

```
Step 1: TodoWrite Generation
   ├─ Update session status to "active"
   ├─ Parse TODO_LIST.md for task statuses
   ├─ Generate TodoWrite for entire workflow
   └─ Prepare session context paths

Step 2: Execution Strategy Parsing
   ├─ Parse IMPL_PLAN.md Section 4 (Execution Model)
   └─ Fallback: Analyze task structure for smart defaults

Step 3: Task Execution Loop
   ├─ Get next in_progress task from TodoWrite
   ├─ Lazy load task JSON
   ├─ Launch agent (spawn_agent → wait → close_agent)
   ├─ Mark task completed (update IMPL-*.json status)
   ├─ [with-commit] Auto-commit changes
   └─ Advance to next task

Step 4: Completion
   ├─ Synchronize all statuses
   ├─ Generate summaries
   └─ ASK_USER: Review or Complete Session
```

## Step 1: TodoWrite Generation

### Step 1.0: Update Session Status to Active

Before generating TodoWrite, update session status from "planning" to "active":
```bash
# Update session status (idempotent - safe to run if already active)
jq '.status = "active" | .execution_started_at = (.execution_started_at // now | todate)' \
  ${projectRoot}/.workflow/active/${sessionId}/workflow-session.json > tmp.json && \
  mv tmp.json ${projectRoot}/.workflow/active/${sessionId}/workflow-session.json
```
This ensures the dashboard shows the session as "ACTIVE" during execution.

### Step 1.1: Parse TODO_LIST.md

```
1. Create TodoWrite List: Generate task list from TODO_LIST.md (not from task JSONs)
   - Parse TODO_LIST.md to extract all tasks with current statuses
   - Identify first pending task with met dependencies
   - Generate comprehensive TodoWrite covering entire workflow
2. Prepare Session Context: Inject workflow paths for agent use
3. Validate Prerequisites: Ensure IMPL_PLAN.md and TODO_LIST.md exist and are valid
```

**Performance Optimization**: TODO_LIST.md provides task metadata and status. Task JSONs are NOT loaded here - deferred to Step 3 (lazy loading).

## Step 2: Execution Strategy Parsing

### Step 2A: Parse Execution Strategy from IMPL_PLAN.md

Read IMPL_PLAN.md Section 4 to extract:
- **Execution Model**: Sequential | Parallel | Phased | TDD Cycles
- **Parallelization Opportunities**: Which tasks can run in parallel
- **Serialization Requirements**: Which tasks must run sequentially
- **Critical Path**: Priority execution order

### Step 2B: Intelligent Fallback

If IMPL_PLAN.md lacks execution strategy, use intelligent fallback:
1. **Analyze task structure**:
   - Check `meta.execution_group` in task JSONs
   - Analyze `depends_on` relationships
   - Understand task complexity and risk
2. **Apply smart defaults**:
   - No dependencies + same execution_group → Parallel
   - Has dependencies → Sequential (wait for deps)
   - Critical/high-risk tasks → Sequential
3. **Conservative approach**: When uncertain, prefer sequential execution

### Execution Models

#### 1. Sequential Execution
**When**: IMPL_PLAN specifies "Sequential" OR no clear parallelization guidance
**Pattern**: Execute tasks one by one in TODO_LIST order via spawn_agent → wait → close_agent per task
**TodoWrite**: ONE task marked as `in_progress` at a time

#### 2. Parallel Execution
**When**: IMPL_PLAN specifies "Parallel" with clear parallelization opportunities
**Pattern**: Execute independent task groups concurrently by spawning multiple agents and batch waiting
**TodoWrite**: MULTIPLE tasks (in same batch) marked as `in_progress` simultaneously
**Agent Instantiation**: spawn one agent per task (respects ONE AGENT = ONE TASK JSON rule), then batch wait

#### 3. Phased Execution
**When**: IMPL_PLAN specifies "Phased" with phase breakdown
**Pattern**: Execute tasks in phases, respect phase boundaries
**TodoWrite**: Within each phase, follow Sequential or Parallel rules

## Step 3: Task Execution Loop

### Execution Loop Pattern
```
while (TODO_LIST.md has pending tasks) {
  next_task_id = getTodoWriteInProgressTask()
  task_json = Read(${projectRoot}/.workflow/active/{session}/.task/{next_task_id}.json)  // Lazy load
  executeTaskWithAgent(task_json)  // spawn_agent → wait → close_agent
  updateTodoListMarkCompleted(next_task_id)
  advanceTodoWriteToNextTask()
}
```

### Execution Process per Task
1. **Identify Next Task**: From TodoWrite, get the next `in_progress` task ID
2. **Load Task JSON on Demand**: Read `.task/{task-id}.json` for current task ONLY
3. **Validate Task Structure**: Ensure all required fields exist (id, title, status, meta, context, flow_control)
4. **Launch Agent**: Invoke specialized agent via spawn_agent with complete context including flow control steps
5. **Wait for Completion**: wait for agent result, handle timeout
6. **Close Agent**: close_agent to free resources
7. **Collect Results**: Gather implementation results and outputs
8. **[with-commit] Auto-Commit**: If `--with-commit` flag enabled, commit changes based on summary
9. **Continue Workflow**: Identify next pending task from TODO_LIST.md and repeat

**Note**: TODO_LIST.md updates are handled by agents (e.g., code-developer.md), not by the orchestrator.

### Agent Prompt Template (Sequential)

**Path-Based Invocation**: Pass paths and trigger markers, let agent parse task JSON autonomously.

```javascript
// Step 1: Spawn agent
const agentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/${meta.agent}.md (MUST read first)
2. Read: ${projectRoot}/.workflow/project-tech.json
3. Read: ${projectRoot}/.workflow/project-guidelines.json

---

Implement task ${task.id}: ${task.title}

[FLOW_CONTROL]

**Input**:
- Task JSON: ${session.task_json_path}
- Context Package: ${session.context_package_path}

**Output Location**:
- Workflow: ${session.workflow_dir}
- TODO List: ${session.todo_list_path}
- Summaries: ${session.summaries_dir}

**Execution**: Read task JSON → Execute pre_analysis → Check execution_config.method → (CLI: handoff to CLI tool | Agent: direct implementation) → Update TODO_LIST.md → Generate summary
`
});

// Step 2: Wait for completion
const result = wait({
  ids: [agentId],
  timeout_ms: 600000  // 10 minutes per task
});

// Step 3: Close agent (IMPORTANT: always close)
close_agent({ id: agentId });
```

**Key Markers**:
- `Implement` keyword: Triggers tech stack detection and guidelines loading
- `[FLOW_CONTROL]`: Triggers flow_control.pre_analysis execution

### Parallel Execution Pattern

```javascript
// Step 1: Spawn agents for parallel batch
const batchAgents = [];
parallelTasks.forEach(task => {
  const agentId = spawn_agent({
    message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/${task.meta.agent}.md (MUST read first)
2. Read: ${projectRoot}/.workflow/project-tech.json
3. Read: ${projectRoot}/.workflow/project-guidelines.json

---

Implement task ${task.id}: ${task.title}

[FLOW_CONTROL]

**Input**:
- Task JSON: ${session.task_json_path}
- Context Package: ${session.context_package_path}

**Output Location**:
- Workflow: ${session.workflow_dir}
- TODO List: ${session.todo_list_path}
- Summaries: ${session.summaries_dir}

**Execution**: Read task JSON → Execute pre_analysis → Check execution_config.method → (CLI: handoff to CLI tool | Agent: direct implementation) → Update TODO_LIST.md → Generate summary
`
  });
  batchAgents.push({ agentId, taskId: task.id });
});

// Step 2: Batch wait for all agents
const batchResult = wait({
  ids: batchAgents.map(a => a.agentId),
  timeout_ms: 600000
});

// Step 3: Check results and handle timeouts
if (batchResult.timed_out) {
  console.log('Some parallel tasks timed out, continuing with completed results');
}

// Step 4: Close all agents
batchAgents.forEach(a => close_agent({ id: a.agentId }));
```

### Agent Assignment Rules
```
meta.agent specified → Use specified agent
meta.agent missing → Infer from meta.type:
  - "feature" → @code-developer  (role: ~/.codex/agents/code-developer.md)
  - "test-gen" → @code-developer  (role: ~/.codex/agents/code-developer.md)
  - "test-fix" → @test-fix-agent  (role: ~/.codex/agents/test-fix-agent.md)
  - "review" → @universal-executor  (role: ~/.codex/agents/universal-executor.md)
  - "docs" → @doc-generator  (role: ~/.codex/agents/doc-generator.md)
```

### Task Status Logic
```
pending + dependencies_met → executable
completed → skip
blocked → skip until dependencies clear
```

## Step 4: Completion

### Process
1. **Update Task Status**: Mark completed tasks in JSON files
2. **Generate Summary**: Create task summary in `.summaries/`
3. **Update TodoWrite**: Mark current task complete, advance to next
4. **Synchronize State**: Update session state and workflow status
5. **Check Workflow Complete**: Verify all tasks are completed
6. **User Choice**: When all tasks finished, ask user to choose next step:

```javascript
// Parse --yes flag
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')

if (autoYes) {
  // Auto mode: Complete session automatically
  console.log(`[--yes] Auto-selecting: Complete Session`)
  // Execute: workflow:session:complete --yes
} else {
  // Interactive mode: Ask user
  ASK_USER([{
    id: "completion-next-step",
    type: "select",
    prompt: "All tasks completed. What would you like to do next?",
    options: [
      {
        label: "Enter Review",
        description: "Run specialized review (security/architecture/quality/action-items)"
      },
      {
        label: "Complete Session",
        description: "Archive session and update manifest"
      }
    ]
  }])  // BLOCKS (wait for user response)
}
```

**Based on user selection**:
- **"Enter Review"**: Execute `workflow:review`
- **"Complete Session"**: Execute `workflow:session:complete`

### Post-Completion Expansion

After completion, ask user whether to expand to issues (test/enhance/refactor/doc). Selected items invoke `issue:new "{summary} - {dimension}"`.

## Auto-Commit Mode (--with-commit)

**Behavior**: After each agent task completes, automatically commit changes based on summary document.

**Minimal Principle**: Only commit files modified by the completed task.

**Commit Message Format**: `{type}: {task-title} - {summary}`

**Type Mapping** (from `meta.type`):
- `feature` → `feat` | `bugfix` → `fix` | `refactor` → `refactor`
- `test-gen` → `test` | `docs` → `docs` | `review` → `chore`

**Implementation**:
```bash
# 1. Read summary from .summaries/{task-id}-summary.md
# 2. Extract files from "Files Modified" section
# 3. Commit: git add <files> && git commit -m "{type}: {title} - {summary}"
```

**Error Handling**: Skip commit on no changes/missing summary, log errors, continue workflow.

## TodoWrite Coordination

### TodoWrite Rules

**Rule 1: Initial Creation**
- Generate TodoWrite from TODO_LIST.md pending tasks

**Rule 2: In-Progress Task Count (Execution-Model-Dependent)**
- **Sequential execution**: Mark ONLY ONE task as `in_progress` at a time
- **Parallel batch execution**: Mark ALL tasks in current batch as `in_progress` simultaneously
- **Execution group indicator**: Show `[execution_group: group-id]` for parallel tasks

**Rule 3: Status Updates**
- **Immediate Updates**: Update status after each task/batch completion without user interruption
- **Status Synchronization**: Sync with JSON task files after updates
- **Continuous Tracking**: Maintain TodoWrite throughout entire workflow execution until completion

**Rule 4: Workflow Completion Check**
- When all tasks marked `completed`, prompt user to choose review or complete session

### TodoWrite Examples

**Sequential Execution**:
```javascript
TodoWrite({
  todos: [
    {
      content: "Execute IMPL-1.1: Design auth schema [code-developer] [FLOW_CONTROL]",
      status: "in_progress",  // ONE task in progress
      activeForm: "Executing IMPL-1.1: Design auth schema"
    },
    {
      content: "Execute IMPL-1.2: Implement auth logic [code-developer] [FLOW_CONTROL]",
      status: "pending",
      activeForm: "Executing IMPL-1.2: Implement auth logic"
    }
  ]
});
```

**Parallel Batch Execution**:
```javascript
TodoWrite({
  todos: [
    {
      content: "Execute IMPL-1.1: Build Auth API [code-developer] [execution_group: parallel-auth-api]",
      status: "in_progress",
      activeForm: "Executing IMPL-1.1: Build Auth API"
    },
    {
      content: "Execute IMPL-1.2: Build User UI [code-developer] [execution_group: parallel-ui-comp]",
      status: "in_progress",
      activeForm: "Executing IMPL-1.2: Build User UI"
    },
    {
      content: "Execute IMPL-2.1: Integration Tests [test-fix-agent] [depends_on: IMPL-1.1, IMPL-1.2]",
      status: "pending",
      activeForm: "Executing IMPL-2.1: Integration Tests"
    }
  ]
});
```

## Error Handling & Recovery

### Common Errors & Recovery

| Error Type | Cause | Recovery Strategy | Max Attempts |
|-----------|-------|------------------|--------------|
| **Execution Errors** |
| Agent failure | Agent crash/timeout | Retry with simplified context (close_agent first, then spawn new) | 2 |
| Flow control error | Command failure | Skip optional, fail critical | 1 per step |
| Context loading error | Missing dependencies | Reload from JSON, use defaults | 3 |
| JSON file corruption | File system issues | Restore from backup/recreate | 1 |
| **Lifecycle Errors** |
| Agent timeout | wait timed out | send_input to prompt completion, or close_agent and retry | 2 |
| Orphaned agent | Agent not closed after error | Ensure close_agent in error paths | N/A |

### Error Recovery with Lifecycle Management
```javascript
// Safe agent execution pattern with error handling
let agentId = null;
try {
  agentId = spawn_agent({ message: taskPrompt });
  const result = wait({ ids: [agentId], timeout_ms: 600000 });

  if (result.timed_out) {
    // Option 1: Send prompt to complete
    send_input({ id: agentId, message: "Please wrap up and generate summary." });
    const retryResult = wait({ ids: [agentId], timeout_ms: 120000 });
  }

  // Process results...
  close_agent({ id: agentId });
} catch (error) {
  // Ensure cleanup on error
  if (agentId) close_agent({ id: agentId });
  // Handle error (retry or skip task)
}
```

### Error Prevention
- **Lazy Loading**: Reduces upfront memory usage and validation errors
- **Atomic Updates**: Update JSON files atomically to prevent corruption
- **Dependency Validation**: Check all depends_on references exist
- **Context Verification**: Ensure all required context is available
- **Lifecycle Cleanup**: Always close_agent in both success and error paths

## Output

- **Updated**: Task JSON status fields (completed)
- **Created**: `.summaries/IMPL-*-summary.md` per task
- **Updated**: `TODO_LIST.md` (by agents)
- **Updated**: `workflow-session.json` status
- **Created**: Git commits (if `--with-commit`)

## Next Step

Return to orchestrator. Orchestrator handles completion summary output.
