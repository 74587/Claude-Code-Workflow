# Command: dispatch (v3 Enhanced)

Create task chains based on execution mode with conditional routing, dynamic role injection, and priority assignment.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Mode | Phase 1 requirements | Yes |
| Session folder | Phase 2 session init | Yes |
| Scope | User requirements | Yes |
| Injected roles | Phase 1 keyword analysis | No |
| Complexity | Phase 1 assessment | No |

## Phase 3: Task Chain Creation

### Spec Pipeline (6 tasks, 3 discuss)

| # | Subject | Owner | BlockedBy | Description | Validation | Priority |
|---|---------|-------|-----------|-------------|------------|----------|
| 1 | RESEARCH-001 | analyst | (none) | Seed analysis and context gathering | DISCUSS-001 | P0 |
| 2 | DRAFT-001 | writer | RESEARCH-001 | Generate Product Brief | self-validate | P0 |
| 3 | DRAFT-002 | writer | DRAFT-001 | Generate Requirements/PRD | DISCUSS-002 | P0 |
| 4 | DRAFT-003 | writer | DRAFT-002 | Generate Architecture Document | self-validate | P0 |
| 5 | DRAFT-004 | writer | DRAFT-003 | Generate Epics & Stories | self-validate | P0 |
| 6 | QUALITY-001 | reviewer | DRAFT-004 | 5-dimension spec quality + sign-off | DISCUSS-003 | P0 |

### Impl Pipeline - Dynamic Task Creation

Initial dispatch creates **only PLAN-001**. IMPL-*, TEST-001, REVIEW-001 are dynamically created after PLAN-001 completes (see monitor.md handleCallback → PLAN-001).

#### Initial Dispatch (all complexity levels)

| # | Subject | Owner | BlockedBy | Description | Priority |
|---|---------|-------|-----------|-------------|----------|
| 1 | PLAN-001 | planner | (none) | Planning with complexity assessment + TASK-*.json generation | P0 |

#### Dynamic Creation (after PLAN-001 completes)

Coordinator reads planner's output and creates tasks dynamically:

1. Read `<session-folder>/plan/plan.json` → extract `complexity` field
2. Read `<session-folder>/plan/.task/TASK-*.json` → enumerate sub-tasks
3. Apply complexity routing:

| Complexity | Pre-IMPL tasks | Then |
|------------|---------------|------|
| Low | (none) | Create IMPL-* directly, blockedBy PLAN-001 |
| Medium | ORCH-001 (orchestrator, blockedBy PLAN-001) | Create IMPL-* blockedBy ORCH-001 |
| High | ARCH-001 (architect, blockedBy PLAN-001) → ORCH-001 (blockedBy ARCH-001) | Create IMPL-* blockedBy ORCH-001 |

4. For each `TASK-N.json`, create corresponding IMPL task:

```
TaskCreate({
  subject: "IMPL-00N",
  description: "PURPOSE: <TASK-N.title> | Success: <TASK-N.convergence.criteria>
TASK:
  - <steps from TASK-N.json>
CONTEXT:
  - Session: <session-folder>
  - Task file: <session-folder>/plan/.task/TASK-N.json
  - Files: <TASK-N.files[]>
  - Priority: P0
EXPECTED: Implementation matching task file specification
CONSTRAINTS: Only modify files listed in task file
---
Validation: self-validate
InnerLoop: false
Priority: P0",
  addBlockedBy: [<PLAN-001 or ORCH-001>]
})
```

5. Create TEST-001 (tester, blockedBy all IMPL-*, P1)
6. Create REVIEW-001 (reviewer, blockedBy all IMPL-*, P1)
7. Apply dynamic role injection (see below)

### FE Pipeline (3 tasks)

| # | Subject | Owner | BlockedBy | Description | Priority |
|---|---------|-------|-----------|-------------|----------|
| 1 | PLAN-001 | planner | (none) | Planning (frontend focus) | P0 |
| 2 | DEV-FE-001 | fe-developer | PLAN-001 | Frontend implementation | P0 |
| 3 | QA-FE-001 | fe-qa | DEV-FE-001 | 5-dimension frontend QA | P1 |

### Fullstack Pipeline (6 tasks, parallel execution)

| # | Subject | Owner | BlockedBy | Description | Priority |
|---|---------|-------|-----------|-------------|----------|
| 1 | PLAN-001 | planner | (none) | Fullstack planning | P0 |
| 2 | IMPL-001 | executor | PLAN-001 | Backend implementation | P0 |
| 3 | DEV-FE-001 | fe-developer | PLAN-001 | Frontend implementation (parallel) | P0 |
| 4 | TEST-001 | tester | IMPL-001 | Backend test-fix | P1 |
| 5 | QA-FE-001 | fe-qa | DEV-FE-001 | Frontend QA (parallel) | P1 |
| 6 | REVIEW-001 | reviewer | TEST-001, QA-FE-001 | Full code review | P1 |

