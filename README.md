# 🚀 Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v3.1.0-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()
[![MCP Tools](https://img.shields.io/badge/🔧_MCP_Tools-Experimental-orange.svg)](https://github.com/modelcontextprotocol)

**Languages:** [English](README.md) | [中文](README_CN.md)

</div>

---

**Claude Code Workflow (CCW)** is a next-generation multi-agent automation framework that orchestrates complex software development tasks through intelligent workflow management and autonomous execution.

> **🎉 Latest: v3.1.0** - TDD Workflow Support with Red-Green-Refactor cycle enforcement. See [CHANGELOG.md](CHANGELOG.md) for details.
>
> **v3.0.0**: Introduced **unified CLI command structure**. The `/cli:*` commands consolidate all tool interactions (Gemini, Qwen, Codex) using a `--tool` flag for selection.

---

## ✨ Key Features

- **🎯 Context-First Architecture**: Pre-defined context gathering eliminates execution uncertainty and error accumulation.
- **🤖 Multi-Agent System**: Specialized agents (`@code-developer`, `@code-review-test-agent`) with tech-stack awareness.
- **🔄 End-to-End Workflow Automation**: From brainstorming to deployment with multi-phase orchestration.
- **📋 JSON-First Task Model**: Structured task definitions with `pre_analysis` steps for deterministic execution.
- **🧪 TDD Workflow Support**: Complete Test-Driven Development with Red-Green-Refactor cycle enforcement.
- **🧠 Multi-Model Orchestration**: Leverages Gemini (analysis), Qwen (architecture), and Codex (implementation) strengths.
- **✅ Pre-execution Verification**: Validates plans with both strategic (Gemini) and technical (Codex) analysis.
- **🔧 Unified CLI**: A single, powerful `/cli:*` command set for interacting with various AI tools.
- **📦 Smart Context Package**: `context-package.json` links tasks to relevant codebase files and external examples.

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

## 🚀 Getting Started

### Complete Development Workflow

**Phase 1: Brainstorming & Conceptual Planning**
```bash
# Multi-perspective brainstorming with role-based agents
/workflow:brainstorm:auto-parallel "Build a user authentication system"

# Review and refine specific aspects (optional)
/workflow:brainstorm:ui-designer "authentication flows"
/workflow:brainstorm:synthesis  # Generate consolidated specification
```

**Phase 2: Action Planning**
```bash
# Create executable implementation plan
/workflow:plan "Implement JWT-based authentication system"

# OR for TDD approach
/workflow:tdd-plan "Implement authentication with test-first development"
```

**Phase 3: Execution**
```bash
# Execute tasks with AI agents
/workflow:execute

# Monitor progress
/workflow:status
```

**Phase 4: Testing & Quality Assurance**
```bash
# Generate comprehensive test suite (standard workflow)
/workflow:test-gen
/workflow:execute

# OR verify TDD compliance (TDD workflow)
/workflow:tdd-verify

# Final quality review
/workflow:review
```

### Quick Start for Simple Tasks

**Feature Development:**
```bash
/workflow:session:start "Add password reset feature"
/workflow:plan "Email-based password reset with token expiry"
/workflow:execute
```

**Bug Fixing:**
```bash
# Interactive analysis with CLI tools
/cli:mode:bug-index --tool gemini "Login timeout on mobile devices"

# Execute the suggested fix
/workflow:execute
```

**Code Analysis:**
```bash
# Deep codebase analysis
/cli:mode:code-analysis --tool qwen "Analyze authentication module architecture"
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
| `/workflow:tdd-plan` | Create a Test-Driven Development workflow with Red-Green-Refactor cycles. |
| `/workflow:execute` | Execute the current workflow plan autonomously. |
| `/workflow:status` | Display the current status of the workflow. |
| `/workflow:test-gen` | Automatically generate a test plan from the implementation. |
| `/workflow:tdd-verify` | Verify TDD compliance and generate quality report. |
| `/workflow:review` | Initiate a quality assurance review of the completed work. |

### **Task & Memory Commands**

| Command | Description |
|---|---|
| `/task:*` | Manage individual tasks (`create`, `breakdown`, `execute`, `replan`). |
| `/update-memory-full` | Re-index the entire project documentation. |
| `/update-memory-related` | Update documentation related to recent changes. |

---

## ⚙️ Configuration

### **Essential: Gemini CLI Setup**

Configure Gemini CLI for optimal integration:

```json
// ~/.gemini/settings.json
{
  "contextFileName": "CLAUDE.md"
}
```

### **Recommended: .geminiignore**

Optimize performance by excluding unnecessary files:

```bash
# .geminiignore (in project root)
/dist/
/build/
/node_modules/
/.next/
*.tmp
*.log
/temp/

# Include important docs
!README.md
!**/CLAUDE.md
```

### **Optional: MCP Tools** *(Enhanced Analysis)*

MCP (Model Context Protocol) tools provide advanced codebase analysis. **Completely optional** - CCW works perfectly without them.

#### Available MCP Servers

| MCP Server | Purpose | Installation Guide |
|------------|---------|-------------------|
| **Exa MCP** | External API patterns & best practices | [Install Guide](https://github.com/exa-labs/exa-mcp-server) |
| **Code Index MCP** | Advanced internal code search | [Install Guide](https://github.com/johnhuang316/code-index-mcp) |

#### Benefits When Enabled
- 📊 **Faster Analysis**: Direct codebase indexing vs manual searching
- 🌐 **External Context**: Real-world API patterns and examples
- 🔍 **Advanced Search**: Pattern matching and similarity detection
- ⚡ **Automatic Fallback**: Uses traditional tools when MCP unavailable

---

## 🧩 How It Works: Design Philosophy

### The Core Problem

Traditional AI coding workflows face a fundamental challenge: **execution uncertainty leads to error accumulation**.

**Example:**
```bash
# Prompt 1: "Develop XX feature"
# Prompt 2: "Review XX architecture in file Y, then develop XX feature"
```

While Prompt 1 might succeed for simple tasks, in complex workflows:
- The AI may examine different files each time
- Small deviations compound across multiple steps
- Final output drifts from the intended goal

> **CCW's Mission**: Solve the "1-to-N" problem — building upon existing codebases with precision, not just "0-to-1" greenfield development.

---

### The CCW Solution: Context-First Architecture

#### 1. **Pre-defined Context Gathering**

Instead of letting agents randomly explore, CCW uses structured context packages:

**`context-package.json`** created during planning:
```json
{
  "metadata": {
    "task_description": "...",
    "tech_stack": {"frontend": [...], "backend": [...]},
    "complexity": "high"
  },
  "assets": [
    {
      "path": "synthesis-specification.md",
      "priority": "critical",
      "sections": ["Backend Module Structure"]
    }
  ],
  "implementation_guidance": {
    "start_with": ["Step 1", "Step 2"],
    "critical_security_items": [...]
  }
}
```

#### 2. **JSON-First Task Model**

Each task includes a `flow_control.pre_analysis` section:

```json
{
  "id": "IMPL-1",
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_architecture",
        "commands": ["Read(architecture.md)", "grep 'auth' src/"],
        "output_to": "arch_context",
        "on_error": "fail"
      }
    ],
    "implementation_approach": {
      "modification_points": ["..."],
      "logic_flow": ["..."]
    },
    "target_files": ["src/auth/index.ts"]
  }
}
```

**Key Innovation**: The `pre_analysis` steps are **executed before implementation**, ensuring agents always have the correct context.

#### 3. **Multi-Phase Orchestration**

CCW workflows are orchestrators that coordinate slash commands:

**Planning Phase** (`/workflow:plan`):
```
Phase 1: session:start       → Create session
Phase 2: context-gather      → Build context-package.json
Phase 3: concept-enhanced    → CLI analysis (Gemini/Qwen)
Phase 4: task-generate       → Generate task JSONs with pre_analysis
```

**Execution Phase** (`/workflow:execute`):
```
For each task:
  1. Execute pre_analysis steps → Load context
  2. Apply implementation_approach → Make changes
  3. Validate acceptance criteria → Verify success
  4. Generate summary → Track progress
