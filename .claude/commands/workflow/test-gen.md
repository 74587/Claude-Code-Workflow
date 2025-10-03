---
name: test-gen
description: Create independent test-fix workflow session by analyzing completed implementation
usage: /workflow:test-gen <source-session-id>
argument-hint: "<source-session-id>"
examples:
  - /workflow:test-gen WFS-user-auth
  - /workflow:test-gen WFS-api-refactor
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

**Execution Flow**:
1. Initialize TodoWrite → Create test session → Parse session ID
2. Gather cross-session context (automatic) → Parse context path
3. Analyze implementation with concept-enhanced → Parse ANALYSIS_RESULTS.md
4. Generate test task from analysis → Return summary

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 test session creation
2. **No Preliminary Analysis**: Do not read files or analyze before Phase 1
3. **Parse Every Output**: Extract required data from each phase for next phase
4. **Sequential Execution**: Each phase depends on previous phase's output
5. **Complete All Phases**: Do not return to user until Phase 4 completes (execution triggered separately)
6. **Track Progress**: Update TodoWrite after every phase completion
7. **Automatic Detection**: context-gather auto-detects test session and gathers source session context

## 4-Phase Execution

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

### Phase 2: Gather Cross-Session Context
**Command**: `SlashCommand(command="/workflow:tools:context-gather --session [testSessionId]")`

**Input**: `testSessionId` from Phase 1 (e.g., `WFS-test-user-auth`)

**Automatic Detection**:
- context-gather reads `.workflow/[testSessionId]/workflow-session.json`
- Detects `workflow_type: "test_session"`
- Automatically uses `source_session_id` to gather source session context
- No need for manual `--source-session` parameter

**Cross-Session Context Collection** (Automatic):
- Implementation summaries: `.workflow/[sourceSessionId]/.summaries/IMPL-*-summary.md`
- Code changes: `git log --since=[source_session_created_at]` for changed files
- Original plan: `.workflow/[sourceSessionId]/IMPL_PLAN.md`
- Test files: Discovered via MCP code-index tools

**Parse Output**:
- Extract: context package path (store as `contextPath`)
- Pattern: `.workflow/[testSessionId]/.process/context-package.json`

**Validation**:
- Context package created in test session directory
- Contains source session artifacts (summaries, changed files)
- Includes test file inventory

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

---

### Phase 3: Implementation Analysis
**Command**: `SlashCommand(command="/workflow:tools:concept-enhanced --session [testSessionId] --context [contextPath]")`

**Input**:
- `testSessionId` from Phase 1 (e.g., `WFS-test-user-auth`)
- `contextPath` from Phase 2 (e.g., `.workflow/WFS-test-user-auth/.process/context-package.json`)

**Analysis Focus**:
- Review implementation summaries from source session
- Identify test files and coverage gaps
- Assess test execution strategy (unit, integration, e2e)
- Determine failure diagnosis approach
- Recommend code quality improvements

**Expected Behavior**:
- Reads context-package.json with cross-session artifacts
- Executes parallel analysis (Gemini for test strategy, optional Codex for validation)
- Generates comprehensive test execution strategy
- Identifies code modification targets for test fixes
- Provides feasibility assessment for test validation

**Parse Output**:
- Verify `.workflow/[testSessionId]/.process/ANALYSIS_RESULTS.md` created
- Contains test strategy and execution plan
- Lists code modification targets (format: `file:function:lines` or `file`)
- Includes risk assessment and optimization recommendations

**Validation**:
- File `.workflow/[testSessionId]/.process/ANALYSIS_RESULTS.md` exists
- Contains complete analysis sections:
  - Current State Analysis (test coverage, existing tests)
  - Proposed Solution Design (test execution strategy)
  - Implementation Strategy (code targets, feasibility)
  - Solution Optimization (performance, quality)
  - Critical Success Factors (acceptance criteria)

**TodoWrite**: Mark phase 3 completed, phase 4 in_progress

---

### Phase 4: Generate Test Task
**Command**: `SlashCommand(command="/workflow:tools:task-generate --session [testSessionId]")`

**Input**: `testSessionId` from Phase 1

**Expected Behavior**:
- Reads ANALYSIS_RESULTS.md from Phase 3
- Extracts test strategy and code modification targets
- Generates `IMPL-001.json` (reusing standard format) with:
  - `meta.type: "test-fix"` (enables @test-fix-agent assignment)
  - `meta.agent: "@test-fix-agent"`
  - `context.requirements`: Test execution requirements from analysis
  - `context.focus_paths`: Test files and source files from analysis
  - `context.acceptance`: All tests pass criteria
  - `flow_control.pre_analysis`: Load source session summaries
  - `flow_control.implementation_approach`: Test execution strategy from ANALYSIS_RESULTS.md
  - `flow_control.target_files`: Code modification targets from analysis

