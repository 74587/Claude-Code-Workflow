# 🚀 Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v6.2.0-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![npm](https://img.shields.io/npm/v/claude-code-workflow.svg)](https://www.npmjs.com/package/claude-code-workflow)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()

**语言:** [English](README.md) | [中文](README_CN.md)

</div>

---

**Claude Code Workflow (CCW)** 将 AI 开发从简单的提示词链接转变为一个强大的、上下文优先的编排系统。它通过结构化规划、确定性执行和智能多模型编排，解决了执行不确定性和误差累积的问题。

> **🎉 版本 6.2.0: 原生 CodexLens 与 Dashboard 革新**
>
> **破坏性变更**:
> - ⚠️ CLI 命令重构: `ccw cli exec` → `ccw cli -p`
> - ⚠️ Code Index MCP 替换为原生 CodexLens
> - ⚠️ 知识图谱替换为会话聚类系统
>
> **核心功能**:
> - 🔍 **原生 CodexLens**: 全文搜索 + 语义搜索 + HNSW 向量索引
> - 🖥️ **新 Dashboard 视图**: CLAUDE.md 管理器、技能管理器、图浏览器、核心记忆
> - 📘 **TypeScript 迁移**: 后端全面现代化
> - 🧠 **会话聚类**: 智能记忆管理与聚类可视化
>
> 详见 [CHANGELOG.md](CHANGELOG.md) 获取完整详情和迁移指南。

> 📚 **第一次使用 CCW？** 查看 [**快速上手指南**](GETTING_STARTED_CN.md) 获取新手友好的 5 分钟教程！

---

## ✨ 核心概念

CCW 构建在一系列核心原则之上，这些原则使其与传统的 AI 开发方法区别开来：

- **上下文优先架构**: 通过预定义的上下文收集，消除了执行过程中的不确定性，确保智能体在实现*之前*就拥有正确的信息。
- **JSON 优先的状态管理**: 任务状态完全存储在 `.task/IMPL-*.json` 文件中，作为唯一的事实来源，实现了无需状态漂移的程序化编排。
- **自主多阶段编排**: 命令链式调用专门的子命令和智能体，以零用户干预的方式自动化复杂的工作流。
- **多模型策略**: 充分利用不同 AI 模型（如 Gemini 用于分析，Codex 用于实现）的独特优势，以获得更优越的结果。
- **分层内存系统**: 一个 4 层文档系统，在适当的抽象级别上提供上下文，防止信息过载。
- **专门的基于角色的智能体**: 一套模拟真实软件团队的智能体（`@code-developer`, `@test-fix-agent` 等），用于处理多样化的任务。

---

## ⚙️ 安装

有关详细的安装说明，请参阅 [**INSTALL_CN.md**](INSTALL_CN.md) 指南。

### **🚀 一键快速安装**

**Windows (PowerShell):**
```powershell
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1" -UseBasicParsing).Content
```

**Linux/macOS (Bash/Zsh):**
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.sh)
```

### **✅ 验证安装**
安装后，打开 **Claude Code** 并通过运行以下命令检查工作流命令是否可用：
```bash
/workflow:session:list
```
如果斜杠命令（例如 `/workflow:*`）被识别，则表示安装成功。

---

## 🖥️ CCW CLI 工具

`ccw` 命令提供了强大的 CLI 来管理您的 Claude Code Workflow 安装：

### **命令**

| 命令 | 描述 |
|---------|-------------|
| `ccw install` | 安装工作流文件到全局 (~/.claude) 或指定路径 |
| `ccw upgrade` | 升级现有安装到当前包版本 |
| `ccw uninstall` | 从安装中移除工作流文件 |
| `ccw view` | 在浏览器中打开工作流仪表板 |
| `ccw serve` | 启动仪表板服务器而不打开浏览器 |
| `ccw list` | 列出所有管理的安装 |
| `ccw cli -p "..."` | 使用提示词执行 CLI 工具 (Gemini/Qwen/Codex) |
| `ccw core-memory` | 管理会话聚类和记忆 |

### **使用示例**

```bash
# 全局安装
ccw install -m Global

