# 🔄 Claude Code Workflow System Documentation

<div align="center">

[![Workflow System](https://img.shields.io/badge/CCW-Workflow%20System-blue.svg)]()
[![JSON-First](https://img.shields.io/badge/architecture-JSON--First-green.svg)]()
[![Multi-Agent](https://img.shields.io/badge/system-Multi--Agent-orange.svg)]()

*Advanced multi-agent orchestration system for autonomous software development*

</div>

---

## 📋 Overview

The **Claude Code Workflow System** is the core engine powering CCW's intelligent development automation. It orchestrates complex software development tasks through a sophisticated multi-agent architecture, JSON-first data model, and atomic session management.

### 🏗️ **System Architecture Components**

| Component | Purpose | Key Features |
|-----------|---------|--------------|
| 🤖 **Multi-Agent System** | Task orchestration | Specialized agents for planning, coding, review |
| 📊 **JSON-First Data Model** | State management | Single source of truth, atomic operations |
| ⚡ **Session Management** | Context preservation | Zero-overhead switching, conflict resolution |
| 🔍 **Intelligent Analysis** | Context gathering | Dual CLI integration, smart search strategies |
| 🎯 **Task Decomposition** | Work organization | Core standards, complexity management |

---

## 🤖 Multi-Agent Architecture

### **Agent Specializations**

#### 🎯 **Conceptual Planning Agent**
```markdown
**Role**: Strategic planning and architectural design
**Capabilities**:
- High-level system architecture design
- Technology stack recommendations
- Risk assessment and mitigation strategies
- Integration pattern identification

**Tools**: Gemini CLI, architectural templates, brainstorming frameworks
**Output**: Strategic plans, architecture diagrams, technology recommendations
```

#### ⚡ **Action Planning Agent**
```markdown
**Role**: Converts high-level concepts into executable implementation plans
**Capabilities**:
- Task breakdown and decomposition
- Dependency mapping and sequencing
- Resource allocation planning
- Timeline estimation and milestones

**Tools**: Task templates, decomposition algorithms, dependency analyzers
**Output**: Executable task plans, implementation roadmaps, resource schedules
```

#### 👨‍💻 **Code Developer Agent**
```markdown
**Role**: Autonomous code implementation and refactoring
**Capabilities**:
- Full-stack development automation
- Pattern-based code generation
- Refactoring and optimization
- Integration and testing

**Tools**: Codex CLI, code templates, pattern libraries, testing frameworks
**Output**: Production-ready code, tests, documentation, deployment configs
```

#### 🔍 **Code Review Agent**
```markdown
**Role**: Quality assurance and compliance validation
**Capabilities**:
- Code quality assessment
- Security vulnerability detection
- Performance optimization recommendations
- Standards compliance verification

**Tools**: Static analysis tools, security scanners, performance profilers
**Output**: Quality reports, fix recommendations, compliance certificates
```

#### 📚 **Memory Gemini Bridge**
```markdown
**Role**: Intelligent documentation management and updates
**Capabilities**:
- Context-aware documentation generation
- Knowledge base synchronization
- Change impact analysis
- Living documentation maintenance

**Tools**: Gemini CLI, documentation templates, change analyzers
**Output**: Updated documentation, knowledge graphs, change summaries
```

---

## 📊 JSON-First Data Model

### **Core Architecture Principles**

#### **🎯 Single Source of Truth**
```json
{
  "principle": "All workflow state stored in structured JSON files",
  "benefits": [
    "Data consistency guaranteed",
    "No synchronization conflicts",
    "Atomic state transitions",
    "Version control friendly"
  ],
  "implementation": ".task/impl-*.json files contain complete task state"
}
```

#### **⚡ Generated Views**
```json
{
  "principle": "Markdown documents generated on-demand from JSON",
  "benefits": [
    "Always up-to-date views",
    "No manual synchronization needed",
    "Multiple view formats possible",
    "Performance optimized"
  ],
  "examples": ["IMPL_PLAN.md", "TODO_LIST.md", "progress reports"]
}
```

### **Task JSON Schema (5-Field Architecture)**

```json
{
  "id": "IMPL-1.2",
  "title": "Implement JWT authentication system",
  "status": "pending|active|completed|blocked|container",

  "meta": {
    "type": "feature|bugfix|refactor|test|docs",
    "agent": "code-developer|planning-agent|code-review-test-agent",
    "priority": "high|medium|low",
    "complexity": 1-5,
    "estimated_hours": 8
  },

  "context": {
    "requirements": ["JWT token generation", "Refresh token support"],
    "focus_paths": ["src/auth", "tests/auth", "config/auth.json"],
    "acceptance": ["JWT validation works", "Token refresh functional"],
    "parent": "IMPL-1",
    "depends_on": ["IMPL-1.1"],
    "inherited": {
      "from": "IMPL-1",
      "context": ["Authentication system architecture completed"]
    },
    "shared_context": {
      "auth_strategy": "JWT with refresh tokens",
      "security_level": "enterprise"
    }
  },

  "flow_control": {
    "pre_analysis": [
      {
        "step": "gather_dependencies",
        "action": "Load context from completed dependencies",
        "command": "bash(cat .workflow/WFS-[session-id]/.summaries/IMPL-1.1-summary.md)",
        "output_to": "dependency_context",
        "on_error": "skip_optional"
      },
      {
        "step": "discover_patterns",
        "action": "Find existing authentication patterns",
        "command": "bash(rg -A 2 -B 2 'class.*Auth|interface.*Auth' --type ts [focus_paths])",
        "output_to": "auth_patterns",
        "on_error": "skip_optional"
      }
    ],
    "implementation_approach": {
      "task_description": "Implement JWT authentication with refresh tokens...",
      "modification_points": [
        "Add JWT generation in login handler (src/auth/login.ts:handleLogin:75-120)",
        "Implement validation middleware (src/middleware/auth.ts:validateToken)"
      ],
      "logic_flow": [
        "User login → validate → generate JWT → store refresh token",
        "Protected access → validate JWT → allow/deny"
      ]
    },
    "target_files": [
      "src/auth/login.ts:handleLogin:75-120",
      "src/middleware/auth.ts:validateToken"
    ]
  }
}
```

---

## ⚡ Advanced Session Management

### **Atomic Session Architecture**

#### **🏷️ Marker File System**
```bash
# Session state managed through atomic marker files
.workflow/
├── .active-WFS-oauth2-system     # Active session marker
├── .active-WFS-payment-fix       # Another active session
└── WFS-oauth2-system/            # Session directory
    ├── workflow-session.json     # Session metadata
    ├── .task/                    # Task definitions
    └── .summaries/               # Completion summaries
```

#### **🔄 Session Operations**
```json
{
  "session_creation": {
    "operation": "atomic file creation",
    "time_complexity": "O(1)",
    "performance": "<10ms average"
  },
  "session_switching": {
    "operation": "marker file update",
    "time_complexity": "O(1)",
    "performance": "<5ms average"
  },
  "conflict_resolution": {
    "strategy": "last-write-wins with backup",
    "recovery": "automatic rollback available"
  }
}
```

### **Session Lifecycle Management**

#### **📋 Session States**
| State | Description | Operations | Next States |
|-------|-------------|------------|-------------|
| `🚀 created` | Initial state | start, configure | active, paused |
| `▶️ active` | Currently executing | pause, switch | paused, completed |
| `⏸️ paused` | Temporarily stopped | resume, archive | active, archived |
| `✅ completed` | Successfully finished | archive, restart | archived |
| `❌ error` | Error state | recover, reset | active, archived |
| `📚 archived` | Long-term storage | restore, delete | active |

---

## 🎯 Core Task Decomposition Standards

### **Revolutionary Decomposition Principles**

#### **1. 🎯 Functional Completeness Principle**
```yaml
definition: "Each task must deliver a complete, independently runnable functional unit"
requirements:
  - All related files (logic, UI, tests, config) included
  - Task can be deployed and tested independently
  - Provides business value when completed
  - Has clear acceptance criteria

examples:
  ✅ correct: "User authentication system (login, JWT, middleware, tests)"
  ❌ wrong: "Create login component" (incomplete functional unit)
```

#### **2. 📏 Minimum Size Threshold**
```yaml
definition: "Single task must contain at least 3 related files or 200 lines of code"
rationale: "Prevents over-fragmentation and context switching overhead"
enforcement:
  - Tasks below threshold must be merged with adjacent features
  - Exception: Critical configuration or security files
  - Measured after task completion for validation

examples:
  ✅ correct: "Payment system (gateway, validation, UI, tests, config)" # 5 files, 400+ lines
  ❌ wrong: "Update README.md" # 1 file, <50 lines - merge with related task
```

#### **3. 🔗 Dependency Cohesion Principle**
```yaml
definition: "Tightly coupled components must be completed in the same task"
identification:
  - Shared data models or interfaces
  - Same API endpoint (frontend + backend)
  - Single user workflow components
  - Components that fail together

examples:
  ✅ correct: "Order processing (model, API, validation, UI, tests)" # Tightly coupled
  ❌ wrong: "Order model" + "Order API" as separate tasks # Will break separately
```

#### **4. 📊 Hierarchy Control Rule**
```yaml
definition: "Clear structure guidelines based on task count"
rules:
  flat_structure: "≤5 tasks - single level hierarchy (IMPL-1, IMPL-2, ...)"
  hierarchical_structure: "6-10 tasks - two level hierarchy (IMPL-1.1, IMPL-1.2, ...)"
  re_scope_required: ">10 tasks - mandatory re-scoping into multiple iterations"

enforcement:
  - Hard limit prevents unmanageable complexity
  - Forces proper planning and scoping
  - Enables effective progress tracking
```

---

## 🔍 Intelligent Analysis System

### **Dual CLI Integration Strategy**

#### **🧠 Gemini CLI (Analysis & Investigation)**
```yaml
primary_use: "Deep codebase analysis, pattern recognition, context gathering"
strengths:
  - Large context window (2M+ tokens)
  - Excellent pattern recognition
  - Cross-module relationship analysis
  - Architectural understanding

optimal_tasks:
  - "Analyze authentication patterns across entire codebase"
  - "Understand module relationships and dependencies"
  - "Find similar implementations for reference"
  - "Identify architectural inconsistencies"

command_examples:
  - "~/.claude/scripts/gemini-wrapper -p 'Analyze patterns in auth module'"
  - "gemini --all-files -p 'Review overall system architecture'"
```

#### **🤖 Codex CLI (Development & Implementation)**
```yaml
primary_use: "Autonomous development, code generation, implementation"
strengths:
  - Mathematical reasoning and optimization
  - Security vulnerability assessment
  - Performance analysis and tuning
  - Autonomous feature development

optimal_tasks:
  - "Implement complete payment processing system"
  - "Optimize database queries for performance"
  - "Add comprehensive security validation"
  - "Refactor code for better maintainability"

command_examples:
  - "codex --full-auto exec 'Implement JWT authentication system'"
  - "codex --full-auto exec 'Optimize API performance bottlenecks'"
```

### **🔍 Advanced Search Strategies**

#### **Pattern Discovery Commands**
```json
{
  "authentication_patterns": {
    "command": "rg -A 3 -B 3 'authenticate|login|jwt|auth' --type ts --type js | head -50",
    "purpose": "Discover authentication patterns with context",
    "output": "Patterns with surrounding code for analysis"
  },

  "interface_extraction": {
    "command": "rg '^\\s*interface\\s+\\w+' --type ts -A 5 | awk '/interface/{p=1} p&&/^}/{p=0;print}'",
    "purpose": "Extract TypeScript interface definitions",
    "output": "Complete interface definitions for analysis"
  },

  "dependency_analysis": {
    "command": "rg '^import.*from.*auth' --type ts | awk -F'from' '{print $2}' | sort | uniq -c",
    "purpose": "Analyze import dependencies for auth modules",
    "output": "Sorted list of authentication dependencies"
  }
}
```

#### **Combined Analysis Pipelines**
```bash
# Multi-stage analysis pipeline
step1="find . -name '*.ts' -o -name '*.js' | xargs rg -l 'auth|jwt' 2>/dev/null"
step2="rg '^\\s*(function|const\\s+\\w+\\s*=)' --type ts [files_from_step1]"
step3="awk '/^[[:space:]]*interface/{p=1} p&&/^[[:space:]]*}/{p=0;print}' [output]"

# Context merging command
echo "Files: [$step1]; Functions: [$step2]; Interfaces: [$step3]" > combined_analysis.txt
```

---

## 📈 Performance & Optimization

### **System Performance Metrics**

| Operation | Target Performance | Current Performance | Optimization Strategy |
|-----------|-------------------|-------------------|----------------------|
| 🔄 **Session Switch** | <10ms | <5ms average | Atomic file operations |
| 📊 **JSON Query** | <1ms | <0.5ms average | Direct JSON access |
| 🔍 **Context Load** | <5s | <3s average | Intelligent caching |
| 📝 **Doc Update** | <30s | <20s average | Targeted updates only |
| ⚡ **Task Execute** | 10min timeout | Variable | Parallel agent execution |

### **Optimization Strategies**

#### **🚀 Performance Enhancements**
```yaml
json_operations:
  strategy: "Direct JSON manipulation without parsing overhead"
  benefit: "Sub-millisecond query response times"
  implementation: "Native file system operations"

session_management:
  strategy: "Atomic marker file operations"
  benefit: "Zero-overhead context switching"
  implementation: "Single file create/delete operations"

context_caching:
  strategy: "Intelligent context preservation"
  benefit: "Faster subsequent operations"
  implementation: "Memory-based caching with invalidation"

parallel_execution:
  strategy: "Multi-agent parallel task processing"
  benefit: "Reduced overall execution time"
  implementation: "Async agent coordination with dependency management"
```

---

## 🛠️ Development & Extension Guide

### **Adding New Agents**

#### **Agent Development Template**
```markdown
# Agent: [Agent Name]

## Purpose
[Clear description of agent's role and responsibilities]

## Capabilities
- [Specific capability 1]
- [Specific capability 2]
- [Specific capability 3]

## Tools & Integration
- **Primary CLI**: [Gemini|Codex|Both]
- **Templates**: [List of template files used]
- **Output Format**: [JSON schema or format description]

## Task Assignment Logic
```yaml
triggers:
  - keyword: "[keyword pattern]"
  - task_type: "[feature|bugfix|refactor|test|docs]"
  - complexity: "[1-5 scale]"
assignment_priority: "[high|medium|low]"
```

## Implementation
[Code structure and key files]
```

#### **Command Development Pattern**
```yaml
command_structure:
  frontmatter:
    name: "[command-name]"
    description: "[clear description]"
    usage: "[syntax pattern]"
    examples: "[usage examples]"

  content_sections:
    - "## Purpose and Scope"
    - "## Command Syntax"
    - "## Execution Flow"
    - "## Integration Points"
    - "## Error Handling"

file_naming: "[category]/[command-name].md"
location: ".claude/commands/[category]/"
```

### **Template System Extension**

#### **Template Categories**
```yaml
analysis_templates:
  location: ".claude/workflows/cli-templates/prompts/analysis/"
  purpose: "Pattern recognition, architectural understanding"
  primary_tool: "Gemini"

development_templates:
  location: ".claude/workflows/cli-templates/prompts/development/"
  purpose: "Code generation, implementation"
  primary_tool: "Codex"

planning_templates:
  location: ".claude/workflows/cli-templates/prompts/planning/"
  purpose: "Strategic planning, task breakdown"
  tools: "Cross-tool compatible"

role_templates:
  location: ".claude/workflows/cli-templates/planning-roles/"
  purpose: "Specialized perspective templates"
  usage: "Brainstorming and strategic planning"
```

---

## 🔧 Configuration & Customization

### **System Configuration Files**

#### **Core Configuration**
```json
// .claude/settings.local.json
{
  "session_management": {
    "max_concurrent_sessions": 5,
    "auto_cleanup_days": 30,
    "backup_frequency": "daily"
  },

  "performance": {
    "token_limit_gemini": 2000000,
    "execution_timeout": 600000,
    "cache_retention_hours": 24
  },

  "agent_preferences": {
    "default_code_agent": "code-developer",
    "default_analysis_agent": "conceptual-planning-agent",
    "parallel_execution": true
  },

  "cli_integration": {
    "gemini_wrapper_path": "~/.claude/scripts/gemini-wrapper",
    "codex_command": "codex --full-auto exec",
    "auto_approval_modes": true
  }
}
```

### **Custom Agent Configuration**

#### **Agent Priority Matrix**
```yaml
task_assignment_rules:
  feature_development:
    primary: "code-developer"
    secondary: "action-planning-agent"
    review: "code-review-test-agent"

  bug_analysis:
    primary: "conceptual-planning-agent"
    secondary: "code-developer"
    review: "code-review-test-agent"

  architecture_planning:
    primary: "conceptual-planning-agent"
    secondary: "action-planning-agent"
    documentation: "memory-gemini-bridge"

complexity_routing:
  simple_tasks: "direct_execution"  # Skip planning phase
  medium_tasks: "standard_workflow"  # Full planning + execution
  complex_tasks: "multi_agent_orchestration"  # All agents coordinated
```

---

## 📚 Advanced Usage Patterns

### **Enterprise Workflows**

#### **🏢 Large-Scale Development**
```bash
# Multi-team coordination workflow
/workflow:session:start "Microservices Migration Initiative"

# Comprehensive analysis phase
/workflow:brainstorm "microservices architecture strategy" \
  --perspectives=system-architect,data-architect,security-expert,ui-designer

# Parallel team planning
/workflow:plan-deep "service decomposition" --complexity=high --depth=3
/task:breakdown IMPL-1 --strategy=auto --depth=2

# Coordinated implementation
/codex:mode:auto "Implement user service microservice with full test coverage"
/codex:mode:auto "Implement payment service microservice with integration tests"
/codex:mode:auto "Implement notification service microservice with monitoring"

# Cross-service integration
/workflow:review --auto-fix
/update-memory-full
```

#### **🔒 Security-First Development**
```bash
# Security-focused workflow
/workflow:session:start "Security Hardening Initiative"

# Security analysis
/workflow:brainstorm "application security assessment" \
  --perspectives=security-expert,system-architect

# Threat modeling and implementation
/gemini:analyze "security vulnerabilities and threat vectors"
/codex:mode:auto "Implement comprehensive security controls based on threat model"

# Security validation
/workflow:review --auto-fix
/gemini:mode:bug-index "Verify all security controls are properly implemented"
```

---

## 🎯 Best Practices & Guidelines

### **Development Best Practices**

#### **📋 Task Planning Guidelines**
```yaml
effective_planning:
  - "Start with business value, not technical implementation"
  - "Use brainstorming for complex or unfamiliar domains"
  - "Always validate task decomposition against the 4 core standards"
  - "Include integration and testing in every task"
  - "Plan for rollback and error scenarios"

task_sizing:
  - "Aim for 1-3 day completion per task"
  - "Include all related files in single task"
  - "Consider deployment and configuration requirements"
  - "Plan for documentation and knowledge transfer"

quality_gates:
  - "Every task must include tests"
  - "Security review required for user-facing features"
  - "Performance testing for critical paths"
  - "Documentation updates for public APIs"
```

#### **🔍 Analysis Best Practices**
```yaml
effective_analysis:
  - "Use Gemini for understanding, Codex for implementation"
  - "Start with project structure analysis"
  - "Identify 3+ similar patterns before implementing new ones"
  - "Document assumptions and decisions"
  - "Validate analysis with targeted searches"

context_gathering:
  - "Load complete context before making changes"
  - "Use focus_paths for targeted analysis"
  - "Leverage free exploration phase for edge cases"
  - "Combine multiple search strategies"
  - "Cache and reuse analysis results"
```

### **🚨 Common Pitfalls & Solutions**

| Pitfall | Impact | Solution |
|---------|--------|----------|
| **Over-fragmented tasks** | Context switching overhead | Apply 4 core decomposition standards |
| **Missing dependencies** | Build failures, integration issues | Use dependency analysis commands |
| **Insufficient context** | Poor implementation quality | Leverage free exploration phase |
| **Inconsistent patterns** | Maintenance complexity | Always find 3+ similar implementations |
| **Missing tests** | Quality and regression issues | Include testing in every task |

---

## 🔮 Future Enhancements & Roadmap

### **Planned Improvements**

#### **🧠 Enhanced AI Integration**
```yaml
advanced_reasoning:
  - "Multi-step reasoning chains for complex problems"
  - "Self-correcting analysis with validation loops"
  - "Cross-agent knowledge sharing and learning"

intelligent_automation:
  - "Predictive task decomposition based on project history"
  - "Automatic pattern detection and application"
  - "Context-aware template selection and customization"
```

#### **⚡ Performance Optimization**
```yaml
performance_enhancements:
  - "Distributed agent execution across multiple processes"
  - "Intelligent caching with dependency invalidation"
  - "Streaming analysis results for large codebases"

scalability_improvements:
  - "Support for multi-repository workflows"
  - "Enterprise-grade session management"
  - "Team collaboration and shared sessions"
```

#### **🔧 Developer Experience**
```yaml
dx_improvements:
  - "Visual workflow designer and editor"
  - "Interactive task breakdown with AI assistance"
  - "Real-time collaboration and code review"
  - "Integration with popular IDEs and development tools"
```

---

<div align="center">

## 🎯 **CCW Workflow System**

*Advanced multi-agent orchestration for autonomous software development*

**Built for developers, by developers, with AI-first principles**

[![🚀 Get Started](https://img.shields.io/badge/🚀-Get%20Started-brightgreen.svg)](../README.md)
[![📖 Documentation](https://img.shields.io/badge/📖-Full%20Documentation-blue.svg)](https://github.com/catlog22/Claude-Code-Workflow/wiki)

</div>