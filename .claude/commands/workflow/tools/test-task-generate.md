---
name: test-task-generate
description: Generate test-fix task JSON with iterative test-fix-retest cycle specification
argument-hint: "[--use-codex] [--cli-execute] --session WFS-test-session-id"
examples:
  - /workflow:tools:test-task-generate --session WFS-test-auth
  - /workflow:tools:test-task-generate --use-codex --session WFS-test-auth
  - /workflow:tools:test-task-generate --cli-execute --session WFS-test-auth
  - /workflow:tools:test-task-generate --cli-execute --use-codex --session WFS-test-auth
---

# Test Task Generation Command

## Overview
Generate specialized test-fix task JSON with comprehensive test-fix-retest cycle specification, including Gemini diagnosis (using bug-fix template) and manual fix workflow (Codex automation only when explicitly requested).

## Execution Modes

### Test Generation (IMPL-001)
- **Agent Mode (Default)**: @code-developer generates tests within agent context
- **CLI Execute Mode (`--cli-execute`)**: Use Codex CLI for autonomous test generation

### Test Fix (IMPL-002)
- **Manual Mode (Default)**: Gemini diagnosis → user applies fixes
- **Codex Mode (`--use-codex`)**: Gemini diagnosis → Codex applies fixes with resume mechanism

## Core Philosophy
- **Analysis-Driven Test Generation**: Use TEST_ANALYSIS_RESULTS.md from test-concept-enhanced
- **Agent-Based Test Creation**: Call @code-developer agent for comprehensive test generation
- **Coverage-First**: Generate all missing tests before execution
- **Test Execution**: Execute complete test suite after generation
- **Gemini Diagnosis**: Use Gemini for root cause analysis and fix suggestions (references bug-fix template)
- **Manual Fixes First**: Apply fixes manually by default, codex only when explicitly needed
- **Iterative Refinement**: Repeat test-analyze-fix-retest cycle until all tests pass
- **Surgical Fixes**: Minimal code changes, no refactoring during test fixes
- **Auto-Revert**: Rollback all changes if max iterations reached

## Core Responsibilities
- Parse TEST_ANALYSIS_RESULTS.md from test-concept-enhanced
- Extract test requirements and generation strategy
- Parse `--use-codex` flag to determine fix mode (manual vs automated)
- Generate test generation subtask calling @code-developer
- Generate test execution and fix cycle task JSON with appropriate fix mode
- Configure Gemini diagnosis workflow (bug-fix template) and manual/Codex fix application
- Create test-oriented IMPL_PLAN.md and TODO_LIST.md with test generation phase

## Execution Lifecycle

### Phase 1: Input Validation & Discovery

1. **Parameter Parsing**
   - Parse `--use-codex` flag from command arguments → Controls IMPL-002 fix mode
   - Parse `--cli-execute` flag from command arguments → Controls IMPL-001 generation mode
   - Store flag values for task JSON generation

2. **Test Session Validation**
   - Load `.workflow/{test-session-id}/workflow-session.json`
   - Verify `workflow_type: "test_session"`
   - Extract `source_session_id` from metadata

3. **Test Analysis Results Loading**
   - **REQUIRED**: Load `.workflow/{test-session-id}/.process/TEST_ANALYSIS_RESULTS.md`
   - Parse test requirements by file
   - Extract test generation strategy
   - Identify test files to create with specifications

4. **Test Context Package Loading**
   - Load `.workflow/{test-session-id}/.process/test-context-package.json`
   - Extract test framework configuration
   - Extract coverage gaps and priorities
   - Load source session implementation summaries

### Phase 2: Task JSON Generation

Generate **TWO task JSON files**:
1. **IMPL-001.json** - Test Generation (calls @code-developer)
2. **IMPL-002.json** - Test Execution and Fix Cycle (calls @test-fix-agent)

#### IMPL-001.json - Test Generation Task

