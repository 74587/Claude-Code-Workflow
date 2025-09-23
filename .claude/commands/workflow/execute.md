---
name: execute
description: Coordinate agents for existing workflow tasks with automatic discovery
usage: /workflow:execute
argument-hint: none
examples:
  - /workflow:execute
---

# Workflow Execute Command

## Overview
Orchestrates autonomous workflow execution through systematic task discovery, agent coordination, and progress tracking. Provides complete context to agents and ensures proper flow control execution.

## Core Responsibilities
- **Session Discovery**: Identify and select active workflow sessions
- **Task Dependency Resolution**: Analyze task relationships and execution order
- **TodoWrite Progress Tracking**: Maintain real-time execution status
- **Agent Orchestration**: Coordinate specialized agents with complete context
- **Flow Control Execution**: Execute pre-analysis steps and context accumulation
- **Status Synchronization**: Update task JSON files and workflow state

## Execution Philosophy
- **Discovery-first**: Auto-discover existing plans and tasks
- **Status-aware**: Execute only ready tasks with resolved dependencies
- **Context-rich**: Provide complete task JSON and accumulated context to agents
- **Progress tracking**: Real-time TodoWrite updates and status synchronization
- **Flow control**: Sequential step execution with variable passing

## Flow Control Execution
**[FLOW_CONTROL]** marker indicates sequential step execution required for context gathering and preparation.

### Flow Control Rules
1. **Auto-trigger**: When `task.flow_control.pre_analysis` array exists in task JSON
2. **Sequential Processing**: Execute steps in order, accumulating context
3. **Variable Passing**: Use `[variable_name]` syntax to reference step outputs
4. **Error Handling**: Follow step-specific error strategies (`fail`, `skip_optional`, `retry_once`)

### Execution Pattern
```
Step 1: load_dependencies → dependency_context
Step 2: analyze_patterns [dependency_context] → pattern_analysis
Step 3: implement_solution [pattern_analysis] [dependency_context] → implementation
```

### Context Accumulation Process
- **Load Dependencies**: Retrieve summaries from `context.depends_on` tasks
- **Execute Analysis**: Run CLI tools with accumulated context
- **Prepare Implementation**: Build comprehensive context for agent execution
- **Pass to Agent**: Provide all accumulated context for implementation

## Execution Lifecycle

### Phase 1: Discovery
1. **Check Active Sessions**: Find `.workflow/.active-*` markers
2. **Select Session**: If multiple found, prompt user selection
3. **Load Session State**: Read `workflow-session.json` and `IMPL_PLAN.md`
4. **Scan Tasks**: Analyze `.task/*.json` files for ready tasks

### Phase 2: Analysis
1. **Dependency Resolution**: Build execution order based on `depends_on`
2. **Status Validation**: Filter tasks with `status: "pending"` and met dependencies
3. **Agent Assignment**: Determine agent type from `meta.agent` or `meta.type`
4. **Context Preparation**: Load dependency summaries and inherited context

### Phase 3: Planning
1. **Create TodoWrite List**: Generate task list with status markers
2. **Mark Initial Status**: Set first task as `in_progress`
3. **Prepare Session Context**: Inject workflow paths for agent use
4. **Validate Prerequisites**: Ensure all required context is available

### Phase 4: Execution
1. **Execute Flow Control**: Run `pre_analysis` steps if present
2. **Launch Agent**: Invoke specialized agent with complete context
3. **Monitor Progress**: Track agent execution and handle errors
4. **Collect Results**: Gather implementation results and outputs

### Phase 5: Completion
1. **Update Task Status**: Mark completed tasks in JSON files
2. **Generate Summary**: Create task summary in `.summaries/`
3. **Update TodoWrite**: Mark current task complete, advance to next
4. **Synchronize State**: Update session state and workflow status

## Task Discovery & Queue Building

### Session Discovery Process
```
├── Check for .active-* markers in .workflow/
├── If multiple active sessions found → Prompt user to select
├── Locate selected session's workflow folder
├── Load selected session's workflow-session.json and IMPL_PLAN.md
├── Scan selected session's .task/ directory for task JSON files
├── Analyze task statuses and dependencies for selected session only
└── Build execution queue of ready tasks from selected session
```

### Task Status Logic
```
pending + dependencies_met → executable
completed → skip
blocked → skip until dependencies clear
```

## TodoWrite Coordination
**Real-time progress tracking** with immediate status updates:

#### TodoWrite Workflow Rules
1. **Initial Creation**: Generate TodoWrite from discovered pending tasks
2. **Single In-Progress**: Mark ONLY ONE task as `in_progress` at a time
3. **Immediate Updates**: Update status after each task completion
4. **Status Synchronization**: Sync with JSON task files after updates

#### TodoWrite Template
```markdown
# Workflow Execute Progress
*Session: WFS-[topic-slug]*

- [⚠️] **IMPL-1.1**: [code-developer] [FLOW_CONTROL] Design auth schema
- [ ] **IMPL-1.2**: [code-developer] [FLOW_CONTROL] Implement auth logic
- [ ] **IMPL-2**: [code-review-agent] Review implementations

**Status Legend**:
- [ ] = Pending task
- [⚠️] = Currently in progress
- [✅] = Completed task
- [FLOW_CONTROL] = Requires pre-analysis step execution
```