**Parse Output**:
- Verify `.workflow/[testSessionId]/.task/IMPL-001.json` exists
- Verify `.workflow/[testSessionId]/IMPL_PLAN.md` created
- Verify `.workflow/[testSessionId]/TODO_LIST.md` created

**Validation**:
- Task JSON has `id: "IMPL-001"` and `meta.type: "test-fix"`
- IMPL_PLAN.md contains test validation strategy from ANALYSIS_RESULTS.md
- TODO_LIST.md shows IMPL-001 task
- flow_control includes code targets and test strategy
- Task is ready for /workflow:execute

**TodoWrite**: Mark phase 4 completed

**Return to User**:
```
Independent test-fix workflow created successfully!

Source Session: [sourceSessionId]
Test Session: [testSessionId]
Task Created: IMPL-001 (test-fix)

Next Steps:
1. Review test plan: .workflow/[testSessionId]/IMPL_PLAN.md
2. Execute validation: /workflow:execute
3. Monitor progress: /workflow:status

The @test-fix-agent will:
- Execute all tests
- Diagnose any failures
- Fix code until tests pass
```

---

## TodoWrite Pattern

```javascript
// Initialize (before Phase 1)
TodoWrite({todos: [
  {"content": "Create independent test session", "status": "in_progress", "activeForm": "Creating test session"},
  {"content": "Gather cross-session context", "status": "pending", "activeForm": "Gathering cross-session context"},
  {"content": "Analyze implementation for test strategy", "status": "pending", "activeForm": "Analyzing implementation"},
  {"content": "Generate test validation task", "status": "pending", "activeForm": "Generating test validation task"}
]})

// After Phase 1
TodoWrite({todos: [
  {"content": "Create independent test session", "status": "completed", "activeForm": "Creating test session"},
  {"content": "Gather cross-session context", "status": "in_progress", "activeForm": "Gathering cross-session context"},
  {"content": "Analyze implementation for test strategy", "status": "pending", "activeForm": "Analyzing implementation"},
  {"content": "Generate test validation task", "status": "pending", "activeForm": "Generating test validation task"}
]})

// After Phase 2
TodoWrite({todos: [
  {"content": "Create independent test session", "status": "completed", "activeForm": "Creating test session"},
  {"content": "Gather cross-session context", "status": "completed", "activeForm": "Gathering cross-session context"},
  {"content": "Analyze implementation for test strategy", "status": "in_progress", "activeForm": "Analyzing implementation"},
  {"content": "Generate test validation task", "status": "pending", "activeForm": "Generating test validation task"}
]})

// After Phase 3
TodoWrite({todos: [
  {"content": "Create independent test session", "status": "completed", "activeForm": "Creating test session"},
  {"content": "Gather cross-session context", "status": "completed", "activeForm": "Gathering cross-session context"},
  {"content": "Analyze implementation for test strategy", "status": "completed", "activeForm": "Analyzing implementation"},
  {"content": "Generate test validation task", "status": "in_progress", "activeForm": "Generating test validation task"}
]})

// After Phase 4
TodoWrite({todos: [
  {"content": "Create independent test session", "status": "completed", "activeForm": "Creating test session"},
  {"content": "Gather cross-session context", "status": "completed", "activeForm": "Gathering cross-session context"},
  {"content": "Analyze implementation for test strategy", "status": "completed", "activeForm": "Analyzing implementation"},
  {"content": "Generate test validation task", "status": "completed", "activeForm": "Generating test validation task"}
]})
```

## Data Flow

```
User: /workflow:test-gen WFS-user-auth
    ↓
Phase 1: session-start --new "Test validation for WFS-user-auth"
    ↓ Creates: WFS-test-user-auth session
    ↓ Writes: workflow-session.json with workflow_type="test_session", source_session_id="WFS-user-auth"
    ↓ Output: testSessionId = "WFS-test-user-auth"
    ↓
Phase 2: context-gather --session WFS-test-user-auth
    ↓ Auto-detects: test session type from workflow-session.json
    ↓ Auto-reads: source_session_id = "WFS-user-auth"
    ↓ Gathers: Cross-session context (summaries, code changes, tests)
    ↓ Output: .workflow/WFS-test-user-auth/.process/context-package.json
    ↓
Phase 3: concept-enhanced --session WFS-test-user-auth --context context-package.json
    ↓ Reads: context-package.json with cross-session artifacts
    ↓ Executes: Parallel analysis (Gemini test strategy + optional Codex validation)
    ↓ Analyzes: Test coverage, execution strategy, code targets
    ↓ Output: .workflow/WFS-test-user-auth/.process/ANALYSIS_RESULTS.md
    ↓
Phase 4: task-generate --session WFS-test-user-auth
    ↓ Reads: ANALYSIS_RESULTS.md with test strategy and code targets
    ↓ Generates: IMPL-001.json with meta.type="test-fix"
    ↓ Output: Task, plan, and todo files in test session
    ↓
Return: Summary with next steps (user triggers /workflow:execute separately)
```

