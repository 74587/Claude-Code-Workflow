# 🚀 Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v5.8.1-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()

**Languages:** [English](README.md) | [中文](README_CN.md)

</div>

---

## 1. Overview

Claude Code Workflow (CCW) transforms AI development from simple prompt chaining into a robust, context-first orchestration system. It solves execution uncertainty and error accumulation through structured planning, deterministic execution, and intelligent multi-model orchestration. CCW is designed for AI developers and software engineers seeking to streamline their development processes.

**Key Features**:
*   **Context-First Architecture**: Ensures agents receive correct information before implementation.
*   **JSON-First State Management**: Task states use `.task/IMPL-*.json` files as the single source of truth for programmatic orchestration.
*   **Autonomous Multi-Phase Orchestration**: Commands chain specialized sub-commands and agents to automate complex workflows.
*   **Multi-Model Strategy**: Leverages Gemini for analysis, Codex for implementation, and Qwen for architecture/planning.
*   **Hierarchical Memory System**: A 4-layer CLAUDE.md documentation system provides context at appropriate abstraction levels.
*   **Specialized Role-Based Agents**: A suite of agents (e.g., `@code-developer`, `@test-fix-agent`) mirrors a real software team.
*   **Lite-Plan Workflow**: A lightweight interactive planning and execution workflow with in-memory planning, smart code exploration, three-dimensional multi-select confirmation, and parallel task execution support.
*   **CLI Tools Optimization**: Simplified command syntax with auto-model-selection for Gemini, Qwen, and Codex.

---

## 2. System Architecture

CCW is built on a foundation of robust design principles and a multi-layered architecture to facilitate AI-driven software development.

### Architectural Style and Design Principles

**Design Philosophy**:
*   **Context-First Architecture**: Pre-defined context gathering eliminates execution uncertainty.
*   **JSON-First State Management**: Task states live in `.task/IMPL-*.json` files as the single source of truth.
*   **Autonomous Multi-Phase Orchestration**: Commands chain specialized sub-commands and agents.
*   **Multi-Model Strategy**: Leverages the unique strengths of different AI models (Gemini for analysis, Codex for implementation, Qwen for architecture and planning).
*   **Hierarchical Memory System**: A 4-layer documentation system provides context at the appropriate level of abstraction.
*   **Specialized Role-Based Agents**: A suite of agents mirrors a real software team.

**Core Beliefs**:
*   **Pursue good taste**: Eliminate edge cases to make code logic natural and elegant.
*   **Embrace extreme simplicity**: Complexity is the root of all evil.
*   **Be pragmatic**: Code must solve real-world problems, not hypothetical ones.
*   **Data structures first**: Good programmers worry about data structures.
*   **Never break backward compatibility**: Existing functionality is sacred and inviolable.
*   **Incremental progress over big bangs**: Small changes that compile and pass tests.
*   **Learning from existing code**: Study and plan before implementing.
*   **Clear intent over clever code**: Be boring and obvious.
*   **Follow existing code style**: Match import patterns, naming conventions, and formatting of existing codebase.

### System Architecture Diagram

```mermaid
graph TB
    subgraph "User Interface Layer"
        CLI[Slash Commands]
        CHAT[Natural Language]
    end

    subgraph "Orchestration Layer"
        WF[Workflow Engine]
        SM[Session Manager]
        TM[Task Manager]
    end

    subgraph "Agent Layer"
        AG1[@code-developer]
        AG2[@test-fix-agent]
        AG3[@ui-design-agent]
        AG4[@cli-execution-agent]
        AG5[More Agents...]
    end

    subgraph "Tool Layer"
        GEMINI[Gemini CLI]
        QWEN[Qwen CLI]
        CODEX[Codex CLI]
        BASH[Bash/System]
    end

    subgraph "Data Layer"
        JSON[Task JSON Files]
        MEM[CLAUDE.md Memory]
        STATE[Session State]
    end

    CLI --> WF
    CHAT --> WF
    WF --> SM
    WF --> TM
    SM --> STATE
    TM --> JSON
    WF --> AG1
    WF --> AG2
    WF --> AG3
    WF --> AG4
    AG1 --> GEMINI
    AG1 --> QWEN
    AG1 --> CODEX
    AG2 --> BASH
    AG3 --> GEMINI
    AG4 --> CODEX
    GEMINI --> MEM
    QWEN --> MEM
    CODEX --> JSON
```

### Core Components

