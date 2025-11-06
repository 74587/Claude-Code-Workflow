---
name: execute
description: Coordinate agent execution for workflow tasks with automatic session discovery, parallel task processing, and status tracking
argument-hint: "[--resume-session=\"session-id\"]"
---

# Workflow Execute Command

## Overview
Orchestrates autonomous workflow execution through systematic task discovery, agent coordination, and progress tracking. **Executes entire workflow without user interruption**, providing complete context to agents and ensuring proper flow control execution with comprehensive TodoWrite tracking.

**Resume Mode**: When called with `--resume-session` flag, skips discovery phase and directly enters TodoWrite generation and agent execution for the specified session.

## Performance Optimization Strategy

**Lazy Loading**: Task JSONs read **on-demand** during execution, not upfront. TODO_LIST.md + IMPL_PLAN.md provide metadata for planning.

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Initial Load** | All task JSONs (~2,300 lines) | TODO_LIST.md only (~650 lines) | **72% reduction** |
| **Startup Time** | Seconds | Milliseconds | **~90% faster** |
| **Memory** | All tasks | 1-2 tasks | **90% less** |
| **Scalability** | 10-20 tasks | 100+ tasks | **5-10x** |

## Core Rules
**Complete entire workflow autonomously without user interruption, using TodoWrite for comprehensive progress tracking.**
**Execute all discovered pending tasks sequentially until workflow completion or blocking dependency.**
**Auto-complete session when all tasks finished: Call `/workflow:session:complete` upon workflow completion.**

## Core Responsibilities
- **Session Discovery**: Identify and select active workflow sessions
- **Task Dependency Resolution**: Analyze task relationships and execution order
- **TodoWrite Progress Tracking**: Maintain real-time execution status throughout entire workflow
- **Agent Orchestration**: Coordinate specialized agents with complete context
- **Flow Control Execution**: Execute pre-analysis steps and context accumulation
- **Status Synchronization**: Update task JSON files and workflow state
- **Autonomous Completion**: Continue execution until all tasks complete or reach blocking state
- **Session Auto-Complete**: Call `/workflow:session:complete` when all workflow tasks finished

## Execution Philosophy
- **Discovery-first**: Auto-discover existing plans and tasks
- **Status-aware**: Execute only ready tasks with resolved dependencies
- **Context-rich**: Provide complete task JSON and accumulated context to agents
- **Progress tracking**: **Continuous TodoWrite updates throughout entire workflow execution**
- **Flow control**: Sequential step execution with variable passing
- **Autonomous completion**: **Execute all tasks without user interruption until workflow complete**

## Flow Control Execution
**[FLOW_CONTROL]** marker indicates task JSON contains `flow_control.pre_analysis` steps for context preparation.

### Orchestrator Responsibility
- Pass complete task JSON to agent (including `flow_control` block)
- Provide session paths for artifact access
- Monitor agent completion

### Agent Responsibility
- Parse `flow_control.pre_analysis` array from JSON
- Execute steps sequentially with variable substitution
- Accumulate context from artifacts and dependencies
- Follow error handling per `step.on_error`
- Complete implementation using accumulated context

**Orchestrator does NOT execute flow control steps - Agent interprets and executes them from JSON.**

## Execution Lifecycle

### Resume Mode Detection
**Special Flag Processing**: When `--resume-session="session-id"` is provided:
1. **Skip Discovery Phase**: Use provided session ID directly
2. **Load Specified Session**: Read session state from `.workflow/{session-id}/`
3. **Direct TodoWrite Generation**: Skip to Phase 3 (Planning) immediately
4. **Accelerated Execution**: Enter agent coordination without validation delays

### Phase 1: Discovery (Normal Mode Only)
1. **Check Active Sessions**: Find `.workflow/.active-*` markers
2. **Select Session**: If multiple found, prompt user selection
3. **Load Session Metadata**: Read `workflow-session.json` ONLY (minimal context)
4. **DO NOT read task JSONs yet** - defer until execution phase

**Note**: In resume mode, this phase is completely skipped.

### Phase 2: Planning Document Analysis (Normal Mode Only)
**Optimized to avoid reading all task JSONs upfront**

