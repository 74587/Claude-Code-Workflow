---
name: test-fix-gen
description: Create test-fix workflow session with progressive test layers (L0-L3), AI code validation, and test task generation
argument-hint: "(source-session-id | \"feature description\" | /path/to/file.md)"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
group: workflow
---

# Workflow Test-Fix Generation Command (/workflow:test-fix-gen)

## Coordinator Role

**This command is a pure orchestrator**: Execute 5 slash commands in sequence, parse their outputs, pass context between them, and ensure complete execution through **automatic continuation**.

**Execution Model - Auto-Continue Workflow**:

This workflow runs **fully autonomously** once triggered. Phase 3 (test analysis) and Phase 4 (task generation) are delegated to specialized agents.

1. **User triggers**: `/workflow:test-fix-gen "task"` or `/workflow:test-fix-gen WFS-source-session`
2. **Phase 1 executes** → Test session created → Auto-continues
3. **Phase 2 executes** → Context gathering → Auto-continues
4. **Phase 3 executes** → Test generation analysis (Gemini) → Auto-continues
5. **Phase 4 executes** → Task generation (test-task-generate) → Reports final summary

**Task Attachment Model**:
- SlashCommand execute **expands workflow** by attaching sub-tasks to current TodoWrite
- When a sub-command is executed, its internal tasks are attached to the orchestrator's TodoWrite
- Orchestrator **executes these attached tasks** sequentially
- After completion, attached tasks are **collapsed** back to high-level phase summary
- This is **task expansion**, not external delegation

**Auto-Continue Mechanism**:
- TodoList tracks current phase status and dynamically manages task attachment/collapse
- When each phase finishes executing, automatically execute next pending phase
- All phases run autonomously without user interaction
- **⚠️ CONTINUOUS EXECUTION** - Do not stop until all phases complete

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 command execution
2. **No Preliminary Analysis**: Do not read files, analyze structure, or gather context before Phase 1
3. **Parse Every Output**: Extract required data from each command output for next phase
4. **Auto-Continue via TodoList**: Check TodoList status to execute next pending phase automatically
5. **Track Progress**: Update TodoWrite dynamically with task attachment/collapse pattern
6. **Task Attachment Model**: SlashCommand execute **attaches** sub-tasks to current workflow. Orchestrator **executes** these attached tasks itself, then **collapses** them after completion
7. **⚠️ CRITICAL: DO NOT STOP**: Continuous multi-phase workflow. After executing all attached tasks, immediately collapse them and execute next phase

---

## Test Strategy Overview

This workflow generates tests using **Progressive Test Layers (L0-L3)**:

| Layer | Name | Focus |
|-------|------|-------|
| **L0** | Static Analysis | Compilation, imports, types, AI code issues |
| **L1** | Unit Tests | Function/class behavior (happy/negative/edge cases) |
| **L2** | Integration Tests | Component interactions, API contracts, failure modes |
| **L3** | E2E Tests | User journeys, critical paths (optional) |

**Key Features**:
- **AI Code Issue Detection** - Validates against common AI-generated code problems (hallucinated imports, placeholder code, mock leakage, etc.)
- **Project Type Detection** - Applies appropriate test templates (React, Node API, CLI, Library, etc.)
- **Quality Gates** - IMPL-001.3 (code validation) and IMPL-001.5 (test quality) ensure high standards

**Detailed specifications**: See `/workflow:tools:test-task-generate` for complete L0-L3 requirements and quality thresholds.

---

## Execution Process

```
Input Parsing:
   ├─ Detect input type: Session ID (WFS-*) | Description | File path
   └─ Set MODE: session | prompt

Phase 1: Create Test Session
   └─ /workflow:session:start --type test --new "structured-description"
      └─ Output: testSessionId (WFS-test-xxx)

Phase 2: Gather Test Context
   ├─ MODE=session → /workflow:tools:test-context-gather --session testSessionId
   └─ MODE=prompt  → /workflow:tools:context-gather --session testSessionId "description"
      └─ Output: contextPath (context-package.json)

Phase 3: Test Generation Analysis
   └─ /workflow:tools:test-concept-enhanced --session testSessionId --context contextPath
      └─ Output: TEST_ANALYSIS_RESULTS.md (L0-L3 requirements)

Phase 4: Generate Test Tasks
   └─ /workflow:tools:test-task-generate --session testSessionId
      └─ Output: IMPL_PLAN.md, IMPL-*.json (4+ tasks), TODO_LIST.md

Phase 5: Return Summary
   └─ Summary with next steps → /workflow:test-cycle-execute
```

