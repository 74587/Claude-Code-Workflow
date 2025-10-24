# 🚀 Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v5.0.0-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()

**Languages:** [English](README.md) | [中文](README_CN.md)

</div>

---

**Claude Code Workflow (CCW)** transforms AI development from simple prompt chaining into a robust, context-first orchestration system. It solves execution uncertainty and error accumulation through structured planning, deterministic execution, and intelligent multi-model orchestration.

> **🎉 Version 5.0: Less is More**
>
> **Core Improvements**:
> - ✅ **Removed External Dependencies** - Using standard ripgrep/find instead of MCP code-index for better stability
> - ✅ **Streamlined Workflows** - Enhanced TDD workflow with conflict resolution mechanism
> - ✅ **Focused on Role Analysis** - Simplified planning architecture centered on role documents
>
> See [CHANGELOG.md](CHANGELOG.md) for full details.

> 📚 **New to CCW?** Check out the [**Getting Started Guide**](GETTING_STARTED.md) for a beginner-friendly 5-minute tutorial!

---

## ✨ Core Concepts

CCW is built on a set of core principles that differentiate it from traditional AI development approaches:

- **Context-First Architecture**: Pre-defined context gathering eliminates execution uncertainty by ensuring agents have the correct information *before* implementation.
- **JSON-First State Management**: Task states live in `.task/IMPL-*.json` files as the single source of truth, enabling programmatic orchestration without state drift.
- **Autonomous Multi-Phase Orchestration**: Commands chain specialized sub-commands and agents to automate complex workflows with zero user intervention.
- **Multi-Model Strategy**: Leverages the unique strengths of different AI models (Gemini for analysis, Codex for implementation) for superior results.
- **Hierarchical Memory System**: A 4-layer documentation system provides context at the appropriate level of abstraction, preventing information overload.
- **Specialized Role-Based Agents**: A suite of agents (`@code-developer`, `@test-fix-agent`, etc.) mirrors a real software team to handle diverse tasks.

---

## ⚙️ Installation

For detailed installation instructions, please refer to the [**INSTALL.md**](INSTALL.md) guide.

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
After installation, open **Claude Code** and check if the workflow commands are available by running:
```bash
/workflow:session:list
```
If the slash commands (e.g., `/workflow:*`) are recognized, the installation was successful.

---

## 🛠️ Command Reference

CCW provides a rich set of commands for managing workflows, tasks, and interacting with AI tools. For a complete list and detailed descriptions of all available commands, please see the [**COMMAND_REFERENCE.md**](COMMAND_REFERENCE.md) file.

For a detailed technical specification of every command, see the [**COMMAND_SPEC.md**](COMMAND_SPEC.md).

---

## 🚀 Getting Started

The best way to get started is to follow the 5-minute tutorial in the [**Getting Started Guide**](GETTING_STARTED.md).

Here is a quick example of a common development workflow:

1.  **Create a Plan** (automatically starts a session):
    ```bash
    /workflow:plan "Implement JWT-based user login and registration"
    ```
2.  **Execute the Plan**:
    ```bash
    /workflow:execute
    ```
3.  **Check Status** (optional):
    ```bash
    /workflow:status
    ```

---

## 🤝 Contributing & Support

- **Repository**: [GitHub - Claude-Code-Workflow](https://github.com/catlog22/Claude-Code-Workflow)
- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues).
- **Discussions**: Join the [Community Forum](https://github.com/catlog22/Claude-Code-Workflow/discussions).

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.