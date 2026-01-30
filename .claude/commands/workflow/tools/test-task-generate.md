---
name: test-task-generate
description: Generate test planning documents (IMPL_PLAN.md, test task JSONs, TODO_LIST.md) by invoking test-action-planning-agent
argument-hint: "--session WFS-test-session-id"
examples:
  - /workflow:tools:test-task-generate --session WFS-test-auth
---

# Generate Test Planning Documents Command

## Overview

Generate test planning documents (IMPL_PLAN.md, test task JSONs, TODO_LIST.md) by invoking **test-action-planning-agent**.

This command produces **test planning artifacts only** - it does NOT execute tests or implement code. Actual test execution requires separate execution command (e.g., /workflow:test-cycle-execute).

### Agent Specialization

This command invokes `@test-action-planning-agent` - a specialized variant of action-planning-agent with:
- Progressive L0-L3 test layers (Static, Unit, Integration, E2E)
- AI code issue detection (L0.5) with severity levels
- Project type templates (React, Node API, CLI, Library, Monorepo)
- Test anti-pattern detection with quality gates
- Layer completeness thresholds and coverage targets

**See**: `d:\Claude_dms3\.claude\agents\test-action-planning-agent.md` for complete test specifications.

---

## Execution Process

```
Input Parsing:
   └─ Parse flags: --session

Phase 1: Context Preparation (Command)
   ├─ Assemble test session paths
   │  ├─ session_metadata_path
   │  ├─ test_analysis_results_path (REQUIRED)
   │  └─ test_context_package_path
   └─ Provide metadata (session_id, source_session_id)

Phase 2: Test Document Generation (Agent)
   ├─ Load TEST_ANALYSIS_RESULTS.md as primary requirements source
   ├─ Generate Test Task JSON Files (.task/IMPL-*.json)
   │  ├─ IMPL-001: Test generation (L1-L3 layers, project-specific templates)
   │  ├─ IMPL-001.3: Code validation gate (L0 + AI issue detection)
   │  ├─ IMPL-001.5: Test quality gate (anti-patterns + coverage)
   │  └─ IMPL-002: Test execution & fix cycle
   ├─ Create IMPL_PLAN.md (test_session variant)
   └─ Generate TODO_LIST.md with test phase indicators
```

---

## Agent Invocation

```javascript
Task(
  subagent_type="test-action-planning-agent",
  run_in_background=false,
  description="Generate test planning documents",
  prompt=`
## TASK OBJECTIVE
Generate test planning documents (IMPL_PLAN.md, task JSONs, TODO_LIST.md) for test workflow session

IMPORTANT: This is TEST PLANNING ONLY - you are generating planning documents, NOT executing tests.

## SESSION PATHS
Input:
  - Session Metadata: .workflow/active/{test-session-id}/workflow-session.json
  - TEST_ANALYSIS_RESULTS: .workflow/active/{test-session-id}/.process/TEST_ANALYSIS_RESULTS.md (REQUIRED)
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
Source Session: {source-session-id} (if exists)
MCP Capabilities: {exa_code, exa_web, code_index}

## YOUR SPECIFICATIONS
You are @test-action-planning-agent. Your complete test specifications are defined in:
  d:\Claude_dms3\.claude\agents\test-action-planning-agent.md

This includes:
  - Progressive Test Layers (L0-L3) with L0.1-L0.5, L1.1-L1.5, L2.1-L2.5, L3.1-L3.4
  - AI Code Issue Detection (L0.5) with 7 categories and severity levels
  - Project Type Detection & Templates (6 project types)
  - Test Anti-Pattern Detection (5 categories)
  - Layer Completeness & Quality Metrics (thresholds and gate decisions)
  - Task JSON structure requirements (minimum 4 tasks)
  - Quality validation rules

**Follow your specification exactly** when generating test task JSONs.

