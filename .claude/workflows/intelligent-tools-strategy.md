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
- **Gemini**: Analysis, understanding, exploration & documentation (primary)
- **Qwen**: Analysis, understanding, exploration & documentation (fallback, same capabilities as Gemini)
- **Codex**: Development, implementation & automation

### Decision Principles
- **Use tools early and often** - Tools are faster, more thorough, and reliable than manual approaches
- **When in doubt, use both** - Parallel usage provides comprehensive coverage
- **Default to tools** - Use specialized tools for most coding tasks, no matter how small
- **Lower barriers** - Engage tools immediately when encountering any complexity
- **Context optimization** - Based on user intent, determine whether to use `-C [directory]` parameter for focused analysis to reduce irrelevant context import
- **⚠️ Write operation protection** - For local codebase write/modify operations, require EXPLICIT user confirmation unless user provides clear instructions containing MODE=write or MODE=auto

### Quick Decision Rules
1. **Exploring/Understanding?** → Start with Gemini (fallback to Qwen if needed)
2. **Architecture/Analysis?** → Start with Gemini (fallback to Qwen if needed)
3. **Building/Fixing?** → Start with Codex
4. **Not sure?** → Use multiple tools in parallel
5. **Small task?** → Still use tools - they're faster than manual work

---

## 🎯 Tool Specifications

### Gemini
- **Command**: `~/.claude/scripts/gemini-wrapper`
- **Strengths**: Large context window, pattern recognition
- **Best For**: Analysis, documentation generation, code exploration
- **Permissions**: Default read-only analysis, MODE=write requires explicit specification (auto-enables --approval-mode yolo)
- **Default MODE**: `analysis` (read-only)
- **⚠️ Write Trigger**: Only when user explicitly requests "generate documentation", "modify code", or specifies MODE=write

#### MODE Options
- `analysis` (default) - Read-only analysis and documentation generation
- `write` - ⚠️ Create/modify codebase files (requires explicit specification, auto-enables --approval-mode yolo)

### Qwen
- **Command**: `~/.claude/scripts/qwen-wrapper`
- **Strengths**: Large context window, pattern recognition (same as Gemini)
- **Best For**: Analysis, documentation generation, code exploration (fallback option when Gemini unavailable)
- **Permissions**: Default read-only analysis, MODE=write requires explicit specification (auto-enables --approval-mode yolo)
- **Default MODE**: `analysis` (read-only)
- **⚠️ Write Trigger**: Only when user explicitly requests "generate documentation", "modify code", or specifies MODE=write
- **Priority**: Secondary to Gemini - use as fallback for same tasks

#### MODE Options
- `analysis` (default) - Read-only analysis and documentation generation (same as Gemini)
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
- `codex resume` - Resume previous interactive session (picker by default)
- `codex exec "task" resume --last` - Continue most recent session with new task (maintains context)
- `codex -i <image_file>` - Attach image(s) to initial prompt (useful for UI/design references)
- **Multi-task Pattern**: First task uses `exec`, subsequent tasks use `exec "..." resume --last` for context continuity
  - **Parameter Position**: `resume --last` must be placed AFTER the prompt string at command END
  - **Example**:
    ```bash
    # First task - establish session
    codex -C project --full-auto exec "Implement auth module" --skip-git-repo-check -s danger-full-access

    # Subsequent tasks - continue same session
    codex --full-auto exec "Add JWT validation" resume --last --skip-git-repo-check -s danger-full-access
    codex --full-auto exec "Write auth tests" resume --last --skip-git-repo-check -s danger-full-access
    ```

#### Auto-Resume Decision Rules
**When to use `resume --last`**:
- Current task is related to/extends previous Codex task in conversation memory
- Current task requires context from previous implementation
- Current task is part of multi-step workflow (e.g., implement → enhance → test)
- Session memory indicates recent Codex execution on same module/feature

**When NOT to use `resume --last`**:
- First Codex task in conversation
- New independent task unrelated to previous work
- Switching to different module/feature area
- No recent Codex task in conversation memory

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

#### Gemini Commands
```bash
# Gemini Analysis (read-only, default)
cd [directory] && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: [clear analysis goal]
TASK: [specific analysis task]
MODE: analysis
CONTEXT: [file references and memory context]
EXPECTED: [expected output]
RULES: [template reference and constraints]
"

# Gemini Write Mode (requires explicit MODE=write)
# NOTE: --approval-mode yolo must be placed AFTER wrapper command, BEFORE -p
cd [directory] && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: [clear goal]
TASK: [specific task]
MODE: write
CONTEXT: [file references and memory context]
EXPECTED: [expected output]
RULES: [template reference and constraints]
"
```

