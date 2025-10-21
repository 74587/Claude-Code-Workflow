---
name: intelligent-tools-strategy
description: Strategic decision framework for intelligent tool selection
type: strategic-guideline
---

# Intelligent Tools Selection Strategy

## 📋 Table of Contents
1. [Quick Start](#-quick-start)
2. [Tool Specifications](#-tool-specifications)
3. [Command Templates](#-command-templates)
4. [Execution Configuration](#-execution-configuration)
5. [Best Practices](#-best-practices)

---

## ⚡ Quick Start

### Tool Overview
- **Gemini**: Analysis, understanding, exploration & documentation (primary)
- **Qwen**: Analysis, understanding, exploration & documentation (fallback, same capabilities as Gemini)
- **Codex**: Development, implementation & automation

### Model Selection (-m parameter)

**Gemini Models**:
- `gemini-2.5-pro` - Analysis tasks (default)
- `gemini-2.5-flash` - Documentation updates

**Qwen Models**:
- `coder-model` - Code analysis (default, -m optional)
- `vision-model` - Image analysis (rare usage)

**Codex Models**:
- `gpt-5` - Analysis & execution (default)
- `gpt5-codex` - Large context tasks

**Usage**: `tool -p "prompt" -m model-name` (NOTE: -m placed AFTER prompt)

### Quick Decision Matrix

| Scenario | Tool | Command Pattern |
|----------|------|-----------------|
| **Exploring/Understanding** | Gemini → Qwen | `cd [dir] && gemini -p "PURPOSE:... CONTEXT: @**/*"` |
| **Architecture/Analysis** | Gemini → Qwen | `cd [dir] && gemini -p "PURPOSE:... CONTEXT: @**/*"` |
| **Building/Fixing** | Codex | `codex -C [dir] --full-auto exec "PURPOSE:... MODE: auto"` |
| **Not sure?** | Multiple | Use tools in parallel |
| **Small task?** | Still use tools | Tools are faster than manual work |

### Core Principles
- **Use tools early and often** - Tools are faster, more thorough, and reliable than manual approaches
- **When in doubt, use both** - Parallel usage provides comprehensive coverage
- **Default to tools** - Use specialized tools for most coding tasks, no matter how small
- **Lower barriers** - Engage tools immediately when encountering any complexity
- **⚠️ Write operation protection** - For local codebase write/modify operations, require EXPLICIT user confirmation unless user provides clear instructions containing MODE=write or MODE=auto

---

## 🎯 Tool Specifications

### Gemini & Qwen

#### Overview
- **Commands**: `gemini` (primary) | `qwen` (fallback)
- **Strengths**: Large context window, pattern recognition
- **Best For**: Analysis, documentation generation, code exploration, architecture review
- **Permissions**: Default read-only analysis, MODE=write requires explicit specification
- **Default MODE**: `analysis` (read-only)
- **⚠️ Write Trigger**: Only when user explicitly requests "generate documentation", "modify code", or specifies MODE=write
- **Priority**: Prefer Gemini; use Qwen as fallback when Gemini unavailable

#### MODE Options

**analysis** (default) - Read-only analysis and documentation generation
- **⚠️ CRITICAL CONSTRAINT**: Absolutely NO file creation, modification, or deletion operations
- Analysis output should be returned as text response only
- Use for: code review, architecture analysis, pattern discovery, documentation reading

**write** - ⚠️ Create/modify codebase files (requires explicit specification, auto-enables --approval-mode yolo)
- Use for: generating documentation files, creating code files, modifying existing files

#### Tool Selection
```bash
# Default: Use Gemini
gemini -p "analysis prompt"

# Fallback: Use Qwen if Gemini unavailable
qwen -p "analysis prompt"
```

---

### Codex

#### Overview
- **Command**: `codex --full-auto exec`
- **Strengths**: Autonomous development, mathematical reasoning
- **Best For**: Implementation, testing, automation
- **Permissions**: Requires explicit MODE=auto or MODE=write specification
- **Default MODE**: No default, must be explicitly specified
- **⚠️ Write Trigger**: Only when user explicitly requests "implement", "modify", "generate code" AND specifies MODE

#### MODE Options

**auto** - ⚠️ Autonomous development with full file operations
- Requires explicit specification
- Enables `-s danger-full-access`
- Use for: feature implementation, bug fixes, autonomous development

**write** - ⚠️ Test generation and file modification
- Requires explicit specification
- Use for: test generation, focused file modifications

#### Session Management

**Basic Commands**:
- `codex resume` - Resume previous interactive session (picker by default)
- `codex resume --last` - Resume most recent session directly
- `codex -i <image_file>` - Attach image(s) to initial prompt (useful for UI/design references)

**Multi-task Pattern**: First task uses `exec`, subsequent tasks use `exec "..." resume --last` for context continuity

**Parameter Position**: `resume --last` must be placed AFTER the prompt string at command END

**Example**:
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

---

### Standard Command Formats

#### Gemini & Qwen Commands

```bash
# Analysis Mode (read-only, default)
# Use 'gemini' (primary) or 'qwen' (fallback)
cd [directory] && gemini -p "
PURPOSE: [clear analysis goal]
TASK: [specific analysis task]
MODE: analysis
CONTEXT: @**/* [default: all files, or specify file patterns]
EXPECTED: [expected output]
RULES: [template reference and constraints]
"

# Model Selection Examples (NOTE: -m placed AFTER prompt)
cd [directory] && gemini -p "..." -m gemini-2.5-pro      # Analysis (default)
cd [directory] && gemini -p "..." -m gemini-2.5-flash    # Documentation updates
cd [directory] && qwen -p "..."                          # coder-model (default, -m optional)
cd [directory] && qwen -p "..." -m vision-model           # Image analysis (rare)

# Write Mode (requires explicit MODE=write)
# NOTE: --approval-mode yolo must be placed AFTER the prompt
cd [directory] && gemini -p "
PURPOSE: [clear goal]
TASK: [specific task]
MODE: write
CONTEXT: @**/* [default: all files, or specify file patterns]
EXPECTED: [expected output]
RULES: [template reference and constraints]
" -m gemini-2.5-flash --approval-mode yolo

# Fallback: Replace 'gemini' with 'qwen' if Gemini unavailable
cd [directory] && qwen -p "..." # coder-model default (-m optional)
```

#### Codex Commands

```bash
# Codex Development (requires explicit MODE=auto)
# NOTE: -m, --skip-git-repo-check and -s danger-full-access must be placed at command END
codex -C [directory] --full-auto exec "
PURPOSE: [clear development goal]
TASK: [specific development task]
MODE: auto
CONTEXT: @**/* [default: all files, or specify file patterns and memory context]
EXPECTED: [expected deliverables]
RULES: [template reference and constraints]
" -m gpt-5 --skip-git-repo-check -s danger-full-access

# Model Selection Examples (NOTE: -m placed AFTER prompt, BEFORE flags)
codex -C [directory] --full-auto exec "..." -m gpt-5 --skip-git-repo-check -s danger-full-access        # Analysis & execution (default)
codex -C [directory] --full-auto exec "..." -m gpt5-codex --skip-git-repo-check -s danger-full-access   # Large context tasks

# Codex Test/Write Mode (requires explicit MODE=write)
# NOTE: -m, --skip-git-repo-check and -s danger-full-access must be placed at command END
codex -C [directory] --full-auto exec "
PURPOSE: [clear goal]
TASK: [specific task]
MODE: write
CONTEXT: @**/* [default: all files, or specify file patterns and memory context]
EXPECTED: [expected deliverables]
RULES: [template reference and constraints]
" -m gpt-5 --skip-git-repo-check -s danger-full-access
```

---

### Directory Context Configuration

**Tool Directory Navigation**:
- **Gemini & Qwen**: `cd path/to/project && gemini -p "prompt"` (or `qwen`)
- **Codex**: `codex -C path/to/project --full-auto exec "task"` (Codex still supports -C)
- **Path types**: Supports both relative (`../project`) and absolute (`/full/path`) paths
- **Token analysis**: For Gemini/Qwen, token counting happens in current directory

#### ⚠️ Critical Directory Scope Rules

**Once `cd` to a directory**:
- **@ references ONLY apply to current directory and its subdirectories**
- `@**/*` = All files within current directory tree
- `@*.ts` = TypeScript files in current directory tree
- `@src/**/*` = Files within src subdirectory (if exists under current directory)
- **CANNOT reference parent or sibling directories via @ alone**

**To reference files outside current directory (TWO-STEP REQUIREMENT)**:
- **Step 1**: Add `--include-directories` parameter to make external directories ACCESSIBLE
- **Step 2**: Explicitly reference external files in CONTEXT field with @ patterns
- **⚠️ BOTH steps are MANDATORY** - missing either step will fail
- Example: `cd src/auth && gemini -p "CONTEXT: @**/* @../shared/**/*" --include-directories ../shared`
- **Rule**: If CONTEXT contains `@../dir/**/*`, command MUST include `--include-directories ../dir`
- Without `--include-directories`, @ patterns CANNOT access parent/sibling directories at all

#### Multi-Directory Support (Gemini & Qwen)

**Purpose**: For large projects requiring fine-grained access across multiple directories

**Use Case**: When `cd` limits scope but you need to reference files from parent/sibling folders

**Parameter**: `--include-directories <dir1,dir2,...>`
- Includes additional directories in the workspace beyond current `cd` directory
- Can be specified multiple times or as comma-separated values
- Maximum 5 directories can be added
- **REQUIRED** when working in a subdirectory but needing context from parent or sibling directories

**Syntax Options**:
```bash
# Comma-separated format
gemini -p "prompt" --include-directories /path/to/project1,/path/to/project2

# Multiple flags format
gemini -p "prompt" --include-directories /path/to/project1 --include-directories /path/to/project2

# Combined with cd for focused analysis with extended context (RECOMMENDED)
cd src/auth && gemini -p "
PURPOSE: Analyze authentication with shared utilities context
TASK: Review auth implementation and its dependencies
MODE: analysis
CONTEXT: @**/* @../shared/**/* @../types/**/*
EXPECTED: Complete analysis with cross-directory dependencies
RULES: Focus on integration patterns
" --include-directories ../shared,../types
```

**Best Practices**:
- **Recommended Pattern**: Use `cd` to navigate to primary focus directory, then use `--include-directories` for additional context
  - Example: `cd src/auth && gemini -p "CONTEXT: @**/* @../shared/**/*" --include-directories ../shared,../types`
  - **⚠️ CRITICAL**: CONTEXT must explicitly list external files (e.g., `@../shared/**/*`), AND command must include `--include-directories ../shared`
  - Benefits: More precise file references (relative to current directory), clearer intent, better context control
- **Enforcement Rule**: When CONTEXT references external directories, ALWAYS add corresponding `--include-directories`
- Use when `cd` alone limits necessary context visibility
- Keep directory count ≤ 5 for optimal performance
- **Pattern matching rule**: `@../dir/**/*` in CONTEXT → `--include-directories ../dir` in command (MANDATORY)
- Prefer `cd + --include-directories` over multiple `cd` commands for cross-directory analysis

---

### CONTEXT Field Configuration

#### File Pattern Reference

**Default Pattern**:
- **All files (default)**: `@**/*` - Use this as default for comprehensive context

**Common Patterns**:
- Source files: `@src/**/*`
- TypeScript: `@*.ts @*.tsx` (multiple @ for multiple patterns)
- With docs: `@CLAUDE.md @**/*CLAUDE.md` (multiple @ for multiple patterns)
- Tests: `@src/**/*.test.*`

#### Complex Pattern Discovery

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
CONTEXT: @src/components/Auth.tsx @src/types/auth.d.ts @src/hooks/useAuth.ts

# Step 3: Execute CLI with precise file references
cd src && gemini -p "
PURPOSE: Analyze authentication components
TASK: Review auth component patterns and props interfaces
MODE: analysis
CONTEXT: @components/Auth.tsx @types/auth.d.ts @hooks/useAuth.ts
EXPECTED: Pattern analysis and improvement suggestions
RULES: Focus on type safety and component composition
"
```

---

### RULES Field Configuration

#### Basic Format
```bash
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints]
```

#### ⚠️ CRITICAL: Command Substitution Rules

When using `$(cat ...)` for template loading in actual CLI commands:
- **Template reference only, never read**: When user specifies template name, use `$(cat ...)` directly in RULES field, do NOT read template content first
- **NEVER use escape characters**: `\$`, `\"`, `\'` will break command substitution
- **In prompt context**: Path in `$(cat ...)` needs NO quotes (tilde expands correctly)
- **Correct**: `RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)`
- **WRONG**: `RULES: \$(cat ...)` or `RULES: $(cat \"...\")` or `RULES: $(cat '...')`
- **Why**: Shell executes `$(...)` in subshell where path is safe without quotes

#### Examples
- Single template: `$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | Focus on security`
- Multiple templates: `$(cat template1.txt) $(cat template2.txt) | Enterprise standards`
- No template: `Focus on security patterns, include dependency analysis`
- File patterns: `@src/**/*.ts @CLAUDE.md - Stay within scope`

---

### Template System

#### Base Structure
`~/.claude/workflows/cli-templates/`

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
│   └── claude-module-unified.txt  - Universal module/file documentation template
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

#### Task-Template Selection Matrix

| Task Type | Tool | Use Case | Template |
|-----------|------|----------|-----------|
| **Analysis** | Gemini (Qwen fallback) | Code exploration, architecture review, patterns | `analysis/pattern.txt` |
| **Architecture** | Gemini (Qwen fallback) | System design, architectural analysis | `analysis/architecture.txt` |
| **Documentation** | Gemini (Qwen fallback) | Code docs, API specs, guides | `analysis/quality.txt` |
| **Development** | Codex | Feature implementation, bug fixes, testing | `development/feature.txt` |
| **Planning** | Gemini/Qwen | Task breakdown, migration planning | `planning/task-breakdown.txt` |
| **Security** | Codex | Vulnerability assessment, fixes | `analysis/security.txt` |
| **Refactoring** | Multiple | Gemini/Qwen for analysis, Codex for execution | `development/refactor.txt` |
| **Module Documentation** | Gemini (Qwen fallback) | Universal module/file documentation for all levels | `memory/claude-module-unified.txt` |

---

## ⚙️ Execution Configuration

### Dynamic Timeout Allocation

**Timeout Ranges**:
- **Simple tasks** (analysis, search): 20-40min (1200000-2400000ms)
- **Medium tasks** (refactoring, documentation): 40-60min (2400000-3600000ms)
- **Complex tasks** (implementation, migration): 60-120min (3600000-7200000ms)

**Codex Multiplier**: Codex commands use 1.5x of allocated time

**Application**: All bash() wrapped commands including Gemini, Qwen and Codex executions

**Auto-detection**: Analyze PURPOSE and TASK fields to determine appropriate timeout

**Command Examples**:
```bash
bash(gemini -p "prompt")  # Simple analysis: 20-40min
bash(codex -C directory --full-auto exec "task")  # Complex implementation: 90-180min
```

---

### Permission Framework

#### Write Operation Protection

**⚠️ WRITE PROTECTION**: Local codebase write/modify requires EXPLICIT user confirmation

**Mode Hierarchy**:
- **Analysis Mode (default)**: Read-only, safe for auto-execution
- **Write Mode**: Requires user explicitly states MODE=write or MODE=auto in prompt
- **Exception**: User provides clear instructions like "modify", "create", "implement"

#### Tool-Specific Permissions

**Gemini/Qwen Write Access**:
- Use `--approval-mode yolo` ONLY when MODE=write explicitly specified
- **Parameter Position**: Place AFTER the prompt: `gemini -p "..." --approval-mode yolo`

**Codex Write Access**:
- Use `-s danger-full-access` and `--skip-git-repo-check` ONLY when MODE=auto explicitly specified
- **Parameter Position**: Place AFTER the prompt string at command END: `codex ... exec "..." --skip-git-repo-check -s danger-full-access`

**Default Behavior**: All tools default to analysis/read-only mode without explicit write permission

---

## 🔧 Best Practices

### General Guidelines

**Workflow Principles**:
- **Start with templates** - Use predefined templates for consistency
- **Be specific** - Clear PURPOSE, TASK, and EXPECTED fields
- **Include constraints** - File patterns, scope, requirements in RULES
- **Discover patterns first** - Use rg/MCP for complex file discovery before CLI execution
- **Build precise CONTEXT** - Convert discovery results to explicit file references
- **Document context** - Always reference CLAUDE.md for context
- **Default to full context** - Use `@**/*` in CONTEXT for comprehensive analysis unless specific files needed
- **⚠️ No escape characters in CLI commands** - NEVER use `\$`, `\"`, `\'` in actual CLI execution (breaks command substitution and path expansion)

---

### Context Optimization Strategy

**Directory Navigation**: Use `cd [directory] &&` pattern when analyzing specific areas to reduce irrelevant context

**When to change directory**:
- Specific directory mentioned → Use `cd directory &&` pattern
- Focused analysis needed → Target specific directory with cd
- Multi-directory scope → Use `cd` + `--include-directories` for precise control

**When to use `--include-directories`**:
- Working in subdirectory but need parent/sibling context
- Cross-directory dependency analysis required
- Multiple related modules need simultaneous access

---

### Workflow Integration (REQUIRED)

When planning any coding task, **ALWAYS** integrate CLI tools:

1. **Understanding Phase**: Use Gemini for analysis (Qwen as fallback)
2. **Architecture Phase**: Use Gemini for design and analysis (Qwen as fallback)
3. **Implementation Phase**: Use Codex for development
4. **Quality Phase**: Use Codex for testing and validation

---

### Planning Checklist

For every development task:
- [ ] **Purpose defined** - Clear goal and intent
- [ ] **Mode selected** - Execution mode and permission level determined
- [ ] **Context gathered** - File references and session memory documented (default `@**/*`)
- [ ] **Directory navigation** - Determine if `cd` or `cd + --include-directories` needed
- [ ] **Gemini analysis** completed for understanding
- [ ] **Template selected** - Appropriate template chosen
- [ ] **Constraints specified** - File patterns, scope, requirements
- [ ] **Implementation approach** - Tool selection and workflow
