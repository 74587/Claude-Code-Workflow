<div align="center">
new line
new line

<!-- Animated Header -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=180&section=header&text=Claude%20Code%20Workflow&fontSize=42&fontColor=fff&animation=twinkling&fontAlignY=32&desc=Multi-Agent%20AI%20Development%20Framework&descAlignY=52&descSize=18"/>

<!-- Badges -->
<p>
  <a href="https://github.com/catlog22/Claude-Code-Workflow/releases"><img src="https://img.shields.io/badge/version-v7.0.0-6366F1?style=flat-square" alt="Version"/></a>
  <a href="https://www.npmjs.com/package/claude-code-workflow"><img src="https://img.shields.io/npm/v/claude-code-workflow?style=flat-square&color=cb3837" alt="npm"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-10B981?style=flat-square" alt="License"/></a>
  <a href="https://github.com/catlog22/Claude-Code-Workflow/stargazers"><img src="https://img.shields.io/github/stars/catlog22/Claude-Code-Workflow?style=flat-square&color=F59E0B" alt="Stars"/></a>
  <a href="https://github.com/catlog22/Claude-Code-Workflow/issues"><img src="https://img.shields.io/github/issues/catlog22/Claude-Code-Workflow?style=flat-square&color=EF4444" alt="Issues"/></a>
</p>

**[English](README.md) | [中文](README_CN.md)**

<br/>

<!-- Typing Animation -->
<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&color=6366F1&center=true&vCenter=true&random=false&width=600&lines=JSON-Driven+Multi-Agent+Framework;4-Level+Workflow+System;Semantic+CLI+Orchestration;Gemini+%7C+Codex+%7C+OpenCode+%7C+Qwen+%7C+Claude" alt="Typing SVG" /></a>

</div>

<br/>

<!-- Quick Links -->
<div align="center">
  <a href="#-quick-start"><img src="https://img.shields.io/badge/🚀_Quick_Start-4285F4?style=flat-square" alt="Quick Start"/></a>
  <a href="WORKFLOW_GUIDE.md"><img src="https://img.shields.io/badge/📖_Workflow_Guide-34A853?style=flat-square" alt="Guide"/></a>
  <a href="#-cli-tool-installation"><img src="https://img.shields.io/badge/🛠️_CLI_Tools-EA4335?style=flat-square" alt="CLI Tools"/></a>
  <a href="#-architecture"><img src="https://img.shields.io/badge/🏗️_Architecture-FBBC05?style=flat-square" alt="Architecture"/></a>
</div>

<br/>

---

## ✨ Key Features

<div align="center">
<table>
<tr>
<td width="50%">

### 🎯 4-Level Workflows
From `lite-lite-lite` (instant) to `brainstorm` (multi-role analysis)

### 🔄 Multi-CLI Orchestration
Gemini, Qwen, Codex, Claude - auto-select or manual

### ⚡ Team Architecture v2
Role-based agents with inner loop execution

### 🔧 Queue Scheduler
Background queue execution service

</td>
<td width="50%">

### 📦 Workflow Session Commands
start/resume/complete/sync sessions

### 🖥️ Terminal Dashboard
Multi-terminal grid with execution monitor

### 🎨 Orchestrator Editor
Template-based workflow visual editing

### 💬 A2UI
Agent-to-User interactive interface

</td>
</tr>
</table>
</div>

> 📖 **New?** See [Workflow Guide](WORKFLOW_GUIDE.md) for the complete 4-level workflow system.

---

## 🚀 Quick Start

### Install CCW

```bash
npm install -g claude-code-workflow
ccw install -m Global
```

