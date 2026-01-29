---
name: quick-plan-with-file
description: Multi-agent rapid planning with minimal documentation, conflict resolution, and actionable synthesis. Designed as a lightweight planning supplement between brainstorm and full implementation planning
argument-hint: "[-y|--yes] [-c|--continue] [-f|--from <type>] \"planning topic or task description\""
allowed-tools: TodoWrite(*), Task(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*), Bash(*), Edit(*), Write(*)
---

## Auto Mode

When `--yes` or `-y`: Auto-confirm planning decisions, use aggressive parallelization, minimal user interaction.

# Workflow Quick-Plan-With-File Command (/workflow:quick-plan-with-file)

## Overview

Multi-agent rapid planning workflow with **minimal documentation overhead**. Coordinates parallel agent analysis, synthesizes conflicting perspectives into actionable decisions, and generates a lightweight implementation-ready plan.

**Core workflow**: Parse Input → Parallel Analysis → Conflict Resolution → Plan Synthesis → Output

**Key features**:
- **Plan Format Agnostic**: Consumes brainstorm conclusions, analysis recommendations, or raw task descriptions
- **Minimal Docs**: Single `plan.md` (no lengthy brainstorm.md or discussion.md)
- **Parallel Multi-Agent**: 3-4 concurrent agent perspectives (architecture, implementation, validation, risk)
- **Conflict Resolution**: Automatic conflict detection and resolution via synthesis agent
- **Actionable Output**: Direct task breakdown ready for execution
- **Session Resumable**: Continue if interrupted, checkpoint at each phase

## Usage

```bash
/workflow:quick-plan-with-file [FLAGS] <PLANNING_TOPIC>

# Flags
-y, --yes              Auto-confirm decisions, use defaults
-c, --continue         Continue existing session (auto-detected)
-f, --from <type>      Input source type: brainstorm|analysis|task|raw

# Arguments
<planning-topic>       Planning topic, task, or reference to planning artifact

# Examples
/workflow:quick-plan-with-file "实现分布式缓存层，支持Redis和内存后端"
/workflow:quick-plan-with-file --continue "缓存层规划"                           # Continue
/workflow:quick-plan-with-file -y -f analysis "从分析结论生成实施规划"          # Auto mode
/workflow:quick-plan-with-file --from brainstorm BS-rate-limiting-2025-01-28    # From artifact
```

## Execution Process

```
Input Validation & Loading:
   ├─ Parse input (topic | artifact reference)
   ├─ Load artifact if referenced (synthesis.json | conclusions.json | etc.)
   ├─ Extract key constraints and requirements
   └─ Initialize session folder and plan.md

Session Initialization:
   ├─ Create .workflow/.planning/{sessionId}/
   ├─ Initialize plan.md with input summary
   ├─ Parse existing output (if --from artifact)
   └─ Define planning dimensions & focus areas

Phase 1: Parallel Multi-Agent Analysis (concurrent)
   ├─ Agent 1 (Architecture): High-level design & decomposition
   ├─ Agent 2 (Implementation): Technical approach & feasibility
   ├─ Agent 3 (Validation): Risk analysis & edge cases
   ├─ Agent 4 (Decision): Recommendations & tradeoffs
   └─ Aggregate findings into perspectives.json

Phase 2: Conflict Detection & Resolution
   ├─ Analyze agent perspectives for contradictions
   ├─ Identify critical decision points
   ├─ Generate synthesis via arbitration agent
   ├─ Document conflicts and resolutions
   └─ Update plan.md with decisive recommendations

Phase 3: Plan Synthesis
   ├─ Consolidate all insights
   ├─ Generate actionable task breakdown
   ├─ Create execution strategy
   ├─ Document assumptions & risks
   └─ Generate synthesis.md with ready-to-execute tasks

Output:
   ├─ .workflow/.planning/{sessionId}/plan.md (minimal, actionable)
   ├─ .workflow/.planning/{sessionId}/perspectives.json (agent findings)
   ├─ .workflow/.planning/{sessionId}/conflicts.json (decision points)
   ├─ .workflow/.planning/{sessionId}/synthesis.md (task breakdown)
   └─ Optional: Feed to /workflow:unified-execute-with-file
```

## Implementation

### Session Setup & Input Loading

