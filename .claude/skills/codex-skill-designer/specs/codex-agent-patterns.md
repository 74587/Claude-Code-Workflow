# Codex Agent Patterns

Core Codex subagent API patterns reference for skill generation.

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand available Codex patterns |
| Phase 2 | Reference when generating orchestrator patterns |
| Phase 3 | Reference when designing agent interactions |

---

## 1. API Reference

### 1.1 spawn_agent

Creates a new subagent with independent context.

```javascript
const agentId = spawn_agent({
  message: "task message",   // Required: task assignment
  agent_type: "type"         // Optional: preset baseline
})
// Returns: agent_id (string)
```

**Key Facts**:
- Each agent has isolated context (no shared state)
- `agent_type` selects preset behavior baseline
- Role definition must be loaded via MANDATORY FIRST STEPS
- Returns immediately — use `wait()` for results

### 1.2 wait

Retrieves results from one or more agents.

```javascript
const result = wait({
  ids: [agentId1, agentId2],  // Required: agent IDs to wait for
  timeout_ms: 300000           // Optional: max wait time (ms)
})
// Returns: { timed_out: boolean, status: { [id]: { completed: string } } }
```

**Key Facts**:
- Primary result retrieval method (NOT close_agent)
- Supports batch wait for multiple agents
- `timed_out: true` means some agents haven't finished — can re-wait
- Can be called multiple times on same agent

### 1.3 send_input

Continues interaction with an active agent.

```javascript
send_input({
  id: agentId,          // Required: target agent
  message: "follow-up", // Required: continuation message
  interrupt: false       // Optional: interrupt current processing
})
```

**Key Facts**:
- Agent must NOT be closed
- Preserves full conversation context
- Use for: clarification answers, phase transitions, iterative refinement
- `interrupt: true` — use with caution (stops current processing)

### 1.4 close_agent

Permanently terminates an agent.

```javascript
close_agent({ id: agentId })
```

**Key Facts**:
- Irreversible — no further wait/send_input possible
- Do NOT use to retrieve results (use wait instead)
- Delay until certain no more interaction needed
- Call for ALL agents at end of workflow (cleanup)

## 2. Interaction Patterns

### 2.1 Standard (Single Agent, Single Task)

```
spawn_agent → wait → close_agent
```

**Use When**: Simple, one-shot tasks with clear deliverables.

```javascript
const agent = spawn_agent({ message: taskPrompt })
const result = wait({ ids: [agent], timeout_ms: 300000 })
close_agent({ id: agent })
```

### 2.2 Parallel Fan-out (Multiple Independent Agents)

```
spawn_agent × N → batch wait({ ids: [...] }) → close_agent × N
```

**Use When**: Multiple independent tasks that can run concurrently.

```javascript
const agents = tasks.map(t => spawn_agent({ message: buildPrompt(t) }))
const results = wait({ ids: agents, timeout_ms: 600000 })
// Aggregate results
const merged = agents.map(id => results.status[id].completed)
// Cleanup all
agents.forEach(id => close_agent({ id }))
```

**Split Strategies**:

| Strategy | Description | Example |
|----------|-------------|---------|
| By responsibility | Each agent has different role | Research / Plan / Test |
| By module | Each agent handles different code area | auth / api / database |
| By perspective | Each agent analyzes from different angle | security / performance / maintainability |

### 2.3 Deep Interaction (Multi-round with send_input)

```
spawn_agent → wait (round 1) → send_input → wait (round 2) → ... → close_agent
```

**Use When**: Tasks needing iterative refinement or multi-phase execution within single agent context.

```javascript
const agent = spawn_agent({ message: initialPrompt })

// Round 1
const r1 = wait({ ids: [agent], timeout_ms: 300000 })

// Round 2 (refine based on r1)
send_input({ id: agent, message: refinementPrompt })
const r2 = wait({ ids: [agent], timeout_ms: 300000 })

// Round 3 (finalize)
send_input({ id: agent, message: finalizationPrompt })
const r3 = wait({ ids: [agent], timeout_ms: 300000 })

close_agent({ id: agent })
```

### 2.4 Two-Phase (Clarify → Execute)

```
spawn_agent → wait (questions) → send_input (answers) → wait (solution) → close_agent
```

**Use When**: Complex tasks where requirements need clarification before execution.

```javascript
const agent = spawn_agent({
  message: `
## TASK ASSIGNMENT
...
### Phase A: Exploration & Clarification
Output findings + Open Questions (CLARIFICATION_NEEDED format)

### Phase B: Full Solution (after receiving answers)
Output complete deliverable
`
})

// Phase A
const exploration = wait({ ids: [agent], timeout_ms: 600000 })

if (exploration.status[agent].completed.includes('CLARIFICATION_NEEDED')) {
  // Collect answers
  const answers = getUserAnswers(exploration)

  // Phase B
  send_input({
    id: agent,
    message: `## CLARIFICATION ANSWERS\n${answers}\n\n## PROCEED\nGenerate full solution.`
  })
  const solution = wait({ ids: [agent], timeout_ms: 900000 })
}

