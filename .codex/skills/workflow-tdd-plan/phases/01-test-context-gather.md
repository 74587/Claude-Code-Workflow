# Phase 1: Test Context Gather

## Overview

Orchestrator command that invokes `test-context-search-agent` to gather comprehensive test coverage context for test generation workflows. Generates standardized `test-context-package.json` with coverage analysis, framework detection, and source implementation context.

## Core Philosophy

- **Agent Delegation**: Delegate all test coverage analysis to `test-context-search-agent` for autonomous execution
- **Detection-First**: Check for existing test-context-package before executing
- **Coverage-First**: Analyze existing test coverage before planning new tests
- **Source Context Loading**: Import implementation summaries from source session
- **Standardized Output**: Generate `.workflow/active/{test_session_id}/.process/test-context-package.json`
- **Explicit Lifecycle**: Always close_agent after wait completes to free resources

## Execution Process

```
Input Parsing:
   ├─ Parse flags: --session
   └─ Validation: test_session_id REQUIRED

Step 1: Test-Context-Package Detection
   └─ Decision (existing package):
      ├─ Valid package exists → Return existing (skip execution)
      └─ No valid package → Continue to Step 2

Step 2: Invoke Test-Context-Search Agent
   ├─ Phase 1: Session Validation & Source Context Loading
   │  ├─ Detection: Check for existing test-context-package
   │  ├─ Test session validation
   │  └─ Source context loading (summaries, changed files)
   ├─ Phase 2: Test Coverage Analysis
   │  ├─ Track 1: Existing test discovery
   │  ├─ Track 2: Coverage gap analysis
   │  └─ Track 3: Coverage statistics
   └─ Phase 3: Framework Detection & Packaging
      ├─ Framework identification
      ├─ Convention analysis
      └─ Generate test-context-package.json

Step 3: Output Verification
   └─ Verify test-context-package.json created
```

## Execution Flow

### Step 1: Test-Context-Package Detection

**Execute First** - Check if valid package already exists:

```javascript
const testContextPath = `.workflow/${test_session_id}/.process/test-context-package.json`;

if (file_exists(testContextPath)) {
  const existing = Read(testContextPath);

  // Validate package belongs to current test session
  if (existing?.metadata?.test_session_id === test_session_id) {
    console.log("Valid test-context-package found for session:", test_session_id);
    console.log("Coverage Stats:", existing.test_coverage.coverage_stats);
    console.log("Framework:", existing.test_framework.framework);
    console.log("Missing Tests:", existing.test_coverage.missing_tests.length);
    return existing; // Skip execution, return existing
  } else {
    console.warn("Invalid test_session_id in existing package, re-generating...");
  }
}
```

### Step 2: Invoke Test-Context-Search Agent

**Only execute if Step 1 finds no valid package**

```javascript
// Spawn test-context-search-agent
const agentId = spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/test-context-search-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

## Execution Mode
**PLAN MODE** (Comprehensive) - Full Phase 1-3 execution

## Session Information
- **Test Session ID**: ${test_session_id}
- **Output Path**: .workflow/${test_session_id}/.process/test-context-package.json

## Mission
Execute complete test-context-search-agent workflow for test generation planning:

### Phase 1: Session Validation & Source Context Loading
1. **Detection**: Check for existing test-context-package (early exit if valid)
2. **Test Session Validation**: Load test session metadata, extract source_session reference
3. **Source Context Loading**: Load source session implementation summaries, changed files, tech stack

### Phase 2: Test Coverage Analysis
Execute coverage discovery:
- **Track 1**: Existing test discovery (find *.test.*, *.spec.* files)
- **Track 2**: Coverage gap analysis (match implementation files to test files)
- **Track 3**: Coverage statistics (calculate percentages, identify gaps by module)

### Phase 3: Framework Detection & Packaging
1. Framework identification from package.json/requirements.txt
2. Convention analysis from existing test patterns
3. Generate and validate test-context-package.json

## Output Requirements
Complete test-context-package.json with:
- **metadata**: test_session_id, source_session_id, task_type, complexity
- **source_context**: implementation_summaries, tech_stack, project_patterns
- **test_coverage**: existing_tests[], missing_tests[], coverage_stats
- **test_framework**: framework, version, test_pattern, conventions
- **assets**: implementation_summary[], existing_test[], source_code[] with priorities
- **focus_areas**: Test generation guidance based on coverage gaps

## Quality Validation
Before completion verify:
- [ ] Valid JSON format with all required fields
- [ ] Source session context loaded successfully
- [ ] Test coverage gaps identified
- [ ] Test framework detected (or marked as 'unknown')
- [ ] Coverage percentage calculated correctly
- [ ] Missing tests catalogued with priority
- [ ] Execution time < 30 seconds (< 60s for large codebases)

Execute autonomously following agent documentation.
Report completion with coverage statistics.
`
});