```javascript
const getUtc8ISOString = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()

// Parse arguments
const planningTopic = "$PLANNING_TOPIC"
const inputType = $ARGUMENTS.match(/--from\s+(\w+)/)?.[1] || 'raw'
const isAutoMode = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const isContinue = $ARGUMENTS.includes('--continue') || $ARGUMENTS.includes('-c')

// Auto-detect artifact if referenced
let artifact = null
let artifactContent = null

if (inputType === 'brainstorm' || planningTopic.startsWith('BS-')) {
  const sessionId = planningTopic
  const synthesisPath = `.workflow/.brainstorm/${sessionId}/synthesis.json`
  if (fs.existsSync(synthesisPath)) {
    artifact = { type: 'brainstorm', path: synthesisPath }
    artifactContent = JSON.parse(Read(synthesisPath))
  }
} else if (inputType === 'analysis' || planningTopic.startsWith('ANL-')) {
  const sessionId = planningTopic
  const conclusionsPath = `.workflow/.analysis/${sessionId}/conclusions.json`
  if (fs.existsSync(conclusionsPath)) {
    artifact = { type: 'analysis', path: conclusionsPath }
    artifactContent = JSON.parse(Read(conclusionsPath))
  }
}

// Generate session ID
const planSlug = planningTopic.toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
  .substring(0, 30)
const dateStr = getUtc8ISOString().substring(0, 10)
const sessionId = `PLAN-${planSlug}-${dateStr}`
const sessionFolder = `.workflow/.planning/${sessionId}`

// Session mode detection
const sessionExists = fs.existsSync(sessionFolder)
const hasPlan = sessionExists && fs.existsSync(`${sessionFolder}/plan.md`)
const mode = (hasPlan || isContinue) ? 'continue' : 'new'

if (!sessionExists) {
  bash(`mkdir -p ${sessionFolder}`)
}
```

---

### Phase 1: Initialize plan.md (Minimal)

```markdown
# Quick Planning Session

**Session ID**: ${sessionId}
**Topic**: ${planningTopic}
**Started**: ${getUtc8ISOString()}
**Mode**: ${mode}

---

## Input Context

${artifact ? `
**Source**: ${artifact.type} artifact
**Path**: ${artifact.path}

**Artifact Summary**:
${artifact.type === 'brainstorm' ? `
- Topic: ${artifactContent.topic}
- Top Ideas: ${artifactContent.top_ideas?.length || 0}
- Key Insights: ${artifactContent.key_insights?.slice(0, 2).join(', ') || 'N/A'}
` : artifact.type === 'analysis' ? `
- Topic: ${artifactContent.topic}
- Key Conclusions: ${artifactContent.key_conclusions?.length || 0}
- Recommendations: ${artifactContent.recommendations?.length || 0}
` : ''}
` : `
**User Input**: ${planningTopic}
`}

---

## Planning Dimensions

*To be populated after agent analysis*

---

## Key Decisions

*Conflict resolution and recommendations - to be populated*

---

## Implementation Plan

*Task breakdown - to be populated after synthesis*

---

## Progress

- [ ] Multi-agent analysis
- [ ] Conflict detection
- [ ] Plan synthesis
- [ ] Ready for execution
```

---

### Phase 2: Parallel Multi-Agent Analysis

```javascript
const analysisPrompt = artifact
  ? `Convert ${artifact.type} artifact to planning requirements and execute parallel analysis`
  : `Create planning breakdown for: ${planningTopic}`

// Prepare context for agents
const agentContext = {
  topic: planningTopic,
  artifact: artifact ? {
    type: artifact.type,
    summary: extractArtifactSummary(artifactContent)
  } : null,
  planning_focus: determineFocusAreas(planningTopic),
  constraints: extractConstraints(planningTopic, artifactContent)
}

// Agent 1: Architecture & Design
const archPromise = Bash({
  command: `ccw cli -p "
PURPOSE: Architecture & high-level design planning for '${planningTopic}'
Success: Clear component decomposition, interface design, and data flow

TASK:
• Decompose problem into major components/modules
• Identify architectural patterns and integration points
• Design interfaces and data models
• Assess scalability and maintainability implications
• Propose architectural approach with rationale

MODE: analysis

