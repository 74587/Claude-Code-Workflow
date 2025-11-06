# CLI 工具使用指南

> 从用户视角理解和使用 Gemini、Qwen、Codex 三大 CLI 工具

## 🎯 快速理解：CLI 工具是什么？

CLI 工具是集成在 Claude DMS3 中的**智能分析和执行助手**。你不需要记忆复杂的命令格式，只需用自然语言描述你想做什么，工具会自动完成。

**核心理念**：用自然语言描述需求 → CLI 工具理解并执行 → 返回结果

---

## 📋 三大工具能力对比

| 工具 | 擅长领域 | 典型场景 | 何时使用 |
|------|----------|----------|----------|
| **Gemini** | 分析、理解、规划 | 代码分析、架构设计、问题诊断 | 需要深入理解代码或系统 |
| **Qwen** | 分析、备选方案 | 代码审查、模式识别 | Gemini 不可用时的备选 |
| **Codex** | 实现、测试、执行 | 功能开发、测试生成、自动化任务 | 需要生成代码或自动执行 |

**简单记忆**：
- 想**理解**什么 → Gemini / Qwen
- 想**实现**什么 → Codex

---

## 🚀 如何调用：两种方式

### 方式 1：语义调用（推荐，最优雅）

**通过 workflow 命令**，用自然语言描述需求，系统自动选择合适的 CLI 工具：

```bash
# 自动规划和分析
/workflow:plan "实现用户认证功能"

# 自动执行实现
/workflow:execute

# 自动生成测试
/workflow:test-gen WFS-xxx
```

**优点**：
- ✅ 无需指定工具，系统自动选择
- ✅ 自然语言描述，无需记忆格式
- ✅ 集成完整工作流

**适用场景**：日常开发任务、标准工作流

---

### 方式 2：直接命令调用（精确控制）

**直接调用特定 CLI 工具**，适合需要精确控制的场景：

#### Gemini/Qwen（分析类）

```bash
# 基础格式
/cli:analyze --tool gemini "分析认证模块的安全性"

# 带增强模式
/cli:analyze --tool gemini --enhance "代码执行流程追踪"

# 指定工作目录
/cli:analyze --tool gemini --cd src/auth "分析当前模块"
```

#### Codex（实现类）

```bash
# 基础执行
/cli:execute --tool codex "实现 JWT 令牌刷新机制"

# 自动化执行（YOLO 模式）
/cli:codex-execute "实现用户登录功能"

# 使用 agent 模式
/cli:execute --agent --tool codex "重构认证服务"
```

**优点**：
- ✅ 精确指定工具和模式
- ✅ 灵活的参数控制
- ✅ 适合高级用户

**适用场景**：特定工具需求、自定义参数、高级控制

---

## 💡 能力特性清单

### Gemini 能力

**🔍 深度分析**
- 执行流程追踪
- 依赖关系分析
- 代码模式识别
- 架构评审

**🎯 规划设计**
- 架构设计
- 技术方案评估
- 任务分解
- 迁移策略

**📚 文档生成**
- API 文档
- 模块说明
- 使用指南

**使用示例**：
```bash
# 追踪代码执行流程
/cli:analyze --tool gemini "追踪用户登录的完整流程"

# 架构设计
/cli:mode:plan --tool gemini "设计微服务通信架构"

# 代码模式分析
/cli:analyze --tool gemini "识别项目中的设计模式"
```

---

### Qwen 能力

**作为 Gemini 的备选方案**，能力基本相同：
- 代码分析
- 模式识别
- 架构评审

**何时使用**：
- Gemini 不可用
- 需要第二意见
- 特定领域分析

**使用示例**：
```bash
# Gemini 不可用时的备选
/cli:analyze --tool qwen "分析数据处理模块"

# 并行使用获取多角度分析
/cli:analyze --tool gemini "分析认证模块" &
/cli:analyze --tool qwen "分析认证模块"
```

---

### Codex 能力

**⚡ 代码实现**
- 功能开发
- 组件实现
- API 创建
- UI 组件

**🧪 测试生成**
- 单元测试
- 集成测试
- 测试用例
- TDD 支持

**🔧 代码重构**
- 结构优化
- 性能改进
- 代码清理

**🤖 自动化执行**
- 完整功能实现
- Bug 修复
- 批量操作

