---
name: workflow:multi-cli-plan
description: Multi-CLI collaborative planning workflow using ACE semantic search and iterative Claude+Codex analysis to determine execution plan. Features user-driven decision points and convergent refinement.
argument-hint: "<task description> [--max-rounds=3] [--tools=gemini,codex]"
allowed-tools: TodoWrite(*), Task(*), AskUserQuestion(*), Read(*), Bash(*), Glob(*), Grep(*), mcp__ace-tool__search_context(*)
---

# Multi-CLI Collaborative Planning Command (/workflow:multi-cli-plan)

## Overview

Multi-CLI collaborative planning workflow that uses ACE semantic search for context gathering, followed by iterative multi-tool analysis (Claude + Codex/Gemini) to converge on an optimal execution plan.

**Core Philosophy**:
- **Multi-round Verification**: Claude and Codex alternate analysis to ensure solutions match codebase reality
- **User-driven**: Every analysis round ends with user decision point
- **Iterative Convergence**: Multiple cycles progressively refine requirements and solutions
- **Final Confirmation**: Executable plan only output after explicit user approval

**Core Capabilities**:
- ACE semantic search for comprehensive codebase context
- Multi-tool collaborative analysis (Claude + Gemini/Codex)
- Interactive refinement with user feedback loops
- Solution comparison with trade-off analysis
- Final executable plan with file locations and acceptance criteria

## Usage

```bash
/workflow:multi-cli-plan <task-description>

# With options
/workflow:multi-cli-plan "Implement user authentication" --max-rounds=3
/workflow:multi-cli-plan "Refactor payment module" --tools=gemini,codex

# Examples
/workflow:multi-cli-plan "Add dark mode support to the application"
/workflow:multi-cli-plan "Fix the memory leak in WebSocket connections"
/workflow:multi-cli-plan "Implement rate limiting for API endpoints"
```

## Execution Flow

```
Phase 1: Input & Context Gathering
   |-- Parse user task description
   |-- ACE semantic search for codebase context
   |-- Build initial context package
   +-- Initialize discussion session

Phase 2: Multi-CLI Collaborative Analysis (Iterative)
   |-- Round N:
   |   |-- Claude Analysis: Architecture perspective
   |   |-- Codex/Gemini Analysis: Implementation perspective
   |   |-- Cross-verify technical feasibility
   |   +-- Synthesize multiple implementation approaches
   |
   +-- Loop until convergence or max rounds

Phase 3: Stage Summary & Options
   |-- Present 2-3 viable solution options with trade-offs
   |-- Proactively ask clarifying questions for ambiguities
   +-- Wait for user feedback

Phase 4: User Decision Point
   |-- Option A: User approves current approach -> Phase 5
   |-- Option B: User provides clarification/adjustments -> Return to Phase 2
   +-- Option C: User requests different direction -> Reset analysis

Phase 5: Agent Planning & Output Generation
   |-- Invoke cli-lite-planning-agent with discussion context
   |-- Generate IMPL_PLAN.md (documentation)
   |-- Generate plan.json (structured plan for execution)
   |-- User confirms execution
   +-- Hand off to /workflow:lite-execute
```

## Implementation

### Phase 1: Input & Context Gathering

**Session Initialization**:
```javascript
// Helper: Get UTC+8 (China Standard Time) ISO string
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

// Parse arguments
const { taskDescription, maxRounds, tools } = parseArgs(args)
const effectiveMaxRounds = maxRounds || 3
const effectiveTools = tools || ['gemini', 'codex']

// Generate session ID
const taskSlug = taskDescription.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const dateStr = getUtc8ISOString().substring(0, 10)
const sessionId = `MCP-${taskSlug}-${dateStr}`
const sessionFolder = `.workflow/.multi-cli-plan/${sessionId}`

// Create session folder
Bash(`mkdir -p ${sessionFolder}/rounds && test -d ${sessionFolder} && echo "SUCCESS: ${sessionFolder}"`)

// Initialize session state
const sessionState = {
  session_id: sessionId,
  task_description: taskDescription,
  created_at: getUtc8ISOString(),
  max_rounds: effectiveMaxRounds,
  tools: effectiveTools,
  current_round: 0,
  phase: 'context-gathering',
  rounds: [],
  solutions: [],
  user_decisions: [],
  final_plan: null
}

Write(`${sessionFolder}/session-state.json`, JSON.stringify(sessionState, null, 2))
```

