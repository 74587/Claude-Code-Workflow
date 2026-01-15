---
name: workflow:lite-lite-lite
description: Ultra-lightweight multi-tool analysis and direct execution. No artifacts, auto tool selection based on task analysis, user-driven iteration via AskUser.
argument-hint: "<task description>"
allowed-tools: TodoWrite(*), Task(*), AskUserQuestion(*), Read(*), Bash(*), mcp__ace-tool__search_context(*)
---

# Ultra-Lite Multi-Tool Workflow

## Quick Start

```bash
# Basic usage
/workflow:lite-lite-lite "Fix the login bug"

# Complex task
/workflow:lite-lite-lite "Refactor payment module for multi-gateway support"
```

**Core Philosophy**: Minimal friction, maximum velocity. No files, no artifacts - just analyze and execute.

## What & Why

### Core Concept

**Zero-artifact workflow**: Clarify requirements → Auto-select tools → Mixed tool analysis → User decision → Direct execution. All state in memory, all decisions via AskUser.

**vs multi-cli-plan**:
- **multi-cli-plan**: Full artifacts (IMPL_PLAN.md, plan.json, synthesis.json)
- **lite-lite-lite**: No files, direct in-memory flow, immediate execution

### Value Proposition

1. **Ultra-Fast**: No file I/O overhead, no session management
2. **Smart Selection**: Auto-select optimal tool combination based on task
3. **Interactive**: Key decisions validated via AskUser
4. **Direct**: Analysis → Execution without intermediate artifacts

## Execution Flow

```
Phase 1: Clarify Requirements
   └─ Parse input → AskUser for missing details (if needed)

Phase 2: Auto-Select Tools
   └─ Analyze task → Match to tool strengths → Confirm selection

Phase 3: Mixed Tool Analysis
   └─ Execute selected tools in parallel → Aggregate results

Phase 4: User Decision
   ├─ Present analysis summary
   ├─ AskUser: Execute / Refine / Change tools / Cancel
   └─ Loop to Phase 3 if refinement needed

Phase 5: Direct Execution
   └─ Execute solution directly (no plan files)
```

## Phase Details

### Phase 1: Clarify Requirements

**Parse Task Description**:
```javascript
// Extract intent from user input
const taskDescription = $ARGUMENTS

// Check if clarification needed
if (taskDescription.length < 20 || isAmbiguous(taskDescription)) {
  AskUserQuestion({
    questions: [{
      question: "Please provide more details: target files/modules, expected behavior, constraints?",
      header: "Details",
      options: [
        { label: "I'll provide more", description: "Add more context" },
        { label: "Continue analysis", description: "Let tools explore autonomously" }
      ],
      multiSelect: false
    }]
  })
}
```

**Quick ACE Context** (optional, for complex tasks):
```javascript
// Only if task seems to need codebase context
mcp__ace-tool__search_context({
  project_root_path: process.cwd(),
  query: `${taskDescription} implementation patterns`
})
```

### Phase 2: Auto-Select Analysis Tools

**Tool Categories**:

| Category | Source | Execution |
|----------|--------|-----------|
| **CLI Tools** | cli-tools.json | `ccw cli -p "..." --tool <name>` |
| **Sub Agents** | Task tool | `Task({ subagent_type: "...", prompt: "..." })` |

**Task Analysis Dimensions**:
```javascript
function analyzeTask(taskDescription) {
  return {
    complexity: detectComplexity(taskDescription),  // simple, medium, complex
    taskType: detectTaskType(taskDescription),      // bugfix, feature, refactor, analysis, etc.
    domain: detectDomain(taskDescription),          // frontend, backend, fullstack
    needsExecution: detectExecutionNeed(taskDescription)  // analysis-only vs needs-write
  }
}
```

**CLI Tools** (dynamically loaded from cli-tools.json):

