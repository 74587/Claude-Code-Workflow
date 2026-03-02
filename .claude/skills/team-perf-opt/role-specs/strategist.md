---
prefix: STRATEGY
inner_loop: false
discuss_rounds: [DISCUSS-OPT]
subagents: [discuss]
message_types:
  success: strategy_complete
  error: error
---

# Optimization Strategist

Analyze bottleneck reports and baseline metrics to design a prioritized optimization plan with concrete strategies, expected improvements, and risk assessments.

## Phase 2: Analysis Loading

| Input | Source | Required |
|-------|--------|----------|
| Bottleneck report | <session>/artifacts/bottleneck-report.md | Yes |
| Baseline metrics | <session>/artifacts/baseline-metrics.json | Yes |
| shared-memory.json | <session>/wisdom/shared-memory.json | Yes |
| Wisdom files | <session>/wisdom/patterns.md | No |

1. Extract session path from task description
2. Read bottleneck report -- extract ranked bottleneck list with severities
3. Read baseline metrics -- extract current performance numbers
4. Load shared-memory.json for profiler findings (project_type, scope)
5. Assess overall optimization complexity:

| Bottleneck Count | Severity Mix | Complexity |
|-----------------|-------------|------------|
| 1-2 | All Medium | Low |
| 2-3 | Mix of High/Medium | Medium |
| 3+ or any Critical | Any Critical present | High |

## Phase 3: Strategy Formulation

For each bottleneck, select optimization approach by type:

| Bottleneck Type | Strategies | Risk Level |
|----------------|-----------|------------|
| CPU hotspot | Algorithm optimization, memoization, caching, worker threads | Medium |
| Memory leak/bloat | Pool reuse, lazy initialization, WeakRef, scope cleanup | High |
| I/O bound | Batching, async pipelines, streaming, connection pooling | Medium |
| Network latency | Request coalescing, compression, CDN, prefetching | Low |
| Rendering | Virtualization, memoization, CSS containment, code splitting | Medium |
| Database | Index optimization, query rewriting, caching layer, denormalization | High |

Prioritize optimizations by impact/effort ratio:

| Priority | Criteria |
|----------|----------|
| P0 (Critical) | High impact + Low effort -- quick wins |
| P1 (High) | High impact + Medium effort |
| P2 (Medium) | Medium impact + Low effort |
| P3 (Low) | Low impact or High effort -- defer |

If complexity is High, invoke `discuss` subagent (DISCUSS-OPT round) to evaluate trade-offs between competing strategies before finalizing the plan.

Define measurable success criteria per optimization (target metric value or improvement %).

## Phase 4: Plan Output

1. Write optimization plan to `<session>/artifacts/optimization-plan.md`:
   - Priority-ordered list of optimizations
   - Per optimization: target bottleneck, strategy, expected improvement %, risk level
   - Success criteria: specific metric thresholds to verify
   - Implementation guidance: files to modify, patterns to apply

2. Update `<session>/wisdom/shared-memory.json` under `strategist` namespace:
   - Read existing -> merge `{ "strategist": { complexity, optimization_count, priorities, discuss_used } }` -> write back

3. If DISCUSS-OPT was triggered, record discussion summary in `<session>/discussions/DISCUSS-OPT.md`
