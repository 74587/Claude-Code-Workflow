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

### Universal Prompt Template

All CLI tools (Gemini, Qwen, Codex) share this template structure:

```
PURPOSE: [objective + why + success criteria]
TASK: • [step 1] • [step 2] • [step 3]
MODE: [analysis|write|auto]
CONTEXT: @**/* | Memory: [session/tech/module context]
EXPECTED: [format + quality + structure]
RULES: [template + constraints] | MODE=[permission level]
```

### Tool Selection

- **Analysis/Documentation** → Gemini (preferred) or Qwen (fallback)
- **Implementation/Testing** → Codex

### Quick Command Syntax

```bash
# Gemini/Qwen
cd [dir] && gemini -p "[prompt]" [-m model] [--approval-mode yolo]

# Codex
codex -C [dir] --full-auto exec "[prompt]" [-m model] [--skip-git-repo-check -s danger-full-access]
```

### Model Selection

**Gemini**:
- `gemini-3-pro-preview-11-2025` - Analysis (default, preferred)
- `gemini-2.5-pro` - Analysis (alternative)
- `gemini-2.5-flash` - Documentation updates

**Qwen**:
- `coder-model` - Code analysis (default)
- `vision-model` - Image analysis (rare)

**Codex**:
- `gpt-5` - Analysis & execution (default)
- `gpt5-codex` - Large context tasks

**Note**: `-m` parameter placed AFTER prompt

### Quick Decision Matrix

| Scenario | Tool | MODE |
|----------|------|------|
| Exploring/Understanding | Gemini → Qwen | analysis |
| Architecture/Analysis | Gemini → Qwen | analysis |
| Building/Fixing | Codex | auto |
| Documentation Generation | Gemini/Qwen | write |
| Test Generation | Codex | write |

### Core Principles

- **Use tools early and often** - Tools are faster and more thorough
- **When in doubt, use both** - Parallel usage provides comprehensive coverage
- **Default to tools** - Use for most coding tasks, no matter how small
- **Minimize context noise** - Use `cd` + `--include-directories` to focus on relevant files
- **⚠️ Write protection** - Require EXPLICIT MODE=write or MODE=auto specification

---

## 🎯 Tool Specifications

### MODE Options

**analysis** (default for Gemini/Qwen)
- Read-only operations, no file modifications
- Analysis output returned as text response
- Use for: code review, architecture analysis, pattern discovery
- Permission: Default, no special parameters needed

**write** (Gemini/Qwen/Codex)
- File creation/modification/deletion allowed
- Requires explicit MODE=write specification
- Use for: documentation generation, code creation, file modifications
- Permission:
  - Gemini/Qwen: `--approval-mode yolo`
  - Codex: `--skip-git-repo-check -s danger-full-access`

**auto** (Codex only)
- Full autonomous development operations
- Requires explicit MODE=auto specification
- Use for: feature implementation, bug fixes, autonomous development
- Permission: `--skip-git-repo-check -s danger-full-access`

### Gemini & Qwen

**Commands**: `gemini` (primary) | `qwen` (fallback)

**Strengths**: Large context window, pattern recognition

**Best For**: Analysis, documentation generation, code exploration, architecture review

**Default MODE**: `analysis` (read-only)

**Priority**: Prefer Gemini; use Qwen as fallback when Gemini unavailable

**Error Handling**: Gemini may show HTTP 429 error but still return results - check if results exist (results present = success, no results = retry/fallback to Qwen)

### Codex

**Command**: `codex --full-auto exec`

**Strengths**: Autonomous development, mathematical reasoning

**Best For**: Implementation, testing, automation

**Default MODE**: No default, must be explicitly specified

**Session Management**:
- `codex resume` - Resume previous session (picker)
- `codex resume --last` - Resume most recent session
- `codex -i <image_file>` - Attach image to prompt

**Multi-task Pattern**: First task uses `exec`, subsequent tasks use `exec "..." resume --last` for context continuity