```javascript
// Load CLI tools from config file
const cliConfig = JSON.parse(Read("~/.claude/cli-tools.json"))
const cliTools = Object.entries(cliConfig.tools)
  .filter(([_, config]) => config.enabled)
  .map(([name, config]) => ({
    name,
    type: 'cli',
    tags: config.tags || [],
    model: config.primaryModel,
    toolType: config.type  // builtin, cli-wrapper, api-endpoint
  }))
```

**Tags** (user-defined in cli-tools.json, no fixed specification):

Tags are completely user-defined. Users can create any tags that match their workflow needs.

**Config Example** (cli-tools.json):
```json
{
  "tools": {
    "gemini": {
      "enabled": true,
      "tags": ["architecture", "reasoning", "performance"],
      "primaryModel": "gemini-2.5-pro"
    },
    "codex": {
      "enabled": true,
      "tags": ["implementation", "fast"],
      "primaryModel": "gpt-5.2"
    },
    "qwen": {
      "enabled": true,
      "tags": ["implementation", "chinese", "documentation"],
      "primaryModel": "coder-model"
    }
  }
}
```

**Sub Agents** (predefined, canExecute marks execution capability):

```javascript
const agents = [
  { name: 'code-developer', type: 'agent', strength: 'Code implementation, test writing', canExecute: true },
  { name: 'Explore', type: 'agent', strength: 'Fast code exploration', canExecute: false },
  { name: 'cli-explore-agent', type: 'agent', strength: 'Dual-source deep analysis', canExecute: false },
  { name: 'cli-discuss-agent', type: 'agent', strength: 'Multi-CLI collaborative verification', canExecute: false },
  { name: 'debug-explore-agent', type: 'agent', strength: 'Hypothesis-driven debugging', canExecute: false },
  { name: 'context-search-agent', type: 'agent', strength: 'Context collection', canExecute: false },
  { name: 'test-fix-agent', type: 'agent', strength: 'Test execution and fixing', canExecute: true },
  { name: 'universal-executor', type: 'agent', strength: 'General multi-step execution', canExecute: true }
]
```

| Agent | Strengths | canExecute |
|-------|-----------|------------|
| **code-developer** | Code implementation, test writing, incremental development | ✅ |
| **Explore** | Fast code exploration, file search, pattern discovery | ❌ |
| **cli-explore-agent** | Dual-source analysis (Bash+CLI), read-only exploration | ❌ |
| **cli-discuss-agent** | Multi-CLI collaboration, cross-verification, solution synthesis | ❌ |
| **debug-explore-agent** | Hypothesis-driven debugging, NDJSON logging, iterative verification | ❌ |
| **context-search-agent** | Multi-layer file discovery, dependency analysis, conflict assessment | ❌ |
| **test-fix-agent** | Test execution, failure diagnosis, code fixing | ✅ |
| **universal-executor** | General execution, multi-domain adaptation | ✅ |

**Three-Step Selection Flow** (CLI → Mode → Agent):

```javascript
// Step 1: Present CLI options from config (multiSelect for multi-CLI modes)
function getCliDescription(cli) {
  return cli.tags.length > 0 ? cli.tags.join(', ') : cli.model || 'general'
}

const cliOptions = cliTools.map(cli => ({
  label: cli.name,
  description: getCliDescription(cli)
}))

AskUserQuestion({
  questions: [{
    question: "Select CLI tools for analysis (select 1-3 for collaboration modes)",
    header: "CLI Tools",
    options: cliOptions,
    multiSelect: true  // Allow multiple selection for collaboration modes
  }]
})
```

