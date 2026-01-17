# CCW Workflow Difficulty Guide

## Overview

CCW provides two workflow systems: **Main Workflow** and **Issue Workflow**, working together to cover the complete software development lifecycle.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Main Workflow                                  │
│                                                                             │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐     │
│  │   Level 1   │ → │   Level 2   │ → │   Level 3   │ → │   Level 4   │     │
│  │   Rapid     │   │ Lightweight │   │  Standard   │   │ Brainstorm  │     │
│  │             │   │             │   │             │   │             │     │
│  │ lite-lite-  │   │ lite-plan   │   │    plan     │   │ brainstorm  │     │
│  │    lite     │   │ lite-fix    │   │  tdd-plan   │   │  :auto-     │     │
│  │             │   │ multi-cli-  │   │ test-fix-   │   │  parallel   │     │
│  │             │   │    plan     │   │    gen      │   │     ↓       │     │
│  │             │   │             │   │             │   │   plan      │     │
│  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘     │
│                                                                             │
│  Complexity: ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━▶  │
│              Low                                                    High    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ After development
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Issue Workflow                                 │
│                                                                             │
│     ┌──────────────┐         ┌──────────────┐         ┌──────────────┐     │
│     │  Accumulate  │    →    │    Plan      │    →    │   Execute    │     │
│     │  Discover &  │         │    Batch     │         │   Parallel   │     │
│     │   Collect    │         │   Planning   │         │  Execution   │     │
│     └──────────────┘         └──────────────┘         └──────────────┘     │
│                                                                             │
│     Supplementary role: Maintain main branch stability, worktree isolation  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Main Workflow vs Issue Workflow

### Design Philosophy

| Aspect | Main Workflow | Issue Workflow |
|--------|---------------|----------------|
| **Purpose** | Primary development cycle | Post-development maintenance |
| **Timing** | Feature development phase | After main workflow completes |
| **Scope** | Complete feature implementation | Targeted fixes/enhancements |
| **Parallelism** | Dependency analysis → Agent parallel | Worktree isolation (optional) |
| **Branch Model** | Work on current branch | Can use isolated worktree |

### Why Main Workflow Doesn't Use Worktree Automatically?

**Dependency analysis already solves parallelism**:

1. Planning phase (`/workflow:plan`) performs dependency analysis
2. Automatically identifies task dependencies and critical paths
3. Partitions into **parallel groups** (independent tasks) and **serial chains** (dependent tasks)
4. Agents execute independent tasks in parallel without filesystem isolation

```
┌─────────────────────────────────────────────────┐
│            Dependency Analysis                  │
│                                                 │
│  Task A ─────┐                                  │
│              ├──→ Parallel Group 1 ──→ Agent 1  │
│  Task B ─────┘                                  │
│                                                 │
│  Task C ────────→ Serial Chain ──────→ Agent 2  │
│       ↓                                         │
│  Task D ────────→                               │
│                                                 │
│  Same worktree, parallelism through scheduling  │
└─────────────────────────────────────────────────┘
```

### Why Issue Workflow Supports Worktree?

Issue Workflow serves as a **supplementary mechanism** with different scenarios:

1. Main development complete, merged to `main`
2. Issues discovered requiring fixes
3. Need to fix without affecting current development
4. Worktree isolation keeps main branch stable

```
Development → Release → Discover Issue → Worktree Fix → Merge back
    ↑                                                      │
    └────────────── Continue new feature ←─────────────────┘
```

---

## Level 1: Rapid Execution (lite-lite-lite)

**Simplest - Single CLI analysis to execution, zero artifacts**

### Characteristics

| Property | Value |
|----------|-------|
| **Complexity** | Low |
| **Artifacts** | None |
| **State** | Stateless |
| **CLI Selection** | Auto-analyze task type |
| **Iteration** | Via AskUser |

### Flow

```
User Input → Clarification → Auto-select CLI → Parallel Analysis → Show Results → Direct Execute
                                  ↓
                            No intermediate files
```

### Command

```bash
/workflow:lite-lite-lite
# Or CCW auto-selects for simple tasks
```

### Use Cases

- ✅ Quick fixes
- ✅ Simple feature additions
- ✅ Configuration adjustments
- ✅ Small-scope renaming
- ❌ Multi-module changes
- ❌ Need persistent records

---

## Level 2: Lightweight Planning

**Lightweight - In-memory planning or single analysis, fast iteration**

### Included Workflows

