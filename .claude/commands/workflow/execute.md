---
name: execute
description: Coordinate agents for existing workflow tasks with automatic discovery
argument-hint: "[--resume-session=\"session-id\"]"
---

# Workflow Execute Command

## Overview
Orchestrates autonomous workflow execution through systematic task discovery, agent coordination, and progress tracking. **Executes entire workflow without user interruption**, providing complete context to agents and ensuring proper flow control execution with comprehensive TodoWrite tracking.

**Resume Mode**: When called with `--resume-session` flag, skips discovery phase and directly enters TodoWrite generation and agent execution for the specified session.

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
**[FLOW_CONTROL]** marker indicates sequential step execution required for context gathering and preparation. **These steps are executed BY THE AGENT, not by the workflow:execute command.**

### Flow Control Rules
1. **Auto-trigger**: When `task.flow_control.pre_analysis` array exists in task JSON, agents execute these steps
2. **Sequential Processing**: Agents execute steps in order, accumulating context including artifacts
3. **Variable Passing**: Agents use `[variable_name]` syntax to reference step outputs including artifact content
4. **Error Handling**: Agents follow step-specific error strategies (`fail`, `skip_optional`, `retry_once`)
5. **Artifacts Priority**: When artifacts exist in task.context.artifacts, load synthesis specifications first

### Execution Pattern
```
Step 1: load_dependencies → dependency_context
Step 2: analyze_patterns [dependency_context] → pattern_analysis
Step 3: implement_solution [pattern_analysis] [dependency_context] → implementation
```

### Context Accumulation Process (Executed by Agents)
- **Load Artifacts**: Agents retrieve synthesis specifications and brainstorming outputs from `context.artifacts`
- **Load Dependencies**: Agents retrieve summaries from `context.depends_on` tasks
- **Execute Analysis**: Agents run CLI tools with accumulated context including artifacts
- **Prepare Implementation**: Agents build comprehensive context for implementation
- **Continue Implementation**: Agents use all accumulated context including artifacts for task execution

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
3. **Load Session State**: Read `workflow-session.json` and `IMPL_PLAN.md`
4. **Scan Tasks**: Analyze `.task/*.json` files for ready tasks

**Note**: In resume mode, this phase is completely skipped.

### Phase 2: Analysis (Normal Mode Only)
1. **Dependency Resolution**: Build execution order based on `depends_on`
2. **Status Validation**: Filter tasks with `status: "pending"` and met dependencies
3. **Agent Assignment**: Determine agent type from `meta.agent` or `meta.type`
4. **Context Preparation**: Load dependency summaries and inherited context

**Note**: In resume mode, this phase is also skipped as session analysis was already completed by `/workflow:status`.

### Phase 3: Planning (Resume Mode Entry Point)
**This is where resume mode directly enters after skipping Phases 1 & 2**

1. **Create TodoWrite List**: Generate task list with status markers from session state
2. **Mark Initial Status**: Set first pending task as `in_progress`
3. **Prepare Session Context**: Inject workflow paths for agent use (using provided session-id)
4. **Prepare Complete Task JSON**: Include pre_analysis and flow control steps for agent consumption
5. **Validate Prerequisites**: Ensure all required context is available from existing session

**Resume Mode Behavior**:
- Load existing session state directly from `.workflow/{session-id}/`
- Use session's task files and summaries without discovery
- Generate TodoWrite from current session progress
- Proceed immediately to agent execution

### Phase 4: Execution
1. **Pass Task with Flow Control**: Include complete task JSON with `pre_analysis` steps for agent execution
2. **Launch Agent**: Invoke specialized agent with complete context including flow control steps
3. **Monitor Progress**: Track agent execution and handle errors without user interruption
4. **Collect Results**: Gather implementation results and outputs
5. **Continue Workflow**: Automatically proceed to next pending task until completion

### Phase 5: Completion
1. **Update Task Status**: Mark completed tasks in JSON files
2. **Generate Summary**: Create task summary in `.summaries/`
3. **Update TodoWrite**: Mark current task complete, advance to next
4. **Synchronize State**: Update session state and workflow status
5. **Check Workflow Complete**: Verify all tasks are completed
6. **Auto-Complete Session**: Call `/workflow:session:complete` when all tasks finished

## Task Discovery & Queue Building

### Session Discovery Process (Normal Mode)
```
├── Check for .active-* markers in .workflow/
├── If multiple active sessions found → Prompt user to select
├── Locate selected session's workflow folder
├── Load selected session's workflow-session.json and IMPL_PLAN.md
├── Scan selected session's .task/ directory for task JSON files
├── Analyze task statuses and dependencies for selected session only
└── Build execution queue of ready tasks from selected session
```