**使用示例**：
```bash
# 功能实现
/cli:execute --tool codex "实现用户注册功能，包含邮箱验证"

# 测试生成
/workflow:test-gen WFS-session-id

# 自动化执行（YOLO 模式）
/cli:codex-execute --verify-git "重构认证服务，使用依赖注入"

# Bug 修复
/cli:mode:bug-diagnosis --tool codex "修复登录超时问题"
```

---

## 🎓 使用场景决策树

```mermaid
graph TD
    A[我想...] --> B{是分析还是实现?}
    B -->|分析理解| C[使用 Gemini/Qwen]
    B -->|实现开发| D[使用 Codex]

    C --> C1{具体需求?}
    C1 -->|理解代码流程| C2[/cli:mode:code-analysis]
    C1 -->|诊断bug| C3[/cli:mode:bug-diagnosis]
    C1 -->|设计架构| C4[/cli:mode:plan]
    C1 -->|一般分析| C5[/cli:analyze]

    D --> D1{具体需求?}
    D1 -->|完整功能| D2[/cli:codex-execute]
    D1 -->|精确控制| D3[/cli:execute]
    D1 -->|生成测试| D4[/workflow:test-gen]
    D1 -->|标准流程| D5[/workflow:execute]
```

---

## 🔄 典型使用场景

### 场景 1：理解陌生代码库

**需求**：接手新项目，需要快速理解代码结构

**推荐方式**：
```bash
# 1. 整体架构分析
/cli:analyze --tool gemini "分析整个项目的架构设计和模块关系"

# 2. 关键流程追踪
/cli:mode:code-analysis --tool gemini "追踪用户注册的完整流程"

# 3. 识别技术栈
/cli:analyze --tool gemini "识别项目使用的技术栈和设计模式"
```

---

### 场景 2：实现新功能

**需求**：实现用户认证功能

**推荐方式**（语义调用）：
```bash
# 完整工作流
/workflow:plan --agent "实现用户认证功能，包括注册、登录、JWT 令牌"
/workflow:execute
/workflow:test-gen WFS-xxx
```

**或直接调用**（精确控制）：
```bash
# 直接实现
/cli:codex-execute "实现用户认证功能：
- 用户注册（邮箱+密码）
- 登录验证
- JWT 令牌生成和刷新
- 密码加密存储
"
```

---

### 场景 3：诊断 Bug

**需求**：登录功能偶尔超时

**推荐方式**：
```bash
# 1. 诊断问题
/cli:mode:bug-diagnosis --tool gemini "诊断登录超时问题"

# 2. 分析执行流程
/cli:mode:code-analysis --tool gemini "追踪登录请求的完整执行路径"

# 3. 修复问题（如果需要）
/cli:execute --tool codex "修复登录超时问题，基于上述分析结果"
```

---

### 场景 4：代码重构

**需求**：重构认证模块，提高可维护性

**推荐方式**：
```bash
# 1. 分析现状
/cli:analyze --tool gemini "评估当前认证模块的代码质量和可维护性"

# 2. 制定计划
/cli:mode:plan --tool gemini "制定认证模块重构方案"

# 3. 执行重构
/cli:execute --tool codex "重构认证模块，按照上述计划执行"

# 4. 生成测试
/workflow:test-gen WFS-xxx
```

---

### 场景 5：生成文档

**需求**：为 API 模块生成文档

**推荐方式**：
```bash
# 自动生成文档
/memory:docs src/api --tool gemini --mode full
```

---

## 🎯 最佳实践

### ✅ 推荐做法

1. **默认使用语义调用**
   - 通过 `/workflow:*` 命令描述需求
   - 让系统自动选择合适的工具

2. **分析用 Gemini，实现用 Codex**
   - 理解问题 → Gemini
   - 解决问题 → Codex

3. **善用 --enhance 参数**
   - 让提示自动优化，提高结果质量
   ```bash
   /cli:analyze --enhance "分析认证模块"
   ```

4. **指定工作目录减少噪音**
   ```bash
   /cli:analyze --cd src/auth "分析当前模块"
   ```

5. **并行使用获得多角度**
   ```bash
   /cli:analyze --tool gemini "分析方案A"
   /cli:analyze --tool qwen "分析方案A"  # 对比结果
   ```

---

