---
name: test-fix-gen
description: Create independent test-fix workflow session from existing implementation (session or prompt-based)
argument-hint: "[--use-codex] [--cli-execute] (source-session-id | \"feature description\" | /path/to/file.md)"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*)
---

# Workflow Test-Fix Generation Command (/workflow:test-fix-gen)

## Overview

### What It Does

This command creates an independent test-fix workflow session for existing code. It orchestrates a 5-phase process to analyze implementation, generate test requirements, and create executable test generation and fix tasks.

**⚠️ CRITICAL - Command Scope**:
- **This command ONLY generates task JSON files** (IMPL-001.json, IMPL-002.json)
- **Does NOT execute tests or apply fixes** - all execution happens in separate orchestrator
- **Must call `/workflow:test-cycle-execute`** after this command to actually run tests and fixes
- **Test failure handling happens in test-cycle-execute**, not here

### Dual-Mode Support

**Automatic mode detection** based on input pattern:

| Mode | Input Pattern | Context Source | Use Case |
|------|--------------|----------------|----------|
| **Session Mode** | `WFS-xxx` | Source session summaries | Test validation for completed workflow |
| **Prompt Mode** | Text or file path | Direct codebase analysis | Test generation from description |

**Detection Logic**:
```bash
if [[ "$input" == WFS-* ]]; then
  MODE="session"  # Use test-context-gather
else
  MODE="prompt"   # Use context-gather
fi
```

### Core Principles

- **Dual Input Support**: Accepts session ID (WFS-xxx) or feature description/file path
- **Session Isolation**: Creates independent `WFS-test-[slug]` session
- **Context-First**: Gathers implementation context via appropriate method
- **Format Reuse**: Creates standard `IMPL-*.json` tasks with `meta.type: "test-fix"`
- **Manual First**: Default to manual fixes, use `--use-codex` for automation
- **Automatic Detection**: Input pattern determines execution mode

### Coordinator Role

This command is a **pure planning coordinator**:
- Does NOT analyze code directly
- Does NOT generate tests or documentation
- Does NOT execute tests or apply fixes
- Does NOT handle test failures or iterations
- ONLY coordinates slash commands to generate task JSON files
- Parses outputs to pass data between phases
- Creates independent test workflow session
- **All execution delegated to `/workflow:test-cycle-execute`**

---

## Usage

### Command Syntax

```bash
# Basic syntax
/workflow:test-fix-gen [FLAGS] <INPUT>

# Flags (optional)
--use-codex        # Enable Codex automated fixes in IMPL-002
--cli-execute      # Enable CLI execution in IMPL-001

# Input
<INPUT>            # Session ID, description, or file path
```

### Usage Examples

#### Session Mode
```bash
# Test validation for completed implementation
/workflow:test-fix-gen WFS-user-auth-v2

# With automated fixes
/workflow:test-fix-gen --use-codex WFS-api-endpoints

# With CLI execution
/workflow:test-fix-gen --cli-execute --use-codex WFS-payment-flow
```

#### Prompt Mode - Text Description
```bash
# Generate tests from feature description
/workflow:test-fix-gen "Test the user authentication API endpoints in src/auth/api.ts"

# With automated fixes
/workflow:test-fix-gen --use-codex "Test user registration and login flows"
```

#### Prompt Mode - File Reference
```bash
# Generate tests from requirements file
/workflow:test-fix-gen ./docs/api-requirements.md

# With flags
/workflow:test-fix-gen --use-codex --cli-execute ./specs/feature.md
```

### Mode Comparison

| Aspect | Session Mode | Prompt Mode |
|--------|-------------|-------------|
| **Phase 1** | Create `WFS-test-[source]` with `source_session_id` | Create `WFS-test-[slug]` without `source_session_id` |
| **Phase 2** | `/workflow:tools:test-context-gather` | `/workflow:tools:context-gather` |
| **Phase 3-5** | Identical | Identical |
| **Context** | Source session summaries + artifacts | Direct codebase analysis |

---

## Execution Flow

### Core Execution Rules

1. **Start Immediately**: First action is TodoWrite, second is Phase 1 session creation
2. **No Preliminary Analysis**: Do not read files before Phase 1
3. **Parse Every Output**: Extract required data from each phase for next phase
4. **Sequential Execution**: Each phase depends on previous phase's output
5. **Complete All Phases**: Do not return until Phase 5 completes
6. **Track Progress**: Update TodoWrite after every phase
7. **Automatic Detection**: Mode auto-detected from input pattern
8. **Parse Flags**: Extract `--use-codex` and `--cli-execute` flags for Phase 4