**ACE Context Gathering**:
```javascript
// Step 1: Extract keywords from task description
const keywords = extractKeywords(taskDescription)
// e.g., "Add dark mode support" -> ["dark", "mode", "theme", "style", "color"]

// Step 2: Use ACE to understand codebase structure and relevant code
const aceQueries = [
  // Architecture query
  `Project architecture and module structure related to ${keywords.slice(0, 3).join(', ')}`,
  // Implementation query
  `Existing implementations of ${keywords[0]} in this codebase`,
  // Pattern query
  `Code patterns and conventions for ${keywords.slice(0, 2).join(' ')} features`,
  // Integration query
  `Integration points and dependencies for ${keywords[0]} functionality`
]

const aceResults = []
for (const query of aceQueries) {
  const result = await mcp__ace-tool__search_context({
    project_root_path: process.cwd(),
    query: query
  })
  aceResults.push({ query, result, timestamp: getUtc8ISOString() })
}

// Step 3: Build context package (kept in memory for CLI consumption)
const contextPackage = {
  task_description: taskDescription,
  keywords: keywords,
  ace_results: aceResults,
  relevant_files: extractRelevantFiles(aceResults),
  detected_patterns: extractPatterns(aceResults),
  architecture_insights: aceResults[0].result,
  existing_implementations: aceResults[1].result
}

// Update session state
sessionState.phase = 'context-gathered'
sessionState.context_summary = {
  files_identified: contextPackage.relevant_files.length,
  patterns_detected: contextPackage.detected_patterns.length,
  ace_queries: aceQueries.length
}
```

---

### Phase 2: Agent-Driven Collaborative Analysis

**Core Principle**: Orchestrator delegates all analysis to `cli-discuss-agent`, only reads output files for decision making.

**Analysis Round Loop**:
```javascript
let currentRound = 0
let shouldContinue = true
let analysisResults = []

while (shouldContinue && currentRound < effectiveMaxRounds) {
  currentRound++

  console.log(`
## Analysis Round ${currentRound}/${effectiveMaxRounds}

Delegating to cli-discuss-agent...
`)

  // ========================================
  // DELEGATE TO AGENT - No direct analysis
  // ========================================
  Task({
    subagent_type: "cli-discuss-agent",
    run_in_background: false,
    description: `Discussion round ${currentRound}`,
    prompt: `
## Task Objective
Execute collaborative discussion round ${currentRound} for task analysis.

## Input Context
- **Task Description**: ${taskDescription}
- **Round Number**: ${currentRound}
- **Session ID**: ${sessionId}
- **Session Folder**: ${sessionFolder}

## ACE Context
${JSON.stringify(contextPackage, null, 2)}

## Previous Rounds
${analysisResults.length > 0
  ? JSON.stringify(analysisResults, null, 2)
  : 'None (first round)'}

## User Feedback
${userFeedback || 'None'}

## CLI Configuration
${JSON.stringify({
  tools: effectiveTools,
  timeout: 600000,
  fallback_chain: ['gemini', 'codex', 'qwen']
}, null, 2)}

## Output Requirements
Write: ${sessionFolder}/rounds/${currentRound}/synthesis.json

Follow cli-discuss-agent output schema exactly.

## Success Criteria
- [ ] All configured CLI tools executed
- [ ] Cross-verification completed
- [ ] 2-3 solution options generated
- [ ] Convergence score calculated
- [ ] synthesis.json written to round folder
`
  })

  // ========================================
  // READ AGENT OUTPUT - Decision making only
  // ========================================
  const synthesisPath = `${sessionFolder}/rounds/${currentRound}/synthesis.json`
  const roundSynthesis = JSON.parse(Read(synthesisPath))
  analysisResults.push(roundSynthesis)

  // Update session state from agent output
  sessionState.rounds.push({
    number: currentRound,
    cli_tools_used: roundSynthesis._metadata.cli_tools_used,
    solutions_identified: roundSynthesis.solutions.length,
    convergence_score: roundSynthesis.convergence.score,
    new_insights: roundSynthesis.convergence.new_insights,
    recommendation: roundSynthesis.convergence.recommendation
  })

  // Display round summary
  console.log(`
