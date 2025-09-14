---
name: tools-implementation-guide
description: Comprehensive implementation guide for Gemini and Codex CLI tools
type: technical-guideline
---

# Tools Implementation Guide

## 📚 Part A: Shared Resources

### 📁 Template System

**Structure**: `~/.claude/workflows/cli-templates/prompts/`

**Categories**:
- `analysis/` - pattern.txt, architecture.txt, security.txt, performance.txt, quality.txt (Gemini primary, Codex compatible)
- `development/` - feature.txt, component.txt, refactor.txt, testing.txt, debugging.txt (Codex primary)
- `planning/` - task-breakdown.txt, migration.txt (Cross-tool)
- `automation/` - scaffold.txt, migration.txt, deployment.txt (Codex specialized)
- `review/` - code-review.txt (Cross-tool)
- `integration/` - api-design.txt, database.txt (Codex primary)

**Usage**: `$(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt)`

### 📂 File Pattern Wildcards

```bash
*         # Any character (excluding path separators)
**        # Any directory levels (recursive)
?         # Any single character
[abc]     # Any character within the brackets
{a,b,c}   # Any of the options within the braces
```

### 🌐 Cross-Platform Rules

- Always use forward slashes (`/`) for paths
- Enclose paths with spaces in quotes: `@{"My Project/src/**/*"}`
- Escape special characters like brackets: `@{src/**/*\[bracket\]*}`

### ⏱️ Execution Settings

- **Default Timeout**: Bash command execution extended to **10 minutes** for complex analysis and development workflows
- **Error Handling**: Both tools provide comprehensive error logging and recovery mechanisms

---

## 🔍 Part B: Gemini Implementation Guide

### 🚀 Command Overview

- **Purpose**: Comprehensive codebase analysis, context gathering, and pattern detection across multiple files
- **Key Feature**: Large context window for simultaneous multi-file analysis
- **Primary Triggers**: "analyze", "get context", "understand the codebase", relationships between files

### ⭐ Primary Method: gemini-wrapper

**Location**: `~/.claude/scripts/gemini-wrapper` (auto-installed)

**Smart Features**:
- **Token Threshold**: 2,000,000 tokens (configurable via `GEMINI_TOKEN_LIMIT`)
- **Auto `--all-files`**: Small projects get `--all-files`, large projects use patterns
- **Smart Approval Modes**: Analysis tasks use `default`, execution tasks use `yolo`
- **Error Logging**: Captures errors to `~/.claude/.logs/gemini-errors.log`

**Task Detection**:
- **Analysis Keywords**: "analyze", "analysis", "review", "understand", "inspect", "examine" → `--approval-mode default`
- **All Other Tasks**: → `--approval-mode yolo`

### 📝 Gemini Command Syntax

**Basic Structure**:
```bash
gemini [flags] -p "@{patterns} {template} prompt"
```

**Key Arguments**:
- `--all-files`: Includes all files in current working directory
- `-p`: Prompt string with file patterns and analysis query
- `@{pattern}`: Special syntax for referencing files and directories
- `--approval-mode`: Tool approval mode (`default` | `yolo`)
- `--include-directories`: Additional workspace directories (max 5, comma-separated)

### 📦 Gemini Usage Patterns

#### 🎯 Using gemini-wrapper (RECOMMENDED - 90% of tasks)

**Automatic Management**:
```bash
# Analysis task - auto detects and uses --approval-mode default
~/.claude/scripts/gemini-wrapper -p "Analyze authentication module patterns"

# Development task - auto detects and uses --approval-mode yolo
~/.claude/scripts/gemini-wrapper -p "Implement user login feature with JWT"

# Directory-specific analysis
cd src/auth && ~/.claude/scripts/gemini-wrapper -p "Review authentication patterns"

# Custom token threshold
GEMINI_TOKEN_LIMIT=500000 ~/.claude/scripts/gemini-wrapper -p "Custom analysis"
```

**Module-Specific Analysis**:
```bash
# Navigate to module directory
cd src/auth && ~/.claude/scripts/gemini-wrapper -p "Analyze authentication module patterns"

# Template-enhanced analysis
cd frontend/components && ~/.claude/scripts/gemini-wrapper -p "$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)"
```

#### 📝 Direct Gemini Usage (Manual Control)

**Manual Token Management**:
```bash
# Direct control when needed
gemini --all-files -p "Analyze authentication module patterns and implementation"

# Pattern-based fallback
gemini -p "@{src/auth/**/*} @{CLAUDE.md} Analyze authentication patterns"
```

**Template-Enhanced Prompts**:
```bash
# Single template usage
gemini --all-files -p "@{src/**/*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)"

# Multi-template composition
gemini --all-files -p "@{src/**/*} @{CLAUDE.md}
$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)

Additional Security Focus:
$(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt)"
```

