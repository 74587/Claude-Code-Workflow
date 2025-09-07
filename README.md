# Claude Code Workflow (CCW)

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

## 🛠️ Installation

### Quick Install (Recommended)

**One-liner remote installation:**

```powershell
# PowerShell (Windows/Linux/macOS)
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1" -UseBasicParsing).Content
```

**With parameters:**
```powershell
# Global installation
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1" -UseBasicParsing).Content | ForEach-Object { iex "$_ -Global" }

# Custom directory installation  
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1" -UseBasicParsing).Content | ForEach-Object { iex "$_ -Directory 'C:\MyCustomPath'" }

# Force installation (overwrites existing)
Invoke-Expression (Invoke-WebRequest -Uri "https://raw.githubusercontent.com/catlog22/Claude-Code-Workflow/main/install-remote.ps1" -UseBasicParsing).Content | ForEach-Object { iex "$_ -Force" }
```

### Manual Installation

1. Clone this repository:
```bash
git clone https://github.com/catlog22/Claude-Code-Workflow.git
cd Claude-Code-Workflow
```

2. Run the local installer:
```powershell
# Windows PowerShell
.\Install-Claude.ps1

# With parameters
.\Install-Claude.ps1 -InstallMode Global -Force
```

3. Or manually set up the environment:
```bash
# Copy to your Claude Code configuration directory
cp -r .claude ~/.claude/
# Or on Windows
xcopy .claude %USERPROFILE%\.claude /E /I
```

4. Verify installation:
```bash
/workflow:session list
```

### Installation Options

| Parameter | Description | Example |
|-----------|-------------|---------|
| `-Global` | Install system-wide | `-Global` |
| `-Directory` | Custom installation path | `-Directory "C:\CCW"` |
| `-Force` | Overwrite existing installation | `-Force` |
| `-NoBackup` | Skip backup of existing files | `-NoBackup` |
| `-NonInteractive` | Silent installation | `-NonInteractive` |
| `-Branch` | Install from specific branch | `-Branch "develop"` |

## 📖 Usage Guide

### Starting a Complex Workflow

1. **Initialize Session**:
```bash
/workflow:session start complex "Implement OAuth2 user authentication system"
```

2. **Conceptual Planning** (Optional but recommended):
```bash
/brainstorm "Design OAuth2 authentication system architecture" --perspectives=system-architect,security-expert,data-architect
```

3. **Create Action Plan**:
```bash
/workflow:action-plan --from-brainstorming
```

4. **Task Creation & Breakdown**:
```bash
/task:create "Backend API development"
/task:breakdown IMPL-1
```

5. **Execute Tasks**:
```bash
/task:execute IMPL-1.1
```

6. **Handle Changes**:
```bash
/workflow:issue create --type=bug "JWT token refresh logic vulnerability"
/workflow:issue integrate ISS-001 --position=immediate
```

7. **Monitor Progress**:
```bash
/workflow:context --detailed
/task:context IMPL-1.2
```

8. **Review & Complete**:
```bash
/workflow:review
```

## 🎯 Key Commands

| Command | Purpose |
|---------|---------|
| `/workflow:session` | Manage workflow sessions |
| `/brainstorm` | Multi-perspective conceptual planning |
| `/workflow:action-plan` | Convert concepts to implementation plans |
| `/task:breakdown` | Decompose tasks into executable units |
| `/task:execute` | Execute specific tasks |
| `/workflow:issue` | Manage issues and changes |
| `/gemini-execute` | Enhanced Gemini CLI integration |
| `/update_dms` | Maintain distributed memory system |

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