# Reference Documents Generation Specification

> **重要**: 本规范定义如何在生成的skill中组织和展现参考文档，避免重复问题。

## 核心原则

### 1. 分阶段组织 (Phase-Based Organization)

参考文档必须按照skill的执行阶段组织，而不是平铺列表。

**❌ 错误方式** (平铺列表):
```markdown
## Reference Documents

| Document | Purpose |
|----------|---------|
| doc1.md | ... |
| doc2.md | ... |
| doc3.md | ... |
```

**✅ 正确方式** (分阶段导航):
```markdown
## Reference Documents by Phase

### 📋 Phase 1: Analysis
执行Phase 1时查阅的文档

| Document | Purpose | When to Use |
|----------|---------|-------------|
| doc1.md | ... | 理解x概念 |

### ⚙️ Phase 2: Implementation
执行Phase 2时查阅的文档

| Document | Purpose | When to Use |
|----------|---------|-------------|
| doc2.md | ... | 实现y功能 |
```

### 2. 四个标准分组

参考文档必须分为以下四个分组：

| 分组 | 使用时机 | 内容 |
|-----|---------|------|
| **Phase N: [Name]** | 执行该Phase时 | 该阶段相关的所有文档 |
| **🔍 Debugging** | 遇到问题时 | 问题→文档映射表 |
| **📚 Reference** | 深度学习时 | 模板、原始实现、最佳实践 |
| (可选) **📌 Quick Links** | 快速导航 | 最常查阅的5-7个文档 |

### 3. 每个文档条目必须包含

```
| [path](path) | Purpose | When to Use |
```

**When to Use 列要求**:
- ✅ 清晰说明使用场景
- ✅ 描述解决什么问题
- ❌ 不要简单说 "参考" 或 "了解"

**良好例子**:
- "理解issue数据结构"
- "学习Planning Agent的角色"
- "检查implementation是否达到质量标准"
- "快速定位状态异常的原因"

**糟糕例子**:
- "参考文档"
- "更多信息"
- "背景知识"

### 4. 执行流程中嵌入文档指引

在"Execution Flow"部分，每个Phase说明中应包含"查阅"提示：

```markdown
### Phase 2: Planning Pipeline
→ **查阅**: action-plan.md, subagent-roles.md
→ 具体流程说明...
```

### 5. 问题排查快速查询表

应包含常见问题到文档的映射：

```markdown
### 🔍 Debugging & Troubleshooting

| Issue | Solution Document |
|-------|------------------|
| Phase执行失败 | 查阅相应Phase文档 |
| 输出格式不符 | specs/quality-standards.md |
| 数据验证失败 | specs/schema-validation.md |
```

---

## 生成规则

### 规则 1: 文档分类识别

根据skill的phases自动生成分组：

```javascript
const phaseEmojis = {
  'discovery': '📋',      // 收集、探索
  'generation': '🔧',     // 生成、创建
  'analysis': '🔍',       // 分析、审查
  'implementation': '⚙️', // 实现、执行
  'validation': '✅',     // 验证、测试
  'completion': '🏁',     // 完成、收尾
};

// 为每个phase生成一个章节
phases.forEach((phase, index) => {
  const emoji = phaseEmojis[phase.type] || '📌';
  const title = `### ${emoji} Phase ${index + 1}: ${phase.name}`;
  // 列出该phase相关的所有文档
});
```

### 规则 2: 文档到Phase的映射

在config中，specs和templates应标注所属的phases：

```json
{
  "specs": [
    {
      "path": "specs/issue-handling.md",
      "purpose": "Issue数据规范",
      "phases": ["phase-2", "phase-3"],  // 这个spec与哪些phase相关
      "context": "理解issue结构和验证规则"
    }
  ]
}
```

### 规则 3: 优先级和必读性

用视觉符号区分文档的重要性：

```markdown
| Document | When | Notes |
|----------|------|-------|
| spec.md | **执行前必读** | ✅ 强制前置 |
| action.md | 执行时查阅 | 操作指南 |
| template.md | 参考学习 | 可选深入 |
```

### 规则 4: 避免重复

- **Mandatory Prerequisites** 部分：列出强制必读的P0规范
- **Reference Documents by Phase** 部分：列出所有文档 (包括强制必读的)
- 两个部分的文档可以重叠，但目的不同：
  - Prerequisites：强调"必须先读"
  - Reference：提供"完整导航"

---

## 实现示例

### Sequential Skill 示例

```markdown
## ⚠️ Mandatory Prerequisites (强制前置条件)

