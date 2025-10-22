---
name: test-cycle-execute
description: Execute test-fix workflow with dynamic task generation and iterative fix cycles
argument-hint: "[--resume-session=\"session-id\"] [--max-iterations=N]"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Task(*)
---

# Workflow Test-Cycle-Execute Command

## Overview
Orchestrates dynamic test-fix workflow execution through iterative cycles of testing, analysis, and fixing. **Unlike standard execute, this command dynamically generates intermediate tasks** during execution based on test results and CLI analysis, enabling adaptive problem-solving.

**Resume Mode**: When called with `--resume-session` flag, skips discovery and continues from interruption point.

## Core Philosophy

### Dynamic vs Static Execution
**Standard Execute**: Pre-defined task queue → Sequential execution → Complete
**Test Execute**: Initial tasks → Test → Analyze → Generate fix tasks → Execute → Re-test → Repeat

### Iteration Loop Pattern
```
1. Execute current task (test/implement)
2. Run tests and collect results
3. If failures: CLI analysis → Generate fix tasks → Execute → Back to 2
4. If success: Mark complete → Next task
5. Repeat until all tests pass or max iterations reached
```

### Agent Coordination
- **@code-developer**: Understands requirements, generates implementations
- **@test-fix-agent**: Executes tests, applies fixes, validates results
- **CLI Tools (Gemini/Qwen)**: Analyzes failures, suggests fix strategies

## Core Rules
1. **Dynamic Task Generation**: Create intermediate fix tasks based on test failures
2. **Iterative Execution**: Repeat test-fix cycles until success or max iterations
3. **CLI-Driven Analysis**: Use Gemini/Qwen to analyze failures and plan fixes
4. **Agent Delegation**: All execution delegated to specialized agents
5. **Context Accumulation**: Each iteration builds on previous attempt context
6. **Autonomous Completion**: Continue until all tests pass without user interruption

## Core Responsibilities
- **Session Discovery**: Identify test-fix workflow sessions
- **Task Queue Management**: Maintain dynamic task queue with runtime additions
- **Test Execution**: Run tests through @test-fix-agent
- **Failure Analysis**: Use CLI tools to diagnose test failures
- **Fix Task Generation**: Create intermediate fix tasks dynamically
- **Iteration Control**: Manage fix cycles with max iteration limits
- **Context Propagation**: Pass failure context and fix history between iterations
- **Progress Tracking**: TodoWrite updates for entire iteration cycle
- **Session Auto-Complete**: Call `/workflow:session:complete` when all tests pass

## Responsibility Matrix

**Clear division of labor between orchestrator and agents:**

| Responsibility | test-cycle-execute (Orchestrator) | @test-fix-agent (Executor) |
|----------------|----------------------------|---------------------------|
| Manage iteration loop | ✅ Controls loop flow | ❌ Executes single task |
| Run CLI analysis (Gemini/Qwen) | ✅ Runs between agent tasks | ❌ Not involved |
| Generate IMPL-fix-N.json | ✅ Creates task files | ❌ Not involved |
| Run tests | ❌ Delegates to agent | ✅ Executes test command |
| Apply fixes | ❌ Delegates to agent | ✅ Modifies code |
| Detect test failures | ✅ Analyzes agent output | ✅ Reports results |
| Add tasks to queue | ✅ Manages queue | ❌ Not involved |
| Update iteration state | ✅ Maintains state files | ✅ Updates task status |

**Key Principle**: Orchestrator manages the "what" and "when"; agents execute the "how".

## Execution Lifecycle

### Phase 1: Discovery & Initialization
1. **Detect Session Type**: Identify test-fix session from `workflow_type: "test_session"`
2. **Load Session State**: Read `workflow-session.json`, `IMPL_PLAN.md`, `TODO_LIST.md`
3. **Scan Initial Tasks**: Analyze `.task/*.json` files
4. **Initialize TodoWrite**: Create task list including initial tasks
5. **Prepare Iteration Context**: Setup iteration counter and max limits

**Resume Mode**: Load existing iteration context from `.process/iteration-state.json`

### Phase 2: Task Execution Loop
**Main execution loop with dynamic task generation (executed by test-cycle-execute orchestrator):**

**Execution Order**: The workflow begins by executing IMPL-001 (test generation) first. Upon successful completion, IMPL-002 (test-fix cycle) is initiated, starting the iterative test-fix loop.