CONTEXT: @**/*
${artifact ? `| Source artifact: ${artifact.type}` : ''}

EXPECTED:
- Component decomposition (box diagram in text)
- Module interfaces and responsibilities
- Data flow between components
- Architectural patterns applied
- Scalability assessment (1-5 rating)
- Risks from architectural perspective

CONSTRAINTS: Focus on long-term maintainability
" --tool gemini --mode analysis`,
  run_in_background: true
})

// Agent 2: Implementation & Feasibility
const implPromise = Bash({
  command: `ccw cli -p "
PURPOSE: Implementation approach & technical feasibility for '${planningTopic}'
Success: Concrete implementation strategy with realistic resource estimates

TASK:
• Evaluate technical feasibility of approach
• Identify required technologies and dependencies
• Estimate effort: high/medium/low + rationale
• Suggest implementation phases and milestones
• Highlight technical blockers or challenges

MODE: analysis

CONTEXT: @**/*
${artifact ? `| Source artifact: ${artifact.type}` : ''}

EXPECTED:
- Technology stack recommendation
- Implementation complexity: high|medium|low with justification
- Estimated effort breakdown (analysis/design/coding/testing/deployment)
- Key technical decisions with tradeoffs
- Potential blockers and mitigations
- Suggested implementation phases
- Reusable components or libraries

CONSTRAINTS: Realistic with current tech stack
" --tool codex --mode analysis`,
  run_in_background: true
})

// Agent 3: Risk & Validation
const riskPromise = Bash({
  command: `ccw cli -p "
PURPOSE: Risk analysis and validation strategy for '${planningTopic}'
Success: Comprehensive risk matrix with testing strategy

TASK:
• Identify technical risks and failure scenarios
• Assess business/timeline risks
• Define validation/testing strategy
• Suggest monitoring and observability requirements
• Rate overall risk level (low/medium/high)

MODE: analysis

CONTEXT: @**/*
${artifact ? `| Source artifact: ${artifact.type}` : ''}

EXPECTED:
- Risk matrix (likelihood × impact, 1-5 each)
- Top 3 technical risks with mitigations
- Top 3 timeline/resource risks with mitigations
- Testing strategy (unit/integration/e2e/performance)
- Deployment strategy and rollback plan
- Monitoring/observability requirements
- Overall risk rating with confidence (low/medium/high)

CONSTRAINTS: Be realistic, not pessimistic
" --tool claude --mode analysis`,
  run_in_background: true
})

// Agent 4: Decisions & Recommendations
const decisionPromise = Bash({
  command: `ccw cli -p "
PURPOSE: Strategic decisions and execution recommendations for '${planningTopic}'
Success: Clear recommended approach with tradeoff analysis

TASK:
• Synthesize all considerations into recommendations
• Clearly identify critical decision points
• Outline key tradeoffs (speed vs quality, scope vs timeline, etc.)
• Propose go/no-go decision criteria
• Suggest execution strategy and sequencing

MODE: analysis

CONTEXT: @**/*
${artifact ? `| Source artifact: ${artifact.type}` : ''}

EXPECTED:
- Primary recommendation with strong rationale
- Alternative approaches with pros/cons
- 2-3 critical decision points with recommended choices
- Key tradeoffs and what we're optimizing for
- Success metrics and go/no-go criteria
- Suggested execution sequencing
- Resource requirements and dependencies

CONSTRAINTS: Focus on actionable decisions, not analysis
" --tool gemini --mode analysis`,
  run_in_background: true
})

