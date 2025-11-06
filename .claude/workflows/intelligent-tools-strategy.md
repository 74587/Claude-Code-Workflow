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
- `gemini-3-pro-preview-11-2025` - Analysis tasks (default, preferred)
- `gemini-2.5-pro` - Analysis tasks (alternative)
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
| **Multi-directory Analysis** | Gemini → Qwen | `cd [main-dir] && gemini -p "CONTEXT: @**/* @../dep/**/*" --include-directories ../dep` (reduces noise) |
| **Building/Fixing** | Codex | `codex -C [dir] --full-auto exec "PURPOSE:... MODE: auto"` |
| **Not sure?** | Multiple | Use tools in parallel |
| **Small task?** | Still use tools | Tools are faster than manual work |

### Core Principles
- **Use tools early and often** - Tools are faster, more thorough, and reliable than manual approaches
- **When in doubt, use both** - Parallel usage provides comprehensive coverage
- **Default to tools** - Use specialized tools for most coding tasks, no matter how small
- **Lower barriers** - Engage tools immediately when encountering any complexity
- **Minimize context noise** - Use `cd` + `--include-directories` to focus on relevant files, exclude unrelated directories
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

#### Error Handling
**⚠️ Gemini 429 Behavior**: May show HTTP 429 error but still return results - ignore error messages, only check if results exist (results present = success, no results = retry/fallback to Qwen)

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
    - `@../shared/**/*` - Files from sibling directory (requires `--include-directories`)
  - **Memory Context**: Reference previous session findings and context
    - Workflow sessions: `Previous WFS-session-id findings: [key insights]`
    - Related tasks: `Building on previous analysis from [session/commit]`
    - Tech stack: `Using patterns from [tech-stack-name] documentation`
    - Cross-reference: `Related to implementation in [module/file]`
  - **Memory Sources**: Include relevant memory packages
    - SKILL packages: `Skill(workflow-progress)`, `Skill(react-dev)`, `Skill(project-name)`
    - Session artifacts: `.workflow/[session-id]/artifacts/`
    - Documentation: `CLAUDE.md`, module-specific docs
  - Example: "CONTEXT: @src/auth/**/* @CLAUDE.md | Memory: Previous WFS-20241105-001 identified JWT validation gap"

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

---

### Standard Command Formats

#### Gemini & Qwen Commands

```bash
# Analysis Mode (read-only, default)
# Use 'gemini' (primary) or 'qwen' (fallback)
cd [directory] && gemini -p "
PURPOSE: [clear analysis goal - state objective, why needed, success criteria]
TASK:
• [specific analysis task - actionable step 1]
• [specific analysis task - actionable step 2]
• [specific analysis task - actionable step 3]
MODE: analysis
CONTEXT: @**/* [default: all files, or specify file patterns] | Memory: [previous session findings, related implementations, tech stack patterns]
EXPECTED: [deliverable format, quality criteria, output structure]
RULES: [template reference and constraints] | analysis=READ-ONLY
"

# Model Selection Examples (NOTE: -m placed AFTER prompt)
cd [directory] && gemini -p "..." -m gemini-3-pro-preview-11-2025      # Analysis (default, preferred)
cd [directory] && gemini -p "..." -m gemini-2.5-pro      # Analysis (alternative)
cd [directory] && gemini -p "..." -m gemini-2.5-flash    # Documentation updates
cd [directory] && qwen -p "..."                          # coder-model (default, -m optional)
cd [directory] && qwen -p "..." -m vision-model           # Image analysis (rare)

# Write Mode (requires explicit MODE=write)
# NOTE: --approval-mode yolo must be placed AFTER the prompt
cd [directory] && gemini -p "
PURPOSE: [clear goal - state objective, why needed, success criteria]
TASK:
• [specific task - actionable step 1]
• [specific task - actionable step 2]
• [specific task - actionable step 3]
MODE: write
CONTEXT: @**/* [default: all files, or specify file patterns] | Memory: [previous session findings, related implementations, tech stack patterns]
EXPECTED: [deliverable format, quality criteria, output structure]
RULES: [template reference and constraints] | write=CREATE/MODIFY/DELETE
" -m gemini-2.5-flash --approval-mode yolo

# Fallback: Replace 'gemini' with 'qwen' if Gemini unavailable
cd [directory] && qwen -p "..." # coder-model default (-m optional)
```

#### Codex Commands