#### Qwen Commands
```bash
# Qwen Analysis (read-only, default) - Same as Gemini, use as fallback
cd [directory] && ~/.claude/scripts/qwen-wrapper -p "
PURPOSE: [clear analysis goal]
TASK: [specific analysis task]
MODE: analysis
CONTEXT: [file references and memory context]
EXPECTED: [expected output]
RULES: [template reference and constraints]
"

# Qwen Write Mode (requires explicit MODE=write)
# NOTE: --approval-mode yolo must be placed AFTER wrapper command, BEFORE -p
cd [directory] && ~/.claude/scripts/qwen-wrapper --approval-mode yolo -p "
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
- **Gemini**: `cd path/to/project && ~/.claude/scripts/gemini-wrapper -p "prompt"`
- **Qwen**: `cd path/to/project && ~/.claude/scripts/qwen-wrapper -p "prompt"`
- **Codex**: `codex -C path/to/project --full-auto exec "task"` (Codex still supports -C)
- **Path types**: Supports both relative (`../project`) and absolute (`/full/path`) paths
- **Token analysis**: For gemini-wrapper and qwen-wrapper, token counting happens in current directory

### RULES Field Format
```bash
RULES: $(cat "~/.claude/workflows/cli-templates/prompts/[category]/[template].txt") | [constraints]
```

**⚠️ CRITICAL: Command Substitution Rules**
When using `$(cat ...)` for template loading in actual CLI commands:
- **NEVER use escape characters**: `\$`, `\"`, `\'` will break command substitution
- **In -p "..." context**: Path in `$(cat ...)` needs NO quotes (tilde expands correctly)
- **Correct**: `RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)`
- **WRONG**: `RULES: \$(cat ...)` or `RULES: $(cat \"...\")` or `RULES: $(cat '...')`
- **Why**: Shell executes `$(...)` in subshell where path is safe without quotes

**Examples**:
- Single template: `$(cat "~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt") | Focus on security`
- Multiple templates: `$(cat "template1.txt") $(cat "template2.txt") | Enterprise standards`
- No template: `Focus on security patterns, include dependency analysis`
- File patterns: `@{src/**/*.ts,CLAUDE.md} - Stay within scope`

### File Pattern Reference
- All files: `@{**/*}`
- Source files: `@{src/**/*}`
- TypeScript: `@{*.ts,*.tsx}`
- With docs: `@{CLAUDE.md,**/*CLAUDE.md}`
- Tests: `@{src/**/*.test.*}`

**Complex Pattern Discovery**:
For complex file pattern requirements, use semantic discovery tools BEFORE CLI execution:
- **rg (ripgrep)**: Content-based file discovery with regex patterns
- **Code Index MCP**: Semantic file search based on task requirements
- **Workflow**: Discover → Extract precise paths → Build CONTEXT field

**Example**:
```bash
# Step 1: Discover files semantically
rg "export.*Component" --files-with-matches --type ts  # Find component files
mcp__code-index__search_code_advanced(pattern="interface.*Props", file_pattern="*.tsx")  # Find interface files

# Step 2: Build precise CONTEXT from discovery results
CONTEXT: @{src/components/Auth.tsx,src/types/auth.d.ts,src/hooks/useAuth.ts}

# Step 3: Execute CLI with precise file references
cd src && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Analyze authentication components
TASK: Review auth component patterns and props interfaces
MODE: analysis
CONTEXT: @{components/Auth.tsx,types/auth.d.ts,hooks/useAuth.ts}
EXPECTED: Pattern analysis and improvement suggestions
RULES: Focus on type safety and component composition
"
```

---

## 📊 Tool Selection Guide

### Selection Matrix

