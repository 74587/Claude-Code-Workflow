---
name: test-fix-gen
description: Create independent test-fix workflow session by analyzing completed implementation
argument-hint: "[--use-codex] [--cli-execute] source-session-id"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
---

# Workflow Test-Fix Generation Command (/workflow:test-fix-gen)

## Coordinator Role

**This command is a pure orchestrator**: Creates an independent test-fix workflow session for validating a completed implementation. It reuses the standard planning toolchain with automatic cross-session context gathering.

**Core Principles**:
- **Session Isolation**: Creates new `WFS-test-[source]` session to keep verification separate from implementation
- **Context-First**: Prioritizes gathering code changes and summaries from source session
- **Format Reuse**: Creates standard `IMPL-*.json` task, using `meta.type: "test-fix"` for agent assignment
- **Parameter Simplification**: Tools auto-detect test session type via metadata, no manual cross-session parameters needed
- **Manual First**: Default to manual fixes, use `--use-codex` flag for automated Codex fix application

**Execution Flow**:
1. Initialize TodoWrite → Create test session → Parse session ID
2. Gather cross-session context (automatic) → Parse context path
3. Analyze implementation with concept-enhanced → Parse ANALYSIS_RESULTS.md
4. Generate test task from analysis → Return summary

**⚠️ Command Scope**: This command prepares test workflow artifacts only. Task execution requires separate commands.

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 test session creation
2. **No Preliminary Analysis**: Do not read files or analyze before Phase 1
3. **Parse Every Output**: Extract required data from each phase for next phase
4. **Sequential Execution**: Each phase depends on previous phase's output
5. **Complete All Phases**: Do not return to user until Phase 5 completes (command ends after summary)
6. **Track Progress**: Update TodoWrite after every phase completion
7. **Automatic Detection**: context-gather auto-detects test session and gathers source session context
8. **Parse --use-codex Flag**: Extract flag from arguments and pass to Phase 4 (test-task-generate)

## 5-Phase Execution

### Phase 1: Create Test Session
**Command**: `SlashCommand(command="/workflow:session:start --new \"Test validation for [sourceSessionId]\"")`

**Input**: `sourceSessionId` from user argument (e.g., `WFS-user-auth`)

**Expected Behavior**:
- Creates new session with pattern `WFS-test-[source-slug]` (e.g., `WFS-test-user-auth`)
- Writes metadata to `workflow-session.json`:
  - `workflow_type: "test_session"`
  - `source_session_id: "[sourceSessionId]"`
- Returns new session ID for subsequent phases

**Parse Output**:
- Extract: new test session ID (store as `testSessionId`)
- Pattern: `WFS-test-[slug]`

**Validation**:
- Source session `.workflow/[sourceSessionId]/` exists
- Source session has completed IMPL tasks (`.summaries/IMPL-*-summary.md`)
- New test session directory created
- Metadata includes `workflow_type` and `source_session_id`

**TodoWrite**: Mark phase 1 completed, phase 2 in_progress

---

### Phase 2: Gather Test Context
**Command**: `SlashCommand(command="/workflow:tools:test-context-gather --session [testSessionId]")`

**Input**: `testSessionId` from Phase 1 (e.g., `WFS-test-user-auth`)

**Expected Behavior**:
- Load source session implementation context and summaries
- Analyze test coverage using MCP tools (find existing tests)
- Identify files requiring tests (coverage gaps)
- Detect test framework and conventions
- Generate `test-context-package.json`

**Parse Output**:
- Extract: test context package path (store as `testContextPath`)
- Pattern: `.workflow/[testSessionId]/.process/test-context-package.json`

**Validation**:
- Test context package created
- Contains source session summaries
- Includes coverage gap analysis
- Test framework detected
- Test conventions documented

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

---

### Phase 3: Test Generation Analysis
**Command**: `SlashCommand(command="/workflow:tools:test-concept-enhanced --session [testSessionId] --context [testContextPath]")`

**Input**:
- `testSessionId` from Phase 1
- `testContextPath` from Phase 2

**Expected Behavior**:
- Use Gemini to analyze coverage gaps and implementation context
- Study existing test patterns and conventions
- Generate test requirements for each missing test file
- Design test generation strategy
- Generate `TEST_ANALYSIS_RESULTS.md`

**Parse Output**:
- Verify `.workflow/[testSessionId]/.process/TEST_ANALYSIS_RESULTS.md` created
- Contains test requirements and generation strategy
- Lists test files to create with specifications

**Validation**:
- TEST_ANALYSIS_RESULTS.md exists with complete sections:
  - Coverage Assessment
  - Test Framework & Conventions
  - Test Requirements by File
  - Test Generation Strategy
  - Implementation Targets (test files to create)
  - Success Criteria

**TodoWrite**: Mark phase 3 completed, phase 4 in_progress

