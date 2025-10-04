---
name: tdd-plan
description: Orchestrate TDD workflow planning with Red-Green-Refactor task chains
usage: /workflow:tdd-plan [--agent] <input>
argument-hint: "[--agent] \"feature description\"|file.md|ISS-001"
examples:
  - /workflow:tdd-plan "Implement user authentication"
  - /workflow:tdd-plan --agent requirements.md
  - /workflow:tdd-plan ISS-001
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
4. **Sequential Execution**: Each phase depends on previous output
5. **Complete All Phases**: Do not return until Phase 5 completes
6. **TDD Context**: All descriptions include "TDD:" prefix

## 6-Phase Execution

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

### Phase 2: Context Gathering
**Command**: `/workflow:tools:context-gather --session [sessionId] "TDD: [structured-description]"`

**Parse**: Extract contextPath

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

### Phase 4: TDD Analysis
**Command**: `/workflow:tools:concept-enhanced --session [sessionId] --context [contextPath]`

**Note**: Generates ANALYSIS_RESULTS.md with TDD-specific structure:
- Feature list with testable requirements
- Test cases for Red phase
- Implementation requirements for Green phase
- Refactoring opportunities
- Task dependencies and execution order

**Parse**: Verify ANALYSIS_RESULTS.md contains TDD breakdown sections

### Phase 5: TDD Task Generation
**Command**:
- Manual: `/workflow:tools:task-generate-tdd --session [sessionId]`
- Agent: `/workflow:tools:task-generate-tdd --session [sessionId] --agent`

**Parse**: Extract feature count, chain count, task count

**Validate**:
- IMPL_PLAN.md exists (unified plan with TDD Task Chains section)
- TEST-*.json, IMPL-*.json, REFACTOR-*.json exist
- TODO_LIST.md exists
- IMPL tasks include test-fix-cycle configuration
- IMPL_PLAN.md contains workflow_type: "tdd" in frontmatter

### Phase 6: TDD Structure Validation
**Internal validation (no command)**

**Validate**:
1. Each feature has TEST → IMPL → REFACTOR chain
2. Dependencies: IMPL depends_on TEST, REFACTOR depends_on IMPL
3. Meta fields: tdd_phase correct ("red"/"green"/"refactor")
4. Agents: TEST uses @code-review-test-agent, IMPL/REFACTOR use @code-developer
5. IMPL tasks contain test-fix-cycle in flow_control for iterative Green phase

**Return Summary**:
```
TDD Planning complete for session: [sessionId]

Features analyzed: [N]
TDD chains generated: [N]
Total tasks: [3N]

Structure:
- Feature 1: TEST-1.1 → IMPL-1.1 → REFACTOR-1.1
[...]

Plan:
- Unified Implementation Plan: .workflow/[sessionId]/IMPL_PLAN.md
  (includes TDD Task Chains section)

Next: /workflow:execute or /workflow:tdd-verify
```

## TodoWrite Pattern

```javascript
// Initialize (6 phases now)
[
  {content: "Execute session discovery", status: "in_progress", activeForm: "Executing session discovery"},
  {content: "Execute context gathering", status: "pending", activeForm: "Executing context gathering"},
  {content: "Execute test coverage analysis", status: "pending", activeForm: "Executing test coverage analysis"},
  {content: "Execute TDD analysis", status: "pending", activeForm: "Executing TDD analysis"},
  {content: "Execute TDD task generation", status: "pending", activeForm: "Executing TDD task generation"},
  {content: "Validate TDD structure", status: "pending", activeForm: "Validating TDD structure"}
]

// Update after each phase: mark current "completed", next "in_progress"
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

## Related Commands
- `/workflow:plan` - Standard (non-TDD) planning
- `/workflow:execute` - Execute TDD tasks
- `/workflow:tdd-verify` - Verify TDD compliance
- `/workflow:status` - View progress
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
3. IF tests pass → Complete task ✅
4. IF tests fail → Enter fix cycle:
   a. Gemini diagnoses with bug-fix template
   b. Apply fix (manual or Codex)
   c. Retest
   d. Repeat (max 3 iterations)
5. IF max iterations → Auto-revert changes 🔄
```

**Benefits**:
- ✅ Faster feedback within Green phase
- ✅ Autonomous recovery from implementation errors
- ✅ Systematic debugging with Gemini
- ✅ Safe rollback prevents broken state

#### 3. Agent-Driven Planning
**From plan --agent workflow**

Supports action-planning-agent for more autonomous TDD planning with:
- MCP tool integration (code-index, exa)
- Memory-first principles
- Brainstorming artifact integration
- Task merging over decomposition

### Workflow Comparison

| Aspect | Previous | Current |
|--------|----------|---------|
| **Phases** | 5 | 6 (test coverage analysis) |
| **Context** | Greenfield assumption | Existing codebase aware |
| **Green Phase** | Single implementation | Iterative with fix cycle |
| **Failure Handling** | Manual intervention | Auto-diagnose + fix + revert |
| **Test Analysis** | None | Deep coverage analysis |
| **Feedback Loop** | Post-execution | During Green phase |

### Migration Notes

**Backward Compatibility**: ✅ Fully compatible
- Existing TDD workflows continue to work
- New features are additive, not breaking
- Phase 3 can be skipped if test-context-gather not available

**Session Structure**:
```
.workflow/WFS-xxx/
├── IMPL_PLAN.md (unified plan with TDD Task Chains section)
├── TODO_LIST.md
├── .process/
│   ├── context-package.json
│   ├── test-context-package.json
│   ├── ANALYSIS_RESULTS.md (enhanced with TDD breakdown)
│   └── green-fix-iteration-*.md (fix logs)
└── .task/
    ├── TEST-*.json (Red phase)
    ├── IMPL-*.json (Green phase with test-fix-cycle)
    └── REFACTOR-*.json (Refactor phase)
```

**Configuration Options** (in IMPL tasks):
- `meta.max_iterations`: Fix attempts (default: 3)
- `meta.use_codex`: Auto-fix mode (default: false)

