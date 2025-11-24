---
name: test-cycle-execute
description: Execute test-fix workflow with dynamic task generation and iterative fix cycles until test pass rate >= 95% or max iterations reached. Uses @cli-planning-agent for failure analysis and task generation.
argument-hint: "[--resume-session=\"session-id\"] [--max-iterations=N]"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Task(*)
---

# Workflow Test-Cycle-Execute Command

## Architecture & Philosophy

**Core Concept**: Dynamic test-fix orchestrator with adaptive task generation based on runtime analysis.

**Quality Gate**: Iterates until test pass rate >= 95% (with criticality assessment) or 100% (full pass).

**Key Differences from Standard Execute**:
- **Standard**: Pre-defined task queue → Sequential execution → Complete
- **Test-Cycle**: Initial tasks → Test → Analyze → Generate fix tasks → Execute → Re-test → Repeat

**Orchestrator Boundary (CRITICAL)**:
- This command is the **ONLY place** where test failures are handled
- All failure analysis delegated to **@cli-planning-agent** (Gemini/Qwen/Codex)
- All fixes applied by **@test-fix-agent**
- Orchestrator manages: pass rate calculation, criticality assessment, iteration loop, strategy selection

**Agent Coordination**:
- **Orchestrator**: Loop control, strategy selection, pass rate calculation, threshold decisions
- **@cli-planning-agent**: CLI analysis (Gemini/Qwen/Codex), root cause extraction, fix task generation
- **@test-fix-agent**: Test execution, code fixes, result reporting

**Resume Mode**: `--resume-session` flag skips discovery and continues from interruption point.

## Enhanced Features

### 1. Intelligent Strategy Engine

**Strategy Types**:
- **Conservative** (default): Single fix per iteration, full validation
- **Aggressive**: Batch fix similar failures (when pass rate >80% + high pattern similarity)
- **Exploratory**: Parallel multi-strategy attempt (when stuck on same failures 3+ times)
- **Surgical**: Minimal changes, rollback on regression

**Strategy Selection Logic**:
```javascript
// In orchestrator, before invoking @cli-planning-agent
function selectStrategy(context) {
  const { passRate, iteration, stuckTests, regressionDetected } = context;

  if (iteration <= 2) return "conservative";
  if (passRate > 80 && context.failurePattern.similarity > 0.7) return "aggressive";
  if (stuckTests > 0 && iteration >= 3) return "exploratory";
  if (regressionDetected) return "surgical";
  return "conservative";
}
```

**Integration**: Orchestrator passes selected strategy to @cli-planning-agent in prompt.

### 2. Progressive Testing

**Concept**: Run affected tests during iterations, full suite on final validation.

**Affected Test Detection**:
- @cli-planning-agent analyzes modified files from fix strategy
- Maps to test files via imports and integration patterns
- Returns `affected_tests[]` in fix task JSON

**Execution**:
- **Iteration N**: `npm test -- ${affected_tests.join(' ')}` (fast feedback)
- **Final validation**: `npm test` (comprehensive check)

**Benefits**: 70-90% iteration speed improvement.

**Task JSON Integration**:
```json
{
  "context": {
    "fix_strategy": {
      "test_execution": {
        "mode": "affected_only",
        "affected_tests": ["tests/auth/client.test.ts"],
        "fallback_to_full": true
      }
    }
  }
}
```

### 3. Parallel Strategy Exploration

**Trigger**: Iteration >= 3 AND stuck tests detected (same test failed 3+ consecutive times)

**Workflow**:
```
Stuck State Detected → Switch to "exploratory" strategy:
├── @cli-planning-agent generates 3 alternative fix approaches
├── Orchestrator creates 3 task JSONs: IMPL-fix-Na, IMPL-fix-Nb, IMPL-fix-Nc
├── Execute in parallel via git worktree:
│   ├── worktree-a/ → Apply fix-Na → Test → Score: 92%
│   ├── worktree-b/ → Apply fix-Nb → Test → Score: 88%
│   └── worktree-c/ → Apply fix-Nc → Test → Score: 95% ✓
└── Select best result, apply to main branch
```

**Implementation**:
```bash
# Orchestrator creates worktrees
git worktree add ../worktree-a
git worktree add ../worktree-b
git worktree add ../worktree-c

# Launch 3 @test-fix-agent instances in parallel
Task(subagent_type="test-fix-agent", prompt="...", model="haiku") x3

# Collect results, select winner by pass_rate
```

**Task JSON**:
```json
{
  "id": "IMPL-fix-3-parallel",
  "meta": {
    "type": "parallel-exploration",
    "strategies": ["IMPL-fix-3a", "IMPL-fix-3b", "IMPL-fix-3c"],
    "selection_criteria": "highest_pass_rate"
  }
}
```

