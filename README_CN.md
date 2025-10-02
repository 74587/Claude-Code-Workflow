# 🚀 Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v3.2.1-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()
[![MCP工具](https://img.shields.io/badge/🔧_MCP工具-实验性-orange.svg)](https://github.com/modelcontextprotocol)

**语言:** [English](README.md) | [中文](README_CN.md)

</div>

---

**Claude Code Workflow (CCW)** 是一个新一代的多智能体自动化开发框架，通过智能工作流管理和自主执行来协调复杂的软件开发任务。

> **🎉 最新版本: v3.2.0** - 采用"测试即审查"理念简化智能体架构。详见 [CHANGELOG.md](CHANGELOG.md)。
>
> **v3.2.0 版本新特性**:
> - 🔄 从 3 个智能体简化为 2 个核心智能体（`@code-developer`、`@test-fix-agent`）
> - ✅ "测试即审查" - 测试通过 = 代码批准
> - 🧪 增强的测试修复工作流，支持自动执行和修复
> - 📦 交互式安装，包含版本选择菜单

---

## ✨ 核心特性

- **🎯 上下文优先架构**: 预定义上下文收集消除执行不确定性和误差累积。
- **🤖 多智能体系统**: 专用智能体（`@code-developer`、`@code-review-test-agent`）具备技术栈感知能力。
- **🔄 端到端工作流自动化**: 从头脑风暴到部署的多阶段编排。
- **📋 JSON 优先任务模型**: 结构化任务定义，包含 `pre_analysis` 步骤实现确定性执行。
- **🧪 TDD 工作流支持**: 完整的测试驱动开发，包含 Red-Green-Refactor 循环强制执行。
- **🧠 多模型编排**: 发挥 Gemini（分析）、Qwen（架构）和 Codex（实现）各自优势。
- **✅ 执行前验证**: 通过战略（Gemini）和技术（Codex）双重分析验证计划。
- **🔧 统一 CLI**: 一个强大、统一的 `/cli:*` 命令集，用于与各种 AI 工具交互。
- **📦 智能上下文包**: `context-package.json` 将任务链接到相关代码库文件和外部示例。

---

## ⚙️ 安装

### **🚀 一键快速安装**

**Windows (PowerShell):**
```powershell
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1" -UseBasicParsing).Content
```

**Linux/macOS (Bash/Zsh):**
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.sh)
```

### **📋 交互式版本选择**

运行安装命令后，您将看到包含实时版本信息的交互式菜单：

```
正在检测最新版本和提交...
最新稳定版: v3.2.0 (2025-10-02 04:27 UTC)
最新提交: cdea58f (2025-10-02 08:15 UTC)

====================================================
            版本选择菜单
====================================================

1) 最新稳定版（推荐）
   |-- 版本: v3.2.0
   |-- 发布时间: 2025-10-02 04:27 UTC
   \-- 生产就绪

2) 最新开发版
   |-- 分支: main
   |-- 提交: cdea58f
   |-- 更新时间: 2025-10-02 08:15 UTC
   |-- 最新功能
   \-- 可能包含实验性更改

3) 指定版本
   |-- 安装特定标签版本
   \-- 最近版本: v3.2.0, v3.1.0, v3.0.1

====================================================

选择要安装的版本 (1-3, 默认: 1):
```

**版本选项：**
- **选项 1（推荐）**：经过验证的最新稳定版本，生产环境可用
- **选项 2**：来自 main 分支的最新开发版本，包含最新功能
- **选项 3**：指定版本标签，用于受控部署

> 💡 **提示**：安装程序会自动从 GitHub 检测并显示最新的版本号和发布日期。只需按 Enter 键即可选择推荐的稳定版本。

### **✅ 验证安装**
安装后，运行以下命令以确保 CCW 正常工作：
```bash
/workflow:session:list
```

> **📝 重要说明：**
> - 安装程序将自动安装/更新 `.codex/` 和 `.gemini/` 目录
> - **全局模式**：安装到 `~/.codex` 和 `~/.gemini`
> - **路径模式**：安装到指定目录（例如 `project/.codex`、`project/.gemini`）
> - 安装前会自动备份现有文件

---

## 🚀 快速入门

### 完整开发工作流

**阶段 1：头脑风暴与概念规划**
```bash
# 多视角头脑风暴，使用基于角色的智能体
/workflow:brainstorm:auto-parallel "构建用户认证系统"

# 审查和优化特定方面（可选）
/workflow:brainstorm:ui-designer "认证流程"
/workflow:brainstorm:synthesis  # 生成综合规范
```

**阶段 2：行动规划**
```bash
# 创建可执行的实现计划
/workflow:plan "实现基于 JWT 的认证系统"

# 或使用 TDD 方法
/workflow:tdd-plan "使用测试优先开发实现认证"
```

**阶段 3：执行**
```bash
# 使用 AI 智能体执行任务
/workflow:execute

