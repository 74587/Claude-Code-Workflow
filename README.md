<div align="center">

<!-- Animated Header -->
<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=180&section=header&text=Claude%20Code%20Workflow&fontSize=42&fontColor=fff&animation=twinkling&fontAlignY=32&desc=Multi-Agent%20AI%20Development%20Framework&descAlignY=52&descSize=18"/>

<!-- Badges -->
<p>
  <a href="https://github.com/catlog22/Claude-Code-Workflow/releases"><img src="https://img.shields.io/badge/version-v6.3.33-6366F1?style=flat-square" alt="Version"/></a>
  <a href="https://www.npmjs.com/package/claude-code-workflow"><img src="https://img.shields.io/npm/v/claude-code-workflow?style=flat-square&color=cb3837" alt="npm"/></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-10B981?style=flat-square" alt="License"/></a>
  <a href="https://github.com/catlog22/Claude-Code-Workflow/stargazers"><img src="https://img.shields.io/github/stars/catlog22/Claude-Code-Workflow?style=flat-square&color=F59E0B" alt="Stars"/></a>
  <a href="https://github.com/catlog22/Claude-Code-Workflow/issues"><img src="https://img.shields.io/github/issues/catlog22/Claude-Code-Workflow?style=flat-square&color=EF4444" alt="Issues"/></a>
</p>

**[English](README.md) | [中文](README_CN.md)**

<br/>

<!-- Typing Animation -->
<a href="https://git.io/typing-svg"><img src="https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&color=6366F1&center=true&vCenter=true&random=false&width=600&lines=JSON-Driven+Multi-Agent+Framework;4-Level+Workflow+System;Semantic+CLI+Orchestration;Gemini+%7C+Codex+%7C+Qwen+%7C+Claude" alt="Typing SVG" /></a>

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

<table>
<tr>
<td width="50%">

### 🎯 4-Level Workflows
From `lite-lite-lite` (instant) to `brainstorm` (multi-role analysis)

### 🔄 Multi-CLI Orchestration
Gemini, Qwen, Codex, Claude - auto-select or manual

### ⚡ Dependency-Aware Parallelism
Agent parallel execution without worktree complexity

</td>
<td width="50%">

### 🔧 Issue Workflow
Post-development maintenance with optional worktree isolation

### 📦 JSON-First State
`.task/IMPL-*.json` as single source of truth

### 🖥️ Dashboard
Visual session management, CodexLens search, graph explorer

</td>
</tr>
</table>

> 📖 **New?** See [Workflow Guide](WORKFLOW_GUIDE.md) for the complete 4-level workflow system.

---

## 🚀 Quick Start

### Install CCW

```bash
npm install -g claude-code-workflow
ccw install -m Global
```

### Choose Your Workflow Level

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

<table>
<tr><th>CLI</th><th>Description</th><th>Official Docs</th></tr>
<tr><td><b>Gemini</b></td><td>Google AI analysis</td><td><a href="https://github.com/google-gemini/gemini-cli">google-gemini/gemini-cli</a></td></tr>
<tr><td><b>Codex</b></td><td>OpenAI autonomous coding</td><td><a href="https://github.com/openai/codex">openai/codex</a></td></tr>
<tr><td><b>OpenCode</b></td><td>Open-source multi-model</td><td><a href="https://github.com/opencode-ai/opencode">opencode-ai/opencode</a></td></tr>
<tr><td><b>Qwen</b></td><td>Alibaba Qwen-Code</td><td><a href="https://github.com/QwenLM">QwenLM/Qwen</a></td></tr>
</table>

---

## 🎭 Semantic CLI Invocation

<div align="center">
<img src="https://img.shields.io/badge/Just_Describe-What_You_Want-6366F1?style=flat-square"/>
<img src="https://img.shields.io/badge/CCW_Handles-The_Rest-10B981?style=flat-square"/>
</div>

<br/>

Users can **semantically specify CLI tools** in prompts - the system automatically invokes the corresponding CLI.

### Basic Invocation

| User Prompt | System Action |
|-------------|---------------|
| "Use Gemini to analyze the auth module" | Auto-invoke `gemini` CLI for analysis |
| "Let Codex review this code" | Auto-invoke `codex` CLI for review |
| "Ask Qwen about performance optimization" | Auto-invoke `qwen` CLI for consultation |

### Multi-CLI Orchestration

| Pattern | User Prompt Example |
|---------|---------------------|
| **Collaborative** | "Use Gemini and Codex to collaboratively analyze security vulnerabilities" |
| **Parallel** | "Have Gemini, Codex, and Qwen analyze the architecture in parallel" |
| **Iterative** | "Use Gemini to diagnose, then Codex to fix, iterate until resolved" |
| **Pipeline** | "Gemini designs the solution, Codex implements, Claude reviews" |

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

| Field | Example |
|-------|---------|
| **Name** | `deepseek` |
| **Endpoint** | `https://api.deepseek.com/v1/chat` |
| **API Key** | `your-api-key` |

> ⚙️ Register once, invoke semantically forever - no code changes needed.

---

## 🔍 ACE Tool Configuration

ACE (Augment Context Engine) provides powerful semantic code search.

| Method | Link |
|--------|------|
| **Official** | [Augment MCP Documentation](https://docs.augmentcode.com/context-services/mcp/overview) |
| **Proxy** | [ace-tool (GitHub)](https://github.com/eastxiaodong/ace-tool) |

---

## 📚 CodexLens Local Search

> ⚠️ **In Development**: CodexLens is under iterative optimization. Some features may be unstable.

<table>
<tr><th>Search Mode</th><th>Description</th></tr>
<tr><td><b>FTS</b></td><td>Full-text search, based on SQLite FTS5</td></tr>
<tr><td><b>Semantic</b></td><td>Semantic search, using local embedding models</td></tr>
<tr><td><b>Hybrid</b></td><td>Hybrid search, combining FTS + Semantic + Reranking</td></tr>
</table>

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

```bash
ccw install           # Install workflow files
ccw view              # Open dashboard
ccw cli -p "..."      # Execute CLI tools (Gemini/Qwen/Codex)
ccw upgrade -a        # Upgrade all installations
```

### Dashboard Features

<table>
<tr><th>Feature</th><th>Description</th></tr>
<tr><td><b>Session Overview</b></td><td>Track workflow sessions and progress</td></tr>
<tr><td><b>CodexLens</b></td><td>FTS + Semantic + Hybrid code search</td></tr>
<tr><td><b>Graph Explorer</b></td><td>Interactive code relationship visualization</td></tr>
<tr><td><b>CLI Manager</b></td><td>Execution history with session resume</td></tr>
</table>

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [**Workflow Guide**](WORKFLOW_GUIDE.md) | 4-level workflow system (recommended) |
| [**Getting Started**](GETTING_STARTED.md) | 5-minute quick start |
| [**Dashboard Guide**](DASHBOARD_GUIDE.md) | Dashboard user guide |
| [**FAQ**](FAQ.md) | Common questions |
| [**Changelog**](CHANGELOG.md) | Version history |

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
