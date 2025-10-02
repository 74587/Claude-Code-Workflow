---
name: test-gen
description: Orchestrate test-fix workflow by analyzing implementation and generating TEST-FIX tasks
usage: /workflow:test-gen [session-id]
argument-hint: "[session-id]"
examples:
  - /workflow:test-gen
  - /workflow:test-gen WFS-user-auth
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
---

# Workflow Test Generation Command (/workflow:test-gen)

## Coordinator Role

**This command is a pure orchestrator**: Analyze completed implementation session, generate test-fix workflow through standardized tool commands, and trigger automated test validation.

**Execution Flow**:
1. Initialize TodoWrite → Execute Phase 1 → Parse output → Update TodoWrite
2. Execute Phase 2 with Phase 1 data → Parse output → Update TodoWrite
3. Execute Phase 3 with Phase 2 data → Parse output → Update TodoWrite
4. Execute Phase 4 with Phase 3 validation → Update TodoWrite → Return summary

## Core Rules

1. **Start Immediately**: First action is TodoWrite initialization, second action is Phase 1 session discovery
2. **No Preliminary Analysis**: Do not read files or analyze before Phase 1
3. **Parse Every Output**: Extract required data from each phase for next phase
4. **Sequential Execution**: Each phase depends on previous phase's output
5. **Complete All Phases**: Do not return to user until Phase 4 completes
6. **Track Progress**: Update TodoWrite after every phase completion
7. **Use Standard Tools**: Follow plan.md pattern using context-gather, concept-enhanced, task-generate

## 4-Phase Execution

### Phase 1: Session Discovery & Context Gathering
**Command**: `SlashCommand(command="/workflow:tools:context-gather --session [sessionId] \"TEST-FIX: Validate implementation for [sessionId]\"")`

**Session ID Resolution**:
- If argument provided → Use directly as `sessionId`
- If no argument → Auto-detect from `.workflow/.active-*` marker
- Format: `WFS-[session-name]`

**Task Description Structure**:
```
GOAL: Execute and validate all tests for completed implementation
SCOPE: Test execution, failure diagnosis, code fixing
CONTEXT: Implementation session [sessionId] with completed IMPL tasks
```

**Parse Output**:
- Extract: context package path (store as `contextPath`)
- Typical pattern: `.workflow/[sessionId]/.process/context-package-test.json`

**Validation**:
- Session directory `.workflow/[sessionId]/` exists
- Session has completed IMPL tasks (check .summaries/IMPL-*-summary.md)
- Context package created successfully

**TodoWrite**: Mark phase 1 completed, phase 2 in_progress

---

### Phase 2: Implementation Analysis
**Command**: `SlashCommand(command="/workflow:tools:concept-enhanced --session [sessionId] --context [contextPath]")`

**Input**: `sessionId` from Phase 1, `contextPath` from Phase 1

**Expected Analysis**:
- Review completed implementation summaries
- Identify test files and coverage gaps
- Assess test execution strategy
- Determine failure diagnosis approach

**Parse Output**:
- Verify `.workflow/[sessionId]/.process/ANALYSIS_RESULTS.md` created
- Extract test execution recommendations
- Identify critical test areas

**Validation**:
- File `.workflow/[sessionId]/.process/ANALYSIS_RESULTS.md` exists
- Contains test strategy and execution plan
- Lists focus test paths and acceptance criteria

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

---

### Phase 3: TEST-FIX Task Generation
**Command**: `SlashCommand(command="/workflow:tools:task-generate --session [sessionId]")`

**Input**: `sessionId` from Phase 1

**Expected Behavior**:
- Parse ANALYSIS_RESULTS.md for test requirements
- Generate TEST-FIX-001.json with:
  - `meta.type: "test-fix"`
  - `meta.agent: "@test-fix-agent"`
  - `context.requirements`: Test execution requirements
  - `context.focus_paths`: Test files and source files
  - `context.acceptance`: All tests pass criteria
  - `flow_control.pre_analysis`: Load implementation summaries
  - `flow_control.implementation_approach`: Test execution strategy