| Document | Purpose | When |
|----------|---------|------|
| [specs/issue-handling.md](specs/issue-handling.md) | Issue数据规范 | **执行前必读** |
| [specs/solution-schema.md](specs/solution-schema.md) | 解决方案结构 | **执行前必读** |

---

## Reference Documents by Phase

### 📋 Phase 1: Issue Collection
执行Phase 1时查阅的文档

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [phases/actions/action-list.md](phases/actions/action-list.md) | Issue加载逻辑 | 理解如何收集issues |
| [specs/issue-handling.md](specs/issue-handling.md) | Issue数据规范 | 验证issue格式 ✅ **必读** |

### ⚙️ Phase 2: Planning
执行Phase 2时查阅的文档

| Document | Purpose | When to Use |
|----------|---------|-------------|
| [phases/actions/action-plan.md](phases/actions/action-plan.md) | Planning流程 | 理解issue→solution转换 |
| [specs/solution-schema.md](specs/solution-schema.md) | 解决方案结构 | 验证solution JSON格式 ✅ **必读** |

### 🔍 Debugging & Troubleshooting

| Issue | Solution Document |
|-------|------------------|
| Phase 1失败 | [phases/actions/action-list.md](phases/actions/action-list.md) |
| Planning输出不符 | [phases/actions/action-plan.md](phases/actions/action-plan.md) + [specs/solution-schema.md](specs/solution-schema.md) |
| 数据验证失败 | [specs/issue-handling.md](specs/issue-handling.md) |

### 📚 Reference & Background

| Document | Purpose | Notes |
|----------|---------|-------|
| [../issue-plan.md](../../.codex/prompts/issue-plan.md) | 原始实现 | Planning Agent system prompt |
```

---

## 生成算法

```javascript
function generateReferenceDocuments(config) {
  let result = '## Reference Documents by Phase\n\n';

  // 为每个phase生成一个章节
  const phases = config.phases || config.actions || [];

  phases.forEach((phase, index) => {
    const phaseNum = index + 1;
    const emoji = getPhaseEmoji(phase.type);
    const title = phase.display_name || phase.name;

    result += `### ${emoji} Phase ${phaseNum}: ${title}\n`;
    result += `执行Phase ${phaseNum}时查阅的文档\n\n`;

    // 找出该phase相关的所有文档
    const docs = config.specs.filter(spec =>
      (spec.phases || []).includes(`phase-${phaseNum}`) ||
      matchesByName(spec.path, phase.name)
    );

    if (docs.length > 0) {
      result += '| Document | Purpose | When to Use |\n';
      result += '|----------|---------|-------------|\n';
      docs.forEach(doc => {
        const required = doc.phases && doc.phases[0] === `phase-${phaseNum}` ? ' ✅ **必读**' : '';
        result += `| [${doc.path}](${doc.path}) | ${doc.purpose} | ${doc.context}${required} |\n`;
      });
      result += '\n';
    }
  });

  // 问题排查部分
  result += '### 🔍 Debugging & Troubleshooting\n\n';
  result += generateDebuggingTable(config);

  // 深度学习参考
  result += '### 📚 Reference & Background\n\n';
  result += generateReferenceTable(config);

  return result;
}
```

---

## 检查清单

生成skill的SKILL.md时，参考文档部分应满足：

- [ ] 有明确的"## Reference Documents by Phase"标题
- [ ] 每个Phase都有对应的章节 (用emoji标识)
- [ ] 每个文档条目包含"When to Use"列
- [ ] 包含"🔍 Debugging & Troubleshooting"部分
- [ ] 包含"📚 Reference & Background"部分
- [ ] 强制必读文档用✅和**粗体**标记
- [ ] Execution Flow部分中有"→ **查阅**: ..."指引
- [ ] 避免过长的文档列表 (一个Phase最多5-8个文档)