**Auto-Resume Rules**:
- **Use `resume --last`**: Related tasks, extending previous work, multi-step workflow
- **Don't use**: First task, new independent work, different module

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
    - SKILL packages: Must load BEFORE CLI execution with `Skill(workflow-progress)`, `Skill(react-dev)`, `Skill(project-name)`
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
RULES: [template reference and constraints] | [MODE]=[READ-ONLY|CREATE/MODIFY/DELETE|FULL operations]
```

### Tool-Specific Configuration

#### Gemini & Qwen

**Command Format**: `cd [directory] && [tool] -p "[prompt]" [options]`

**Complete Examples**:
```bash
# Analysis Mode (read-only, default)
cd [directory] && gemini -p "
PURPOSE: [goal]
TASK: • [step 1] • [step 2] • [step 3]
MODE: analysis
CONTEXT: @**/* | Memory: [memory context]
EXPECTED: [expected output]
RULES: [rules] | analysis=READ-ONLY
"

# Analysis with specific model
cd [directory] && gemini -p "[prompt]" -m gemini-3-pro-preview-11-2025

# Write Mode (requires explicit MODE=write)
cd [directory] && gemini -p "
PURPOSE: [goal]
TASK: • [step 1] • [step 2] • [step 3]
MODE: write
CONTEXT: @**/* | Memory: [memory context]
EXPECTED: [expected output]
RULES: [rules] | write=CREATE/MODIFY/DELETE
" -m gemini-2.5-flash --approval-mode yolo

# Fallback to Qwen
cd [directory] && qwen -p "[prompt]"
```

#### Codex

**Command Format**: `codex -C [directory] --full-auto exec "[prompt]" [options]`

**Complete Examples**:
```bash
# Auto Mode (full autonomous development)
codex -C [directory] --full-auto exec "
PURPOSE: [development goal]
TASK: • [step 1] • [step 2] • [step 3]
MODE: auto
CONTEXT: @**/* | Memory: [memory context with workflow context]
EXPECTED: [deliverables with testing requirements]
RULES: [rules] | auto=FULL operations
" -m gpt-5 --skip-git-repo-check -s danger-full-access

# Write Mode (test generation, focused modifications)
codex -C [directory] --full-auto exec "
PURPOSE: [goal]
TASK: • [step 1] • [step 2] • [step 3]
MODE: write
CONTEXT: @**/* | Memory: [memory context]
EXPECTED: [deliverables with testing requirements]
RULES: [rules] | write=CREATE/MODIFY/DELETE
" -m gpt-5 --skip-git-repo-check -s danger-full-access

# Session continuity (using resume)
# First task - establish session
codex -C project --full-auto exec "
PURPOSE: Implement authentication module
TASK: • Create auth service • Add user validation • Setup JWT tokens
MODE: auto
CONTEXT: @**/* | Memory: Following security patterns from project standards
EXPECTED: Complete auth module with tests
RULES: Follow existing patterns | auto=FULL operations
" --skip-git-repo-check -s danger-full-access

# Subsequent tasks - continue same session
codex --full-auto exec "Add JWT refresh token validation" resume --last --skip-git-repo-check -s danger-full-access
```

### Directory Context Configuration

**Tool Directory Navigation**:
- **Gemini & Qwen**: `cd path/to/project && gemini -p "prompt"`
- **Codex**: `codex -C path/to/project --full-auto exec "task"`
- **Path types**: Supports both relative (`../project`) and absolute (`/full/path`)

#### Critical Directory Scope Rules

**Once `cd` to a directory**:
- @ references ONLY apply to current directory and subdirectories
- `@**/*` = All files within current directory tree
- `@*.ts` = TypeScript files in current directory tree
- `@src/**/*` = Files within src subdirectory
- CANNOT reference parent/sibling directories via @ alone

**To reference files outside current directory (TWO-STEP REQUIREMENT)**:
1. Add `--include-directories` parameter to make external directories ACCESSIBLE
2. Explicitly reference external files in CONTEXT field with @ patterns
3. ⚠️ BOTH steps are MANDATORY

Example: `cd src/auth && gemini -p "CONTEXT: @**/* @../shared/**/*" --include-directories ../shared`

**Rule**: If CONTEXT contains `@../dir/**/*`, command MUST include `--include-directories ../dir`

#### Multi-Directory Support (Gemini & Qwen)

**Parameter**: `--include-directories <dir1,dir2,...>`
- Includes additional directories beyond current `cd` directory
- Can be specified multiple times or comma-separated
- Maximum 5 directories
- REQUIRED when working in subdirectory but needing parent/sibling context

**Syntax**:
```bash
# Comma-separated format
gemini -p "prompt" --include-directories /path/to/project1,/path/to/project2

