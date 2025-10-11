# 🚀 Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v4.3.0-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()
[![MCP工具](https://img.shields.io/badge/🔧_MCP工具-实验性-orange.svg)](https://github.com/modelcontextprotocol)

**语言:** [English](README.md) | [中文](README_CN.md)

</div>

---

**Claude Code Workflow (CCW)** 是一个新一代的多智能体自动化开发框架，通过智能工作流管理和自主执行来协调复杂的软件开发任务。

> **🎉 最新版本: v4.3.0** - UI 设计工作流 V2 自包含 CSS 架构。详见 [CHANGELOG.md](CHANGELOG.md)。
>
> **v4.3.0 版本新特性**:
> - 🎨 **自包含 CSS**: Agent 从 design-tokens.json 直接生成独立 CSS
> - ⚡ **简化工作流**: 移除占位符机制和令牌转换步骤
> - 💪 **更强风格差异**: CSS 使用直接令牌值，实现更强视觉区分
> - 📉 **代码减少 31%**: 移除 346 行代码，职责更清晰

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

### **📦 本地安装 (Install-Claude.ps1)**

无需网络访问时，使用内置的 PowerShell 安装脚本：

**安装模式：**
```powershell
# 交互式安装（推荐）
.\Install-Claude.ps1

# 快速安装（自动备份）
.\Install-Claude.ps1 -Force -BackupAll

# 非交互式安装
.\Install-Claude.ps1 -NonInteractive -Force
```

**安装选项：**

| 模式 | 描述 | 安装位置 |
|------|------|----------|
| **Global** | 系统级安装（默认） | `~/.claude/`、`~/.codex/`、`~/.gemini/` |
| **Path** | 自定义目录 + 全局混合 | 本地：`agents/`、`commands/`<br>全局：`workflows/`、`scripts/` |

**备份行为：**
- **默认**：自动备份启用（`-BackupAll`）
- **禁用**：使用 `-NoBackup` 标志（⚠️ 无备份覆盖）
- **备份位置**：安装目录中的 `claude-backup-{timestamp}/`

**⚠️ 重要警告：**
- `-Force -BackupAll`：静默文件覆盖（带备份）
- `-NoBackup -Force`：永久文件覆盖（无法恢复）
- Global 模式会修改用户配置目录

### **✅ 验证安装**
安装后，运行以下命令以确保 CCW 正常工作：
```bash
/workflow:session:list
```

> **📝 安装说明：**
> - 安装程序将自动安装/更新 `.codex/` 和 `.gemini/` 目录
> - **全局模式**：安装到 `~/.codex` 和 `~/.gemini`
> - **路径模式**：安装到指定目录（例如 `project/.codex`、`project/.gemini`）
> - **备份**：默认自动备份现有文件到 `claude-backup-{timestamp}/`
> - **安全**：首次安装建议使用交互式模式以审查更改

---

## ⚙️ 配置

### **工具控制系统**

CCW 使用**基于配置的工具控制系统**，使外部 CLI 工具成为**可选项**而非必需项。这允许您：

- ✅ **从纯 Claude 模式开始** - 无需安装额外工具即可立即开始工作
- ✅ **渐进式增强** - 根据需要选择性地添加外部工具
- ✅ **优雅降级** - 工具不可用时自动回退
- ✅ **灵活配置** - 按项目控制工具可用性

**配置文件**: `~/.claude/workflows/tool-control.yaml`

```yaml
tools:
  gemini:
    enabled: false  # 可选：AI 分析与文档生成
  qwen:
    enabled: true   # 可选：AI 架构与代码生成
  codex:
    enabled: true   # 可选：AI 开发与实现
```

**行为**:
- **禁用时**: CCW 自动回退到其他已启用工具或 Claude 的原生能力
- **启用时**: 使用专用工具发挥各自优势
- **默认**: 所有工具禁用 - 纯 Claude 模式开箱即用

### **可选 CLI 工具** *(增强功能)*

虽然 CCW 仅使用 Claude 即可工作，但安装这些工具可提供增强的分析和扩展上下文：

#### **外部 CLI 工具**

| 工具 | 用途 | 安装方式 | 优势 |
|------|------|----------|------|
| **Gemini CLI** | AI 分析与文档生成 | `npm install -g @google/gemini-cli` ([GitHub](https://github.com/google-gemini/gemini-cli)) | 免费配额，复杂项目的扩展上下文 |
| **Codex CLI** | AI 开发与实现 | `npm install -g @openai/codex` ([GitHub](https://github.com/openai/codex)) | 自主开发，数学推理 |
| **Qwen Code** | AI 架构与代码生成 | `npm install -g @qwen-code/qwen-code` ([文档](https://github.com/QwenLM/qwen-code)) | 大上下文窗口，架构分析 |

#### **系统实用工具**

| 工具 | 用途 | 安装方式 |
|------|------|----------|
| **ripgrep (rg)** | 快速代码搜索 | [下载](https://github.com/BurntSushi/ripgrep/releases) 或 `brew install ripgrep` (macOS), `apt install ripgrep` (Ubuntu) |
| **jq** | JSON 处理 | [下载](https://jqlang.github.io/jq/download/) 或 `brew install jq` (macOS), `apt install jq` (Ubuntu) |

**快速安装（所有工具）：**

```bash
# macOS
brew install ripgrep jq
npm install -g @google/gemini-cli @openai/codex @qwen-code/qwen-code

# Ubuntu/Debian
sudo apt install ripgrep jq
npm install -g @google/gemini-cli @openai/codex @qwen-code/qwen-code

# Windows (Chocolatey)
choco install ripgrep jq
npm install -g @google/gemini-cli @openai/codex @qwen-code/qwen-code
```

### **必需: Gemini CLI 设置**

配置 Gemini CLI 以实现最佳集成：

```json
// ~/.gemini/settings.json
{
  "contextFileName": ["CLAUDE.md", "GEMINI.md"]
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

### **推荐: MCP 工具** *(增强分析)*

MCP (模型上下文协议) 工具提供高级代码库分析。**推荐安装** - 虽然 CCW 具有回退机制，但不安装 MCP 工具可能会导致某些工作流出现意外行为或性能下降。

#### 可用的 MCP 服务器

| MCP 服务器 | 用途 | 安装指南 |
|------------|------|---------|
| **Exa MCP** | 外部 API 模式和最佳实践 | [安装指南](https://smithery.ai/server/exa) |
| **Code Index MCP** | 高级内部代码搜索 | [安装指南](https://github.com/johnhuang316/code-index-mcp) |

#### 启用后的好处
- 📊 **更快分析**: 直接代码库索引 vs 手动搜索
- 🌐 **外部上下文**: 真实世界的 API 模式和示例
- 🔍 **高级搜索**: 模式匹配和相似性检测
- ⚡ **更好的可靠性**: 某些工作流的主要工具

⚠️ **注意**: 某些工作流期望 MCP 工具可用。如果没有安装，您可能会遇到：
- 代码分析和搜索操作速度较慢
- 某些场景下上下文质量降低
- 回退到效率较低的传统工具
- 高级工作流中可能出现意外行为

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

**阶段 2：UI 设计精炼** *(UI 密集型项目可选)*
```bash
# 矩阵探索模式 - 多个风格×布局变体（v4.2.1+）
/workflow:ui-design:explore-auto --prompt "现代博客：首页，文章，作者" --style-variants 3 --layout-variants 2

# 快速模仿模式 - 单一设计快速复制（v4.2.1+）
/workflow:ui-design:imitate-auto --images "refs/design.png" --pages "dashboard,settings"

# 与会话集成
/workflow:ui-design:explore-auto --session WFS-auth --images "refs/*.png" --style-variants 2 --layout-variants 3

# 或者运行单独的设计阶段
/workflow:ui-design:extract --images "refs/*.png" --variants 3
/workflow:ui-design:consolidate --variants "variant-1,variant-3"
/workflow:ui-design:generate --pages "dashboard,auth" --style-variants 2 --layout-variants 2

# 预览生成的原型
# 选项1：在浏览器中打开 .workflow/WFS-auth/.design/prototypes/compare.html
# 选项2：启动本地服务器
cd .workflow/WFS-auth/.design/prototypes && python -m http.server 8080
# 访问 http://localhost:8080 获取交互式预览和对比工具

/workflow:ui-design:update --session WFS-auth --selected-prototypes "dashboard-s1-l2"
```

**阶段 3：行动规划**
```bash
# 创建可执行的实现计划
/workflow:plan "实现基于 JWT 的认证系统"

# 或使用 TDD 方法
/workflow:tdd-plan "使用测试优先开发实现认证"
```

**阶段 4：执行**
```bash
# 使用 AI 智能体执行任务
/workflow:execute

# 监控进度
/workflow:status
```

**阶段 5：测试与质量保证**
```bash
# 生成独立测试修复工作流（v3.2.2+）
/workflow:test-gen WFS-auth  # 创建 WFS-test-auth 会话
/workflow:execute            # 运行测试验证

# 或验证 TDD 合规性（TDD 工作流）
/workflow:tdd-verify
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
| `/workflow:ui-design:explore-auto` | **v4.2.1** 矩阵探索模式 - 生成多个风格×布局变体，全面探索设计方向。 |
| `/workflow:ui-design:imitate-auto` | **v4.2.1** 快速模仿模式 - 单一设计快速复制，自动截图和直接令牌提取。 |
| `/workflow:ui-design:extract` | **v4.2.1** 使用 Claude 原生分析从图像/文本提取设计。单次生成变体。 |
| `/workflow:ui-design:consolidate` | **v4.2.1** 使用 Claude 合成将风格变体整合为经过验证的设计令牌。 |
| `/workflow:ui-design:generate` | **v4.2.1** 生成矩阵模式（风格×布局组合）的令牌驱动 HTML/CSS 原型。 |
| `/workflow:ui-design:update` | **v4.2.1** 将最终确定的设计系统集成到头脑风暴产物中。 |
| `/workflow:plan` | 从描述创建详细、可执行的计划。 |
| `/workflow:tdd-plan` | 创建 TDD 工作流（6 阶段），包含测试覆盖分析和 Red-Green-Refactor 循环。 |
| `/workflow:execute` | 自主执行当前的工作流计划。 |
| `/workflow:status` | 显示工作流的当前状态。 |
| `/workflow:test-gen [--use-codex] <session>` | 为已完成实现创建独立测试生成工作流，支持自动诊断和修复。 |
| `/workflow:tdd-verify` | 验证 TDD 合规性并生成质量报告。 |
| `/workflow:review` | **可选** 手动审查（仅在明确需要时使用，测试通过即代表代码已批准）。 |
| `/workflow:tools:test-context-gather` | 分析测试覆盖率，识别缺失的测试文件。 |
| `/workflow:tools:test-concept-enhanced` | 使用 Gemini 生成测试策略和需求分析。 |
| `/workflow:tools:test-task-generate` | 生成测试任务 JSON，包含 test-fix-cycle 规范。 |

### **UI 设计工作流命令 (`/workflow:ui-design:*`)** *(v4.2.1)*

设计工作流系统提供完整的 UI 设计精炼，具备**纯 Claude 执行**、**智能页面推断**和**零外部依赖**。

#### 核心命令

**`/workflow:ui-design:explore-auto`** - 矩阵探索模式
```bash
# 全面探索 - 多个风格×布局变体
/workflow:ui-design:explore-auto --prompt "现代博客：首页，文章，作者" --style-variants 3 --layout-variants 2

# 与图像和会话集成
/workflow:ui-design:explore-auto --session WFS-auth --images "refs/*.png" --style-variants 2 --layout-variants 3

# 纯文本模式，带页面推断
/workflow:ui-design:explore-auto --prompt "电商：首页，产品，购物车" --style-variants 2 --layout-variants 2
```
- **🎯 矩阵模式**: 生成所有风格×布局组合
- **📊 全面探索**: 比较多个设计方向
- **🔍 交互式对比**: 带视口控制的并排比较
- **✅ 跨页面验证**: 多页面设计的自动一致性检查
- **⚡ 批量选择**: 按风格或布局快速选择

**`/workflow:ui-design:imitate-auto`** - 快速模仿模式
```bash
# 快速单一设计复制
/workflow:ui-design:imitate-auto --images "refs/design.png" --pages "dashboard,settings"

# 与会话集成
/workflow:ui-design:imitate-auto --session WFS-auth --images "refs/ui.png" --pages "home,product"

# 从 URL 自动截图（需要 Playwright）
/workflow:ui-design:imitate-auto --url "https://example.com" --pages "landing"
```
- **⚡ 速度优化**: 比 explore-auto 快 5-10 倍
- **📸 自动截图**: 使用 Playwright/Chrome 自动捕获 URL 截图
- **🎯 直接提取**: 跳过变体选择，直接进入实现
- **🔧 单一设计聚焦**: 最适合快速复制现有设计

**`/workflow:ui-design:style-consolidate`** - 验证和合并令牌
```bash
# 整合选定的风格变体
/workflow:ui-design:style-consolidate --session WFS-auth --variants "variant-1,variant-3"
```
- **功能**: WCAG AA 验证、OKLCH 颜色、W3C 令牌格式
- **输出**: `design-tokens.json`、`style-guide.md`、`tailwind.config.js`

**`/workflow:ui-design:generate`** - 生成 HTML/CSS 原型
```bash
# 矩阵模式 - 风格×布局组合
/workflow:ui-design:generate --pages "dashboard,auth" --style-variants 2 --layout-variants 3

# 单页面多变体
/workflow:ui-design:generate --pages "home" --style-variants 3 --layout-variants 2
```
- **🎯 矩阵生成**: 创建所有风格×布局组合
- **📊 多页面支持**: 跨页面一致的设计系统
- **✅ 一致性验证**: 自动跨页面一致性报告（v4.2.0+）
- **🔍 交互式预览**: `compare.html` 并排比较
- **📋 批量选择**: 按风格或布局过滤器快速选择

**`/workflow:ui-design:update`** - 集成设计系统
```bash
# 使用设计系统更新头脑风暴产物
/workflow:ui-design:update --session WFS-auth --selected-prototypes "dashboard-s1-l2"
```
- **更新**: `synthesis-specification.md`、`ui-designer/style-guide.md`
- **使设计令牌可用于任务生成**

#### 预览系统

运行 `ui-generate` 后，您将获得交互式预览工具：

**快速预览**（直接浏览器）:
```bash
# 导航到原型目录
cd .workflow/WFS-auth/.design/prototypes
# 在浏览器中打开 index.html（双击或执行）:
open index.html  # macOS
start index.html  # Windows
xdg-open index.html  # Linux
```

**完整预览**（本地服务器 - 推荐）:
```bash
cd .workflow/WFS-auth/.design/prototypes
# 选择一个:
python -m http.server 8080      # Python
npx http-server -p 8080         # Node.js
php -S localhost:8080           # PHP
# 访问: http://localhost:8080
```

**预览功能**:
- `index.html`: 包含所有原型的主导航
- `compare.html`: 带视口控制的并排对比（桌面/平板/移动）
- 同步滚动用于布局对比
- 动态页面切换
- 实时响应式测试

---

### **任务与内存命令**

| 命令 | 描述 |
|---|---|
| `/task:*` | 管理单个任务（`create`, `breakdown`, `execute`, `replan`）。 |
| `/update-memory-full` | 重新索引整个项目文档。 |
| `/update-memory-related` | 更新与最近更改相关的文档。 |
| `/version` | 显示版本信息并检查 GitHub 更新。 |

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
