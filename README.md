<div align="center">

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
<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&color=6366F1&center=true&vCenter=true&random=false&width=600&lines=JSON-Driven+Multi-Agent+Framework;Skill-based+Workflow+System;Semantic+CLI+Orchestration;Gemini+%7C+Codex+%7C+OpenCode+%7C+Qwen+%7C+Claude" alt="Typing SVG" /></a>

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

### 🎯 Skill-based Workflows
From `lite-plan` (lightweight) to `brainstorm` (multi-role analysis)

### 🔄 Multi-CLI Orchestration
Gemini, Qwen, Codex, Claude - auto-select or manual

### ⚡ Team Architecture v2
Role-based agents with inner loop execution

### 🔧 Queue Scheduler
Background queue execution service

</td>
<td width="50%">

### 📦 Session Lifecycle
start/resume/complete/sync workflow sessions

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

> 📖 **New?** See [Workflow Guide](WORKFLOW_GUIDE.md) for complete workflow documentation.

---

## 🚀 Quick Start

### Install CCW

```bash
npm install -g claude-code-workflow
ccw install -m Global
```

### Codex Configuration (Required for `.codex/skills/`)

If you use **Codex CLI** with the `.codex/skills/` workflow skills, add these required features to your `~/.codex/config.toml`:

```toml
[features]
default_mode_request_user_input = true   # Enable request_user_input tool for interactive confirmations
multi_agent = true                       # Enable multi-agent coordination (spawn_agent, wait, etc.)
enable_fanout = true                     # Enable spawn_agents_on_csv for parallel wave execution
```

> These features are required for workflow skills to function properly. Without them, interactive confirmation gates (`request_user_input`), subagent orchestration, and CSV-driven parallel execution will not work.

### Workflow Skills vs Commands

CCW uses two types of invocations:

| Type | Format | Examples |
|------|--------|----------|
| **Skills** | Trigger phrase (no slash) | `workflow-lite-plan`, `brainstorm`, `workflow-plan` |
| **Commands** | Slash command | `/ccw`, `/workflow/session:start`, `/issue/new` |

### Choose Your Workflow Skill

<div align="center">
<table>
<tr><th>Skill Trigger</th><th>Use Case</th></tr>
<tr><td><code>workflow-lite-plan</code></td><td>Lightweight planning, single-module features (hands off to lite-execute)</td></tr>
<tr><td><code>workflow-multi-cli-plan</code></td><td>Multi-CLI collaborative analysis</td></tr>
<tr><td><code>workflow-plan</code></td><td>Full planning with session persistence</td></tr>
<tr><td><code>workflow-tdd-plan</code></td><td>Test-driven development</td></tr>
<tr><td><code>workflow-test-fix</code></td><td>Test generation and fix cycles</td></tr>
<tr><td><code>brainstorm</code></td><td>Multi-role brainstorming analysis</td></tr>
</table>
</div>

### Workflow Examples

```bash
# Skill triggers (no slash - just describe what you want)
workflow-lite-plan "Add JWT authentication"
workflow-plan "Implement payment gateway integration"
workflow-execute

# Brainstorming
brainstorm "Design real-time collaboration system"

# Slash commands for session management
/workflow/session:start
/workflow/session:resume
/workflow/session:complete
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

---

## 💻 CCW CLI Commands

### 🌟 Recommended Commands

<div align="center">
<table>
<tr><th>Command</th><th>Description</th><th>When to Use</th></tr>
<tr>
  <td><b>/ccw</b></td>
  <td>Auto workflow orchestrator - analyzes intent, selects workflow, executes</td>
  <td>✅ General tasks, auto workflow selection</td>
</tr>
<tr>
  <td><b>/ccw-coordinator</b></td>
  <td>Smart orchestrator - recommends command chains, allows manual adjustment</td>
  <td>🔧 Complex multi-step workflows</td>
</tr>
</table>
</div>

**Quick Examples**:

```bash
# /ccw - Auto workflow selection
/ccw "Add user authentication"
/ccw "Fix memory leak in WebSocket"
/ccw "Implement with TDD"