```
For each task in queue:
  1. [Orchestrator] Load task JSON and context
  2. [Orchestrator] Determine task type (test-gen, test-fix, fix-iteration)
  3. [Orchestrator] Execute task through appropriate agent
  4. [Orchestrator] Collect agent results and check exit conditions
  5. If test failures detected:
     a. [Orchestrator] Run CLI analysis (Gemini/Qwen)
     b. [Orchestrator] Generate fix task JSON (IMPL-fix-N.json)
     c. [Orchestrator] Insert fix task at front of queue
     d. [Orchestrator] Continue loop
  6. If test success:
     a. [Orchestrator] Mark task complete
     b. [Orchestrator] Update TodoWrite
     c. [Orchestrator] Continue to next task
  7. [Orchestrator] Check max iterations limit
```

**Note**: The orchestrator controls the loop. Agents execute individual tasks and return results.

### Phase 3: Iteration Cycle (Test-Fix Loop)

**Orchestrator-controlled iteration with agent delegation:**

#### Iteration Structure
```
Iteration N (managed by test-cycle-execute orchestrator):
├── 1. Test Execution
│   ├── [Orchestrator] Launch @test-fix-agent with test task
│   ├── [Agent] Run test suite
│   ├── [Agent] Collect failures and report back
│   └── [Orchestrator] Receive failure report
├── 2. Failure Analysis
│   ├── [Orchestrator] Run CLI tool (Gemini/Qwen)
│   ├── [CLI Tool] Analyze error messages and failure context
│   ├── [CLI Tool] Identify root causes
│   └── [CLI Tool] Generate fix strategy → saved to iteration-N-analysis.md
├── 3. Fix Task Generation
│   ├── [Orchestrator] Parse CLI analysis results
│   ├── [Orchestrator] Create IMPL-fix-N.json with:
│   │   ├── meta.agent: "@test-fix-agent"
│   │   ├── Failure context (content, not just path)
│   │   └── Fix strategy from CLI analysis
│   └── [Orchestrator] Insert into task queue (front position)
├── 4. Fix Execution
│   ├── [Orchestrator] Launch @test-fix-agent with fix task
│   ├── [Agent] Load fix strategy from task context
│   ├── [Agent] Apply fixes to code/tests
│   └── [Agent] Report completion
└── 5. Re-test
    └── [Orchestrator] Return to step 1 with updated code
```

**Key**: Orchestrator runs CLI analysis between agent tasks, then generates new fix tasks.

#### Iteration Task JSON Template
```json
{
  "id": "IMPL-fix-{iteration}",
  "title": "Fix test failures - Iteration {N}",
  "status": "pending",
  "meta": {
    "type": "test-fix-iteration",
    "agent": "@test-fix-agent",
    "iteration": N,
    "parent_task": "IMPL-002",
    "max_iterations": 5
  },
  "context": {
    "requirements": [
      "Fix identified test failures",
      "Address root causes from analysis"
    ],
    "failure_context": {
      "failed_tests": ["test1", "test2"],
      "error_messages": ["error1", "error2"],
      "failure_analysis": "Raw test output and error messages",
      "previous_attempts": ["iteration-1 context"]
    },
    "fix_strategy": {
      "approach": "Generated by CLI tool (Gemini/Qwen) analysis",
      "modification_points": ["file1:func1", "file2:func2"],
      "expected_outcome": "All tests pass"
    },
    "depends_on": ["IMPL-fix-{N-1}"],
    "inherited": {
      "iteration_history": [...]
    }
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_failure_context",
        "command": "Read(.workflow/{session}/.process/iteration-{N-1}-failures.json)",
        "output_to": "previous_failures",
        "on_error": "skip_optional"
      },
      {
        "step": "load_fix_strategy",
        "command": "Read(.workflow/{session}/.process/iteration-{N}-strategy.md)",
        "output_to": "fix_strategy",
        "on_error": "fail"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Apply fixes from strategy",
        "description": "Implement fixes identified by CLI analysis",
        "modification_points": "From fix_strategy",
        "logic_flow": [
          "Load failure context and strategy",
          "Apply surgical fixes",
          "Run tests",
          "Validate fixes"
        ]
      }
    ],
    "target_files": ["from fix_strategy"],
    "exit_conditions": {
      "success": "all_tests_pass",
      "failure": "max_iterations_reached",
      "max_iterations": 5
    }
  }
}
```

### Phase 4: CLI Analysis Integration

**Orchestrator executes CLI analysis between agent tasks:**

#### When Test Failures Occur
1. **[Orchestrator]** Detects failures from agent output
2. **[Orchestrator]** Collects failure context from `.process/test-results.json` and logs
3. **[Orchestrator]** Runs Gemini/Qwen CLI with failure context
4. **[CLI Tool]** Analyzes failures and generates fix strategy
5. **[Orchestrator]** Saves analysis to `.process/iteration-N-analysis.md`
6. **[Orchestrator]** Generates `IMPL-fix-N.json` with strategy content (not just path)

