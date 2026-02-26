# Dispatch Command - Task Chain Creation

**Purpose**: Create task chains based on execution mode, aligned with SKILL.md Three-Mode Pipeline

**Invoked by**: Coordinator role.md Phase 3

**Output Tag**: `[coordinator]`

---

## Task Chain Strategies

### Role-Task Mapping (Source of Truth: SKILL.md VALID_ROLES)

| Task Prefix | Role | VALID_ROLES Key |
|-------------|------|-----------------|
| RESEARCH-* | analyst | `analyst` |
| DISCUSS-* | discussant | `discussant` |
| DRAFT-* | writer | `writer` |
| QUALITY-* | reviewer | `reviewer` |
| PLAN-* | planner | `planner` |
| IMPL-* | executor | `executor` |
| TEST-* | tester | `tester` |
| REVIEW-* | reviewer | `reviewer` |
| DEV-FE-* | fe-developer | `fe-developer` |
| QA-FE-* | fe-qa | `fe-qa` |

---

### Strategy 1: Spec-Only Mode (12 tasks)

Pipeline: `RESEARCH → DISCUSS → DRAFT → DISCUSS → DRAFT → DISCUSS → DRAFT → DISCUSS → DRAFT → DISCUSS → QUALITY → DISCUSS`

```javascript
if (requirements.mode === "spec-only") {
  Output("[coordinator] Creating spec-only task chain (12 tasks)")

  // Task 1: Seed Analysis
  TaskCreate({
    subject: "RESEARCH-001",
    owner: "analyst",
    description: `Seed analysis: codebase exploration and context gathering\nSession: ${sessionFolder}\nScope: ${requirements.scope}\nFocus: ${requirements.focus.join(", ")}\nDepth: ${requirements.depth}`,
    blockedBy: [],
    status: "pending"
  })

  // Task 2: Critique Research
  TaskCreate({
    subject: "DISCUSS-001",
    owner: "discussant",
    description: `Critique research findings from RESEARCH-001, identify gaps and clarify scope\nSession: ${sessionFolder}`,
    blockedBy: ["RESEARCH-001"],
    status: "pending"
  })

  // Task 3: Product Brief
  TaskCreate({
    subject: "DRAFT-001",
    owner: "writer",
    description: `Generate Product Brief based on RESEARCH-001 findings and DISCUSS-001 feedback\nSession: ${sessionFolder}`,
    blockedBy: ["DISCUSS-001"],
    status: "pending"
  })

  // Task 4: Critique Product Brief
  TaskCreate({
    subject: "DISCUSS-002",
    owner: "discussant",
    description: `Critique Product Brief (DRAFT-001), evaluate completeness and clarity\nSession: ${sessionFolder}`,
    blockedBy: ["DRAFT-001"],
    status: "pending"
  })

  // Task 5: Requirements/PRD
  TaskCreate({
    subject: "DRAFT-002",
    owner: "writer",
    description: `Generate Requirements/PRD incorporating DISCUSS-002 feedback\nSession: ${sessionFolder}`,
    blockedBy: ["DISCUSS-002"],
    status: "pending"
  })

  // Task 6: Critique Requirements
  TaskCreate({
    subject: "DISCUSS-003",
    owner: "discussant",
    description: `Critique Requirements/PRD (DRAFT-002), validate coverage and feasibility\nSession: ${sessionFolder}`,
    blockedBy: ["DRAFT-002"],
    status: "pending"
  })

  // Task 7: Architecture Document
  TaskCreate({
    subject: "DRAFT-003",
    owner: "writer",
    description: `Generate Architecture Document incorporating DISCUSS-003 feedback\nSession: ${sessionFolder}`,
    blockedBy: ["DISCUSS-003"],
    status: "pending"
  })

  // Task 8: Critique Architecture
  TaskCreate({
    subject: "DISCUSS-004",
    owner: "discussant",
    description: `Critique Architecture Document (DRAFT-003), evaluate design decisions\nSession: ${sessionFolder}`,
    blockedBy: ["DRAFT-003"],
    status: "pending"
  })

  // Task 9: Epics
  TaskCreate({
    subject: "DRAFT-004",
    owner: "writer",
    description: `Generate Epics document incorporating DISCUSS-004 feedback\nSession: ${sessionFolder}`,
    blockedBy: ["DISCUSS-004"],
    status: "pending"
  })

  // Task 10: Critique Epics
  TaskCreate({
    subject: "DISCUSS-005",
    owner: "discussant",
    description: `Critique Epics (DRAFT-004), validate task decomposition and priorities\nSession: ${sessionFolder}`,
    blockedBy: ["DRAFT-004"],
    status: "pending"
  })

  // Task 11: Spec Quality Check
  TaskCreate({
    subject: "QUALITY-001",
    owner: "reviewer",
    description: `5-dimension spec quality validation across all spec artifacts\nSession: ${sessionFolder}`,
    blockedBy: ["DISCUSS-005"],
    status: "pending"
  })

  // Task 12: Final Review Discussion
  TaskCreate({
    subject: "DISCUSS-006",
    owner: "discussant",
    description: `Final review discussion: address QUALITY-001 findings, sign-off\nSession: ${sessionFolder}`,
    blockedBy: ["QUALITY-001"],
    status: "pending"
  })

  Output("[coordinator] Spec-only task chain created (12 tasks)")
  Output("[coordinator] Starting with: RESEARCH-001 (analyst)")
}
```

