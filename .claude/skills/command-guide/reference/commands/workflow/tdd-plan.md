---
name: tdd-plan
description: TDD workflow planning with Red-Green-Refactor task chain generation, test-first development structure, and cycle tracking
argument-hint: "[--agent] \"feature description\"|file.md"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
---

# TDD Workflow Plan Command (/workflow:tdd-plan)

## Coordinator Role

**This command is a pure orchestrator**: Execute 5 slash commands in sequence, parse outputs, pass context, and ensure complete TDD workflow creation.

**Execution Modes**:
- **Manual Mode** (default): Use `/workflow:tools:task-generate-tdd`
- **Agent Mode** (`--agent`): Use `/workflow:tools:task-generate-tdd --agent`

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 execution
2. **No Preliminary Analysis**: Do not read files before Phase 1
3. **Parse Every Output**: Extract required data for next phase
4. **Auto-Continue via TodoList**: Check TodoList status to execute next pending phase automatically
5. **Track Progress**: Update TodoWrite after every phase completion
6. **TDD Context**: All descriptions include "TDD:" prefix
7. **Quality Gate**: Phase 4 conflict resolution (optional, auto-triggered) validates compatibility before task generation

## 6-Phase Execution (with Conflict Resolution)

### Phase 1: Session Discovery
**Command**: `/workflow:session:start --auto "TDD: [structured-description]"`

**TDD Structured Format**:
```
TDD: [Feature Name]
GOAL: [Objective]
SCOPE: [Included/excluded]
CONTEXT: [Background]
TEST_FOCUS: [Test scenarios]
```

**Parse**: Extract sessionId

**TodoWrite**: Mark phase 1 completed, phase 2 in_progress

**After Phase 1**: Return to user showing Phase 1 results, then auto-continue to Phase 2

---

### Phase 2: Context Gathering
**Command**: `/workflow:tools:context-gather --session [sessionId] "TDD: [structured-description]"`

**Use Same Structured Description**: Pass the same structured format from Phase 1

**Input**: `sessionId` from Phase 1

**Parse Output**:
- Extract: context-package.json path (store as `contextPath`)
- Typical pattern: `.workflow/[sessionId]/.process/context-package.json`

**Validation**:
- Context package path extracted
- File exists and is valid JSON

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

**After Phase 2**: Return to user showing Phase 2 results, then auto-continue to Phase 3

---

### Phase 3: Test Coverage Analysis
**Command**: `/workflow:tools:test-context-gather --session [sessionId]`

**Purpose**: Analyze existing codebase for:
- Existing test patterns and conventions
- Current test coverage
- Related components and integration points
- Test framework detection

**Parse**: Extract testContextPath (`.workflow/[sessionId]/.process/test-context-package.json`)

**Benefits**:
- Makes TDD aware of existing environment
- Identifies reusable test patterns
- Prevents duplicate test creation
- Enables integration with existing tests

**TodoWrite**: Mark phase 3 completed, phase 4 in_progress

**After Phase 3**: Return to user showing test coverage results, then auto-continue to Phase 4

---

### Phase 4: Conflict Resolution (Optional - auto-triggered by conflict risk)

**Trigger**: Only execute when context-package.json indicates conflict_risk is "medium" or "high"

**Command**: `SlashCommand(command="/workflow:tools:conflict-resolution --session [sessionId] --context [contextPath]")`

**Input**:
- sessionId from Phase 1
- contextPath from Phase 2
- conflict_risk from context-package.json

**Parse Output**:
- Extract: Execution status (success/skipped/failed)
- Verify: CONFLICT_RESOLUTION.md file path (if executed)

**Validation**:
- File `.workflow/[sessionId]/.process/CONFLICT_RESOLUTION.md` exists (if executed)

**Skip Behavior**:
- If conflict_risk is "none" or "low", skip directly to Phase 5
- Display: "No significant conflicts detected, proceeding to TDD task generation"

**TodoWrite**: Mark phase 4 completed (if executed) or skipped, phase 5 in_progress

