# Codex Bug Fix and Refactoring Examples

> **📖 Template Structure**: See [Universal Template Structure](SKILL.md#universal-template-structure) in SKILL.md for detailed field guidelines and session resume patterns.

## Bug Fix: Performance Issue Investigation and Resolution

Three-phase approach: Investigate → Fix → Verify

### Phase 1: Investigation (start session)

```bash
codex -C src/api --full-auto exec "
PURPOSE: Investigate and resolve API endpoint performance degradation (p95 from 200ms to 2.5s)
TASK: Analyze /api/dashboard endpoint performance: 1) Profile request execution (use Node.js profiler), 2) Identify slow database queries (enable query logging), 3) Check N+1 query problems, 4) Analyze serialization overhead, 5) Review caching effectiveness, 6) Examine memory allocation patterns
MODE: auto
CONTEXT: @{src/api/dashboard.controller.ts,src/services/dashboard.service.ts,src/repositories/**/*.ts} Endpoint aggregates data from 5 database tables, serves 1000 req/min peak, PostgreSQL 14, Redis cache enabled. Performance degraded after recent feature addition (user preferences).
EXPECTED: Deliverables: 1) Performance analysis report identifying bottlenecks with percentages (e.g., \"45% time in database queries, 30% in serialization\"), 2) Flame graph from profiling, 3) Query execution plans for slow queries, 4) Specific line numbers of problematic code, 5) Root cause summary with evidence, 6) Optimization recommendations prioritized by impact
RULES: Use Node.js --prof for profiling | Enable PostgreSQL query logging with execution times | Use Chrome DevTools for flame graph visualization | Check for N+1 queries with Prisma query logging | Analyze JSON serialization overhead | Review Redis cache hit rates | Identify memory leaks with heapdump | Compare current vs previous commit performance | Document findings in INVESTIGATION.md
" --skip-git-repo-check -s danger-full-access
```

### Phase 2: Fix Implementation (continue session)

```bash
codex --full-auto exec "
PURPOSE: Implement optimizations to restore API performance to <200ms p95
TASK: Apply fixes based on investigation findings: 1) Optimize database queries (add indexes, use joins instead of sequential queries), 2) Implement query result caching, 3) Use streaming for large responses, 4) Add database query batching, 5) Optimize serialization with selective field loading
MODE: auto
CONTEXT: Investigation results from current session showing: N+1 query in user preferences (40% of latency), missing index on user_settings.user_id (25%), inefficient JSON serialization of nested objects (20%). Current code performs 15 queries per request.
EXPECTED: Deliverables: 1) Optimized dashboard.service.ts reducing queries to max 3 per request, 2) Database migration adding indexes on user_settings.user_id and preferences.user_id, 3) Implement Redis caching with 5min TTL for dashboard data, 4) Add query batching using dataloader pattern, 5) Selective field loading (only fetch needed columns), 6) Update tests to verify optimizations, 7) Performance comparison report showing improvement
RULES: Maintain backward compatibility (same API contract) | Add database indexes without locking tables (CONCURRENTLY) | Implement cache invalidation on data updates | Use Prisma select for selective loading | Test with production-like data volume | Verify cache hit rate >80% | Ensure p95 <200ms under load | Add performance monitoring (APM integration) | Document optimization strategy | Update runbooks with new caching behavior
" resume --last --skip-git-repo-check -s danger-full-access
```

### Phase 3: Verification (continue session)

```bash
codex --full-auto exec "
PURPOSE: Verify performance fixes and ensure no regressions
TASK: Comprehensive validation: 1) Run load tests comparing before/after metrics, 2) Verify all functional tests pass, 3) Check for new memory leaks, 4) Validate cache behavior, 5) Measure database impact (connection pool usage, query counts)
MODE: write
CONTEXT: Optimizations from current session: reduced queries from 15 to 3, added 2 indexes, implemented Redis caching, added dataloader. Original p95: 2.5s, target: <200ms.
EXPECTED: Deliverables: 1) performance-test.ts (Artillery load test: 1000 req/min for 5min), 2) Performance report comparing metrics (latency p50/p95/p99, throughput, error rate, database connections, cache hit rate), 3) Regression test suite covering all dashboard functionality, 4) Memory profile comparison (before/after heap usage), 5) Go/No-Go recommendation with evidence
RULES: Load test must match production traffic pattern | Verify all existing tests pass (no regressions) | Check memory usage under load (no leaks) | Validate cache hit rate >80% | Ensure database connection pool <50% utilized | Verify error rate <0.1% | Test cache invalidation scenarios | Monitor for slow query logs | Document performance gains | Create performance dashboard for ongoing monitoring
" resume --last --skip-git-repo-check -s danger-full-access
```

**Key Points**:
- **Three-phase approach**: Investigate → Fix → Verify
- **Data-driven**: Specific metrics, percentages, targets
- **Evidence-based**: Profiling, flame graphs, query plans
- **Production-ready**: Load testing, monitoring, go/no-go decision

## Large-Scale Refactoring with Safety Nets

Four-phase DDD refactoring: Plan → Pilot → Scale → Cleanup

### Phase 1: Analysis and Planning (start session)

```bash
codex -C src --full-auto exec "
PURPOSE: Refactor monolithic service layer to modular domain-driven design for improved maintainability
TASK: Analyze current architecture for refactoring scope: 1) Identify domain boundaries (user, product, order, payment, notification), 2) Map current service dependencies, 3) Identify shared utilities, 4) Find circular dependencies, 5) Assess test coverage by module, 6) Estimate breaking changes
MODE: auto
CONTEXT: @{src/services/**/*.ts,src/models/**/*.ts,src/repositories/**/*.ts} Monolithic structure: single services/ directory with 45 service files, 80k LOC, shared database models, tight coupling. Team of 8 developers, 100k users in production.
EXPECTED: Deliverables: 1) Domain boundary map with proposed structure, 2) Dependency graph (current vs proposed), 3) Migration strategy (phase-by-phase plan), 4) Breaking changes catalog, 5) Test strategy to prevent regressions, 6) Risk assessment matrix, 7) Rollback plan, 8) Estimated timeline (sprints), 9) REFACTORING_PLAN.md document
RULES: $(cat ~/.claude/workflows/cli-templates/prompts/development/refactor.txt) | Follow DDD principles (bounded contexts) | Minimize breaking changes | Plan for gradual migration | Maintain API compatibility during transition | Identify shared kernel carefully | Design anti-corruption layers | Consider team ownership per domain | Assess impact on deployment pipeline | Include database migration strategy | Define success metrics and exit criteria
" --skip-git-repo-check -s danger-full-access
```

### Phase 2: Extract First Domain (continue session)

```bash
codex --full-auto exec "
PURPOSE: Extract user domain as pilot for refactoring approach
TASK: Refactor user-related services into isolated domain: 1) Create src/domains/user structure, 2) Move user.service.ts, profile.service.ts, preferences.service.ts, 3) Extract user-specific models and repositories, 4) Define domain public API (facade pattern), 5) Update imports in consuming code, 6) Ensure zero functionality changes
MODE: auto
CONTEXT: Refactoring plan from current session. User domain identified as: 3 services, 2 models, 2 repositories. Currently consumed by 12 API controllers. No external domain dependencies (good isolation).
EXPECTED: Deliverables: 1) domains/user/ directory structure (services/, models/, repositories/, index.ts for public API), 2) Migrate 3 services with same API signatures, 3) Create UserDomain facade class, 4) Update 12 controller imports to use facade, 5) All existing tests pass unchanged, 6) Add integration tests for domain boundary, 7) Update architecture docs
RULES: Use barrel exports (index.ts) for public API | Hide implementation details | Maintain exact same function signatures | Run full test suite after each file move | Use git mv to preserve history | Add deprecation warnings to old imports | Create facade with same interface as direct service calls | Ensure no circular dependencies | Verify production build succeeds | Document domain public API with JSDoc
" resume --last --skip-git-repo-check -s danger-full-access
```

### Phase 3: Continue with Remaining Domains (continue session)

```bash
codex --full-auto exec "
PURPOSE: Complete domain extraction for product and order domains
TASK: Following user domain pattern, extract: 1) Product domain (4 services), 2) Order domain (6 services with product dependency). Handle cross-domain dependencies correctly.
MODE: auto
CONTEXT: User domain successfully extracted from current session. Product domain: 4 services, no external dependencies. Order domain: 6 services, depends on Product and User domains.
EXPECTED: Deliverables: 1) domains/product/ structure with facade, 2) domains/order/ structure with facades for User and Product, 3) Cross-domain communication through facades only, 4) Update all controller imports, 5) All tests pass, 6) Add domain integration tests, 7) Update dependency graph diagram
RULES: Domains communicate only through public APIs (facades) | No direct cross-domain model access | Use dependency injection for cross-domain calls | Maintain transactional boundaries | Verify no circular domain dependencies | Test cross-domain scenarios | Document domain relationships | Ensure performance not degraded | Run regression tests | Update team ownership docs
" resume --last --skip-git-repo-check -s danger-full-access
```

### Phase 4: Cleanup and Verification (continue session)

```bash
codex --full-auto exec "
PURPOSE: Finalize refactoring with cleanup and comprehensive verification
TASK: Complete migration: 1) Remove old services/ directory, 2) Update all import statements, 3) Clean up unused code, 4) Update build configuration, 5) Verify no broken imports, 6) Run full test suite, 7) Perform load test
MODE: auto
CONTEXT: All domains extracted from current session: user (3 services), product (4 services), order (6 services), payment (5 services), notification (3 services). Old services/ directory still exists for reference.
EXPECTED: Deliverables: 1) Delete old services/ directory, 2) Update tsconfig.json paths, 3) Update import statements across codebase, 4) Remove dead code (identified by unused exports), 5) All tests pass (unit + integration + e2e), 6) Load test confirms no performance regression, 7) Update ARCHITECTURE.md with new structure, 8) Create migration guide for other developers
RULES: Verify no imports from old paths | Run ESLint to catch broken imports | Ensure all tests pass | Load test must show <5% performance delta | Update CI/CD pipeline if needed | Document new domain structure | Create coding guidelines for domain boundaries | Update onboarding docs | Verify build artifacts are correct | Perform git commit with detailed message documenting refactoring scope
" resume --last --skip-git-repo-check -s danger-full-access
```

**Key Points**:
- **Four-phase refactoring**: Plan → Pilot → Scale → Cleanup
- **Safety-first**: Gradual migration, test coverage, rollback plan
- **Production awareness**: Zero downtime, performance monitoring
- **Team enablement**: Documentation, guidelines, ownership