# 安装到指定项目
ccw install -m Path -p ./my-project

# 打开仪表板
ccw view

# 在自定义端口启动仪表板服务器
ccw serve --port 8080

# 升级所有安装
ccw upgrade -a

# 列出安装
ccw list
```

### **Dashboard 功能**

CCW Dashboard (`ccw view`) 提供：
- 📊 **会话概览**: 查看所有工作流会话的状态和进度
- 📋 **任务管理**: 跟踪任务执行和完成情况
- 🔍 **CodexLens 管理器**: 原生代码索引，支持 FTS + 语义 + 混合搜索
- 🧠 **核心记忆**: 会话聚类可视化与聚类管理
- 📄 **CLAUDE.md 管理器**: 配置管理的文件树查看器
- 🎯 **技能管理器**: 查看和管理 Claude Code 技能
- 🕸️ **图浏览器**: 交互式代码关系可视化 (Cytoscape.js)
- ⚙️ **MCP 管理器**: 配置和监控 MCP 服务器
- 🪝 **Hook 管理器**: 管理 Claude Code Hooks
- ❓ **帮助视图**: 国际化帮助文档
- 💻 **CLI 管理器**: CLI 执行历史与会话恢复

> 📖 详见 [**Dashboard 用户指南**](DASHBOARD_GUIDE.md) 和 [**Dashboard 操作指南**](DASHBOARD_OPERATIONS.md)。

---

## 🛠️ 命令参考

CCW 提供了一套丰富的命令，用于管理工作流、任务以及与 AI 工具的交互。有关所有可用命令的完整列表和详细说明，请参阅 [**COMMAND_REFERENCE.md**](COMMAND_REFERENCE.md) 文件。

有关每个命令的详细技术规范，请参阅 [**COMMAND_SPEC.md**](COMMAND_SPEC.md)。

---

### 💡 **需要帮助？使用交互式命令指南**

CCW 包含内置的**命令指南技能**，帮助您有效地发现和使用命令：

- **`CCW-help`** - 获取交互式帮助和命令推荐
- **`CCW-issue`** - 使用引导模板报告错误或请求功能

命令指南提供：
- 🔍 **智能命令搜索** - 按关键词、分类或使用场景查找命令
- 🤖 **下一步推荐** - 获取任何命令之后的操作建议
- 📖 **详细文档** - 查看参数、示例和最佳实践
- 🎓 **新手入门** - 通过引导式学习路径学习 14 个核心命令
- 📝 **问题报告** - 生成标准化的错误报告和功能请求

**使用示例**:
```
用户: "CCW-help"
→ 交互式菜单，包含命令搜索、推荐和文档

用户: "执行完 /workflow:plan 后做什么？"
→ 推荐 /workflow:execute、/workflow:action-plan-verify 及工作流模式

用户: "CCW-issue"
→ 引导式模板生成，用于错误、功能或问题咨询
```

---

## 🚀 快速入门

开始使用的最佳方式是遵循 [**快速上手指南**](GETTING_STARTED_CN.md) 中的 5 分钟教程。

以下是一个常见开发工作流的快速示例：

### **选项 1: Lite-Plan 工作流** (⚡ 推荐用于快速任务)

轻量级交互式工作流，内存中规划并立即执行：

```bash
# 基本用法，自动检测
/workflow:lite-plan "为用户登录添加 JWT 认证"

# 强制代码探索
/workflow:lite-plan -e "重构日志模块以提高性能"

# 基本用法
/workflow:lite-plan "为认证服务添加单元测试"
```

**交互流程**:
1. **阶段 1**: 自动任务分析和智能代码探索（如需要）
2. **阶段 2**: 回答澄清问题（如有）
3. **阶段 3**: 查看生成的计划和任务分解
4. **阶段 4**: 三维确认:
   - ✅ 确认/修改/取消任务
   - 🔧 选择执行方式: 智能体 / 仅提供计划 / CLI（Gemini/Qwen/Codex）
   - 🔍 可选代码审查: 否 / Claude / Gemini / Qwen / Codex
5. **阶段 5**: 观察实时执行和任务跟踪

### **选项 2: Lite-Fix 工作流** (🐛 推荐用于 Bug 修复)

智能 Bug 诊断和修复工作流，具有自适应严重性评估：

```bash
# 标准 Bug 修复（根据严重性自动适应）
/workflow:lite-fix "用户头像上传失败，返回 413 错误"

