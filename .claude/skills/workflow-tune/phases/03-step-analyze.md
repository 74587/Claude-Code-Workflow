# Phase 3: Analyze Step

> **COMPACT SENTINEL [Phase 3: Analyze Step]**
> This phase contains 5 execution steps (Step 3.1 -- 3.5).
> If you can read this sentinel but cannot find the full Step protocol below, context has been compressed.
> Recovery: `Read("phases/03-step-analyze.md")`

Analyze a completed step's artifacts and quality using `ccw cli --tool gemini --mode analysis`. Uses `--resume` to maintain context across step analyses, building a continuous analysis chain.

## Objective

- Inspect step artifacts (file list, content, quality signals)
- Build analysis prompt with step context + prior process log
- Execute via ccw cli Gemini with resume chain
- Parse analysis results → write step-{N}-analysis.md
- Append findings to process-log.md
- Return updated session ID for resume chain

## Execution

### Step 3.1: Inspect Artifacts

```javascript
const stepIdx = currentStepIndex;
const step = state.steps[stepIdx];
const stepDir = `${state.work_dir}/steps/step-${stepIdx + 1}`;

// Read artifacts manifest
const manifest = JSON.parse(Read(`${stepDir}/artifacts-manifest.json`));

// Build artifact summary based on analysis depth
let artifactSummary = '';

if (state.analysis_depth === 'quick') {
  // Quick: just file list and sizes
  artifactSummary = `Artifacts (${manifest.artifacts.length} files):\n` +
    manifest.artifacts.map(a => `- ${a.path} (${a.type})`).join('\n');
} else {
  // Standard/Deep: include file content summaries
  artifactSummary = manifest.artifacts.map(a => {
    const maxLines = state.analysis_depth === 'deep' ? 300 : 150;
    try {
      const content = Read(a.path, { limit: maxLines });
      return `--- ${a.path} (${a.type}) ---\n${content}`;
    } catch {
      return `--- ${a.path} --- [unreadable]`;
    }
  }).join('\n\n');

  // Deep: also include scratchpad files
  if (state.analysis_depth === 'deep' && manifest.scratchpad_files?.length > 0) {
    artifactSummary += '\n\n--- Scratchpad Files ---\n' +
      manifest.scratchpad_files.slice(0, 5).map(f => {
        const content = Read(f, { limit: 100 });
        return `--- ${f} ---\n${content}`;
      }).join('\n\n');
  }
}

// Execution result summary
const execSummary = `Execution: ${step.execution.method} | ` +
  `Success: ${step.execution.success} | ` +
  `Duration: ${step.execution.duration_ms}ms | ` +
  `Artifacts: ${manifest.artifacts.length} files`;
```

### Step 3.2: Build Prior Context

```javascript
// Build accumulated process log context for this analysis
const priorProcessLog = Read(`${state.work_dir}/process-log.md`);

// Build step chain context (what came before, what comes after)
const stepChainContext = state.steps.map((s, i) => {
  const status = i < stepIdx ? 'completed' : i === stepIdx ? 'CURRENT' : 'pending';
  const score = s.analysis?.quality_score || '-';
  return `${i + 1}. [${status}] ${s.name} (${s.type}) — Quality: ${score}`;
}).join('\n');

// Previous step handoff context (if not first step)
let handoffContext = '';
if (stepIdx > 0) {
  const prevStep = state.steps[stepIdx - 1];
  const prevAnalysis = prevStep.analysis;
  if (prevAnalysis) {
    handoffContext = `PREVIOUS STEP OUTPUT SUMMARY:
Step "${prevStep.name}" produced ${prevStep.execution?.artifact_count || 0} artifacts.
Quality: ${prevAnalysis.quality_score}/100
Key outputs: ${prevAnalysis.key_outputs?.join(', ') || 'unknown'}
Handoff notes: ${prevAnalysis.handoff_notes || 'none'}`;
  }
}
```

### Step 3.3: Construct Analysis Prompt

