# Qwen Analysis Mode Examples

> **📖 Template Structure**: See [Universal Template Structure](SKILL.md#universal-template-structure) in SKILL.md for detailed field guidelines.

All examples demonstrate read-only analysis mode with compliance-focused, security-aware prompt writing.

## Example 1: Architecture Analysis with Business Context

```bash
cd src/auth && ~/.claude/scripts/qwen-wrapper -p "
PURPOSE: Analyze authentication system to support SOC 2 compliance audit
TASK: Review authentication flow, authorization logic, session management, token handling, password policies, audit logging
MODE: analysis
CONTEXT: @{**/*.ts,**/*.json,!**/*.test.ts} System serves 50k daily active users, uses JWT with Redis session store, bcrypt for passwords
EXPECTED: Compliance-ready analysis including: 1) Authentication flow diagram, 2) Security control mapping (SOC 2 CC6.1), 3) Vulnerability assessment with CVSS scores, 4) Policy compliance report, 5) Audit logging coverage, 6) Remediation roadmap with deadlines
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Map to SOC 2 Trust Service Criteria | Follow OWASP ASVS v4.0 | Include penetration test recommendations | Verify GDPR data handling | Document all authentication events for audit trail
"
```

**Key Points**:
- **PURPOSE**: Include business driver (SOC 2 compliance)
- **CONTEXT**: Business metrics (50k DAU) + tech stack details
- **EXPECTED**: Numbered, specific deliverables with compliance mapping
- **RULES**: Multiple compliance frameworks + specific versions

## Example 2: Performance Optimization with Metrics

```bash
~/.claude/scripts/qwen-wrapper -p "
PURPOSE: Identify API performance bottlenecks to meet SLA requirements (<200ms p95)
TASK: Analyze request lifecycle: routing → middleware → controller → service → repository → database, measure each layer, identify slow queries, evaluate caching strategy, assess serialization overhead
MODE: analysis
CONTEXT: @{src/api/**/*.ts,src/services/**/*.ts,src/repositories/**/*.ts,src/middleware/**/*.ts} Current p95: 850ms, p99: 2.1s, 10k req/min peak, PostgreSQL 14, Redis 7, Node 20 LTS
EXPECTED: Performance optimization report: 1) Latency breakdown by layer (with percentiles), 2) Top 10 slow queries with execution plans, 3) N+1 query identification, 4) Caching opportunity analysis (hit rate projections), 5) Database index recommendations, 6) Implementation priority matrix (impact vs effort), 7) Expected performance gains per optimization
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | Focus on p95 and p99 latency | Identify serialization bottlenecks | Evaluate connection pooling | Consider Redis cache warming | Analyze query plan costs | Include monitoring recommendations (APM integration) | Prioritize quick wins vs long-term improvements
"
```

**Key Points**:
- **TASK**: Detailed layer-by-layer analysis with measurement
- **CONTEXT**: Current metrics (p95, p99) + target SLA + tech versions
- **EXPECTED**: Quantifiable outputs (top 10, hit rates, gains)
- **RULES**: Performance-focused constraints with monitoring integration

## Example 3: Code Quality Assessment with Technical Debt

```bash
cd src && ~/.claude/scripts/qwen-wrapper -p "
PURPOSE: Assess technical debt to plan refactoring sprint
TASK: Analyze code quality metrics: cyclomatic complexity, code duplication, test coverage, type safety, documentation completeness, pattern consistency, dependency coupling
MODE: analysis
CONTEXT: @{**/*.ts,!**/node_modules/**,!**/*.test.ts,tsconfig.json,jest.config.js,CLAUDE.md} Codebase: 80k LOC, 12 months old, 6 developers, TypeScript 5.2, strict mode enabled, current test coverage 45%
EXPECTED: Technical debt assessment: 1) Complexity hotspots (files >10 cyclomatic complexity), 2) Duplication report (>5% threshold), 3) Coverage gaps by module, 4) Type safety violations, 5) Documentation score, 6) Dependency coupling matrix, 7) Refactoring backlog prioritized by maintainability impact, 8) Sprint plan (2-week capacity) with effort estimates in story points
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/quality.txt) | Use standard complexity thresholds (>10 high, >20 critical) | Identify copy-paste code blocks | Flag any 'any' types | Check JSDoc coverage for public APIs | Detect circular dependencies | Calculate technical debt in developer-days | Recommend ESLint rule additions | Include CI/CD quality gate suggestions
"
```

**Key Points**:
- **CONTEXT**: Team context (6 devs, 12 months) + current metrics (45% coverage)
- **EXPECTED**: Sprint-ready backlog with effort estimates (story points)
- **RULES**: Specific thresholds + quantifiable debt + tooling recommendations
