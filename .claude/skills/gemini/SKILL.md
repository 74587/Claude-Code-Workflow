---
name: Gemini CLI Tool
description: Primary code analysis and documentation tool with large context capabilities. AUTO-TRIGGER when user message contains "gemini" keyword OR requests analysis/exploration/documentation tasks (e.g., "analyze codebase", "分析代码库", "understand architecture", "理解架构", "explore patterns", "探索模式", "review code", "审查代码", "document API", "生成文档"). Supports read-only analysis (default) and write operations (explicit permission). Use for architecture review, pattern discovery, security assessment, performance analysis, and comprehensive documentation generation.
allowed-tools: Bash, Read, Glob, Grep
---

# Gemini CLI Tool

## Core Execution

Gemini executes code analysis and documentation tasks using large context window capabilities.

**Trigger Keywords**: "use gemini", "gemini analysis", "gemini generate docs", "analyze with gemini"

**Execution Modes**:
- `analysis` (default): Read-only analysis, auto-execute
- `write`: Create/modify files, requires explicit permission

**Command Pattern**:
```bash
cd [directory] && ~/.claude/scripts/gemini-wrapper [--approval-mode yolo] -p "
PURPOSE: [goal]
TASK: [specific task]
MODE: [analysis|write]
CONTEXT: @{file/patterns}
EXPECTED: [results]
RULES: [constraints]
"
```

## Universal Template Structure

Every Gemini command should follow this detailed structure for best results:

```bash
cd [directory] && ~/.claude/scripts/gemini-wrapper [--approval-mode yolo] -p "
PURPOSE: [One clear sentence: what and why]
TASK: [Specific actionable task with scope]
MODE: [analysis|write]
CONTEXT: @{file/patterns} [Previous session context, dependencies, constraints]
EXPECTED: [Deliverable format, file names, coverage requirements]
RULES: [Template reference] | [Specific constraints: standards, patterns, focus areas]
"
```

### Template Field Guidelines

**PURPOSE**:
- One sentence combining goal + reason
- Examples: "Analyze auth system to identify security risks", "Generate API docs for partner integration"

**TASK**:
- Break down into numbered sub-tasks for complex operations
- Include specific aspects: "Review JWT implementation, token management, session handling"
- Specify scope boundaries

**CONTEXT**:
- File patterns: `@{src/**/*.ts}` (include only what you need)
- Business context: "50k DAU, PostgreSQL 14, target <200ms p95"
- Tech stack: Versions, frameworks, constraints
- Session memory: "Previous analysis showed X"

**EXPECTED**:
- Numbered deliverables: "1) File.md with sections, 2) Diagram in Mermaid format"
- Specific file names: "API.md", "SECURITY.md", "analysis-report.json"
- Coverage requirements: ">90% test coverage", "All endpoints documented"
- Output format: "Markdown tables", "OpenAPI 3.1 spec", "Mermaid diagrams"

**RULES**:
- Template reference: `$(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)`
- Multiple constraints separated by `|`: "Follow OWASP Top 10 | Use TypeScript strict | Include metrics"
- Specific standards: "OWASP ASVS v4.0", "SOC 2 CC6.1", "RFC 6749"
- Thresholds: "Complexity >10 is high", ">80% cache hit rate"

## Command Structure

### Universal Template
Every Gemini command follows this structure:

```bash
cd [directory] && ~/.claude/scripts/gemini-wrapper [options] -p "
PURPOSE: [clear goal and intent]
TASK: [specific execution task]
MODE: [analysis|write]
CONTEXT: [file references and memory context]
EXPECTED: [clear expected results]
RULES: [template reference and constraints]
"
```

## Execution Modes

### Analysis Mode (Default - Read-Only)
Safe for auto-execution without user confirmation:

```bash
cd [directory] && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: [analysis goal]
TASK: [specific analysis task]
MODE: analysis
CONTEXT: @{file/patterns} [session memory]
EXPECTED: [analysis output]
RULES: [constraints]
"
```

**When to use**:
- Code exploration and understanding
- Architecture analysis
- Pattern discovery
- Security assessment
- Performance analysis

### Write Mode (Requires Explicit Permission)
⚠️ Only use when user explicitly requests file creation/modification:

```bash
cd [directory] && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: [documentation goal]
TASK: [specific write task]
MODE: write
CONTEXT: @{file/patterns}
EXPECTED: [generated files]
RULES: [constraints]
"
```