### Resume Mode Process (--resume-session flag)
```
├── Use provided session-id directly (skip discovery)
├── Validate .workflow/{session-id}/ directory exists
├── Load session's workflow-session.json and IMPL_PLAN.md directly
├── Scan session's .task/ directory for task JSON files
├── Use existing task statuses and dependencies (no re-analysis needed)
└── Build execution queue from session state (prioritize pending/in-progress tasks)
```

### Task Status Logic
```
pending + dependencies_met → executable
completed → skip
blocked → skip until dependencies clear
```

## TodoWrite Coordination
**Comprehensive workflow tracking** with immediate status updates throughout entire execution without user interruption:

#### TodoWrite Workflow Rules
1. **Initial Creation**: Generate TodoWrite from discovered pending tasks for entire workflow
   - **Normal Mode**: Create from discovery results
   - **Resume Mode**: Create from existing session state and current progress
2. **Single In-Progress**: Mark ONLY ONE task as `in_progress` at a time
3. **Immediate Updates**: Update status after each task completion without user interruption
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
// Create initial todo list from discovered pending tasks
TodoWrite({
  todos: [
    {
      content: "Execute IMPL-1.1: Design auth schema [code-developer] [FLOW_CONTROL]",
      status: "pending",
      activeForm: "Executing IMPL-1.1: Design auth schema"
    },
    {
      content: "Execute IMPL-1.2: Implement auth logic [code-developer] [FLOW_CONTROL]",
      status: "pending",
      activeForm: "Executing IMPL-1.2: Implement auth logic"
    },
    {
      content: "Execute TEST-FIX-1: Validate implementation tests [test-fix-agent]",
      status: "pending",
      activeForm: "Executing TEST-FIX-1: Validate implementation tests"
    }
  ]
});