// Wait for agent completion
const result = wait({
  ids: [agentId],
  timeout_ms: 300000  // 5 minutes
});

// Handle timeout
if (result.timed_out) {
  console.warn("Test context gathering timed out, sending prompt...");
  send_input({
    id: agentId,
    message: "Please complete test-context-package.json generation and report results."
  });
  const retryResult = wait({ ids: [agentId], timeout_ms: 120000 });
}

// Clean up agent resources
close_agent({ id: agentId });
```

### Step 3: Output Verification

After agent completes, verify output:

```javascript
// Verify file was created
const outputPath = `.workflow/${test_session_id}/.process/test-context-package.json`;
if (!file_exists(outputPath)) {
  throw new Error("Agent failed to generate test-context-package.json");
}

// Load and display summary
const testContext = Read(outputPath);
console.log("Test context package generated successfully");
console.log("Coverage:", testContext.test_coverage.coverage_stats.coverage_percentage + "%");
console.log("Tests to generate:", testContext.test_coverage.missing_tests.length);
```

## Parameter Reference

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `--session` | string | Yes | Test workflow session ID (e.g., WFS-test-auth) |

## Output Schema

Refer to `test-context-search-agent.md` Phase 3.2 for complete `test-context-package.json` schema.

**Key Sections**:
- **metadata**: Test session info, source session reference, complexity
- **source_context**: Implementation summaries with changed files and tech stack
- **test_coverage**: Existing tests, missing tests with priorities, coverage statistics
- **test_framework**: Framework name, version, patterns, conventions
- **assets**: Categorized files with relevance (implementation_summary, existing_test, source_code)
- **focus_areas**: Test generation guidance based on analysis

## Success Criteria

- Valid test-context-package.json generated in `.workflow/active/{test_session_id}/.process/`
- Source session context loaded successfully
- Test coverage gaps identified (>90% accuracy)
- Test framework detected and documented
- Execution completes within 30 seconds (60s for large codebases)
- All required schema fields present and valid
- Coverage statistics calculated correctly
- Agent reports completion with statistics

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Package validation failed | Invalid test_session_id in existing package | Re-run agent to regenerate |
| Source session not found | Invalid source_session reference | Verify test session metadata |
| No implementation summaries | Source session incomplete | Complete source session first |
| Agent execution timeout | Large codebase or slow analysis | Increase timeout, check file access |
| Missing required fields | Agent incomplete execution | Check agent logs, verify schema compliance |
| No test framework detected | Missing test dependencies | Agent marks as 'unknown', manual specification needed |

## Integration

### Called By
- SKILL.md (Phase 3: Test Coverage Analysis)

### Calls
- `test-context-search-agent` via spawn_agent - Autonomous test coverage analysis

## Notes

- **Detection-first**: Always check for existing test-context-package before invoking agent
- **No redundancy**: This command is a thin orchestrator, all logic in agent
- **Framework agnostic**: Supports Jest, Mocha, pytest, RSpec, Go testing, etc.
- **Coverage focus**: Primary goal is identifying implementation files without tests
- **Explicit lifecycle**: Always close_agent after wait completes

---

## Post-Phase Update

After Phase 1 (Test Context Gather) completes:
- **Output Created**: `test-context-package.json` in `.workflow/active/{session}/.process/`
- **Data Available**: Test coverage stats, framework info, missing tests list
- **Next Action**: Continue to Phase 4 (Conflict Resolution, if conflict_risk >= medium) or Phase 5 (TDD Task Generation)
- **TodoWrite**: Collapse Phase 3 sub-tasks to "Phase 3: Test Coverage Analysis: completed"
