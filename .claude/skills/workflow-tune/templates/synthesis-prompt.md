# Synthesis Prompt Template

Phase 04 使用此模板构造 ccw cli 提示词，让 Gemini 综合所有步骤分析，产出跨步骤优化建议。

## Template

```
PURPOSE: Synthesize all step analyses into a holistic workflow optimization assessment. Evaluate cross-step concerns: ordering, handoff quality, redundancy, bottlenecks, and overall workflow coherence.

WORKFLOW OVERVIEW:
Name: ${workflowName}
Goal: ${workflowContext}
Steps: ${stepCount}
Average Quality: ${avgScore}/100
Weakest Step: ${minScore}/100
Total Issues: ${totalIssues} (${totalHighIssues} high severity)

SCORE SUMMARY:
${scoreSummary}

COMPLETE PROCESS LOG:
${processLog}

DETAILED STEP ANALYSES:
${stepAnalyses}

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

CONSTRAINTS: Be specific, reference step names and artifact details, output ONLY JSON
```

## Variable Substitution

| Variable | Source | Description |
|----------|--------|-------------|
| `${workflowName}` | workflow-state.json | Workflow 名称 |
| `${workflowContext}` | workflow-state.json | Workflow 目标 |
| `${stepCount}` | workflow-state.json | 总步骤数 |
| `${avgScore}` | Phase 04 computes | 所有步骤平均分 |
| `${minScore}` | Phase 04 computes | 最低步骤分 |
| `${totalIssues}` | Phase 04 computes | 总问题数 |
| `${totalHighIssues}` | Phase 04 computes | 高优先级问题数 |
| `${scoreSummary}` | Phase 04 builds | 每步分数一行 |
| `${processLog}` | process-log.md | 完整过程日志 |
| `${stepAnalyses}` | Phase 04 reads | 所有 step-N-analysis.md 内容 |
