---
适用CLI: claude
分类: team
---

# Claude Skills - Team Collaboration

## One-Liner

**Team Collaboration Skills is a multi-role collaborative work orchestration system** — Through coordinator, worker roles, and message bus, it enables parallel processing and state synchronization for complex tasks.

## Pain Points Solved

| Pain Point | Current State | Claude Code Workflow Solution |
|------------|---------------|----------------------|
| **Single model limitation** | Can only call one AI model | Multi-role parallel collaboration, leveraging各自专长 |
| **Chaotic task orchestration** | Manual task dependency and state management | Automatic task discovery, dependency resolution, pipeline orchestration |
| **Fragmented collaboration** | Team members work independently | Unified message bus, shared state, progress sync |
| **Resource waste** | Repeated context loading | Wisdom accumulation, exploration cache, artifact reuse |

## Skills List

| Skill | Function | Trigger |
|-------|----------|---------|
| `team-coordinate` | Universal team coordinator (dynamic role generation) | `/team-coordinate` |
| `team-lifecycle` | Full lifecycle team (spec→impl→test→review) | `/team-lifecycle` |
| `team-planex` | Plan-execute pipeline (plan while executing) | `/team-planex` |
| `team-review` | Code review team (scan→review→fix) | `/team-review` |
| `team-testing` | Testing team (strategy→generate→execute→analyze) | `/team-testing` |

## Skills Details

### team-coordinate

**One-Liner**: Universal team coordinator — Dynamically generates roles and orchestrates execution based on task analysis

**Trigger**:
```
/team-coordinate <task-description>
/team-coordinate --role=coordinator <task>
/team-coordinate --role=<worker> --session=<path>
```

**Features**:
- Only coordinator is built-in, all worker roles are dynamically generated at runtime
- Supports inner-loop roles (handle multiple same-prefix tasks)
- Fast-Advance mechanism skips coordinator to directly spawn successor tasks
- Wisdom accumulates cross-task knowledge

**Role Registry**:
| Role | File | Task Prefix | Type |
|------|------|-------------|------|
| coordinator | roles/coordinator/role.md | (none) | orchestrator |
| (dynamic) | `<session>/roles/<role>.md` | (dynamic) | worker |

**Pipeline**:
```
Task Analysis → Generate Roles → Initialize Session → Create Task Chain → Spawn First Batch Workers → Loop Progress → Completion Report
```

**Session Directory**:
```
.workflow/.team/TC-<slug>-<date>/
├── team-session.json           # Session state + dynamic role registry
├── task-analysis.json          # Phase 1 output
├── roles/                      # Dynamic role definitions
├── artifacts/                  # All MD deliverables
├── wisdom/                     # Cross-task knowledge
├── explorations/               # Shared exploration cache
├── discussions/                # Inline discussion records
└── .msg/                       # Team message bus logs
```

---

### team-lifecycle

**One-Liner**: Full lifecycle team — Complete pipeline from specification to implementation to testing to review

**Trigger**:
```
/team-lifecycle <task-description>
```

**Features**:
- Based on team-worker agent architecture, all workers share the same agent definition
- Role-specific Phase 2-4 loaded from markdown specs
- Supports specification pipeline, implementation pipeline, frontend pipeline

**Role Registry**:
| Role | Spec | Task Prefix | Inner Loop |
|------|------|-------------|------------|
| coordinator | roles/coordinator/role.md | (none) | - |
| analyst | role-specs/analyst.md | RESEARCH-* | false |
| writer | role-specs/writer.md | DRAFT-* | true |
| planner | role-specs/planner.md | PLAN-* | true |
| executor | role-specs/executor.md | IMPL-* | true |
| tester | role-specs/tester.md | TEST-* | false |
| reviewer | role-specs/reviewer.md | REVIEW-* | false |
| architect | role-specs/architect.md | ARCH-* | false |
| fe-developer | role-specs/fe-developer.md | DEV-FE-* | false |
| fe-qa | role-specs/fe-qa.md | QA-FE-* | false |

**Pipeline Definitions**:
```
Specification Pipeline (6 tasks):
  RESEARCH-001 → DRAFT-001 → DRAFT-002 → DRAFT-003 → DRAFT-004 → QUALITY-001

Implementation Pipeline (4 tasks):
  PLAN-001 → IMPL-001 → TEST-001 + REVIEW-001

Full Lifecycle (10 tasks):
  [Spec Pipeline] → PLAN-001 → IMPL-001 → TEST-001 + REVIEW-001

Frontend Pipeline:
  PLAN-001 → DEV-FE-001 → QA-FE-001 (GC loop, max 2 rounds)
```