### 5-Phase Execution

#### Phase 1: Create Test Session

**Command**:
- **Session Mode**: `SlashCommand("/workflow:session:start --new \"Test validation for [sourceSessionId]\"")`
- **Prompt Mode**: `SlashCommand("/workflow:session:start --new \"Test generation for: [description]\"")`

**Input**: User argument (session ID, description, or file path)

**Expected Behavior**:
- Creates new session: `WFS-test-[slug]`
- Writes `workflow-session.json` metadata:
  - **Session Mode**: Includes `workflow_type: "test_session"`, `source_session_id: "[sourceId]"`
  - **Prompt Mode**: Includes `workflow_type: "test_session"` only
- Returns new session ID

**Parse Output**:
- Extract: `testSessionId` (pattern: `WFS-test-[slug]`)

**Validation**:
- **Session Mode**: Source session exists with completed IMPL tasks
- **Both Modes**: New test session directory created with metadata

**TodoWrite**: Mark phase 1 completed, phase 2 in_progress

---

#### Phase 2: Gather Test Context

**Command**:
- **Session Mode**: `SlashCommand("/workflow:tools:test-context-gather --session [testSessionId]")`
- **Prompt Mode**: `SlashCommand("/workflow:tools:context-gather --session [testSessionId] \"[task_description]\"")`

**Input**: `testSessionId` from Phase 1

**Expected Behavior**:
- **Session Mode**:
  - Load source session implementation context and summaries
  - Analyze test coverage using MCP tools
  - Identify files requiring tests
- **Prompt Mode**:
  - Analyze codebase based on description
  - Identify relevant files and dependencies
- Detect test framework and conventions
- Generate context package JSON

**Parse Output**:
- Extract: `contextPath` (pattern: `.workflow/[testSessionId]/.process/[test-]context-package.json`)

**Validation**:
- Context package created with coverage analysis
- Test framework detected
- Test conventions documented

**TodoWrite**: Mark phase 2 completed, phase 3 in_progress

---

#### Phase 3: Test Generation Analysis

**Command**: `SlashCommand("/workflow:tools:test-concept-enhanced --session [testSessionId] --context [contextPath]")`

**Input**:
- `testSessionId` from Phase 1
- `contextPath` from Phase 2

**Expected Behavior**:
- Use Gemini to analyze coverage gaps and implementation
- Study existing test patterns and conventions
- Generate test requirements for missing test files
- Design test generation strategy
- Generate `TEST_ANALYSIS_RESULTS.md`

**Parse Output**:
- Verify `.workflow/[testSessionId]/.process/TEST_ANALYSIS_RESULTS.md` created

**Validation**:
- TEST_ANALYSIS_RESULTS.md exists with complete sections:
  - Coverage Assessment
  - Test Framework & Conventions
  - Test Requirements by File
  - Test Generation Strategy
  - Implementation Targets
  - Success Criteria

**TodoWrite**: Mark phase 3 completed, phase 4 in_progress

---

#### Phase 4: Generate Test Tasks

**Command**: `SlashCommand("/workflow:tools:test-task-generate [--use-codex] [--cli-execute] --session [testSessionId]")`

**Input**:
- `testSessionId` from Phase 1
- `--use-codex` flag (if present) - Controls IMPL-002 fix mode
- `--cli-execute` flag (if present) - Controls IMPL-001 generation mode

**Expected Behavior**:
- Parse TEST_ANALYSIS_RESULTS.md from Phase 3
- Generate **minimum 2 task JSON files** (expandable based on complexity):
  - **IMPL-001.json**: Test Understanding & Generation (`@code-developer`)
  - **IMPL-002.json**: Test Execution & Fix Cycle (`@test-fix-agent`)
  - **IMPL-003+**: Additional tasks if needed for complex projects
- Generate `IMPL_PLAN.md` with test strategy
- Generate `TODO_LIST.md` with task checklist

**Parse Output**:
- Verify `.workflow/[testSessionId]/.task/IMPL-001.json` exists
- Verify `.workflow/[testSessionId]/.task/IMPL-002.json` exists
- Verify additional `.task/IMPL-*.json` if applicable
- Verify `IMPL_PLAN.md` and `TODO_LIST.md` created

