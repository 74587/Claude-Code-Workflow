---
name: workflow-execute
description: Coordinate agent execution for workflow tasks with automatic session discovery, parallel task processing, and status tracking. Triggers on "workflow execute".
allowed-tools: spawn_agent, wait, send_input, close_agent, AskUserQuestion, Read, Write, Edit, Bash, Glob, Grep
---

# Workflow Execute (Codex Version)

Orchestrates autonomous workflow execution through systematic task discovery, agent coordination, and progress tracking. **Executes entire workflow without user interruption** (except initial session selection if multiple active sessions exist), providing complete context to agents and ensuring proper flow control execution with comprehensive TodoWrite tracking.

**Also available as**: `workflow:plan` Phase 4 — when running `workflow:plan` with `--yes` or selecting "Start Execution" after Phase 3, the core execution logic runs inline without needing a separate `workflow:execute` call. Use this standalone command for `--resume-session` scenarios or when invoking execution independently.

**Resume Mode**: When called with `--resume-session` flag, skips discovery phase and directly enters TodoWrite generation and agent execution for the specified session.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Workflow Execute Orchestrator (SKILL.md)                     │
│  → Parse args → Session discovery → Strategy → Execute tasks  │
└──────────┬───────────────────────────────────────────────────┘
           │
    ┌──────┴──────┐
    │  Normal Mode │──→ Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5
    │  Resume Mode │──→ Phase 3 → Phase 4 → Phase 5
    └─────────────┘
           │
    ┌──────┴──────────────────────────────────────────────┐
    │ Phase 1: Discovery         (session selection)       │
    │ Phase 2: Validation        (planning doc checks)     │
    │ Phase 3: TodoWrite Gen     (progress tracking init)  │
    │ Phase 4: Strategy+Execute  (lazy load + agent loop)  │
    │ Phase 5: Completion        (status sync + user choice)│
    └─────────────────────────────────────────────────────┘
```

## Key Design Principles

1. **Autonomous Execution**: Complete entire workflow without user interruption
2. **Lazy Loading**: Task JSONs read on-demand during execution, not upfront
3. **ONE AGENT = ONE TASK JSON**: Each agent instance executes exactly one task JSON file
4. **IMPL_PLAN-Driven Strategy**: Execution model derived from planning document
5. **Continuous Progress Tracking**: TodoWrite updates throughout entire workflow
6. **Subagent Lifecycle**: Explicit lifecycle management with spawn_agent → wait → close_agent

## Auto Mode

When `--yes` or `-y`:
- **Session Selection**: Automatically selects the first (most recent) active session
- **Completion Choice**: Automatically completes session (runs `workflow:session:complete --yes`)

When `--with-commit`:
- **Auto-Commit**: After each agent task completes, commit changes based on summary document
- **Commit Principle**: Minimal commits - only commit files modified by the completed task
- **Commit Message**: Generated from task summary with format: "feat/fix/refactor: {task-title} - {summary}"

## Usage

```
codex -p "@.codex/prompts/workflow-execute.md"
codex -p "@.codex/prompts/workflow-execute.md [FLAGS]"

# Flags
-y, --yes                           Skip all confirmations (auto mode)
--resume-session="<session-id>"     Skip discovery, resume specified session
--with-commit                       Auto-commit after each task completion

# Examples
codex -p "@.codex/prompts/workflow-execute.md"                                                         # Interactive mode
codex -p "@.codex/prompts/workflow-execute.md --yes"                                                   # Auto mode
codex -p "@.codex/prompts/workflow-execute.md --resume-session=\"WFS-auth\""                            # Resume specific session
codex -p "@.codex/prompts/workflow-execute.md -y --resume-session=\"WFS-auth\""                         # Auto + resume
codex -p "@.codex/prompts/workflow-execute.md --with-commit"                                            # With auto-commit
codex -p "@.codex/prompts/workflow-execute.md -y --with-commit"                                         # Auto + commit
codex -p "@.codex/prompts/workflow-execute.md -y --with-commit --resume-session=\"WFS-auth\""           # All flags
```

## Execution Flow

```
Normal Mode:
Phase 1: Discovery
   ├─ Count active sessions
   └─ Decision:
      ├─ count=0 → ERROR: No active sessions
      ├─ count=1 → Auto-select session → Phase 2
      └─ count>1 → ASK_USER (max 4 options) → Phase 2

