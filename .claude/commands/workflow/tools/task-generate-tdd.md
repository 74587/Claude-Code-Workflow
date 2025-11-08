---
name: task-generate-tdd
description: Generate TDD task chains with Red-Green-Refactor dependencies, test-first structure, and cycle validation
argument-hint: "--session WFS-session-id [--agent]"
allowed-tools: Read(*), Write(*), Bash(gemini:*), TodoWrite(*)
---

# TDD Task Generation Command

## Overview
Generate TDD-specific tasks from analysis results with complete Red-Green-Refactor cycles contained within each task.

## Task Strategy & Philosophy

### Optimized Task Structure (Current)
- **1 feature = 1 task** containing complete TDD cycle internally
- Each task executes Red-Green-Refactor phases sequentially
- Task count = Feature count (typically 5 features = 5 tasks)
- **Benefits**:
  - 70% reduction in task management overhead
  - Continuous context per feature (no switching between TEST/IMPL/REFACTOR)
  - Simpler dependency management
  - Maintains TDD rigor through internal phase structure

**Previous Approach** (Deprecated):
- 1 feature = 3 separate tasks (TEST-N.M, IMPL-N.M, REFACTOR-N.M)
- 5 features = 15 tasks with complex dependency chains
- High context switching cost between phases

### When to Use Subtasks
- Feature complexity >2500 lines or >6 files per TDD cycle
- Multiple independent sub-features needing parallel execution
- Strong technical dependency blocking (e.g., API before UI)
- Different tech stacks or domains within feature

### Task Limits
- **Maximum 10 tasks** (hard limit for TDD workflows)
- **Feature-based**: Complete functional units with internal TDD cycles
- **Hierarchy**: Flat (≤5 simple features) | Two-level (6-10 for complex features with sub-features)
- **Re-scope**: If >10 tasks needed, break project into multiple TDD workflow sessions

### TDD Cycle Mapping
- **Old approach**: 1 feature = 3 tasks (TEST-N.M, IMPL-N.M, REFACTOR-N.M)
- **Current approach**: 1 feature = 1 task (IMPL-N with internal Red-Green-Refactor phases)
- **Complex features**: 1 container (IMPL-N) + subtasks (IMPL-N.M) when necessary

### Core Principles
- **TDD-First**: Every feature starts with a failing test (Red phase)
- **Feature-Complete Tasks**: Each task contains complete Red-Green-Refactor cycle
- **Phase-Explicit**: Internal phases clearly marked in flow_control.implementation_approach
- **Task Merging**: Prefer single task per feature over decomposition
- **Path Clarity**: All `focus_paths` prefer absolute paths (e.g., `D:\\project\\src\\module`), or clear relative paths from project root (e.g., `./src/module`)
- **Artifact-Aware**: Integrates brainstorming outputs
- **Memory-First**: Reuse loaded documents from memory
- **Context-Aware**: Analyzes existing codebase and test patterns
- **Iterative Green Phase**: Auto-diagnose and fix test failures with Gemini + optional Codex
- **Safety-First**: Auto-revert on max iterations to prevent broken state
- **Quantification-Enforced**: All test cases, coverage requirements, and implementation scope MUST include explicit counts and enumerations (e.g., "15 test cases: [test1, test2, ...]" not "comprehensive tests")

## Quantification Requirements for TDD (MANDATORY)

**Purpose**: Eliminate ambiguity in TDD task generation by enforcing explicit test case counts, coverage metrics, and implementation scope.

**Core Rules**:
1. **Explicit Test Case Counts**: Red phase MUST specify exact number of test cases with enumerated list
2. **Quantified Coverage**: Acceptance criteria MUST include measurable coverage percentage (e.g., ">=85%")
3. **Detailed Implementation Scope**: Green phase MUST enumerate exact files, functions, and line counts
4. **Enumerated Refactoring Targets**: Refactor phase MUST list specific improvements with counts

**Test Case Format (Red Phase)**:
```
"requirements": [
  "GOOD: Red Phase - Write 15 test cases: [test_user_auth_success, test_user_auth_invalid_password, test_user_auth_missing_token, test_session_create, test_session_resume, test_session_expire, test_api_post_valid, test_api_post_invalid, test_api_get_list, test_api_get_item, test_validation_required_fields, test_validation_type_checking, test_error_404, test_error_500, test_integration_full_flow]",
  "BAD: Red Phase - Write comprehensive test suite covering all scenarios"
]
```