1.  **Workflow Engine**: Orchestrates complex development processes through planning, execution, verification, testing, and review phases.
2.  **Session Manager**: Manages isolated workflow contexts, providing directory-based session tracking, persistence, parallel support, and archival.
3.  **Task Manager**: Handles hierarchical task structures using a JSON-first data model, dynamic subtask creation, and dependency tracking.
4.  **Memory System**: A four-layer hierarchical CLAUDE.md documentation system for project knowledge (`CLAUDE.md`, `src/CLAUDE.md`, `auth/CLAUDE.md`, `jwt/CLAUDE.md`).
5.  **Multi-Agent System**: Specialized agents for different types of tasks, such as `@code-developer` (implementation), `@test-fix-agent` (testing), `@ui-design-agent` (UI design), `@action-planning-agent` (planning), and `@cli-execution-agent` (CLI task handling).
6.  **CLI Tool Integration**: Seamlessly integrates Gemini CLI (for deep analysis), Qwen CLI (for architecture and planning), and Codex CLI (for autonomous development).

---

## 3. Getting Started

This section provides a quick guide to installing, configuring, and running Claude Code Workflow.

### Prerequisites

Before you begin, ensure you have the following:
*   **Claude Code**: The latest version installed.
*   **Git**: For version control.
*   **Text Editor**: VS Code, Vim, or your preferred editor.
*   **Basic Knowledge**: Familiarity with Bash scripting, Markdown formatting, JSON structure, and Git workflow.

### Installation

For detailed installation instructions, please refer to the [INSTALL.md](INSTALL.md) guide.

#### 🚀 Quick One-Line Installation

**Windows (PowerShell):**
```powershell
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1" -UseBasicParsing).Content
```

