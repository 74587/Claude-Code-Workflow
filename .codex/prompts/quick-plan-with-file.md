---
description: Multi-agent rapid planning with minimal documentation, conflict resolution, and actionable synthesis. Lightweight planning from raw task, brainstorm, or analysis artifacts
argument-hint: "TOPIC=\"<planning topic or task>\" [--from=brainstorm|analysis|task|raw] [--perspectives=arch,impl,risk,decision] [--auto] [--verbose]"
---

# Codex Quick-Plan-With-File Prompt

## Overview

Multi-agent rapid planning workflow with **minimal documentation overhead**. Coordinates parallel agent analysis (architecture, implementation, validation, decision), synthesizes conflicting perspectives into actionable decisions, and generates an implementation-ready plan.

**Core workflow**: Parse Input → Parallel Analysis → Conflict Resolution → Plan Synthesis → Output

**Key features**:
- **Format Agnostic**: Consumes brainstorm conclusions, analysis recommendations, quick tasks, or raw descriptions
- **Minimal Docs**: Single plan.md (no lengthy timeline documentation)
- **Parallel Multi-Agent**: 4 concurrent perspectives for rapid analysis
- **Conflict Resolution**: Automatic conflict detection and synthesis
- **Actionable Output**: Direct task breakdown ready for execution

## Target Planning

**$TOPIC**

- `--from`: Input source type (brainstorm | analysis | task | raw) - auto-detected if omitted
- `--perspectives`: Which perspectives to use (arch, impl, risk, decision) - all by default
- `--auto`: Auto-confirm decisions, minimal user prompts
- `--verbose`: Verbose output with all reasoning

## Execution Process

```
Phase 1: Input Validation & Loading
   ├─ Parse input: topic | artifact reference
   ├─ Load artifact if referenced (synthesis.json | conclusions.json)
   ├─ Extract constraints and key requirements
   └─ Initialize session folder

Phase 2: Parallel Multi-Agent Analysis (concurrent)
   ├─ Agent 1 (Architecture): Design decomposition, patterns, scalability
   ├─ Agent 2 (Implementation): Tech stack, feasibility, effort estimates
   ├─ Agent 3 (Validation): Risk matrix, testing strategy, monitoring
   ├─ Agent 4 (Decision): Recommendations, tradeoffs, execution strategy
   └─ Aggregate findings into perspectives.json

Phase 3: Conflict Detection & Resolution
   ├─ Detect: effort conflicts, architecture conflicts, risk conflicts
   ├─ Analyze rationale for each conflict
   ├─ Synthesis via arbitration: generate unified recommendation
   ├─ Document conflicts and resolutions
   └─ Update plan.md

Phase 4: Plan Synthesis
   ├─ Consolidate all insights
   ├─ Generate task breakdown (5-8 major tasks)
   ├─ Create execution strategy and dependencies
   ├─ Document assumptions and risks
   └─ Output plan.md + synthesis.json

Output:
   ├─ .workflow/.planning/{sessionId}/plan.md (minimal, actionable)
   ├─ .workflow/.planning/{sessionId}/perspectives.json (agent findings)
   ├─ .workflow/.planning/{sessionId}/conflicts.json (decision points)
   └─ .workflow/.planning/{sessionId}/synthesis.json (task breakdown for execution)
```

## Implementation Details

### Phase 1: Session Setup & Input Loading

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

// Parse input
const planSlug = "$TOPIC".toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
  .substring(0, 30)
const sessionId = `PLAN-${planSlug}-${getUtc8ISOString().substring(0, 10)}`
const sessionFolder = `.workflow/.planning/${sessionId}`

// Detect input type
let artifact = null
if ($TOPIC.startsWith('BS-') || "$TOPIC".includes('brainstorm')) {
  artifact = loadBrainstormArtifact($TOPIC)
} else if ($TOPIC.startsWith('ANL-') || "$TOPIC".includes('analysis')) {
  artifact = loadAnalysisArtifact($TOPIC)
}

bash(`mkdir -p ${sessionFolder}`)
```

### Phase 2: Parallel Multi-Agent Analysis

Run 4 agents in parallel using ccw cli:

```javascript
// Launch all 4 agents concurrently with Bash run_in_background
const agentPromises = []

// Agent 1 - Architecture (Gemini)
agentPromises.push(
  Bash({
    command: `ccw cli -p "
PURPOSE: Architecture & high-level design for '${planningTopic}'
Success: Clear component decomposition and architectural approach

TASK:
• Decompose problem into major components/modules
• Identify architectural patterns and integration points
• Design component interfaces and data models
• Assess scalability and maintainability implications
• Propose architectural approach with rationale

MODE: analysis

CONTEXT: @**/*
${artifact ? \`| Source artifact: \${artifact.type}\` : ''}

EXPECTED:
- Component decomposition (list with responsibilities)
- Module interfaces and contracts
- Data flow between components
- Architectural patterns applied (e.g., MVC, Event-Driven, etc.)
- Scalability assessment (1-5 rating with rationale)
- Architectural risks identified

CONSTRAINTS: Focus on long-term maintainability and extensibility
" --tool gemini --mode analysis`,
    run_in_background: true
  })
)

