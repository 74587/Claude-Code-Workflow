---
name: codex-unified
description: Comprehensive Codex CLI guidelines - core rules, syntax, patterns, templates, and best practices with automation focus
type: technical-guideline
---

### 🚀 Command Overview: Bash(codex *)

-   **Purpose**: An AI-powered CLI tool for automated codebase analysis, intelligent code generation, and autonomous development workflows.
-   **⚠️ CRITICAL**: **NO wrapper script exists** - always use direct `codex` command, never `~/.claude/scripts/codex`
-   **Key Characteristic**: **No `--all-files` flag** - requires explicit `@` pattern references for file inclusion.
-   **Directory Analysis Rule**: When user intends to analyze specific directory (cd XXX), use: `bash(codex --cd XXX --full-auto exec "prompt")` or `bash(cd XXX && codex --full-auto exec "@{**/*} prompt")`
-   **Default Mode**: `--full-auto exec` autonomous development mode (RECOMMENDED for all tasks).
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

> **🎯 Golden Rule**: Always start with `bash(codex --full-auto exec "your task description")` for maximum autonomous capabilities. This is the recommended approach for 90% of development tasks.

**Why `bash(codex --full-auto)` Should Be Your Default:**
- **🧠 Intelligent File Discovery**: Codex automatically identifies relevant files without manual `@` patterns
- **🎯 Context-Aware Execution**: Understands project structure and dependencies autonomously  
- **⚡ Streamlined Workflow**: No need to specify file patterns - just describe what you want
- **🚀 Maximum Automation**: Leverages full autonomous development capabilities
- **📚 Smart Documentation**: Automatically includes relevant CLAUDE.md files and project context

**When to Use `bash(codex --full-auto exec)` with Explicit Patterns:**
- ✅ When you need precise control over which files are included
- ✅ When working with specific file patterns that require manual specification
- ✅ When debugging issues with file discovery in `--full-auto` mode
- ❌ **NOT as a default choice** - reserve for special circumstances

### ⚙️ Command Syntax & Arguments

-   **Basic Structure** (Priority Order):
    ```bash
    bash(codex --full-auto exec "autonomous development task")  # DEFAULT & RECOMMENDED
    bash(codex --full-auto exec "prompt with @{patterns}")      # For specific control needs
    ```

    **⚠️ NEVER use**: `~/.claude/scripts/codex` - this wrapper script does not exist!
-   **Key Commands** (In Order of Preference):
    -   `bash(codex --full-auto exec "...")` ⭐ **PRIMARY MODE** - Full autonomous development
    -   `bash(codex --full-auto exec "...")` - Controlled execution when you need specific patterns
    -   `bash(codex --cd /path --full-auto exec "...")` - Directory-specific autonomous development
    -   `bash(codex --cd /path --full-auto exec "@{patterns} ...")` - Directory-specific execution with patterns