### ❌ 避免做法

1. **不要混淆工具职责**
   - ❌ 用 Gemini 实现功能
   - ❌ 用 Codex 做架构分析

2. **不要忽略工作目录**
   - ❌ 在项目根目录分析单个模块
   - ✅ 使用 `--cd` 切换到目标目录

3. **不要直接编写技术规范**
   - ❌ 手动构造复杂的 RULES 模板
   - ✅ 使用 `--enhance` 让系统优化

---

## 🔍 进阶技巧

### 技巧 1：链式分析

```bash
# 步骤 1：理解现状
/cli:analyze --tool gemini "分析当前认证实现" > analysis.md

# 步骤 2：基于分析结果制定计划
/cli:mode:plan --tool gemini "基于 analysis.md，制定改进方案"

# 步骤 3：执行改进
/cli:execute --tool codex "按照改进方案执行"
```

---

### 技巧 2：使用 Agent 模式

Agent 模式让 CLI 工具更自主地执行任务：

```bash
# 标准模式（需要明确指令）
/cli:execute --tool codex "实现用户登录"

# Agent 模式（更自主，可自行决策）
/cli:execute --agent --tool codex "实现用户认证系统"
```

**何时使用 Agent**：
- 任务复杂，需要多步决策
- 需要工具自主探索代码库
- 信任工具的判断

---

### 技巧 3：自定义提示增强

```bash
# 使用预定义模板增强
/cli:analyze --enhance "分析认证模块安全性"

# 系统会自动：
# 1. 识别任务类型（安全分析）
# 2. 选择合适模板
# 3. 优化提示词
# 4. 执行分析
```

---

## 📚 快速参考

### 常用命令速查

| 需求 | 命令 | 示例 |
|------|------|------|
| 代码分析 | `/cli:analyze` | `/cli:analyze --tool gemini "分析auth模块"` |
| Bug 诊断 | `/cli:mode:bug-diagnosis` | `/cli:mode:bug-diagnosis "登录超时"` |
| 功能实现 | `/cli:codex-execute` | `/cli:codex-execute "实现用户注册"` |
| 架构规划 | `/cli:mode:plan` | `/cli:mode:plan "设计微服务架构"` |
| 生成测试 | `/workflow:test-gen` | `/workflow:test-gen WFS-xxx` |
| 完整工作流 | `/workflow:plan` + `/workflow:execute` | 最推荐的标准流程 |

---

### 参数速查

| 参数 | 作用 | 示例 |
|------|------|------|
| `--tool <gemini\|qwen\|codex>` | 指定CLI工具 | `--tool gemini` |
| `--enhance` | 自动优化提示 | `--enhance` |
| `--agent` | 启用Agent模式 | `--agent` |
| `--cd <路径>` | 切换工作目录 | `--cd src/auth` |
| `--verify-git` | Git状态验证 | `--verify-git` |

---

## 🆘 常见问题

### Q: 我该用哪个工具？

**A**: 记住简单规则：
- 想**理解/分析/规划** → Gemini
- 想**实现/测试/执行** → Codex
- 不确定 → 用 `/workflow:*` 让系统选

---

### Q: 语义调用和命令调用有什么区别？

**A**:
- **语义调用**（`/workflow:*`）：自然语言描述，系统自动选工具，适合日常
- **命令调用**（`/cli:*`）：手动指定工具和参数，适合高级控制

---

### Q: 什么时候用 Agent 模式？

**A**: Agent 模式更自主，适合：
- 复杂任务需要多步决策
- 信任工具的判断
- 想让工具自主探索

**不适合**：
- 精确控制每一步
- 不确定工具行为
- 简单任务

---

### Q: 如何提高结果质量？

**A**:
1. 使用 `--enhance` 自动优化提示
2. 明确描述需求和期望
3. 指定工作目录减少噪音（`--cd`）
4. 提供上下文（已有的分析、相关代码）

---

## 📖 相关文档

- [Intelligent Tools Strategy](../../workflows/intelligent-tools-strategy.md) - 技术规范和高级配置
- [Workflow Patterns](workflow-patterns.md) - 标准工作流模式
- [Getting Started](getting-started.md) - 快速入门指南
- [Troubleshooting](troubleshooting.md) - 问题排查

---

**最后更新**: 2025-11-06