```javascript
// Ref: templates/step-analysis-prompt.md

const depthInstructions = {
  quick: 'Provide brief assessment (3-5 bullet points). Focus on: execution success, output completeness, obvious issues.',
  standard: 'Provide detailed assessment. Cover: execution quality, output completeness, artifact quality, step-to-step handoff readiness, potential issues.',
  deep: 'Provide exhaustive assessment. Cover: execution quality, output completeness and correctness, artifact quality and structure, step-to-step handoff integrity, error handling, performance signals, architecture implications, edge cases.'
};

// ★ Build test requirements section (the evaluation baseline)
const testReqs = step.test_requirements;
let testReqSection = '';
if (testReqs) {
  testReqSection = `
TEST REQUIREMENTS (Acceptance Criteria — use these as the PRIMARY evaluation baseline):
  Pass Criteria: ${testReqs.pass_criteria}
  Expected Outputs: ${(testReqs.expected_outputs || []).join(', ') || 'not specified'}
  Content Signals (patterns that indicate success): ${(testReqs.content_signals || []).join(', ') || 'not specified'}
  Quality Thresholds: ${(testReqs.quality_thresholds || []).join(', ') || 'not specified'}
  Fail Signals (patterns that indicate failure): ${(testReqs.fail_signals || []).join(', ') || 'not specified'}
  Handoff Contract (what next step needs): ${testReqs.handoff_contract || 'not specified'}

IMPORTANT: Score quality_score based on how well the actual output matches these test requirements.
  - 90-100: All pass_criteria met, all expected_outputs present, content_signals found, no fail_signals
  - 70-89: Most criteria met, minor gaps
  - 50-69: Partial match, significant gaps
  - 0-49: Fail — fail_signals present or pass_criteria not met`;
} else {
  testReqSection = `
NOTE: No pre-generated test requirements for this step. Evaluate based on general quality signals and workflow context.`;
}

const analysisPrompt = `PURPOSE: Evaluate workflow step "${step.name}" (step ${stepIdx + 1}/${state.steps.length}) against its acceptance criteria. Judge whether the command execution met the pre-defined test requirements.

WORKFLOW CONTEXT:
Name: ${state.workflow_name}
Goal: ${state.workflow_context}
Step Chain:
${stepChainContext}

CURRENT STEP:
Name: ${step.name}
Type: ${step.type}
Command: ${step.command}
${step.success_criteria ? `Success Criteria: ${step.success_criteria}` : ''}
${testReqSection}

EXECUTION RESULT:
${execSummary}

${handoffContext}

STEP ARTIFACTS:
${artifactSummary}

ANALYSIS DEPTH: ${state.analysis_depth}
${depthInstructions[state.analysis_depth]}

TASK:
1. **Requirement Matching**: Compare actual output against test requirements (pass_criteria, expected_outputs, content_signals)
2. **Fail Signal Detection**: Check for any fail_signals in the output
3. **Handoff Contract Verification**: Does the output satisfy handoff_contract for the next step?
4. **Gap Analysis**: What's missing between actual output and requirements?
5. **Quality Score**: Rate 0-100 based on requirement fulfillment (NOT general quality)

EXPECTED OUTPUT (strict JSON, no markdown):
{
  "quality_score": <0-100>,
  "requirement_match": {
    "pass": <true|false>,
    "criteria_met": ["<which pass_criteria were satisfied>"],
    "criteria_missed": ["<which pass_criteria were NOT satisfied>"],
    "expected_outputs_found": ["<expected files that exist>"],
    "expected_outputs_missing": ["<expected files that are absent>"],
    "content_signals_found": ["<success patterns detected in output>"],
    "content_signals_missing": ["<success patterns NOT found>"],
    "fail_signals_detected": ["<failure patterns found, if any>"]
  },
  "execution_assessment": {
    "success": <true|false>,
    "completeness": "<complete|partial|failed>",
    "notes": "<brief assessment>"
  },
  "artifact_assessment": {
    "count": <number>,
    "quality": "<high|medium|low>",
    "key_outputs": ["<main output 1>", "<main output 2>"],
    "missing_outputs": ["<expected but missing>"]
  },
  "handoff_assessment": {
    "ready": <true|false>,
    "contract_satisfied": <true|false|null>,
    "next_step_compatible": <true|false|null>,
    "handoff_notes": "<what next step should know>"
  },
  "issues": [
    { "severity": "high|medium|low", "description": "<issue>", "suggestion": "<fix>" }
  ],
  "optimization_opportunities": [
    { "area": "<area>", "description": "<opportunity>", "impact": "high|medium|low" }
  ],
  "step_summary": "<1-2 sentence summary for process log>"
}