-   **Template Usage** (Preferred Approaches):
    ```bash
    # RECOMMENDED: Full autonomous mode (let Codex handle file discovery)
    bash(codex --full-auto exec "Refactor authentication system using best practices")
    
    # Alternative: Direct execution with explicit patterns
    bash(codex --full-auto exec "@{src/**/*} @{CLAUDE.md} Refactor authentication system")
    
    # Advanced: Template injection with autonomous mode
    bash(codex --full-auto exec "$(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)
    
    ## Task: Authentication System Refactoring
    - Apply modern security patterns
    - Improve code organization
    - Add comprehensive tests")
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

### ⏱️ Execution Settings

-   **Default Timeout**: Bash command execution extended to **10 minutes** to handle complex autonomous development workflows.
-   **Autonomous Intelligence**: Codex automatically manages file discovery and context gathering in `--full-auto` mode.

### 📁 Templates

**Structure**: `~/.claude/workflows/cli-templates/prompts/`

**Categories**:
- `analysis/` - pattern.txt, architecture.txt, security.txt, performance.txt, quality.txt (Gemini primary, Codex compatible)
- `development/` - feature.txt, component.txt, refactor.txt, testing.txt, debugging.txt (Codex primary)
- `planning/` - task-breakdown.txt, migration.txt (Cross-tool)
- `automation/` - scaffold.txt, migration.txt, deployment.txt (Codex specialized)
- `review/` - code-review.txt (Cross-tool)
- `integration/` - api-design.txt, database.txt (Codex primary)

**Usage**: `$(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt)`

### 📦 Standard Command Structures

-   **Module-Specific Development**
    ```bash
    # RECOMMENDED: Full autonomous mode with directory context
    bash(codex --cd src/auth --full-auto exec "Refactor authentication module using latest patterns")
    
    # Alternative: Full autonomous mode with explicit task description
    bash(codex --full-auto exec "Refactor the authentication module in src/auth/ using latest security patterns")
    
    # Fallback: Explicit patterns when autonomous mode needs guidance  
    bash(codex --full-auto exec "@{src/auth/**/*,CLAUDE.md} Refactor authentication module using latest patterns")
    
    # Alternative: Directory-specific execution with explicit patterns
    bash(codex --cd src/auth --full-auto exec "@{**/*,../../CLAUDE.md} Refactor authentication module using latest patterns")
    ```

-   **Basic Development Task**
    ```bash
    # RECOMMENDED: Let Codex handle everything autonomously
    bash(codex --full-auto exec "Implement user authentication with JWT tokens")
    
    # Alternative: Explicit file patterns if needed
    bash(codex --full-auto exec "@{src/**/*,*.json,CLAUDE.md} Implement user authentication with JWT")
    ```

-   **Template-Enhanced Development**
    ```bash
    # RECOMMENDED: Autonomous mode with template guidance
    bash(codex --full-auto exec "$(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)
    
    ## Task: User Authentication System
    - JWT token management
    - Role-based access control
    - Password reset functionality")
    
    # Alternative: Explicit patterns with templates
    bash(codex --full-auto exec "@{src/**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)")
    ```

-   **Full Auto Mode (PRIMARY RECOMMENDATION)**
    ```bash
    # OPTIMAL: Let Codex discover files and handle everything
    bash(codex --full-auto exec "Create a complete todo application with React and TypeScript")
    
    # Alternative: Explicit patterns if you want to control file scope
    bash(codex --full-auto exec "@{**/*} Create a complete todo application with React and TypeScript")
    ```

-   **Debugging & Analysis**
    ```bash
    # RECOMMENDED: Autonomous debugging mode
    bash(codex --full-auto exec "$(cat ~/.claude/workflows/cli-templates/prompts/development/debugging.txt)
    
    ## Issue: Performance degradation in user dashboard
    - Identify bottlenecks in the codebase
    - Propose and implement optimizations
    - Add performance monitoring")
    
    # Alternative: Explicit patterns for controlled analysis
    bash(codex --full-auto exec "@{src/**/*,package.json,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/debugging.txt)")
    ```

### ⭐ Best Practices & Rules

#### 🎯 Codex-Specific Guidelines

**Always Use @ Patterns:**
- **MANDATORY**: Codex requires explicit file references via `@` patterns
- **No automatic inclusion**: Unlike gemini's `--all-files`, you must specify what to analyze
- **Be comprehensive**: Use `@{**/*}` for full codebase context when needed
- **Be selective**: Use specific patterns like `@{src/**/*.ts}` for targeted analysis

**Default Automation Mode (CRITICAL GUIDANCE):**
- **`bash(codex --full-auto exec)` is the PRIMARY choice**: Use for 90% of all tasks - maximizes autonomous capabilities
- **`bash(codex --full-auto exec)` with explicit patterns only when necessary**: Reserve for cases where you need explicit file pattern control
- **Trust the autonomous intelligence**: Codex excels at file discovery, context gathering, and architectural decisions
- **Start with `bash(codex --full-auto exec)` always**: If it doesn't meet needs, then consider explicit patterns with `exec` mode

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
| Default Mode | `--full-auto exec` automation | Interactive analysis |
| Primary Use | Development & implementation | Analysis & planning |
| Template Support | Full compatibility via `cat` | Native template system |
| Automation Level | Autonomous execution | Manual implementation |
| Working Directory | `--cd` flag support | Current directory |

### 🎯 Integration with Development Workflow

**Pre-Development Analysis:**
```bash
# RECOMMENDED: Autonomous pattern analysis
bash(codex --full-auto exec "$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)

Analyze the existing codebase patterns and conventions before implementing new features.")

# Alternative: Explicit patterns if needed
bash(codex --full-auto exec "@{src/**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)")
```

**Feature Development:**
```bash
# RECOMMENDED: Full autonomous feature development
bash(codex --full-auto exec "$(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)

## Feature: Advanced Search Functionality
- Full-text search capabilities
- Filter and sort options
- Performance optimization
- Integration with existing UI components")

# Alternative: Explicit patterns when needed
bash(codex --full-auto exec "@{**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)")
```

**Quality Assurance:**
```bash
# RECOMMENDED: Autonomous testing and validation
bash(codex --full-auto exec "$(cat ~/.claude/workflows/cli-templates/prompts/development/testing.txt)

Generate comprehensive tests and perform validation for the entire codebase.")

# Alternative: Specific test scope control
bash(codex --full-auto exec "@{src/**/*,test/**/*,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/testing.txt)")
```

### 🎨 Advanced Usage Patterns

**Multi-Phase Development (Full Autonomous Workflow):**
```bash
# Phase 1: Autonomous Analysis
bash(codex --full-auto exec "Analyze current architecture for payment system integration")

# Phase 2: Autonomous Implementation (RECOMMENDED APPROACH)
bash(codex --full-auto exec "Implement Stripe payment integration based on the analyzed architecture")

# Phase 3: Autonomous Testing
bash(codex --full-auto exec "Generate comprehensive tests for the payment system implementation")

# Alternative: Explicit control when needed
bash(codex --full-auto exec "@{**/*,CLAUDE.md} Analyze current architecture for payment system integration")
```

**Cross-Project Learning:**
```bash
# RECOMMENDED: Autonomous cross-project pattern learning
bash(codex --full-auto exec "Implement feature X by learning patterns from ../other-project/ and applying them to the current codebase")

# Alternative: Explicit pattern specification
bash(codex --full-auto exec "@{../other-project/src/**/*,src/**/*,CLAUDE.md} Implement feature X using patterns from other-project")
```

Remember: **Codex excels at autonomous development** - `bash(codex --full-auto exec)` mode should be your default choice. Trust its intelligence for file discovery, context gathering, and implementation decisions. Use explicit `@` patterns with `bash(codex --full-auto exec)` only when you need precise control over file scope.