# Multiple flags format
gemini -p "prompt" --include-directories /path/to/project1 --include-directories /path/to/project2

# Recommended: cd + --include-directories
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
- Use `cd` to navigate to primary focus directory
- Use `--include-directories` for additional context
- ⚠️ CONTEXT must explicitly list external files AND command must include `--include-directories`
- Benefits: Minimizes irrelevant file interference, more precise file references
- Pattern matching rule: `@../dir/**/*` in CONTEXT → `--include-directories ../dir` in command (MANDATORY)

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

1. **Workflow Sessions** - Previous WFS session findings and artifacts
   - Format: `WFS-[session-id]: [key findings]`
   - Artifact paths: `.workflow/WFS-[session-id]/artifacts/[artifact-name].md`
   - Common artifacts:
     - Analysis: `.workflow/WFS-[session-id]/artifacts/analysis.md`
     - Plans: `.workflow/WFS-[session-id]/artifacts/IMPL_PLAN.md`
     - Tasks: `.workflow/WFS-[session-id]/.task/task.json`
     - Lessons: `.workflow/WFS-[session-id]/artifacts/lessons.md`

2. **SKILL Packages** - ⚠️ MUST load BEFORE CLI execution
   - **CRITICAL**: Load using `Skill()` tool BEFORE CLI commands
   - CLI tools do NOT support loading SKILL during execution
   - Workflow: Load SKILL → Extract content → Reference in Memory → Execute CLI
   - Types:
     - Workflow: `Skill(workflow-progress)` for session history
     - Tech stacks: `Skill(react-dev)`, `Skill(typescript-dev)` for patterns
     - Project: `Skill(project-name)` for codebase architecture

3. **Related Tasks** - Cross-task context
   - Previous refactoring, task extensions, conflict resolution

4. **Tech Stack Patterns** - Framework and library conventions
   - React hooks patterns, TypeScript utilities, security guidelines

5. **Cross-Module References** - Inter-module dependencies
   - Integration points, shared utilities, type dependencies

**Memory Context Examples**:

```bash
# Example 1: Building on previous session
# Step 1: Load SKILL packages BEFORE CLI execution
Skill(command: "workflow-progress")  # Extract session findings
Skill(command: "react-dev")          # Extract React patterns

# Step 2: Execute CLI with memory context
CONTEXT: @src/auth/**/* @CLAUDE.md | Memory: WFS-20241105-001 identified JWT validation gap (see .workflow/WFS-20241105-001/artifacts/analysis.md line 45-67), implementing refresh token mechanism following React hooks patterns (loaded from react-dev SKILL)

# Example 2: Cross-module integration
CONTEXT: @src/payment/**/* @src/shared/types/**/* | Memory: Integration with auth module from WFS-20241103-002 (implementation plan: .workflow/WFS-20241103-002/artifacts/IMPL_PLAN.md section 3.2), using shared error handling patterns from @shared/utils/errors.ts

# Example 3: Workflow continuity
Skill(command: "workflow-progress")  # Extract previous session findings
CONTEXT: @**/* | Memory: Continuing from WFS-20241104-005 API refactor (findings from workflow-progress SKILL, detailed analysis: .workflow/WFS-20241104-005/artifacts/analysis.md, implementation plan: .workflow/WFS-20241104-005/artifacts/IMPL_PLAN.md), applying RESTful patterns documented in section 2.1
```

**Best Practices**:
- **Always include memory context** when building on previous work
- **Reference specific session IDs**: `WFS-[session-id]` for traceability
- **Specify artifact paths** explicitly: `.workflow/WFS-[session-id]/artifacts/[artifact-name].md`
- **Include line numbers/sections**: `(line 45-67)` or `(section 3.2)`
- **Load SKILL packages BEFORE CLI** - CLI cannot load SKILL during execution
- **Cross-reference artifacts** with full paths
- **Document dependencies** with explicit file references
- **Use consistent format**: `CONTEXT: [file patterns] | Memory: [memory context with paths]`

