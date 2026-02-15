# Orchestrator Template

Template for the generated Codex orchestrator document.

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand orchestrator output structure |
| Phase 2 | Apply with skill-specific content |

---

## Template

```markdown
---
name: {{skill_name}}
description: |
  {{description}}
agents: {{agent_count}}
phases: {{phase_count}}
---

# {{skill_display_name}}

{{one_paragraph_description}}

## Architecture Overview

\`\`\`
{{architecture_diagram}}
\`\`\`

## Agent Registry

| Agent | Role File | Responsibility | New/Existing |
|-------|-----------|----------------|--------------|
{{#each agents}}
| `{{this.name}}` | `{{this.role_file}}` | {{this.responsibility}} | {{this.status}} |
{{/each}}

## Phase Execution

{{#each phases}}
### Phase {{this.index}}: {{this.name}}

{{this.description}}

{{#if this.is_parallel}}
#### Parallel Fan-out

\`\`\`javascript
// Create parallel agents
const agentIds = [
{{#each this.agents}}
  spawn_agent({
    message: \`
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: {{this.role_file}} (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: {{this.goal}}

Scope:
- Include: {{this.scope_include}}
- Exclude: {{this.scope_exclude}}

Context:
{{this.context}}

Deliverables:
{{this.deliverables}}

Quality bar:
{{this.quality_bar}}
\`
  }),
{{/each}}
]

// Batch wait
const results = wait({
  ids: agentIds,
  timeout_ms: {{this.timeout_ms}}
})

// Handle timeout
if (results.timed_out) {
  const completed = agentIds.filter(id => results.status[id]?.completed)
  const pending = agentIds.filter(id => !results.status[id]?.completed)
  // Use completed results, log pending
}

// Aggregate results
const phaseResults = agentIds.map(id => results.status[id].completed)

// Cleanup
agentIds.forEach(id => close_agent({ id }))
\`\`\`
{{/if}}

{{#if this.is_standard}}
#### Standard Execution

\`\`\`javascript
const agentId = spawn_agent({
  message: \`
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: {{this.agent.role_file}} (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: {{this.goal}}

Scope:
- Include: {{this.scope_include}}
- Exclude: {{this.scope_exclude}}

Context:
{{this.context}}

Deliverables:
{{this.deliverables}}

Quality bar:
{{this.quality_bar}}
\`
})

const result = wait({ ids: [agentId], timeout_ms: {{this.timeout_ms}} })

if (result.timed_out) {
  // Timeout handling: continue wait or urge convergence
  send_input({ id: agentId, message: "Please finalize and output current findings." })
  const retry = wait({ ids: [agentId], timeout_ms: 60000 })
}

close_agent({ id: agentId })
\`\`\`
{{/if}}

{{#if this.is_deep_interaction}}
#### Deep Interaction (Multi-round)

\`\`\`javascript
const agent = spawn_agent({
  message: \`
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: {{this.agent.role_file}} (MUST read first)

---

### Phase A: {{this.initial_goal}}
Output: Findings + Open Questions (CLARIFICATION_NEEDED format)

### Phase B: {{this.followup_goal}} (after clarification)
Output: Complete deliverable
\`
})

// Round 1: Initial exploration
const round1 = wait({ ids: [agent], timeout_ms: {{this.timeout_ms}} })

// Check for clarification needs
if (round1.status[agent].completed.includes('CLARIFICATION_NEEDED')) {
  // Parse questions, collect user answers
  const answers = collectUserAnswers(round1.status[agent].completed)

  // Round 2: Continue with answers
  send_input({
    id: agent,
    message: \`
## CLARIFICATION ANSWERS
\${answers}

## NEXT STEP
Proceed with Phase B.
\`
  })

  const round2 = wait({ ids: [agent], timeout_ms: {{this.followup_timeout_ms}} })
}

close_agent({ id: agent })
\`\`\`
{{/if}}

{{#if this.is_pipeline}}
#### Pipeline (Sequential Chain)

\`\`\`javascript
{{#each this.stages}}
// Stage {{this.index}}: {{this.name}}
const stage{{this.index}}Agent = spawn_agent({
  message: \`
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: {{this.role_file}} (MUST read first)

---

Goal: {{this.goal}}
{{#if this.previous_output}}
## PREVIOUS STAGE OUTPUT
\${stage{{this.previous_index}}Result}
{{/if}}

Deliverables: {{this.deliverables}}
\`
})

const stage{{this.index}}Result = wait({ ids: [stage{{this.index}}Agent], timeout_ms: {{this.timeout_ms}} })
close_agent({ id: stage{{this.index}}Agent })
{{/each}}
\`\`\`
{{/if}}

{{/each}}

## Result Aggregation

\`\`\`javascript
// Merge results from all phases
const finalResult = {
{{#each phases}}
  phase{{this.index}}: phase{{this.index}}Results,
{{/each}}
}

// Output summary
console.log(\`
## Skill Execution Complete

{{#each phases}}
### Phase {{this.index}}: {{this.name}}
Status: \${phase{{this.index}}Results.status}
{{/each}}
\`)
\`\`\`

## Lifecycle Management

### Timeout Handling

| Timeout Scenario | Action |
|-----------------|--------|
| Single agent timeout | send_input to urge convergence, retry wait |
| Parallel partial timeout | Use completed results if >= 70%, close pending |
| All agents timeout | Log error, abort with partial state |

### Cleanup Protocol

\`\`\`javascript
// Track all agents created during execution
const allAgentIds = []

// ... (agents added during phase execution) ...

// Final cleanup (end of orchestrator or on error)
allAgentIds.forEach(id => {
  try { close_agent({ id }) } catch { /* already closed */ }
})
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Agent produces invalid output | Retry with clarified instructions via send_input |
| Agent timeout | Urge convergence, retry, or abort |
| Missing role file | Log error, skip agent or use fallback |
| Partial results | Proceed with available data, log gaps |
```

---

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `{{skill_name}}` | codexSkillConfig.name | Skill identifier |
| `{{skill_display_name}}` | Derived from name | Human-readable title |
| `{{description}}` | codexSkillConfig.description | Skill description |
| `{{agent_count}}` | codexSkillConfig.agents.length | Number of agents |
| `{{phase_count}}` | codexSkillConfig.phases.length | Number of phases |
| `{{architecture_diagram}}` | Generated from phase/agent topology | ASCII flow diagram |
| `{{agents}}` | codexSkillConfig.agents | Array of agent configs |
| `{{phases}}` | codexSkillConfig.phases | Array of phase configs |
| `{{phases[].is_parallel}}` | phase.interaction_model === "parallel_fanout" | Boolean |
| `{{phases[].is_standard}}` | phase.interaction_model === "standard" | Boolean |
| `{{phases[].is_deep_interaction}}` | phase.interaction_model === "deep_interaction" | Boolean |
| `{{phases[].is_pipeline}}` | phase.interaction_model === "pipeline" | Boolean |
| `{{phases[].timeout_ms}}` | Phase-specific timeout | Default: 300000 |
