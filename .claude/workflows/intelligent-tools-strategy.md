# Intelligent Tools Selection Strategy

## Table of Contents
1. [Quick Start](#-quick-start)
2. [Tool Specifications](#-tool-specifications)
3. [Command Templates](#-command-templates)
4. [Execution Configuration](#-execution-configuration)
5. [Best Practices](#-best-practices)

---

## Quick Start

### Universal Prompt Template

All CLI tools (Gemini, Qwen, Codex) share this template structure:

```
PURPOSE: [objective + why + success criteria]
TASK: • [step 1] • [step 2] • [step 3]
MODE: [analysis|write|auto]
CONTEXT: @**/* | Memory: [session/tech/module context]
EXPECTED: [format + quality + structure]
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | [constraints] | MODE=[permission level]
```

### Tool Selection

- **Analysis/Documentation** → Gemini (preferred) or Qwen (fallback)
- **Implementation/Testing** → Codex

### CCW Unified CLI Syntax

```bash
# Basic execution
ccw cli exec "<prompt>" --tool <gemini|qwen|codex> --mode <analysis|write|auto>

# With working directory
ccw cli exec "<prompt>" --tool gemini --cd <path>

# With additional directories
ccw cli exec "<prompt>" --tool gemini --includeDirs ../shared,../types

# Full example
ccw cli exec "<prompt>" --tool codex --mode auto --cd ./project --includeDirs ./lib
```

### CLI Subcommands

| Command | Description |
|---------|-------------|
| `ccw cli status` | Check CLI tools availability |
| `ccw cli exec "<prompt>"` | Execute a CLI tool |
| `ccw cli exec "<prompt>" --resume [id]` | Resume a previous session |
| `ccw cli history` | Show execution history |
| `ccw cli detail <id>` | Show execution detail |

### Model Selection

**Available Models** (override via `--model`):
- Gemini: `gemini-2.5-pro`, `gemini-2.5-flash`
- Qwen: `coder-model`, `vision-model`
- Codex: `gpt-5.1`, `gpt-5.1-codex`, `gpt-5.1-codex-mini`

**Best Practice**: Omit `--model` for optimal auto-selection

### Core Principles

- **Use tools early and often** - Tools are faster and more thorough
- **When in doubt, use both** - Parallel usage provides comprehensive coverage
- **Default to tools** - Use for most coding tasks, no matter how small
- **Unified CLI** - Always use `ccw cli exec` for consistent parameter handling
- **Choose templates by need** - See [Template System](#template-system) for naming conventions and selection guide
- **Write protection** - Require EXPLICIT MODE=write or MODE=auto specification

---

## Tool Specifications

### MODE Options

**analysis** (default)
- Read-only operations, no file modifications
- Analysis output returned as text response
- Use for: code review, architecture analysis, pattern discovery
- CCW: `ccw cli exec "<prompt>" --mode analysis`

**write**
- File creation/modification/deletion allowed
- Requires explicit `--mode write` specification
- Use for: documentation generation, code creation, file modifications
- CCW: `ccw cli exec "<prompt>" --mode write`

**auto** (Codex only)
- Full autonomous development operations
- Requires explicit `--mode auto` specification
- Use for: feature implementation, bug fixes, autonomous development
- CCW: `ccw cli exec "<prompt>" --tool codex --mode auto`

### Gemini & Qwen

**Via CCW**: `ccw cli exec "<prompt>" --tool gemini` or `--tool qwen`

**Strengths**: Large context window, pattern recognition

**Best For**: Analysis, documentation generation, code exploration, architecture review

**Default MODE**: `analysis` (read-only)

**Priority**: Prefer Gemini; use Qwen as fallback when Gemini unavailable

**Error Handling**:
- **HTTP 429**: May show error but still return results - check if results exist (results present = success, no results = retry/fallback to Qwen)

### Codex

**Via CCW**: `ccw cli exec "<prompt>" --tool codex --mode auto`

**Strengths**: Autonomous development, mathematical reasoning

**Best For**: Implementation, testing, automation

**Default MODE**: No default, must be explicitly specified

### Session Resume

**Resume via `--resume` parameter** (integrated into exec):
```bash
# Resume last session with continuation prompt
ccw cli exec "Now add error handling" --resume --tool gemini
ccw cli exec "Continue analyzing security" --resume --tool gemini

# Resume specific session by ID with prompt
ccw cli exec "Fix the issues you found" --resume <execution-id> --tool gemini

# Resume last session (empty --resume = last)
ccw cli exec "Continue analysis" --resume
```

**Resume Parameter**:
| Value | Description |
|-------|-------------|
| `--resume` (empty) | Resume most recent session |
| `--resume <id>` | Resume specific execution ID |

**Context Assembly** (automatic):
```
=== PREVIOUS CONVERSATION ===

USER PROMPT:
[Previous prompt content]

ASSISTANT RESPONSE:
[Previous output]

=== CONTINUATION ===

[Your new prompt content here]
```

**Tool-Specific Behavior**:
- **Codex**: Uses native `codex resume` command
- **Gemini/Qwen**: Assembles previous prompt + response + new prompt as single context

---

## Command Templates

### Universal Template Structure

Every command MUST follow this structure:

- [ ] **PURPOSE** - Clear goal and intent
  - State the high-level objective of this execution
  - Explain why this task is needed
  - Define success criteria
  - Example: "Analyze authentication module to identify security vulnerabilities"

- [ ] **TASK** - Specific execution task (use list format: • Task item 1 • Task item 2 • Task item 3)
  - Break down PURPOSE into concrete, actionable steps
  - Use bullet points (•) for multiple sub-tasks
  - Order tasks by execution sequence
  - Example: "• Review auth implementation patterns • Identify potential security risks • Document findings with recommendations"

- [ ] **MODE** - Execution mode and permission level
  - `analysis` (default): Read-only operations, no file modifications
  - `write`: File creation/modification/deletion allowed (requires explicit specification)
  - `auto`: Full autonomous development operations (Codex only, requires explicit specification)
  - Example: "MODE: analysis" or "MODE: write"

- [ ] **CONTEXT** - File references and memory context from previous sessions
  - **File Patterns**: Use @ syntax for file references (default: `@**/*` for all files)
    - `@**/*` - All files in current directory tree
    - `@src/**/*.ts` - TypeScript files in src directory
    - `@../shared/**/*` - Files from sibling directory (requires `--includeDirs`)
  - **Memory Context**: Reference previous session findings and context
    - Related tasks: `Building on previous analysis from [session/commit]`
    - Tech stack: `Using patterns from [tech-stack-name] documentation`
    - Cross-reference: `Related to implementation in [module/file]`
  - **Memory Sources**: Include relevant memory sources
    - Documentation: `CLAUDE.md`, module-specific docs
  - Example: "CONTEXT: @src/auth/**/* @CLAUDE.md | Memory: Building on previous auth refactoring (commit abc123)"

- [ ] **EXPECTED** - Clear expected results
  - Specify deliverable format (report, code, documentation, list)
  - Define quality criteria
  - State output structure requirements
  - Example: "Comprehensive security report with categorized findings, risk levels, and actionable recommendations"

- [ ] **RULES** - Template reference and constraints (include mode constraints: analysis=READ-ONLY | write=CREATE/MODIFY/DELETE | auto=FULL operations)
  - Reference templates: `$(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt)`
  - Specify constraints and boundaries
  - Include mode-specific constraints:
    - `analysis=READ-ONLY` - No file modifications
    - `write=CREATE/MODIFY/DELETE` - File operations allowed
    - `auto=FULL operations` - Autonomous development
  - Example: "$(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt) | Focus on authentication flows only | analysis=READ-ONLY"

### Standard Prompt Template

```
PURPOSE: [clear goal - state objective, why needed, success criteria]
TASK:
• [specific task - actionable step 1]
• [specific task - actionable step 2]
• [specific task - actionable step 3]
MODE: [analysis|write|auto]
CONTEXT: @**/* | Memory: [previous session findings, related implementations, tech stack patterns, workflow context]
EXPECTED: [deliverable format, quality criteria, output structure, testing requirements (if applicable)]
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[0X-template-name].txt) | [additional constraints] | [MODE]=[READ-ONLY|CREATE/MODIFY/DELETE|FULL operations]
```

### CCW CLI Execution

Use the **[Standard Prompt Template](#standard-prompt-template)** for all tools. CCW provides unified command syntax.

#### Basic Command Format

```bash
ccw cli exec "<Standard Prompt Template>" [options]
```

#### Common Options

| Option | Description | Default |
|--------|-------------|---------|
| `--tool <tool>` | CLI tool: gemini, qwen, codex | gemini |
| `--mode <mode>` | Mode: analysis, write, auto | analysis |
| `--model <model>` | Model override | auto-select |
| `--cd <path>` | Working directory | current dir |
| `--includeDirs <dirs>` | Additional directories (comma-separated) | none |
| `--timeout <ms>` | Timeout in milliseconds | 300000 |
| `--no-stream` | Disable streaming output | false |

#### Command Examples

```bash
# Analysis Mode (default, read-only) - Gemini
ccw cli exec "
PURPOSE: Analyze authentication with shared utilities context
TASK: Review auth implementation and its dependencies
MODE: analysis
CONTEXT: @**/* @../shared/**/*
EXPECTED: Complete analysis with cross-directory dependencies
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-analyze-code-patterns.txt) | analysis=READ-ONLY
" --tool gemini --cd src/auth --includeDirs ../shared,../types

# Write Mode - Gemini with file modifications
ccw cli exec "
PURPOSE: Generate documentation for API module
TASK: • Create API docs • Add usage examples • Update README
MODE: write
CONTEXT: @src/api/**/*
EXPECTED: Complete API documentation
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/02-implement-feature.txt) | write=CREATE/MODIFY/DELETE
" --tool gemini --mode write --cd src

# Auto Mode - Codex for implementation
ccw cli exec "
PURPOSE: Implement authentication module
TASK: • Create auth service • Add user validation • Setup JWT tokens
MODE: auto
CONTEXT: @**/* | Memory: Following security patterns from project standards
EXPECTED: Complete auth module with tests
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/02-implement-feature.txt) | auto=FULL operations
" --tool codex --mode auto --cd project

# Fallback to Qwen
ccw cli exec "
PURPOSE: Analyze code patterns
TASK: Review implementation patterns
MODE: analysis
CONTEXT: @**/*
EXPECTED: Pattern analysis report
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-analyze-code-patterns.txt) | analysis=READ-ONLY
" --tool qwen
```

#### Tool Fallback Strategy

```bash
# Primary: Gemini
ccw cli exec "<prompt>" --tool gemini

# Fallback: Qwen (if Gemini fails or unavailable)
ccw cli exec "<prompt>" --tool qwen

# Check tool availability
ccw cli status
```

### Directory Context Configuration

**CCW Directory Options**:
- `--cd <path>`: Set working directory for execution
- `--includeDirs <dir1,dir2>`: Include additional directories

#### Critical Directory Scope Rules

**When using `--cd` to set working directory**:
- @ references ONLY apply to that directory and subdirectories
- `@**/*` = All files within working directory tree
- `@*.ts` = TypeScript files in working directory tree
- `@src/**/*` = Files within src subdirectory
- CANNOT reference parent/sibling directories via @ alone

**To reference files outside working directory (TWO-STEP REQUIREMENT)**:
1. Add `--includeDirs` parameter to make external directories ACCESSIBLE
2. Explicitly reference external files in CONTEXT field with @ patterns
3. Both steps are MANDATORY

Example:
```bash
ccw cli exec "CONTEXT: @**/* @../shared/**/*" --tool gemini --cd src/auth --includeDirs ../shared
```

**Rule**: If CONTEXT contains `@../dir/**/*`, command MUST include `--includeDirs ../dir`

#### Multi-Directory Examples

```bash
# Single additional directory
ccw cli exec "<prompt>" --tool gemini --cd src/auth --includeDirs ../shared

# Multiple additional directories
ccw cli exec "<prompt>" --tool gemini --cd src/auth --includeDirs ../shared,../types,../utils

# With full prompt template
ccw cli exec "
PURPOSE: Analyze authentication with shared utilities context
TASK: Review auth implementation and its dependencies
MODE: analysis
CONTEXT: @**/* @../shared/**/* @../types/**/*
EXPECTED: Complete analysis with cross-directory dependencies
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-analyze-code-patterns.txt) | Focus on integration patterns | analysis=READ-ONLY
" --tool gemini --cd src/auth --includeDirs ../shared,../types
```

### CONTEXT Field Configuration

CONTEXT field consists of: **File Patterns** + **Memory Context**

#### File Pattern Reference

**Default**: `@**/*` (all files - use as default for comprehensive context)

**Common Patterns**:
- Source files: `@src/**/*`
- TypeScript: `@*.ts @*.tsx`
- With docs: `@CLAUDE.md @**/*CLAUDE.md`
- Tests: `@src/**/*.test.*`

#### Memory Context Integration

**Purpose**: Leverage previous session findings, related implementations, and established patterns to provide continuity

**Format**: `CONTEXT: [file patterns] | Memory: [memory context]`

**Memory Sources**:

1. **Related Tasks** - Cross-task context
   - Previous refactoring, task extensions, conflict resolution

2. **Tech Stack Patterns** - Framework and library conventions
   - React hooks patterns, TypeScript utilities, security guidelines

3. **Cross-Module References** - Inter-module dependencies
   - Integration points, shared utilities, type dependencies

**Memory Context Examples**:

```bash
# Example 1: Building on related task
CONTEXT: @src/auth/**/* @CLAUDE.md | Memory: Building on previous auth refactoring (commit abc123), implementing refresh token mechanism following React hooks patterns

# Example 2: Cross-module integration
CONTEXT: @src/payment/**/* @src/shared/types/**/* | Memory: Integration with auth module from previous implementation, using shared error handling patterns from @shared/utils/errors.ts
```

**Best Practices**:
- **Always include memory context** when building on previous work
- **Reference commits/tasks**: Use commit hashes or task IDs for traceability
- **Document dependencies** with explicit file references
- **Cross-reference implementations** with file paths
- **Use consistent format**: `CONTEXT: [file patterns] | Memory: [memory context]`

#### Complex Pattern Discovery

For complex file pattern requirements, use semantic discovery BEFORE CLI execution:

**Tools**:
- `rg (ripgrep)` - Content-based file discovery with regex
- `mcp__code-index__search_code_advanced` - Semantic file search

**Workflow**: Discover → Extract precise paths → Build CONTEXT field

**Example**:
```bash
# Step 1: Discover files semantically
rg "export.*Component" --files-with-matches --type ts
mcp__code-index__search_code_advanced(pattern="interface.*Props", file_pattern="*.tsx")

# Step 2: Build precise CONTEXT with file patterns + memory
CONTEXT: @src/components/Auth.tsx @src/types/auth.d.ts @src/hooks/useAuth.ts | Memory: Previous refactoring identified type inconsistencies, following React hooks patterns

# Step 3: Execute CLI with precise references
ccw cli exec "
PURPOSE: Analyze authentication components for type safety improvements
TASK:
• Review auth component patterns and props interfaces
• Identify type inconsistencies in auth components
• Recommend improvements following React best practices
MODE: analysis
CONTEXT: @components/Auth.tsx @types/auth.d.ts @hooks/useAuth.ts | Memory: Previous refactoring identified type inconsistencies, following React hooks patterns, related implementation in @hooks/useAuth.ts (commit abc123)
EXPECTED: Comprehensive analysis report with type safety recommendations, code examples, and references to previous findings
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/02-analyze-code-patterns.txt) | Focus on type safety and component composition | analysis=READ-ONLY
" --tool gemini --cd src
```

### RULES Field Configuration

**Basic Format**: `RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints]`

**Command Substitution Rules**:
- **Template reference only, never read**: Use `$(cat ...)` directly, do NOT read template content first
- **NEVER use escape characters**: `\$`, `\"`, `\'` will break command substitution
- **In prompt context**: Path needs NO quotes (tilde expands correctly)
- **Correct**: `RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/01-trace-code-execution.txt)`
- **WRONG**: `RULES: \$(cat ...)` or `RULES: $(cat \"...\")`
- **Why**: Shell executes `$(...)` in subshell where path is safe

**Examples**:
- General template: `$(cat ~/.claude/workflows/cli-templates/prompts/analysis/01-diagnose-bug-root-cause.txt) | Focus on authentication module`
- Multiple: `$(cat template1.txt) $(cat template2.txt) | Enterprise standards`
- No template: `Focus on security patterns, include dependency analysis`

### Template System

**Base**: `~/.claude/workflows/cli-templates/

**Naming Convention**:
- `00-*` - **Universal fallback templates** (use when no specific template matches)
- `01-*` - Universal, high-frequency templates
- `02-*` - Common specialized templates
- `03-*` - Domain-specific, less frequent templates

**Note**: Number prefix indicates category and frequency, not required usage order. Choose based on task needs.

**Universal Templates**:

When no specific template matches your task requirements, use one of these universal templates based on the desired execution style:

1. **Rigorous Style** (`universal/00-universal-rigorous-style.txt`)
   - **Use for**: Precision-critical tasks requiring systematic methodology

2. **Creative Style** (`universal/00-universal-creative-style.txt`)
   - **Use for**: Exploratory tasks requiring innovative solutions

**Selection Guide**:
- **Rigorous**: When correctness, reliability, and compliance are paramount
- **Creative**: When innovation, flexibility, and elegant solutions are needed
- **Specific template**: When task matches predefined category (analysis, development, planning, etc.)

**Task-Template Matrix**:

| Task Type | Tool | Template |
|-----------|------|----------|
| **Universal Fallbacks** | | |
| Precision-Critical Tasks | Gemini/Qwen/Codex | `universal/00-universal-rigorous-style.txt` |
| Exploratory/Innovative Tasks | Gemini/Qwen/Codex | `universal/00-universal-creative-style.txt` |
| **Analysis Tasks** | | |
| Execution Tracing | Gemini (Qwen fallback) | `analysis/01-trace-code-execution.txt` |
| Bug Diagnosis | Gemini (Qwen fallback) | `analysis/01-diagnose-bug-root-cause.txt` |
| Code Pattern Analysis | Gemini (Qwen fallback) | `analysis/02-analyze-code-patterns.txt` |
| Document Analysis | Gemini (Qwen fallback) | `analysis/02-analyze-technical-document.txt` |
| Architecture Review | Gemini (Qwen fallback) | `analysis/02-review-architecture.txt` |
| Code Review | Gemini (Qwen fallback) | `analysis/02-review-code-quality.txt` |
| Performance Analysis | Gemini (Qwen fallback) | `analysis/03-analyze-performance.txt` |
| Security Assessment | Gemini (Qwen fallback) | `analysis/03-assess-security-risks.txt` |
| Quality Standards | Gemini (Qwen fallback) | `analysis/03-review-quality-standards.txt` |
| **Planning Tasks** | | |
| Architecture Planning | Gemini (Qwen fallback) | `planning/01-plan-architecture-design.txt` |
| Task Breakdown | Gemini (Qwen fallback) | `planning/02-breakdown-task-steps.txt` |
| Component Design | Gemini (Qwen fallback) | `planning/02-design-component-spec.txt` |
| Concept Evaluation | Gemini (Qwen fallback) | `planning/03-evaluate-concept-feasibility.txt` |
| Migration Planning | Gemini (Qwen fallback) | `planning/03-plan-migration-strategy.txt` |
| **Development Tasks** | | |
| Feature Development | Codex | `development/02-implement-feature.txt` |
| Refactoring | Codex | `development/02-refactor-codebase.txt` |
| Test Generation | Codex | `development/02-generate-tests.txt` |
| Component Implementation | Codex | `development/02-implement-component-ui.txt` |
| Debugging | Codex | `development/03-debug-runtime-issues.txt` |
---

## Execution Configuration

### Dynamic Timeout Allocation

**Minimum timeout: 5 minutes (300000ms)** - Never set below this threshold.

**Timeout Ranges**:
- **Simple** (analysis, search): 5-10min (300000-600000ms)
- **Medium** (refactoring, documentation): 10-20min (600000-1200000ms)
- **Complex** (implementation, migration): 20-60min (1200000-3600000ms)
- **Heavy** (large codebase, multi-file): 60-120min (3600000-7200000ms)

**Codex Multiplier**: 3x of allocated time (minimum 15min / 900000ms)

**CCW Timeout Usage**:
```bash
ccw cli exec "<prompt>" --tool gemini --timeout 600000  # 10 minutes
ccw cli exec "<prompt>" --tool codex --timeout 1800000  # 30 minutes
```

**Auto-detection**: Analyze PURPOSE and TASK fields to determine timeout

### Permission Framework

**Single-Use Explicit Authorization**: Each CLI execution requires explicit user command instruction - one command authorizes ONE execution only. Analysis does NOT authorize write operations. Previous authorization does NOT carry over. Each operation needs NEW explicit user directive.

**Mode Hierarchy**:
- **analysis** (default): Read-only, safe for auto-execution
- **write**: Requires explicit `--mode write` specification
- **auto**: Requires explicit `--mode auto` specification
- **Exception**: User provides clear instructions like "modify", "create", "implement"

**CCW Mode Permissions**:
```bash
# Analysis (default, no special permissions)
ccw cli exec "<prompt>" --tool gemini

# Write mode (enables file modifications)
ccw cli exec "<prompt>" --tool gemini --mode write

# Auto mode (full autonomous operations, Codex only)
ccw cli exec "<prompt>" --tool codex --mode auto
```

**Default**: All tools default to analysis/read-only mode

---

## Best Practices

### Workflow Principles

- **Use CCW unified interface** - `ccw cli exec` for all tool executions
- **Start with templates** - Use predefined templates for consistency
- **Be specific** - Clear PURPOSE, TASK, and EXPECTED fields with detailed descriptions
- **Include constraints** - File patterns, scope, requirements in RULES
- **Leverage memory context** - ALWAYS include Memory field when building on previous work
  - Cross-reference tasks with file paths and commit hashes
  - Document dependencies with explicit file references
  - Reference related implementations and patterns
- **Discover patterns first** - Use rg/MCP for complex file discovery before CLI execution
- **Build precise CONTEXT** - Convert discovery to explicit file references with memory
  - Format: `CONTEXT: [file patterns] | Memory: [memory context]`
  - File patterns: `@**/*` (default) or specific patterns
  - Memory: Previous sessions, tech stack patterns, cross-references
- **Document context** - Always reference CLAUDE.md and relevant documentation
- **Default to full context** - Use `@**/*` unless specific files needed
- **No escape characters** - NEVER use `\$`, `\"`, `\'` in CLI commands

### Context Optimization Strategy

**Directory Navigation**: Use `--cd [directory]` to focus on specific directory

**When to set working directory**:
- Specific directory mentioned → Use `--cd directory`
- Focused analysis needed → Target specific directory
- Multi-directory scope → Use `--cd` + `--includeDirs`

**When to use `--includeDirs`**:
- Working in subdirectory but need parent/sibling context
- Cross-directory dependency analysis required
- Multiple related modules need simultaneous access
- **Key benefit**: Excludes unrelated directories, reduces token usage

### Workflow Integration

When planning any coding task, **ALWAYS** integrate CLI tools via CCW:

1. **Understanding Phase**: `ccw cli exec "<prompt>" --tool gemini`
2. **Architecture Phase**: `ccw cli exec "<prompt>" --tool gemini`
3. **Implementation Phase**: `ccw cli exec "<prompt>" --tool codex --mode auto`
4. **Quality Phase**: `ccw cli exec "<prompt>" --tool codex --mode write`

### Planning Checklist

For every development task:
- [ ] **Purpose defined** - Clear goal and intent
- [ ] **Mode selected** - Execution mode (`--mode analysis|write|auto`)
- [ ] **Context gathered** - File references and session memory documented (default `@**/*`)
- [ ] **Directory navigation** - Determine if `--cd` or `--cd + --includeDirs` needed
- [ ] **Tool selected** - `--tool gemini|qwen|codex` based on task type
- [ ] **Template applied** - Use Standard Prompt Template
- [ ] **Constraints specified** - File patterns, scope, requirements
- [ ] **Timeout configured** - `--timeout` based on task complexity