Phase 2: Planning Document Validation
   ├─ Check IMPL_PLAN.md exists
   ├─ Check TODO_LIST.md exists
   └─ Validate .task/ contains IMPL-*.json files

Phase 3: TodoWrite Generation
   ├─ Update session status to "active" (Step 0)
   ├─ Parse TODO_LIST.md for task statuses
   ├─ Generate TodoWrite for entire workflow
   └─ Prepare session context paths

Phase 4: Execution Strategy & Task Execution
   ├─ Step 4A: Parse execution strategy from IMPL_PLAN.md
   └─ Step 4B: Execute tasks with lazy loading
      └─ Loop:
         ├─ Get next in_progress task from TodoWrite
         ├─ Lazy load task JSON
         ├─ Launch agent (spawn_agent → wait → close_agent)
         ├─ Mark task completed (update IMPL-*.json status)
         │  # Quick fix: Update task status for ccw dashboard
         │  # TS=$(date -Iseconds) && jq --arg ts "$TS" '.status="completed" | .status_history=(.status_history // [])+[{"from":"in_progress","to":"completed","changed_at":$ts}]' IMPL-X.json > tmp.json && mv tmp.json IMPL-X.json
         ├─ [with-commit] Commit changes based on summary (minimal principle)
         │  # Read summary from .summaries/IMPL-X-summary.md
         │  # Extract changed files from summary's "Files Modified" section
         │  # Generate commit message: "feat/fix/refactor: {task-title} - {summary}"
         │  # git add <changed-files> && git commit -m "<commit-message>"
         └─ Advance to next task

Phase 5: Completion
   ├─ Update task statuses in JSON files
   ├─ Generate summaries
   └─ ASK_USER: Choose next step
      ├─ "Enter Review" → workflow:review
      └─ "Complete Session" → workflow:session:complete

Resume Mode (--resume-session):
   ├─ Skip Phase 1 & Phase 2
   └─ Entry Point: Phase 3 (TodoWrite Generation)
      ├─ Update session status to "active" (if not already)
      └─ Continue: Phase 4 → Phase 5
```

## Core Rules

**Complete entire workflow autonomously without user interruption, using TodoWrite for comprehensive progress tracking.**
**Execute all discovered pending tasks until workflow completion or blocking dependency.**
**User-choice completion: When all tasks finished, ask user to choose review or complete.**
**ONE AGENT = ONE TASK JSON: Each agent instance executes exactly one task JSON file - never batch multiple tasks into single agent execution.**
**Explicit Lifecycle: Always close_agent after wait completes to free resources.**

## Subagent API Reference

### spawn_agent
Create a new subagent with task assignment.

```javascript
const agentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/{agent-type}.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

## TASK CONTEXT
${taskContext}

## DELIVERABLES
${deliverables}
`
})
```

### wait
Get results from subagent (only way to retrieve results).

```javascript
const result = wait({
  ids: [agentId],
  timeout_ms: 600000  // 10 minutes
})

if (result.timed_out) {
  // Handle timeout - can continue waiting or send_input to prompt completion
}
```

### send_input
Continue interaction with active subagent (for clarification or follow-up).

```javascript
send_input({
  id: agentId,
  message: `
## CLARIFICATION ANSWERS
${answers}

## NEXT STEP
Continue with implementation.
`
})
```

### close_agent
Clean up subagent resources (irreversible).

```javascript
close_agent({ id: agentId })
```

## Core Responsibilities