**After Phase 4**: Return to user showing conflict resolution results (if executed) and selected strategies, then auto-continue to Phase 5

**Memory State Check**:
- Evaluate current context window usage and memory state
- If memory usage is high (>110K tokens or approaching context limits):
  - **Command**: `SlashCommand(command="/compact")`
  - This optimizes memory before proceeding to Phase 5
- Memory compaction is particularly important after analysis phase which may generate extensive documentation
- Ensures optimal performance and prevents context overflow

---

### Phase 5: TDD Task Generation
**Command**:
- Manual: `/workflow:tools:task-generate-tdd --session [sessionId]`
- Agent: `/workflow:tools:task-generate-tdd --session [sessionId] --agent`

**Parse**: Extract feature count, task count (not chain count - tasks now contain internal TDD cycles)

**Validate**:
- IMPL_PLAN.md exists (unified plan with TDD Implementation Tasks section)
- IMPL-*.json files exist (one per feature, or container + subtasks for complex features)
- TODO_LIST.md exists with internal TDD phase indicators
- Each IMPL task includes:
  - `meta.tdd_workflow: true`
  - `flow_control.implementation_approach` with 3 steps (red/green/refactor)
  - Green phase includes test-fix-cycle configuration
- IMPL_PLAN.md contains workflow_type: "tdd" in frontmatter
- Task count ≤10 (compliance with task limit)

### Phase 6: TDD Structure Validation & Action Plan Verification (RECOMMENDED)
**Internal validation first, then recommend external verification**

**Internal Validation**:
1. Each task contains complete TDD workflow (Red-Green-Refactor internally)
2. Task structure validation:
   - `meta.tdd_workflow: true` in all IMPL tasks
   - `flow_control.implementation_approach` has exactly 3 steps
   - Each step has correct `tdd_phase`: "red", "green", "refactor"
3. Dependency validation:
   - Sequential features: IMPL-N depends_on ["IMPL-(N-1)"] if needed
   - Complex features: IMPL-N.M depends_on ["IMPL-N.(M-1)"] for subtasks
4. Agent assignment: All IMPL tasks use @code-developer
5. Test-fix cycle: Green phase step includes test-fix-cycle logic with max_iterations
6. Task count: Total tasks ≤10 (simple + subtasks)

**Return Summary**:
```
TDD Planning complete for session: [sessionId]

Features analyzed: [N]
Total tasks: [M] (1 task per simple feature + subtasks for complex features)

Task breakdown:
- Simple features: [K] tasks (IMPL-1 to IMPL-K)
- Complex features: [L] features with [P] subtasks
- Total task count: [M] (within 10-task limit)

Structure:
- IMPL-1: {Feature 1 Name} (Internal: Red → Green → Refactor)
- IMPL-2: {Feature 2 Name} (Internal: Red → Green → Refactor)
- IMPL-3: {Complex Feature} (Container)
  - IMPL-3.1: {Sub-feature A} (Internal: Red → Green → Refactor)
  - IMPL-3.2: {Sub-feature B} (Internal: Red → Green → Refactor)
[...]

Plans generated:
- Unified Implementation Plan: .workflow/[sessionId]/IMPL_PLAN.md
  (includes TDD Implementation Tasks section with workflow_type: "tdd")
- Task List: .workflow/[sessionId]/TODO_LIST.md
  (with internal TDD phase indicators)

TDD Configuration:
- Each task contains complete Red-Green-Refactor cycle
- Green phase includes test-fix cycle (max 3 iterations)
- Auto-revert on max iterations reached

Recommended Next Steps:
1. /workflow:action-plan-verify --session [sessionId]  # Verify TDD plan quality and dependencies
2. /workflow:execute --session [sessionId]  # Start TDD execution
3. /workflow:tdd-verify [sessionId]  # Post-execution TDD compliance check

Quality Gate: Consider running /workflow:action-plan-verify to validate TDD task structure and dependencies
```

## TodoWrite Pattern

