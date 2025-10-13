
# 🚀 Claude Code Workflow (CCW) - 快速上手指南

欢迎来到 Claude Code Workflow (CCW)！本指南将帮助您在 5 分钟内快速入门，体验由 AI 驱动的自动化软件开发流程。

---

## ⏱️ 5 分钟快速入门

让我们通过一个简单的例子，从零开始构建一个 "Hello World" Web 应用。

### 第 1 步：安装 CCW

首先，请确保您已经根据 [安装指南](INSTALL_CN.md) 完成了 CCW 的安装。

### 第 2 步：启动一个工作流会话

把“会话”想象成一个专门的项目文件夹。CCW 会在这里存放所有与您当前任务相关的文件。

```bash
/workflow:session:start "我的第一个 Web 应用"
```

您会看到系统创建了一个新的会话，例如 `WFS-我的第一个-web-应用`。

### 第 3 步：创建执行计划

现在，告诉 CCW 您想做什么。CCW 会分析您的需求，并自动生成一个详细的、可执行的任务计划。

```bash
/workflow:plan "创建一个简单的 Express API，在根路径返回 Hello World"
```

这个命令会启动一个完全自动化的规划流程，包括：
1.  **上下文收集**：分析您的项目环境。
2.  **智能体分析**：AI 智能体思考最佳实现路径。
3.  **任务生成**：创建具体的任务文件（`.json` 格式）。

### 第 4 步：执行计划

当计划创建完毕后，您就可以命令 AI 智能体开始工作了。

```bash
/workflow:execute
```

您会看到 CCW 的智能体（如 `@code-developer`）开始逐一执行任务。它会自动创建文件、编写代码、安装依赖。

### 第 5 步：查看状态

想知道进展如何？随时可以查看当前工作流的状态。

```bash
/workflow:status
```

这会显示任务的完成情况、当前正在执行的任务以及下一步计划。

---

## 🧠 核心概念解析

理解这几个概念，能帮助您更好地使用 CCW：

-   **工作流会话 (Workflow Session)**
    > 就像一个独立的沙盒或项目空间，用于隔离不同任务的上下文、文件和历史记录。所有相关文件都存放在 `.workflow/WFS-<会话名>/` 目录下。

-   **任务 (Task)**
    > 一个原子化的工作单元，例如“创建 API 路由”、“编写测试用例”。每个任务都是一个 `.json` 文件，详细定义了目标、上下文和执行步骤。

-   **智能体 (Agent)**
    > 专门负责特定领域工作的 AI 助手。例如：
    > -   `@code-developer`: 负责编写和实现代码。
    > -   `@test-fix-agent`: 负责运行测试并自动修复失败的用例。
    > -   `@ui-design-agent`: 负责 UI 设计和原型创建。

-   **工作流 (Workflow)**
    > 一系列预定义的、相互协作的命令，用于编排不同的智能体和工具，以完成一个复杂的开发目标（如 `plan`、`execute`、`test-gen`）。

---

## 🛠️ 常见场景示例

### 场景 1：开发一个新功能（如上所示）

这是最常见的用法，遵循“启动会话 → 规划 → 执行”的模式。

```bash
# 1. 启动会话
/workflow:session:start "用户登录功能"

# 2. 创建计划
/workflow:plan "实现基于 JWT 的用户登录和注册功能"

# 3. 执行
/workflow:execute
```

### 场景 2：进行 UI 设计

CCW 拥有强大的 UI 设计能力，可以从简单的文本描述生成复杂的 UI 原型。

```bash
# 1. 启动一个 UI 设计工作流
/workflow:ui-design:explore-auto --prompt "一个现代、简洁的管理后台登录页面，包含用户名、密码输入框和登录按钮"

# 2. 查看生成的原型
# 命令执行完毕后，会提供一个 compare.html 文件的路径，在浏览器中打开即可预览。
```

### 场景 3：修复一个 Bug

CCW 可以帮助您分析并修复 Bug。

```bash
# 1. 使用 bug-index 命令分析问题
/cli:mode:bug-index "用户登录时，即使密码错误也提示成功"

# 2. AI 会分析相关代码，并生成一个修复计划。然后您可以执行这个计划。
/workflow:execute
```

---

## 🔧 无工作流协作：独立工具使用

除了完整的工作流模式，CCW 还提供独立的 CLI 工具和命令，适合快速分析、临时查询和日常维护任务。

### CLI 工具直接调用

CCW 支持通过统一的 CLI 接口直接调用外部 AI 工具（Gemini、Qwen、Codex），无需创建工作流会话。

#### 代码分析

快速分析项目代码结构和架构模式：

```bash
# 使用 Gemini 进行代码分析
/cli:analyze --tool gemini "分析认证模块的架构设计"

# 使用 Qwen 分析代码质量
/cli:analyze --tool qwen "检查数据库模型的设计是否合理"
```

#### 交互式对话

与 AI 工具进行直接交互式对话：

```bash
# 与 Gemini 交互
/cli:chat --tool gemini "解释一下 React Hook 的使用场景"

# 与 Codex 交互讨论实现方案
/cli:chat --tool codex "如何优化这个查询性能"
```

#### 专业模式分析

使用特定的分析模式进行深度探索：