---

### Strategy 2: Impl-Only Mode (4 tasks)

Pipeline: `PLAN → IMPL → TEST + REVIEW`

```javascript
if (requirements.mode === "impl-only") {
  Output("[coordinator] Creating impl-only task chain (4 tasks)")

  // Verify spec exists
  const specExists = AskUserQuestion({
    question: "Implementation mode requires existing specifications. Do you have a spec file?",
    choices: ["yes", "no"]
  })

  if (specExists === "no") {
    Output("[coordinator] ERROR: impl-only mode requires existing specifications")
    Output("[coordinator] Please run spec-only mode first or use full-lifecycle mode")
    throw new Error("Missing specifications for impl-only mode")
  }

  const specFile = AskUserQuestion({
    question: "Provide path to specification file:",
    type: "text"
  })

  const specContent = Read(specFile)
  if (!specContent) {
    throw new Error(`Specification file not found: ${specFile}`)
  }

  Output(`[coordinator] Using specification: ${specFile}`)

  // Task 1: Planning
  TaskCreate({
    subject: "PLAN-001",
    owner: "planner",
    description: `Multi-angle codebase exploration and structured planning\nSession: ${sessionFolder}\nSpec: ${specFile}\nScope: ${requirements.scope}`,
    blockedBy: [],
    status: "pending"
  })

  // Task 2: Implementation
  TaskCreate({
    subject: "IMPL-001",
    owner: "executor",
    description: `Code implementation following PLAN-001\nSession: ${sessionFolder}\nSpec: ${specFile}`,
    blockedBy: ["PLAN-001"],
    status: "pending"
  })

  // Task 3: Testing (parallel with REVIEW-001)
  TaskCreate({
    subject: "TEST-001",
    owner: "tester",
    description: `Adaptive test-fix cycles and quality gates\nSession: ${sessionFolder}`,
    blockedBy: ["IMPL-001"],
    status: "pending"
  })

  // Task 4: Code Review (parallel with TEST-001)
  TaskCreate({
    subject: "REVIEW-001",
    owner: "reviewer",
    description: `4-dimension code review of IMPL-001 output\nSession: ${sessionFolder}`,
    blockedBy: ["IMPL-001"],
    status: "pending"
  })

  Output("[coordinator] Impl-only task chain created (4 tasks)")
  Output("[coordinator] Starting with: PLAN-001 (planner)")
}
```

---

### Strategy 3: Full-Lifecycle Mode (16 tasks)

Pipeline: `[Spec pipeline 12] → PLAN(blockedBy: DISCUSS-006) → IMPL → TEST + REVIEW`