#### CLI Analysis Command (executed by orchestrator)
```bash
cd {project_root} && gemini -p "
PURPOSE: Analyze test failures and generate fix strategy
TASK: Review test failures and identify root causes
MODE: analysis
CONTEXT: @test files @ implementation files

[Test failure context and requirements...]

EXPECTED: Detailed fix strategy in markdown format
RULES: Focus on minimal changes, avoid over-engineering
"
```

#### Analysis Output Structure
```markdown
# Test Failure Analysis - Iteration {N}

## Root Cause Analysis
1. **Test: test_auth_flow**
   - Error: `Expected 200, got 401`
   - Root Cause: Missing authentication token in request headers
   - Affected Code: `src/auth/client.ts:45`

2. **Test: test_data_validation**
   - Error: `TypeError: Cannot read property 'name' of undefined`
   - Root Cause: Null check missing before property access
   - Affected Code: `src/validators/user.ts:23`

## Fix Strategy

### Priority 1: Authentication Issue
- **File**: src/auth/client.ts
- **Function**: sendRequest (line 45)
- **Change**: Add token header: `headers['Authorization'] = 'Bearer ' + token`
- **Verification**: Run test_auth_flow

### Priority 2: Null Check
- **File**: src/validators/user.ts
- **Function**: validateUser (line 23)
- **Change**: Add check: `if (!user?.name) return false`
- **Verification**: Run test_data_validation

## Verification Plan
1. Apply fixes in order
2. Run test suite after each fix
3. Check for regressions
4. Validate all tests pass

## Risk Assessment
- Low risk: Changes are surgical and isolated
- No breaking changes expected
- Existing tests should remain green
```

### Phase 5: Task Queue Management

**Orchestrator maintains dynamic task queue with runtime insertions:**

#### Dynamic Queue Operations
```
Initial Queue: [IMPL-001, IMPL-002]

After IMPL-002 execution (test failures detected by orchestrator):
  [Orchestrator] Generates IMPL-fix-1.json
  [Orchestrator] Inserts at front: [IMPL-fix-1, IMPL-002-retest, ...]

After IMPL-fix-1 execution (still failures):
  [Orchestrator] Generates IMPL-fix-2.json
  [Orchestrator] Inserts at front: [IMPL-fix-2, IMPL-002-retest, ...]

After IMPL-fix-2 execution (success):
  [Orchestrator] Continues to: [IMPL-002-complete, ...]
```

#### Queue Priority Rules (orchestrator-managed)
1. **Fix tasks**: Inserted at queue front for immediate execution
2. **Retest tasks**: Automatically scheduled after fix tasks
3. **Regular tasks**: Standard dependency order preserved
4. **Iteration limit**: Max 5 fix iterations per test task (orchestrator enforces)

### Phase 6: Completion & Session Management

#### Success Conditions
- All initial tasks completed
- All generated fix tasks completed
- All tests passing
- No pending tasks in queue

#### Completion Steps
1. **Final Validation**: Run full test suite one more time
2. **Update Session State**: Mark all tasks completed
3. **Generate Summary**: Create session completion summary
4. **Update TodoWrite**: Mark all items completed
5. **Auto-Complete**: Call `/workflow:session:complete`

#### Failure Conditions
- Max iterations reached without success
- Unrecoverable test failures
- Agent execution errors

#### Failure Handling
1. **Document State**: Save current iteration context
2. **Generate Report**: Create failure analysis report
3. **Preserve Context**: Keep all iteration logs
4. **Mark Blocked**: Update task status to blocked
5. **Return Control**: Return to user with detailed report

## TodoWrite Coordination

### TodoWrite Structure for Test-Execute
```javascript
TodoWrite({
  todos: [
    {
      content: "Execute IMPL-001: Generate tests [code-developer]",
      status: "completed",
      activeForm: "Executing test generation"
    },
    {
      content: "Execute IMPL-002: Test & Fix Cycle [test-fix-agent] [ITERATION]",
      status: "in_progress",
      activeForm: "Running test-fix iteration cycle"
    },
    {
      content: "  → Iteration 1: Initial test run",
      status: "completed",
      activeForm: "Running initial tests"
    },
    {
      content: "  → Iteration 2: Fix auth issues",
      status: "in_progress",
      activeForm: "Fixing authentication issues"
    },
    {
      content: "  → Iteration 3: Re-test and validate",
      status: "pending",
      activeForm: "Re-testing after fixes"
    }
  ]
});
```

