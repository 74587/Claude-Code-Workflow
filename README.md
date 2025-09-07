# Claude Code Workflow (CCW) - Intelligent Development Workflow System

[中文](README_CN.md) | **English**

**An innovative AI-powered development workflow orchestration system featuring progressive complexity management, document-state separation architecture, and intelligent multi-agent coordination.**

> 🚀 **Version 2.0+** - Next-generation development automation with advanced architectural patterns and intelligent workflow orchestration.

## 🏗️ System Architecture

Claude Code Workflow implements a **4-layer intelligent development architecture**:

### 🧠 Core Innovation: Document-State Separation Pattern
- **Markdown Files** → Planning, requirements, task structure, implementation strategy
- **JSON Files** → Execution state, progress tracking, session metadata, dynamic changes
- **Auto-Sync Engine** → Bidirectional coordination with clear ownership rules

### ⚡ Progressive Complexity Management
- **Level 0** (Simple): <5 tasks, minimal structure, direct execution
- **Level 1** (Medium): 5-15 tasks, enhanced planning, agent coordination
- **Level 2** (Complex): >15 tasks, full orchestration, iterative refinement

### 🤖 Intelligent Agent Orchestration
- **5 Specialized Agents**: Planning → Development → Review → Quality → Memory
- **Context Preservation**: Original task context maintained throughout agent chain
- **Quality Gates**: Each agent validates input and ensures output standards
- **Adaptive Workflows**: Workflow depth matches task complexity requirements

### 🔄 Advanced Features
- **Session-First Architecture**: All commands auto-discover and inherit active session context
- **Embedded Workflow Logic**: Commands contain built-in document generation
- **Gemini CLI Integration**: 12+ specialized templates for intelligent context management
- **Real-time Synchronization**: Reliable document-state coordination with conflict resolution

## 🔥 Revolutionary Features

### 🎯 Intelligent Workflow Orchestration
**Three Execution Patterns**:
- **Simple**: `TodoWrite → Context → Implementation → Review`
- **Medium**: `TodoWrite → Planning → Implementation → Review`  
- **Complex**: `TodoWrite → Planning → Implementation → Review → Iteration (max 2 cycles)`

### 🏗️ Advanced Architecture Components

#### 1. **5-Agent Specialized System**
- **Action Planning Agent** (27KB) - PRD processing & implementation plans
- **Code Developer** (13KB) - Test-driven development expert  
- **Code Review Agent** (12KB) - Quality assurance & security validation
- **Conceptual Planning Agent** (9KB) - High-level concept design
- **Memory Gemini Bridge** (8KB) - Distributed memory synchronization

#### 2. **Dynamic Template Ecosystem**
- **10 Role-Based Planning Templates**: Multi-perspective brainstorming
- **6 Tech-Stack Templates**: Language-specific development guidelines
- **Script-Based Discovery**: YAML frontmatter parsing with semantic loading
- **Conditional Content Filtering**: Version-aware template management

#### 3. **JSON Document Coordination System**
**Hierarchical File Structure**:
```
.workflow/WFS-[topic-slug]/
├── workflow-session.json (master state)
├── IMPL_PLAN.md (planning document)
├── TODO_LIST.md (progress tracking)
└── .task/
    ├── impl-*.json (main tasks)
    ├── impl-*.*.json (subtasks)
    └── impl-*.*.*.json (detailed subtasks, max 3 levels)
```

**Data Ownership Rules**:
- **Documents Own**: Implementation strategy, requirements, context
- **JSON Owns**: Task definitions, status, progress, dependencies  
- **Shared Responsibility**: Task status, progress calculation, cross-references

#### 4. **Real-time Synchronization Engine**
```
File System Monitor → Change Parser → Conflict Detector → Sync Engine → Validator → Audit Log
```
**Conflict Resolution Priority**: Data ownership rules → Recent timestamp → User intent → System consistency

## 📁 Project Structure

