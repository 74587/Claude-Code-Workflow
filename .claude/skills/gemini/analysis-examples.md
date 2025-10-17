# Gemini Analysis Mode Examples

> **📖 Template Structure**: See [Universal Template Structure](command-structure.md) for detailed field guidelines.

All examples demonstrate read-only analysis mode with comprehensive template usage.

## Example 1: Architecture Analysis with Multiple Constraints

```bash
cd src/auth && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Analyze authentication system architecture to identify security risks and scalability issues
TASK: Review JWT implementation, token management, session handling, and middleware integration
MODE: analysis
CONTEXT: @{**/*.ts,**/*.json} Current system handles 10k users, planning to scale to 100k
EXPECTED: Architecture analysis report covering: security vulnerabilities, scalability bottlenecks, integration risks, priority recommendations with effort estimates
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Focus on OWASP Top 10 | Follow OAuth 2.0 best practices | Consider microservices migration path | Include performance metrics
"
```

**Key Points**:
- **PURPOSE**: Clear goal (analyze) + reason (identify risks)
- **TASK**: Multiple specific aspects to review
- **CONTEXT**: File patterns + business context (scale requirements)
- **EXPECTED**: Multiple deliverables with specific coverage
- **RULES**: Template + multiple constraints separated by `|`

## Example 2: Pattern Discovery with Output Specifications

```bash
cd src && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Identify and document error handling patterns to establish coding standards
TASK: Analyze error handling across all modules, categorize patterns (try-catch, promise rejection, async/await, custom error classes), identify inconsistencies
MODE: analysis
CONTEXT: @{**/*.ts,!**/*.test.ts,!**/node_modules/**} Team size 5 developers, TypeScript 5.0, Node 20 LTS
EXPECTED: Pattern analysis document including: 1) Pattern catalog with code examples, 2) Consistency score by module, 3) Recommended standard pattern, 4) Migration guide from inconsistent patterns to standard
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/pattern.txt) | Focus on async/await patterns | Exclude test files | Consider error logging integration | Follow TypeScript strict mode conventions
"
```

**Key Points**:
- **TASK**: Break down into sub-tasks (analyze → categorize → identify)
- **CONTEXT**: Exclude patterns with `!` + tech stack context
- **EXPECTED**: Numbered deliverables with clear output structure
- **RULES**: Multiple focus areas + exclusions + tech constraints

## Example 3: Multi-Module Analysis with Dependency Tracing

```bash
~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Understand data flow from API to database to identify performance bottlenecks
TASK: Trace data flow through: API endpoints → Controllers → Services → Repositories → Database, identify transformation points, analyze query patterns, measure complexity at each layer
MODE: analysis
CONTEXT: @{src/api/**/*.ts,src/controllers/**/*.ts,src/services/**/*.ts,src/repositories/**/*.ts,src/models/**/*.ts,CLAUDE.md} Current API response time avg 500ms, target <200ms
EXPECTED: Data flow diagram (Mermaid format), transformation analysis per layer, query complexity report, performance bottleneck identification with impact scores (high/medium/low), optimization recommendations prioritized by ROI
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/analysis/architecture.txt) | Map all transformation points | Identify N+1 query problems | Consider caching opportunities | Include database index recommendations | Follow repository pattern standards
"
```

**Key Points**:
- **TASK**: Multi-step trace with specific layers
- **CONTEXT**: Multiple module paths + performance metrics
- **EXPECTED**: Multiple output formats (diagram + reports) with prioritization
- **RULES**: Comprehensive constraint list with specific technical focuses
