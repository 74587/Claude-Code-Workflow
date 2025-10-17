# Qwen Write Mode Examples

> **📖 Template Structure**: See [Universal Template Structure](SKILL.md#universal-template-structure) in SKILL.md for detailed field guidelines.

All examples demonstrate write mode with compliance-focused documentation generation.

## Example 1: API Documentation with OpenAPI Spec

```bash
~/.claude/scripts/qwen-wrapper --approval-mode yolo -p "
PURPOSE: Generate production-ready API documentation for partner integration
TASK: Document all public API endpoints: authentication flow, user management, data access, webhooks, including request/response schemas, error codes, rate limits, pagination, versioning
MODE: write
CONTEXT: @{src/api/**/*.ts,src/controllers/**/*.ts,src/validators/**/*.ts,src/middleware/auth.ts,src/middleware/rateLimit.ts} API v2.1, OAuth 2.0 + API keys, rate limit 1000/hour per key, pagination max 100 items, webhook retry 3 times with exponential backoff
EXPECTED: Generate two files: 1) API_REFERENCE.md with sections (Authentication, Endpoints by resource, Webhooks, Error Handling, Rate Limits, Pagination, Versioning, SDKs), include curl/JavaScript/Python examples for each endpoint; 2) openapi.yaml (OpenAPI 3.1 spec) for automated tooling
RULES: Follow OpenAPI 3.1 specification exactly | Use markdown tables for parameter documentation | Include all HTTP status codes with examples | Document rate limit headers (X-RateLimit-*) | Provide webhook signature verification examples | Add troubleshooting section for common errors | Reference RFC 6749 for OAuth | Include Postman collection generation instructions
"
```

**Key Points**:
- **--approval-mode yolo**: Required for write mode
- **EXPECTED**: Two output files with specific formats (MD + YAML)
- **RULES**: Specification compliance + examples in multiple languages + troubleshooting

## Example 2: Module Documentation with Architecture Diagrams

```bash
cd src/payment && ~/.claude/scripts/qwen-wrapper --approval-mode yolo -p "
PURPOSE: Document payment module for PCI DSS compliance audit and team onboarding
TASK: Create comprehensive documentation covering: payment flow, provider integration (Stripe, PayPal), retry logic, idempotency, reconciliation, refund handling, webhook processing, failure scenarios
MODE: write
CONTEXT: @{**/*.ts,../models/**/*.ts,../services/**/*.ts,../../config/payment.json} Processes $2M monthly, supports 3 providers, handles 50k transactions/month, uses Stripe SDK v11, implements at-least-once delivery, stores payment tokens in HashiCorp Vault
EXPECTED: Create PAYMENT_MODULE.md with sections: 1) Executive Summary (purpose, metrics), 2) Architecture Overview (with Mermaid diagram), 3) Payment Flow (sequence diagram for happy path), 4) Provider Integration (per-provider details), 5) Idempotency Strategy, 6) Error Handling & Retries, 7) Reconciliation Process, 8) Security & PCI Compliance, 9) Monitoring & Alerting, 10) Runbooks (common operations), 11) Testing Strategy, 12) API Reference. Include code examples for critical paths.
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/memory/claude-module-unified.txt) | Include PCI DSS scope documentation | Document all failure scenarios with recovery procedures | Add Mermaid sequence diagrams for complex flows | Reference Stripe best practices | Include rate limiting for provider APIs | Document vault token lifecycle | Add metric definitions for monitoring | Create decision tree for refund handling | Include disaster recovery procedures
"
```

**Key Points**:
- **CONTEXT**: Business metrics ($2M, 50k txns) + security tooling (Vault)
- **EXPECTED**: Single comprehensive file with 12 sections + diagrams + code
- **RULES**: Compliance focus + diagrams + operational runbooks
