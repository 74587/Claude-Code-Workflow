# Phase 3: Deep Analysis

并行 Agent 直接写入 MD 章节文件，返回简要信息。

> **规范参考**: [../specs/quality-standards.md](../specs/quality-standards.md)

## Agent 配置

根据报告类型，使用不同的 Agent 配置：

### Architecture Report Agents

| Agent | 输出文件 | 章节 |
|-------|----------|------|
| overview | sections/section-overview.md | System Overview |
| layers | sections/section-layers.md | Layer Analysis |
| dependencies | sections/section-dependencies.md | Module Dependencies |
| dataflow | sections/section-dataflow.md | Data Flow |
| entrypoints | sections/section-entrypoints.md | Entry Points & Critical Paths |

### Design Report Agents

| Agent | 输出文件 | 章节 |
|-------|----------|------|
| patterns | sections/section-patterns.md | Design Patterns Used |
| classes | sections/section-classes.md | Class Relationships |
| interfaces | sections/section-interfaces.md | Interface Contracts |
| state | sections/section-state.md | State Management |

### Methods Report Agents

| Agent | 输出文件 | 章节 |
|-------|----------|------|
| algorithms | sections/section-algorithms.md | Core Algorithms |
| paths | sections/section-paths.md | Critical Code Paths |
| apis | sections/section-apis.md | Public API Reference |
| logic | sections/section-logic.md | Complex Logic Breakdown |

---

## 通用 Agent 返回格式

```typescript
interface AgentReturn {
  status: "completed" | "partial" | "failed";
  output_file: string;
  summary: string;               // 50字以内
  cross_module_notes: string[];  // 跨模块发现
  stats: {
    diagrams: number;
    code_refs: number;
  };
}
```

---

## Agent 提示词模板

### Overview Agent (Architecture)

```javascript
Task({
  subagent_type: "cli-explore-agent",
  prompt: `
[ROLE] 系统架构师，专注于系统全貌和核心组件。

[TASK]
分析 ${config.scope}，生成 System Overview 章节。
输出: ${outDir}/sections/section-overview.md

