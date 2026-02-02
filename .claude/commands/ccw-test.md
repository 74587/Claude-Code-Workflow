---
name: ccw-test
description: Test coordinator - analyze testing needs, select test strategy, execute test workflow in main process
argument-hint: "[--mode gen|fix|verify|tdd] [--yes|-y] \"test description\""
allowed-tools: Skill(*), TodoWrite(*), AskUserQuestion(*), Read(*), Bash(*)
---

# CCW-Test Command - Test Coordinator

Test orchestrator: testing needs analysis → strategy selection → test execution.

## Core Concept: Test Units (测试单元)

**Definition**: Test commands grouped into logical units based on testing objectives.

**Test Units**:

| Unit Type | Pattern | Example |
|-----------|---------|---------|
| **Generation Only** | test-gen (no execution) | test-fix-gen |
| **Test + Fix Cycle** | test-gen → test-execute-fix | test-fix-gen → test-cycle-execute |
| **Verification Only** | existing-tests → execute | execute-tests |
| **TDD Cycle** | tdd-plan → tdd-execute → verify | Red-Green-Refactor |

**Atomic Rules**:
1. Gen mode: Generate tests only (no execution)
2. Fix mode: Generate + auto-iteration until ≥95% pass
3. Verify mode: Execute existing tests + report
4. TDD mode: Full Red-Green-Refactor cycle compliance

## Execution Model

**Synchronous (Main Process)**: Test commands execute via Skill, blocking until complete.

```
User Input → Analyze Testing Needs → Select Strategy → [Confirm] → Execute Tests
                                                                     ↓
                                                           Skill (blocking)
                                                                     ↓
                                                           Update TodoWrite
                                                                     ↓
                                                           Generate Tests/Results
```

## 5-Phase Workflow

### Phase 1: Analyze Testing Needs

**Input** → Extract (description, target_module, existing_tests) → Assess (testing_goal, framework, coverage_target) → **Analysis**

| Field | Values |
|-------|--------|
| testing_goal | generate \| fix \| verify \| tdd |
| framework | jest \| vitest \| pytest \| ... |
| coverage_target | 0-100 (default: 80) |
| existing_tests | true \| false |

#### Mode Detection (Priority Order)

```
Input Keywords                                  → Mode
─────────────────────────────────────────────────────────
generate|create|write test|need test           → gen
fix|repair|failing|broken                      → fix
verify|validate|check|run test                 → verify
tdd|test-driven|test first                     → tdd
(default)                                      → fix
```

**Output**: `TestingGoal: [goal] | Mode: [mode] | Target: [module] | Framework: [framework]`

---

### Phase 1.5: Testing Clarification (if needed)

```
Analysis → Check testing_goal known?
           ↓
       YES → Check target_module set?
           ↓
       YES → Continue to Phase 2
           ↓
        NO → Ask Questions → Update Analysis
```

**Questions Asked**: Testing Goal, Target Module/Files, Coverage Requirements, Test Framework

---

### Phase 2: Select Test Strategy & Build Command Chain

```
Analysis → Detect Mode (keywords) → Build Command Chain → Test Workflow
```

#### Command Chain Mapping

| Mode | Command Chain | Behavior |
|------|---------------|----------|
| **gen** | test-fix-gen | Generate only, no execution |
| **fix** | test-fix-gen → test-cycle-execute (iterate) | Auto-iteration until ≥95% pass or max iterations |
| **verify** | execute-existing-tests → coverage-report | Execute + report only |
| **tdd** | tdd-plan → execute → tdd-verify | Red-Green-Refactor cycle compliance |

**Note**: `(iterate)` = auto-iteration until pass_rate ≥ 95% or max_iterations reached

**Output**: `Mode: [mode] | Strategy: [strategy] | Commands: [1. /cmd1 2. /cmd2]`

---

### Phase 3: User Confirmation

```
Test Chain → Show Strategy → Ask User → User Decision:
- ✓ Confirm → Continue to Phase 4
- ⚙ Change Mode → Select Different Mode (back to Phase 2)
- ✗ Cancel → Abort
```

---

### Phase 4: Setup TODO Tracking & Status File

```
Test Chain → Create Session Dir → Initialize Tracking → Tracking State
```