> **Troubleshooting**: If you see `NODE_MODULE_VERSION` mismatch errors for `better-sqlite3`, run `npm rebuild better-sqlite3`. See [FAQ - Troubleshooting](FAQ.md#better-sqlite3-node_module_version-mismatch) for details.

### Choose Your Workflow Level

<div align="center">
<table>
<tr><th>Level</th><th>Command</th><th>Use Case</th></tr>
<tr><td><b>1</b></td><td><code>/workflow:lite-lite-lite</code></td><td>Quick fixes, config changes</td></tr>
<tr><td><b>2</b></td><td><code>/workflow:lite-plan</code></td><td>Clear single-module features</td></tr>
<tr><td><b>2</b></td><td><code>/workflow:lite-fix</code></td><td>Bug diagnosis and fix</td></tr>
<tr><td><b>2</b></td><td><code>/workflow:multi-cli-plan</code></td><td>Multi-perspective analysis</td></tr>
<tr><td><b>3</b></td><td><code>/workflow:plan</code></td><td>Multi-module development</td></tr>
<tr><td><b>3</b></td><td><code>/workflow:tdd-plan</code></td><td>Test-driven development</td></tr>
<tr><td><b>4</b></td><td><code>/workflow:brainstorm:auto-parallel</code></td><td>New features, architecture design</td></tr>
</table>
</div>

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

<div align="center">
<table>
<tr><th>CLI</th><th>Description</th><th>Official Docs</th></tr>
<tr><td><b>Gemini</b></td><td>Google AI analysis</td><td><a href="https://github.com/google-gemini/gemini-cli">google-gemini/gemini-cli</a></td></tr>
<tr><td><b>Codex</b></td><td>OpenAI autonomous coding</td><td><a href="https://github.com/openai/codex">openai/codex</a></td></tr>
<tr><td><b>OpenCode</b></td><td>Open-source multi-model</td><td><a href="https://github.com/opencode-ai/opencode">opencode-ai/opencode</a></td></tr>
<tr><td><b>Qwen</b></td><td>Alibaba Qwen-Code</td><td><a href="https://github.com/QwenLM">QwenLM/Qwen</a></td></tr>
</table>
</div>

---

## 🎭 Semantic CLI Invocation

<div align="center">
<img src="https://img.shields.io/badge/Just_Describe-What_You_Want-6366F1?style=flat-square"/>
<img src="https://img.shields.io/badge/CCW_Handles-The_Rest-10B981?style=flat-square"/>
</div>

<br/>

Users can **semantically specify CLI tools** in prompts - the system automatically invokes the corresponding CLI.

### Basic Invocation

<div align="center">

| User Prompt | System Action |
|-------------|---------------|
| "Use Gemini to analyze the auth module" | Auto-invoke `gemini` CLI for analysis |
| "Let Codex review this code" | Auto-invoke `codex` CLI for review |
| "Ask Qwen about performance optimization" | Auto-invoke `qwen` CLI for consultation |

</div>

### Multi-CLI Orchestration

<div align="center">

| Pattern | User Prompt Example |
|---------|---------------------|
| **Collaborative** | "Use Gemini and Codex to collaboratively analyze security vulnerabilities" |
| **Parallel** | "Have Gemini, Codex, and Qwen analyze the architecture in parallel" |
| **Iterative** | "Use Gemini to diagnose, then Codex to fix, iterate until resolved" |
| **Pipeline** | "Gemini designs the solution, Codex implements, Claude reviews" |

</div>

<details>
<summary><b>📝 More Examples</b></summary>

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

</details>

### Custom CLI Registration

Register **any API as a custom CLI** via Dashboard interface:

```bash
ccw view  # Open Dashboard → Status → API Settings → Add Custom CLI
```

<div align="center">

| Field | Example |
|-------|---------|
| **Name** | `deepseek` |
| **Endpoint** | `https://api.deepseek.com/v1/chat` |
| **API Key** | `your-api-key` |

</div>

> ⚙️ Register once, invoke semantically forever - no code changes needed.

---

## 🔍 ACE Tool Configuration

ACE (Augment Context Engine) provides powerful semantic code search.

<div align="center">

| Method | Link |
|--------|------|
| **Official** | [Augment MCP Documentation](https://docs.augmentcode.com/context-services/mcp/overview) |
| **Proxy** | [ace-tool (GitHub)](https://github.com/eastxiaodong/ace-tool) |

</div>

---

## 📚 CodexLens Local Search

> ⚠️ **In Development**: CodexLens is under iterative optimization. Some features may be unstable.

<div align="center">
<table>
<tr><th>Search Mode</th><th>Description</th></tr>
<tr><td><b>FTS</b></td><td>Full-text search, based on SQLite FTS5</td></tr>
<tr><td><b>Semantic</b></td><td>Semantic search, using local embedding models</td></tr>
<tr><td><b>Hybrid</b></td><td>Hybrid search, combining FTS + Semantic + Reranking</td></tr>
</table>
</div>

<details>
<summary><b>📦 Installation</b></summary>

```bash
# Enter codex-lens directory
cd codex-lens

# Install dependencies
pip install -e .

# Initialize index
codexlens index /path/to/project
```

Open Dashboard via `ccw view`, manage indexes and execute searches in **CodexLens Manager**.

</details>

---

## 💻 CCW CLI Commands

### 🌟 Recommended Commands (Main Features)

<div align="center">
<table>
<tr><th>Command</th><th>Description</th><th>When to Use</th></tr>
<tr>
  <td><b>/ccw</b></td>
  <td>Auto workflow orchestrator - analyzes intent, selects workflow level, executes command chain in main process</td>
  <td>✅ General tasks, auto workflow selection, quick development</td>
</tr>
<tr>
  <td><b>/ccw-coordinator</b></td>
  <td>Smart orchestrator - intelligently recommends command chains, allows manual adjustment, executes via external CLI with state persistence</td>
  <td>🔧 Complex multi-step workflows, customizable chains, resumable sessions</td>
</tr>
</table>
</div>

**Quick Examples**:

```bash
# /ccw - Auto workflow selection (Main Process)
/ccw "Add user authentication"              # Auto-selects workflow based on intent
/ccw "Fix memory leak in WebSocket"         # Detects bugfix workflow
/ccw "Implement with TDD"                   # Routes to TDD workflow

# /ccw-coordinator - Manual chain orchestration (External CLI)
/ccw-coordinator "Implement OAuth2 system"  # Analyzes → Recommends chain → User confirms → Executes
```

**Key Differences**:

| Aspect | /ccw | /ccw-coordinator |
|--------|------|------------------|
| **Execution** | Main process (SlashCommand) | External CLI (background tasks) |
| **Selection** | Auto intent-based | Smart recommendation + optional adjustment |
| **State** | TodoWrite tracking | Persistent state.json |
| **Use Case** | General tasks, quick dev | Complex chains, resumable |

---

### Other CLI Commands

```bash
ccw install           # Install workflow files
ccw view              # Open dashboard
ccw cli -p "..."      # Execute CLI tools (Gemini/Qwen/Codex)
ccw upgrade -a        # Upgrade all installations
```

### Dashboard Features

<div align="center">
<table>
<tr><th>Feature</th><th>Description</th></tr>
<tr><td><b>Session Overview</b></td><td>Track workflow sessions and progress</td></tr>
<tr><td><b>CodexLens</b></td><td>FTS + Semantic + Hybrid code search</td></tr>
<tr><td><b>Graph Explorer</b></td><td>Interactive code relationship visualization</td></tr>
<tr><td><b>CLI Manager</b></td><td>Execution history with session resume</td></tr>
</table>
</div>

---

## 📖 Documentation

<div align="center">

| Document | Description |
|----------|-------------|
| [**Workflow Guide**](WORKFLOW_GUIDE.md) | 4-level workflow system (recommended) |
| [**Getting Started**](GETTING_STARTED.md) | 5-minute quick start |
| [**Dashboard Guide**](DASHBOARD_GUIDE.md) | Dashboard user guide |
| [**FAQ**](FAQ.md) | Common questions |
| [**Changelog**](CHANGELOG.md) | Version history |

</div>

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
│                   Team Architecture v2                          │
│  🤖 team-worker agents with role-spec based execution           │
│  🔄 Inner loop framework for sequential task processing         │
│  📢 Message bus protocol with team coordination                 │
│  🧠 Wisdom accumulation (learnings/decisions/conventions)       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Queue Scheduler Service                       │
│  ⚙️ Background execution service with API endpoints             │
│  📊 Queue management and unified CLI execution settings         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                   Terminal Dashboard & Orchestrator             │
│  🖥️ Multi-terminal grid with execution monitor                  │
│  🎨 Template-based workflow editor with slash commands          │
│  📡 Real-time agent communication via A2UI                      │
└─────────────────────────────────────────────────────────────────┘
```

**Core Principles:**
- ⚡ **Dependency Analysis** solves parallelism - no worktree needed for main workflow
- 🤖 **Team Architecture v2** provides unified role-based agent execution with inner loop
- 🔧 **Queue Scheduler** handles background task execution with unified settings
- 🖥️ **Terminal Dashboard** provides real-time monitoring and control
- 🎯 Select workflow level based on complexity - avoid over-engineering

---

## 🎼 Team Cadence Control (Beat Model)

The v2 team architecture introduces an **event-driven beat model** for efficient orchestration:

```
Beat Cycle (single beat)
======================================================================
  Event                   Coordinator              Workers
----------------------------------------------------------------------
  callback/resume --> +- handleCallback -+
                      |  mark completed   |
                      |  check pipeline   |
                      +- handleSpawnNext -+
                      |  find ready tasks |
                      |  spawn workers ---+--> [team-worker A] Phase 1-5
                      |  (parallel OK)  --+--> [team-worker B] Phase 1-5
                      +- STOP (idle) -----+         |
                                                     |
  callback <-----------------------------------------+
  (next beat)              SendMessage + TaskUpdate(completed)
======================================================================

  Fast-Advance (skips coordinator for simple linear successors)
======================================================================
  [Worker A] Phase 5 complete
    +- 1 ready task? simple successor? --> spawn team-worker B directly
    +- complex case? --> SendMessage to coordinator
======================================================================
```

**Key Benefits:**
- 🎯 **Event-driven**: Coordinator only wakes when needed (callback/resume)
- ⚡ **Fast-advance**: Simple successors spawn directly without coordinator roundtrip
- 🔄 **Dynamic pipelines**: Generated per-task from dependency graph
- 📊 **Parallel execution**: Independent tasks run concurrently

---

## 🖥️ Frontend Highlights

### Terminal Dashboard

Multi-terminal grid layout with real-time execution monitoring:

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard Toolbar                    [Issues][Queue][Inspector]│
├──────────┬──────────────────────────────────────────────────────┤
│ Session  │  Terminal Grid (tmux-style split panes)              │
│ Groups   │  ┌─────────────────┬─────────────────────────────────┐│
│ ├─ proj1 │  │ Terminal 1      │ Terminal 2                      ││
│ │  └─ cla│  │ $ ccw cli ...   │ $ gemini analyze ...            ││
│ ├─ proj2 │  │                 │                                 ││
│ └─ ...   │  └─────────────────┴─────────────────────────────────┘│
│          │  Execution Monitor Panel (floating)                   │
└──────────┴──────────────────────────────────────────────────────┘
```

**Features:**
- 🖥️ Multi-terminal grid with resizable panes
- 📊 Execution monitor with agent list
- 📁 File sidebar for project navigation
- 🎯 Session grouping by project tags
- 🌙 Fullscreen/immersive mode

### Orchestrator Editor

Visual workflow template editor with drag-drop:

```
┌─────────────────────────────────────────────────────────────────┐
│  FlowToolbar                              [Templates][Execute]  │
├────────────┬────────────────────────────────────────┬───────────┤
│ Node       │          Flow Canvas                   │ Property  │
│ Palette    │  ┌──────────┐     ┌──────────┐        │ Panel     │
│ ├─ Prompt  │  │ Prompt   │────▶│ CLI Tool │        │           │
│ ├─ CLI     │  │ Template │     │ Executor │        │ Edit node │
│ ├─ Slash   │  └──────────┘     └──────────┘        │ props     │
│ └─ Flow    │        │                │              │           │
│            │        ▼                ▼              │           │
│            │  ┌──────────────────────────┐         │           │
│            │  │    Slash Command         │         │           │
│            │  │    /workflow:plan        │         │           │
│            │  └──────────────────────────┘         │           │
└────────────┴────────────────────────────────────────┴───────────┘
```

**Features:**
- 🎨 React Flow-based visual editing
- 📦 Template library with pre-built workflows
- 🔧 Property panel for node configuration
- ⚡ Slash command integration

### Analysis Viewer

Grid layout for analysis sessions with filtering:

```
┌─────────────────────────────────────────────────────────────────┐
│  Filters: [Type ▼] [Status ▼] [Date Range]    [Fullscreen]     │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────────┐ │
│ │ Analysis #1     │ │ Analysis #2     │ │ Analysis #3         │ │
│ │ Type: security  │ │ Type: perf      │ │ Type: architecture  │ │
│ │ Status: ✓ done  │ │ Status: ✓ done  │ │ Status: ⏳ running  │ │
│ └─────────────────┘ └─────────────────┘ └─────────────────────┘ │
│ ┌─────────────────┐ ┌─────────────────┐                        │
│ │ Analysis #4     │ │ Analysis #5     │                        │
│ │ ...             │ │ ...             │                        │
│ └─────────────────┘ └─────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🤝 Contributing

<div align="center">
  <a href="https://github.com/catlog22/Claude-Code-Workflow"><img src="https://img.shields.io/badge/GitHub-Repository-181717?style=flat-square" alt="GitHub"/></a>
  <a href="https://github.com/catlog22/Claude-Code-Workflow/issues"><img src="https://img.shields.io/badge/Issues-Report_Bug-EF4444?style=flat-square" alt="Issues"/></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/Contributing-Guide-10B981?style=flat-square" alt="Contributing"/></a>
</div>

---

## 📄 License

<div align="center">

MIT License - see [LICENSE](LICENSE)

<br/>

<!-- Footer -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer"/>

</div>
