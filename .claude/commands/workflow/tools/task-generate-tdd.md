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
- **Context-Aware**: Analyzes existing codebase and test patterns
- **Iterative Green Phase**: Auto-diagnose and fix test failures with Gemini + optional Codex
- **Safety-First**: Auto-revert on max iterations to prevent broken state

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

### Phase 2: TDD Task JSON Generation

**Input**: Use `.process/ANALYSIS_RESULTS.md` directly (enhanced with TDD structure from concept-enhanced phase)

**Note**: The ANALYSIS_RESULTS.md now includes TDD-specific breakdown:
- Feature list with testable requirements
- Test cases for Red phase
- Implementation requirements for Green phase
- Refactoring opportunities
- Task dependencies and execution order

### Phase 3: Enhanced IMPL_PLAN.md Generation

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
    "tdd_phase": "green",
    "max_iterations": 3,
    "use_codex": false
  },
  "context": {
    "requirements": [
      "Implement minimal AuthService to pass TEST-1.1",
      "Handle valid and invalid credentials",
      "Return appropriate success/error responses",
      "If tests fail after implementation, diagnose and fix iteratively"
    ],
    "focus_paths": ["src/auth/AuthService.ts", "tests/auth/login.test.ts"],
    "acceptance": [
      "All tests in TEST-1.1 pass",
      "Implementation is minimal and focused",
      "No over-engineering or premature optimization",
      "Test failures resolved within iteration limit"
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
        "action": "Confirm tests are currently failing (Red phase validation)",
        "command": "bash(npm test -- tests/auth/login.test.ts || echo 'Tests failing as expected')",
        "output_to": "initial_test_status",
        "on_error": "warn"
      },
      {
        "step": "load_test_context",
        "action": "Load test patterns and framework info",
        "command": "bash(cat .workflow/WFS-xxx/.process/test-context-package.json 2>/dev/null || echo '{}')",
        "output_to": "test_context",
        "on_error": "skip_optional"
      }
    ],
    "implementation_approach": {
      "task_description": "Write minimal code to pass tests, then enter iterative fix cycle if they still fail",
      "initial_implementation": [
        "Write minimal code based on test requirements",
        "Execute test suite: bash(npm test -- tests/auth/login.test.ts)",
        "If tests pass → Complete task",
        "If tests fail → Capture failure logs and proceed to test-fix cycle"
      ],
      "test_fix_cycle": {
        "max_iterations": 3,
        "cycle_pattern": "gemini_diagnose → manual_fix (or codex if meta.use_codex=true) → retest",
        "tools": {
          "diagnosis": "gemini-wrapper (MODE: analysis, uses bug-fix template)",
          "fix_application": "manual (default) or codex if meta.use_codex=true",
          "verification": "bash(npm test -- tests/auth/login.test.ts)"
        },
        "exit_conditions": {
          "success": "all_tests_pass",
          "failure": "max_iterations_reached"
        },
        "steps": [
          "ITERATION LOOP (max 3):",
          "  1. Gemini Diagnosis:",
          "     bash(cd .workflow/WFS-xxx/.process && ~/.claude/scripts/gemini-wrapper --all-files -p \"",
          "     PURPOSE: Diagnose TDD Green phase test failure iteration [N]",
          "     TASK: Systematic bug analysis and fix recommendations",
          "     MODE: analysis",
          "     CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}",
          "              Test output: [test_failures]",
          "              Test requirements: [test_requirements]",
          "              Implementation: [focus_paths]",
          "     EXPECTED: Root cause analysis, code path tracing, targeted fixes",
          "     RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Bug: [test_failure_description]",
          "            Minimal surgical fixes only - stay in Green phase",
          "     \" > green-fix-iteration-[N]-diagnosis.md)",
          "  2. Apply Fix (check meta.use_codex):",
          "     IF meta.use_codex=false (default): Present diagnosis to user for manual fix",
          "     IF meta.use_codex=true: Codex applies fix automatically",
          "  3. Retest: bash(npm test -- tests/auth/login.test.ts)",
          "  4. If pass → Exit loop, complete task",
          "     If fail → Continue to next iteration",
          "IF max_iterations reached: Revert changes, report failure"
        ]
      }
    },
    "post_completion": [
      {
        "step": "verify_tests_passing",
        "action": "Confirm all tests now pass (Green phase achieved)",
        "command": "bash(npm test -- tests/auth/login.test.ts)",
        "output_to": "final_test_status",
        "on_error": "fail"
      }
    ],
    "error_handling": {
      "max_iterations_reached": {
        "action": "revert_all_changes",
        "commands": [
          "bash(git reset --hard HEAD)",
          "bash(echo 'TDD Green phase failed: Unable to pass tests within 3 iterations' > .workflow/WFS-xxx/.process/green-phase-failure.md)"
        ],
        "report": "Generate failure report in .summaries/IMPL-1.1-failure-report.md"
      }
    }
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

