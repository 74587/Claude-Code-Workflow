---
name: team-uidesign
description: Unified team skill for UI design team. All roles invoke this skill with --role arg for role-specific execution. CP-9 Dual-Track design+implementation.
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Task(*), AskUserQuestion(*), TodoWrite(*), Read(*), Write(*), Edit(*), Bash(*), Glob(*), Grep(*), WebFetch(*), WebSearch(*)
---

# Team UI Design

Unified team skill: design system analysis, token definition, component specification, accessibility audit, and code implementation via CP-9 Dual-Track (design+implementation). All team members invoke with `--role=xxx` to route to role-specific execution.

## Architecture

```
┌───────────────────────────────────────────────────┐
│  Skill(skill="team-uidesign")                      │
│  args="<task>" or args="--role=xxx"                │
└───────────────────┬───────────────────────────────┘
                    │ Role Router
         ┌──── --role present? ────┐
         │ NO                      │ YES
         ↓                         ↓
  Orchestration Mode         Role Dispatch
  (auto → coordinator)      (route to role.md)
         │
    ┌────┴────┬───────────┬───────────┬───────────┐
    ↓         ↓           ↓           ↓           ↓
┌──────────┐┌──────────┐┌──────────┐┌──────────┐┌───────────┐
│coordinator││researcher││ designer ││ reviewer ││implementer│
│          ││RESEARCH-*││ DESIGN-* ││ AUDIT-*  ││ BUILD-*   │
└──────────┘└──────────┘└──────────┘└──────────┘└───────────┘
```

## Role Router

### Input Parsing

Parse `$ARGUMENTS` to extract `--role`. If absent → Orchestration Mode (auto route to coordinator).

### Role Registry

| Role | File | Task Prefix | Type | Compact |
|------|------|-------------|------|---------|
| coordinator | [roles/coordinator.md](roles/coordinator.md) | (none) | orchestrator | **⚠️ 压缩后必须重读** |
| researcher | [roles/researcher.md](roles/researcher.md) | RESEARCH-* | pipeline | 压缩后必须重读 |
| designer | [roles/designer.md](roles/designer.md) | DESIGN-* | pipeline | 压缩后必须重读 |
| reviewer | [roles/reviewer.md](roles/reviewer.md) | AUDIT-* | pipeline | 压缩后必须重读 |
| implementer | [roles/implementer.md](roles/implementer.md) | BUILD-* | pipeline | 压缩后必须重读 |

> **⚠️ COMPACT PROTECTION**: 角色文件是执行文档，不是参考资料。当 context compression 发生后，角色指令仅剩摘要时，**必须立即 `Read` 对应 role.md 重新加载后再继续执行**。不得基于摘要执行任何 Phase。

### Dispatch

1. Extract `--role` from arguments
2. If no `--role` → route to coordinator (Orchestration Mode)
3. Look up role in registry → Read the role file → Execute its phases

### Orchestration Mode

When invoked without `--role`, coordinator auto-starts. User just provides task description.

**Invocation**: `Skill(skill="team-uidesign", args="<task-description>")`

**Lifecycle**:
```
User provides task description
  → coordinator Phase 1-3: Scope assessment → TeamCreate → Create task chain (dual-track)
  → coordinator Phase 4: spawn first batch workers (background) → STOP
  → Worker executes → SendMessage callback → coordinator advances next step
  → Loop until pipeline complete → Phase 5 report
```

**User Commands** (wake paused coordinator):

| Command | Action |
|---------|--------|
| `check` / `status` | Output execution status graph, no advancement |
| `resume` / `continue` | Check worker states, advance next step |

---

## Shared Infrastructure

The following templates apply to all worker roles. Each role.md only needs to write **Phase 2-4** role-specific logic.

### Worker Phase 1: Task Discovery (shared by all workers)

Every worker executes the same task discovery flow on startup:

1. Call `TaskList()` to get all tasks
2. Filter: subject matches this role's prefix + owner is this role + status is pending + blockedBy is empty
3. No tasks → idle wait
4. Has tasks → `TaskGet` for details → `TaskUpdate` mark in_progress

**Resume Artifact Check** (prevent duplicate output after resume):
- Check whether this task's output artifact already exists
- Artifact complete → skip to Phase 5 report completion
- Artifact incomplete or missing → normal Phase 2-4 execution

