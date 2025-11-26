---
name: review-fix
description: Automated fixing of code review findings with AI-powered planning and coordinated execution. Uses intelligent grouping, multi-stage timeline coordination, and test-driven verification.
argument-hint: "<export-file|review-dir> [--resume] [--max-iterations=N]"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Task(*), Edit(*), Write(*)
---

# Workflow Review-Fix Command

## Quick Start

```bash
# Fix from exported findings file (session-based path)
/workflow:review-fix .workflow/active/WFS-123/.review/fix-export-1706184622000.json

# Fix from review directory (auto-discovers latest export)
/workflow:review-fix .workflow/active/WFS-123/.review/

# Resume interrupted fix session
/workflow:review-fix --resume

# Custom max retry attempts per finding
/workflow:review-fix .workflow/active/WFS-123/.review/ --max-iterations=5
```

**Fix Source**: Exported findings from review cycle dashboard
**Output Directory**: `{review-dir}/fixes/{fix-session-id}/` (within session .review/)
**Default Max Iterations**: 3 (per finding, adjustable)
**CLI Tools**: @cli-planning-agent (planning), @cli-execute-agent (fixing)

## What & Why

### Core Concept
Automated fix orchestrator with **two-phase architecture**: AI-powered planning followed by coordinated parallel/serial execution. Generates fix timeline with intelligent grouping and dependency analysis, then executes fixes with conservative test verification.

**Fix Process**:
- **Planning Phase**: AI analyzes findings, generates fix plan with grouping and execution strategy
- **Execution Phase**: Main orchestrator coordinates agents per timeline stages
- **No rigid structure**: Adapts to task requirements, not bound to fixed JSON format

**vs Manual Fixing**:
- **Manual**: Developer reviews findings one-by-one, fixes sequentially
- **Automated**: AI groups related issues, executes in optimal parallel/serial order with automatic test verification

### Value Proposition
1. **Intelligent Planning**: AI-powered analysis identifies optimal grouping and execution strategy
2. **Multi-stage Coordination**: Supports complex parallel + serial execution with dependency management
3. **Conservative Safety**: Mandatory test verification with automatic rollback on failure
4. **Real-time Visibility**: Dashboard shows planning progress, stage timeline, and active agents
5. **Resume Support**: Checkpoint-based recovery for interrupted sessions

### Orchestrator Boundary (CRITICAL)
- **ONLY command** for automated review finding fixes
- Manages: Planning phase coordination, stage-based execution, agent scheduling, progress tracking
- Delegates: Fix planning to @cli-planning-agent, fix execution to @cli-execute-agent


### Execution Flow 

```
1. Discovery & Initialization
   └─ Validate export file, create fix session structure, initialize state files → Update dashboard

2. Phase 2: Planning (@cli-planning-agent):
   ├─ Analyze findings for patterns and dependencies
   ├─ Group by file + dimension + root cause similarity
   ├─ Determine execution strategy (parallel/serial/hybrid)
   ├─ Generate fix timeline with stages
   └─ Output: fix-plan.json → Update dashboard to execution phase

3. Phase 3: Execution (Stage-based):
   For each timeline stage:
   ├─ Load groups for this stage
   ├─ If parallel: Launch all group agents simultaneously
   ├─ If serial: Execute groups sequentially
   ├─ Each agent:
   │  ├─ Analyze code context
   │  ├─ Apply fix per strategy
   │  ├─ Run affected tests
   │  ├─ On test failure: Rollback, retry up to max_iterations
   │  └─ On success: Commit, update fix-progress-{N}.json
   └─ Advance to next stage

4. Phase 4: Completion
   └─ Aggregate results → Generate fix-summary.md → Update history → Output summary
```

### Agent Roles

| Agent | Responsibility |
|-------|---------------|
| **Orchestrator** | Input validation, session management, planning coordination, stage-based execution scheduling, progress tracking, aggregation |
| **@cli-planning-agent** | Findings analysis, intelligent grouping (file+dimension+root cause), execution strategy determination (parallel/serial/hybrid), timeline generation with dependency mapping |
| **@cli-execute-agent** | Fix execution per group, code context analysis, Edit tool operations, test verification, git rollback on failure, completion JSON generation |

## Enhanced Features

### 1. Two-Phase Architecture