```json
{
  "id": "IMPL-001",
  "title": "Generate comprehensive tests for [sourceSessionId]",
  "status": "pending",
  "meta": {
    "type": "test-gen",
    "agent": "@code-developer",
    "source_session": "[sourceSessionId]",
    "test_framework": "jest|pytest|cargo|detected"
  },
  "context": {
    "requirements": [
      "Generate comprehensive test files based on TEST_ANALYSIS_RESULTS.md",
      "Follow existing test patterns and conventions from test framework",
      "Create tests for all missing coverage identified in analysis",
      "Include happy path, error handling, edge cases, and integration tests",
      "Use test data and mocks as specified in analysis",
      "Ensure tests follow project coding standards"
    ],
    "focus_paths": [
      "tests/**/*",
      "src/**/*.test.*",
      "{paths_from_analysis}"
    ],
    "acceptance": [
      "All test files from TEST_ANALYSIS_RESULTS.md section 5 are created",
      "Tests follow existing test patterns and conventions",
      "Test scenarios cover happy path, errors, edge cases, integration",
      "All dependencies are properly mocked",
      "Test files are syntactically valid and can be executed",
      "Test coverage meets analysis requirements"
    ],
    "depends_on": [],
    "source_context": {
      "session_id": "[sourceSessionId]",
      "test_analysis": ".workflow/[testSessionId]/.process/TEST_ANALYSIS_RESULTS.md",
      "test_context": ".workflow/[testSessionId]/.process/test-context-package.json",
      "implementation_summaries": [
        ".workflow/[sourceSessionId]/.summaries/IMPL-001-summary.md"
      ]
    }
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_test_analysis",
        "action": "Load test generation requirements and strategy",
        "commands": [
          "Read(.workflow/[testSessionId]/.process/TEST_ANALYSIS_RESULTS.md)",
          "Read(.workflow/[testSessionId]/.process/test-context-package.json)"
        ],
        "output_to": "test_generation_requirements",
        "on_error": "fail"
      },
      {
        "step": "load_implementation_context",
        "action": "Load source implementation for test generation context",
        "commands": [
          "bash(for f in .workflow/[sourceSessionId]/.summaries/IMPL-*-summary.md; do echo \"=== $(basename $f) ===\"&& cat \"$f\"; done)"
        ],
        "output_to": "implementation_context",
        "on_error": "skip_optional"
      },
      {
        "step": "load_existing_test_patterns",
        "action": "Study existing tests for pattern reference",
        "commands": [
          "mcp__code-index__find_files(pattern=\"*.test.*\")",
          "bash(# Read first 2 existing test files as examples)",
          "bash(test_files=$(mcp__code-index__find_files(pattern=\"*.test.*\") | head -2))",
          "bash(for f in $test_files; do echo \"=== $f ===\"&& cat \"$f\"; done)"
        ],
        "output_to": "existing_test_patterns",
        "on_error": "skip_optional"
      }
    ],
    // Agent Mode (Default): Agent implements tests
    "implementation_approach": [
      {
        "step": 1,
        "title": "Generate comprehensive test suite",
        "description": "Generate comprehensive test suite based on TEST_ANALYSIS_RESULTS.md. Follow test generation strategy and create all test files listed in section 5 (Implementation Targets).",
        "modification_points": [
          "Read TEST_ANALYSIS_RESULTS.md sections 3 and 4",
          "Study existing test patterns",
          "Create test files with all required scenarios",
          "Implement happy path, error handling, edge case, and integration tests",
          "Add required mocks and fixtures"
        ],
        "logic_flow": [
          "Read TEST_ANALYSIS_RESULTS.md section 3 (Test Requirements by File)",
          "Read TEST_ANALYSIS_RESULTS.md section 4 (Test Generation Strategy)",
          "Study existing test patterns from test_context.test_framework.conventions",
          "For each test file in section 5 (Implementation Targets): Create test file with specified scenarios, Implement happy path tests, Implement error handling tests, Implement edge case tests, Implement integration tests (if specified), Add required mocks and fixtures",
          "Follow test framework conventions and project standards",
          "Ensure all tests are executable and syntactically valid"
        ],
        "depends_on": [],
        "output": "test_suite"
      }
    ],

    // CLI Execute Mode (--cli-execute): Use Codex command (alternative format shown below)
    "implementation_approach": [{
      "step": 1,
      "title": "Generate tests using Codex",
      "description": "Use Codex CLI to autonomously generate comprehensive test suite based on TEST_ANALYSIS_RESULTS.md",
      "modification_points": [
        "Codex loads TEST_ANALYSIS_RESULTS.md and existing test patterns",
        "Codex generates all test files listed in analysis section 5",
        "Codex ensures tests follow framework conventions"
      ],
      "logic_flow": [
        "Start new Codex session",
        "Pass TEST_ANALYSIS_RESULTS.md to Codex",
        "Codex studies existing test patterns",
        "Codex generates comprehensive test suite",
        "Codex validates test syntax and executability"
      ],
      "command": "bash(codex -C [focus_paths] --full-auto exec \"PURPOSE: Generate comprehensive test suite TASK: Create test files based on TEST_ANALYSIS_RESULTS.md section 5 MODE: write CONTEXT: @{.workflow/WFS-test-[session]/.process/TEST_ANALYSIS_RESULTS.md,.workflow/WFS-test-[session]/.process/test-context-package.json} EXPECTED: All test files with happy path, error handling, edge cases, integration tests RULES: Follow test framework conventions, ensure tests are executable\" --skip-git-repo-check -s danger-full-access)",
      "depends_on": [],
      "output": "test_generation"
    }],
    "target_files": [
      "{test_file_1 from TEST_ANALYSIS_RESULTS.md section 5}",
      "{test_file_2 from TEST_ANALYSIS_RESULTS.md section 5}",
      "{test_file_N from TEST_ANALYSIS_RESULTS.md section 5}"
    ]
  }
}
```