### Worker Phase 5: Report (shared by all workers)

Standard reporting flow after task completion:

1. **Message Bus**: Call `mcp__ccw-tools__team_msg` to log message
   - Parameters: operation="log", session_id=<session-id>, from=<role>, type=<message-type>, data={ref: "<artifact-path>"}
   - `to` and `summary` auto-defaulted -- do NOT specify explicitly
   - **CLI fallback**: `ccw team log --session-id <session-id> --from <role> --type <type> --json`
2. **SendMessage**: Send result to coordinator (content and summary both prefixed with `[<role>]`)
3. **TaskUpdate**: Mark task completed
4. **Loop**: Return to Phase 1 to check next task

### Wisdom Accumulation (all roles)

Cross-task knowledge accumulation. Coordinator creates `wisdom/` directory at session initialization.

**Directory**:
```
<session-folder>/wisdom/
├── learnings.md      # Patterns and insights
├── decisions.md      # Architecture and design decisions
├── conventions.md    # Codebase conventions
└── issues.md         # Known risks and issues
```

**Worker Load** (Phase 2): Extract `Session: <path>` from task description, read wisdom directory files.
**Worker Contribute** (Phase 4/5): Write this task's discoveries to corresponding wisdom files.

### Role Isolation Rules

| Allowed | Forbidden |
|---------|-----------|
| Process tasks with own prefix | Process tasks with other role prefixes |
| SendMessage to coordinator | Communicate directly with other workers |
| Share state via team_msg(type='state_update') | Create tasks for other roles |
| Delegate to commands/ files | Modify resources outside own responsibility |

Coordinator additional restrictions: Do not write/modify code directly, do not call implementation subagents, do not execute analysis/audits, do not bypass workers.

### Output Tagging

All outputs must carry `[role_name]` prefix in both SendMessage content/summary and team_msg summary.

### Message Bus (All Roles)

Every SendMessage **before**, must call `mcp__ccw-tools__team_msg` to log:

**Parameters**: operation="log", session_id=<session-id>, from=<role>, type=<message-type>, data={ref: "<artifact-path>"}

> `to` and `summary` are auto-defaulted by the tool.

**CLI fallback**: When MCP unavailable → `ccw team log --session-id <session-id> --from <role> --type <type> --json`

**Message types by role**:

| Role | Types |
|------|-------|
| coordinator | `task_unblocked`, `sync_checkpoint`, `fix_required`, `error`, `shutdown` |
| researcher | `research_ready`, `research_progress`, `error` |
| designer | `design_ready`, `design_revision`, `design_progress`, `error` |
| reviewer | `audit_result`, `audit_passed`, `fix_required`, `error` |
| implementer | `build_complete`, `build_progress`, `error` |

### Shared State

All roles share state via `team_msg(type='state_update')` + `meta.json`:

| Role | Field |
|------|-------|
| researcher | `design_intelligence`, `component_inventory`, `industry_context` |
| designer | `design_token_registry`, `style_decisions` |
| reviewer | `audit_history`, `accessibility_patterns` |
| implementer | (reads all fields, writes build artifacts to session dir) |

### Design Intelligence (ui-ux-pro-max)

Researcher obtains design intelligence via `Skill(skill="ui-ux-pro-max", args="...")`, writes to `design-intelligence.json`. Downstream roles consume:

```
researcher (Stream 4)
  | Skill("ui-ux-pro-max", args="<industry> <keywords> --design-system")
  | Skill("ui-ux-pro-max", args="accessibility animation responsive --domain ux")
  | Skill("ui-ux-pro-max", args="<keywords> --stack <detected-stack>")
  ↓
design-intelligence.json
  |-> designer: recommended colors/typography/style → token values, anti-patterns → component specs
  |-> reviewer: anti-patterns → Industry Compliance audit dimension (20% weight)
  |-> implementer: stack guidelines → code generation, anti-patterns → validation
```

**Data flow**:
- `design_system.colors/typography/style` → designer token defaults (recommended-first mode)
- `recommendations.anti_patterns[]` → reviewer compliance check, designer/implementer avoidance
- `stack_guidelines` → implementer code generation constraints
- `ux_guidelines[]` → designer component spec implementation hints

**Degradation strategy**: When ui-ux-pro-max unavailable, use LLM general knowledge for defaults, mark `_source` as `"llm-general-knowledge"`.

