---
name: copyright
description: Multi-phase iterative software copyright documentation generator for CPCC compliance, produces design specification with Mermaid diagrams through code analysis
argument-hint: "[scope|path] [--name=软件名称] [--version=版本号]"
allowed-tools: Task(*), AskUserQuestion(*), Read(*), Bash(*), Glob(*), Grep(*), TodoWrite(*), Write(*)
---

# Workflow Copyright Command (/workflow:docs:copyright)

## Overview

**软件著作权设计说明书生成器** - 基于源代码深度分析，生成符合中国版权保护中心（CPCC）规范的无界面软件设计说明书。通过多阶段迭代和用户交互，确保文档内容准确、完整、合规。

**核心原则**：
- **基于代码分析**：所有内容严格来源于代码分析，杜绝臆测
- **Mermaid 规范**：所有图表使用正确的 Mermaid 语法，特殊字符正确转义
- **CPCC 合规**：严格遵循鉴别材料必备组成部分要求
- **迭代优化**：通过多轮交互确保文档质量

## 文档结构（鉴别材料必备组成部分）

| 章节 | 内容 | 图表类型 |
|------|------|----------|
| 1. 软件概述 | 背景、目标、运行环境、技术架构 | - |
| 2. 系统架构图 | 整体架构、模块关系、数据流 | `graph TD` |
| 3. 功能模块设计 | 功能分解、模块职责、交互关系 | `flowchart TD` |
| 4. 核心算法与流程 | 关键业务逻辑、算法实现、处理流程 | `flowchart TD` |
| 5. 数据结构设计 | 数据实体、关系、约束 | `classDiagram` |
| 6. 接口设计 | API 定义、参数、返回值 | `sequenceDiagram` |
| 7. 异常处理设计 | 错误处理、异常流程、恢复机制 | `flowchart TD` |

## Execution Process

```
Input Parsing:
   ├─ Parse: scope/path (required, source code location)
   ├─ Parse: --name (software name, will prompt if not provided)
   └─ Parse: --version (version number, will prompt if not provided)

Phase 1: Project Discovery & Metadata Collection
   ├─ Ask: Software name and version (if not specified)
   ├─ Ask: Software category and primary function
   ├─ Explore: Project structure and tech stack
   └─ Output: project-metadata.json

Phase 2: Deep Code Analysis (Parallel Agents)
   ├─ Agent 1: Architecture analysis (modules, layers, dependencies)
   ├─ Agent 2: Function analysis (features, workflows, algorithms)
   ├─ Agent 3: Data structure analysis (entities, relationships)
   ├─ Agent 4: Interface analysis (APIs, protocols)
   └─ Output: analysis-{dimension}.json files

Phase 3: Mermaid Diagram Generation
   ├─ Generate: System architecture diagram (graph TD)
   ├─ Generate: Function module diagrams (flowchart TD)
   ├─ Generate: Core algorithm flowcharts (flowchart TD)
   ├─ Generate: Class diagrams (classDiagram)
   ├─ Generate: Sequence diagrams (sequenceDiagram)
   └─ Output: diagrams/*.mmd + validation

Phase 4: Document Assembly
   ├─ Synthesize: Merge all analysis results
   ├─ Generate: 软件设计说明书.md (draft)
   ├─ Validate: CPCC compliance check
   └─ Output: Present document to user

Phase 5: Iterative Refinement (Discovery-Driven)
   ├─ Extract: Gaps and ambiguities from analysis
   ├─ Ask: Targeted questions based on findings
   ├─ Update: Incremental document modification
   └─ Loop: Until user satisfied or no more discoveries

Finalize:
   └─ Output: Final 软件设计说明书.md
```

## 5-Phase Execution

### Phase 1: Project Discovery & Metadata Collection

**Purpose**: Collect essential metadata and understand project structure

**Step 1.1: Initialize TodoWrite**

```javascript
TodoWrite([
  {content: "Phase 1: Project Discovery", status: "in_progress", activeForm: "Discovering project structure"},
  {content: "Phase 2: Deep Code Analysis", status: "pending", activeForm: "Analyzing source code"},
  {content: "Phase 3: Diagram Generation", status: "pending", activeForm: "Generating Mermaid diagrams"},
  {content: "Phase 4: Document Assembly", status: "pending", activeForm: "Assembling design document"},
  {content: "Phase 5: Iterative Refinement", status: "pending", activeForm: "Refining based on feedback"}
])
```

**Step 1.2: Collect Software Metadata (if not specified)**

```javascript
if (!name_specified || !version_specified) {
  AskUserQuestion({
    questions: [
      {
        question: "请提供软件的正式名称（将显示在页眉和文档标题中）",
        header: "软件名称",
        multiSelect: false,
        options: [
          {label: "使用项目名称", description: `自动检测: ${detected_project_name}`},
          {label: "自定义名称", description: "输入自定义的软件名称"}
        ]
      },
      {
        question: "请提供软件版本号（格式如 V1.0.0）",
        header: "版本号",
        multiSelect: false,
        options: [
          {label: "V1.0.0", description: "初始版本"},
          {label: "使用 package.json 版本", description: `自动检测: ${detected_version}`},
          {label: "自定义版本", description: "输入自定义版本号"}
        ]
      }
    ]
  });
}
```