```bash
# Codex Development (requires explicit MODE=auto)
# NOTE: -m, --skip-git-repo-check and -s danger-full-access must be placed at command END
codex -C [directory] --full-auto exec "
PURPOSE: [clear development goal - state objective, why needed, success criteria]
TASK:
• [specific development task - actionable step 1]
• [specific development task - actionable step 2]
• [specific development task - actionable step 3]
MODE: auto
CONTEXT: @**/* [default: all files, or specify file patterns] | Memory: [previous session findings, related implementations, tech stack patterns, workflow context]
EXPECTED: [deliverable format, quality criteria, output structure, testing requirements]
RULES: [template reference and constraints] | auto=FULL operations
" -m gpt-5 --skip-git-repo-check -s danger-full-access

# Model Selection Examples (NOTE: -m placed AFTER prompt, BEFORE flags)
codex -C [directory] --full-auto exec "..." -m gpt-5 --skip-git-repo-check -s danger-full-access        # Analysis & execution (default)
codex -C [directory] --full-auto exec "..." -m gpt5-codex --skip-git-repo-check -s danger-full-access   # Large context tasks

# Codex Test/Write Mode (requires explicit MODE=write)
# NOTE: -m, --skip-git-repo-check and -s danger-full-access must be placed at command END
codex -C [directory] --full-auto exec "
PURPOSE: [clear goal - state objective, why needed, success criteria]
TASK:
• [specific task - actionable step 1]
• [specific task - actionable step 2]
• [specific task - actionable step 3]
MODE: write
CONTEXT: @**/* [default: all files, or specify file patterns] | Memory: [previous session findings, related implementations, tech stack patterns, workflow context]
EXPECTED: [deliverable format, quality criteria, output structure, testing requirements]
RULES: [template reference and constraints] | write=CREATE/MODIFY/DELETE
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

**Purpose**: Reduce irrelevant file noise by focusing analysis on specific directories while maintaining necessary cross-directory context

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
# This pattern minimizes irrelevant files by focusing on src/auth while only including necessary dependencies
cd src/auth && gemini -p "
PURPOSE: Analyze authentication with shared utilities context
TASK: Review auth implementation and its dependencies
MODE: analysis
CONTEXT: @**/* @../shared/**/* @../types/**/*
EXPECTED: Complete analysis with cross-directory dependencies
RULES: Focus on integration patterns
" --include-directories ../shared,../types
# Result: Only src/auth/**, ../shared/**, ../types/** are analyzed, other project files excluded
```

**Best Practices**:
- **Recommended Pattern**: Use `cd` to navigate to primary focus directory, then use `--include-directories` for additional context
  - Example: `cd src/auth && gemini -p "CONTEXT: @**/* @../shared/**/*" --include-directories ../shared,../types`
  - **⚠️ CRITICAL**: CONTEXT must explicitly list external files (e.g., `@../shared/**/*`), AND command must include `--include-directories ../shared`
  - Benefits: **Minimizes irrelevant file interference** (only includes specified directories), more precise file references (relative to current directory), clearer intent, better context control
- **Enforcement Rule**: When CONTEXT references external directories, ALWAYS add corresponding `--include-directories`
- Use when `cd` alone limits necessary context visibility
- Keep directory count ≤ 5 for optimal performance
- **Pattern matching rule**: `@../dir/**/*` in CONTEXT → `--include-directories ../dir` in command (MANDATORY)
- Prefer `cd + --include-directories` over multiple `cd` commands for cross-directory analysis

---

### CONTEXT Field Configuration

CONTEXT field consists of two main components: **File Patterns** and **Memory Context**

#### File Pattern Reference

**Default Pattern**:
- **All files (default)**: `@**/*` - Use this as default for comprehensive context

**Common Patterns**:
- Source files: `@src/**/*`
- TypeScript: `@*.ts @*.tsx` (multiple @ for multiple patterns)
- With docs: `@CLAUDE.md @**/*CLAUDE.md` (multiple @ for multiple patterns)
- Tests: `@src/**/*.test.*`

#### Memory Context Integration

**Purpose**: Leverage previous session findings, related implementations, and established patterns to provide continuity and avoid repeating analysis

**Format**: `CONTEXT: [file patterns] | Memory: [memory context]`

**Memory Sources**:
1. **Workflow Sessions** - Previous WFS session findings and artifacts
   - Format: `WFS-[session-id]: [key findings]`
   - Artifact paths: `.workflow/WFS-[session-id]/artifacts/[artifact-name].md`
   - Common artifacts:
     - Analysis results: `.workflow/WFS-[session-id]/artifacts/analysis.md`
     - Implementation plans: `.workflow/WFS-[session-id]/artifacts/IMPL_PLAN.md`
     - Task definitions: `.workflow/WFS-[session-id]/.task/task.json`
     - Lessons learned: `.workflow/WFS-[session-id]/artifacts/lessons.md`
   - Examples:
     - `WFS-20241105-001: JWT validation gap identified in .workflow/WFS-20241105-001/artifacts/analysis.md`
     - `WFS-20241103-002: Auth refactor documented in .workflow/WFS-20241103-002/artifacts/IMPL_PLAN.md`