1. **Read IMPL_PLAN.md**: Understand overall strategy, task breakdown summary, dependencies
2. **Read TODO_LIST.md**: Get current task statuses and execution progress
3. **Extract Task Metadata**: Parse task IDs, titles, and dependency relationships from TODO_LIST.md
4. **Build Execution Queue**: Determine ready tasks based on TODO_LIST.md status and dependencies

**Key Optimization**: Use IMPL_PLAN.md and TODO_LIST.md as primary sources instead of reading all task JSONs

**Note**: In resume mode, this phase is also skipped as session analysis was already completed by `/workflow:status`.

### Phase 3: TodoWrite Generation (Resume Mode Entry Point)
**This is where resume mode directly enters after skipping Phases 1 & 2**

1. **Create TodoWrite List**: Generate task list from TODO_LIST.md (not from task JSONs)
   - Parse TODO_LIST.md to extract all tasks with current statuses
   - Identify first pending task with met dependencies
   - Generate comprehensive TodoWrite covering entire workflow
2. **Mark Initial Status**: Set first ready task as `in_progress` in TodoWrite
3. **Prepare Session Context**: Inject workflow paths for agent use (using provided session-id)
4. **Validate Prerequisites**: Ensure IMPL_PLAN.md and TODO_LIST.md exist and are valid

**Resume Mode Behavior**:
- Load existing TODO_LIST.md directly from `.workflow/{session-id}/`
- Extract current progress from TODO_LIST.md
- Generate TodoWrite from TODO_LIST.md state
- Proceed immediately to agent execution (Phase 4)

### Phase 4: Execution (Lazy Task Loading)
**Key Optimization**: Read task JSON **only when needed** for execution

1. **Identify Next Task**: From TodoWrite, get the next `in_progress` task ID
2. **Load Task JSON on Demand**: Read `.task/{task-id}.json` for current task ONLY
3. **Validate Task Structure**: Ensure all 5 required fields exist (id, title, status, meta, context, flow_control)
4. **Pass Task with Flow Control**: Include complete task JSON with `pre_analysis` steps for agent execution
5. **Launch Agent**: Invoke specialized agent with complete context including flow control steps
6. **Monitor Progress**: Track agent execution and handle errors without user interruption
7. **Collect Results**: Gather implementation results and outputs
8. **Update TODO_LIST.md**: Mark current task as completed in TODO_LIST.md
9. **Continue Workflow**: Identify next pending task from TODO_LIST.md and repeat from step 1

**Execution Loop Pattern**:
```
while (TODO_LIST.md has pending tasks) {
  next_task_id = getTodoWriteInProgressTask()
  task_json = Read(.workflow/{session}/.task/{next_task_id}.json)  // Lazy load
  executeTaskWithAgent(task_json)
  updateTodoListMarkCompleted(next_task_id)
  advanceTodoWriteToNextTask()
}
```

**Benefits**:
- Reduces initial context loading by ~90%
- Only reads task JSON when actually executing
- Scales better for workflows with many tasks
- Faster startup time for workflow execution

### Phase 5: Completion
1. **Update Task Status**: Mark completed tasks in JSON files
2. **Generate Summary**: Create task summary in `.summaries/`
3. **Update TodoWrite**: Mark current task complete, advance to next
4. **Synchronize State**: Update session state and workflow status
5. **Check Workflow Complete**: Verify all tasks are completed
6. **Auto-Complete Session**: Call `/workflow:session:complete` when all tasks finished

## Task Discovery & Queue Building

### Session Discovery Process (Normal Mode - Optimized)
```
├── Check for .active-* markers in .workflow/
├── If multiple active sessions found → Prompt user to select
├── Locate selected session's workflow folder
├── Load session metadata: workflow-session.json (minimal context)
├── Read IMPL_PLAN.md (strategy overview and task summary)
├── Read TODO_LIST.md (current task statuses and dependencies)
├── Parse TODO_LIST.md to extract task metadata (NO JSON loading)
├── Build execution queue from TODO_LIST.md
└── Generate TodoWrite from TODO_LIST.md state
```

**Key Change**: Task JSONs are NOT loaded during discovery - they are loaded lazily during execution

