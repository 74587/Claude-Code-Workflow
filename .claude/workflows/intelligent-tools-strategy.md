---
name: intelligent-tools-strategy
description: Strategic decision framework for intelligent tool selection
type: strategic-guideline
---

# Intelligent Tools Selection Strategy

## 📋 Table of Contents
1. [Core Framework](#-core-framework)
2. [Tool Specifications](#-tool-specifications)
3. [Command Templates](#-command-templates)
4. [Tool Selection Guide](#-tool-selection-guide)
5. [Usage Patterns](#-usage-patterns)
6. [Best Practices](#-best-practices)

---

## ⚡ Core Framework

### Tool Overview
- **Analysis Tools (Gemini/Qwen)**: Analysis, understanding, exploration & documentation
  - Gemini: Primary choice
  - Qwen: Fallback with identical capabilities
- **Codex**: Development, implementation & automation

### Decision Principles
- **Use tools early and often** - Tools are faster, more thorough, and reliable than manual approaches
- **When in doubt, use both** - Parallel usage provides comprehensive coverage
- **Default to tools** - Use specialized tools for most coding tasks, no matter how small
- **Lower barriers** - Engage tools immediately when encountering any complexity
- **Context optimization** - Based on user intent, determine whether to use `-C [directory]` parameter for focused analysis to reduce irrelevant context import
- **⚠️ Write operation protection** - For local codebase write/modify operations, require EXPLICIT user confirmation unless user provides clear instructions containing MODE=write or MODE=auto

### Quick Decision Rules
1. **Exploring/Understanding?** → Use Analysis Tools (Gemini primary, Qwen fallback)
2. **Architecture/Analysis?** → Use Analysis Tools
3. **Building/Fixing?** → Use Codex
4. **Not sure?** → Use multiple tools in parallel
5. **Small task?** → Still use tools - they're faster than manual work

---

## 🎯 Tool Specifications

### Analysis Tools: Gemini & Qwen
- **Commands**: `~/.claude/scripts/gemini-wrapper` | `~/.claude/scripts/qwen-wrapper`
- **Priority**: Gemini (primary), Qwen (fallback - identical capabilities)
- **Strengths**: Large context window, pattern recognition
- **Best For**: Analysis, documentation generation, code exploration, architecture review
- **Permissions**: Default read-only analysis, MODE=write requires explicit specification (auto-enables --approval-mode yolo)
- **Default MODE**: `analysis` (read-only)
- **⚠️ Write Trigger**: Only when user explicitly requests "generate documentation", "modify code", or specifies MODE=write

#### MODE Options
- `analysis` (default) - Read-only analysis and documentation generation
- `write` - ⚠️ Create/modify codebase files (requires explicit specification, auto-enables --approval-mode yolo)

### Codex
- **Command**: `codex --full-auto exec`
- **Strengths**: Autonomous development, mathematical reasoning
- **Best For**: Implementation, testing, automation
- **Permissions**: Requires explicit MODE=auto or MODE=write specification
- **Default MODE**: No default, must be explicitly specified
- **⚠️ Write Trigger**: Only when user explicitly requests "implement", "modify", "generate code" AND specifies MODE

#### MODE Options
- `auto` - ⚠️ Autonomous development with full file operations (requires explicit specification, enables -s danger-full-access)
- `write` - ⚠️ Test generation and file modification (requires explicit specification)
- **Default**: No default mode, MODE must be explicitly specified

#### Session Management
- `codex resume` - Resume with picker | `codex exec "task" resume --last` - Continue most recent
- `codex -i <image>` - Attach images for UI/design tasks
- **Multi-task Pattern**: First uses `exec`, subsequent use `exec "..." resume --last`
- **Position**: `resume --last` AFTER prompt string at command END

#### Auto-Resume Decision Rules
**Use `resume --last`**: Related task, requires previous context, multi-step workflow on same module
**Don't use**: First task, independent task, different module, no recent Codex session

---

## 🎯 Command Templates

### Universal Template Structure
Every command MUST follow this structure:
- [ ] **PURPOSE** - Clear goal and intent
- [ ] **TASK** - Specific execution task
- [ ] **MODE** - Execution mode and permission level
- [ ] **CONTEXT** - File references and memory context from previous sessions
- [ ] **EXPECTED** - Clear expected results
- [ ] **RULES** - Template reference and constraints

### Standard Command Formats

#### Analysis Tools Commands (Gemini/Qwen)
**Note**: Commands are identical for both tools. Use `gemini-wrapper` (primary) or `qwen-wrapper` (fallback).

```bash
# Analysis Mode (read-only, default)
cd [directory] && ~/.claude/scripts/{gemini,qwen}-wrapper -p "
PURPOSE: [clear analysis goal]
TASK: [specific analysis task]
MODE: analysis
CONTEXT: [file references and memory context]
EXPECTED: [expected output]
RULES: [template reference and constraints]
"

# Write Mode (requires explicit MODE=write)
# NOTE: --approval-mode yolo must be placed AFTER wrapper command, BEFORE -p
cd [directory] && ~/.claude/scripts/{gemini,qwen}-wrapper --approval-mode yolo -p "
PURPOSE: [clear goal]
TASK: [specific task]
MODE: write
CONTEXT: [file references and memory context]
EXPECTED: [expected output]
RULES: [template reference and constraints]
"
```

#### Codex Commands
```bash
# Codex Development (requires explicit MODE=auto)
# NOTE: --skip-git-repo-check and -s danger-full-access must be placed at command END
codex -C [directory] --full-auto exec "
PURPOSE: [clear development goal]
TASK: [specific development task]
MODE: auto
CONTEXT: [file references and memory context]
EXPECTED: [expected deliverables]
RULES: [template reference and constraints]
" --skip-git-repo-check -s danger-full-access

# Codex Test/Write Mode (requires explicit MODE=write)
# NOTE: --skip-git-repo-check and -s danger-full-access must be placed at command END
codex -C [directory] --full-auto exec "
PURPOSE: [clear goal]
TASK: [specific task]
MODE: write
CONTEXT: [file references and memory context]
EXPECTED: [expected deliverables]
RULES: [template reference and constraints]
" --skip-git-repo-check -s danger-full-access
```

### Directory Context Configuration
Tools execute in current working directory:
- **Analysis Tools**: `cd path/to/project && ~/.claude/scripts/{gemini,qwen}-wrapper -p "prompt"`
- **Codex**: `codex -C path/to/project --full-auto exec "task"` (Codex supports -C flag)
- **Path types**: Supports both relative (`../project`) and absolute (`/full/path`) paths
- **Token analysis**: For analysis tools, token counting happens in current directory

### RULES Field Format
```bash
RULES: $(cat "~/.claude/workflows/cli-templates/prompts/[category]/[template].txt") | [constraints]
```

**⚠️ CRITICAL: Command Substitution Rules**
- **NEVER use escape characters**: `\$`, `\"`, `\'` break command substitution
- **Correct**: `$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)`
- **WRONG**: `\$(cat ...)` or `$(cat \"...\")`
- **Why**: Shell subshell handles path expansion safely

**Examples**: `$(cat "template.txt") | Focus on security` | `@{src/**/*.ts,CLAUDE.md}`

### File Pattern Reference
Common patterns: `@{**/*}` (all), `@{src/**/*}` (source), `@{*.ts,*.tsx}` (TypeScript), `@{**/*.test.*}` (tests)

**Complex Pattern Discovery**: Use semantic tools (rg, MCP) → Extract paths → Build CONTEXT
```bash
# 1. Discover: rg "export.*Component" --files-with-matches --type ts
# 2. Build CONTEXT: @{src/components/Auth.tsx,src/types/auth.d.ts}
# 3. Execute CLI with precise file references
```

---

## 📊 Tool Selection Guide

### Selection Matrix

| Task Type | Tool | Use Case | Template |
|-----------|------|----------|-----------|
| **Analysis** | Analysis Tools | Code exploration, architecture review, patterns | `analysis/pattern.txt` |
| **Architecture** | Analysis Tools | System design, architectural analysis | `analysis/architecture.txt` |
| **Documentation** | Analysis Tools | Code docs, API specs, guides | `analysis/quality.txt` |
| **Development** | Codex | Feature implementation, bug fixes, testing | `development/feature.txt` |
| **Planning** | Analysis Tools | Task breakdown, migration planning | `planning/task-breakdown.txt` |
| **Security** | Codex | Vulnerability assessment, fixes | `analysis/security.txt` |
| **Refactoring** | Multiple | Analysis Tools for analysis, Codex for execution | `development/refactor.txt` |
| **Module Documentation** | Analysis Tools | Universal module/file documentation for all levels | `memory/claude-module-unified.txt` |

### Template System
**Base**: `~/.claude/workflows/cli-templates/`

| Category | Template | Purpose |
|----------|----------|---------|
| **Analysis** | pattern.txt, architecture.txt, security.txt, quality.txt | Code/architecture review |
| **Development** | feature.txt, refactor.txt, testing.txt | Implementation tasks |
| **Memory** | claude-module-unified.txt | Module documentation |
| **Planning** | task-breakdown.txt | Task decomposition |
| **Roles** | system-architect.md, security-expert.md, feature-planner.md | Planning perspectives |
| **Tech Stacks** | typescript-dev.md, python-dev.md, react-dev.md | Language conventions |

---

## 🚀 Usage Patterns

### Workflow Integration (REQUIRED)
When planning any coding task, **ALWAYS** integrate CLI tools:

1. **Understanding Phase**: Use Analysis Tools for codebase analysis
2. **Architecture Phase**: Use Analysis Tools for design and architecture review
3. **Implementation Phase**: Use Codex for development
4. **Quality Phase**: Use Codex for testing and validation

### Common Scenarios

#### Analysis Example
```bash
# Architecture analysis using Analysis Tools
cd src/auth && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Analyze authentication system architecture
TASK: Review JWT-based auth system design
MODE: analysis
CONTEXT: @{src/auth/**/*} Existing patterns and requirements
EXPECTED: Architecture analysis report with recommendations
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Focus on security
"

# Note: Replace 'gemini-wrapper' with 'qwen-wrapper' if Gemini unavailable
```

#### Codex Development (Multi-task with Resume)
```bash
# First task
codex -C project --full-auto exec "
PURPOSE: Implement user authentication
TASK: JWT-based auth system
MODE: auto
CONTEXT: @{src/auth/**/*}
EXPECTED: Complete auth module
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt)
" --skip-git-repo-check -s danger-full-access

# Continue session
codex --full-auto exec "Add JWT validation" resume --last --skip-git-repo-check -s danger-full-access
codex --full-auto exec "Generate auth tests" resume --last --skip-git-repo-check -s danger-full-access
```


---

## 🔧 Best Practices

### General Guidelines
- ✅ Use templates for consistency | Be specific in PURPOSE/TASK/EXPECTED
- ✅ Use rg/MCP for file discovery → Build precise CONTEXT
- ✅ Reference CLAUDE.md for project context
- ⚠️ NEVER use escape characters (`\$`, `\"`, `\'`) in CLI commands

### Context Optimization Strategy
**Directory Navigation**: Use `cd [directory] &&` for focused analysis to reduce token usage

**Decision Rules**:
- Specific directory → `cd directory &&` pattern
- Focused analysis → Target specific directory
- Multi-directory scope → Stay in root, use explicit paths

**Example**:
```bash
# Analysis Tools - Focused analysis
cd src/auth && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Understand authentication patterns
TASK: Analyze auth implementation
MODE: analysis
CONTEXT: @{**/*.ts}
EXPECTED: Pattern documentation
RULES: Focus on security best practices
"

# Codex - Implementation
codex -C src/auth --full-auto exec "
PURPOSE: Improve auth implementation
TASK: Review and enhance auth code
MODE: auto
CONTEXT: @{**/*.ts}
EXPECTED: Code improvements and fixes
RULES: Maintain backward compatibility
" --skip-git-repo-check -s danger-full-access
```

### Planning Checklist

For every development task:
- [ ] **Purpose defined** - Clear goal and intent
- [ ] **Mode selected** - Execution mode and permission level determined
- [ ] **Context gathered** - File references and session memory documented
- [ ] **Analysis completed** - Use Analysis Tools for understanding
- [ ] **Template selected** - Appropriate template chosen
- [ ] **Constraints specified** - File patterns, scope, requirements
- [ ] **Implementation approach** - Tool selection and workflow
- [ ] **Quality measures** - Testing and validation plan
- [ ] **Tool configuration** - Review tool-specific configs if needed

---

## ⚙️ Execution Configuration

### Core Execution Rules
- **Dynamic Timeout**: 20-40min (simple), 40-60min (medium), 60-120min (complex)
- **Codex Multiplier**: 1.5x allocated time
- **Apply to**: All bash() wrapped commands (Analysis Tools, Codex)
- **Auto-detect**: Based on PURPOSE and TASK complexity

### Permission Framework
- **⚠️ WRITE PROTECTION**: Codebase write/modify requires EXPLICIT user confirmation
  - **Default**: Read-only analysis mode (safe for auto-execution)
  - **Write Mode**: User must explicitly state MODE=write or MODE=auto
  - **Exception**: Clear instructions like "modify", "create", "implement"
- **Analysis Tools Write**: `--approval-mode yolo` AFTER wrapper command when MODE=write
- **Codex Write**: `-s danger-full-access --skip-git-repo-check` AFTER prompt when MODE=auto
- **Default Behavior**: All tools start in read-only mode
