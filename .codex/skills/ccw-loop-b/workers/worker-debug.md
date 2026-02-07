# Worker: DEBUG

Problem diagnosis worker. Hypothesis-driven debugging with evidence tracking.

## Purpose

- Locate error source and understand failure mechanism
- Generate testable hypotheses ranked by likelihood
- Collect evidence and evaluate against criteria
- Document root cause and fix recommendations

## Preconditions

- Issue exists (test failure, bug report, blocked task)
- `state.status === 'running'`

## Mode Detection

```javascript
const debugPath = `${progressDir}/debug.md`
const debugExists = fs.existsSync(debugPath)

const debugMode = debugExists ? 'continue' : 'explore'
```

## Execution

### Mode: Explore (First Debug)

#### Step E1: Understand Problem

```javascript
// From test failures, blocked tasks, or user description
const bugDescription = state.skill_state.findings?.[0]
  || state.description
```

#### Step E2: Search Codebase

```javascript
const searchResults = mcp__ace_tool__search_context({
  project_root_path: '.',
  query: `code related to: ${bugDescription}`
})
```

#### Step E3: Generate Hypotheses

```javascript
const hypotheses = [
  {
    id: 'H1',
    description: 'Most likely cause',
    testable_condition: 'What to check',
    confidence: 'high | medium | low',
    evidence: [],
    mechanism: 'Detailed explanation of how this causes the bug'
  },
  // H2, H3...
]
```

#### Step E4: Create Understanding Document

```javascript
Write(`${progressDir}/debug.md`, `# Debug Understanding

**Loop ID**: ${loopId}
**Bug**: ${bugDescription}
**Started**: ${getUtc8ISOString()}

---

## Hypotheses

${hypotheses.map(h => `
### ${h.id}: ${h.description}
- Confidence: ${h.confidence}
- Testable: ${h.testable_condition}
- Mechanism: ${h.mechanism}
`).join('\n')}

## Evidence

[To be collected]

## Root Cause

[Pending investigation]
`)
```

### Mode: Continue (Previous Debug Exists)

#### Step C1: Review Previous Findings

```javascript
const previousDebug = Read(`${progressDir}/debug.md`)
// Continue investigation based on previous findings
```

#### Step C2: Apply Fix and Verify

```javascript
// If root cause identified, apply fix
// Record fix in progress document
```

## Output Format

```
WORKER_RESULT:
- action: debug
- status: success
- summary: Root cause: {description}
- files_changed: []
- next_suggestion: develop
- loop_back_to: develop

DETAILED_OUTPUT:
ROOT_CAUSE_ANALYSIS:
  hypothesis: "H1: {description}"
  confidence: high
  evidence: [...]
  mechanism: "Detailed explanation"

FIX_RECOMMENDATIONS:
  1. {specific fix action}
  2. {verification step}
```

## Clarification Mode

If insufficient information:

```
CLARIFICATION_NEEDED:
Q1: Can you reproduce the issue? | Options: [Yes, No, Sometimes] | Recommended: [Yes]
Q2: When did this start? | Options: [Recent change, Always, Unknown] | Recommended: [Recent change]
```

## Error Handling

| Error | Recovery |
|-------|----------|
| Insufficient info | Output CLARIFICATION_NEEDED |
| All hypotheses rejected | Generate new hypotheses |
| >5 iterations | Suggest escalation |