**Session Structure**:
```
Session ID: CCWT-{target-module-slug}-{date}
Session Dir: .workflow/.ccw-test/{session_id}/

TodoWrite:
  CCWT:{mode}: [1/n] /command1  [in_progress]
  CCWT:{mode}: [2/n] /command2  [pending]
  ...

status.json:
  {
    "session_id": "CCWT-...",
    "mode": "gen|fix|verify|tdd",
    "status": "running",
    "testing": { description, target_module, framework, coverage_target },
    "command_chain": [...],
    "test_metrics": { total_tests, passed, failed, pass_rate, iteration_count, coverage }
  }
```

**Output**:
- TODO: `-> CCWT:fix: [1/2] /workflow:test-fix-gen | CCWT:fix: [2/2] /workflow:test-cycle-execute`
- Status File: `.workflow/.ccw-test/{session_id}/status.json`

---

### Phase 5: Execute Test Chain

#### For All Modes (Sequential Execution)

```
Start Command → Update status (running) → Execute via Skill → Result
                                                   ↓
                         Update test_metrics → Next Command
                                                   ↓
                         Error? → YES → Ask Action (Retry/Skip/Abort)
                               → NO → Continue
```

#### For Fix Mode (Auto-Iteration)

```
test-fix-gen completes → test-cycle-execute begins
                              ↓
                         Check pass_rate ≥ 95%?
                         ↓                    ↓
                       YES → Complete    NO → Check iteration < max?
                                         ↓                      ↓
                                       YES → Iteration      NO → Complete
                                         |   (analyze failures
                                         |    generate fix
                                         |    re-execute tests)
                                         |
                                         └→ Loop back to pass_rate check
```

#### Error Handling Pattern

```
Command Error → Update status (failed) → Ask User:
  - Retry → Re-execute (same index)
  - Skip → Continue next command
  - Abort → Stop execution
```

#### Test Metrics Update

```
After Each Execution → Collect test_metrics:
  - total_tests: number
  - passed/failed: count
  - pass_rate: percentage
  - iteration_count: increment (fix mode)
  - coverage: line/branch/function
       ↓
Update status.json → Update TODO with iteration info (if fix mode)
```

---

## Execution Flow Summary

```
User Input
    |
Phase 1: Analyze Testing Needs
    |-- Extract: description, testing_goal, target_module, existing_tests
    +-- If unclear -> Phase 1.5: Clarify Testing Needs
    |
Phase 2: Select Test Strategy & Build Chain
    |-- Detect mode: gen | fix | verify | tdd
    |-- Build command chain based on mode
    +-- Configure iteration limits (fix mode)
    |
Phase 3: User Confirmation (optional)
    |-- Show test strategy
    +-- Allow mode change
    |
Phase 4: Setup TODO Tracking & Status File
    |-- Create todos with CCWT prefix
    +-- Initialize .workflow/.ccw-test/{session_id}/status.json
    |
Phase 5: Execute Test Chain
    |-- For each command:
    |   |-- Update status.json (current=running)
    |   |-- Execute via Skill
    |   |-- Test-fix cycle: iterate until ≥95% pass or max iterations
    |   |-- Update test_metrics in status.json
    |   +-- Update TODO status
    +-- Mark status.json as completed
```

---

## Test Pipeline Examples

| Input | Mode | Pipeline | Iteration |
|-------|------|----------|-----------|
| "Generate tests for auth module" | gen | test-fix-gen | No execution |
| "Fix failing authentication tests" | fix | test-fix-gen → test-cycle-execute (iterate) | Max 3 iterations |
| "Run existing test suite" | verify | execute-tests → coverage-report | One-time |
| "Implement user profile with TDD" | tdd | tdd-plan → execute → tdd-verify | Red-Green-Refactor |

**Legend**: `(iterate)` = auto-iteration until ≥95% pass rate

---

## State Management

### Dual Tracking System

**1. TodoWrite-Based Tracking** (UI Display):