### Resume Mode Process (--resume-session flag - Optimized)
```
├── Use provided session-id directly (skip discovery)
├── Validate .workflow/{session-id}/ directory exists
├── Read TODO_LIST.md for current progress
├── Parse TODO_LIST.md to extract task IDs and statuses
├── Generate TodoWrite from TODO_LIST.md (prioritize in-progress/pending tasks)
└── Enter Phase 4 (Execution) with lazy task JSON loading
```

**Key Change**: Completely skip IMPL_PLAN.md and task JSON loading - use TODO_LIST.md only

### Task Status Logic
```
pending + dependencies_met → executable
completed → skip
blocked → skip until dependencies clear
```

## Batch Execution with Dependency Graph

### Parallel Execution Algorithm
**Core principle**: Execute independent tasks concurrently in batches based on dependency graph.

#### Algorithm Steps (Optimized with Lazy Loading)
```javascript
function executeBatchWorkflow(sessionId) {
  // 1. Build dependency graph from TODO_LIST.md (NOT task JSONs)
  const graph = buildDependencyGraphFromTodoList(`.workflow/${sessionId}/TODO_LIST.md`);

  // 2. Process batches until graph is empty
  while (!graph.isEmpty()) {
    // 3. Identify current batch (tasks with in-degree = 0)
    const batch = graph.getNodesWithInDegreeZero();

    // 4. Load task JSONs ONLY for current batch (lazy loading)
    const batchTaskJsons = batch.map(taskId =>
      Read(`.workflow/${sessionId}/.task/${taskId}.json`)
    );

    // 5. Check for parallel execution opportunities
    const parallelGroups = groupByExecutionGroup(batchTaskJsons);

    // 6. Execute batch concurrently
    await Promise.all(
      parallelGroups.map(group => executeBatch(group))
    );

    // 7. Update graph: remove completed tasks and their edges
    graph.removeNodes(batch);

    // 8. Update TODO_LIST.md and TodoWrite to reflect completed batch
    updateTodoListAfterBatch(batch);
    updateTodoWriteAfterBatch(batch);
  }

  // 9. All tasks complete - auto-complete session
  SlashCommand("/workflow:session:complete");
}

function buildDependencyGraphFromTodoList(todoListPath) {
  const todoContent = Read(todoListPath);
  const tasks = parseTodoListTasks(todoContent);
  const graph = new DirectedGraph();

  tasks.forEach(task => {
    graph.addNode(task.id, { id: task.id, title: task.title, status: task.status });
    task.dependencies?.forEach(depId => graph.addEdge(depId, task.id));
  });

  return graph;
}

function parseTodoListTasks(todoContent) {
  // Parse: - [ ] **IMPL-001**: Task title → [📋](./.task/IMPL-001.json)
  const taskPattern = /- \[([ x])\] \*\*([A-Z]+-\d+(?:\.\d+)?)\*\*: (.+?) →/g;
  const tasks = [];
  let match;

  while ((match = taskPattern.exec(todoContent)) !== null) {
    tasks.push({
      status: match[1] === 'x' ? 'completed' : 'pending',
      id: match[2],
      title: match[3]
    });
  }

  return tasks;
}

function groupByExecutionGroup(tasks) {
  const groups = {};

  tasks.forEach(task => {
    const groupId = task.meta.execution_group || task.id;
    if (!groups[groupId]) groups[groupId] = [];
    groups[groupId].push(task);
  });

  return Object.values(groups);
}

async function executeBatch(tasks) {
  // Execute all tasks in batch concurrently
  return Promise.all(
    tasks.map(task => executeTask(task))
  );
}
```

#### Execution Group Rules
1. **Same `execution_group` ID** → Execute in parallel (independent, different contexts)
2. **No `execution_group` (null)** → Execute sequentially (has dependencies)
3. **Different `execution_group` IDs** → Execute in parallel (independent batches)
4. **Same `context_signature`** → Should have been merged (warning if not)

#### Parallel Execution Example
```
Batch 1 (no dependencies):
  - IMPL-1.1 (execution_group: "parallel-auth-api") → Agent 1
  - IMPL-1.2 (execution_group: "parallel-ui-comp") → Agent 2
  - IMPL-1.3 (execution_group: "parallel-db-schema") → Agent 3

Wait for Batch 1 completion...

Batch 2 (depends on Batch 1):
  - IMPL-2.1 (execution_group: null, depends_on: [IMPL-1.1, IMPL-1.2]) → Agent 1

Wait for Batch 2 completion...

Batch 3 (independent of Batch 2):
  - IMPL-3.1 (execution_group: "parallel-tests-1") → Agent 1
  - IMPL-3.2 (execution_group: "parallel-tests-2") → Agent 2
```