- **Session Discovery**: Identify and select active workflow sessions
- **Execution Strategy Parsing**: Extract execution model from IMPL_PLAN.md
- **TodoWrite Progress Tracking**: Maintain real-time execution status throughout entire workflow
- **Agent Orchestration**: Coordinate specialized agents with complete context via spawn_agent lifecycle
- **Status Synchronization**: Update task JSON files and workflow state
- **Autonomous Completion**: Continue execution until all tasks complete or reach blocking state
- **Session User-Choice Completion**: Ask user to choose review or complete when all tasks finished

## Execution Philosophy

- **Progress tracking**: Continuous TodoWrite updates throughout entire workflow execution
- **Autonomous completion**: Execute all tasks without user interruption until workflow complete

## Performance Optimization Strategy

**Lazy Loading**: Task JSONs read **on-demand** during execution, not upfront. TODO_LIST.md + IMPL_PLAN.md provide metadata for planning.

**Loading Strategy**:
- **TODO_LIST.md**: Read in Phase 3 (task metadata, status, dependencies for TodoWrite generation)
- **IMPL_PLAN.md**: Check existence in Phase 2 (normal mode), parse execution strategy in Phase 4A
- **Task JSONs**: Lazy loading - read only when task is about to execute (Phase 4B)

## Execution Lifecycle

### Phase 1: Discovery
**Applies to**: Normal mode only (skipped in resume mode)

**Purpose**: Find and select active workflow session with user confirmation when multiple sessions exist

**Process**:

#### Step 1.1: Count Active Sessions
```bash
bash(find .workflow/active/ -name "WFS-*" -type d 2>/dev/null | wc -l)
```

#### Step 1.2: Handle Session Selection

**Case A: No Sessions** (count = 0)
```
ERROR: No active workflow sessions found
Run workflow:plan "task description" to create a session
```

**Case B: Single Session** (count = 1)
```bash
bash(find .workflow/active/ -name "WFS-*" -type d 2>/dev/null | head -1 | xargs basename)
```
Auto-select and continue to Phase 2.

**Case C: Multiple Sessions** (count > 1)

List sessions with metadata and prompt user selection:
```bash
bash(for dir in .workflow/active/WFS-*/; do [ -d "$dir" ] || continue; session=$(basename "$dir"); project=$(jq -r '.project // "Unknown"' "${dir}workflow-session.json" 2>/dev/null || echo "Unknown"); total=$(grep -c '^\- \[' "${dir}TODO_LIST.md" 2>/dev/null || echo 0); completed=$(grep -c '^\- \[x\]' "${dir}TODO_LIST.md" 2>/dev/null || echo 0); if [ "$total" -gt 0 ]; then progress=$((completed * 100 / total)); else progress=0; fi; echo "$session | $project | $completed/$total tasks ($progress%)"; done)
```

**Parse --yes flag**:
```javascript
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
```

**Conditional Selection**:
```javascript
if (autoYes) {
  // Auto mode: Select first session (most recent)
  const firstSession = sessions[0]
  console.log(`[--yes] Auto-selecting session: ${firstSession.id}`)
  selectedSessionId = firstSession.id
  // Continue to Phase 2
} else {
  // Interactive mode: Use ASK_USER to present formatted options (max 4 options shown)
  // If more than 4 sessions, show most recent 4 with "Other" option for manual input
  const sessions = getActiveSessions()  // sorted by last modified
  const displaySessions = sessions.slice(0, 4)

  ASK_USER([{
    id: "session", type: "select",
    prompt: "Multiple active sessions detected. Select one:",
    options: displaySessions.map(s => ({
      label: s.id,
      description: `${s.project} | ${s.progress}`
    }))
    // Note: User can select "Other" to manually enter session ID
  }])  // BLOCKS (wait for user response)
}
```

**Input Validation**:
- If user selects from options: Use selected session ID
- If user selects "Other" and provides input: Validate session exists
- If validation fails: Show error and re-prompt or suggest available sessions

Parse user input (supports: number "1", full ID "WFS-auth-system", or partial "auth"), validate selection, and continue to Phase 2.

#### Step 1.3: Load Session Metadata
```bash
bash(cat .workflow/active/${sessionId}/workflow-session.json)
```

**Output**: Store session metadata in memory
**DO NOT read task JSONs yet** - defer until execution phase (lazy loading)