**Coverage Format (Acceptance)**:
```
"acceptance": [
  "GOOD: All 15 tests pass with >=85% coverage: verify by pytest --cov=src/auth --cov-report=term | grep TOTAL",
  "GOOD: Test 5 functions: [authenticate(), createSession(), validateToken(), refreshSession(), revokeSession()]",
  "BAD: All tests pass with good coverage",
  "BAD: Test suite complete"
]
```

**Implementation Scope Format (Green Phase)**:
```
"modification_points": [
  "GOOD: Implement 5 functions in src/auth/service.ts lines 20-180: [authenticate() 20-45, createSession() 50-75, validateToken() 80-100, refreshSession() 105-135, revokeSession() 140-160]",
  "GOOD: Create 3 files: [src/auth/service.ts (180 lines), src/auth/models.ts (50 lines), src/auth/utils.ts (30 lines)]",
  "BAD: Implement authentication service following requirements",
  "BAD: Create necessary files for feature"
]
```

**Refactoring Targets Format (Refactor Phase)**:
```
"modification_points": [
  "GOOD: Apply 4 refactorings: [extract validateInput() helper (15 lines), merge duplicate error handlers (3 occurrences), rename confusing variables (token->authToken in 8 locations), add JSDoc to 5 public functions]",
  "BAD: Improve code quality and maintainability",
  "BAD: Refactor implementation"
]
```

**TDD Cycles Array Format**:
```
"tdd_cycles": [
  {
    "cycle": 1,
    "feature": "User authentication with password validation",
    "test_count": 5,
    "test_cases": [
      "test_auth_valid_credentials",
      "test_auth_invalid_password",
      "test_auth_missing_username",
      "test_auth_account_locked",
      "test_auth_password_expired"
    ],
    "implementation_scope": "Implement authenticate() function in src/auth/service.ts lines 20-65 (45 lines)",
    "expected_coverage": ">=90%"
  },
  {
    "cycle": 2,
    "feature": "Session management lifecycle",
    "test_count": 6,
    "test_cases": [
      "test_session_create",
      "test_session_resume",
      "test_session_expire",
      "test_session_refresh",
      "test_session_revoke",
      "test_session_concurrent_limit"
    ],
    "implementation_scope": "Implement 3 functions in src/auth/service.ts lines 70-150: [createSession() 70-95, resumeSession() 100-125, revokeSession() 130-150]",
    "expected_coverage": ">=85%"
  }
]
```

**Validation Checklist** (Run before TDD task generation):
- [ ] Every Red phase specifies exact test case count with enumerated list
- [ ] Every Green phase enumerates files, functions, and estimated line counts
- [ ] Every Refactor phase lists specific improvements with counts
- [ ] Every acceptance criterion includes measurable coverage percentage
- [ ] tdd_cycles array contains test_count and test_cases for each cycle
- [ ] No vague language ("comprehensive", "complete", "thorough")

## Core Responsibilities
- Parse analysis results and identify testable features
- Generate feature-complete tasks with internal TDD cycles (1 task per simple feature)
- Apply task merging strategy by default, create subtasks only when complexity requires
- Generate IMPL_PLAN.md with TDD Implementation Tasks section
- Generate TODO_LIST.md with internal TDD phase indicators
- Update session state for TDD execution with task count compliance

## Execution Lifecycle

### Phase 1: Input Validation & Discovery
**Memory-First Rule**: Skip file loading if documents already in conversation memory

1. **Session Validation**
   - If session metadata in memory → Skip loading
   - Else: Load `.workflow/{session_id}/workflow-session.json`

2. **Conflict Resolution Check** (NEW - Priority Input)
   - If CONFLICT_RESOLUTION.md exists → Load selected strategies
   - Else: Skip to brainstorming artifacts
   - Path: `.workflow/{session_id}/.process/CONFLICT_RESOLUTION.md`

3. **Artifact Discovery**
   - If artifact inventory in memory → Skip scanning
   - Else: Scan `.workflow/{session_id}/.brainstorming/` directory
   - Detect: role analysis documents, guidance-specification.md, role analyses

