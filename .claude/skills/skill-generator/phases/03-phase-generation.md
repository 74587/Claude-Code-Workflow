# Phase 3: Phase Generation

根据执行模式生成 Phase 文件，包含声明式工作流编排和上下文策略支持。

## Objective

- Sequential 模式：生成顺序 Phase 文件 + **声明式编排器**
- Autonomous 模式：生成编排器和动作文件
- 支持 **文件上下文** 和 **内存上下文** 两种策略



## 上下文策略 (P0 增强)

根据 `config.context_strategy` 生成不同的上下文管理代码：

| 策略 | 适用场景 | 优点 | 缺点 |
|------|----------|------|------|
| `file` | 复杂多阶段任务 | 持久化、可调试、可恢复 | IO 开销 |
| `memory` | 简单线性任务 | 速度快 | 无法恢复、调试困难 |

```javascript
const CONTEXT_STRATEGIES = {
  file: {
    read: (key) => `JSON.parse(Read(\`\${workDir}/context/${key}.json\`))`,
    write: (key, data) => `Write(\`\${workDir}/context/${key}.json\`, JSON.stringify(${data}, null, 2))`,
    init: `Bash(\`mkdir -p "\${workDir}/context"\`)`
  },
  memory: {
    read: (key) => `state.context.${key}`,
    write: (key, data) => `state.context.${key} = ${data}`,
    init: `state.context = {}`
  }
};
```

## Execution Steps

### Step 1: 读取配置和模板

```javascript
const config = JSON.parse(Read(`${workDir}/skill-config.json`));
const skillDir = `.claude/skills/${config.skill_name}`;
const contextStrategy = config.context_strategy || 'file'; // 默认文件策略

// 读取模板
const skillRoot = '.claude/skills/skill-generator';
```

### Step 2: Sequential 模式 - 生成阶段文件 + 声明式编排器

```javascript
if (config.execution_mode === 'sequential') {
  const phases = config.sequential_config.phases;

  // ========== P0 增强: 生成声明式编排器 ==========
  const workflowOrchestrator = generateSequentialOrchestrator(config, phases);
  Write(`${skillDir}/phases/_orchestrator.md`, workflowOrchestrator);

  // ========== P0 增强: 生成工作流定义 ==========
  const workflowDef = generateWorkflowDefinition(config, phases);
  Write(`${skillDir}/workflow.json`, JSON.stringify(workflowDef, null, 2));

  // ========== P0 增强: 生成 Phase 0 (强制规范研读) ==========
  const phase0Content = generatePhase0Spec(config);
  Write(`${skillDir}/phases/00-spec-study.md`, phase0Content);

  // ========== 生成用户定义的各阶段文件 ==========
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const prevPhase = i > 0 ? phases[i-1] : null;
    const nextPhase = i < phases.length - 1 ? phases[i+1] : null;

    const content = generateSequentialPhase({
      phaseNumber: i + 1,
      phaseId: phase.id,
      phaseName: phase.name,
      phaseDescription: phase.description || `Execute ${phase.name}`,
      input: prevPhase ? prevPhase.output : "phase 0 output", // Phase 0 为首个输入源
      output: phase.output,
      nextPhase: nextPhase ? nextPhase.id : null,
      config: config,
      contextStrategy: contextStrategy
    });

    Write(`${skillDir}/phases/${phase.id}.md`, content);
  }
}

// ========== P0 增强: 声明式工作流定义 ==========
function generateWorkflowDefinition(config, phases) {
  // ========== P0: 添加强制 Phase 0 ==========
  const phase0 = {
    id: '00-spec-study',
    name: 'Specification Study',
    order: 0,
    input: null,
    output: 'spec-study-complete.flag',
    description: '⚠️ MANDATORY: Read all specification documents before execution',
    parallel: false,
    condition: null,
    agent: {
      type: 'universal-executor',
      run_in_background: false
    }
  };

  return {
    skill_name: config.skill_name,
    version: "1.0.0",
    execution_mode: "sequential",
    context_strategy: config.context_strategy || "file",

    // ========== P0: Phase 0 置于首位 ==========
    phases_to_run: ['00-spec-study', ...phases.map(p => p.id)],

    // ========== P0: Phase 0 + 用户定义阶段 ==========
    phases: [
      phase0,
      ...phases.map((p, i) => ({
        id: p.id,
        name: p.name,
        order: i + 1,
        input: i === 0 ? phase0.output : phases[i-1].output, // 第一个阶段依赖 Phase 0
        output: p.output,
        parallel: p.parallel || false,
        condition: p.condition || null,
        // Agent 配置 (支持 LLM 集成)
        agent: p.agent || (config.llm_integration?.enabled ? {
          type: "llm",
          tool: config.llm_integration.default_tool,
          mode: config.llm_integration.mode || "analysis",
          fallback_chain: config.llm_integration.fallback_chain || [],
          run_in_background: false
        } : {
          type: "universal-executor",
          run_in_background: false
        })
      }))
    ],

    // 终止条件
    termination: {
      on_success: "all_phases_completed",
      on_error: "stop_and_report",
      max_retries: 3
    }
  };
}