# 生产热修复模式
/workflow:lite-fix --hotfix "支付网关 5xx 错误"
```

**工作流特性**:
- **阶段 1**: 智能根因诊断，采用自适应搜索
- **阶段 2**: 自动影响评估和风险评分
- **阶段 3**: 基于复杂度的修复策略生成
- **阶段 4**: 风险感知的验证计划
- **阶段 5**: 用户确认与执行选择
- **阶段 6**: 执行调度，完整产物跟踪

**会话产物** (保存到 `.workflow/.lite-fix/{bug-slug}-{timestamp}/`):
- `diagnosis.json` - 根因分析和复现步骤
- `impact.json` - 风险评分、严重性和工作流适应
- `fix-plan.json` - 修复策略和实现任务
- `task.json` - 包含完整上下文的增强任务 JSON
- `followup.json` - 自动生成的跟进任务（仅热修复模式）

### **选项 3: 完整工作流** (📋 综合规划)

适用于复杂项目的传统多阶段工作流：

1.  **创建计划**（自动启动会话）:
    ```bash
    /workflow:plan "实现基于 JWT 的用户登录和注册"
    ```
2.  **执行计划**:
    ```bash
    /workflow:execute
    ```
3.  **查看状态**（可选）:
    ```bash
    /workflow:status
    ```

---

## 📚 文档

CCW 提供全面的文档，帮助您快速上手并掌握高级功能：

### 📖 **快速入门**
- [**快速上手指南**](GETTING_STARTED_CN.md) - 5 分钟快速入门教程
- [**安装指南**](INSTALL_CN.md) - 详细安装说明 ([English](INSTALL.md))
- [**工作流决策指南**](WORKFLOW_DECISION_GUIDE.md) - 🌳 交互式流程图帮助选择正确的命令
- [**示例**](EXAMPLES.md) - 真实世界用例和实践示例 (English)
- [**常见问题**](FAQ.md) - 常见问题和故障排除 (English)

### 🖥️ **Dashboard**
- [**Dashboard 用户指南**](DASHBOARD_GUIDE.md) - Dashboard 界面概览和功能说明
- [**Dashboard 操作指南**](DASHBOARD_OPERATIONS.md) - 详细操作步骤说明

### 🏗️ **架构与设计**
- [**架构概览**](ARCHITECTURE.md) - 系统设计和核心组件 (English)
- [**项目介绍**](PROJECT_INTRODUCTION.md) - 详细项目概览
- [**工作流图示**](WORKFLOW_DIAGRAMS.md) - 可视化工作流表示 (English)

### 📋 **命令参考**
- [**命令参考**](COMMAND_REFERENCE.md) - 所有命令的完整列表 (English)
- [**命令规范**](COMMAND_SPEC.md) - 详细技术规范 (English)
- [**命令流程标准**](COMMAND_FLOW_STANDARD.md) - 命令设计模式 (English)

### 🤝 **贡献**
- [**贡献指南**](CONTRIBUTING.md) - 如何为 CCW 做贡献 (English)
- [**更新日志**](CHANGELOG.md) - 版本历史和发布说明

---

## 🤝 贡献与支持

- **仓库**: [GitHub - Claude-Code-Workflow](https://github.com/catlog22/Claude-Code-Workflow)
- **问题**: 在 [GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues) 上报告错误或请求功能。
- **讨论**: 加入 [社区论坛](https://github.com/catlog22/Claude-Code-Workflow/discussions)。
- **贡献**: 查看 [CONTRIBUTING.md](CONTRIBUTING.md) 了解贡献指南。

## 📄 许可证

此项目根据 **MIT 许可证** 授权。详见 [LICENSE](LICENSE) 文件。