---

## 5-Phase Execution

### Phase 1: Create Test Session

**Step 1.0: Detect Input Mode**

```javascript
// Automatic mode detection based on input pattern
if (input.startsWith("WFS-")) {
  MODE = "session"
  // Load source session to preserve original task description
  Read(".workflow/active/[sourceSessionId]/workflow-session.json")
} else {
  MODE = "prompt"
}
```

**Step 1.1: Execute** - Create test workflow session

```javascript
// Session Mode - preserve original task description
SlashCommand(command="/workflow:session:start --type test --new \"Test validation for [sourceSessionId]: [originalTaskDescription]\"")

// Prompt Mode - use user's description directly
SlashCommand(command="/workflow:session:start --type test --new \"Test generation for: [description]\"")
```

**Parse Output**:
- Extract: `SESSION_ID: WFS-test-[slug]` (store as `testSessionId`)

**Validation**:
- Session Mode: Source session `.workflow/active/[sourceSessionId]/` exists with completed IMPL tasks
- Both Modes: New test session directory created with metadata

**TodoWrite**: Mark phase 1 completed, phase 2 in_progress

---

### Phase 2: Gather Test Context

**Step 2.1: Execute** - Gather context based on mode

```javascript
// Session Mode - gather from source session
SlashCommand(command="/workflow:tools:test-context-gather --session [testSessionId]")

// Prompt Mode - gather from codebase
SlashCommand(command="/workflow:tools:context-gather --session [testSessionId] \"[task_description]\"")
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
  {"content": "Phase 1: Create Test Session", "status": "completed"},
  {"content": "Phase 2: Gather Test Context", "status": "in_progress"},
  {"content": "  → Load source/codebase context", "status": "in_progress"},
  {"content": "  → Analyze test coverage", "status": "pending"},
  {"content": "  → Generate context package", "status": "pending"},
  {"content": "Phase 3: Test Generation Analysis", "status": "pending"},
  {"content": "Phase 4: Generate Test Tasks", "status": "pending"},
  {"content": "Phase 5: Return Summary", "status": "pending"}
]
```

**TodoWrite Update (tasks collapsed)**:
```json
[
  {"content": "Phase 1: Create Test Session", "status": "completed"},
  {"content": "Phase 2: Gather Test Context", "status": "completed"},
  {"content": "Phase 3: Test Generation Analysis", "status": "pending"},
  {"content": "Phase 4: Generate Test Tasks", "status": "pending"},
  {"content": "Phase 5: Return Summary", "status": "pending"}
]
```

---

### Phase 3: Test Generation Analysis

**Step 3.1: Execute** - Analyze test requirements with Gemini

```javascript
SlashCommand(command="/workflow:tools:test-concept-enhanced --session [testSessionId] --context [contextPath]")
```

**Input**:
- `testSessionId` from Phase 1
- `contextPath` from Phase 2

**Expected Behavior**:
- Use Gemini to analyze coverage gaps
- Detect project type and apply appropriate test templates
- Generate **multi-layered test requirements** (L0-L3)
- Scan for AI code issues
- Generate `TEST_ANALYSIS_RESULTS.md`

**Output**: `.workflow/[testSessionId]/.process/TEST_ANALYSIS_RESULTS.md`

**Validation** - TEST_ANALYSIS_RESULTS.md must include:
- Project Type Detection (with confidence)
- Coverage Assessment (current vs target)
- Test Framework & Conventions
- Multi-Layered Test Plan (L0-L3)
- AI Issue Scan Results
- Test Requirements by File (with layer annotations)
- Quality Assurance Criteria
- Success Criteria

**Note**: Detailed specifications for project types, L0-L3 layers, and AI issue detection are defined in `/workflow:tools:test-concept-enhanced`.

---

### Phase 4: Generate Test Tasks

**Step 4.1: Execute** - Generate test planning documents