### Dynamic Role Injection (v3 NEW)

When specialist roles are injected, add corresponding tasks (blockedBy references the **last IMPL-*** task dynamically):

| Injected Role | Task ID | Owner | BlockedBy | Description | Priority |
|---------------|---------|-------|-----------|-------------|----------|
| security-expert | SECURITY-001 | security-expert | all IMPL-* | Security audit (OWASP Top 10) | P0 |
| performance-optimizer | PERF-001 | performance-optimizer | all IMPL-* | Performance profiling & optimization | P1 |
| data-engineer | DATA-001 | data-engineer | PLAN-001 | Data pipeline implementation (parallel) | P0 |
| devops-engineer | DEVOPS-001 | devops-engineer | all IMPL-* | CI/CD & infrastructure setup | P1 |
| ml-engineer | ML-001 | ml-engineer | PLAN-001 | ML pipeline implementation (parallel) | P0 |

**Injection Rules**:
- Security tasks: P0 priority, block REVIEW-001
- Performance tasks: P1 priority, parallel with TEST-001
- Data/ML tasks: P0 priority, parallel with IMPL-*
- DevOps tasks: P1 priority, after all IMPL-*

### Composite Modes

| Mode | Construction | PLAN-001 BlockedBy |
|------|-------------|-------------------|
| full-lifecycle | Spec (6) + Impl (conditional) | QUALITY-001 |
| full-lifecycle-fe | Spec (6) + Fullstack (6) | QUALITY-001 |

### Task Description Template

```
TaskCreate({
  subject: "<TASK-ID>",
  description: "PURPOSE: <what> | Success: <criteria>
TASK:
  - <step 1>
  - <step 2>
  - <step 3>
CONTEXT:
  - Session: <session-folder>
  - Scope: <scope>
  - Upstream: <artifacts>
  - Priority: <P0|P1|P2>
EXPECTED: <deliverable> + <quality>
CONSTRAINTS: <scope limits>
---
Validation: <DISCUSS-NNN or self-validate>
InnerLoop: <true|false>
Priority: <P0|P1|P2>",
  addBlockedBy: [<deps>]
})
```

### Complexity Assessment Logic (v3 NEW)

PLAN-001 task description includes complexity assessment and TASK-*.json generation instructions:

```
PURPOSE: Create implementation plan with complexity assessment and task decomposition | Success: plan.json + TASK-*.json files

TASK:
  - Analyze requirements and scope
  - Identify modules and dependencies
  - Assess complexity (Low/Medium/High)
  - Generate plan.json with complexity field
  - Generate .task/TASK-*.json files (1 per implementation unit, 2-7 tasks)
  - Each TASK-*.json must include: id, title, files[].change, convergence.criteria, depends_on

CONTEXT:
  - Session: <session-folder>
  - Spec artifacts: <paths>
  - Complexity criteria:
    * Low: 1-2 modules, shallow deps, single tech stack
    * Medium: 3-4 modules, moderate deps, 2 tech stacks
    * High: 5+ modules, deep deps, multiple tech stacks

EXPECTED:
  <session-folder>/plan/plan.json (with complexity field)
  <session-folder>/plan/.task/TASK-001.json ... TASK-00N.json

Priority: P0
```

### Revision Task Template

```
TaskCreate({
  subject: "<ORIGINAL-ID>-R1",
  owner: "<same-role>",
  description: "PURPOSE: Revision of <ORIGINAL-ID> | Success: Address feedback
TASK:
  - Review original + feedback
  - Apply fixes
  - Validate
CONTEXT:
  - Session: <session-folder>
  - Original: <artifact-path>
  - Feedback: <text>
  - Priority: <inherit-from-original>
EXPECTED: Updated artifact + summary
---
Validation: <same-as-original>
InnerLoop: <same-as-original>
Priority: <inherit-from-original>",
  addBlockedBy: []
})
```

## Phase 4: Artifact Manifest Generation

For each task, include artifact manifest generation instructions in task description:

```
---
Artifact Contract:
Generate artifact-manifest.json in Phase 4:
{
  "artifact_id": "<role>-<type>-<timestamp>",
  "creator_role": "<role>",
  "artifact_type": "<type>",
  "version": "1.0.0",
  "path": "<relative-path>",
  "dependencies": [<upstream-artifact-ids>],
  "validation_status": "pending|passed|failed",
  "validation_summary": "<summary>",
  "metadata": {
    "created_at": "<ISO8601>",
    "task_id": "<task-id>",
    "priority": "<P0|P1|P2>"
  }
}
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Invalid mode | Reject, ask to clarify |
| Complexity assessment missing | Default to Low complexity |
| Injected role not found | Log warning, skip injection |
| Priority conflict | P0 > P1 > P2, FIFO within same priority |
| Circular dependency | Detect, report, halt |
