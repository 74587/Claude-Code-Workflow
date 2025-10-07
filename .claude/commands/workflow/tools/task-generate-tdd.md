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

Generate single comprehensive IMPL_PLAN.md with enhanced 8-section structure:

**Frontmatter**:
```yaml
---
identifier: WFS-{session-id}
source: "User requirements" | "File: path" | "Issue: ISS-001"
analysis: .workflow/{session-id}/.process/ANALYSIS_RESULTS.md
artifacts: .workflow/{session-id}/.brainstorming/
context_package: .workflow/{session-id}/.process/context-package.json  # CCW smart context
workflow_type: "tdd"  # TDD-specific workflow
verification_history:  # CCW quality gates
  concept_verify: "passed | skipped | pending"
  action_plan_verify: "pending"
phase_progression: "brainstorm → context → test_context → analysis → concept_verify → tdd_planning"  # TDD workflow phases
feature_count: N
task_count: 3N
tdd_chains: N
---
```

**Complete Structure** (8 Sections):

```markdown
# Implementation Plan: {Project Title}

## 1. Summary
Core requirements, objectives, and TDD-specific technical approach (2-3 paragraphs max).

**Core Objectives**:
- [Key objective 1]
- [Key objective 2]

**Technical Approach**:
- TDD-driven development with Red-Green-Refactor cycles
- [Other high-level approaches]

## 2. Context Analysis

### CCW Workflow Context
**Phase Progression** (TDD-specific):
- ✅ Phase 1: Brainstorming (synthesis-specification.md generated)
- ✅ Phase 2: Context Gathering (context-package.json: {N} files, {M} modules analyzed)
- ✅ Phase 3: Test Coverage Analysis (test-context-package.json: existing test patterns identified)
- ✅ Phase 4: TDD Analysis (ANALYSIS_RESULTS.md: test-first requirements with Gemini/Qwen insights)
- ✅ Phase 5: Concept Verification ({X} clarifications answered, test requirements clarified | skipped)
- ⏳ Phase 6: TDD Task Generation (current phase - generating IMPL_PLAN.md with TDD chains)

**Quality Gates**:
- concept-verify: ✅ Passed (test requirements clarified, 0 ambiguities) | ⏭️ Skipped (user decision) | ⏳ Pending
- action-plan-verify: ⏳ Pending (recommended before /workflow:execute for TDD dependency validation)

**Context Package Summary**:
- **Focus Paths**: {list key directories from context-package.json}
- **Key Files**: {list primary files for modification}
- **Test Context**: {existing test patterns, coverage baseline, test framework detected}
- **Module Depth Analysis**: {from get_modules_by_depth.sh output}
- **Smart Context**: {total file count} files, {module count} modules, {test file count} tests identified

### Project Profile
- **Type**: Greenfield/Enhancement/Refactor
- **Scale**: User count, data volume, complexity
- **Tech Stack**: Primary technologies
- **Timeline**: Duration and milestones
- **TDD Framework**: Testing framework and tools

### Module Structure
```
[Directory tree showing key modules and test directories]
```

### Dependencies
**Primary**: [Core libraries and frameworks]
**Testing**: [Test framework, mocking libraries]
**Development**: [Linting, CI/CD tools]

### Patterns & Conventions
- **Architecture**: [Key patterns]
- **Testing Patterns**: [Unit, integration, E2E patterns]
- **Code Style**: [Naming, TypeScript coverage]

## 3. Brainstorming Artifacts Reference

### Artifact Usage Strategy
**Primary Reference (synthesis-specification.md)**:
- **What**: Comprehensive implementation blueprint from multi-role synthesis
- **When**: Every TDD task (TEST/IMPL/REFACTOR) references this for requirements and acceptance criteria
- **How**: Extract testable requirements, architecture decisions, expected behaviors
- **Priority**: Authoritative - defines what to test and how to implement
- **CCW Value**: Consolidates insights from all brainstorming roles into single source of truth for TDD

**Context Intelligence (context-package.json & test-context-package.json)**:
- **What**: Smart context from CCW's context-gather and test-context-gather phases
- **Content**: Focus paths, dependency graph, existing test patterns, test framework configuration
- **Usage**: RED phase loads test patterns, GREEN phase loads implementation context
- **CCW Value**: Automated discovery of existing tests and patterns for TDD consistency

**Technical Analysis (ANALYSIS_RESULTS.md)**:
- **What**: Gemini/Qwen parallel analysis with TDD-specific breakdown
- **Content**: Testable requirements, test scenarios, implementation strategies, risk assessment
- **Usage**: RED phase references test cases, GREEN phase references implementation approach
- **CCW Value**: Multi-model analysis providing comprehensive TDD guidance

### Integrated Specifications (Highest Priority)
- **synthesis-specification.md**: Comprehensive implementation blueprint
  - Contains: Architecture design, functional/non-functional requirements

### Supporting Artifacts (Reference)
- **topic-framework.md**: Discussion framework
- **system-architect/analysis.md**: Architecture specifications
- **Role-specific analyses**: [Other relevant analyses]

**Artifact Priority in Development**:
1. synthesis-specification.md (primary reference for test cases and implementation)
2. test-context-package.json (existing test patterns for TDD consistency)
3. context-package.json (smart context for execution environment)
4. ANALYSIS_RESULTS.md (technical analysis with TDD breakdown)
5. Role-specific analyses (supplementary)

## 4. Implementation Strategy

### Execution Strategy
**Execution Model**: TDD Cycles (Red-Green-Refactor)

**Rationale**: Test-first approach ensures correctness and reduces bugs

**TDD Cycle Pattern**:
- RED: Write failing test
- GREEN: Implement minimal code to pass (with test-fix cycle if needed)
- REFACTOR: Improve code quality while keeping tests green

**Parallelization Opportunities**:
- [Independent features that can be developed in parallel]

### Architectural Approach
**Key Architecture Decisions**:
- [ADR references from synthesis]
- [TDD-compatible architecture patterns]

**Integration Strategy**:
- [How modules communicate]
- [Test isolation strategy]

### Key Dependencies
**Task Dependency Graph**:
```
Feature 1:
  TEST-1.1 (RED)
      ↓
  IMPL-1.1 (GREEN) [with test-fix cycle]
      ↓
  REFACTOR-1.1 (REFACTOR)

