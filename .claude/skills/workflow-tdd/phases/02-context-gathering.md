# Phase 2: Context Gathering

Gather project context and analyze codebase for TDD planning.

## Objective

- Gather project context via context-search agents
- Generate context-package.json with codebase analysis
- Extract conflictRisk to determine Phase 4 execution

## Execution

### Step 2.1: Execute Context Gathering

```javascript
Skill(skill="workflow:tools:context-gather", args="--session [sessionId] \"TDD: [structured-description]\"")
```

**Use Same Structured Description**: Pass the same structured format from Phase 1.

**Input**: `sessionId` from Phase 1

### Step 2.2: Parse Output

- Extract: context-package.json path (store as `contextPath`)
- Typical pattern: `.workflow/active/[sessionId]/.process/context-package.json`

**Validation**:
- Context package path extracted
- File exists and is valid JSON

### Step 2.3: Extract conflictRisk

```javascript
const contextPackage = Read(contextPath)
const conflictRisk = contextPackage.conflict_risk // "none" | "low" | "medium" | "high"
```

**Note**: conflictRisk determines whether Phase 4 (Conflict Resolution) will execute.

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

**After Phase 2**: Return to user showing Phase 2 results, then auto-continue to Phase 3

## Output

- **Variable**: `contextPath` (path to context-package.json)
- **Variable**: `conflictRisk` ("none" | "low" | "medium" | "high")
- **TodoWrite**: Mark Phase 2 completed, Phase 3 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 3: Test Coverage Analysis](03-test-coverage-analysis.md).