#### IMPL-002.json - Test Execution & Fix Cycle Task

```json
{
  "id": "IMPL-002",
  "title": "Execute and fix tests for [sourceSessionId]",
  "status": "pending",
  "meta": {
    "type": "test-fix",
    "agent": "@test-fix-agent",
    "source_session": "[sourceSessionId]",
    "test_framework": "jest|pytest|cargo|detected",
    "max_iterations": 5,
    "use_codex": false  // Set to true if --use-codex flag present
  },
  "context": {
    "requirements": [
      "Execute complete test suite (generated in IMPL-001)",
      "Diagnose test failures using Gemini analysis with bug-fix template",
      "Present fixes to user for manual application (default)",
      "Use Codex ONLY if user explicitly requests automation",
      "Iterate until all tests pass or max iterations reached",
      "Revert changes if unable to fix within iteration limit"
    ],
    "focus_paths": [
      "tests/**/*",
      "src/**/*.test.*",
      "{implementation_files_from_source_session}"
    ],
    "acceptance": [
      "All tests pass successfully (100% pass rate)",
      "No test failures or errors in final run",
      "Code changes are minimal and surgical",
      "All fixes are verified through retest",
      "Iteration logs document fix progression"
    ],
    "depends_on": ["IMPL-001"],
    "source_context": {
      "session_id": "[sourceSessionId]",
      "test_generation_summary": ".workflow/[testSessionId]/.summaries/IMPL-001-summary.md",
      "implementation_summaries": [
        ".workflow/[sourceSessionId]/.summaries/IMPL-001-summary.md"
      ]
    }
  },
  "flow_control": {
    "pre_analysis": [
      {
        "step": "load_source_session_summaries",
        "action": "Load implementation context from source session",
        "commands": [
          "bash(find .workflow/[sourceSessionId]/.summaries/ -name 'IMPL-*-summary.md' 2>/dev/null)",
          "bash(for f in .workflow/[sourceSessionId]/.summaries/IMPL-*-summary.md; do echo \"=== $(basename $f) ===\"&& cat \"$f\"; done)"
        ],
        "output_to": "implementation_context",
        "on_error": "skip_optional"
      },
      {
        "step": "discover_test_framework",
        "action": "Identify test framework and test command",
        "commands": [
          "bash(jq -r '.scripts.test // \"npm test\"' package.json 2>/dev/null || echo 'pytest' || echo 'cargo test')",
          "bash([ -f 'package.json' ] && echo 'jest/npm' || [ -f 'pytest.ini' ] && echo 'pytest' || [ -f 'Cargo.toml' ] && echo 'cargo' || echo 'unknown')"
        ],
        "output_to": "test_command",
        "on_error": "fail"
      },
      {
        "step": "analyze_test_coverage",
        "action": "Analyze test coverage and identify missing tests",
        "commands": [
          "mcp__code-index__find_files(pattern=\"*.test.*\")",
          "mcp__code-index__search_code_advanced(pattern=\"test|describe|it|def test_\", file_pattern=\"*.test.*\")",
          "bash(# Count implementation files vs test files)",
          "bash(impl_count=$(find [changed_files_dirs] -type f \\( -name '*.ts' -o -name '*.js' -o -name '*.py' \\) ! -name '*.test.*' 2>/dev/null | wc -l))",
          "bash(test_count=$(mcp__code-index__find_files(pattern=\"*.test.*\") | wc -l))",
          "bash(echo \"Implementation files: $impl_count, Test files: $test_count\")"
        ],
        "output_to": "test_coverage_analysis",
        "on_error": "skip_optional"
      },
      {
        "step": "identify_files_without_tests",
        "action": "List implementation files that lack corresponding test files",
        "commands": [
          "bash(# For each changed file from source session, check if test exists)",
          "bash(for file in [changed_files]; do test_file=$(echo $file | sed 's/\\(.*\\)\\.\\(ts\\|js\\|py\\)$/\\1.test.\\2/'); [ ! -f \"$test_file\" ] && echo \"$file\"; done)"
        ],
        "output_to": "files_without_tests",
        "on_error": "skip_optional"
      },
      {
        "step": "prepare_test_environment",
        "action": "Ensure test environment is ready",
        "commands": [
          "bash([ -f 'package.json' ] && npm install 2>/dev/null || true)",
          "bash([ -f 'requirements.txt' ] && pip install -q -r requirements.txt 2>/dev/null || true)"
        ],
        "output_to": "environment_status",
        "on_error": "skip_optional"
      }
    ],
    "implementation_approach": [
      {
        "step": 1,
        "title": "Execute iterative test-fix-retest cycle",
        "description": "Execute iterative test-fix-retest cycle using Gemini diagnosis (bug-fix template) and manual fixes (Codex only if meta.use_codex=true). Max 5 iterations with automatic revert on failure.",
        "test_fix_cycle": {
          "max_iterations": 5,
          "cycle_pattern": "test → gemini_diagnose → manual_fix (or codex if needed) → retest",
          "tools": {
            "test_execution": "bash(test_command)",
            "diagnosis": "gemini-wrapper (MODE: analysis, uses bug-fix template)",
            "fix_application": "manual (default) or codex exec resume --last (if explicitly needed)",
            "verification": "bash(test_command) + regression_check"
          },
          "exit_conditions": {
            "success": "all_tests_pass",
            "failure": "max_iterations_reached",
            "error": "test_command_not_found"
          }
        },
        "modification_points": [
        "PHASE 1: Initial Test Execution",
        "  1.1. Discover test command from framework detection",
        "  1.2. Execute initial test run: bash([test_command])",
        "  1.3. Parse test output and count failures",
        "  1.4. If all pass → Skip to PHASE 3 (success)",
        "  1.5. If failures → Store failure output, proceed to PHASE 2",
        "",
        "PHASE 2: Iterative Test-Fix-Retest Cycle (max 5 iterations)",
        "  Note: This phase handles test failures, NOT test generation failures",
        "  Initialize: max_iterations=5, current_iteration=0",
        "  ",
        "  WHILE (tests failing AND current_iteration < max_iterations):",
        "    current_iteration++",
        "    ",
        "    STEP 2.1: Gemini Diagnosis (using bug-fix template)",
        "    - Prepare diagnosis context:",
        "      * Test failure output from previous run",
        "      * Source files from focus_paths",
        "      * Implementation summaries from source session",
        "    - Execute Gemini analysis with bug-fix template:",
        "      bash(cd .workflow/WFS-test-[session]/.process && ~/.claude/scripts/gemini-wrapper --all-files -p \"",
        "      PURPOSE: Diagnose test failure iteration [N] and propose minimal fix",
        "      TASK: Systematic bug analysis and fix recommendations for test failure",
        "      MODE: analysis",
        "      CONTEXT: @{CLAUDE.md,**/*CLAUDE.md}",
        "               Test output: [test_failures]",
        "               Source files: [focus_paths]",
        "               Implementation: [implementation_context]",
        "      EXPECTED: Root cause analysis, code path tracing, targeted fixes",
        "      RULES: $(cat ~/.claude/prompt-templates/bug-fix.md) | Bug: [test_failure_description]",
        "             Minimal surgical fixes only - no refactoring",
        "      \" > fix-iteration-[N]-diagnosis.md)",
        "    - Parse diagnosis → extract fix_suggestion and target_files",
        "    - Present fix to user for manual application (default)",
        "    ",
        "    STEP 2.2: Apply Fix (Based on meta.use_codex Flag)",
        "    ",
        "    IF meta.use_codex = false (DEFAULT):",
        "    - Present Gemini diagnosis to user for manual fix",
        "    - User applies fix based on diagnosis recommendations",
        "    - Stage changes: bash(git add -A)",
        "    - Store fix log: .process/fix-iteration-[N]-changes.log",
        "    ",
        "    IF meta.use_codex = true (--use-codex flag present):",
        "    - Stage current changes (if valid git repo): bash(git add -A)",
        "    - First iteration: Start new Codex session",
        "      codex -C [project_root] --full-auto exec \"",
        "      PURPOSE: Fix test failure iteration 1",
        "      TASK: [fix_suggestion from Gemini]",
        "      MODE: write",
        "      CONTEXT: Diagnosis: .workflow/.process/fix-iteration-1-diagnosis.md",
        "               Target files: [target_files]",
        "               Implementation context: [implementation_context]",
        "      EXPECTED: Minimal code changes to resolve test failure",
        "      RULES: Apply ONLY suggested changes, no refactoring",
        "             Preserve existing code style",
        "      \" --skip-git-repo-check -s danger-full-access",
        "    - Subsequent iterations: Resume session for context continuity",
        "      codex exec \"",
        "      CONTINUE TO NEXT FIX:",
        "      Iteration [N] of 5: Fix test failure",
        "      ",
        "      PURPOSE: Fix remaining test failures",
        "      TASK: [fix_suggestion from Gemini iteration N]",
        "      CONTEXT: Previous fixes applied, diagnosis: .process/fix-iteration-[N]-diagnosis.md",
        "      EXPECTED: Surgical fix for current failure",
        "      RULES: Build on previous fixes, maintain consistency",
        "      \" resume --last --skip-git-repo-check -s danger-full-access",
        "    - Store fix log: .process/fix-iteration-[N]-changes.log",
        "    ",
        "    STEP 2.3: Retest and Verification",
        "    - Re-execute test suite: bash([test_command])",
        "    - Capture output: .process/fix-iteration-[N]-retest.log",
        "    - Count failures: bash(grep -c 'FAIL\\|ERROR' .process/fix-iteration-[N]-retest.log)",
        "    - Check for regression:",
        "      IF new_failures > previous_failures:",
        "        WARN: Regression detected",
        "        Include in next Gemini diagnosis context",
        "    - Analyze results:",
        "      IF all_tests_pass:",
        "        BREAK loop → Proceed to PHASE 3",
        "      ELSE:",
        "        Update test_failures context",
        "        CONTINUE loop",
        "  ",
        "  IF max_iterations reached AND tests still failing:",
        "    EXECUTE: git reset --hard HEAD (revert all changes)",
        "    MARK: Task status = blocked",
        "    GENERATE: Detailed failure report with iteration logs",
        "    EXIT: Require manual intervention",
        "",
        "PHASE 3: Final Validation and Certification",
        "  3.1. Execute final confirmation test run",
        "  3.2. Generate success summary:",
        "       - Iterations required: [current_iteration]",
        "       - Fixes applied: [summary from iteration logs]",
        "       - Test results: All passing ✅",
        "  3.3. Mark task status: completed",
        "  3.4. Update TODO_LIST.md: Mark as ✅",
        "  3.5. Certify code: APPROVED for deployment"
      ],
      "logic_flow": [
        "Load source session implementation context",
        "Discover test framework and command",
        "PHASE 0: Test Coverage Check",
        "  Analyze existing test files",
        "  Identify files without tests",
        "  IF tests missing:",
        "    Report to user (no automatic generation)",
        "    Wait for user to generate tests or request automation",
        "  ELSE:",
        "    Skip to Phase 1",
        "PHASE 1: Initial Test Execution",
        "  Execute test suite",
        "  IF all pass → Success (Phase 3)",
        "  ELSE → Store failures, proceed to Phase 2",
        "PHASE 2: Iterative Fix Cycle (max 5 iterations)",
        "  LOOP (max 5 times):",
        "    1. Gemini diagnoses failure with bug-fix template → fix suggestion",
        "    2. Check meta.use_codex flag:",
        "       - IF false (default): Present fix to user for manual application",
        "       - IF true (--use-codex): Codex applies fix with resume for continuity",
        "    3. Retest and check results",
        "    4. IF pass → Exit loop to Phase 3",
        "    5. ELSE → Continue with updated context",
        "  IF max iterations → Revert + report failure",
        "PHASE 3: Final Validation",
        "  Confirm all tests pass",
        "  Generate summary (include test generation info)",
        "  Certify code APPROVED"
      ],
        "error_handling": {
          "max_iterations_reached": {
            "action": "revert_all_changes",
            "commands": [
              "bash(git reset --hard HEAD)",
              "bash(jq '.status = \"blocked\"' .workflow/[session]/.task/IMPL-001.json > temp.json && mv temp.json .workflow/[session]/.task/IMPL-001.json)"
            ],
            "report": "Generate failure report with iteration logs in .summaries/IMPL-001-failure-report.md"
          },
          "test_command_fails": {
            "action": "treat_as_test_failure",
            "context": "Use stderr as failure context for Gemini diagnosis"
          },
          "codex_apply_fails": {
            "action": "retry_once_then_skip",
            "fallback": "Mark iteration as skipped, continue to next"
          },
          "gemini_diagnosis_fails": {
            "action": "retry_with_simplified_context",
            "fallback": "Use previous diagnosis, continue"
          },
          "regression_detected": {
            "action": "log_warning_continue",
            "context": "Include regression info in next Gemini diagnosis"
          }
        },
        "depends_on": [],
        "output": "test_fix_results"
      }
    ],
    "target_files": [
      "Auto-discovered from test failures",
      "Extracted from Gemini diagnosis each iteration",
      "Format: file:function:lines or file (for new files)"
    ],
    "codex_session": {
      "strategy": "resume_for_continuity",
      "first_iteration": "codex exec \"fix iteration 1\" --full-auto",
      "subsequent_iterations": "codex exec \"fix iteration N\" resume --last",
      "benefits": [
        "Maintains conversation context across fixes",
        "Remembers previous decisions and patterns",
        "Ensures consistency in fix approach",
        "Reduces redundant context injection"
      ]
    }
  }
}
```