### TodoWrite Update Rules
1. **Initial Tasks**: Standard task list
2. **Iteration Start**: Add nested iteration item
3. **Fix Task Added**: Add fix task as nested item
4. **Iteration Complete**: Mark iteration item completed
5. **All Complete**: Mark parent task completed

## Agent Context Package

**Generated by test-cycle-execute orchestrator before launching agents.**

The orchestrator assembles this context package from:
- Task JSON file (IMPL-*.json)
- Iteration state files
- Test results and failure context
- Session metadata

This package is passed to agents via the Task tool's prompt context.

### Enhanced Context for Test-Fix Agent
```json
{
  "task": { /* IMPL-fix-N.json */ },
  "iteration_context": {
    "current_iteration": N,
    "max_iterations": 5,
    "previous_attempts": [
      {
        "iteration": N-1,
        "failures": ["test1", "test2"],
        "fixes_attempted": ["fix1", "fix2"],
        "result": "partial_success"
      }
    ],
    "failure_analysis": {
      "source": "gemini_cli",
      "analysis_file": ".process/iteration-N-analysis.md",
      "fix_strategy": { /* from CLI */ }
    }
  },
  "test_context": {
    "test_framework": "jest|pytest|...",
    "test_files": ["path/to/test1.test.ts"],
    "test_command": "npm test",
    "coverage_target": 80
  },
  "session": {
    "workflow_dir": ".workflow/WFS-test-{session}/",
    "iteration_state_file": ".process/iteration-state.json",
    "test_results_file": ".process/test-results.json",
    "fix_history_file": ".process/fix-history.json"
  }
}
```

## File Structure

### Test-Fix Session Files
```
.workflow/WFS-test-{session}/
├── workflow-session.json          # Session metadata with workflow_type
├── IMPL_PLAN.md                   # Test plan
├── TODO_LIST.md                   # Progress tracking
├── .task/
│   ├── IMPL-001.json              # Test generation task
│   ├── IMPL-002.json              # Initial test-fix task
│   ├── IMPL-fix-1.json            # Generated: Iteration 1 fix
│   ├── IMPL-fix-2.json            # Generated: Iteration 2 fix
│   └── ...
├── .summaries/
│   ├── IMPL-001-summary.md
│   ├── IMPL-002-summary.md
│   └── iteration-summaries/
│       ├── iteration-1.md
│       ├── iteration-2.md
│       └── ...
└── .process/
    ├── TEST_ANALYSIS_RESULTS.md   # From planning phase
    ├── iteration-state.json       # Current iteration state
    ├── test-results.json          # Latest test results
    ├── test-output.log            # Full test output
    ├── fix-history.json           # All fix attempts
    ├── iteration-1-analysis.md    # CLI analysis for iteration 1
    ├── iteration-1-failures.json  # Failures from iteration 1
    ├── iteration-1-strategy.md    # Fix strategy for iteration 1
    ├── iteration-2-analysis.md
    └── ...
```

### Iteration State JSON
```json
{
  "session_id": "WFS-test-user-auth",
  "current_task": "IMPL-002",
  "current_iteration": 2,
  "max_iterations": 5,
  "started_at": "2025-10-17T10:00:00Z",
  "iterations": [
    {
      "iteration": 1,
      "started_at": "2025-10-17T10:05:00Z",
      "completed_at": "2025-10-17T10:15:00Z",
      "test_results": {
        "total": 10,
        "passed": 7,
        "failed": 3,
        "failures": ["test1", "test2", "test3"]
      },
      "analysis_file": ".process/iteration-1-analysis.md",
      "fix_task": "IMPL-fix-1",
      "result": "partial_success"
    }
  ],
  "status": "active",
  "next_action": "execute_fix_task"
}
```

## Agent Prompt Template

**Unified template for all agent tasks (orchestrator invokes with Task tool):**