**Step 1.3: Software Category Selection**

```javascript
AskUserQuestion({
  questions: [{
    question: "请选择软件的主要类型（影响文档描述风格）",
    header: "软件类型",
    multiSelect: false,
    options: [
      {label: "命令行工具 (CLI)", description: "无图形界面的命令行应用程序"},
      {label: "后端服务/API", description: "Web API、微服务、后台服务"},
      {label: "SDK/库", description: "供其他程序调用的开发工具包"},
      {label: "数据处理系统", description: "ETL、数据分析、批处理系统"},
      {label: "自动化脚本", description: "运维自动化、构建工具、脚本集合"}
    ]
  }]
});
```

**Step 1.4: Explore Project Structure**

```javascript
Task({
  subagent_type: "cli-explore-agent",
  run_in_background: false,
  description: "Explore project structure",
  prompt: `
## Exploration Objective
分析项目结构，提取软件著作权文档所需的基础信息。

## Target Path
${scope_path}

## Required Analysis
1. **技术栈识别**：编程语言、框架、主要依赖
2. **目录结构**：源代码组织方式、模块划分
3. **入口点识别**：主程序入口、命令行入口
4. **配置文件**：环境配置、构建配置
5. **文档线索**：README、注释中的功能描述

## Output
Write to: ${outputDir}/project-discovery.json
{
  "tech_stack": {...},
  "directory_structure": {...},
  "entry_points": [...],
  "main_modules": [...],
  "detected_features": [...]
}
`
});
```

**Step 1.5: Store Project Metadata**

```javascript
const projectMetadata = {
  software_name: selected_name,
  version: selected_version,
  category: selected_category,
  scope_path: scope_path,
  tech_stack: discovery.tech_stack,
  entry_points: discovery.entry_points,
  main_modules: discovery.main_modules,
  timestamp: new Date().toISOString()
};

Write(`${outputDir}/project-metadata.json`, JSON.stringify(projectMetadata, null, 2));
```

**TodoWrite**: Mark Phase 1 completed, Phase 2 in_progress

---

### Phase 2: Deep Code Analysis (Parallel Agents)

**Purpose**: Multi-dimensional code analysis for comprehensive understanding

**Step 2.1: Launch Parallel Analysis Agents**

```javascript
const analysisAgents = [
  {
    dimension: "architecture",
    focus: "系统架构分析",
    prompt: `
## 分析目标
分析项目的系统架构，为"系统架构图"章节提供数据。

## 分析内容
1. **分层结构**：识别代码的分层（如 Controller/Service/Repository）
2. **模块边界**：各模块的职责范围和边界
3. **依赖关系**：模块间的依赖方向和类型
4. **核心组件**：系统的核心组件及其作用
5. **数据流向**：数据在各层之间的流动路径

## 输出格式
{
  "layers": [{name, components, responsibility}],
  "modules": [{name, path, responsibility, dependencies}],
  "data_flow": [{from, to, data_type, description}],
  "core_components": [{name, type, responsibility}],
  "mermaid_hints": {nodes: [], edges: []}
}
`
  },
  {
    dimension: "functions",
    focus: "功能模块分析",
    prompt: `
## 分析目标
分析项目的功能模块，为"功能模块设计"章节提供数据。

## 分析内容
1. **功能清单**：从代码中提取的所有功能点
2. **功能分组**：按业务逻辑分组的功能模块
3. **功能层级**：功能的父子关系和层级结构
4. **模块交互**：功能模块之间的调用关系
5. **关键流程**：主要业务流程的步骤分解

## 输出格式
{
  "feature_list": [{id, name, description, module, entry_file}],
  "feature_groups": [{group_name, features: []}],
  "feature_hierarchy": {root: {children: [...]}},
  "interactions": [{caller, callee, trigger, description}],
  "key_workflows": [{name, steps: [], files_involved}]
}
`
  },
  {
    dimension: "algorithms",
    focus: "核心算法分析",
    prompt: `
## 分析目标
分析项目的核心算法和业务逻辑，为"核心算法与流程"章节提供数据。

## 分析内容
1. **核心算法**：识别关键算法（排序、搜索、加密、业务规则等）
2. **复杂逻辑**：圈复杂度高的函数/方法
3. **处理流程**：核心业务的处理步骤
4. **输入输出**：算法的输入参数和输出结果
5. **边界条件**：特殊情况的处理逻辑

## 输出格式
{
  "algorithms": [{
    name, file, line, 
    description, 
    complexity, 
    inputs: [{name, type, description}],
    outputs: [{name, type, description}],
    steps: [{step_num, description, code_ref}]
  }],
  "complex_functions": [{name, file, cyclomatic_complexity, description}],
  "flowchart_hints": [{algorithm_name, nodes: [], edges: []}]
}
`
  },
  {
    dimension: "data_structures",
    focus: "数据结构分析",
    prompt: `