#### Update Timing
- **Before Agent Launch**: Mark task as `in_progress` (⚠️)
- **After Task Complete**: Mark as `completed` (✅), advance to next
- **On Error**: Keep as `in_progress`, add error note
- **Session End**: Sync all statuses with JSON files

### 3. Agent Context Management
**Comprehensive context preparation** for autonomous agent execution:

#### Context Sources (Priority Order)
1. **Complete Task JSON**: Full task definition including all fields
2. **Flow Control Context**: Accumulated outputs from pre_analysis steps
3. **Dependency Summaries**: Previous task completion summaries
4. **Session Context**: Workflow paths and session metadata
5. **Inherited Context**: Parent task context and shared variables

#### Context Assembly Process
```
1. Load Task JSON → Base context
2. Execute Flow Control → Accumulated context
3. Load Dependencies → Dependency context
4. Prepare Session Paths → Session context
5. Combine All → Complete agent context
```

#### Agent Context Package Structure
```json
{
  "task": { /* Complete task JSON */ },
  "flow_context": {
    "step_outputs": { "pattern_analysis": "...", "dependency_context": "..." }
  },
  "session": {
    "workflow_dir": ".workflow/WFS-session/",
    "todo_list_path": ".workflow/WFS-session/TODO_LIST.md",
    "summaries_dir": ".workflow/WFS-session/.summaries/",
    "task_json_path": ".workflow/WFS-session/.task/IMPL-1.1.json"
  },
  "dependencies": [ /* Task summaries from depends_on */ ],
  "inherited": { /* Parent task context */ }
}
```

#### Context Validation Rules
- **Task JSON Complete**: All 5 fields present and valid
- **Flow Control Ready**: All pre_analysis steps completed if present
- **Dependencies Loaded**: All depends_on summaries available
- **Session Paths Valid**: All workflow paths exist and accessible
- **Agent Assignment**: Valid agent type specified in meta.agent

### 4. Agent Execution Pattern
**Structured agent invocation** with complete context and clear instructions:

#### Agent Prompt Template
```bash
Task(subagent_type="{agent_type}",
     prompt="Execute {task_id}: {task_title}

     ## Task Definition
     **ID**: {task_id}
     **Type**: {task_type}
     **Agent**: {assigned_agent}

     ## Execution Instructions
     {flow_control_marker}

     ### Flow Control Steps (if [FLOW_CONTROL] present)
     Execute sequentially with context accumulation:
     {pre_analysis_steps}

     ### Implementation Context
     **Requirements**: {context.requirements}
     **Focus Paths**: {context.focus_paths}
     **Acceptance Criteria**: {context.acceptance}
     **Target Files**: {flow_control.target_files}

     ### Session Context
     **Workflow Directory**: {session.workflow_dir}
     **TODO List Path**: {session.todo_list_path}
     **Summaries Directory**: {session.summaries_dir}
     **Task JSON Path**: {session.task_json_path}

     ### Dependencies & Context
     **Dependencies**: {context.depends_on}
     **Inherited Context**: {context.inherited}
     **Previous Outputs**: {flow_context.step_outputs}

     ## Completion Requirements
     1. Execute all flow control steps if present
     2. Implement according to acceptance criteria
     3. Update TODO_LIST.md at provided path
     4. Generate summary in summaries directory
     5. Mark task as completed in task JSON",
     description="{task_description}")
```

#### Execution Flow
1. **Prepare Agent Context**: Assemble complete context package
2. **Generate Prompt**: Fill template with task and context data
3. **Launch Agent**: Invoke specialized agent with structured prompt
4. **Monitor Execution**: Track progress and handle errors
5. **Collect Results**: Process agent outputs and update status

#### Agent Assignment Rules
```
meta.agent specified → Use specified agent
meta.agent missing → Infer from meta.type:
  - "feature" → @code-developer
  - "test" → @code-review-test-agent
  - "review" → @code-review-agent
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
| Corrupted session | Invalid JSON files | Recreate session structure | `/workflow:status --validate` |
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

## Usage Examples & Integration

### Complete Execution Workflow
```bash
# 1. Check current status
/workflow:status

# 2. Execute workflow tasks
/workflow:execute

# 3. Monitor progress
/workflow:status --format=hierarchy

# 4. Continue with remaining tasks
/workflow:execute

# 5. Review when complete
/workflow:review
```

### Common Scenarios

#### Single Task Execution
```bash
/task:execute IMPL-1.2    # Execute specific task
```

#### Resume After Error
```bash
/workflow:status --validate  # Check for issues
/workflow:execute           # Resume execution
```

#### Multiple Session Management
```bash
# Will prompt for session selection if multiple active
/workflow:execute

# Or check status first
find .workflow -name ".active-*" -exec basename {} \; | sed 's/^\.active-//'
```

### Integration Points
- **Planning**: Use `/workflow:plan` to create session and tasks
- **Status**: Use `/workflow:status` for real-time progress views
- **Documentation**: Use `/workflow:docs` for context generation
- **Review**: Use `/workflow:review` for completion validation

### Key Benefits
- **Autonomous Execution**: Agents work independently with complete context
- **Progress Tracking**: Real-time TodoWrite updates and status synchronization
- **Error Recovery**: Comprehensive error handling and recovery procedures
- **Context Management**: Systematic context accumulation and distribution
- **Flow Control**: Sequential step execution with variable passing

