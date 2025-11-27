---
name: test-task-generate
description: Generate test planning documents (IMPL_PLAN.md, test task JSONs, TODO_LIST.md) using action-planning-agent - produces test planning artifacts, does NOT execute tests
argument-hint: "[--use-codex] [--cli-execute] --session WFS-test-session-id"
examples:
  - /workflow:tools:test-task-generate --session WFS-test-auth
  - /workflow:tools:test-task-generate --use-codex --session WFS-test-auth
  - /workflow:tools:test-task-generate --cli-execute --session WFS-test-auth
---

# Generate Test Planning Documents Command

## Overview
Generate test planning documents (IMPL_PLAN.md, test task JSONs, TODO_LIST.md) using action-planning-agent. This command produces **test planning artifacts only** - it does NOT execute tests or implement code. Actual test execution requires separate execution command (e.g., /workflow:test-cycle-execute).

## Core Philosophy
- **Planning Only**: Generate test planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) - does NOT execute tests
- **Agent-Driven Document Generation**: Delegate test plan generation to action-planning-agent
- **Two-Phase Flow**: Context Preparation (command) → Test Document Generation (agent)
- **Memory-First**: Reuse loaded documents from conversation memory
- **MCP-Enhanced**: Use MCP tools for test pattern research and analysis
- **Path Clarity**: All `focus_paths` prefer absolute paths (e.g., `D:\\project\\src\\module`), or clear relative paths from project root
- **Leverage Existing Test Infrastructure**: Prioritize using established testing frameworks and tools present in the project

## Test-Specific Execution Modes

### Test Generation (IMPL-001)
- **Agent Mode** (default): @code-developer generates tests within agent context
- **CLI Execute Mode** (`--cli-execute`): Use Codex CLI for autonomous test generation

### Test Execution & Fix (IMPL-002+)
- **Manual Mode** (default): Gemini diagnosis → user applies fixes
- **Codex Mode** (`--use-codex`): Gemini diagnosis → Codex applies fixes with resume mechanism

## Execution Process

```
Input Parsing:
   ├─ Parse flags: --session, --use-codex, --cli-execute
   └─ Validation: session_id REQUIRED

Phase 1: Context Preparation (Command)
   ├─ Assemble test session paths
   │  ├─ session_metadata_path
   │  ├─ test_analysis_results_path (REQUIRED)
   │  └─ test_context_package_path
   └─ Provide metadata (session_id, execution_mode, use_codex, source_session_id)

Phase 2: Test Document Generation (Agent)
   ├─ Load TEST_ANALYSIS_RESULTS.md as primary requirements source
   ├─ Generate Test Task JSON Files (.task/IMPL-*.json)
   │  ├─ IMPL-001: Test generation (meta.type: "test-gen")
   │  └─ IMPL-002+: Test execution & fix (meta.type: "test-fix")
   ├─ Create IMPL_PLAN.md (test_session variant)
   └─ Generate TODO_LIST.md with test phase indicators
```

## Document Generation Lifecycle

### Phase 1: Context Preparation (Command Responsibility)

**Command prepares test session paths and metadata for planning document generation.**

**Test Session Path Structure**:
```
.workflow/active/WFS-test-{session-id}/
├── workflow-session.json          # Test session metadata
├── .process/
│   ├── TEST_ANALYSIS_RESULTS.md   # Test requirements and strategy
│   ├── test-context-package.json  # Test patterns and coverage
│   └── context-package.json       # General context artifacts
├── .task/                         # Output: Test task JSON files
├── IMPL_PLAN.md                   # Output: Test implementation plan
└── TODO_LIST.md                   # Output: Test TODO list
```

**Command Preparation**:
1. **Assemble Test Session Paths** for agent prompt:
   - `session_metadata_path`
   - `test_analysis_results_path` (REQUIRED)
   - `test_context_package_path`
   - Output directory paths

2. **Provide Metadata** (simple values):
   - `session_id`
   - `execution_mode` (agent-mode | cli-execute-mode)
   - `use_codex` flag (true | false)
   - `source_session_id` (if exists)
   - `mcp_capabilities` (available MCP tools)

### Phase 2: Test Document Generation (Agent Responsibility)

**Purpose**: Generate test-specific IMPL_PLAN.md, task JSONs, and TODO_LIST.md - planning documents only, NOT test execution.

**Agent Invocation**:
```javascript
Task(
  subagent_type="action-planning-agent",
  description="Generate test planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md)",
  prompt=`
## TASK OBJECTIVE
Generate test planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) for test workflow session

IMPORTANT: This is TEST PLANNING ONLY - you are generating planning documents, NOT executing tests.

CRITICAL:
- Use existing test frameworks and utilities from the project
- Follow the progressive loading strategy defined in your agent specification (load context incrementally from memory-first approach)

## AGENT CONFIGURATION REFERENCE
All test task generation rules, schemas, and quality standards are defined in your agent specification:
@.claude/agents/action-planning-agent.md

Refer to your specification for:
- Test Task JSON Schema (6-field structure with test-specific metadata)
- Test IMPL_PLAN.md Structure (test_session variant with test-fix cycle)
- TODO_LIST.md Format (with test phase indicators)
- Progressive Loading Strategy (memory-first, load TEST_ANALYSIS_RESULTS.md as primary source)
- Quality Validation Rules (task count limits, requirement quantification)

## SESSION PATHS
Input:
  - Session Metadata: .workflow/active/{test-session-id}/workflow-session.json
  - TEST_ANALYSIS_RESULTS: .workflow/active/{test-session-id}/.process/TEST_ANALYSIS_RESULTS.md (REQUIRED - primary requirements source)
  - Test Context Package: .workflow/active/{test-session-id}/.process/test-context-package.json
  - Context Package: .workflow/active/{test-session-id}/.process/context-package.json
  - Source Session Summaries: .workflow/active/{source-session-id}/.summaries/IMPL-*.md (if exists)