## 分析目标
分析项目的数据结构，为"数据结构设计"章节提供数据。

## 分析内容
1. **数据实体**：类、接口、类型定义
2. **属性字段**：实体的属性及其类型
3. **实体关系**：继承、组合、关联关系
4. **约束规则**：数据验证、业务约束
5. **枚举常量**：枚举类型和常量定义

## 输出格式
{
  "entities": [{
    name, file, type, // class/interface/type
    properties: [{name, type, visibility, description}],
    methods: [{name, params, return_type, visibility}]
  }],
  "relationships": [{
    from, to, 
    type, // inheritance/composition/association/dependency
    cardinality, description
  }],
  "enums": [{name, values: [{name, value, description}]}],
  "class_diagram_hints": {classes: [], relationships: []}
}
`
  },
  {
    dimension: "interfaces",
    focus: "接口设计分析",
    prompt: `
## 分析目标
分析项目的接口设计，为"接口设计"章节提供数据。

## 分析内容
1. **API 端点**：HTTP API、RPC 接口、CLI 命令
2. **参数定义**：输入参数的名称、类型、约束
3. **返回值**：输出结果的格式和类型
4. **调用协议**：同步/异步、请求/响应模式
5. **接口分组**：按功能或资源分组

## 输出格式
{
  "apis": [{
    name, path, method, // GET/POST/CLI/RPC
    description,
    parameters: [{name, type, required, description}],
    response: {type, schema, description},
    category
  }],
  "protocols": [{name, type, description}],
  "sequence_hints": [{scenario, actors: [], messages: []}]
}
`
  },
  {
    dimension: "exceptions",
    focus: "异常处理分析",
    prompt: `
## 分析目标
分析项目的异常处理机制，为"异常处理设计"章节提供数据。

## 分析内容
1. **异常类型**：自定义异常类、错误码定义
2. **捕获策略**：try-catch 的使用模式
3. **错误传播**：异常的传播和转换链
4. **恢复机制**：重试、降级、回滚策略
5. **日志记录**：错误日志的记录方式

## 输出格式
{
  "exception_types": [{name, parent, code, message, file}],
  "error_codes": [{code, message, severity, category}],
  "handling_patterns": [{pattern, locations: [], description}],
  "recovery_strategies": [{strategy, trigger, action, files}],
  "logging_approach": {framework, levels, format}
}
`
  }
];

// Launch all agents in parallel
const analysisTasks = analysisAgents.map(agent =>
  Task({
    subagent_type: "cli-explore-agent",
    run_in_background: false,
    description: agent.focus,
    prompt: `
${agent.prompt}

## Context
- **Scope Path**: ${scope_path}
- **Tech Stack**: ${projectMetadata.tech_stack}
- **Main Modules**: ${projectMetadata.main_modules.join(', ')}

## Output File
Write to: ${outputDir}/analysis-${agent.dimension}.json
`
  })
);
```

**Step 2.2: Validate Analysis Results**

```javascript
// Verify all analysis files created
const requiredAnalyses = ['architecture', 'functions', 'algorithms', 'data_structures', 'interfaces', 'exceptions'];
for (const dimension of requiredAnalyses) {
  const filePath = `${outputDir}/analysis-${dimension}.json`;
  if (!file_exists(filePath)) {
    throw new Error(`Missing analysis: ${dimension}`);
  }
}
```

**TodoWrite**: Mark Phase 2 completed, Phase 3 in_progress

---

### Phase 3: Mermaid Diagram Generation

**Purpose**: Generate all required diagrams with correct Mermaid syntax

**Step 3.1: System Architecture Diagram**

```javascript
const archAnalysis = JSON.parse(Read(`${outputDir}/analysis-architecture.json`));

// Generate Mermaid graph TD
function generateArchitectureDiagram(analysis) {
  let mermaid = 'graph TD\n';
  
  // Add subgraphs for layers
  for (const layer of analysis.layers) {
    mermaid += `    subgraph ${sanitizeId(layer.name)}["${escapeLabel(layer.name)}"]\n`;
    for (const comp of layer.components) {
      mermaid += `        ${sanitizeId(comp)}["${escapeLabel(comp)}"]\n`;
    }
    mermaid += '    end\n';
  }
  
  // Add edges for data flow
  for (const flow of analysis.data_flow) {
    mermaid += `    ${sanitizeId(flow.from)} -->|"${escapeLabel(flow.description)}"| ${sanitizeId(flow.to)}\n`;
  }
  
  return mermaid;
}

// Helper: Escape special characters in labels
function escapeLabel(text) {
  return text.replace(/["(){}[\]<>]/g, char => `#${char.charCodeAt(0)};`);
}