**Phase Separation**:

| Phase | Agent | Output | Purpose |
|-------|-------|--------|---------|
| **Planning** | @cli-planning-agent | fix-plan.json | Analyze findings, group intelligently, determine optimal execution strategy |
| **Execution** | @cli-execute-agent | completions/*.json | Execute fixes per plan with test verification and rollback |

**Benefits**:
- Clear separation of concerns (analysis vs execution)
- Reusable plans (can re-execute without re-planning)
- Better error isolation (planning failures vs execution failures)

### 2. Intelligent Grouping Strategy

**Three-Level Grouping**:

```javascript
// Level 1: Primary grouping by file + dimension
{file: "auth.ts", dimension: "security"} → Group A
{file: "auth.ts", dimension: "quality"} → Group B
{file: "query-builder.ts", dimension: "security"} → Group C

// Level 2: Secondary grouping by root cause similarity
Group A findings → Semantic similarity analysis (threshold 0.7)
  → Sub-group A1: "missing-input-validation" (findings 1, 2)
  → Sub-group A2: "insecure-crypto" (finding 3)

// Level 3: Dependency analysis
Sub-group A1 creates validation utilities
Sub-group C4 depends on those utilities
→ A1 must execute before C4 (serial stage dependency)
```

**Similarity Computation**:
- Combine: `description + recommendation + category`
- Vectorize: TF-IDF or LLM embedding
- Cluster: Greedy algorithm with cosine similarity > 0.7

### 3. Execution Strategy Determination

**Strategy Types**:

| Strategy | When to Use | Stage Structure |
|----------|-------------|-----------------|
| **Parallel** | All groups independent, different files | Single stage, all groups in parallel |
| **Serial** | Strong dependencies, shared resources | Multiple stages, one group per stage |
| **Hybrid** | Mixed dependencies | Multiple stages, parallel within stages |

**Dependency Detection**:
- Shared file modifications
- Utility creation + usage patterns
- Test dependency chains
- Risk level clustering (high-risk groups isolated)

### 4. Conservative Test Verification

**Test Strategy** (per fix):

```javascript
// 1. Identify affected tests
const testPattern = identifyTestPattern(finding.file);
// e.g., "tests/auth/**/*.test.*" for src/auth/service.ts

// 2. Run tests
const result = await runTests(testPattern);

// 3. Evaluate
if (result.passRate < 100%) {
  // Rollback
  await gitCheckout(finding.file);

  // Retry with failure context
  if (attempts < maxIterations) {
    const fixContext = analyzeFailure(result.stderr);
    regenerateFix(finding, fixContext);
    retry();
  } else {
    markFailed(finding.id);
  }
} else {
  // Commit
  await gitCommit(`Fix: ${finding.title} [${finding.id}]`);
  markFixed(finding.id);
}
```

**Pass Criteria**: 100% test pass rate (no partial fixes)

## Core Responsibilities

### Orchestrator

**Phase 1: Discovery & Initialization**
- Input validation: Check export file exists and is valid JSON
- Auto-discovery: If review-dir provided, find latest `*-fix-export.json`
- Session creation: Generate fix-session-id (`fix-{timestamp}`)
- Directory structure: Create `{review-dir}/fixes/{fix-session-id}/` with subdirectories
- State files: Initialize active-fix-session.json (session marker)
- Dashboard generation: Create fix-dashboard.html from template (see Dashboard Generation below)
- TodoWrite initialization: Set up 4-phase tracking

**Phase 2: Planning Coordination**
- Launch @cli-planning-agent with findings data and project context
- Monitor planning progress (dashboard shows "Planning fixes..." indicator)
- Validate fix-plan.json output (schema conformance, includes metadata with session status)
- Load plan into memory for execution phase
- TodoWrite update: Mark planning complete, start execution

**Phase 3: Execution Orchestration**
- Load fix-plan.json timeline stages
- For each stage:
  - If parallel mode: Launch all group agents via `Promise.all()`
  - If serial mode: Execute groups sequentially with `await`
  - Assign agent IDs (agents update their fix-progress-{N}.json)
- Handle agent failures gracefully (mark group as failed, continue)
- Advance to next stage only when current stage complete
- Dashboard polls and aggregates fix-progress-{N}.json files for display

**Phase 4: Completion & Aggregation**
- Collect final status from all fix-progress-{N}.json files
- Generate fix-summary.md with timeline and results
- Update fix-history.json with new session entry
- Remove active-fix-session.json
- TodoWrite completion: Mark all phases done
- Output summary to user with dashboard link

**Phase 5: Session Completion (Optional)**
- If all findings fixed successfully (no failures):
  - Prompt user: "All fixes complete. Complete workflow session? [Y/n]"
  - If confirmed: Execute `/workflow:session:complete` to archive session with lessons learned
- If partial success (some failures):
  - Output: "Some findings failed. Review fix-summary.md before completing session."
  - Do NOT auto-complete session

### Dashboard Generation

**MANDATORY**: Dashboard MUST be generated from template during Phase 1 initialization

**Template Location**: `~/.claude/templates/fix-dashboard.html`

**⚠️ POST-GENERATION**: Orchestrator and agents MUST NOT read/write/modify fix-dashboard.html after creation

**Generation Steps**:

```bash
# 1. Copy template to fix session directory
cp ~/.claude/templates/fix-dashboard.html ${sessionDir}/fixes/${fixSessionId}/fix-dashboard.html

