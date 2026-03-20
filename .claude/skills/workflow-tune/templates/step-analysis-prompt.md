# Step Analysis Prompt Template

Phase 03 使用此模板构造 ccw cli 提示词，让 Gemini 分析单个步骤的执行结果和产物质量。

## Template

```
PURPOSE: Analyze the output of workflow step "${stepName}" (step ${stepIndex}/${totalSteps}) to assess quality, identify issues, and evaluate handoff readiness for the next step.

WORKFLOW CONTEXT:
Name: ${workflowName}
Goal: ${workflowContext}
Step Chain:
${stepChainContext}

CURRENT STEP:
Name: ${stepName}
Type: ${stepType}
Command: ${stepCommand}
${successCriteria}

EXECUTION RESULT:
${execSummary}

${handoffContext}

STEP ARTIFACTS:
${artifactSummary}

ANALYSIS DEPTH: ${analysisDepth}
${depthInstructions}

TASK:
1. Assess step execution quality (did it succeed? complete output?)
2. Evaluate artifact quality (content correctness, completeness, format)
3. Check handoff readiness (can the next step consume this output?)
4. Identify issues, risks, or optimization opportunities
5. Rate overall step quality 0-100

EXPECTED OUTPUT (strict JSON, no markdown):
{
  "quality_score": <0-100>,
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

CONSTRAINTS: Be specific, reference artifact content where possible, output ONLY JSON
```

## Variable Substitution

| Variable | Source | Description |
|----------|--------|-------------|
| `${stepName}` | workflow-state.json | 当前步骤名称 |
| `${stepIndex}` | orchestrator loop | 当前步骤序号 (1-based) |
| `${totalSteps}` | workflow-state.json | 总步骤数 |
| `${workflowName}` | workflow-state.json | Workflow 名称 |
| `${workflowContext}` | workflow-state.json | Workflow 目标描述 |
| `${stepChainContext}` | Phase 03 builds | 所有步骤状态概览 |
| `${stepType}` | workflow-state.json | 步骤类型 (skill/ccw-cli/command) |
| `${stepCommand}` | workflow-state.json | 步骤命令 |
| `${successCriteria}` | workflow-state.json | 成功标准 (如有) |
| `${execSummary}` | Phase 03 builds | 执行结果摘要 |
| `${handoffContext}` | Phase 03 builds | 上一步的产出摘要 (非首步) |
| `${artifactSummary}` | Phase 03 builds | 产物内容摘要 |
| `${analysisDepth}` | workflow-state.json | 分析深度 (quick/standard/deep) |
| `${depthInstructions}` | Phase 03 maps | 对应深度的分析指令 |
