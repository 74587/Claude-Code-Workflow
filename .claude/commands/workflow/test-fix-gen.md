---
name: test-fix-gen
description: Create test-fix workflow session from session ID, description, or file path with test strategy generation and task planning
argument-hint: "(source-session-id | \"feature description\" | /path/to/file.md)"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
---

# Workflow Test-Fix Generation Command (/workflow:test-fix-gen)

## Quick Reference

### Command Scope

| Aspect | Description |
|--------|-------------|
| **Purpose** | Generate test-fix workflow session with task JSON files |
| **Output** | IMPL-001.json, IMPL-001.3-validation.json, IMPL-001.5-review.json, IMPL-002.json |
| **Does NOT** | Execute tests, apply fixes, handle test failures |
| **Next Step** | Must call `/workflow:test-cycle-execute` after this command |

### Task Pipeline

```
IMPL-001 (Test Generation) → IMPL-001.3 (Code Validation) → IMPL-001.5 (Test Quality) → IMPL-002 (Test Execution)
     @code-developer              @test-fix-agent              @test-fix-agent            @test-fix-agent
```

### Coordinator Role

This command is a **pure planning coordinator**:
- ONLY coordinates slash commands to generate task JSON files
- Does NOT analyze code, generate tests, execute tests, or apply fixes
- All execution delegated to `/workflow:test-cycle-execute`

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Session Isolation** | Creates independent `WFS-test-[slug]` session |
| **Context-First** | Gathers implementation context via appropriate method |
| **Format Reuse** | Creates standard `IMPL-*.json` tasks with `meta.type: "test-fix"` |
| **Semantic CLI Selection** | CLI tool usage determined from user's task description |
| **Automatic Detection** | Input pattern determines execution mode |

---

## Usage

### Command Syntax

```bash
/workflow:test-fix-gen <INPUT>

# INPUT can be:
# - Session ID: WFS-user-auth-v2
# - Description: "Test the user authentication API"
# - File path: ./docs/api-requirements.md
```

### Mode Detection

**Automatic mode detection** based on input pattern:

```bash
if [[ "$input" == WFS-* ]]; then
  MODE="session"  # Use test-context-gather
else
  MODE="prompt"   # Use context-gather
fi
```

| Mode | Input Pattern | Context Source | Use Case |
|------|--------------|----------------|----------|
| **Session** | `WFS-xxx` | Source session summaries | Test validation for completed workflow |
| **Prompt** | Text or file path | Direct codebase analysis | Ad-hoc test generation |

### Examples

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

## Execution Phases

### Execution Rules

1. **Start Immediately**: First action is TodoWrite, second is Phase 1 execution
2. **No Preliminary Analysis**: Do not read files before Phase 1
3. **Parse Every Output**: Extract required data from each phase for next phase
4. **Sequential Execution**: Each phase depends on previous phase's output
5. **Complete All Phases**: Do not return until Phase 5 completes
6. **⚠️ CONTINUOUS EXECUTION**: Do not stop between phases

### Phase 1: Create Test Session

**Execute**:
```javascript
// Session Mode - preserve original task description
Read(".workflow/active/[sourceSessionId]/workflow-session.json")
SlashCommand("/workflow:session:start --type test --new \"Test validation for [sourceSessionId]: [originalTaskDescription]\"")

// Prompt Mode - use user's description directly
SlashCommand("/workflow:session:start --type test --new \"Test generation for: [description]\"")
```

**Output**: `testSessionId` (pattern: `WFS-test-[slug]`)

**Validation**:
- Session Mode: Source session exists with completed IMPL tasks
- Both Modes: New test session directory created with metadata

---

### Phase 2: Gather Test Context

**Execute**:
```javascript
// Session Mode
SlashCommand("/workflow:tools:test-context-gather --session [testSessionId]")

// Prompt Mode
SlashCommand("/workflow:tools:context-gather --session [testSessionId] \"[task_description]\"")
```