| Workflow | Purpose | Artifacts | Execution |
|----------|---------|-----------|-----------|
| `lite-plan` | Clear requirement development | memory://plan | → `lite-execute` |
| `lite-fix` | Bug diagnosis and fix | `.workflow/.lite-fix/` | → `lite-execute` |
| `multi-cli-plan` | Multi-perspective tasks | `.workflow/.multi-cli-plan/` | → `lite-execute` |

### Common Characteristics

| Property | Value |
|----------|-------|
| **Complexity** | Low-Medium |
| **State** | Session-scoped / Lightweight persistence |
| **Execution** | Unified via `lite-execute` |
| **Use Case** | Relatively clear requirements |

---

### 2.1 lite-plan → lite-execute

**In-memory planning + Direct execution**

```
┌─────────────────┐     ┌─────────────────┐
│  lite-plan      │ ──→ │  lite-execute   │
│  In-memory plan │     │  Direct execute │
└─────────────────┘     └─────────────────┘
```

```bash
/workflow:lite-plan    # Planning
/workflow:lite-execute # Execution
```

**Use Case**: Clear single-module features

---

### 2.2 lite-fix

**Intelligent diagnosis + Fix (5 phases)**

```
Phase 1: Bug Analysis & Diagnosis
   ├─ Intelligent severity pre-assessment (Low/Medium/High/Critical)
   └─ Parallel cli-explore-agent diagnosis (1-4 angles)

Phase 2: Clarification (optional)
   └─ Aggregate clarification needs, AskUserQuestion

Phase 3: Fix Planning
   ├─ Low/Medium → Claude direct planning
   └─ High/Critical → cli-lite-planning-agent

Phase 4: Confirmation & Selection
   └─ User confirms execution method

Phase 5: Execute
   └─ SlashCommand("/workflow:lite-execute --in-memory --mode bugfix")
```

```bash
/workflow:lite-fix           # Standard fix
/workflow:lite-fix --hotfix  # Emergency hotfix (skip diagnosis)
```

**Artifacts**: `.workflow/.lite-fix/{bug-slug}-{date}/`
- `diagnosis-{angle}.json` (1-4 diagnosis files)
- `diagnoses-manifest.json`
- `fix-plan.json`

**Use Case**: Bug diagnosis, production emergencies

---

### 2.3 multi-cli-plan → lite-execute

**Multi-CLI collaborative analysis + Consensus convergence (5 phases)**

```
Phase 1: Context Gathering
   └─ ACE semantic search, build context package

Phase 2: Multi-CLI Discussion (iterative)
   ├─ cli-discuss-agent executes Gemini + Codex + Claude
   ├─ Cross-verification, synthesize solutions
   └─ Loop until convergence or max rounds

Phase 3: Present Options
   └─ Display solutions with trade-offs

Phase 4: User Decision
   └─ User selects solution

Phase 5: Plan Generation
   ├─ cli-lite-planning-agent generates plan
   └─ → lite-execute
```

```bash
/workflow:multi-cli-plan "task description"  # Multi-CLI collaborative planning
/workflow:lite-execute                       # Execute selected solution
```

**Artifacts**: `.workflow/.multi-cli-plan/{MCP-task-slug-date}/`
- `rounds/*/synthesis.json` (per-round analysis)
- `context-package.json`
- `IMPL_PLAN.md` + `plan.json`

**vs lite-plan comparison**:

| Aspect | multi-cli-plan | lite-plan |
|--------|---------------|-----------|
| **Context** | ACE semantic search | Manual file patterns |
| **Analysis** | Multi-CLI cross-verification | Single planning |
| **Iteration** | Multiple rounds until convergence | Single round |
| **Confidence** | High (consensus-driven) | Medium (single perspective) |

**Use Case**: Multi-perspective analysis, technology selection, solution comparison

---

## Level 3: Standard Planning

**Standard - Complete planning + Persistent Session + Verification**

### Included Workflows

| Workflow | Purpose | Phases | Artifact Location |
|----------|---------|--------|-------------------|
| `plan` | Complex feature development | 5 phases | `.workflow/active/{session}/` |
| `tdd-plan` | Test-driven development | 6 phases | `.workflow/active/{session}/` |
| `test-fix-gen` | Test fix generation | 5 phases | `.workflow/active/WFS-test-{session}/` |

### Common Characteristics

| Property | Value |
|----------|-------|
| **Complexity** | Medium-High |
| **Artifacts** | Persistent files (`.workflow/active/{session}/`) |
| **State** | Full session management |
| **Verification** | Built-in verification steps |
| **Execution** | `/workflow:execute` |
| **Use Case** | Multi-module, traceable tasks |

