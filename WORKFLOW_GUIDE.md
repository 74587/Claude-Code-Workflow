# CCW Workflow Guide

## Overview

CCW provides a comprehensive workflow system built on **Team Architecture v2** and a **4-Level Workflow System**, designed to cover the complete software development lifecycle from rapid prototyping to full team orchestration.

```
+---------------------------------------------------------------+
|                    4-Level Workflow System                     |
|                                                                |
|  +----------+   +----------+   +----------+   +--------------+ |
|  | Level 1  | ->| Level 2  | ->| Level 3  | ->| Level 4     | |
|  | Rapid    |   |Lightweight|  | Standard |   | Brainstorm  | |
|  |          |   |          |   |          |   |              | |
|  | lite-    |   |lite-plan |   |   plan   |   | brainstorm   | |
|  | lite-lite|   |lite-fix  |   | tdd-plan |   | :auto-       | |
|  |          |   |multi-cli-|   |test-fix- |   |  parallel    | |
|  |          |   |  plan    |   |   gen    |   |     |        | |
|  +----------+   +----------+   +----------+   +-----|--------+ |
|                                                      |        |
|                                         +------------v------+ |
|                                         | Team Architecture | |
|                                         |       v2          | |
|                                         | team-coordinate   | |
|                                         | team-executor     | |
|                                         +-------------------+ |
|                                                                |
|  Manual: High -------------------------------------> Low: Auto |
+---------------------------------------------------------------+
```

## What's New in v7.0

**Major New Features**:
- **Team Architecture v2**: `team-coordinate-v2` and `team-executor-v2` with unified team-worker agent
- **team-lifecycle-v5**: Unified team skill for full lifecycle (spec -> impl -> test -> review)
- **Queue Scheduler**: Background task execution with dependency resolution
- **Workflow Session Commands**: `start`, `resume`, `complete`, `sync` for full lifecycle management
- **Beat/Cadence Orchestration**: Event-driven coordination model
- **New Dashboard Views**: Analysis Viewer, Terminal Dashboard, Orchestrator Template Editor

---

## Table of Contents

