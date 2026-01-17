# Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v6.3.33-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![npm](https://img.shields.io/npm/v/claude-code-workflow.svg)](https://www.npmjs.com/package/claude-code-workflow)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**[English](README.md) | [中文](README_CN.md)**

</div>

---

**CCW** 是一个 JSON 驱动的多智能体开发框架，具有智能 CLI 编排能力。提供 **4 级工作流系统**，从急速执行到完整头脑风暴，将 AI 开发转变为强大的编排系统。

## 核心特性

| 特性 | 说明 |
|------|------|
| **4 级工作流** | 从 `lite-lite-lite`（即时执行）到 `brainstorm`（多角色分析） |
| **多 CLI 编排** | Gemini、Qwen、Codex、Claude - 自动选择或手动指定 |
| **依赖感知并行** | Agent 并行执行，无需 worktree 复杂性 |
| **Issue 工作流** | 开发后维护，可选 worktree 隔离 |
| **JSON 优先状态** | `.task/IMPL-*.json` 作为唯一事实来源 |
| **Dashboard** | 可视化会话管理、CodexLens 搜索、图浏览器 |

> 📖 **新用户？** 查看 [工作流指南](WORKFLOW_GUIDE_CN.md) 了解完整的 4 级工作流系统。

---

## 快速开始

### 安装 CCW

```bash
npm install -g claude-code-workflow
ccw install -m Global
```

### 选择工作流级别

| 级别 | 命令 | 使用场景 |
|------|------|----------|
| **1** | `/workflow:lite-lite-lite` | 快速修复、配置调整 |
| **2** | `/workflow:lite-plan` | 明确的单模块功能 |
| **2** | `/workflow:lite-fix` | Bug 诊断修复 |
| **2** | `/workflow:multi-cli-plan` | 多视角分析 |
| **3** | `/workflow:plan` | 多模块开发 |
| **3** | `/workflow:tdd-plan` | 测试驱动开发 |
| **4** | `/workflow:brainstorm:auto-parallel` | 新功能、架构设计 |

### 工作流示例

```bash
# Level 1: 即时执行
/workflow:lite-lite-lite "修复 README 中的拼写错误"

# Level 2: 轻量规划
/workflow:lite-plan "添加 JWT 认证"
/workflow:lite-fix "用户上传失败返回 413 错误"

# Level 3: 标准规划 + Session
/workflow:plan "实现支付网关集成"
/workflow:execute

# Level 4: 多角色头脑风暴
/workflow:brainstorm:auto-parallel "设计实时协作系统" --count 5
/workflow:plan --session WFS-xxx
/workflow:execute
```

---

## CLI 工具安装

CCW 支持多种 CLI 工具进行代码分析和生成。以下是各工具的安装方式：

### Gemini CLI

Google 官方 Gemini CLI 工具：

```bash
# 安装
npm install -g @anthropic-ai/gemini-cli

# 配置 API Key
export GEMINI_API_KEY="your-api-key"

# 验证
gemini --version
```

### Codex CLI

OpenAI Codex CLI 工具（推荐用于长时间自主编码）：

```bash
# 安装
npm install -g @openai/codex

# 配置 API Key
export OPENAI_API_KEY="your-api-key"

# 验证
codex --version
```

### OpenCode CLI

开源多模型 CLI 工具：

```bash
# 安装
npm install -g opencode-ai

# 配置（支持多种模型）
export OPENCODE_API_KEY="your-api-key"

# 验证
opencode --version
```

### Qwen CLI

阿里云 Qwen CLI 工具：

```bash
# 安装
pip install qwen-cli

# 配置
export QWEN_API_KEY="your-api-key"

# 验证
qwen --version
```

---

## ACE Tool 配置

ACE (Augment Context Engine) 提供强大的语义代码搜索能力。

### 方式一：官方安装（推荐）

直接使用 Anthropic 官方 MCP 包：