const archDiagram = generateArchitectureDiagram(archAnalysis);
Write(`${outputDir}/diagrams/architecture.mmd`, archDiagram);
```

**Step 3.2: Function Module Diagrams**

```javascript
const funcAnalysis = JSON.parse(Read(`${outputDir}/analysis-functions.json`));

function generateFunctionDiagram(analysis) {
  let mermaid = 'flowchart TD\n';
  
  // Root node
  mermaid += `    ROOT["${escapeLabel(projectMetadata.software_name)}"]\n`;
  
  // Feature groups as subgraphs
  for (const group of analysis.feature_groups) {
    mermaid += `    subgraph ${sanitizeId(group.group_name)}["${escapeLabel(group.group_name)}"]\n`;
    for (const feature of group.features) {
      mermaid += `        ${sanitizeId(feature.id)}["${escapeLabel(feature.name)}"]\n`;
    }
    mermaid += '    end\n';
    mermaid += `    ROOT --> ${sanitizeId(group.group_name)}\n`;
  }
  
  return mermaid;
}

const funcDiagram = generateFunctionDiagram(funcAnalysis);
Write(`${outputDir}/diagrams/functions.mmd`, funcDiagram);
```

**Step 3.3: Algorithm Flowcharts**

```javascript
const algoAnalysis = JSON.parse(Read(`${outputDir}/analysis-algorithms.json`));

function generateAlgorithmFlowchart(algorithm) {
  let mermaid = 'flowchart TD\n';
  
  // Start node
  mermaid += `    START(["开始"])\n`;
  
  // Input nodes
  for (const input of algorithm.inputs) {
    mermaid += `    INPUT_${sanitizeId(input.name)}[/"${escapeLabel(input.name)}: ${escapeLabel(input.type)}"/]\n`;
  }
  
  // Process steps
  let prevNode = 'START';
  for (const step of algorithm.steps) {
    const nodeId = `STEP_${step.step_num}`;
    mermaid += `    ${nodeId}["${escapeLabel(step.description)}"]\n`;
    mermaid += `    ${prevNode} --> ${nodeId}\n`;
    prevNode = nodeId;
  }
  
  // Output and end
  mermaid += `    OUTPUT[/"输出结果"/]\n`;
  mermaid += `    ${prevNode} --> OUTPUT\n`;
  mermaid += `    END_(["结束"])\n`;
  mermaid += `    OUTPUT --> END_\n`;
  
  return mermaid;
}

// Generate flowchart for each core algorithm
for (const algo of algoAnalysis.algorithms.slice(0, 5)) { // Top 5 algorithms
  const flowchart = generateAlgorithmFlowchart(algo);
  Write(`${outputDir}/diagrams/algorithm-${sanitizeId(algo.name)}.mmd`, flowchart);
}
```

**Step 3.4: Class Diagrams**

```javascript
const dataAnalysis = JSON.parse(Read(`${outputDir}/analysis-data_structures.json`));

function generateClassDiagram(analysis) {
  let mermaid = 'classDiagram\n';
  
  // Classes
  for (const entity of analysis.entities) {
    mermaid += `    class ${sanitizeId(entity.name)} {\n`;
    
    // Properties
    for (const prop of entity.properties) {
      const visibility = {public: '+', private: '-', protected: '#'}[prop.visibility] || '+';
      mermaid += `        ${visibility}${prop.type} ${prop.name}\n`;
    }
    
    // Methods
    for (const method of entity.methods) {
      const visibility = {public: '+', private: '-', protected: '#'}[method.visibility] || '+';
      mermaid += `        ${visibility}${method.name}(${method.params}) ${method.return_type}\n`;
    }
    
    mermaid += '    }\n';
  }
  
  // Relationships
  for (const rel of analysis.relationships) {
    const arrows = {
      inheritance: '--|>',
      composition: '*--',
      aggregation: 'o--',
      association: '-->',
      dependency: '..>'
    };
    const arrow = arrows[rel.type] || '-->';
    mermaid += `    ${sanitizeId(rel.from)} ${arrow} ${sanitizeId(rel.to)} : ${escapeLabel(rel.description || rel.type)}\n`;
  }
  
  return mermaid;
}

const classDiagram = generateClassDiagram(dataAnalysis);
Write(`${outputDir}/diagrams/class-diagram.mmd`, classDiagram);
```

**Step 3.5: Sequence Diagrams**

```javascript
const interfaceAnalysis = JSON.parse(Read(`${outputDir}/analysis-interfaces.json`));

function generateSequenceDiagram(scenario) {
  let mermaid = 'sequenceDiagram\n';
  
  // Participants
  for (const actor of scenario.actors) {
    mermaid += `    participant ${sanitizeId(actor.id)} as ${escapeLabel(actor.name)}\n`;
  }
  
  // Messages
  for (const msg of scenario.messages) {
    const arrow = msg.type === 'async' ? '-)' : '->>';
    mermaid += `    ${sanitizeId(msg.from)}${arrow}${sanitizeId(msg.to)}: ${escapeLabel(msg.description)}\n`;
  }
  
  return mermaid;
}