```javascript
if (requirements.mode === "full-lifecycle") {
  Output("[coordinator] Creating full-lifecycle task chain (16 tasks)")

  // ========================================
  // SPEC PHASE (12 tasks) — same as spec-only
  // ========================================

  TaskCreate({ subject: "RESEARCH-001", owner: "analyst",    description: `Seed analysis: codebase exploration and context gathering\nSession: ${sessionFolder}\nScope: ${requirements.scope}\nFocus: ${requirements.focus.join(", ")}\nDepth: ${requirements.depth}`, blockedBy: [], status: "pending" })
  TaskCreate({ subject: "DISCUSS-001",  owner: "discussant", description: `Critique research findings from RESEARCH-001\nSession: ${sessionFolder}`, blockedBy: ["RESEARCH-001"], status: "pending" })
  TaskCreate({ subject: "DRAFT-001",    owner: "writer",     description: `Generate Product Brief\nSession: ${sessionFolder}`, blockedBy: ["DISCUSS-001"], status: "pending" })
  TaskCreate({ subject: "DISCUSS-002",  owner: "discussant", description: `Critique Product Brief (DRAFT-001)\nSession: ${sessionFolder}`, blockedBy: ["DRAFT-001"], status: "pending" })
  TaskCreate({ subject: "DRAFT-002",    owner: "writer",     description: `Generate Requirements/PRD\nSession: ${sessionFolder}`, blockedBy: ["DISCUSS-002"], status: "pending" })
  TaskCreate({ subject: "DISCUSS-003",  owner: "discussant", description: `Critique Requirements/PRD (DRAFT-002)\nSession: ${sessionFolder}`, blockedBy: ["DRAFT-002"], status: "pending" })
  TaskCreate({ subject: "DRAFT-003",    owner: "writer",     description: `Generate Architecture Document\nSession: ${sessionFolder}`, blockedBy: ["DISCUSS-003"], status: "pending" })
  TaskCreate({ subject: "DISCUSS-004",  owner: "discussant", description: `Critique Architecture Document (DRAFT-003)\nSession: ${sessionFolder}`, blockedBy: ["DRAFT-003"], status: "pending" })
  TaskCreate({ subject: "DRAFT-004",    owner: "writer",     description: `Generate Epics\nSession: ${sessionFolder}`, blockedBy: ["DISCUSS-004"], status: "pending" })
  TaskCreate({ subject: "DISCUSS-005",  owner: "discussant", description: `Critique Epics (DRAFT-004)\nSession: ${sessionFolder}`, blockedBy: ["DRAFT-004"], status: "pending" })
  TaskCreate({ subject: "QUALITY-001",  owner: "reviewer",   description: `5-dimension spec quality validation\nSession: ${sessionFolder}`, blockedBy: ["DISCUSS-005"], status: "pending" })
  TaskCreate({ subject: "DISCUSS-006",  owner: "discussant", description: `Final review discussion and sign-off\nSession: ${sessionFolder}`, blockedBy: ["QUALITY-001"], status: "pending" })

  // ========================================
  // IMPL PHASE (4 tasks) — blocked by spec completion
  // ========================================

  TaskCreate({
    subject: "PLAN-001",
    owner: "planner",
    description: `Multi-angle codebase exploration and structured planning\nSession: ${sessionFolder}\nScope: ${requirements.scope}`,
    blockedBy: ["DISCUSS-006"],  // Blocked until spec phase completes
    status: "pending"
  })

  TaskCreate({
    subject: "IMPL-001",
    owner: "executor",
    description: `Code implementation following PLAN-001\nSession: ${sessionFolder}`,
    blockedBy: ["PLAN-001"],
    status: "pending"
  })

  TaskCreate({
    subject: "TEST-001",
    owner: "tester",
    description: `Adaptive test-fix cycles and quality gates\nSession: ${sessionFolder}`,
    blockedBy: ["IMPL-001"],
    status: "pending"
  })

  TaskCreate({
    subject: "REVIEW-001",
    owner: "reviewer",
    description: `4-dimension code review of IMPL-001 output\nSession: ${sessionFolder}`,
    blockedBy: ["IMPL-001"],
    status: "pending"
  })

  Output("[coordinator] Full-lifecycle task chain created (16 tasks)")
  Output("[coordinator] Starting with: RESEARCH-001 (analyst)")
}
```

---

### Strategy 4: FE-Only Mode (3 tasks)