**Quality Gate** (after QUALITY-001 completion):
```
═════════════════════════════════════════
SPEC PHASE COMPLETE
Quality Gate: <PASS|REVIEW|FAIL> (<score>%)

Dimension Scores:
  Completeness:  <bar> <n>%
  Consistency:   <bar> <n>%
  Traceability:  <bar> <n>%
  Depth:         <bar> <n>%
  Coverage:      <bar> <n>%

Available Actions:
  resume              -> Proceed to implementation
  improve             -> Auto-improve weakest dimension
  improve <dimension> -> Improve specific dimension
  revise <TASK-ID>    -> Revise specific document
  recheck             -> Re-run quality check
  feedback <text>     -> Inject feedback, create revision
═════════════════════════════════════════
```

**User Commands** (wake paused coordinator):
| Command | Action |
|---------|--------|
| `check` / `status` | Output execution status graph, no progress |
| `resume` / `continue` | Check worker status, advance next step |
| `revise <TASK-ID> [feedback]` | Create revision task + cascade downstream |
| `feedback <text>` | Analyze feedback impact, create targeted revision chain |
| `recheck` | Re-run QUALITY-001 quality check |
| `improve [dimension]` | Auto-improve weakest dimension in readiness-report |

---

### team-planex

**One-Liner**: Plan-and-execute team — Planner and executor work in parallel through per-issue beat pipeline

**Trigger**:
```
/team-planex <task-description>
/team-planex --role=planner <input>
/team-planex --role=executor --input <solution-file>
```

**Features**:
- 2-member team (planner + executor), planner serves as lead role
- Per-issue beat: planner creates EXEC-* task immediately after completing each issue's solution
- Solution written to intermediate artifact file, executor loads from file
- Supports multiple execution backends (agent/codex/gemini)

**Role Registry**:
| Role | File | Task Prefix | Type |
|------|------|-------------|------|
| planner | roles/planner.md | PLAN-* | pipeline (lead) |
| executor | roles/executor.md | EXEC-* | pipeline |

**Input Types**:
| Input Type | Format | Example |
|------------|--------|---------|
| Issue IDs | Direct ID input | `--role=planner ISS-20260215-001 ISS-20260215-002` |
| Requirement text | `--text '...'` | `--role=planner --text 'Implement user authentication module'` |
| Plan file | `--plan path` | `--role=planner --plan plan/2026-02-15-auth.md` |

**Wave Pipeline** (per-issue beat):
```
Issue 1:  planner plans solution → write artifact → conflict check → create EXEC-* → issue_ready
                ↓ (executor starts immediately)
Issue 2:  planner plans solution → write artifact → conflict check → create EXEC-* → issue_ready
                ↓ (executor consumes in parallel)
Issue N:  ...
Final:    planner sends all_planned → executor completes remaining EXEC-* → finish
```

**Execution Method Selection**:
| Executor | Backend | Use Case |
|----------|---------|----------|
| `agent` | code-developer subagent | Simple tasks, synchronous execution |
| `codex` | `ccw cli --tool codex --mode write` | Complex tasks, background execution |
| `gemini` | `ccw cli --tool gemini --mode write` | Analysis tasks, background execution |

**User Commands**:
| Command | Action |
|---------|--------|
| `check` / `status` | Output execution status graph, no progress |
| `resume` / `continue` | Check worker status, advance next step |
| `add <issue-ids or --text '...' or --plan path>` | Append new tasks to planner queue |

---

### team-review

**One-Liner**: Code review team — Unified code scanning, vulnerability review, optimization suggestions, and auto-fix

**Trigger**:
```
/team-review <target-path>
/team-review --full <target-path>      # scan + review + fix
/team-review --fix <review-files>      # fix only
/team-review -q <target-path>          # quick scan only
```

**Features**:
- 4-role team (coordinator, scanner, reviewer, fixer)
- Multi-dimensional review: security, correctness, performance, maintainability
- Auto-fix loop (review → fix → verify)

**Role Registry**:
| Role | File | Task Prefix | Type |
|------|------|-------------|------|
| coordinator | roles/coordinator/role.md | RC-* | orchestrator |
| scanner | roles/scanner/role.md | SCAN-* | read-only analysis |
| reviewer | roles/reviewer/role.md | REV-* | read-only analysis |
| fixer | roles/fixer/role.md | FIX-* | code generation |

