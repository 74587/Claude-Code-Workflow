---
name: task-generate-tdd
description: Generate TDD task chains with Red-Green-Refactor dependencies
usage: /workflow:tools:task-generate-tdd --session <session_id> [--agent]
argument-hint: "--session WFS-session-id [--agent]"
examples:
  - /workflow:tools:task-generate-tdd --session WFS-auth
  - /workflow:tools:task-generate-tdd --session WFS-auth --agent
allowed-tools: Read(*), Write(*), Bash(gemini-wrapper:*), TodoWrite(*)
---

# TDD Task Generation Command

## Overview
Generate TDD-specific task chains from analysis results with enforced Red-Green-Refactor structure and dependencies.

## Core Philosophy
- **TDD-First**: Every feature starts with a failing test
- **Chain-Enforced**: Dependencies ensure proper TDD cycle
- **Phase-Explicit**: Each task marked with Red/Green/Refactor phase
- **Artifact-Aware**: Integrates brainstorming outputs
- **Memory-First**: Reuse loaded documents from memory

## Core Responsibilities
- Parse analysis results and identify testable features
- Generate Red-Green-Refactor task chains for each feature
- Enforce proper dependencies (TEST → IMPL → REFACTOR)
- Create TDD_PLAN.md and enhanced IMPL_PLAN.md
- Generate TODO_LIST.md with TDD phase indicators
- Update session state for TDD execution

## Execution Lifecycle

### Phase 1: Input Validation & Discovery
**⚡ Memory-First Rule**: Skip file loading if documents already in conversation memory

1. **Session Validation**
   - If session metadata in memory → Skip loading
   - Else: Load `.workflow/{session_id}/workflow-session.json`

2. **Analysis Results Loading**
   - If ANALYSIS_RESULTS.md in memory → Skip loading
   - Else: Read `.workflow/{session_id}/.process/ANALYSIS_RESULTS.md`

3. **Artifact Discovery**
   - If artifact inventory in memory → Skip scanning
   - Else: Scan `.workflow/{session_id}/.brainstorming/` directory
   - Detect: synthesis-specification.md, topic-framework.md, role analyses

### Phase 2: TDD Task Analysis

#### Gemini TDD Breakdown
```bash
cd project-root && ~/.claude/scripts/gemini-wrapper -p "
PURPOSE: Generate TDD task breakdown with Red-Green-Refactor chains
TASK: Analyze ANALYSIS_RESULTS.md and create TDD-structured task breakdown
CONTEXT: @{.workflow/{session_id}/ANALYSIS_RESULTS.md,.workflow/{session_id}/.brainstorming/*}
EXPECTED:
- Feature list with testable requirements (identify 3-8 features)
- Test cases for each feature (Red phase) - specific test scenarios
- Implementation requirements (Green phase) - minimal code to pass
- Refactoring opportunities (Refactor phase) - quality improvements
- Task dependencies and execution order
- Focus paths for each phase
RULES:
- Each feature must have TEST → IMPL → REFACTOR chain
- Tests must define clear failure conditions
- Implementation must be minimal to pass tests
- Refactoring must maintain green tests
- Output structured markdown for task generation
- Maximum 10 features (30 total tasks)
" > .workflow/{session_id}/.process/TDD_TASK_BREAKDOWN.md
```

### Phase 3: TDD Task JSON Generation

#### Task Chain Structure
For each feature, generate 3 tasks with ID format:
- **TEST-N.M** (Red phase)
- **IMPL-N.M** (Green phase)
- **REFACTOR-N.M** (Refactor phase)

#### Chain Dependency Rules
- **IMPL depends_on TEST**: Cannot implement before test exists
- **REFACTOR depends_on IMPL**: Cannot refactor before implementation
- **Cross-feature dependencies**: If Feature 2 needs Feature 1, then `IMPL-2.1 depends_on ["REFACTOR-1.1"]`

#### Agent Assignment
- **TEST tasks** → `@code-review-test-agent`
- **IMPL tasks** → `@code-developer`
- **REFACTOR tasks** → `@code-developer`

#### Meta Fields
- `meta.type`: "test" | "feature" | "refactor"
- `meta.agent`: Agent for task execution
- `meta.tdd_phase`: "red" | "green" | "refactor"