**Token Limit Fallback Strategy**:
```bash
# If --all-files exceeds token limits, retry with targeted patterns:

# Original command that failed:
gemini --all-files -p "Analyze authentication patterns"

# Fallback with specific patterns:
gemini -p "@{src/auth/**/*} @{src/middleware/**/*} @{CLAUDE.md} Analyze authentication patterns"

# Focus on specific file types:
gemini -p "@{**/*.ts} @{**/*.js} @{CLAUDE.md} Analyze authentication patterns"
```

### 📋 Gemini File Pattern Rules

**Syntax**:
- `@{pattern}`: Single file or directory pattern
- `@{pattern1,pattern2}`: Multiple patterns, comma-separated

**CLAUDE.md Loading Rules**:
- **With `--all-files`**: CLAUDE.md files automatically included
- **Without `--all-files`**: Must use `@{CLAUDE.md}` or `@{**/CLAUDE.md}`

**When to Use @ Patterns**:
1. User explicitly provides @ patterns - ALWAYS preserve exactly
2. Cross-directory analysis - relationships between modules
3. Configuration files - scattered config files
4. Selective inclusion - specific file types only

### ⚠️ Gemini Best Practices

- **Quote paths with spaces**: Use proper shell quoting
- **Test patterns first**: Validate @ patterns match existing files
- **Prefer directory navigation**: Reduces complexity, improves performance
- **Preserve user patterns**: When user provides @, always keep them
- **Handle token limits**: Immediate retry without `--all-files` using targeted patterns

---

## 🛠️ Part C: Codex Implementation Guide

### 🚀 Command Overview

- **Purpose**: Automated codebase analysis, intelligent code generation, and autonomous development workflows
- **⚠️ CRITICAL**: **NO wrapper script exists** - always use direct `codex` command
- **Key Characteristic**: **No `--all-files` flag** - requires explicit `@` pattern references
- **Default Mode**: `--full-auto exec` autonomous development mode (RECOMMENDED)

### ⭐ CRITICAL: Default to `--full-auto` Mode

**🎯 Golden Rule**: Always start with `codex --full-auto exec "task description"` for maximum autonomous capabilities.

**Why `--full-auto` Should Be Your Default**:
- **🧠 Intelligent File Discovery**: Auto-identifies relevant files without manual `@` patterns
- **🎯 Context-Aware Execution**: Understands project structure and dependencies autonomously
- **⚡ Streamlined Workflow**: No need to specify file patterns - just describe what you want
- **🚀 Maximum Automation**: Leverages full autonomous development capabilities
- **📚 Smart Documentation**: Automatically includes relevant CLAUDE.md files

**When to Use Explicit Patterns**:
- ✅ Precise control over which files are included
- ✅ Specific file patterns requiring manual specification
- ✅ Debugging issues with file discovery in `--full-auto` mode
- ❌ **NOT as default choice** - reserve for special circumstances

### 📝 Codex Command Syntax

**Basic Structure** (Priority Order):
```bash
codex --full-auto exec "autonomous development task"  # DEFAULT & RECOMMENDED
codex --full-auto exec "prompt with @{patterns}"      # For specific control needs
```

**⚠️ NEVER use**: `~/.claude/scripts/codex` - this wrapper script does not exist!

**Key Commands** (In Order of Preference):
- `codex --full-auto exec "..."` ⭐ **PRIMARY MODE** - Full autonomous development
- `codex --cd /path --full-auto exec "..."` - Directory-specific autonomous development
- `codex --cd /path --full-auto exec "@{patterns} ..."` - Directory-specific with patterns

### 📦 Codex Usage Patterns

#### 🎯 Autonomous Development (PRIMARY - 90% of tasks)

**Basic Development**:
```bash
# RECOMMENDED: Let Codex handle everything autonomously
codex --full-auto exec "Implement user authentication with JWT tokens"

# Directory-specific autonomous development
codex --cd src/auth --full-auto exec "Refactor authentication module using latest patterns"

# Complex feature development
codex --full-auto exec "Create a complete todo application with React and TypeScript"
```

**Template-Enhanced Development**:
```bash
# Autonomous mode with template guidance
codex --full-auto exec "$(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)

## Task: User Authentication System
- JWT token management
- Role-based access control
- Password reset functionality"
```

#### 🛠️ Controlled Development (When Explicit Control Needed)

**Module-Specific with Patterns**:
```bash
# Explicit patterns when autonomous mode needs guidance
codex --full-auto exec "@{src/auth/**/*,CLAUDE.md} Refactor authentication module using latest patterns"

# Alternative: Directory-specific execution with explicit patterns
codex --cd src/auth --full-auto exec "@{**/*,../../CLAUDE.md} Refactor authentication module"
```

**Debugging & Analysis**:
```bash
# Autonomous debugging mode
codex --full-auto exec "$(cat ~/.claude/workflows/cli-templates/prompts/development/debugging.txt)

## Issue: Performance degradation in user dashboard
- Identify bottlenecks in the codebase
- Propose and implement optimizations
- Add performance monitoring"

# Alternative: Explicit patterns for controlled analysis
codex --full-auto exec "@{src/**/*,package.json,CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/development/debugging.txt)"
```