### Round ${currentRound} Complete

**Convergence**: ${roundSynthesis.convergence.score.toFixed(2)}
**Solutions Found**: ${roundSynthesis.solutions.length}
**Recommendation**: ${roundSynthesis.convergence.recommendation}

**Solutions**:
${roundSynthesis.solutions.map((s, i) => `${i+1}. ${s.name} (${s.effort} effort, ${s.risk} risk)`).join('\n')}
`)

  // Decide whether to continue based on agent's recommendation
  if (roundSynthesis.convergence.recommendation === 'converged') {
    shouldContinue = false
    console.log('Analysis converged. Proceeding to decision phase.')
  } else if (roundSynthesis.convergence.recommendation === 'user_input_needed') {
    // Collect user feedback before next round
    const feedbackResult = await AskUserQuestion({
      questions: [{
        question: 'Clarification needed. How would you like to proceed?',
        header: 'Feedback',
        multiSelect: false,
        options: [
          { label: 'Provide Clarification', description: 'Answer questions and continue analysis' },
          { label: 'Proceed Anyway', description: 'Accept current solutions' },
          { label: 'Change Direction', description: 'Modify task requirements' }
        ]
      }]
    })

    if (feedbackResult === 'Provide Clarification') {
      // Display clarification questions
      console.log(`
### Clarification Questions
${roundSynthesis.clarification_questions.map((q, i) => `${i+1}. ${q}`).join('\n')}
`)
      // User provides feedback via "Other" option or follow-up
      userFeedback = feedbackResult.other || ''
    } else if (feedbackResult === 'Proceed Anyway') {
      shouldContinue = false
    } else {
      // Reset with new direction
      userFeedback = feedbackResult.other || ''
    }
  } else {
    // Continue to next round
    shouldContinue = roundSynthesis.convergence.new_insights && currentRound < effectiveMaxRounds
  }
}

// Get final synthesis from last round
const finalSynthesis = analysisResults[analysisResults.length - 1]
```

---

### Phase 3: Review Agent Output & Present Options

**Core Principle**: Orchestrator only reads agent output files and formats them for user decision.

**Read and Present Solutions**:
```javascript
// ========================================
// READ FINAL AGENT OUTPUT - No processing
// ========================================
// finalSynthesis already loaded from agent's synthesis.json in Phase 2

console.log(`
## Stage Summary

### Analysis Complete (from cli-discuss-agent output)
- Rounds completed: ${currentRound}
- CLI tools used: ${finalSynthesis._metadata.cli_tools_used.join(', ')}
- Cross-verification: ${finalSynthesis.cross_verification.agreements.length} agreements, ${finalSynthesis.cross_verification.disagreements.length} disagreements
- Convergence score: ${finalSynthesis.convergence.score.toFixed(2)}

### Solution Options (from agent synthesis)

${finalSynthesis.solutions.map((solution, index) => `
**Option ${index + 1}: ${solution.name}**
*Source: ${solution.source_cli.join(' + ')}*

Description: ${solution.description}

Trade-offs:
| Aspect | Assessment |
|--------|------------|
| Effort | ${solution.effort} |
| Risk | ${solution.risk} |
| Maintainability | ${solution.maintainability} |
| Performance | ${solution.performance_impact} |

Pros:
${solution.pros.map(p => `- ${p}`).join('\n')}

Cons:
${solution.cons.map(c => `- ${c}`).join('\n')}

Key files affected:
${solution.affected_files.slice(0, 5).map(f => `- ${f.file}:${f.line} - ${f.reason}`).join('\n')}
`).join('\n---\n')}

### Cross-Verification Summary

**Agreements**:
${finalSynthesis.cross_verification.agreements.slice(0, 5).map(a => `- ${a}`).join('\n')}