## Core Responsibilities

**Orchestrator**:
- Session discovery and task queue management
- Pass rate calculation: `(passed / total) * 100` from test-results.json
- Criticality assessment from test-results.json
- Strategy selection (conservative/aggressive/exploratory/surgical)
- Stuck test detection (same test failed 3+ times)
- Regression detection (pass rate dropped >10%)
- Iteration control (max 10 iterations, default)
- CLI tool selection (Gemini → Qwen → Codex fallback chain)
- Failure analysis delegation to @cli-planning-agent
- TodoWrite progress tracking
- Session auto-complete when pass rate >= 95%

**@cli-planning-agent**:
- Execute CLI analysis (Gemini/Qwen/Codex) with bug diagnosis template
- Parse CLI output for root causes and fix strategy
- Generate IMPL-fix-N.json with structured task definition
- Detect affected tests for progressive testing
- Save analysis reports and CLI output

**@test-fix-agent**:
- Execute tests and save results to test-results.json
- Apply fixes from task JSON fix_strategy
- Assign criticality to test failures
- Update task status

## Execution Flow

### Phase 1: Discovery & Initialization
1. Detect test-fix session from `workflow_type: "test_session"`
2. Load workflow-session.json, IMPL_PLAN.md, .task/*.json
3. Initialize TodoWrite with initial tasks
4. Setup iteration context (current=0, max=10, strategy="conservative")

**Resume Mode**: Load iteration-state.json, continue from `next_action`.

### Phase 2: Task Execution Loop

```javascript
For each task in queue:
  1. Load task JSON and context
  2. Determine task type (test-gen, test-fix, fix-iteration, parallel-exploration)
  3. Execute via appropriate agent
  4. Collect results from test-results.json
  5. Calculate pass rate: (passed / total) * 100
  6. Assess criticality from test-results.json
  7. Detect regression: if passRate < previousPassRate - 10% → REGRESSION
  8. Detect stuck tests: if same test failed 3+ consecutive iterations → STUCK

  9. Make threshold decision:
     IF passRate === 100%:
       → SUCCESS: Mark complete, continue to next task

     ELSE IF passRate >= 95%:
       → CHECK criticality:
          - All "low" → PARTIAL SUCCESS (auto-approve with note)
          - Any "high"/"medium" → Enter fix loop (step 10)

     ELSE IF passRate < 95%:
       → FAILED: Enter fix loop (step 10)

  10. Fix Loop (if needed):
      a. Select strategy: conservative/aggressive/exploratory/surgical
      b. If strategy === "exploratory":
         - Invoke @cli-planning-agent for 3 alternative approaches
         - Create parallel tasks (IMPL-fix-Na, Nb, Nc)
         - Execute in parallel via git worktree
         - Select best result (highest pass_rate)
         - Apply to main branch
      c. Else:
         - Invoke @cli-planning-agent with selected strategy
         - Generate single IMPL-fix-N.json
         - Insert at queue front
      d. Continue loop

  11. Check max iterations (abort if exceeded)
```

### Phase 3: Iteration Cycle (Per Fix Task)

**Structure**:
```
Iteration N:
├── 1. Test Execution (via @test-fix-agent)
│   ├── Mode: affected_only or full_suite (from task JSON)
│   ├── Save results: test-results.json, test-output.log
│   └── Report to orchestrator
├── 2. Pass Rate Validation (orchestrator)
│   ├── Calculate: (passed / total) * 100
│   ├── Assess criticality
│   ├── Detect regression/stuck
│   └── Select strategy
├── 3. Failure Analysis (via @cli-planning-agent)
│   ├── Input: failure context + selected strategy
│   ├── CLI tool: Gemini (fallback: Qwen → Codex)
│   ├── Output: IMPL-fix-N.json, iteration-N-analysis.md, cli-output.txt
│   └── Return task ID to orchestrator
└── 4. Fix Execution (via @test-fix-agent)
    ├── Load fix_strategy from task JSON
    ├── Apply changes (surgical fixes)
    └── Return to step 1 for re-test
```

### Phase 4: Completion

**Success Conditions**:
- All tasks completed
- Pass rate === 100% (full success)

**Partial Success Conditions**:
- All tasks completed
- Pass rate >= 95% and < 100%
- All failures are "low" criticality
- **Action**: Auto-approve with review note

**Completion Steps**:
1. Final validation: Run full test suite
2. Calculate final pass rate
3. Assess status (full/partial/failure)
4. Update session state
5. Generate summary with pass rate metrics
6. Call `/workflow:session:complete`

**Failure Conditions**:
- Max iterations (10) reached without 95% pass rate
- Pass rate < 95% after max iterations
- Unrecoverable errors

**Failure Handling**:
1. Document final state with pass rate
2. Generate failure report (remaining failures, iteration history, recommendations)
3. Mark tasks as blocked
4. Return control to user

## Agent Coordination Details

### @cli-planning-agent Invocation

**CLI Tool Selection** (fallback chain):
1. **Gemini** (primary): `gemini-2.5-pro`
2. **Qwen** (fallback): `coder-model`
3. **Codex** (fallback): `gpt-5.1-codex`

**Template**: `~/.claude/workflows/cli-templates/prompts/analysis/01-diagnose-bug-root-cause.txt`

**Timeout**: 40min (2400000ms)

**Prompt Structure**:
```javascript
Task(
  subagent_type="cli-planning-agent",
  description=`Analyze test failures (iteration ${N}) - ${strategy} strategy`,
  prompt=`
    ## Task Objective
    Analyze test failures and generate fix task JSON for iteration ${N}

    ## Strategy
    ${selectedStrategy} - ${strategyDescription}

    ## MANDATORY FIRST STEPS
    1. Read test results: ${session.test_results_path}
    2. Read test output: ${session.test_output_path}
    3. Read iteration state: ${session.iteration_state_path}

    ## Session Paths
    - Workflow Dir: ${session.workflow_dir}
    - Test Results: ${session.test_results_path}
    - Task Output Dir: ${session.task_dir}
    - Analysis Output: ${session.process_dir}/iteration-${N}-analysis.md

    ## Context Metadata
    - Session ID: ${sessionId}
    - Current Iteration: ${N}
    - Max Iterations: 10
    - Current Pass Rate: ${passRate}%
    - Selected Strategy: ${selectedStrategy}
    - Stuck Tests: ${stuckTests}

    ## CLI Configuration
    - Tool Priority: gemini → qwen → codex
    - Template: 01-diagnose-bug-root-cause.txt
    - Timeout: 2400000ms

    ## Expected Deliverables
    1. Task JSON: ${session.task_dir}/IMPL-fix-${N}.json
       - Must include: fix_strategy.test_execution.affected_tests[]
       - Must include: fix_strategy.confidence_score
    2. Analysis report: ${session.process_dir}/iteration-${N}-analysis.md
    3. CLI output: ${session.process_dir}/iteration-${N}-cli-output.txt
    4. Return task ID to orchestrator

    ## Strategy-Specific Requirements
    ${strategyRequirements[selectedStrategy]}

    ## Success Criteria
    - Valid IMPL-fix-${N}.json with all required fields
    - Concrete fix strategy with modification points (file:function:lines)
    - Affected tests list for progressive testing
    - Root cause analysis (not just symptoms)
  `
)
```

**Strategy-Specific Requirements**:
```javascript
const strategyRequirements = {
  conservative: "Single targeted fix, high confidence required",
  aggressive: "Batch fix similar failures, pattern-based approach",
  exploratory: "Generate 3 alternative approaches with different root cause hypotheses",
  surgical: "Minimal changes, focus on rollback safety"
};
```

### @test-fix-agent Context Loading

**File Loading Sequence**:
1. Task JSON (`task_json_path`)
2. Iteration state (`iteration_state_path`)
3. Test results (`test_results_path`)
4. Test output (`test_output_path`)
5. Analysis report (`analysis_path`)
6. Fix history (`fix_history_path`)

**Paths Provided by Orchestrator**:
```javascript
{
  "task_json_path": ".workflow/active/WFS-test-{session}/.task/IMPL-fix-N.json",
  "iteration_state_path": ".workflow/active/WFS-test-{session}/.process/iteration-state.json",
  "test_results_path": ".workflow/active/WFS-test-{session}/.process/test-results.json",
  "test_output_path": ".workflow/active/WFS-test-{session}/.process/test-output.log",
  "analysis_path": ".workflow/active/WFS-test-{session}/.process/iteration-N-analysis.md",
  "workflow_dir": ".workflow/active/WFS-test-{session}/",
  "session_id": "WFS-test-{session}",
  "current_iteration": N,
  "max_iterations": 10
}
```

## Data Structures

### Session File Structure
```
.workflow/active/WFS-test-{session}/
├── workflow-session.json
├── IMPL_PLAN.md, TODO_LIST.md
├── .task/
│   ├── IMPL-{001,002}.json              # Initial tasks
│   ├── IMPL-fix-{N}.json                # Generated fix tasks
│   └── IMPL-fix-{N}-parallel.json       # Parallel exploration tasks
├── .process/
│   ├── iteration-state.json             # Current iteration + strategy
│   ├── test-results.json                # Latest test results
│   ├── test-output.log                  # Full test output
│   ├── fix-history.json                 # All fix attempts
│   ├── iteration-{N}-analysis.md        # CLI analysis
│   └── iteration-{N}-cli-output.txt     # Raw CLI output
└── .summaries/iteration-summaries/
```

### Iteration State JSON
```json
{
  "session_id": "WFS-test-user-auth",
  "current_task": "IMPL-002",
  "current_iteration": 3,
  "max_iterations": 10,
  "selected_strategy": "aggressive",
  "iterations": [
    {
      "iteration": 1,
      "pass_rate": 70,
      "strategy": "conservative",
      "stuck_tests": [],
      "regression_detected": false
    },
    {
      "iteration": 2,
      "pass_rate": 82,
      "strategy": "conservative",
      "stuck_tests": [],
      "regression_detected": false
    },
    {
      "iteration": 3,
      "pass_rate": 89,
      "strategy": "aggressive",
      "stuck_tests": ["test_auth_edge_case"],
      "regression_detected": false
    }
  ],
  "stuck_tests": ["test_auth_edge_case"],
  "next_action": "execute_fix_task"
}
```

### Task JSON Template (Fix Iteration)
```json
{
  "id": "IMPL-fix-3",
  "title": "Fix test failures - Iteration 3 (aggressive)",
  "status": "pending",
  "meta": {
    "type": "test-fix-iteration",
    "agent": "@test-fix-agent",
    "iteration": 3,
    "strategy": "aggressive",
    "max_iterations": 10
  },
  "context": {
    "requirements": ["Fix identified test failures", "Address root causes"],
    "failure_context": {
      "failed_tests": ["test1", "test2"],
      "error_messages": ["error1", "error2"],
      "pass_rate": 89,
      "stuck_tests": ["test_auth_edge_case"]
    },
    "fix_strategy": {
      "approach": "Batch fix authentication validation across multiple endpoints",
      "modification_points": ["src/auth/middleware.ts:validateToken:45-60"],
      "confidence_score": 0.85,
      "test_execution": {
        "mode": "affected_only",
        "affected_tests": ["tests/auth/*.test.ts"],
        "fallback_to_full": true
      }
    }
  }
}
```

## Error Handling

| Scenario | Action |
|----------|--------|
| Test execution error | Log error, retry with error context |
| CLI analysis failure | Fallback: Gemini → Qwen → Codex → manual |
| Agent execution error | Save state, retry with simplified context |
| Max iterations reached | Generate failure report, mark blocked |
| Regression detected | Rollback last fix, switch to surgical strategy |
| Stuck tests detected | Switch to exploratory strategy (parallel) |

**CLI Fallback Chain**:
1. Try Gemini (primary)
2. If HTTP 429 or error: Try Qwen
3. If Qwen fails: Try Codex
4. If all fail: Mark as degraded, use basic pattern matching

## TodoWrite Coordination

**Structure**:
```javascript
TodoWrite({
  todos: [
    {
      content: "Execute IMPL-001: Generate tests [code-developer]",
      status: "completed",
      activeForm: "Executing test generation"
    },
    {
      content: "Execute IMPL-002: Test & Fix Cycle [ITERATION]",
      status: "in_progress",
      activeForm: "Running test-fix iteration cycle"
    },
    {
      content: "  → Iteration 1: Initial test (pass: 70%, conservative)",
      status: "completed",
      activeForm: "Running initial tests"
    },
    {
      content: "  → Iteration 2: Fix validation (pass: 82%, conservative)",
      status: "completed",
      activeForm: "Fixing validation issues"
    },
    {
      content: "  → Iteration 3: Batch fix auth (pass: 89%, aggressive)",
      status: "in_progress",
      activeForm: "Fixing authentication issues"
    }
  ]
});
```

**Update Rules**:
1. Add iteration item with strategy and pass rate
2. Mark completed after each iteration
3. Update parent task when all complete

## Usage

```bash
# Execute test-fix workflow (discovers active session)
/workflow:test-cycle-execute

# Resume interrupted session
/workflow:test-cycle-execute --resume-session="WFS-test-user-auth"

# Custom iteration limit
/workflow:test-cycle-execute --max-iterations=15
```

## Best Practices

1. **Iteration Limits**: Default 10, adjust based on complexity
2. **Commit Between Iterations**: Enables easier rollback
3. **Monitor Iteration Logs**: Review CLI analysis quality
4. **Trust Strategy Engine**: Let orchestrator select optimal approach
5. **Leverage Progressive Testing**: 70-90% faster iterations
6. **Watch for Stuck Tests**: Parallel exploration auto-triggers at iteration 3