---

### Phase 4: Generate Test Tasks
**Command**: `SlashCommand(command="/workflow:tools:test-task-generate [--use-codex] [--cli-execute] --session [testSessionId]")`

**Input**:
- `testSessionId` from Phase 1
- `--use-codex` flag (if present in original command) - Controls IMPL-002 fix mode
- `--cli-execute` flag (if present in original command) - Controls IMPL-001 generation mode

**Expected Behavior**:
- Parse TEST_ANALYSIS_RESULTS.md from Phase 3
- Extract test requirements and generation strategy
- Generate **task JSON files** (minimum 2, expandable based on complexity):
  - **IMPL-001.json**: Test Understanding & Generation task (calls @code-developer)
    - Understand source code implementation
    - Analyze test requirements from TEST_ANALYSIS_RESULTS.md
    - Generate test files following existing patterns
  - **IMPL-002.json**: Test Execution and Fix Cycle task (calls @test-fix-agent)
  - **IMPL-003+**: Additional tasks if needed (e.g., per-module test generation for complex projects)
- Generate IMPL_PLAN.md with test generation and execution strategy
- Generate TODO_LIST.md with all tasks

**Parse Output**:
- Verify `.workflow/[testSessionId]/.task/IMPL-001.json` exists (test understanding & generation)
- Verify `.workflow/[testSessionId]/.task/IMPL-002.json` exists (test execution & fix)
- Verify additional `.task/IMPL-*.json` files if complex project requires multi-task breakdown
- Verify `.workflow/[testSessionId]/IMPL_PLAN.md` created
- Verify `.workflow/[testSessionId]/TODO_LIST.md` created

**Validation - IMPL-001.json (Test Understanding & Generation)**:
- Task ID: `IMPL-001`
- `meta.type: "test-gen"`
- `meta.agent: "@code-developer"`
- `context.requirements`: Understand source implementation and generate tests
- `flow_control.pre_analysis`:
  - Load TEST_ANALYSIS_RESULTS.md and test context
  - Understand source code implementation patterns
  - Analyze test requirements and existing test conventions
- `flow_control.implementation_approach`:
  - Phase 1: Understand source code and identify test scenarios
  - Phase 2: Generate test files following existing patterns
  - Phase 3: Verify test completeness
- `flow_control.target_files`: Test files to create from analysis section 5

**Validation - IMPL-002.json (Test Execution & Fix)**:
- Task ID: `IMPL-002`
- `meta.type: "test-fix"`
- `meta.agent: "@test-fix-agent"`
- `meta.use_codex: true|false` (based on --use-codex flag)
- `context.depends_on: ["IMPL-001"]`
- `context.requirements`: Execute and fix tests
- `flow_control.implementation_approach.test_fix_cycle`: Complete cycle specification
  - **Cycle pattern**: test → gemini_diagnose → manual_fix (or codex if --use-codex) → retest
  - **Tools configuration**: Gemini for analysis with bug-fix template, manual or Codex for fixes
  - **Exit conditions**: Success (all pass) or failure (max iterations)
- `flow_control.implementation_approach.modification_points`: 3-phase execution flow
  - Phase 1: Initial test execution
  - Phase 2: Iterative Gemini diagnosis + manual/Codex fixes (based on flag)
  - Phase 3: Final validation and certification

**TodoWrite**: Mark phase 4 completed, phase 5 in_progress

---

### Phase 5: Return Summary to User

**Return to User**:
```
Independent test-fix workflow created successfully!

Source Session: [sourceSessionId]
Test Session: [testSessionId]

Tasks Created:
- IMPL-001: Test Understanding & Generation (@code-developer)
- IMPL-002: Test Execution & Fix Cycle (@test-fix-agent)
- [Additional tasks if applicable]

Test Framework: [detected framework]
Test Files to Generate: [count]
Max Fix Iterations: 5
Fix Mode: [Manual|Codex Automated] (based on --use-codex flag)

Review artifacts:
- Test plan: .workflow/[testSessionId]/IMPL_PLAN.md
- Task list: .workflow/[testSessionId]/TODO_LIST.md
```

**TodoWrite**: Mark phase 5 completed

**Note**: Command completes here. Task execution requires separate workflow commands.

---

## TodoWrite Pattern

Track progress through 5 phases:

```javascript
TodoWrite({todos: [
  {"content": "Create independent test session", "status": "in_progress|completed", "activeForm": "Creating test session"},
  {"content": "Gather test coverage context", "status": "pending|in_progress|completed", "activeForm": "Gathering test coverage context"},
  {"content": "Analyze test requirements with Gemini", "status": "pending|in_progress|completed", "activeForm": "Analyzing test requirements"},
  {"content": "Generate test generation and execution tasks", "status": "pending|in_progress|completed", "activeForm": "Generating test tasks"},
  {"content": "Return workflow summary", "status": "pending|in_progress|completed", "activeForm": "Returning workflow summary"}
]})
```