## TodoWrite Coordination
**Comprehensive workflow tracking** with immediate status updates throughout entire execution without user interruption:

#### TodoWrite Workflow Rules
1. **Initial Creation**: Generate TodoWrite from discovered pending tasks for entire workflow
   - **Normal Mode**: Create from discovery results
   - **Resume Mode**: Create from existing session state and current progress
2. **Parallel Task Support**:
   - **Single-task execution**: Mark ONLY ONE task as `in_progress` at a time
   - **Batch execution**: Mark ALL tasks in current batch as `in_progress` simultaneously
   - **Execution group indicator**: Show `[execution_group: group-id]` for parallel tasks
3. **Immediate Updates**: Update status after each task/batch completion without user interruption
4. **Status Synchronization**: Sync with JSON task files after updates
5. **Continuous Tracking**: Maintain TodoWrite throughout entire workflow execution until completion

#### Resume Mode TodoWrite Generation
**Special behavior when `--resume-session` flag is present**:
- Load existing session progress from `.workflow/{session-id}/TODO_LIST.md`
- Identify currently in-progress or next pending task
- Generate TodoWrite starting from interruption point
- Preserve completed task history in TodoWrite display
- Focus on remaining pending tasks for execution

#### TodoWrite Tool Usage
**Use Claude Code's built-in TodoWrite tool** to track workflow progress in real-time:

```javascript
// Example 1: Sequential execution (traditional)
TodoWrite({
  todos: [
    {
      content: "Execute IMPL-1.1: Design auth schema [code-developer] [FLOW_CONTROL]",
      status: "in_progress",  // Single task in progress
      activeForm: "Executing IMPL-1.1: Design auth schema"
    },
    {
      content: "Execute IMPL-1.2: Implement auth logic [code-developer] [FLOW_CONTROL]",
      status: "pending",
      activeForm: "Executing IMPL-1.2: Implement auth logic"
    }
  ]
});

// Example 2: Batch execution (parallel tasks with execution_group)
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

// Example 3: After batch completion
TodoWrite({
  todos: [
    {
      content: "Execute IMPL-1.1: Build Auth API [code-developer] [execution_group: parallel-auth-api]",
      status: "completed",  // Batch completed
      activeForm: "Executing IMPL-1.1: Build Auth API"
    },
    {
      content: "Execute IMPL-1.2: Build User UI [code-developer] [execution_group: parallel-ui-comp]",
      status: "completed",  // Batch completed
      activeForm: "Executing IMPL-1.2: Build User UI"
    },
    {
      content: "Execute IMPL-1.3: Setup Database [code-developer] [execution_group: parallel-db-schema]",
      status: "completed",  // Batch completed
      activeForm: "Executing IMPL-1.3: Setup Database"
    },
    {
      content: "Execute IMPL-2.1: Integration Tests [test-fix-agent]",
      status: "in_progress",  // Next batch started
      activeForm: "Executing IMPL-2.1: Integration Tests"
    }
  ]
});
```

**TodoWrite Integration Rules**:
- **Continuous Workflow Tracking**: Use TodoWrite tool throughout entire workflow execution
- **Real-time Updates**: Immediate progress tracking without user interruption
- **Single Active Task**: Only ONE task marked as `in_progress` at any time
- **Immediate Completion**: Mark tasks `completed` immediately after finishing
- **Status Sync**: Sync TodoWrite status with JSON task files after each update
- **Full Execution**: Continue TodoWrite tracking until all workflow tasks complete
- **Workflow Completion Check**: When all tasks marked `completed`, auto-call `/workflow:session:complete`

#### TODO_LIST.md Update Timing
**Single source of truth for task status** - enables lazy loading by providing task metadata without reading JSONs

- **Before Agent Launch**: Mark task as `in_progress`
- **After Task Complete**: Mark as `completed`, advance to next
- **On Error**: Keep as `in_progress`, add error note
- **Workflow Complete**: Call `/workflow:session:complete`

### 3. Agent Context Management
**Comprehensive context preparation** for autonomous agent execution:

#### Context Sources (Priority Order)
1. **Complete Task JSON**: Full task definition including all fields and artifacts
2. **Artifacts Context**: Brainstorming outputs and role analysess from task.context.artifacts
3. **Flow Control Context**: Accumulated outputs from pre_analysis steps (including artifact loading)
4. **Dependency Summaries**: Previous task completion summaries
5. **Session Context**: Workflow paths and session metadata
6. **Inherited Context**: Parent task context and shared variables

#### Context Assembly Process
```
1. Load Task JSON → Base context (including artifacts array)
2. Load Artifacts → Synthesis specifications and brainstorming outputs
3. Execute Flow Control → Accumulated context (with artifact loading steps)
4. Load Dependencies → Dependency context
5. Prepare Session Paths → Session context
6. Combine All → Complete agent context with artifact integration
```

#### Agent Context Package Structure
```json
{
  "task": { /* Complete task JSON with artifacts array */ },
  "artifacts": {
    "synthesis_specification": { "path": "{{from context-package.json → brainstorm_artifacts.synthesis_output.path}}", "priority": "highest" },
    "guidance_specification": { "path": "{{from context-package.json → brainstorm_artifacts.guidance_specification.path}}", "priority": "medium" },
    "role_analyses": [ /* From context-package.json → brainstorm_artifacts.role_analyses[] */ ],
    "conflict_resolution": { "path": "{{from context-package.json → brainstorm_artifacts.conflict_resolution.path}}", "conditional": true }
  },
  "flow_context": {
    "step_outputs": {
      "synthesis_specification": "...",
      "individual_artifacts": "...",
      "pattern_analysis": "...",
      "dependency_context": "..."
    }
  },
  "session": {
    "workflow_dir": ".workflow/WFS-session/",
    "context_package_path": ".workflow/WFS-session/.process/context-package.json",
    "todo_list_path": ".workflow/WFS-session/TODO_LIST.md",
    "summaries_dir": ".workflow/WFS-session/.summaries/",
    "task_json_path": ".workflow/WFS-session/.task/IMPL-1.1.json"
  },
  "dependencies": [ /* Task summaries from depends_on */ ],
  "inherited": { /* Parent task context */ }
}
```

#### Context Validation Rules
- **Task JSON Complete**: All 5 fields present and valid, including artifacts array in context
- **Artifacts Available**: All artifacts loaded from context-package.json
- **Flow Control Ready**: All pre_analysis steps completed including artifact loading steps
- **Dependencies Loaded**: All depends_on summaries available
- **Session Paths Valid**: All workflow paths exist and accessible (verified via context-package.json)
- **Agent Assignment**: Valid agent type specified in meta.agent

### 4. Agent Execution Pattern
**Structured agent invocation** with complete context and clear instructions:

#### Agent Prompt Template
```bash
Task(subagent_type="{meta.agent}",
     prompt="**EXECUTE TASK FROM JSON**

     ## Task JSON Location
     {session.task_json_path}

     ## Instructions
     1. **Load Complete Task JSON**: Read and validate all fields (id, title, status, meta, context, flow_control)
     2. **Execute Flow Control**: If `flow_control.pre_analysis` exists, execute steps sequentially:
        - Load artifacts (role analysis documents, role analyses) using commands in each step
        - Accumulate context from step outputs using variable substitution [variable_name]
        - Handle errors per step.on_error (skip_optional | fail | retry_once)
     3. **Implement Solution**: Follow `flow_control.implementation_approach` using accumulated context
     4. **Complete Task**:
        - Update task status: `jq '.status = \"completed\"' {session.task_json_path} > temp.json && mv temp.json {session.task_json_path}`
        - Update TODO_LIST.md: Mark task as [x] completed in {session.todo_list_path}
        - Generate summary: {session.summaries_dir}/{task.id}-summary.md
        - Check workflow completion and call `/workflow:session:complete` if all tasks done

     ## Context Sources (All from JSON)
     - Requirements: `context.requirements`
     - Focus Paths: `context.focus_paths`
     - Acceptance: `context.acceptance`
     - Artifacts: `context.artifacts` (synthesis specs, brainstorming outputs)
     - Dependencies: `context.depends_on`
     - Target Files: `flow_control.target_files`

     ## Session Paths
     - Workflow Dir: {session.workflow_dir}
     - TODO List: {session.todo_list_path}
     - Summaries: {session.summaries_dir}
     - Flow Context: {flow_context.step_outputs}

     **Complete JSON structure is authoritative - load and follow it exactly.**"),
     description="Execute task: {task.id}")
```

