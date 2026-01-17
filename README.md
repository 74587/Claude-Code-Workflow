# Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v6.3.33-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![npm](https://img.shields.io/npm/v/claude-code-workflow.svg)](https://www.npmjs.com/package/claude-code-workflow)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**[English](README.md) | [中文](README_CN.md)**

</div>

---

**CCW** is a JSON-driven multi-agent development framework with intelligent CLI orchestration. It provides **4-level workflow system** from rapid execution to full brainstorming, transforming AI development into powerful orchestration.

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| 🎯 **4-Level Workflows** | From `lite-lite-lite` (instant) to `brainstorm` (multi-role analysis) |
| 🔄 **Multi-CLI Orchestration** | Gemini, Qwen, Codex, Claude - auto-select or manual |
| ⚡ **Dependency-Aware Parallelism** | Agent parallel execution without worktree complexity |
| 🔧 **Issue Workflow** | Post-development maintenance with optional worktree isolation |
| 📦 **JSON-First State** | `.task/IMPL-*.json` as single source of truth |
| 🖥️ **Dashboard** | Visual session management, CodexLens search, graph explorer |

> 📖 **New?** See [Workflow Guide](WORKFLOW_GUIDE.md) for the complete 4-level workflow system.

---

## 🚀 Quick Start

### Install CCW

```bash
npm install -g claude-code-workflow
ccw install -m Global
```

### Choose Your Workflow Level

| Level | Command | Use Case |
|-------|---------|----------|
| ⚡ **1** | `/workflow:lite-lite-lite` | Quick fixes, config changes |
| 📝 **2** | `/workflow:lite-plan` | Clear single-module features |
| 🔧 **2** | `/workflow:lite-fix` | Bug diagnosis and fix |
| 🔍 **2** | `/workflow:multi-cli-plan` | Multi-perspective analysis |
| 📊 **3** | `/workflow:plan` | Multi-module development |
| 🧪 **3** | `/workflow:tdd-plan` | Test-driven development |
| 🧠 **4** | `/workflow:brainstorm:auto-parallel` | New features, architecture design |

### Workflow Examples

```bash
# Level 1: Instant execution
/workflow:lite-lite-lite "Fix typo in README"

# Level 2: Lightweight planning
/workflow:lite-plan "Add JWT authentication"
/workflow:lite-fix "User upload fails with 413 error"

# Level 3: Standard planning with session
/workflow:plan "Implement payment gateway integration"
/workflow:execute

# Level 4: Multi-role brainstorming
/workflow:brainstorm:auto-parallel "Design real-time collaboration system" --count 5
/workflow:plan --session WFS-xxx
/workflow:execute
```

---

## 🛠️ CLI Tool Installation

CCW supports multiple CLI tools for code analysis and generation. Install as needed:

### 🔷 Gemini CLI

Google's official Gemini CLI:

```bash
# Install
npm install -g @anthropic-ai/gemini-cli

# Configure API Key
export GEMINI_API_KEY="your-api-key"

# Verify
gemini --version
```

### 🟢 Codex CLI

OpenAI Codex CLI (recommended for long autonomous coding):

```bash
# Install
npm install -g @openai/codex

# Configure API Key
export OPENAI_API_KEY="your-api-key"

# Verify
codex --version
```

### 🟠 OpenCode CLI

Open-source multi-model CLI:

```bash
# Install
npm install -g opencode-ai

# Configure (supports multiple models)
export OPENCODE_API_KEY="your-api-key"

# Verify
opencode --version
```

### 🟣 Qwen CLI

Alibaba Cloud Qwen CLI:

```bash
# Install
pip install qwen-cli

# Configure
export QWEN_API_KEY="your-api-key"

# Verify
qwen --version
```

---

## 🎭 Semantic CLI Invocation

Users can **semantically specify CLI tools** in prompts - the system automatically invokes the corresponding CLI for analysis.

### Basic Invocation

| User Prompt | System Action |
|-------------|---------------|
| "Use Gemini to analyze the auth module" | Auto-invoke `gemini` CLI for analysis |
| "Let Codex review this code" | Auto-invoke `codex` CLI for review |
| "Ask Qwen about performance optimization" | Auto-invoke `qwen` CLI for consultation |

### Multi-CLI Orchestration

Users can semantically orchestrate multiple CLIs in a single prompt:

| Pattern | User Prompt Example |
|---------|---------------------|
| 🔄 **Collaborative** | "Use Gemini and Codex to collaboratively analyze security vulnerabilities" |
| ⚡ **Parallel** | "Have Gemini, Codex, and Qwen analyze the architecture in parallel" |
| 🔁 **Iterative** | "Use Gemini to diagnose, then Codex to fix, iterate until resolved" |
| 🔗 **Pipeline** | "Gemini designs the solution, Codex implements, Claude reviews" |

### Examples

