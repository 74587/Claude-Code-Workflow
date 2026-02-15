---
name: codex-skill-designer
description: Meta-skill for designing Codex-native skills with subagent orchestration (spawn_agent/wait/send_input/close_agent). Supports new skill creation and Claude→Codex conversion. Triggers on "design codex skill", "create codex skill", "codex skill designer", "convert to codex".
allowed-tools: Task, AskUserQuestion, TodoWrite, Read, Write, Edit, Bash, Glob, Grep
---

# Codex Skill Designer

Meta-skill for creating Codex-native skills that use the subagent API (`spawn_agent`/`wait`/`send_input`/`close_agent`). Generates complete skill packages with orchestrator coordination and agent role definitions.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Codex Skill Designer                                        │
│  → Analyze requirements → Design orchestrator → Design agents│
└───────────────┬──────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┐
    ↓           ↓           ↓           ↓
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Phase 1 │ │ Phase 2 │ │ Phase 3 │ │ Phase 4 │
│ Require │ │  Orch   │ │ Agent   │ │ Valid   │
│ Analysis│ │ Design  │ │ Design  │ │ & Integ │
└─────────┘ └─────────┘ └─────────┘ └─────────┘
     ↓           ↓           ↓           ↓
  codexSkill  orchestrator agents/    Complete
  Config      .md generated *.md      skill pkg
```

## Target Output Structure

The skill this meta-skill produces follows this structure:

### Mode A: Structured Skill Package (multi-agent orchestration)

```
.codex/skills/{skill-name}/
├── orchestrator.md              # Main Codex orchestrator
│   ├── Frontmatter (name, description)
│   ├── Architecture (spawn/wait/close flow)
│   ├── Agent Registry (role → path mapping)
│   ├── Phase Execution (spawn_agent patterns)
│   ├── Result Aggregation (wait + merge)
│   └── Lifecycle Management (close_agent cleanup)
├── agents/                      # Skill-specific agent definitions
│   ├── {agent-1}.md             # → deploy to ~/.codex/agents/
│   └── {agent-2}.md             # → deploy to ~/.codex/agents/
└── phases/                      # [Optional] Phase execution detail
    ├── 01-{phase}.md
    └── 02-{phase}.md
```

### Mode B: Single Prompt (simple or self-contained skills)

```
~/.codex/prompts/{skill-name}.md   # Self-contained Codex prompt
```

## Key Design Principles — Codex-Native Patterns

### Pattern 1: Explicit Lifecycle Management

Every agent has a complete lifecycle: `spawn_agent` → `wait` → [`send_input`] → `close_agent`.

```javascript
// Standard lifecycle
const agentId = spawn_agent({ message: taskMessage })
const result = wait({ ids: [agentId], timeout_ms: 300000 })
// [Optional: send_input for multi-round]
close_agent({ id: agentId })
```

**Key Rules**:
- Use `wait()` to get results, NEVER depend on `close_agent` return
- `close_agent` is irreversible — no further `wait`/`send_input` possible
- Delay `close_agent` until certain no more interaction is needed

### Pattern 2: Role Loading via Path Reference

Codex subagents cannot auto-load roles. Use MANDATORY FIRST STEPS pattern:

```javascript
spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/{agent-type}.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

## TASK CONTEXT
${taskContext}

## DELIVERABLES
${deliverables}
`
})
```

### Pattern 3: Parallel Fan-out with Batch Wait

Multiple independent agents → batch `wait({ ids: [...] })`:

```javascript
const agentIds = tasks.map(task =>
  spawn_agent({ message: buildTaskMessage(task) })
)
const results = wait({ ids: agentIds, timeout_ms: 600000 })
agentIds.forEach(id => close_agent({ id }))
```

### Pattern 4: Deep Interaction (send_input Multi-round)

Single agent, multi-phase with context preservation:

```javascript
const agent = spawn_agent({ message: explorePrompt })
const round1 = wait({ ids: [agent] })

// Continue with clarification
send_input({ id: agent, message: clarificationAnswers })
const round2 = wait({ ids: [agent] })

close_agent({ id: agent })  // Only after all rounds complete
```

### Pattern 5: Two-Phase Workflow (Clarify → Execute)

```
Phase 1: spawn_agent → output Open Questions only
         ↓
Phase 2: send_input (answers) → output full solution
```

### Pattern 6: Structured Output Template

All agents produce uniform output:

```text
Summary:
- One-sentence completion status

Findings:
- Finding 1: specific description
- Finding 2: specific description

Proposed changes:
- File: path/to/file
- Change: specific modification
- Risk: potential impact

Tests:
- New/updated test cases needed
- Test commands to run

Open questions:
1. Question needing clarification
2. Question needing clarification
```

## Execution Flow

```
Phase 1: Requirements Analysis
   └─ Ref: phases/01-requirements-analysis.md
      ├─ Input: text description / Claude skill / requirements doc / existing codex prompt
      └─ Output: codexSkillConfig (agents, phases, patterns, interaction model)

Phase 2: Orchestrator Design
   └─ Ref: phases/02-orchestrator-design.md
      ├─ Input: codexSkillConfig
      └─ Output: .codex/skills/{name}/orchestrator.md (or ~/.codex/prompts/{name}.md)

Phase 3: Agent Design
   └─ Ref: phases/03-agent-design.md
      ├─ Input: codexSkillConfig + source content
      └─ Output: .codex/skills/{name}/agents/*.md + optional phases/*.md

Phase 4: Validation & Delivery
   └─ Ref: phases/04-validation.md
      └─ Output: Validated skill package + deployment instructions
```

**Phase Reference Documents** (read on-demand when phase executes):

| Phase | Document | Purpose |
|-------|----------|---------|
| 1 | [phases/01-requirements-analysis.md](phases/01-requirements-analysis.md) | Analyze inputs, determine skill config |
| 2 | [phases/02-orchestrator-design.md](phases/02-orchestrator-design.md) | Generate Codex-native orchestrator |
| 3 | [phases/03-agent-design.md](phases/03-agent-design.md) | Generate agent roles & command patterns |
| 4 | [phases/04-validation.md](phases/04-validation.md) | Validate structure, patterns, quality |

## Input Sources

| Source | Description | Example |
|--------|-------------|---------|
| **Text description** | User describes desired Codex skill | "Create a 3-agent code review skill for Codex" |
| **Claude skill** | Convert existing Claude skill to Codex | `.claude/skills/workflow-plan/SKILL.md` |
| **Requirements doc** | Structured requirements file | `requirements.md` with agents/phases/outputs |
| **Existing Codex prompt** | Refactor/enhance a Codex prompt | `~/.codex/prompts/plan.md` |

## Conversion Mode (Claude → Codex)

When source is a Claude skill, apply conversion rules:

| Claude Pattern | Codex Equivalent |
|----------------|-----------------|
| `Task({ subagent_type, prompt })` | `spawn_agent({ message })` + `wait()` |
| `Task({ run_in_background: false })` | `spawn_agent()` + immediate `wait()` |
| `Task({ resume: agentId })` | `send_input({ id: agentId })` |
| `TaskOutput({ task_id, block })` | `wait({ ids: [id], timeout_ms })` |
| Automatic agent cleanup | Explicit `close_agent({ id })` |
| `subagent_type` auto-loads role | MANDATORY FIRST STEPS role path |
| Multiple parallel `Task()` calls | Multiple `spawn_agent()` + batch `wait({ ids })` |

**Full conversion spec**: Ref: specs/conversion-rules.md

## Data Flow

```
Phase 1 → codexSkillConfig:
  {
    name, description, outputMode (structured|single),
    agents: [{ name, role_file, responsibility, patterns }],
    phases: [{ name, agents_involved, interaction_model }],
    parallelSplits: [{ strategy, agents }],
    conversionSource: null | { type, path }
  }

Phase 2 → orchestrator.md:
  Generated Codex orchestrator with spawn/wait/close patterns

Phase 3 → agents/*.md:
  Per-agent role definitions with Codex-native conventions

Phase 4 → validated package:
  Structural completeness + pattern compliance + quality score
```

