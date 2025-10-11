# 🚀 Claude Code Workflow (CCW)

<div align="center">

[![Version](https://img.shields.io/badge/version-v4.4.0-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux%20%7C%20macOS-lightgrey.svg)]()
[![MCP Tools](https://img.shields.io/badge/🔧_MCP_Tools-Experimental-orange.svg)](https://github.com/modelcontextprotocol)

**Languages:** [English](README.md) | [中文](README_CN.md)

</div>

---

**Claude Code Workflow (CCW)** is a next-generation multi-agent automation framework that orchestrates complex software development tasks through intelligent workflow management and autonomous execution.

> **🎉 Latest: v4.4.0** - UI Design Workflow V3 with Layout/Style Separation Architecture. See [CHANGELOG.md](CHANGELOG.md) for details.
>
> **What's New in v4.4.0**:
> - 🏗️ **Layout/Style Separation**: New `layout-extract` command separates structure from visual tokens
> - 📦 **Pure Assembler**: `generate` command now purely combines pre-extracted layouts + styles
> - 🎯 **Better Variety**: Layout exploration generates structurally distinct designs
> - ✅ **Single Responsibility**: Each phase (style, layout, assembly) has clear purpose

---

## ✨ Key Features

- **🎯 Context-First Architecture**: Pre-defined context gathering eliminates execution uncertainty and error accumulation.
- **🤖 Multi-Agent System**: Specialized agents (`@code-developer`, `@test-fix-agent`) with tech-stack awareness and automated test validation.
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

### **📋 Interactive Version Selection**

After running the installation command, you'll see an interactive menu with real-time version information:

```
Detecting latest release and commits...
Latest stable: v3.2.0 (2025-10-02 04:27 UTC)
Latest commit: cdea58f (2025-10-02 08:15 UTC)

====================================================
            Version Selection Menu
====================================================

1) Latest Stable Release (Recommended)
   |-- Version: v3.2.0
   |-- Released: 2025-10-02 04:27 UTC
   \-- Production-ready

2) Latest Development Version
   |-- Branch: main
   |-- Commit: cdea58f
   |-- Updated: 2025-10-02 08:15 UTC
   |-- Cutting-edge features
   \-- May contain experimental changes

3) Specific Release Version
   |-- Install a specific tagged release
   \-- Recent: v3.2.0, v3.1.0, v3.0.1

====================================================

Select version to install (1-3, default: 1):
```

**Version Options:**
- **Option 1 (Recommended)**: Latest stable release with verified production quality
- **Option 2**: Latest development version from main branch with newest features
- **Option 3**: Specific version tag for controlled deployments

> 💡 **Pro Tip**: The installer automatically detects and displays the latest version numbers and release dates from GitHub. Just press Enter to select the recommended stable release.

### **📦 Local Installation (Install-Claude.ps1)**

For local installation without network access, use the bundled PowerShell installer:

**Installation Modes:**
```powershell
# Interactive mode with prompts (recommended)
.\Install-Claude.ps1

# Quick install with automatic backup
.\Install-Claude.ps1 -Force -BackupAll

# Non-interactive install
.\Install-Claude.ps1 -NonInteractive -Force
```

**Installation Options:**

| Mode | Description | Installs To |
|------|-------------|-------------|
| **Global** | System-wide installation (default) | `~/.claude/`, `~/.codex/`, `~/.gemini/` |
| **Path** | Custom directory + global hybrid | Local: `agents/`, `commands/`<br>Global: `workflows/`, `scripts/` |

**Backup Behavior:**
- **Default**: Automatic backup enabled (`-BackupAll`)
- **Disable**: Use `-NoBackup` flag (⚠️ overwrites without backup)
- **Backup location**: `claude-backup-{timestamp}/` in installation directory

**⚠️ Important Warnings:**
- `-Force -BackupAll`: Silent file overwrite (with backup)
- `-NoBackup -Force`: Permanent file overwrite (no recovery)
- Global mode modifies user profile directories

### **✅ Verify Installation**
After installation, run the following command to ensure CCW is working:
```bash
/workflow:session:list
```

> **📝 Installation Notes:**
> - The installer will automatically install/update `.codex/` and `.gemini/` directories
> - **Global mode**: Installs to `~/.codex` and `~/.gemini`
> - **Path mode**: Installs to your specified directory (e.g., `project/.codex`, `project/.gemini`)
> - **Backup**: Existing files are backed up by default to `claude-backup-{timestamp}/`
> - **Safety**: Use interactive mode for first-time installation to review changes

---

## ⚙️ Configuration

### **Tool Control System**

CCW uses a **configuration-based tool control system** that makes external CLI tools **optional** rather than required. This allows you to:

- ✅ **Start with Claude-only mode** - Work immediately without installing additional tools
- ✅ **Progressive enhancement** - Add external tools selectively as needed
- ✅ **Graceful degradation** - Automatic fallback when tools are unavailable
- ✅ **Flexible configuration** - Control tool availability per project

**Configuration File**: `~/.claude/workflows/tool-control.yaml`

```yaml
tools:
  gemini:
    enabled: false  # Optional: AI analysis & documentation
  qwen:
    enabled: true   # Optional: AI architecture & code generation
  codex:
    enabled: true   # Optional: AI development & implementation
```

**Behavior**:
- **When disabled**: CCW automatically falls back to other enabled tools or Claude's native capabilities
- **When enabled**: Uses specialized tools for their specific strengths
- **Default**: All tools disabled - Claude-only mode works out of the box

### **Optional CLI Tools** *(Enhanced Capabilities)*

While CCW works with Claude alone, installing these tools provides enhanced analysis and extended context:

#### **External CLI Tools**

| Tool | Purpose | Installation | Benefits |
|------|---------|--------------|----------|
| **Gemini CLI** | AI analysis & documentation | `npm install -g @google/gemini-cli` ([GitHub](https://github.com/google-gemini/gemini-cli)) | Free quota, extended context for complex projects |
| **Codex CLI** | AI development & implementation | `npm install -g @openai/codex` ([GitHub](https://github.com/openai/codex)) | Autonomous development, mathematical reasoning |
| **Qwen Code** | AI architecture & code generation | `npm install -g @qwen-code/qwen-code` ([Docs](https://github.com/QwenLM/qwen-code)) | Large context window, architecture analysis |

#### **System Utilities**

| Tool | Purpose | Installation |
|------|---------|--------------|
| **ripgrep (rg)** | Fast code search | [Download](https://github.com/BurntSushi/ripgrep/releases) or `brew install ripgrep` (macOS), `apt install ripgrep` (Ubuntu) |
| **jq** | JSON processing | [Download](https://jqlang.github.io/jq/download/) or `brew install jq` (macOS), `apt install jq` (Ubuntu) |

**Quick Install (All Tools):**

```bash
# macOS
brew install ripgrep jq
npm install -g @google/gemini-cli @openai/codex @qwen-code/qwen-code

# Ubuntu/Debian
sudo apt install ripgrep jq
npm install -g @google/gemini-cli @openai/codex @qwen-code/qwen-code

# Windows (Chocolatey)
choco install ripgrep jq
npm install -g @google/gemini-cli @openai/codex @qwen-code/qwen-code
```

### **Essential: Gemini CLI Setup**

Configure Gemini CLI for optimal integration:

```json
// ~/.gemini/settings.json
{
  "contextFileName": ["CLAUDE.md", "GEMINI.md"]
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

### **Recommended: MCP Tools** *(Enhanced Analysis)*

MCP (Model Context Protocol) tools provide advanced codebase analysis. **Recommended installation** - While CCW has fallback mechanisms, not installing MCP tools may lead to unexpected behavior or degraded performance in some workflows.

#### Available MCP Servers

| MCP Server | Purpose | Installation Guide |
|------------|---------|-------------------|
| **Exa MCP** | External API patterns & best practices | [Install Guide](https://smithery.ai/server/exa) |
| **Code Index MCP** | Advanced internal code search | [Install Guide](https://github.com/johnhuang316/code-index-mcp) |

#### Benefits When Enabled
- 📊 **Faster Analysis**: Direct codebase indexing vs manual searching
- 🌐 **External Context**: Real-world API patterns and examples
- 🔍 **Advanced Search**: Pattern matching and similarity detection
- ⚡ **Better Reliability**: Primary tools for certain workflows

⚠️ **Note**: Some workflows expect MCP tools to be available. Without them, you may experience:
- Slower code analysis and search operations
- Reduced context quality in some scenarios
- Fallback to less efficient traditional tools
- Potential unexpected behavior in advanced workflows

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

**Phase 2: UI Design Refinement** *(Optional for UI-heavy projects)*
```bash
# Matrix Exploration Mode - Multiple style/layout variants (v4.2.1+)
/workflow:ui-design:explore-auto --prompt "Modern blog: home, article, author" --style-variants 3 --layout-variants 2

# Fast Imitation Mode - Single design replication (v4.2.1+)
/workflow:ui-design:imitate-auto --images "refs/design.png" --pages "dashboard,settings"

# With session integration
/workflow:ui-design:explore-auto --session WFS-auth --images "refs/*.png" --style-variants 2 --layout-variants 3

# Or run individual design phases (v4.4.0+)
/workflow:ui-design:style-extract --images "refs/*.png" --mode explore --variants 3
/workflow:ui-design:consolidate --variants "variant-1,variant-3"
/workflow:ui-design:layout-extract --targets "dashboard,auth" --mode explore --variants 2 --device-type responsive
/workflow:ui-design:generate --style-variants 1 --layout-variants 2

# Preview generated prototypes
# Option 1: Open .workflow/WFS-auth/.design/prototypes/compare.html in browser
# Option 2: Start local server
cd .workflow/WFS-auth/.design/prototypes && python -m http.server 8080
# Visit http://localhost:8080 for interactive preview with comparison tools

/workflow:ui-design:update --session WFS-auth --selected-prototypes "dashboard-s1-l2"
```

**Phase 3: Action Planning**
```bash
# Create executable implementation plan
/workflow:plan "Implement JWT-based authentication system"

# OR for TDD approach
/workflow:tdd-plan "Implement authentication with test-first development"
```

**Phase 4: Execution**
```bash
# Execute tasks with AI agents
/workflow:execute

# Monitor progress
/workflow:status
```

**Phase 5: Testing & Quality Assurance**
```bash
# Generate independent test-fix workflow (v3.2.2+)
/workflow:test-gen WFS-auth  # Creates WFS-test-auth session
/workflow:execute            # Runs test validation

# OR verify TDD compliance (TDD workflow)
/workflow:tdd-verify
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

> **💡 When to Use Which Approach?**
>
> **Use `/workflow:plan` + `/workflow:execute` for:**
> - Complex features requiring multiple modules (>3 modules)
> - Tasks with multiple subtasks (>5 subtasks)
> - Cross-cutting changes affecting architecture
> - Features requiring coordination between components
> - When you need structured planning and progress tracking
>
> **Use Claude Code directly for:**
> - Simple, focused changes (single file or module)
> - Quick bug fixes with clear solutions
> - Documentation updates
> - Code refactoring within one component
> - Straightforward feature additions

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
| `/workflow:ui-design:explore-auto` | **v4.4.0** Matrix exploration mode - Generate multiple style × layout variants with layout/style separation. |
| `/workflow:ui-design:imitate-auto` | **v4.4.0** Fast imitation mode - Rapid UI replication with auto-screenshot, layout extraction, and assembly. |
| `/workflow:ui-design:style-extract` | **v4.4.0** Extract visual style (colors, typography, spacing) from images/text using Claude-native analysis. |
| `/workflow:ui-design:layout-extract` | **v4.4.0** Extract structural layout (DOM, CSS layout rules) with device-aware templates. |
| `/workflow:ui-design:consolidate` | **v4.4.0** Consolidate style variants into validated design tokens using Claude synthesis. |
| `/workflow:ui-design:generate` | **v4.4.0** Pure assembler - Combine layout templates + design tokens → HTML/CSS prototypes. |
| `/workflow:ui-design:update` | **v4.4.0** Integrate finalized design system into brainstorming artifacts. |
| `/workflow:plan` | Create a detailed, executable plan from a description. |
| `/workflow:tdd-plan` | Create TDD workflow (6 phases) with test coverage analysis and Red-Green-Refactor cycles. |
| `/workflow:execute` | Execute the current workflow plan autonomously. |
| `/workflow:status` | Display the current status of the workflow. |
| `/workflow:test-gen [--use-codex] <session>` | Create test generation workflow with auto-diagnosis and fix cycle for completed implementations. |
| `/workflow:tdd-verify` | Verify TDD compliance and generate quality report. |
| `/workflow:review` | **Optional** manual review (only use when explicitly needed - passing tests = approved code). |
| `/workflow:tools:test-context-gather` | Analyze test coverage and identify missing test files. |
| `/workflow:tools:test-concept-enhanced` | Generate test strategy and requirements analysis using Gemini. |
| `/workflow:tools:test-task-generate` | Generate test task JSON with test-fix-cycle specification. |

### **UI Design Workflow Commands (`/workflow:ui-design:*`)** *(v4.4.0)*

The design workflow system provides complete UI design refinement with **layout/style separation architecture**, **pure Claude execution**, **intelligent target inference**, and **zero external dependencies**.

#### Core Commands

**`/workflow:ui-design:explore-auto`** - Matrix exploration mode
```bash
# Comprehensive exploration - multiple style × layout variants
/workflow:ui-design:explore-auto --prompt "Modern blog: home, article, author" --style-variants 3 --layout-variants 2

# With images and session integration
/workflow:ui-design:explore-auto --session WFS-auth --images "refs/*.png" --style-variants 2 --layout-variants 3

# Text-only mode with page inference
/workflow:ui-design:explore-auto --prompt "E-commerce: home, product, cart" --style-variants 2 --layout-variants 2
```
- **🎯 Matrix Mode**: Generate all style × layout combinations
- **📊 Comprehensive Exploration**: Compare multiple design directions
- **🔍 Interactive Comparison**: Side-by-side comparison with viewport controls
- **✅ Cross-page Validation**: Automatic consistency checks for multi-page designs
- **⚡ Batch Selection**: Quick selection by style or layout

**`/workflow:ui-design:imitate-auto`** - Fast imitation mode
```bash
# Rapid single-design replication
/workflow:ui-design:imitate-auto --images "refs/design.png" --pages "dashboard,settings"

# With session integration
/workflow:ui-design:imitate-auto --session WFS-auth --images "refs/ui.png" --pages "home,product"

# Auto-screenshot from URL (requires Playwright)
/workflow:ui-design:imitate-auto --url "https://example.com" --pages "landing"
```
- **⚡ Speed Optimized**: 5-10x faster than explore-auto
- **📸 Auto-Screenshot**: Automatic URL screenshot capture with Playwright/Chrome
- **🎯 Direct Extraction**: Skip variant selection, go straight to implementation
- **🔧 Single Design Focus**: Best for copying existing designs quickly

**`/workflow:ui-design:style-extract`** - Visual style extraction (v4.4.0)
```bash
# Pure text prompt
/workflow:ui-design:style-extract --prompt "Modern minimalist, dark theme" --mode explore --variants 3

# Pure images
/workflow:ui-design:style-extract --images "refs/*.png" --mode explore --variants 3

# Hybrid (text guides image analysis)
/workflow:ui-design:style-extract --images "refs/*.png" --prompt "Linear.app style" --mode imitate

# High-fidelity single style
/workflow:ui-design:style-extract --images "design.png" --mode imitate
```
- **🎨 Visual Tokens Only**: Colors, typography, spacing (no layout structure)
- **🔄 Dual Mode**: Imitate (single variant) / Explore (multiple variants)
- **Claude-Native**: Single-pass analysis, no external tools
- **Output**: `style-cards.json` with embedded `proposed_tokens`

**`/workflow:ui-design:layout-extract`** - Structural layout extraction (v4.4.0)
```bash
# Explore mode - multiple layout variants
/workflow:ui-design:layout-extract --targets "home,dashboard" --mode explore --variants 3 --device-type responsive

# Imitate mode - single layout replication
/workflow:ui-design:layout-extract --images "refs/*.png" --targets "dashboard" --mode imitate --device-type desktop

# With MCP research (explore mode)
/workflow:ui-design:layout-extract --prompt "E-commerce checkout" --targets "cart,checkout" --mode explore --variants 2
```
- **🏗️ Structure Only**: DOM hierarchy, CSS layout rules (no visual style)
- **📱 Device-Aware**: Desktop, mobile, tablet, responsive optimizations
- **🧠 Agent-Powered**: Uses ui-design-agent for structural analysis
- **🔍 MCP Research**: Layout pattern inspiration (explore mode)
- **Output**: `layout-templates.json` with token-based CSS

**`/workflow:ui-design:consolidate`** - Validate and merge tokens
```bash
# Consolidate selected style variants
/workflow:ui-design:consolidate --session WFS-auth --variants "variant-1,variant-3"
```
- **Claude Synthesis**: Single-pass generation of all design system files
- **Features**: WCAG AA validation, OKLCH colors, W3C token format
- **Output**: `design-tokens.json`, `style-guide.md`, `tailwind.config.js`, `validation-report.json`

**`/workflow:ui-design:generate`** - Pure assembler (v4.4.0)
```bash
# Combine layout templates + design tokens
/workflow:ui-design:generate --style-variants 1 --layout-variants 2

# Multiple styles with multiple layouts
/workflow:ui-design:generate --style-variants 2 --layout-variants 3
```
- **📦 Pure Assembly**: Combines pre-extracted layout-templates.json + design-tokens.json
- **❌ No Design Logic**: All layout/style decisions made in previous phases
- **✅ Token Resolution**: Replaces var() placeholders with actual token values
- **🎯 Matrix Output**: Generates style × layout × targets prototypes
- **🔍 Interactive Preview**: `compare.html` with side-by-side comparison

**`/workflow:ui-design:update`** - Integrate design system
```bash
# Update brainstorming artifacts with design system
/workflow:ui-design:update --session WFS-auth --selected-prototypes "login-variant-1"
```
- **Updates**: `synthesis-specification.md`, `ui-designer/style-guide.md`
- **Makes design tokens available for task generation**

#### Preview System

After running `ui-generate`, you get interactive preview tools:

**Quick Preview** (Direct Browser):
```bash
# Navigate to prototypes directory
cd .workflow/WFS-auth/.design/prototypes
# Open index.html in browser (double-click or):
open index.html  # macOS
start index.html  # Windows
xdg-open index.html  # Linux
```

**Full Preview** (Local Server - Recommended):
```bash
cd .workflow/WFS-auth/.design/prototypes
# Choose one:
python -m http.server 8080      # Python
npx http-server -p 8080         # Node.js
php -S localhost:8080           # PHP
# Visit: http://localhost:8080
```

**Preview Features**:
- `index.html`: Master navigation with all prototypes
- `compare.html`: Side-by-side comparison with viewport controls (Desktop/Tablet/Mobile)
- Synchronized scrolling for layout comparison
- Dynamic page switching
- Real-time responsive testing

---

### **Task & Memory Commands**

| Command | Description |
|---|---|
| `/task:*` | Manage individual tasks (`create`, `breakdown`, `execute`, `replan`). |
| `/update-memory-full` | Re-index the entire project documentation. |
| `/update-memory-related` | Update documentation related to recent changes. |
| `/version` | Display version information and check for updates from GitHub. |

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