#### Complex Pattern Discovery

For complex file pattern requirements, use semantic discovery BEFORE CLI execution:

**Tools**:
- `rg (ripgrep)` - Content-based file discovery with regex
- `mcp__code-index__search_code_advanced` - Semantic file search

**Workflow**: Discover → Extract precise paths → Build CONTEXT field

**Example**:
```bash
# Step 1: Load SKILL packages (CLI cannot load SKILL)
Skill(command: "workflow-progress")
Skill(command: "react-dev")

# Step 2: Discover files semantically
rg "export.*Component" --files-with-matches --type ts
mcp__code-index__search_code_advanced(pattern="interface.*Props", file_pattern="*.tsx")

# Step 3: Build precise CONTEXT with file patterns + memory
CONTEXT: @src/components/Auth.tsx @src/types/auth.d.ts @src/hooks/useAuth.ts | Memory: WFS-20241103-002 identified type inconsistencies (see .workflow/WFS-20241103-002/artifacts/analysis.md line 34-56, section 2.3), following React hooks patterns (loaded from react-dev SKILL)

# Step 4: Execute CLI with precise references
cd src && gemini -p "
PURPOSE: Analyze authentication components for type safety improvements
TASK:
• Review auth component patterns and props interfaces
• Identify type inconsistencies documented in WFS-20241103-002 (line 34-56)
• Recommend improvements following React best practices
MODE: analysis
CONTEXT: @components/Auth.tsx @types/auth.d.ts @hooks/useAuth.ts | Memory: WFS-20241103-002 identified type inconsistencies (detailed analysis: .workflow/WFS-20241103-002/artifacts/analysis.md line 34-56, section 2.3 'Type Safety Issues'), following React hooks patterns (loaded from react-dev SKILL), related implementation in @hooks/useAuth.ts (commit abc123)
EXPECTED: Comprehensive analysis report with type safety recommendations, code examples, and references to previous findings
RULES: Focus on type safety and component composition | analysis=READ-ONLY
"
```

### RULES Field Configuration

**Basic Format**: `RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints]`

**⚠️ Command Substitution Rules**:
- **Template reference only, never read**: Use `$(cat ...)` directly, do NOT read template content first
- **NEVER use escape characters**: `\$`, `\"`, `\'` will break command substitution
- **In prompt context**: Path needs NO quotes (tilde expands correctly)
- **Correct**: `RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)`
- **WRONG**: `RULES: \$(cat ...)` or `RULES: $(cat \"...\")`
- **Why**: Shell executes `$(...)` in subshell where path is safe

**Examples**:
- Single: `$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | Focus on security`
- Multiple: `$(cat template1.txt) $(cat template2.txt) | Enterprise standards`
- No template: `Focus on security patterns, include dependency analysis`

### Template System

**Base**: `~/.claude/workflows/cli-templates/`

**Available Templates**:
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
│   └── claude-module-unified.txt  - Universal module/file documentation
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

**Task-Template Matrix**:

| Task Type | Tool | Template |
|-----------|------|----------|
| Analysis | Gemini (Qwen fallback) | `analysis/pattern.txt` |
| Architecture | Gemini (Qwen fallback) | `analysis/architecture.txt` |
| Documentation | Gemini (Qwen fallback) | `analysis/quality.txt` |
| Development | Codex | `development/feature.txt` |
| Planning | Gemini/Qwen | `planning/task-breakdown.txt` |
| Security | Codex | `analysis/security.txt` |
| Refactoring | Multiple | `development/refactor.txt` |
| Module Documentation | Gemini (Qwen fallback) | `memory/claude-module-unified.txt` |

---

## ⚙️ Execution Configuration

### Dynamic Timeout Allocation

**Timeout Ranges**:
- **Simple** (analysis, search): 20-40min (1200000-2400000ms)
- **Medium** (refactoring, documentation): 40-60min (2400000-3600000ms)
- **Complex** (implementation, migration): 60-120min (3600000-7200000ms)

