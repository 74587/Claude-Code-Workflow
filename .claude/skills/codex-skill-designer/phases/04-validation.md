# Phase 4: Validation & Delivery

Validate the generated Codex skill package and deliver to target location.

## Objective

- Verify structural completeness of all generated files
- Validate Codex pattern compliance (lifecycle, role loading, output format)
- Score quality against standards
- Deploy to target location with instructions

## Pre-Requisites

- Read `specs/quality-standards.md` for validation criteria
- Access `generatedFiles` from previous phases
- Access `codexSkillConfig` for expected structure

## Execution

### Step 4.1: Structural Completeness Check

```javascript
const structuralChecks = {
  // Orchestrator exists
  orchestrator: {
    exists: fileExists(generatedFiles.orchestrator),
    hasFrontmatter: checkFrontmatter(generatedFiles.orchestrator),
    hasArchitecture: checkSection(generatedFiles.orchestrator, "Architecture"),
    hasAgentRegistry: checkSection(generatedFiles.orchestrator, "Agent Registry"),
    hasPhaseExecution: checkSection(generatedFiles.orchestrator, "Phase"),
    hasLifecycleManagement: checkSection(generatedFiles.orchestrator, "Lifecycle"),
    hasTimeoutHandling: checkSection(generatedFiles.orchestrator, "Timeout"),
    passed: 0, total: 7
  },

  // Agent files exist and are well-formed
  agents: codexSkillConfig.agents.map(agent => ({
    name: agent.name,
    exists: fileExists(agent.role_file) || fileExists(generatedFiles.agents.find(f => f.includes(agent.name))),
    hasFrontmatter: checkFrontmatter(agentFile),
    hasCapabilities: checkSection(agentFile, "Core Capabilities"),
    hasExecution: checkSection(agentFile, "Execution Process"),
    hasReminders: checkSection(agentFile, "Key Reminders"),
    passed: 0, total: 5
  })),

  // Phase files (if structured mode)
  phases: generatedFiles.phases?.map(phasePath => ({
    path: phasePath,
    exists: fileExists(phasePath),
    hasAgentTable: checkSection(phasePath, "Agents Involved"),
    hasSpawnConfig: checkSection(phasePath, "spawn_agent"),
    hasWaitProcessing: checkSection(phasePath, "Wait"),
    passed: 0, total: 4
  })) || []
}

// Count passes
let totalPassed = 0, totalChecks = 0
// ... count logic
```

### Step 4.2: Codex Pattern Compliance

Verify all Codex-native patterns are correctly applied:

```javascript
const patternChecks = {
  // Lifecycle: every spawn has a close
  lifecycle: {
    spawnCount: countPattern(orchestratorContent, /spawn_agent/g),
    closeCount: countPattern(orchestratorContent, /close_agent/g),
    balanced: spawnCount <= closeCount,  // close >= spawn (batch close is OK)
    description: "Every spawn_agent must have matching close_agent"
  },

  // Role loading: MANDATORY FIRST STEPS present
  roleLoading: {
    hasPattern: orchestratorContent.includes("MANDATORY FIRST STEPS"),
    allAgentsReferenced: codexSkillConfig.agents.every(a =>
      orchestratorContent.includes(a.role_file)
    ),
    usesPathNotInline: !orchestratorContent.includes("## ROLE DEFINITION"),
    description: "Role files loaded via path reference, not inline content"
  },

  // Wait pattern: uses wait() not close_agent for results
  waitPattern: {
    usesWaitForResults: countPattern(orchestratorContent, /wait\(\s*\{/) > 0,
    noCloseForResults: !hasPatternSequence(orchestratorContent, "close_agent", "result"),
    description: "Results obtained via wait(), not close_agent"
  },

  // Batch wait: parallel agents use batch wait
  batchWait: {
    applicable: codexSkillConfig.parallelSplits?.length > 0,
    usesBatchIds: orchestratorContent.includes("ids: [") ||
                  orchestratorContent.includes("ids: agentIds"),
    description: "Parallel agents use batch wait({ ids: [...] })"
  },

  // Timeout handling: timeout_ms specified
  timeout: {
    hasTimeout: orchestratorContent.includes("timeout_ms"),
    hasTimeoutHandling: orchestratorContent.includes("timed_out"),
    description: "Timeout specified and timeout scenarios handled"
  },

  // Structured output: agents produce uniform output
  structuredOutput: {
    hasSummary: agentContents.every(c => c.includes("Summary:")),
    hasDeliverables: agentContents.every(c => c.includes("Deliverables") || c.includes("Findings")),
    description: "All agents produce structured output template"
  },

  // No Claude patterns: no Task(), no TaskOutput(), no resume
  noClaudePatterns: {
    noTask: !orchestratorContent.includes("Task("),
    noTaskOutput: !orchestratorContent.includes("TaskOutput("),
    noResume: !orchestratorContent.includes("resume:") && !orchestratorContent.includes("resume ="),
    description: "No Claude-specific patterns remain"
  }
}

const patternScore = calculatePatternScore(patternChecks)
```

