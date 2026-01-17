# Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v6.3.33-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![npm](https://img.shields.io/npm/v/claude-code-workflow.svg)](https://www.npmjs.com/package/claude-code-workflow)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**[English](README.md) | [中文](README_CN.md)**

</div>

---

**CCW** is a JSON-driven multi-agent development framework with intelligent CLI orchestration. It provides **4-level workflow system** from rapid execution to full brainstorming, transforming AI development into powerful orchestration.

## Key Features

| Feature | Description |
|---------|-------------|
| **4-Level Workflows** | From `lite-lite-lite` (instant) to `brainstorm` (multi-role analysis) |
| **Multi-CLI Orchestration** | Gemini, Qwen, Codex, Claude - auto-select or manual |
| **Dependency-Aware Parallelism** | Agent parallel execution without worktree complexity |
| **Issue Workflow** | Post-development maintenance with optional worktree isolation |
| **JSON-First State** | `.task/IMPL-*.json` as single source of truth |
| **Dashboard** | Visual session management, CodexLens search, graph explorer |

> 📖 **New?** See [Workflow Guide](WORKFLOW_GUIDE.md) for the complete 4-level workflow system.

---

## Quick Start

### Install

```bash
npm install -g claude-code-workflow
ccw install -m Global
```

### Choose Your Workflow Level

| Level | Command | Use Case |
|-------|---------|----------|
| **1** | `/workflow:lite-lite-lite` | Quick fixes, config changes |
| **2** | `/workflow:lite-plan` | Clear single-module features |
| **2** | `/workflow:lite-fix` | Bug diagnosis and fix |
| **2** | `/workflow:multi-cli-plan` | Multi-perspective analysis |
| **3** | `/workflow:plan` | Multi-module development |
| **3** | `/workflow:tdd-plan` | Test-driven development |
| **4** | `/workflow:brainstorm:auto-parallel` | New features, architecture design |

### Example Workflows

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

## CLI Tool

```bash
ccw install           # Install workflow files
ccw view              # Open dashboard
ccw cli -p "..."      # Execute CLI tools (Gemini/Qwen/Codex)
ccw upgrade -a        # Upgrade all installations
```

### Dashboard Features

- **Session Overview** - Track workflow sessions and progress
- **CodexLens** - FTS + Semantic + Hybrid code search
- **Graph Explorer** - Interactive code relationship visualization
- **CLI Manager** - Execution history with session resume

---

## Documentation

| Document | Description |
|----------|-------------|
| [**Workflow Guide**](WORKFLOW_GUIDE.md) | 4-level workflow system (recommended) |
| [**Getting Started**](GETTING_STARTED.md) | 5-minute quick start |
| [**Dashboard Guide**](DASHBOARD_GUIDE.md) | Dashboard user guide |
| [**FAQ**](FAQ.md) | Common questions |
| [**Changelog**](CHANGELOG.md) | Version history |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Main Workflow (4 Levels)                    │
│  Level 1: lite-lite-lite (instant, no artifacts)                │
│  Level 2: lite-plan / lite-fix / multi-cli-plan (→ lite-execute)│
│  Level 3: plan / tdd-plan / test-fix-gen (session persistence)  │
│  Level 4: brainstorm:auto-parallel → plan → execute             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Issue Workflow (Supplement)                 │
│  discover → plan → queue → execute (worktree isolation)         │
└─────────────────────────────────────────────────────────────────┘
```

**Core Principles:**
- **Dependency Analysis** solves parallelism - no worktree needed for main workflow
- **Issue Workflow** supplements main workflow for post-development maintenance
- Select workflow level based on complexity - avoid over-engineering

---

## Contributing

- **Repository**: [GitHub](https://github.com/catlog22/Claude-Code-Workflow)
- **Issues**: [Report bugs or request features](https://github.com/catlog22/Claude-Code-Workflow/issues)
- **Contributing**: See [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT License - see [LICENSE](LICENSE)
