# Phase 4: Synthesize

> **COMPACT SENTINEL [Phase 4: Synthesize]**
> This phase contains 4 execution steps (Step 4.1 -- 4.4).
> If you can read this sentinel but cannot find the full Step protocol below, context has been compressed.
> Recovery: `Read("phases/04-synthesize.md")`

Synthesize all step analyses into cross-step insights. Evaluates the workflow as a whole: step ordering, handoff quality, redundancy, bottlenecks, and overall coherence.

## Objective

- Read complete process-log.md and all step analyses
- Build synthesis prompt with full workflow context
- Execute via ccw cli Gemini with resume chain
- Generate cross-step optimization insights
- Write synthesis.md

## Execution

### Step 4.1: Gather All Analyses

```javascript
// Read process log
const processLog = Read(`${state.work_dir}/process-log.md`);

// Read all step analysis files
const stepAnalyses = state.steps.map((step, i) => {
  const analysisFile = `${state.work_dir}/steps/step-${i + 1}/step-${i + 1}-analysis.md`;
  try {
    return { step: step.name, index: i, content: Read(analysisFile) };
  } catch {
    return { step: step.name, index: i, content: '[Analysis not available]' };
  }
});

// Build score summary
const scoreSummary = state.steps.map((s, i) =>
  `Step ${i + 1} (${s.name}): ${s.analysis?.quality_score || '-'}/100 | Issues: ${s.analysis?.issue_count || 0} (${s.analysis?.high_issues || 0} high)`
).join('\n');

// Compute aggregate stats
const scores = state.steps.map(s => s.analysis?.quality_score).filter(Boolean);
const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
const minScore = scores.length > 0 ? Math.min(...scores) : 0;
const totalIssues = state.steps.reduce((sum, s) => sum + (s.analysis?.issue_count || 0), 0);
const totalHighIssues = state.steps.reduce((sum, s) => sum + (s.analysis?.high_issues || 0), 0);
```

### Step 4.2: Construct Synthesis Prompt

```javascript
// Ref: templates/synthesis-prompt.md

const synthesisPrompt = `PURPOSE: Synthesize all step analyses into a holistic workflow optimization assessment. Evaluate cross-step concerns: ordering, handoff quality, redundancy, bottlenecks, and overall workflow coherence.

WORKFLOW OVERVIEW:
Name: ${state.workflow_name}
Goal: ${state.workflow_context}
Steps: ${state.steps.length}
Average Quality: ${avgScore}/100
Weakest Step: ${minScore}/100
Total Issues: ${totalIssues} (${totalHighIssues} high severity)

SCORE SUMMARY:
${scoreSummary}

COMPLETE PROCESS LOG:
${processLog}

DETAILED STEP ANALYSES:
${stepAnalyses.map(a => `### ${a.step} (Step ${a.index + 1})\n${a.content}`).join('\n\n---\n\n')}

TASK:
1. **Workflow Coherence**: Do steps form a logical sequence? Any missing steps?
2. **Handoff Quality**: Are step outputs well-consumed by subsequent steps? Data format mismatches?
3. **Redundancy Detection**: Do any steps duplicate work? Overlapping concerns?
4. **Bottleneck Identification**: Which steps are bottlenecks (lowest quality, longest duration)?
5. **Step Ordering**: Would reordering steps improve outcomes?
6. **Missing Steps**: Are there gaps in the pipeline that need additional steps?
7. **Per-Step Optimization**: Top 3 improvements per underperforming step
8. **Workflow-Level Optimization**: Structural changes to the overall pipeline

EXPECTED OUTPUT (strict JSON, no markdown):
{
  "workflow_score": <0-100>,
  "coherence": {
    "score": <0-100>,
    "assessment": "<logical flow evaluation>",
    "gaps": ["<missing step or transition>"]
  },
  "handoff_quality": {
    "score": <0-100>,
    "issues": [
      { "from_step": "<step name>", "to_step": "<step name>", "issue": "<description>", "fix": "<suggestion>" }
    ]
  },
  "redundancy": {
    "found": <true|false>,
    "items": [
      { "steps": ["<step1>", "<step2>"], "description": "<what overlaps>", "recommendation": "<merge or remove>" }
    ]
  },
  "bottlenecks": [
    { "step": "<step name>", "reason": "<why it's a bottleneck>", "impact": "high|medium|low", "fix": "<suggestion>" }
  ],
  "ordering_suggestions": [
    { "current": "<current order description>", "proposed": "<new order>", "rationale": "<why>" }
  ],
  "per_step_improvements": [
    { "step": "<step name>", "improvements": [
      { "priority": "high|medium|low", "description": "<what to change>", "rationale": "<why>" }
    ]}
  ],
  "workflow_improvements": [
    { "priority": "high|medium|low", "category": "structure|handoff|performance|quality", "description": "<change>", "rationale": "<why>", "affected_steps": ["<step names>"] }
  ],
  "summary": "<2-3 sentence executive summary of workflow health and top recommendations>"
}

