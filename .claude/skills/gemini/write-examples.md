# Gemini Write Mode Examples

> **📖 Template Structure**: See [Universal Template Structure](command-structure.md) for detailed field guidelines.

All examples demonstrate write mode with explicit `--approval-mode yolo` and user permission.

## Example 1: Documentation Generation with Structured Output

```bash
~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: Generate comprehensive API documentation for external developers
TASK: Document all REST endpoints including: HTTP methods, routes, request/response schemas, authentication requirements, rate limits, error codes, example requests/responses
MODE: write
CONTEXT: @{src/api/**/*.ts,src/middleware/**/*.ts,src/validators/**/*.ts} API follows OpenAPI 3.0, uses JWT auth, implements rate limiting with Redis
EXPECTED: Create API.md with sections: 1) Overview, 2) Authentication, 3) Endpoints (grouped by resource), 4) Error Handling, 5) Rate Limits, 6) Code Examples (curl, JavaScript, Python). Include OpenAPI spec generation instructions.
RULES: Follow OpenAPI 3.0 specification | Use markdown tables for endpoints | Include all HTTP status codes | Add rate limit headers documentation | Provide working curl examples | Consider API versioning strategy
"
```

**Key Points**:
- **--approval-mode yolo**: Required for write mode
- **TASK**: Exhaustive list of what to document
- **EXPECTED**: Specific file name (API.md) + numbered sections + multiple output requirements
- **RULES**: Specification compliance + formatting + comprehensive coverage

## Example 2: Module Documentation with Template and Standards

```bash
cd src/services && ~/.claude/scripts/gemini-wrapper --approval-mode yolo -p "
PURPOSE: Document service layer modules for team knowledge sharing and onboarding
TASK: Generate CLAUDE.md for each service file covering: module purpose, public API, dependencies, data flow, error handling, testing approach, usage examples
MODE: write
CONTEXT: @{**/*.ts,../models/**/*.ts,../repositories/**/*.ts} Services follow DDD pattern, use dependency injection, integrate with Redis cache and PostgreSQL
EXPECTED: Create CLAUDE.md for: user.service.ts, auth.service.ts, payment.service.ts, notification.service.ts. Each file includes: Purpose, Architecture, Public Methods (with signatures), Dependencies Graph, Error Scenarios, Test Coverage Status, Integration Points, Usage Examples
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/memory/claude-module-unified.txt) | Follow DDD ubiquitous language | Document all public methods | Include sequence diagrams for complex flows | Reference related services | Add TODO sections for future improvements | Maintain consistency across all service docs
"
```

**Key Points**:
- **TASK**: Comprehensive documentation coverage per file
- **EXPECTED**: Multiple output files with identical structure
- **RULES**: Template + pattern adherence + diagram requirements + maintenance considerations
