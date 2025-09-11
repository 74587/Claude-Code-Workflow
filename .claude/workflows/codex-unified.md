---
name: codex-unified
description: Comprehensive Codex CLI guidelines - core rules, syntax, patterns, templates, and best practices with automation focus
type: technical-guideline
---

### 🚀 Command Overview: `codex`

-   **Purpose**: An AI-powered CLI tool for automated codebase analysis, intelligent code generation, and autonomous development workflows.
-   **Key Characteristic**: **No `--all-files` flag** - requires explicit `@` pattern references for file inclusion.
-   **Directory Analysis Rule**: When user intends to analyze specific directory (cd XXX), use: `codex --cd XXX exec "@{**/*} prompt"` or `cd XXX && codex exec "@{**/*} prompt"`
-   **Default Mode**: `--full-auto` autonomous development mode (RECOMMENDED for all tasks).
-   **Primary Triggers**:
    -   When user needs automated code generation or refactoring.
    -   When task requires intelligent analysis with autonomous execution.
    -   When building complex features or applications from scratch.
-   **Core Use Cases**:
    -   Automated application development.
    -   Intelligent code refactoring and optimization.
    -   Context-aware feature implementation.
    -   Autonomous debugging and problem-solving.

### ⭐ **CRITICAL: Default to `--full-auto` Mode**

> **🎯 Golden Rule**: Always start with `codex --full-auto "your task description"` for maximum autonomous capabilities. This is the recommended approach for 90% of development tasks.

**Why `--full-auto` Should Be Your Default:**
- **🧠 Intelligent File Discovery**: Codex automatically identifies relevant files without manual `@` patterns
- **🎯 Context-Aware Execution**: Understands project structure and dependencies autonomously  
- **⚡ Streamlined Workflow**: No need to specify file patterns - just describe what you want
- **🚀 Maximum Automation**: Leverages full autonomous development capabilities
- **📚 Smart Documentation**: Automatically includes relevant CLAUDE.md files and project context

**When to Use `codex exec` Instead:**
- ✅ When you need precise control over which files are included
- ✅ When working with specific file patterns that require manual specification
- ✅ When debugging issues with file discovery in `--full-auto` mode
- ❌ **NOT as a default choice** - reserve for special circumstances

### ⚙️ Command Syntax & Arguments

-   **Basic Structure** (Priority Order):
    ```bash
    codex --full-auto "autonomous development task"  # DEFAULT & RECOMMENDED
    codex exec "prompt with @{patterns}"              # For specific control needs
    ```
-   **Key Commands** (In Order of Preference):
    -   `codex --full-auto "..."` ⭐ **PRIMARY MODE** - Full autonomous development
    -   `codex exec "..."` - Controlled execution when you need specific patterns
    -   `codex --cd /path --full-auto "..."` - Directory-specific autonomous development