4. **Context Package Loading**
   - Load `.workflow/{session_id}/.process/context-package.json`
   - Load `.workflow/{session_id}/.process/test-context-package.json` (if exists)

### Phase 2: TDD Task JSON Generation

**Input Sources** (priority order):
1. **Conflict Resolution** (if exists): `.process/CONFLICT_RESOLUTION.md` - Selected resolution strategies
2. **Brainstorming Artifacts**: Role analysis documents (system-architect, product-owner, etc.)
3. **Context Package**: `.process/context-package.json` - Project structure and requirements
4. **Test Context**: `.process/test-context-package.json` - Existing test patterns

**TDD Task Structure includes**:
- Feature list with testable requirements
- Test cases for Red phase
- Implementation requirements for Green phase (with test-fix cycle)
- Refactoring opportunities
- Task dependencies and execution order
- Conflict resolution decisions (if applicable)

### Phase 3: Task JSON & IMPL_PLAN.md Generation

#### Task Structure (Feature-Complete with Internal TDD)
For each feature, generate task(s) with ID format:
- **IMPL-N** - Single task containing complete TDD cycle (Red-Green-Refactor)
- **IMPL-N.M** - Sub-tasks only when feature is complex (>2500 lines or technical blocking)

**Task Dependency Rules**:
- **Sequential features**: IMPL-2 depends_on ["IMPL-1"] if Feature 2 needs Feature 1
- **Independent features**: No dependencies, can execute in parallel
- **Complex features**: IMPL-N.2 depends_on ["IMPL-N.1"] for subtask ordering

**Agent Assignment**:
- **All IMPL tasks** → `@code-developer` (handles full TDD cycle)
- Agent executes Red, Green, Refactor phases sequentially within task

**Meta Fields**:
- `meta.type`: "feature" (TDD-driven feature implementation)
- `meta.agent`: "@code-developer"
- `meta.tdd_workflow`: true (enables TDD-specific flow)
- `meta.tdd_phase`: Not used (phases are in flow_control.implementation_approach)
- `meta.max_iterations`: 3 (for Green phase test-fix cycle)
- `meta.use_codex`: false (manual fixes by default)

#### Task JSON Structure Reference

