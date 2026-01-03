# Phase 3: Phase Generation

根据执行模式生成 Phase 文件。

## Objective

- Sequential 模式：生成顺序 Phase 文件 (`01-xx.md`, `02-xx.md`, ...)
- Autonomous 模式：生成编排器和动作文件

## Input

- 依赖: `skill-config.json`, SKILL.md (Phase 1-2 产出)
- 模板: `templates/sequential-phase.md`, `templates/autonomous-*.md`

## Execution Steps

### Step 1: 读取配置和模板

```javascript
const config = JSON.parse(Read(`${workDir}/skill-config.json`));
const skillDir = `.claude/skills/${config.skill_name}`;

// 读取模板
const sequentialTemplate = Read(`${skillRoot}/templates/sequential-phase.md`);
const orchestratorTemplate = Read(`${skillRoot}/templates/autonomous-orchestrator.md`);
const actionTemplate = Read(`${skillRoot}/templates/autonomous-action.md`);
```

### Step 2: Sequential 模式 - 生成阶段文件

```javascript
if (config.execution_mode === 'sequential') {
  const phases = config.sequential_config.phases;
  
  for (let i = 0; i < phases.length; i++) {
    const phase = phases[i];
    const prevPhase = i > 0 ? phases[i-1] : null;
    const nextPhase = i < phases.length - 1 ? phases[i+1] : null;
    
    const content = generateSequentialPhase({
      phaseNumber: i + 1,
      phaseId: phase.id,
      phaseName: phase.name,
      phaseDescription: phase.description || `Execute ${phase.name}`,
      input: prevPhase ? prevPhase.output : "user input",
      output: phase.output,
      nextPhase: nextPhase ? nextPhase.id : null,
      config: config
    });
    
    Write(`${skillDir}/phases/${phase.id}.md`, content);
  }
}

function generateSequentialPhase(params) {
  return `# Phase ${params.phaseNumber}: ${params.phaseName}

${params.phaseDescription}

## Objective

- 主要目标描述
- 具体任务列表

## Input

- 依赖: \`${params.input}\`
- 配置: \`{workDir}/skill-config.json\`

## Execution Steps

### Step 1: 准备工作

\`\`\`javascript
// 读取上一阶段产出
${params.phaseNumber > 1 ? 
  `const prevOutput = JSON.parse(Read(\`\${workDir}/${params.input}\`));` : 
  `// 首阶段，直接从配置开始`}
\`\`\`

### Step 2: 核心处理

\`\`\`javascript
// TODO: 实现核心逻辑
const result = {
  // 处理结果
};
\`\`\`

### Step 3: 输出结果

\`\`\`javascript
Write(\`\${workDir}/${params.output}\`, JSON.stringify(result, null, 2));
\`\`\`

## Output

- **File**: \`${params.output}\`
- **Format**: ${params.output.endsWith('.json') ? 'JSON' : 'Markdown'}

## Quality Checklist

- [ ] 输入数据验证通过
- [ ] 核心逻辑执行成功
- [ ] 输出格式正确

${params.nextPhase ? 
  `## Next Phase\n\n→ [Phase ${params.phaseNumber + 1}: ${params.nextPhase}](${params.nextPhase}.md)` : 
  `## Completion\n\n此为最后阶段，输出最终产物。`}
`;
}
```

### Step 3: Autonomous 模式 - 生成编排器

```javascript
if (config.execution_mode === 'autonomous' || config.execution_mode === 'hybrid') {
  
  // 生成状态 Schema
  const stateSchema = generateStateSchema(config);
  Write(`${skillDir}/phases/state-schema.md`, stateSchema);
  
  // 生成编排器
  const orchestrator = generateOrchestrator(config);
  Write(`${skillDir}/phases/orchestrator.md`, orchestrator);
  
  // 生成动作文件
  for (const action of config.autonomous_config.actions) {
    const actionContent = generateAction(action, config);
    Write(`${skillDir}/phases/actions/${action.id}.md`, actionContent);
  }
}

function generateStateSchema(config) {
  return `# State Schema

## 状态文件

位置: \`{workDir}/state.json\`

## 结构定义

\`\`\`typescript
interface ${toPascalCase(config.skill_name)}State {
  // 元信息
  skill_name: "${config.skill_name}";
  started_at: string;
  updated_at: string;
  
  // 执行状态
  status: 'pending' | 'running' | 'completed' | 'failed';
  current_action: string | null;
  completed_actions: string[];
  
  // 业务数据
${config.autonomous_config.state_schema?.fields?.map(f => 
  `  ${f.name}: ${f.type};  // ${f.description}`
).join('\n') || '  context: Record<string, any>;'}
  
  // 错误追踪
  errors: Array<{
    action: string;
    message: string;
    timestamp: string;
  }>;
  error_count: number;
}
\`\`\`

## 初始状态

\`\`\`json
{
  "skill_name": "${config.skill_name}",
  "started_at": "",
  "updated_at": "",
  "status": "pending",
  "current_action": null,
  "completed_actions": [],
${config.autonomous_config.state_schema?.fields?.map(f => 
  `  "${f.name}": ${getDefaultValue(f.type)}`
).join(',\n') || '  "context": {}'}
  "errors": [],
  "error_count": 0
}
\`\`\`

## 状态转换规则

| 当前状态 | 触发条件 | 目标状态 |
|----------|----------|----------|
| pending | 首次执行 | running |
| running | 动作完成 | running |
| running | 所有任务完成 | completed |
| running | 错误超限 | failed |
`;
}