**Parameter Position**: `--approval-mode yolo` must be placed AFTER `gemini-wrapper`, BEFORE `-p`

**Write Triggers**:
- User explicitly says "generate documentation"
- User explicitly says "create/modify files"
- User specifies `MODE=write` in prompt

## File Pattern Reference

Common patterns for CONTEXT field:

```bash
@{**/*}                    # All files
@{src/**/*}                # Source files
@{*.ts,*.tsx}              # TypeScript files
@{CLAUDE.md,**/*CLAUDE.md} # Documentation
@{src/**/*.test.*}         # Test files
```

**Complex Pattern Discovery**:
For complex requirements, discover files first:
```bash
# Step 1: Discover with ripgrep or MCP
rg "export.*Component" --files-with-matches --type ts

# Step 2: Build precise CONTEXT
CONTEXT: @{src/components/Auth.tsx,src/types/auth.d.ts}

# Step 3: Execute with precise references
```

## Template System

Templates are located in `~/.claude/workflows/cli-templates/prompts/`

### Available Templates

**Analysis Templates**:
- `analysis/pattern.txt` - Code pattern analysis
- `analysis/architecture.txt` - System architecture review
- `analysis/security.txt` - Security assessment
- `analysis/quality.txt` - Code quality review

**Development Templates**:
- `development/feature.txt` - Feature implementation
- `development/refactor.txt` - Refactoring tasks
- `development/testing.txt` - Test generation

**Memory Templates**:
- `memory/claude-module-unified.txt` - Module documentation

### Using Templates in RULES Field

```bash
# Single template
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | Focus on security

# Multiple templates
RULES: $(cat template1.txt) $(cat template2.txt) | Enterprise standards

# No template
RULES: Focus on security patterns, include dependency analysis
```

⚠️ **CRITICAL**: Never use escape characters (`\$`, `\"`, `\'`) in CLI commands - breaks command substitution.

## Context Optimization

Use `cd [directory] &&` pattern to focus analysis and reduce irrelevant context:

```bash
# Focused analysis
cd src/auth && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Understand authentication patterns
TASK: Analyze auth implementation
MODE: analysis
CONTEXT: @{**/*.ts}
EXPECTED: Pattern documentation
RULES: Focus on security best practices
"
```

**When to change directory**:
- Specific directory mentioned → Use `cd directory &&`
- Focused analysis needed → Target specific directory
- Multi-directory scope → Stay in root, use explicit paths

## Execution Configuration

### Timeout Allocation (Dynamic)
Based on task complexity:
- **Simple** (analysis, search): 20-40min (1200000-2400000ms)
- **Medium** (refactoring, docs): 40-60min (2400000-3600000ms)
- **Complex** (implementation): 60-120min (3600000-7200000ms)

Auto-detect from PURPOSE and TASK fields.

### Permission Framework
- ✅ **Analysis Mode (default)**: Auto-execute without confirmation
- ⚠️ **Write Mode**: Requires explicit user confirmation or MODE=write specification
- 🔒 **Write Protection**: Never modify codebase without explicit user instruction

## Examples

Production-ready examples organized by scenario type:

- **[Analysis Examples](analysis-examples.md)** - Read-only analysis with architecture review, pattern discovery, and multi-module tracing
- **[Write Examples](write-examples.md)** - Documentation generation with OpenAPI specs and module documentation
- **[Advanced Workflows](advanced-workflows.md)** - Multi-phase discovery → analysis → documentation pipelines
- **[Template Examples](template-examples.md)** - Multiple template combinations for comprehensive audits
- **[Context Optimization](context-optimization.md)** - Focused analysis strategies for large codebases

Each example follows the Universal Template Structure with detailed explanations.

## Best Practices

### Analysis Phase
- Use analysis mode for all exploratory work
- Focus on specific directories with `cd` pattern
- Include relevant file patterns in CONTEXT
- Reference session memory for continuity

### Documentation Phase
- Always use write mode with `--approval-mode yolo`
- Get explicit user confirmation first
- Include source files in CONTEXT
- Follow project documentation standards

## Error Handling

**If timeout occurs**:
- Reduce CONTEXT scope
- Use more specific file patterns
- Split into smaller analysis tasks

**If context too large**:
- Use `cd` to focus on specific directory
- Narrow file patterns
- Analyze in phases

**If output incomplete**:
- Increase timeout allocation
- Simplify EXPECTED results
- Break into multiple commands
