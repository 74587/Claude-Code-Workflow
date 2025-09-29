# Workflow 命令模块化重构方案

## 📋 重构概览

### 目标
将现有workflow命令中的智能分析能力抽象为独立的、可复用的模块，提升系统的模块化程度、可维护性和可扩展性。

### 核心原则
- **单一职责**：每个模块只负责一个核心功能
- **高内聚低耦合**：模块内部逻辑紧密，模块间接口清晰
- **可复用性**：智能模块可在多个场景下复用
- **向后兼容**：保持现有工作流程的功能完整性

## 🎯 模块化设计

### 1. 智能上下文模块 (`/context`)

**职责**：智能收集项目相关上下文信息

**核心命令**：`/context:gather`
- **功能**：根据任务描述，从代码库、文档、历史记录中智能收集相关信息
- **输入**：任务描述字符串
- **输出**：标准化的context-package.json文件
- **特性**：
  - 关键字分析和文档智能加载
  - 代码结构分析（使用get_modules_by_depth.sh）
  - 依赖关系发现
  - MCP工具集成（code-index, exa）

**输出格式**：
```json
{
  "metadata": {
    "task_description": "实现用户认证系统",
    "timestamp": "2025-09-29T10:00:00Z",
    "keywords": ["用户", "认证", "系统"]
  },
  "assets": [
    {
      "type": "documentation|source_code|config",
      "path": "相对路径",
      "relevance": "相关性描述"
    }
  ]
}
```

### 2. 智能分析模块 (`/analysis`)

**职责**：基于上下文进行深度智能分析

**核心命令**：`/analysis:run`
- **功能**：接收上下文包，执行深度分析，生成结构化报告
- **输入**：context-package.json文件路径
- **输出**：ANALYSIS_RESULTS.md文件
- **特性**：
  - 智能工具选择（Gemini/Qwen/Codex）
  - 动态Prompt构建
  - 结构化分析输出

### 3. 重构的协调器 (`/workflow:plan`)

**新职责**：编排智能模块，生成最终实施计划

**执行流程**：
```
用户输入 → 创建会话 → context:gather → analysis:run → 生成IMPL_PLAN.md
```

## 📁 目录结构重组

### 当前结构问题
```
.claude/commands/workflow/
├── plan.md              # 复杂混合逻辑
├── execute.md           # 代理协调
├── status.md            # 状态查看
├── docs.md              # 文档生成
├── concept-eval.md      # 概念评估
├── session/             # 会话管理 ✓
├── issue/               # 问题跟踪 ✓
└── brainstorm/          # 头脑风暴 ✓
```

### 重构后结构
```
.claude/commands/
├── workflow/
│   ├── pipeline/        # 核心流程
│   │   ├── plan.md      # 重构为协调器
│   │   ├── verify.md    # 计划验证
│   │   ├── execute.md   # 执行协调
│   │   ├── resume.md    # 恢复执行
│   │   ├── review.md    # 代码审查
│   │   └── test-gen.md  # 测试生成
│   ├── session/         # 会话管理（保持）
│   ├── issue/           # 问题跟踪（保持）
│   ├── brainstorm/      # 头脑风暴（保持）
│   └── tools/           # 辅助工具
│       ├── status.md
│       ├── docs.md
│       └── concept-eval.md
├── context/             # 新增：智能上下文
│   └── gather.md
├── analysis/            # 新增：智能分析
│   └── run.md
└── task/               # 任务管理（保持）
```

## 🔧 实施计划

### 阶段1：创建新模块 (步骤1-4)
1. **创建模块目录**
   - 创建 `.claude/commands/context/`
   - 创建 `.claude/commands/analysis/`

2. **实现context:gather命令**
   - 从workflow/plan.md提取上下文收集逻辑
   - 实现标准化的context-package.json输出

3. **实现analysis:run命令**
   - 从workflow/plan.md提取分析逻辑
   - 实现ANALYSIS_RESULTS.md生成

4. **定义模块接口**
   - 标准化输入输出格式
   - 定义错误处理策略

### 阶段2：重构现有命令 (步骤5-6)
5. **重构workflow:plan**
   - 简化为协调器角色
   - 调用新的智能模块
   - 保持最终输出兼容性

6. **重组workflow目录**
   - 创建pipeline/和tools/子目录
   - 移动相应命令文件
   - 更新命令路径引用

### 阶段3：测试与优化 (步骤7)
7. **集成测试**
   - 验证新模块功能
   - 测试模块间协调
   - 确保向后兼容

## 📋 详细实施清单

### 文件操作清单

**新建文件**：
- `.claude/commands/context/gather.md`
- `.claude/commands/analysis/run.md`
- `.claude/commands/workflow/pipeline/` (目录)
- `.claude/commands/workflow/tools/` (目录)

**移动文件**：
- `workflow/plan.md` → `workflow/pipeline/plan.md` (内容重构)
- `workflow/plan-verify.md` → `workflow/pipeline/verify.md`
- `workflow/execute.md` → `workflow/pipeline/execute.md`
- `workflow/resume.md` → `workflow/pipeline/resume.md`
- `workflow/review.md` → `workflow/pipeline/review.md`
- `workflow/test-gen.md` → `workflow/pipeline/test-gen.md`
- `workflow/status.md` → `workflow/tools/status.md`
- `workflow/docs.md` → `workflow/tools/docs.md`
- `workflow/concept-eval.md` → `workflow/tools/concept-eval.md`

**保持不变**：
- `workflow/session/` (所有文件)
- `workflow/issue/` (所有文件)
- `workflow/brainstorm/` (所有文件)
- `task/` (所有文件)

## 🎯 预期收益

### 可复用性提升
- **context:gather** 可用于快速分析、调试诊断等场景
- **analysis:run** 可服务于不同类型的分析需求

### 可维护性提升
- 单一职责，逻辑清晰
- 独立测试和调试
- 更容易定位问题

### 可扩展性提升
- 新增分析引擎无需修改协调器
- 支持不同的上下文源
- 便于添加缓存、并行等优化

### 开发体验提升
- 命令职责更清晰
- 调试更容易
- 功能扩展更简单

## ⚠️ 风险管控

### 兼容性风险
- **缓解措施**：保持最终输出格式不变
- **验证方案**：对比重构前后的IMPL_PLAN.md输出

### 性能风险
- **潜在影响**：模块调用可能增加执行时间
- **缓解措施**：优化模块间数据传递，避免重复读取

### 维护风险
- **潜在影响**：增加了命令间的依赖关系
- **缓解措施**：清晰的接口定义和错误处理

## 📈 成功标准

1. **功能完整性**：所有原有workflow功能正常工作
2. **输出一致性**：IMPL_PLAN.md等输出文件格式保持兼容
3. **性能可接受**：执行时间增幅不超过20%
4. **可维护性**：新模块代码清晰，易于理解和修改
5. **可复用性**：智能模块可在其他场景成功复用

---

## 📝 更新日志

### v1.1 - 2025-09-29
- **✅ 完成**: Session管理逻辑模块化
- **改进**: 将Session Discovery & Selection从pipeline/plan.md移动到session/start.md
- **增强**: pipeline/plan.md现在调用专用的session管理命令
- **优化**: 实现了更清晰的职责分离

### v1.0 - 2025-09-29
- **✅ 完成**: 基础模块化架构实施
- **✅ 完成**: 智能上下文和分析模块创建
- **✅ 完成**: 目录结构重组

---

**文档版本**: v1.1
**创建日期**: 2025-09-29
**最后更新**: 2025-09-29
**负责人**: Claude Code Assistant
**状态**: 已实施并优化