# 监控进度
/workflow:status
```

**阶段 4：测试与质量保证**
```bash
# 生成全面测试套件（标准工作流）
/workflow:test-gen
/workflow:execute

# 或验证 TDD 合规性（TDD 工作流）
/workflow:tdd-verify

# 可选：手动审查（仅在明确需要时使用）
# /workflow:review  # 测试通过 = 代码已批准
```

### 简单任务快速入门

**功能开发：**
```bash
/workflow:session:start "添加密码重置功能"
/workflow:plan "基于邮件的密码重置，带令牌过期"
/workflow:execute
```

**Bug 修复：**
```bash
# 使用 CLI 工具进行交互式分析
/cli:mode:bug-index --tool gemini "移动设备上登录超时"

# 执行建议的修复
/workflow:execute
```

> **💡 何时使用哪种方式？**
>
> **使用 `/workflow:plan` + `/workflow:execute` 适用于：**
> - 需要多个模块的复杂功能（>3 个模块）
> - 包含多个子任务的任务（>5 个子任务）
> - 影响架构的横切变更
> - 需要组件间协调的功能
> - 需要结构化规划和进度跟踪时
>
> **直接使用 Claude Code 适用于：**
> - 简单、聚焦的变更（单个文件或模块）
> - 解决方案明确的快速 bug 修复
> - 文档更新
> - 单个组件内的代码重构
> - 简单直接的功能添加

**代码分析：**
```bash
# 深度代码库分析
/cli:mode:code-analysis --tool qwen "分析认证模块架构"
```

---

## 🛠️ 命令参考

### **统一 CLI 命令 (`/cli:*)**
*使用 `--tool <gemini|qwen|codex>` 标志选择所需工具。默认为 `gemini`。*

| 命令 | 描述 |
|---|---|
| `/cli:analyze` | 深度代码库分析。 |
| `/cli:chat` | 与工具进行直接的交互式聊天。 |
| `/cli:execute` | 以完全权限执行任务。 |
| `/cli:cli-init`| 为工作区初始化CLI工具配置。 |
| `/cli:mode:bug-index` | 分析错误并提出修复建议。 |
| `/cli:mode:code-analysis` | 执行深度代码分析和调试。 |
| `/cli:mode:plan` | 项目规划和架构分析。 |

### **工作流命令 (`/workflow:*)**

| 命令 | 描述 |
|---|---|
| `/workflow:session:*` | 管理开发会话（`start`, `pause`, `resume`, `list`, `switch`, `complete`）。 |
| `/workflow:brainstorm:*` | 使用基于角色的智能体进行多视角规划。 |
| `/workflow:plan` | 从描述创建详细、可执行的计划。 |
| `/workflow:tdd-plan` | 创建测试驱动开发工作流，包含 Red-Green-Refactor 循环。 |
| `/workflow:execute` | 自主执行当前的工作流计划。 |
| `/workflow:status` | 显示工作流的当前状态。 |
| `/workflow:test-gen` | 从实现中自动生成测试计划。 |
| `/workflow:tdd-verify` | 验证 TDD 合规性并生成质量报告。 |
| `/workflow:review` | **可选** 手动审查（仅在明确需要时使用，测试通过即代表代码已批准）。 |

### **任务与内存命令**

| 命令 | 描述 |
|---|---|
| `/task:*` | 管理单个任务（`create`, `breakdown`, `execute`, `replan`）。 |
| `/update-memory-full` | 重新索引整个项目文档。 |
| `/update-memory-related` | 更新与最近更改相关的文档。 |

---

## ⚙️ 配置

### **必需: Gemini CLI 设置**

配置 Gemini CLI 以实现最佳集成：

```json
// ~/.gemini/settings.json
{
  "contextFileName": "CLAUDE.md"
}
```

### **推荐: .geminiignore**

通过排除不必要的文件来优化性能：

```bash
# .geminiignore (在项目根目录)
/dist/
/build/
/node_modules/
/.next/
*.tmp
*.log
/temp/

# 包含重要文档
!README.md
!**/CLAUDE.md
```

### **可选: MCP 工具** *(增强分析)*

MCP (模型上下文协议) 工具提供高级代码库分析。**完全可选** - CCW 在没有它们的情况下也能完美工作。

#### 可用的 MCP 服务器