[QUALITY_SPEC]
- 内容基于代码分析，无臆测
- 代码引用格式: \`file:line\`
- 每个子章节 ≥100字
- 包含至少1个 Mermaid 图表

[TEMPLATE]
## System Overview

### Project Summary
{项目概述，技术栈，核心功能}

### Architecture Diagram
\`\`\`mermaid
graph TD
    subgraph Core["核心层"]
        A[组件A]
    end
\`\`\`

### Key Components
| 组件 | 职责 | 文件 |
|------|------|------|

### Technology Stack
| 技术 | 用途 | 版本 |
|------|------|------|

[FOCUS]
1. 项目定位和核心功能
2. 技术栈和依赖
3. 核心组件及职责
4. 整体架构模式

[RETURN JSON]
{"status":"completed","output_file":"section-overview.md","summary":"<50字>","cross_module_notes":[],"stats":{"diagrams":1,"code_refs":5}}
`
})
```

### Layers Agent (Architecture)

```javascript
Task({
  subagent_type: "cli-explore-agent",
  prompt: `
[ROLE] 架构分析师，专注于分层结构。

[TASK]
分析 ${config.scope}，生成 Layer Analysis 章节。
输出: ${outDir}/sections/section-layers.md

[QUALITY_SPEC]
- 内容基于代码分析，无臆测
- 代码引用格式: \`file:line\`
- 每个子章节 ≥100字

[TEMPLATE]
## Layer Analysis

### Layer Overview
\`\`\`mermaid
graph TD
    L1[表现层] --> L2[业务层]
    L2 --> L3[数据层]
\`\`\`

### Layer Details
| 层级 | 目录 | 职责 | 组件数 |
|------|------|------|--------|

### Layer Interactions
{层间交互说明}

### Violations & Recommendations
{违反分层的情况和建议}

[FOCUS]
1. 识别代码分层（按目录/命名空间）
2. 每层职责和边界
3. 层间依赖方向
4. 违反分层原则的情况

[RETURN JSON]
{"status":"completed","output_file":"section-layers.md","summary":"<50字>","cross_module_notes":[],"stats":{}}
`
})
```

### Dependencies Agent (Architecture)

```javascript
Task({
  subagent_type: "cli-explore-agent",
  prompt: `
[ROLE] 依赖分析师，专注于模块依赖关系。

[TASK]
分析 ${config.scope}，生成 Module Dependencies 章节。
输出: ${outDir}/sections/section-dependencies.md

[TEMPLATE]
## Module Dependencies

### Dependency Graph
\`\`\`mermaid
graph LR
    A[ModuleA] --> B[ModuleB]
    A --> C[ModuleC]
    B --> D[ModuleD]
\`\`\`

### Module List
| 模块 | 路径 | 依赖数 | 被依赖数 |
|------|------|--------|----------|

### Critical Dependencies
{核心依赖说明}

### Circular Dependencies
{循环依赖检测结果}

[FOCUS]
1. 模块间依赖关系
2. 依赖方向（单向/双向）
3. 循环依赖检测
4. 核心模块识别

[RETURN JSON]
{"status":"completed","output_file":"section-dependencies.md","summary":"<50字>","cross_module_notes":["发现循环依赖: A <-> B"],"stats":{}}
`
})
```

### Patterns Agent (Design)

```javascript
Task({
  subagent_type: "cli-explore-agent",
  prompt: `
[ROLE] 设计模式专家，专注于识别和分析设计模式。

[TASK]
分析 ${config.scope}，生成 Design Patterns 章节。
输出: ${outDir}/sections/section-patterns.md

[TEMPLATE]
## Design Patterns Used

### Pattern Summary
| 模式 | 类型 | 实现位置 | 说明 |
|------|------|----------|------|

### Pattern Details

#### Singleton Pattern
**位置**: \`src/core/config.ts:15\`
**说明**: {实现说明}
\`\`\`mermaid
classDiagram
    class Singleton {
        -instance: Singleton
        +getInstance()
    }
\`\`\`

### Pattern Recommendations
{模式使用建议}

[FOCUS]
1. 识别使用的设计模式（GoF 23种 + 其他）
2. 模式实现质量评估
3. 模式使用建议

[RETURN JSON]
{"status":"completed","output_file":"section-patterns.md","summary":"<50字>","cross_module_notes":[],"stats":{}}
`
})
```

### Algorithms Agent (Methods)

```javascript
Task({
  subagent_type: "cli-explore-agent",
  prompt: `
[ROLE] 算法分析师，专注于核心算法和复杂度。

[TASK]
分析 ${config.scope}，生成 Core Algorithms 章节。
输出: ${outDir}/sections/section-algorithms.md

[TEMPLATE]
## Core Algorithms

### Algorithm Inventory
| 算法 | 文件 | 复杂度 | 说明 |
|------|------|--------|------|

### Algorithm Details

#### {算法名称}
**位置**: \`src/algo/xxx.ts:42\`
**复杂度**: 时间 O(n log n), 空间 O(n)

\`\`\`mermaid
flowchart TD
    Start([开始]) --> Process[处理]
    Process --> End([结束])
\`\`\`

**说明**: {算法说明，≥100字}

### Optimization Suggestions
{优化建议}

[FOCUS]
1. 核心业务算法
2. 复杂度分析
3. 算法流程图
4. 优化建议

[RETURN JSON]
{"status":"completed","output_file":"section-algorithms.md","summary":"<50字>","cross_module_notes":[],"stats":{}}
`
})
```

---

## 执行流程

```javascript
// 1. 根据报告类型选择 Agent 配置
const agentConfigs = getAgentConfigs(config.type);

// 2. 准备目录
Bash(`mkdir -p ${outputDir}/sections`);

// 3. 并行启动所有 Agent
const results = await Promise.all(
  agentConfigs.map(agent => launchAgent(agent, config, outputDir))
);

// 4. 收集简要返回信息
const summaries = results.map(r => JSON.parse(r));

// 5. 传递给 Phase 3.5 汇总 Agent
return {
  summaries,
  cross_notes: summaries.flatMap(s => s.cross_module_notes)
};
```

## Output

各 Agent 写入 `sections/section-xxx.md`，返回简要 JSON 供 Phase 3.5 汇总。