```
Claude-CCW/
├── .claude/
│   ├── agents/                    # Specialized development agents
│   │   ├── conceptual-planning-agent.md
│   │   ├── action-planning-agent.md
│   │   ├── code-developer.md
│   │   ├── code-review-agent.md
│   │   └── [4 more agents]
│   ├── commands/                  # Command implementations with file output
│   │   ├── workflow/              # 8 core workflow commands (all with file generation)
│   │   ├── task/                  # 6 task management commands (JSON + summary files)
│   │   ├── docs/                  # Documentation management commands  
│   │   └── [utility commands]
│   ├── planning-templates/        # 10 role-based planning templates
│   │   ├── system-architect.md
│   │   ├── ui-designer.md
│   │   └── [8 more roles]
│   ├── tech-stack-templates/      # 6 language-specific guidelines
│   │   ├── javascript-dev.md
│   │   ├── python-dev.md
│   │   ├── react-dev.md
│   │   └── [3 more languages]
│   ├── scripts/                   # Dynamic template loaders & executors
│   │   ├── plan-executor.sh
│   │   ├── tech-stack-loader.sh
│   │   └── gemini-chat-executor.sh
│   ├── schemas/                   # JSON schemas for state management
│   │   ├── workflow-session.json
│   │   ├── task.json
│   │   └── issue.json
│   ├── output-styles/             # Document generation templates
│   │   └── agent-workflow-coordination.md
│   └── workflows/                 # Unified workflow system principles
│       ├── unified-workflow-system-principles.md
│       ├── session-management-principles.md
│       ├── file-structure-standards.md
│       └── [18+ workflow guidelines]
├── .workflow/                     # Generated workflow sessions
│   ├── WFS-[topic-slug]/          # Individual session directories
│   │   ├── workflow-session.json # Session state
│   │   ├── IMPL_PLAN.md          # Planning document
│   │   ├── TODO_LIST.md          # Task tracking
│   │   ├── WORKFLOW_ISSUES.md    # Issue tracking
│   │   ├── .task/                # JSON task files
│   │   ├── .summaries/           # Completion summaries
│   │   └── reports/              # Status reports
│   └── session_status.jsonl     # Multi-session registry
├── CLAUDE.md                     # Project-specific guidelines
└── [Project documentation files]
```

## 🚀 Core Features

### 1. Unified File Output System

**All Workflow Commands Generate Files**:
```bash
# Context analysis with exportable reports  
/workflow:context --export --health-check
# → Generates reports/STATUS_REPORT.md and reports/HEALTH_CHECK.md

# Implementation with comprehensive logging
/workflow:implement --type=medium
# → Generates TODO_LIST.md and IMPLEMENTATION_LOG.md

# Issue tracking with structured files
/workflow:issue create --type=feature "OAuth2 support"
# → Generates WORKFLOW_ISSUES.md and issues/ISS-001.json
```

**Dynamic Template System**:
```bash
# Discover available planning roles
~/.claude/scripts/plan-executor.sh --list

# Load specific role semantically  
~/.claude/scripts/plan-executor.sh --load system-architect
```

### 2. Multi-Agent Workflow Orchestration

**Simple Tasks** (Bug fixes, single-file changes):
```bash
/workflow:session start simple "Fix login button styling"
/workflow:implement --type=simple
# Auto-completes with minimal overhead
```

**Medium Tasks** (Multi-component features):
```bash  
/workflow:session start medium "Add user profile editing"
/workflow:plan                      # Lightweight planning
/workflow:implement --type=medium   # Multi-agent execution
/workflow:review                    # Quality validation
```

**Complex Tasks** (System-level changes):
```bash
/workflow:session start complex "Implement OAuth2 authentication"
/workflow:plan                      # Detailed planning with PRD
/workflow:implement --type=complex  # Full agent orchestration
/task:create "Design OAuth2 architecture"
/task:breakdown IMPL-001
/workflow:status                    # Progress monitoring
/workflow:review                    # Comprehensive review
```

### 3. Session Management with State Persistence

**Complete Session Control**:
- **JSON State Management**: All workflow state persisted in `workflow-session.json`
- **Task-Level Tracking**: Detailed task management in `tasks.json`
- **Pause/Resume**: Safe interruption and recovery
- **Progress Monitoring**: Real-time TodoWrite integration

**Session Example**:
```json
{
  "session_id": "WFS-2025-001",
  "type": "complex",
  "current_phase": "IMPLEMENT", 
  "phases": {
    "PLAN": {"status": "completed"},
    "IMPLEMENT": {"status": "active", "progress": 60},
    "REVIEW": {"status": "pending"}
  }
}
```

### 4. Intelligent Context Analysis

**Gemini CLI Integration** with 12+ specialized templates:
- **Architecture Analysis**: System structure and component relationships
- **Security Review**: Vulnerability assessment and compliance
- **Performance Analysis**: Optimization opportunities and bottlenecks
- **Pattern Detection**: Code patterns and best practices
- **Dependency Analysis**: Module relationships and impacts

### 5. Unified Task Management  

