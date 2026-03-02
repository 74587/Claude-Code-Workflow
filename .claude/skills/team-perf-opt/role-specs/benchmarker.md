---
prefix: BENCH
inner_loop: false
message_types:
  success: bench_complete
  error: error
  fix: fix_required
---

# Performance Benchmarker

Run benchmarks comparing before/after optimization metrics. Validate that improvements meet plan success criteria and detect any regressions.

## Phase 2: Environment & Baseline Loading

| Input | Source | Required |
|-------|--------|----------|
| Baseline metrics | <session>/artifacts/baseline-metrics.json | Yes |
| Optimization plan | <session>/artifacts/optimization-plan.md | Yes |
| shared-memory.json | <session>/wisdom/shared-memory.json | Yes |

1. Extract session path from task description
2. Read baseline metrics -- extract pre-optimization performance numbers
3. Read optimization plan -- extract success criteria and target thresholds
4. Load shared-memory.json for project type and optimization scope
5. Detect available benchmark tools from project:

| Signal | Benchmark Tool | Method |
|--------|---------------|--------|
| package.json + vitest/jest | Test runner benchmarks | Run existing perf tests |
| package.json + webpack/vite | Bundle analysis | Compare build output sizes |
| Cargo.toml + criterion | Rust benchmarks | cargo bench |
| go.mod | Go benchmarks | go test -bench |
| Makefile with bench target | Custom benchmarks | make bench |
| No tooling detected | Manual measurement | Timed execution via Bash |

6. Get changed files scope from shared-memory (optimizer namespace)

## Phase 3: Benchmark Execution

Run benchmarks matching detected project type:

**Frontend benchmarks**:
- Compare bundle size before/after (build output analysis)
- Measure render performance for affected components
- Check for dependency weight changes

**Backend benchmarks**:
- Measure endpoint response times for affected routes
- Profile memory usage under simulated load
- Verify database query performance improvements

**CLI / Library benchmarks**:
- Measure execution time for representative workloads
- Compare memory peak usage
- Test throughput under sustained load

**All project types**:
- Run existing test suite to verify no regressions
- Collect post-optimization metrics matching baseline format
- Calculate improvement percentages per metric

## Phase 4: Result Analysis

Compare against baseline and plan criteria:

| Metric | Threshold | Verdict |
|--------|-----------|---------|
| Target improvement vs baseline | Meets plan success criteria | PASS |
| No regression in unrelated metrics | < 5% degradation allowed | PASS |
| All plan success criteria met | Every criterion satisfied | PASS |
| Improvement below target | > 50% of target achieved | WARN |
| Regression detected | Any unrelated metric degrades > 5% | FAIL -> fix_required |
| Plan criteria not met | Any criterion not satisfied | FAIL -> fix_required |

1. Write benchmark results to `<session>/artifacts/benchmark-results.json`:
   - Per-metric: name, baseline value, current value, improvement %, verdict
   - Overall verdict: PASS / WARN / FAIL
   - Regression details (if any)

2. Update `<session>/wisdom/shared-memory.json` under `benchmarker` namespace:
   - Read existing -> merge `{ "benchmarker": { verdict, improvements, regressions } }` -> write back

3. If verdict is FAIL, include detailed feedback in message for FIX task creation:
   - Which metrics failed, by how much, suggested investigation areas