CONSTRAINTS: Be specific, reference step names and artifact details, output ONLY JSON`;
```

### Step 4.3: Execute via ccw cli Gemini with Resume

```javascript
function escapeForShell(str) {
  return str.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
}

let cliCommand = `ccw cli -p "${escapeForShell(synthesisPrompt)}" --tool gemini --mode analysis`;

// Resume from the last step's analysis session
if (state.analysis_session_id) {
  cliCommand += ` --resume ${state.analysis_session_id}`;
}

Bash({
  command: cliCommand,
  run_in_background: true,
  timeout: 300000
});

// STOP — wait for hook callback
```

### Step 4.4: Parse Results and Write Synthesis

After CLI completes:

```javascript
const rawOutput = /* CLI output from callback */;
const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
let synthesis;

if (jsonMatch) {
  try {
    synthesis = JSON.parse(jsonMatch[0]);
  } catch {
    synthesis = {
      workflow_score: avgScore,
      summary: 'Synthesis parsing failed — individual step analyses available',
      workflow_improvements: [],
      per_step_improvements: [],
      bottlenecks: [],
      handoff_quality: { score: 0, issues: [] },
      coherence: { score: 0, assessment: 'Parse error' },
      redundancy: { found: false, items: [] },
      ordering_suggestions: []
    };
  }
} else {
  synthesis = {
    workflow_score: avgScore,
    summary: 'No synthesis output received',
    workflow_improvements: [],
    per_step_improvements: []
  };
}

// Write synthesis report
const synthesisReport = `# Workflow Synthesis

**Workflow Score**: ${synthesis.workflow_score}/100
**Date**: ${new Date().toISOString()}

## Executive Summary
${synthesis.summary}

## Coherence (${synthesis.coherence?.score || '-'}/100)
${synthesis.coherence?.assessment || 'N/A'}
${(synthesis.coherence?.gaps || []).length > 0 ? '\n### Gaps\n' + synthesis.coherence.gaps.map(g => `- ${g}`).join('\n') : ''}

## Handoff Quality (${synthesis.handoff_quality?.score || '-'}/100)
${(synthesis.handoff_quality?.issues || []).map(i =>
  `- **${i.from_step} → ${i.to_step}**: ${i.issue}\n  Fix: ${i.fix}`
).join('\n') || 'No handoff issues'}

## Redundancy
${synthesis.redundancy?.found ? (synthesis.redundancy.items || []).map(r =>
  `- Steps ${r.steps.join(', ')}: ${r.description} → ${r.recommendation}`
).join('\n') : 'No redundancy detected'}

## Bottlenecks
${(synthesis.bottlenecks || []).map(b =>
  `- **${b.step}** [${b.impact}]: ${b.reason}\n  Fix: ${b.fix}`
).join('\n') || 'No bottlenecks'}

## Ordering Suggestions
${(synthesis.ordering_suggestions || []).map(o =>
  `- Current: ${o.current}\n  Proposed: ${o.proposed}\n  Rationale: ${o.rationale}`
).join('\n') || 'Current ordering is optimal'}

## Per-Step Improvements
${(synthesis.per_step_improvements || []).map(s =>
  `### ${s.step}\n` + (s.improvements || []).map(i =>
    `- [${i.priority}] ${i.description} — ${i.rationale}`
  ).join('\n')
).join('\n\n') || 'No per-step improvements'}

## Workflow-Level Improvements
${(synthesis.workflow_improvements || []).map((w, i) =>
  `### ${i + 1}. [${w.priority}] ${w.description}\n- Category: ${w.category}\n- Rationale: ${w.rationale}\n- Affected: ${(w.affected_steps || []).join(', ')}`
).join('\n\n') || 'No workflow-level improvements'}
`;

Write(`${state.work_dir}/synthesis.md`, synthesisReport);

// Update state
state.synthesis = {
  workflow_score: synthesis.workflow_score,
  summary: synthesis.summary,
  improvement_count: (synthesis.workflow_improvements || []).length +
    (synthesis.per_step_improvements || []).reduce((sum, s) => sum + (s.improvements || []).length, 0),
  high_priority_count: (synthesis.workflow_improvements || []).filter(w => w.priority === 'high').length,
  bottleneck_count: (synthesis.bottlenecks || []).length,
  handoff_issue_count: (synthesis.handoff_quality?.issues || []).length,
  synthesis_file: `${state.work_dir}/synthesis.md`,
  raw_data: synthesis
};

state.updated_at = new Date().toISOString();
Write(`${state.work_dir}/workflow-state.json`, JSON.stringify(state, null, 2));
```

## Error Handling

| Error | Recovery |
|-------|----------|
| CLI timeout | Generate synthesis from individual step analyses only (no cross-step) |
| Resume fails | Start fresh analysis session |
| JSON parse fails | Use step-level data to construct minimal synthesis |

## Output

- **Files**: `synthesis.md`
- **State**: `state.synthesis` updated
- **Next**: Phase 5 (Optimization Report)
