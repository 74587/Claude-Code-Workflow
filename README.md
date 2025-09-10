# Claude Code Workflow (CCW)

<div align="right">

**Languages:** [English](README.md) | [中文](README_CN.md)

</div>

A sophisticated multi-agent automation workflow framework that transforms complex software development tasks from conceptualization to implementation review into manageable, trackable, AI-orchestrated processes.

> **🎉 v1.1 Release**: Unified CLI architecture with both Gemini (analysis) and Codex (development) integration, shared template system, comprehensive workflow documentation, and autonomous development capabilities. See [CHANGELOG.md](CHANGELOG.md) for details.

## 🏗️ Architecture Overview

Claude Code Workflow (CCW) is built on three foundational pillars:

### **JSON-Only Data Model**
- **Single Source of Truth**: All task states stored exclusively in `.task/impl-*.json` files
- **Dynamic Document Generation**: Markdown files generated on-demand as read-only views
- **Zero Synchronization**: Eliminates data consistency issues and sync complexity
- **Performance**: Direct JSON operations with <1ms query times

### **Marker File Session Management**
- **Ultra-Fast Operations**: Session switching through atomic file operations (`.workflow/.active-[session]`)
- **Self-Healing**: Automatic detection and resolution of session conflicts
- **Visual Management**: `ls .workflow/.active-*` shows current active session
- **Scalability**: Supports hundreds of concurrent sessions without performance degradation

### **Progressive Complexity**
CCW intelligently adapts its file structure and workflow processes based on unified task-count thresholds:
- **Simple workflows** (<5 tasks): Minimal structure, single-level hierarchy
- **Medium workflows** (5-15 tasks): Enhanced structure with progress tracking  
- **Complex workflows** (>15 tasks): Complete document suite with 3-level task decomposition

## 🚀 Core Features

### Multi-Agent System
- **Conceptual Planning Agent**: Multi-perspective brainstorming and concept planning
- **Action Planning Agent**: Converts high-level concepts into executable implementation plans
- **Code Developer**: Implements code based on plans
- **Code Review Agent**: Reviews code quality and compliance
- **Memory Gemini Bridge**: Intelligent CLAUDE.md documentation system with context-aware updates

### Unified CLI Integration (v1.1)
- **Gemini & Codex Unified**: Comprehensive CLI integration with both analysis (`gemini`) and development (`codex`) workflows
- **Dynamic Template Discovery**: Automatically detects and loads templates from `~/.claude/workflows/cli-templates/`
- **Intelligent Auto-Selection**: Matches user input against template keywords and descriptions
- **Template System**: Analysis, development, planning, and specialized templates
- **Streamlined Commands**: Unified documentation architecture with shared templates

### Workflow Session Management
- Create, pause, resume, list, and switch workflow sessions
- Automatic initialization of required file and directory structures
- Hierarchical workflow filesystem (`.workflow/WFS-[topic-slug]/`)

### Intelligent Context Generation
- Dynamic context construction based on technology stack detection
- Project structure analysis and domain keyword extraction
- Optimized file targeting for Gemini CLI integration

### Dynamic Change Management
- Issue tracking and integration (`/workflow:issue`)
- Automatic re-planning capabilities (`/task:replan`)
- Seamless adaptation to changing requirements

## 📁 Directory Structure

```
.claude/
├── agents/                 # AI agent definitions and behaviors
├── commands/              # CLI command implementations  
├── output-styles/         # Output formatting templates
├── planning-templates/    # Role-specific planning approaches
├── prompt-templates/      # AI interaction templates
├── scripts/              # Automation scripts
├── tech-stack-templates/ # Technology-specific templates
├── workflows/            # Core system architecture (v2.0)
│   ├── system-architecture.md     # 🆕 Unified architecture overview
│   ├── data-model.md              # 🆕 JSON-only task management spec
│   ├── complexity-rules.md        # 🆕 Unified complexity standards
│   ├── session-management-principles.md # Marker file session system
│   ├── file-structure-standards.md     # Progressive structure definitions
│   └── [gemini-*.md]              # Gemini CLI integration templates
└── settings.local.json   # Local configuration

.workflow/                 # 🆕 Session workspace (auto-generated)
├── .active-[session-name] # 🆕 Active session marker file
└── WFS-[topic-slug]/      # Individual session directories
    ├── workflow-session.json      # Session metadata
    ├── .task/impl-*.json          # 🆕 JSON-only task definitions
    ├── IMPL_PLAN.md               # Generated planning document
    └── .summaries/                # Generated completion summaries
```

## 🚀 Quick Start