```javascript
// Step 2: Select Analysis Mode
const analysisModes = [
  {
    name: 'parallel',
    label: 'Parallel',
    description: 'All CLIs analyze simultaneously, aggregate results',
    minCLIs: 1,
    pattern: 'A || B || C → Aggregate'
  },
  {
    name: 'sequential',
    label: 'Sequential',
    description: 'Chain analysis: each CLI builds on previous via --resume',
    minCLIs: 2,
    pattern: 'A → B(resume A) → C(resume B)'
  },
  {
    name: 'collaborative',
    label: 'Collaborative',
    description: 'Multi-round synthesis: CLIs take turns refining analysis',
    minCLIs: 2,
    pattern: 'A → B(resume A) → A(resume B) → Synthesize'
  },
  {
    name: 'debate',
    label: 'Debate',
    description: 'Adversarial: CLI B challenges CLI A findings, A responds',
    minCLIs: 2,
    pattern: 'A(propose) → B(challenge, resume A) → A(defend, resume B)'
  },
  {
    name: 'challenge',
    label: 'Challenge',
    description: 'Stress test: CLI B finds flaws/alternatives in CLI A analysis',
    minCLIs: 2,
    pattern: 'A(analyze) → B(challenge, resume A) → Evaluate'
  }
]

// Filter modes based on selected CLI count
const availableModes = analysisModes.filter(m => selectedCLIs.length >= m.minCLIs)

AskUserQuestion({
  questions: [{
    question: "Select analysis mode",
    header: "Mode",
    options: availableModes.map(m => ({
      label: m.label,
      description: `${m.description} [${m.pattern}]`
    })),
    multiSelect: false
  }]
})
```

```javascript
// Step 3: Present Agent options for execution
const agentOptions = agents.map(agent => ({
  label: agent.name,
  description: agent.strength
}))

AskUserQuestion({
  questions: [{
    question: "Select Sub Agent for execution",
    header: "Agent",
    options: agentOptions,
    multiSelect: false
  }]
})
```

**Selection Summary**:
```javascript
console.log(`
## Selected Configuration

**CLI Tools**: ${selectedCLIs.map(c => c.name).join(' → ')}
**Analysis Mode**: ${selectedMode.label} - ${selectedMode.pattern}
**Execution Agent**: ${selectedAgent.name} - ${selectedAgent.strength}

> Mode determines how CLIs collaborate, Agent handles final execution
`)

AskUserQuestion({
  questions: [{
    question: "Confirm selection?",
    header: "Confirm",
    options: [
      { label: "Confirm and continue", description: `${selectedMode.label} mode with ${selectedCLIs.length} CLIs` },
      { label: "Re-select CLIs", description: "Choose different CLI tools" },
      { label: "Re-select Mode", description: "Choose different analysis mode" },
      { label: "Re-select Agent", description: "Choose different Sub Agent" }
    ],
    multiSelect: false
  }]
})
```

### Phase 3: Multi-Mode Analysis

**Mode-Specific Execution Patterns**:

#### Mode 1: Parallel (并行)
```javascript
// All CLIs run simultaneously, no resume dependency
async function executeParallel(clis, taskDescription) {
  const promises = clis.map(cli => Bash({
    command: `ccw cli -p "