**Expected Behavior**:
- **Session Mode**: Load source session summaries, analyze test coverage
- **Prompt Mode**: Analyze codebase from description
- Both: Detect test framework, generate context package

**Output**: `contextPath` (pattern: `.workflow/[testSessionId]/.process/[test-]context-package.json`)

---

### Phase 3: Test Generation Analysis

**Execute**:
```javascript
SlashCommand("/workflow:tools:test-concept-enhanced --session [testSessionId] --context [contextPath]")
```

**Expected Behavior**:
- Use Gemini to analyze coverage gaps
- Generate **multi-layered test requirements**:
  - L0: Static Analysis (linting, type checking, anti-pattern detection)
  - L1: Unit Tests (happy path, negative path, edge cases: null/undefined/empty)
  - L2: Integration Tests (component interactions, failure scenarios: timeout/unavailable)
  - L3: E2E Tests (user journeys, if applicable)
- Generate `TEST_ANALYSIS_RESULTS.md`

**Output**: `.workflow/[testSessionId]/.process/TEST_ANALYSIS_RESULTS.md`

**Validation** - TEST_ANALYSIS_RESULTS.md must include:
- Coverage Assessment
- Test Framework & Conventions
- Multi-Layered Test Plan (L0-L3)
- Test Requirements by File (with layer annotations)
- Test Generation Strategy
- Implementation Targets
- Quality Assurance Criteria:
  - Minimum coverage thresholds
  - Required test types per function
  - Acceptance criteria for test quality
- Success Criteria

---

### Phase 4: Generate Test Tasks

**Execute**:
```javascript
SlashCommand("/workflow:tools:test-task-generate --session [testSessionId]")
```

**Expected Behavior**:
- Parse TEST_ANALYSIS_RESULTS.md
- Generate **minimum 4 task JSON files**:
  - IMPL-001.json (Test Generation)
  - IMPL-001.3-validation.json (Code Validation Gate)
  - IMPL-001.5-review.json (Test Quality Gate)
  - IMPL-002.json (Test Execution & Fix)
- Generate IMPL_PLAN.md and TODO_LIST.md

**Output Validation**:
- Verify all `.task/IMPL-*.json` files exist
- Verify `IMPL_PLAN.md` and `TODO_LIST.md` created

---

### Phase 5: Return Summary

**Return to User**:
```
Independent test-fix workflow created successfully!

Input: [original input]
Mode: [Session|Prompt]
Test Session: [testSessionId]

Tasks Created:
- IMPL-001: Test Understanding & Generation (@code-developer)
- IMPL-001.3: Code Validation Gate - AI Error Detection (@test-fix-agent)
- IMPL-001.5: Test Quality Gate - Static Analysis & Coverage (@test-fix-agent)
- IMPL-002: Test Execution & Fix Cycle (@test-fix-agent)

Quality Thresholds:
- Code Validation: Zero compilation/import/variable errors
- Minimum Coverage: 80%
- Static Analysis: Zero critical issues
- Max Fix Iterations: 5

Review artifacts:
- Test plan: .workflow/[testSessionId]/IMPL_PLAN.md
- Task list: .workflow/[testSessionId]/TODO_LIST.md
- Validation config: ~/.claude/workflows/test-quality-config.json

CRITICAL - Next Steps:
1. Review IMPL_PLAN.md
2. **MUST execute: /workflow:test-cycle-execute**
```

---

## Task Specifications

Generates minimum 4 tasks (expandable for complex projects):

### IMPL-001: Test Understanding & Generation

| Field | Value |
|-------|-------|
| **Agent** | `@code-developer` |
| **Type** | `test-gen` |
| **Depends On** | None |

**Purpose**: Understand source implementation and generate test files following multi-layered test strategy

**Execution Flow**:
1. **Understand**: Load TEST_ANALYSIS_RESULTS.md, analyze requirements (L0-L3)
2. **Generate**: Create test files (unit, integration, E2E as applicable)
3. **Verify**: Check test completeness, meaningful assertions, no anti-patterns