Output:
  - Task Dir: .workflow/active/{test-session-id}/.task/
  - IMPL_PLAN: .workflow/active/{test-session-id}/IMPL_PLAN.md
  - TODO_LIST: .workflow/active/{test-session-id}/TODO_LIST.md

## CONTEXT METADATA
Session ID: {test-session-id}
Workflow Type: test_session
Planning Mode: {agent-mode | cli-execute-mode}
Use Codex: {true | false}
Source Session: {source-session-id} (if exists)
MCP Capabilities: {exa_code, exa_web, code_index}

## TEST-SPECIFIC REQUIREMENTS SUMMARY
(Detailed specifications in your agent definition)

### Task Structure Requirements
- Minimum 2 tasks: IMPL-001 (test generation) + IMPL-002 (test execution & fix)
- Expandable for complex projects: Add IMPL-003+ (per-module, integration, E2E tests)

Task Configuration:
  IMPL-001 (Test Generation):
    - meta.type: "test-gen"
    - meta.agent: "@code-developer" (agent-mode) OR CLI execution (cli-execute-mode)
    - meta.test_framework: Specify existing framework (e.g., "jest", "vitest", "pytest")
    - flow_control: Test generation strategy from TEST_ANALYSIS_RESULTS.md

  IMPL-002+ (Test Execution & Fix):
    - meta.type: "test-fix"
    - meta.agent: "@test-fix-agent"
    - meta.use_codex: true/false (based on flag)
    - flow_control: Test-fix cycle with iteration limits and diagnosis configuration

### Test-Fix Cycle Specification (IMPL-002+)
Required flow_control fields:
  - max_iterations: 5
  - diagnosis_tool: "gemini"
  - diagnosis_template: "~/.claude/workflows/cli-templates/prompts/analysis/01-diagnose-bug-root-cause.txt"
  - fix_mode: "manual" OR "codex" (based on use_codex flag)
  - cycle_pattern: "test → gemini_diagnose → fix → retest"
  - exit_conditions: ["all_tests_pass", "max_iterations_reached"]
  - auto_revert_on_failure: true

### TEST_ANALYSIS_RESULTS.md Mapping
PRIMARY requirements source - extract and map to task JSONs:
  - Test framework config → meta.test_framework (use existing framework from project)
  - Existing test utilities → flow_control.reusable_test_tools (discovered test helpers, fixtures, mocks)
  - Test runner commands → flow_control.test_commands (from package.json or pytest config)
  - Coverage targets → meta.coverage_target
  - Test requirements → context.requirements (quantified with explicit counts)
  - Test generation strategy → IMPL-001 flow_control.implementation_approach
  - Implementation targets → context.files_to_test (absolute paths)

## EXPECTED DELIVERABLES
1. Test Task JSON Files (.task/IMPL-*.json)
   - 6-field schema with quantified requirements from TEST_ANALYSIS_RESULTS.md
   - Test-specific metadata: type, agent, use_codex, test_framework, coverage_target
   - flow_control includes: reusable_test_tools, test_commands (from project config)
   - Artifact references from test-context-package.json
   - Absolute paths in context.files_to_test

2. Test Implementation Plan (IMPL_PLAN.md)
   - Template: ~/.claude/workflows/cli-templates/prompts/workflow/impl-plan-template.txt
   - Test-specific frontmatter: workflow_type="test_session", test_framework, source_session_id
   - Test-Fix-Retest Cycle section with diagnosis configuration
   - Source session context integration (if applicable)

3. TODO List (TODO_LIST.md)
   - Hierarchical structure with test phase containers
   - Links to task JSONs with status markers
   - Matches task JSON hierarchy

## QUALITY STANDARDS
Hard Constraints:
  - Task count: minimum 2, maximum 12
  - All requirements quantified from TEST_ANALYSIS_RESULTS.md
  - Test framework matches existing project framework
  - flow_control includes reusable_test_tools and test_commands from project
  - use_codex flag correctly set in IMPL-002+ tasks
  - Absolute paths for all focus_paths
  - Acceptance criteria include verification commands

## SUCCESS CRITERIA
- All test planning documents generated successfully
- Return completion status: task count, test framework, coverage targets, source session status
`
)
```

## Integration & Usage

### Command Chain
- **Called By**: `/workflow:test-gen` (Phase 4), `/workflow:test-fix-gen` (Phase 4)
- **Invokes**: `action-planning-agent` for test planning document generation
- **Followed By**: `/workflow:test-cycle-execute` or `/workflow:execute` (user-triggered)

### Usage Examples
```bash
# Agent mode (default)
/workflow:tools:test-task-generate --session WFS-test-auth

# With automated Codex fixes
/workflow:tools:test-task-generate --use-codex --session WFS-test-auth

# CLI execution mode for test generation
/workflow:tools:test-task-generate --cli-execute --session WFS-test-auth
```

### Flag Behavior
- **No flags**: `meta.use_codex=false` (manual fixes), agent-mode test generation
- **--use-codex**: `meta.use_codex=true` (Codex automated fixes in IMPL-002+)
- **--cli-execute**: CLI tool execution mode for IMPL-001 test generation
- **Both flags**: CLI generation + automated Codex fixes

### Output
- Test task JSON files in `.task/` directory (minimum 2)
- IMPL_PLAN.md with test strategy and fix cycle specification
- TODO_LIST.md with test phase indicators
- Session ready for test execution
