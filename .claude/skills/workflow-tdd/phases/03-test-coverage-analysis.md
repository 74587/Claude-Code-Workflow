# Phase 3: Test Coverage Analysis

Analyze existing test coverage, detect test framework, and identify coverage gaps.

## Objective

- Analyze existing codebase for test patterns and conventions
- Detect current test coverage and framework
- Identify related components and integration points
- Generate test-context-package.json

## Execution

### Step 3.1: Execute Test Context Gathering

```javascript
Skill(skill="workflow:tools:test-context-gather", args="--session [sessionId]")
```

**Purpose**: Analyze existing codebase for:
- Existing test patterns and conventions
- Current test coverage
- Related components and integration points
- Test framework detection

### Step 3.2: Parse Output

- Extract: testContextPath (`.workflow/active/[sessionId]/.process/test-context-package.json`)

**Validation**:
- test-context-package.json exists and is valid JSON
- Contains framework detection results

### TodoWrite Update (Phase 3 Skill executed - tasks attached)

```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Phase 2: Context Gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Phase 3: Test Coverage Analysis", "status": "in_progress", "activeForm": "Executing test coverage analysis"},
  {"content": "  → Detect test framework and conventions", "status": "in_progress", "activeForm": "Detecting test framework"},
  {"content": "  → Analyze existing test coverage", "status": "pending", "activeForm": "Analyzing test coverage"},
  {"content": "  → Identify coverage gaps", "status": "pending", "activeForm": "Identifying coverage gaps"},
  {"content": "Phase 5: TDD Task Generation", "status": "pending", "activeForm": "Executing TDD task generation"},
  {"content": "Phase 6: TDD Structure Validation", "status": "pending", "activeForm": "Validating TDD structure"}
]
```

**Note**: Skill execute **attaches** test-context-gather's 3 tasks. Orchestrator **executes** these tasks.

**Next Action**: Tasks attached → **Execute Phase 3.1-3.3** sequentially

### TodoWrite Update (Phase 3 completed - tasks collapsed)

```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Phase 2: Context Gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Phase 3: Test Coverage Analysis", "status": "completed", "activeForm": "Executing test coverage analysis"},
  {"content": "Phase 5: TDD Task Generation", "status": "pending", "activeForm": "Executing TDD task generation"},
  {"content": "Phase 6: TDD Structure Validation", "status": "pending", "activeForm": "Validating TDD structure"}
]
```

**Note**: Phase 3 tasks completed and collapsed to summary.

**After Phase 3**: Return to user showing test coverage results, then auto-continue to Phase 4/5 (depending on conflict_risk)

## Output

- **Variable**: `testContextPath` (path to test-context-package.json)
- **TodoWrite**: Mark Phase 3 completed

## Next Phase

Based on `conflictRisk` from Phase 2:
- If conflictRisk ≥ medium → [Phase 4: Conflict Resolution](04-conflict-resolution.md)
- If conflictRisk < medium → Skip to [Phase 5: TDD Task Generation](05-tdd-task-generation.md)