// Generate sequence diagram for each key scenario
for (const scenario of interfaceAnalysis.sequence_hints || []) {
  const seqDiagram = generateSequenceDiagram(scenario);
  Write(`${outputDir}/diagrams/sequence-${sanitizeId(scenario.scenario)}.mmd`, seqDiagram);
}
```

**Step 3.6: Validate Mermaid Syntax**

```javascript
// Validate all generated diagrams
const diagramFiles = Glob(`${outputDir}/diagrams/*.mmd`);
const validationResults = [];

for (const file of diagramFiles) {
  const content = Read(file);
  const issues = validateMermaidSyntax(content);
  validationResults.push({
    file: file,
    valid: issues.length === 0,
    issues: issues
  });
}

Write(`${outputDir}/diagrams/validation-report.json`, JSON.stringify(validationResults, null, 2));
```

**TodoWrite**: Mark Phase 3 completed, Phase 4 in_progress

---

### Phase 4: Document Assembly

**Purpose**: Assemble all analysis and diagrams into final document

**Step 4.1: Load All Analysis Data**

```javascript
const metadata = JSON.parse(Read(`${outputDir}/project-metadata.json`));
const analyses = {
  architecture: JSON.parse(Read(`${outputDir}/analysis-architecture.json`)),
  functions: JSON.parse(Read(`${outputDir}/analysis-functions.json`)),
  algorithms: JSON.parse(Read(`${outputDir}/analysis-algorithms.json`)),
  data_structures: JSON.parse(Read(`${outputDir}/analysis-data_structures.json`)),
  interfaces: JSON.parse(Read(`${outputDir}/analysis-interfaces.json`)),
  exceptions: JSON.parse(Read(`${outputDir}/analysis-exceptions.json`))
};
const diagrams = loadAllDiagrams(`${outputDir}/diagrams/`);
```

**Step 4.2: Generate Document Header**

```javascript
const header = `
<!-- 页眉：${metadata.software_name} - 版本号：${metadata.version} -->
<!-- 注：最终文档页码位于每页右上角 -->

# ${metadata.software_name} 软件设计说明书

**版本号**：${metadata.version}  
**生成日期**：${new Date().toLocaleDateString('zh-CN')}  
**文档性质**：软件著作权鉴别材料

---

`;
```

**Step 4.3: Generate Each Section**

```javascript
function generateSection1_Overview(metadata, analyses) {
  return `
## 1. 软件概述

### 1.1 软件背景与用途

${metadata.software_name}是一款${metadata.category}软件，主要用于${inferPurpose(analyses)}。

本软件基于${metadata.tech_stack.language}语言开发，采用${metadata.tech_stack.framework || '自研架构'}实现核心功能。

### 1.2 开发目标与特点

**开发目标**：
${generateObjectives(analyses.functions)}

**技术特点**：
${generateFeatures(analyses.architecture)}

### 1.3 运行环境与技术架构

**运行环境**：
- 操作系统：${metadata.tech_stack.os || '跨平台'}
- 运行时：${metadata.tech_stack.runtime}
- 依赖环境：${metadata.tech_stack.dependencies?.join('、') || '无特殊依赖'}

**技术架构**：
- 架构模式：${analyses.architecture.pattern || '模块化架构'}
- 核心框架：${metadata.tech_stack.framework || '无'}
- 主要技术栈：${metadata.tech_stack.main_technologies?.join('、') || metadata.tech_stack.language}

`;
}

function generateSection2_Architecture(analyses, diagrams) {
  return `
## 2. 系统架构图

本章节展示${metadata.software_name}的整体系统架构，包括各主要模块之间的关系与核心数据流。

\`\`\`mermaid
${diagrams.architecture}
\`\`\`

**图2-1 系统架构图**

### 架构说明

${generateArchitectureDescription(analyses.architecture)}

**核心模块说明**：

${analyses.architecture.modules.map((m, i) => 
  `${i + 1}. **${m.name}**：${m.responsibility}`
).join('\n')}

`;
}

function generateSection3_FunctionModules(analyses, diagrams) {
  return `
## 3. 功能模块设计

本章节详细描述各功能模块的设计与职责划分。

\`\`\`mermaid
${diagrams.functions}
\`\`\`

**图3-1 功能模块结构图**

### 3.1 功能模块列表

${analyses.functions.feature_groups.map((group, gi) => `
#### 3.1.${gi + 1} ${group.group_name}

${group.features.map((f, fi) => 
  `- **${f.name}**：${f.description}`
).join('\n')}
`).join('\n')}

### 3.2 模块交互关系

${generateInteractionDescription(analyses.functions.interactions)}

`;
}