**Disagreements** (resolved):
${finalSynthesis.cross_verification.disagreements.slice(0, 3).map(d => `- ${d}`).join('\n') || '- None'}

### Clarification Questions (from agent)

${finalSynthesis.clarification_questions.length > 0
  ? finalSynthesis.clarification_questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
  : 'No clarifications needed.'}
`)

// Update session state with agent's findings
sessionState.solutions = finalSynthesis.solutions
sessionState.cross_verification = finalSynthesis.cross_verification
sessionState.phase = 'awaiting-decision'
Write(`${sessionFolder}/session-state.json`, JSON.stringify(sessionState, null, 2))
```

---

### Phase 4: User Decision Point

**Collect User Decision**:
```javascript
const decisionResult = await AskUserQuestion({
  questions: [
    {
      question: `Which solution approach do you prefer?`,
      header: "Solution",
      multiSelect: false,
      options: finalSynthesis.solutions.map((sol, i) => ({
        label: `Option ${i + 1}: ${sol.name}`,
        description: `${sol.effort} effort, ${sol.risk} risk`
      })).concat([
        { label: "Need More Analysis", description: "Return to analysis with additional context" }
      ])
    },
    {
      question: "Any clarifications or adjustments?",
      header: "Feedback",
      multiSelect: true,
      options: [
        { label: "Proceed as-is", description: "Generate final plan with selected option" },
        { label: "Add constraints", description: "Specify additional requirements" },
        { label: "Change scope", description: "Adjust what's included/excluded" },
        { label: "Different direction", description: "Explore completely different approach" }
      ]
    }
  ]
})

// Process decision
const userDecision = {
  timestamp: getUtc8ISOString(),
  selected_solution: decisionResult.solution,
  feedback_type: decisionResult.feedback,
  additional_input: decisionResult.other || null
}

sessionState.user_decisions.push(userDecision)

// Decision routing
if (userDecision.selected_solution === 'Need More Analysis' ||
    userDecision.feedback_type.includes('Different direction')) {
  // Return to Phase 2 with updated context
  sessionState.phase = 'additional-analysis'
  // Continue analysis loop with user feedback incorporated
} else if (userDecision.feedback_type.includes('Add constraints') ||
           userDecision.feedback_type.includes('Change scope')) {
  // Prompt for additional details
  const additionalInput = await AskUserQuestion({
    questions: [{
      question: "Please provide the additional constraints or scope changes:",
      header: "Details",
      multiSelect: false,
      options: [
        { label: "Performance priority", description: "Optimize for speed over simplicity" },
        { label: "Maintainability priority", description: "Prefer clear, maintainable code" },
        { label: "Minimal changes", description: "Change as few files as possible" },
        { label: "Full refactor OK", description: "Willing to do comprehensive changes" }
      ]
    }]
  })
  // Incorporate and proceed to Phase 5
  userDecision.constraints = additionalInput
  sessionState.phase = 'generating-plan'
} else {
  // Proceed to Phase 5
  sessionState.phase = 'generating-plan'
}
```

---

### Phase 5: Agent Planning & Output Generation

**Step 5.1: Prepare Planning Context**
```javascript
// Select the approved solution
const selectedSolution = finalSynthesis.solutions[userDecision.selected_solution_index]

// Build comprehensive planning context from discussion
const planningContext = {
  task_description: taskDescription,
  selected_solution: selectedSolution,
  analysis_rounds: analysisResults,
  consensus_points: finalSynthesis._internal?.cross_verification?.agreements || [],
  user_constraints: userDecision.constraints || null,
  ace_context: contextPackage,
  clarifications: sessionState.user_decisions
}

console.log(`
## Generating Implementation Plan

Selected approach: **${selectedSolution.name}**
Invoking planning agent...
`)
```

**Step 5.2: Invoke cli-lite-planning-agent**
```javascript
// Call planning agent to generate detailed plan
Task({
  subagent_type: "cli-lite-planning-agent",
  run_in_background: false,
  description: "Generate detailed implementation plan",
  prompt: `
## Task Objective
Generate detailed implementation plan based on collaborative discussion results.