```text
# Single CLI invocation
User: "Use Gemini to analyze the database query performance"
→ System auto-calls: gemini CLI with analysis task

# Collaborative analysis
User: "Use Gemini and Codex to collaboratively review the authentication flow"
→ System auto-calls: gemini + codex CLIs, synthesizes results

# Parallel multi-perspective
User: "Have all available CLIs analyze this architecture design in parallel"
→ System auto-calls: gemini, codex, qwen in parallel → merged report

# Sequential pipeline
User: "Use Gemini to plan the refactoring, then Codex to implement it"
→ System auto-calls: gemini (plan) → codex (implement) sequentially
```

> 💡 **Key**: Just describe which CLI to use and what to do - CCW handles the invocation automatically.

### Custom CLI Registration

Register **any API as a custom CLI** via Dashboard API Settings:

```json
// Example: Register "deepseek" as custom CLI
{
  "tools": {
    "deepseek": {
      "enabled": true,
      "type": "api-endpoint",
      "endpoint": "https://api.deepseek.com/v1/chat",
      "apiKey": "your-api-key"
    }
  }
}
```

After registration, use it semantically:

```text
User: "Use DeepSeek to analyze this algorithm complexity"
→ System auto-calls: deepseek CLI (your custom endpoint)

User: "Let DeepSeek and Gemini compare their analysis results"
→ System auto-calls: deepseek + gemini in parallel
```

> ⚙️ **Dashboard**: `ccw view` → Status → API Settings to manage custom CLIs.

---

## 🔍 ACE Tool Configuration

ACE (Augment Context Engine) provides powerful semantic code search.

| Method | Link |
|--------|------|
| 📘 **Official** | [Augment MCP Documentation](https://docs.augmentcode.com/context-services/mcp/overview) |
| 🔧 **Proxy Version** | [ace-tool (GitHub)](https://github.com/eastxiaodong/ace-tool) |

---

## 📚 CodexLens Local Search

> ⚠️ **In Development**: CodexLens is under iterative optimization. Some features may be unstable.

CodexLens provides local code indexing and search without external APIs:

| Search Mode | Description |
|-------------|-------------|
| 🔤 **FTS** | Full-text search, based on SQLite FTS5 |
| 🧠 **Semantic** | Semantic search, using local embedding models |
| 🔀 **Hybrid** | Hybrid search, combining FTS + Semantic + Reranking |

### Installation

```bash
# Enter codex-lens directory
cd codex-lens

# Install dependencies
pip install -e .

# Initialize index
codexlens index /path/to/project
```

### Dashboard Integration

Open Dashboard via `ccw view`, manage indexes and execute searches in **CodexLens Manager**.

---

## 💻 CCW CLI Commands

```bash
ccw install           # Install workflow files
ccw view              # Open dashboard
ccw cli -p "..."      # Execute CLI tools (Gemini/Qwen/Codex)
ccw upgrade -a        # Upgrade all installations
```

### Dashboard Features

| Feature | Description |
|---------|-------------|
| 📊 **Session Overview** | Track workflow sessions and progress |
| 🔍 **CodexLens** | FTS + Semantic + Hybrid code search |
| 🕸️ **Graph Explorer** | Interactive code relationship visualization |
| 📜 **CLI Manager** | Execution history with session resume |

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| 📘 [**Workflow Guide**](WORKFLOW_GUIDE.md) | 4-level workflow system (recommended) |
| 🚀 [**Getting Started**](GETTING_STARTED.md) | 5-minute quick start |
| 🖥️ [**Dashboard Guide**](DASHBOARD_GUIDE.md) | Dashboard user guide |
| ❓ [**FAQ**](FAQ.md) | Common questions |
| 📝 [**Changelog**](CHANGELOG.md) | Version history |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Main Workflow (4 Levels)                    │
│  ⚡ Level 1: lite-lite-lite (instant, no artifacts)             │
│  📝 Level 2: lite-plan / lite-fix / multi-cli-plan (→ execute)  │
│  📊 Level 3: plan / tdd-plan / test-fix-gen (session persist)   │
│  🧠 Level 4: brainstorm:auto-parallel → plan → execute          │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Issue Workflow (Supplement)                   │
│  🔍 discover → 📋 plan → 📦 queue → ▶️ execute (worktree)        │
└─────────────────────────────────────────────────────────────────┘
```

**Core Principles:**
- ⚡ **Dependency Analysis** solves parallelism - no worktree needed for main workflow
- 🔧 **Issue Workflow** supplements main workflow for post-development maintenance
- 🎯 Select workflow level based on complexity - avoid over-engineering

---

## 🤝 Contributing

- **Repository**: [GitHub](https://github.com/catlog22/Claude-Code-Workflow)
- **Issues**: [Report bugs or request features](https://github.com/catlog22/Claude-Code-Workflow/issues)
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md)

## 📄 License

MIT License - see [LICENSE](LICENSE)
