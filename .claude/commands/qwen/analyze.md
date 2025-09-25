---
name: analyze
description: Quick analysis of codebase patterns, architecture, and code quality using qwen CLI
usage: /qwen:analyze <analysis-type>
argument-hint: "analysis target or type"
examples:
  - /qwen:analyze "React hooks patterns"
  - /qwen:analyze "authentication security"
  - /qwen:analyze "performance bottlenecks"
  - /qwen:analyze "API design patterns"
model: haiku
---

# qwen Analysis Command (/qwen:analyze)

## Overview
Quick analysis tool for codebase insights using intelligent pattern detection and template-driven analysis.

**Core Guidelines**: @~/.claude/workflows/intelligent-tools-strategy.md

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
/qwen:analyze "authentication patterns"
```
**Executes**: `qwen -p -a "@{**/*auth*} @{CLAUDE.md} $(template:analysis/pattern.txt)"`

### Targeted Analysis
```bash
/qwen:analyze "React component architecture"
```
**Executes**: `qwen -p -a "@{src/components/**/*} @{CLAUDE.md} $(template:analysis/architecture.txt)"`

### Security Focus
```bash
/qwen:analyze "API security vulnerabilities"
```
**Executes**: `qwen -p -a "@{**/api/**/*} @{CLAUDE.md} $(template:analysis/security.txt)"`

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
/qwen:analyze "project technology stack"
# Auto-detects: package.json, config files, dependencies
```

### Code Quality Review
```bash
/qwen:analyze "code quality and standards"
# Auto-targets: source files, test files, CLAUDE.md
```

### Migration Planning
```bash
/qwen:analyze "legacy code modernization"
# Focuses: older patterns, deprecated APIs, upgrade paths
```

## Output Format

Analysis results include:
- **File References**: Specific file:line locations
- **Code Examples**: Relevant code snippets
- **Patterns Found**: Common patterns and anti-patterns
- **Recommendations**: Actionable improvements
- **Integration Points**: How components connect