### Step 4.3: Content Quality Check

```javascript
const qualityChecks = {
  // Orchestrator quality
  orchestratorQuality: {
    hasDescription: orchestratorContent.length > 500,
    hasCodeBlocks: countPattern(orchestratorContent, /```/g) >= 4,
    hasErrorHandling: orchestratorContent.includes("Error") || orchestratorContent.includes("error"),
    noPlaceholders: !orchestratorContent.includes("{{") || !orchestratorContent.includes("TODO"),
    description: "Orchestrator is complete and production-ready"
  },

  // Agent quality
  agentQuality: agentContents.map(content => ({
    hasSubstantiveContent: content.length > 300,
    hasActionableSteps: countPattern(content, /Step \d/g) >= 2,
    hasOutputFormat: content.includes("Output") || content.includes("Deliverables"),
    noPlaceholders: !content.includes("{{") || !content.includes("TODO")
  })),

  // Conversion quality (if applicable)
  conversionQuality: codexSkillConfig.conversionSource ? {
    allTasksConverted: true, // verify all Claude Task() calls are mapped
    noLostFunctionality: true, // verify no features dropped
    interactionPreserved: true  // verify resume → send_input mapping
  } : null
}

const qualityScore = calculateQualityScore(qualityChecks)
```

### Step 4.4: Quality Gate

```javascript
const overallScore = (
  structuralScore * 0.30 +
  patternScore * 0.40 +
  qualityScore * 0.30
)

const verdict = overallScore >= 80 ? "PASS" :
                overallScore >= 60 ? "REVIEW" : "FAIL"
```

| Verdict | Score | Action |
|---------|-------|--------|
| **PASS** | >= 80% | Deliver to target location |
| **REVIEW** | 60-79% | Report issues, ask user to proceed or fix |
| **FAIL** | < 60% | Block delivery, list critical issues |

### Step 4.5: Validation Report

```javascript
const validationReport = {
  skill: codexSkillConfig.name,
  outputMode: codexSkillConfig.outputMode,
  scores: {
    structural: structuralScore,
    pattern: patternScore,
    quality: qualityScore,
    overall: overallScore
  },
  verdict: verdict,
  issues: collectIssues(structuralChecks, patternChecks, qualityChecks),
  generatedFiles: generatedFiles,
  deploymentMap: deploymentMap
}
```

### Step 4.6: Delivery

If verdict is PASS or user approves REVIEW:

```javascript
// For structured mode — files already in .codex/skills/{name}/
// Report deployment instructions for agent files

const deploymentInstructions = `
## Deployment Instructions

### Generated Files
${generatedFiles.orchestrator}
${generatedFiles.agents.join('\n')}
${generatedFiles.phases?.join('\n') || '(no phase files)'}

### Agent Deployment
${deploymentMap.new.map(a =>
  `Copy: ${a.sourcePath} → ${a.targetPath}`
).join('\n')}

### Existing Agents (no action needed)
${deploymentMap.existing.map(a =>
  `✓ ${a.name}: ${a.path}`
).join('\n')}

### Usage
Invoke the generated orchestrator via Codex:
- Read the orchestrator.md and follow its phase execution
- Or register as a Codex prompt in ~/.codex/prompts/

### Validation Score
Overall: ${overallScore}% (${verdict})
- Structural: ${structuralScore}%
- Pattern Compliance: ${patternScore}%
- Content Quality: ${qualityScore}%
`
```

### Step 4.7: Final Summary to User

Present:
1. Generated file list with paths
2. Validation scores
3. Deployment instructions
4. Any issues or warnings
5. Next steps (e.g., "test the skill by running the orchestrator")

## Output

- **Report**: Validation report with scores
- **Deployment**: Instructions for agent file deployment
- **TodoWrite**: Mark Phase 4 completed

## Completion

Skill package generation complete. All files written and validated.