1. [4-Level Workflow System](#4-level-workflow-system)
2. [Session Lifecycle](#session-lifecycle)
3. [Team Architecture v2](#team-architecture-v2)
4. [Command Categories](#command-categories)
5. [Skill Categories](#skill-categories)
6. [Workflow Selection Guide](#workflow-selection-guide)
7. [Issue Workflow](#issue-workflow)

---

## 4-Level Workflow System

### Level 1: Rapid Execution (lite-lite-lite)

**Fastest - Direct execution, minimal overhead**

```
+-----------------+     +------------------+
| lite-lite-lite  | --> | Direct Execution |
+-----------------+     +------------------+
```

**Characteristics**:
| Property | Value |
|----------|-------|
| **Complexity** | Lowest |
| **Planning** | In-memory, immediate |
| **Artifacts** | None (code only) |
| **Use Case** | Quick fixes, config changes |

**Commands**:
```bash
/workflow:lite-lite-lite "Add CORS headers to API"
```

---

### Level 2: Lightweight Planning

**Fast - In-memory planning or single analysis, quick iteration**

| Workflow | Purpose | Artifacts | Execution |
|----------|---------|-----------|-----------|
| `lite-plan` | Clear requirement development | memory://plan | -> `lite-execute` |
| `lite-fix` | Bug diagnosis and fix | `.workflow/.lite-fix/` | -> `lite-execute` |
| `multi-cli-plan` | Multi-perspective tasks | `.workflow/.multi-cli-plan/` | -> `lite-execute` |

#### lite-plan -> lite-execute

**5-Phase Interactive Workflow**:
```
Phase 1: Task Analysis & Exploration (30-90s)
   └─ Auto-detect codebase context need, launch @cli-explore-agent

Phase 2: Clarification (user-dependent)
   └─ Interactive Q&A based on exploration findings

Phase 3: Planning (20-60s)
   ├─ Low complexity -> Direct planning
   └─ Medium/High complexity -> @cli-planning-agent

Phase 4: Three-Dimensional Confirmation
   └─ Task approval + Execution method + Code review tool

Phase 5: Execution & Tracking (5-120min)
   └─ Live progress with selected method
```

**Key Features**:
- Smart code exploration (auto-detect or force with `-e`)
- In-memory planning (no file artifacts)
- Three-dimensional multi-select confirmation
- Flexible execution (Agent or CLI)
- Optional post-review

```bash
/workflow:lite-plan "Add JWT authentication"    # Basic usage
/workflow:lite-plan -e "Refactor logging"       # Force exploration
/workflow:lite-execute                          # Execute the plan
```

#### lite-fix

**Intelligent Bug Diagnosis + Fix (5 phases)**:
```
Phase 1: Bug Analysis
   ├─ Severity pre-assessment (Low/Medium/High/Critical)
   └─ Parallel cli-explore-agent diagnosis (1-4 angles)

Phase 2: Clarification (optional)
   └─ Aggregate clarification needs, AskUserQuestion

Phase 3: Fix Planning
   ├─ Low/Medium -> Claude direct planning
   └─ High/Critical -> cli-lite-planning-agent

Phase 4: Confirmation
   └─ User confirms execution method

Phase 5: Execute
   └─ /workflow:lite-execute --in-memory --mode bugfix
```

```bash
/workflow:lite-fix           # Standard fix
/workflow:lite-fix --hotfix  # Emergency hotfix (skip diagnosis)
```

**Artifacts**: `.workflow/.lite-fix/{bug-slug}-{date}/`

#### multi-cli-plan

**Multi-CLI Collaborative Analysis + Consensus (5 phases)**:
```
Phase 1: Context Gathering
   └─ ACE semantic search, build context package

Phase 2: Multi-CLI Discussion (iterative)
   ├─ cli-discuss-agent: Gemini + Codex + Claude
   ├─ Cross-verification, synthesize solutions
   └─ Loop until convergence or max rounds

Phase 3: Present Options
   └─ Display solutions with trade-offs

Phase 4: User Decision
   └─ User selects solution

Phase 5: Plan Generation
   └─ -> lite-execute
```

```bash
/workflow:multi-cli-plan "Compare OAuth vs JWT"
```

---

### Level 3: Standard Planning

**Complete - Persistent Session + Verification + Full Execution**

| Workflow | Purpose | Phases | Artifacts |
|----------|---------|--------|-----------|
| `plan` | Complex feature development | 5 phases | `.workflow/active/{session}/` |
| `tdd-plan` | Test-driven development | 6 phases | `.workflow/active/{session}/` |
| `test-fix-gen` | Test fix generation | 5 phases | `.workflow/active/WFS-test-{session}/` |

#### plan -> verify -> execute

**5-Phase Complete Planning**:
```
Phase 1: Session Discovery
   └─ /workflow:session:start --auto

Phase 2: Context Gathering
   └─ /workflow:tools:context-gather
      └─ Returns context-package.json + conflict_risk

Phase 3: Conflict Resolution (conditional)
   └─ IF conflict_risk >= medium -> /workflow:tools:conflict-resolution

Phase 4: Task Generation
   └─ /workflow:tools:task-generate-agent
      └─ Returns IMPL_PLAN.md + IMPL-*.json + TODO_LIST.md

Phase 5: Summary + Next Steps
```

```bash
/workflow:plan "Multi-module refactoring"   # Complete planning
/workflow:plan-verify                       # Verify plan (recommended)
/workflow:execute                           # Execute
/workflow:review                            # (optional) Review
```

**Artifacts**: `.workflow/active/{WFS-session}/`
- `workflow-session.json`
- `IMPL_PLAN.md`
- `TODO_LIST.md`
- `.task/IMPL-*.json`

#### tdd-plan -> execute -> tdd-verify

**6-Phase Test-Driven Development**:
```
Phase 1: Session Discovery (--type tdd)
Phase 2: Context Gathering
Phase 3: Test Coverage Analysis
Phase 4: Conflict Resolution (conditional)
Phase 5: TDD Task Generation (Red-Green-Refactor cycles)
Phase 6: TDD Structure Validation
```

```bash
/workflow:tdd-plan "User authentication"
/workflow:execute
/workflow:tdd-verify
```

**TDD Task Structure**:
- Each IMPL task contains complete Red-Green-Refactor internal cycle
- `meta.tdd_workflow: true`
- `flow_control.implementation_approach` has 3 steps (red/green/refactor)

#### test-fix-gen -> test-cycle-execute

**5-Phase Test Fix Generation**:

**Dual-mode support**:
| Mode | Input | Context Source |
|------|-------|----------------|
| Session Mode | `WFS-xxx` | Source session summaries |
| Prompt Mode | Text/file path | Direct codebase analysis |

```bash
/workflow:test-fix-gen WFS-user-auth-v2     # Session Mode
/workflow:test-fix-gen "Test the auth API"  # Prompt Mode
/workflow:test-cycle-execute                # Execute test-fix cycle
```

---

### Level 4: Brainstorming (brainstorm:auto-parallel)

**Exploratory - Multi-role brainstorming + Complete planning**

**3-Phase Flow**:
```
Phase 1: Interactive Framework Generation
   └─ /workflow:brainstorm:artifacts
      ├─ Topic analysis, generate questions
      ├─ Role selection (user confirmation)
      ├─ Role question collection
      └─ Generate guidance-specification.md

Phase 2: Parallel Role Analysis
   └─ N x Task(conceptual-planning-agent)
      ├─ Each role analyzes independently
      └─ Parallel generate {role}/analysis.md

Phase 3: Synthesis Integration
   └─ /workflow:brainstorm:synthesis
      └─ Integrate all analyses -> synthesis-specification.md
```

```bash
/workflow:brainstorm:auto-parallel "Real-time collaboration system"
/workflow:plan --session {sessionId}
/workflow:execute
```

**Available Roles**:
| Role | Description |
|------|-------------|
| `system-architect` | System Architect |
| `ui-designer` | UI Designer |
| `ux-expert` | UX Expert |
| `product-manager` | Product Manager |
| `data-architect` | Data Architect |
| `test-strategist` | Test Strategist |

**Artifact Structure**:
```
.workflow/active/WFS-{topic}/
├── workflow-session.json
└── .brainstorming/
    ├── guidance-specification.md
    ├── {role}/analysis.md
    └── synthesis-specification.md
```

---

## Session Lifecycle

CCW v7.0 introduces comprehensive session lifecycle commands for managing workflow sessions from creation to completion.

### Session Commands Overview

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/workflow:session:start` | Start new or discover existing | Beginning any workflow |
| `/workflow:session:resume` | Resume a paused session | Returning to interrupted work |
| `/workflow:session:complete` | Archive session and extract learnings | After all tasks complete |
| `/workflow:session:sync` | Sync session work to specs | Update project documentation |

### Starting a Session

```bash
# Discovery mode - list active sessions
/workflow:session:start

# Auto mode - intelligently create or reuse
/workflow:session:start --auto "Implement OAuth2"

# Force new mode
/workflow:session:start --new "User authentication"

# Specify session type
/workflow:session:start --type tdd --auto "Test-driven login"
```

**Session Types**:
- `workflow`: Standard implementation (default)
- `review`: Code review sessions
- `tdd`: Test-driven development
- `test`: Test generation/fix sessions
- `docs`: Documentation sessions

### Completing a Session

```bash
/workflow:session:complete          # Interactive completion
/workflow:session:complete --yes    # Auto-complete with sync
/workflow:session:complete --detailed  # With metrics
```

**Completion Actions**:
- Archive session to `.workflow/archives/`
- Generate `manifest.json` with metrics
- Extract lessons learned
- Auto-sync project state (with `--yes`)

### Session Directory Structure

```
.workflow/
├── active/                          # Active sessions
│   └── WFS-{session-name}/
│       ├── workflow-session.json    # Session metadata
│       ├── IMPL_PLAN.md             # Implementation plan
│       ├── TODO_LIST.md             # Task checklist
│       ├── .task/                   # Task JSON files
│       └── .process/                # Process artifacts
├── archives/                        # Completed sessions
└── project-tech.json                # Project tech registry
```

---

## Team Architecture v2

**For complex multi-role projects requiring specialized expertise and orchestration.**

### Overview

Team Architecture v2 (`team-coordinate-v2`, `team-executor-v2`, `team-lifecycle-v5`) provides a unified team-worker agent architecture for complex software development workflows.

```
+---------------------------------------------------------------+
|              Team Coordinate / Team Executor v2               |
|                                                               |
|  +-------------+      +-------------------------------------+ |
|  | Coordinator | ---> |  Dynamic Role-Spec Generation       | |
|  | / Executor  |      |  (analyst, planner, executor, etc.) | |
|  +-------------+      +-------------------------------------+ |
|        |                            |                         |
|        v                            v                         |
|  +-------------+      +-------------------------------------+ |
|  |   Task      |      |         team-worker Agents          | |
|  | Dispatching |      |  Phase 1: Task Discovery (built-in) | |
|  +-------------+      |  Phase 2-4: Role-Specific (spec)    | |
|                       |  Phase 5: Report (built-in)         | |
|                       +-------------------------------------+ |
|                                    |                          |
|                                    v                          |
|                       +-------------------------------------+ |
|                       |  Subagents (Discuss, Explore, Docs) | |
|                       +-------------------------------------+ |
+---------------------------------------------------------------+
```

### team-worker Agent

The unified worker agent:
- **Phase 1 (Built-in)**: Task discovery - filters tasks by prefix and status
- **Phase 2-4 (Role-Specific)**: Loads domain logic from role-spec markdown files
- **Phase 5 (Built-in)**: Report + Fast-Advance - handles completion and successor spawning

### Role-Spec Files

Lightweight markdown files with YAML frontmatter:

```yaml
---
role: analyst
prefix: RESEARCH
inner_loop: false
subagents: [explore, discuss]
message_types:
  success: research_ready
  error: error
---
```

### Available Roles

| Role | Prefix | Responsibility | Inner Loop |
|------|--------|----------------|------------|
| analyst | RESEARCH | Codebase exploration, analysis | No |
| writer | DRAFT | Document generation | Yes |
| planner | PLAN | Task breakdown, dependency planning | Yes |
| executor | IMPL | Implementation and coding | Yes |
| tester | TEST | Testing and quality assurance | Yes |
| reviewer | REVIEW | Code review and quality gates | No |
| architect | ARCH | Architecture decisions | No |
| fe-developer | FE-IMPL | Frontend implementation | No |
| fe-qa | FE-TEST | Frontend testing | No |

### Inner Loop Framework

When `inner_loop: true`, a single agent processes all same-prefix tasks sequentially:

```
context_accumulator = []

Phase 1: Find first IMPL-* task
  Phase 2-4: Execute role spec
  Phase 5-L: Mark done, log, accumulate
    More IMPL-* tasks? -> Phase 1 (loop)
    No more? -> Phase 5-F (final report)
```

### Beat/Cadence Orchestration

**Event-driven coordination model**:

```
Beat Cycle (single beat)
======================================================================
  Event                   Coordinator              Workers
----------------------------------------------------------------------
  callback/resume --> +- handleCallback -+
                      |  mark completed   |
                      |  check pipeline   |
                      +- handleSpawnNext -+
                      |  find ready tasks |
                      |  spawn workers ---+--> [team-worker A]
                      |  (parallel OK)  --+--> [team-worker B]
                      +- STOP (idle) -----+         |
                                                     |
  callback <-----------------------------------------+
  (next beat)
======================================================================
```

### Commands

#### Team Coordinate

Generate role-specs and orchestrate a team from scratch:

```bash
/team-coordinate "Design and implement real-time collaboration"
```

**Process**:
1. Analyze requirements and detect capabilities
2. Generate role-specs dynamically
3. Create tasks with dependency chains
4. Spawn team-worker agents
5. Monitor progress via callbacks
6. Complete with comprehensive report

#### Team Executor

Execute a pre-planned team session:

```bash
/team-executor <session-folder>           # Initial execution
/team-executor <session-folder> resume    # Resume paused session
/team-executor <session-folder> status    # Check status
```

#### Team Lifecycle v5

Unified team skill for full lifecycle (spec -> impl -> test -> review):

```bash
# Triggers on "team lifecycle"
/team-lifecycle "Build a user authentication system with OAuth2"
```

**Pipeline Definitions**:

| Pipeline | Tasks | Flow |
|----------|-------|------|
| Spec-only | 6 | RESEARCH -> DRAFT-001..004 -> QUALITY |
| Impl-only | 4 | PLAN -> IMPL -> TEST + REVIEW |
| Full-lifecycle | 10 | [Spec] -> PLAN -> IMPL -> TEST + REVIEW |
| Frontend | 3+ | PLAN -> DEV-FE -> QA-FE (GC loop) |

### Subagents

| Subagent | Purpose |
|----------|---------|
| discuss | Multi-perspective critique with dynamic perspectives |
| explore | Codebase exploration with caching |
| doc-generation | Document generation from templates |

### Message Bus Protocol

```javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: "<session_id>",      // Session ID, NOT team name
  from: "<role>",
  to: "coordinator",
  type: "<message_type>",
  summary: "[<role>] <message>",
  ref: "<artifact_path>"
})
```

### Session Structure

```
.workflow/.team/<session-id>/
├── team-session.json           # Session metadata
├── task-analysis.json          # Task dependencies
├── role-specs/                 # Generated role-spec files
├── artifacts/                  # Task outputs
├── discussions/                # Multi-perspective critiques
├── explorations/               # Cached exploration results
└── wisdom/                     # Accumulated learnings
    ├── learnings.md
    ├── decisions.md
    ├── conventions.md
    └── issues.md
```

---

## Command Categories

### Workflow Commands

High-level orchestration for multi-phase development:

| Command | Purpose |
|---------|---------|
| `/workflow:plan` | Complete planning with session |
| `/workflow:lite-plan` | Lightweight interactive planning |
| `/workflow:lite-fix` | Bug diagnosis and fix |
| `/workflow:execute` | Execute tasks in session |
| `/workflow:resume` | Resume paused session |
| `/workflow:review` | Post-implementation review |
| `/workflow:status` | View workflow status |

### Session Commands

Session lifecycle management:

| Command | Purpose |
|---------|---------|
| `/workflow:session:start` | Start new session |
| `/workflow:session:list` | List all sessions |
| `/workflow:session:resume` | Resume paused session |
| `/workflow:session:complete` | Archive completed session |
| `/workflow:session:sync` | Sync to project specs |

### CLI Commands

Direct AI tool access:

| Command | Purpose |
|---------|---------|
| `/cli:cli-init` | Initialize CLI tool configs |
| `ccw cli -p "..." --tool gemini` | Execute with Gemini |
| `ccw cli -p "..." --tool codex --mode review` | Code review |

### Memory Commands

Context and documentation management:

| Command | Purpose |
|---------|---------|
| `/memory:capture` | Capture session insights |
| `/memory:query` | Query captured memories |

### Issue Commands

Post-development issue management:

| Command | Purpose |
|---------|---------|
| `/issue:discover` | Auto-discover issues |
| `/issue:discover-by-prompt` | Prompt-based discovery |
| `/issue:new` | Manual issue creation |
| `/issue:plan --all-pending` | Batch plan all pending |
| `/issue:queue` | Generate optimized queue |
| `/issue:execute` | Parallel execution |

---

## Skill Categories

### Workflow Skills

| Skill | Purpose |
|-------|---------|
| `workflow-plan` | Standard planning workflow |
| `workflow-lite-plan` | Lightweight planning |
| `workflow-multi-cli-plan` | Multi-CLI collaborative planning |
| `workflow-tdd` | Test-driven development |
| `workflow-test-fix` | Test fix generation |
| `workflow-execute` | Task execution engine |

### Team Skills

| Skill | Purpose |
|-------|---------|
| `team-lifecycle-v5` | Full lifecycle (spec -> impl -> test) |
| `team-coordinate-v2` | Team orchestration from scratch |
| `team-executor-v2` | Execute pre-planned team session |
| `team-brainstorm` | Multi-role brainstorming |
| `team-frontend` | Frontend-focused team |
| `team-testing` | Testing-focused team |
| `team-review` | Review-focused team |

### Specialized Skills

| Skill | Purpose |
|-------|---------|
| `brainstorm` | Single-agent brainstorming |
| `review-cycle` | Code review cycle |
| `review-code` | Code review |
| `spec-generator` | Specification generation |
| `skill-generator` | Create new skills |
| `command-generator` | Generate slash commands |

---

## Workflow Selection Guide

### Quick Selection Table

| Scenario | Recommended Workflow | Level |
|----------|---------------------|-------|
| Quick fixes, config adjustments | `lite-lite-lite` | 1 |
| Clear single-module features | `lite-plan -> lite-execute` | 2 |
| Bug diagnosis and fix | `lite-fix` | 2 |
| Production emergencies | `lite-fix --hotfix` | 2 |
| Technology selection, solution comparison | `multi-cli-plan -> lite-execute` | 2 |
| Multi-module changes, refactoring | `plan -> verify -> execute` | 3 |
| Test-driven development | `tdd-plan -> execute -> tdd-verify` | 3 |
| Test failure fixes | `test-fix-gen -> test-cycle-execute` | 3 |
| New features, architecture design | `brainstorm:auto-parallel -> plan` | 4 |
| Complex multi-role projects | `team-lifecycle-v5` | Team |
| Post-development issue fixes | Issue Workflow | - |

### Decision Flowchart

```
Start
  |
  +-- Post-development maintenance?
  |     +-- Yes -> Issue Workflow
  |     +-- No -->
  |
  +-- Need full team orchestration?
  |     +-- Yes -> team-lifecycle-v5 / team-coordinate-v2
  |     +-- No -->
  |
  +-- Requirements clear?
  |     +-- Uncertain -> Level 4 (brainstorm:auto-parallel)
  |     +-- Clear -->
  |
  +-- Need persistent Session?
  |     +-- Yes -> Level 3 (plan / tdd-plan / test-fix-gen)
  |     +-- No -->
  |
  +-- Need multi-perspective / comparison?
  |     +-- Yes -> Level 2 (multi-cli-plan)
  |     +-- No -->
  |
  +-- Bug fix?
  |     +-- Yes -> Level 2 (lite-fix)
  |     +-- No -->
  |
  +-- Need planning?
        +-- Yes -> Level 2 (lite-plan)
        +-- No -> Level 1 (lite-lite-lite)
```

### Complexity Indicators

System auto-evaluates complexity:

| Weight | Keywords |
|--------|----------|
| +2 | refactor, migrate, architect, system |
| +2 | multiple, across, all, entire |
| +1 | integrate, api, database |
| +1 | security, performance, scale |

- **High complexity** (>=4): Auto-select Level 3/Team
- **Medium complexity** (2-3): Auto-select Level 2
- **Low complexity** (<2): Auto-select Level 1

---

## Issue Workflow

**Main Workflow Supplement - Post-development continuous maintenance**

### Two-Phase Lifecycle

```
+-------------------------------------------------------------+
|                 Phase 1: Accumulation                        |
|                                                              |
|   Triggers:                                                  |
|   * Post-task review                                         |
|   * Code review findings                                     |
|   * Test failures                                            |
|                                                              |
|   +------------+    +------------+    +------------+         |
|   |  discover  |    | discover-  |    |    new     |         |
|   |   Auto     |    | by-prompt  |    |  Manual    |         |
|   +------------+    +------------+    +------------+         |
|                                                              |
|   Continuously accumulate issues to pending queue            |
+-------------------------------------------------------------+
                              |
                              | After sufficient accumulation
                              v
+-------------------------------------------------------------+
|               Phase 2: Batch Resolution                      |
|                                                              |
|   +------------+    +------------+    +------------+         |
|   |    plan    | -> |   queue    | -> |   execute  |         |
|   | --all-     |    |  Optimize  |    |  Parallel  |         |
|   |  pending   |    |   order    |    | execution  |         |
|   +------------+    +------------+    +------------+         |
|                                                              |
|   Supports worktree isolation, maintains main branch stable  |
+-------------------------------------------------------------+
```

### Command List

**Accumulation Phase**:
```bash
/issue:discover            # Multi-perspective auto-discovery
/issue:discover-by-prompt  # Prompt-based discovery
/issue:new                 # Manual creation
```

**Batch Resolution**:
```bash
/issue:plan --all-pending  # Batch plan all pending
/issue:queue               # Generate optimized execution queue
/issue:execute             # Parallel execution
```

---

## Summary

### Level Overview

| Level | Name | Workflows | Artifacts | Execution |
|-------|------|-----------|-----------|-----------|
| **1** | Rapid | `lite-lite-lite` | None | Direct |
| **2** | Lightweight | `lite-plan`, `lite-fix`, `multi-cli-plan` | Memory/Light | `lite-execute` |
| **3** | Standard | `plan`, `tdd-plan`, `test-fix-gen` | Session | `execute` |
| **4** | Brainstorm | `brainstorm:auto-parallel` | Multi-role + Session | `plan -> execute` |
| **Team** | Orchestration | `team-lifecycle-v5`, `team-*` | Full team artifacts | Coordinator |
| **Issue** | Maintenance | `discover -> plan -> queue -> execute` | Issue records | Worktree (optional) |

### Core Principles

1. **Main Workflow** solves parallelism through **dependency analysis + Agent parallel execution**
2. **Issue Workflow** serves as **supplementary mechanism**, supports worktree isolation
3. Select appropriate workflow level based on task complexity, **avoid over-engineering**
4. **Levels 1-4** are manual command selection; **Team Architecture** provides intelligent orchestration
5. Use **Session Lifecycle** commands for full workflow state management
6. Leverage **Inner Loop** roles for batch processing of same-type tasks
