# Command: Dispatch

Create the performance optimization task chain with correct dependencies and structured task descriptions.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| User requirement | From coordinator Phase 1 | Yes |
| Session folder | From coordinator Phase 2 | Yes |
| Pipeline definition | From SKILL.md Pipeline Definitions | Yes |

1. Load user requirement and optimization scope from session.json
2. Load pipeline stage definitions from SKILL.md Task Metadata Registry
3. Determine if single-pass or multi-pass optimization is needed

## Phase 3: Task Chain Creation

### Task Description Template

Every task description uses structured format for clarity:

```
TaskCreate({
  subject: "<TASK-ID>",
  owner: "<role>",
  description: "PURPOSE: <what this task achieves> | Success: <measurable completion criteria>
TASK:
  - <step 1: specific action>
  - <step 2: specific action>
  - <step 3: specific action>
CONTEXT:
  - Session: <session-folder>
  - Scope: <optimization-scope>
  - Upstream artifacts: <artifact-1>, <artifact-2>
  - Shared memory: <session>/wisdom/shared-memory.json
EXPECTED: <deliverable path> + <quality criteria>
CONSTRAINTS: <scope limits, focus areas>
---
InnerLoop: <true|false>",
  blockedBy: [<dependency-list>],
  status: "pending"
})
```

### Task Chain

Create tasks in dependency order:

**PROFILE-001** (profiler, Stage 1):
```
TaskCreate({
  subject: "PROFILE-001",
  description: "PURPOSE: Profile application performance to identify bottlenecks | Success: Baseline metrics captured, top 3-5 bottlenecks ranked by severity
TASK:
  - Detect project type and available profiling tools
  - Execute profiling across relevant dimensions (CPU, memory, I/O, network, rendering)
  - Collect baseline metrics and rank bottlenecks by severity
CONTEXT:
  - Session: <session-folder>
  - Scope: <optimization-scope>
  - Shared memory: <session>/wisdom/shared-memory.json
EXPECTED: <session>/artifacts/baseline-metrics.json + <session>/artifacts/bottleneck-report.md | Quantified metrics with evidence
CONSTRAINTS: Focus on <optimization-scope> | Profile before any changes
---
InnerLoop: false",
  status: "pending"
})
```

**STRATEGY-001** (strategist, Stage 2):
```
TaskCreate({
  subject: "STRATEGY-001",
  description: "PURPOSE: Design prioritized optimization plan from bottleneck analysis | Success: Actionable plan with measurable success criteria per optimization
TASK:
  - Analyze bottleneck report and baseline metrics
  - Select optimization strategies per bottleneck type
  - Prioritize by impact/effort ratio, define success criteria
CONTEXT:
  - Session: <session-folder>
  - Scope: <optimization-scope>
  - Upstream artifacts: baseline-metrics.json, bottleneck-report.md
  - Shared memory: <session>/wisdom/shared-memory.json
EXPECTED: <session>/artifacts/optimization-plan.md | Priority-ordered with improvement targets
CONSTRAINTS: Focus on highest-impact optimizations | Risk assessment required
---
InnerLoop: false",
  blockedBy: ["PROFILE-001"],
  status: "pending"
})
```

**IMPL-001** (optimizer, Stage 3):
```
TaskCreate({
  subject: "IMPL-001",
  description: "PURPOSE: Implement optimization changes per strategy plan | Success: All planned optimizations applied, code compiles, existing tests pass
TASK:
  - Load optimization plan and identify target files
  - Apply optimizations in priority order (P0 first)
  - Validate changes compile and pass existing tests
CONTEXT:
  - Session: <session-folder>
  - Scope: <optimization-scope>
  - Upstream artifacts: optimization-plan.md
  - Shared memory: <session>/wisdom/shared-memory.json
EXPECTED: Modified source files + validation passing | Optimizations applied without regressions
CONSTRAINTS: Preserve existing behavior | Minimal changes per optimization | Follow code conventions
---
InnerLoop: true",
  blockedBy: ["STRATEGY-001"],
  status: "pending"
})
```

**BENCH-001** (benchmarker, Stage 4 - parallel):
```
TaskCreate({
  subject: "BENCH-001",
  description: "PURPOSE: Benchmark optimization results against baseline | Success: All plan success criteria met, no regressions detected
TASK:
  - Load baseline metrics and plan success criteria
  - Run benchmarks matching project type
  - Compare before/after metrics, calculate improvements
CONTEXT:
  - Session: <session-folder>
  - Scope: <optimization-scope>
  - Upstream artifacts: baseline-metrics.json, optimization-plan.md
  - Shared memory: <session>/wisdom/shared-memory.json
EXPECTED: <session>/artifacts/benchmark-results.json | Per-metric comparison with verdicts
CONSTRAINTS: Must compare against baseline | Flag any regressions
---
InnerLoop: false",
  blockedBy: ["IMPL-001"],
  status: "pending"
})
```

**REVIEW-001** (reviewer, Stage 4 - parallel):
```
TaskCreate({
  subject: "REVIEW-001",
  description: "PURPOSE: Review optimization code for correctness, side effects, and regression risks | Success: All dimensions reviewed, verdict issued
TASK:
  - Load modified files and optimization plan
  - Review across 5 dimensions: correctness, side effects, maintainability, regression risk, best practices
  - Issue verdict: APPROVE, REVISE, or REJECT with actionable feedback
CONTEXT:
  - Session: <session-folder>
  - Scope: <optimization-scope>
  - Upstream artifacts: optimization-plan.md, benchmark-results.json (if available)
  - Shared memory: <session>/wisdom/shared-memory.json
EXPECTED: <session>/artifacts/review-report.md | Per-dimension findings with severity
CONSTRAINTS: Focus on optimization changes only | Provide specific file:line references
---
InnerLoop: false",
  blockedBy: ["IMPL-001"],
  status: "pending"
})
```

## Phase 4: Validation

Verify task chain integrity:

| Check | Method | Expected |
|-------|--------|----------|
| All 5 tasks created | TaskList count | 5 tasks |
| Dependencies correct | STRATEGY blocks on PROFILE, IMPL blocks on STRATEGY, BENCH+REVIEW block on IMPL | All valid |
| No circular dependencies | Trace dependency graph | Acyclic |
| All task IDs use correct prefixes | PROFILE-*, STRATEGY-*, IMPL-*, BENCH-*, REVIEW-* | Match role registry |
| Structured descriptions complete | Each has PURPOSE/TASK/CONTEXT/EXPECTED/CONSTRAINTS | All present |

If validation fails, fix the specific task and re-validate.
