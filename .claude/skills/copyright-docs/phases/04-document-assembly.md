# Phase 4: Document Assembly

合并所有章节文件，生成最终 CPCC 合规文档。

> **规范参考**: [../specs/cpcc-requirements.md](../specs/cpcc-requirements.md)

## 输入

```typescript
interface AssemblyInput {
  output_dir: string;
  metadata: ProjectMetadata;
  consolidation: {
    issues: { errors: Issue[], warnings: Issue[], info: Issue[] };
    stats: { total_sections: number, total_diagrams: number };
  };
}
```

## 执行流程

```javascript
// 1. 检查是否有阻塞性问题
if (consolidation.issues.errors.length > 0) {
  // 阻止装配，先修复
  return AskUserQuestion({
    questions: [{
      question: `发现 ${consolidation.issues.errors.length} 个严重问题，如何处理？`,
      header: "阻塞问题",
      multiSelect: false,
      options: [
        {label: "查看并修复", description: "显示问题列表，手动修复后重试"},
        {label: "忽略继续", description: "跳过问题检查，继续装配"},
        {label: "终止", description: "停止文档生成"}
      ]
    }]
  });
}

// 2. 读取章节文件
const sections = [
  Read(`${outputDir}/sections/section-2-architecture.md`),
  Read(`${outputDir}/sections/section-3-functions.md`),
  Read(`${outputDir}/sections/section-4-algorithms.md`),
  Read(`${outputDir}/sections/section-5-data-structures.md`),
  Read(`${outputDir}/sections/section-6-interfaces.md`),
  Read(`${outputDir}/sections/section-7-exceptions.md`)
];

// 3. 读取汇总报告
const crossModuleSummary = Read(`${outputDir}/cross-module-summary.md`);

// 4. 装配文档
const finalDoc = assembleDocument(metadata, sections, crossModuleSummary);

// 5. 写入最终文件
Write(`${outputDir}/${metadata.software_name}-软件设计说明书.md`, finalDoc);
```

## 文档结构

```markdown
<!-- 页眉：{软件名称} - 版本号：{版本号} -->
<!-- 注：最终文档页码位于每页右上角 -->

# {软件名称} 软件设计说明书

## 文档信息

| 项目 | 内容 |
|------|------|
| 软件名称 | {software_name} |
| 版本号 | {version} |
| 生成日期 | {date} |

---

## 1. 软件概述

### 1.1 软件背景与用途
{从 metadata 生成}

### 1.2 开发目标与特点
{从 metadata 生成}

### 1.3 运行环境与技术架构
{从 metadata.tech_stack 生成}

---

<!-- 以下章节直接引用 Agent 产出 -->

{section-2-architecture.md 内容}

---

{section-3-functions.md 内容}

---

{section-4-algorithms.md 内容}

---

{section-5-data-structures.md 内容}

---

{section-6-interfaces.md 内容}

---

{section-7-exceptions.md 内容}

---

## 附录A：跨模块分析

{cross-module-summary.md 的问题列表和关联图}

---

## 附录B：文档统计

| 章节 | 图表数 | 字数 |
|------|--------|------|
| ... | ... | ... |

---

<!-- 页脚：生成时间 {timestamp} -->
```

## Section 1 生成

```javascript
function generateSection1(metadata) {
  const categoryDescriptions = {
    "命令行工具 (CLI)": "提供命令行界面，用户通过终端命令与系统交互",
    "后端服务/API": "提供 RESTful/GraphQL API 接口，支持前端或其他服务调用",
    "SDK/库": "提供可复用的代码库，供其他项目集成使用",
    "数据处理系统": "处理数据导入、转换、分析和导出",
    "自动化脚本": "自动执行重复性任务，提高工作效率"
  };

  return `
## 1. 软件概述

### 1.1 软件背景与用途

${metadata.software_name}是一款${metadata.category}软件。${categoryDescriptions[metadata.category]}

本软件基于${metadata.tech_stack.language}语言开发，运行于${metadata.tech_stack.runtime}环境，采用${metadata.tech_stack.framework || '原生'}框架实现核心功能。

### 1.2 开发目标与特点

**开发目标**：
${generateObjectives(metadata)}

**技术特点**：
${generateFeatures(metadata)}

### 1.3 运行环境与技术架构

**运行环境**：
- 操作系统：${metadata.os || 'Windows/Linux/macOS'}
- 运行时：${metadata.tech_stack.runtime}
- 依赖环境：${metadata.tech_stack.dependencies?.join(', ') || '无'}

**技术架构**：
- 架构模式：${metadata.architecture_pattern || '分层架构'}
- 核心框架：${metadata.tech_stack.framework || '原生实现'}
- 主要模块：${metadata.main_modules?.join(', ') || '见第2章'}
`;
}
```

## 装配函数

```javascript
function assembleDocument(metadata, sections, crossModuleSummary) {
  const header = `<!-- 页眉：${metadata.software_name} - 版本号：${metadata.version} -->
<!-- 注：最终文档页码位于每页右上角 -->

# ${metadata.software_name} 软件设计说明书

## 文档信息

| 项目 | 内容 |
|------|------|
| 软件名称 | ${metadata.software_name} |
| 版本号 | ${metadata.version} |
| 生成日期 | ${new Date().toLocaleDateString('zh-CN')} |

---

`;

  const section1 = generateSection1(metadata);

  // 合并章节 (sections 已经是完整的 MD 内容)
  const mainContent = sections.join('\n\n---\n\n');

  // 提取跨模块问题作为附录
  const appendixA = extractAppendixA(crossModuleSummary);

  // 生成统计
  const appendixB = generateStats(sections);

  const footer = `
---

<!-- 页脚：生成时间 ${new Date().toISOString()} -->
`;

  return header + section1 + '\n\n---\n\n' + mainContent + '\n\n' + appendixA + '\n\n' + appendixB + footer;
}
```

## 附录生成

### 附录A：跨模块分析

```javascript
function extractAppendixA(crossModuleSummary) {
  // 从 cross-module-summary.md 提取关键内容
  return `
## 附录A：跨模块分析

本附录汇总了文档生成过程中发现的跨模块问题和关联关系。

${extractSection(crossModuleSummary, '## 2. 发现的问题')}

${extractSection(crossModuleSummary, '## 3. 跨模块关联图')}
`;
}
```

### 附录B：文档统计

```javascript
function generateStats(sections) {
  const stats = sections.map((content, idx) => {
    const diagrams = (content.match(/```mermaid/g) || []).length;
    const words = content.length;
    const sectionNames = ['系统架构图', '功能模块设计', '核心算法与流程',
                          '数据结构设计', '接口设计', '异常处理设计'];
    return { name: sectionNames[idx], diagrams, words };
  });

  let table = `
## 附录B：文档统计

| 章节 | 图表数 | 字数 |
|------|--------|------|
`;

  stats.forEach(s => {
    table += `| ${s.name} | ${s.diagrams} | ${s.words} |\n`;
  });

  const total = stats.reduce((acc, s) => ({
    diagrams: acc.diagrams + s.diagrams,
    words: acc.words + s.words
  }), { diagrams: 0, words: 0 });

  table += `| **总计** | **${total.diagrams}** | **${total.words}** |\n`;

  return table;
}
```

## 输出

- 最终文档: `{软件名称}-软件设计说明书.md`
- 保留原始章节文件供追溯
