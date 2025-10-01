# 🚀 Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v3.0.1-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()
[![MCP Tools](https://img.shields.io/badge/🔧_MCP_Tools-Experimental-orange.svg)](https://github.com/modelcontextprotocol)

**Languages:** [English](README.md) | [中文](README_CN.md)

</div>

---

**Claude Code Workflow (CCW)** is a next-generation multi-agent automation framework that orchestrates complex software development tasks through intelligent workflow management and autonomous execution.

> **🎉 Latest: v3.0.1** - Documentation optimization and brainstorming role updates. See [CHANGELOG.md](CHANGELOG.md) for details.
>
> **v3.0.0**: Introduced **unified CLI command structure**. The `/cli:*` commands consolidate all tool interactions (Gemini, Qwen, Codex) using a `--tool` flag for selection.

---

## ✨ Key Features

- **🤖 Multi-Agent System**: Specialized agents for planning, coding, testing, and reviewing.
- **🔄 End-to-End Workflow Automation**: From brainstorming (`/workflow:brainstorm`) to deployment.
- **🎯 JSON-First Architecture**: Uses JSON as the single source of truth for tasks, ensuring consistency.
- **🧪 Automated Test Generation**: Creates comprehensive test suites based on implementation analysis.
- **✅ Pre-execution Verification**: Validates plans with both strategic (Gemini) and technical (Codex) analysis.
- **🔧 Unified CLI**: A single, powerful `/cli:*` command set for interacting with various AI tools.
- **🧠 Smart Context Management**: Automatically manages and updates project documentation (`CLAUDE.md`).

---

## ⚙️ Installation

### **🚀 Quick One-Line Installation**

**Windows (PowerShell):**
```powershell
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1" -UseBasicParsing).Content
```

**Linux/macOS (Bash/Zsh):**
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.sh)
```

### **✅ Verify Installation**
After installation, run the following command to ensure CCW is working:
```bash
/workflow:session:list
```

---

## 🚀 Getting Started: A Simple Workflow

1.  **Start a new workflow session:**
    ```bash
    /workflow:session:start "Create a new user authentication feature"
    ```

2.  **Generate an implementation plan:**
    ```bash
    /workflow:plan "Implement JWT-based user authentication"
    ```

3.  **Execute the plan with AI agents:**
    ```bash
    /workflow:execute
    ```

4.  **Check the status:**
    ```bash
    /workflow:status
    ```

---

## 🛠️ Command Reference

### **Unified CLI Commands (`/cli:*)**
*Use the `--tool <gemini|qwen|codex>` flag to select the desired tool. Defaults to `gemini`.*

| Command | Description |
|---|---|
| `/cli:analyze` | Deep codebase analysis. |
| `/cli:chat` | Direct, interactive chat with a tool. |
| `/cli:execute` | Execute a task with full permissions. |
| `/cli:cli-init`| Initialize CLI tool configurations for the workspace. |
| `/cli:mode:bug-index` | Analyze bugs and suggest fixes. |
| `/cli:mode:code-analysis` | Perform deep code analysis and debugging. |
| `/cli:mode:plan` | Project planning and architecture analysis. |

### **Workflow Commands (`/workflow:*)**

| Command | Description |
|---|---|
| `/workflow:session:*` | Manage development sessions (`start`, `pause`, `resume`, `list`, `switch`, `complete`). |
| `/workflow:brainstorm:*` | Use role-based agents for multi-perspective planning. |
| `/workflow:plan` | Create a detailed, executable plan from a description. |
| `/workflow:execute` | Execute the current workflow plan autonomously. |
| `/workflow:status` | Display the current status of the workflow. |
| `/workflow:test-gen` | Automatically generate a test plan from the implementation. |
| `/workflow:review` | Initiate a quality assurance review of the completed work. |

### **Task & Memory Commands**

| Command | Description |
|---|---|
| `/task:*` | Manage individual tasks (`create`, `breakdown`, `execute`, `replan`). |
| `/update-memory-full` | Re-index the entire project documentation. |
| `/update-memory-related` | Update documentation related to recent changes. |

---

## ⚙️ Essential Configuration

For optimal integration, configure your Gemini CLI settings by creating a `settings.json` file in `~/.gemini/`:

```json
// ~/.gemini/settings.json
{
  "contextFileName": "CLAUDE.md"
}
```
This ensures CCW's intelligent documentation system works seamlessly with the Gemini CLI.

---

## 🤝 Contributing & Support

- **Repository**: [GitHub - Claude-Code-Workflow](https://github.com/catlog22/Claude-Code-Workflow)
- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues).
- **Discussions**: Join the [Community Forum](https://github.com/catlog22/Claude-Code-Workflow/discussions).

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
