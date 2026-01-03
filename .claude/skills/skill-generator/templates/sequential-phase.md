# Sequential Phase Template

顺序模式 Phase 文件的模板。

## 模板结构

```markdown
# Phase {{phase_number}}: {{phase_name}}

{{phase_description}}

## Objective

{{objectives}}

## Input

- 依赖: `{{input_dependency}}`
- 配置: `{workDir}/skill-config.json`

## Execution Steps

### Step 1: {{step_1_name}}

\`\`\`javascript
{{step_1_code}}
\`\`\`

### Step 2: {{step_2_name}}

\`\`\`javascript
{{step_2_code}}
\`\`\`

### Step 3: {{step_3_name}}

\`\`\`javascript
{{step_3_code}}
\`\`\`

## Output

- **File**: `{{output_file}}`
- **Format**: {{output_format}}

## Quality Checklist

{{quality_checklist}}

## Next Phase

{{next_phase_link}}
```

## 变量说明

| 变量 | 说明 |
|------|------|
| `{{phase_number}}` | 阶段序号 (1, 2, 3...) |
| `{{phase_name}}` | 阶段名称 |
| `{{phase_description}}` | 一句话描述 |
| `{{objectives}}` | 目标列表 |
| `{{input_dependency}}` | 输入依赖文件 |
| `{{step_N_name}}` | 步骤名称 |
| `{{step_N_code}}` | 步骤代码 |
| `{{output_file}}` | 输出文件名 |
| `{{output_format}}` | 输出格式 |
| `{{quality_checklist}}` | 质量检查项 |
| `{{next_phase_link}}` | 下一阶段链接 |

## Phase 类型模板

### 1. 收集型 Phase (Collection)

```markdown
# Phase 1: Requirements Collection

收集用户需求和项目配置。

## Objective

- 收集用户输入
- 自动检测项目信息
- 生成配置文件

## Execution Steps

### Step 1: 用户交互

\`\`\`javascript
const userInput = await AskUserQuestion({
  questions: [
    {
      question: "请选择...",
      header: "选项",
      multiSelect: false,
      options: [
        { label: "选项A", description: "..." },
        { label: "选项B", description: "..." }
      ]
    }
  ]
});
\`\`\`

### Step 2: 自动检测

\`\`\`javascript
// 检测项目信息
const packageJson = JSON.parse(Read('package.json'));
const projectName = packageJson.name;
\`\`\`

### Step 3: 生成配置

\`\`\`javascript
const config = {
  name: projectName,
  userChoice: userInput["选项"],
  // ...
};

Write(`${workDir}/config.json`, JSON.stringify(config, null, 2));
\`\`\`

## Output

- **File**: `config.json`
- **Format**: JSON
```

### 2. 分析型 Phase (Analysis)

```markdown
# Phase 2: Deep Analysis

深度分析代码结构。

## Objective

- 扫描代码文件
- 提取关键信息
- 生成分析报告

## Execution Steps

### Step 1: 文件扫描

\`\`\`javascript
const files = Glob('src/**/*.ts');
\`\`\`

### Step 2: 内容分析

\`\`\`javascript
const analysisResults = [];
for (const file of files) {
  const content = Read(file);
  // 分析逻辑
  analysisResults.push({ file, /* 分析结果 */ });
}
\`\`\`

### Step 3: 生成报告

\`\`\`javascript
Write(`${workDir}/analysis.json`, JSON.stringify(analysisResults, null, 2));
\`\`\`

## Output

- **File**: `analysis.json`
- **Format**: JSON
```

### 3. 并行型 Phase (Parallel)

```markdown
# Phase 3: Parallel Processing

并行处理多个子任务。

## Objective

- 启动多个 Agent 并行执行
- 收集各 Agent 结果
- 合并输出

## Execution Steps

### Step 1: 准备任务

\`\`\`javascript
const tasks = [
  { id: 'task-a', prompt: '...' },
  { id: 'task-b', prompt: '...' },
  { id: 'task-c', prompt: '...' }
];
\`\`\`

### Step 2: 并行执行

\`\`\`javascript
const results = await Promise.all(
  tasks.map(task => 
    Task({
      subagent_type: 'universal-executor',
      run_in_background: false,
      prompt: task.prompt
    })
  )
);
\`\`\`

### Step 3: 合并结果

\`\`\`javascript
const merged = results.map((r, i) => ({
  task_id: tasks[i].id,
  result: JSON.parse(r)
}));

Write(`${workDir}/parallel-results.json`, JSON.stringify(merged, null, 2));
\`\`\`

## Output

- **File**: `parallel-results.json`
- **Format**: JSON
```