## Output Schema Reference
Execute: cat ~/.claude/workflows/cli-templates/schemas/plan-json-schema.json

## Project Context (MANDATORY - Read Both Files)
1. Read: .workflow/project-tech.json (technology stack, architecture)
2. Read: .workflow/project-guidelines.json (user-defined constraints)

## Discussion Results

### Task Description
${taskDescription}

### Selected Solution
**Name**: ${selectedSolution.name}
**Description**: ${selectedSolution.description}
**Effort**: ${selectedSolution.effort}
**Risk**: ${selectedSolution.risk}

**Pros**:
${selectedSolution.pros.map(p => `- ${p}`).join('\n')}

**Cons**:
${selectedSolution.cons.map(c => `- ${c}`).join('\n')}

**Affected Files**:
${selectedSolution.affected_files.map(f => `- ${f.file}:${f.line} - ${f.reason}`).join('\n')}

### Analysis Consensus
${(finalSynthesis._internal?.cross_verification?.agreements || []).map(p => `- ${p}`).join('\n')}

### User Constraints
${userDecision.constraints ? JSON.stringify(userDecision.constraints) : 'None specified'}

### ACE Context Summary
Relevant files: ${contextPackage.relevant_files.slice(0, 15).join(', ')}
Detected patterns: ${contextPackage.detected_patterns.join(', ')}

## Output Requirements

### 1. IMPL_PLAN.md (Documentation)
Write: ${sessionFolder}/IMPL_PLAN.md

Structure:
\`\`\`markdown
# Implementation Plan: {Task Title}

## Overview
- **Task**: {description}
- **Approach**: {selected solution name}
- **Complexity**: {Low/Medium/High}
- **Generated**: {timestamp}

## Background & Decision Rationale
{Why this approach was chosen, key trade-offs considered}

## Implementation Steps

### Step 1: {Title}
**Objective**: {what this step achieves}
**Files**:
- \`path/to/file.ts:line\` - {change description}

**Actions**:
1. {specific action}
2. {specific action}

**Verification**: {how to verify this step is complete}

### Step 2: ...

## File Manifest
| File | Lines | Change Type | Description |
|------|-------|-------------|-------------|
| ... | ... | ... | ... |

## Acceptance Criteria
1. {criterion with verification method}
2. ...

## Risk Mitigation
| Risk | Mitigation Strategy |
|------|---------------------|
| ... | ... |

## Dependencies & Prerequisites
- {prerequisite 1}
- {prerequisite 2}
\`\`\`

### 2. plan.json (Structured Plan)
Write: ${sessionFolder}/plan.json

Follow schema from plan-json-schema.json. Key requirements:
- tasks: 2-7 structured tasks (group by feature/module, NOT by file)
- Each task includes: id, title, description, scope, files, depends_on, execution_group
- _metadata.source: "collaborative-discussion"
- _metadata.session_id: "${sessionId}"

## Task Grouping Rules
1. **Group by feature**: All changes for one feature = one task
2. **Substantial tasks**: Each task = 15-60 minutes of work
3. **True dependencies only**: Use depends_on only when Task B needs Task A's output
4. **Prefer parallel**: Most tasks should be independent

## Success Criteria
- [ ] IMPL_PLAN.md written with complete documentation
- [ ] plan.json follows schema exactly
- [ ] All affected files have line numbers
- [ ] Acceptance criteria are testable
- [ ] Tasks are properly grouped (not one per file)
`
})
```

**Step 5.3: Display Generated Plan**
```javascript
// Read generated outputs
const implPlan = Read(`${sessionFolder}/IMPL_PLAN.md`)
const planJson = JSON.parse(Read(`${sessionFolder}/plan.json`))

console.log(`
## Plan Generated Successfully

### Documentation
${implPlan}

---

### Structured Plan Summary
**Tasks**: ${planJson.tasks.length}
**Complexity**: ${planJson.complexity}
**Estimated Time**: ${planJson.estimated_time}

| # | Task | Scope | Dependencies |
|---|------|-------|--------------|
${planJson.tasks.map((t, i) =>
  `| ${i+1} | ${t.title} | ${t.scope} | ${t.depends_on?.join(', ') || 'None'} |`
).join('\n')}
`)

