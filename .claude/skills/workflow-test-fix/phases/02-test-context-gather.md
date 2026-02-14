# Phase 2: Test Context Gather (test-context-gather)

Gather test context via coverage analysis or codebase scan.

## Objective

- Gather test context (coverage analysis or codebase scan)
- Generate context package for downstream analysis

## Execution

### Step 1.2: Gather Test Context

```
// Session Mode - gather from source session
Skill(skill="workflow:tools:test-context-gather", args="--session [testSessionId]")

// Prompt Mode - gather from codebase
Skill(skill="workflow:tools:context-gather", args="--session [testSessionId] \"[task_description]\"")
```

**Input**: `testSessionId` from Phase 1

**Parse Output**:
- Extract: context package path (store as `contextPath`)
- Pattern: `.workflow/active/[testSessionId]/.process/[test-]context-package.json`

**Validation**:
- Context package file exists and is valid JSON
- Contains coverage analysis (session mode) or codebase analysis (prompt mode)
- Test framework detected

**TodoWrite Update (tasks attached)**:
```json
[
  {"content": "Phase 1: Test Generation", "status": "in_progress"},
  {"content": "  → Create test session", "status": "completed"},
  {"content": "  → Gather test context", "status": "in_progress"},
  {"content": "    → Load source/codebase context", "status": "in_progress"},
  {"content": "    → Analyze test coverage", "status": "pending"},
  {"content": "    → Generate context package", "status": "pending"},
  {"content": "  → Test analysis (Gemini)", "status": "pending"},
  {"content": "  → Generate test tasks", "status": "pending"},
  {"content": "Phase 2: Test Cycle Execution", "status": "pending"}
]
```

**TodoWrite Update (tasks collapsed)**:
```json
[
  {"content": "Phase 1: Test Generation", "status": "in_progress"},
  {"content": "  → Create test session", "status": "completed"},
  {"content": "  → Gather test context", "status": "completed"},
  {"content": "  → Test analysis (Gemini)", "status": "pending"},
  {"content": "  → Generate test tasks", "status": "pending"},
  {"content": "Phase 2: Test Cycle Execution", "status": "pending"}
]
```

## Output

- **Variable**: `contextPath` (context-package.json path)

## Next Phase

Continue to [Phase 3: Test Concept Enhanced](03-test-concept-enhanced.md).