Feature 2:
  TEST-2.1 (RED) [depends on REFACTOR-1.1 if related]
      ↓
  IMPL-2.1 (GREEN)
      ↓
  REFACTOR-2.1 (REFACTOR)
```

**Critical Path**: [Identify bottleneck features]

### Testing Strategy
**TDD Testing Approach**:
- Unit testing: Each feature has comprehensive unit tests
- Integration testing: Cross-feature integration
- E2E testing: Critical user flows after all TDD cycles

**Coverage Targets**:
- Lines: ≥80% (TDD ensures high coverage)
- Functions: ≥80%
- Branches: ≥75%

**Quality Gates**:
- All tests must pass before moving to next phase
- Refactor phase must maintain test success

## 5. TDD Task Chains (TDD-Specific Section)

### Feature-by-Feature TDD Chains

**Feature 1: {Feature Name}**
```
🔴 TEST-1.1: Write failing test for {feature}
    ↓
🟢 IMPL-1.1: Implement to pass tests (includes test-fix cycle: max 3 iterations)
    ↓
🔵 REFACTOR-1.1: Refactor implementation while keeping tests green
```

**Feature 2: {Feature Name}**
```
🔴 TEST-2.1: Write failing test for {feature}
    ↓
🟢 IMPL-2.1: Implement to pass tests (includes test-fix cycle)
    ↓
🔵 REFACTOR-2.1: Refactor implementation
```

[Continue for all N features]

### TDD Task Breakdown Summary
- **Total Features**: {N}
- **Total Tasks**: {3N} (N TEST + N IMPL + N REFACTOR)
- **TDD Chains**: {N}

## 6. Implementation Plan (Detailed Phased Breakdown)

### Execution Strategy

**TDD Cycle Execution**: Feature-by-feature sequential TDD cycles

**Phase 1 (Weeks 1-2): Foundation Features**
- **Features**: Feature 1, Feature 2
- **Tasks**: TEST-1.1, IMPL-1.1, REFACTOR-1.1, TEST-2.1, IMPL-2.1, REFACTOR-2.1
- **Deliverables**:
  - Complete TDD cycles for foundation features
  - All tests passing
- **Success Criteria**:
  - ≥80% test coverage
  - All RED-GREEN-REFACTOR cycles completed

**Phase 2 (Weeks 3-N): Advanced Features**
[Continue with remaining features]

### Resource Requirements

**Development Team**:
- [Team composition with TDD experience]

**External Dependencies**:
- [Testing frameworks, mocking services]

**Infrastructure**:
- [CI/CD with test automation]

## 7. Risk Assessment & Mitigation

| Risk | Impact | Probability | Mitigation Strategy | Owner |
|------|--------|-------------|---------------------|-------|
| Tests fail repeatedly in GREEN phase | High | Medium | Test-fix cycle (max 3 iterations) with auto-revert | Dev Team |
| Complex features hard to test | High | Medium | Break down into smaller testable units | Architect |
| [Other risks] | Med/Low | Med/Low | [Strategies] | [Owner] |

**Critical Risks** (TDD-Specific):
- **GREEN phase failures**: Mitigated by test-fix cycle with Gemini diagnosis
- **Test coverage gaps**: Mitigated by TDD-first approach ensuring tests before code

**Monitoring Strategy**:
- Track TDD cycle completion rate
- Monitor test success rate per iteration

## 8. Success Criteria

**Functional Completeness**:
- [ ] All features implemented through TDD cycles
- [ ] All RED-GREEN-REFACTOR cycles completed successfully

**Technical Quality**:
- [ ] Test coverage ≥80% (ensured by TDD)
- [ ] All tests passing (GREEN state achieved)
- [ ] Code refactored for quality (REFACTOR phase completed)

**Operational Readiness**:
- [ ] CI/CD pipeline with automated test execution
- [ ] Test failure alerting configured

**TDD Compliance**:
- [ ] Every feature has TEST → IMPL → REFACTOR chain
- [ ] No implementation without tests (RED-first principle)
- [ ] Refactoring did not break tests
```

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