**Simple Feature Task (IMPL-N.json)** - Recommended for most features:
```json
{
  "id": "IMPL-N",                                  // Task identifier
  "title": "Feature description with TDD",         // Human-readable title
  "status": "pending",                             // pending | in_progress | completed | container
  "context_package_path": ".workflow/{session-id}/.process/context-package.json", // Path to smart context package
  "meta": {
    "type": "feature",                             // Task type
    "agent": "@code-developer",                    // Assigned agent
    "tdd_workflow": true,                          // REQUIRED: Enables TDD flow
    "max_iterations": 3,                           // Green phase test-fix cycle limit
    "use_codex": false                             // false=manual fixes, true=Codex automated fixes
  },
  "context": {
    "requirements": [                              // Feature requirements with TDD phases (QUANTIFIED)
      "Implement user authentication with session management",
      "Red: Write 11 test cases: [test_auth_valid, test_auth_invalid_pwd, test_auth_missing_user, test_session_create, test_session_resume, test_session_expire, test_session_refresh, test_session_revoke, test_validation_required, test_error_401, test_integration_full_auth_flow]",
      "Green: Implement 5 functions in src/auth/service.ts (160 lines total): [authenticate() 20-50, createSession() 55-80, validateToken() 85-105, refreshSession() 110-135, revokeSession() 140-160]",
      "Refactor: Apply 3 improvements: [extract validateInput() helper (12 lines), merge 2 duplicate error handlers, add JSDoc to 5 public functions]"
    ],
    "tdd_cycles": [                                // REQUIRED: Detailed test cycles with counts
      {
        "cycle": 1,
        "feature": "User authentication with password validation",
        "test_count": 5,
        "test_cases": [
          "test_auth_valid_credentials",
          "test_auth_invalid_password",
          "test_auth_missing_username",
          "test_auth_account_locked",
          "test_auth_session_created"
        ],
        "implementation_scope": "Implement authenticate() function in src/auth/service.ts lines 20-50 (30 lines)",
        "expected_coverage": ">=90%"
      },
      {
        "cycle": 2,
        "feature": "Session lifecycle management",
        "test_count": 6,
        "test_cases": [
          "test_session_create",
          "test_session_resume_valid",
          "test_session_expire_timeout",
          "test_session_refresh_extend",
          "test_session_revoke_immediate",
          "test_session_concurrent_limit"
        ],
        "implementation_scope": "Implement 3 functions in src/auth/service.ts lines 55-160: [createSession() 55-80, validateToken() 85-105, refreshSession() 110-135, revokeSession() 140-160]",
        "expected_coverage": ">=85%"
      }
    ],
    "focus_paths": ["D:\\project\\src\\path", "./tests/path"],  // Absolute or clear relative paths from project root
    "acceptance": [                                // Success criteria (QUANTIFIED)
      "All 11 tests pass: verify by npm test -- tests/auth/ (exit code 0)",
      "Test coverage >=85%: verify by npm test -- --coverage | grep TOTAL | awk '{print $4}' >= 85",
      "5 functions implemented with proper error handling",
      "3 refactoring improvements applied: code passes npm run lint with 0 warnings"
    ],
    "depends_on": []                               // Task dependencies
  },
  "flow_control": {
    "pre_analysis": [                              // OPTIONAL: Pre-execution checks
      {
        "step": "check_test_framework",
        "action": "Verify test framework",
        "command": "bash(npm list jest)",
        "output_to": "test_framework_info",
        "on_error": "warn"
      }
    ],
    "implementation_approach": [                   // REQUIRED: 3 TDD phases
      {
        "step": 1,
        "title": "RED Phase: Write failing tests",
        "tdd_phase": "red",                        // REQUIRED: Phase identifier
        "description": "Write 11 failing test cases for authentication and session management",
        "modification_points": [
          "Create tests/auth/authentication.test.ts with 5 test cases: [test_auth_valid_credentials, test_auth_invalid_password, test_auth_missing_username, test_auth_account_locked, test_auth_session_created]",
          "Create tests/auth/session.test.ts with 6 test cases: [test_session_create, test_session_resume_valid, test_session_expire_timeout, test_session_refresh_extend, test_session_revoke_immediate, test_session_concurrent_limit]"
        ],
        "logic_flow": [
          "Create test file structure: tests/auth/ directory",
          "Write 5 authentication test cases in authentication.test.ts",
          "Write 6 session management test cases in session.test.ts",
          "Verify all 11 tests fail with expected errors"
        ],
        "acceptance": [
          "11 test cases written: verify by grep -E 'test_.*\\(' tests/auth/*.test.ts | wc -l = 11",
          "All tests fail: npm test -- tests/auth/ exits with non-zero status",
          "Each test has clear assertion and expected failure reason"
        ],
        "depends_on": [],
        "output": "failing_tests"
      },
      {
        "step": 2,
        "title": "GREEN Phase: Implement to pass tests",
        "tdd_phase": "green",                      // REQUIRED: Phase identifier
        "description": "Implement 5 functions (160 lines) in src/auth/service.ts with test-fix cycle",
        "modification_points": [
          "Create src/auth/service.ts implementing 5 functions (160 lines total): [authenticate() 20-50, createSession() 55-80, validateToken() 85-105, refreshSession() 110-135, revokeSession() 140-160]",
          "Create src/auth/models.ts with 2 interfaces: [User, Session]",
          "Create src/auth/utils.ts with 2 helper functions: [hashPassword(), generateToken()]"
        ],
        "logic_flow": [
          "Implement minimal code for 5 functions",
          "Run tests: npm test -- tests/auth/",
          "If fail -> Enter iteration loop (max 3):",
          "  1. Extract failure messages from test output",
          "  2. Use Gemini for bug-fix diagnosis",
          "  3. Apply fixes to failing functions",
          "  4. Rerun tests",
          "If max_iterations reached -> Auto-revert via git reset --hard HEAD"
        ],
        "acceptance": [
          "All 11 tests pass: npm test -- tests/auth/ exits with status 0",
          "5 functions implemented: grep -E '^(export )?function ' src/auth/service.ts | wc -l = 5",
          "Test coverage >=85%: npm test -- --coverage | grep TOTAL | awk '{print $4}' >= 85"
        ],
        "command": "bash(npm test -- tests/auth/)",
        "depends_on": [1],
        "output": "passing_implementation"
      },
      {
        "step": 3,
        "title": "REFACTOR Phase: Improve code quality",
        "tdd_phase": "refactor",                   // REQUIRED: Phase identifier
        "description": "Apply 3 refactoring improvements while maintaining test coverage",
        "modification_points": [
          "Extract validateInput() helper function (12 lines) from authenticate() and createSession()",
          "Merge 2 duplicate error handlers in session.ts into single handleSessionError() function",
          "Add JSDoc comments to 5 public functions: [authenticate(), createSession(), validateToken(), refreshSession(), revokeSession()]"
        ],
        "logic_flow": [
          "Extract validateInput() helper, update 2 call sites",
          "Merge duplicate error handlers, verify 2 usages updated",
          "Add JSDoc to 5 functions with @param, @returns, @throws",
          "Run tests after each refactoring to ensure green state",
          "Run linter: npm run lint (expect 0 warnings)"
        ],
        "acceptance": [
          "All 11 tests still pass: npm test -- tests/auth/ exits with status 0",
          "3 refactorings applied: validateInput() extracted + error handlers merged + 5 JSDoc added",
          "Lint passes: npm run lint exits with 0 warnings",
          "Test coverage maintained >=85%"
        ],
        "command": "bash(npm run lint && npm test)",
        "depends_on": [2],
        "output": "refactored_implementation"
      }
    ],
    "post_completion": [                           // OPTIONAL: Final verification
      {
        "step": "verify_full_tdd_cycle",
        "action": "Confirm complete TDD cycle",
        "command": "bash(npm test && echo 'TDD complete')",
        "output_to": "final_validation",
        "on_error": "fail"
      }
    ],
    "error_handling": {                            // OPTIONAL: Error recovery
      "green_phase_max_iterations": {
        "action": "revert_all_changes",
        "commands": ["bash(git reset --hard HEAD)"],
        "report": "Generate failure report"
      }
    }
  }
}
```