---

### IMPL-001.3: Code Validation Gate

| Field | Value |
|-------|-------|
| **Agent** | `@test-fix-agent` |
| **Type** | `code-validation` |
| **Depends On** | `["IMPL-001"]` |
| **Config** | `~/.claude/workflows/test-quality-config.json` |

**Purpose**: Validate AI-generated code for common errors before test execution

**Validation Phases**:
| Phase | Checks |
|-------|--------|
| L0.1 Compilation | `tsc --noEmit` - syntax errors, module resolution |
| L0.2 Imports | Unresolved/hallucinated packages, circular deps, duplicates |
| L0.3 Variables | Redeclaration, scope conflicts, undefined/unused vars |
| L0.4 Types | Type mismatches, missing definitions, `any` abuse |
| L0.5 AI-Specific | Placeholder code, mock in production, naming inconsistency |

**Gate Decision**:
| Decision | Condition | Action |
|----------|-----------|--------|
| **PASS** | critical=0, error≤3, warning≤10 | Proceed to IMPL-001.5 |
| **SOFT_FAIL** | Fixable issues | Auto-fix and retry (max 2) |
| **HARD_FAIL** | critical>0 OR max retries | Block with report |

**Acceptance Criteria**:
- Zero compilation errors
- All imports resolvable
- No variable redeclarations
- No undefined variable usage

**Output**: `.process/code-validation-report.md`, `.process/code-validation-report.json`

---

### IMPL-001.5: Test Quality Gate

| Field | Value |
|-------|-------|
| **Agent** | `@test-fix-agent` |
| **Type** | `test-quality-review` |
| **Depends On** | `["IMPL-001", "IMPL-001.3"]` |
| **Config** | `~/.claude/workflows/test-quality-config.json` |

**Purpose**: Validate test quality before entering fix cycle

**Execution Flow**:
1. **Static Analysis**: Lint test files, check anti-patterns (empty tests, missing assertions)
2. **Coverage Analysis**: Calculate coverage percentage, identify gaps
3. **Quality Metrics**: Verify thresholds, negative test coverage
4. **Gate Decision**: PASS (proceed) or FAIL (loop back to IMPL-001)

**Acceptance Criteria**:
- Coverage ≥ 80%
- Zero critical anti-patterns
- All targeted functions have unit tests
- Each public API has error handling test

**Failure Handling**:
If quality gate fails:
1. Generate detailed feedback report (`.process/test-quality-report.md`)
2. Update IMPL-001 task with specific improvement requirements
3. Trigger IMPL-001 re-execution with enhanced context
4. Maximum 2 quality gate retries before escalating to user

**Output**: `.process/test-quality-report.md`

---

### IMPL-002: Test Execution & Fix Cycle

| Field | Value |
|-------|-------|
| **Agent** | `@test-fix-agent` |
| **Type** | `test-fix` |
| **Depends On** | `["IMPL-001", "IMPL-001.3", "IMPL-001.5"]` |

**Purpose**: Execute tests and trigger orchestrator-managed fix cycles

**Note**: The agent executes tests and reports results. The `test-cycle-execute` orchestrator manages all fix iterations.

**Cycle Pattern** (orchestrator-managed):
```
test → gemini_diagnose → fix (agent or CLI) → retest
```

**Tools Configuration** (orchestrator-controlled):
- Gemini for analysis with bug-fix template → surgical fix suggestions
- Agent fix application (default) OR CLI if `command` field present in implementation_approach

**Exit Conditions**:
- Success: All tests pass
- Failure: Max iterations reached (5)

---

### IMPL-003+: Additional Tasks (Optional)

**Scenarios**:
- Large projects requiring per-module test generation
- Separate integration vs unit test tasks
- Specialized test types (performance, security)

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
    ├── TEST_ANALYSIS_RESULTS.md       # Test requirements and strategy
    ├── code-validation-report.md      # Code validation findings
    ├── code-validation-report.json    # Machine-readable findings
    └── test-quality-report.md         # Test quality gate findings