Pipeline: `PLAN → DEV-FE → QA-FE` (with GC loop: max 2 rounds)

```javascript
if (requirements.mode === "fe-only") {
  Output("[coordinator] Creating fe-only task chain (3 tasks)")

  TaskCreate({
    subject: "PLAN-001",
    owner: "planner",
    description: `Multi-angle codebase exploration and structured planning (frontend focus)\nSession: ${sessionFolder}\nScope: ${requirements.scope}`,
    blockedBy: [],
    status: "pending"
  })

  TaskCreate({
    subject: "DEV-FE-001",
    owner: "fe-developer",
    description: `Frontend component/page implementation following PLAN-001\nSession: ${sessionFolder}`,
    blockedBy: ["PLAN-001"],
    status: "pending"
  })

  TaskCreate({
    subject: "QA-FE-001",
    owner: "fe-qa",
    description: `5-dimension frontend QA for DEV-FE-001 output\nSession: ${sessionFolder}`,
    blockedBy: ["DEV-FE-001"],
    status: "pending"
  })

  // Note: GC loop (DEV-FE-002 → QA-FE-002) created dynamically by coordinator
  // when QA-FE-001 verdict = NEEDS_FIX (max 2 rounds)

  Output("[coordinator] FE-only task chain created (3 tasks)")
  Output("[coordinator] Starting with: PLAN-001 (planner)")
}
```

---

### Strategy 5: Fullstack Mode (6 tasks)

Pipeline: `PLAN → IMPL ∥ DEV-FE → TEST ∥ QA-FE → REVIEW`

```javascript
if (requirements.mode === "fullstack") {
  Output("[coordinator] Creating fullstack task chain (6 tasks)")

  TaskCreate({
    subject: "PLAN-001",
    owner: "planner",
    description: `Multi-angle codebase exploration and structured planning (fullstack)\nSession: ${sessionFolder}\nScope: ${requirements.scope}`,
    blockedBy: [],
    status: "pending"
  })

  // Backend + Frontend in parallel
  TaskCreate({
    subject: "IMPL-001",
    owner: "executor",
    description: `Backend implementation following PLAN-001\nSession: ${sessionFolder}`,
    blockedBy: ["PLAN-001"],
    status: "pending"
  })

  TaskCreate({
    subject: "DEV-FE-001",
    owner: "fe-developer",
    description: `Frontend implementation following PLAN-001\nSession: ${sessionFolder}`,
    blockedBy: ["PLAN-001"],
    status: "pending"
  })

  // Testing + QA in parallel
  TaskCreate({
    subject: "TEST-001",
    owner: "tester",
    description: `Backend test-fix cycles\nSession: ${sessionFolder}`,
    blockedBy: ["IMPL-001"],
    status: "pending"
  })

  TaskCreate({
    subject: "QA-FE-001",
    owner: "fe-qa",
    description: `Frontend QA for DEV-FE-001\nSession: ${sessionFolder}`,
    blockedBy: ["DEV-FE-001"],
    status: "pending"
  })

  // Final review after all testing
  TaskCreate({
    subject: "REVIEW-001",
    owner: "reviewer",
    description: `Full code review (backend + frontend)\nSession: ${sessionFolder}`,
    blockedBy: ["TEST-001", "QA-FE-001"],
    status: "pending"
  })

  Output("[coordinator] Fullstack task chain created (6 tasks)")
  Output("[coordinator] Starting with: PLAN-001 (planner)")
}
```

---

### Strategy 6: Full-Lifecycle-FE Mode (18 tasks)

Pipeline: `[Spec 12] → PLAN(blockedBy: DISCUSS-006) → IMPL ∥ DEV-FE → TEST ∥ QA-FE → REVIEW`

