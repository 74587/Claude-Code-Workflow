# Qwen Template Usage Examples

> **📖 Template Structure**: See [Universal Template Structure](SKILL.md#universal-template-structure) in SKILL.md for detailed field guidelines.

## Multi-Template Quality & Security Review

This example demonstrates combining multiple templates for comprehensive pre-release audit.

```bash
~/.claude/scripts/qwen-wrapper -p "
PURPOSE: Pre-release quality gate combining security, performance, and maintainability checks
TASK: Execute comprehensive review across: security vulnerabilities, code quality metrics, performance bottlenecks, pattern consistency, test coverage, documentation completeness
MODE: analysis
CONTEXT: @{src/**/*,!**/node_modules/**,tests/**/*,docs/**/*,CLAUDE.md,package.json,tsconfig.json} Release v3.0 scheduled in 1 week, 6-month development cycle, 10 developers, 120k LOC added/changed, current test coverage 72%, no security audit since v2.5 (6 months ago)
EXPECTED: Consolidated release readiness report: 1) Executive Summary (Go/No-Go with rationale), 2) Security Assessment (OWASP Top 10 coverage, dependency CVEs, CVSS scores), 3) Performance Benchmarks (vs v2.5 baseline, latency p50/p95/p99), 4) Code Quality Metrics (complexity hotspots, duplication %, type safety score), 5) Test Coverage Analysis (per module, gaps in critical paths), 6) Documentation Review (API docs, runbooks, migration guides), 7) Breaking Changes Assessment (semver compliance), 8) Rollback Plan, 9) Post-release Monitoring Strategy, 10) Release Blocker Issues (prioritized action items)
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/quality.txt) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | Block release if any CVSS >7.0 unpatched | Require >70% test coverage for new code | Flag complexity >15 as blocker | Verify all breaking changes are documented | Check migration guide completeness | Validate rollback tested in staging | Ensure monitoring dashboards updated | Confirm on-call runbooks current | Assess blast radius for failures | Include load test results vs capacity plan
"
```

## Key Points

- **Three templates combined**: Security + Quality + Pattern analysis
- **Release context**: Timeline (1 week), team size, scope (120k LOC)
- **Decision-oriented**: Go/No-Go recommendation with criteria
- **RULES as quality gate**: Specific blocking criteria + verification steps

## Template Combinations

### Security + Architecture + Compliance

```bash
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/security.txt) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Map to SOC 2 controls | Include threat modeling | Document compliance evidence
```

### Quality + Pattern + Maintainability

```bash
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/quality.txt) $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | Calculate technical debt | Assess refactoring ROI | Include maintainability index
```

### Migration Planning Template

```bash
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Zero-downtime requirement | Feature flag strategy | Rollback plan | Performance comparison | Risk assessment matrix
```