**Dual-Layer Architecture**:
- **Workflow Layer**: Macro-level session and phase management
- **Task Layer**: Micro-level task execution and tracking
- **Automatic Synchronization**: Bi-directional data consistency
- **Unified Status**: Single command for complete project overview

## 🎯 Usage Examples

### Multi-Perspective Feature Planning
```bash
# Use conceptual planning agent for brainstorming
# System loads multiple planning roles dynamically:
# - system-architect (technical feasibility)
# - ui-designer (user experience)  
# - security-expert (security implications)
# - data-architect (data requirements)

/workflow:session start complex "Real-time chat feature"
/workflow:plan
# → Generates comprehensive PRD with multi-role analysis
# → Creates IMPLEMENTATION_PLAN.md and TASK_DECOMPOSITION.md
```

### Tech Stack Specific Development
```bash  
# Code developer agent loads appropriate tech guidelines
/workflow:implement --type=medium
# → Automatically detects JavaScript/React codebase
# → Loads javascript-dev.md and react-dev.md guidelines  
# → Applies language-specific best practices
```

### Advanced Session Management
```bash
# Complex project with interruption handling
/workflow:session start complex "Microservices migration"
/workflow:plan                       # Detailed planning
/workflow:implement --type=complex   # Begin implementation

# Work gets interrupted
/workflow:session pause              # Safe state preservation

# Later resume
/workflow:session resume             # Continues from exact point
/workflow:status                     # Shows current progress
/task:execute IMPL-003.2             # Continue specific task
```

## 🛠️ Installation & Setup

### Prerequisites
- **Claude Code CLI** environment
- **Bash/PowerShell** for script execution  
- **Git** for version control
- **Gemini CLI** (optional, for enhanced analysis)

### Installation
```bash
# Clone the repository
git clone https://github.com/catlog22/Claude-CCW.git
cd Claude-CCW

# Copy to Claude Code directory
cp -r .claude ~/.claude/
cp CLAUDE.md ~/.claude/

# Make scripts executable
chmod +x ~/.claude/scripts/*.sh
```

### Quick Start
```bash
# Start with a simple task
/workflow:session start simple "Fix responsive layout bug"
/workflow:implement --type=simple

# Or try a medium complexity task
/workflow:session start medium "Add user notification system"  
/workflow:plan
/workflow:implement --type=medium
/workflow:review
```

## 📊 System Capabilities

### Planning & Analysis
- **Multi-Role Brainstorming**: 10 specialized planning perspectives
- **PRD Generation**: Comprehensive requirement documentation
- **Risk Assessment**: Automated risk identification and mitigation
- **Dependency Analysis**: Smart module relationship detection

### Development & Implementation  
- **Tech Stack Awareness**: 6 language-specific development guidelines
- **Test-Driven Development**: Automated test generation and execution
- **Code Quality Enforcement**: Real-time quality validation
- **Pattern Recognition**: Existing codebase pattern analysis

### Project Management
- **Session Persistence**: Complete workflow state management
- **Progress Tracking**: Real-time TodoWrite integration
- **Task Decomposition**: Hierarchical task breakdown
- **Status Monitoring**: Unified progress dashboard

### Quality Assurance
- **Multi-Phase Review**: Planning → Implementation → Review validation
- **Security Analysis**: Automated security assessment
- **Performance Monitoring**: Performance impact analysis
- **Documentation Updates**: Automatic documentation synchronization

## 🔧 Advanced Configuration

### Template Customization
Add custom planning roles or tech stack guidelines by:
1. Creating new `.md` files with YAML frontmatter
2. Following the template structure pattern
3. Templates auto-discovered by script loaders

### Session Configuration
Modify session behavior in:
- `.claude/workflows/session-management-principles.md`
- `.claude/schemas/workflow-session.json`

### Agent Coordination
Customize agent workflows in:
- `.claude/workflows/agent-orchestration-patterns.md`
- Individual agent configuration files

## 📈 Performance & Scalability

- **JSON-Based State**: Efficient session persistence
- **Modular Architecture**: Independent component operation
- **Dynamic Loading**: On-demand template activation  
- **Scalable Task Management**: Handles simple to enterprise-level complexity
- **Memory Efficient**: Smart context management with Gemini integration

## 🤝 Contributing

This is an active development project. Key areas for contribution:
- Additional planning role templates
- New tech stack development guidelines  
- Enhanced agent coordination patterns
- Performance optimizations
- Documentation improvements

## 📄 License

[Specify license - typically MIT or Apache 2.0]

---

**Claude Code Workflow (CCW)** - Elevating Claude Code development through intelligent workflow orchestration and comprehensive project management.