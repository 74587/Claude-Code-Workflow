# Command Pattern Template

Pre-built Codex command patterns for common agent interaction scenarios.

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand available command patterns |
| Phase 2 | Select appropriate patterns for orchestrator |
| Phase 3 | Apply patterns to agent definitions |

---

## Pattern 1: Explore (Parallel Fan-out)

**Use When**: Multi-angle codebase exploration needed.

```javascript
// ==================== Explore Pattern ====================

// Step 1: Define exploration angles
const angles = ["architecture", "dependencies", "patterns", "testing"]

// Step 2: Create parallel exploration agents
const agents = angles.map(angle =>
  spawn_agent({
    message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. Read: .workflow/project-tech.json

---

Goal: Execute ${angle} exploration for ${task_description}

Scope:
- Include: All source files relevant to ${angle}
- Exclude: node_modules, dist, build artifacts

Context:
- Task: ${task_description}
- Angle: ${angle}

Deliverables:
- Structured findings following output template
- File:line references for key discoveries
- Open questions for unclear areas

Quality bar:
- At least 3 relevant files identified
- Findings backed by concrete evidence
`
  })
)

// Step 3: Batch wait
const results = wait({ ids: agents, timeout_ms: 600000 })

// Step 4: Aggregate
const findings = agents.map((id, i) => ({
  angle: angles[i],
  result: results.status[id].completed
}))

// Step 5: Cleanup
agents.forEach(id => close_agent({ id }))
```

## Pattern 2: Analyze (Multi-Perspective)

**Use When**: Code analysis from multiple dimensions needed.

```javascript
// ==================== Analyze Pattern ====================

const perspectives = [
  { name: "security", focus: "OWASP Top 10, injection, auth bypass" },
  { name: "performance", focus: "O(n²), memory leaks, blocking I/O" },
  { name: "maintainability", focus: "complexity, coupling, duplication" }
]

const agents = perspectives.map(p =>
  spawn_agent({
    message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)

---

Goal: Analyze ${targetModule} from ${p.name} perspective
Focus: ${p.focus}

Scope:
- Include: ${targetPaths}
- Exclude: Test files, generated code

Deliverables:
- Severity-classified findings (Critical/High/Medium/Low)
- File:line references for each finding
- Remediation recommendations

Quality bar:
- Every finding must have evidence (code reference)
- Remediation must be actionable
`
  })
)

const results = wait({ ids: agents, timeout_ms: 600000 })

// Merge findings by severity
const merged = {
  critical: [], high: [], medium: [], low: []
}
agents.forEach((id, i) => {
  const parsed = parseFindings(results.status[id].completed)
  Object.keys(merged).forEach(sev => merged[sev].push(...(parsed[sev] || [])))
})

agents.forEach(id => close_agent({ id }))
```

## Pattern 3: Implement (Sequential Delegation)

**Use When**: Code implementation following a plan.

```javascript
// ==================== Implement Pattern ====================

const implementAgent = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/code-developer.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: Implement ${featureDescription}

Scope:
- Include: ${targetPaths}
- Exclude: Unrelated modules
- Constraints: No breaking changes, follow existing patterns

Context:
- Plan: ${planContent}
- Dependencies: ${dependencies}
- Existing patterns: ${patterns}

Deliverables:
- Working implementation following plan
- Updated/new test files
- Summary of changes with file:line references

Quality bar:
- All existing tests pass
- New code follows project conventions
- No TypeScript errors
- Backward compatible
`
})

const result = wait({ ids: [implementAgent], timeout_ms: 900000 })

// Check for open questions (might need clarification)
if (result.status[implementAgent].completed.includes('CLARIFICATION_NEEDED')) {
  // Handle clarification via send_input
  const answers = getUserAnswers(result)
  send_input({ id: implementAgent, message: `## ANSWERS\n${answers}\n\n## CONTINUE\nProceed with implementation.` })
  const final = wait({ ids: [implementAgent], timeout_ms: 900000 })
}

close_agent({ id: implementAgent })
```

## Pattern 4: Validate (Test-Fix Cycle)

**Use When**: Running tests and fixing failures iteratively.

```javascript
// ==================== Validate Pattern ====================

const validateAgent = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/test-fix-agent.md (MUST read first)

---

Goal: Validate ${component} — run tests, fix failures, iterate

Scope:
- Include: ${testPaths}
- Exclude: Unrelated test suites

Context:
- Recent changes: ${changedFiles}
- Test framework: ${testFramework}

Deliverables:
- All tests passing (or documented blocked tests)
- Fix summary with file:line references
- Coverage report

