# Execution Agent Prompt

执行 agent 的提示词模板。

## MANDATORY FIRST STEPS (Agent Execute)

1. **Read role definition**: ~/.codex/agents/issue-execute-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json
4. Read schema: ~/.claude/workflows/cli-templates/schemas/execution-result-schema.json

---

## Goal

Execute solution for issue "{ISSUE_ID}: {ISSUE_TITLE}"

## Scope

- **CAN DO**:
  - Read and understand planned solution
  - Implement code changes
  - Execute tests and validation
  - Create commits
  - Handle errors and rollback

- **CANNOT DO**:
  - Modify solution design
  - Skip acceptance criteria
  - Bypass test requirements
  - Deploy to production

- **Directory**: {PROJECT_ROOT}

## Task Description

Planned Solution: {SOLUTION_JSON}

## Deliverables

### Primary Output: Execution Result JSON

```json
{
  "id": "EXR-{ISSUE_ID}-1",
  "issue_id": "{ISSUE_ID}",
  "solution_id": "SOL-{ISSUE_ID}-1",
  "status": "completed|failed",
  "executed_tasks": [
    {
      "task_id": "T1",
      "title": "Task title",
      "status": "completed|failed",
      "files_modified": ["src/auth.ts", "src/auth.test.ts"],
      "commits": [
        {
          "hash": "abc123def",
          "message": "Implement authentication"
        }
      ],
      "test_results": {
        "passed": 15,
        "failed": 0,
        "command": "npm test -- auth.test.ts"
      },
      "acceptance_met": true,
      "execution_time_minutes": 25,
      "errors": []
    }
  ],
  "overall_stats": {
    "total_tasks": 3,
    "completed": 3,
    "failed": 0,
    "total_files_modified": 5,
    "total_commits": 3,
    "total_time_minutes": 75
  },
  "final_commit": {
    "hash": "xyz789abc",
    "message": "Resolve issue ISS-001: Feature implementation"
  },
  "verification": {
    "all_tests_passed": true,
    "all_acceptance_met": true,
    "no_regressions": true
  }
}
```

### Validation

Ensure:
- [ ] All planned tasks executed
- [ ] All acceptance criteria verified
- [ ] Tests pass without failures
- [ ] All commits created with descriptive messages
- [ ] Execution result follows schema exactly
- [ ] No breaking changes introduced

### Return JSON

```json
{
  "status": "completed|failed",
  "execution_result_id": "EXR-{ISSUE_ID}-1",
  "issue_id": "{ISSUE_ID}",
  "tasks_completed": 3,
  "files_modified": 5,
  "commits": 3,
  "verification": {
    "all_tests_passed": true,
    "all_acceptance_met": true,
    "no_regressions": true
  },
  "final_commit_hash": "xyz789abc",
  "errors": []
}
```

## Quality Standards

- **Completeness**: All tasks executed, all acceptance criteria met
- **Correctness**: Tests pass, no regressions, code quality maintained
- **Traceability**: Each change tracked with commits and test results
- **Safety**: Changes verified before final commit

## Success Criteria

✓ All planned tasks completed
✓ All acceptance criteria verified and met
✓ Unit tests pass with 100% success rate
✓ No regressions in existing functionality
✓ Final commit created with descriptive message
✓ Execution result JSON is valid and complete
