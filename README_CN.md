# 🚀 Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v4.6.0-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()
[![MCP Tools](https://img.shields.io/badge/🔧_MCP_Tools-Experimental-orange.svg)](https://github.com/modelcontextprotocol)

**语言:** [English](README.md) | [中文](README_CN.md)

</div>

---

**Claude Code Workflow (CCW)** 将 AI 开发从简单的提示词链接转变为一个强大的、上下文优先的编排系统。它通过结构化规划、确定性执行和智能多模型编排，解决了执行不确定性和误差累积的问题。

> **🎉 最新版本: v4.6.0** - 概念澄清与智能体驱动分析。详见 [CHANGELOG.md](CHANGELOG.md)。

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

## 🛠️ 命令参考

CCW 提供了一套丰富的命令，用于管理工作流、任务以及与 AI 工具的交互。有关所有可用命令的完整列表和详细说明，请参阅 [**COMMAND_REFERENCE.md**](COMMAND_REFERENCE.md) 文件。

有关每个命令的详细技术规范，请参阅 [**COMMAND_SPEC.md**](COMMAND_SPEC.md)。

---

## 🚀 快速入门

开始使用的最佳方式是遵循 [**快速上手指南**](GETTING_STARTED_CN.md) 中的 5 分钟教程。

以下是一个常见开发工作流的快速示例：

1.  **启动会话**:
    ```bash
    /workflow:session:start "实现用户登录功能"
    ```
2.  **创建计划**:
    ```bash
    /workflow:plan "实现基于 JWT 的用户登录和注册"
    ```
3.  **执行计划**:
    ```bash
    /workflow:execute
    ```

---

## 🤝 贡献与支持

- **仓库**: [GitHub - Claude-Code-Workflow](https://github.com/catlog22/Claude-Code-Workflow)
- **问题**: 在 [GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues) 上报告错误或请求功能。
- **讨论**: 加入 [社区论坛](https://github.com/catlog22/Claude-Code-Workflow/discussions)。

## 📄 许可证

此项目根据 **MIT 许可证** 授权。详见 [LICENSE](LICENSE) 文件。