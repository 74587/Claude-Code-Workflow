---
name: analyze
description: Quick analysis of codebase patterns, architecture, and code quality using Codex CLI
usage: /codex:analyze <analysis-type>
argument-hint: "analysis target or type"
examples:
  - /codex:analyze "React hooks patterns"
  - /codex:analyze "authentication security"
  - /codex:analyze "performance bottlenecks"
  - /codex:analyze "API design patterns"
model: haiku
---

# Codex Analysis Command (/codex:analyze)

## Overview
Quick analysis tool for codebase insights using intelligent pattern detection and template-driven analysis with Codex CLI.

**Core Guidelines**: @~/.claude/workflows/codex-unified.md

⚠️ **Critical Difference**: Codex has **NO `--all-files` flag** - you MUST use `@` patterns to reference files.

## Analysis Types

| Type | Purpose | Example |
|------|---------|---------|
| **pattern** | Code pattern detection | "React hooks usage patterns" |
| **architecture** | System structure analysis | "component hierarchy structure" |
| **security** | Security vulnerabilities | "authentication vulnerabilities" |
| **performance** | Performance bottlenecks | "rendering performance issues" |
| **quality** | Code quality assessment | "testing coverage analysis" |
| **dependencies** | Third-party analysis | "outdated package dependencies" |

## Quick Usage

### Basic Analysis
```bash
/codex:analyze "authentication patterns"
```
**Executes**: `codex exec "@{**/*auth*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt)"`

### Targeted Analysis
```bash
/codex:analyze "React component architecture"
```
**Executes**: `codex exec "@{src/components/**/*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt)"`

### Security Focus
```bash
/codex:analyze "API security vulnerabilities"
```
**Executes**: `codex exec "@{**/api/**/*} @{CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt)"`

## Codex-Specific Patterns

**Essential File Patterns** (Required for Codex):
```bash
@{**/*}                    # All files recursively
@{src/**/*}               # All source files
@{*.ts,*.js}              # Specific file types
@{CLAUDE.md,**/*CLAUDE.md} # Documentation hierarchy
@{package.json,*.config.*} # Configuration files
```

## Templates Used

Templates are automatically selected based on analysis type:
- **Pattern Analysis**: `~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt`
- **Architecture Analysis**: `~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt`
- **Security Analysis**: `~/.claude/workflows/cli-templates/prompts/analysis/security.txt`
- **Performance Analysis**: `~/.claude/workflows/cli-templates/prompts/analysis/performance.txt`

## Workflow Integration

⚠️ **Session Check**: Automatically detects active workflow session via `.workflow/.active-*` marker file.

**Analysis results saved to:**
- Active session: `.workflow/WFS-[topic]/.chat/analysis-[timestamp].md`
- No session: Temporary analysis output

## Common Patterns

### Technology Stack Analysis
```bash
/codex:analyze "project technology stack"
# Executes: codex exec "@{package.json,*.config.*,CLAUDE.md} [analysis prompt]"
```

### Code Quality Review
```bash
/codex:analyze "code quality and standards"
# Executes: codex exec "@{src/**/*,test/**/*,CLAUDE.md} [analysis prompt]"
```

### Migration Planning
```bash
/codex:analyze "legacy code modernization"
# Executes: codex exec "@{**/*.{js,jsx,ts,tsx},CLAUDE.md} [analysis prompt]"
```

### Module-Specific Analysis
```bash
/codex:analyze "authentication module patterns"
# Executes: codex exec "@{src/auth/**/*,**/*auth*,CLAUDE.md} [analysis prompt]"
```

## Output Format

Analysis results include:
- **File References**: Specific file:line locations
- **Code Examples**: Relevant code snippets
- **Patterns Found**: Common patterns and anti-patterns
- **Recommendations**: Actionable improvements
- **Integration Points**: How components connect

## Execution Templates

### Basic Analysis Template
```bash
codex exec "@{inferred_patterns} @{CLAUDE.md,**/*CLAUDE.md}

Analysis Type: [analysis_type]

Provide:
- Pattern identification and analysis
- Code quality assessment
- Architecture insights
- Specific recommendations with file:line references"
```

### Template-Enhanced Analysis
```bash
codex exec "@{inferred_patterns} @{CLAUDE.md,**/*CLAUDE.md} $(cat ~/.claude/workflows/cli-templates/prompts/analysis/[template].txt)

Focus: [analysis_type]
Context: [user_description]"
```

## Error Prevention

- **Always include @ patterns**: Commands without file references will fail
- **Test patterns first**: Validate @ patterns match existing files
- **Use comprehensive patterns**: `@{**/*}` when unsure of file structure
- **Include documentation**: Always add `@{CLAUDE.md,**/*CLAUDE.md}` for context

## Codex vs Gemini

| Feature | Codex | Gemini |
|---------|-------|--------|
| File Loading | `@` patterns **required** | `--all-files` available |
| Command Structure | `codex exec "@{patterns}"` | `gemini --all-files -p` |
| Pattern Flexibility | Must be explicit | Auto-includes with flag |

For detailed syntax, patterns, and advanced usage see:
**@~/.claude/workflows/codex-unified.md**