### Phase 3: IMPL_PLAN.md Generation

#### Document Structure
```markdown
---
identifier: WFS-test-[session-id]
source_session: WFS-[source-session-id]
workflow_type: test_session
test_framework: jest|pytest|cargo|detected
---

# Test Validation Plan: [Source Session Topic]

## Summary
Execute comprehensive test suite for implementation from session WFS-[source-session-id].
Diagnose and fix all test failures using iterative Gemini analysis and Codex execution.

## Source Session Context
- **Implementation Session**: WFS-[source-session-id]
- **Completed Tasks**: IMPL-001, IMPL-002, ...
- **Changed Files**: [list from git log]
- **Implementation Summaries**: [references to source session summaries]

## Test Framework
- **Detected Framework**: jest|pytest|cargo|other
- **Test Command**: npm test|pytest|cargo test
- **Test Files**: [discovered test files]
- **Coverage**: [estimated test coverage]

## Test-Fix-Retest Cycle
- **Max Iterations**: 5
- **Diagnosis Tool**: Gemini (analysis mode with bug-fix template from bug-index.md)
- **Fix Tool**: Manual (default, meta.use_codex=false) or Codex (if --use-codex flag, meta.use_codex=true)
- **Verification**: Bash test execution + regression check

### Cycle Workflow
1. **Initial Test**: Execute full suite, capture failures
2. **Iterative Fix Loop** (max 5 times):
   - Gemini diagnoses failure using bug-fix template → surgical fix suggestion
   - Check meta.use_codex flag:
     - If false (default): Present fix to user for manual application
     - If true (--use-codex): Codex applies fix with resume for context continuity
   - Retest and verify (check for regressions)
   - Continue until all pass or max iterations reached
3. **Final Validation**: Confirm all tests pass, certify code

### Error Recovery
- **Max iterations reached**: Revert all changes, report failure
- **Test command fails**: Treat as test failure, diagnose with Gemini
- **Codex fails**: Retry once, skip iteration if still failing
- **Regression detected**: Log warning, include in next diagnosis

## Task Breakdown
- **IMPL-001**: Execute and validate tests with iterative fix cycle

## Implementation Strategy
- **Phase 1**: Initial test execution and failure capture
- **Phase 2**: Iterative Gemini diagnosis + Codex fix + retest
- **Phase 3**: Final validation and code certification

## Success Criteria
- All tests pass (100% pass rate)
- No test failures or errors in final run
- Minimal, surgical code changes
- Iteration logs document fix progression
- Code certified APPROVED for deployment
```