function generateSection4_Algorithms(analyses, diagrams) {
  return `
## 4. 核心算法与流程

本章节描述软件中的核心算法实现与关键业务处理流程。

${analyses.algorithms.algorithms.slice(0, 5).map((algo, i) => `
### 4.${i + 1} ${algo.name}

**功能描述**：${algo.description}

**输入参数**：
${algo.inputs.map(input => `- \`${input.name}\`（${input.type}）：${input.description}`).join('\n')}

**输出结果**：
${algo.outputs.map(output => `- \`${output.name}\`（${output.type}）：${output.description}`).join('\n')}

**处理流程**：

\`\`\`mermaid
${diagrams[`algorithm-${sanitizeId(algo.name)}`] || generateSimpleFlowchart(algo)}
\`\`\`

**图4-${i + 1} ${algo.name}流程图**

**算法步骤说明**：

${algo.steps.map((step, si) => 
  `${si + 1}. ${step.description}`
).join('\n')}

`).join('\n')}
`;
}

function generateSection5_DataStructures(analyses, diagrams) {
  return `
## 5. 数据结构设计

本章节描述软件中使用的主要数据实体及其关系。

\`\`\`mermaid
${diagrams['class-diagram']}
\`\`\`

**图5-1 数据结构类图**

### 5.1 主要数据实体

${analyses.data_structures.entities.map((entity, i) => `
#### 5.1.${i + 1} ${entity.name}

**类型**：${entity.type}  
**文件位置**：\`${entity.file}\`

**属性列表**：

| 属性名 | 类型 | 可见性 | 说明 |
|--------|------|--------|------|
${entity.properties.map(p => 
  `| ${p.name} | ${p.type} | ${p.visibility} | ${p.description || '-'} |`
).join('\n')}

`).join('\n')}

### 5.2 实体关系说明

${analyses.data_structures.relationships.map((rel, i) => 
  `${i + 1}. **${rel.from}** ${rel.type} **${rel.to}**：${rel.description || '关联关系'}`
).join('\n')}

`;
}

function generateSection6_Interfaces(analyses, diagrams) {
  return `
## 6. 接口设计

本章节描述软件对外提供的接口定义。

${diagrams.sequence ? `
\`\`\`mermaid
${diagrams.sequence}
\`\`\`

**图6-1 接口调用时序图**
` : ''}

### 6.1 接口列表

${analyses.interfaces.apis.map((api, i) => `
#### 6.1.${i + 1} ${api.name}

- **路径/命令**：\`${api.path}\`
- **方法类型**：${api.method}
- **功能描述**：${api.description}

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
${api.parameters.map(p => 
  `| ${p.name} | ${p.type} | ${p.required ? '是' : '否'} | ${p.description} |`
).join('\n')}

**返回结果**：
- 类型：${api.response.type}
- 说明：${api.response.description}

`).join('\n')}
`;
}

function generateSection7_Exceptions(analyses) {
  return `
## 7. 异常处理设计

本章节描述软件的异常处理机制与错误恢复策略。

### 7.1 异常类型定义

${analyses.exceptions.exception_types.map((ex, i) => `
#### 7.1.${i + 1} ${ex.name}

- **错误码**：\`${ex.code || 'N/A'}\`
- **错误信息**：${ex.message}
- **父类**：${ex.parent || '基础异常类'}
- **定义位置**：\`${ex.file}\`
`).join('\n')}

### 7.2 错误码说明

| 错误码 | 错误信息 | 严重程度 | 类别 |
|--------|----------|----------|------|
${analyses.exceptions.error_codes.map(e => 
  `| ${e.code} | ${e.message} | ${e.severity} | ${e.category} |`
).join('\n')}

### 7.3 异常处理策略

${analyses.exceptions.handling_patterns.map((pattern, i) => `
**${i + 1}. ${pattern.pattern}**

${pattern.description}

应用位置：${pattern.locations.join('、')}
`).join('\n')}

### 7.4 恢复机制

${analyses.exceptions.recovery_strategies.map((strategy, i) => 
  `${i + 1}. **${strategy.strategy}**：${strategy.action}（触发条件：${strategy.trigger}）`
).join('\n')}

`;
}
```

**Step 4.4: Assemble Final Document**

```javascript
const documentContent = [
  header,
  generateSection1_Overview(metadata, analyses),
  generateSection2_Architecture(analyses, diagrams),
  generateSection3_FunctionModules(analyses, diagrams),
  generateSection4_Algorithms(analyses, diagrams),
  generateSection5_DataStructures(analyses, diagrams),
  generateSection6_Interfaces(analyses, diagrams),
  generateSection7_Exceptions(analyses)
].join('\n');

const documentPath = `${outputDir}/${metadata.software_name}-软件设计说明书.md`;
Write(documentPath, documentContent);
```

**Step 4.5: CPCC Compliance Check**