## TodoWrite Pattern

```
Phase starts:
  → Sub-tasks ATTACHED to TodoWrite (in_progress + pending)
  → Designer executes sub-tasks sequentially

Phase ends:
  → Sub-tasks COLLAPSED back to high-level summary (completed)
  → Next phase begins
```

## Interactive Preference Collection

Collect preferences via AskUserQuestion before dispatching to phases:

```javascript
const prefResponse = AskUserQuestion({
  questions: [
    {
      question: "What is the output mode for this Codex skill?",
      header: "Output Mode",
      multiSelect: false,
      options: [
        { label: "Structured Package (Recommended)", description: "Multi-file: orchestrator.md + agents/*.md + phases/*.md" },
        { label: "Single Prompt", description: "Self-contained ~/.codex/prompts/{name}.md" }
      ]
    },
    {
      question: "What is the input source?",
      header: "Input Source",
      multiSelect: false,
      options: [
        { label: "Text Description", description: "Describe the desired Codex skill in natural language" },
        { label: "Claude Skill (Convert)", description: "Convert existing .claude/skills/ to Codex-native" },
        { label: "Requirements Doc", description: "Structured requirements file" },
        { label: "Existing Codex Prompt", description: "Refactor/enhance existing ~/.codex/prompts/" }
      ]
    }
  ]
})

const workflowPreferences = {
  outputMode: prefResponse["Output Mode"].includes("Structured") ? "structured" : "single",
  inputSource: prefResponse["Input Source"]
}
```

## Specification Documents

Read specs on-demand for pattern guidance:

| Spec | Document | Purpose |
|------|----------|---------|
| Agent Patterns | [specs/codex-agent-patterns.md](specs/codex-agent-patterns.md) | Core Codex subagent API patterns |
| Conversion Rules | [specs/conversion-rules.md](specs/conversion-rules.md) | Claude → Codex mapping rules |
| Quality Standards | [specs/quality-standards.md](specs/quality-standards.md) | Quality gates & validation criteria |

## Generation Templates

Apply templates during generation:

| Template | Document | Purpose |
|----------|----------|---------|
| Orchestrator | [templates/orchestrator-template.md](templates/orchestrator-template.md) | Codex orchestrator output template |
| Agent Role | [templates/agent-role-template.md](templates/agent-role-template.md) | Agent role definition template |
| Command Patterns | [templates/command-pattern-template.md](templates/command-pattern-template.md) | Pre-built Codex command patterns |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Source Claude skill has unsupported patterns | Log warning, provide manual conversion guidance |
| Agent role file path conflict | Append skill-name prefix to agent file |
| Output directory exists | Ask user: overwrite or new name |
| Validation score < 70% | Block delivery, report issues |

## Post-Phase Updates

After each phase, update accumulated state:

```javascript
// After Phase 1
codexSkillConfig = { ...requirements analysis output }

// After Phase 2
generatedFiles.orchestrator = "path/to/orchestrator.md"

// After Phase 3
generatedFiles.agents = ["path/to/agent1.md", "path/to/agent2.md"]
generatedFiles.phases = ["path/to/phase1.md"]  // optional

// After Phase 4
validationResult = { score, issues, passed }
```

## Coordinator Checklist

### Pre-Phase Actions
- [ ] Verify input source exists and is readable
- [ ] Collect preferences via AskUserQuestion
- [ ] Read relevant specs based on input source

### Post-Phase Actions
- [ ] Verify phase output completeness
- [ ] Update TodoWrite status
- [ ] Pass accumulated state to next phase

### Final Delivery
- [ ] All generated files written to target directory
- [ ] Deployment instructions provided
- [ ] Agent files include `~/.codex/agents/` deployment paths