**TodoWrite**: Mark phase 4 completed, phase 5 in_progress

---

#### Phase 5: Return Summary

**Return to User**:
```
Independent test-fix workflow created successfully!

Input: [original input]
Mode: [Session|Prompt]
Test Session: [testSessionId]

Tasks Created:
- IMPL-001: Test Understanding & Generation (@code-developer)
- IMPL-002: Test Execution & Fix Cycle (@test-fix-agent)
[- IMPL-003+: Additional tasks if applicable]

Test Framework: [detected framework]
Test Files to Generate: [count]
Max Fix Iterations: 5
Fix Mode: [Manual|Codex Automated]

Review artifacts:
- Test plan: .workflow/[testSessionId]/IMPL_PLAN.md
- Task list: .workflow/[testSessionId]/TODO_LIST.md

⚠️ CRITICAL - Next Steps:
1. Review IMPL_PLAN.md
2. **MUST execute: /workflow:test-cycle-execute**
   - This command only generated task JSON files
   - Test execution and fix iterations happen in test-cycle-execute
   - Do NOT attempt to run tests or fixes in main workflow
```

**TodoWrite**: Mark phase 5 completed

**⚠️ BOUNDARY NOTE**:
- Command completes here - only task JSON files generated
- All test execution, failure detection, CLI analysis, fix generation happens in `/workflow:test-cycle-execute`
- This command does NOT handle test failures or apply fixes

---

### TodoWrite Progress Tracking

Track all 5 phases:

```javascript
TodoWrite({todos: [
  {"content": "Create independent test session", "status": "in_progress|completed", "activeForm": "Creating test session"},
  {"content": "Gather test coverage context", "status": "pending|in_progress|completed", "activeForm": "Gathering test coverage context"},
  {"content": "Analyze test requirements with Gemini", "status": "pending|in_progress|completed", "activeForm": "Analyzing test requirements"},
  {"content": "Generate test generation and execution tasks", "status": "pending|in_progress|completed", "activeForm": "Generating test tasks"},
  {"content": "Return workflow summary", "status": "pending|in_progress|completed", "activeForm": "Returning workflow summary"}
]})
```

Update status to `in_progress` when starting each phase, `completed` when done.

---

## Task Specifications

Generates minimum 2 tasks (expandable for complex projects):

### IMPL-001: Test Understanding & Generation

**Agent**: `@code-developer`

**Purpose**: Understand source implementation and generate test files

**Task Configuration**:
- Task ID: `IMPL-001`
- `meta.type: "test-gen"`
- `meta.agent: "@code-developer"`
- `context.requirements`: Understand source implementation and generate tests
- `flow_control.target_files`: Test files to create from TEST_ANALYSIS_RESULTS.md section 5

**Execution Flow**:
1. **Understand Phase**:
   - Load TEST_ANALYSIS_RESULTS.md and test context
   - Understand source code implementation patterns
   - Analyze test requirements and conventions
   - Identify test scenarios and edge cases
2. **Generation Phase**:
   - Generate test files following existing patterns
   - Ensure test coverage aligns with requirements
3. **Verification Phase**:
   - Verify test completeness and correctness

### IMPL-002: Test Execution & Fix Cycle

**Agent**: `@test-fix-agent`

**Purpose**: Execute initial tests and trigger orchestrator-managed fix cycles

**Note**: This task executes tests and reports results. The test-cycle-execute orchestrator manages all fix iterations, CLI analysis, and fix task generation.

**Task Configuration**:
- Task ID: `IMPL-002`
- `meta.type: "test-fix"`
- `meta.agent: "@test-fix-agent"`
- `meta.use_codex: true|false` (based on `--use-codex` flag)
- `context.depends_on: ["IMPL-001"]`
- `context.requirements`: Execute and fix tests

**Test-Fix Cycle Specification**:
**Note**: This specification describes what test-cycle-execute orchestrator will do. The agent only executes single tasks.
- **Cycle Pattern** (orchestrator-managed): test → gemini_diagnose → manual_fix (or codex) → retest
- **Tools Configuration** (orchestrator-controlled):
  - Gemini for analysis with bug-fix template → surgical fix suggestions
  - Manual fix application (default) OR Codex if `--use-codex` flag (resume mechanism)