---

### 3.1 plan → verify → execute

**5-phase complete planning workflow**

```
Phase 1: Session Discovery
   └─ /workflow:session:start --auto

Phase 2: Context Gathering
   └─ /workflow:tools:context-gather
      └─ Returns context-package.json + conflict_risk

Phase 3: Conflict Resolution (conditional)
   └─ IF conflict_risk ≥ medium → /workflow:tools:conflict-resolution

Phase 4: Task Generation
   └─ /workflow:tools:task-generate-agent
      └─ Returns IMPL_PLAN.md + IMPL-*.json + TODO_LIST.md

Return: Summary + Next Steps
```

```bash
/workflow:plan "task description"   # Complete planning
/workflow:action-plan-verify        # Verify plan (recommended)
/workflow:execute                   # Execute
/workflow:review                    # (optional) Review
```

**Artifacts**: `.workflow/active/{WFS-session}/`
- `workflow-session.json`
- `IMPL_PLAN.md`
- `TODO_LIST.md`
- `.task/IMPL-*.json`
- `.process/context-package.json`

**Use Case**: Multi-module changes, refactoring, dependency analysis needed

---

### 3.2 tdd-plan → execute → tdd-verify

**6-phase test-driven development workflow**

```
Phase 1: Session Discovery
   └─ /workflow:session:start --type tdd --auto

Phase 2: Context Gathering
   └─ /workflow:tools:context-gather

Phase 3: Test Coverage Analysis
   └─ /workflow:tools:test-context-gather
      └─ Detect test framework, analyze coverage

Phase 4: Conflict Resolution (conditional)
   └─ IF conflict_risk ≥ medium → /workflow:tools:conflict-resolution

Phase 5: TDD Task Generation
   └─ /workflow:tools:task-generate-tdd
      └─ Generate IMPL tasks with built-in Red-Green-Refactor cycles

Phase 6: TDD Structure Validation
   └─ Verify TDD structure compliance
```

```bash
/workflow:tdd-plan "feature description"  # TDD planning
/workflow:action-plan-verify              # Verify (recommended)
/workflow:execute                         # Execute (follow Red-Green-Refactor)
/workflow:tdd-verify                      # Verify TDD compliance
```

**TDD Task Structure**:
- Each IMPL task contains complete internal Red-Green-Refactor cycle
- `meta.tdd_workflow: true`
- `flow_control.implementation_approach` contains 3 steps (red/green/refactor)
- Green phase includes test-fix-cycle configuration

**Use Case**: Test-driven development, high-quality feature requirements

---

### 3.3 test-fix-gen → test-cycle-execute

**5-phase test fix generation workflow**

```
Phase 1: Create Test Session
   └─ /workflow:session:start --type test --new

Phase 2: Gather Test Context
   ├─ Session Mode: /workflow:tools:test-context-gather
   └─ Prompt Mode: /workflow:tools:context-gather

Phase 3: Test Generation Analysis
   └─ /workflow:tools:test-concept-enhanced
      └─ Multi-layer test requirements (L0: Static, L1: Unit, L2: Integration, L3: E2E)

Phase 4: Generate Test Tasks
   └─ /workflow:tools:test-task-generate
      └─ IMPL-001 (generate) + IMPL-001.5 (quality gate) + IMPL-002 (execute fix)

Phase 5: Return Summary
   └─ → /workflow:test-cycle-execute
```

**Dual-mode support**:
| Mode | Input Pattern | Context Source |
|------|---------------|----------------|
| Session Mode | `WFS-xxx` | Source session summaries |
| Prompt Mode | Text/file path | Direct codebase analysis |

```bash
/workflow:test-fix-gen WFS-user-auth-v2        # Session Mode
/workflow:test-fix-gen "Test the auth API"     # Prompt Mode
/workflow:test-cycle-execute                   # Execute test-fix cycle
```

**Artifacts**: `.workflow/active/WFS-test-{session}/`
- `.task/IMPL-001.json` (test understanding & generation)
- `.task/IMPL-001.5-review.json` (quality gate)
- `.task/IMPL-002.json` (test execution & fix cycle)
- `.process/TEST_ANALYSIS_RESULTS.md`

**Use Case**: Test failure fixes, coverage improvement

---

## Level 4: Brainstorming (brainstorm:auto-parallel)

**Most Complex - Multi-role brainstorming + Complete planning + Execution**

### Characteristics

