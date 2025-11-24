---
name: test-cycle-execute
description: Execute test-fix workflow with dynamic task generation and iterative fix cycles until test pass rate >= 95% or max iterations reached. Uses @cli-planning-agent for failure analysis and task generation.
argument-hint: "[--resume-session=\"session-id\"] [--max-iterations=N]"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Task(*)
---

# Workflow Test-Cycle-Execute Command

## Quick Start

```bash
# Execute test-fix workflow (auto-discovers active session)
/workflow:test-cycle-execute

# Resume interrupted session
/workflow:test-cycle-execute --resume-session="WFS-test-user-auth"

# Custom iteration limit (default: 10)
/workflow:test-cycle-execute --max-iterations=15
```

**Quality Gate**: Test pass rate >= 95% (criticality-aware) or 100%
**Max Iterations**: 10 (default, adjustable)
**CLI Tools**: Gemini → Qwen → Codex (fallback chain)

## What & Why

### Core Concept
Dynamic test-fix orchestrator with **adaptive task generation** based on runtime analysis.

**vs Standard Execute**:
- **Standard**: Pre-defined tasks → Execute sequentially → Done
- **Test-Cycle**: Initial tasks → **Test → Analyze failures → Generate fix tasks → Fix → Re-test** → Repeat until pass

### Value Proposition
1. **Automatic Problem Solving**: No manual intervention needed until 95% pass rate
2. **Intelligent Adaptation**: Strategy adjusts based on progress (conservative → aggressive → exploratory)
3. **Fast Feedback**: Progressive testing runs only affected tests (70-90% faster)
4. **Stuck Handling**: Parallel strategy exploration when same tests fail 3+ times

### Orchestrator Boundary (CRITICAL)
- **ONLY command** handling test failures - always delegate here
- Manages: iteration loop, strategy selection, pass rate validation
- Delegates: CLI analysis to @cli-planning-agent, execution to @test-fix-agent

## How It Works

### Execution Flow (Simplified)

```
1. Discovery
   └─ Load session, tasks, iteration state

2. Main Loop (for each task):
   ├─ Execute → Test → Calculate pass_rate
   ├─ Decision:
   │  ├─ 100% → SUCCESS: Next task
   │  ├─ 95-99% + low criticality → PARTIAL SUCCESS: Approve with note
   │  └─ <95% or critical failures → Fix Loop ↓
   └─ Fix Loop:
      ├─ Detect: stuck tests, regression, progress trend
      ├─ Select strategy: conservative/aggressive/exploratory/surgical
      ├─ Generate fix tasks via @cli-planning-agent:
      │  ├─ Normal: Single IMPL-fix-N.json
      │  └─ Exploratory: 3 parallel alternatives
      ├─ Execute fixes via @test-fix-agent
      └─ Re-test → Back to step 2

3. Completion
   └─ Final validation → Generate summary → Auto-complete session
```

### Agent Roles

| Agent | Responsibility |
|-------|---------------|
| **Orchestrator** | Loop control, strategy selection, pass rate calculation, threshold decisions |
| **@cli-planning-agent** | CLI analysis (Gemini/Qwen/Codex), root cause extraction, task generation, affected test detection |
| **@test-fix-agent** | Test execution, code fixes, criticality assignment, result reporting |

## Enhanced Features

### 1. Intelligent Strategy Engine

**Auto-selects optimal strategy based on iteration context:**

| Strategy | Trigger | Behavior |
|----------|---------|----------|
| **Conservative** | Iteration 1-2 (default) | Single targeted fix, full validation |
| **Aggressive** | Pass rate >80% + similar failures | Batch fix related issues |
| **Exploratory** | Stuck tests (3+ failures) at iteration 3+ | Parallel try 3 alternative approaches |
| **Surgical** | Regression detected (pass rate drops >10%) | Minimal changes, rollback focus |

**Selection Logic** (in orchestrator):
```javascript
if (iteration <= 2) return "conservative";
if (passRate > 80 && failurePattern.similarity > 0.7) return "aggressive";
if (stuckTests > 0 && iteration >= 3) return "exploratory";
if (regressionDetected) return "surgical";
```

**Integration**: Strategy passed to @cli-planning-agent in prompt for tailored analysis.

### 2. Progressive Testing

**Runs affected tests during iterations, full suite only for final validation.**

**How It Works**:
1. @cli-planning-agent analyzes fix_strategy.modification_points
2. Maps modified files to test files (via imports + integration patterns)
3. Returns `affected_tests[]` in task JSON
4. @test-fix-agent runs: `npm test -- ${affected_tests.join(' ')}`
5. Final validation: `npm test` (full suite)

**Task JSON**:
```json
{
  "fix_strategy": {
    "modification_points": ["src/auth/middleware.ts:validateToken:45-60"],
    "test_execution": {
      "mode": "affected_only",
      "affected_tests": ["tests/auth/*.test.ts"],
      "fallback_to_full": true
    }
  }
}
```

**Benefits**: 70-90% iteration speed improvement, instant feedback on fix effectiveness.

### 3. Parallel Strategy Exploration

**Automatically triggered when stuck on same failures 3+ consecutive times.**