function generateOrchestrator(config) {
  const actions = config.autonomous_config.actions;
  
  return `# Orchestrator

## Role

根据当前状态选择并执行下一个动作。

## State Reading

\`\`\`javascript
const state = JSON.parse(Read(\`\${workDir}/state.json\`));
\`\`\`

## Decision Logic

\`\`\`javascript
function selectNextAction(state) {
  // 1. 检查终止条件
${config.autonomous_config.termination_conditions?.map(c => 
  `  if (${getTerminationCheck(c)}) return null;`
).join('\n') || '  if (state.status === "completed") return null;'}
  
  // 2. 错误检查
  if (state.error_count >= 3) return 'action-abort';
  
  // 3. 根据状态选择动作
${actions.map(a => 
  `  if (${getPreconditionCheck(a)}) return '${a.id}';`
).join('\n')}
  
  // 4. 默认: 完成
  return 'action-complete';
}
\`\`\`

## Execution Loop

\`\`\`javascript
async function runOrchestrator() {
  while (true) {
    // 读取状态
    const state = JSON.parse(Read(\`\${workDir}/state.json\`));
    
    // 选择动作
    const actionId = selectNextAction(state);
    if (!actionId) {
      console.log("任务完成或终止");
      break;
    }
    
    // 更新当前动作
    state.current_action = actionId;
    state.updated_at = new Date().toISOString();
    Write(\`\${workDir}/state.json\`, JSON.stringify(state, null, 2));
    
    // 执行动作
    try {
      const result = await executeAction(actionId, state);
      
      // 更新状态
      state.completed_actions.push(actionId);
      state.current_action = null;
      Object.assign(state, result.stateUpdates);
      
    } catch (error) {
      state.errors.push({
        action: actionId,
        message: error.message,
        timestamp: new Date().toISOString()
      });
      state.error_count++;
    }
    
    Write(\`\${workDir}/state.json\`, JSON.stringify(state, null, 2));
  }
}
\`\`\`

## Action Catalog

| Action | Purpose | Preconditions |
|--------|---------|---------------|
${actions.map(a => 
  `| [${a.id}](actions/${a.id}.md) | ${a.description || a.name} | ${a.preconditions?.join(', ') || '-'} |`
).join('\n')}

## Termination Conditions

${config.autonomous_config.termination_conditions?.map(c => `- ${c}`).join('\n') || '- status === "completed"'}
`;
}

function generateAction(action, config) {
  return `# Action: ${action.name}

${action.description || '执行 ' + action.name + ' 操作'}

## Purpose

${action.description || 'TODO: 描述此动作的目的'}

## Preconditions

${action.preconditions?.map(p => `- [ ] ${p}`).join('\n') || '- [ ] 无特殊前置条件'}

## Execution

\`\`\`javascript
async function execute(state) {
  // TODO: 实现动作逻辑
  
  // 1. 读取必要数据
  
  // 2. 执行核心逻辑
  
  // 3. 返回状态更新
  return {
    stateUpdates: {
      // 更新的状态字段
    }
  };
}
\`\`\`

## State Updates

\`\`\`javascript
return {
  completed_actions: [...state.completed_actions, '${action.id}'],
  // 其他状态更新
${action.effects?.map(e => `  // Effect: ${e}`).join('\n') || ''}
};
\`\`\`

## Error Handling

| 错误类型 | 处理方式 |
|----------|----------|
| 数据验证失败 | 返回错误，不更新状态 |
| 执行异常 | 记录错误，增加 error_count |

## Next Actions (Hints)

- 成功时: 由编排器根据状态决定
- 失败时: 重试或 \`action-abort\`
`;
}
```

### Step 4: 辅助函数

```javascript
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
    'task_completed': 'state.status === "completed"'
  };
  return checks[condition] || `state.${condition}`;
}

function getPreconditionCheck(action) {
  if (!action.preconditions?.length) return 'true';
  return action.preconditions.map(p => `state.${p}`).join(' && ');
}
```

## Output

### Sequential 模式

- `phases/01-{step}.md`
- `phases/02-{step}.md`
- ...

### Autonomous 模式

- `phases/orchestrator.md`
- `phases/state-schema.md`
- `phases/actions/action-{name}.md` (多个)

## Next Phase

→ [Phase 4: Specs & Templates](04-specs-templates.md)