2. **SKILL Packages** - Structured knowledge packages (⚠️ MUST load BEFORE CLI execution)
   - **CRITICAL**: SKILL packages MUST be loaded using `Skill()` tool BEFORE executing CLI commands
   - CLI tools (Gemini/Qwen/Codex) do NOT support loading SKILL packages during execution
   - Workflow: Load SKILL → Extract content → Reference in Memory context → Execute CLI
   - Workflow progress: `Skill(workflow-progress)` for session history
   - Tech stacks: `Skill(react-dev)`, `Skill(typescript-dev)` for framework patterns
   - Project docs: `Skill(project-name)` for codebase architecture

3. **Related Tasks** - Cross-task context
   - `Related to previous refactoring in module X (commit abc123)`
   - `Extends implementation from task IMPL-001`
   - `Addresses conflict identified in previous analysis`

4. **Tech Stack Patterns** - Framework and library conventions
   - `Following React hooks patterns from tech stack docs`
   - `Using TypeScript utility types from project standards`
   - `Applying authentication patterns from security guidelines`

5. **Cross-Module References** - Inter-module dependencies
   - `Integration point with payment module analyzed in WFS-20241101-003`
   - `Shares utilities with shared/utils documented in CLAUDE.md`
   - `Depends on types defined in @types/core`

**Memory Context Examples**:
```bash
# Example 1: Building on previous session with explicit artifact paths
# Step 1: Load workflow SKILL package BEFORE CLI execution
Skill(command: "workflow-progress")  # Extract previous session findings
# Step 2: Load tech stack SKILL package
Skill(command: "react-dev")  # Extract React patterns and conventions
# Step 3: Execute CLI with memory context referencing specific artifact paths
CONTEXT: @src/auth/**/* @CLAUDE.md | Memory: WFS-20241105-001 identified JWT validation gap (see .workflow/WFS-20241105-001/artifacts/analysis.md line 45-67), implementing refresh token mechanism following React hooks patterns (loaded from react-dev SKILL)

# Example 2: Cross-module integration with artifact references
CONTEXT: @src/payment/**/* @src/shared/types/**/* | Memory: Integration with auth module from WFS-20241103-002 (implementation plan: .workflow/WFS-20241103-002/artifacts/IMPL_PLAN.md section 3.2), using shared error handling patterns from @shared/utils/errors.ts (established in WFS-20241101-001)

# Example 3: Tech stack patterns with SKILL pre-loaded
# Step 1: Load SKILL package BEFORE CLI execution
Skill(command: "react-dev")  # Extract React custom hooks patterns
# Step 2: Execute CLI with memory context
CONTEXT: @src/hooks/**/* | Memory: Following React custom hooks patterns (loaded from react-dev SKILL), previous analysis in .workflow/WFS-20241102-003/artifacts/analysis.md showed need for useAuth refactor (commit abc123, see src/hooks/useAuth.ts:23-45)

# Example 4: Workflow continuity with specific artifact paths
# Step 1: Load workflow SKILL package BEFORE CLI execution
Skill(command: "workflow-progress")  # Extract previous session findings
# Step 2: Execute CLI with memory context referencing specific artifacts
CONTEXT: @**/* | Memory: Continuing from WFS-20241104-005 API refactor (findings from workflow-progress SKILL, detailed analysis: .workflow/WFS-20241104-005/artifacts/analysis.md, implementation plan: .workflow/WFS-20241104-005/artifacts/IMPL_PLAN.md), applying RESTful patterns documented in section 2.1
```

**Best Practices**:
- **Always include memory context** when building on previous work
- **Reference specific session IDs** with format `WFS-[session-id]` for traceability
- **Specify artifact paths** explicitly: `.workflow/WFS-[session-id]/artifacts/[artifact-name].md`
- **Include line numbers/sections** when referencing specific findings: `(line 45-67)` or `(section 3.2)`
- **Load SKILL packages BEFORE CLI execution** - CLI tools do not support loading SKILL during execution
  - Workflow: `Skill(command: "workflow-progress")` → Extract findings → Reference in Memory
  - Tech stacks: `Skill(command: "tech-name")` → Extract patterns → Reference in Memory
  - Project docs: `Skill(command: "project-name")` → Extract architecture → Reference in Memory