### Prerequisites
Install and configure [Gemini CLI](https://github.com/google-gemini/gemini-cli) for optimal workflow integration.

### Installation
**One-liner installation:**
```powershell
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1" -UseBasicParsing).Content
```

**Verify installation:**
```bash
/workflow:session list
```

### Essential Configuration
For Gemini CLI integration, configure your `settings.json` file:

```json
{
  "contextFileName": "CLAUDE.md"
}
```

> **⚠️ Important**: Set `"contextFileName": "CLAUDE.md"` in your Gemini CLI `settings.json` to ensure proper integration with CCW's intelligent documentation system. This can be set in your user settings (`~/.gemini/settings.json`) or project settings (`.gemini/settings.json`).

## 📚 Complete Command Reference

### CLI Tool Guidelines
- **Gemini Commands**: For analysis, investigation, and understanding codebase patterns
- **Codex Commands**: For autonomous development, code generation, and implementation
- **Unified Templates**: Shared template system at `~/.claude/workflows/cli-templates/`

### Core Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `/enhance-prompt` | `/enhance-prompt <input>` | Enhance and structure user inputs with technical context |
| `/gemini:analyze` | `/gemini:analyze <inquiry> [--all-files] [--save-session]` | Direct codebase analysis and investigation |
| `/gemini:chat` | `/gemini:chat <inquiry> [--all-files] [--save-session]` | Simple direct interaction with Gemini CLI without templates |
| `/gemini:execute` | `/gemini:execute <task-id\|description> [--yolo] [--debug]` | Intelligent executor with automatic file context inference |
| `/gemini:mode:auto` | `/gemini:mode:auto "<description>"` | Auto-select and execute appropriate template based on user input analysis |
| `/gemini:mode:bug-index` | `/gemini:mode:bug-index <bug-description>` | Bug analysis using specialized diagnostic template |
| `/gemini:mode:plan` | `/gemini:mode:plan <planning-topic>` | Project planning using specialized architecture template |
| `/codex:exec` | `/codex:exec "@{patterns} prompt"` | 🆕 Autonomous development with explicit file pattern references |
| `/codex:--full-auto` | `/codex --full-auto "task description"` | 🆕 Full automation mode for complex development workflows |
| `/update-memory` | `/update-memory [related\|full]` | Intelligent CLAUDE.md documentation system with context-aware updates |
| `/update-memory-full` | `/update-memory-full` | 🆕 Complete project-wide CLAUDE.md documentation update with depth-parallel execution |
| `/update-memory-related` | `/update-memory-related` | 🆕 Context-aware documentation updates for modules affected by recent changes |

### Workflow Management

| Command | Syntax | Description |
|---------|--------|-------------|
| `/workflow:session:*` | `/workflow:session:start\|pause\|resume\|list\|switch\|status "task"` | Session lifecycle management with complexity adaptation |
| `/workflow:brainstorm` | `/workflow:brainstorm <topic> [--perspectives=role1,role2]` | Multi-agent conceptual planning from different expert perspectives |
| `/workflow:plan` | `[--from-brainstorming] [--skip-brainstorming]` | Convert concepts to executable implementation plans |
| `/workflow:plan-deep` | `<topic> [--complexity=high] [--depth=3]` | Deep architectural planning with comprehensive analysis |
| `/workflow:execute` | `[--type=simple\|medium\|complex] [--auto-create-tasks]` | Enter implementation phase with complexity-based organization |
| `/workflow:review` | `[--auto-fix]` | Final quality assurance with automated testing and validation |
| `/workflow:issue:*` | `create\|list\|update\|close [options]` | 🆕 Dynamic issue and change request management |
| `/context` | `[task-id\|--filter] [--analyze] [--format=tree\|list\|json]` | Unified task and workflow context with automatic data consistency |

### Task Execution

| Command | Syntax | Description |
|---------|--------|-------------|
| `/task:create` | `"<title>" [--type=type] [--priority=level]` | Create hierarchical implementation tasks with auto-generated IDs |
| `/task:breakdown` | `<task-id> [--strategy=auto\|interactive] [--depth=1-3]` | Intelligent task decomposition into manageable sub-tasks |
| `/task:execute` | `<task-id> [--mode=auto\|guided] [--agent=type]` | Execute tasks with automatic agent selection |
| `/task:replan` | `[task-id\|--all] [--reason] [--strategy=adjust\|rebuild]` | Dynamic task re-planning for changing requirements |

## 🎯 Usage Workflows

### Complex Feature Development
```bash
# 1. Start sophisticated workflow with full documentation
/workflow:session:start "Implement OAuth2 authentication system"

# 2. Multi-perspective brainstorming
/workflow:brainstorm "OAuth2 architecture design" --perspectives=system-architect,security-expert,data-architect

# 3. Create detailed implementation plan
/workflow:plan --from-brainstorming

# 4. Break down into manageable tasks
/task:create "Backend API development"
/task:breakdown IMPL-1 --strategy=auto

# 5. Execute with intelligent automation
/gemini:execute IMPL-1.1 --yolo
/gemini:execute IMPL-1.2 --yolo

# 6. Handle dynamic changes and issues
/workflow:issue:create "Add social login support"
/workflow:issue:list
/workflow:issue:update 1 --status=in-progress

# 7. Monitor and review
/context --format=hierarchy
/workflow:review --auto-fix
```

### Quick Bug Fix
```bash
# 1. Lightweight session for simple tasks
/workflow:session:start "Fix login button alignment"

# 2. Direct analysis and implementation
/gemini:analyze "Analyze login button CSS issues in @{src/components/Login.js}"

# 3. Create and execute single task
/task:create "Apply CSS fix to login button"
/task:execute IMPL-1 --mode=auto

# 4. Quick review
/workflow:review
```

### Smart Template Auto-Selection (v1.0)
```bash
# 1. Automatic template selection based on keywords
/gemini:mode:auto "React component not rendering after state update"
# → Auto-selects bug-fix template

# 2. Planning template for architecture work
/gemini:mode:auto "design microservices architecture for user management"
# → Auto-selects planning template

# 3. Manual template override when needed
/gemini:mode:auto "authentication issues" --template plan.md

# 4. List available templates
/gemini:mode:auto --list-templates
```

### Intelligent Documentation Management
```bash
# 1. Daily development - context-aware updates
/update-memory                    # Default: related mode - detects and updates affected modules
/update-memory-related            # Explicit: context-aware updates based on recent changes

# 2. After working in specific module
cd src/api && /update-memory related  # Updates API module and parent hierarchy
/update-memory-related            # Same as above, with intelligent change detection

# 3. Periodic full refresh
/update-memory full               # Complete project-wide documentation update
/update-memory-full               # Explicit: full project scan with depth-parallel execution

# 4. Post-refactoring documentation sync
git commit -m "Major refactoring"
/update-memory-related            # Intelligently updates all affected areas with git-aware detection

# 5. Project initialization or major architectural changes
/update-memory-full               # Complete baseline documentation creation
```

#### Update Mode Comparison

| Mode | Trigger | Complexity Threshold | Best Use Case |
|------|---------|---------------------|---------------|
| `related` (default) | Git changes + recent files | >15 modules | Daily development, feature work |
| `full` | Complete project scan | >20 modules | Initial setup, major refactoring |

## 📊 Complexity-Based Strategies

| Complexity | Task Count | Hierarchy Depth | File Structure | Command Strategy |
|------------|------------|----------------|----------------|------------------|
| **Simple** | <5 tasks | 1 level (impl-N) | Minimal structure | Skip brainstorming → Direct implementation |
| **Medium** | 5-15 tasks | 2 levels (impl-N.M) | Enhanced + auto-generated TODO_LIST.md | Optional brainstorming → Action plan → Progress tracking |
| **Complex** | >15 tasks | 3 levels (impl-N.M.P) | Complete document suite | Required brainstorming → Multi-agent orchestration → Deep context analysis |

### 🚀 v1.1 Release Benefits
- **Unified CLI Architecture**: Seamless integration of analysis (`gemini`) and development (`codex`) workflows
- **Smart Automation**: Intelligent template selection with autonomous development capabilities
- **Shared Template System**: Unified template library with cross-tool compatibility
- **Enhanced Documentation**: Comprehensive workflow guides with best practices
- **Cross-Platform**: Unified path handling for Windows/Linux compatibility
- **Developer Experience**: Powerful automation with human oversight control

## 🔧 Technical Highlights

- **Dual CLI Integration**: Seamless `gemini` (analysis) and `codex` (development) workflow coordination
- **Intelligent Context Processing**: Dynamic context construction with technology stack detection
- **Template-Driven Architecture**: Highly customizable and extensible through unified shared templates
- **Quality Assurance Integration**: Built-in code review and testing strategy phases
- **Intelligent Documentation System**: 4-layer hierarchical CLAUDE.md system with:
  - **Dual-mode Operations**: `related` (git-aware change detection) and `full` (complete project scan)  
  - **Complexity-adaptive Execution**: Auto-delegation to memory-gemini-bridge for complex projects (>15/20 modules)
  - **Depth-parallel Processing**: Bottom-up execution ensuring child context availability for parent updates
  - **Git Integration**: Smart change detection with fallback strategies and comprehensive status reporting
- **CLI-First Design**: Powerful, orthogonal command-line interface for automation and autonomous development

## 🎨 Design Philosophy

- **Structure over Freeform**: Guided workflows prevent chaos and oversights
- **Traceability & Auditing**: Complete audit trail for all decisions and changes
- **Automation with Human Oversight**: High automation with human confirmation at key decision points
- **Separation of Concerns**: Clean architecture with distinct responsibilities
- **Extensibility**: Easy to extend with new agents, commands, and templates

## 📚 Documentation

- **Workflow Guidelines**: See `workflows/` directory for detailed process documentation
- **Agent Definitions**: Check `agents/` for AI agent specifications
- **Template Library**: Explore `planning-templates/` and `prompt-templates/`
- **Integration Guides**: Review Gemini CLI integration in `workflows/gemini-*.md`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔮 Future Roadmap

- Enhanced multi-language support
- Integration with additional AI models
- Advanced project analytics and insights
- Real-time collaboration features
- Extended CI/CD pipeline integration

---

**Claude Code Workflow (CCW)** - Transforming software development through intelligent automation and structured workflows.