### Phase 4: TODO_LIST.md Generation

```markdown
# Tasks: Test Validation for [Source Session]

## Task Progress
- [ ] **IMPL-001**: Execute and validate tests with iterative fix cycle → [📋](./.task/IMPL-001.json)

## Execution Details
- **Source Session**: WFS-[source-session-id]
- **Test Framework**: jest|pytest|cargo
- **Max Iterations**: 5
- **Tools**: Gemini diagnosis + Codex resume fixes

## Status Legend
- `- [ ]` = Pending
- `- [x]` = Completed
```

## Output Files Structure
```
.workflow/WFS-test-[session]/
├── workflow-session.json           # Test session metadata
├── IMPL_PLAN.md                    # Test validation plan
├── TODO_LIST.md                    # Progress tracking
├── .task/
│   └── IMPL-001.json               # Test-fix task with cycle spec
├── .process/
│   ├── ANALYSIS_RESULTS.md         # From concept-enhanced (optional)
│   ├── context-package.json        # From context-gather
│   ├── initial-test.log            # Phase 1: Initial test results
│   ├── fix-iteration-1-diagnosis.md # Gemini diagnosis iteration 1
│   ├── fix-iteration-1-changes.log  # Codex changes iteration 1
│   ├── fix-iteration-1-retest.log   # Retest results iteration 1
│   ├── fix-iteration-N-*.md/log    # Subsequent iterations
│   └── final-test.log              # Phase 3: Final validation
└── .summaries/
    └── IMPL-001-summary.md         # Success report OR failure report
```