**Key JSON Fields Summary**:
- `meta.tdd_workflow`: Must be `true`
- `meta.max_iterations`: Green phase fix cycle limit (default: 3)
- `meta.use_codex`: Automated fixes (false=manual, true=Codex)
- `flow_control.implementation_approach`: Exactly 3 steps with `tdd_phase`: "red", "green", "refactor"
- `context.tdd_cycles`: Optional detailed test cycle specifications
- `context.parent`: Required for subtasks (IMPL-N.M)

#### IMPL_PLAN.md Structure

Generate IMPL_PLAN.md with 8-section structure:

**Frontmatter** (required fields):
```yaml
---
identifier: WFS-{session-id}
source: "User requirements" | "File: path"
conflict_resolution: .workflow/{session-id}/.process/CONFLICT_RESOLUTION.md  # if exists
context_package: .workflow/{session-id}/.process/context-package.json
context_package_path: .workflow/{session-id}/.process/context-package.json
test_context: .workflow/{session-id}/.process/test-context-package.json  # if exists
workflow_type: "tdd"
verification_history:
  conflict_resolution: "executed | skipped" # based on conflict_risk
  action_plan_verify: "pending"
phase_progression: "brainstorm → context → test_context → conflict_resolution → tdd_planning"
feature_count: N
task_count: N  # ≤10 total
task_breakdown:
  simple_features: K
  complex_features: L
  total_subtasks: M
tdd_workflow: true
---
```

**8 Sections Structure**:

```markdown
# Implementation Plan: {Project Title}

## 1. Summary
- Core requirements and objectives (2-3 paragraphs)
- TDD-specific technical approach

## 2. Context Analysis
- CCW Workflow Context (Phase progression, Quality gates)
- Context Package Summary (Focus paths, Test context)
- Project Profile (Type, Scale, Tech Stack, Timeline)
- Module Structure (Directory tree)
- Dependencies (Primary, Testing, Development)
- Patterns & Conventions

## 3. Brainstorming Artifacts Reference
- Artifact Usage Strategy
  - CONFLICT_RESOLUTION.md (if exists - selected resolution strategies)
  - role analysis documents (primary reference)
  - test-context-package.json (test patterns)
  - context-package.json (smart context)
- Artifact Priority in Development

## 4. Implementation Strategy
- Execution Strategy (TDD Cycles: Red-Green-Refactor)
- Architectural Approach
- Key Dependencies (Task dependency graph)
- Testing Strategy (Coverage targets, Quality gates)

## 5. TDD Implementation Tasks
- Feature-by-Feature TDD Tasks
  - Each task: IMPL-N with internal Red → Green → Refactor
  - Dependencies and complexity metrics
- Complex Feature Examples (when subtasks needed)
- TDD Task Breakdown Summary

## 6. Implementation Plan (Detailed Phased Breakdown)
- Execution Strategy (feature-by-feature sequential)
- Phase breakdown (Phase 1, Phase 2, etc.)
- Resource Requirements (Team, Dependencies, Infrastructure)

## 7. Risk Assessment & Mitigation
- Risk table (Risk, Impact, Probability, Mitigation, Owner)
- Critical Risks (TDD-specific)
- Monitoring Strategy

## 8. Success Criteria
- Functional Completeness
- Technical Quality (Test coverage ≥80%)
- Operational Readiness
- TDD Compliance
```

### Phase 4: TODO_LIST.md Generation

Generate task list with internal TDD phase indicators:

**For Simple Features (1 task per feature)**:
```markdown
## TDD Implementation Tasks

### Feature 1: {Feature Name}
- [ ] **IMPL-1**: Implement {feature} with TDD → [Task](./.task/IMPL-1.json)
  - Internal phases: Red → Green → Refactor
  - Dependencies: None

### Feature 2: {Feature Name}
- [ ] **IMPL-2**: Implement {feature} with TDD → [Task](./.task/IMPL-2.json)
  - Internal phases: Red → Green → Refactor
  - Dependencies: IMPL-1
```

**For Complex Features (with subtasks)**:
```markdown
### Feature 3: {Complex Feature Name}
▸ **IMPL-3**: Implement {complex feature} with TDD → [Task](./.task/IMPL-3.json)
  - [ ] **IMPL-3.1**: {Sub-feature A} with TDD → [Task](./.task/IMPL-3.1.json)
    - Internal phases: Red → Green → Refactor
  - [ ] **IMPL-3.2**: {Sub-feature B} with TDD → [Task](./.task/IMPL-3.2.json)
    - Internal phases: Red → Green → Refactor
    - Dependencies: IMPL-3.1
```

**Status Legend**:
```markdown
## Status Legend
- ▸ = Container task (has subtasks)
- [ ] = Pending task
- [x] = Completed task
- Red = Write failing tests
- Green = Implement to pass tests (with test-fix cycle)
- Refactor = Improve code quality
```

### Phase 5: Session State Update

Update workflow-session.json with TDD metadata:
```json
{
  "workflow_type": "tdd",
  "feature_count": 5,
  "task_count": 5,
  "task_breakdown": {
    "simple_features": 4,
    "complex_features": 1,
    "total_subtasks": 2
  },
  "tdd_workflow": true,
  "task_limit_compliance": true
}
```

**Task Count Calculation**:
- **Simple features**: 1 task each (IMPL-N with internal TDD cycle)
- **Complex features**: 1 container + M subtasks (IMPL-N + IMPL-N.M)
- **Total**: Simple feature count + Complex feature subtask count
- **Example**: 4 simple + 1 complex (with 2 subtasks) = 6 total tasks (not 15)

## Output Files Structure
```
.workflow/{session-id}/
├── IMPL_PLAN.md                     # Unified plan with TDD Implementation Tasks section
├── TODO_LIST.md                     # Progress tracking with internal TDD phase indicators
├── .task/
│   ├── IMPL-1.json                  # Complete TDD task (Red-Green-Refactor internally)
│   ├── IMPL-2.json                  # Complete TDD task
│   ├── IMPL-3.json                  # Complex feature container (if needed)
│   ├── IMPL-3.1.json                # Complex feature subtask (if needed)
│   ├── IMPL-3.2.json                # Complex feature subtask (if needed)
│   └── ...
└── .process/
    ├── CONFLICT_RESOLUTION.md       # Conflict resolution strategies (if conflict_risk ≥ medium)
    ├── test-context-package.json    # Test coverage analysis
    ├── context-package.json         # Input from context-gather
    ├── context_package_path         # Path to smart context package
    └── green-fix-iteration-*.md     # Fix logs from Green phase test-fix cycles
```