PURPOSE: Analyze and provide solution for: ${taskDescription}
TASK: • Identify affected files • Analyze implementation approach • List specific changes needed
MODE: analysis
CONTEXT: @**/*
EXPECTED: Concise analysis with: 1) Root cause/approach 2) Files to modify 3) Key changes 4) Risks
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) | Focus on actionable insights
" --tool ${cli.name} --mode analysis`,
    run_in_background: true
  }))

  return await Promise.all(promises)
}
```

#### Mode 2: Sequential (串联)
```javascript
// Chain analysis: each CLI builds on previous via --resume
async function executeSequential(clis, taskDescription) {
  const results = []
  let previousSessionId = null

  for (const cli of clis) {
    const resumeFlag = previousSessionId ? `--resume ${previousSessionId}` : ''

    const result = await Bash({
      command: `ccw cli -p "
PURPOSE: ${previousSessionId ? 'Build on previous analysis and deepen' : 'Initial analysis'}: ${taskDescription}
TASK: • ${previousSessionId ? 'Review previous findings • Extend analysis • Add new insights' : 'Identify affected files • Analyze implementation approach'}
MODE: analysis
CONTEXT: @**/*
EXPECTED: ${previousSessionId ? 'Extended analysis building on previous findings' : 'Initial analysis with root cause and approach'}
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) | ${previousSessionId ? 'Build incrementally, avoid repetition' : 'Focus on actionable insights'}
" --tool ${cli.name} --mode analysis ${resumeFlag}`,
      run_in_background: false
    })

    results.push(result)
    previousSessionId = extractSessionId(result)  // Extract session ID for next iteration
  }

  return results
}
```

#### Mode 3: Collaborative (协同)
```javascript
// Multi-round synthesis: CLIs take turns refining analysis
async function executeCollaborative(clis, taskDescription, rounds = 2) {
  const results = []
  let previousSessionId = null

  for (let round = 0; round < rounds; round++) {
    for (const cli of clis) {
      const resumeFlag = previousSessionId ? `--resume ${previousSessionId}` : ''
      const roundContext = round === 0 ? 'Initial analysis' : `Round ${round + 1}: Refine and synthesize`

      const result = await Bash({
        command: `ccw cli -p "
PURPOSE: ${roundContext} for: ${taskDescription}
TASK: • ${round === 0 ? 'Initial analysis of the problem' : 'Review previous analysis • Identify gaps • Add complementary insights • Synthesize findings'}
MODE: analysis
CONTEXT: @**/*
EXPECTED: ${round === 0 ? 'Foundational analysis' : 'Refined synthesis with new perspectives'}
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) | ${round === 0 ? 'Be thorough' : 'Build collaboratively, add value not repetition'}
" --tool ${cli.name} --mode analysis ${resumeFlag}`,
        run_in_background: false
      })

      results.push({ cli: cli.name, round, result })
      previousSessionId = extractSessionId(result)
    }
  }

  return results
}
```

#### Mode 4: Debate (辩论)
```javascript
// Adversarial: CLI B challenges CLI A findings, A responds
async function executeDebate(clis, taskDescription) {
  const [cliA, cliB] = clis
  const results = []

  // Step 1: CLI A proposes initial analysis
  const proposeResult = await Bash({
    command: `ccw cli -p "
PURPOSE: Propose comprehensive analysis for: ${taskDescription}
TASK: • Analyze problem thoroughly • Propose solution approach • Identify implementation details • State assumptions clearly
MODE: analysis
CONTEXT: @**/*
EXPECTED: Well-reasoned proposal with clear assumptions and trade-offs stated
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) | Be clear about assumptions and trade-offs
" --tool ${cliA.name} --mode analysis`,
    run_in_background: false
  })
  results.push({ phase: 'propose', cli: cliA.name, result: proposeResult })
  const proposeSessionId = extractSessionId(proposeResult)

  // Step 2: CLI B challenges the proposal
  const challengeResult = await Bash({
    command: `ccw cli -p "
PURPOSE: Challenge and stress-test the previous analysis for: ${taskDescription}
TASK: • Identify weaknesses in proposed approach • Question assumptions • Suggest alternative approaches • Highlight potential risks overlooked
MODE: analysis
CONTEXT: @**/*
EXPECTED: Constructive critique with specific counter-arguments and alternatives
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) | Be adversarial but constructive, focus on improving the solution
" --tool ${cliB.name} --mode analysis --resume ${proposeSessionId}`,
    run_in_background: false
  })
  results.push({ phase: 'challenge', cli: cliB.name, result: challengeResult })
  const challengeSessionId = extractSessionId(challengeResult)

  // Step 3: CLI A defends and refines
  const defendResult = await Bash({
    command: `ccw cli -p "
PURPOSE: Respond to challenges and refine analysis for: ${taskDescription}
TASK: • Address each challenge point • Defend valid aspects • Acknowledge valid criticisms • Propose refined solution incorporating feedback
MODE: analysis
CONTEXT: @**/*
EXPECTED: Refined proposal that addresses criticisms and incorporates valid alternatives
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) | Be open to valid criticism, synthesize best ideas
" --tool ${cliA.name} --mode analysis --resume ${challengeSessionId}`,
    run_in_background: false
  })
  results.push({ phase: 'defend', cli: cliA.name, result: defendResult })

  return results
}
```

#### Mode 5: Challenge (挑战)
```javascript
// Stress test: CLI B finds flaws/alternatives in CLI A analysis
async function executeChallenge(clis, taskDescription) {
  const [cliA, cliB] = clis
  const results = []

  // Step 1: CLI A provides initial analysis
  const analyzeResult = await Bash({
    command: `ccw cli -p "
PURPOSE: Provide comprehensive analysis for: ${taskDescription}
TASK: • Deep analysis of problem space • Propose implementation approach • List specific changes • Identify risks
MODE: analysis
CONTEXT: @**/*
EXPECTED: Thorough analysis with clear reasoning
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) | Be thorough and explicit about reasoning
" --tool ${cliA.name} --mode analysis`,
    run_in_background: false
  })
  results.push({ phase: 'analyze', cli: cliA.name, result: analyzeResult })
  const analyzeSessionId = extractSessionId(analyzeResult)

  // Step 2: CLI B challenges with focus on finding flaws
  const challengeResult = await Bash({
    command: `ccw cli -p "
PURPOSE: Stress-test and find weaknesses in the analysis for: ${taskDescription}
TASK: • Find logical flaws in reasoning • Identify missed edge cases • Propose better alternatives • Rate confidence in each criticism (High/Medium/Low)
MODE: analysis
CONTEXT: @**/*
EXPECTED: Detailed critique with severity ratings: [CRITICAL] [HIGH] [MEDIUM] [LOW] for each issue found
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/analysis-protocol.md) | Be ruthlessly critical, find every possible flaw
" --tool ${cliB.name} --mode analysis --resume ${analyzeSessionId}`,
    run_in_background: false
  })
  results.push({ phase: 'challenge', cli: cliB.name, result: challengeResult })

  return results
}
```

**Mode Router**:
```javascript
async function executeAnalysis(mode, clis, taskDescription) {
  switch (mode.name) {
    case 'parallel':
      return await executeParallel(clis, taskDescription)
    case 'sequential':
      return await executeSequential(clis, taskDescription)
    case 'collaborative':
      return await executeCollaborative(clis, taskDescription)
    case 'debate':
      return await executeDebate(clis, taskDescription)
    case 'challenge':
      return await executeChallenge(clis, taskDescription)
    default:
      return await executeParallel(clis, taskDescription)
  }
}

