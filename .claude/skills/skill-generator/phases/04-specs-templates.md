# Phase 4: Specifications & Templates Generation

Generate domain requirements, quality standards, agent templates, and action catalogs.

## Objective

Generate comprehensive specifications and templates:
- Domain requirements document with validation function
- Quality standards with automated check system
- Agent base template with prompt structure
- Action catalog for autonomous mode (conditional)

## Input

**File Dependencies**:
- `skill-config.json` (from Phase 1)
- `.claude/skills/{skill-name}/` directory (from Phase 2)
- Generated phase/action files (from Phase 3)

**Required Information**:
- Skill name, display name, description
- Execution mode (determines if action-catalog.md is generated)
- Output format and location
- Phase/action definitions

## Output

**Generated Files**:

| File | Purpose | Generation Condition |
|------|---------|---------------------|
| `specs/{skill-name}-requirements.md` | Domain requirements with validation | Always |
| `specs/quality-standards.md` | Quality evaluation criteria | Always |
| `templates/agent-base.md` | Agent prompt template | Always |
| `specs/action-catalog.md` | Action dependency graph and selection priority | Autonomous/Hybrid mode only |

**File Structure**:

**Domain Requirements** (`specs/{skill-name}-requirements.md`):
```markdown
# {display_name} Requirements
- When to Use (phase/action reference table)
- Domain Requirements (功能要求, 输出要求, 质量要求)
- Validation Function (JavaScript code)
- Error Handling (recovery strategies)
```

**Quality Standards** (`specs/quality-standards.md`):
```markdown
# Quality Standards
- Quality Dimensions (Completeness 25%, Consistency 25%, Accuracy 25%, Usability 25%)
- Quality Gates (Pass ≥80%, Review 60-79%, Fail <60%)
- Issue Classification (Errors, Warnings, Info)
- Automated Checks (runQualityChecks function)
```

**Agent Base** (`templates/agent-base.md`):
```markdown
# Agent Base Template
- 通用 Prompt 结构 (ROLE, PROJECT CONTEXT, TASK, CONSTRAINTS, OUTPUT_FORMAT, QUALITY_CHECKLIST)
- 变量说明 (workDir, output_path)
- 返回格式 (AgentReturn interface)
- 角色定义参考 (phase/action specific agents)
```

**Action Catalog** (`specs/action-catalog.md`, Autonomous/Hybrid only):
```markdown
# Action Catalog
- Available Actions (table with Purpose, Preconditions, Effects)
- Action Dependencies (Mermaid diagram)
- State Transitions (state machine table)
- Selection Priority (ordered action list)
```

## Decision Logic

```
Decision (execution_mode check):
   ├─ mode === 'sequential' → Generate 3 files only
   │  └─ Files: requirements.md, quality-standards.md, agent-base.md
   │
   ├─ mode === 'autonomous' → Generate 4 files
   │  ├─ Files: requirements.md, quality-standards.md, agent-base.md
   │  └─ Additional: action-catalog.md (with action dependencies)
   │
   └─ mode === 'hybrid' → Generate 4 files
      ├─ Files: requirements.md, quality-standards.md, agent-base.md
      └─ Additional: action-catalog.md (with hybrid logic)
```

## Execution Protocol

```javascript
// Phase 4: Generate Specifications & Templates
// Reference: phases/04-specs-templates.md

// Load config and setup
const config = JSON.parse(Read(`${workDir}/skill-config.json`));
const skillDir = `.claude/skills/${config.skill_name}`;

// Ensure specs and templates directories exist (created in Phase 2)
// skillDir structure: phases/, specs/, templates/

// Step 1: Generate domain requirements
const domainRequirements = `# ${config.display_name} Requirements

${config.description}

## When to Use

| Phase | Usage | Reference |
|-------|-------|-----------|
${config.execution_mode === 'sequential' ?
  config.sequential_config.phases.map((p, i) =>
    `| Phase ${i+1} | ${p.name} | ${p.id}.md |`
  ).join('\n') :
  `| Orchestrator | 动作选择 | orchestrator.md |
| Actions | 动作执行 | actions/*.md |`}

---

## Domain Requirements

### 功能要求

- [ ] 要求1: TODO
- [ ] 要求2: TODO
- [ ] 要求3: TODO

### 输出要求

- [ ] 格式: ${config.output.format}
- [ ] 位置: ${config.output.location}
- [ ] 命名: ${config.output.filename_pattern}

### 质量要求

- [ ] 完整性: 所有必需内容存在
- [ ] 一致性: 术语和格式统一
- [ ] 准确性: 内容基于实际分析

## Validation Function

\`\`\`javascript
function validate${toPascalCase(config.skill_name)}(output) {
  const checks = [
    // TODO: 添加验证规则
    { name: "格式正确", pass: output.format === "${config.output.format}" },
    { name: "内容完整", pass: output.content?.length > 0 }
  ];

  return {
    passed: checks.filter(c => c.pass).length,
    total: checks.length,
    details: checks
  };
}
\`\`\`

## Error Handling

| Error | Recovery |
|-------|----------|
| 输入数据缺失 | 返回明确错误信息 |
| 处理超时 | 缩小范围，重试 |
| 输出验证失败 | 记录问题，人工审核 |
`;

Write(`${skillDir}/specs/${config.skill_name}-requirements.md`, domainRequirements);