#### Task JSON Examples

**RED Phase - Test Task (TEST-1.1.json)**
```json
{
  "id": "TEST-1.1",
  "title": "Write failing test for user authentication",
  "status": "pending",
  "meta": {
    "type": "test",
    "agent": "@code-review-test-agent",
    "tdd_phase": "red"
  },
  "context": {
    "requirements": [
      "Write test case for login with valid credentials",
      "Test should fail with 'AuthService not implemented' error",
      "Include tests for invalid credentials and edge cases"
    ],
    "focus_paths": ["tests/auth/login.test.ts"],
    "acceptance": [
      "Test file created with at least 3 test cases",
      "Test runs and fails with clear error message",
      "Test assertions define expected behavior"
    ],
    "depends_on": []
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "check_test_framework",
        "action": "Verify test framework is configured",
        "command": "bash(npm list jest || npm list vitest)",
        "output_to": "test_framework_info",
        "on_error": "warn"
      }
    ]
  }
}
```

**GREEN Phase - Implementation Task (IMPL-1.1.json)**
```json
{
  "id": "IMPL-1.1",
  "title": "Implement user authentication to pass tests",
  "status": "pending",
  "meta": {
    "type": "feature",
    "agent": "@code-developer",
    "tdd_phase": "green"
  },
  "context": {
    "requirements": [
      "Implement minimal AuthService to pass TEST-1.1",
      "Handle valid and invalid credentials",
      "Return appropriate success/error responses"
    ],
    "focus_paths": ["src/auth/AuthService.ts", "tests/auth/login.test.ts"],
    "acceptance": [
      "All tests in TEST-1.1 pass",
      "Implementation is minimal and focused",
      "No over-engineering or premature optimization"
    ],
    "depends_on": ["TEST-1.1"]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_test_requirements",
        "action": "Read test specifications from TEST phase",
        "command": "bash(cat .workflow/WFS-xxx/.summaries/TEST-1.1-summary.md)",
        "output_to": "test_requirements",
        "on_error": "fail"
      },
      {
        "step": "verify_tests_failing",
        "action": "Confirm tests are currently failing",
        "command": "bash(npm test -- tests/auth/login.test.ts || echo 'Tests failing as expected')",
        "output_to": "initial_test_status",
        "on_error": "warn"
      }
    ],
    "post_completion": [
      {
        "step": "verify_tests_passing",
        "action": "Confirm all tests now pass",
        "command": "bash(npm test -- tests/auth/login.test.ts)",
        "output_to": "final_test_status",
        "on_error": "fail"
      }
    ]
  }
}
```

**REFACTOR Phase - Refactoring Task (REFACTOR-1.1.json)**
```json
{
  "id": "REFACTOR-1.1",
  "title": "Refactor authentication implementation",
  "status": "pending",
  "meta": {
    "type": "refactor",
    "agent": "@code-developer",
    "tdd_phase": "refactor"
  },
  "context": {
    "requirements": [
      "Improve code quality while keeping tests green",
      "Remove duplication in credential validation",
      "Improve error handling and logging",
      "Enhance code readability and maintainability"
    ],
    "focus_paths": ["src/auth/AuthService.ts", "tests/auth/login.test.ts"],
    "acceptance": [
      "Code quality improved (complexity, readability)",
      "All tests still pass after refactoring",
      "No new functionality added",
      "Duplication eliminated"
    ],
    "depends_on": ["IMPL-1.1"]
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "verify_tests_passing",
        "action": "Run tests to confirm green state before refactoring",
        "command": "bash(npm test -- tests/auth/login.test.ts)",
        "output_to": "test_status",
        "on_error": "fail"
      },
      {
        "step": "analyze_code_quality",
        "action": "Run linter and complexity analysis",
        "command": "bash(npm run lint src/auth/AuthService.ts)",
        "output_to": "quality_metrics",
        "on_error": "warn"
      }
    ],
    "post_completion": [
      {
        "step": "verify_tests_still_passing",
        "action": "Confirm tests remain green after refactoring",
        "command": "bash(npm test -- tests/auth/login.test.ts)",
        "output_to": "final_test_status",
        "on_error": "fail"
      }
    ]
  }
}
```