**Codex Multiplier**: 1.5x of allocated time

**Application**: All bash() wrapped commands including Gemini, Qwen and Codex executions

**Auto-detection**: Analyze PURPOSE and TASK fields to determine timeout

### Permission Framework

**⚠️ Single-Use Explicit Authorization**: Each CLI execution requires explicit user command instruction - one command authorizes ONE execution only. Analysis does NOT authorize write operations. Previous authorization does NOT carry over. Each operation needs NEW explicit user directive.

**Mode Hierarchy**:
- **analysis** (default): Read-only, safe for auto-execution
- **write**: Requires explicit MODE=write specification
- **auto**: Requires explicit MODE=auto specification
- **Exception**: User provides clear instructions like "modify", "create", "implement"

**Tool-Specific Permissions**:
- **Gemini/Qwen**: Use `--approval-mode yolo` ONLY when MODE=write (placed AFTER prompt)
- **Codex**: Use `--skip-git-repo-check -s danger-full-access` ONLY when MODE=auto or MODE=write (placed at command END)
- **Default**: All tools default to analysis/read-only mode

---

## 🔧 Best Practices

### Workflow Principles

- **Start with templates** - Use predefined templates for consistency
- **Be specific** - Clear PURPOSE, TASK, and EXPECTED fields with detailed descriptions
- **Include constraints** - File patterns, scope, requirements in RULES
- **Leverage memory context** - ALWAYS include Memory field when building on previous work
  - Reference WFS sessions with explicit paths: `.workflow/WFS-[session-id]/artifacts/[artifact-name].md`
  - Include line numbers/sections: `(line 45-67)` or `(section 3.2)`
  - Load SKILL packages BEFORE CLI (CLI cannot load SKILL during execution):
    - Workflow: `Skill(command: "workflow-progress")` → Extract → Reference in Memory
    - Tech: `Skill(command: "tech-name")` → Extract → Reference in Memory
    - Project: `Skill(command: "project-name")` → Extract → Reference in Memory
  - Cross-reference tasks with file paths and commit hashes
  - Document dependencies with explicit file references
- **Discover patterns first** - Use rg/MCP for complex file discovery before CLI execution
- **Build precise CONTEXT** - Convert discovery to explicit file references with memory
  - Format: `CONTEXT: [file patterns] | Memory: [memory context]`
  - File patterns: `@**/*` (default) or specific patterns
  - Memory: Previous sessions, tech stack patterns, cross-references
- **Document context** - Always reference CLAUDE.md and relevant documentation
- **Default to full context** - Use `@**/*` unless specific files needed
- **⚠️ No escape characters** - NEVER use `\$`, `\"`, `\'` in CLI commands

### Context Optimization Strategy

**Directory Navigation**: Use `cd [directory] &&` pattern to reduce irrelevant context

**When to change directory**:
- Specific directory mentioned → Use `cd directory &&`
- Focused analysis needed → Target specific directory
- Multi-directory scope → Use `cd` + `--include-directories`

**When to use `--include-directories`**:
- Working in subdirectory but need parent/sibling context
- Cross-directory dependency analysis required
- Multiple related modules need simultaneous access
- **Key benefit**: Excludes unrelated directories, reduces token usage

### Workflow Integration

When planning any coding task, **ALWAYS** integrate CLI tools:

1. **Understanding Phase**: Use Gemini for analysis (Qwen as fallback)
2. **Architecture Phase**: Use Gemini for design and analysis (Qwen as fallback)
3. **Implementation Phase**: Use Codex for development
4. **Quality Phase**: Use Codex for testing and validation

### Planning Checklist

For every development task:
- [ ] **Purpose defined** - Clear goal and intent
- [ ] **Mode selected** - Execution mode and permission level determined
- [ ] **Context gathered** - File references and session memory documented (default `@**/*`)
- [ ] **Directory navigation** - Determine if `cd` or `cd + --include-directories` needed
- [ ] **Gemini analysis** completed for understanding
- [ ] **Template applied** - Use Standard Prompt Template (universal for all tools)
- [ ] **Constraints specified** - File patterns, scope, requirements
- [ ] **Implementation approach** - Tool selection and workflow
