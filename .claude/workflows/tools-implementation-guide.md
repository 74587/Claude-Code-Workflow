---
name: tools-implementation-guide
description: Comprehensive implementation guide for Gemini and Codex CLI tools
type: technical-guideline
---

# Tools Implementation Guide

## 🚀 Quick Start

### ⚡ Tool Selection at a Glance

| Tool | Primary Use | Command Pattern | File Loading | Best For |
|------|-------------|-----------------|---------------|-----------|
| **Gemini** | Analysis & Understanding | `~/.claude/scripts/gemini-wrapper -p "prompt"` | `--all-files` or `@{patterns}` | Large context analysis, pattern detection |
| **Codex** | Development & Implementation | `codex --full-auto exec "task" -s danger-full-access` | `@{patterns}` or autonomous discovery | Feature development, automation |

### 🎯 Quick Commands

**Gemini (Analysis)**:
```bash
# Pattern analysis
~/.claude/scripts/gemini-wrapper -p "analyze authentication patterns"

# Architecture review
cd src && ~/.claude/scripts/gemini-wrapper -p "review overall architecture"
```

**Codex (Development)**:
```bash
# Autonomous feature development
codex --full-auto exec "implement JWT authentication system" -s danger-full-access

# Targeted development
codex --cd src/auth --full-auto exec "refactor authentication module" -s danger-full-access
```

### ⚠️ Critical Differences

| Aspect | Gemini | Codex |
|--------|--------|--------|
| **Wrapper Script** | ✅ Has wrapper: `~/.claude/scripts/gemini-wrapper` | ❌ No wrapper: direct `codex` command only |
| **File Discovery** | Auto `--all-files` for small projects | Autonomous discovery with `--full-auto` |
| **Sandbox Mode** | Not required | 🔒 Required: `-s danger-full-access` |
| **Default Mode** | Interactive analysis | Autonomous execution |

---

## 📚 Shared Resources

### 📁 Template System

**Base Structure**: `~/.claude/workflows/cli-templates/`

#### Prompt Templates (`prompts/`)
```
analysis/        # Gemini primary, Codex compatible
├── pattern.txt      - Code pattern analysis
├── architecture.txt - System architecture review
├── security.txt     - Security assessment
├── performance.txt  - Performance analysis
└── quality.txt      - Code quality review

development/     # Codex primary
├── feature.txt      - Feature implementation
├── component.txt    - Component development
├── refactor.txt     - Refactoring tasks
├── testing.txt      - Test generation
└── debugging.txt    - Debug and fix issues

planning/        # Cross-tool compatible
├── task-breakdown.txt - Task decomposition
└── migration.txt      - Migration planning

automation/      # Codex specialized
├── scaffold.txt     - Project scaffolding
├── migration.txt    - Data migration
└── deployment.txt   - Deployment automation

review/          # Cross-tool compatible
└── code-review.txt  - Code review process

integration/     # Codex primary
├── api-design.txt   - API specification
└── database.txt     - Database design
```

**Usage**: `$(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt)`

#### Planning Role Templates (`planning-roles/`)
- **business-analyst.md** - Business requirements analysis
- **data-architect.md** - Data modeling and architecture
- **feature-planner.md** - Feature specification
- **innovation-lead.md** - Technology exploration
- **product-manager.md** - Product roadmap
- **security-expert.md** - Security architecture
- **system-architect.md** - System design
- **test-strategist.md** - Testing strategy
- **ui-designer.md** - UI/UX design
- **user-researcher.md** - User research

**Usage**: `$(cat ~/.claude/workflows/cli-templates/planning-roles/[role].md)`

#### Tech Stack Templates (`tech-stacks/`)
- **go-dev.md** - Go development patterns
- **java-dev.md** - Java enterprise standards
- **javascript-dev.md** - JavaScript fundamentals
- **python-dev.md** - Python conventions
- **react-dev.md** - React architecture
- **typescript-dev.md** - TypeScript guidelines

**Usage**: `$(cat ~/.claude/workflows/cli-templates/tech-stacks/[stack]-dev.md)`

### 📂 File Pattern Reference

#### Universal Patterns
```bash
*                      # Any character (excluding path separators)
**                     # Any directory levels (recursive)
?                      # Any single character
[abc]                  # Any character within brackets
{a,b,c}                # Any of the specified options
```

#### Common Pattern Examples
```bash
@{**/*}                    # All files recursively
@{src/**/*}               # All source files
@{*.ts,*.js}              # TypeScript and JavaScript files
@{CLAUDE.md,**/*CLAUDE.md} # Documentation hierarchy
@{package.json,*.config.*} # Configuration files
@{src/**/*.test.*}        # Test files
```

#### Cross-Platform Rules
- Always use forward slashes (`/`) for paths
- Quote paths with spaces: `@{"My Project/src/**/*"}`
- Escape special characters: `@{src/**/*\[bracket\]*}`