| Property | Value |
|----------|-------|
| **Complexity** | High |
| **Artifacts** | Multi-role analysis docs + `IMPL_PLAN.md` |
| **Role Count** | 3-9 (default 3) |
| **Execution Mode** | Phase 1/3 sequential, Phase 2 parallel |

### 3-Phase Flow

```
Phase 1: Interactive Framework Generation
   └─ /workflow:brainstorm:artifacts
      ├─ Topic analysis, generate questions
      ├─ Role selection (user confirmation)
      ├─ Role question collection
      ├─ Conflict detection and resolution
      └─ Generate guidance-specification.md

Phase 2: Parallel Role Analysis (parallel)
   └─ N × Task(conceptual-planning-agent)
      ├─ Each role analyzes independently
      └─ Parallel generate {role}/analysis.md

Phase 3: Synthesis Integration
   └─ /workflow:brainstorm:synthesis
      └─ Integrate all role analyses → synthesis-specification.md
```

### Commands

```bash
/workflow:brainstorm:auto-parallel "topic" [--count N] [--style-skill package]
/workflow:plan --session {sessionId}     # Plan based on brainstorm results
/workflow:action-plan-verify             # Verify
/workflow:execute                        # Execute
```

### Available Roles

| Role | Description |
|------|-------------|
| `system-architect` | System Architect |
| `ui-designer` | UI Designer |
| `ux-expert` | UX Expert |
| `product-manager` | Product Manager |
| `product-owner` | Product Owner |
| `data-architect` | Data Architect |
| `scrum-master` | Scrum Master |
| `subject-matter-expert` | Domain Expert |
| `test-strategist` | Test Strategist |

### Artifact Structure

```
.workflow/active/WFS-{topic}/
├── workflow-session.json              # Session metadata
└── .brainstorming/
    ├── guidance-specification.md      # Framework (Phase 1)
    ├── {role}/
    │   ├── analysis.md                # Main document
    │   └── analysis-{slug}.md         # Sub-documents (optional, max 5)
    └── synthesis-specification.md     # Integration (Phase 3)
```

### Use Cases

- ✅ New feature design
- ✅ System architecture refactoring
- ✅ Exploratory requirements
- ✅ Uncertain implementation approach
- ✅ Multi-dimensional trade-offs needed
- ❌ Clear requirements
- ❌ Time-sensitive tasks

---

## Issue Workflow

**Main Workflow Supplement - Post-development continuous maintenance**

### Two-Phase Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Phase 1: Accumulation                            │
│                                                                     │
│   Triggers:                                                         │
│   • Post-task review                                                │
│   • Code review findings                                            │
│   • Test failures                                                   │
│                                                                     │
│   ┌────────────┐     ┌────────────┐     ┌────────────┐             │
│   │ discover   │     │ discover-  │     │    new     │             │
│   │ Auto-find  │     │ by-prompt  │     │  Manual    │             │
│   └────────────┘     └────────────┘     └────────────┘             │
│                                                                     │
│   Continuously accumulate issues to pending queue                   │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               │ After sufficient accumulation
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Phase 2: Batch Resolution                          │
│                                                                     │
│   ┌────────────┐     ┌────────────┐     ┌────────────┐             │
│   │   plan     │ ──→ │   queue    │ ──→ │  execute   │             │
│   │ --all-     │     │ Optimize   │     │  Parallel  │             │
│   │  pending   │     │  order     │     │ execution  │             │
│   └────────────┘     └────────────┘     └────────────┘             │
│                                                                     │
│   Supports worktree isolation, maintains main branch stability      │
└─────────────────────────────────────────────────────────────────────┘
```

### Command List

**Accumulation Phase:**
```bash
/issue:discover            # Multi-perspective auto-discovery
/issue:discover-by-prompt  # Prompt-based discovery
/issue:new                 # Manual creation
```

**Batch Resolution:**
```bash
/issue:plan --all-pending  # Batch plan all pending
/issue:queue               # Generate optimized execution queue
/issue:execute             # Parallel execution
```

### Collaboration with Main Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Development Iteration Loop                     │
│                                                                     │
│   ┌─────────┐                              ┌─────────┐             │
│   │ Feature │ ──→ Main Workflow ──→ Done ──→│ Review  │             │
│   │ Request │     (Level 1-4)              └────┬────┘             │
│   └─────────┘                                   │                  │
│        ▲                                        │ Issues found      │
│        │                                        ▼                  │
│        │                                  ┌─────────┐              │
│        │                                  │  Issue  │              │
│        │                                  │ Workflow│              │
│   Continue│                               └────┬────┘              │
│   new     │                                    │                   │
│   feature │         ┌──────────────────────────┘                   │
│        │         │ Fix complete                                    │
│        │         ▼                                                 │
│   ┌────┴────┐◀──────                                               │
│   │  Main   │    Merge                                             │
│   │ Branch  │    back                                              │
│   └─────────┘                                                      │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Workflow Selection Guide

### Quick Selection Table

| Scenario | Recommended Workflow | Level |
|----------|---------------------|-------|
| Quick fixes, config adjustments | `lite-lite-lite` | 1 |
| Clear single-module features | `lite-plan → lite-execute` | 2 |
| Bug diagnosis and fix | `lite-fix` | 2 |
| Production emergencies | `lite-fix --hotfix` | 2 |
| Technology selection, solution comparison | `multi-cli-plan → lite-execute` | 2 |
| Multi-module changes, refactoring | `plan → verify → execute` | 3 |
| Test-driven development | `tdd-plan → execute → tdd-verify` | 3 |
| Test failure fixes | `test-fix-gen → test-cycle-execute` | 3 |
| New features, architecture design | `brainstorm:auto-parallel → plan → execute` | 4 |
| Post-development issue fixes | Issue Workflow | - |

### Decision Flowchart

```
Start
  │
  ├─ Is it post-development maintenance?
  │     ├─ Yes → Issue Workflow
  │     └─ No ↓
  │
  ├─ Are requirements clear?
  │     ├─ Uncertain → Level 4 (brainstorm:auto-parallel)
  │     └─ Clear ↓
  │
  ├─ Need persistent Session?
  │     ├─ Yes → Level 3 (plan / tdd-plan / test-fix-gen)
  │     └─ No ↓
  │
  ├─ Need multi-perspective / solution comparison?
  │     ├─ Yes → Level 2 (multi-cli-plan)
  │     └─ No ↓
  │
  ├─ Is it a bug fix?
  │     ├─ Yes → Level 2 (lite-fix)
  │     └─ No ↓
  │
  ├─ Need planning?
  │     ├─ Yes → Level 2 (lite-plan)
  │     └─ No → Level 1 (lite-lite-lite)