## Error Handling

### Input Validation Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| Not a test session | Missing workflow_type: "test_session" | Verify session created by test-gen |
| Source session not found | Invalid source_session_id | Check source session exists |
| No implementation summaries | Source session incomplete | Ensure source session has completed tasks |

### Test Framework Discovery Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| No test command found | Unknown framework | Manual test command specification |
| No test files found | Tests not written | Request user to write tests first |
| Test dependencies missing | Incomplete setup | Run dependency installation |

### Generation Errors
| Error | Cause | Resolution |
|-------|-------|------------|
| Invalid JSON structure | Template error | Fix task generation logic |
| Missing required fields | Incomplete metadata | Validate session metadata |

## Integration & Usage

### Command Chain
- **Called By**: `/workflow:test-gen` (Phase 4)
- **Calls**: None (terminal command)
- **Followed By**: `/workflow:execute` (user-triggered)

### Basic Usage
```bash
# Manual fix mode (default)
/workflow:tools:test-task-generate --session WFS-test-auth

# Automated Codex fix mode
/workflow:tools:test-task-generate --use-codex --session WFS-test-auth
```

### Flag Behavior
- **No flag**: `meta.use_codex=false`, manual fixes presented to user
- **--use-codex**: `meta.use_codex=true`, Codex automatically applies fixes with resume mechanism