- **Exit Conditions** (orchestrator-enforced):
  - Success: All tests pass
  - Failure: Max iterations reached (5)

**Execution Flow**:
1. **Phase 1**: Initial test execution
2. **Phase 2**: Iterative Gemini diagnosis + manual/Codex fixes
3. **Phase 3**: Final validation and certification

### IMPL-003+: Additional Tasks (Optional)

**Scenarios for Multiple Tasks**:
- Large projects requiring per-module test generation
- Separate integration vs unit test tasks
- Specialized test types (performance, security, etc.)

**Agent**: `@code-developer` or specialized agents based on requirements

---

## Artifacts & Output

### Output Files Structure

Created in `.workflow/WFS-test-[session]/`:

```
WFS-test-[session]/
├── workflow-session.json          # Session metadata
├── IMPL_PLAN.md                   # Test generation and execution strategy
├── TODO_LIST.md                   # Task checklist
├── .task/
│   ├── IMPL-001.json              # Test understanding & generation
│   ├── IMPL-002.json              # Test execution & fix cycle
│   └── IMPL-*.json                # Additional tasks (if applicable)
└── .process/
    ├── [test-]context-package.json # Context and coverage analysis
    └── TEST_ANALYSIS_RESULTS.md    # Test requirements and strategy
```

### Session Metadata

**File**: `workflow-session.json`

**Session Mode** includes:
- `workflow_type: "test_session"`
- `source_session_id: "[sourceSessionId]"` (enables automatic cross-session context)

**Prompt Mode** includes:
- `workflow_type: "test_session"`
- No `source_session_id` field

### Complete Data Flow

**Example Command**: `/workflow:test-fix-gen WFS-user-auth`

**Phase Execution Chain**:
1. Phase 1: `session-start` → `WFS-test-user-auth`
2. Phase 2: `test-context-gather` → `test-context-package.json`
3. Phase 3: `test-concept-enhanced` → `TEST_ANALYSIS_RESULTS.md`
4. Phase 4: `test-task-generate` → `IMPL-001.json` + `IMPL-002.json` (+ additional if needed)
5. Phase 5: Return summary

**Command completes after Phase 5**

---

## Reference

### Error Handling

| Phase | Error Condition | Action |
|-------|----------------|--------|
| 1 | Source session not found (session mode) | Return error with source session ID |
| 1 | No completed IMPL tasks (session mode) | Return error, source incomplete |
| 2 | Context gathering failed | Return error, check source artifacts |
| 3 | Gemini analysis failed | Return error, check context package |
| 4 | Task generation failed | Retry once, then return error with details |

### Best Practices

1. **Before Running**:
   - Ensure implementation is complete (session mode: check summaries exist)
   - Commit all implementation changes
   - Review source code quality

2. **After Running**:
   - Review generated `IMPL_PLAN.md` before execution
   - Check `TEST_ANALYSIS_RESULTS.md` for completeness
   - Verify task dependencies in `TODO_LIST.md`

3. **During Execution**:
   - Monitor iteration logs in `.process/fix-iteration-*`
   - Track progress with `/workflow:status`
   - Review Gemini diagnostic outputs

4. **Mode Selection**:
   - Use **Session Mode** for completed workflow validation
   - Use **Prompt Mode** for ad-hoc test generation
   - Use `--use-codex` for autonomous fix application
   - Use `--cli-execute` for enhanced generation capabilities

### Related Commands

**Planning Phase**:
- `/workflow:plan` - Create implementation workflow
- `/workflow:session:start` - Initialize workflow session

**Context Gathering**:
- `/workflow:tools:test-context-gather` - Session-based context (Phase 2 for session mode)
- `/workflow:tools:context-gather` - Prompt-based context (Phase 2 for prompt mode)

**Analysis & Task Generation**:
- `/workflow:tools:test-concept-enhanced` - Gemini test analysis (Phase 3)
- `/workflow:tools:test-task-generate` - Generate test tasks (Phase 4)

**Execution**:
- `/workflow:test-cycle-execute` - Execute test-fix workflow (recommended for IMPL-002)
- `/workflow:execute` - Execute standard workflow tasks
- `/workflow:status` - Check task progress

**Review & Management**:
- `/workflow:review` - Review workflow results
- `/workflow:session:complete` - Mark session complete
