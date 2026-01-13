# Orchestrator

根据当前状态选择并执行下一个审查动作。

## Role

Code Review 编排器，负责：
1. 读取当前审查状态
2. 根据状态选择下一个动作
3. 执行动作并更新状态
4. 循环直到审查完成

## State Management

### 读取状态

```javascript
const state = JSON.parse(Read(`${workDir}/state.json`));
```

### 更新状态

```javascript
function updateState(updates) {
  const state = JSON.parse(Read(`${workDir}/state.json`));
  const newState = {
    ...state,
    ...updates,
    updated_at: new Date().toISOString()
  };
  Write(`${workDir}/state.json`, JSON.stringify(newState, null, 2));
  return newState;
}
```

## Decision Logic

```javascript
function selectNextAction(state) {
  // 1. 终止条件检查
  if (state.status === 'completed') return null;
  if (state.status === 'user_exit') return null;
  if (state.error_count >= 3) return 'action-abort';
  
  // 2. 初始化阶段
  if (state.status === 'pending' || !state.context) {
    return 'action-collect-context';
  }
  
  // 3. 快速扫描阶段
  if (!state.scan_completed) {
    return 'action-quick-scan';
  }
  
  // 4. 深入审查阶段 - 逐维度审查
  const dimensions = ['correctness', 'readability', 'performance', 'security', 'testing', 'architecture'];
  const reviewedDimensions = state.reviewed_dimensions || [];
  
  for (const dim of dimensions) {
    if (!reviewedDimensions.includes(dim)) {
      return 'action-deep-review';  // 传递 dimension 参数
    }
  }
  
  // 5. 报告生成阶段
  if (!state.report_generated) {
    return 'action-generate-report';
  }
  
  // 6. 完成
  return 'action-complete';
}
```

## Execution Loop

```javascript
async function runOrchestrator() {
  console.log('=== Code Review Orchestrator Started ===');
  
  let iteration = 0;
  const MAX_ITERATIONS = 20;  // 6 dimensions + overhead
  
  while (iteration < MAX_ITERATIONS) {
    iteration++;
    
    // 1. 读取当前状态
    const state = JSON.parse(Read(`${workDir}/state.json`));
    console.log(`[Iteration ${iteration}] Status: ${state.status}`);
    
    // 2. 选择下一个动作
    const actionId = selectNextAction(state);
    
    if (!actionId) {
      console.log('Review completed, terminating.');
      break;
    }
    
    console.log(`[Iteration ${iteration}] Executing: ${actionId}`);
    
    // 3. 更新状态：当前动作
    updateState({ current_action: actionId });
    
    // 4. 执行动作
    try {
      const actionPrompt = Read(`phases/actions/${actionId}.md`);
      
      // 确定当前需要审查的维度
      let currentDimension = null;
      if (actionId === 'action-deep-review') {
        const dimensions = ['correctness', 'readability', 'performance', 'security', 'testing', 'architecture'];
        const reviewed = state.reviewed_dimensions || [];
        currentDimension = dimensions.find(d => !reviewed.includes(d));
      }
      
      const result = await Task({
        subagent_type: 'universal-executor',
        run_in_background: false,
        prompt: `
[WORK_DIR]
${workDir}

[STATE]
${JSON.stringify(state, null, 2)}

[CURRENT_DIMENSION]
${currentDimension || 'N/A'}

[ACTION]
${actionPrompt}

[SPECS]
Review Dimensions: specs/review-dimensions.md
Issue Classification: specs/issue-classification.md

[RETURN]
Return JSON with stateUpdates field containing updates to apply to state.
`
      });
      
      const actionResult = JSON.parse(result);
      
      // 5. 更新状态：动作完成
      updateState({
        current_action: null,
        completed_actions: [...(state.completed_actions || []), actionId],
        ...actionResult.stateUpdates
      });
      
    } catch (error) {
      // 错误处理
      updateState({
        current_action: null,
        errors: [...(state.errors || []), {
          action: actionId,
          message: error.message,
          timestamp: new Date().toISOString()
        }],
        error_count: (state.error_count || 0) + 1
      });
    }
  }
  
  console.log('=== Code Review Orchestrator Finished ===');
}
```

## Action Catalog

| Action | Purpose | Preconditions |
|--------|---------|---------------|
| [action-collect-context](actions/action-collect-context.md) | 收集审查目标上下文 | status === 'pending' |
| [action-quick-scan](actions/action-quick-scan.md) | 快速扫描识别风险区域 | context !== null |
| [action-deep-review](actions/action-deep-review.md) | 深入审查指定维度 | scan_completed === true |
| [action-generate-report](actions/action-generate-report.md) | 生成结构化审查报告 | all dimensions reviewed |
| [action-complete](actions/action-complete.md) | 完成审查，保存结果 | report_generated === true |

## Termination Conditions

- `state.status === 'completed'` - 审查正常完成
- `state.status === 'user_exit'` - 用户主动退出
- `state.error_count >= 3` - 错误次数超限
- `iteration >= MAX_ITERATIONS` - 迭代次数超限

## Error Recovery

| Error Type | Recovery Strategy |
|------------|-------------------|
| 文件读取失败 | 跳过该文件，记录警告 |
| 动作执行失败 | 重试最多 3 次 |
| 状态不一致 | 重新初始化状态 |
| 用户中止 | 保存当前进度，允许恢复 |
