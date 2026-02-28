# Core Concepts

## One-Line Positioning

**Core Concepts are the foundation for understanding Claude_dms3** — Three-layer abstraction of Commands, Skills, Prompts, Workflow session management, and team collaboration patterns.

---

## 3.1 Three-Layer Abstraction

Claude_dms3's command system is divided into three layers of abstraction:

### 3.1.1 Commands - Built-in Commands

**Commands are the atomic operations of Claude_dms3** — Predefined reusable commands that complete specific tasks.

| Category | Count | Description |
| --- | --- | --- |
| **Core Orchestration** | 2 | ccw, ccw-coordinator |
| **CLI Tools** | 2 | cli-init, codex-review |
| **Issue Workflow** | 8 | discover, plan, execute, queue, etc. |
| **Memory** | 2 | prepare, style-skill-memory |
| **Workflow Session** | 6 | start, resume, list, complete, etc. |
| **Workflow Analysis** | 10+ | analyze, brainstorm, debug, refactor, etc. |
| **Workflow UI Design** | 9 | generate, import-from-code, style-extract, etc. |

::: tip Tip
Commands are defined in the `.claude/commands/` directory. Each command is a Markdown file.
:::

### 3.1.2 Skills - Composite Skills

**Skills are combined encapsulations of Commands** — Reusable skills for specific scenarios, containing multiple steps and best practices.

| Skill | Function | Trigger |
| --- | --- | --- |
| **brainstorm** | Multi-perspective brainstorming | `/brainstorm` |
| **ccw-help** | CCW command help | `/ccw-help` |
| **command-generator** | Generate Claude commands | `/command-generator` |
| **issue-manage** | Issue management | `/issue-manage` |
| **memory-capture** | Memory compression and capture | `/memory-capture` |
| **memory-manage** | Memory updates | `/memory-manage` |
| **review-code** | Multi-dimensional code review | `/review-code` |
| **review-cycle** | Code review and fix cycle | `/review-cycle` |
| **skill-generator** | Generate Claude skills | `/skill-generator` |
| **skill-tuning** | Skill diagnosis and tuning | `/skill-tuning` |

::: tip Tip
Skills are defined in the `.claude/skills/` directory, containing SKILL.md specification files and reference documentation.
:::

### 3.1.3 Prompts - Codex Prompts

**Prompts are instruction templates for the Codex model** — Prompt templates optimized for the Codex (GPT) model.

| Prompt | Function |
| --- | --- |
| **prep-cycle** | Prep cycle prompt |
| **prep-plan** | Prep planning prompt |

::: tip Tip
Codex Prompts are defined in the `.codex/prompts/` directory, optimized specifically for the Codex model.
:::

---

## 3.2 Three-Layer Relationship

```
┌─────────────────────────────────────────────────────┐
│                    User Request                      │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────┐
│                  ccw (Orchestrator)                  │
│  Intent Analysis → Workflow Selection → Execution    │
└────────────────────┬────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
    ┌────────┐  ┌────────┐  ┌────────┐
    │ Command│  │ Skill  │  │ Prompt │
    │ (Atom) │  │(Composite)│ │(Template)│
    └────────┘  └────────┘  └────────┘
         │           │           │
         └───────────┼───────────┘
                     ▼
            ┌────────────────┐
            │ AI Model Call   │
            └────────────────┘
```

### 3.2.1 Call Path

1. **User initiates request** → Enter command or describe requirements in VS Code
2. **ccw orchestration** → Intent analysis, select appropriate workflow
3. **Execute Command** → Execute atomic command operations
4. **Call Skill** → For complex logic, call composite skills
5. **Use Prompt** → For specific models, use optimized prompts
6. **AI model execution** → Call configured AI model
7. **Return result** → Format output to user

---

## 3.3 Workflow Session Management

### 3.3.1 Session Lifecycle

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────┐
│  Start  │────▶│ Resume  │────▶│ Execute │────▶│Complete │
│  Launch │     │  Resume │     │ Execute │     │ Complete│
└─────────┘     └─────────┘     └─────────┘     └─────────┘
     │                                │
     ▼                                ▼
