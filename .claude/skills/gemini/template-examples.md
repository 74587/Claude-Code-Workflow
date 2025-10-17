# Gemini Template Usage Examples

> **📖 Template Structure**: See [Universal Template Structure](command-structure.md) for detailed field guidelines.

## Multiple Templates with Custom Constraints

This example demonstrates combining multiple templates for comprehensive analysis.

```bash
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Comprehensive security and code quality audit for production release
TASK: Perform full codebase review covering: security vulnerabilities, code quality metrics, pattern consistency, performance bottlenecks, documentation coverage
MODE: analysis
CONTEXT: @{src/**/*,!**/node_modules/**,!**/*.test.ts,CLAUDE.md,package.json,tsconfig.json} Production release scheduled in 2 weeks, team of 8 developers, 50k lines of code
EXPECTED: Consolidated audit report with: 1) Executive Summary (priority issues), 2) Security Findings (OWASP categorized), 3) Code Quality Metrics (complexity, duplication, test coverage), 4) Pattern Consistency Score, 5) Performance Analysis, 6) Documentation Gaps, 7) Remediation Roadmap (2-week sprint plan)
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/quality.txt) | Follow enterprise security standards | Include CVSS scores for vulnerabilities | Calculate technical debt in hours | Prioritize by business impact | Provide automated fix scripts where possible | Consider CI/CD integration for continuous monitoring
"
```

## Key Points

- **Multiple templates**: Three templates combined for comprehensive review
- **Complex EXPECTED**: 7 sections with specific output requirements
- **Detailed RULES**: Mix of templates + enterprise standards + quantifiable metrics + automation considerations

## Template Combinations

### Security + Architecture

```bash
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Focus on integration security | Include threat modeling
```

### Pattern + Quality

```bash
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/quality.txt) | Identify antipatterns | Calculate maintainability index
```

### All Analysis Templates

```bash
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/quality.txt) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Comprehensive review for production readiness
```