### 4. 组装型 Phase (Assembly)

```markdown
# Phase 4: Document Assembly

组装最终输出文档。

## Objective

- 读取各阶段产出
- 合并内容
- 生成最终文档

## Execution Steps

### Step 1: 读取产出

\`\`\`javascript
const config = JSON.parse(Read(`${workDir}/config.json`));
const analysis = JSON.parse(Read(`${workDir}/analysis.json`));
const sections = Glob(`${workDir}/sections/*.md`).map(f => Read(f));
\`\`\`

### Step 2: 组装内容

\`\`\`javascript
const document = \`
# \${config.name}

## 概述
\${config.description}

## 详细内容
\${sections.join('\\n\\n')}
\`;
\`\`\`

### Step 3: 写入文件

\`\`\`javascript
Write(`${workDir}/${config.name}-output.md`, document);
\`\`\`

## Output

- **File**: `{name}-output.md`
- **Format**: Markdown
```

### 5. 验证型 Phase (Validation)

```markdown
# Phase 5: Validation

验证输出质量。

## Objective

- 检查输出完整性
- 验证内容质量
- 生成验证报告

## Execution Steps

### Step 1: 完整性检查

\`\`\`javascript
const outputFile = `${workDir}/${config.name}-output.md`;
const content = Read(outputFile);
const completeness = {
  hasTitle: content.includes('# '),
  hasSections: content.match(/## /g)?.length >= 3,
  hasContent: content.length > 500
};
\`\`\`

### Step 2: 质量评估

\`\`\`javascript
const quality = {
  completeness: Object.values(completeness).filter(v => v).length / 3 * 100,
  // 其他维度...
};
\`\`\`

### Step 3: 生成报告

\`\`\`javascript
const report = {
  status: quality.completeness >= 80 ? 'PASS' : 'REVIEW',
  scores: quality,
  issues: []
};

Write(`${workDir}/validation-report.json`, JSON.stringify(report, null, 2));
\`\`\`

## Output

- **File**: `validation-report.json`
- **Format**: JSON
```

## 生成函数

```javascript
function generateSequentialPhase(phaseConfig, index, phases, skillConfig) {
  const prevPhase = index > 0 ? phases[index - 1] : null;
  const nextPhase = index < phases.length - 1 ? phases[index + 1] : null;
  
  return `# Phase ${index + 1}: ${phaseConfig.name}

${phaseConfig.description || `执行 ${phaseConfig.name}`}

## Objective

- ${phaseConfig.objectives?.join('\n- ') || 'TODO: 定义目标'}

## Input

- 依赖: \`${prevPhase ? prevPhase.output : 'user input'}\`
- 配置: \`{workDir}/skill-config.json\`

## Execution Steps

### Step 1: 准备

\`\`\`javascript
${prevPhase ? 
  `const prevOutput = JSON.parse(Read(\`\${workDir}/${prevPhase.output}\`));` :
  '// 首阶段，从配置开始'}
\`\`\`

### Step 2: 处理

\`\`\`javascript
// TODO: 实现核心逻辑
\`\`\`

### Step 3: 输出

\`\`\`javascript
Write(\`\${workDir}/${phaseConfig.output}\`, JSON.stringify(result, null, 2));
\`\`\`

## Output

- **File**: \`${phaseConfig.output}\`
- **Format**: ${phaseConfig.output.endsWith('.json') ? 'JSON' : 'Markdown'}

## Quality Checklist

- [ ] 输入验证通过
- [ ] 核心逻辑执行成功
- [ ] 输出格式正确

${nextPhase ? 
  `## Next Phase\n\n→ [Phase ${index + 2}: ${nextPhase.name}](${nextPhase.id}.md)` :
  '## Completion\n\n此为最后阶段。'}
`;
}
```
