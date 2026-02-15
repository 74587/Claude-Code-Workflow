# Phase 1: Requirements Analysis

Analyze input source and extract Codex skill configuration.

## Objective

- Parse input source (text / Claude skill / requirements doc / Codex prompt)
- Identify agents, phases, interaction patterns
- Determine output mode (structured package vs single prompt)
- Produce codexSkillConfig for downstream phases

## Pre-Requisites

Read specification documents based on input source:
- **Always**: Read `specs/codex-agent-patterns.md` for available patterns
- **Claude conversion**: Also read `specs/conversion-rules.md`
- **Quality reference**: Read `specs/quality-standards.md` for target criteria

## Execution

### Step 1.1: Input Source Detection

```javascript
// Determine input type from workflowPreferences
const inputSource = workflowPreferences.inputSource

if (inputSource.includes("Claude Skill")) {
  // Read source Claude skill
  const sourceSkillPath = AskUserQuestion({
    questions: [{
      question: "Path to the Claude skill to convert?",
      header: "Skill Path",
      multiSelect: false,
      options: [
        { label: "Browse", description: "I'll provide the path" }
      ]
    }]
  })
  // Read SKILL.md + phases/*.md from source
  const skillContent = Read(sourceSkillPath)
  const phaseFiles = Glob(`${sourceSkillDir}/phases/*.md`)
} else if (inputSource.includes("Text Description")) {
  // Collect description via user interaction
} else if (inputSource.includes("Requirements Doc")) {
  // Read requirements file
} else if (inputSource.includes("Existing Codex")) {
  // Read existing Codex prompt for refactoring
}
```

### Step 1.2: Skill Structure Extraction

For each input type, extract:

**From Text Description**:
```javascript
const codexSkillConfig = {
  name: extractSkillName(userDescription),
  description: extractDescription(userDescription),
  outputMode: workflowPreferences.outputMode,
  agents: inferAgents(userDescription),
  phases: inferPhases(userDescription),
  parallelSplits: inferParallelism(userDescription),
  interactionModel: inferInteractionModel(userDescription),
  conversionSource: null
}
```

**From Claude Skill** (conversion):
```javascript
// Parse Claude SKILL.md
const claudeConfig = {
  phases: extractPhases(skillContent),
  agents: extractTaskCalls(skillContent),       // Find Task() invocations
  dataFlow: extractDataFlow(skillContent),
  todoPattern: extractTodoPattern(skillContent),
  resumePatterns: findResumePatterns(skillContent)  // For send_input mapping
}

const codexSkillConfig = {
  name: claudeConfig.name,
  description: claudeConfig.description,
  outputMode: workflowPreferences.outputMode,
  agents: claudeConfig.agents.map(a => ({
    name: a.subagent_type,
    role_file: mapToCodexRolePath(a.subagent_type),
    responsibility: a.description,
    patterns: determinePatterns(a)
  })),
  phases: claudeConfig.phases.map(p => ({
    name: p.name,
    agents_involved: p.agentCalls.map(a => a.subagent_type),
    interaction_model: hasResume(p) ? "deep_interaction" : "standard"
  })),
  parallelSplits: detectParallelPatterns(claudeConfig),
  conversionSource: { type: "claude_skill", path: sourceSkillPath }
}
```

### Step 1.3: Agent Inventory Check

Verify agent roles exist in `~/.codex/agents/`:

```javascript
const existingAgents = Glob("~/.codex/agents/*.md")
const requiredAgents = codexSkillConfig.agents.map(a => a.role_file)

const missingAgents = requiredAgents.filter(r =>
  !existingAgents.includes(r)
)

if (missingAgents.length > 0) {
  // Mark as "needs new agent role definition"
  codexSkillConfig.newAgentDefinitions = missingAgents
}
```

### Step 1.4: Interaction Model Selection

Based on agent relationships, select interaction patterns:

| Pattern | Condition | Result |
|---------|-----------|--------|
| **Standard** | Single agent, single task | `spawn → wait → close` |
| **Parallel Fan-out** | Multiple independent agents | `spawn[] → batch wait → close[]` |
| **Deep Interaction** | Multi-phase with context | `spawn → wait → send_input → wait → close` |
| **Two-Phase** | Needs clarification first | `spawn(clarify) → wait → send_input(answers) → wait → close` |
| **Pipeline** | Sequential agent chain | `spawn(A) → wait → spawn(B, with A result) → wait → close` |

```javascript
codexSkillConfig.phases.forEach(phase => {
  if (phase.agents_involved.length > 1) {
    phase.interaction_model = "parallel_fanout"
  } else if (phase.interaction_model === "deep_interaction") {
    // Already set from resume pattern detection
  } else {
    phase.interaction_model = "standard"
  }
})
```

### Step 1.5: User Confirmation

Present extracted configuration for user review:

```javascript
AskUserQuestion({
  questions: [{
    question: `Skill "${codexSkillConfig.name}" will have ${codexSkillConfig.agents.length} agent(s) and ${codexSkillConfig.phases.length} phase(s). ${codexSkillConfig.newAgentDefinitions?.length || 0} new agent definitions needed. Proceed?`,
    header: "Confirm",
    multiSelect: false,
    options: [
      { label: "Proceed", description: "Generate Codex skill package" },
      { label: "Adjust", description: "Modify configuration first" }
    ]
  }]
})
```

## Output

- **Variable**: `codexSkillConfig` — complete skill configuration
- **TodoWrite**: Mark Phase 1 completed, Phase 2 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 2: Orchestrator Design](02-orchestrator-design.md).