```javascript
SlashCommand(command="/workflow:tools:test-task-generate --session [testSessionId]")
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

**TodoWrite Update (agent task attached)**:
```json
[
  {"content": "Phase 1: Create Test Session", "status": "completed"},
  {"content": "Phase 2: Gather Test Context", "status": "completed"},
  {"content": "Phase 3: Test Generation Analysis", "status": "completed"},
  {"content": "Phase 4: Generate Test Tasks", "status": "in_progress"},
  {"content": "Phase 5: Return Summary", "status": "pending"}
]
```

---

### Phase 5: Return Summary

**Return to User**:
```
Test-fix workflow created successfully!

Input: [original input]
Mode: [Session|Prompt]
Test Session: [testSessionId]

Tasks Created:
- IMPL-001: Test Understanding & Generation (@code-developer)
- IMPL-001.3: Code Validation Gate - AI Error Detection (@test-fix-agent)
- IMPL-001.5: Test Quality Gate - Static Analysis & Coverage (@test-fix-agent)
- IMPL-002: Test Execution & Fix Cycle (@test-fix-agent)

Quality Thresholds:
- Code Validation: Zero CRITICAL issues, zero compilation errors
- Minimum Coverage: 80% line, 70% branch
- Static Analysis: Zero critical anti-patterns
- Max Fix Iterations: 5

Review artifacts:
- Test plan: .workflow/[testSessionId]/IMPL_PLAN.md
- Task list: .workflow/[testSessionId]/TODO_LIST.md
- Analysis: .workflow/[testSessionId]/.process/TEST_ANALYSIS_RESULTS.md

CRITICAL - Next Step:
  /workflow:test-cycle-execute --session [testSessionId]
```

---

## Data Flow

```
User Input (session ID | description | file path)
    ↓
[Detect Mode: session | prompt]
    ↓
Phase 1: session:start --type test --new "description"
    ↓ Output: testSessionId
    ↓
Phase 2: test-context-gather | context-gather
    ↓ Input: testSessionId
    ↓ Output: contextPath (context-package.json)
    ↓
Phase 3: test-concept-enhanced
    ↓ Input: testSessionId + contextPath
    ↓ Output: TEST_ANALYSIS_RESULTS.md (L0-L3 requirements + AI issues)
    ↓
Phase 4: test-task-generate
    ↓ Input: testSessionId + TEST_ANALYSIS_RESULTS.md
    ↓ Output: IMPL_PLAN.md, IMPL-*.json (4+), TODO_LIST.md
    ↓
Phase 5: Return summary to user
    ↓
Next: /workflow:test-cycle-execute
```

---

## Execution Flow Diagram

```
User triggers: /workflow:test-fix-gen "Test user authentication"
  ↓
[Input Detection] → MODE: prompt
  ↓
[TodoWrite Init] 5 orchestrator-level tasks
  ↓
Phase 1: Create Test Session
  → /workflow:session:start --type test
  → testSessionId extracted (WFS-test-user-auth)
  ↓
Phase 2: Gather Test Context (SlashCommand executed)
  → ATTACH 3 sub-tasks: ← ATTACHED
    - → Load codebase context
    - → Analyze test coverage
    - → Generate context package
  → Execute sub-tasks sequentially
  → COLLAPSE tasks ← COLLAPSED
  → contextPath extracted
  ↓
Phase 3: Test Generation Analysis (SlashCommand executed)
  → ATTACH 3 sub-tasks: ← ATTACHED
    - → Analyze coverage gaps with Gemini
    - → Detect AI code issues (L0.5)
    - → Generate L0-L3 test requirements
  → Execute sub-tasks sequentially
  → COLLAPSE tasks ← COLLAPSED
  → TEST_ANALYSIS_RESULTS.md created
  ↓
Phase 4: Generate Test Tasks (SlashCommand executed)
  → Single agent task (test-task-generate → action-planning-agent)
  → Agent autonomously generates:
    - IMPL-001.json (test generation)
    - IMPL-001.3-validation.json (code validation)
    - IMPL-001.5-review.json (test quality)
    - IMPL-002.json (test execution)
    - IMPL_PLAN.md
    - TODO_LIST.md
  ↓
Phase 5: Return Summary
  → Display summary with next steps
  → Command ends

