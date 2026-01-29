# SKILL.md Template

用于生成新 Skill 入口文件的模板。

## Purpose

生成新 Skill 的入口文件 (SKILL.md)，作为 Skill 的主文档和执行入口点。

## Usage Context

| Phase | Usage |
|-------|-------|
| Phase 2 (Structure Generation) | 创建 SKILL.md 入口文件 |
| Generation Trigger | `config.execution_mode` 决定架构图样式 |
| Output Location | `.claude/skills/{skill-name}/SKILL.md` |

---

## ⚠️ 重要：YAML Front Matter 规范

> **CRITICAL**: SKILL.md 文件必须以 YAML front matter 开头，即以 `---` 作为文件第一行。
>
> **禁止**使用以下格式：
> - `# Title` 然后 `## Metadata` + yaml 代码块 ❌
> - 任何在 `---` 之前的内容 ❌
>
> **正确格式**：文件第一行必须是 `---`

## 可直接应用的模板

以下是完整的 SKILL.md 模板。生成时**直接复制应用**，将 `{{变量}}` 替换为实际值：

---
name: {{skill_name}}
description: {{description}}. Triggers on {{triggers}}.
allowed-tools: {{allowed_tools}}
---

# {{display_name}}

{{description}}

## Architecture Overview

\`\`\`
{{architecture_diagram}}
\`\`\`

## Key Design Principles

{{design_principles}}

---

## ⚠️ Mandatory Prerequisites (强制前置条件)

> **⛔ 禁止跳过**: 在执行任何操作之前，**必须**完整阅读以下文档。未阅读规范直接执行将导致输出不符合质量标准。

{{mandatory_prerequisites}}

---

## Execution Flow

{{execution_flow}}

## Directory Setup

\`\`\`javascript
const timestamp = new Date().toISOString().slice(0,19).replace(/[-:T]/g, '');
const workDir = \`{{output_location}}\`;

Bash(\`mkdir -p "\${workDir}"\`);
{{additional_dirs}}
\`\`\`

## Output Structure

\`\`\`
{{output_structure}}
\`\`\`

## Reference Documents by Phase

> **重要**: 参考文档应按执行阶段组织，清晰标注使用时机和场景。避免平铺文档列表。

{{reference_table}}

---

## 变量说明

| 变量 | 类型 | 来源 |
|------|------|------|
| `{{skill_name}}` | string | config.skill_name |
| `{{display_name}}` | string | config.display_name |
| `{{description}}` | string | config.description |
| `{{triggers}}` | string | config.triggers.join(", ") |
| `{{allowed_tools}}` | string | config.allowed_tools.join(", ") |
| `{{architecture_diagram}}` | string | 根据 execution_mode 生成 (包含 Phase 0) |
| `{{design_principles}}` | string | 根据 execution_mode 生成 |
| `{{mandatory_prerequisites}}` | string | 强制前置阅读文档列表 (specs + templates) |
| `{{execution_flow}}` | string | 根据 phases/actions 生成 (Phase 0 在最前) |
| `{{output_location}}` | string | config.output.location |
| `{{additional_dirs}}` | string | 根据 execution_mode 生成 |
| `{{output_structure}}` | string | 根据配置生成 |
| `{{reference_table}}` | string | 根据文件列表生成 |

## 生成函数

```javascript
function generateSkillMd(config) {
  const template = Read('templates/skill-md.md');

  return template
    .replace(/\{\{skill_name\}\}/g, config.skill_name)
    .replace(/\{\{display_name\}\}/g, config.display_name)
    .replace(/\{\{description\}\}/g, config.description)
    .replace(/\{\{triggers\}\}/g, config.triggers.map(t => `"${t}"`).join(", "))
    .replace(/\{\{allowed_tools\}\}/g, config.allowed_tools.join(", "))
    .replace(/\{\{architecture_diagram\}\}/g, generateArchitecture(config))  // 包含 Phase 0
    .replace(/\{\{design_principles\}\}/g, generatePrinciples(config))
    .replace(/\{\{mandatory_prerequisites\}\}/g, generatePrerequisites(config))  // 强制前置条件
    .replace(/\{\{execution_flow\}\}/g, generateFlow(config))  // Phase 0 在最前
    .replace(/\{\{output_location\}\}/g, config.output.location)
    .replace(/\{\{additional_dirs\}\}/g, generateAdditionalDirs(config))
    .replace(/\{\{output_structure\}\}/g, generateOutputStructure(config))
    .replace(/\{\{reference_table\}\}/g, generateReferenceTable(config));
}

// 生成强制前置条件表格
function generatePrerequisites(config) {
  const specs = config.specs || [];
  const templates = config.templates || [];

  let result = '### 规范文档 (必读)\n\n';
  result += '| Document | Purpose | When |\n';
  result += '|----------|---------|------|\n';

  specs.forEach((spec, index) => {
    const when = index === 0 ? '**执行前必读**' : '执行前推荐';
    result += `| [${spec.path}](${spec.path}) | ${spec.purpose} | ${when} |\n`;
  });

  if (templates.length > 0) {
    result += '\n### 模板文件 (生成前必读)\n\n';
    result += '| Document | Purpose |\n';
    result += '|----------|---------|\n';
    templates.forEach(tmpl => {
      result += `| [${tmpl.path}](${tmpl.path}) | ${tmpl.purpose} |\n`;
    });
  }

  return result;
}

