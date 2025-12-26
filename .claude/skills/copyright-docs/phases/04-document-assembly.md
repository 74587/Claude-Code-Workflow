# Phase 4: Document Assembly

Assemble all analysis and diagrams into CPCC-compliant document.

## Execution

### Document Structure (7 Sections)

```markdown
<!-- 页眉：{软件名称} - 版本号：{版本号} -->
<!-- 注：最终文档页码位于每页右上角 -->

## 1. 软件概述
### 1.1 软件背景与用途
### 1.2 开发目标与特点
### 1.3 运行环境与技术架构

## 2. 系统架构图
图2-1 系统架构图
(Mermaid graph TD)

## 3. 功能模块设计
图3-1 功能模块结构图
(Mermaid flowchart TD)

## 4. 核心算法与流程
图4-1 {算法名称}流程图
(Mermaid flowchart TD)

## 5. 数据结构设计
图5-1 数据结构类图
(Mermaid classDiagram)

## 6. 接口设计
图6-1 接口调用时序图
(Mermaid sequenceDiagram)

## 7. 异常处理设计
图7-1 异常处理流程图
(Mermaid flowchart TD)
```

### Section Templates

**Section 1: 软件概述**
```markdown
## 1. 软件概述

### 1.1 软件背景与用途

${software_name}是一款${category}软件，主要用于${inferred_purpose}。

本软件基于${tech_stack.language}语言开发，采用${tech_stack.framework}实现核心功能。

### 1.2 开发目标与特点

**开发目标**：
${objectives}

**技术特点**：
${features}

### 1.3 运行环境与技术架构

**运行环境**：
- 操作系统：${os}
- 运行时：${runtime}
- 依赖环境：${dependencies}

**技术架构**：
- 架构模式：${architecture_pattern}
- 核心框架：${framework}
```

**Section 2-7: Pattern**
```markdown
## {N}. {章节标题}

本章节展示${software_name}的{描述}。

\`\`\`mermaid
${diagram_content}
\`\`\`

**图{N}-1 {图表标题}**

### {子标题}

{详细说明}
```

### Figure Numbering

| Section | Figure Number | Title |
|---------|---------------|-------|
| 2 | 图2-1 | 系统架构图 |
| 3 | 图3-1 | 功能模块结构图 |
| 4 | 图4-1, 图4-2... | {算法名称}流程图 |
| 5 | 图5-1 | 数据结构类图 |
| 6 | 图6-1, 图6-2... | {接口名称}时序图 |
| 7 | 图7-1 | 异常处理流程图 |

### Assembly Code

```javascript
function assembleDocument(metadata, analyses, diagrams) {
  let doc = '';
  
  // Header
  doc += `<!-- 页眉：${metadata.software_name} - 版本号：${metadata.version} -->\n`;
  doc += `<!-- 注：最终文档页码位于每页右上角 -->\n\n`;
  
  // Generate each section
  doc += generateSection1(metadata, analyses.architecture);
  doc += generateSection2(analyses.architecture, diagrams.architecture);
  doc += generateSection3(analyses.functions, diagrams.functions, metadata.software_name);
  doc += generateSection4(analyses.algorithms, diagrams.algorithms);
  doc += generateSection5(analyses.data_structures, diagrams.class);
  doc += generateSection6(analyses.interfaces, diagrams.sequences);
  doc += generateSection7(analyses.exceptions, diagrams.exception_flow);
  
  return doc;
}
```

## Output

Generate `{软件名称}-软件设计说明书.md`.