# 2. Replace SESSION_ID placeholder
sed -i "s|{{SESSION_ID}}|${sessionId}|g" ${sessionDir}/fixes/${fixSessionId}/fix-dashboard.html

# 3. Replace REVIEW_DIR placeholder
sed -i "s|{{REVIEW_DIR}}|${reviewDir}|g" ${sessionDir}/fixes/${fixSessionId}/fix-dashboard.html

# 4. Output dashboard URL
echo "🔧 Fix Dashboard: file://$(cd ${sessionDir}/fixes/${fixSessionId} && pwd)/fix-dashboard.html"
```

**Dashboard Features**:
- Real-time progress tracking via JSON polling (3-second interval)
- Stage timeline visualization with parallel/serial execution modes
- Active groups and agents monitoring
- Flow control steps tracking for each agent
- Fix history drawer with session summaries
- Consumes new JSON structure (fix-plan.json with metadata + fix-progress-{N}.json)

**JSON Consumption**:
- `fix-plan.json`: Reads metadata field for session info, timeline stages, groups configuration
- `fix-progress-{N}.json`: Polls all progress files to aggregate real-time status
- `active-fix-session.json`: Detects active session on load
- `fix-history.json`: Loads historical fix sessions

### Output File Structure

```
.workflow/active/WFS-{session-id}/.review/
├── fix-export-{timestamp}.json     # Exported findings (input)
└── fixes/{fix-session-id}/
    ├── fix-dashboard.html          # Interactive dashboard (generated once, auto-polls JSON)
    ├── fix-plan.json               # Planning agent output (execution plan with metadata)
    ├── fix-progress-1.json         # Group 1 progress (planning agent init → agent updates)
    ├── fix-progress-2.json         # Group 2 progress (planning agent init → agent updates)
    ├── fix-progress-3.json         # Group 3 progress (planning agent init → agent updates)
    ├── fix-summary.md              # Final report (orchestrator generates)
    ├── active-fix-session.json     # Active session marker
    └── fix-history.json            # All sessions history
