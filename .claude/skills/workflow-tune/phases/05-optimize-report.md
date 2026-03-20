# Phase 5: Optimization Report

> **COMPACT SENTINEL [Phase 5: Report]**
> This phase contains 4 execution steps (Step 5.1 -- 5.4).
> If you can read this sentinel but cannot find the full Step protocol below, context has been compressed.
> Recovery: `Read("phases/05-optimize-report.md")`

Generate the final optimization report and optionally apply high-priority fixes.

## Objective

- Read complete state, process log, synthesis
- Generate structured final report
- Optionally apply auto-fix (if enabled)
- Write final-report.md
- Display summary to user

## Execution

### Step 5.1: Read Complete State

```javascript
const state = JSON.parse(Read(`${state.work_dir}/workflow-state.json`));
const processLog = Read(`${state.work_dir}/process-log.md`);
const synthesis = state.synthesis;
state.status = 'completed';
state.updated_at = new Date().toISOString();
```

### Step 5.2: Generate Report

```javascript
// Compute stats
const scores = state.steps.map(s => s.analysis?.quality_score).filter(Boolean);
const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
const minStep = state.steps.reduce((min, s) =>
  (s.analysis?.quality_score || 100) < (min.analysis?.quality_score || 100) ? s : min
, state.steps[0]);

const totalIssues = state.steps.reduce((sum, s) => sum + (s.analysis?.issue_count || 0), 0);
const totalHighIssues = state.steps.reduce((sum, s) => sum + (s.analysis?.high_issues || 0), 0);

// Step quality table (with requirement match)
const stepTable = state.steps.map((s, i) => {
  const reqPass = s.analysis?.requirement_pass;
  const reqStr = reqPass === true ? 'PASS' : reqPass === false ? 'FAIL' : '-';
  return `| ${i + 1} | ${s.name} | ${s.type} | ${s.execution?.success ? 'OK' : 'FAIL'} | ${reqStr} | ${s.analysis?.quality_score || '-'} | ${s.analysis?.issue_count || 0} | ${s.analysis?.high_issues || 0} |`;
}).join('\n');

// Collect all improvements (workflow-level + per-step)
const allImprovements = [];
if (synthesis?.raw_data?.workflow_improvements) {
  synthesis.raw_data.workflow_improvements.forEach(w => {
    allImprovements.push({
      scope: 'workflow',
      priority: w.priority,
      description: w.description,
      rationale: w.rationale,
      category: w.category,
      affected: w.affected_steps || []
    });
  });
}
if (synthesis?.raw_data?.per_step_improvements) {
  synthesis.raw_data.per_step_improvements.forEach(s => {
    (s.improvements || []).forEach(imp => {
      allImprovements.push({
        scope: s.step,
        priority: imp.priority,
        description: imp.description,
        rationale: imp.rationale,
        category: 'step',
        affected: [s.step]
      });
    });
  });
}

// Sort by priority
const priorityOrder = { high: 0, medium: 1, low: 2 };
allImprovements.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2));

const report = `# Workflow Tune — Final Report

## Summary

| Field | Value |
|-------|-------|
| **Workflow** | ${state.workflow_name} |
| **Goal** | ${state.workflow_context} |
| **Steps** | ${state.steps.length} |
| **Workflow Score** | ${synthesis?.workflow_score || avgScore}/100 |
| **Average Step Quality** | ${avgScore}/100 |
| **Weakest Step** | ${minStep.name} (${minStep.analysis?.quality_score || '-'}/100) |
| **Total Issues** | ${totalIssues} (${totalHighIssues} high severity) |
| **Analysis Depth** | ${state.analysis_depth} |
| **Started** | ${state.started_at} |
| **Completed** | ${state.updated_at} |

## Step Quality Matrix

| # | Step | Type | Exec | Req Match | Quality | Issues | High |
|---|------|------|------|-----------|---------|--------|------|
${stepTable}

## Workflow Flow Assessment

### Coherence: ${synthesis?.raw_data?.coherence?.score || '-'}/100
${synthesis?.raw_data?.coherence?.assessment || 'Not evaluated'}

### Handoff Quality: ${synthesis?.raw_data?.handoff_quality?.score || '-'}/100
${(synthesis?.raw_data?.handoff_quality?.issues || []).map(i =>
  `- **${i.from_step} → ${i.to_step}**: ${i.issue}`
).join('\n') || 'No handoff issues'}

### Bottlenecks
${(synthesis?.raw_data?.bottlenecks || []).map(b =>
  `- **${b.step}** [${b.impact}]: ${b.reason}`
).join('\n') || 'No bottlenecks identified'}

