---
name: test-gen
description: Create independent test-fix workflow session from completed implementation session, analyzes code to generate test tasks
argument-hint: "[--use-codex] [--cli-execute] source-session-id"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
---

# Workflow Test Generation Command (/workflow:test-gen)

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

**Command Scope**: This command ONLY prepares test workflow artifacts. It does NOT execute tests or implementation. Task execution requires separate user action.

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 test session creation
2. **No Preliminary Analysis**: Do not read files or analyze before Phase 1
3. **Parse Every Output**: Extract required data from each phase for next phase
4. **Sequential Execution**: Each phase depends on previous phase's output
5. **Complete All Phases**: Do not return to user until Phase 5 completes (summary returned)
6. **Track Progress**: Update TodoWrite after every phase completion
7. **Automatic Detection**: context-gather auto-detects test session and gathers source session context
8. **Parse --use-codex Flag**: Extract flag from arguments and pass to Phase 4 (test-task-generate)
9. **Command Boundary**: This command ends at Phase 5 summary. Test execution is NOT part of this command.

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
- Generate **TWO task JSON files**:
  - **IMPL-001.json**: Test Generation task (calls @code-developer)
  - **IMPL-002.json**: Test Execution and Fix Cycle task (calls @test-fix-agent)
- Generate IMPL_PLAN.md with test generation and execution strategy
- Generate TODO_LIST.md with both tasks

**Parse Output**:
- Verify `.workflow/[testSessionId]/.task/IMPL-001.json` exists (test generation)
- Verify `.workflow/[testSessionId]/.task/IMPL-002.json` exists (test execution & fix)
- Verify `.workflow/[testSessionId]/IMPL_PLAN.md` created
- Verify `.workflow/[testSessionId]/TODO_LIST.md` created

**Validation - IMPL-001.json (Test Generation)**:
- Task ID: `IMPL-001`
- `meta.type: "test-gen"`
- `meta.agent: "@code-developer"`
- `context.requirements`: Generate tests based on TEST_ANALYSIS_RESULTS.md
- `flow_control.pre_analysis`: Load TEST_ANALYSIS_RESULTS.md and test context
- `flow_control.implementation_approach`: Test generation steps
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

### Phase 5: Return Summary (Command Ends Here)

**Important**: This is the final phase of `/workflow:test-gen`. The command completes and returns control to the user. No automatic execution occurs.

**Return to User**:
```
Test workflow preparation complete!

Source Session: [sourceSessionId]
Test Session: [testSessionId]

Artifacts Created:
- Test context analysis
- Test generation strategy
- Task definitions (IMPL-001, IMPL-002)
- Implementation plan

Test Framework: [detected framework]
Test Files to Generate: [count]
Fix Mode: [Manual|Codex Automated] (based on --use-codex flag)

Review Generated Artifacts:
- Test plan: .workflow/[testSessionId]/IMPL_PLAN.md
- Task list: .workflow/[testSessionId]/TODO_LIST.md
- Analysis: .workflow/[testSessionId]/.process/TEST_ANALYSIS_RESULTS.md

Ready for execution. Use appropriate workflow commands to proceed.
```

**TodoWrite**: Mark phase 5 completed

**Command Boundary**: After this phase, the command terminates and returns to user prompt.

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

```
┌─────────────────────────────────────────────────────────┐
│ /workflow:test-gen WFS-user-auth                        │
├─────────────────────────────────────────────────────────┤
│ Phase 1: session-start → WFS-test-user-auth            │
│   ↓                                                     │
│ Phase 2: test-context-gather → test-context-package.json│
│   ↓                                                     │
│ Phase 3: test-concept-enhanced → TEST_ANALYSIS_RESULTS.md│
│   ↓                                                     │
│ Phase 4: test-task-generate → IMPL-001.json + IMPL-002.json│
│   ↓                                                     │
│ Phase 5: Return summary                                │
└─────────────────────────────────────────────────────────┘
         COMMAND ENDS - Control returns to user

Artifacts Created:
├── .workflow/WFS-test-[session]/
│   ├── workflow-session.json
│   ├── IMPL_PLAN.md
│   ├── TODO_LIST.md
│   ├── .task/
│   │   ├── IMPL-001.json (test generation task)
│   │   └── IMPL-002.json (test execution task)
│   └── .process/
│       ├── test-context-package.json
│       └── TEST_ANALYSIS_RESULTS.md
```

## Session Metadata

Test session includes `workflow_type: "test_session"` and `source_session_id` for automatic context gathering.

## Task Output

Generates two task definition files:
- **IMPL-001.json**: Test generation task specification
  - Agent: @code-developer
  - Input: TEST_ANALYSIS_RESULTS.md
  - Output: Test files based on analysis
- **IMPL-002.json**: Test execution and fix cycle specification
  - Agent: @test-fix-agent
  - Dependency: IMPL-001 must complete first
  - Max iterations: 5
  - Fix mode: Manual or Codex (based on --use-codex flag)

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
- `.task/IMPL-001.json` - Test generation task
- `.task/IMPL-002.json` - Test execution & fix task
- `IMPL_PLAN.md` - Test plan
- `TODO_LIST.md` - Task checklist

## Task Specifications

**IMPL-001.json Structure**:
- `meta.type: "test-gen"`
- `meta.agent: "@code-developer"`
- `context.requirements`: Generate tests based on TEST_ANALYSIS_RESULTS.md
- `flow_control.target_files`: Test files to create
- `flow_control.implementation_approach`: Test generation strategy

**IMPL-002.json Structure**:
- `meta.type: "test-fix"`
- `meta.agent: "@test-fix-agent"`
- `meta.use_codex`: true/false (based on --use-codex flag)
- `context.depends_on: ["IMPL-001"]`
- `flow_control.implementation_approach.test_fix_cycle`: Complete cycle specification
  - Gemini diagnosis template
  - Fix application mode (manual/codex)
  - Max iterations: 5
- `flow_control.implementation_approach.modification_points`: 3-phase flow

See `/workflow:tools:test-task-generate` for complete JSON schemas.

## Best Practices

1. **Prerequisites**: Ensure source session has completed IMPL tasks with summaries
2. **Clean State**: Commit implementation changes before running test-gen
3. **Review Artifacts**: Check generated IMPL_PLAN.md and TODO_LIST.md before proceeding
4. **Understand Scope**: This command only prepares artifacts; it does not execute tests

## Related Commands

**Prerequisite Commands**:
- `/workflow:plan` or `/workflow:execute` - Complete implementation session that needs test validation

**Called by This Command** (5 phases):
- `/workflow:session:start` - Phase 1: Create independent test workflow session
- `/workflow:tools:test-context-gather` - Phase 2: Analyze test coverage and gather source session context
- `/workflow:tools:test-concept-enhanced` - Phase 3: Generate test requirements and strategy using Gemini
- `/workflow:tools:test-task-generate` - Phase 4: Generate test generation and execution task JSONs
- `/workflow:tools:test-task-generate --use-codex` - Phase 4: With automated Codex fixes (when `--use-codex` flag used)
- `/workflow:tools:test-task-generate --cli-execute` - Phase 4: With CLI execution mode (when `--cli-execute` flag used)

**Follow-up Commands**:
- `/workflow:status` - Review generated test tasks
- `/workflow:test-cycle-execute` - Execute test generation and fix cycles
- `/workflow:execute` - Execute generated test tasks