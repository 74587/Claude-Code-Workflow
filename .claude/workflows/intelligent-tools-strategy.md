---
name: intelligent-tools-strategy
description: Strategic decision framework for intelligent tool selection
type: strategic-guideline
---

# Intelligent Tools Selection Strategy

## ⚡ Core Framework

**Gemini**: Analysis, understanding, exploration & documentation
**Qwen**: Architecture analysis, code generation & implementation
**Codex**: Development, implementation & automation

### Decision Principles
- **Use tools early and often** - Tools are faster, more thorough, and reliable than manual approaches
- **When in doubt, use both** - Parallel usage provides comprehensive coverage
- **Default to tools** - Use specialized tools for most coding tasks, no matter how small
- **Lower barriers** - Engage tools immediately when encountering any complexity
- **Context optimization** - Based on user intent, determine whether to use `-C [directory]` parameter for focused analysis to reduce irrelevant context import
- **⚠️ Write operation protection** - For local codebase write/modify operations, require EXPLICIT user confirmation unless user provides clear instructions containing MODE=write or MODE=auto

### Quick Decision Rules
1. **Exploring/Understanding?** → Start with Gemini
2. **Architecture/Code generation?** → Start with Qwen
3. **Building/Fixing?** → Start with Codex
4. **Not sure?** → Use multiple tools in parallel
5. **Small task?** → Still use tools - they're faster than manual work

### Core Execution Rules
- **Default Timeout**: Bash commands default execution time = 20 minutes (1200000ms)
- **Apply to All Tools**: All bash() wrapped commands including Gemini, Qwen wrapper and Codex executions use this timeout
- **Command Examples**: `bash(cd target/directory && ~/.claude/scripts/gemini-wrapper -p "prompt")`, `bash(cd target/directory && ~/.claude/scripts/qwen-wrapper -p "prompt")`, `bash(codex -C directory --full-auto exec "task")`
- **Override When Needed**: Specify custom timeout for longer operations

### Permission Framework
- **⚠️ WRITE PROTECTION**: Local codebase write/modify requires EXPLICIT user confirmation
  - **Analysis Mode (default)**: Read-only, safe for auto-execution
  - **Write Mode**: Requires user explicitly states MODE=write or MODE=auto in prompt
  - **Exception**: User provides clear instructions like "modify", "create", "implement"
- **Gemini/Qwen Write Access**: Use `--approval-mode yolo` ONLY when MODE=write explicitly specified
- **Codex Write Access**: Use `-s danger-full-access` and `--skip-git-repo-check` ONLY when MODE=auto explicitly specified
- **Default Behavior**: All tools default to analysis/read-only mode without explicit write permission

## 🎯 Universal Command Template

### Standard Format (REQUIRED)
```bash
# Gemini Analysis (read/write capable)
cd [directory] && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: [clear analysis goal]
TASK: [specific analysis task]
MODE: [analysis|write]
CONTEXT: [file references and memory context]
EXPECTED: [expected output]
RULES: [template reference and constraints]
"

# Qwen Architecture Analysis (read-only analysis)
cd [directory] && ~/.claude/scripts/qwen-wrapper -p "
PURPOSE: [clear architecture goal]
TASK: [specific analysis task]
MODE: analysis
CONTEXT: [file references and memory context]
EXPECTED: [expected deliverables]
RULES: [template reference and constraints]
"

# Codex Development
codex -C [directory] --full-auto exec "
PURPOSE: [clear development goal]
TASK: [specific development task]
MODE: [auto|write]
CONTEXT: [file references and memory context]
EXPECTED: [expected deliverables]
RULES: [template reference and constraints]
" --skip-git-repo-check -s danger-full-access
```

### Template Structure
- [ ] **PURPOSE** - Clear goal and intent
- [ ] **TASK** - Specific execution task
- [ ] **MODE** - Execution mode and permission level
- [ ] **CONTEXT** - File references and memory context from previous sessions
- [ ] **EXPECTED** - Clear expected results
- [ ] **RULES** - Template reference and constraints

### MODE Field Definition

The MODE field controls execution behavior and file permissions:

**For Gemini**:
- `analysis` (default) - Read-only analysis and documentation generation
- `write` - ⚠️ Create/modify codebase files (requires explicit specification, auto-enables --approval-mode yolo)

**For Qwen**:
- `analysis` (default) - Architecture analysis only, no code generation/modification (read-only)
- `write` - ⚠️ Code generation (requires explicit specification, disabled by default)

**For Codex**:
- `auto` - ⚠️ Autonomous development with full file operations (requires explicit specification, enables -s danger-full-access)
- `write` - ⚠️ Test generation and file modification (requires explicit specification)
- **Default**: No default mode, MODE must be explicitly specified

### Directory Context
Tools execute in current working directory:
- **Gemini**: `cd path/to/project && ~/.claude/scripts/gemini-wrapper -p "prompt"`
- **Qwen**: `cd path/to/project && ~/.claude/scripts/qwen-wrapper -p "prompt"`
- **Codex**: `codex -C path/to/project --full-auto exec "task"` (Codex still supports -C)
- **Path types**: Supports both relative (`../project`) and absolute (`/full/path`) paths
- **Token analysis**: For gemini-wrapper and qwen-wrapper, token counting happens in current directory

### Rules Field Format
```bash
RULES: $(cat "~/.claude/workflows/cli-templates/prompts/[category]/[template].txt") | [constraints]
```

**Examples**:
- Single template: `$(cat "~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt") | Focus on security`
- Multiple templates: `$(cat "template1.txt") $(cat "template2.txt") | Enterprise standards`
- No template: `Focus on security patterns, include dependency analysis`
- File patterns: `@{src/**/*.ts,CLAUDE.md} - Stay within scope`