## Session Metadata Design

**Test Session (`WFS-test-user-auth/workflow-session.json`)**:
```json
{
  "session_id": "WFS-test-user-auth",
  "project": "Test validation for user authentication implementation",
  "status": "planning",
  "created_at": "2025-10-03T12:00:00Z",
  "workflow_type": "test_session",
  "source_session_id": "WFS-user-auth"
}
```

## Automatic Cross-Session Context Collection

When `context-gather` detects `workflow_type: "test_session"`:

**Collected from Source Session** (`.workflow/WFS-user-auth/`):
- Implementation summaries: `.summaries/IMPL-*-summary.md`
- Code changes: `git log --since=[source_created_at] --name-only`
- Original plan: `IMPL_PLAN.md`
- Task definitions: `.task/IMPL-*.json`

**Collected from Current Project**:
- Test files: `mcp__code-index__find_files(pattern="*.test.*")`
- Test configuration: `package.json`, `jest.config.js`, etc.
- Source files: Based on changed files from git log

## Task Generation Output

task-generate creates `IMPL-001.json` (reusing standard format) with:

```json
{
  "id": "IMPL-001",
  "title": "Execute and validate tests for [sourceSessionId]",
  "status": "pending",
  "meta": {
    "type": "test-fix",
    "agent": "@test-fix-agent"
  },
  "context": {
    "requirements": [
      "Execute complete test suite for all implemented modules",
      "Diagnose and fix any test failures",
      "Ensure all tests pass before completion"
    ],
    "focus_paths": ["src/**/*.test.ts", "src/**/implementation.ts"],
    "acceptance": [
      "All tests pass successfully",
      "No test failures or errors",
      "Code is approved and ready for deployment"
    ],
    "depends_on": [],
    "artifacts": []
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_source_session_summaries",
        "action": "Load implementation summaries from source session",
        "commands": [
          "bash(find .workflow/[sourceSessionId]/.summaries/ -name 'IMPL-*-summary.md' 2>/dev/null)",
          "Read(.workflow/[sourceSessionId]/.summaries/IMPL-001-summary.md)"
        ],
        "output_to": "implementation_context",
        "on_error": "skip_optional"
      },
      {
        "step": "analyze_test_files",
        "action": "Identify test files and coverage",
        "commands": [
          "mcp__code-index__find_files(pattern=\"*.test.*\")",
          "mcp__code-index__search_code_advanced(pattern=\"test|describe|it\", file_pattern=\"*.test.*\")"
        ],
        "output_to": "test_inventory",
        "on_error": "fail"
      }
    ],
    "implementation_approach": {
      "task_description": "Execute tests and fix failures until all pass",
      "modification_points": [
        "Run test suite using detected framework",
        "Parse test output to identify failures",
        "Diagnose root cause of failures",
        "Modify source code to fix issues",
        "Re-run tests to verify fixes"
      ],
      "logic_flow": [
        "Load implementation context",
        "Identify test framework and configuration",
        "Execute complete test suite",
        "If failures: analyze error messages",
        "Fix source code based on diagnosis",
        "Re-run tests",
        "Repeat until all tests pass"
      ]
    },
    "target_files": ["src/**/*.test.ts", "src/**/implementation.ts"]
  }
}
```

## Error Handling

### Phase 1 Failures
- **Source session not found**: Return error "Source session [sourceSessionId] not found in .workflow/"
- **Invalid source session**: Return error "Source session [sourceSessionId] has no completed IMPL tasks"
- **Session creation failed**: Return error "Could not create test session. Check /workflow:session:start"

### Phase 2 Failures
- **Context gathering failed**: Return error "Could not gather cross-session context. Check source session artifacts"
- **No source artifacts**: Return error "Source session has no implementation summaries or git history"

### Phase 3 Failures
- **Analysis failed**: Return error "Implementation analysis failed. Check context package and ANALYSIS_RESULTS.md"
- **No test strategy**: Return error "Could not determine test execution strategy from analysis"
- **Missing code targets**: Warning only, proceed with general test task