### Team Configuration

| Setting | Value |
|---------|-------|
| Team name | uidesign |
| Session directory | `.workflow/.team/UDS-<slug>-<date>/` |

---

## Three-Pipeline Architecture

### CP-9 Dual-Track Concept

```
Track A (Design):     RESEARCH → DESIGN(tokens) → DESIGN(components) → ...
                                      |                    |
                            Sync Point 1          Sync Point 2
                                      |                    |
Track B (Build):              BUILD(tokens) ──→ BUILD(components) → ...
```

Design and implementation proceed in parallel after sync checkpoints. Each sync point validates that design artifacts are stable enough for implementation to consume.

### Pipeline Modes

```
component (single component):
  RESEARCH-001 → DESIGN-001 → AUDIT-001 → BUILD-001

system (design system - dual-track):
  Track A: RESEARCH-001 → DESIGN-001(tokens) → DESIGN-002(components)
  Sync-1: AUDIT-001 (token audit)
  Track B: BUILD-001(tokens, blockedBy AUDIT-001) || DESIGN-002(components)
  Sync-2: AUDIT-002 (component audit)
  Track B: BUILD-002(components, blockedBy AUDIT-002)

full-system (complete design system):
  RESEARCH-001 → DESIGN-001(tokens) → AUDIT-001
  → [DESIGN-002(components) + BUILD-001(tokens)](parallel, blockedBy AUDIT-001)
  → AUDIT-002 → BUILD-002(components) → AUDIT-003(final)
```

### Generator-Critic Loop

designer <-> reviewer loop, ensuring design consistency and accessibility:

```
DESIGN → AUDIT → (if audit.score < 8 or critical_count > 0) → DESIGN-fix → AUDIT-2
                  (if audit.score >= 8 and critical_count === 0) → next stage or BUILD

Convergence: audit.score >= 8 && audit.critical_count === 0
Max 2 rounds
```

### Cadence Control

**Beat model**: Event-driven, each beat = coordinator wake → process → spawn → STOP. UI Design beat: research → design → review → implement.

```
Beat Cycle (single beat)
═══════════════════════════════════════════════════════════
  Event                   Coordinator              Workers
───────────────────────────────────────────────────────────
  callback/resume ──→ ┌─ handleCallback ─┐
                      │  mark completed   │
                      │  check pipeline   │
                      ├─ handleSpawnNext ─┤
                      │  find ready tasks │
                      │  spawn workers ───┼──→ [Worker A] Phase 1-5
                      │  (parallel OK)  ──┼──→ [Worker B] Phase 1-5
                      └─ STOP (idle) ─────┘         │
                                                     │
  callback ←─────────────────────────────────────────┘
  (next beat)              SendMessage + TaskUpdate(completed)
═══════════════════════════════════════════════════════════
```

**Pipeline beat views**:

```
Component (4 beats, strictly serial)
──────────────────────────────────────────────────────────
Beat  1            2           3           4
      |            |           |           |
      RESEARCH → DESIGN → AUDIT ──→ BUILD
      ^                                    ^
   pipeline                            pipeline
    start                               done

RESEARCH=researcher  DESIGN=designer  AUDIT=reviewer  BUILD=implementer

System (dual-track, 5-6 beats with parallel windows)
──────────────────────────────────────────────────────────
Beat  1            2              3         4              5           6
      |            |              |    ┌────┴────┐         |           |
      RESEARCH → DESIGN-tokens → AUDIT-1 → BUILD-tokens ∥ DESIGN-comp → AUDIT-2 → BUILD-comp
                                       ^                         ^
                                  sync point 1              sync point 2

Full-system (7+ beats with dual-track parallel)
──────────────────────────────────────────────────────────
Beat 1         2              3           4                      5         6         7
     |         |              |      ┌────┴────┐                 |         |         |
     RESEARCH → DESIGN-tokens → AUDIT-1 → DESIGN-comp ∥ BUILD-tokens → AUDIT-2 → BUILD-comp → AUDIT-3
                                          ^                                                       ^
                                     parallel                                                  final
                                     window                                                    audit
```

**Checkpoints**:

| Trigger | Location | Behavior |
|---------|----------|----------|
| Sync Point (token audit) | After AUDIT on tokens | If passed → unblock BUILD(tokens) + DESIGN(components); else GC loop |
| Sync Point (component audit) | After AUDIT on components | If passed → unblock BUILD(components); else GC loop |
| GC loop limit | Max 2 rounds | Exceeds limit → coordinator escalates to user |
| Pipeline stall | No ready + no running | Check missing tasks, report to user |