```

### Complexity Indicators

System auto-evaluates complexity based on these keywords:

| Weight | Keywords |
|--------|----------|
| +2 | refactor, migrate, architect, system |
| +2 | multiple, across, all, entire |
| +1 | integrate, api, database |
| +1 | security, performance, scale |

- **High complexity** (≥4): Auto-select Level 3-4
- **Medium complexity** (2-3): Auto-select Level 2
- **Low complexity** (<2): Auto-select Level 1

---

## ACE Tool Configuration

ACE (Augment Context Engine) provides powerful semantic code search. Two configuration methods available:

| Method | Link |
|--------|------|
| **Official** | [Augment MCP Documentation](https://docs.augmentcode.com/context-services/mcp/overview) |
| **Proxy** | [ace-tool (GitHub)](https://github.com/eastxiaodong/ace-tool) |

### Usage Example

```javascript
mcp__ace-tool__search_context({
  project_root_path: "/path/to/project",
  query: "authentication logic"
})
```

---

## Summary

### Level Overview

| Level | Name | Included Workflows | Artifacts | Execution |
|-------|------|-------------------|-----------|-----------|
| **1** | Rapid | `lite-lite-lite` | None | Direct execute |
| **2** | Lightweight | `lite-plan`, `lite-fix`, `multi-cli-plan` | Memory/Lightweight files | → `lite-execute` |
| **3** | Standard | `plan`, `tdd-plan`, `test-fix-gen` | Session persistence | → `execute` / `test-cycle-execute` |
| **4** | Brainstorm | `brainstorm:auto-parallel` → `plan` | Multi-role analysis + Session | → `execute` |
| **-** | Issue | `discover` → `plan` → `queue` → `execute` | Issue records | Worktree isolation (optional) |

### Core Principles

1. **Main Workflow** solves parallelism through **dependency analysis + Agent parallel execution**, no worktree needed
2. **Issue Workflow** serves as a **supplementary mechanism**, supporting worktree isolation to maintain main branch stability
3. Select appropriate workflow level based on task complexity, **avoid over-engineering**
4. Level 2 workflow selection criteria:
   - Clear requirements → `lite-plan`
   - Bug fix → `lite-fix`
   - Need multi-perspective → `multi-cli-plan`
5. Level 3 workflow selection criteria:
   - Standard development → `plan`
   - Test-driven → `tdd-plan`
   - Test fix → `test-fix-gen`