### 📂 Codex File Pattern Rules - CRITICAL

⚠️ **UNLIKE GEMINI**: Codex has **NO `--all-files` flag** - you MUST use `@` patterns to reference files.

**Essential Patterns**:
```bash
@{**/*}                    # All files recursively (equivalent to --all-files)
@{src/**/*}               # All source files
@{*.ts,*.js}              # Specific file types
@{CLAUDE.md,**/*CLAUDE.md} # Documentation hierarchy
@{package.json,*.config.*} # Configuration files
```

**CLAUDE.md Loading Rules** (Critical Difference from Gemini):
- **Always explicit**: Must use `@{CLAUDE.md}` or `@{**/*CLAUDE.md}`
- **No automatic loading**: Codex will not include documentation without explicit reference
- **Hierarchical loading**: Use `@{CLAUDE.md,**/*CLAUDE.md}` for complete context

### 🚀 Codex Advanced Patterns

#### 🔄 Multi-Phase Development (Full Autonomous Workflow)

```bash
# Phase 1: Autonomous Analysis
codex --full-auto exec "Analyze current architecture for payment system integration"

# Phase 2: Autonomous Implementation (RECOMMENDED APPROACH)
codex --full-auto exec "Implement Stripe payment integration based on the analyzed architecture"

# Phase 3: Autonomous Testing
codex --full-auto exec "Generate comprehensive tests for the payment system implementation"

# Alternative: Explicit control when needed
codex --full-auto exec "@{**/*,CLAUDE.md} Analyze current architecture for payment system integration"
```

#### 🌐 Cross-Project Learning

```bash
# RECOMMENDED: Autonomous cross-project pattern learning
codex --full-auto exec "Implement feature X by learning patterns from ../other-project/ and applying them to the current codebase"

# Alternative: Explicit pattern specification
codex --full-auto exec "@{../other-project/src/**/*,src/**/*,CLAUDE.md} Implement feature X using patterns from other-project"
```

#### 📊 Development Workflow Integration

**Pre-Development Analysis**:
```bash
# RECOMMENDED: Autonomous pattern analysis
codex --full-auto exec "$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)

Analyze the existing codebase patterns and conventions before implementing new features."
```

**Quality Assurance**:
```bash
# RECOMMENDED: Autonomous testing and validation
codex --full-auto exec "$(cat ~/.claude/workflows/cli-templates/prompts/development/testing.txt)

Generate comprehensive tests and perform validation for the entire codebase."
```

### ⚠️ Codex Best Practices

**Always Use @ Patterns**:
- **MANDATORY**: Codex requires explicit file references via `@` patterns (when not using full-auto autonomous mode)
- **No automatic inclusion**: Unlike Gemini's `--all-files`, you must specify what to analyze
- **Be comprehensive**: Use `@{**/*}` for full codebase context when needed
- **Be selective**: Use specific patterns like `@{src/**/*.ts}` for targeted analysis

**Default Automation Mode** (CRITICAL GUIDANCE):
- **`codex --full-auto exec` is PRIMARY choice**: Use for 90% of all tasks - maximizes autonomous capabilities
- **Explicit patterns only when necessary**: Reserve for cases where you need explicit file pattern control
- **Trust the autonomous intelligence**: Codex excels at file discovery, context gathering, and architectural decisions
- **Start with full-auto always**: If it doesn't meet needs, then consider explicit patterns

**Error Prevention**:
- **Always include @ patterns**: Commands without file references will fail (except in full-auto mode)
- **Test patterns first**: Validate @ patterns match existing files
- **Use comprehensive patterns**: `@{**/*}` when unsure of file structure
- **Include documentation**: Always add `@{CLAUDE.md,**/*CLAUDE.md}` for context when using explicit patterns
- **Quote complex paths**: Use proper shell quoting for paths with spaces

---

## 🎯 Strategic Integration

### Template Reuse Across Tools

**Gemini and Codex Template Compatibility**:
- **`cat` command works identically**: Reuse templates seamlessly between tools
- **Cross-reference patterns**: Combine analysis and development templates
- **Template composition**: Build complex prompts from multiple template sources

### Autonomous Development Pattern (Codex-Specific)

1. **Context Gathering**: `@{**/*,CLAUDE.md}` for full project understanding (or let full-auto handle)
2. **Pattern Analysis**: Understand existing code conventions
3. **Automated Implementation**: Let codex handle the development workflow
4. **Quality Assurance**: Built-in testing and validation

---

**Remember**:
- **Gemini excels at understanding** - use `~/.claude/scripts/gemini-wrapper` for analysis and pattern recognition
- **Codex excels at building** - use `codex --full-auto exec` for autonomous development and implementation