```json
{
  "mcpServers": {
    "ace-tool": {
      "command": "npx",
      "args": ["-y", "@anthropic/ace-mcp"],
      "env": {
        "AUGMENT_API_KEY": "your-augment-api-key"
      }
    }
  }
}
```

**获取 API Key**: 从 [Augment 开发者门户](https://augment.dev) 获取

### 方式二：代理安装

如果网络受限，可通过代理服务器配置：

```json
{
  "mcpServers": {
    "ace-tool": {
      "command": "npx",
      "args": ["-y", "@anthropic/ace-mcp"],
      "env": {
        "AUGMENT_API_KEY": "your-api-key",
        "HTTPS_PROXY": "http://your-proxy:port",
        "HTTP_PROXY": "http://your-proxy:port"
      }
    }
  }
}
```

### 使用方式

```javascript
mcp__ace-tool__search_context({
  project_root_path: "/path/to/project",
  query: "用户认证逻辑"
})
```

---

## CodexLens 本地搜索

> ⚠️ **开发中**: CodexLens 正在迭代优化中，部分功能可能不稳定。

CodexLens 提供本地代码索引和搜索能力，无需外部 API：

| 搜索模式 | 说明 |
|----------|------|
| **FTS** | 全文搜索，基于 SQLite FTS5 |
| **Semantic** | 语义搜索，基于本地嵌入模型 |
| **Hybrid** | 混合搜索，结合 FTS + 语义 + 重排序 |

### 安装

```bash
# 进入 codex-lens 目录
cd codex-lens

# 安装依赖
pip install -e .

# 初始化索引
codexlens index /path/to/project
```

### Dashboard 集成

通过 `ccw view` 打开 Dashboard，在 **CodexLens Manager** 中管理索引和执行搜索。

---

## CCW CLI 命令

```bash
ccw install           # 安装工作流文件
ccw view              # 打开 Dashboard
ccw cli -p "..."      # 执行 CLI 工具 (Gemini/Qwen/Codex)
ccw upgrade -a        # 升级所有安装
```

### Dashboard 功能

- **会话概览** - 跟踪工作流会话和进度
- **CodexLens** - FTS + 语义 + 混合代码搜索
- **图浏览器** - 交互式代码关系可视化
- **CLI 管理器** - 执行历史与会话恢复

---

## 文档

| 文档 | 说明 |
|------|------|
| [**工作流指南**](WORKFLOW_GUIDE_CN.md) | 4 级工作流系统（推荐） |
| [**快速开始**](GETTING_STARTED_CN.md) | 5 分钟快速入门 |
| [**Dashboard 指南**](DASHBOARD_GUIDE.md) | Dashboard 用户指南 |
| [**常见问题**](FAQ.md) | 常见问题解答 |
| [**更新日志**](CHANGELOG.md) | 版本历史 |

---

## 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                     主干工作流 (4 级)                            │
│  Level 1: lite-lite-lite (即时执行，无产物)                      │
│  Level 2: lite-plan / lite-fix / multi-cli-plan (→ lite-execute)│
│  Level 3: plan / tdd-plan / test-fix-gen (Session 持久化)        │
│  Level 4: brainstorm:auto-parallel → plan → execute             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Issue 工作流 (补充)                          │
│  discover → plan → queue → execute (worktree 隔离)              │
└─────────────────────────────────────────────────────────────────┘
```

**核心原则：**
- **依赖分析** 解决并行问题 - 主干工作流无需 worktree
- **Issue 工作流** 补充主干工作流，用于开发后维护
- 根据复杂度选择工作流级别 - 避免过度工程化

---

## 贡献

- **仓库**: [GitHub](https://github.com/catlog22/Claude-Code-Workflow)
- **问题**: [报告 Bug 或请求功能](https://github.com/catlog22/Claude-Code-Workflow/issues)
- **贡献**: 查看 [CONTRIBUTING.md](CONTRIBUTING.md)

## 许可证

MIT License - 详见 [LICENSE](LICENSE)