## Related Commands
- `/workflow:test-gen` - Creates test session and calls this tool
- `/workflow:tools:context-gather` - Provides cross-session context
- `/workflow:tools:concept-enhanced` - Provides test strategy analysis
- `/workflow:execute` - Executes the generated test-fix task
- `@test-fix-agent` - Agent that executes the iterative test-fix cycle

## Agent Execution Notes

The `@test-fix-agent` will execute the task by following the `flow_control.implementation_approach` specification:

1. **Load task JSON**: Read complete test-fix task from `.task/IMPL-002.json`
2. **Check meta.use_codex**: Determine fix mode (manual or automated)
3. **Execute pre_analysis**: Load source context, discover framework, analyze tests
4. **Phase 1**: Run initial test suite
5. **Phase 2**: If failures, enter iterative loop:
   - Use Gemini for diagnosis (analysis mode with bug-fix template)
   - Check meta.use_codex flag:
     - If false (default): Present fix suggestions to user for manual application
     - If true (--use-codex): Use Codex resume for automated fixes (maintains context)
   - Retest and check for regressions
   - Repeat max 5 times
6. **Phase 3**: Generate summary and certify code
7. **Error Recovery**: Revert changes if max iterations reached

**Bug Diagnosis Template**: Uses bug-fix.md template as referenced in bug-index.md for systematic root cause analysis, code path tracing, and targeted fix recommendations.

**Codex Usage**: The agent uses `codex exec "..." resume --last` pattern ONLY when meta.use_codex=true (--use-codex flag present) to maintain conversation context across multiple fix iterations, ensuring consistency and learning from previous attempts.