**Resume Mode**: This entire phase is skipped when `--resume-session="session-id"` flag is provided.

### Phase 2: Planning Document Validation
**Applies to**: Normal mode only (skipped in resume mode)

**Purpose**: Validate planning artifacts exist before execution

**Process**:
1. **Check IMPL_PLAN.md**: Verify file exists (defer detailed parsing to Phase 4A)
2. **Check TODO_LIST.md**: Verify file exists (defer reading to Phase 3)
3. **Validate Task Directory**: Ensure `.task/` contains at least one IMPL-*.json file

**Key Optimization**: Only existence checks here. Actual file reading happens in later phases.

**Resume Mode**: This phase is skipped when `--resume-session` flag is provided. Resume mode entry point is Phase 3.

### Phase 3: TodoWrite Generation
**Applies to**: Both normal and resume modes (resume mode entry point)

**Step 0: Update Session Status to Active**
Before generating TodoWrite, update session status from "planning" to "active":
```bash
# Update session status (idempotent - safe to run if already active)
jq '.status = "active" | .execution_started_at = (.execution_started_at // now | todate)' \
  .workflow/active/${sessionId}/workflow-session.json > tmp.json && \
  mv tmp.json .workflow/active/${sessionId}/workflow-session.json
```
This ensures the dashboard shows the session as "ACTIVE" during execution.

**Process**:
1. **Create TodoWrite List**: Generate task list from TODO_LIST.md (not from task JSONs)
   - Parse TODO_LIST.md to extract all tasks with current statuses
   - Identify first pending task with met dependencies
   - Generate comprehensive TodoWrite covering entire workflow
2. **Prepare Session Context**: Inject workflow paths for agent use (using provided session-id)
3. **Validate Prerequisites**: Ensure IMPL_PLAN.md and TODO_LIST.md exist and are valid

**Resume Mode Behavior**:
- Load existing TODO_LIST.md directly from `.workflow/active/{session-id}/`
- Extract current progress from TODO_LIST.md
- Generate TodoWrite from TODO_LIST.md state
- Proceed immediately to agent execution (Phase 4)

### Phase 4: Execution Strategy Selection & Task Execution
**Applies to**: Both normal and resume modes

**Step 4A: Parse Execution Strategy from IMPL_PLAN.md**

Read IMPL_PLAN.md Section 4 to extract:
- **Execution Model**: Sequential | Parallel | Phased | TDD Cycles
- **Parallelization Opportunities**: Which tasks can run in parallel
- **Serialization Requirements**: Which tasks must run sequentially
- **Critical Path**: Priority execution order

If IMPL_PLAN.md lacks execution strategy, use intelligent fallback (analyze task structure).

**Step 4B: Execute Tasks with Lazy Loading**

**Key Optimization**: Read task JSON **only when needed** for execution

**Execution Loop Pattern**:
```
while (TODO_LIST.md has pending tasks) {
  next_task_id = getTodoWriteInProgressTask()
  task_json = Read(.workflow/active/{session}/.task/{next_task_id}.json)  // Lazy load
  executeTaskWithAgent(task_json)  // spawn_agent → wait → close_agent
  updateTodoListMarkCompleted(next_task_id)
  advanceTodoWriteToNextTask()
}
```

**Execution Process per Task**:
1. **Identify Next Task**: From TodoWrite, get the next `in_progress` task ID
2. **Load Task JSON on Demand**: Read `.task/{task-id}.json` for current task ONLY
3. **Validate Task Structure**: Ensure all 5 required fields exist (id, title, status, meta, context, flow_control)
4. **Launch Agent**: Invoke specialized agent via spawn_agent with complete context including flow control steps
5. **Wait for Completion**: wait for agent result, handle timeout
6. **Close Agent**: close_agent to free resources
7. **Collect Results**: Gather implementation results and outputs
8. **[with-commit] Auto-Commit**: If `--with-commit` flag enabled, commit changes based on summary
   - Read summary from `.summaries/{task-id}-summary.md`
   - Extract changed files from summary's "Files Modified" section
   - Determine commit type from `meta.type` (feature→feat, bugfix→fix, refactor→refactor)
   - Generate commit message: "{type}: {task-title} - {summary-first-line}"
   - Commit only modified files (minimal principle): `git add <files> && git commit -m "<message>"`