// Agent 2 - Implementation (Codex)
agentPromises.push(
  Bash({
    command: \`ccw cli -p "
PURPOSE: Implementation approach & technical feasibility for '\${planningTopic}'
Success: Concrete implementation strategy with realistic estimates

TASK:
• Evaluate technical feasibility of proposed approach
• Identify required technologies and dependencies
• Estimate effort: analysis/design/coding/testing/deployment
• Suggest implementation phases and milestones
• Highlight technical blockers and challenges

MODE: analysis

CONTEXT: @**/*
\${artifact ? \`| Source artifact: \${artifact.type}\` : ''}

EXPECTED:
- Technology stack recommendation (languages, frameworks, tools)
- Implementation complexity: high|medium|low (with justification)
- Effort breakdown (hours or complexity: analysis, design, coding, testing, deployment)
- Key technical decisions with tradeoffs explained
- Potential blockers and mitigation strategies
- Suggested implementation phases with sequencing
- Reusable components or libraries identified

CONSTRAINTS: Realistic with current tech stack
" --tool codex --mode analysis\`,
    run_in_background: true
  })
)

// Agent 3 - Validation & Risk (Claude)
agentPromises.push(
  Bash({
    command: \`ccw cli -p "
PURPOSE: Risk analysis and validation strategy for '\${planningTopic}'
Success: Comprehensive risk matrix with testing and deployment strategy

TASK:
• Identify technical risks and failure scenarios
• Assess timeline and resource risks
• Define validation/testing strategy (unit, integration, e2e, performance)
• Suggest monitoring and observability requirements
• Propose deployment strategy and rollback plan

MODE: analysis

CONTEXT: @**/*
\${artifact ? \`| Source artifact: \${artifact.type}\` : ''}

EXPECTED:
- Risk matrix (likelihood × impact, each 1-5)
- Top 3 technical risks with mitigation approaches
- Top 3 timeline/resource risks with mitigation
- Testing strategy (what to test, how, when, acceptance criteria)
- Deployment strategy (staged rollout, blue-green, canary, etc.)
- Rollback plan and recovery procedures
- Monitoring/observability requirements (metrics, logs, alerts)
- Overall risk rating: low|medium|high (with confidence)

CONSTRAINTS: Be realistic, not pessimistic
" --tool claude --mode analysis\`,
    run_in_background: true
  })
)

// Agent 4 - Strategic Decision (Gemini)
agentPromises.push(
  Bash({
    command: \`ccw cli -p "
PURPOSE: Strategic decisions and execution recommendations for '\${planningTopic}'
Success: Clear recommended approach with tradeoff analysis

TASK:
• Synthesize all perspectives into strategic recommendations
• Identify 2-3 critical decision points with recommended choices
• Clearly outline key tradeoffs (speed vs quality, scope vs timeline, risk vs cost)
• Propose go/no-go decision criteria and success metrics
• Suggest execution strategy and resource sequencing

MODE: analysis

CONTEXT: @**/*
\${artifact ? \`| Source artifact: \${artifact.type}\` : ''}

EXPECTED:
- Primary recommendation with strong rationale (1-2 paragraphs)
- Alternative approaches with pros/cons (2-3 alternatives)
- 2-3 critical decision points:
  - What decision needs to be made
  - Trade-offs for each option
  - Recommended choice and why
- Key trade-offs explained (what we're optimizing for: speed/quality/risk/cost)
- Success metrics and go/no-go criteria
- Resource requirements and critical path items
- Suggested execution sequencing and phases

CONSTRAINTS: Focus on actionable decisions, provide clear rationale
" --tool gemini --mode analysis\`,
    run_in_background: true
  })
)

// Wait for all agents to complete
const [archResult, implResult, riskResult, decisionResult] = await Promise.all(agentPromises)

// Parse and extract findings from each agent result
const architecture = parseArchitectureResult(archResult)
const implementation = parseImplementationResult(implResult)
const validation = parseValidationResult(riskResult)
const recommendation = parseDecisionResult(decisionResult)
```

**Agent Focus Areas**:

| Agent | Perspective | Focus Areas |
|-------|-------------|------------|
| Gemini (Design) | Architecture patterns | Components, interfaces, scalability, patterns |
| Codex (Build) | Implementation reality | Tech stack, complexity, effort, blockers |
| Claude (Validate) | Risk & testing | Risk matrix, testing strategy, deployment, monitoring |
| Gemini (Decide) | Strategic synthesis | Recommendations, trade-offs, critical decisions |

### Phase 3: Parse & Aggregate Perspectives

```javascript
const perspectives = {
  session_id: sessionId,
  topic: "$TOPIC",
  timestamp: getUtc8ISOString(),

  architecture: {
    components: [...],
    patterns: [...],
    scalability_rating: 3,
    risks: [...]
  },

  implementation: {
    technology_stack: [...],
    complexity: "medium",
    effort_breakdown: { analysis: 2, design: 3, coding: 8, testing: 4 },
    blockers: [...]
  },

  validation: {
    risk_matrix: [...],
    top_risks: [{ title, impact, mitigation }, ...],
    testing_strategy: "...",
    monitoring: [...]
  },

  recommendation: {
    primary_approach: "...",
    alternatives: [...],
    critical_decisions: [...],
    tradeoffs: [...]
  }
}

Write(`${sessionFolder}/perspectives.json`, JSON.stringify(perspectives, null, 2))
```

### Phase 4: Conflict Detection

Detect conflicts:
- Effort variance: Are estimates consistent?
- Risk disagreement: Do arch and validation agree on risks?
- Scope confusion: Are recommendations aligned?
- Architecture mismatch: Do design and implementation agree?

For each conflict: document it, then run synthesis arbitration.

### Phase 5: Generate Plan

```markdown
# Quick Planning Session

**Session ID**: ${sessionId}
**Topic**: $TOPIC
**Created**: ${timestamp}

---

## Executive Summary

${synthesis.executive_summary}

**Complexity**: ${synthesis.complexity_level}
**Estimated Effort**: ${formatEffort(synthesis.effort_breakdown)}
**Optimization Focus**: ${synthesis.optimization_focus}

---

## Architecture

**Primary Pattern**: ${synthesis.architecture_approach}

**Key Components**:
${synthesis.key_components.map((c, i) => `${i+1}. ${c.name}: ${c.responsibility}`).join('\n')}

---

## Implementation Strategy

**Technology Stack**:
${synthesis.technology_stack.map(t => `- ${t}`).join('\n')}

**Phases**:
${synthesis.phases.map((p, i) => `${i+1}. ${p.name} (${p.effort})`).join('\n')}

---

## Risk Assessment

**Overall Risk**: ${synthesis.overall_risk_level}

**Top 3 Risks**:
${synthesis.top_risks.map((r, i) => `${i+1}. **${r.title}** (Impact: ${r.impact})\n   Mitigation: ${r.mitigation}`).join('\n\n')}

---

## Task Breakdown (Ready for Execution)

${synthesis.tasks.map((task, i) => `
${i+1}. **${task.id}: ${task.title}** (Effort: ${task.effort})
   ${task.description}
   Dependencies: ${task.dependencies.join(', ') || 'none'}
`).join('\n')}

---

## Next Steps

**Execute with**:
\`\`\`
/workflow:unified-execute-with-file -p ${sessionFolder}/synthesis.json
\`\`\`

**Detailed planning if needed**:
\`\`\`
/workflow:plan "Based on: $TOPIC"
\`\`\`
```

## Session Folder Structure

```
.workflow/.planning/{sessionId}/
├── plan.md              # Minimal, actionable
├── perspectives.json    # Agent findings
├── conflicts.json       # Conflicts & resolutions (if any)
└── synthesis.json       # Task breakdown for execution
```

## Multi-Agent Coordination

| Agent | Perspective | Tools | Output |
|-------|-------------|-------|--------|
| Gemini (Design) | Architecture patterns | Design thinking, cross-domain | Components, patterns, scalability |
| Codex (Build) | Implementation reality | Tech stack evaluation | Stack, effort, feasibility |
| Claude (Validate) | Risk & testing | Risk assessment, QA | Risks, testing strategy |
| Gemini (Decide) | Strategic synthesis | Decision analysis | Recommendations, tradeoffs |

## Error Handling

| Situation | Action |
|-----------|--------|
| Agents conflict | Arbitration agent synthesizes recommendation |
| Missing blockers | Continue with available context, note gaps |
| Unclear input | Ask for clarification on planning focus |
| Estimate too high | Suggest MVP approach or phasing |

## Integration Flow

```
Raw Task / Brainstorm / Analysis
         │
         ▼
quick-plan-with-file (5-10 min)
         │
         ├─ plan.md
         ├─ perspectives.json
         └─ synthesis.json
         │
         ▼
unified-execute-with-file
         │
         ▼
Implementation
```

## Usage Patterns

**Pattern 1: Quick planning from task**
```
TOPIC="实现实时通知系统" --auto
→ Creates actionable plan in ~5 minutes
```

**Pattern 2: Convert brainstorm to execution plan**
```
TOPIC="BS-notifications-2025-01-28" --from=brainstorm
→ Reads synthesis.json from brainstorm
→ Generates implementation plan
```

**Pattern 3: From analysis to plan**
```
TOPIC="ANL-auth-2025-01-28" --from=analysis
→ Converts conclusions.json to executable plan
```

---

**Now execute quick-plan-with-file for topic**: $TOPIC
