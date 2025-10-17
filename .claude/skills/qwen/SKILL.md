---
name: Qwen CLI Tool
description: Code analysis and documentation tool (Gemini fallback). Trigger keywords "use qwen", "qwen analysis", "analyze with qwen". Use when Gemini unavailable or for parallel analysis. Supports read-only analysis (default) and write operations (explicit permission).
allowed-tools: Bash, Read, Glob, Grep
---

# Qwen CLI Tool

## Core Execution

Qwen executes code analysis and documentation tasks using large context window capabilities.

**Trigger Keywords**: "use qwen", "qwen analysis", "qwen generate docs", "analyze with qwen"

**Execution Modes**:
- `analysis` (default): Read-only analysis, auto-execute
- `write`: Create/modify files, requires explicit permission

**Command Pattern**:
```bash
cd [directory] && ~/.claude/scripts/qwen-wrapper [--approval-mode yolo] -p "
PURPOSE: [goal]
TASK: [specific task]
MODE: [analysis|write]
CONTEXT: @{file/patterns}
EXPECTED: [results]
RULES: [constraints]
"
```

## Universal Template Structure

Every Qwen command should follow this detailed structure for best results:

```bash
cd [directory] && ~/.claude/scripts/qwen-wrapper [--approval-mode yolo] -p "
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
- Examples: "Analyze auth system for SOC 2 compliance", "Document payment module for audit"

**TASK**:
- Break down into numbered sub-tasks for complex operations
- Include specific aspects: "Review authentication flow, session management, audit logging"
- Specify scope boundaries

**CONTEXT**:
- File patterns: `@{**/*.ts,**/*.test.ts}`
- Business context: "100k users, $2M monthly transactions, PCI DSS scope"
- Tech stack: Versions, frameworks, constraints
- Session memory: "Phase 1 identified 3 high-priority issues"

**EXPECTED**:
- Numbered deliverables: "1) Compliance report, 2) Remediation roadmap, 3) Evidence collection guide"
- Specific file names: "SECURITY.md", "PAYMENT_MODULE.md", "audit-findings.json"
- Coverage requirements: ">95% coverage", "All SOC 2 controls mapped"
- Output format: "Mermaid diagrams", "Compliance checklist", "Risk matrix"

**RULES**:
- Template reference: `$(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt)`
- Multiple constraints separated by `|`: "Map to SOC 2 CC6.1 | Include CVE references | Follow NIST 800-63B"
- Specific standards: "OWASP Top 10 2021", "PCI DSS 3.2.1", "GDPR Article 32"
- Thresholds: "CVSS >7.0 as blocker", "p95 <200ms", ">80% cache hit rate"

## Command Structure

### Universal Template
Every Qwen command follows this structure:

```bash
cd [directory] && ~/.claude/scripts/qwen-wrapper [options] -p "
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
cd [directory] && ~/.claude/scripts/qwen-wrapper -p "
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
cd [directory] && ~/.claude/scripts/qwen-wrapper --approval-mode yolo -p "
PURPOSE: [documentation goal]
TASK: [specific write task]
MODE: write
CONTEXT: @{file/patterns}
EXPECTED: [generated files]
RULES: [constraints]
"
```

**Parameter Position**: `--approval-mode yolo` must be placed AFTER `qwen-wrapper`, BEFORE `-p`

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
cd src/auth && ~/.claude/scripts/qwen-wrapper -p "
PURPOSE: Analyze auth architecture
TASK: Review auth system design and patterns
MODE: analysis
CONTEXT: @{**/*}
EXPECTED: Architecture analysis report
RULES: Focus on modularity and security
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

- **[Analysis Examples](analysis-examples.md)** - Compliance-focused analysis with SOC 2 mapping, performance optimization, and technical debt assessment
- **[Write Examples](write-examples.md)** - API documentation with OpenAPI specs and PCI DSS compliance documentation
- **[Advanced Workflows](advanced-workflows.md)** - Security audit → remediation → verification pipeline
- **[Template Examples](template-examples.md)** - Multi-template quality gates for production releases

Each example follows the Universal Template Structure with compliance and business context focus.

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