## Optimization Recommendations

### Priority: HIGH
${allImprovements.filter(i => i.priority === 'high').map((i, idx) =>
  `${idx + 1}. **[${i.scope}]** ${i.description}\n   - Rationale: ${i.rationale}\n   - Affected: ${i.affected.join(', ')}`
).join('\n') || 'None'}

### Priority: MEDIUM
${allImprovements.filter(i => i.priority === 'medium').map((i, idx) =>
  `${idx + 1}. **[${i.scope}]** ${i.description}\n   - Rationale: ${i.rationale}`
).join('\n') || 'None'}

### Priority: LOW
${allImprovements.filter(i => i.priority === 'low').map((i, idx) =>
  `${idx + 1}. **[${i.scope}]** ${i.description}`
).join('\n') || 'None'}

## Process Documentation

Full process log: \`${state.work_dir}/process-log.md\`
Synthesis: \`${state.work_dir}/synthesis.md\`

### Per-Step Analysis Files

| Step | Analysis File |
|------|---------------|
${state.steps.map((s, i) =>
  `| ${s.name} | \`${state.work_dir}/steps/step-${i + 1}/step-${i + 1}-analysis.md\` |`
).join('\n')}

## Artifact Locations

| Path | Description |
|------|-------------|
| \`${state.work_dir}/workflow-state.json\` | Complete state |
| \`${state.work_dir}/process-log.md\` | Accumulated process log |
| \`${state.work_dir}/synthesis.md\` | Cross-step synthesis |
| \`${state.work_dir}/final-report.md\` | This report |
`;

Write(`${state.work_dir}/final-report.md`, report);
```

### Step 5.3: Optional Auto-Fix

```javascript
if (state.auto_fix && allImprovements.filter(i => i.priority === 'high').length > 0) {
  const highPriorityFixes = allImprovements.filter(i => i.priority === 'high');

  // ★ Safety: confirm with user before applying auto-fixes
  const fixList = highPriorityFixes.map((f, i) =>
    `${i + 1}. [${f.scope}] ${f.description}\n   Affected: ${f.affected.join(', ')}`
  ).join('\n');

  const autoFixConfirm = AskUserQuestion({
    questions: [{
      question: `以下 ${highPriorityFixes.length} 项高优先级优化将被自动应用：\n\n${fixList}\n\n确认应用？`,
      header: "Auto-Fix Confirmation",
      multiSelect: false,
      options: [
        { label: "Apply (应用)", description: "自动应用以上高优先级修复" },
        { label: "Skip (跳过)", description: "跳过自动修复，仅保留报告" }
      ]
    }]
  });

  if (autoFixConfirm["Auto-Fix Confirmation"].startsWith("Skip")) {
    // Skip auto-fix, just log it
    state.auto_fix_skipped = true;
  } else {

  Agent({
    subagent_type: 'general-purpose',
    run_in_background: false,
    description: 'Apply high-priority workflow optimizations',
    prompt: `## Task: Apply High-Priority Workflow Optimizations

You are applying the top optimization suggestions from a workflow analysis.

## Improvements to Apply (HIGH priority only)
${highPriorityFixes.map((f, i) =>
  `${i + 1}. [${f.scope}] ${f.description}\n   Rationale: ${f.rationale}\n   Affected: ${f.affected.join(', ')}`
).join('\n')}

## Workflow Steps
${state.steps.map((s, i) => `${i + 1}. ${s.name} (${s.type}): ${s.command}`).join('\n')}

## Rules
1. Read each affected file BEFORE modifying
2. Apply ONLY the high-priority suggestions
3. Preserve existing code style
4. Write a changes summary to: ${state.work_dir}/auto-fix-changes.md
`
  });

  } // end Apply branch
}
```

### Step 5.4: Display Summary

Output to user:

```
Workflow Tune Complete!

Workflow: {name}
Steps: {count}
Workflow Score: {score}/100
Average Step Quality: {avgScore}/100
Weakest Step: {name} ({score}/100)

Step Scores: {step1}={score1} → {step2}={score2} → ... → {stepN}={scoreN}

Issues: {total} ({high} high priority)
Improvements: {count} ({highCount} high priority)

Full report: {workDir}/final-report.md
Process log: {workDir}/process-log.md
```

## Output

- **Files**: `final-report.md`, optionally `auto-fix-changes.md`
- **State**: `status = completed`
- **Next**: Workflow complete. Return control to user.