// ⭐ 新增：生成分阶段参考文档指南
function generateReferenceTable(config) {
  const phases = config.phases || config.actions || [];
  const specs = config.specs || [];
  const templates = config.templates || [];

  let result = '';

  // 为每个执行阶段生成文档导航
  phases.forEach((phase, index) => {
    const phaseNum = index + 1;
    const phaseEmoji = getPhaseEmoji(phase.type || 'default');
    const phaseTitle = phase.display_name || phase.name;

    result += `### ${phaseEmoji} Phase ${phaseNum}: ${phaseTitle}\n`;
    result += `执行Phase ${phaseNum}时查阅的文档\n\n`;

    // 列出该阶段相关的文档
    const relatedDocs = filterDocsByPhase(specs, phase, index);
    if (relatedDocs.length > 0) {
      result += '| Document | Purpose | When to Use |\n';
      result += '|----------|---------|-------------|\n';
      relatedDocs.forEach(doc => {
        result += `| [${doc.path}](${doc.path}) | ${doc.purpose} | ${doc.context || '查阅内容'} |\n`;
      });
      result += '\n';
    }
  });

  // 问题排查部分
  result += '### 🔍 Debugging & Troubleshooting (问题排查)\n';
  result += '遇到问题时查阅的文档\n\n';
  result += '| Issue | Solution Document |\n';
  result += '|-------|-------------------|\n';
  result += `| Phase执行失败 | 查阅相应Phase的文档 |\n`;
  result += `| 输出不符合预期 | [specs/quality-standards.md](specs/quality-standards.md) - 验证质量标准 |\n`;
  result += '\n';

  // 深度学习参考
  result += '### 📚 Reference & Background (深度学习)\n';
  result += '用于理解原始实现和设计决策\n\n';
  result += '| Document | Purpose | Notes |\n';
  result += '|----------|---------|-------|\n';
  templates.forEach(tmpl => {
    result += `| [${tmpl.path}](${tmpl.path}) | ${tmpl.purpose} | 生成时参考 |\n`;
  });

  return result;
}

// 辅助函数：获取Phase表情符号
function getPhaseEmoji(phaseType) {
  const emojiMap = {
    'discovery': '📋',
    'generation': '🔧',
    'analysis': '🔍',
    'implementation': '⚙️',
    'validation': '✅',
    'completion': '🏁',
    'default': '📌'
  };
  return emojiMap[phaseType] || emojiMap['default'];
}

// 辅助函数：根据Phase过滤文档
function filterDocsByPhase(specs, phase, phaseIndex) {
  // 简单过滤逻辑：匹配phase名称关键词
  const keywords = phase.name.toLowerCase().split('-');
  return specs.filter(spec => {
    const specName = spec.path.toLowerCase();
    return keywords.some(kw => specName.includes(kw));
  });
}
```

## Sequential 模式示例

```markdown
---
name: api-docs-generator
description: Generate API documentation from source code. Triggers on "generate api docs", "api documentation".
allowed-tools: Task, Read, Write, Glob, Grep, Bash
---

# API Docs Generator

Generate API documentation from source code.

## Architecture Overview

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Phase 0: Specification  → 阅读并理解设计规范 (强制前置)      │
│              Study                                               │
│           ↓                                                      │
│  Phase 1: Scanning        → endpoints.json                      │
│           ↓                                                      │
│  Phase 2: Parsing         → schemas.json                        │
│           ↓                                                      │
│  Phase 3: Generation      → api-docs.md                         │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

## ⚠️ Mandatory Prerequisites (强制前置条件)

> **⛔ 禁止跳过**: 在执行任何操作之前，**必须**完整阅读以下文档。

### 规范文档 (必读)

| Document | Purpose | Priority |
|----------|---------|----------|
| [specs/api-standards.md](specs/api-standards.md) | API 文档标准规范 | **P0 - 最高** |

### 模板文件 (生成前必读)

| Document | Purpose |
|----------|---------|
| [templates/endpoint-doc.md](templates/endpoint-doc.md) | 端点文档模板 |
```

## Autonomous 模式示例

```markdown
---
name: task-manager
description: Interactive task management with CRUD operations. Triggers on "manage tasks", "task list".
allowed-tools: Task, AskUserQuestion, Read, Write
---

# Task Manager

Interactive task management with CRUD operations.

## Architecture Overview

\`\`\`
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️ Phase 0: Specification Study (强制前置)                       │
└───────────────┬─────────────────────────────────────────────────┘
                ↓
┌─────────────────────────────────────────────────────────────────┐
│           Orchestrator (状态驱动决策)                             │
└───────────────┬─────────────────────────────────────────────────┘
                │
    ┌───────────┼───────────┬───────────┐
    ↓           ↓           ↓           ↓
┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐
│ List  │  │Create │  │ Edit  │  │Delete │
└───────┘  └───────┘  └───────┘  └───────┘
\`\`\`

## ⚠️ Mandatory Prerequisites (强制前置条件)

> **⛔ 禁止跳过**: 在执行任何操作之前，**必须**完整阅读以下文档。

### 规范文档 (必读)

| Document | Purpose | Priority |
|----------|---------|----------|
| [specs/task-schema.md](specs/task-schema.md) | 任务数据结构规范 | **P0 - 最高** |
| [specs/action-catalog.md](specs/action-catalog.md) | 动作目录 | P1 |

### 模板文件 (生成前必读)

| Document | Purpose |
|----------|---------|
| [templates/orchestrator-base.md](templates/orchestrator-base.md) | 编排器模板 |
| [templates/action-base.md](templates/action-base.md) | 动作模板 |
```