Task Pipeline (for execution):
┌──────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐
│  IMPL-001    │───→│  IMPL-001.3     │───→│  IMPL-001.5     │───→│  IMPL-002    │
│  Test Gen    │    │  Code Validate  │    │  Quality Gate   │    │  Test & Fix  │
│  L1-L3       │    │  L0 + AI Issues │    │  Coverage 80%+  │    │  Max 5 iter  │
│@code-developer│   │ @test-fix-agent │    │ @test-fix-agent │    │@test-fix-agent│
└──────────────┘    └─────────────────┘    └─────────────────┘    └──────────────┘
```

---

## Output Artifacts

### Directory Structure

```
.workflow/active/WFS-test-[session]/
├── workflow-session.json              # Session metadata
├── IMPL_PLAN.md                       # Test generation and execution strategy
├── TODO_LIST.md                       # Task checklist
├── .task/
│   ├── IMPL-001.json                  # Test understanding & generation
│   ├── IMPL-001.3-validation.json     # Code validation gate
│   ├── IMPL-001.5-review.json         # Test quality gate
│   ├── IMPL-002.json                  # Test execution & fix cycle
│   └── IMPL-*.json                    # Additional tasks (if applicable)
└── .process/
    ├── [test-]context-package.json    # Context and coverage analysis
    └── TEST_ANALYSIS_RESULTS.md       # Test requirements and strategy (L0-L3)
```

### Session Metadata

**File**: `workflow-session.json`

| Mode | Fields |
|------|--------|
| **Session** | `type: "test"`, `source_session_id: "[sourceId]"` |
| **Prompt** | `type: "test"` (no source_session_id) |

---

## Error Handling

| Phase | Error Condition | Action |
|-------|----------------|--------|
| 1 | Source session not found (session mode) | Return error with session ID |
| 1 | No completed IMPL tasks (session mode) | Return error, source incomplete |
| 2 | Context gathering failed | Return error, check source artifacts |
| 3 | Gemini analysis failed | Return error, check context package |
| 4 | Task generation failed | Retry once, then return error |

---

## Coordinator Checklist

- Detect input type (session ID / description / file path)
- Initialize TodoWrite before any command
- Execute Phase 1 immediately with structured description
- Parse test session ID from Phase 1 output, store in memory
- Execute Phase 2 with appropriate context-gather command based on mode
- Parse context path from Phase 2 output, store in memory
- Execute Phase 3 test-concept-enhanced with session and context
- Verify TEST_ANALYSIS_RESULTS.md created with L0-L3 requirements
- Execute Phase 4 test-task-generate with session ID
- Verify all Phase 4 outputs (4 task JSONs, IMPL_PLAN.md, TODO_LIST.md)
- Return summary with next step: `/workflow:test-cycle-execute`
- Update TodoWrite after each phase

---

## Usage Examples

```bash
# Session Mode - test validation for completed implementation
/workflow:test-fix-gen WFS-user-auth-v2

# Prompt Mode - text description
/workflow:test-fix-gen "Test the user authentication API endpoints in src/auth/api.ts"

# Prompt Mode - file reference
/workflow:test-fix-gen ./docs/api-requirements.md

# With CLI tool preference (semantic detection)
/workflow:test-fix-gen "Test user registration, use Codex for automated fixes"
```

---

## Related Commands

**Prerequisite Commands**:
- `/workflow:plan` or `/workflow:execute` - Complete implementation (Session Mode)
- None for Prompt Mode

**Called by This Command** (5 phases):
- `/workflow:session:start` - Phase 1: Create test workflow session
- `/workflow:tools:test-context-gather` - Phase 2 (Session Mode): Analyze test coverage
- `/workflow:tools:context-gather` - Phase 2 (Prompt Mode): Analyze codebase
- `/workflow:tools:test-concept-enhanced` - Phase 3: Generate test requirements with Gemini
- `/workflow:tools:test-task-generate` - Phase 4: Generate test task JSONs via action-planning-agent

**Follow-up Commands**:
- `/workflow:status` - Review generated tasks
- `/workflow:test-cycle-execute` - Execute test workflow (REQUIRED next step)
- `/workflow:execute` - Alternative: Standard task execution