```javascript
function validateCPCCCompliance(document, analyses) {
  const checks = [
    {name: "软件概述完整性", pass: document.includes("## 1. 软件概述")},
    {name: "系统架构图存在", pass: document.includes("图2-1 系统架构图")},
    {name: "功能模块设计完整", pass: document.includes("## 3. 功能模块设计")},
    {name: "核心算法描述", pass: document.includes("## 4. 核心算法与流程")},
    {name: "数据结构设计", pass: document.includes("## 5. 数据结构设计")},
    {name: "接口设计说明", pass: document.includes("## 6. 接口设计")},
    {name: "异常处理设计", pass: document.includes("## 7. 异常处理设计")},
    {name: "Mermaid图表语法", pass: !document.includes("mermaid error")},
    {name: "页眉信息", pass: document.includes("页眉")},
    {name: "页码说明", pass: document.includes("页码")}
  ];
  
  return {
    passed: checks.filter(c => c.pass).length,
    total: checks.length,
    details: checks
  };
}

const compliance = validateCPCCCompliance(documentContent, analyses);
console.log(`CPCC 合规检查: ${compliance.passed}/${compliance.total} 项通过`);
```

**TodoWrite**: Mark Phase 4 completed, Phase 5 in_progress

---

### Phase 5: Iterative Refinement (Discovery-Driven)

**Purpose**: Refine document based on analysis gaps and user feedback

**Step 5.1: Extract Document Gaps**

```javascript
function extractDocumentGaps(analyses, document) {
  return {
    // Missing descriptions
    missingDescriptions: analyses.functions.features
      .filter(f => !f.description || f.description.length < 20),
    
    // Low confidence analyses
    lowConfidenceAreas: Object.entries(analyses)
      .flatMap(([dim, data]) => 
        (data.confidence_scores || []).filter(s => s.score < 0.7)
      ),
    
    // Complex areas needing clarification
    complexAreas: analyses.algorithms.algorithms
      .filter(a => a.complexity === 'high' && a.steps.length < 3),
    
    // Incomplete relationships
    incompleteRelationships: analyses.data_structures.relationships
      .filter(r => !r.description),
    
    // Missing exception handling
    missingExceptionHandling: analyses.exceptions.exception_types
      .filter(e => !e.message || e.message === 'Unknown')
  };
}

const gaps = extractDocumentGaps(analyses, documentContent);
```

**Step 5.2: Generate Targeted Questions**

```javascript
function buildRefinementQuestions(gaps, metadata) {
  const questions = [];
  
  // Question about missing feature descriptions
  if (gaps.missingDescriptions.length > 0) {
    questions.push({
      question: `以下功能缺少详细描述，请选择需要补充说明的功能：`,
      header: "功能描述",
      multiSelect: true,
      options: gaps.missingDescriptions.slice(0, 4).map(f => ({
        label: f.name,
        description: `文件: ${f.entry_file} - 当前描述不完整`
      }))
    });
  }
  
  // Question about complex algorithms
  if (gaps.complexAreas.length > 0) {
    questions.push({
      question: `发现 ${gaps.complexAreas.length} 个复杂算法的流程描述不够详细，是否需要深入分析？`,
      header: "算法详解",
      multiSelect: false,
      options: [
        {label: "是，详细分析所有", description: "为所有复杂算法生成详细流程图"},
        {label: "选择性分析", description: "仅分析最核心的算法"},
        {label: "保持现状", description: "当前描述已足够"}
      ]
    });
  }
  
  // Question about data relationships
  if (gaps.incompleteRelationships.length > 0) {
    questions.push({
      question: `发现 ${gaps.incompleteRelationships.length} 个数据实体关系缺少说明，是否补充？`,
      header: "数据关系",
      multiSelect: false,
      options: [
        {label: "自动推断并补充", description: "基于代码分析自动补充关系说明"},
        {label: "跳过", description: "保持当前状态"}
      ]
    });
  }
  
  // Final action question
  questions.push({
    question: "如何处理当前文档？",
    header: "操作",
    multiSelect: false,
    options: [
      {label: "继续优化", description: "应用上述选择并继续检查"},
      {label: "完成文档", description: "当前文档已满足需求，生成最终版本"},
      {label: "调整范围", description: "修改分析范围或重点"}
    ]
  });
  
  return questions.slice(0, 4);
}

const refinementQuestions = buildRefinementQuestions(gaps, metadata);
AskUserQuestion({questions: refinementQuestions});
```

**Step 5.3: Apply Refinements**

```javascript
async function applyRefinements(responses, gaps, outputDir) {
  const updates = [];
  
  if (responses.功能描述) {
    // Re-analyze selected features with deeper exploration
    for (const feature of responses.功能描述) {
      const deepAnalysis = await Task({
        subagent_type: "cli-explore-agent",
        prompt: `深入分析功能 ${feature.name}，提供详细描述...`
      });
      updates.push({type: 'feature_description', data: deepAnalysis});
    }
  }
  
  if (responses.算法详解 === "是，详细分析所有") {
    // Generate detailed flowcharts for complex algorithms
    for (const algo of gaps.complexAreas) {
      const detailedFlow = await analyzeAlgorithmInDepth(algo);
      updates.push({type: 'algorithm_flowchart', data: detailedFlow});
    }
  }
  
  if (responses.数据关系 === "自动推断并补充") {
    // Infer relationship descriptions from code
    const inferences = await inferRelationshipDescriptions(gaps.incompleteRelationships);
    updates.push({type: 'relationship_descriptions', data: inferences});
  }
  
  return updates;
}

const updates = await applyRefinements(user_responses, gaps, outputDir);
```

