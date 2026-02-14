# Phase 4: Conflict Resolution (Conditional)

Detect and resolve conflicts when conflict risk is medium or high.

## Objective

- Execute conflict detection and resolution only when conflictRisk ≥ medium
- Generate conflict-resolution.json with resolution strategies
- Skip directly to Phase 5 if conflictRisk is none/low

## Trigger Condition

**Only execute when**: `context-package.json` indicates `conflict_risk` is "medium" or "high"

**Skip Behavior**: If conflict_risk is "none" or "low", skip directly to Phase 5. Display: "No significant conflicts detected, proceeding to TDD task generation"

## Execution

### Step 4.1: Execute Conflict Resolution

```javascript
Skill(skill="workflow:tools:conflict-resolution", args="--session [sessionId] --context [contextPath]")
```

**Input**:
- sessionId from Phase 1
- contextPath from Phase 2
- conflict_risk from context-package.json

### Step 4.2: Parse Output

- Extract: Execution status (success/skipped/failed)
- Verify: conflict-resolution.json file path (if executed)

**Validation**:
- File `.workflow/active/[sessionId]/.process/conflict-resolution.json` exists (if executed)

### TodoWrite Update (Phase 4 Skill executed - tasks attached, if conflict_risk ≥ medium)

```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Phase 2: Context Gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Phase 3: Test Coverage Analysis", "status": "completed", "activeForm": "Executing test coverage analysis"},
  {"content": "Phase 4: Conflict Resolution", "status": "in_progress", "activeForm": "Executing conflict resolution"},
  {"content": "  → Detect conflicts with CLI analysis", "status": "in_progress", "activeForm": "Detecting conflicts"},
  {"content": "  → Log and analyze detected conflicts", "status": "pending", "activeForm": "Analyzing conflicts"},
  {"content": "  → Apply resolution strategies", "status": "pending", "activeForm": "Applying resolution strategies"},
  {"content": "Phase 5: TDD Task Generation", "status": "pending", "activeForm": "Executing TDD task generation"},
  {"content": "Phase 6: TDD Structure Validation", "status": "pending", "activeForm": "Validating TDD structure"}
]
```

**Note**: Skill execute **attaches** conflict-resolution's 3 tasks. Orchestrator **executes** these tasks.

**Next Action**: Tasks attached → **Execute Phase 4.1-4.3** sequentially

### TodoWrite Update (Phase 4 completed - tasks collapsed)

```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Phase 2: Context Gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Phase 3: Test Coverage Analysis", "status": "completed", "activeForm": "Executing test coverage analysis"},
  {"content": "Phase 4: Conflict Resolution", "status": "completed", "activeForm": "Executing conflict resolution"},
  {"content": "Phase 5: TDD Task Generation", "status": "pending", "activeForm": "Executing TDD task generation"},
  {"content": "Phase 6: TDD Structure Validation", "status": "pending", "activeForm": "Validating TDD structure"}
]
```

**Note**: Phase 4 tasks completed and collapsed to summary.

**After Phase 4**: Return to user showing conflict resolution results and selected strategies, then auto-continue to Phase 5

### Memory State Check

After Phase 4, evaluate current context window usage and memory state:
- If memory usage is high (>110K tokens or approaching context limits):

  ```javascript
  Skill(skill="compact")
  ```

  - This optimizes memory before proceeding to Phase 5
- Memory compaction is particularly important after analysis phase which may generate extensive documentation
- Ensures optimal performance and prevents context overflow

## Output

- **File**: `.workflow/active/[sessionId]/.process/conflict-resolution.json` (if executed)
- **TodoWrite**: Mark Phase 4 completed, Phase 5 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 5: TDD Task Generation](05-tdd-task-generation.md).
