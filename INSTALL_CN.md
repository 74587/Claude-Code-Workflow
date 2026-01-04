# Claude Code Workflow (CCW) - 安装指南

[English](INSTALL.md) | **中文**

Claude Code Agent 工作流协调和分布式内存系统的安装指南。

> **版本 6.3.18：原生 CodexLens 与 Dashboard 革新** - 内置代码索引引擎（FTS + 语义搜索 + HNSW 向量索引），全新 Dashboard 视图，TypeScript 后端，会话聚类智能记忆管理。

## ⚡ 快速安装（推荐）

### NPM 全局安装

```bash
npm install -g claude-code-workflow
```

### 验证安装

```bash
# 检查 ccw 命令
ccw --version

# 启动 Dashboard
ccw dashboard

# 启动 View 界面（替代 UI）
ccw view
```

## 📂 从源码安装

如果你想从源码安装或参与开发：

```bash
# 克隆仓库
git clone https://github.com/catlog22/Claude-Code-Workflow.git
cd Claude-Code-Workflow

# 安装依赖
npm install

# 全局链接（开发模式）
npm link
```

## 平台要求

- **Node.js**: 16.0.0 或更高版本
- **操作系统**: Windows、Linux、macOS

检查 Node.js 版本：
```bash
node --version  # 应该 >= 16.0.0
```

## ⚙️ 配置

### 工具控制系统

CCW 使用**基于配置的工具控制系统**，使外部 CLI 工具成为**可选**而非必需。这允许你：

- ✅ **从仅 Claude 模式开始** - 无需安装额外工具即可立即使用
- ✅ **渐进式增强** - 按需选择性添加外部工具
- ✅ **优雅降级** - 工具不可用时自动回退
- ✅ **灵活配置** - 每个项目控制工具可用性

**配置文件**：`~/.claude/workflows/tool-control.yaml`

```yaml
tools:
  gemini:
    enabled: false  # 可选：AI 分析和文档
  qwen:
    enabled: true   # 可选：AI 架构和代码生成
  codex:
    enabled: true   # 可选：AI 开发和实现
```

**行为**：
- **禁用时**：CCW 自动回退到其他已启用的工具或 Claude 的原生能力
- **启用时**：使用专门工具发挥其特定优势
- **默认**：所有工具禁用 - 仅 Claude 模式开箱即用

### 可选 CLI 工具（增强功能）

虽然 CCW 仅使用 Claude 即可工作，但安装这些工具可提供增强的分析和扩展上下文：

#### 系统工具

| 工具 | 用途 | 安装方式 |
|------|------|----------|
| **ripgrep (rg)** | 快速代码搜索 | **macOS**: `brew install ripgrep`<br>**Linux**: `apt install ripgrep`<br>**Windows**: `winget install ripgrep` |
| **jq** | JSON 处理 | **macOS**: `brew install jq`<br>**Linux**: `apt install jq`<br>**Windows**: `winget install jq` |

#### 外部 AI 工具

在 `~/.claude/workflows/tool-control.yaml` 中配置这些工具：

| 工具 | 用途 | 安装方式 |
|------|------|----------|
| **Gemini CLI** | AI 分析和文档 | 遵循[官方文档](https://ai.google.dev) - 免费配额，扩展上下文 |
| **Codex CLI** | AI 开发和实现 | 遵循[官方文档](https://github.com/openai/codex) - 自主开发 |
| **Qwen Code** | AI 架构和代码生成 | 遵循[官方文档](https://github.com/QwenLM/qwen-code) - 大上下文窗口 |

### 推荐：MCP 工具（增强分析）

MCP（模型上下文协议）工具提供高级代码库分析。**推荐安装** - 虽然 CCW 有回退机制，但不安装 MCP 工具可能导致某些工作流的意外行为或性能下降。

| MCP 服务器 | 用途 | 安装指南 |
|------------|------|----------|
| **Exa MCP** | 外部 API 模式和最佳实践 | [安装指南](https://smithery.ai/server/exa) |
| **Chrome DevTools MCP** | ⚠️ **UI 工作流必需** - URL 模式设计提取 | [安装指南](https://github.com/ChromeDevTools/chrome-devtools-mcp) |

> **注意**：Code Index MCP 已被 CCW 内置的 **CodexLens** (`mcp__ccw-tools__codex_lens`) 替代。无需额外安装代码索引工具。

## ✅ 验证安装

安装后，在 **Claude Code** 中检查工作流命令是否可用：

```bash
/workflow:session:list
```

此命令应在 Claude Code 界面中被识别。如果看到工作流斜杠命令（如 `/workflow:*`、`/cli:*`），则安装成功。

## 故障排除

### 权限错误（npm 全局安装）

**Linux/macOS**：
```bash
# 选项 1：使用 nvm 管理 Node.js（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash

# 选项 2：修复 npm 权限
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

**Windows**：以管理员身份运行命令提示符或 PowerShell

### 工作流命令无效

- 验证安装：`ls ~/.claude`（应显示 agents/、commands/、workflows/）
- 安装后重启 Claude Code
- 检查 `/workflow:session:list` 命令是否被识别

### ccw 命令未找到

```bash
# 检查全局安装位置
npm list -g --depth=0

# 确保 npm bin 目录在 PATH 中
npm bin -g
```

## 支持

- **问题**：[GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues)
- **快速入门**：[快速入门指南](GETTING_STARTED_CN.md)
- **文档**：[主 README](README_CN.md)