-   **Template Usage** (Preferred Approaches):
    ```bash
    # RECOMMENDED: Full autonomous mode (let Codex handle file discovery)
    codex --full-auto "Refactor authentication system using best practices"
    
    # Alternative: Direct execution with explicit patterns
    codex exec "@{src/**/*} @{CLAUDE.md} Refactor authentication system"
    
    # Advanced: Template injection with autonomous mode
    codex --full-auto "$(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)
    
    ## Task: Authentication System Refactoring
    - Apply modern security patterns
    - Improve code organization
    - Add comprehensive tests"
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

> **📋 Complete Template Reference**: See [Shared Template System](./shared-template-system.md) for comprehensive template directory structure, cross-tool compatibility, and detailed usage patterns.

> **💡 Cross-Tool Usage**: Analysis templates (`analysis/`) work with Codex for understanding existing code before development. See shared template system for complete compatibility matrix.

### 📦 Standard Command Structures

-   **Module-Specific Development**
    ```bash
    # RECOMMENDED: Full autonomous mode with directory context
    codex --cd src/auth --full-auto "Refactor authentication module using latest patterns"
    
    # Alternative: Full autonomous mode with explicit task description
    codex --full-auto "Refactor the authentication module in src/auth/ using latest security patterns"
    
    # Fallback: Explicit patterns when autonomous mode needs guidance
    codex exec "@{src/auth/**/*,CLAUDE.md} Refactor authentication module using latest patterns"
    ```

-   **Basic Development Task**
    ```bash
    # RECOMMENDED: Let Codex handle everything autonomously
    codex --full-auto "Implement user authentication with JWT tokens"
    
    # Alternative: Explicit file patterns if needed
    codex exec "@{src/**/*,*.json,CLAUDE.md} Implement user authentication with JWT"
    ```

-   **Template-Enhanced Development**
    ```bash
    # RECOMMENDED: Autonomous mode with template guidance
    codex --full-auto "$(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)
    
    ## Task: User Authentication System
    - JWT token management
    - Role-based access control
    - Password reset functionality"
    
    # Alternative: Explicit patterns with templates
    codex exec "@{src/**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)"
    ```

-   **Full Auto Mode (PRIMARY RECOMMENDATION)**
    ```bash
    # OPTIMAL: Let Codex discover files and handle everything
    codex --full-auto "Create a complete todo application with React and TypeScript"
    
    # Alternative: Explicit patterns if you want to control file scope
    codex --full-auto "@{**/*} Create a complete todo application with React and TypeScript"
    ```

-   **Debugging & Analysis**
    ```bash
    # RECOMMENDED: Autonomous debugging mode
    codex --full-auto "$(cat ~/.claude/workflows/cli-templates/prompts/development/debugging.txt)
    
    ## Issue: Performance degradation in user dashboard
    - Identify bottlenecks in the codebase
    - Propose and implement optimizations
    - Add performance monitoring"
    
    # Alternative: Explicit patterns for controlled analysis
    codex exec "@{src/**/*,package.json,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/debugging.txt)"
    ```

### ⭐ Best Practices & Rules

#### 🎯 Codex-Specific Guidelines

**Always Use @ Patterns:**
- **MANDATORY**: Codex requires explicit file references via `@` patterns
- **No automatic inclusion**: Unlike gemini's `--all-files`, you must specify what to analyze
- **Be comprehensive**: Use `@{**/*}` for full codebase context when needed
- **Be selective**: Use specific patterns like `@{src/**/*.ts}` for targeted analysis

**Default Automation Mode (CRITICAL GUIDANCE):**
- **`--full-auto` is the PRIMARY choice**: Use for 90% of all tasks - maximizes autonomous capabilities
- **`codex exec` only when necessary**: Reserve for cases where you need explicit file pattern control
- **Trust the autonomous intelligence**: Codex excels at file discovery, context gathering, and architectural decisions
- **Start with `--full-auto` always**: If it doesn't meet needs, then consider `exec` mode

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
# RECOMMENDED: Autonomous pattern analysis
codex --full-auto "$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)

Analyze the existing codebase patterns and conventions before implementing new features."

# Alternative: Explicit patterns if needed
codex exec "@{src/**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)"
```

**Feature Development:**
```bash
# RECOMMENDED: Full autonomous feature development
codex --full-auto "$(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)

## Feature: Advanced Search Functionality
- Full-text search capabilities
- Filter and sort options
- Performance optimization
- Integration with existing UI components"

# Alternative: Explicit patterns when needed
codex exec "@{**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)"
```

**Quality Assurance:**
```bash
# RECOMMENDED: Autonomous testing and validation
codex --full-auto "$(cat ~/.claude/workflows/cli-templates/prompts/development/testing.txt)

Generate comprehensive tests and perform validation for the entire codebase."

# Alternative: Specific test scope control
codex exec "@{src/**/*,test/**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/testing.txt)"
```

### 🎨 Advanced Usage Patterns

**Multi-Phase Development (Full Autonomous Workflow):**
```bash
# Phase 1: Autonomous Analysis
codex --full-auto "Analyze current architecture for payment system integration"

# Phase 2: Autonomous Implementation (RECOMMENDED APPROACH)
codex --full-auto "Implement Stripe payment integration based on the analyzed architecture"

# Phase 3: Autonomous Testing
codex --full-auto "Generate comprehensive tests for the payment system implementation"

# Alternative: Explicit control when needed
codex exec "@{**/*,CLAUDE.md} Analyze current architecture for payment system integration"
```

**Cross-Project Learning:**
```bash
# RECOMMENDED: Autonomous cross-project pattern learning
codex --full-auto "Implement feature X by learning patterns from ../other-project/ and applying them to the current codebase"

# Alternative: Explicit pattern specification
codex exec "@{../other-project/src/**/*,src/**/*,CLAUDE.md} Implement feature X using patterns from other-project"
```

Remember: **Codex excels at autonomous development** - `--full-auto` mode should be your default choice. Trust its intelligence for file discovery, context gathering, and implementation decisions. Use explicit `@` patterns only when you need precise control over file scope.