Update status to `in_progress` when starting each phase, mark `completed` when done.

## Data Flow

**Command**: `/workflow:test-fix-gen WFS-user-auth`

**Phase Execution**:
1. Phase 1: session-start → WFS-test-user-auth
2. Phase 2: test-context-gather → test-context-package.json
3. Phase 3: test-concept-enhanced → TEST_ANALYSIS_RESULTS.md
4. Phase 4: test-task-generate → IMPL-001.json + IMPL-002.json (+ additional tasks if needed)
5. Phase 5: Return summary

**Command completes after Phase 5**

**Artifacts Created**:
- `.workflow/WFS-test-[session]/workflow-session.json`
- `.workflow/WFS-test-[session]/IMPL_PLAN.md`
- `.workflow/WFS-test-[session]/TODO_LIST.md`
- `.workflow/WFS-test-[session]/.task/IMPL-001.json` (test understanding & generation)
- `.workflow/WFS-test-[session]/.task/IMPL-002.json` (test execution & fix)
- `.workflow/WFS-test-[session]/.task/IMPL-*.json` (additional tasks if needed)
- `.workflow/WFS-test-[session]/.process/test-context-package.json`
- `.workflow/WFS-test-[session]/.process/TEST_ANALYSIS_RESULTS.md`

## Session Metadata

Test session includes `workflow_type: "test_session"` and `source_session_id` for automatic context gathering.

## Task Output

Generates tasks (minimum 2, expandable based on complexity):
- **IMPL-001** (@code-developer): Understand source implementation and generate tests
  - Analyze source code patterns
  - Study test requirements from TEST_ANALYSIS_RESULTS.md
  - Generate test files following conventions
- **IMPL-002** (@test-fix-agent): Test execution with iterative fix cycle (max 5 iterations)
- **IMPL-003+** (optional): Additional tasks for complex scenarios
  - Per-module test generation for large projects
  - Separate integration vs unit test tasks
  - Specialized test types (performance, security, etc.)

See `/workflow:tools:test-task-generate` for complete task JSON schemas.

## Error Handling

| Phase | Error | Action |
|-------|-------|--------|
| 1 | Source session not found | Return error with source session ID |
| 1 | No completed IMPL tasks | Return error, source incomplete |
| 2 | Context gathering failed | Return error, check source artifacts |
| 3 | Analysis failed | Return error, check context package |
| 4 | Task generation failed | Retry once, then error with details |

## Output Files

Created in `.workflow/WFS-test-[session]/`:
- `workflow-session.json` - Session metadata
- `.process/test-context-package.json` - Coverage analysis
- `.process/TEST_ANALYSIS_RESULTS.md` - Test requirements
- `.task/IMPL-001.json` - Test understanding & generation task
- `.task/IMPL-002.json` - Test execution & fix task
- `.task/IMPL-*.json` - Additional tasks (if complex project requires breakdown)
- `IMPL_PLAN.md` - Test plan
- `TODO_LIST.md` - Task checklist

## Agent Execution

**IMPL-001** (@code-developer):
1. **Understand Phase**:
   - Analyze source code implementation patterns
   - Study test requirements from TEST_ANALYSIS_RESULTS.md
   - Identify test scenarios and edge cases
2. **Generation Phase**:
   - Generate test files following existing patterns and conventions
   - Ensure test coverage aligns with requirements
3. **Verification Phase**:
   - Verify test completeness and correctness

**IMPL-002** (@test-fix-agent):
1. Run test suite
2. Iterative fix cycle (max 5):
   - Gemini diagnosis with bug-fix template → surgical fix suggestions
   - Manual fix application (default) OR Codex applies fixes if --use-codex flag (resume mechanism)
   - Retest and check regressions
3. Final validation and certification

**IMPL-003+** (optional, @code-developer or specialized agents):
- Additional task execution based on specific requirements
- May involve different test types or module-specific generation

See `/workflow:tools:test-task-generate` for detailed specifications.

## Best Practices

1. Run after implementation complete (ensure source session has summaries)
2. Commit implementation changes before running test-fix-gen
3. Review generated IMPL_PLAN.md before proceeding with execution
4. Monitor iteration logs in `.process/fix-iteration-*`

## Related Commands

- `/workflow:tools:test-context-gather` - Phase 2 (coverage analysis)
- `/workflow:tools:test-concept-enhanced` - Phase 3 (Gemini test analysis)
- `/workflow:tools:test-task-generate` - Phase 4 (task generation)
- `/workflow:test-cycle-execute` - Execute test-fix workflow with dynamic iteration
- `/workflow:execute` - Execute standard workflow tasks
- `/workflow:status` - Check progress