close_agent({ id: agent })
```

### 2.5 Pipeline (Sequential Agent Chain)

```
spawn(A) → wait(A) → close(A) → spawn(B, with A's output) → wait(B) → close(B)
```

**Use When**: Tasks where each stage depends on the previous stage's output.

```javascript
// Stage 1: Research
const researcher = spawn_agent({ message: researchPrompt })
const research = wait({ ids: [researcher] })
close_agent({ id: researcher })

// Stage 2: Plan (uses research output)
const planner = spawn_agent({
  message: `${planPrompt}\n\n## RESEARCH CONTEXT\n${research.status[researcher].completed}`
})
const plan = wait({ ids: [planner] })
close_agent({ id: planner })

// Stage 3: Execute (uses plan output)
const executor = spawn_agent({
  message: `${executePrompt}\n\n## PLAN\n${plan.status[planner].completed}`
})
const execution = wait({ ids: [executor] })
close_agent({ id: executor })
```

### 2.6 Merged Exploration (Explore + Clarify + Plan in Single Agent)

```
spawn(dual-role) → wait(explore) → send_input(clarify) → wait(plan) → close
```

**Use When**: Exploration and planning are tightly coupled and benefit from shared context.

**Advantages over Pipeline**:
- 60-80% fewer agent creations
- No context loss between phases
- Higher result consistency

```javascript
const agent = spawn_agent({
  message: `
## DUAL ROLE ASSIGNMENT

### Role A: Explorer
Explore codebase, identify patterns, generate questions

### Role B: Planner (activated after clarification)
Generate implementation plan based on exploration + answers

### Phase 1: Explore
Output: Findings + CLARIFICATION_NEEDED questions

### Phase 2: Plan (triggered by send_input)
Output: plan.json
`
})

const explore = wait({ ids: [agent] })
// ... handle clarification ...
send_input({ id: agent, message: answers })
const plan = wait({ ids: [agent] })
close_agent({ id: agent })
```

## 3. Message Design

### 3.1 TASK ASSIGNMENT Structure

```text
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/{agent-type}.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: One-sentence objective

Scope:
- Include: allowed operations
- Exclude: forbidden operations
- Directory: target paths
- Dependencies: dependency constraints

Context:
- Key paths: relevant file paths
- Current state: system status
- Constraints: must-follow rules

Deliverables:
- Output structured following template

Quality bar:
- Criterion 1
- Criterion 2
```

### 3.2 Structured Output Template

```text
Summary:
- One-sentence completion status

Findings:
- Finding 1: description
- Finding 2: description

Proposed changes:
- File: path/to/file
- Change: modification detail
- Risk: impact assessment

Tests:
- Test cases needed
- Commands to run

Open questions:
1. Unresolved question 1
2. Unresolved question 2
```

### 3.3 Clarification Format

```text
CLARIFICATION_NEEDED:
Q1: [question] | Options: [A, B, C] | Recommended: [A]
Q2: [question] | Options: [A, B] | Recommended: [B]
```

## 4. Error Handling

### 4.1 Timeout

```javascript
const result = wait({ ids: [agent], timeout_ms: 30000 })
if (result.timed_out) {
  // Option 1: Continue waiting
  const retry = wait({ ids: [agent], timeout_ms: 60000 })

  // Option 2: Urge convergence
  send_input({ id: agent, message: "Please wrap up and output current findings." })
  const urged = wait({ ids: [agent], timeout_ms: 30000 })

  // Option 3: Abort
  close_agent({ id: agent })
}
```

### 4.2 Agent Recovery (post close_agent)

```javascript
// Cannot recover closed agent — must recreate
const newAgent = spawn_agent({
  message: `${originalPrompt}\n\n## PREVIOUS ATTEMPT OUTPUT\n${previousOutput}`
})
```

### 4.3 Partial Results (parallel fan-out)

```javascript
const results = wait({ ids: agents, timeout_ms: 300000 })
const completed = agents.filter(id => results.status[id]?.completed)
const pending = agents.filter(id => !results.status[id]?.completed)

if (completed.length >= Math.ceil(agents.length * 0.7)) {
  // 70%+ complete — proceed with partial results
  pending.forEach(id => close_agent({ id }))
}
```

## 5. Role Loading

### 5.1 Path Reference Pattern (Recommended)

```javascript
spawn_agent({
  message: `
### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/${agentType}.md (MUST read first)
...
`
})
```

**Why**: Keeps message lean, agent loads its own role context.

### 5.2 Role Mapping

| Agent Type | Role File |
|------------|-----------|
| cli-explore-agent | ~/.codex/agents/cli-explore-agent.md |
| cli-lite-planning-agent | ~/.codex/agents/cli-lite-planning-agent.md |
| code-developer | ~/.codex/agents/code-developer.md |
| context-search-agent | ~/.codex/agents/context-search-agent.md |
| debug-explore-agent | ~/.codex/agents/debug-explore-agent.md |
| doc-generator | ~/.codex/agents/doc-generator.md |
| action-planning-agent | ~/.codex/agents/action-planning-agent.md |
| test-fix-agent | ~/.codex/agents/test-fix-agent.md |
| universal-executor | ~/.codex/agents/universal-executor.md |
| tdd-developer | ~/.codex/agents/tdd-developer.md |
| ui-design-agent | ~/.codex/agents/ui-design-agent.md |

## 6. Design Principles

1. **Delay close_agent**: Only close when certain no more interaction needed
2. **Batch wait over sequential**: Use `wait({ ids: [...] })` for parallel agents
3. **Merge phases when context-dependent**: Use send_input over new agents
4. **Structured output always**: Enforce uniform output template
5. **Minimal message size**: Pass role file paths, not inline content
6. **Explicit lifecycle**: Every spawn must have a close (balanced)
7. **Timeout handling**: Always specify timeout_ms, always handle timed_out