// Execute based on selected mode
const analysisResults = await executeAnalysis(selectedMode, selectedCLIs, taskDescription)
```

**Result Aggregation** (mode-aware):
```javascript
function aggregateResults(mode, results) {
  const base = {
    mode: mode.name,
    pattern: mode.pattern,
    tools_used: results.map(r => r.cli || 'unknown')
  }

  switch (mode.name) {
    case 'parallel':
      return {
        ...base,
        findings: results.map(r => parseOutput(r)),
        consensus: findCommonPoints(results),
        divergences: findDifferences(results)
      }

    case 'sequential':
      return {
        ...base,
        evolution: results.map((r, i) => ({ step: i + 1, analysis: parseOutput(r) })),
        finalAnalysis: parseOutput(results[results.length - 1])
      }

    case 'collaborative':
      return {
        ...base,
        rounds: groupByRound(results),
        synthesis: extractSynthesis(results[results.length - 1])
      }

    case 'debate':
      return {
        ...base,
        proposal: parseOutput(results.find(r => r.phase === 'propose')?.result),
        challenges: parseOutput(results.find(r => r.phase === 'challenge')?.result),
        resolution: parseOutput(results.find(r => r.phase === 'defend')?.result),
        confidence: calculateDebateConfidence(results)
      }

    case 'challenge':
      return {
        ...base,
        originalAnalysis: parseOutput(results.find(r => r.phase === 'analyze')?.result),
        critiques: parseCritiques(results.find(r => r.phase === 'challenge')?.result),
        riskScore: calculateRiskScore(results)
      }
  }
}