// Wait for all parallel analyses
const [archResult, implResult, riskResult, decisionResult] = await Promise.all([
  archPromise, implPromise, riskPromise, decisionPromise
])
```

---

### Phase 3: Aggregate Perspectives

```javascript
// Parse and structure agent findings
const perspectives = {
  session_id: sessionId,
  timestamp: getUtc8ISOString(),
  topic: planningTopic,
  source_artifact: artifact?.type || 'raw',

  architecture: {
    source: 'gemini (design)',
    components: extractComponents(archResult),
    interfaces: extractInterfaces(archResult),
    patterns: extractPatterns(archResult),
    scalability_rating: extractRating(archResult, 'scalability'),
    risks_from_design: extractRisks(archResult)
  },

  implementation: {
    source: 'codex (pragmatic)',
    technology_stack: extractStack(implResult),
    complexity: extractComplexity(implResult),
    effort_breakdown: extractEffort(implResult),
    blockers: extractBlockers(implResult),
    phases: extractPhases(implResult)
  },

  validation: {
    source: 'claude (systematic)',
    risk_matrix: extractRiskMatrix(riskResult),
    top_risks: extractTopRisks(riskResult),
    testing_strategy: extractTestingStrategy(riskResult),
    deployment_strategy: extractDeploymentStrategy(riskResult),
    monitoring_requirements: extractMonitoring(riskResult),
    overall_risk_rating: extractRiskRating(riskResult)
  },

  recommendation: {
    source: 'gemini (synthesis)',
    primary_approach: extractPrimaryApproach(decisionResult),
    alternatives: extractAlternatives(decisionResult),
    critical_decisions: extractDecisions(decisionResult),
    tradeoffs: extractTradeoffs(decisionResult),
    success_criteria: extractCriteria(decisionResult),
    execution_sequence: extractSequence(decisionResult)
  },

  analysis_timestamp: getUtc8ISOString()
}

Write(`${sessionFolder}/perspectives.json`, JSON.stringify(perspectives, null, 2))
```

---

### Phase 4: Conflict Detection & Resolution

```javascript
// Analyze for conflicts and contradictions
const conflicts = detectConflicts({
  arch_vs_impl: compareArchitectureAndImplementation(perspectives),
  design_vs_risk: compareDesignAndRisk(perspectives),
  effort_vs_scope: compareEffortAndScope(perspectives),
  timeline_implications: extractTimingConflicts(perspectives)
})

// If conflicts exist, invoke arbitration agent
if (conflicts.critical.length > 0) {
  const arbitrationResult = await Bash({
    command: `ccw cli -p "
PURPOSE: Resolve planning conflicts and generate unified recommendation
Input: ${JSON.stringify(conflicts, null, 2)}

TASK:
• Review all conflicts presented
• Recommend resolution for each critical conflict
• Explain tradeoff choices
• Identify what we're optimizing for (speed/quality/risk/resource)
• Generate unified execution strategy

MODE: analysis

EXPECTED:
- For each conflict: recommended resolution + rationale
- Unified optimization criteria (what matters most?)
- Final recommendation with confidence level
- Any unresolved tensions that need user input

CONSTRAINTS: Be decisive, not fence-sitting
" --tool gemini --mode analysis`,
    run_in_background: false
  })

  const conflictResolution = {
    detected_conflicts: conflicts,
    arbitration_result: arbitrationResult,
    timestamp: getUtc8ISOString()
  }

  Write(`${sessionFolder}/conflicts.json`, JSON.stringify(conflictResolution, null, 2))
}
```

---

### Phase 5: Plan Synthesis & Task Breakdown

```javascript
const synthesisPrompt = `
Given the planning context:
- Topic: ${planningTopic}
- Architecture: ${perspectives.architecture.components.map(c => c.name).join(', ')}
- Implementation Complexity: ${perspectives.implementation.complexity}
- Timeline Risk: ${perspectives.validation.overall_risk_rating}
- Primary Recommendation: ${perspectives.recommendation.primary_approach.summary}

Generate a minimal but complete implementation plan with:
1. Task breakdown (5-8 major tasks)
2. Dependencies between tasks
3. For each task: what needs to be done, why, and key considerations
4. Success criteria for the entire effort
5. Known risks and mitigation strategies

Output as structured task list ready for execution.
`

const synthesisResult = await Bash({
  command: `ccw cli -p "${synthesisPrompt}" --tool gemini --mode analysis`,
  run_in_background: false
})

// Parse synthesis and generate task breakdown
const tasks = parseTaskBreakdown(synthesisResult)