**Workflow**:
```
Stuck Detected (iteration 3+):
├─ Orchestrator switches to "exploratory" strategy
├─ @cli-planning-agent generates 3 alternative fix approaches:
│  ├─ Approach A: Refactor validation logic
│  ├─ Approach B: Fix dependency initialization
│  └─ Approach C: Adjust test expectations
├─ Orchestrator creates 3 task JSONs (IMPL-fix-Na, Nb, Nc)
├─ Execute in parallel via git worktree:
│  ├─ worktree-a/ → Apply fix-Na → Test → Pass rate: 92%
│  ├─ worktree-b/ → Apply fix-Nb → Test → Pass rate: 88%
│  └─ worktree-c/ → Apply fix-Nc → Test → Pass rate: 95% ✓
└─ Select best result (highest pass_rate), apply to main branch
```

**Implementation**:
```bash
# Orchestrator creates isolated worktrees
git worktree add ../worktree-{a,b,c}

# Launch 3 @test-fix-agent instances in parallel (haiku for speed)
Task(subagent_type="test-fix-agent", model="haiku", ...) x3

# Collect results, select winner
```

**Benefits**: Escapes stuck situations, explores solution space efficiently.

## Core Responsibilities

### Orchestrator
- Session discovery, task queue management
- Pass rate calculation: `(passed / total) * 100` from test-results.json
- Criticality assessment (high/medium/low)
- Strategy selection based on context
- Detection: stuck tests (3+ consecutive), regression (>10% drop)
- Iteration control (max 10, default)
- CLI tool fallback chain: Gemini → Qwen → Codex
- TodoWrite progress tracking
- Session auto-complete (pass rate >= 95%)

### @cli-planning-agent
- Execute CLI analysis with bug diagnosis template
- Parse output for root causes and fix strategy
- Generate IMPL-fix-N.json task definition
- Detect affected tests for progressive testing
- Save: analysis.md, cli-output.txt

### @test-fix-agent
- Execute tests, save results to test-results.json
- Apply fixes from task.context.fix_strategy
- Assign criticality to failures
- Update task status

## Reference

### CLI Tool Configuration

**Fallback Chain**: Gemini → Qwen → Codex
**Template**: `~/.claude/workflows/cli-templates/prompts/analysis/01-diagnose-bug-root-cause.txt`
**Timeout**: 40min (2400000ms)

**Tool Details**:
1. **Gemini** (primary): `gemini-2.5-pro`
2. **Qwen** (fallback): `coder-model`
3. **Codex** (fallback): `gpt-5.1-codex`

**When to Fallback**: HTTP 429, timeout, analysis quality degraded

### Session File Structure

```
.workflow/active/WFS-test-{session}/
├── workflow-session.json           # Session metadata
├── IMPL_PLAN.md, TODO_LIST.md
├── .task/
│   ├── IMPL-{001,002}.json         # Initial tasks
│   ├── IMPL-fix-{N}.json           # Generated fix tasks
│   └── IMPL-fix-{N}-parallel.json  # Parallel exploration
├── .process/
│   ├── iteration-state.json        # Current iteration + strategy + stuck tests
│   ├── test-results.json           # Latest results (pass_rate, criticality)
│   ├── test-output.log             # Full test output
│   ├── fix-history.json            # All fix attempts
│   ├── iteration-{N}-analysis.md   # CLI analysis report
│   └── iteration-{N}-cli-output.txt
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
      "strategy": "conservative"
    },
    {
      "iteration": 3,
      "pass_rate": 89,
      "strategy": "aggressive",
      "stuck_tests": ["test_auth_edge_case"]
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

### Agent Invocation Template

**@cli-planning-agent** (failure analysis):
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

    ## Context Metadata
    - Session ID: ${sessionId}
    - Current Iteration: ${N} / ${maxIterations}
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

    ## Strategy-Specific Requirements
    - Conservative: Single targeted fix, high confidence required
    - Aggressive: Batch fix similar failures, pattern-based approach
    - Exploratory: Generate 3 alternative approaches with different hypotheses
    - Surgical: Minimal changes, focus on rollback safety

    ## Success Criteria
    - Concrete fix strategy with modification points (file:function:lines)
    - Affected tests list for progressive testing
    - Root cause analysis (not just symptoms)
  `
)
```

**@test-fix-agent** (execution):
- Paths provided by orchestrator (task_json_path, iteration_state_path, etc.)
- Agent loads files independently
- Executes based on task.meta.type and fix_strategy

### Completion Conditions

**Full Success**:
- All tasks completed
- Pass rate === 100%
- Action: Auto-complete session

**Partial Success**:
- All tasks completed
- Pass rate >= 95% and < 100%
- All failures are "low" criticality
- Action: Auto-approve with review note

**Failure**:
- Max iterations (10) reached without 95% pass rate
- Pass rate < 95% after max iterations
- Action: Generate failure report, mark blocked, return to user

### Error Handling

| Scenario | Action |
|----------|--------|
| Test execution error | Log, retry with error context |
| CLI analysis failure | Fallback: Gemini → Qwen → Codex → manual |
| Agent execution error | Save state, retry with simplified context |
| Max iterations reached | Generate failure report, mark blocked |
| Regression detected | Rollback last fix, switch to surgical strategy |
| Stuck tests detected | Switch to exploratory strategy (parallel) |

### TodoWrite Structure

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
- Add iteration item with: strategy, pass rate
- Mark completed after each iteration
- Update parent task when all complete

## Best Practices

1. **Default Settings Work**: 10 iterations sufficient for most cases
2. **Commit Between Iterations**: Enables rollback if needed
3. **Trust Strategy Engine**: Auto-selection based on proven heuristics
4. **Monitor Logs**: Check `.process/iteration-N-analysis.md` for insights
5. **Progressive Testing**: Saves 70-90% iteration time
6. **Parallel Exploration**: Auto-triggers at iteration 3 if stuck
