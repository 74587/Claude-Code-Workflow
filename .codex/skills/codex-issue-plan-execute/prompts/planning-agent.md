# Planning Agent Prompt

规划 agent 的提示词模板。

## MANDATORY FIRST STEPS (Agent Execute)

1. **Read role definition**: ~/.codex/agents/issue-plan-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json
4. Read schema: ~/.claude/workflows/cli-templates/schemas/solution-schema.json

---

## Goal

Plan solution for issue "{ISSUE_ID}: {ISSUE_TITLE}"

## Scope

- **CAN DO**:
  - Explore codebase
  - Analyze issue and design solutions
  - Create executable task breakdown
  - Define acceptance criteria

- **CANNOT DO**:
  - Execute solutions
  - Modify production code
  - Make commits

- **Directory**: {PROJECT_ROOT}

## Task Description

{ISSUE_DESCRIPTION}

## Deliverables

### Primary Output: Solution JSON

```json
{
  "id": "SOL-{ISSUE_ID}-1",
  "issue_id": "{ISSUE_ID}",
  "description": "Brief description of solution",
  "tasks": [
    {
      "id": "T1",
      "title": "Task title",
      "action": "Create|Modify|Fix|Refactor",
      "scope": "file path or directory",
      "description": "What to do",
      "modification_points": [...],
      "implementation": ["Step 1", "Step 2"],
      "test": {
        "commands": ["npm test -- file.test.ts"],
        "unit": ["Requirement 1"]
      },
      "acceptance": {
        "criteria": ["Criterion 1: Must pass"],
        "verification": ["Run tests"]
      },
      "depends_on": [],
      "estimated_minutes": 30,
      "priority": 1
    }
  ],
  "exploration_context": {
    "relevant_files": ["path/to/file.ts"],
    "patterns": "Follow existing pattern",
    "integration_points": "Used by service X"
  },
  "analysis": {
    "risk": "low|medium|high",
    "impact": "low|medium|high",
    "complexity": "low|medium|high"
  },
  "score": 0.95,
  "is_bound": true
}
```

### Validation

Ensure:
- [ ] All required fields present
- [ ] No circular dependencies in task.depends_on
- [ ] Each task has quantified acceptance.criteria
- [ ] Solution follows solution-schema.json exactly
- [ ] Score reflects quality (0.8+ for approval)

### Return JSON

```json
{
  "status": "completed|failed",
  "solution_id": "SOL-{ISSUE_ID}-1",
  "task_count": 3,
  "score": 0.95,
  "validation": {
    "schema_valid": true,
    "criteria_quantified": true,
    "no_circular_deps": true
  },
  "errors": []
}
```

## Quality Standards

- **Completeness**: All required fields, no missing sections
- **Clarity**: Acceptance criteria must be specific and measurable
- **Correctness**: No circular dependencies, valid schema
- **Pragmatism**: Solution is minimal and focused

## Success Criteria

✓ Solution JSON is valid and follows schema
✓ All tasks have acceptance.criteria
✓ No circular dependencies detected
✓ Score >= 0.8
✓ Estimated total time <= 2 hours