```

#### 4. **Multi-Model Orchestration**

Each AI model serves its strength:

| Model | Role | Use Cases |
|-------|------|-----------|
| **Gemini** | Analysis & Understanding | Long-context analysis, architecture review, bug investigation |
| **Qwen** | Architecture & Design | System design, code generation, architectural planning |
| **Codex** | Implementation | Feature development, testing, autonomous execution |

**Example:**
```bash
# Gemini analyzes the problem space
/cli:mode:code-analysis --tool gemini "Analyze auth module"

# Qwen designs the solution
/cli:analyze --tool qwen "Design scalable auth architecture"

# Codex implements the code
/workflow:execute  # Uses @code-developer with Codex
```

---

### From 0-to-1 vs 1-to-N Development

| Scenario | Traditional Workflow | CCW Approach |
|----------|---------------------|--------------|
| **Greenfield (0→1)** | ✅ Works well | ✅ Adds structured planning |
| **Feature Addition (1→2)** | ⚠️ Context uncertainty | ✅ Context-package links to existing code |
| **Bug Fixing (N→N+1)** | ⚠️ May miss related code | ✅ Pre-analysis finds dependencies |
| **Refactoring** | ⚠️ Unpredictable scope | ✅ CLI analysis + structured tasks |

---

### Key Workflows

#### **Complete Development (Brainstorm → Deploy)**
```
Brainstorm (8 roles) → Synthesis → Plan (4 phases) → Execute → Test → Review
```

#### **Quick Feature Development**
```
session:start → plan → execute → test-gen → execute
```

#### **TDD Workflow**
```
tdd-plan (TEST→IMPL→REFACTOR chains) → execute → tdd-verify
```

#### **Bug Fixing**
```
cli:mode:bug-index (analyze) → execute (fix) → test-gen (verify)
```

---

## 🤝 Contributing & Support

- **Repository**: [GitHub - Claude-Code-Workflow](https://github.com/catlog22/Claude-Code-Workflow)
- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/catlog22/Claude-Code-Workflow/issues).
- **Discussions**: Join the [Community Forum](https://github.com/catlog22/Claude-Code-Workflow/discussions).

## 📄 License

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for details.
