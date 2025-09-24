---
name: intelligent-tools-strategy
description: Strategic decision framework for intelligent tool selection
type: strategic-guideline
---

# Intelligent Tools Selection Strategy

## ⚡ Core Framework

**Gemini**: Analysis, understanding, exploration & documentation
**Codex**: Development, implementation & automation

### Decision Principles
- **Use tools early and often** - Tools are faster, more thorough, and reliable than manual approaches
- **When in doubt, use both** - Parallel usage provides comprehensive coverage
- **Default to tools** - Use specialized tools for most coding tasks, no matter how small
- **Lower barriers** - Engage tools immediately when encountering any complexity
- **Context optimization** - Based on user intent, determine whether to use `-C [directory]` parameter for focused analysis to reduce irrelevant context import

### Quick Decision Rules
1. **Exploring/Understanding?** → Start with Gemini
2. **Building/Fixing?** → Start with Codex
3. **Not sure?** → Use both in parallel
4. **Small task?** → Still use tools - they're faster than manual work

### Core Execution Rules
- **Default Timeout**: Bash commands default execution time = 20 minutes (1200000ms)
- **Apply to All Tools**: All bash() wrapped commands including Gemini wrapper and Codex executions use this timeout
- **Command Examples**: `bash(~/.claude/scripts/gemini-wrapper -p "prompt")`, `bash(codex --full-auto exec "task")`
- **Override When Needed**: Specify custom timeout for longer operations

## 🎯 Universal Command Template

### Standard Format (REQUIRED)
```bash
# Gemini Analysis
~/.claude/scripts/gemini-wrapper [-C directory] -p "
PURPOSE: [clear analysis goal]
TASK: [specific analysis task]
CONTEXT: [file references and memory context]
EXPECTED: [expected output]
RULES: [template reference and constraints]
"

# Codex Development
codex [-C directory] --full-auto exec "
PURPOSE: [clear development goal]
TASK: [specific development task]
CONTEXT: [file references and memory context]
EXPECTED: [expected deliverables]
RULES: [template reference and constraints]
" -s danger-full-access
```

### Template Structure
- [ ] **PURPOSE** - Clear goal and intent
- [ ] **TASK** - Specific execution task
- [ ] **CONTEXT** - File references and memory context from previous sessions
- [ ] **EXPECTED** - Clear expected results
- [ ] **RULES** - Template reference and constraints

### Directory Context (-C parameter)
Both tools support changing working directory before execution:
- **Gemini**: `~/.claude/scripts/gemini-wrapper -C path/to/project -p "prompt"`
- **Codex**: `codex -C path/to/project --full-auto exec "task"`
- **Path types**: Supports both relative (`../project`) and absolute (`/full/path`) paths
- **Token analysis**: For gemini-wrapper, token counting happens in target directory

### Rules Field Format
```bash
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/[category]/[template].txt) | [constraints]
```

**Examples**:
- Single template: `$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | Focus on security`
- Multiple templates: `$(cat template1.txt) $(cat template2.txt) | Enterprise standards`
- No template: `Focus on security patterns, include dependency analysis`
- File patterns: `@{src/**/*.ts,CLAUDE.md} - Stay within scope`

## 📊 Tool Selection Matrix

| Task Type | Tool | Use Case | Template |
|-----------|------|----------|-----------|
| **Analysis** | Gemini | Code exploration, architecture review, patterns | `analysis/pattern.txt` |
| **Development** | Codex | Feature implementation, bug fixes, testing | `development/feature.txt` |
| **Planning** | Both | Task breakdown, migration planning | `planning/task-breakdown.txt` |
| **Documentation** | Both | Code docs, API specs, guides | `analysis/quality.txt` |
| **Security** | Codex | Vulnerability assessment, fixes | `analysis/security.txt` |
| **Refactoring** | Both | Gemini for analysis, Codex for execution | `development/refactor.txt` |

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
2. **Implementation Phase**: Use Codex for development
3. **Quality Phase**: Use Codex for testing and validation

### Common Scenarios
```bash
# Project Analysis (in current directory)
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Understand codebase architecture
TASK: Analyze project structure and identify patterns
CONTEXT: @{src/**/*.ts,CLAUDE.md} Previous analysis of auth system
EXPECTED: Architecture overview and integration points
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Focus on integration points
"

# Project Analysis (in different directory)
~/.claude/scripts/gemini-wrapper -C ../other-project -p "
PURPOSE: Compare authentication patterns
TASK: Analyze auth implementation in related project
CONTEXT: @{src/auth/**/*} Current project context from session memory
EXPECTED: Pattern comparison and recommendations
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | Focus on architectural differences
"

# Feature Development (in target directory)
codex -C path/to/project --full-auto exec "
PURPOSE: Implement user authentication
TASK: Create JWT-based authentication system
CONTEXT: @{src/auth/**/*} Database schema from session memory
EXPECTED: Complete auth module with tests
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt) | Follow security best practices
" -s danger-full-access

# Code Review Preparation
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Prepare comprehensive code review
TASK: Analyze code changes and identify potential issues
CONTEXT: @{**/*.modified} Recent changes discussed in last session
EXPECTED: Review checklist and improvement suggestions
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/quality.txt) | Focus on maintainability
"
```

## 📋 Planning Checklist

For every development task:
- [ ] **Purpose defined** - Clear goal and intent
- [ ] **Context gathered** - File references and session memory documented
- [ ] **Gemini analysis** completed for understanding
- [ ] **Template selected** - Appropriate template chosen
- [ ] **Constraints specified** - File patterns, scope, requirements
- [ ] **Implementation approach** - Tool selection and workflow
- [ ] **Quality measures** - Testing and validation plan

## 🎯 Key Features

### Gemini
- **Command**: `~/.claude/scripts/gemini-wrapper`
- **Strengths**: Large context window, pattern recognition
- **Best For**: Analysis, architecture review, code exploration

### Codex
- **Command**: `codex --full-auto exec`
- **Strengths**: Autonomous development, mathematical reasoning
- **Best For**: Implementation, testing, automation
- **Required**: `-s danger-full-access` for development

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
**Directory Navigation**: Use `-C [directory]` parameter when analyzing specific areas to reduce irrelevant context

**When to use `-C`**:
- Specific directory mentioned → Use `-C directory` parameter
- Focused analysis needed → Target specific directory with `-C`
- Multi-directory scope → Stay in root, use explicit paths or multiple commands

**Example**:
```bash
# Focused (preferred)
~/.claude/scripts/gemini-wrapper -C src/auth -p "analyze auth patterns"

# Alternative for codex
codex -C src/auth --full-auto exec "analyze auth implementation"

# Multi-scope (stay in root)
~/.claude/scripts/gemini-wrapper -p "CONTEXT: @{src/auth/**/*,src/api/**/*}"
```