const aggregatedAnalysis = aggregateResults(selectedMode, analysisResults)
```

### Phase 4: User Decision

**Present Mode-Specific Summary**:

```javascript
function presentSummary(aggregatedAnalysis) {
  const { mode, pattern } = aggregatedAnalysis

  console.log(`
## Analysis Result Summary

**Mode**: ${mode} (${pattern})
**Tools**: ${aggregatedAnalysis.tools_used.join(' → ')}
`)

  switch (mode) {
    case 'parallel':
      console.log(`
### Consensus Points
${aggregatedAnalysis.consensus.map(c => `- ${c}`).join('\n')}

### Divergence Points
${aggregatedAnalysis.divergences.map(d => `- ${d}`).join('\n')}
`)
      break

    case 'sequential':
      console.log(`
### Analysis Evolution
${aggregatedAnalysis.evolution.map(e => `**Step ${e.step}**: ${e.analysis.summary}`).join('\n')}

### Final Analysis
${aggregatedAnalysis.finalAnalysis.summary}
`)
      break

    case 'collaborative':
      console.log(`
### Collaboration Rounds
${Object.entries(aggregatedAnalysis.rounds).map(([round, analyses]) =>
  `**Round ${round}**: ${analyses.map(a => a.cli).join(' + ')}`
).join('\n')}

### Synthesized Result
${aggregatedAnalysis.synthesis}
`)
      break

    case 'debate':
      console.log(`
### Debate Summary
**Proposal**: ${aggregatedAnalysis.proposal.summary}
**Challenges**: ${aggregatedAnalysis.challenges.points?.length || 0} points raised
**Resolution**: ${aggregatedAnalysis.resolution.summary}
**Confidence**: ${aggregatedAnalysis.confidence}%
`)
      break

    case 'challenge':
      console.log(`
### Challenge Summary
**Original Analysis**: ${aggregatedAnalysis.originalAnalysis.summary}
**Critiques Found**: ${aggregatedAnalysis.critiques.length} issues
${aggregatedAnalysis.critiques.map(c => `- [${c.severity}] ${c.description}`).join('\n')}
**Risk Score**: ${aggregatedAnalysis.riskScore}/100
`)
      break
  }
}

presentSummary(aggregatedAnalysis)
```

**Decision Options**:
```javascript
AskUserQuestion({
  questions: [{
    question: "How to proceed?",
    header: "Next Step",
    options: [
      { label: "Execute directly", description: "Implement immediately based on analysis" },
      { label: "Refine analysis", description: "Provide more constraints, re-analyze" },
      { label: "Change tools", description: "Select different tool combination" },
      { label: "Cancel", description: "End current workflow" }
    ],
    multiSelect: false
  }]
})
```

**Routing Logic**:
- **Execute directly** → Phase 5
- **Refine analysis** → Collect feedback, return to Phase 3
- **Change tools** → Return to Phase 2
- **Cancel** → End workflow

### Phase 5: Direct Execution

**No Artifacts - Direct Implementation**:
```javascript
// Use the aggregated analysis directly
// No IMPL_PLAN.md, no plan.json, no session files

console.log("Starting direct execution based on analysis...")

// Execution-capable agents (canExecute: true)
const executionAgents = agents.filter(a => a.canExecute)

// Select execution tool: prefer execution-capable agent, fallback to CLI
const executionTool = selectedTools.find(t =>
  t.type === 'agent' && executionAgents.some(ea => ea.name === t.name)
) || selectedTools.find(t => t.type === 'cli')