# /ccw-coordinator - Manual chain orchestration
/ccw-coordinator "Implement OAuth2 system"
```

### Session Management Commands

```bash
/workflow:session:start     # Start new workflow session
/workflow:session:resume    # Resume paused session
/workflow:session:list      # List all sessions
/workflow:session:sync      # Sync session work
/workflow:session:complete  # Complete session
```

### Issue Workflow Commands

```bash
/issue/new       # Create new issue
/issue/plan      # Plan issue resolution
/issue/queue     # Form execution queue
/issue/execute   # Execute issue queue
```

### Other CLI Commands

```bash
ccw install           # Install workflow files
ccw view              # Open dashboard
ccw cli -p "..."      # Execute CLI tools (Gemini/Qwen/Codex)
ccw upgrade -a        # Upgrade all installations
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Workflow Skills                              │
│  📝 workflow-lite-plan / workflow-multi-cli-plan (lightweight)  │
│  📊 workflow-plan / workflow-tdd-plan (session-based)           │
│  🧪 workflow-test-fix / workflow-test-fix         │
│  🧠 brainstorm (multi-role analysis)                            │
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

---

## 📦 Project Structure

```
Claude-Code-Workflow/
├── .claude/
│   ├── agents/          # 22 specialized agents (team-worker, cli-discuss, etc.)
│   ├── commands/        # Slash commands (5 categories)
│   │   ├── ccw.md       # Main orchestrator
│   │   ├── ccw-coordinator.md
│   │   ├── cli/         # CLI commands (cli-init, codex-review)
│   │   ├── issue/       # Issue management (plan, execute, queue)
│   │   ├── memory/      # Memory commands (prepare, style-skill-memory)
│   │   └── workflow/    # Workflow commands (session, ui-design, etc.)
│   └── skills/          # 37 modular skills
│       ├── workflow-lite-plan/
│       ├── workflow-plan/
│       ├── workflow-tdd-plan/
│       ├── workflow-test-fix/
│       ├── brainstorm/
│       ├── team-*/      # Team coordination skills
│       └── ...
├── ccw/
│   ├── src/             # TypeScript source code
│   │   ├── commands/    # CLI command implementations
│   │   ├── core/        # Core services (a2ui, auth, hooks, routes)
│   │   ├── mcp-server/  # MCP server implementation
│   │   └── tools/       # Tool implementations
│   └── frontend/        # React frontend (Terminal Dashboard, Orchestrator)
├── codex-lens/          # Local semantic code search engine
└── docs/                # Documentation
```

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
```

**Key Benefits:**
- 🎯 **Event-driven**: Coordinator only wakes when needed (callback/resume)
- ⚡ **Fast-advance**: Simple successors spawn directly without coordinator roundtrip
- 🔄 **Dynamic pipelines**: Generated per-task from dependency graph
- 📊 **Parallel execution**: Independent tasks run concurrently

---

## 🖥️ Frontend Highlights

### Terminal Dashboard

Multi-terminal grid layout with real-time execution monitoring.

**Features:**
- 🖥️ Multi-terminal grid with resizable panes
- 📊 Execution monitor with agent list
- 📁 File sidebar for project navigation
- 🎯 Session grouping by project tags
- 🌙 Fullscreen/immersive mode

### Orchestrator Editor

Visual workflow template editor with drag-drop.

**Features:**
- 🎨 React Flow-based visual editing
- 📦 Template library with pre-built workflows
- 🔧 Property panel for node configuration
- ⚡ Slash command integration

---

## 🤝 Contributing

<div align="center">
  <a href="https://github.com/catlog22/Claude-Code-Workflow"><img src="https://img.shields.io/badge/GitHub-Repository-181717?style=flat-square" alt="GitHub"/></a>
  <a href="https://github.com/catlog22/Claude-Code-Workflow/issues"><img src="https://img.shields.io/badge/Issues-Report_Bug-EF4444?style=flat-square" alt="Issues"/></a>
</div>

---

## 📄 License

<div align="center">

MIT License - see [LICENSE](LICENSE)

</div>

---

## 🔗 Links

<div align="center">
  <a href="https://linux.do/"><img src="https://img.shields.io/badge/LINUX_DO-Learn_AI,_Go_L!-6366F1?style=flat-square" alt="LINUX DO"/></a>
</div>

<div align="center">

<br/>

<!-- Footer -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=100&section=footer"/>

</div>