```

### Session Metadata

**File**: `workflow-session.json`

| Mode | Fields |
|------|--------|
| **Session** | `type: "test"`, `source_session_id: "[sourceId]"` |
| **Prompt** | `type: "test"` (no source_session_id) |

---

## Orchestration Patterns

### TodoWrite Pattern

**Initial Structure**:
```json
[
  {"content": "Phase 1: Create Test Session", "status": "in_progress", "activeForm": "Creating test session"},
  {"content": "Phase 2: Gather Test Context", "status": "pending", "activeForm": "Gathering test context"},
  {"content": "Phase 3: Test Generation Analysis", "status": "pending", "activeForm": "Analyzing test generation"},
  {"content": "Phase 4: Generate Test Tasks", "status": "pending", "activeForm": "Generating test tasks"},
  {"content": "Phase 5: Return Summary", "status": "pending", "activeForm": "Completing"}
]
```

### Task Attachment Model

SlashCommand execution follows **attach → execute → collapse** pattern:

1. **Attach**: Sub-command's tasks are attached to orchestrator's TodoWrite
2. **Execute**: Orchestrator executes attached tasks sequentially
3. **Collapse**: After completion, sub-tasks collapse to phase summary

**Example - Phase 2 Expanded**:
```json
[
  {"content": "Phase 1: Create Test Session", "status": "completed"},
  {"content": "Phase 2: Gather Test Context", "status": "in_progress"},
  {"content": "  → Load context and analyze coverage", "status": "in_progress"},
  {"content": "  → Detect test framework and conventions", "status": "pending"},
  {"content": "  → Generate context package", "status": "pending"},
  {"content": "Phase 3: Test Generation Analysis", "status": "pending"},
  ...
]
```

### Auto-Continue Mechanism

- TodoList tracks current phase status
- When phase completes, automatically execute next pending phase
- All phases run autonomously without user interaction
- **⚠️ Do not stop until all phases complete**

---

## Reference

### Error Handling

| Phase | Error Condition | Action |
|-------|----------------|--------|
| 1 | Source session not found | Return error with session ID |
| 1 | No completed IMPL tasks | Return error, source incomplete |
| 2 | Context gathering failed | Return error, check source artifacts |
| 3 | Gemini analysis failed | Return error, check context package |
| 4 | Task generation failed | Retry once, then return error |

### Best Practices

**Before Running**:
- Ensure implementation is complete (session mode: check summaries exist)
- Commit all implementation changes

**After Running**:
- Review `IMPL_PLAN.md` before execution
- Check `TEST_ANALYSIS_RESULTS.md` for completeness
- Verify task dependencies in `TODO_LIST.md`

**During Execution** (in test-cycle-execute):
- Monitor iteration logs in `.process/fix-iteration-*`
- Track progress with `/workflow:status`
- Review Gemini diagnostic outputs

**Mode Selection**:
- **Session Mode**: For completed workflow validation
- **Prompt Mode**: For ad-hoc test generation
- Include "use Codex" in description for autonomous fix application

### Related Commands

**Prerequisites**:
- `/workflow:plan` or `/workflow:execute` - Complete implementation (Session Mode)
- None for Prompt Mode

**Called by This Command**:
- `/workflow:session:start` - Phase 1
- `/workflow:tools:test-context-gather` - Phase 2 (Session Mode)
- `/workflow:tools:context-gather` - Phase 2 (Prompt Mode)
- `/workflow:tools:test-concept-enhanced` - Phase 3
- `/workflow:tools:test-task-generate` - Phase 4

**Validation Commands** (invoked during test-cycle-execute):
- `/workflow:tools:code-validation-gate` - IMPL-001.3

**Follow-up Commands**:
- `/workflow:status` - Review generated tasks
- `/workflow:test-cycle-execute` - Execute test workflow
- `/workflow:execute` - Standard task execution
