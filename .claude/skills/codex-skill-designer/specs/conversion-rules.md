# Claude → Codex Conversion Rules

Comprehensive mapping rules for converting Claude Code skills to Codex-native skills.

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 1 | Reference when analyzing Claude source skill |
| Phase 2 | Apply when generating Codex orchestrator |
| Phase 3 | Apply when converting agent definitions |

---

## 1. API Mapping

### 1.1 Core API Conversion

| Claude Pattern | Codex Equivalent | Notes |
|----------------|-----------------|-------|
| `Task({ subagent_type, prompt })` | `spawn_agent({ message })` + `wait()` | Split create and result retrieval |
| `Task({ run_in_background: false })` | `spawn_agent()` + immediate `wait()` | Synchronous equivalent |
| `Task({ run_in_background: true })` | `spawn_agent()` (wait later) | Deferred wait |
| `Task({ resume: agentId })` | `send_input({ id: agentId })` | Agent must not be closed |
| `TaskOutput({ task_id, block: true })` | `wait({ ids: [id] })` | Blocking wait |
| `TaskOutput({ task_id, block: false })` | `wait({ ids: [id], timeout_ms: 1000 })` | Polling with short timeout |
| Agent auto-cleanup | `close_agent({ id })` | Must be explicit |

### 1.2 Parallel Task Conversion

**Claude**:
```javascript
// Multiple Task() calls in single message (parallel)
const result1 = Task({ subagent_type: "agent-a", prompt: promptA })
const result2 = Task({ subagent_type: "agent-b", prompt: promptB })
const result3 = Task({ subagent_type: "agent-c", prompt: promptC })
```

**Codex**:
```javascript
// Explicit parallel: spawn all, then batch wait
const idA = spawn_agent({ message: promptA_with_role })
const idB = spawn_agent({ message: promptB_with_role })
const idC = spawn_agent({ message: promptC_with_role })

const results = wait({ ids: [idA, idB, idC], timeout_ms: 600000 })

// Process results
const resultA = results.status[idA].completed
const resultB = results.status[idB].completed
const resultC = results.status[idC].completed

// Cleanup
;[idA, idB, idC].forEach(id => close_agent({ id }))
```

### 1.3 Resume/Continue Conversion

**Claude**:
```javascript
// Resume a previous agent
Task({ subagent_type: "agent-a", resume: previousAgentId, prompt: "Continue..." })
```

**Codex**:
```javascript
// send_input to continue (agent must still be alive)
send_input({
  id: previousAgentId,
  message: "Continue..."
})
const continued = wait({ ids: [previousAgentId] })
```

### 1.4 TaskOutput Polling Conversion

**Claude**:
```javascript
while (!done) {
  const output = TaskOutput({ task_id: id, block: false })
  if (output.status === 'completed') done = true
  sleep(1000)
}
```

**Codex**:
```javascript
let result = wait({ ids: [id], timeout_ms: 30000 })
while (result.timed_out) {
  result = wait({ ids: [id], timeout_ms: 30000 })
}
```

## 2. Role Loading Conversion

### 2.1 subagent_type → MANDATORY FIRST STEPS

**Claude**: Role automatically loaded via `subagent_type` parameter.

**Codex**: Role must be explicitly loaded by agent as first action.