| MCP 服务器 | 用途 | 安装指南 |
|------------|------|---------|
| **Exa MCP** | 外部 API 模式和最佳实践 | [安装指南](https://github.com/exa-labs/exa-mcp-server) |
| **Code Index MCP** | 高级内部代码搜索 | [安装指南](https://github.com/johnhuang316/code-index-mcp) |

#### 启用后的好处
- 📊 **更快分析**: 直接代码库索引 vs 手动搜索
- 🌐 **外部上下文**: 真实世界的 API 模式和示例
- 🔍 **高级搜索**: 模式匹配和相似性检测
- ⚡ **自动回退**: MCP 不可用时使用传统工具

---

## 🧩 工作原理：设计理念

### 核心问题

传统的 AI 编码工作流面临一个根本性挑战：**执行不确定性导致误差累积**。

**示例：**
```bash
# 提示词1："开发XX功能"
# 提示词2："查看XX文件中架构设计，开发XX功能"
```

虽然提示词1对简单任务可能成功，但在复杂工作流中：
- AI 每次可能检查不同的文件
- 小偏差在多个步骤中累积
- 最终输出偏离预期目标

> **CCW 的使命**：解决"1到N"的问题 — 精确地在现有代码库基础上开发，而不仅仅是"0到1"的全新项目开发。

---

### CCW 解决方案：上下文优先架构

#### 1. **预定义上下文收集**

CCW 使用结构化上下文包，而不是让智能体随机探索：

**规划阶段创建的 `context-package.json`**：
```json
{
  "metadata": {
    "task_description": "...",
    "tech_stack": {"frontend": [...], "backend": [...]},
    "complexity": "high"
  },
  "assets": [
    {
      "path": "synthesis-specification.md",
      "priority": "critical",
      "sections": ["后端模块结构"]
    }
  ],
  "implementation_guidance": {
    "start_with": ["步骤1", "步骤2"],
    "critical_security_items": [...]
  }
}
```

#### 2. **JSON 优先任务模型**

每个任务包含 `flow_control.pre_analysis` 部分：

```json
{
  "id": "IMPL-1",
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_architecture",
        "commands": ["Read(architecture.md)", "grep 'auth' src/"],
        "output_to": "arch_context",
        "on_error": "fail"
      }
    ],
    "implementation_approach": {
      "modification_points": ["..."],
      "logic_flow": ["..."]
    },
    "target_files": ["src/auth/index.ts"]
  }
}
```

**核心创新**：`pre_analysis` 步骤在实现**之前执行**，确保智能体始终拥有正确的上下文。

#### 3. **多阶段编排**

CCW 工作流是协调斜杠命令的编排器：

**规划阶段** (`/workflow:plan`)：
```
阶段1: session:start       → 创建会话
阶段2: context-gather      → 构建 context-package.json
阶段3: concept-enhanced    → CLI 分析（Gemini/Qwen）
阶段4: task-generate       → 生成带 pre_analysis 的任务 JSON
```

**执行阶段** (`/workflow:execute`)：
```
对于每个任务：
  1. 执行 pre_analysis 步骤 → 加载上下文
  2. 应用 implementation_approach → 进行更改
  3. 验证验收标准 → 验证成功
  4. 生成摘要 → 跟踪进度
```

#### 4. **多模型编排**

每个 AI 模型发挥各自优势：

| 模型 | 角色 | 使用场景 |
|------|------|----------|
| **Gemini** | 分析与理解 | 长上下文分析、架构审查、bug 调查 |
| **Qwen** | 架构与设计 | 系统设计、代码生成、架构规划 |
| **Codex** | 实现 | 功能开发、测试、自主执行 |

**示例：**
```bash
# Gemini 分析问题空间
/cli:mode:code-analysis --tool gemini "分析认证模块"

# Qwen 设计解决方案
/cli:analyze --tool qwen "设计可扩展的认证架构"

# Codex 实现代码
/workflow:execute  # 使用带 Codex 的 @code-developer
```

---

### 0到1 vs 1到N 开发

| 场景 | 传统工作流 | CCW 方法 |
|------|-----------|----------|
| **全新项目（0→1）** | ✅ 效果良好 | ✅ 增加结构化规划 |
| **功能添加（1→2）** | ⚠️ 上下文不确定 | ✅ context-package 链接现有代码 |
| **Bug 修复（N→N+1）** | ⚠️ 可能遗漏相关代码 | ✅ pre_analysis 查找依赖 |
| **重构** | ⚠️ 范围不可预测 | ✅ CLI 分析 + 结构化任务 |

---

### 核心工作流

#### **完整开发（头脑风暴 → 部署）**
```
头脑风暴（8个角色）→ 综合 → 规划（4阶段）→ 执行 → 测试 → 审查
```

#### **快速功能开发**
```
session:start → plan → execute → test-gen → execute
```

#### **TDD 工作流**
```
tdd-plan (TEST→IMPL→REFACTOR 链) → execute → tdd-verify
```

#### **Bug 修复**
```
cli:mode:bug-index（分析）→ execute（修复）→ test-gen（验证）
```

---

## 🤝 贡献与支持

- **仓库**: [GitHub - Claude-Code-Workflow](https://github.com/catlog22/Claude-Code-Workflow)
- **问题**: 在 [GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues) 上报告错误或请求功能。
- **讨论**: 加入 [社区论坛](https://github.com/catlog22/Claude-Code-Workflow/discussions)。

## 📄 许可证

此项目根据 **MIT 许可证** 授权。详见 [LICENSE](LICENSE) 文件。