```javascript
if (requirements.mode === "full-lifecycle-fe") {
  Output("[coordinator] Creating full-lifecycle-fe task chain (18 tasks)")

  // SPEC PHASE (12 tasks) — same as spec-only
  TaskCreate({ subject: "RESEARCH-001", owner: "analyst",    description: `Seed analysis\nSession: ${sessionFolder}\nScope: ${requirements.scope}`, blockedBy: [], status: "pending" })
  TaskCreate({ subject: "DISCUSS-001",  owner: "discussant", description: `Critique research findings\nSession: ${sessionFolder}`, blockedBy: ["RESEARCH-001"], status: "pending" })
  TaskCreate({ subject: "DRAFT-001",    owner: "writer",     description: `Generate Product Brief\nSession: ${sessionFolder}`, blockedBy: ["DISCUSS-001"], status: "pending" })
  TaskCreate({ subject: "DISCUSS-002",  owner: "discussant", description: `Critique Product Brief\nSession: ${sessionFolder}`, blockedBy: ["DRAFT-001"], status: "pending" })
  TaskCreate({ subject: "DRAFT-002",    owner: "writer",     description: `Generate Requirements/PRD\nSession: ${sessionFolder}`, blockedBy: ["DISCUSS-002"], status: "pending" })
  TaskCreate({ subject: "DISCUSS-003",  owner: "discussant", description: `Critique Requirements\nSession: ${sessionFolder}`, blockedBy: ["DRAFT-002"], status: "pending" })
  TaskCreate({ subject: "DRAFT-003",    owner: "writer",     description: `Generate Architecture Document\nSession: ${sessionFolder}`, blockedBy: ["DISCUSS-003"], status: "pending" })
  TaskCreate({ subject: "DISCUSS-004",  owner: "discussant", description: `Critique Architecture\nSession: ${sessionFolder}`, blockedBy: ["DRAFT-003"], status: "pending" })
  TaskCreate({ subject: "DRAFT-004",    owner: "writer",     description: `Generate Epics\nSession: ${sessionFolder}`, blockedBy: ["DISCUSS-004"], status: "pending" })
  TaskCreate({ subject: "DISCUSS-005",  owner: "discussant", description: `Critique Epics\nSession: ${sessionFolder}`, blockedBy: ["DRAFT-004"], status: "pending" })
  TaskCreate({ subject: "QUALITY-001",  owner: "reviewer",   description: `Spec quality validation\nSession: ${sessionFolder}`, blockedBy: ["DISCUSS-005"], status: "pending" })
  TaskCreate({ subject: "DISCUSS-006",  owner: "discussant", description: `Final review and sign-off\nSession: ${sessionFolder}`, blockedBy: ["QUALITY-001"], status: "pending" })

  // IMPL PHASE (6 tasks) — fullstack, blocked by spec
  TaskCreate({ subject: "PLAN-001",    owner: "planner",      description: `Fullstack planning\nSession: ${sessionFolder}`, blockedBy: ["DISCUSS-006"], status: "pending" })
  TaskCreate({ subject: "IMPL-001",    owner: "executor",     description: `Backend implementation\nSession: ${sessionFolder}`, blockedBy: ["PLAN-001"], status: "pending" })
  TaskCreate({ subject: "DEV-FE-001",  owner: "fe-developer", description: `Frontend implementation\nSession: ${sessionFolder}`, blockedBy: ["PLAN-001"], status: "pending" })
  TaskCreate({ subject: "TEST-001",    owner: "tester",       description: `Backend test-fix cycles\nSession: ${sessionFolder}`, blockedBy: ["IMPL-001"], status: "pending" })
  TaskCreate({ subject: "QA-FE-001",   owner: "fe-qa",        description: `Frontend QA\nSession: ${sessionFolder}`, blockedBy: ["DEV-FE-001"], status: "pending" })
  TaskCreate({ subject: "REVIEW-001",  owner: "reviewer",     description: `Full code review\nSession: ${sessionFolder}`, blockedBy: ["TEST-001", "QA-FE-001"], status: "pending" })

  Output("[coordinator] Full-lifecycle-fe task chain created (18 tasks)")
  Output("[coordinator] Starting with: RESEARCH-001 (analyst)")
}
```

---

## Task Metadata Reference

