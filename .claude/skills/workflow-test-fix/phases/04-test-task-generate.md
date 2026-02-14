# Phase 4: Test Task Generate (test-task-generate)

Generate test task JSONs via action-planning-agent.

## Objective

- Generate test-specific IMPL_PLAN.md and task JSONs based on TEST_ANALYSIS_RESULTS.md
- Create minimum 4 tasks covering test generation, code validation, quality review, and test execution

## Execution

### Step 1.4: Generate Test Tasks

```
Skill(skill="workflow:tools:test-task-generate", args="--session [testSessionId]")
```

**Input**: `testSessionId` from Phase 1

**Note**: test-task-generate invokes action-planning-agent to generate test-specific IMPL_PLAN.md and task JSONs based on TEST_ANALYSIS_RESULTS.md.

**Expected Output** (minimum 4 tasks):

| Task | Type | Agent | Purpose |
|------|------|-------|---------|
| IMPL-001 | test-gen | @code-developer | Test understanding & generation (L1-L3) |
| IMPL-001.3 | code-validation | @test-fix-agent | Code validation gate (L0 + AI issues) |
| IMPL-001.5 | test-quality-review | @test-fix-agent | Test quality gate |
| IMPL-002 | test-fix | @test-fix-agent | Test execution & fix cycle |

**Validation**:
- `.workflow/active/[testSessionId]/.task/IMPL-001.json` exists
- `.workflow/active/[testSessionId]/.task/IMPL-001.3-validation.json` exists
- `.workflow/active/[testSessionId]/.task/IMPL-001.5-review.json` exists
- `.workflow/active/[testSessionId]/.task/IMPL-002.json` exists
- `.workflow/active/[testSessionId]/IMPL_PLAN.md` exists
- `.workflow/active/[testSessionId]/TODO_LIST.md` exists

## Output

- **Files**: IMPL_PLAN.md, IMPL-*.json (4+), TODO_LIST.md
- **TodoWrite**: Mark Phase 1-4 completed, Phase 5 in_progress

## Next Phase

Return to orchestrator for summary output, then auto-continue to [Phase 5: Test Cycle Execute](05-test-cycle-execute.md).