**Pipeline** (CP-1 Linear):
```
coordinator dispatch
  → SCAN-* (scanner: toolchain + LLM scan)
  → REV-*  (reviewer: deep analysis + report)
  → [User confirmation]
  → FIX-*  (fixer: plan + execute + verify)
```

**Checkpoints**:
| Trigger | Location | Behavior |
|---------|----------|----------|
| Review→Fix transition | REV-* complete | Pause, show review report, wait for user `resume` to confirm fix |
| Quick mode (`-q`) | After SCAN-* | Pipeline ends after scan, no review/fix |
| Fix-only mode (`--fix`) | Entry | Skip scan/review, go directly to fixer |

**Review Dimensions**:
| Dimension | Check Points |
|-----------|--------------|
| Security (sec) | Injection vulnerabilities, sensitive data leakage, permission control |
| Correctness (cor) | Boundary conditions, error handling, type safety |
| Performance (perf) | Algorithm complexity, I/O optimization, resource usage |
| Maintainability (maint) | Code structure, naming conventions, comment quality |

---

### team-testing

**One-Liner**: Testing team — Progressive test coverage through Generator-Critic loop

**Trigger**:
```
/team-testing <task-description>
```

**Features**:
- 5-role team (coordinator, strategist, generator, executor, analyst)
- Three pipelines: Targeted, Standard, Comprehensive
- Generator-Critic loop automatically improves test coverage

**Role Registry**:
| Role | File | Task Prefix | Type |
|------|------|-------------|------|
| coordinator | roles/coordinator.md | (none) | orchestrator |
| strategist | roles/strategist.md | STRATEGY-* | pipeline |
| generator | roles/generator.md | TESTGEN-* | pipeline |
| executor | roles/executor.md | TESTRUN-* | pipeline |
| analyst | roles/analyst.md | TESTANA-* | pipeline |

**Three Pipelines**:
```
Targeted (small scope changes):
  STRATEGY-001 → TESTGEN-001(L1 unit) → TESTRUN-001

Standard (progressive):
  STRATEGY-001 → TESTGEN-001(L1) → TESTRUN-001(L1) → TESTGEN-002(L2) → TESTRUN-002(L2) → TESTANA-001

Comprehensive (full coverage):
  STRATEGY-001 → [TESTGEN-001(L1) + TESTGEN-002(L2)](parallel) → [TESTRUN-001(L1) + TESTRUN-002(L2)](parallel) → TESTGEN-003(L3) → TESTRUN-003(L3) → TESTANA-001
```

**Generator-Critic Loop**:
```
TESTGEN → TESTRUN → (if coverage < target) → TESTGEN-fix → TESTRUN-2
                   (if coverage >= target) → next layer or TESTANA
```

**Test Layer Definitions**:
| Layer | Coverage Target | Example |
|-------|-----------------|---------|
| L1: Unit | 80% | Unit tests, function-level tests |
| L2: Integration | 60% | Integration tests, module interaction |
| L3: E2E | 40% | End-to-end tests, user scenarios |

**Shared Memory** (shared-memory.json):
| Role | Field |
|------|-------|
| strategist | `test_strategy` |
| generator | `generated_tests` |
| executor | `execution_results`, `defect_patterns` |
| analyst | `analysis_report`, `coverage_history` |

## Related Commands

- [Claude Commands - Workflow](../commands/claude/workflow.md)
- [Claude Commands - Session](../commands/claude/session.md)

## Best Practices

1. **Choose the right team type**:
   - General tasks → `team-coordinate`
   - Full feature development → `team-lifecycle`
   - Issue batch processing → `team-planex`
   - Code review → `team-review`
   - Test coverage → `team-testing`

2. **Leverage inner-loop roles**: For roles with multiple same-prefix serial tasks, set `inner_loop: true` to let a single worker handle all tasks, avoiding repeated spawn overhead

3. **Wisdom accumulation**: All roles in team sessions accumulate knowledge to `wisdom/` directory, subsequent tasks can reuse these patterns, decisions, and conventions

4. **Fast-Advance**: Simple linear successor tasks automatically skip coordinator to spawn directly, reducing coordination overhead

5. **Checkpoint recovery**: All team skills support session recovery, continue interrupted sessions via `--resume` or user command `resume`