if (executionTool.type === 'agent') {
  // Use Agent for execution (preferred if available)
  Task({
    subagent_type: executionTool.name,
    run_in_background: false,
    description: `Execute: ${taskDescription.slice(0, 30)}`,
    prompt: `
## Task
${taskDescription}

## Analysis Results (from previous tools)
${JSON.stringify(aggregatedAnalysis, null, 2)}

## Instructions
Based on the analysis above, implement the solution:
1. Apply changes to identified files
2. Follow the recommended approach
3. Handle identified risks
4. Verify changes work correctly
`
  })
} else {
  // Use CLI with write mode
  Bash({
    command: `ccw cli -p "
PURPOSE: Implement the solution based on analysis: ${taskDescription}
TASK: ${extractedTasks.join(' • ')}
MODE: write
CONTEXT: @${affectedFiles.join(' @')}
EXPECTED: Working implementation with all changes applied
RULES: $(cat ~/.claude/workflows/cli-templates/protocols/write-protocol.md) | Apply analysis findings directly
" --tool ${executionTool.name} --mode write`,
    run_in_background: false
  })
}
```

## TodoWrite Structure

```javascript
TodoWrite({ todos: [
  { content: "Phase 1: Clarify requirements", status: "in_progress", activeForm: "Clarifying requirements" },
  { content: "Phase 2: Auto-select tools", status: "pending", activeForm: "Analyzing task" },
  { content: "Phase 3: Mixed tool analysis", status: "pending", activeForm: "Running analysis" },
  { content: "Phase 4: User decision", status: "pending", activeForm: "Awaiting decision" },
  { content: "Phase 5: Direct execution", status: "pending", activeForm: "Executing implementation" }
]})
```

## Iteration Patterns

### Pattern A: Direct Path (Most Common)
```
Phase 1 → Phase 2 (auto) → Phase 3 → Phase 4 (execute) → Phase 5
```

### Pattern B: Refinement Loop
```
Phase 3 → Phase 4 (refine) → Phase 3 → Phase 4 → Phase 5
```

### Pattern C: Tool Adjustment
```
Phase 2 (adjust) → Phase 3 → Phase 4 → Phase 5
```

## Error Handling

| Error | Resolution |
|-------|------------|
| CLI timeout | Retry with secondary model |
| No enabled tools | Load cli-tools.json, ask user to enable tools |
| Task type unclear | Default to first available CLI + code-developer |
| Ambiguous task | Force clarification via AskUser |
| Execution fails | Present error, ask user for direction |

## Analysis Modes Reference

| Mode | Pattern | Use Case | CLI Count |
|------|---------|----------|-----------|
| **Parallel** | `A \|\| B \|\| C → Aggregate` | Fast multi-perspective analysis | 1+ |
| **Sequential** | `A → B(resume) → C(resume)` | Deep incremental analysis | 2+ |
| **Collaborative** | `A → B → A → B → Synthesize` | Multi-round refinement | 2+ |
| **Debate** | `A(propose) → B(challenge) → A(defend)` | Stress-test solutions | 2 |
| **Challenge** | `A(analyze) → B(challenge)` | Find flaws and risks | 2 |

## Comparison

| Aspect | lite-lite-lite | multi-cli-plan |
|--------|----------------|----------------|
| **Artifacts** | None | IMPL_PLAN.md, plan.json, synthesis.json |
| **Session** | Stateless (uses --resume for chaining) | Persistent session folder |
| **Tool Selection** | Multi-CLI + Agent via 3-step selection | Config-driven with fixed tools |
| **Analysis Modes** | 5 modes (parallel/sequential/collaborative/debate/challenge) | Fixed synthesis rounds |
| **CLI Collaboration** | Auto --resume chaining | Manual session management |
| **Iteration** | Via AskUser | Via rounds/synthesis |
| **Execution** | Direct | Via lite-execute |
| **Best For** | Quick analysis, adversarial validation, rapid iteration | Complex multi-step implementations |

## Best Practices

1. **Be Specific**: Clear task description improves auto-selection accuracy
2. **Trust Auto-Selection**: Algorithm matches task type to tool strengths
3. **Adjust When Needed**: Use "Adjust tools" if auto-selection doesn't fit
4. **Trust Consensus**: When tools agree, confidence is high
5. **Iterate Fast**: Use refinement loop for complex requirements
6. **Direct is Fast**: Skip artifacts when task is straightforward

## Related Commands

```bash
# Full planning workflow
/workflow:multi-cli-plan "complex task"

# Single CLI planning
/workflow:lite-plan "task"

# Direct execution
/workflow:lite-execute --in-memory
```
