# Codex Feature Implementation Examples

> **📖 Template Structure**: See [Universal Template Structure](SKILL.md#universal-template-structure) in SKILL.md for detailed field guidelines and session resume patterns.

All examples demonstrate production-ready feature development with testing, security, and maintainability focus.

## Example 1: RESTful API with Validation and Tests

```bash
codex -C src/api --full-auto exec "
PURPOSE: Implement user profile API to support mobile app launch
TASK: Create RESTful CRUD endpoints for user profiles including: GET /users/:id (with query params for field filtering), POST /users (with validation), PUT /users/:id (partial updates), DELETE /users/:id (soft delete). Implement request validation with Joi/Zod, error handling middleware, rate limiting per endpoint, response pagination for list operations, OpenAPI documentation comments.
MODE: auto
CONTEXT: @{src/models/user.ts,src/middleware/**/*.ts,src/validators/**/*.ts,../database/schema.prisma} Existing patterns: Repository pattern, service layer, JWT auth middleware, Prisma ORM, Express 4.18, TypeScript strict mode. Database: PostgreSQL 14 with 50k users.
EXPECTED: Deliverables: 1) user.controller.ts (4 CRUD endpoints), 2) user.service.ts (business logic), 3) user.validator.ts (Joi schemas), 4) user.routes.ts (Express router config), 5) user.test.ts (integration tests with supertest, >90% coverage), 6) Update OpenAPI spec in api-docs.yaml. All endpoints must return consistent error format {code, message, details}.
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt) | Follow REST conventions (proper HTTP verbs and status codes) | Validate all inputs at API boundary | Implement rate limiting: 100/min for GET, 20/min for write ops | Use repository pattern from existing code | Soft delete with deletedAt timestamp | Include request logging | Add JSDoc with OpenAPI annotations | Write integration tests for all endpoints including error cases | Ensure backward compatibility with v1 API | Run ESLint and Prettier before commit
" --skip-git-repo-check -s danger-full-access
```

**Key Points**:
- **TASK**: Detailed requirements with specific endpoints and features
- **CONTEXT**: Tech stack + existing patterns + constraints (50k users)
- **EXPECTED**: 6 concrete deliverables with test coverage requirement
- **RULES**: Template + REST conventions + validation + testing + compatibility

## Example 2: Multi-Task Authentication Feature with Session Resume

Complete authentication system built incrementally across multiple related tasks.

### Task 1: Core Authentication (establish session)

```bash
codex -C src/auth --full-auto exec "
PURPOSE: Implement secure authentication system for enterprise SaaS platform
TASK: Create JWT-based authentication supporting: 1) Email/password login with bcrypt (cost 12), 2) OAuth 2.0 integration (Google, GitHub), 3) Token generation with RS256 asymmetric signing, 4) Access token (15min TTL) and refresh token (7d TTL), 5) Token refresh endpoint, 6) Logout with token blacklist in Redis
MODE: auto
CONTEXT: @{src/models/user.ts,src/config/jwt.ts,../../keys/private.pem,../../keys/public.pem} Requirements: Support 100k users, Redis for session store, Passport.js for OAuth, must comply with OWASP authentication guidelines
EXPECTED: Deliverables: 1) auth.service.ts (login, OAuth, token generation/refresh/revoke), 2) auth.controller.ts (5 endpoints: login, OAuth callback, refresh, logout, verify), 3) jwt.middleware.ts (token verification for protected routes), 4) auth.validator.ts (input validation), 5) auth.test.ts (unit + integration tests, >90% coverage including security scenarios), 6) Update .env.example with new config
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/feature.txt) | Follow OWASP Authentication Cheat Sheet | Use bcrypt with salt rounds 12 | Implement rate limiting: 5 login attempts per 15min per IP | Store only refresh tokens (not access tokens) | Implement token rotation on refresh | Add brute force protection | Include security event logging | Validate OAuth state parameter | Test token expiration and invalid token scenarios | Document security considerations in SECURITY.md
" --skip-git-repo-check -s danger-full-access
```

### Task 2: Multi-Factor Authentication (continue session)

```bash
codex --full-auto exec "
PURPOSE: Add MFA layer to enhance security for enterprise accounts
TASK: Implement TOTP-based MFA: 1) MFA enrollment endpoint with QR code generation, 2) MFA verification during login, 3) Backup codes generation (10 one-time codes), 4) MFA status in user profile, 5) Admin can require MFA for user roles
MODE: auto
CONTEXT: Previous auth implementation from current session. Use speakeasy library for TOTP, qrcode for QR generation. MFA should be optional by default but enforceable per user role.
EXPECTED: Deliverables: 1) mfa.service.ts (enroll, verify, generate backup codes, validate backup code), 2) Update auth.controller.ts with MFA endpoints, 3) Update auth flow to check MFA status, 4) Database migration for MFA fields (secret, enabled, backup_codes), 5) mfa.test.ts (test enrollment, verification, backup codes, >85% coverage), 6) Update API docs with MFA flow
RULES: Use TOTP with 30s window, 6-digit codes | Encrypt MFA secret in database | Invalidate backup codes after use | Rate limit verification attempts (5/min) | Add MFA recovery flow | Log all MFA events | Test clock skew handling | Document MFA setup guide for users | Ensure backward compatibility (MFA optional)
" resume --last --skip-git-repo-check -s danger-full-access
```

### Task 3: Session Management Enhancement (continue session)

```bash
codex --full-auto exec "
PURPOSE: Implement session management UI for users to control active devices
TASK: Create session management system: 1) Track active sessions per user (device, location, IP, last activity), 2) List all active sessions endpoint, 3) Revoke specific session endpoint, 4) Revoke all sessions (logout everywhere), 5) Automatic session cleanup for expired tokens
MODE: auto
CONTEXT: Previous auth and MFA implementation from current session. Store session metadata in Redis with refresh token as key. Use GeoIP for location, UAParser for device detection.
EXPECTED: Deliverables: 1) session.service.ts (create, list, revoke, cleanup), 2) session.controller.ts (3 endpoints), 3) Update token refresh to update session activity, 4) Background job for session cleanup (runs hourly), 5) session.test.ts (>85% coverage), 6) Update user API with session endpoints
RULES: Store minimal session metadata (no PII) | Implement session limit per user (max 10 devices) | Include revocation in token validation middleware | Handle concurrent session updates | Add session activity logs | Test session cleanup job | Ensure revoked session can't refresh | Document session management in API docs | Consider GDPR session data retention (30 days)
" resume --last --skip-git-repo-check -s danger-full-access
```

### Task 4: Comprehensive Test Suite (continue session)

```bash
codex --full-auto exec "
PURPOSE: Ensure authentication security and reliability through comprehensive testing
TASK: Generate complete test suite covering: 1) Unit tests for all services, 2) Integration tests for all endpoints, 3) Security tests (injection, token tampering, brute force), 4) Performance tests (login throughput), 5) E2E tests for complete auth flows
MODE: write
CONTEXT: Complete auth implementation from current session including: login, OAuth, JWT, MFA, session management. Use Jest for unit/integration, Artillery for load testing.
EXPECTED: Deliverables: 1) Expand existing test files to >95% coverage, 2) security.test.ts (12 security scenarios), 3) performance.test.ts (load test: 100 req/s for 1min), 4) e2e/auth-flow.test.ts (full user journey), 5) Test report showing coverage by module, 6) Update CI pipeline config to enforce coverage thresholds
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/testing.txt) | Test all happy paths and error cases | Include security tests: SQL injection attempts, XSS in inputs, JWT tampering, expired tokens, invalid signatures | Mock external dependencies (OAuth providers, Redis) | Test rate limiting enforcement | Verify session isolation between users | Load test should achieve <200ms p95 latency | Use faker for test data generation | Clean up test data after each test | Document test scenarios in test file comments
" resume --last --skip-git-repo-check -s danger-full-access
```

**Key Points**:
- **Four-task sequence**: Core auth → MFA → Sessions → Tests
- **Session continuity**: Each task builds on previous using `resume --last`
- **Progressive complexity**: Features build incrementally
- **Final testing phase**: MODE=write for comprehensive test generation
