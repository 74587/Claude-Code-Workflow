# Claude Code Workflow (CCW)

<div align="right">

**Languages:** [English](README.md) | [中文](README_CN.md)

</div>

A sophisticated multi-agent automation workflow framework that transforms complex software development tasks from conceptualization to implementation review into manageable, trackable, AI-orchestrated processes.

## 🏗️ Architecture Overview

Claude Code Workflow (CCW) is built on two foundational pillars:

### **Document-State Separation**
- **Documents (*.md)**: Store human-readable plans, strategies, analysis reports, and summaries
- **State (*.json)**: Manage machine-readable, dynamic workflow states and task definitions
- This separation ensures robustness, recoverability, and automated processing capabilities

### **Progressive Complexity**
CCW intelligently adapts its file structure and workflow processes based on task complexity:
- **Simple workflows**: Lightweight structure for single-file bug fixes
- **Medium workflows**: Enhanced documentation with progress visualization
- **Complex workflows**: Complete document suite with detailed implementation plans and multi-round iteration

## 🚀 Core Features

### Multi-Agent System
- **Conceptual Planning Agent**: Multi-perspective brainstorming and concept planning
- **Action Planning Agent**: Converts high-level concepts into executable implementation plans
- **Code Developer**: Implements code based on plans
- **Code Review Agent**: Reviews code quality and compliance
- **Memory Gemini Bridge**: Synchronizes Claude and Gemini memory, maintains CLAUDE.md files

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
├── workflows/            # Workflow definitions and guides
└── settings.local.json   # Local configuration
```

## 🚀 Quick Start

**One-liner installation:**
```powershell
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1" -UseBasicParsing).Content
```

**Verify installation:**
```bash
/workflow:session list
```

## 📚 Complete Command Reference

### Core Commands

| Command | Syntax | Description |
|---------|--------|-------------|
| `/enhance-prompt` | `/enhance-prompt <input>` | Enhance and structure user inputs with technical context |
| `/gemini-chat` | `/gemini-chat <inquiry> [--all-files] [--compress]` | Interactive dialogue with Gemini CLI using smart templates |
| `/gemini-execute` | `/gemini-execute <task-id\|description> [--yolo] [--debug]` | Intelligent executor with automatic file context inference |
| `/gemini-mode` | `/gemini-mode <analysis-type> <target> [options]` | Template-driven codebase analysis (pattern, architecture, security) |
| `/update_dms` | `/update_dms [full\|fast\|deep] [path]` | Distributed Memory System management with hierarchical CLAUDE.md |

### Workflow Management

| Command | Syntax | Description |
|---------|--------|-------------|
| `/workflow:session` | `start\|pause\|resume\|list\|switch\|status [complexity] ["task"]` | Session lifecycle management with complexity adaptation |
| `/workflow:brainstorm` | `/brainstorm <topic> [--perspectives=role1,role2]` | Multi-agent conceptual planning from different expert perspectives |
| `/workflow:action-plan` | `[--from-brainstorming] [--skip-brainstorming] [--replan]` | Convert concepts to executable implementation plans |
| `/workflow:implement` | `[--type=simple\|medium\|complex] [--auto-create-tasks]` | Enter implementation phase with complexity-based organization |
| `/workflow:review` | `[--auto-fix]` | Final quality assurance with automated testing and validation |
| `/workflow:issue` | `create\|list\|update\|integrate\|close [options]` | Dynamic issue and change request management |
| `/workflow:context` | `[--detailed] [--health-check] [--export]` | Unified workflow state and progress overview |
| `/workflow:sync` | `[--check] [--fix] [--force]` | Synchronize workflow state across all files |

### Task Execution

| Command | Syntax | Description |
|---------|--------|-------------|
| `/task:create` | `"<title>" [--type=type] [--priority=level]` | Create hierarchical implementation tasks with auto-generated IDs |
| `/task:breakdown` | `<task-id> [--strategy=auto\|interactive] [--depth=1-3]` | Intelligent task decomposition into manageable sub-tasks |
| `/task:execute` | `<task-id> [--mode=auto\|guided] [--agent=type]` | Execute tasks with automatic agent selection |
| `/task:replan` | `[task-id\|--all] [--reason] [--strategy=adjust\|rebuild]` | Dynamic task re-planning for changing requirements |
| `/task:context` | `[task-id\|--filter] [--analyze] [--update]` | Single-task context analysis and dependency tracking |
| `/task:sync` | `[--force] [--dry-run]` | Maintain consistency between task files and tracking documents |

## 🎯 Usage Workflows

### Complex Feature Development
```bash
# 1. Start sophisticated workflow with full documentation
/workflow:session start complex "Implement OAuth2 authentication system"

# 2. Multi-perspective brainstorming
/brainstorm "OAuth2 architecture design" --perspectives=system-architect,security-expert,data-architect

# 3. Create detailed implementation plan
/workflow:action-plan --from-brainstorming

# 4. Break down into manageable tasks
/task:create "Backend API development"
/task:breakdown IMPL-1 --strategy=auto

# 5. Execute with intelligent automation
/gemini-execute IMPL-1.1 --yolo
/gemini-execute IMPL-1.2 --yolo

# 6. Handle dynamic changes
/workflow:issue create --type=enhancement "Add social login support"
/workflow:issue integrate ISS-001 --position=next

# 7. Monitor and review
/workflow:context --detailed
/workflow:review --auto-fix
```

### Quick Bug Fix
```bash
# 1. Lightweight session for simple tasks
/workflow:session start simple "Fix login button alignment"

# 2. Direct analysis and implementation
/gemini-chat "Analyze login button CSS issues in @{src/components/Login.js}"

# 3. Create and execute single task
/task:create "Apply CSS fix to login button"
/task:execute IMPL-1 --mode=auto

# 4. Quick review
/workflow:review
```

### Advanced Code Analysis
```bash
# 1. Security audit
/gemini-mode security "Scan authentication modules for vulnerabilities"

# 2. Architecture analysis
/gemini-mode architecture "Analyze component dependencies and data flow"

# 3. Performance optimization
/gemini-mode performance "Identify bottlenecks in React rendering"

# 4. Pattern recognition
/gemini-mode pattern "Extract reusable component patterns"
```

## 📊 Complexity-Based Strategies

| Complexity | Use Cases | Command Strategy | Documentation Level |
|------------|-----------|------------------|-------------------|
| **Simple** | Bug fixes, text changes, single-file updates | Skip brainstorming → Direct implementation → Minimal tasks | Light (session + log) |
| **Medium** | Multi-file features, refactoring, API changes | Optional brainstorming → Action plan → 2-level tasks → Progress tracking | Moderate (+ TODO_LIST.md) |
| **Complex** | Architecture changes, security modules, system-wide updates | Required brainstorming → Detailed planning → 3-level tasks → Risk assessment | Complete (full document suite) |

## 🔧 Technical Highlights

- **Intelligent Context Processing**: Dynamic context construction with technology stack detection
- **Template-Driven Architecture**: Highly customizable and extensible through templates
- **Quality Assurance Integration**: Built-in code review and testing strategy phases
- **Distributed Memory System (DMS)**: Maintains project-level shared memory through CLAUDE.md files
- **CLI-First Design**: Powerful, orthogonal command-line interface for automation

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