### ⏱️ Execution Environment
- **Default Timeout**: 20 minutes for complex analysis and development workflows
- **Error Logging**: Comprehensive logging and recovery mechanisms
- **Token Management**: Automatic optimization for large codebases

---

## 🔍 Gemini Implementation Guide

### 🎯 Purpose & Strengths
- **Large context window** for simultaneous multi-file analysis
- **Pattern detection** across multiple modules
- **Architectural understanding** of complex codebases
- **Cross-module relationship** analysis

### ⭐ Primary Method: gemini-wrapper (RECOMMENDED)

**Location**: `~/.claude/scripts/gemini-wrapper` (auto-installed)

**Smart Features**:
- **Token Threshold**: 2,000,000 tokens (configurable via `GEMINI_TOKEN_LIMIT`)
- **Auto File Loading**: Small projects get `--all-files`, large projects use targeted patterns
- **Smart Approval Modes**: Analysis tasks use `default`, execution tasks use `yolo`
- **Error Logging**: Captures errors to `~/.claude/.logs/gemini-errors.log`

**Task Detection**:
- **Analysis Keywords**: "analyze", "review", "understand", "inspect" → `--approval-mode default`
- **All Other Tasks**: → `--approval-mode yolo`

### 📝 Command Patterns

#### Automatic Management (90% of use cases)
```bash
# Analysis task - auto detects and configures appropriately
~/.claude/scripts/gemini-wrapper -p "Analyze authentication module patterns"

# Development task - auto configures for execution
~/.claude/scripts/gemini-wrapper -p "Implement user login feature with JWT"

# Directory-specific analysis
cd src/auth && ~/.claude/scripts/gemini-wrapper -p "Review authentication patterns"

# Custom token threshold
GEMINI_TOKEN_LIMIT=500000 ~/.claude/scripts/gemini-wrapper -p "Custom analysis"
```

#### Template-Enhanced Analysis
```bash
# Single template
cd frontend/components && ~/.claude/scripts/gemini-wrapper -p "$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)"

# Multi-template composition
~/.claude/scripts/gemini-wrapper -p "$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)

Additional Security Focus:
$(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt)"
```

#### Manual Control (when needed)
```bash
# Direct control with all files
gemini --all-files -p "Analyze authentication module patterns"

# Pattern-based targeting
gemini -p "@{src/auth/**/*} @{CLAUDE.md} Analyze authentication patterns"
```

### 🔄 Token Limit Fallback Strategy
```bash
# If automatic loading fails due to token limits, retry with patterns:
# Original: ~/.claude/scripts/gemini-wrapper -p "Analyze patterns"
# Fallback:
gemini -p "@{src/auth/**/*} @{src/middleware/**/*} @{CLAUDE.md} Analyze patterns"
```

---

## 🛠️ Codex Implementation Guide

### 🎯 Purpose & Strengths
- **Autonomous development** workflows
- **Mathematical reasoning** and optimization
- **Security analysis** and implementation
- **Intelligent code generation**
- **Full project automation**

### 🔒 Sandbox Modes (REQUIRED)
```bash
-s read-only           # Safe analysis mode, no modifications
-s workspace-write     # Standard development mode
-s danger-full-access  # Full system access (RECOMMENDED for development)
```

**⚠️ CRITICAL**: No wrapper script exists - always use direct `codex` command

### ⭐ Default Mode: Full Autonomous (RECOMMENDED)

**🎯 Golden Rule**: Always start with `codex --full-auto exec "task" -s danger-full-access`

**Why Full-Auto is Primary Choice**:
- 🧠 **Intelligent File Discovery**: Auto-identifies relevant files
- 🎯 **Context-Aware Execution**: Understands project dependencies
- ⚡ **Streamlined Workflow**: Just describe what you want
- 🚀 **Maximum Automation**: Full autonomous capabilities
- 📚 **Smart Documentation**: Includes relevant CLAUDE.md files

### 📝 Command Patterns (Priority Order)

#### 1. Autonomous Development (PRIMARY - 90% of tasks)
```bash
# RECOMMENDED: Full autonomous mode
codex --full-auto exec "Implement user authentication with JWT tokens" -s danger-full-access

# Directory-specific autonomous development
codex --cd src/auth --full-auto exec "Refactor authentication module using latest patterns" -s danger-full-access

# Complex feature development
codex --full-auto exec "Create a complete todo application with React and TypeScript" -s danger-full-access
```

#### 2. Template-Enhanced Development
```bash
# Autonomous mode with template guidance
codex --full-auto exec "$(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)

## Task: User Authentication System
- JWT token management
- Role-based access control
- Password reset functionality" -s danger-full-access
```

