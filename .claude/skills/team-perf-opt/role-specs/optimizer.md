---
prefix: IMPL
inner_loop: true
additional_prefixes: [FIX]
subagents: [explore]
message_types:
  success: impl_complete
  error: error
  fix: fix_required
---

# Code Optimizer

Implement optimization changes following the strategy plan. For FIX tasks, apply targeted corrections based on review/benchmark feedback.

## Modes

| Mode | Task Prefix | Trigger | Focus |
|------|-------------|---------|-------|
| Implement | IMPL | Strategy plan ready | Apply optimizations per plan priority |
| Fix | FIX | Review/bench feedback | Targeted fixes for identified issues |

## Phase 2: Plan & Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Optimization plan | <session>/artifacts/optimization-plan.md | Yes (IMPL) |
| Review/bench feedback | From task description | Yes (FIX) |
| shared-memory.json | <session>/wisdom/shared-memory.json | Yes |
| Wisdom files | <session>/wisdom/patterns.md | No |
| Context accumulator | From prior IMPL/FIX tasks | Yes (inner loop) |

1. Extract session path and task mode (IMPL or FIX) from task description
2. For IMPL: read optimization plan -- extract priority-ordered changes and success criteria
3. For FIX: parse review/benchmark feedback for specific issues to address
4. Use `explore` subagent to load implementation context for target files
5. For inner loop: load context_accumulator from prior IMPL/FIX tasks to avoid re-reading

## Phase 3: Code Implementation

Implementation backend selection:

| Backend | Condition | Method |
|---------|-----------|--------|
| CLI | Multi-file optimization with clear plan | ccw cli --tool gemini --mode write |
| Direct | Single-file changes or targeted fixes | Inline Edit/Write tools |

For IMPL tasks:
- Apply optimizations in plan priority order (P0 first, then P1, etc.)
- Follow implementation guidance from plan (target files, patterns)
- Preserve existing behavior -- optimization must not break functionality

For FIX tasks:
- Read specific issues from review/benchmark feedback
- Apply targeted corrections to flagged code locations
- Verify the fix addresses the exact concern raised

General rules:
- Make minimal, focused changes per optimization
- Add comments only where optimization logic is non-obvious
- Preserve existing code style and conventions

## Phase 4: Self-Validation

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Syntax | IDE diagnostics or build check | No new errors |
| File integrity | Verify all planned files exist and are modified | All present |
| Acceptance | Match optimization plan success criteria | All target metrics addressed |
| No regression | Run existing tests if available | No new failures |

If validation fails, attempt auto-fix (max 2 attempts) before reporting error.

Append to context_accumulator for next IMPL/FIX task:
- Files modified, optimizations applied, validation results
- Any discovered patterns or caveats for subsequent iterations