**File Count**:
- **Old approach**: 5 features = 15 task JSON files (TEST/IMPL/REFACTOR × 5)
- **New approach**: 5 features = 5 task JSON files (IMPL-N × 5)
- **Complex feature**: 1 feature = 1 container + M subtasks (IMPL-N + IMPL-N.M)

## Validation Rules

### Task Completeness
- Every IMPL-N must contain complete TDD workflow in `flow_control.implementation_approach`
- Each task must have 3 steps with `tdd_phase`: "red", "green", "refactor"
- Every task must have `meta.tdd_workflow: true`

### Dependency Enforcement
- Sequential features: IMPL-N depends_on ["IMPL-(N-1)"] if needed
- Complex feature subtasks: IMPL-N.M depends_on ["IMPL-N.(M-1)"] or parent dependencies
- No circular dependencies allowed

### Task Limits
- Maximum 10 total tasks (simple + subtasks)
- Flat hierarchy (≤5 tasks) or two-level (6-10 tasks with containers)
- Re-scope requirements if >10 tasks needed

### TDD Workflow Validation
- `meta.tdd_workflow` must be true
- `flow_control.implementation_approach` must have exactly 3 steps
- Each step must have `tdd_phase` field ("red", "green", or "refactor")
- Green phase step must include test-fix cycle logic
- `meta.max_iterations` must be present (default: 3)

## Error Handling

### Input Validation Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| Session not found | Invalid session ID | Verify session exists |
| Context missing | Incomplete planning | Run context-gather first |

### TDD Generation Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| Task count exceeds 10 | Too many features or subtasks | Re-scope requirements or merge features |
| Missing test framework | No test config | Configure testing first |
| Invalid TDD workflow | Missing tdd_phase or incomplete flow_control | Fix TDD structure in ANALYSIS_RESULTS.md |
| Missing tdd_workflow flag | Task doesn't have meta.tdd_workflow: true | Add TDD workflow metadata |

## Integration & Usage

### Command Chain
- **Called By**: `/workflow:tdd-plan` (Phase 4)
- **Calls**: Gemini CLI for TDD breakdown
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
Total tasks: 5 (1 task per feature with internal TDD cycles)

Task breakdown:
- Simple features: 4 tasks (IMPL-1 to IMPL-4)
- Complex features: 1 task with 2 subtasks (IMPL-5, IMPL-5.1, IMPL-5.2)
- Total task count: 6 (within 10-task limit)

Structure:
- IMPL-1: User Authentication (Internal: Red → Green → Refactor)
- IMPL-2: Password Reset (Internal: Red → Green → Refactor)
- IMPL-3: Email Verification (Internal: Red → Green → Refactor)
- IMPL-4: Role Management (Internal: Red → Green → Refactor)
- IMPL-5: Payment System (Container)
  - IMPL-5.1: Gateway Integration (Internal: Red → Green → Refactor)
  - IMPL-5.2: Transaction Management (Internal: Red → Green → Refactor)

Plans generated:
- Unified Plan: .workflow/WFS-auth/IMPL_PLAN.md (includes TDD Implementation Tasks section)
- Task List: .workflow/WFS-auth/TODO_LIST.md (with internal TDD phase indicators)

TDD Configuration:
- Each task contains complete Red-Green-Refactor cycle
- Green phase includes test-fix cycle (max 3 iterations)
- Auto-revert on max iterations reached

Next: /workflow:action-plan-verify --session WFS-auth (recommended) or /workflow:execute --session WFS-auth
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
- Faster feedback loop within Green phase
- Autonomous recovery from initial implementation errors
- Systematic debugging with Gemini's bug-fix template
- Safe rollback prevents broken TDD state

## Configuration Options
- **meta.max_iterations**: Number of fix attempts (default: 3 for TDD, 5 for test-gen)
- **meta.use_codex**: Enable Codex automated fixes (default: false, manual)

## Related Commands
- `/workflow:tdd-plan` - Orchestrates TDD workflow planning (6 phases)
- `/workflow:tools:test-context-gather` - Analyzes test coverage
- `/workflow:execute` - Executes TDD tasks in order
- `/workflow:tdd-verify` - Verifies TDD compliance
- `/workflow:test-gen` - Post-implementation test generation