### Phase 4: TDD_PLAN.md Generation

Generate TDD-specific plan with:
- Feature breakdown
- Red-Green-Refactor chains
- Execution order
- TDD compliance checkpoints

### Phase 5: Enhanced IMPL_PLAN.md Generation

Generate standard IMPL_PLAN.md with TDD context reference.

### Phase 6: TODO_LIST.md Generation

Generate task list with TDD phase indicators:
```markdown
## Feature 1: {Feature Name}
- [ ] **TEST-1.1**: Write failing test (🔴 RED) → [📋](./.task/TEST-1.1.json)
- [ ] **IMPL-1.1**: Implement to pass tests (🟢 GREEN) [depends: TEST-1.1] → [📋](./.task/IMPL-1.1.json)
- [ ] **REFACTOR-1.1**: Refactor implementation (🔵 REFACTOR) [depends: IMPL-1.1] → [📋](./.task/REFACTOR-1.1.json)
```

### Phase 7: Session State Update

Update workflow-session.json with TDD metadata:
```json
{
  "workflow_type": "tdd",
  "feature_count": 10,
  "task_count": 30,
  "tdd_chains": 10
}
```

## Output Files Structure
```
.workflow/{session-id}/
├── IMPL_PLAN.md                     # Standard implementation plan
├── TDD_PLAN.md                      # TDD-specific plan ⭐ NEW
├── TODO_LIST.md                     # Progress tracking with TDD phases
├── .task/
│   ├── TEST-1.1.json                # Red phase task
│   ├── IMPL-1.1.json                # Green phase task
│   ├── REFACTOR-1.1.json            # Refactor phase task
│   └── ...
└── .process/
    ├── ANALYSIS_RESULTS.md          # Input from concept-enhanced
    ├── TDD_TASK_BREAKDOWN.md        # Gemini TDD breakdown ⭐ NEW
    └── context-package.json         # Input from context-gather
```

## Validation Rules

### Chain Completeness
- Every TEST-N.M must have corresponding IMPL-N.M and REFACTOR-N.M

### Dependency Enforcement
- IMPL-N.M must have `depends_on: ["TEST-N.M"]`
- REFACTOR-N.M must have `depends_on: ["IMPL-N.M"]`

### Task Limits
- Maximum 10 features (30 tasks total)
- Flat hierarchy only

## Error Handling

### Input Validation Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| Session not found | Invalid session ID | Verify session exists |
| Analysis missing | Incomplete planning | Run concept-enhanced first |

### TDD Generation Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| Feature count exceeds 10 | Too many features | Re-scope requirements |
| Missing test framework | No test config | Configure testing first |
| Invalid chain structure | Parsing error | Fix TDD breakdown |

## Integration & Usage

### Command Chain
- **Called By**: `/workflow:tdd-plan` (Phase 4)
- **Calls**: Gemini wrapper for TDD breakdown
- **Followed By**: `/workflow:execute`, `/workflow:tdd-verify`

### Basic Usage
```bash
# Manual mode (default)
/workflow:tools:task-generate-tdd --session WFS-auth

# Agent mode (autonomous task generation)
/workflow:tools:task-generate-tdd --session WFS-auth --agent
```

### Expected Output
```
TDD task generation complete for session: WFS-auth

Features analyzed: 5
TDD chains generated: 5
Total tasks: 15 (5 TEST + 5 IMPL + 5 REFACTOR)

Structure:
- Feature 1: TEST-1.1 → IMPL-1.1 → REFACTOR-1.1
- Feature 2: TEST-2.1 → IMPL-2.1 → REFACTOR-2.1

Plans generated:
- TDD Plan: .workflow/WFS-auth/TDD_PLAN.md
- Implementation Plan: .workflow/WFS-auth/IMPL_PLAN.md

Next: /workflow:execute or /workflow:tdd-verify
```

## Related Commands
- `/workflow:tdd-plan` - Orchestrates TDD workflow planning
- `/workflow:execute` - Executes TDD tasks in order
- `/workflow:tdd-verify` - Verifies TDD compliance