```javascript
// Initialize (Phase 4 added dynamically after Phase 3 if conflict_risk ≥ medium)
TodoWrite({todos: [
  {"content": "Execute session discovery", "status": "in_progress", "activeForm": "Executing session discovery"},
  {"content": "Execute context gathering", "status": "pending", "activeForm": "Executing context gathering"},
  {"content": "Execute test coverage analysis", "status": "pending", "activeForm": "Executing test coverage analysis"},
  // Phase 4 todo added dynamically after Phase 3 if conflict_risk ≥ medium
  {"content": "Execute TDD task generation", "status": "pending", "activeForm": "Executing TDD task generation"},
  {"content": "Validate TDD structure", "status": "pending", "activeForm": "Validating TDD structure"}
]})

// After Phase 3 (if conflict_risk ≥ medium, insert Phase 4 todo)
TodoWrite({todos: [
  {"content": "Execute session discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Execute context gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Execute test coverage analysis", "status": "completed", "activeForm": "Executing test coverage analysis"},
  {"content": "Execute conflict resolution", "status": "in_progress", "activeForm": "Executing conflict resolution"},
  {"content": "Execute TDD task generation", "status": "pending", "activeForm": "Executing TDD task generation"},
  {"content": "Validate TDD structure", "status": "pending", "activeForm": "Validating TDD structure"}
]})

// After Phase 3 (if conflict_risk is none/low, skip Phase 4, go directly to Phase 5)
TodoWrite({todos: [
  {"content": "Execute session discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Execute context gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Execute test coverage analysis", "status": "completed", "activeForm": "Executing test coverage analysis"},
  {"content": "Execute TDD task generation", "status": "in_progress", "activeForm": "Executing TDD task generation"},
  {"content": "Validate TDD structure", "status": "pending", "activeForm": "Validating TDD structure"}
]})

// After Phase 4 (if executed), continue to Phase 5
TodoWrite({todos: [
  {"content": "Execute session discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Execute context gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Execute test coverage analysis", "status": "completed", "activeForm": "Executing test coverage analysis"},
  {"content": "Execute conflict resolution", "status": "completed", "activeForm": "Executing conflict resolution"},
  {"content": "Execute TDD task generation", "status": "in_progress", "activeForm": "Executing TDD task generation"},
  {"content": "Validate TDD structure", "status": "pending", "activeForm": "Validating TDD structure"}
]})
```

## Input Processing

Convert user input to TDD-structured format:

**Simple text** → Add TDD context
**Detailed text** → Extract components with TEST_FOCUS
**File/Issue** → Read and structure with TDD

## Error Handling

- **Parsing failure**: Retry once, then report
- **Validation failure**: Report missing/invalid data
- **Command failure**: Keep phase in_progress, report error
- **TDD validation failure**: Report incomplete chains or wrong dependencies

## TDD Workflow Enhancements

### Overview
The TDD workflow has been significantly enhanced by integrating best practices from both traditional `plan --agent` and `test-gen` workflows, creating a hybrid approach that bridges the gap between idealized TDD and real-world development complexity.

### Key Improvements

#### 1. Test Coverage Analysis (Phase 3)
**Adopted from test-gen workflow**

Before planning TDD tasks, the workflow now analyzes the existing codebase:
- Detects existing test patterns and conventions
- Identifies current test coverage
- Discovers related components and integration points
- Detects test framework automatically

**Benefits**:
- Context-aware TDD planning
- Avoids duplicate test creation
- Enables integration with existing tests
- No longer assumes greenfield scenarios

#### 2. Iterative Green Phase with Test-Fix Cycle
**Adopted from test-gen workflow**

IMPL (Green phase) tasks now include automatic test-fix cycle for resilient implementation:

**Enhanced IMPL Task Flow**:
```
1. Write minimal implementation code
2. Execute test suite
3. IF tests pass → Complete task
4. IF tests fail → Enter fix cycle:
   a. Gemini diagnoses with bug-fix template
   b. Apply fix (manual or Codex)
   c. Retest
   d. Repeat (max 3 iterations)
5. IF max iterations → Auto-revert changes 🔄
```

