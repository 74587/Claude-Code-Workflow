# Phase 3: Agent Design

Generate agent role definitions and optional phase execution detail files.

## Objective

- Generate agent role files for `~/.codex/agents/` or `.codex/skills/{name}/agents/`
- Apply Codex-native conventions (MANDATORY FIRST STEPS, structured output)
- Preserve source content when converting from Claude
- Generate optional phase detail files for complex orchestrations

## Pre-Requisites

- Read `templates/agent-role-template.md` for role file structure
- Read `templates/command-pattern-template.md` for pre-built command patterns
- Read `specs/codex-agent-patterns.md` for API patterns

## Execution

### Step 3.1: Identify Agents to Generate

```javascript
// From codexSkillConfig
const agentsToGenerate = codexSkillConfig.agents.filter(a =>
  a.role_file.startsWith('.codex/skills/')  // new skill-specific agents
  || codexSkillConfig.newAgentDefinitions?.includes(a.role_file)
)

// Existing agents (already in ~/.codex/agents/) — skip generation
const existingAgents = codexSkillConfig.agents.filter(a =>
  !agentsToGenerate.includes(a)
)
```

### Step 3.2: Generate Agent Role Files

For each agent to generate, apply the agent-role-template:

```javascript
for (const agent of agentsToGenerate) {
  const roleContent = applyTemplate('templates/agent-role-template.md', {
    agent_name: agent.name,
    description: agent.responsibility,
    capabilities: agent.capabilities || inferCapabilities(agent),
    execution_process: agent.workflow || inferWorkflow(agent),
    output_format: codexSkillConfig.outputTemplate || "structured",
    key_reminders: generateReminders(agent)
  })

  const outputPath = agent.role_file.startsWith('~/')
    ? agent.role_file
    : `.codex/skills/${codexSkillConfig.name}/agents/${agent.name}.md`

  Write(outputPath, roleContent)
  generatedFiles.agents.push(outputPath)
}
```

### Step 3.3: Agent Role File Content Structure

Each generated agent role file follows this structure:

```markdown
---
name: {{agent_name}}
description: |
  {{description}}
color: {{color}}
skill: {{parent_skill_name}}
---

# {{agent_display_name}}

{{description_paragraph}}

## Core Capabilities

1. **{{capability_1}}**: {{description}}
2. **{{capability_2}}**: {{description}}
3. **{{capability_3}}**: {{description}}

## Execution Process

### Step 1: Context Loading
- Read role-specific configuration files
- Load project context (.workflow/project-tech.json)
- Understand task scope from TASK ASSIGNMENT

### Step 2: {{primary_action}}
{{primary_action_detail}}

### Step 3: {{secondary_action}}
{{secondary_action_detail}}

### Step 4: Output Delivery
Produce structured output following the template:

\`\`\`text
Summary:
- {{summary_format}}

Findings:
- {{findings_format}}

Proposed changes:
- {{changes_format}}

Tests:
- {{tests_format}}

Open questions:
- {{questions_format}}
\`\`\`

## Key Reminders

**ALWAYS**:
- Read role definition file as FIRST action
- Follow structured output template
- Stay within assigned scope
- Report open questions instead of guessing

**NEVER**:
- Modify files outside assigned scope
- Skip role definition loading
- Produce unstructured output
- Make assumptions about unclear requirements
```

### Step 3.4: Conversion from Claude Agent Definitions

When converting from Claude skill, extract agent behavior from:

1. **Task() prompts**: The `prompt` parameter contains the agent's task instructions
2. **Phase files**: Phase execution detail contains the full agent interaction
3. **subagent_type**: Maps to existing `~/.codex/agents/` roles

```javascript
// For each Task() call found in Claude source
for (const taskCall of claudeConfig.agents) {
  const existingRole = roleMapping[taskCall.subagent_type]

  if (existingRole) {
    // Map to existing Codex agent — no new file needed
    // Just reference in orchestrator's MANDATORY FIRST STEPS
    codexSkillConfig.agents.push({
      name: taskCall.subagent_type,
      role_file: `~/.codex/agents/${taskCall.subagent_type}.md`,
      responsibility: taskCall.description,
      is_new: false
    })
  } else {
    // Extract agent behavior from Claude prompt and create new role
    const newRole = extractRoleFromPrompt(taskCall.prompt)
    // Generate new role file
  }
}
```

### Step 3.5: Command Pattern Selection

For agents that need specific command patterns, select from pre-built templates:

| Pattern | Use When | Template |
|---------|----------|----------|
| **Explore** | Agent needs codebase exploration | Parallel fan-out spawn_agent |
| **Analyze** | Agent performs multi-perspective analysis | Parallel spawn + merge |
| **Implement** | Agent writes code | Sequential spawn + validate |
| **Validate** | Agent runs tests | Iterative spawn + send_input fix cycle |
| **Review** | Agent reviews code/artifacts | Parallel spawn + aggregate |
| **Deep Interact** | Agent needs multi-round conversation | spawn + wait + send_input loop |
| **Two-Phase** | Agent needs clarification first | spawn(clarify) + send_input(execute) |

Read `templates/command-pattern-template.md` for full pattern implementations.

### Step 3.6: Generate Phase Detail Files (Optional)

For structured mode with complex phases, generate phase detail files:

```javascript
if (codexSkillConfig.outputMode === "structured") {
  for (const phase of codexSkillConfig.phases) {
    if (phase.complexity === "high" || phase.agents_involved.length > 2) {
      const phaseContent = generatePhaseDetail(phase, codexSkillConfig)
      const phasePath = `.codex/skills/${codexSkillConfig.name}/phases/${phase.index}-${phase.slug}.md`
      Write(phasePath, phaseContent)
      generatedFiles.phases.push(phasePath)
    }
  }
}
```

Phase detail structure:

```markdown
# Phase {{N}}: {{Phase Name}}

{{One-sentence description}}

## Agents Involved

| Agent | Role | Interaction Model |
|-------|------|-------------------|
{{#each phase.agents}}
| {{name}} | {{role_file}} | {{interaction_model}} |
{{/each}}

## Execution

### spawn_agent Configuration

\`\`\`javascript
const agent = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: {{role_file}} (MUST read first)
...

---

Goal: {{goal}}
Scope: {{scope}}
Context: {{context}}
Deliverables: {{deliverables}}
Quality bar: {{quality}}
`
})
\`\`\`

### Wait & Result Processing

\`\`\`javascript
const result = wait({ ids: [agent], timeout_ms: {{timeout}} })
// Process: {{result_processing}}
close_agent({ id: agent })
\`\`\`

## Output

- **Result**: {{output_description}}
- **Passed to**: Phase {{N+1}}
```

### Step 3.7: Deployment Mapping

Generate deployment instructions:

```javascript
const deploymentMap = {
  // Existing agents — no action needed
  existing: existingAgents.map(a => ({
    name: a.name,
    path: a.role_file,
    action: "already deployed"
  })),
  // New agents — need deployment
  new: agentsToGenerate.map(a => ({
    name: a.name,
    sourcePath: `.codex/skills/${codexSkillConfig.name}/agents/${a.name}.md`,
    targetPath: `~/.codex/agents/${a.name}.md`,
    action: "copy to ~/.codex/agents/"
  }))
}
```

## Output

- **Files**: `generatedFiles.agents[]` — agent role files
- **Files**: `generatedFiles.phases[]` — optional phase detail files
- **Variable**: `deploymentMap` — deployment instructions
- **TodoWrite**: Mark Phase 3 completed, Phase 4 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 4: Validation & Delivery](04-validation.md).