CONSTRAINTS: Be specific, reference artifact content where possible, score against requirements not general quality, output ONLY JSON`;
```

### Step 3.4: Execute via ccw cli Gemini with Resume

```javascript
function escapeForShell(str) {
  return str.replace(/"/g, '\\"').replace(/\$/g, '\\$').replace(/`/g, '\\`');
}

// Build CLI command with optional resume
let cliCommand = `ccw cli -p "${escapeForShell(analysisPrompt)}" --tool gemini --mode analysis`;

// Resume from previous step's analysis session (maintains context chain)
if (state.analysis_session_id) {
  cliCommand += ` --resume ${state.analysis_session_id}`;
}

Bash({
  command: cliCommand,
  run_in_background: true,
  timeout: 300000  // 5 minutes
});

// STOP — wait for hook callback
```

### Step 3.5: Parse Results and Update Process Log

After CLI completes:

```javascript
const rawOutput = /* CLI output from callback */;

// Extract session ID from CLI output for resume chain
const sessionIdMatch = rawOutput.match(/\[CCW_EXEC_ID=([^\]]+)\]/);
if (sessionIdMatch) {
  state.analysis_session_id = sessionIdMatch[1];
}

// Parse JSON
const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
let analysis;

if (jsonMatch) {
  try {
    analysis = JSON.parse(jsonMatch[0]);
  } catch (e) {
    // Fallback: extract score heuristically
    const scoreMatch = rawOutput.match(/"quality_score"\s*:\s*(\d+)/);
    analysis = {
      quality_score: scoreMatch ? parseInt(scoreMatch[1]) : 50,
      execution_assessment: { success: step.execution.success, completeness: 'unknown', notes: 'Parse failed' },
      artifact_assessment: { count: manifest.artifacts.length, quality: 'unknown', key_outputs: [], missing_outputs: [] },
      handoff_assessment: { ready: true, next_step_compatible: null, handoff_notes: '' },
      issues: [{ severity: 'low', description: 'Analysis output parsing failed', suggestion: 'Review raw output' }],
      optimization_opportunities: [],
      step_summary: 'Analysis parsing failed — raw output saved for manual review'
    };
  }
} else {
  analysis = {
    quality_score: 50,
    step_summary: 'No structured analysis output received'
  };
}

// Write step analysis file
const reqMatch = analysis.requirement_match;
const reqMatchSection = reqMatch ? `
## Requirement Match — ${reqMatch.pass ? 'PASS ✓' : 'FAIL ✗'}

### Criteria Met
${(reqMatch.criteria_met || []).map(c => `- ✓ ${c}`).join('\n') || '- None'}

### Criteria Missed
${(reqMatch.criteria_missed || []).map(c => `- ✗ ${c}`).join('\n') || '- None'}

### Expected Outputs
- Found: ${(reqMatch.expected_outputs_found || []).join(', ') || 'None'}
- Missing: ${(reqMatch.expected_outputs_missing || []).join(', ') || 'None'}

### Content Signals
- Detected: ${(reqMatch.content_signals_found || []).join(', ') || 'None'}
- Missing: ${(reqMatch.content_signals_missing || []).join(', ') || 'None'}

### Fail Signals
${(reqMatch.fail_signals_detected || []).length > 0
  ? (reqMatch.fail_signals_detected || []).map(f => `- ⚠ ${f}`).join('\n')
  : '- None detected'}
` : '';