// ========== P0 增强: 声明式编排器 ==========
function generateSequentialOrchestrator(config, phases) {
  return `# Sequential Orchestrator

声明式工作流编排器，按 \`workflow.json\` 定义顺序执行阶段。

## 工作流定义

\`\`\`javascript
const workflow = JSON.parse(Read(\`\${skillDir}/workflow.json\`));
\`\`\`

## 编排逻辑

\`\`\`javascript
async function runSequentialWorkflow(workDir) {
  const workflow = JSON.parse(Read(\`\${skillDir}/workflow.json\`));
  const contextStrategy = workflow.context_strategy;
  
  // 初始化上下文
  ${config.context_strategy === 'file' ? 
    `Bash(\`mkdir -p "\${workDir}/context"\`);` :
    `const state = { context: {} };`}
  
  // 执行状态追踪
  const execution = {
    started_at: new Date().toISOString(),
    phases_completed: [],
    current_phase: null,
    errors: []
  };
  
  Write(\`\${workDir}/execution-state.json\`, JSON.stringify(execution, null, 2));
  
  // 按声明顺序执行阶段
  for (const phaseId of workflow.phases_to_run) {
    const phaseConfig = workflow.phases.find(p => p.id === phaseId);
    
    // 更新执行状态
    execution.current_phase = phaseId;
    Write(\`\${workDir}/execution-state.json\`, JSON.stringify(execution, null, 2));
    
    console.log(\`[Orchestrator] Executing: \${phaseId}\`);
    
    try {
      // 检查条件执行
      if (phaseConfig.condition) {
        const shouldRun = evaluateCondition(phaseConfig.condition, execution);
        if (!shouldRun) {
          console.log(\`[Orchestrator] Skipping \${phaseId} (condition not met)\`);
          continue;
        }
      }
      
      // 执行阶段
      const result = await executePhase(phaseId, phaseConfig, workDir);
      
      // 记录完成
      execution.phases_completed.push({
        id: phaseId,
        completed_at: new Date().toISOString(),
        output: phaseConfig.output
      });
      
    } catch (error) {
      execution.errors.push({
        phase: phaseId,
        message: error.message,
        timestamp: new Date().toISOString()
      });
      
      // 错误处理策略
      if (workflow.termination.on_error === 'stop_and_report') {
        console.error(\`[Orchestrator] Failed at \${phaseId}: \${error.message}\`);
        break;
      }
    }
    
    Write(\`\${workDir}/execution-state.json\`, JSON.stringify(execution, null, 2));
  }
  
  // 完成
  execution.current_phase = null;
  execution.completed_at = new Date().toISOString();
  Write(\`\${workDir}/execution-state.json\`, JSON.stringify(execution, null, 2));
  
  return execution;
}

async function executePhase(phaseId, phaseConfig, workDir) {
  const phasePrompt = Read(\`\${skillDir}/phases/\${phaseId}.md\`);
  
  // 使用 Task 调用 Agent
  const result = await Task({
    subagent_type: phaseConfig.agent?.type || 'universal-executor',
    run_in_background: phaseConfig.agent?.run_in_background || false,
    prompt: \`
[PHASE] \${phaseId}
[WORK_DIR] \${workDir}
[INPUT] \${phaseConfig.input ? \`\${workDir}/\${phaseConfig.input}\` : 'None'}
[OUTPUT] \${workDir}/\${phaseConfig.output}

\${phasePrompt}
\`
  });
  
  return JSON.parse(result);
}
\`\`\`

## 阶段执行计划

**执行流程**:

\`\`\`
START
    ↓
Phase 0: Specification Study
    ↓ Output: spec-study-complete.flag
    ↓
Phase 1: ${phases[0]?.name || 'First Phase'}
    ↓ Output: ${phases[0]?.output || 'phase-1.json'}
${phases.slice(1).map((p, i) => `    ↓
Phase ${i+2}: ${p.name}
    ↓ Output: ${p.output}`).join('\n')}
    ↓
COMPLETE
\`\`\`

**阶段列表**:

| Order | Phase | Input | Output | Agent |
|-------|-------|-------|--------|-------|
| 0 | 00-spec-study | - | spec-study-complete.flag | universal-executor |
${phases.map((p, i) =>
  `| ${i+1} | ${p.id} | ${i === 0 ? 'spec-study-complete.flag' : phases[i-1].output} | ${p.output} | ${p.agent?.type || 'universal-executor'} |`
).join('\n')}

## 错误恢复

\`\`\`javascript
// 从指定阶段恢复执行
async function resumeFromPhase(phaseId, workDir) {
  const workflow = JSON.parse(Read(\`\${skillDir}/workflow.json\`));
  const startIndex = workflow.phases_to_run.indexOf(phaseId);
  
  if (startIndex === -1) {
    throw new Error(\`Phase not found: \${phaseId}\`);
  }
  
  // 从指定阶段开始执行
  const remainingPhases = workflow.phases_to_run.slice(startIndex);
  // ...继续执行
}
\`\`\`
`;
}

// 生成阶段文件（增强上下文策略支持）
function generateSequentialPhase(params) {
  const contextCode = params.contextStrategy === 'file' ? {
    readPrev: `const prevOutput = JSON.parse(Read(\`\${workDir}/${params.input}\`));`,
    writeResult: `Write(\`\${workDir}/${params.output}\`, JSON.stringify(result, null, 2));`,
    readContext: (key) => `JSON.parse(Read(\`\${workDir}/context/${key}.json\`))`,
    writeContext: (key) => `Write(\`\${workDir}/context/${key}.json\`, JSON.stringify(data, null, 2))`
  } : {
    readPrev: `const prevOutput = state.context.prevPhaseOutput;`,
    writeResult: `state.context.${params.phaseId.replace(/-/g, '_')}_output = result;`,
    readContext: (key) => `state.context.${key}`,
    writeContext: (key) => `state.context.${key} = data`
  };

  return `# Phase ${params.phaseNumber}: ${params.phaseName}

${params.phaseDescription}

## Objective

- 主要目标描述
- 具体任务列表

## Input

- 依赖: \`${params.input}\`
- 配置: \`{workDir}/skill-config.json\`
- 上下文策略: \`${params.contextStrategy}\`

## Execution Steps

### Step 1: 读取输入

\`\`\`javascript
// 上下文策略: ${params.contextStrategy}
${params.phaseNumber > 1 ? contextCode.readPrev : '// 首阶段，直接从配置开始'}
\`\`\`

### Step 2: 核心处理

\`\`\`javascript
// TODO: 实现核心逻辑
const result = {
  status: 'completed',
  data: {
    // 处理结果
  },
  metadata: {
    phase: '${params.phaseId}',
    timestamp: new Date().toISOString()
  }
};
\`\`\`

### Step 3: 输出结果

\`\`\`javascript
// 写入阶段产出 (上下文策略: ${params.contextStrategy})
${contextCode.writeResult}

// 返回简要信息给编排器
return {
  status: 'completed',
  output_file: '${params.output}',
  summary: '阶段 ${params.phaseNumber} 完成'
};
\`\`\`

## Output

- **File**: \`${params.output}\`
- **Format**: ${params.output.endsWith('.json') ? 'JSON' : 'Markdown'}
- **Context Strategy**: ${params.contextStrategy}

## Quality Checklist

- [ ] 输入数据验证通过
- [ ] 核心逻辑执行成功
- [ ] 输出格式正确
- [ ] 上下文正确保存

${params.nextPhase ? 
  `## Next Phase\n\n→ [Phase ${params.phaseNumber + 1}: ${params.nextPhase}](${params.nextPhase}.md)` : 
  `## Completion\n\n此为最后阶段，输出最终产物。`}
`;
}
```

### Step 3: Autonomous 模式 - 生成编排器 (增强版)

```javascript
if (config.execution_mode === 'autonomous' || config.execution_mode === 'hybrid') {
  const contextStrategy = config.context_strategy || 'file';
  
  // 生成状态 Schema (增强文件策略支持)
  const stateSchema = generateStateSchema(config, contextStrategy);
  Write(`${skillDir}/phases/state-schema.md`, stateSchema);
  
  // 生成编排器 (增强版)
  const orchestrator = generateEnhancedOrchestrator(config, contextStrategy);
  Write(`${skillDir}/phases/orchestrator.md`, orchestrator);
  
  // 生成动作目录
  const actionCatalog = generateActionCatalog(config);
  Write(`${skillDir}/specs/action-catalog.md`, actionCatalog);
  
  // 生成动作文件
  for (const action of config.autonomous_config.actions) {
    const actionContent = generateEnhancedAction(action, config, contextStrategy);
    Write(`${skillDir}/phases/actions/${action.id}.md`, actionContent);
  }
}

// 增强版编排器生成
function generateEnhancedOrchestrator(config, contextStrategy) {
  const actions = config.autonomous_config.actions;
  
  return `# Orchestrator (Enhanced)

增强版编排器，支持声明式动作调度和文件上下文策略。

## 配置

- **上下文策略**: ${contextStrategy}
- **终止条件**: ${config.autonomous_config.termination_conditions?.join(', ') || 'task_completed'}

## 声明式动作目录

\`\`\`javascript
const ACTION_CATALOG = ${JSON.stringify(actions.map(a => ({
  id: a.id,
  name: a.name,
  preconditions: a.preconditions || [],
  effects: a.effects || [],
  priority: a.priority || 0
})), null, 2)};
\`\`\`

## 上下文管理 (${contextStrategy} 策略)

\`\`\`javascript
const ContextManager = {
  ${contextStrategy === 'file' ? `
  // 文件策略: 持久化到 .scratchpad
  init: (workDir) => {
    Bash(\`mkdir -p "\${workDir}/context"\`);
    Write(\`\${workDir}/state.json\`, JSON.stringify(initialState, null, 2));
  },
  
  readState: (workDir) => JSON.parse(Read(\`\${workDir}/state.json\`)),
  
  writeState: (workDir, state) => {
    state.updated_at = new Date().toISOString();
    Write(\`\${workDir}/state.json\`, JSON.stringify(state, null, 2));
  },
  
  readContext: (workDir, key) => {
    try {
      return JSON.parse(Read(\`\${workDir}/context/\${key}.json\`));
    } catch { return null; }
  },
  
  writeContext: (workDir, key, data) => {
    Write(\`\${workDir}/context/\${key}.json\`, JSON.stringify(data, null, 2));
  }` : `
  // 内存策略: 仅在运行时保持
  state: null,
  context: {},
  
  init: (workDir) => {
    ContextManager.state = { ...initialState };
    ContextManager.context = {};
  },
  
  readState: () => ContextManager.state,
  
  writeState: (workDir, state) => {
    state.updated_at = new Date().toISOString();
    ContextManager.state = state;
  },
  
  readContext: (workDir, key) => ContextManager.context[key],
  
  writeContext: (workDir, key, data) => {
    ContextManager.context[key] = data;
  }`}
};
\`\`\`

## 决策逻辑

\`\`\`javascript
function selectNextAction(state) {
  // 1. 终止条件检查
${config.autonomous_config.termination_conditions?.map(c => 
  `  if (${getTerminationCheck(c)}) return null;`
).join('\n') || '  if (state.status === "completed") return null;'}
  
  // 2. 错误限制检查
  if (state.error_count >= 3) return 'action-abort';
  
  // 3. 按优先级选择满足前置条件的动作
  const availableActions = ACTION_CATALOG
    .filter(a => checkPreconditions(a.preconditions, state))
    .filter(a => !state.completed_actions.includes(a.id))
    .sort((a, b) => b.priority - a.priority);
  
  if (availableActions.length > 0) {
    return availableActions[0].id;
  }
  
  // 4. 默认完成
  return 'action-complete';
}

function checkPreconditions(conditions, state) {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(cond => {
    // 支持多种条件格式
    if (cond.includes('===')) {
      const [left, right] = cond.split('===').map(s => s.trim());
      return eval(\`state.\${left}\`) === eval(right);
    }
    return state[cond] === true;
  });
}
\`\`\`

## 执行循环 (增强版)

\`\`\`javascript
async function runOrchestrator(workDir) {
  console.log('=== Orchestrator Started ===');
  console.log(\`Context Strategy: ${contextStrategy}\`);
  
  // 初始化
  ContextManager.init(workDir);
  
  let iteration = 0;
  const MAX_ITERATIONS = 100;
  
  while (iteration < MAX_ITERATIONS) {
    iteration++;
    
    // 1. 读取状态
    const state = ContextManager.readState(workDir);
    console.log(\`[Iteration \${iteration}] Status: \${state.status}, Completed: \${state.completed_actions.length}\`);
    
    // 2. 选择动作
    const actionId = selectNextAction(state);
    
    if (!actionId) {
      console.log('=== All actions completed ===');
      state.status = 'completed';
      ContextManager.writeState(workDir, state);
      break;
    }
    
    console.log(\`[Iteration \${iteration}] Executing: \${actionId}\`);
    
    // 3. 更新当前动作
    state.current_action = actionId;
    ContextManager.writeState(workDir, state);
    
    // 4. 执行动作
    try {
      const actionPrompt = Read(\`\${skillDir}/phases/actions/\${actionId}.md\`);
      
      const result = await Task({
        subagent_type: 'universal-executor',
        run_in_background: false,
        prompt: \`
[STATE]
\${JSON.stringify(state, null, 2)}

[WORK_DIR]
\${workDir}

[CONTEXT_STRATEGY]
${contextStrategy}

[ACTION]
\${actionPrompt}

[RETURN FORMAT]
Return JSON: { "status": "completed"|"failed", "stateUpdates": {...}, "summary": "..." }
\`
      });
      
      const actionResult = JSON.parse(result);
      
      // 5. 更新状态
      state.completed_actions.push(actionId);
      state.current_action = null;
      Object.assign(state, actionResult.stateUpdates || {});
      
      console.log(\`[Iteration \${iteration}] Completed: \${actionResult.summary || actionId}\`);
      
    } catch (error) {
      console.error(\`[Iteration \${iteration}] Error: \${error.message}\`);
      state.errors.push({
        action: actionId,
        message: error.message,
        timestamp: new Date().toISOString()
      });
      state.error_count++;
      state.current_action = null;
    }
    
    ContextManager.writeState(workDir, state);
  }
  
  console.log('=== Orchestrator Finished ===');
  return ContextManager.readState(workDir);
}
\`\`\`

## 动作目录

| Action | Priority | Preconditions | Effects |
|--------|----------|---------------|---------|
${actions.map(a => 
  `| [${a.id}](actions/${a.id}.md) | ${a.priority || 0} | ${a.preconditions?.join(', ') || '-'} | ${a.effects?.join(', ') || '-'} |`
).join('\n')}

## 调试与恢复

\`\`\`javascript
// 从特定状态恢复
async function resumeFromState(workDir) {
  const state = ContextManager.readState(workDir);
  console.log(\`Resuming from: \${state.current_action || 'start'}\`);
  console.log(\`Completed actions: \${state.completed_actions.join(', ')}\`);
  return runOrchestrator(workDir);
}

// 重试失败的动作
async function retryFailedAction(workDir) {
  const state = ContextManager.readState(workDir);
  if (state.errors.length > 0) {
    const lastError = state.errors[state.errors.length - 1];
    console.log(\`Retrying: \${lastError.action}\`);
    state.error_count = Math.max(0, state.error_count - 1);
    ContextManager.writeState(workDir, state);
    return runOrchestrator(workDir);
  }
}
\`\`\`
`;
}