```javascript
// Unified metadata for all pipelines (used by Session Resume)
const TASK_METADATA = {
  // Spec pipeline (12 tasks)
  "RESEARCH-001": { role: "analyst",    deps: [],                description: "Seed analysis: codebase exploration and context gathering" },
  "DISCUSS-001":  { role: "discussant", deps: ["RESEARCH-001"],  description: "Critique research findings, identify gaps" },
  "DRAFT-001":    { role: "writer",     deps: ["DISCUSS-001"],   description: "Generate Product Brief" },
  "DISCUSS-002":  { role: "discussant", deps: ["DRAFT-001"],     description: "Critique Product Brief" },
  "DRAFT-002":    { role: "writer",     deps: ["DISCUSS-002"],   description: "Generate Requirements/PRD" },
  "DISCUSS-003":  { role: "discussant", deps: ["DRAFT-002"],     description: "Critique Requirements/PRD" },
  "DRAFT-003":    { role: "writer",     deps: ["DISCUSS-003"],   description: "Generate Architecture Document" },
  "DISCUSS-004":  { role: "discussant", deps: ["DRAFT-003"],     description: "Critique Architecture Document" },
  "DRAFT-004":    { role: "writer",     deps: ["DISCUSS-004"],   description: "Generate Epics" },
  "DISCUSS-005":  { role: "discussant", deps: ["DRAFT-004"],     description: "Critique Epics" },
  "QUALITY-001":  { role: "reviewer",   deps: ["DISCUSS-005"],   description: "5-dimension spec quality validation" },
  "DISCUSS-006":  { role: "discussant", deps: ["QUALITY-001"],   description: "Final review discussion and sign-off" },

  // Impl pipeline (4 tasks) — deps shown for impl-only mode
  // In full-lifecycle, PLAN-001 deps = ["DISCUSS-006"]
  "PLAN-001":   { role: "planner",  deps: [],           description: "Multi-angle codebase exploration and structured planning" },
  "IMPL-001":   { role: "executor", deps: ["PLAN-001"], description: "Code implementation following plan" },
  "TEST-001":   { role: "tester",   deps: ["IMPL-001"], description: "Adaptive test-fix cycles and quality gates" },
  "REVIEW-001": { role: "reviewer", deps: ["IMPL-001"], description: "4-dimension code review" },

  // Frontend pipeline tasks
  "DEV-FE-001": { role: "fe-developer", deps: ["PLAN-001"],   description: "Frontend component/page implementation" },
  "QA-FE-001":  { role: "fe-qa",        deps: ["DEV-FE-001"], description: "5-dimension frontend QA" },
  // GC loop tasks (created dynamically)
  "DEV-FE-002": { role: "fe-developer", deps: ["QA-FE-001"],  description: "Frontend fixes (GC round 2)" },
  "QA-FE-002":  { role: "fe-qa",        deps: ["DEV-FE-002"], description: "Frontend QA re-check (GC round 2)" }
}

// Pipeline chain constants
const SPEC_CHAIN = [
  "RESEARCH-001", "DISCUSS-001", "DRAFT-001", "DISCUSS-002",
  "DRAFT-002", "DISCUSS-003", "DRAFT-003", "DISCUSS-004",
  "DRAFT-004", "DISCUSS-005", "QUALITY-001", "DISCUSS-006"
]

const IMPL_CHAIN = ["PLAN-001", "IMPL-001", "TEST-001", "REVIEW-001"]

const FE_CHAIN = ["DEV-FE-001", "QA-FE-001"]

const FULLSTACK_CHAIN = ["PLAN-001", "IMPL-001", "DEV-FE-001", "TEST-001", "QA-FE-001", "REVIEW-001"]
```

---

## Execution Method Handling

### Sequential Execution

```javascript
if (requirements.executionMethod === "sequential") {
  Output("[coordinator] Sequential execution: tasks will run one at a time")
  // Only one task active at a time
  // Next task activated only after predecessor completes
}
```

### Parallel Execution

```javascript
if (requirements.executionMethod === "parallel") {
  Output("[coordinator] Parallel execution: independent tasks will run concurrently")
  // Tasks with all deps met can run in parallel
  // e.g., TEST-001 and REVIEW-001 both depend on IMPL-001 → run together
  // e.g., IMPL-001 and DEV-FE-001 both depend on PLAN-001 → run together
}
```

---

## Output Format

All outputs from this command use the `[coordinator]` tag:

```
[coordinator] Creating spec-only task chain (12 tasks)
[coordinator] Starting with: RESEARCH-001 (analyst)
```