// Update session state
sessionState.phase = 'plan-generated'
sessionState.artifacts = {
  impl_plan: `${sessionFolder}/IMPL_PLAN.md`,
  plan_json: `${sessionFolder}/plan.json`
}
Write(`${sessionFolder}/session-state.json`, JSON.stringify(sessionState, null, 2))
```

**Step 5.4: Confirm & Hand off to Execution**
```javascript
const executeDecision = await AskUserQuestion({
  questions: [{
    question: `Plan generated (${planJson.tasks.length} tasks). Proceed to execution?`,
    header: "Execute",
    multiSelect: false,
    options: [
      { label: "Execute Now (Recommended)", description: "Hand off to /workflow:lite-execute" },
      { label: "Review First", description: "Review plan files before execution" },
      { label: "Modify Plan", description: "Adjust plan before execution" },
      { label: "Save Only", description: "Save plan without execution" }
    ]
  }]
})

if (executeDecision === 'Execute Now') {
  // Build execution context
  const executionContext = {
    planObject: planJson,
    explorationsContext: contextPackage,
    clarificationContext: sessionState.user_decisions,
    originalUserInput: taskDescription,
    executionMethod: 'Agent',  // Default to Agent execution
    session: {
      id: sessionId,
      folder: sessionFolder,
      artifacts: {
        impl_plan: `${sessionFolder}/IMPL_PLAN.md`,
        plan_json: `${sessionFolder}/plan.json`,
        session_state: `${sessionFolder}/session-state.json`
      }
    }
  }

  // Update state and hand off
  sessionState.phase = 'executing'
  Write(`${sessionFolder}/session-state.json`, JSON.stringify(sessionState, null, 2))

  console.log(`
## Handing off to lite-execute

Session: ${sessionId}
Tasks: ${planJson.tasks.length}
`)

  // Hand off to lite-execute
  SlashCommand(command="/workflow:lite-execute --in-memory")

} else if (executeDecision === 'Review First') {
  console.log(`
## Plan Files Ready for Review

- Documentation: ${sessionFolder}/IMPL_PLAN.md
- Structured Plan: ${sessionFolder}/plan.json

Run \`/workflow:lite-execute --session=${sessionId}\` when ready.
`)

} else if (executeDecision === 'Modify Plan') {
  // Return to Phase 4 with modification request
  sessionState.phase = 'awaiting-decision'
  console.log('Returning to decision phase for plan modification...')

} else {
  console.log(`
## Plan Saved

Session: ${sessionId}
Location: ${sessionFolder}/

Files:
- IMPL_PLAN.md (documentation)
- plan.json (structured plan)
- session-state.json (full context)

To execute later: /workflow:lite-execute --session=${sessionId}
`)
  sessionState.phase = 'complete'
}

