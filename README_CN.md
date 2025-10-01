# 🚀 Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v3.0.0-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()
[![MCP工具](https://img.shields.io/badge/🔧_MCP工具-实验性-orange.svg)](https://github.com/modelcontextprotocol)

**语言:** [English](README.md) | [中文](README_CN.md)

</div>

---

**Claude Code Workflow (CCW)** 是一个新一代的多智能体自动化开发框架，通过智能工作流管理和自主执行来协调复杂的软件开发任务。

> **🎉 v3.0.0 版本**: 此版本引入了**统一的 CLI 命令结构**。`/cli:*` 命令现在通过 `--tool` 标志整合了所有工具（Gemini, Qwen, Codex）的交互。

---

## ✨ 核心特性

- **🤖 多智能体系统**: 用于规划、编码、测试和审查的专用智能体。
- **🔄 端到端工作流自动化**: 从头脑风暴 (`/workflow:brainstorm`) 到部署的完整流程。
- **🎯 JSON 优先架构**: 使用 JSON 作为任务的唯一真实数据源，确保一致性。
- **🧪 自动测试生成**: 基于实现分析创建全面的测试套件。
- **✅ 执行前验证**: 通过战略（Gemini）和技术（Codex）双重分析验证计划。
- **🔧 统一 CLI**: 一个强大、统一的 `/cli:*` 命令集，用于与各种 AI 工具交互。
- **🧠 智能上下文管理**: 自动管理和更新项目文档 (`CLAUDE.md`)。

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

### **✅ 验证安装**
安装后，运行以下命令以确保 CCW 正常工作：
```bash
/workflow:session:list
```

---

## 🚀 快速入门：一个简单的工作流

1.  **启动一个新的工作流会话：**
    ```bash
    /workflow:session:start "创建一个新的用户认证功能"
    ```

2.  **生成一个实现计划：**
    ```bash
    /workflow:plan "实现基于JWT的用户认证"
    ```

3.  **使用 AI 智能体执行计划：**
    ```bash
    /workflow:execute
    ```

4.  **检查状态：**
    ```bash
    /workflow:status
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
| `/workflow:execute` | 自主执行当前的工作流计划。 |
| `/workflow:status` | 显示工作流的当前状态。 |
| `/workflow:test-gen` | 从实现中自动生成测试计划。 |
| `/workflow:review` | 对已完成的工作启动质量保证审查。 |

### **任务与内存命令**

| 命令 | 描述 |
|---|---|
| `/task:*` | 管理单个任务（`create`, `breakdown`, `execute`, `replan`）。 |
| `/update-memory-full` | 重新索引整个项目文档。 |
| `/update-memory-related` | 更新与最近更改相关的文档。 |

---

## ⚙️ 核心配置

为实现最佳集成，请在 `~/.gemini/` 中创建一个 `settings.json` 文件来配置您的 Gemini CLI 设置：

```json
// ~/.gemini/settings.json
{
  "contextFileName": "CLAUDE.md"
}
```
这确保了 CCW 的智能文档系统能与 Gemini CLI 无缝协作。

---

## 🤝 贡献与支持

- **仓库**: [GitHub - Claude-Code-Workflow](https://github.com/catlog22/Claude-Code-Workflow)
- **问题**: 在 [GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues) 上报告错误或请求功能。
- **讨论**: 加入 [社区论坛](https://github.com/catlog22/Claude-Code-Workflow/discussions)。

## 📄 许可证

此项目根据 **MIT 许可证** 授权。详见 [LICENSE](LICENSE) 文件。