#### Agent JSON Loading Specification
**MANDATORY AGENT PROTOCOL**: All agents must follow this exact loading sequence:

1. **JSON Loading**: First action must be `cat {session.task_json_path}`
2. **Field Validation**: Verify all 5 required fields exist: `id`, `title`, `status`, `meta`, `context`, `flow_control`
3. **Structure Parsing**: Parse nested fields correctly:
   - `meta.type` and `meta.agent` (NOT flat `task_type`)
   - `context.requirements`, `context.focus_paths`, `context.acceptance`
   - `context.depends_on`, `context.inherited`
   - `flow_control.pre_analysis` array, `flow_control.target_files`
4. **Flow Control Execution**: If `flow_control.pre_analysis` exists, execute steps sequentially
5. **Status Management**: Update JSON status upon completion

**JSON Field Reference**:
```json
{
  "id": "IMPL-1.2",
  "title": "Task title",
  "status": "pending|active|completed|blocked",
  "meta": {
    "type": "feature|bugfix|refactor|test-gen|test-fix|docs",
    "agent": "@code-developer|@test-fix-agent|@universal-executor"
  },
  "context": {
    "requirements": ["req1", "req2"],
    "focus_paths": ["src/path1", "src/path2"],
    "acceptance": ["criteria1", "criteria2"],
    "depends_on": ["IMPL-1.1"],
    "inherited": { "from": "parent", "context": ["info"] },
    "artifacts": [
      {
        "type": "synthesis_specification",
        "source": "context-package.json → brainstorm_artifacts.synthesis_output",
        "path": "{{loaded dynamically from context-package.json}}",
        "priority": "highest",
        "contains": "complete_integrated_specification"
      },
      {
        "type": "individual_role_analysis",
        "source": "context-package.json → brainstorm_artifacts.role_analyses[]",
        "path": "{{loaded dynamically from context-package.json}}",
        "note": "Supports analysis*.md pattern (analysis.md, analysis-01.md, analysis-api.md, etc.)",
        "priority": "low",
        "contains": "role_specific_analysis_fallback"
      }
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_synthesis_specification",
        "action": "Load synthesis specification from context-package.json",
        "commands": [
          "Read(.workflow/WFS-[session]/.process/context-package.json)",
          "Extract(brainstorm_artifacts.synthesis_output.path)",
          "Read(extracted path)"
        ],
        "output_to": "synthesis_specification",
        "on_error": "skip_optional"
      },
      {
        "step": "step_name",
        "command": "bash_command",
        "output_to": "variable",
        "on_error": "skip_optional|fail|retry_once"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Implement task following role analyses",
        "description": "Implement '[title]' following role analyses. PRIORITY: Use role analysis documents as primary requirement source. When implementation needs technical details (e.g., API schemas, caching configs, design tokens), refer to artifacts[] for detailed specifications from original role analyses.",
        "modification_points": [
          "Apply consolidated requirements from role analysis documents",
          "Follow technical guidelines from synthesis",
          "Consult artifacts for implementation details when needed",
          "Integrate with existing patterns"
        ],
        "logic_flow": [
          "Load role analyses",
          "Parse architecture and requirements",
          "Implement following specification",
          "Consult artifacts for technical details when needed",
          "Validate against acceptance criteria"
        ],
        "depends_on": [],
        "output": "implementation"
      }
    ],
    "target_files": ["file:function:lines", "path/to/NewFile.ts"]
  }
}
```

#### Execution Flow
1. **Load Task JSON**: Agent reads and validates complete JSON structure
2. **Execute Flow Control**: Agent runs pre_analysis steps if present
3. **Prepare Implementation**: Agent uses implementation_approach from JSON
4. **Launch Implementation**: Agent follows focus_paths and target_files
5. **Update Status**: Agent marks JSON status as completed
6. **Generate Summary**: Agent creates completion summary