Write(`${sessionFolder}/session-state.json`, JSON.stringify(sessionState, null, 2))
```

---

## Session Folder Structure

```
.workflow/.multi-cli-plan/{MCP-task-slug-YYYY-MM-DD}/
|-- session-state.json           # Session state with all rounds and decisions
|-- rounds/
|   |-- 1/
|   |   +-- synthesis.json       # Round 1 analysis synthesis
|   |-- 2/
|   |   +-- synthesis.json       # Round 2 analysis synthesis
|   +-- .../
|-- IMPL_PLAN.md                 # Implementation plan documentation
+-- plan.json                    # Structured plan for lite-execute
```

## Key Features

### 1. Agent-Orchestrator Separation

**Orchestrator (this command)** only handles:
- Task delegation to agents
- Reading agent output files
- User interaction and decisions
- Session state management

**Agent (cli-discuss-agent)** handles:
- Multi-CLI execution (Gemini, Codex, Qwen)
- Cross-verification between CLI outputs
- Solution synthesis and ranking
- Writing structured output files

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR                              │
│  (multi-cli-plan.md - decision layer)                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   1. Delegate → Task(cli-discuss-agent)                     │
│   2. Wait for completion                                    │
│   3. Read → synthesis.json                                  │
│   4. Display → User                                         │
│   5. Collect → Decision                                     │
│   6. Loop or proceed                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    CLI-DISCUSS-AGENT                         │
│  (analysis layer)                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Gemini CLI ──┐                                            │
│                ├──→ Cross-Verify ──→ Synthesize             │
│   Codex CLI ───┘                           │                │
│                                            ▼                │
│                                    synthesis.json           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2. Multi-CLI Cross-Verification

Agent invokes multiple CLI tools and cross-verifies:
- **Gemini**: Deep code analysis, pattern recognition
- **Codex**: Implementation verification, code generation feasibility
- **Qwen** (fallback): Alternative perspective

Cross-verification identifies:
- Agreements (high confidence points)
- Disagreements (requiring resolution)
- Unique insights from each tool

### 3. User-Driven Decision Points

Every analysis cycle ends with user decision:
- Approve and proceed to planning
- Request more analysis with feedback
- Adjust requirements or direction
- View detailed agent output files

### 4. Iterative Convergence

Each round builds on previous findings:
- Round 1: Initial exploration, identify major approaches
- Round 2: Deep dive into promising approaches, resolve conflicts
- Round 3: Final refinement, edge case analysis

Agent calculates convergence score (0.0-1.0) and recommends:
- `converged`: Ready for planning
- `continue`: More analysis needed
- `user_input_needed`: Clarification required

### 5. Trade-off Transparency

Each solution option includes explicit trade-offs:
- Effort (low/medium/high)
- Risk assessment
- Maintainability impact
- Performance considerations
- Affected files with line numbers
- Source CLI(s) that proposed the solution

## Error Handling

| Error | Resolution |
|-------|------------|
| ACE search fails | Fall back to Glob/Grep for file discovery |
| Agent fails to produce synthesis.json | Retry agent with simpler context |
| CLI tool timeout (in agent) | Agent uses fallback chain: gemini → codex → qwen |
| No convergence after max rounds | Present best available options, flag uncertainty |
| synthesis.json parse error | Agent retries with degraded mode |
| User cancels | Save session state for later resumption |

## Configuration

| Flag | Default | Description |
|------|---------|-------------|
| `--max-rounds` | 3 | Maximum analysis rounds before forcing decision |
| `--tools` | gemini,codex | CLI tools to use for analysis |
| `--auto-execute` | false | Auto-execute after plan approval |
| `--save-context` | true | Persist ACE context for resumption |

## Best Practices

1. **Be Specific**: More detailed task descriptions lead to better initial context gathering
2. **Provide Feedback**: Use clarification rounds to narrow down requirements
3. **Trust the Process**: Allow multiple rounds for complex tasks
4. **Review Trade-offs**: Carefully consider pros/cons of each solution option
5. **Iterate**: Don't hesitate to request additional analysis if uncertain
6. **Review Plan**: Check IMPL_PLAN.md before execution for complete understanding

## Output Artifacts

| File | Purpose | Producer |
|------|---------|----------|
| `rounds/{n}/synthesis.json` | Round analysis results | cli-discuss-agent |
| `IMPL_PLAN.md` | Human-readable documentation | cli-lite-planning-agent |
| `plan.json` | Structured tasks for execution | cli-lite-planning-agent |
| `session-state.json` | Session tracking | Orchestrator |

**synthesis.json schema** (produced by cli-discuss-agent):
```json
{
  "round": 1,
  "cli_analyses": [...],
  "cross_verification": { "agreements": [], "disagreements": [] },
  "solutions": [{ "name": "...", "pros": [], "cons": [], "effort": "..." }],
  "convergence": { "score": 0.85, "recommendation": "converged" },
  "clarification_questions": []
}
```

## Related Commands

```bash
# Resume a saved multi-cli-plan session
/workflow:lite-execute --session=MCP-xxx

# For simpler tasks without multi-round discussion
/workflow:lite-plan "task description"

# For issue-driven discovery
/issue:discover-by-prompt "find issues"

# View generated plan
cat .workflow/.multi-cli-plan/{session-id}/IMPL_PLAN.md
```