**Step 5.4: Regenerate Affected Sections**

```javascript
// Update document with refinements
for (const update of updates) {
  switch (update.type) {
    case 'feature_description':
      analyses.functions = mergeFeatureDescriptions(analyses.functions, update.data);
      break;
    case 'algorithm_flowchart':
      diagrams[`algorithm-${update.data.name}`] = update.data.flowchart;
      break;
    case 'relationship_descriptions':
      analyses.data_structures.relationships = update.data;
      break;
  }
}

// Regenerate document
const updatedDocument = regenerateDocument(metadata, analyses, diagrams);
Write(documentPath, updatedDocument);
Write(`${outputDir}/iterations/v${iteration_count}.md`, documentContent); // Archive
```

**Step 5.5: Loop or Finalize**

```javascript
if (user_responses.操作 === "完成文档") {
  finalized = true;
} else if (user_responses.操作 === "调整范围") {
  goto Phase1_Step1_3;
} else {
  iteration_count++;
  if (iteration_count > 5) {
    console.log("已达到最大迭代次数，建议完成文档");
  }
  goto Step5.1;
}
```

---

### Finalization

**Step 6.1: Generate Final Document**

```javascript
const finalDocument = `
${header}

${documentContent}

---

**文档生成信息**

- 生成工具：/workflow:docs:copyright
- 分析范围：${metadata.scope_path}
- 迭代次数：${iteration_count}
- 生成时间：${new Date().toISOString()}

---

*本文档基于源代码自动分析生成，所有描述均来源于代码实现。*
`;

Write(documentPath, finalDocument);
```

**Step 6.2: Output Summary**

```markdown
## 软件著作权设计说明书生成完成

**软件名称**：${metadata.software_name}
**版本号**：${metadata.version}
**文档路径**：${documentPath}

### 文档统计
- 总章节数：7
- Mermaid 图表数：${Object.keys(diagrams).length}
- 功能模块数：${analyses.functions.feature_list.length}
- 数据实体数：${analyses.data_structures.entities.length}
- 接口数量：${analyses.interfaces.apis.length}

### CPCC 合规检查
${compliance.details.map(c => `- [${c.pass ? '✓' : '✗'}] ${c.name}`).join('\n')}

### 后续步骤
1. 检查生成的 Mermaid 图表是否正确渲染
2. 补充任何需要人工说明的细节
3. 将文档转换为 PDF 格式（A4 纵向）
4. 确认页眉、页码格式符合要求
```

**TodoWrite**: Mark all phases completed

---

## Mermaid 语法规范

**关键规则**（确保图表正确渲染）：

```javascript
// 1. 特殊字符转义 - 使用双引号包裹
// 正确
A["处理(数据)"] --> B["验证{结果}"]

// 错误
A[处理(数据)] --> B[验证{结果}]

// 2. 边标签转义
// 正确
A -->|"调用(参数)"| B

// 错误
A -->|调用(参数)| B

// 3. 节点 ID 规范 - 仅使用字母数字下划线
// 正确
UserService --> AuthModule

// 错误
User-Service --> Auth.Module

// 4. 子图标题
// 正确
subgraph ServiceLayer["服务层(核心)"]

// 错误
subgraph ServiceLayer[服务层(核心)]
```

## Usage Examples

```bash
# 交互式生成（引导输入所有信息）
/workflow:docs:copyright src/

# 指定软件名称和版本
/workflow:docs:copyright src/ --name="智能数据分析系统" --version="V1.0.0"

# 分析特定模块
/workflow:docs:copyright src/core --name="核心处理引擎" --version="V2.1.0"
```

## Output Structure

```
.workflow/.scratchpad/copyright-{timestamp}/
├── project-metadata.json        # 软件元数据
├── project-discovery.json       # 项目发现结果
├── analysis-architecture.json   # 架构分析
├── analysis-functions.json      # 功能分析
├── analysis-algorithms.json     # 算法分析
├── analysis-data_structures.json # 数据结构分析
├── analysis-interfaces.json     # 接口分析
├── analysis-exceptions.json     # 异常处理分析
├── diagrams/                    # Mermaid 图表
│   ├── architecture.mmd
│   ├── functions.mmd
│   ├── class-diagram.mmd
│   ├── algorithm-*.mmd
│   └── sequence-*.mmd
├── iterations/                  # 迭代版本
│   ├── v1.md
│   └── ...
└── {软件名称}-软件设计说明书.md  # 最终文档
```

## Related Commands

**Follow-up Commands**:
- `/workflow:analyze` - 更深入的项目分析
- `/memory:docs` - 生成技术文档

**Alternative Commands**:
- `/workflow:docs:copyright --lite` - 简化版（仅生成必要章节）