| Task Type | Tool | Use Case | Template |
|-----------|------|----------|-----------|
| **Analysis** | Gemini (Qwen fallback) | Code exploration, architecture review, patterns | `analysis/pattern.txt` |
| **Architecture** | Gemini (Qwen fallback) | System design, architectural analysis | `analysis/architecture.txt` |
| **Documentation** | Gemini (Qwen fallback) | Code docs, API specs, guides | `analysis/quality.txt` |
| **Development** | Codex | Feature implementation, bug fixes, testing | `development/feature.txt` |
| **Planning** | Gemini/Qwen | Task breakdown, migration planning | `planning/task-breakdown.txt` |
| **Security** | Codex | Vulnerability assessment, fixes | `analysis/security.txt` |
| **Refactoring** | Multiple | Gemini/Qwen for analysis, Codex for execution | `development/refactor.txt` |
| **Memory Layer 1** | Gemini (Qwen fallback) | Root-level project overview, tech stack, architecture principles | `memory/claude-layer1-root.txt` |
| **Memory Layer 2** | Gemini (Qwen fallback) | Domain-level architecture, responsibility boundaries | `memory/claude-layer2-domain.txt` |
| **Memory Layer 3** | Gemini (Qwen fallback) | Module-level implementation patterns, APIs | `memory/claude-layer3-module.txt` |
| **Memory Layer 4** | Gemini (Qwen fallback) | Submodule-level detailed implementation docs | `memory/claude-layer4-submodule.txt` |
| **Memory Hierarchy** | Gemini (Qwen fallback) | Project structure analysis for optimal doc hierarchy | `memory/hierarchy-analysis.txt` |

### Template System

**Base Structure**: `~/.claude/workflows/cli-templates/`

#### Available Templates
```
prompts/
├── analysis/
│   ├── pattern.txt      - Code pattern analysis
│   ├── architecture.txt - System architecture review
│   ├── security.txt     - Security assessment
│   └── quality.txt      - Code quality review
├── development/
│   ├── feature.txt      - Feature implementation
│   ├── refactor.txt     - Refactoring tasks
│   └── testing.txt      - Test generation
├── memory/
│   ├── claude-layer1-root.txt       - Root-level project documentation
│   ├── claude-layer2-domain.txt     - Domain-level architecture docs
│   ├── claude-layer3-module.txt     - Module-level implementation docs
│   ├── claude-layer4-submodule.txt  - Submodule-level detailed docs
│   └── hierarchy-analysis.txt       - Project structure analysis
└── planning/
    └── task-breakdown.txt - Task decomposition

planning-roles/
├── system-architect.md  - System design perspective
├── security-expert.md   - Security architecture
└── feature-planner.md   - Feature specification

tech-stacks/
├── typescript-dev.md    - TypeScript guidelines
├── python-dev.md        - Python conventions
└── react-dev.md         - React architecture
```

---

## 🚀 Usage Patterns

### Workflow Integration (REQUIRED)
When planning any coding task, **ALWAYS** integrate CLI tools:

1. **Understanding Phase**: Use Gemini for analysis (Qwen as fallback)
2. **Architecture Phase**: Use Gemini for design and analysis (Qwen as fallback)
3. **Implementation Phase**: Use Codex for development
4. **Quality Phase**: Use Codex for testing and validation

### Common Scenarios

#### Code Analysis
```bash
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Understand codebase architecture
TASK: Analyze project structure and identify patterns
MODE: analysis
CONTEXT: @{src/**/*.ts,CLAUDE.md} Previous analysis of auth system
EXPECTED: Architecture overview and integration points
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Focus on integration points
"
```

#### Documentation Generation
```bash
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Generate API documentation
TASK: Create comprehensive API reference from code
MODE: write
CONTEXT: @{src/api/**/*}
EXPECTED: API.md with all endpoints documented
RULES: Follow project documentation standards
"
```

#### Architecture Analysis (Qwen as Gemini fallback)
```bash
# Prefer Gemini for architecture analysis
cd src/auth && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Analyze authentication system architecture
TASK: Review JWT-based auth system design
MODE: analysis
CONTEXT: @{src/auth/**/*} Existing patterns and requirements
EXPECTED: Architecture analysis report with recommendations
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Focus on security
"

# Use Qwen only if Gemini unavailable
cd src/auth && ~/.claude/scripts/qwen-wrapper -p "
PURPOSE: Analyze authentication system architecture
TASK: Review JWT-based auth system design
MODE: analysis
CONTEXT: @{src/auth/**/*} Existing patterns and requirements
EXPECTED: Architecture analysis report with recommendations
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Focus on security
"
```

#### Feature Development (Multi-task with Resume)
```bash
# First task - establish session
codex -C path/to/project --full-auto exec "
PURPOSE: Implement user authentication
TASK: Create JWT-based authentication system
MODE: auto
CONTEXT: @{src/auth/**/*} Database schema from session memory
EXPECTED: Complete auth module with tests
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt) | Follow security best practices
" --skip-git-repo-check -s danger-full-access

# Continue in same session - Add JWT validation
codex --full-auto exec "
PURPOSE: Enhance authentication security
TASK: Add JWT token validation and refresh logic
MODE: auto
CONTEXT: Previous auth implementation from current session
EXPECTED: JWT validation middleware and token refresh endpoints
RULES: Follow JWT best practices, maintain session context
" resume --last --skip-git-repo-check -s danger-full-access

# Continue in same session - Add tests
codex --full-auto exec "
PURPOSE: Increase test coverage
TASK: Generate comprehensive tests for auth module
MODE: write
CONTEXT: Auth implementation from current session
EXPECTED: Complete test suite with 80%+ coverage
RULES: Use Jest, follow existing patterns
" resume --last --skip-git-repo-check -s danger-full-access
```