Quality bar:
- Pass rate >= 95%
- No new test regressions
- Max 5 fix iterations
`
})

const round1 = wait({ ids: [validateAgent], timeout_ms: 600000 })

// Check if more iterations needed
let iteration = 1
while (
  iteration < 5 &&
  round1.status[validateAgent].completed.includes('TESTS_FAILING')
) {
  send_input({
    id: validateAgent,
    message: `## ITERATION ${iteration + 1}\nContinue fixing remaining failures. Focus on:\n${remainingFailures}`
  })
  const roundN = wait({ ids: [validateAgent], timeout_ms: 300000 })
  iteration++
}

close_agent({ id: validateAgent })
```

## Pattern 5: Review (Multi-Dimensional)

**Use When**: Code review from multiple dimensions.

```javascript
// ==================== Review Pattern ====================

const dimensions = [
  { name: "correctness", agent: "cli-explore-agent" },
  { name: "security", agent: "cli-explore-agent" },
  { name: "performance", agent: "cli-explore-agent" },
  { name: "style", agent: "cli-explore-agent" }
]

const agents = dimensions.map(d =>
  spawn_agent({
    message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/${d.agent}.md (MUST read first)

---

Goal: Review ${targetCode} for ${d.name}
Scope: ${changedFiles}
Deliverables: Findings with severity, file:line, remediation
`
  })
)

const results = wait({ ids: agents, timeout_ms: 600000 })

// Aggregate review findings
const review = {
  approved: true,
  findings: [],
  blockers: []
}

agents.forEach((id, i) => {
  const parsed = parseReview(results.status[id].completed)
  review.findings.push(...parsed.findings)
  if (parsed.blockers.length > 0) {
    review.approved = false
    review.blockers.push(...parsed.blockers)
  }
})

agents.forEach(id => close_agent({ id }))
```

## Pattern 6: Deep Interact (Merged Explore + Plan)

**Use When**: Exploration and planning are tightly coupled.

```javascript
// ==================== Deep Interact Pattern ====================

const agent = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. **Also read**: ~/.codex/agents/cli-lite-planning-agent.md (dual role)

---

### Phase A: Exploration
Goal: Explore codebase for ${task_description}
Output: Structured findings + CLARIFICATION_NEEDED questions (if any)

### Phase B: Planning (activated after clarification)
Goal: Generate implementation plan based on exploration + answers
Output: Structured plan following plan schema

Deliverables:
- Phase A: exploration findings (Summary/Findings/Open questions)
- Phase B: implementation plan (after receiving clarification answers)
`
})

// Phase A: Exploration
const exploration = wait({ ids: [agent], timeout_ms: 600000 })

if (exploration.status[agent].completed.includes('CLARIFICATION_NEEDED')) {
  const answers = getUserAnswers(exploration)

  // Phase B: Planning (same agent, preserved context)
  send_input({
    id: agent,
    message: `
## CLARIFICATION ANSWERS
${answers}

## PROCEED TO PHASE B
Generate implementation plan based on your exploration findings and these answers.
`
  })

  const plan = wait({ ids: [agent], timeout_ms: 900000 })
}

close_agent({ id: agent })
```

## Pattern 7: Two-Phase (Clarify → Execute)

**Use When**: Task requires explicit clarification before execution.

```javascript
// ==================== Two-Phase Pattern ====================

// Phase 1: Clarification
const agent = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/${agentType}.md (MUST read first)

---

### PHASE: CLARIFICATION ONLY

Goal: Understand ${task_description} and identify unclear points

Output ONLY:
1. Your understanding of the task (2-3 sentences)
2. CLARIFICATION_NEEDED questions (if any)
3. Recommended approach (1-2 sentences)

DO NOT execute any changes yet.
`
})

const clarification = wait({ ids: [agent], timeout_ms: 300000 })

// Collect user confirmation/answers
const userResponse = processUserInput(clarification)

// Phase 2: Execution
send_input({
  id: agent,
  message: `
## USER CONFIRMATION
${userResponse}

## PROCEED TO EXECUTION
Now execute the task with full implementation.
Output: Complete deliverable following structured output template.
`
})

const execution = wait({ ids: [agent], timeout_ms: 900000 })

close_agent({ id: agent })
```

---

## Pattern Selection Guide

| Scenario | Recommended Pattern | Reason |
|----------|-------------------|--------|
| Explore codebase from N angles | Pattern 1: Explore | Parallel fan-out, independent angles |
| Analyze code quality | Pattern 2: Analyze | Multi-perspective, severity classification |
| Implement from plan | Pattern 3: Implement | Sequential, plan-driven |
| Run tests + fix | Pattern 4: Validate | Iterative send_input loop |
| Code review | Pattern 5: Review | Multi-dimensional, aggregated verdict |
| Explore then plan | Pattern 6: Deep Interact | Context preservation, merged phases |
| Complex/unclear task | Pattern 7: Two-Phase | Clarify first, reduce rework |
| Simple one-shot task | Standard (no pattern) | spawn → wait → close |