**Conversion**:
```javascript
// Claude
Task({
  subagent_type: "cli-explore-agent",
  prompt: "Explore the codebase for authentication patterns"
})

// Codex
spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: Explore the codebase for authentication patterns
Deliverables: Structured findings following output template
`
})
```

### 2.2 Role Mapping Table

| Claude subagent_type | Codex Role Path |
|----------------------|-----------------|
| `Explore` | `~/.codex/agents/cli-explore-agent.md` |
| `Plan` | `~/.codex/agents/cli-lite-planning-agent.md` |
| `code-developer` | `~/.codex/agents/code-developer.md` |
| `context-search-agent` | `~/.codex/agents/context-search-agent.md` |
| `debug-explore-agent` | `~/.codex/agents/debug-explore-agent.md` |
| `doc-generator` | `~/.codex/agents/doc-generator.md` |
| `action-planning-agent` | `~/.codex/agents/action-planning-agent.md` |
| `test-fix-agent` | `~/.codex/agents/test-fix-agent.md` |
| `universal-executor` | `~/.codex/agents/universal-executor.md` |
| `tdd-developer` | `~/.codex/agents/tdd-developer.md` |
| `general-purpose` | `~/.codex/agents/universal-executor.md` |
| `Bash` | Direct shell execution (no agent needed) |
| `haiku` / `sonnet` / `opus` | Model selection via agent_type parameter |

## 3. Structural Conversion

### 3.1 SKILL.md → orchestrator.md

| Claude SKILL.md Section | Codex orchestrator.md Section |
|--------------------------|-------------------------------|
| Frontmatter (name, description, allowed-tools) | Frontmatter (name, description, agents, phases) |
| Architecture Overview | Architecture Overview (spawn/wait/close flow) |
| Execution Flow (Ref: markers) | Phase Execution (spawn_agent code blocks) |
| Data Flow (variables, files) | Data Flow (wait results, context passing) |
| TodoWrite Pattern | update_plan tracking (Codex convention) |
| Interactive Preference Collection | User interaction via orchestrator prompts |
| Error Handling | Timeout + Lifecycle error handling |
| Phase Reference Documents table | Agent Registry + Phase detail files |

### 3.2 Phase Files → Phase Detail or Inline

**Simple phases** (single agent, no branching): Inline in orchestrator.md

**Complex phases** (multi-agent, conditional): Separate `phases/0N-{name}.md`

### 3.3 Pattern-Level Conversion

| Claude Pattern | Codex Pattern |
|----------------|---------------|
| Orchestrator + Progressive Loading | Orchestrator + Agent Registry + on-demand phase loading |
| TodoWrite Attachment/Collapse | update_plan pending → in_progress → completed |
| Inter-Phase Data Flow (variables) | wait() result passing between phases |
| Conditional Phase Execution | if/else on wait() results |
| Direct Phase Handoff (Read phase doc) | Inline execution or separate phase files |
| AskUserQuestion | Direct user interaction in orchestrator |

## 4. Content Preservation Rules

When converting Claude skills:

1. **Agent prompts**: Preserve task descriptions, goals, scope, deliverables VERBATIM
2. **Bash commands**: Preserve all shell commands unchanged
3. **Code blocks**: Preserve implementation code unchanged
4. **Validation logic**: Preserve quality checks and success criteria
5. **Error handling**: Convert to Codex timeout/lifecycle patterns, preserve intent

**Transform** (structure changes):
- `Task()` calls → `spawn_agent()` + `wait()` + `close_agent()`
- `subagent_type` → MANDATORY FIRST STEPS role path
- Synchronous returns → Explicit `wait()` calls
- Auto-cleanup → Explicit `close_agent()` calls

**Preserve** (content unchanged):
- Task descriptions and goals
- Scope definitions
- Quality criteria
- File paths and patterns
- Shell commands
- Business logic

## 5. Anti-Patterns to Avoid

| Anti-Pattern | Why | Correct Pattern |
|-------------|-----|-----------------|
| Using close_agent for results | Returns are unreliable | Use wait() for results |
| Inline role content in message | Bloats message, wastes tokens | Pass role file path in MANDATORY FIRST STEPS |
| Early close_agent before potential follow-up | Cannot resume closed agent | Delay close until certain no more interaction |
| Sequential wait for parallel agents | Wasted time | Batch wait({ ids: [...] }) |
| No timeout_ms | Indefinite hang risk | Always specify timeout_ms |
| No timed_out handling | Silent failures | Always check result.timed_out |
| Claude Task() remaining in output | Runtime incompatibility | Convert all Task() to spawn_agent |
| Claude resume: in output | Runtime incompatibility | Convert to send_input() |

## 6. Conversion Checklist

Before delivering converted skill:

- [ ] All `Task()` calls converted to `spawn_agent()` + `wait()` + `close_agent()`
- [ ] All `subagent_type` mapped to MANDATORY FIRST STEPS role paths
- [ ] All `resume` converted to `send_input()`
- [ ] All `TaskOutput` polling converted to `wait()` with timeout
- [ ] No Claude-specific patterns remain (Task, TaskOutput, resume, subagent_type)
- [ ] Timeout handling added for all `wait()` calls
- [ ] Lifecycle balanced (spawn count ≤ close count)
- [ ] Structured output template enforced for all agents
- [ ] Agent prompts/goals/scope preserved verbatim
- [ ] Error handling converted to Codex patterns