#### Agent Assignment Rules
```
meta.agent specified → Use specified agent
meta.agent missing → Infer from meta.type:
  - "feature" → @code-developer
  - "test-gen" → @code-developer
  - "test-fix" → @test-fix-agent
  - "review" → @universal-executor
  - "docs" → @doc-generator
```

#### Error Handling During Execution
- **Agent Failure**: Retry once with adjusted context
- **Flow Control Error**: Skip optional steps, fail on critical
- **Context Missing**: Reload from JSON files and retry
- **Timeout**: Mark as blocked, continue with next task

## Workflow File Structure Reference
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json     # Session state and metadata
├── IMPL_PLAN.md             # Planning document and requirements
├── TODO_LIST.md             # Progress tracking (auto-updated)
├── .task/                   # Task definitions (JSON only)
│   ├── IMPL-1.json          # Main task definitions
│   └── IMPL-1.1.json        # Subtask definitions
├── .summaries/              # Task completion summaries
│   ├── IMPL-1-summary.md    # Task completion details
│   └── IMPL-1.1-summary.md  # Subtask completion details
└── .process/                # Planning artifacts
    └── ANALYSIS_RESULTS.md  # Planning analysis results
```

## Error Handling & Recovery

### Discovery Phase Errors
| Error | Cause | Resolution | Command |
|-------|-------|------------|---------|
| No active session | No `.active-*` markers found | Create or resume session | `/workflow:plan "project"` |
| Multiple sessions | Multiple `.active-*` markers | Select specific session | Manual choice prompt |
| Corrupted session | Invalid JSON files | Recreate session structure | `/workflow:session:status --validate` |
| Missing task files | Broken task references | Regenerate tasks | `/task:create` or repair |

### Execution Phase Errors
| Error | Cause | Recovery Strategy | Max Attempts |
|-------|-------|------------------|--------------|
| Agent failure | Agent crash/timeout | Retry with simplified context | 2 |
| Flow control error | Command failure | Skip optional, fail critical | 1 per step |
| Context loading error | Missing dependencies | Reload from JSON, use defaults | 3 |
| JSON file corruption | File system issues | Restore from backup/recreate | 1 |

### Recovery Procedures

#### Session Recovery
```bash
# Check session integrity
find .workflow -name ".active-*" | while read marker; do
  session=$(basename "$marker" | sed 's/^\.active-//')
  if [ ! -d ".workflow/$session" ]; then
    echo "Removing orphaned marker: $marker"
    rm "$marker"
  fi
done

# Recreate corrupted session files
if [ ! -f ".workflow/$session/workflow-session.json" ]; then
  echo '{"session_id":"'$session'","status":"active"}' > ".workflow/$session/workflow-session.json"
fi
```

#### Task Recovery
```bash
# Validate task JSON integrity
for task_file in .workflow/$session/.task/*.json; do
  if ! jq empty "$task_file" 2>/dev/null; then
    echo "Corrupted task file: $task_file"
    # Backup and regenerate or restore from backup
  fi
done

# Fix missing dependencies
missing_deps=$(jq -r '.context.depends_on[]?' .workflow/$session/.task/*.json | sort -u)
for dep in $missing_deps; do
  if [ ! -f ".workflow/$session/.task/$dep.json" ]; then
    echo "Missing dependency: $dep - creating placeholder"
  fi
done
```

#### Context Recovery
```bash
# Reload context from available sources
if [ -f ".workflow/$session/.process/ANALYSIS_RESULTS.md" ]; then
  echo "Reloading planning context..."
fi

# Restore from documentation if available
if [ -d ".workflow/docs/" ]; then
  echo "Using documentation context as fallback..."
fi
```

### Error Prevention
- **Pre-flight Checks**: Validate session integrity before execution
- **Backup Strategy**: Create task snapshots before major operations
- **Atomic Updates**: Update JSON files atomically to prevent corruption
- **Dependency Validation**: Check all depends_on references exist
- **Context Verification**: Ensure all required context is available

## Usage Examples

### Basic Usage
```bash
/workflow:execute          # Execute all pending tasks autonomously
/workflow:session:status           # Check progress
/task:execute IMPL-1.2     # Execute specific task
```

### Integration
- **Planning**: `/workflow:plan` → `/workflow:execute` → `/workflow:review`
- **Recovery**: `/workflow:status --validate` → `/workflow:execute`