#### Interactive Session Resume
```bash
# Resume previous session with picker
codex resume

# Or resume most recent session directly
codex resume --last
```

---

## 🔧 Best Practices

### General Guidelines
- **Start with templates** - Use predefined templates for consistency
- **Be specific** - Clear PURPOSE, TASK, and EXPECTED fields
- **Include constraints** - File patterns, scope, requirements in RULES
- **Discover patterns first** - Use rg/MCP for complex file discovery before CLI execution
- **Build precise CONTEXT** - Convert discovery results to explicit file references
- **Document context** - Always reference CLAUDE.md for context
- **⚠️ No escape characters in CLI commands** - NEVER use `\$`, `\"`, `\'` in actual CLI execution (breaks command substitution and path expansion)

### Context Optimization Strategy
**Directory Navigation**: Use `cd [directory] &&` pattern when analyzing specific areas to reduce irrelevant context

**When to change directory**:
- Specific directory mentioned → Use `cd directory &&` pattern
- Focused analysis needed → Target specific directory with cd
- Multi-directory scope → Stay in root, use explicit paths or multiple commands

**Example**:
```bash
# Gemini - Focused analysis
cd src/auth && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Understand authentication patterns
TASK: Analyze auth implementation
MODE: analysis
CONTEXT: @{**/*.ts}
EXPECTED: Pattern documentation
RULES: Focus on security best practices
"

# Qwen - Analysis (fallback option, same as Gemini)
cd src/auth && ~/.claude/scripts/qwen-wrapper -p "
PURPOSE: Analyze auth architecture
TASK: Review auth system design and patterns
MODE: analysis
CONTEXT: @{**/*}
EXPECTED: Architecture analysis report
RULES: Focus on modularity and security
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
- [ ] **Gemini analysis** completed for understanding
- [ ] **Template selected** - Appropriate template chosen
- [ ] **Constraints specified** - File patterns, scope, requirements
- [ ] **Implementation approach** - Tool selection and workflow
- [ ] **Quality measures** - Testing and validation plan
- [ ] **Tool configuration** - Review `.gemini/CLAUDE.md` or `.codex/Agent.md` if needed

---

## ⚙️ Execution Configuration

### Core Execution Rules
- **Dynamic Timeout (20-120min)**: Allocate execution time based on task complexity
  - Simple tasks (analysis, search): 20-40min (1200000-2400000ms)
  - Medium tasks (refactoring, documentation): 40-60min (2400000-3600000ms)
  - Complex tasks (implementation, migration): 60-120min (3600000-7200000ms)
- **Codex Multiplier**: Codex commands use 1.5x of allocated time
- **Apply to All Tools**: All bash() wrapped commands including Gemini, Qwen wrapper and Codex executions
- **Command Examples**: `bash(~/.claude/scripts/gemini-wrapper -p "prompt")`, `bash(codex -C directory --full-auto exec "task")`
- **Auto-detect**: Analyze PURPOSE and TASK fields to determine appropriate timeout

### Permission Framework
- **⚠️ WRITE PROTECTION**: Local codebase write/modify requires EXPLICIT user confirmation
  - **Analysis Mode (default)**: Read-only, safe for auto-execution
  - **Write Mode**: Requires user explicitly states MODE=write or MODE=auto in prompt
  - **Exception**: User provides clear instructions like "modify", "create", "implement"
- **Gemini/Qwen Write Access**: Use `--approval-mode yolo` ONLY when MODE=write explicitly specified
  - **Parameter Position**: Place AFTER the wrapper command: `gemini-wrapper --approval-mode yolo -p "..."`
- **Codex Write Access**: Use `-s danger-full-access` and `--skip-git-repo-check` ONLY when MODE=auto explicitly specified
  - **Parameter Position**: Place AFTER the prompt string at command END: `codex ... exec "..." --skip-git-repo-check -s danger-full-access`
- **Default Behavior**: All tools default to analysis/read-only mode without explicit write permission