```bash
# 架构分析模式
/cli:mode:plan --tool gemini "设计一个可扩展的微服务架构"

# 深度代码分析
/cli:mode:code-analysis --tool qwen "分析 src/utils/ 目录下的工具函数"

# Bug 分析模式
/cli:mode:bug-index --tool gemini "分析内存泄漏问题的可能原因"
```

### Gemini 工具语义调用

CCW 提供便捷的 Gemini Wrapper 脚本，支持语义化的项目分析和文档生成。

#### 基础分析（只读模式）

默认情况下，Gemini 以只读模式运行，适合代码探索和架构分析：

```bash
# 在项目根目录执行分析
cd /path/to/project && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: 分析项目的模块化架构
TASK: 识别核心模块及其依赖关系
CONTEXT: @{src/**/*.ts,CLAUDE.md}
EXPECTED: 生成架构关系图和模块说明
RULES: 聚焦于模块边界和接口设计
"
```

#### 文档生成（写入模式）

当需要生成或修改文件时，需要显式启用写入模式：

```bash
# 生成 API 文档
cd /path/to/project && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: 生成 REST API 文档
TASK: 从代码中提取 API 端点并生成 Markdown 文档
MODE: write
CONTEXT: @{src/api/**/*.ts}
EXPECTED: 生成 API.md 文件，包含所有端点说明
RULES: 遵循 OpenAPI 规范格式
"
```

#### 上下文优化技巧

使用 `cd` 切换到特定目录可以优化上下文范围：

```bash
# 只分析 auth 模块
cd src/auth && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: 审查认证模块的安全性
TASK: 检查 JWT 实现和密码处理
CONTEXT: @{**/*.ts}
EXPECTED: 安全审计报告
RULES: 重点关注 OWASP Top 10 安全问题
"
```

### 内存管理：CLAUDE.md 更新

CCW 使用分层的 CLAUDE.md 文档系统维护项目上下文。定期更新这些文档对保证 AI 输出质量至关重要。

#### 完整项目重建索引

适用于大规模重构、架构变更或初次使用 CCW：

```bash
# 重建整个项目的文档索引
/update-memory-full

# 使用特定工具进行索引
/update-memory-full --tool gemini   # 全面分析（推荐）
/update-memory-full --tool qwen     # 架构重点
/update-memory-full --tool codex    # 实现细节
```

**执行时机**：
- 项目初始化时
- 架构重大变更后
- 每周定期维护
- 发现 AI 输出偏差时

#### 增量更新相关模块

适用于日常开发，只更新变更影响的模块：

```bash
# 更新最近修改相关的文档
/update-memory-related

# 指定工具进行更新
/update-memory-related --tool gemini
```

**执行时机**：
- 完成功能开发后
- 重构某个模块后
- 更新 API 接口后
- 修改数据模型后

#### 内存质量的影响

| 更新频率 | 结果 |
|---------|------|
| ❌ 从不更新 | 过时的 API 引用、错误的架构假设、低质量输出 |
| ⚠️ 偶尔更新 | 部分上下文准确、可能出现不一致 |
| ✅ 及时更新 | 高质量输出、精确的上下文、正确的模式引用 |

### CLI 工具初始化

首次使用外部 CLI 工具时，可以使用初始化命令快速配置：

```bash
# 自动配置所有工具
/cli:cli-init

# 只配置特定工具
/cli:cli-init --tool gemini
/cli:cli-init --tool qwen
```

该命令会：
- 分析项目结构
- 生成工具配置文件
- 设置 `.geminiignore` / `.qwenignore`
- 创建上下文文件引用

---

## ❓ 常见问题排查 (Troubleshooting)

-   **问题：提示 "No active session found" (未找到活动会话)**
    > **原因**：您还没有启动一个工作流会话，或者当前会话已完成。
    > **解决方法**：使用 `/workflow:session:start "您的任务描述"` 来开始一个新会话。

-   **问题：命令执行失败或卡住**
    > **原因**：可能是网络问题、AI 模型限制或任务过于复杂。
    > **解决方法**：
    > 1.  首先尝试使用 `/workflow:status` 检查当前状态。
    > 2.  查看 `.workflow/WFS-<会话名>/.chat/` 目录下的日志文件，获取详细错误信息。
    > 3.  如果任务过于复杂，尝试将其分解为更小的任务，然后使用 `/workflow:plan` 重新规划。

---

## 📚 进阶学习路径

当您掌握了基础用法后，可以探索 CCW 更强大的功能：

1.  **测试驱动开发 (TDD)**: 使用 `/workflow:tdd-plan` 来创建一个完整的 TDD 工作流，AI 会先编写失败的测试，然后编写代码让测试通过，最后进行重构。

2.  **多智能体头脑风暴**: 使用 `/workflow:brainstorm:auto-parallel` 让多个不同角色的 AI 智能体（如系统架构师、产品经理、安全专家）同时对一个主题进行分析，并生成一份综合报告。

3.  **自定义智能体和命令**: 您可以修改 `.claude/agents/` 和 `.claude/commands/` 目录下的文件，来定制符合您团队特定需求的智能体行为和工作流。


希望本指南能帮助您顺利开启 CCW 之旅！