### Phase 4 Failures
- **Task generation failed**: Retry once, then return error with details
- **Invalid task structure**: Return error with JSON validation details

## Workflow Integration

### Complete Flow Example
```
1. Implementation Phase (prior to test-gen)
   /workflow:plan "Build auth system"
   → Creates WFS-auth session
   → @code-developer implements + writes tests
   → Creates IMPL-001-summary.md in WFS-auth

2. Test Generation Phase (test-gen)
   /workflow:test-gen WFS-auth
   Phase 1: session-start → Creates WFS-test-auth session
   Phase 2: context-gather → Gathers from WFS-auth, creates context-package.json
   Phase 3: concept-enhanced → Analyzes implementation, creates ANALYSIS_RESULTS.md
   Phase 4: task-generate → Creates IMPL-001.json with meta.type="test-fix"
   Returns: Summary with next steps

3. Test Execution Phase (user-triggered)
   /workflow:execute
   → Detects active session: WFS-test-auth
   → @test-fix-agent picks up IMPL-001 (test-fix type)
   → Runs test suite
   → Diagnoses failures (if any)
   → Fixes source code
   → Re-runs tests
   → All pass → Code approved ✅
```

### Output Files Created

**In Test Session** (`.workflow/WFS-test-auth/`):
- `workflow-session.json` - Contains workflow_type and source_session_id
- `.process/context-package.json` - Cross-session context from WFS-auth
- `.process/ANALYSIS_RESULTS.md` - Test strategy and code targets from concept-enhanced
- `.task/IMPL-001.json` - Test-fix task definition
- `IMPL_PLAN.md` - Test validation plan (from ANALYSIS_RESULTS.md)
- `TODO_LIST.md` - Task checklist
- `.summaries/IMPL-001-summary.md` - Created by @test-fix-agent after completion

## Best Practices

1. **Run after implementation complete**: Ensure source session has completed IMPL tasks and summaries
2. **Check git commits**: Implementation changes should be committed for accurate git log analysis
3. **Verify test files exist**: Source implementation should include test files
4. **Independent sessions**: Test session is separate from implementation session for clean separation
5. **Monitor execution**: Use `/workflow:status` to track test-fix progress after /workflow:execute

## Coordinator Checklist

✅ Initialize TodoWrite before any command (4 phases)
✅ Phase 1: Create test session with source session ID
✅ Parse new test session ID from Phase 1 output
✅ Phase 2: Run context-gather (auto-detects test session, no extra params)
✅ Verify context-package.json contains cross-session artifacts
✅ Phase 3: Run concept-enhanced with session and context path
✅ Verify ANALYSIS_RESULTS.md contains test strategy and code targets
✅ Phase 4: Run task-generate to create IMPL-001.json
✅ Verify task has meta.type="test-fix" and meta.agent="@test-fix-agent"
✅ Verify flow_control includes analysis insights and code targets
✅ Update TodoWrite after each phase
✅ Return summary after Phase 4 (execution is separate user action)

## Required Tool Modifications

### `/workflow:session:start`
- Support `--new` flag for test session creation
- Auto-detect test session pattern from task description
- Write `workflow_type: "test_session"` and `source_session_id` to metadata

### `/workflow:tools:context-gather`
- Read session metadata to detect `workflow_type: "test_session"`
- Auto-extract `source_session_id` from metadata
- Gather cross-session context from source session artifacts
- Include git log analysis from source session creation time

### `/workflow:tools:concept-enhanced`
- No changes required (already supports cross-session context analysis)
- Will automatically analyze test strategy based on context-package.json
- Generates ANALYSIS_RESULTS.md with code targets and test execution plan

### `/workflow:tools:task-generate`
- Recognize test session context and generate appropriate task
- Create `IMPL-001.json` with `meta.type: "test-fix"`
- Extract test strategy from ANALYSIS_RESULTS.md
- Include code targets and cross-session references in flow_control

### `/workflow:execute`
- No changes required (already dispatches by meta.agent)

## Related Commands
- `/workflow:plan` - Create implementation workflow (run before test-gen)
- `/workflow:session:start` - Phase 1 tool for test session creation
- `/workflow:tools:context-gather` - Phase 2 tool for cross-session context collection
- `/workflow:tools:concept-enhanced` - Phase 3 tool for implementation analysis and test strategy
- `/workflow:tools:task-generate` - Phase 4 tool for test task creation
- `/workflow:execute` - Execute test-fix workflow (user-triggered after test-gen)
- `/workflow:status` - Check workflow progress
- `@test-fix-agent` - Agent that executes and fixes tests