// Step 2: Generate quality standards
const qualityStandards = `# Quality Standards

${config.display_name} 的质量评估标准。

## Quality Dimensions

### 1. Completeness (完整性) - 25%

| 要求 | 权重 | 检查方式 |
|------|------|----------|
| 所有必需输出存在 | 10 | 文件检查 |
| 内容覆盖完整 | 10 | 内容分析 |
| 无占位符残留 | 5 | 文本搜索 |

### 2. Consistency (一致性) - 25%

| 方面 | 检查 |
|------|------|
| 术语 | 同一概念使用相同术语 |
| 格式 | 标题层级、代码块格式一致 |
| 风格 | 语气和表达方式统一 |

### 3. Accuracy (准确性) - 25%

| 要求 | 说明 |
|------|------|
| 数据正确 | 引用和数据无错误 |
| 逻辑正确 | 流程和关系描述准确 |
| 代码正确 | 代码示例可运行 |

### 4. Usability (可用性) - 25%

| 指标 | 目标 |
|------|------|
| 可读性 | 结构清晰，易于理解 |
| 可导航 | 目录和链接正确 |
| 可操作 | 步骤明确，可执行 |

## Quality Gates

| Gate | Threshold | Action |
|------|-----------|--------|
| Pass | ≥ 80% | 输出最终产物 |
| Review | 60-79% | 处理警告后继续 |
| Fail | < 60% | 必须修复 |

## Issue Classification

### Errors (Must Fix)

- 必需输出缺失
- 数据错误
- 代码不可运行

### Warnings (Should Fix)

- 格式不一致
- 内容深度不足
- 缺少示例

### Info (Nice to Have)

- 优化建议
- 增强机会

## Automated Checks

\`\`\`javascript
function runQualityChecks(workDir) {
  const results = {
    completeness: checkCompleteness(workDir),
    consistency: checkConsistency(workDir),
    accuracy: checkAccuracy(workDir),
    usability: checkUsability(workDir)
  };

  results.overall = (
    results.completeness * 0.25 +
    results.consistency * 0.25 +
    results.accuracy * 0.25 +
    results.usability * 0.25
  );

  return {
    score: results.overall,
    gate: results.overall >= 80 ? 'pass' :
          results.overall >= 60 ? 'review' : 'fail',
    details: results
  };
}
\`\`\`
`;

Write(`${skillDir}/specs/quality-standards.md`, qualityStandards);

// Step 3: Generate agent base template
const agentBase = `# Agent Base Template

${config.display_name} 的 Agent 基础模板。

## 通用 Prompt 结构

\`\`\`
[ROLE] 你是{角色}，专注于{职责}。

[PROJECT CONTEXT]
Skill: ${config.skill_name}
目标: ${config.description}

[TASK]
{任务描述}
- 输出: {output_path}
- 格式: ${config.output.format}

[CONSTRAINTS]
- 约束1
- 约束2

[OUTPUT_FORMAT]
1. 执行任务
2. 返回 JSON 简要信息

[QUALITY_CHECKLIST]
- [ ] 输出格式正确
- [ ] 内容完整无遗漏
- [ ] 无占位符残留
\`\`\`

## 变量说明

| 变量 | 来源 | 示例 |
|------|------|------|
| {workDir} | 运行时 | .workflow/.scratchpad/${config.skill_name}-xxx |
| {output_path} | 配置 | ${config.output.location}/${config.output.filename_pattern} |

## 返回格式

\`\`\`typescript
interface AgentReturn {
  status: "completed" | "partial" | "failed";
  output_file: string;
  summary: string;  // Max 50 chars
  stats?: {
    items_processed?: number;
    errors?: number;
  };
}
\`\`\`

## 角色定义参考

${config.execution_mode === 'sequential' ?
  config.sequential_config.phases.map((p, i) =>
    `- **Phase ${i+1} Agent**: ${p.name} 专家`
  ).join('\n') :
  config.autonomous_config.actions.map(a =>
    `- **${a.name} Agent**: ${a.description || a.name + ' 执行者'}`
  ).join('\n')}
`;

Write(`${skillDir}/templates/agent-base.md`, agentBase);

// Step 4: Conditional - Generate action catalog for autonomous/hybrid mode
if (config.execution_mode === 'autonomous' || config.execution_mode === 'hybrid') {
  const actionCatalog = `# Action Catalog

${config.display_name} 的可用动作目录。

## Available Actions

| Action | Purpose | Preconditions | Effects |
|--------|---------|---------------|---------|
${config.autonomous_config.actions.map(a =>
  `| [${a.id}](../phases/actions/${a.id}.md) | ${a.description || a.name} | ${a.preconditions?.join(', ') || '-'} | ${a.effects?.join(', ') || '-'} |`
).join('\n')}

## Action Dependencies

\`\`\`mermaid
graph TD
${config.autonomous_config.actions.map((a, i, arr) => {
  if (i === 0) return `    ${a.id.replace(/-/g, '_')}[${a.name}]`;
  const prev = arr[i-1];
  return `    ${prev.id.replace(/-/g, '_')} --> ${a.id.replace(/-/g, '_')}[${a.name}]`;
}).join('\n')}
\`\`\`

## State Transitions

| From State | Action | To State |
|------------|--------|----------|
| pending | action-init | running |
${config.autonomous_config.actions.slice(1).map(a =>
  `| running | ${a.id} | running |`
).join('\n')}
| running | action-complete | completed |
| running | action-abort | failed |

## Selection Priority

当多个动作的前置条件都满足时，按以下优先级选择：

${config.autonomous_config.actions.map((a, i) =>
  `${i + 1}. \`${a.id}\` - ${a.name}`
).join('\n')}
`;

  Write(`${skillDir}/specs/action-catalog.md`, actionCatalog);
}

// Helper function
function toPascalCase(str) {
  return str.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('');
}

// Phase output summary
console.log('Phase 4 complete: Generated specs and templates');
```

## Next Phase

→ [Phase 5: Validation](05-validation.md)

**Data Flow to Phase 5**:
- All generated files in `specs/` and `templates/`
- skill-config.json for validation reference
- Complete skill directory structure ready for final validation