**Benefits**:
- Faster feedback within Green phase
- Autonomous recovery from implementation errors
- Systematic debugging with Gemini
- Safe rollback prevents broken state

#### 3. Agent-Driven Planning
**From plan --agent workflow**

Supports action-planning-agent for more autonomous TDD planning with:
- MCP tool integration (code-index, exa)
- Memory-first principles
- Brainstorming artifact integration
- Task merging over decomposition

### Workflow Comparison

| Aspect | Previous | Current (Optimized) |
|--------|----------|---------------------|
| **Phases** | 6 (with test coverage) | 7 (added concept verification) |
| **Context** | Greenfield assumption | Existing codebase aware |
| **Task Structure** | 1 feature = 3 tasks (TEST/IMPL/REFACTOR) | 1 feature = 1 task (internal TDD cycle) |
| **Task Count** | 5 features = 15 tasks | 5 features = 5 tasks (70% reduction) |
| **Green Phase** | Single implementation | Iterative with fix cycle |
| **Failure Handling** | Manual intervention | Auto-diagnose + fix + revert |
| **Test Analysis** | None | Deep coverage analysis |
| **Feedback Loop** | Post-execution | During Green phase |
| **Task Management** | High overhead (15 tasks) | Low overhead (5 tasks) |
| **Execution Efficiency** | Frequent context switching | Continuous context per feature |

### Migration Notes

**Backward Compatibility**: Fully compatible
- Existing TDD workflows continue to work
- New features are additive, not breaking
- Phase 3 can be skipped if test-context-gather not available

**Session Structure**:
```
.workflow/WFS-xxx/
├── IMPL_PLAN.md (unified plan with TDD Implementation Tasks section)
├── TODO_LIST.md (with internal TDD phase indicators)
├── .process/
│   ├── context-package.json
│   ├── test-context-package.json
│   ├── ANALYSIS_RESULTS.md (enhanced with TDD breakdown)
│   └── green-fix-iteration-*.md (fix logs from Green phase cycles)
└── .task/
    ├── IMPL-1.json (Complete TDD task: Red-Green-Refactor internally)
    ├── IMPL-2.json (Complete TDD task)
    ├── IMPL-3.json (Complex feature container, if needed)
    ├── IMPL-3.1.json (Complex feature subtask, if needed)
    └── IMPL-3.2.json (Complex feature subtask, if needed)
```

**File Count Comparison**:
- **Old structure**: 5 features = 15 task files (TEST/IMPL/REFACTOR × 5)
- **New structure**: 5 features = 5 task files (IMPL-N × 5)
- **Complex features**: Add container + subtasks only when necessary

**Configuration Options** (in IMPL tasks):
- `meta.max_iterations`: Fix attempts (default: 3)
- `meta.use_codex`: Auto-fix mode (default: false)

## Related Commands

**Prerequisite Commands**:
- None - TDD planning is self-contained (can optionally run brainstorm commands before)

**Called by This Command** (6 phases):
- `/workflow:session:start` - Phase 1: Create or discover TDD workflow session
- `/workflow:tools:context-gather` - Phase 2: Gather project context and analyze codebase
- `/workflow:tools:test-context-gather` - Phase 3: Analyze existing test patterns and coverage
- `/workflow:tools:conflict-resolution` - Phase 4: Detect and resolve conflicts (auto-triggered if conflict_risk ≥ medium)
- `/compact` - Phase 4: Memory optimization (if context approaching limits)
- `/workflow:tools:task-generate-tdd` - Phase 5: Generate TDD task chains with Red-Green-Refactor cycles
- `/workflow:tools:task-generate-tdd --agent` - Phase 5: Generate TDD tasks with agent-driven approach (when `--agent` flag used)

**Follow-up Commands**:
- `/workflow:action-plan-verify` - Recommended: Verify TDD plan quality and structure before execution
- `/workflow:status` - Review TDD task breakdown
- `/workflow:execute` - Begin TDD implementation
- `/workflow:tdd-verify` - Post-execution: Verify TDD compliance and generate quality report

