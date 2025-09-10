---
name: codex-unified
description: Comprehensive Codex CLI guidelines - core rules, syntax, patterns, templates, and best practices with automation focus
type: technical-guideline
---

### 🚀 Command Overview: `codex`

-   **Purpose**: An AI-powered CLI tool for automated codebase analysis, intelligent code generation, and autonomous development workflows.
-   **Key Characteristic**: **No `--all-files` flag** - requires explicit `@` pattern references for file inclusion.
-   **Default Mode**: `--full-auto` automation mode for autonomous task execution.
-   **Primary Triggers**:
    -   When user needs automated code generation or refactoring.
    -   When task requires intelligent analysis with autonomous execution.
    -   When building complex features or applications from scratch.
-   **Core Use Cases**:
    -   Automated application development.
    -   Intelligent code refactoring and optimization.
    -   Context-aware feature implementation.
    -   Autonomous debugging and problem-solving.

### ⚙️ Command Syntax & Arguments

-   **Basic Structure**:
    ```bash
    codex exec "prompt with @{patterns}"
    codex --full-auto "automated development task"
    ```
-   **Key Commands**:
    -   `codex exec "..."` ≡ `gemini -p "..."` (non-interactive automation mode)
    -   `codex --full-auto "..."` (default autonomous development mode)
    -   `codex --cd /path "..."` (specify working directory)

-   **Template Usage**:
    ```bash
    # Direct execution (most common)
    codex exec "@{src/**/*} @{CLAUDE.md} Refactor authentication system"
    
    # With template injection
    codex exec "@{src/**/*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)"
    
    # Multi-template composition
    codex exec "@{src/**/*} @{CLAUDE.md} $(cat <<'EOF'
    $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt)
    
    Development Focus:
    $(cat ~/.claude/workflows/cli-templates/prompts/development/component.txt)
    EOF
    )"
    ```

### 📂 File Pattern Rules - **CRITICAL FOR CODEX**

⚠️ **UNLIKE GEMINI**: Codex has **NO `--all-files` flag** - you MUST use `@` patterns to reference files.

-   **Syntax**:
    -   `@{pattern}`: Single file or directory pattern.
    -   `@{pattern1,pattern2}`: Multiple patterns, comma-separated.
-   **Essential Patterns**:
    ```bash
    @{**/*}                    # All files recursively (equivalent to --all-files)
    @{src/**/*}               # All source files
    @{*.ts,*.js}              # Specific file types
    @{CLAUDE.md,**/*CLAUDE.md} # Documentation hierarchy
    @{package.json,*.config.*} # Configuration files
    ```
-   **Cross-Platform Rules**:
    -   Always use forward slashes (`/`) for paths.
    -   Enclose paths with spaces in quotes: `@{"My Project/src/**/*"}`.
    -   Escape special characters like brackets: `@{src/**/*\[bracket\]*}`.

### 📁 Shared Template Directory Structure

Templates are shared between gemini and codex. This structure must be located at `~/.claude/workflows/cli-templates/`.

```
~/.claude/workflows/cli-templates/
├── prompts/
│   ├── development/    # Automated development templates
│   │   ├── feature.txt      # 🔧 Feature implementation & integration
│   │   ├── component.txt    # 🧩 Component design & development
│   │   ├── refactor.txt     # 🔄 Code refactoring & optimization
│   │   ├── testing.txt      # 🧪 Test generation & validation
│   │   └── debugging.txt    # 🐛 Bug analysis & resolution
│   ├── automation/     # Autonomous workflow templates
│   │   ├── scaffold.txt     # 🏗️ Project scaffolding & setup
│   │   ├── migration.txt    # 🚀 Automated migration & upgrades
│   │   └── deployment.txt   # 🚢 CI/CD & deployment automation
│   ├── analysis/       # Inherited from gemini templates
│   │   ├── pattern.txt      # ✨ Implementation patterns & conventions
│   │   ├── architecture.txt # 🏗️ System architecture & dependencies
│   │   ├── security.txt     # 🔒 Security vulnerabilities & protection
│   │   ├── performance.txt  # ⚡ Performance bottlenecks & optimization
│   │   └── quality.txt      # 📊 Code quality & maintainability
│   └── integration/    # Cross-system templates
│       ├── api-design.txt   # 🌐 API design & implementation
│       └── database.txt     # 🗄️ Database schema & operations
└── commands/          # Command examples and patterns
```

### 🧭 Template Selection Guide

| Task Type | Primary Template | Purpose | Codex Advantage |
|---|---|---|---|
| Build New Feature | `feature.txt` | End-to-end feature development | Autonomous implementation |
| Create Component | `component.txt` | Reusable component development | Pattern-aware generation |
| Refactor Code | `refactor.txt` | Code improvement & optimization | Context-aware refactoring |
| Generate Tests | `testing.txt` | Comprehensive test coverage | Intelligent test generation |
| Debug Issues | `debugging.txt` | Problem analysis & resolution | Root cause identification |
| Scaffold Project | `scaffold.txt` | Project structure creation | Best practice templates |
| Migrate Systems | `migration.txt` | Technology upgrades | Automated migration paths |
| API Development | `api-design.txt` | API design & implementation | RESTful pattern adherence |