## 📊 Tool Selection Matrix

| Task Type | Tool | Use Case | Template |
|-----------|------|----------|-----------|
| **Analysis** | Gemini | Code exploration, architecture review, patterns | `analysis/pattern.txt` |
| **Architecture** | Qwen | System design, code generation, architectural analysis | `analysis/architecture.txt` |
| **Code Generation** | Qwen | Implementation patterns, code scaffolding, component creation | `development/feature.txt` |
| **Development** | Codex | Feature implementation, bug fixes, testing | `development/feature.txt` |
| **Planning** | Multiple | Task breakdown, migration planning | `planning/task-breakdown.txt` |
| **Documentation** | Multiple | Code docs, API specs, guides | `analysis/quality.txt` |
| **Security** | Codex | Vulnerability assessment, fixes | `analysis/security.txt` |
| **Refactoring** | Multiple | Gemini for analysis, Qwen/Codex for execution | `development/refactor.txt` |

## 📁 Template System

**Base Structure**: `~/.claude/workflows/cli-templates/`

### Available Templates
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

## 🚀 Usage Patterns

### Workflow Integration (REQUIRED)
When planning any coding task, **ALWAYS** integrate CLI tools:

1. **Understanding Phase**: Use Gemini for analysis
2. **Architecture Phase**: Use Qwen for design and code generation
3. **Implementation Phase**: Use Qwen/Codex for development
4. **Quality Phase**: Use Codex for testing and validation

### Common Scenarios
```bash
# Gemini - Code Analysis
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Understand codebase architecture
TASK: Analyze project structure and identify patterns
MODE: analysis
CONTEXT: @{src/**/*.ts,CLAUDE.md} Previous analysis of auth system
EXPECTED: Architecture overview and integration points
RULES: $(cat '~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt') | Focus on integration points
"

# Gemini - Generate Documentation
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Generate API documentation
TASK: Create comprehensive API reference from code
MODE: write
CONTEXT: @{src/api/**/*}
EXPECTED: API.md with all endpoints documented
RULES: Follow project documentation standards
"

# Qwen - Architecture Analysis
cd src/auth && ~/.claude/scripts/qwen-wrapper -p "
PURPOSE: Analyze authentication system architecture
TASK: Review JWT-based auth system design
MODE: analysis
CONTEXT: @{src/auth/**/*} Existing patterns and requirements
EXPECTED: Architecture analysis report with recommendations
RULES: $(cat '~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt') | Focus on security
"

# Codex - Feature Development
codex -C path/to/project --full-auto exec "
PURPOSE: Implement user authentication
TASK: Create JWT-based authentication system
MODE: auto
CONTEXT: @{src/auth/**/*} Database schema from session memory
EXPECTED: Complete auth module with tests
RULES: $(cat '~/.claude/workflows/cli-templates/prompts/development/feature.txt') | Follow security best practices
" --skip-git-repo-check -s danger-full-access

# Codex - Test Generation
codex -C src/auth --full-auto exec "
PURPOSE: Increase test coverage
TASK: Generate comprehensive tests for auth module
MODE: write
CONTEXT: @{**/*.ts} Exclude existing tests
EXPECTED: Complete test suite with 80%+ coverage
RULES: Use Jest, follow existing patterns
" --skip-git-repo-check -s danger-full-access
```

## 📋 Planning Checklist

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

## 🎯 Key Features

### Gemini
- **Command**: `~/.claude/scripts/gemini-wrapper`
- **Strengths**: Large context window, pattern recognition
- **Best For**: Analysis, documentation generation, code exploration
- **Permissions**: Default read-only analysis, MODE=write requires explicit specification (auto-enables --approval-mode yolo)
- **Default MODE**: `analysis` (read-only)
- **⚠️ Write Trigger**: Only when user explicitly requests "generate documentation", "modify code", or specifies MODE=write

### Qwen
- **Command**: `~/.claude/scripts/qwen-wrapper`
- **Strengths**: Architecture analysis, pattern recognition
- **Best For**: System design analysis, architectural review
- **Permissions**: Architecture analysis only, no automatic code generation
- **Default MODE**: `analysis` (read-only)
- **⚠️ Write Trigger**: Explicitly prohibited from auto-calling write mode

### Codex
- **Command**: `codex --full-auto exec`
- **Strengths**: Autonomous development, mathematical reasoning
- **Best For**: Implementation, testing, automation
- **Permissions**: Requires explicit MODE=auto or MODE=write specification
- **Default MODE**: No default, must be explicitly specified
- **⚠️ Write Trigger**: Only when user explicitly requests "implement", "modify", "generate code" AND specifies MODE
- **Session Management**:
  - `codex resume` - Resume previous interactive session (picker by default)
  - `codex exec "task" resume --last` - Continue most recent session with new task (maintains context)
  - `codex -i <image_file>` - Attach image(s) to initial prompt (useful for UI/design references)
  - **Multi-task Pattern**: First task uses `exec`, subsequent tasks use `exec "..." resume --last` for context continuity

### File Patterns
- All files: `@{**/*}`
- Source files: `@{src/**/*}`
- TypeScript: `@{*.ts,*.tsx}`
- With docs: `@{CLAUDE.md,**/*CLAUDE.md}`
- Tests: `@{src/**/*.test.*}`

## 🔧 Best Practices

- **Start with templates** - Use predefined templates for consistency
- **Be specific** - Clear PURPOSE, TASK, and EXPECTED fields
- **Include constraints** - File patterns, scope, requirements in RULES
- **Test patterns first** - Validate file patterns with `ls`
- **Document context** - Always reference CLAUDE.md for context

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

# Qwen - Architecture analysis
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