**Stall Detection** (coordinator `handleCheck` executes):

| Check | Condition | Resolution |
|-------|-----------|------------|
| Worker no response | in_progress task no callback | Report waiting task list, suggest user `resume` |
| Pipeline deadlock | no ready + no running + has pending | Check blockedBy dependency chain, report blocking point |
| GC loop exceeded | designer/reviewer iteration > 2 rounds | Terminate loop, escalate to user |
| Dual-track sync failure | BUILD waiting on AUDIT that never completes | Fall back to single-track sequential execution |

### Task Metadata Registry

| Task ID | Role | Phase | Dependencies | Description |
|---------|------|-------|-------------|-------------|
| RESEARCH-001 | researcher | research | (none) | Design system analysis, component inventory, accessibility audit |
| DESIGN-001 | designer | design | RESEARCH-001 | Design token definition (colors, typography, spacing) |
| AUDIT-001 | reviewer | review | DESIGN-001 | Token design consistency and accessibility audit |
| BUILD-001 | implementer | implement | AUDIT-001 | Token code implementation (CSS variables, JS constants) |
| DESIGN-002 | designer | design | AUDIT-001 | Component specification and layout design |
| AUDIT-002 | reviewer | review | DESIGN-002 | Component design audit |
| BUILD-002 | implementer | implement | AUDIT-002 | Component code implementation |
| AUDIT-003 | reviewer | review | BUILD-002 | Final integrated audit (full-system only) |

---

## Coordinator Spawn Template

When coordinator spawns workers, use background mode (Spawn-and-Stop):

```
Task({
  subagent_type: "general-purpose",
  description: "Spawn <role> worker",
  team_name: "uidesign",
  name: "<role>",
  run_in_background: true,
  prompt: `You are team "uidesign" <ROLE>.

## Primary Directive
All your work must be executed through Skill to load role definition:
Skill(skill="team-uidesign", args="--role=<role>")

Current task: <task-description>
Session: <session-folder>

## Role Guidelines
- Only process <PREFIX>-* tasks, do not execute other role work
- All output prefixed with [<role>] identifier
- Only communicate with coordinator
- Do not use TaskCreate for other roles
- Call mcp__ccw-tools__team_msg before every SendMessage

## Workflow
1. Call Skill -> load role definition and execution logic
2. Follow role.md 5-Phase flow
3. team_msg + SendMessage results to coordinator
4. TaskUpdate completed -> check next task`
})
```

---

## Unified Session Directory

```
.workflow/.team/UDS-<slug>-<YYYY-MM-DD>/
├── .msg/messages.jsonl          # Message bus log
├── .msg/meta.json               # Session metadata
├── wisdom/                     # Cross-task knowledge
│   ├── learnings.md
│   ├── decisions.md
│   ├── conventions.md
│   └── issues.md
├── research/                   # Researcher output
│   ├── design-system-analysis.json
│   ├── component-inventory.json
│   ├── accessibility-audit.json
│   ├── design-intelligence.json       # ui-ux-pro-max design intelligence
│   └── design-intelligence-raw.md     # ui-ux-pro-max raw output
├── design/                     # Designer output
│   ├── design-tokens.json
│   ├── component-specs/
│   │   └── {component-name}.md
│   └── layout-specs/
│       └── {layout-name}.md
├── audit/                      # Reviewer output
│   └── audit-{NNN}.md
└── build/                      # Implementer output
    ├── token-files/
    └── component-files/
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown --role value | Error with available role list |
| Missing --role arg | Orchestration Mode → auto route to coordinator |
| Role file not found | Error with expected path (roles/<name>.md) |
| AUDIT score < 6 after 2 GC rounds | Coordinator escalates to user |
| Dual-track sync failure | Fall back to single-track sequential execution |
| Design token conflict | Reviewer arbitrates, coordinator intervenes |
| BUILD cannot find design files | Wait for Sync Point or escalate |
| ui-ux-pro-max unavailable | Degrade to LLM general knowledge, `_source: "llm-general-knowledge"` |
| Industry anti-pattern check failure | Reviewer marks Industry Compliance dimension as N/A |