```bash
Task(subagent_type="{meta.agent}",
     prompt="**TASK EXECUTION: {task.title}**

     ## STEP 1: Load Complete Task JSON
     **MANDATORY**: First load the complete task JSON from: {session.task_json_path}

     cat {session.task_json_path}

     **CRITICAL**: Validate all required fields present

     ## STEP 2: Task Context (From Loaded JSON)
     **ID**: {task.id}
     **Type**: {task.meta.type}
     **Agent**: {task.meta.agent}

     ## STEP 3: Execute Task Based on Type

     ### For test-gen (IMPL-001):
     - Generate tests based on TEST_ANALYSIS_RESULTS.md
     - Follow test framework conventions
     - Create test files in target_files

     ### For test-fix (IMPL-002):
     - Run test suite: {test_command}
     - Collect results to .process/test-results.json
     - If failures: Save context, return to orchestrator
     - If success: Mark complete

     ### For test-fix-iteration (IMPL-fix-N):
     - Load fix strategy from context.fix_strategy (CONTENT, not path)
     - Apply surgical fixes to identified files
     - Run tests to verify
     - If still failures: Save context with new failure data
     - Update iteration state

     ## STEP 4: Implementation Context (From JSON)
     **Requirements**: {context.requirements}
     **Fix Strategy**: {context.fix_strategy} (full content provided in task JSON)
     **Failure Context**: {context.failure_context}
     **Iteration History**: {context.inherited.iteration_history}

     ## STEP 5: Flow Control Execution
     If flow_control.pre_analysis exists, execute steps sequentially

     ## STEP 6: Agent Completion
     1. Execute task following implementation_approach
     2. Update task status in JSON
     3. Update TODO_LIST.md
     4. Generate summary in .summaries/
     5. **CRITICAL**: Save results for orchestrator to analyze

     **Output Requirements**:
     - test-results.json: Structured test results
     - test-output.log: Full test output
     - iteration-state.json: Current iteration state (if applicable)
     - task-summary.md: Completion summary

     **Return to Orchestrator**: Agent completes and returns. Orchestrator decides next action.
     "),
     description="Execute {task.type} task with JSON validation")
```

**Key Points**:
- Agent executes single task and returns
- Orchestrator analyzes results and decides next step
- Fix strategy content (not path) embedded in task JSON by orchestrator
- Agent does not manage iteration loop

## Error Handling & Recovery

### Iteration Failure Scenarios
| Scenario | Handling | Recovery |
|----------|----------|----------|
| Test execution error | Log error, save context | Retry with error context |
| CLI analysis failure | Fallback to Qwen, or manual analysis | Retry analysis with different tool |
| Agent execution error | Save iteration state | Retry agent with simplified context |
| Max iterations reached | Generate failure report | Mark blocked, return to user |
| Unexpected test regression | Rollback last fix | Analyze regression, add to fix strategy |

### Recovery Procedures

#### Resume from Interruption
```bash
# Load iteration state
iteration_state=$(cat .workflow/{session}/.process/iteration-state.json)
current_iteration=$(jq -r '.current_iteration' <<< "$iteration_state")

# Determine resume point
if [[ "$(jq -r '.next_action' <<< "$iteration_state")" == "execute_fix_task" ]]; then
  # Resume fix task execution
  task_id="IMPL-fix-${current_iteration}"
else
  # Resume test execution
  task_id="IMPL-002"
fi
```

#### Rollback Failed Fix
```bash
# Revert last commit (if fixes were committed)
git revert HEAD

# Remove failed fix task
rm .workflow/{session}/.task/IMPL-fix-{N}.json

# Restore iteration state
jq '.current_iteration -= 1' iteration-state.json > temp.json
mv temp.json iteration-state.json

# Re-run analysis with additional context
# Include failure reason in next analysis
```

## Usage Examples

### Basic Usage
```bash
# Execute test-fix workflow
/workflow:test-cycle-execute

# Resume interrupted session
/workflow:test-cycle-execute --resume-session="WFS-test-user-auth"

# Set custom iteration limit
/workflow:test-cycle-execute --max-iterations=10
```

### Integration with Planning
```bash
# 1. Plan test workflow
/workflow:test-fix-gen WFS-user-auth

# 2. Execute with dynamic iteration
/workflow:test-cycle-execute

# 3. Monitor progress
/workflow:status

# 4. Resume if interrupted
/workflow:test-cycle-execute --resume-session="WFS-test-user-auth"
```

## Best Practices

1. **Set Realistic Iteration Limits**: Default 5, increase for complex fixes
2. **Commit Between Iterations**: Easier rollback if needed
3. **Monitor Iteration Logs**: Review CLI analysis for insights
4. **Incremental Fixes**: Prefer multiple small iterations over large changes
5. **Verify No Regressions**: Check all tests pass, not just previously failing ones
6. **Preserve Context**: All iteration artifacts saved for debugging

## Related Commands

- `/workflow:test-fix-gen` - Planning phase (creates initial tasks)
- `/workflow:execute` - Standard workflow execution (no dynamic iteration)
- `/workflow:status` - Check progress and iteration state
- `/workflow:session:complete` - Mark session complete (auto-called on success)
- `/task:create` - Manually create additional tasks if needed