// 增强版动作生成
function generateEnhancedAction(action, config, contextStrategy) {
  return `# Action: ${action.name}

${action.description || '执行 ' + action.name + ' 操作'}

## Purpose

${action.description || 'TODO: 描述此动作的目的'}

## Preconditions

${action.preconditions?.map(p => `- [ ] \`${p}\``).join('\n') || '- [ ] 无特殊前置条件'}

## Context Access (${contextStrategy} 策略)

\`\`\`javascript
// 读取共享上下文
${contextStrategy === 'file' ?
  `const sharedData = JSON.parse(Read(\`\${workDir}/context/shared.json\`));` :
  `const sharedData = state.context.shared || {};`}

// 写入共享上下文
${contextStrategy === 'file' ?
  `Write(\`\${workDir}/context/shared.json\`, JSON.stringify(updatedData, null, 2));` :
  `state.context.shared = updatedData;`}
\`\`\`

## Execution

\`\`\`javascript
async function execute(state, workDir) {
  // 1. 读取必要数据
  ${contextStrategy === 'file' ?
    `const input = JSON.parse(Read(\`\${workDir}/context/input.json\`));` :
    `const input = state.context.input || {};`}
  
  // 2. 执行核心逻辑
  // TODO: 实现动作逻辑
  const result = {
    // 处理结果
  };
  
  // 3. 保存结果 (${contextStrategy} 策略)
  ${contextStrategy === 'file' ?
    `Write(\`\${workDir}/context/${action.id.replace(/-/g, '_')}_result.json\`, JSON.stringify(result, null, 2));` :
    `// 结果通过 stateUpdates 返回`}
  
  // 4. 返回状态更新
  return {
    status: 'completed',
    stateUpdates: {
      completed_actions: [...state.completed_actions, '${action.id}'],
      ${contextStrategy === 'memory' ? `context: { ...state.context, ${action.id.replace(/-/g, '_')}_result: result }` : '// 文件策略：结果已保存到文件'}
    },
    summary: '${action.name} 完成'
  };
}
\`\`\`

## State Updates

\`\`\`javascript
return {
  status: 'completed',
  stateUpdates: {
    completed_actions: [...state.completed_actions, '${action.id}'],
${action.effects?.map(e => `    // Effect: ${e}`).join('\n') || '    // 无额外效果'}
  }
};
\`\`\`

## Error Handling

| 错误类型 | 处理方式 |
|----------|----------|
| 数据验证失败 | 返回错误，不更新状态 |
| 执行异常 | 记录错误，增加 error_count |
| 上下文读取失败 | 使用默认值或跳过 |

## Next Actions (Hints)

- 成功: 由编排器根据 \`ACTION_CATALOG\` 优先级决定
- 失败: 重试或 \`action-abort\`
`;
}

