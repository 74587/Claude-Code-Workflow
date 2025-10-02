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

## 5-Phase Execution

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

### Phase 3: TDD Analysis
**Command**: `/workflow:tools:concept-enhanced --session [sessionId] --context [contextPath]`

**Parse**: Verify ANALYSIS_RESULTS.md

### Phase 4: TDD Task Generation
**Command**:
- Manual: `/workflow:tools:task-generate-tdd --session [sessionId]`
- Agent: `/workflow:tools:task-generate-tdd --session [sessionId] --agent`

**Parse**: Extract feature count, chain count, task count

**Validate**:
- TDD_PLAN.md exists
- IMPL_PLAN.md exists
- TEST-*.json, IMPL-*.json, REFACTOR-*.json exist
- TODO_LIST.md exists

### Phase 5: TDD Structure Validation
**Internal validation (no command)**

**Validate**:
1. Each feature has TEST → IMPL → REFACTOR chain
2. Dependencies: IMPL depends_on TEST, REFACTOR depends_on IMPL
3. Meta fields: tdd_phase correct ("red"/"green"/"refactor")
4. Agents: TEST uses @code-review-test-agent, IMPL/REFACTOR use @code-developer

**Return Summary**:
```
TDD Planning complete for session: [sessionId]

Features analyzed: [N]
TDD chains generated: [N]
Total tasks: [3N]

Structure:
- Feature 1: TEST-1.1 → IMPL-1.1 → REFACTOR-1.1
[...]

Plans:
- TDD Structure: .workflow/[sessionId]/TDD_PLAN.md
- Implementation: .workflow/[sessionId]/IMPL_PLAN.md

Next: /workflow:execute or /workflow:tdd-verify
```

## TodoWrite Pattern

```javascript
// Initialize
[
  {content: "Execute session discovery", status: "in_progress", activeForm: "..."},
  {content: "Execute context gathering", status: "pending", activeForm: "..."},
  {content: "Execute TDD analysis", status: "pending", activeForm: "..."},
  {content: "Execute TDD task generation", status: "pending", activeForm: "..."},
  {content: "Validate TDD structure", status: "pending", activeForm: "..."}
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