### Phase 4: Unified IMPL_PLAN.md Generation

Generate single comprehensive IMPL_PLAN.md with:

**Frontmatter**:
```yaml
---
identifier: WFS-{session-id}
workflow_type: "tdd"
feature_count: N
task_count: 3N
tdd_chains: N
---
```

**Structure**:
1. **Summary**: Project overview
2. **TDD Task Chains** (TDD-specific section):
   - Visual representation of TEST → IMPL → REFACTOR chains
   - Feature-by-feature breakdown with phase indicators
3. **Task Breakdown**: Standard task listing
4. **Implementation Strategy**: Execution approach
5. **Success Criteria**: Acceptance conditions

### Phase 5: TODO_LIST.md Generation

Generate task list with TDD phase indicators:
```markdown
## Feature 1: {Feature Name}
- [ ] **TEST-1.1**: Write failing test (🔴 RED) → [📋](./.task/TEST-1.1.json)
- [ ] **IMPL-1.1**: Implement to pass tests (🟢 GREEN) [depends: TEST-1.1] → [📋](./.task/IMPL-1.1.json)
- [ ] **REFACTOR-1.1**: Refactor implementation (🔵 REFACTOR) [depends: IMPL-1.1] → [📋](./.task/REFACTOR-1.1.json)
```

### Phase 6: Session State Update

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
├── IMPL_PLAN.md                     # Unified plan with TDD Task Chains section
├── TODO_LIST.md                     # Progress tracking with TDD phases
├── .task/
│   ├── TEST-1.1.json                # Red phase task
│   ├── IMPL-1.1.json                # Green phase task (with test-fix-cycle)
│   ├── REFACTOR-1.1.json            # Refactor phase task
│   └── ...
└── .process/
    ├── ANALYSIS_RESULTS.md          # Enhanced with TDD breakdown from concept-enhanced
    ├── test-context-package.json    # Test coverage analysis
    ├── context-package.json         # Input from context-gather
    └── green-fix-iteration-*.md     # Fix logs from Green phase
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
- Unified Plan: .workflow/WFS-auth/IMPL_PLAN.md (includes TDD Task Chains section)

Next: /workflow:execute or /workflow:tdd-verify
```

## Test Coverage Analysis Integration

The TDD workflow includes test coverage analysis (via `/workflow:tools:test-context-gather`) to:
- Detect existing test patterns and conventions
- Identify current test coverage gaps
- Discover test framework and configuration
- Enable integration with existing tests

This makes TDD workflow context-aware instead of assuming greenfield scenarios.

## Iterative Green Phase with Test-Fix Cycle

IMPL (Green phase) tasks include automatic test-fix cycle:

**Process Flow**:
1. **Initial Implementation**: Write minimal code to pass tests
2. **Test Execution**: Run test suite
3. **Success Path**: Tests pass → Complete task
4. **Failure Path**: Tests fail → Enter iterative fix cycle:
   - **Gemini Diagnosis**: Analyze failures with bug-fix template
   - **Fix Application**: Manual (default) or Codex (if meta.use_codex=true)
   - **Retest**: Verify fix resolves failures
   - **Repeat**: Up to max_iterations (default: 3)
5. **Safety Net**: Auto-revert all changes if max iterations reached

**Key Benefits**:
- ✅ Faster feedback loop within Green phase
- ✅ Autonomous recovery from initial implementation errors
- ✅ Systematic debugging with Gemini's bug-fix template
- ✅ Safe rollback prevents broken TDD state

## Configuration Options
- **meta.max_iterations**: Number of fix attempts (default: 3 for TDD, 5 for test-gen)
- **meta.use_codex**: Enable Codex automated fixes (default: false, manual)

## Related Commands
- `/workflow:tdd-plan` - Orchestrates TDD workflow planning (6 phases)
- `/workflow:tools:test-context-gather` - Analyzes test coverage
- `/workflow:execute` - Executes TDD tasks in order
- `/workflow:tdd-verify` - Verifies TDD compliance
- `/workflow:test-gen` - Post-implementation test generation