- **Cross-reference artifacts** with full paths for detailed context
- **Document dependencies** between sessions and modules with explicit file references
- **Use consistent format**: `CONTEXT: [file patterns] | Memory: [memory context with paths]`

#### Complex Pattern Discovery

For complex file pattern requirements, use semantic discovery tools BEFORE CLI execution:
- **rg (ripgrep)**: Content-based file discovery with regex patterns
- **Code Index MCP**: Semantic file search based on task requirements
- **Workflow**: Discover → Extract precise paths → Build CONTEXT field

**Example**:
```bash
# Step 1: Load SKILL packages BEFORE CLI execution (CRITICAL - CLI cannot load SKILL)
Skill(command: "workflow-progress")  # Extract previous session findings
Skill(command: "react-dev")          # Extract React patterns and conventions

# Step 2: Discover files semantically
rg "export.*Component" --files-with-matches --type ts  # Find component files
mcp__code-index__search_code_advanced(pattern="interface.*Props", file_pattern="*.tsx")  # Find interface files

# Step 3: Build precise CONTEXT with both file patterns and memory context (with explicit paths)
CONTEXT: @src/components/Auth.tsx @src/types/auth.d.ts @src/hooks/useAuth.ts | Memory: WFS-20241103-002 identified type inconsistencies (see .workflow/WFS-20241103-002/artifacts/analysis.md line 34-56, section 2.3), following React hooks patterns (loaded from react-dev SKILL)

# Step 4: Execute CLI with precise file references and memory context with explicit artifact paths
# cd to src/ reduces scope; specific files further minimize context to only relevant files
cd src && gemini -p "
PURPOSE: Analyze authentication components for type safety improvements based on previous WFS findings
TASK:
• Review auth component patterns and props interfaces
• Identify type inconsistencies documented in WFS-20241103-002 (line 34-56)
• Recommend improvements following React best practices (loaded from react-dev SKILL)
MODE: analysis
CONTEXT: @components/Auth.tsx @types/auth.d.ts @hooks/useAuth.ts | Memory: WFS-20241103-002 identified type inconsistencies (detailed analysis: .workflow/WFS-20241103-002/artifacts/analysis.md line 34-56, section 2.3 'Type Safety Issues'), following React hooks patterns (loaded from react-dev SKILL), related implementation in @hooks/useAuth.ts (commit abc123)
EXPECTED: Comprehensive analysis report with type safety recommendations, code examples, and references to previous findings
RULES: Focus on type safety and component composition | analysis=READ-ONLY
"
# Result: Only 3 specific files analyzed with historical context and explicit artifact paths, instead of entire src/ tree
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

**⚠️ CRITICAL: Single-Use Explicit Authorization**: Each CLI execution (Gemini/Qwen/Codex) requires explicit user command instruction - one command authorizes ONE execution only. Analysis does NOT authorize write operations. Previous authorization does NOT carry over to subsequent actions. Each operation needs NEW explicit user directive.

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
- **Be specific** - Clear PURPOSE, TASK, and EXPECTED fields with detailed descriptions
- **Include constraints** - File patterns, scope, requirements in RULES
- **Leverage memory context** - ALWAYS include Memory field when building on previous work
  - Reference previous WFS session findings with explicit paths: `.workflow/WFS-[session-id]/artifacts/[artifact-name].md`
  - Include specific line numbers or sections: `(line 45-67)` or `(section 3.2)`
  - Load SKILL packages BEFORE CLI execution (CLI tools cannot load SKILL during execution):
    - Workflow sessions: `Skill(command: "workflow-progress")` → Extract → Reference in Memory
    - Tech stacks: `Skill(command: "tech-name")` → Extract → Reference in Memory
    - Project docs: `Skill(command: "project-name")` → Extract → Reference in Memory
  - Cross-reference related tasks with file paths and commit hashes
  - Document dependencies between sessions and modules with explicit file references
- **Discover patterns first** - Use rg/MCP for complex file discovery before CLI execution
- **Build precise CONTEXT** - Convert discovery results to explicit file references with memory context
  - Format: `CONTEXT: [file patterns] | Memory: [memory context]`
  - File patterns: `@**/*` (default), or specific patterns
  - Memory context: Previous sessions, tech stack patterns, cross-references
- **Document context** - Always reference CLAUDE.md and relevant documentation
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
- **Key benefit**: Excludes unrelated directories, reducing token usage and improving analysis precision

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