// 生成动作目录
function generateActionCatalog(config) {
  const actions = config.autonomous_config.actions;
  
  return `# Action Catalog

${config.display_name} 的可用动作目录（声明式）。

## 动作定义

\`\`\`json
${JSON.stringify(actions.map(a => ({
  id: a.id,
  name: a.name,
  description: a.description,
  preconditions: a.preconditions || [],
  effects: a.effects || [],
  priority: a.priority || 0
})), null, 2)}
\`\`\`

## 动作依赖图

\`\`\`mermaid
graph TD
${actions.map((a, i) => {
  const deps = a.preconditions?.filter(p => p.startsWith('completed_actions.includes'))
    .map(p => p.match(/'([^']+)'/)?.[1])
    .filter(Boolean) || [];
  
  if (deps.length === 0 && i === 0) {
    return `    START((Start)) --> ${a.id.replace(/-/g, '_')}[${a.name}]`;
  } else if (deps.length > 0) {
    return deps.map(d => `    ${d.replace(/-/g, '_')} --> ${a.id.replace(/-/g, '_')}[${a.name}]`).join('\n');
  }
  return '';
}).filter(Boolean).join('\n')}
    ${actions[actions.length-1]?.id.replace(/-/g, '_') || 'last'} --> END((End))
\`\`\`

## 选择优先级

| Priority | Action | Description |
|----------|--------|-------------|
${actions.sort((a, b) => (b.priority || 0) - (a.priority || 0)).map(a => 
  `| ${a.priority || 0} | ${a.id} | ${a.description || a.name} |`
).join('\n')}
`;
}
```

### Step 4: 辅助函数

```javascript
// ========== P0: Phase 0 生成函数 ==========
function generatePhase0Spec(config) {
  const skillRoot = '.claude/skills/skill-generator';
  const specsToRead = [
    '../_shared/SKILL-DESIGN-SPEC.md',
    `${skillRoot}/templates/*.md`
  ];

  return `# Phase 0: Specification Study

⚠️ **MANDATORY PREREQUISITE** - 此阶段不可跳过

## Objective

在生成任何文件前，完整阅读所有规范文档，理解 Skill 设计标准。

## Why This Matters

**不研读规范 (❌)**:
\`\`\`
跳过规范
    ├─ ✗ 不符合标准
    ├─ ✗ 结构混乱
    └─ ✗ 质量问题
\`\`\`

**研读规范 (✅)**:
\`\`\`
完整研读
    ├─ ✓ 标准化输出
    ├─ ✓ 高质量代码
    └─ ✓ 易于维护
\`\`\`

## Required Reading

### P0 - 核心设计规范

\`\`\`javascript
// 通用设计标准 (MUST READ)
const designSpec = Read('.claude/skills/_shared/SKILL-DESIGN-SPEC.md');

// 关键内容检查点:
const checkpoints = {
  structure: '目录结构约定',
  naming: '命名规范',
  quality: '质量标准',
  output: '输出格式要求'
};
\`\`\`

### P1 - 模板文件 (生成前必读)

\`\`\`javascript
// 根据执行模式加载对应模板
const templates = {
  all: [
    'templates/skill-md.md'  // SKILL.md 入口文件模板
  ],
  sequential: [
    'templates/sequential-phase.md'
  ],
  autonomous: [
    'templates/autonomous-orchestrator.md',
    'templates/autonomous-action.md'
  ]
};

const mode = '${config.execution_mode}';
const requiredTemplates = [...templates.all, ...templates[mode]];

requiredTemplates.forEach(template => {
  const content = Read(\`.claude/skills/skill-generator/\${template}\`);
  // 理解模板结构、变量位置、生成规则
});
\`\`\`

## Execution

\`\`\`javascript
// ========== 加载规范 ==========
const specs = [];

// 1. 设计规范 (P0)
specs.push({
  file: '../_shared/SKILL-DESIGN-SPEC.md',
  content: Read('.claude/skills/_shared/SKILL-DESIGN-SPEC.md'),
  priority: 'P0'
});

// 2. 模板文件 (P1)
const templateFiles = Glob('.claude/skills/skill-generator/templates/*.md');
templateFiles.forEach(file => {
  specs.push({
    file: file,
    content: Read(file),
    priority: 'P1'
  });
});

// ========== 内化规范 ==========
console.log('📖 Reading specifications...');
specs.forEach(spec => {
  console.log(\`  [\${spec.priority}] \${spec.file}\`);
  // 理解内容（无需生成文件，仅内存处理）
});

// ========== 生成完成标记 ==========
const result = {
  status: 'completed',
  specs_loaded: specs.length,
  timestamp: new Date().toISOString()
};

Write(\`\${workDir}/spec-study-complete.flag\`, JSON.stringify(result, null, 2));
\`\`\`

## Output

- **标记文件**: \`spec-study-complete.flag\` (证明已完成阅读)
- **副作用**: 内化规范知识，后续阶段遵循标准

## Success Criteria

✅ **通过标准**:
- [ ] 已阅读 SKILL-DESIGN-SPEC.md
- [ ] 已阅读执行模式对应的模板文件
- [ ] 理解目录结构约定
- [ ] 理解命名规范
- [ ] 理解质量标准

## Next Phase

→ [Phase 1: Requirements Discovery](01-requirements-discovery.md)

**关键**: 只有完成规范研读后，Phase 1 才能正确收集需求并生成符合标准的配置。
`;
}

// ========== 其他辅助函数 ==========
function toPascalCase(str) {
  return str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

function getDefaultValue(type) {
  if (type.endsWith('[]')) return '[]';
  if (type === 'number') return '0';
  if (type === 'boolean') return 'false';
  if (type === 'string') return '""';
  return '{}';
}

function getTerminationCheck(condition) {
  const checks = {
    'user_exit': 'state.status === "user_exit"',
    'error_limit': 'state.error_count >= 3',
    'task_completed': 'state.status === "completed"',
    'max_iterations': 'iteration >= MAX_ITERATIONS'
  };
  return checks[condition] || `state.${condition}`;
}

function getPreconditionCheck(action) {
  if (!action.preconditions?.length) return 'true';
  return action.preconditions.map(p => `state.${p}`).join(' && ');
}
```