```
// Initial state (fix mode)
CCWT:fix: [1/2] /workflow:test-fix-gen           [in_progress]
CCWT:fix: [2/2] /workflow:test-cycle-execute     [pending]

// During iteration (fix mode, iteration 2/3)
CCWT:fix: [1/2] /workflow:test-fix-gen           [completed]
CCWT:fix: [2/2] /workflow:test-cycle-execute     [in_progress] (iteration 2/3, pass rate: 78%)

// Gen mode (no execution)
CCWT:gen: [1/1] /workflow:test-fix-gen           [in_progress]

// Verify mode (one-time)
CCWT:verify: [1/2] execute-existing-tests        [in_progress]
CCWT:verify: [2/2] generate-coverage-report      [pending]

// TDD mode (Red-Green-Refactor)
CCWT:tdd: [1/3] /workflow:tdd-plan               [in_progress]
CCWT:tdd: [2/3] /workflow:execute                [pending]
CCWT:tdd: [3/3] /workflow:tdd-verify             [pending]
```

**2. Status.json Tracking**: Persistent state for test monitoring.

**Location**: `.workflow/.ccw-test/{session_id}/status.json`

**Structure**:
```json
{
  "session_id": "CCWT-auth-module-2025-02-02",
  "mode": "fix",
  "status": "running|completed|failed",
  "created_at": "2025-02-02T10:00:00Z",
  "updated_at": "2025-02-02T10:05:00Z",
  "testing": {
    "description": "Fix failing authentication tests",
    "target_module": "src/auth/**/*.ts",
    "framework": "jest",
    "coverage_target": 80
  },
  "command_chain": [
    { "index": 0, "command": "/workflow:test-fix-gen", "unit": "sequential", "status": "completed" },
    { "index": 1, "command": "/workflow:test-cycle-execute", "unit": "test-fix-cycle", "max_iterations": 3, "status": "in_progress" }
  ],
  "current_index": 1,
  "test_metrics": {
    "total_tests": 42,
    "passed": 38,
    "failed": 4,
    "pass_rate": 90.5,
    "iteration_count": 2,
    "coverage": {
      "line": 82.3,
      "branch": 75.6,
      "function": 88.1
    }
  }
}
```

**Status Values**:
- `running`: Test workflow in progress
- `completed`: Tests passing (≥95%) or generation complete
- `failed`: Test workflow aborted

**Test Metrics** (updated during execution):
- `total_tests`: Number of tests executed
- `pass_rate`: Percentage of passing tests (target: ≥95%)
- `iteration_count`: Number of test-fix iterations (fix mode)
- `coverage`: Line/branch/function coverage percentages

---

## Key Design Principles

1. **Testing-Focused** - Pure test coordination, no implementation
2. **Mode-Driven** - 4 test strategies for different needs
3. **Auto-Iteration** - Fix mode iterates until ≥95% pass rate
4. **Metrics Tracking** - Real-time test metrics in status.json
5. **Coverage-Driven** - Coverage targets guide test generation
6. **TODO Tracking** - Use CCWT prefix to isolate test todos
7. **TDD Compliance** - TDD mode enforces Red-Green-Refactor cycle

---

## Usage

```bash
# Auto-select mode
/ccw-test "Test user authentication module"

# Explicit mode selection
/ccw-test --mode gen "Generate tests for payment module"
/ccw-test --mode fix "Fix failing authentication tests"
/ccw-test --mode verify "Validate current test suite"
/ccw-test --mode tdd "Implement user profile with TDD"

# Custom configuration
/ccw-test --mode fix --max-iterations 5 --pass-threshold 98 "Fix all tests"
/ccw-test --target "src/auth/**/*.ts" "Test authentication module"

# Auto mode (skip confirmations)
/ccw-test --yes "Quick test validation"
```

---

## Mode Selection Decision Tree

```
User calls: /ccw-test "test description"

├─ Keywords: "generate", "create", "write test"
│  └─ Mode: Gen (generate only, no execution)
│
├─ Keywords: "fix", "repair", "failing"
│  └─ Mode: Fix (auto-iterate until ≥95% pass)
│
├─ Keywords: "verify", "validate", "run test"
│  └─ Mode: Verify (execute existing tests)
│
├─ Keywords: "tdd", "test-driven", "test first"
│  └─ Mode: TDD (Red-Green-Refactor cycle)
│
└─ Default → Fix (most common: fix failing tests)
```