┌─────────┐                     ┌─────────┐
│  List   │                     │ Solidify│
│  List   │                     │ Solidify│
└─────────┘                     └─────────┘
```

### 3.3.2 Session Commands

| Command | Function | Example |
| --- | --- | --- |
| **start** | Start new session | `/workflow:session:start` |
| **resume** | Resume existing session | `/workflow:session:resume <session-id>` |
| **list** | List all sessions | `/workflow:session:list` |
| **sync** | Sync session state | `/workflow:session:sync` |
| **complete** | Complete current session | `/workflow:session:complete` |
| **solidify** | Solidify session results | `/workflow:session:solidify` |

### 3.3.3 Session Directory Structure

```
.workflow/
├── .team/
│   └── TC-<project>-<date>/      # Session directory
│       ├── spec/                  # Session specifications
│       │   ├── discovery-context.json
│       │   └── requirements.md
│       ├── artifacts/             # Session artifacts
│       ├── wisdom/                # Session wisdom
│       │   ├── learnings.md
│       │   ├── decisions.md
│       │   ├── conventions.md
│       │   └── issues.md
│       └── .team-msg/             # Message bus
```

---

## 3.4 Team Collaboration Patterns

### 3.4.1 Role System

Claude_dms3 supports 8 team workflows, each defining different roles:

| Workflow | Roles | Description |
| --- | --- | --- |
| **PlanEx** | planner, executor | Planning-execution separation |
| **IterDev** | developer, reviewer | Iterative development |
| **Lifecycle** | analyzer, developer, tester, reviewer | Lifecycle coverage |
| **Issue** | discoverer, planner, executor | Issue-driven |
| **Testing** | tester, developer | Test-driven |
| **QA** | qa, developer | Quality assurance |
| **Brainstorm** | facilitator, perspectives | Multi-perspective analysis |
| **UIDesign** | designer, developer | UI design generation |

### 3.4.2 Message Bus

Team members communicate via the message bus:

```
┌────────────┐                   ┌────────────┐
│  Planner   │                   │ Executor   │
└─────┬──────┘                   └──────┬─────┘
      │                                 │
      │  [plan_ready]                   │
      ├────────────────────────────────▶
      │                                 │
      │                          [task_complete]
      │◀────────────────────────────────┤
      │                                 │
      │   [plan_approved]               │
      ├────────────────────────────────▶
      │                                 │
```

### 3.4.3 Workflow Selection Guide

| Task Objective | Recommended Workflow | Command |
| --- | --- | --- |
| New feature development | PlanEx | `/workflow:plan` |
| Bug fix | Lifecycle | `/debug-with-file` |
| Code refactoring | IterDev | `/refactor-cycle` |
| Technical decision | Brainstorm | `/brainstorm-with-file` |
| UI development | UIDesign | `/workflow:ui-design` |
| Integration testing | Testing | `/integration-test-cycle` |
| Code review | QA | `/review-cycle` |
| Issue management | Issue | `/issue` series |

---

## 3.5 Core Concepts Overview

| Concept | Description | Location/Command |
| --- | --- | --- |
| **Command** | Atomic operation commands | `.claude/commands/` |
| **Skill** | Composite skill encapsulation | `.claude/skills/` |
| **Prompt** | Codex prompt templates | `.codex/prompts/` |
| **Workflow** | Team collaboration process | `/workflow:*` |
| **Session** | Session context management | `/workflow:session:*` |
| **Memory** | Cross-session knowledge persistence | `ccw memory` |
| **Spec** | Project specification constraints | `.workflow/specs/` |
| **CodexLens** | Semantic code indexing | `.codex-lens/` |
| **CCW** | CLI invocation framework | `ccw` directory |

---

## 3.6 Data Flow

```
User Request
   │
   ▼
┌──────────────┐
│  CCW Orchestrator│ ──▶ Intent Analysis
└──────────────┘
   │
   ├─▶ Workflow Selection
   │      │
   │      ├─▶ PlanEx
   │      ├─▶ IterDev
   │      ├─▶ Lifecycle
   │      └─▶ ...
   │
   ├─▶ Command Execution
   │      │
   │      ├─▶ Built-in commands
   │      └─▶ Skill calls
   │
   ├─▶ AI Model Invocation
   │      │
   │      ├─▶ Gemini
   │      ├─▶ Qwen
   │      ├─▶ Codex
   │      └─▶ Claude
   │
   └─▶ Result Return
          │
          ├─▶ File modification
          ├─▶ Memory update
          └─▶ Dashboard update
```

---

## Next Steps

- [Workflow Basics](ch04-workflow-basics.md) — Learn various workflow commands
- [Advanced Tips](ch05-advanced-tips.md) — CLI toolchain, multi-model collaboration
- [Best Practices](ch06-best-practices.md) — Team collaboration standards, code review process