const synthesis = {
  session_id: sessionId,
  planning_topic: planningTopic,
  completed: getUtc8ISOString(),

  // Summary
  executive_summary: perspectives.recommendation.primary_approach.summary,
  optimization_focus: extractOptimizationFocus(perspectives),

  // Architecture
  architecture_approach: perspectives.architecture.patterns[0] || 'TBD',
  key_components: perspectives.architecture.components.slice(0, 5),

  // Implementation
  technology_stack: perspectives.implementation.technology_stack,
  complexity_level: perspectives.implementation.complexity,
  estimated_effort: perspectives.implementation.effort_breakdown,

  // Risks & Validation
  top_risks: perspectives.validation.top_risks.slice(0, 3),
  testing_approach: perspectives.validation.testing_strategy,

  // Execution
  phases: perspectives.implementation.phases,
  critical_path_tasks: extractCriticalPath(tasks),
  total_tasks: tasks.length,

  // Task breakdown (ready for unified-execute-with-file)
  tasks: tasks.map(task => ({
    id: task.id,
    title: task.title,
    description: task.description,
    type: task.type,
    dependencies: task.dependencies,
    effort_estimate: task.effort,
    success_criteria: task.criteria
  }))
}

Write(`${sessionFolder}/synthesis.md`, formatSynthesisMarkdown(synthesis))
Write(`${sessionFolder}/synthesis.json`, JSON.stringify(synthesis, null, 2))
```

---

### Phase 6: Update plan.md with Results

```markdown
# Quick Planning Session

**Session ID**: ${sessionId}
**Topic**: ${planningTopic}
**Started**: ${startTime}
**Completed**: ${completionTime}

---

## Executive Summary

${synthesis.executive_summary}

**Optimization Focus**: ${synthesis.optimization_focus}
**Complexity**: ${synthesis.complexity_level}
**Estimated Effort**: ${formatEffort(synthesis.estimated_effort)}

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

**Overall Risk Level**: ${synthesis.top_risks[0].risk_level}

**Top 3 Risks**:
${synthesis.top_risks.map((r, i) => `
${i+1}. **${r.title}** (Impact: ${r.impact})
   - Mitigation: ${r.mitigation}
`).join('\n')}

**Testing Approach**: ${synthesis.testing_approach}

---

## Execution Plan

**Total Tasks**: ${synthesis.total_tasks}
**Critical Path**: ${synthesis.critical_path_tasks.map(t => t.id).join(' → ')}

### Task Breakdown

${synthesis.tasks.map((task, i) => `
${i+1}. **${task.id}: ${task.title}** (Effort: ${task.effort_estimate})
   - ${task.description}
   - Depends on: ${task.dependencies.join(', ') || 'none'}
   - Success: ${task.success_criteria}
`).join('\n')}

---

## Next Steps

**Recommended**: Execute with \`/workflow:unified-execute-with-file\` using:
\`\`\`
/workflow:unified-execute-with-file -p ${sessionFolder}/synthesis.json
\`\`\`

---

## Artifacts

- **Perspectives**: ${sessionFolder}/perspectives.json (all agent findings)
- **Conflicts**: ${sessionFolder}/conflicts.json (decision points and resolutions)
- **Synthesis**: ${sessionFolder}/synthesis.json (task breakdown for execution)
```

---

## Session Folder Structure

```
.workflow/.planning/{sessionId}/
├── plan.md              # Minimal, actionable planning doc
├── perspectives.json    # Multi-agent findings (architecture, impl, risk, decision)
├── conflicts.json       # Detected conflicts and resolutions (if any)
├── synthesis.json       # Task breakdown ready for execution
└── synthesis.md         # Human-readable execution plan
```

---

## Multi-Agent Roles

| Agent | Focus | Input | Output |
|-------|-------|-------|--------|
| **Gemini (Design)** | Architecture & design patterns | Topic + constraints | Components, interfaces, patterns, scalability |
| **Codex (Pragmatic)** | Implementation reality | Topic + architecture | Tech stack, effort, phases, blockers |
| **Claude (Validation)** | Risk & testing | Architecture + impl | Risk matrix, test strategy, monitoring |
| **Gemini (Decision)** | Synthesis & strategy | All findings | Recommendations, tradeoffs, execution plan |

---

## Conflict Resolution Strategy

**Auto-Resolution for conflicts**:
1. **Architecture vs Implementation**: Recommend design-for-feasibility approach
2. **Scope vs Timeline**: Prioritize critical path, defer nice-to-haves
3. **Quality vs Speed**: Suggest iterative approach (MVP + iterations)
4. **Resource vs Effort**: Identify parallelizable tasks