### 📦 Standard Command Structures

-   **Module-Specific Development (Folder Analysis Required)**
    ```bash
    # MUST use @{folder/**/*} pattern since codex has no --all-files
    codex exec "@{src/auth/**/*,CLAUDE.md} Refactor authentication module using latest patterns"
    
    # Alternative: use --cd flag to navigate + include folder
    codex --cd src/auth exec "@{**/*,../../CLAUDE.md} Implement JWT refresh token functionality"
    
    # For comprehensive module analysis
    codex exec "@{backend/services/**/*,package.json,CLAUDE.md} Optimize service layer performance"
    ```

-   **Basic Development Task**
    ```bash
    codex exec "@{src/**/*,*.json,CLAUDE.md} Implement user authentication with JWT"
    ```

-   **Template-Enhanced Development**
    ```bash
    codex exec "@{src/**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)
    
    ## Task: User Authentication System
    - JWT token management
    - Role-based access control
    - Password reset functionality"
    ```

-   **Full Auto Mode (Default)**
    ```bash
    codex --full-auto "@{**/*} Create a complete todo application with React and TypeScript"
    ```

-   **Debugging & Analysis**
    ```bash
    codex exec "@{src/**/*,package.json,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/debugging.txt)
    
    ## Issue: Performance degradation in user dashboard
    - Identify bottlenecks
    - Propose optimizations
    - Implement solutions"
    ```

### ⭐ Best Practices & Rules

#### 🎯 Codex-Specific Guidelines

**Always Use @ Patterns:**
- **MANDATORY**: Codex requires explicit file references via `@` patterns
- **No automatic inclusion**: Unlike gemini's `--all-files`, you must specify what to analyze
- **Be comprehensive**: Use `@{**/*}` for full codebase context when needed
- **Be selective**: Use specific patterns like `@{src/**/*.ts}` for targeted analysis

**Default Automation Mode:**
- **`--full-auto` is preferred**: Maximizes autonomous capabilities
- **`codex exec` for specific tasks**: Use when you need precise control
- **Let codex decide**: Trust the AI's architectural decisions in auto mode

#### 📋 CLAUDE.md Loading Rules

**Critical Difference from Gemini:**
- **Always explicit**: Must use `@{CLAUDE.md}` or `@{**/*CLAUDE.md}`
- **No automatic loading**: Codex will not include documentation without explicit reference
- **Hierarchical loading**: Use `@{CLAUDE.md,**/*CLAUDE.md}` for complete context

#### ⚠️ Error Prevention

-   **Always include @ patterns**: Commands without file references will fail
-   **Test patterns first**: Validate @ patterns match existing files
-   **Use comprehensive patterns**: `@{**/*}` when unsure of file structure
-   **Include documentation**: Always add `@{CLAUDE.md,**/*CLAUDE.md}` for context
-   **Quote complex paths**: Use proper shell quoting for paths with spaces

#### 🔄 Template Reuse

**Compatibility with Gemini Templates:**
- **`cat` command works identically**: Reuse gemini templates seamlessly
- **Cross-reference patterns**: Combine analysis and development templates
- **Template composition**: Build complex prompts from multiple template sources

#### 🚀 Automation Workflow

**Autonomous Development Pattern:**
1. **Context Gathering**: `@{**/*,CLAUDE.md}` for full project understanding
2. **Pattern Analysis**: Understand existing code conventions
3. **Automated Implementation**: Let codex handle the development workflow
4. **Quality Assurance**: Built-in testing and validation

### 📊 Codex vs Gemini Quick Reference

| Feature | Codex | Gemini |
|---------|--------|---------|
| File Loading | `@` patterns **required** | `--all-files` available |
| Default Mode | `--full-auto` automation | Interactive analysis |
| Primary Use | Development & implementation | Analysis & planning |
| Template Support | Full compatibility via `cat` | Native template system |
| Automation Level | Autonomous execution | Manual implementation |
| Working Directory | `--cd` flag support | Current directory |

### 🎯 Integration with Development Workflow

**Pre-Development Analysis:**
```bash
# Understand existing patterns before implementing
codex exec "@{src/**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)"
```

**Feature Development:**
```bash
# Implement new feature with full context
codex exec "@{**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)

## Feature: Advanced Search Functionality
- Full-text search capabilities
- Filter and sort options
- Performance optimization"
```

**Quality Assurance:**
```bash
# Comprehensive testing and validation
codex exec "@{src/**/*,test/**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/testing.txt)"
```

### 🎨 Advanced Usage Patterns

**Multi-Phase Development:**
```bash
# Phase 1: Analysis
codex exec "@{**/*,CLAUDE.md} Analyze current architecture for payment system integration"

# Phase 2: Implementation
codex --full-auto "@{**/*,CLAUDE.md} Implement Stripe payment integration with the analyzed architecture"

# Phase 3: Testing
codex exec "@{**/*,CLAUDE.md} Generate comprehensive tests for the payment system"
```

**Cross-Project Learning:**
```bash
# Learn from similar implementations
codex exec "@{../other-project/src/**/*,src/**/*,CLAUDE.md} Implement feature X using patterns from other-project"
```

Remember: **Codex excels at autonomous development** - trust its intelligence while providing comprehensive context through proper `@` pattern usage.