**Parse Output**:
- Verify `.workflow/[sessionId]/.task/TEST-FIX-001.json` exists
- Verify `.workflow/[sessionId]/IMPL_PLAN.md` updated
- Verify `.workflow/[sessionId]/TODO_LIST.md` updated

**Validation**:
- Task JSON has correct structure (id, meta.type="test-fix", meta.agent="@test-fix-agent")
- IMPL_PLAN.md contains test-fix strategy
- TODO_LIST.md shows TEST-FIX-001 task

**TodoWrite**: Mark phase 3 completed, phase 4 in_progress

---

### Phase 4: Execute Test-Fix Workflow
**Command**: `SlashCommand(command="/workflow:execute --session [sessionId]")`

**Input**: `sessionId` from Phase 1

**Expected Behavior**:
- Workflow executor detects TEST-FIX-001 task
- Assigns to @test-fix-agent
- Agent executes tests using flow_control.pre_analysis
- If failures: diagnoses and fixes code
- Re-runs tests until all pass
- Generates completion summary

**Validation**:
- Workflow execution started successfully
- TEST-FIX-001 task status updated to "active" or "completed"

**TodoWrite**: Mark phase 4 completed

**Return to User**:
```
Test-fix workflow initiated for session: [sessionId]
- TEST-FIX-001 created and executing
- @test-fix-agent validating implementation
- Progress: /workflow:status [sessionId]
```

---

## TodoWrite Pattern

```javascript
// Initialize (before Phase 1)
TodoWrite({todos: [
  {"content": "Execute context gathering for test-fix", "status": "in_progress", "activeForm": "Executing context gathering for test-fix"},
  {"content": "Execute implementation analysis", "status": "pending", "activeForm": "Executing implementation analysis"},
  {"content": "Execute TEST-FIX task generation", "status": "pending", "activeForm": "Executing TEST-FIX task generation"},
  {"content": "Execute test-fix workflow", "status": "pending", "activeForm": "Executing test-fix workflow"}
]})

// After Phase 1
TodoWrite({todos: [
  {"content": "Execute context gathering for test-fix", "status": "completed", "activeForm": "Executing context gathering for test-fix"},
  {"content": "Execute implementation analysis", "status": "in_progress", "activeForm": "Executing implementation analysis"},
  {"content": "Execute TEST-FIX task generation", "status": "pending", "activeForm": "Executing TEST-FIX task generation"},
  {"content": "Execute test-fix workflow", "status": "pending", "activeForm": "Executing test-fix workflow"}
]})

// Continue pattern for Phase 2, 3, 4...
```

## Data Flow

```
Session ID (from argument or auto-detect)
    ↓
Phase 1: context-gather --session sessionId "test-fix description"
    ↓ Output: contextPath (context-package-test.json)
    ↓
Phase 2: concept-enhanced --session sessionId --context contextPath
    ↓ Input: sessionId + contextPath
    ↓ Output: ANALYSIS_RESULTS.md (test execution strategy)
    ↓
Phase 3: task-generate --session sessionId
    ↓ Input: sessionId + ANALYSIS_RESULTS.md
    ↓ Output: TEST-FIX-001.json, IMPL_PLAN.md, TODO_LIST.md
    ↓
Phase 4: execute --session sessionId
    ↓ Input: sessionId + TEST-FIX-001.json
    ↓ Output: Test execution and fixing
    ↓
Return summary to user
```

## Context Gathering Customization

context-gather will analyze:
- Completed IMPL task summaries
- Git changes since session start
- Test files in focus_paths
- Implementation files to be tested
- Test framework configuration

## Analysis Focus

concept-enhanced will analyze:
- Test coverage gaps
- Test execution strategy (unit, integration, e2e)
- Failure diagnosis approaches
- Code fixing patterns
- Test framework best practices

## Task Generation Output

task-generate creates TEST-FIX-001.json with:

```json
{
  "id": "TEST-FIX-001",
  "title": "Execute and validate tests for [sessionId]",
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
        "step": "load_implementation_summaries",
        "action": "Load completed IMPL task summaries",
        "commands": [
          "bash(find .workflow/[sessionId]/.summaries/ -name 'IMPL-*-summary.md' 2>/dev/null)",
          "Read(.workflow/[sessionId]/.summaries/IMPL-001-summary.md)"
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
- **No session found**: Return error "No active session detected. Provide session-id or run /workflow:plan first"
- **Invalid session**: Return error "Session [sessionId] not found or incomplete"
- **No implementation**: Return error "No completed IMPL tasks found. Complete implementation first"

### Phase 2 Failures
- **Analysis failed**: Return error "Implementation analysis failed. Check context package"
- **No test strategy**: Return error "Could not determine test execution strategy"

### Phase 3 Failures
- **Task generation failed**: Retry once, then return error with details
- **Invalid task structure**: Return error with JSON validation details

### Phase 4 Failures
- **Execution failed**: Return error "Could not start test-fix workflow. Check session state"

## Workflow Integration

### Complete Flow Example
```
1. Implementation Phase (prior to test-gen)
   /workflow:plan "Build auth system"
   → @code-developer implements + writes tests
   → Creates IMPL-001-summary.md

2. Test Generation Phase (test-gen)
   /workflow:test-gen WFS-auth
   Phase 1: context-gather → Creates context-package-test.json
   Phase 2: concept-enhanced → Creates ANALYSIS_RESULTS.md
   Phase 3: task-generate → Creates TEST-FIX-001.json
   Phase 4: execute → Triggers @test-fix-agent

3. Test-Fix Phase (automated)
   @test-fix-agent picks up TEST-FIX-001
   → Runs test suite
   → Diagnoses failures (if any)
   → Fixes source code
   → Re-runs tests
   → All pass → Code approved ✅
```

### Output Files Created
- `.workflow/[sessionId]/.process/context-package-test.json` - Test context package
- `.workflow/[sessionId]/.process/ANALYSIS_RESULTS.md` - Test execution strategy
- `.workflow/[sessionId]/.task/TEST-FIX-001.json` - Task definition
- `.workflow/[sessionId]/IMPL_PLAN.md` - Updated with test-fix plan
- `.workflow/[sessionId]/TODO_LIST.md` - Updated with TEST-FIX task
- `.workflow/[sessionId]/.summaries/TEST-FIX-001-summary.md` - Created by test-fix-agent after completion

## Best Practices

1. **Run after implementation complete**: Ensure all IMPL tasks are done before test-gen
2. **Check git commits**: Make sure implementation changes are committed
3. **Verify test files exist**: Code-developer should have created tests
4. **Monitor execution**: Use `/workflow:status` to track test-fix progress
5. **Review failures**: If tests fail repeatedly, check test-fix-agent summary for details

## Coordinator Checklist

✅ Initialize TodoWrite before any command
✅ Execute Phase 1 immediately with session ID
✅ Parse context package path from Phase 1 output
✅ Pass session ID and context path to Phase 2 command
✅ Verify ANALYSIS_RESULTS.md after Phase 2
✅ Pass session ID to Phase 3 command
✅ Verify all Phase 3 outputs (task JSON, IMPL_PLAN, TODO_LIST)
✅ Pass session ID to Phase 4 command
✅ Update TodoWrite after each phase
✅ Return summary only after Phase 4 completes

## Related Commands
- `/workflow:plan` - Create implementation workflow (run before test-gen)
- `/workflow:tools:context-gather` - Phase 1 tool for context collection
- `/workflow:tools:concept-enhanced` - Phase 2 tool for analysis
- `/workflow:tools:task-generate` - Phase 3 tool for task creation
- `/workflow:execute` - Phase 4 workflow execution
- `/workflow:status` - Check workflow progress
- `@test-fix-agent` - Agent that executes and fixes tests