**Linux/macOS (Bash/Zsh):**
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.sh)
```

The installer provides an interactive menu for version selection (Latest Stable Release, Latest Development Version, or Specific Release Version).

#### ✅ Verify Installation

After installation, open **Claude Code** and check if the workflow commands are available by running:
```bash
/workflow:session:list
```
If slash commands like `/workflow:*` are recognized, the installation was successful.

### Configuration

CCW uses a **configuration-based tool control system** that makes external CLI tools optional. This allows for progressive enhancement, graceful degradation, and flexible configuration.

**Configuration File**: `~/.claude/workflows/tool-control.yaml`

**Optional CLI Tools** (for enhanced capabilities):
*   **System Utilities**: `ripgrep (rg)` for fast code search, `jq` for JSON processing.
*   **External AI Tools**: Gemini CLI, Codex CLI, Qwen Code. These need to be configured in `tool-control.yaml` after installation.

### Running the Project (Quick Start)

Let's build a "Hello World" web application from scratch with a simple example. For a more detailed tutorial, see the [Getting Started Guide](GETTING_STARTED.md).

#### Step 1: Create an Execution Plan (Automatically Starts a Session)

Tell CCW what you want to do. CCW will analyze your request and automatically generate a detailed, executable task plan.

```bash
/workflow:plan "Create a simple Express API that returns Hello World at the root path"
```
This command initiates a planning process including context gathering, AI agent analysis, and task generation.

#### Step 2: Execute the Plan

Once the plan is created, command the AI agents to start working.

```bash
/workflow:execute
```
CCW's agents (e.g., `@code-developer`) will execute tasks, create files, write code, and install dependencies.

#### Step 3: Check the Status

Check the progress of the current workflow at any time.

```bash
/workflow:status
```
This command shows the completion status of tasks, the currently executing task, and next steps.

---

## 4. Development Workflow

This section outlines the development processes, coding standards, testing practices, and guidelines for contributing to CCW.

### Development Setup

1.  **Fork and Clone**: Fork the repository on GitHub and then clone your fork.
2.  **Set Up Upstream Remote**: Add the upstream remote to keep your fork in sync.
3.  **Create Development Branch**: Create a feature branch for your work.
4.  **Install CCW for Testing**: Install your development version of CCW.

### How to Contribute

CCW welcomes contributions in the form of bug fixes, new features, documentation improvements, new commands, and new agents. Refer to the [CONTRIBUTING.md](CONTRIBUTING.md) for detailed instructions.

### Coding Standards

**General Principles**:
*   Follow the project's core beliefs (simplicity, clear intent, pragmatic solutions).
*   Ensure single responsibility per function/class.
*   Avoid premature abstractions and clever tricks.
*   Maintain backward compatibility.
*   Make incremental progress with small, testable changes.
*   Learn from existing code and follow existing style/patterns.

**Specific Standards**:
*   **Bash Script Standards**: Use `set -euo pipefail`, function definitions, and a `main` function structure.
*   **JSON Standards**: Use 2-space indentation, validate syntax, and include all required fields.
*   **Markdown Standards**: Use clear headings, bullet points, code blocks, and proper emphasis.
*   **File Organization**: Follow the established directory structure for agents, commands, skills, and workflows within `.claude/`.

### Testing Guidelines

*   **Manual Testing**: Test happy paths, error handling, and edge cases.
*   **Integration Testing**: Verify how your changes interact with existing commands and workflows.
*   **Testing Checklist**: Ensure commands execute without errors, error messages are clear, session state is preserved, and documentation is accurate.

### Submitting Changes

*   **Commit Message Guidelines**: Follow the Conventional Commits specification (e.g., `feat(workflow): add new command`).
*   **Pull Request Process**: Create a pull request on GitHub, fill out the PR template, link related issues, and address review comments.

---

## 5. Project Structure

The project follows a modular and organized structure to manage agents, commands, skills, and workflows effectively.

```
.
├── .claude/                    # Internal Claude configurations, agents, commands, skills, and workflows
│   ├── agents/                 # Definitions and roles of AI agents
│   ├── commands/               # Implementations of CCW slash commands
│   ├── scripts/                # Utility scripts for various tasks
│   ├── skills/                 # Modular, reusable AI capabilities (e.g., command-guide)
│   ├── templates/              # Generic templates for different workflows
│   └── workflows/              # Workflow definitions, strategies, and related documentation
├── .git/                       # Git repository data
├── .gemini/                    # Gemini CLI tool configurations
├── .codex/                     # Codex CLI tool configurations
├── ARCHITECTURE.md             # High-level system architecture overview
├── CHANGELOG.md                # Detailed history of project changes and releases
├── CLAUDE.md                   # Core development guidelines and philosophical principles
├── COMMAND_REFERENCE.md        # Comprehensive reference for all CCW commands
├── COMMAND_SPEC.md             # Detailed technical specifications for each command
├── CONTRIBUTING.md             # Guidelines for contributing to the project
├── GETTING_STARTED.md          # Quick start guide for new users
├── INSTALL.md                  # Instructions for installing CCW
├── LICENSE                     # Project's open-source license information
├── README.md                   # This overview documentation file
└── WORKFLOW_DIAGRAMS.md        # Visual diagrams illustrating CCW workflows and architecture
```

---

## 6. Navigation

This section provides links to more detailed documentation for various aspects of Claude Code Workflow.

### 📖 Documentation

*   [**Getting Started Guide**](GETTING_STARTED.md) - A 5-minute quick start tutorial for new users.
*   [**Installation Guide**](INSTALL.md) - Detailed instructions on how to install CCW.
*   [**Command Reference**](COMMAND_REFERENCE.md) - A complete list of all available CCW commands with brief descriptions.
*   [**Command Specification**](COMMAND_SPEC.md) - Detailed technical specifications for every command.
*   [**Architecture Overview**](ARCHITECTURE.md) - An in-depth look at the system's design and core components.
*   [**Workflow Decision Guide**](WORKFLOW_DECISION_GUIDE.md) - An interactive flowchart to help choose the right commands and workflows.
*   [**Changelog**](CHANGELOG.md) - A history of all notable changes and releases.
*   [**Contributing Guide**](CONTRIBUTING.md) - Guidelines and instructions for contributing to the project.
*   [**Examples**](EXAMPLES.md) - Real-world use cases and practical examples of CCW in action.
*   [**FAQ**](FAQ.md) - Frequently asked questions and troubleshooting tips.
*   [**Workflow Diagrams**](WORKFLOW_DIAGRAMS.md) - Visual representations of CCW's various workflows.
*   [**Development Guidelines**](CLAUDE.md) - Core development principles and coding standards.

### 💡 Need Help? Use the Interactive Command Guide

CCW includes a built-in **command-guide skill** to help you discover and use commands effectively:
*   **`CCW-help`**: Get interactive help and command recommendations.
*   **`CCW-issue`**: Report bugs or request features with guided templates.

**Example Usage**:
```
User: "CCW-help"
→ Interactive menu with command search, recommendations, and documentation

User: "What's next after /workflow:plan?"
→ Recommends /workflow:execute, /workflow:action-plan-verify, with workflow patterns

User: "CCW-issue"
→ Guided template generation for bugs, features, or questions
```

---

## 🤝 Contributing & Support

*   **Repository**: [GitHub - Claude-Code-Workflow](https://github.com/catlog22/Claude-Code-Workflow)
*   **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues).
*   **Discussions**: Join the [Community Forum](https://github.com/catlog22/Claude-Code-Workflow/discussions).
*   **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.