**Require User Input for**:
- Strategic choices (which feature to prioritize?)
- Tool/technology decisions with strong team preferences
- Budget/resource constraints not stated in planning topic

---

## Continue & Resume

```bash
/workflow:quick-plan-with-file --continue "planning-topic"
```

When continuing:
1. Load existing plan.md and perspectives.json
2. Identify what's incomplete
3. Re-run affected agents (if planning has changed)
4. Update plan.md with new findings
5. Generate updated synthesis.json

---

## Integration Flow

```
Input Source:
  ├─ Raw task description
  ├─ Brainstorm synthesis.json
  └─ Analysis conclusions.json
       ↓
/workflow:quick-plan-with-file
       ↓
plan.md + synthesis.json
       ↓
/workflow:unified-execute-with-file
       ↓
Implementation
```

---

## Usage Patterns

### Pattern 1: Quick Planning from Task

```bash
# User has a task, needs rapid multi-perspective plan
/workflow:quick-plan-with-file -y "实现实时通知系统，支持推送和WebSocket"
# → Creates plan in ~5 minutes
# → Ready for execution
```

### Pattern 2: Convert Brainstorm to Executable Plan

```bash
# User completed brainstorm, wants to convert top idea to executable plan
/workflow:quick-plan-with-file --from brainstorm BS-notifications-2025-01-28
# → Reads synthesis.json from brainstorm
# → Generates implementation plan
# → Ready for unified-execute-with-file
```

### Pattern 3: From Analysis to Implementation

```bash
# Analysis completed, now need execution plan
/workflow:quick-plan-with-file --from analysis ANL-auth-architecture-2025-01-28
# → Reads conclusions.json from analysis
# → Generates planning with recommendations
# → Output task breakdown
```

### Pattern 4: Planning with Interactive Conflict Resolution

```bash
# Full planning with user involvement in decision-making
/workflow:quick-plan-with-file "新的支付流程集成"
# → Without -y flag
# → After conflict detection, asks user about tradeoffs
# → Generates plan based on user preferences
```

---

## Comparison with Other Workflows

| Feature | brainstorm | analyze | quick-plan | plan |
|---------|-----------|---------|-----------|------|
| **Purpose** | Ideation | Investigation | Lightweight planning | Detailed planning |
| **Multi-agent** | 3 perspectives | 2 CLI + explore | 4 concurrent agents | N/A (single) |
| **Documentation** | Extensive | Extensive | Minimal | Standard |
| **Output** | Ideas + synthesis | Conclusions | Executable tasks | IMPL_PLAN |
| **Typical Duration** | 30-60 min | 20-30 min | 5-10 min | 15-20 min |
| **User Interaction** | High (multi-round) | High (Q&A) | Low (decisions) | Medium |

---

## Error Handling

| Situation | Action |
|-----------|--------|
| Agents conflict on approach | Arbitration agent decides, document in conflicts.json |
| Missing critical files | Continue with available context, note limitations |
| Insufficient task breakdown | Ask user for planning focus areas |
| Effort estimate too high | Suggest MVP approach or phasing |
| Unclear requirements | Ask clarifying questions via AskUserQuestion |
| Agent timeout | Use last successful result, note partial analysis |

---

## Best Practices

1. **Use when**:
   - You have clarity on WHAT but not HOW
   - Need rapid multi-perspective planning
   - Converting brainstorm/analysis into execution
   - Want minimal planning overhead

2. **Avoid when**:
   - Requirements are highly ambiguous (use brainstorm instead)
   - Need deep investigation (use analyze instead)
   - Want extensive planning document (use plan instead)
   - No tech stack clarity (use analyze first)

3. **For best results**:
   - Provide complete task/requirement description
   - Include constraints and success criteria
   - Specify preferences (speed vs quality vs risk)
   - Review conflicts.json and make conscious tradeoff decisions

---

## Next Steps After Planning

### Feed to Execution
```bash
/workflow:unified-execute-with-file -p .workflow/.planning/{sessionId}/synthesis.json
```

### Detailed Planning if Needed
```bash
/workflow:plan "Based on quick-plan recommendations..."
```

### Continuous Refinement
```bash
/workflow:quick-plan-with-file --continue "{topic}"  # Update plan with new constraints
```
