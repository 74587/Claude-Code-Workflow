---
name: review-fix
description: Automated fixing of code review findings with AI-powered planning and coordinated execution. Uses intelligent grouping, multi-stage timeline coordination, and test-driven verification.
argument-hint: "<export-file|review-dir> [--resume] [--max-iterations=N]"
allowed-tools: SlashCommand(*), TodoWrite(*), Read(*), Bash(*), Task(*), Edit(*), Write(*)
---

# Workflow Review-Fix Command

## Quick Start

```bash
# Fix from exported findings file
/workflow:review-fix .workflow/.reviews/session-WFS-123/fix-export-1706184622000.json

# Fix from review directory (auto-discovers latest export)
/workflow:review-fix .workflow/.reviews/session-WFS-123/

# Resume interrupted fix session
/workflow:review-fix --resume

# Custom max retry attempts per finding
/workflow:review-fix .workflow/.reviews/session-WFS-123/ --max-iterations=5
```

**Fix Source**: Exported findings from review cycle dashboard
**Output Directory**: `{review-dir}/fixes/{fix-session-id}/` (fixed location)
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
   │  └─ On success: Commit, write completion JSON
   ├─ Update fix-progress.json after each finding
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
- State files: Initialize fix-state.json, fix-progress.json, active-fix-session.json
- TodoWrite initialization: Set up 4-phase tracking

**Phase 2: Planning Coordination**
- Launch @cli-planning-agent with findings data and project context
- Monitor planning progress (dashboard shows "Planning fixes..." indicator)
- Validate fix-plan.json output (schema conformance)
- Load plan into memory for execution phase
- Update fix-state.json with plan_file reference
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

### Planning Agent (@cli-planning-agent)

**Role**: Analyze findings, create execution strategy, initialize progress tracking

**Orchestrator Provides**:
- Review findings data (id, title, severity, file, description, recommendations)
- Project context (structure, test framework, git status)
- Output directory and template paths

**Agent Outputs**:
- fix-plan.json (groups, timeline, execution strategy)
- fix-progress-{N}.json (one per group, initial state)

### Execution Agent (@cli-execute-agent)

**Role**: Execute fixes for assigned group, update progress in real-time

**Orchestrator Provides**:
- Group assignment (from fix-plan.json)
- Fix strategy and risk assessment (from fix-plan.json)
- Progress file path (fix-progress-{N}.json)

**Agent Responsibilities**:
- Read/update assigned progress file
- Apply fixes with flow control tracking
- Run tests and verify
- Commit successful fixes to git

## Reference

### CLI Tool Configuration

**Planning Agent**:
```javascript
{
  subagent_type: "cli-planning-agent",
  timeout: 300000, // 5 minutes for planning
  description: "Generate fix plan for N code review findings"
}
```

**Execution Agent**:
```javascript
{
  subagent_type: "cli-execute-agent",
  timeout: 3600000, // 60 minutes per group (adjustable)
  description: "Fix M issues: {group_name}"
}
```

### Output File Structure

```
.workflow/.reviews/{review-id}/
├── fix-export-{timestamp}.json     # Exported findings (input)
└── fixes/{fix-session-id}/
    ├── fix-plan.json               # Planning agent output (execution plan)
    ├── fix-progress-1.json         # Group 1 progress (planning agent init → agent updates)
    ├── fix-progress-2.json         # Group 2 progress (planning agent init → agent updates)
    ├── fix-progress-3.json         # Group 3 progress (planning agent init → agent updates)
    ├── fix-summary.md              # Final report (orchestrator generates)
    ├── active-fix-session.json     # Active session marker
    └── fix-history.json            # All sessions history
```

**File Producers**:
- **Planning Agent**: `fix-plan.json`, all `fix-progress-*.json` (initial state)
- **Execution Agents**: Update assigned `fix-progress-{N}.json` in real-time
- **Dashboard**: Reads `fix-plan.json` + all `fix-progress-*.json`, aggregates in-memory every 3 seconds

### Agent Output Files

**fix-plan.json**:
- **Generated by**: @cli-planning-agent
- **Template**: `~/.claude/workflows/cli-templates/fix-plan-template.json`
- **Purpose**: Execution strategy, group definitions, timeline stages
- **Orchestrator uses**: Load groups, determine execution order, assign agents

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
    Analyze ${findings.length} code review findings and generate:
    - fix-plan.json (execution strategy, groups, timeline)
    - fix-progress-{N}.json for each group (initial state)

    Input: ${JSON.stringify(findings, null, 2)}
    Templates: @~/.claude/workflows/cli-templates/fix-plan-template.json
              @~/.claude/workflows/cli-templates/fix-progress-template.json
    Output Dir: ${sessionDir}
  `
})
```

**Execution Agent** (per group):
```javascript
Task({
  subagent_type: "cli-execute-agent",
  description: `Fix ${group.findings.length} issues: ${group.group_name}`,
  prompt: `
    Execute fixes for findings in ${group.progress_file}.
    Read initial state, apply fixes, run tests, commit changes.
    Update progress file in real-time with flow_control steps.

    Group: ${group.group_id} (${group.group_name})
    Progress File: ${group.progress_file}
    Fix Strategy: ${JSON.stringify(group.fix_strategy, null, 2)}
  `
})
```

### Completion Conditions

**Success Criteria**:
- ✅ All findings processed (fixed or failed)
- ✅ Success rate ≥ 70% (configurable threshold)
- ✅ All fixed code has passing tests
- ✅ All changes committed to git
- ✅ All fix-progress-{N}.json files have status = "completed"
- ✅ fix-summary.md generated
- ✅ fix-history.json updated

**Trigger Next Phase**:
- Planning complete → Start execution
- Stage complete → Advance to next stage
- All stages complete → Generate completion report

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


