# Phase 9: Fix Completion

> Source: `commands/workflow/review-cycle-fix.md` Phase 4 + Phase 5

## Overview
Aggregate fix results, generate summary report, update history, and optionally complete workflow session.

## Phase 4: Completion & Aggregation (Orchestrator)

- Collect final status from all fix-progress-{N}.json files
- Generate fix-summary.md with timeline and results
- Update fix-history.json with new session entry
- Remove active-fix-session.json
- TodoWrite completion: Mark all phases done
- Output summary to user

## Phase 5: Session Completion (Orchestrator)

- If all findings fixed successfully (no failures):
  - Prompt user: "All fixes complete. Complete workflow session? [Y/n]"
  - If confirmed: Execute `Skill(skill="workflow:session:complete")` to archive session with lessons learned
- If partial success (some failures):
  - Output: "Some findings failed. Review fix-summary.md before completing session."
  - Do NOT auto-complete session

## Error Handling

### Batching Failures (Phase 1.5)

- Invalid findings data -> Abort with error message
- Empty batches after grouping -> Warn and skip empty batches

### Planning Failures (Phase 2)

- Planning agent timeout -> Mark batch as failed, continue with other batches
- Partial plan missing -> Skip batch, warn user
- Agent crash -> Collect available partial plans, proceed with aggregation
- All agents fail -> Abort entire fix session with error
- Aggregation conflicts -> Apply conflict resolution (serialize conflicting groups)

### Execution Failures (Phase 3)

- Agent crash -> Mark group as failed, continue with other groups
- Test command not found -> Skip test verification, warn user
- Git operations fail -> Abort with error, preserve state

### Rollback Scenarios

- Test failure after fix -> Automatic `git checkout` rollback
- Max iterations reached -> Leave file unchanged, mark as failed
- Unrecoverable error -> Rollback entire group, save checkpoint

## TodoWrite Structures

### Initialization (after Phase 1.5 batching)

```javascript
TodoWrite({
  todos: [
    {content: "Phase 1: Discovery & Initialization", status: "completed", activeForm: "Discovering"},
    {content: "Phase 1.5: Intelligent Batching", status: "completed", activeForm: "Batching"},
    {content: "Phase 2: Parallel Planning", status: "in_progress", activeForm: "Planning"},
    {content: "  → Batch 1: 4 findings (auth.ts:security)", status: "pending", activeForm: "Planning batch 1"},
    {content: "  → Batch 2: 3 findings (query.ts:security)", status: "pending", activeForm: "Planning batch 2"},
    {content: "  → Batch 3: 2 findings (config.ts:quality)", status: "pending", activeForm: "Planning batch 3"},
    {content: "Phase 3: Execution", status: "pending", activeForm: "Executing"},
    {content: "Phase 4: Completion", status: "pending", activeForm: "Completing"}
  ]
});
```

### During Planning (parallel agents running)

```javascript
TodoWrite({
  todos: [
    {content: "Phase 1: Discovery & Initialization", status: "completed", activeForm: "Discovering"},
    {content: "Phase 1.5: Intelligent Batching", status: "completed", activeForm: "Batching"},
    {content: "Phase 2: Parallel Planning", status: "in_progress", activeForm: "Planning"},
    {content: "  → Batch 1: 4 findings (auth.ts:security)", status: "completed", activeForm: "Planning batch 1"},
    {content: "  → Batch 2: 3 findings (query.ts:security)", status: "in_progress", activeForm: "Planning batch 2"},
    {content: "  → Batch 3: 2 findings (config.ts:quality)", status: "in_progress", activeForm: "Planning batch 3"},
    {content: "Phase 3: Execution", status: "pending", activeForm: "Executing"},
    {content: "Phase 4: Completion", status: "pending", activeForm: "Completing"}
  ]
});
```

### During Execution

```javascript
TodoWrite({
  todos: [
    {content: "Phase 1: Discovery & Initialization", status: "completed", activeForm: "Discovering"},
    {content: "Phase 1.5: Intelligent Batching", status: "completed", activeForm: "Batching"},
    {content: "Phase 2: Parallel Planning (3 batches → 5 groups)", status: "completed", activeForm: "Planning"},
    {content: "Phase 3: Execution", status: "in_progress", activeForm: "Executing"},
    {content: "  → Stage 1: Parallel execution (3 groups)", status: "completed", activeForm: "Executing stage 1"},
    {content: "    • Group G1: Auth validation (2 findings)", status: "completed", activeForm: "Fixing G1"},
    {content: "    • Group G2: Query security (3 findings)", status: "completed", activeForm: "Fixing G2"},
    {content: "    • Group G3: Config quality (1 finding)", status: "completed", activeForm: "Fixing G3"},
    {content: "  → Stage 2: Serial execution (1 group)", status: "in_progress", activeForm: "Executing stage 2"},
    {content: "    • Group G4: Dependent fixes (2 findings)", status: "in_progress", activeForm: "Fixing G4"},
    {content: "Phase 4: Completion", status: "pending", activeForm: "Completing"}
  ]
});
```

### Update Rules

- Add batch items dynamically during Phase 1.5
- Mark batch items completed as parallel agents return results
- Add stage/group items dynamically after Phase 2 plan aggregation
- Mark completed immediately after each group finishes
- Update parent phase status when all child items complete

## Post-Completion Expansion

After completion, ask user whether to expand into issues (test/enhance/refactor/doc). For selected items, invoke `Skill(skill="issue:new", args="{summary} - {dimension}")`.

## Best Practices

1. **Leverage Parallel Planning**: For 10+ findings, parallel batching significantly reduces planning time
2. **Tune Batch Size**: Use `--batch-size` to control granularity (smaller batches = more parallelism, larger = better grouping context)
3. **Conservative Approach**: Test verification is mandatory - no fixes kept without passing tests
4. **Parallel Efficiency**: MAX_PARALLEL=10 for planning agents, 3 concurrent execution agents per stage
5. **Resume Support**: Fix sessions can resume from checkpoints after interruption
6. **Manual Review**: Always review failed fixes manually - may require architectural changes
7. **Incremental Fixing**: Start with small batches (5-10 findings) before large-scale fixes

## Related Commands

### View Fix Progress
Use `ccw view` to open the workflow dashboard in browser:

```bash
ccw view
```

### Re-run Fix Pipeline
```
Skill(skill="review-cycle", args="--fix ...")
```

## Output

- Files: fix-summary.md, fix-history.json
- State: active-fix-session.json removed
- Optional: workflow session completed via `Skill(skill="workflow:session:complete")`

## Completion

Review Cycle fix pipeline complete. Review fix-summary.md for results.
