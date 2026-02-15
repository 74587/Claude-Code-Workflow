# Phase 2: Orchestrator Design

Generate the main Codex orchestrator document using codexSkillConfig.

## Objective

- Generate orchestrator.md (structured mode) or {skill-name}.md (single mode)
- Apply Codex-native patterns: spawn_agent, wait, send_input, close_agent
- Include agent registry, phase execution, lifecycle management
- Preserve source content faithfully when converting from Claude

## Pre-Requisites

- Read `templates/orchestrator-template.md` for output structure
- Read `specs/codex-agent-patterns.md` for pattern reference
- If converting: Read `specs/conversion-rules.md` for mapping rules

## Execution

### Step 2.1: Determine Output Path

```javascript
const outputPath = codexSkillConfig.outputMode === "structured"
  ? `.codex/skills/${codexSkillConfig.name}/orchestrator.md`
  : `~/.codex/prompts/${codexSkillConfig.name}.md`
```

### Step 2.2: Generate Frontmatter

```markdown
---
name: {{skill_name}}
description: {{description}}
agents: {{agent_count}}
phases: {{phase_count}}
output_template: structured  # or "open_questions" for clarification-first
---
```

### Step 2.3: Generate Architecture Diagram

Map phases and agents to ASCII flow:

```javascript
// For parallel fan-out:
const diagram = `
┌──────────────────────────────────────────┐
│  ${codexSkillConfig.name} Orchestrator    │
└──────────────┬───────────────────────────┘
               │
   ┌───────────┼───────────┬────────────┐
   ↓           ↓           ↓            ↓
┌──────┐   ┌──────┐   ┌──────┐    ┌──────┐
│Agent1│   │Agent2│   │Agent3│    │AgentN│
│spawn │   │spawn │   │spawn │    │spawn │
└──┬───┘   └──┬───┘   └──┬───┘    └──┬───┘
   └──────────┼───────────┘           │
              ↓                       │
        batch wait({ids})  ←──────────┘
              ↓
        Aggregate Results
              ↓
        close_agent (all)
`
```

### Step 2.4: Generate Agent Registry

```javascript
const agentRegistry = codexSkillConfig.agents.map(agent => ({
  name: agent.name,
  role_file: agent.role_file,       // e.g., ~/.codex/agents/cli-explore-agent.md
  responsibility: agent.responsibility,
  is_new: agent.role_file.startsWith('.codex/skills/')  // skill-specific new agent
}))
```

Output as registry table in orchestrator:

```markdown
## Agent Registry

| Agent | Role File | Responsibility | Status |
|-------|-----------|----------------|--------|
{{#each agents}}
| `{{name}}` | `{{role_file}}` | {{responsibility}} | {{#if is_new}}NEW{{else}}existing{{/if}} |
{{/each}}
```

### Step 2.5: Generate Phase Execution Blocks

For each phase in codexSkillConfig.phases, generate the appropriate pattern:

**Standard Pattern** (single agent, single task):
```javascript
// Phase N: {{phase.name}}
const agentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: {{agent.role_file}} (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: {{phase.goal}}

Scope:
- 可做: {{phase.scope.include}}
- 不可做: {{phase.scope.exclude}}

Context:
{{phase.context}}

Deliverables:
- {{phase.deliverables}}

Quality bar:
- {{phase.quality_criteria}}
`
})

const result = wait({ ids: [agentId], timeout_ms: {{phase.timeout_ms || 300000}} })
close_agent({ id: agentId })
```

**Parallel Fan-out Pattern** (multiple independent agents):
```javascript
// Phase N: {{phase.name}} (Parallel)
const agentIds = {{phase.agents}}.map(agentConfig => {
  return spawn_agent({
    message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ${agentConfig.role_file} (MUST read first)
2. Read: .workflow/project-tech.json

---

Goal: ${agentConfig.specific_goal}
Scope: ${agentConfig.scope}
Deliverables: ${agentConfig.deliverables}
`
  })
})

// Batch wait for all agents
const results = wait({
  ids: agentIds,
  timeout_ms: {{phase.timeout_ms || 600000}}
})

// Handle timeout
if (results.timed_out) {
  const completed = agentIds.filter(id => results.status[id].completed)
  const pending = agentIds.filter(id => !results.status[id].completed)
  // Decision: continue waiting or use partial results
}

// Aggregate results
const aggregated = agentIds.map(id => results.status[id].completed)

// Cleanup
agentIds.forEach(id => close_agent({ id }))
```

**Deep Interaction Pattern** (multi-round with send_input):
```javascript
// Phase N: {{phase.name}} (Deep Interaction)
const agent = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: {{agent.role_file}} (MUST read first)

---

### Phase A: {{phase.initial_goal}}
Goal: {{phase.initial_goal}}
Output: Findings + Open Questions (if any)

Output format for questions:
\`\`\`
CLARIFICATION_NEEDED:
Q1: [question] | Options: [A, B, C] | Recommended: [A]
\`\`\`

### Phase B: {{phase.followup_goal}}
Trigger: Receive answers via send_input
Output: Complete deliverable
`
})

// Round 1: Initial exploration
const round1 = wait({ ids: [agent], timeout_ms: {{phase.timeout_ms || 600000}} })

// Check for clarification needs
const needsClarification = round1.status[agent].completed.includes('CLARIFICATION_NEEDED')

if (needsClarification) {
  // Collect user answers (orchestrator responsibility)
  const answers = collectUserAnswers(round1)

  // Continue interaction
  send_input({
    id: agent,
    message: `
## CLARIFICATION ANSWERS
${answers}

## NEXT STEP
Proceed with Phase B: {{phase.followup_goal}}
`
  })

  const round2 = wait({ ids: [agent], timeout_ms: {{phase.timeout_ms || 900000}} })
}

close_agent({ id: agent })
```

**Pipeline Pattern** (sequential agent chain):
```javascript
// Phase N: {{phase.name}} (Pipeline)

// Stage 1
const agent1 = spawn_agent({ message: stage1Prompt })
const result1 = wait({ ids: [agent1] })
close_agent({ id: agent1 })

// Stage 2 (uses Stage 1 output)
const agent2 = spawn_agent({
  message: `
## TASK ASSIGNMENT
...
## PREVIOUS STAGE OUTPUT
${result1.status[agent1].completed}
...
`
})
const result2 = wait({ ids: [agent2] })
close_agent({ id: agent2 })
```

### Step 2.6: Generate Lifecycle Management Section

```markdown
## Lifecycle Management

### Timeout Handling

| Timeout | Action |
|---------|--------|
| Agent completes within timeout | Process result, close_agent |
| Agent times out (partial) | Option 1: continue wait / Option 2: send_input to urge convergence / Option 3: close_agent and use partial |
| All agents timeout | Log warning, retry with extended timeout or abort |

### Cleanup Protocol

After ALL phases complete or on error:
1. Verify all agent IDs have been closed
2. Report any agents still running
3. Force close remaining agents

\`\`\`javascript
const allAgentIds = [] // accumulated during execution
allAgentIds.forEach(id => {
  try { close_agent({ id }) } catch { /* already closed */ }
})
\`\`\`
```

### Step 2.7: Write Orchestrator File

Apply template from `templates/orchestrator-template.md` with generated content.

Write the complete orchestrator to the output path.

## Output

- **File**: `{outputPath}` — generated Codex orchestrator
- **Variable**: `generatedFiles.orchestrator` = outputPath
- **TodoWrite**: Mark Phase 2 completed, Phase 3 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 3: Agent Design](03-agent-design.md).