#### 3. Controlled Development (When Explicit Control Needed)
```bash
# Explicit patterns for specific control
codex --full-auto exec "@{src/auth/**/*,CLAUDE.md} Refactor authentication module" -s danger-full-access

# Directory-specific with patterns
codex --cd src/auth --full-auto exec "@{**/*,../../CLAUDE.md} Refactor module" -s danger-full-access
```

### 🚀 Advanced Workflow Patterns

#### Multi-Phase Development
```bash
# Phase 1: Autonomous Analysis
codex --full-auto exec "Analyze current architecture for payment integration" -s danger-full-access

# Phase 2: Autonomous Implementation
codex --full-auto exec "Implement Stripe payment integration" -s danger-full-access

# Phase 3: Autonomous Testing
codex --full-auto exec "Generate comprehensive tests for payment system" -s danger-full-access
```

#### Cross-Project Learning
```bash
# Learn from other projects
codex --full-auto exec "Implement feature X by learning patterns from ../other-project/" -s danger-full-access

# Explicit cross-project patterns
codex --full-auto exec "@{../other-project/src/**/*,src/**/*,CLAUDE.md} Implement feature X" -s danger-full-access
```

### ⚠️ Critical Requirements
- **File References**: Unlike Gemini, Codex has NO `--all-files` flag
- **Sandbox Required**: Must specify `-s` parameter for write operations
- **Pattern Syntax**: Use `@{patterns}` when not using full-auto mode
- **Documentation Loading**: Must explicitly reference `@{CLAUDE.md}` when using patterns

---

## ✅ Best Practices & Guidelines

### 🎯 Tool Selection Strategy

**Choose Gemini when**:
- Understanding large codebases (>50 files)
- Analyzing patterns across modules
- Cross-module dependency analysis
- Code convention detection
- Architectural review

**Choose Codex when**:
- Building new features
- Algorithm optimization
- Security implementation
- Autonomous development workflows
- Mathematical problem solving

### 🛠️ Development Workflow

#### Pre-Development Pattern
1. **Context Gathering** (Gemini): `~/.claude/scripts/gemini-wrapper -p "analyze project architecture"`
2. **Implementation** (Codex): `codex --full-auto exec "implement feature based on analysis" -s danger-full-access`
3. **Quality Assurance** (Codex): `codex --full-auto exec "generate tests and validate" -s danger-full-access`

#### Error Prevention
- **Test patterns first**: Validate `@{patterns}` match existing files
- **Quote complex paths**: Use proper shell quoting for paths with spaces
- **Start simple**: Begin with basic patterns, add complexity as needed
- **Include documentation**: Always reference CLAUDE.md files for context

#### Token and Context Management
- **Gemini**: Rely on wrapper for automatic token management
- **Codex**: Trust full-auto mode for intelligent file discovery
- **Manual patterns**: Use only when autonomous modes need guidance
- **Fallback strategies**: Have targeted patterns ready for large projects

### 📊 Template Integration Strategy

#### Template Composition
```bash
# Combine multiple templates
codex --full-auto exec "$(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)

$(cat ~/.claude/workflows/cli-templates/planning-roles/system-architect.md)

Task: Implement authentication system" -s danger-full-access
```

#### Cross-Tool Template Reuse
- Templates work identically with both tools
- Use `cat` command for seamless integration
- Combine analysis and development templates
- Build complex prompts from multiple sources

### 🚨 Troubleshooting

#### Common Issues
1. **Token limit exceeded** (Gemini): Wrapper automatically retries with targeted patterns
2. **File not found** (Both): Validate patterns with `ls` before using
3. **Sandbox errors** (Codex): Ensure `-s` parameter is specified
4. **Pattern matching** (Both): Test with simple patterns first

#### Recovery Strategies
- **Gemini**: Fallback from `--all-files` to specific patterns
- **Codex**: Fallback from full-auto to explicit patterns
- **Both**: Use directory navigation to reduce complexity
- **Documentation**: Always include CLAUDE.md for context

---

## 🎯 Strategic Integration Summary

### Template Ecosystem
- **Cross-tool compatibility**: Templates work with both Gemini and Codex
- **Layered approach**: Combine prompt templates with planning roles and tech stacks
- **Reusable patterns**: Build library of common development patterns

### Autonomous Development Pipeline
1. **Analysis Phase** (Gemini): Large context understanding
2. **Development Phase** (Codex): Autonomous implementation
3. **Quality Phase** (Codex): Testing and validation

### Key Reminders
- **Gemini excels at understanding** - use for analysis and pattern recognition
- **Codex excels at building** - use for development and implementation
- **Start with autonomous modes** - leverage full capabilities before manual control
- **Trust the intelligence** - both tools excel at their specialized functions

---

**Quick Reference**: For strategic guidance on tool selection, see `@~/.claude/workflows/intelligent-tools-strategy.md`