// Update status as tasks progress - ONLY ONE task should be in_progress at a time
TodoWrite({
  todos: [
    {
      content: "Execute IMPL-1.1: Design auth schema [code-developer] [FLOW_CONTROL]",
      status: "in_progress",  // Mark current task as in_progress
      activeForm: "Executing IMPL-1.1: Design auth schema"
    },
    // ... other tasks remain pending
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
- **Before Agent Launch**: Update TODO_LIST.md to mark task as `in_progress` (⚠️)
- **After Task Complete**: Update TODO_LIST.md to mark as `completed` (✅), advance to next
- **On Error**: Keep as `in_progress` in TODO_LIST.md, add error note
- **Workflow Complete**: When all tasks completed, call `/workflow:session:complete`
- **Session End**: Sync all TODO_LIST.md statuses with JSON task files

### 3. Agent Context Management
**Comprehensive context preparation** for autonomous agent execution:

#### Context Sources (Priority Order)
1. **Complete Task JSON**: Full task definition including all fields and artifacts
2. **Artifacts Context**: Brainstorming outputs and synthesis specifications from task.context.artifacts
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
    "synthesis_specification": { "path": ".workflow/WFS-session/.brainstorming/synthesis-specification.md", "priority": "highest" },
    "topic_framework": { "path": ".workflow/WFS-session/.brainstorming/topic-framework.md", "priority": "medium" },
    "role_analyses": [ /* Individual role analysis files */ ],
    "available_artifacts": [ /* All detected brainstorming artifacts */ ]
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
    "brainstorming_dir": ".workflow/WFS-session/.brainstorming/",
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
- **Artifacts Available**: Synthesis specifications and brainstorming outputs accessible
- **Flow Control Ready**: All pre_analysis steps completed including artifact loading steps
- **Dependencies Loaded**: All depends_on summaries available
- **Session Paths Valid**: All workflow paths exist and accessible, including .brainstorming directory
- **Agent Assignment**: Valid agent type specified in meta.agent

### 4. Agent Execution Pattern
**Structured agent invocation** with complete context and clear instructions:

#### Agent Prompt Template
```bash
Task(subagent_type="{meta.agent}",
     prompt="**TASK EXECUTION WITH FULL JSON LOADING**

     ## STEP 1: Load Complete Task JSON
     **MANDATORY**: First load the complete task JSON from: {session.task_json_path}

     cat {session.task_json_path}

     **CRITICAL**: Validate all 5 required fields are present:
     - id, title, status, meta, context, flow_control

     ## STEP 2: Task Definition (From Loaded JSON)
     **ID**: Use id field from JSON
     **Title**: Use title field from JSON
     **Type**: Use meta.type field from JSON
     **Agent**: Use meta.agent field from JSON
     **Status**: Verify status is pending or active

     ## STEP 3: Flow Control Execution (if flow_control.pre_analysis exists)
     **AGENT RESPONSIBILITY**: Execute pre_analysis steps sequentially from loaded JSON:

     **PRIORITY: Artifact Loading Steps First**
     1. **Load Synthesis Specification** (if present): Priority artifact loading for consolidated design
     2. **Load Individual Artifacts** (fallback): Load role-specific brainstorming outputs if synthesis unavailable
     3. **Execute Remaining Steps**: Continue with other pre_analysis steps

     For each step in flow_control.pre_analysis array:
     1. Execute step.command/commands with variable substitution (support both single command and commands array)
     2. Store output to step.output_to variable
     3. Handle errors per step.on_error strategy (skip_optional, fail, retry_once)
     4. Pass accumulated variables to next step including artifact context

     **Special Artifact Loading Commands**:
     - Use `bash(ls path 2>/dev/null || echo 'file not found')` for artifact existence checks
     - Use `Read(path)` for loading artifact content
     - Use `find` commands for discovering multiple artifact files
     - Reference artifacts in subsequent steps using output variables: [synthesis_specification], [individual_artifacts]

     ## STEP 4: Implementation Context (From JSON context field)
     **Requirements**: Use context.requirements array from JSON
     **Focus Paths**: Use context.focus_paths array from JSON
     **Acceptance Criteria**: Use context.acceptance array from JSON
     **Dependencies**: Use context.depends_on array from JSON
     **Parent Context**: Use context.inherited object from JSON
     **Artifacts**: Use context.artifacts array from JSON (synthesis specifications, brainstorming outputs)
     **Target Files**: Use flow_control.target_files array from JSON
     **Implementation Approach**: Use flow_control.implementation_approach object from JSON (with artifact integration)

     ## STEP 5: Session Context (Provided by workflow:execute)
     **Workflow Directory**: {session.workflow_dir}
     **TODO List Path**: {session.todo_list_path}
     **Summaries Directory**: {session.summaries_dir}
     **Task JSON Path**: {session.task_json_path}
     **Flow Context**: {flow_context.step_outputs}

     ## STEP 6: Agent Completion Requirements
     1. **Load Task JSON**: Read and validate complete task structure
     2. **Execute Flow Control**: Run all pre_analysis steps if present
     3. **Implement Solution**: Follow implementation_approach from JSON
     4. **Update Progress**: Mark task status in JSON as completed
     5. **Update TODO List**: Update TODO_LIST.md at provided path
     6. **Generate Summary**: Create completion summary in summaries directory
     7. **Check Workflow Complete**: After task completion, check if all workflow tasks done
     8. **Auto-Complete Session**: If all tasks completed, call SlashCommand(\"/workflow:session:complete\")

     **JSON UPDATE COMMAND**:
     Update task status to completed using jq:
     jq '.status = \"completed\"' {session.task_json_path} > temp.json && mv temp.json {session.task_json_path}

     **WORKFLOW COMPLETION CHECK**:
     After updating task status, check if workflow is complete:
     total_tasks=\$(find .workflow/*/\.task/ -name "*.json" -type f 2>/dev/null | wc -l)
     completed_tasks=\$(find .workflow/*/\.summaries/ -name "*.md" -type f 2>/dev/null | wc -l)
     if [ \$total_tasks -eq \$completed_tasks ]; then
       SlashCommand(command=\"/workflow:session:complete\")
     fi"),
     description="Execute task with full JSON loading and validation")
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
    "agent": "@code-developer|@test-fix-agent|@general-purpose"
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
        "source": "brainstorm_synthesis",
        "path": ".workflow/WFS-[session]/.brainstorming/synthesis-specification.md",
        "priority": "highest",
        "contains": "complete_integrated_specification"
      },
      {
        "type": "individual_role_analysis",
        "source": "brainstorm_roles",
        "path": ".workflow/WFS-[session]/.brainstorming/[role]/analysis.md",
        "priority": "low",
        "contains": "role_specific_analysis_fallback"
      }
    ]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_synthesis_specification",
        "action": "Load consolidated synthesis specification from brainstorming",
        "commands": [
          "bash(ls .workflow/WFS-[session]/.brainstorming/synthesis-specification.md 2>/dev/null || echo 'synthesis specification not found')",
          "Read(.workflow/WFS-[session]/.brainstorming/synthesis-specification.md)"
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
        "title": "Implement task following synthesis specification",
        "description": "Implement '[title]' following synthesis specification. PRIORITY: Use synthesis-specification.md as primary requirement source. When implementation needs technical details (e.g., API schemas, caching configs, design tokens), refer to artifacts[] for detailed specifications from original role analyses.",
        "modification_points": [
          "Apply consolidated requirements from synthesis-specification.md",
          "Follow technical guidelines from synthesis",
          "Consult artifacts for implementation details when needed",
          "Integrate with existing patterns"
        ],
        "logic_flow": [
          "Load synthesis specification",
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
  - "review" → @general-purpose
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