const stepAnalysisReport = `# Step ${stepIdx + 1} Analysis: ${step.name}

**Quality Score**: ${analysis.quality_score}/100
**Requirement Match**: ${reqMatch ? (reqMatch.pass ? 'PASS' : 'FAIL') : 'N/A (no test requirements)'}
**Date**: ${new Date().toISOString()}
${reqMatchSection}
## Execution
- Success: ${analysis.execution_assessment?.success}
- Completeness: ${analysis.execution_assessment?.completeness}
- Notes: ${analysis.execution_assessment?.notes}

## Artifacts
- Count: ${analysis.artifact_assessment?.count}
- Quality: ${analysis.artifact_assessment?.quality}
- Key Outputs: ${analysis.artifact_assessment?.key_outputs?.join(', ') || 'N/A'}
- Missing: ${analysis.artifact_assessment?.missing_outputs?.join(', ') || 'None'}

## Handoff Readiness
- Ready: ${analysis.handoff_assessment?.ready}
- Contract Satisfied: ${analysis.handoff_assessment?.contract_satisfied}
- Next Step Compatible: ${analysis.handoff_assessment?.next_step_compatible}
- Notes: ${analysis.handoff_assessment?.handoff_notes}

## Issues
${(analysis.issues || []).map(i => `- [${i.severity}] ${i.description} → ${i.suggestion}`).join('\n') || 'None'}

## Optimization Opportunities
${(analysis.optimization_opportunities || []).map(o => `- [${o.impact}] ${o.area}: ${o.description}`).join('\n') || 'None'}
`;

Write(`${stepDir}/step-${stepIdx + 1}-analysis.md`, stepAnalysisReport);

// Append to process log
const reqPassStr = reqMatch ? (reqMatch.pass ? 'PASS' : 'FAIL') : 'N/A';
const processLogEntry = `
## Step ${stepIdx + 1}: ${step.name} — Score: ${analysis.quality_score}/100 | Req: ${reqPassStr}

**Command**: \`${step.command}\`
**Result**: ${analysis.execution_assessment?.completeness || 'unknown'} | ${analysis.artifact_assessment?.count || 0} artifacts
**Requirement Match**: ${reqPassStr}${reqMatch ? ` — Met: ${(reqMatch.criteria_met || []).length}, Missed: ${(reqMatch.criteria_missed || []).length}, Fail Signals: ${(reqMatch.fail_signals_detected || []).length}` : ''}
**Summary**: ${analysis.step_summary || 'No summary'}
**Issues**: ${(analysis.issues || []).filter(i => i.severity === 'high').map(i => i.description).join('; ') || 'None critical'}
**Handoff**: ${analysis.handoff_assessment?.contract_satisfied ? 'Contract satisfied' : analysis.handoff_assessment?.handoff_notes || 'Ready'}

---
`;

// Append to process-log.md
const currentLog = Read(`${state.work_dir}/process-log.md`);
Write(`${state.work_dir}/process-log.md`, currentLog + processLogEntry);

// Update state
state.steps[stepIdx].analysis = {
  quality_score: analysis.quality_score,
  requirement_pass: reqMatch?.pass ?? null,
  criteria_met_count: (reqMatch?.criteria_met || []).length,
  criteria_missed_count: (reqMatch?.criteria_missed || []).length,
  fail_signals_count: (reqMatch?.fail_signals_detected || []).length,
  key_outputs: analysis.artifact_assessment?.key_outputs || [],
  handoff_notes: analysis.handoff_assessment?.handoff_notes || '',
  contract_satisfied: analysis.handoff_assessment?.contract_satisfied ?? null,
  issue_count: (analysis.issues || []).length,
  high_issues: (analysis.issues || []).filter(i => i.severity === 'high').length,
  optimization_count: (analysis.optimization_opportunities || []).length,
  analysis_file: `${stepDir}/step-${stepIdx + 1}-analysis.md`
};
state.steps[stepIdx].status = 'analyzed';

state.process_log_entries.push({
  step_index: stepIdx,
  step_name: step.name,
  quality_score: analysis.quality_score,
  summary: analysis.step_summary,
  timestamp: new Date().toISOString()
});

state.updated_at = new Date().toISOString();
Write(`${state.work_dir}/workflow-state.json`, JSON.stringify(state, null, 2));
```

## Error Handling

| Error | Recovery |
|-------|----------|
| CLI timeout | Retry once without --resume (fresh session) |
| Resume session not found | Start fresh analysis session, continue |
| JSON parse fails | Extract score heuristically, save raw output |
| No output | Default score 50, minimal process log entry |

## Output

- **Files**: `step-{N}-analysis.md`, updated `process-log.md`
- **State**: `steps[stepIdx].analysis` updated, `analysis_session_id` updated
- **Next**: Phase 2 for next step, or Phase 4 (Synthesize) if all steps done