9. **Continue Workflow**: Identify next pending task from TODO_LIST.md and repeat

**Note**: TODO_LIST.md updates are handled by agents (e.g., code-developer.md), not by the orchestrator.

### Phase 5: Completion
**Applies to**: Both normal and resume modes

**Process**:
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
    id: "next_step", type: "select",
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

完成后询问用户是否扩展为issue(test/enhance/refactor/doc)，选中项调用 `issue:new "{summary} - {dimension}"`

## Execution Strategy (IMPL_PLAN-Driven)

### Strategy Priority

**IMPL_PLAN-Driven Execution (Recommended)**:
1. **Read IMPL_PLAN.md execution strategy** (Section 4: Implementation Strategy)
2. **Follow explicit guidance**:
   - Execution Model (Sequential/Parallel/Phased/TDD)
   - Parallelization Opportunities (which tasks can run in parallel)
   - Serialization Requirements (which tasks must run sequentially)
   - Critical Path (priority execution order)
3. **Use TODO_LIST.md for status tracking** only
4. **IMPL_PLAN decides "HOW"**, execute implements it

**Intelligent Fallback (When IMPL_PLAN lacks execution details)**:
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

**Parallel Execution Pattern**:
```javascript
// Step 1: Spawn agents for parallel batch
const batchAgents = [];
parallelTasks.forEach(task => {
  const agentId = spawn_agent({
    message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/${task.meta.agent}.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

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

#### 3. Phased Execution
**When**: IMPL_PLAN specifies "Phased" with phase breakdown
**Pattern**: Execute tasks in phases, respect phase boundaries
**TodoWrite**: Within each phase, follow Sequential or Parallel rules

#### 4. Intelligent Fallback
**When**: IMPL_PLAN lacks execution strategy details
**Pattern**: Analyze task structure and apply smart defaults
**TodoWrite**: Follow Sequential or Parallel rules based on analysis

### Task Status Logic
```
pending + dependencies_met → executable
completed → skip
blocked → skip until dependencies clear
```

## TodoWrite Coordination

### TodoWrite Rules (Unified)

**Rule 1: Initial Creation**
- **Normal Mode**: Generate TodoWrite from discovered pending tasks for entire workflow
- **Resume Mode**: Generate from existing session state and current progress

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

### TodoWrite Tool Usage

**Example 1: Sequential Execution**
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

**Example 2: Parallel Batch Execution**
```javascript
TodoWrite({
  todos: [
    {
      content: "Execute IMPL-1.1: Build Auth API [code-developer] [execution_group: parallel-auth-api]",
      status: "in_progress",  // Batch task 1
      activeForm: "Executing IMPL-1.1: Build Auth API"
    },
    {
      content: "Execute IMPL-1.2: Build User UI [code-developer] [execution_group: parallel-ui-comp]",
      status: "in_progress",  // Batch task 2 (running concurrently)
      activeForm: "Executing IMPL-1.2: Build User UI"
    },
    {
      content: "Execute IMPL-1.3: Setup Database [code-developer] [execution_group: parallel-db-schema]",
      status: "in_progress",  // Batch task 3 (running concurrently)
      activeForm: "Executing IMPL-1.3: Setup Database"
    },
    {
      content: "Execute IMPL-2.1: Integration Tests [test-fix-agent] [depends_on: IMPL-1.1, IMPL-1.2, IMPL-1.3]",
      status: "pending",  // Next batch (waits for current batch completion)
      activeForm: "Executing IMPL-2.1: Integration Tests"
    }
  ]
});
```

## Agent Execution Pattern

### Flow Control Execution
**[FLOW_CONTROL]** marker indicates task JSON contains `flow_control.pre_analysis` steps for context preparation.

**Note**: Orchestrator does NOT execute flow control steps - Agent interprets and executes them autonomously.

### Agent Prompt Template (Sequential)
**Path-Based Invocation**: Pass paths and trigger markers, let agent parse task JSON autonomously.

```javascript
// Step 1: Spawn agent
const agentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/${meta.agent}.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

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