## EXPECTED DELIVERABLES
1. Test Task JSON Files (.task/IMPL-*.json) - Minimum 4:
   - IMPL-001.json: Test generation (L1-L3 layers per spec)
   - IMPL-001.3-validation.json: Code validation gate (L0 + AI issues per spec)
   - IMPL-001.5-review.json: Test quality gate (anti-patterns + coverage per spec)
   - IMPL-002.json: Test execution & fix cycle

2. IMPL_PLAN.md: Test implementation plan with quality gates

3. TODO_LIST.md: Hierarchical task list with test phase indicators

## SUCCESS CRITERIA
- All test planning documents generated successfully
- Task count: minimum 4 (expandable for complex projects)
- Test framework: {detected from project}
- Coverage targets: L0 zero errors, L1 80%+, L2 70%+
- L0-L3 layers explicitly defined per spec
- AI issue detection configured per spec
- Quality gates with measurable thresholds
`
)
```

---

## Test-Specific Execution Modes

### Test Generation (IMPL-001)
- **Agent Mode** (default): @code-developer generates tests within agent context
- **CLI Mode**: Use CLI tools when `command` field present in implementation_approach

### Test Execution & Fix (IMPL-002+)
- **Agent Mode** (default): Gemini diagnosis → agent applies fixes
- **CLI Mode**: Gemini diagnosis → CLI applies fixes (when `command` field present)

**CLI Tool Selection**: Determined semantically from user's task description (e.g., "use Codex for fixes")

---

## Output

### Directory Structure

```
.workflow/active/WFS-test-[session]/
├── workflow-session.json              # Session metadata
├── IMPL_PLAN.md                       # Test implementation plan
├── TODO_LIST.md                       # Task checklist
├── .task/
│   ├── IMPL-001.json                  # Test generation (L1-L3)
│   ├── IMPL-001.3-validation.json     # Code validation gate (L0 + AI)
│   ├── IMPL-001.5-review.json         # Test quality gate
│   └── IMPL-002.json                  # Test execution & fix cycle
└── .process/
    ├── test-context-package.json      # Test coverage and patterns
    └── TEST_ANALYSIS_RESULTS.md       # L0-L3 requirements (source for agent)
```

### Task Summary

| Task | Type | Agent | Purpose |
|------|------|-------|---------|
| IMPL-001 | test-gen | @code-developer | Generate L1-L3 tests with project templates |
| IMPL-001.3 | code-validation | @test-fix-agent | Validate L0 + detect AI issues (CRITICAL/ERROR/WARNING) |
| IMPL-001.5 | test-quality-review | @test-fix-agent | Check anti-patterns, layer completeness, coverage |
| IMPL-002 | test-fix | @test-fix-agent | Execute tests, diagnose failures, apply fixes |

---

## Integration & Usage

### Command Chain
- **Called By**: `/workflow:test-fix-gen` (Phase 4)
- **Invokes**: `@test-action-planning-agent` for test planning document generation
- **Followed By**: `/workflow:test-cycle-execute` or `/workflow:execute` (user-triggered)

### Usage Examples
```bash
# Standard execution
/workflow:tools:test-task-generate --session WFS-test-auth

# With semantic CLI request (include in task description when calling /workflow:test-fix-gen)
# e.g., "Generate tests, use Codex for implementation and fixes"
```

### Output Validation

**Minimum Requirements**:
- 4 task JSON files created
- IMPL_PLAN.md exists with test-specific sections
- TODO_LIST.md exists with test phase hierarchy
- All tasks reference TEST_ANALYSIS_RESULTS.md specifications
- L0-L3 layers explicitly defined in IMPL-001
- AI issue detection configured in IMPL-001.3
- Quality gates with thresholds in IMPL-001.5

---

## Related Commands

**Called By**:
- `/workflow:test-fix-gen` - Phase 4: Generate test planning documents

**Prerequisite**:
- `/workflow:tools:test-concept-enhanced` - Must generate TEST_ANALYSIS_RESULTS.md first

**Follow-Up**:
- `/workflow:test-cycle-execute` - Execute generated test tasks
- `/workflow:execute` - Alternative: Standard task execution
