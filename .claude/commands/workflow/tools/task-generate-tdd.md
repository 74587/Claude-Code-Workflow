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

**Purpose**: Eliminate ambiguity by enforcing explicit test case counts, coverage metrics, and implementation scope.

**Core Rules**:
1. **Explicit Test Case Counts**: Red phase specifies exact number with enumerated list
2. **Quantified Coverage**: Acceptance includes measurable percentage (e.g., ">=85%")
3. **Detailed Implementation Scope**: Green phase enumerates files, functions, line counts
4. **Enumerated Refactoring Targets**: Refactor phase lists specific improvements with counts

**TDD Phase Formats**:
- **Red Phase**: `"Write N test cases: [test1, test2, ...]"`
- **Green Phase**: `"Implement N functions in file lines X-Y: [func1() X1-Y1, func2() X2-Y2, ...]"`
- **Refactor Phase**: `"Apply N refactorings: [improvement1 (details), improvement2 (details), ...]"`
- **Acceptance**: `"All N tests pass with >=X% coverage: verify by [test command]"`

**TDD Cycles Array**: Each cycle must include `test_count`, `test_cases` array, `implementation_scope`, and `expected_coverage`

**Validation Checklist**:
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

Each TDD task JSON contains complete Red-Green-Refactor cycle with these key fields:

**Top-Level Fields**:
- `id`: Task identifier (`IMPL-N` or `IMPL-N.M` for subtasks)
- `title`: Feature description with TDD
- `status`: `pending | in_progress | completed | container`
- `context_package_path`: Path to context package
- `meta`: TDD-specific metadata
- `context`: Requirements, cycles, paths, acceptance
- `flow_control`: Pre-analysis, 3 TDD phases, post-completion, error handling

**Meta Object (TDD-Specific)**:
- `type`: "feature"
- `agent`: "@code-developer"
- `tdd_workflow`: `true` (REQUIRED - enables TDD flow)
- `max_iterations`: Green phase test-fix cycle limit (default: 3)
- `use_codex`: `false` (manual fixes) or `true` (Codex automated fixes)

**Context Object**:
- `requirements`: Quantified feature requirements with TDD phase details
- `tdd_cycles`: Array of test cycles (each with `test_count`, `test_cases`, `implementation_scope`, `expected_coverage`)
- `focus_paths`: Target directories (absolute or relative from project root)
- `acceptance`: Measurable success criteria with verification commands
- `depends_on`: Task dependencies
- `parent`: Parent task ID (for subtasks only)

**Flow Control Object**:
- `pre_analysis`: Optional pre-execution checks
- `implementation_approach`: Exactly 3 steps with `tdd_phase` field:
  1. **Red Phase** (`tdd_phase: "red"`): Write failing tests
  2. **Green Phase** (`tdd_phase: "green"`): Implement to pass tests (includes test-fix cycle)
  3. **Refactor Phase** (`tdd_phase: "refactor"`): Improve code quality
- `post_completion`: Optional final verification
- `error_handling`: Error recovery strategies (e.g., auto-revert on max iterations)

**Implementation Approach Step Structure**:
Each step includes:
- `step`: Step number
- `title`: Phase description
- `tdd_phase`: Phase identifier ("red" | "green" | "refactor")
- `description`: Detailed phase description
- `modification_points`: Quantified changes to make
- `logic_flow`: Step-by-step execution logic
- `acceptance`: Phase-specific acceptance criteria
- `command`: Test/verification command (optional)
- `depends_on`: Previous step dependencies
- `output`: Step output identifier

#### IMPL_PLAN.md Structure

**Frontmatter** (TDD-specific fields):
- `workflow_type`: "tdd"
- `tdd_workflow`: true
- `feature_count`, `task_count` (≤10 total)
- `task_breakdown`: simple_features, complex_features, total_subtasks
- `test_context`: Path to test-context-package.json (if exists)
- `conflict_resolution`: Path to CONFLICT_RESOLUTION.md (if exists)
- `verification_history`, `phase_progression`

**8 Sections**:
1. **Summary**: Core requirements, TDD-specific approach
2. **Context Analysis**: CCW workflow context, project profile, module structure, dependencies
3. **Brainstorming Artifacts Reference**: Artifact usage strategy, priority order
4. **Implementation Strategy**: TDD cycles (Red-Green-Refactor), architectural approach, testing strategy
5. **TDD Implementation Tasks**: Feature-by-feature tasks with internal TDD cycles, dependencies
6. **Implementation Plan**: Phased breakdown, resource requirements
7. **Risk Assessment & Mitigation**: Risk table, TDD-specific risks, monitoring
8. **Success Criteria**: Functional completeness, technical quality (≥80% coverage), TDD compliance

### Phase 4: TODO_LIST.md Generation

Generate task list with internal TDD phase indicators:

**Structure**:
- Simple features: `- [ ] **IMPL-N**: Feature with TDD` (Internal phases: Red → Green → Refactor)
- Complex features: `▸ **IMPL-N**: Container` with subtasks `- [ ] **IMPL-N.M**: Sub-feature`

**Status Legend**:
- `▸` = Container task (has subtasks)
- `[ ]` = Pending | `[x]` = Completed
- Red → Green → Refactor = TDD phases

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

**Command Chain**:
- Called by: `/workflow:tdd-plan` (Phase 4)
- Calls: Gemini CLI for TDD breakdown
- Followed by: `/workflow:execute`, `/workflow:tdd-verify`

**Basic Usage**:
```bash
# Manual mode (default)
/workflow:tools:task-generate-tdd --session WFS-auth

# Agent mode (autonomous task generation)
/workflow:tools:task-generate-tdd --session WFS-auth --agent
```

**Output**:
- Task JSON files in `.task/` directory (IMPL-N.json format)
- IMPL_PLAN.md with TDD Implementation Tasks section
- TODO_LIST.md with internal TDD phase indicators
- Session state updated with task count and TDD metadata

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