```

**File Producers**:
- **Orchestrator**: `fix-dashboard.html` (generated once from template during Phase 1)
- **Planning Agent**: `fix-plan.json` (with metadata), all `fix-progress-*.json` (initial state)
- **Execution Agents**: Update assigned `fix-progress-{N}.json` in real-time
- **Dashboard (Browser)**: Reads `fix-plan.json` + all `fix-progress-*.json`, aggregates in-memory every 3 seconds via JavaScript polling

### Agent Output Files

**fix-plan.json**:
- **Generated by**: @cli-planning-agent
- **Template**: `~/.claude/workflows/cli-templates/fix-plan-template.json`
- **Purpose**: Session metadata, execution strategy, group definitions, timeline stages
- **Structure**: Includes `metadata` field with fix_session_id, review_session_id, status, timestamps
- **Orchestrator uses**: Load groups, determine execution order, assign agents, track session state

**fix-progress-{N}.json** (one per group):
- **Generated by**: @cli-planning-agent (initial) → @cli-execute-agent (updates)
- **Template**: `~/.claude/workflows/cli-templates/fix-progress-template.json`
- **Purpose**: Track individual group progress with flow control steps
- **Consumed by**: Dashboard (reads all, aggregates in-memory)

### Agent Invocation Template

**Planning Agent**:
```javascript
Task({
  subagent_type: "cli-planning-agent",
  description: `Generate fix plan and initialize progress files for ${findings.length} findings`,
  prompt: `
## Task Objective
Analyze ${findings.length} code review findings and generate execution plan with intelligent grouping and timeline coordination.

## Input Data
Review Session: ${reviewId}
Fix Session ID: ${fixSessionId}
Total Findings: ${findings.length}

Findings:
${JSON.stringify(findings, null, 2)}

Project Context:
- Structure: ${projectStructure}
- Test Framework: ${testFramework}
- Git Status: ${gitStatus}

## Output Requirements

### 1. fix-plan.json
Execute: cat ~/.claude/workflows/cli-templates/fix-plan-template.json

Generate execution plan following template structure:

**Key Generation Rules**:
- **Metadata**: Populate fix_session_id, review_session_id, status ("planning"), created_at, started_at timestamps
- **Execution Strategy**: Choose approach (parallel/serial/hybrid) based on dependency analysis, set parallel_limit and stages count
- **Groups**: Create groups (G1, G2, ...) with intelligent grouping (see Analysis Requirements below), assign progress files (fix-progress-1.json, ...), populate fix_strategy with approach/complexity/test_pattern, assess risks, identify dependencies
- **Timeline**: Define stages respecting dependencies, set execution_mode per stage, map groups to stages, calculate critical path

### 2. fix-progress-{N}.json (one per group)
Execute: cat ~/.claude/workflows/cli-templates/fix-progress-template.json

For each group (G1, G2, G3, ...), generate fix-progress-{N}.json following template structure:

**Initial State Requirements**:
- Status: "pending", phase: "waiting"
- Timestamps: Set last_update to now, others null
- Findings: Populate from review findings with status "pending", all operation fields null
- Summary: Initialize all counters to zero
- Flow control: Empty implementation_approach array
- Errors: Empty array

**CRITICAL**: Ensure complete template structure for Dashboard consumption - all fields must be present.

## Analysis Requirements

### Intelligent Grouping Strategy
Group findings using these criteria (in priority order):

1. **File Proximity**: Findings in same file or related files
2. **Dimension Affinity**: Same dimension (security, performance, etc.)
3. **Root Cause Similarity**: Similar underlying issues
4. **Fix Approach Commonality**: Can be fixed with similar approach

**Grouping Guidelines**:
- Optimal group size: 2-5 findings per group
- Avoid cross-cutting concerns in same group
- Consider test isolation (different test suites → different groups)
- Balance workload across groups for parallel execution

### Execution Strategy Determination

**Parallel Mode**: Use when groups are independent, no shared files
**Serial Mode**: Use when groups have dependencies or shared resources
**Hybrid Mode**: Use for mixed dependency graphs (recommended for most cases)

**Dependency Analysis**:
- Identify shared files between groups
- Detect test dependency chains
- Evaluate risk of concurrent modifications

### Risk Assessment

For each group, evaluate:
- **Complexity**: Based on code structure, file size, existing tests
- **Impact Scope**: Number of files affected, API surface changes
- **Rollback Feasibility**: Ease of reverting changes if tests fail

### Test Strategy

For each group, determine:
- **Test Pattern**: Glob pattern matching affected tests
- **Pass Criteria**: All tests must pass (100% pass rate)
- **Test Command**: Infer from project (package.json, pytest.ini, etc.)

## Output Files

Write to ${sessionDir}:
- ./fix-plan.json
- ./fix-progress-1.json
- ./fix-progress-2.json
- ./fix-progress-{N}.json (as many as groups created)

## Quality Checklist

Before finalizing outputs:
- ✅ All findings assigned to exactly one group
- ✅ Group dependencies correctly identified
- ✅ Timeline stages respect dependencies
- ✅ All progress files have complete initial structure
- ✅ Test patterns are valid and specific
- ✅ Risk assessments are realistic
- ✅ Estimated times are reasonable
  `
})
```

**Execution Agent** (per group):
```javascript
Task({
  subagent_type: "cli-execute-agent",
  description: `Fix ${group.findings.length} issues: ${group.group_name}`,
  prompt: `
## Task Objective
Execute fixes for code review findings in group ${group.group_id}. Update progress file in real-time with flow control tracking for dashboard visibility.

## Assignment
- Group ID: ${group.group_id}
- Group Name: ${group.group_name}
- Progress File: ${sessionDir}/${group.progress_file}
- Findings Count: ${group.findings.length}
- Max Iterations: ${maxIterations} (per finding)

## Fix Strategy
${JSON.stringify(group.fix_strategy, null, 2)}

## Risk Assessment
${JSON.stringify(group.risk_assessment, null, 2)}

## Execution Flow

### Initialization (Before Starting)

1. Read ${group.progress_file} to load initial state
2. Update progress file:
   - assigned_agent: "${agentId}"
   - status: "in-progress"
   - started_at: Current ISO 8601 timestamp
   - last_update: Current ISO 8601 timestamp
3. Write updated state back to ${group.progress_file}

### Main Execution Loop

For EACH finding in ${group.progress_file}.findings:

#### Step 1: Analyze Context

**Before Step**:
- Update finding: status→"in-progress", started_at→now()
- Update current_finding: Populate with finding details, status→"analyzing", action→"Reading file and understanding code structure"
- Update phase→"analyzing"
- Update flow_control: Add "analyze_context" step to implementation_approach (status→"in-progress"), set current_step→"analyze_context"
- Update last_update→now(), write to ${group.progress_file}

**Action**:
- Read file: finding.file
- Understand code structure around line: finding.line
- Analyze surrounding context (imports, dependencies, related functions)
- Review recommendations: finding.recommendations

**After Step**:
- Update flow_control: Mark "analyze_context" step as "completed" with completed_at→now()
- Update last_update→now(), write to ${group.progress_file}

#### Step 2: Apply Fix

**Before Step**:
- Update current_finding: status→"fixing", action→"Applying code changes per recommendations"
- Update phase→"fixing"
- Update flow_control: Add "apply_fix" step to implementation_approach (status→"in-progress"), set current_step→"apply_fix"
- Update last_update→now(), write to ${group.progress_file}

**Action**:
- Use Edit tool to implement code changes per finding.recommendations
- Follow fix_strategy.approach
- Maintain code style and existing patterns

**After Step**:
- Update flow_control: Mark "apply_fix" step as "completed" with completed_at→now()
- Update last_update→now(), write to ${group.progress_file}

#### Step 3: Test Verification

**Before Step**:
- Update current_finding: status→"testing", action→"Running test suite to verify fix"
- Update phase→"testing"
- Update flow_control: Add "run_tests" step to implementation_approach (status→"in-progress"), set current_step→"run_tests"
- Update last_update→now(), write to ${group.progress_file}

**Action**:
- Run tests using fix_strategy.test_pattern
- Require 100% pass rate
- Capture test output

**On Test Failure**:
- Git rollback: \`git checkout -- \${finding.file}\`
- Increment finding.attempts
- Update flow_control: Mark "run_tests" step as "failed" with completed_at→now()
- Update errors: Add entry (finding_id, error_type→"test_failure", message, timestamp)
- If finding.attempts < ${maxIterations}:
  - Reset flow_control: implementation_approach→[], current_step→null
  - Retry from Step 1
- Else:
  - Update finding: status→"completed", result→"failed", error_message→"Max iterations reached", completed_at→now()
  - Update summary counts, move to next finding

**On Test Success**:
- Update flow_control: Mark "run_tests" step as "completed" with completed_at→now()
- Update last_update→now(), write to ${group.progress_file}
- Proceed to Step 4

#### Step 4: Commit Changes

**Before Step**:
- Update current_finding: status→"committing", action→"Creating git commit for successful fix"
- Update phase→"committing"
- Update flow_control: Add "commit_changes" step to implementation_approach (status→"in-progress"), set current_step→"commit_changes"
- Update last_update→now(), write to ${group.progress_file}

**Action**:
- Git commit: \`git commit -m "fix(${finding.dimension}): ${finding.title} [${finding.id}]"\`
- Capture commit hash

**After Step**:
- Update finding: status→"completed", result→"fixed", commit_hash→<captured>, test_passed→true, completed_at→now()
- Update flow_control: Mark "commit_changes" step as "completed" with completed_at→now()
- Update last_update→now(), write to ${group.progress_file}

#### After Each Finding

- Update summary: Recalculate counts (pending/in_progress/fixed/failed) and percent_complete
- If all findings completed: Clear current_finding, reset flow_control
- Update last_update→now(), write to ${group.progress_file}

### Final Completion

When all findings processed:
- Update status→"completed", phase→"done", summary.percent_complete→100.0
- Update last_update→now(), write final state to ${group.progress_file}

## Critical Requirements

### Progress File Updates
- **MUST update after every significant action** (before/after each step)
- **Dashboard polls every 3 seconds** - ensure writes are atomic
- **Always maintain complete structure** - never write partial updates
- **Use ISO 8601 timestamps** - e.g., "2025-01-25T14:36:00Z"

### Flow Control Format
Follow action-planning-agent flow_control.implementation_approach format:
- step: Identifier (e.g., "analyze_context", "apply_fix")
- action: Human-readable description
- status: "pending" | "in-progress" | "completed" | "failed"
- started_at: ISO 8601 timestamp or null
- completed_at: ISO 8601 timestamp or null

### Error Handling
- Capture all errors in errors[] array
- Never leave progress file in invalid state
- Always write complete updates, never partial
- On unrecoverable error: Mark group as failed, preserve state

## Test Patterns
Use fix_strategy.test_pattern to run affected tests:
- Pattern: ${group.fix_strategy.test_pattern}
- Command: Infer from project (npm test, pytest, etc.)
- Pass Criteria: 100% pass rate required
  `
})
```



### Error Handling

**Planning Failures**:
- Invalid template → Abort with error message
- Insufficient findings data → Request complete export
- Planning timeout → Retry once, then fail gracefully

**Execution Failures**:
- Agent crash → Mark group as failed, continue with other groups
- Test command not found → Skip test verification, warn user
- Git operations fail → Abort with error, preserve state

**Rollback Scenarios**:
- Test failure after fix → Automatic `git checkout` rollback
- Max iterations reached → Leave file unchanged, mark as failed
- Unrecoverable error → Rollback entire group, save checkpoint

### TodoWrite Structure

**Initialization**:
```javascript
TodoWrite({
  todos: [
    {content: "Phase 1: Discovery & Initialization", status: "completed"},
    {content: "Phase 2: Planning", status: "in_progress"},
    {content: "Phase 3: Execution", status: "pending"},
    {content: "Phase 4: Completion", status: "pending"}
  ]
});
```

**During Execution**:
```javascript
TodoWrite({
  todos: [
    {content: "Phase 1: Discovery & Initialization", status: "completed"},
    {content: "Phase 2: Planning", status: "completed"},
    {content: "Phase 3: Execution", status: "in_progress"},
    {content: "  → Stage 1: Parallel execution (3 groups)", status: "completed"},
    {content: "    • Group G1: Auth validation (2 findings)", status: "completed"},
    {content: "    • Group G2: Query security (3 findings)", status: "completed"},
    {content: "    • Group G3: Config quality (1 finding)", status: "completed"},
    {content: "  → Stage 2: Serial execution (1 group)", status: "in_progress"},
    {content: "    • Group G4: Dependent fixes (2 findings)", status: "in_progress"},
    {content: "Phase 4: Completion", status: "pending"}
  ]
});
```

**Update Rules**:
- Add stage items dynamically based on fix-plan.json timeline
- Add group items per stage
- Mark completed immediately after each group finishes
- Update parent phase status when all child items complete

## Best Practices

1. **Trust AI Planning**: Planning agent's grouping and execution strategy are based on dependency analysis
2. **Conservative Approach**: Test verification is mandatory - no fixes kept without passing tests
3. **Parallel Efficiency**: Default 3 concurrent agents balances speed and resource usage
4. **Monitor Dashboard**: Real-time stage timeline and agent status provide execution visibility
5. **Resume Support**: Fix sessions can resume from checkpoints after interruption
6. **Manual Review**: Always review failed fixes manually - may require architectural changes
7. **Incremental Fixing**: Start with small batches (5-10 findings) before large-scale fixes