**Why Path-Based**: Agent (code-developer.md) autonomously:
- Reads and parses task JSON (requirements, acceptance, flow_control, execution_config)
- Executes pre_analysis steps (Phase 1: context gathering)
- Checks execution_config.method (Phase 2: determine mode)
- CLI mode: Builds handoff prompt and executes via ccw cli with resume strategy
- Agent mode: Directly implements using modification_points and logic_flow
- Generates structured summary with integration points

Embedding task content in prompt creates duplication and conflicts with agent's parsing logic.

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

## Data Flow

```
Phase 1 (Discovery) → selectedSessionId, sessionMetadata
    ↓
Phase 2 (Validation) → validated paths (IMPL_PLAN.md, TODO_LIST.md, .task/)
    ↓
Phase 3 (TodoWrite Gen) → todoWriteList, sessionContextPaths
    ↓
Phase 4 (Execute) → per-task: taskJson (lazy), spawn_agent → wait → close_agent, summaryDoc
    ↓
Phase 5 (Completion) → updatedStatuses, userChoice (review|complete)
```

## Workflow File Structure Reference
```
.workflow/active/WFS-[topic-slug]/
├── workflow-session.json     # Session state and metadata
├── IMPL_PLAN.md             # Planning document and requirements
├── TODO_LIST.md             # Progress tracking (updated by agents)
├── .task/                   # Task definitions (JSON only)
│   ├── IMPL-1.json          # Main task definitions
│   └── IMPL-1.1.json        # Subtask definitions
├── .summaries/              # Task completion summaries
│   ├── IMPL-1-summary.md    # Task completion details
│   └── IMPL-1.1-summary.md  # Subtask completion details
└── .process/                # Planning artifacts
    ├── context-package.json # Smart context package
    └── ANALYSIS_RESULTS.md  # Planning analysis results
```

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

## Error Handling & Recovery

### Common Errors & Recovery

| Error Type | Cause | Recovery Strategy | Max Attempts |
|-----------|-------|------------------|--------------|
| **Discovery Errors** |
| No active session | No sessions in `.workflow/active/` | Create or resume session: `workflow:plan "project"` | N/A |
| Multiple sessions | Multiple sessions in `.workflow/active/` | Prompt user selection | N/A |
| Corrupted session | Invalid JSON files | Recreate session structure or validate files | N/A |
| **Execution Errors** |
| Agent failure | Agent crash/timeout | Retry with simplified context (close_agent first, then spawn new) | 2 |
| Flow control error | Command failure | Skip optional, fail critical | 1 per step |
| Context loading error | Missing dependencies | Reload from JSON, use defaults | 3 |
| JSON file corruption | File system issues | Restore from backup/recreate | 1 |
| **Lifecycle Errors** |
| Agent timeout | wait timed out | send_input to prompt completion, or close_agent and retry | 2 |
| Orphaned agent | Agent not closed after error | Ensure close_agent in error paths | N/A |

### Error Prevention
- **Pre-flight Checks**: Validate session integrity before execution
- **Backup Strategy**: Create task snapshots before major operations
- **Atomic Updates**: Update JSON files atomically to prevent corruption
- **Dependency Validation**: Check all depends_on references exist
- **Context Verification**: Ensure all required context is available
- **Lifecycle Cleanup**: Always close_agent in both success and error paths

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

## Flag Parsing

```javascript
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const withCommit = $ARGUMENTS.includes('--with-commit')
```

## Related Commands

**Prerequisite Commands**:
- `workflow:plan` - Create workflow session with planning documents

**Follow-up Commands**:
- `workflow:review` - Run specialized post-implementation review
- `workflow:session:complete` - Archive session and update manifest
- `issue:new` - Create issue for post-completion expansion
