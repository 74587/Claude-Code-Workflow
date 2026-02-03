---
description: Universal execution engine for consuming planning/brainstorm/analysis output. Serial task execution with progress tracking. Codex-optimized.
argument-hint: "PLAN=\"<path>\" [--auto-commit] [--dry-run]"
---

# Codex Unified-Execute-With-File Workflow

## Quick Start

Universal execution engine consuming **any** planning output and executing tasks serially with progress tracking.

**Core workflow**: Load Plan → Parse Tasks → Validate → Execute Sequentially → Track Progress → Verify

**Key features**:
- **Format-agnostic**: Supports plan.json, plan-note.md, synthesis.json, conclusions.json
- **Serial execution**: Process tasks sequentially with dependency ordering
- **Progress tracking**: execution.md overview + execution-events.md detailed log
- **Auto-commit**: Optional conventional commits after each task
- **Dry-run mode**: Simulate execution without making changes

## Overview

This workflow enables reliable task execution through sequential phases:

1. **Plan Detection & Parsing** - Load and parse planning output in any format
2. **Pre-Execution Analysis** - Validate feasibility and identify potential issues
3. **Serial Task Execution** - Execute tasks one by one with dependency ordering
4. **Progress Tracking** - Update execution logs with results and discoveries
5. **Completion** - Generate summary and offer follow-up actions

The key innovation is the **unified event log** that serves as both human-readable progress tracker and machine-parseable state store.

## Output Structure

```
.workflow/.execution/EXEC-{slug}-{date}-{random}/
├── execution.md              # Plan overview + task table + timeline
└── execution-events.md       # ⭐ Unified log (all executions) - SINGLE SOURCE OF TRUTH
```

## Output Artifacts

### Phase 1: Session Initialization

| Artifact | Purpose |
|----------|---------|
| `execution.md` | Overview of plan source, task table, execution timeline |
| Session folder | `.workflow/.execution/{sessionId}/` |

### Phase 2: Pre-Execution Analysis

| Artifact | Purpose |
|----------|---------|
| `execution.md` (updated) | Feasibility assessment and validation results |

### Phase 3-4: Serial Execution & Progress

| Artifact | Purpose |
|----------|---------|
| `execution-events.md` | Unified log: all task executions with results |
| `execution.md` (updated) | Real-time progress updates and task status |

### Phase 5: Completion

| Artifact | Purpose |
|----------|---------|
| Final `execution.md` | Complete execution summary and statistics |
| Final `execution-events.md` | Complete execution history |

---

## Implementation Details

### Session Initialization

The workflow creates a unique session for tracking execution.

**Session ID Format**: `EXEC-{slug}-{date}-{random}`
- `slug`: Plan filename without extension, lowercased, max 30 chars
- `date`: YYYY-MM-DD format (UTC+8)
- `random`: 7-char random suffix for uniqueness

**Session Directory**: `.workflow/.execution/{sessionId}/`

**Plan Path Resolution**:
1. If `$PLAN` provided explicitly, use it
2. Otherwise, auto-detect from common locations:
   - `.workflow/IMPL_PLAN.md`
   - `.workflow/.planning/*/plan-note.md`
   - `.workflow/.brainstorm/*/synthesis.json`
   - `.workflow/.analysis/*/conclusions.json`

**Session Variables**:
- `sessionId`: Unique session identifier
- `sessionFolder`: Base directory for artifacts
- `planPath`: Resolved path to plan file
- `autoCommit`: Boolean flag for auto-commit mode
- `dryRun`: Boolean flag for dry-run mode

---

## Phase 1: Plan Detection & Parsing

**Objective**: Load plan file, parse tasks, build execution order, and validate for cycles.

### Step 1.1: Load Plan File

Detect plan format and parse based on file extension.

**Supported Formats**:

| Format | Source | Parser |
|--------|--------|--------|
| plan.json | lite-plan, collaborative-plan | parsePlanJson() |
| plan-note.md | collaborative-plan | parsePlanMarkdown() |
| synthesis.json | brainstorm session | convertSynthesisToTasks() |
| conclusions.json | analysis session | convertConclusionsToTasks() |

**Parsing Activities**:
1. Read plan file content
2. Detect format from filename or content structure
3. Route to appropriate parser
4. Extract tasks with required fields: id, title, description, files_to_modify, depends_on

### Step 1.2: Build Execution Order

Analyze task dependencies and calculate execution sequence.

**Execution Order Calculation**:
1. Build dependency graph from task dependencies
2. Validate for circular dependencies (no cycles allowed)
3. Calculate topological sort for sequential execution order
4. In Codex: serial mode means executing tasks one by one

**Dependency Validation**:
- Check that all referenced dependencies exist
- Detect cycles and report as critical error
- Order tasks based on dependencies

### Step 1.3: Generate execution.md

Create the main execution tracking document.

**execution.md Structure**:
- **Header**: Session ID, plan source, execution timestamp
- **Plan Overview**: Summary from plan metadata
- **Task List**: Table with ID, title, complexity, dependencies, status
- **Execution Timeline**: To be updated as tasks complete

**Success Criteria**:
- execution.md created with complete plan overview
- Task list includes all tasks from plan
- Execution order calculated with no cycles
- Ready for feasibility analysis

---

## Phase 2: Pre-Execution Analysis

**Objective**: Validate feasibility and identify potential issues before starting execution.

### Step 2.1: Analyze Plan Structure

Examine task dependencies, file modifications, and potential conflicts.

**Analysis Activities**:
1. **Check file conflicts**: Identify files modified by multiple tasks
2. **Check missing dependencies**: Verify all referenced dependencies exist
3. **Check file existence**: Identify files that will be created vs modified
4. **Estimate complexity**: Assess overall execution complexity

**Issue Detection**:
- Sequential modifications to same file (document for ordered execution)
- Missing dependency targets
- High complexity patterns that may need special handling

### Step 2.2: Generate Feasibility Report

Document analysis results and recommendations.

**Feasibility Report Content**:
- Issues found (if any)
- File conflict warnings
- Dependency validation results
- Complexity assessment
- Recommended execution strategy

### Step 2.3: Update execution.md

Append feasibility analysis results.

**Success Criteria**:
- All validation checks completed
- Issues documented in execution.md
- No blocking issues found (or user confirmed to proceed)
- Ready for task execution

---

## Phase 3: Serial Task Execution

**Objective**: Execute tasks one by one in dependency order, tracking progress and recording results.

**Execution Model**: Serial execution - process tasks sequentially, one at a time. Each task must complete before the next begins.

### Step 3.1: Execute Tasks Sequentially

For each task in execution order:
1. Load context from previous task results
2. Route to Codex CLI for execution
3. Wait for completion
4. Record results in execution-events.md
5. Auto-commit if enabled
6. Move to next task

**Execution Loop**:
```
For each task in executionOrder:
  ├─ Extract task context
  ├─ Load previous task outputs
  ├─ Execute task via CLI (synchronous)
  ├─ Record result with timestamp
  ├─ Auto-commit if enabled
  └─ Continue to next task
```

### Step 3.2: Execute Task via CLI

Execute individual task using Codex CLI in synchronous mode.

**CLI Execution Scope**:
- **PURPOSE**: Execute task from plan
- **TASK DETAILS**: ID, title, description, required changes
- **PRIOR CONTEXT**: Results from previous tasks
- **REQUIRED CHANGES**: Files to modify with specific locations
- **MODE**: write (modification mode)
- **EXPECTED**: Files modified as specified, no test failures

**CLI Parameters**:
- `--tool codex`: Use Codex for execution
- `--mode write`: Allow file modifications
- Synchronous execution: Wait for completion

### Step 3.3: Track Progress

Record task execution results in the unified event log.

**execution-events.md Structure**:
- **Header**: Session metadata
- **Event Timeline**: One entry per task with results
- **Event Format**:
  - Task ID and title
  - Timestamp and duration
  - Status (completed/failed)
  - Summary of changes
  - Any notes or issues discovered

**Event Recording Activities**:
1. Capture execution timestamp
2. Record task status and duration
3. Document any modifications made
4. Note any issues or discoveries
5. Append event to execution-events.md

### Step 3.4: Auto-Commit (if enabled)

Commit task changes with conventional commit format.

**Auto-Commit Process**:
1. Get changed files from git status
2. Filter to task.files_to_modify
3. Stage files: `git add`
4. Generate commit message based on task type
5. Commit: `git commit -m`

**Commit Message Format**:
- Type: feat, fix, refactor, test, docs (inferred from task)
- Scope: file/module affected (inferred from files modified)
- Subject: Task title or description
- Footer: Task ID and plan reference

**Success Criteria**:
- All tasks executed sequentially
- Results recorded in execution-events.md
- Auto-commits created (if enabled)
- Failed tasks logged for review

---

## Phase 4: Completion

**Objective**: Summarize execution results and offer follow-up actions.

### Step 4.1: Collect Statistics

Gather execution metrics.

**Metrics Collection**:
- Total tasks executed
- Successfully completed count
- Failed count
- Success rate percentage
- Total duration
- Artifacts generated

### Step 4.2: Generate Summary

Update execution.md with final results.

**Summary Content**:
- Execution completion timestamp
- Statistics table
- Task status table (completed/failed)
- Commit log (if auto-commit enabled)
- Any failed tasks requiring attention

### Step 4.3: Display Completion Summary

Present results to user.

**Summary Output**:
- Session ID and folder path
- Statistics (completed/failed/total)
- Failed tasks (if any)
- Execution log location
- Next step recommendations

**Success Criteria**:
- execution.md finalized with complete summary
- execution-events.md contains all task records
- User informed of completion status
- All artifacts successfully created

---

## Configuration

### Plan Format Detection

Workflow automatically detects plan format:

| File Extension | Format |
|---|---|
| `.json` | JSON plan (lite-plan, collaborative-plan) |
| `.md` | Markdown plan (IMPL_PLAN.md, plan-note.md) |
| `synthesis.json` | Brainstorm synthesis |
| `conclusions.json` | Analysis conclusions |

### Execution Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| Normal | Execute tasks, track progress | Standard execution |
| `--auto-commit` | Execute + commit each task | Tracked progress with git history |
| `--dry-run` | Simulate execution, no changes | Validate plan before executing |

### Task Dependencies

Tasks can declare dependencies on other tasks:
- `depends_on: ["TASK-001", "TASK-002"]` - Wait for these tasks
- Tasks are executed in topological order
- Circular dependencies are detected and reported as error

---

## Error Handling & Recovery

| Situation | Action | Recovery |
|-----------|--------|----------|
| Plan not found | Check file path and common locations | Verify plan path is correct |
| Unsupported format | Detect format from extension/content | Use supported plan format |
| Circular dependency | Stop execution, report error | Remove or reorganize dependencies |
| Task execution fails | Record failure in log | Review error details in execution-events.md |
| File conflict | Document in execution-events.md | Resolve conflict manually or adjust plan order |
| Missing file | Log as warning, continue | Verify files will be created by prior tasks |

---

## Execution Flow Diagram

```
Load Plan File
   ├─ Detect format (JSON/Markdown)
   ├─ Parse tasks
   └─ Build dependency graph

Validate
   ├─ Check for cycles
   ├─ Analyze file conflicts
   └─ Calculate execution order

Execute Sequentially
   ├─ Task 1: CLI execution → record result
   ├─ Task 2: CLI execution → record result
   ├─ Task 3: CLI execution → record result
   └─ (repeat for all tasks)

Track Progress
   ├─ Update execution.md after each task
   └─ Append event to execution-events.md

Complete
   ├─ Generate final summary
   ├─ Report statistics
   └─ Offer follow-up actions
```

---

## Best Practices

### Before Execution

1. **Review Plan**: Check plan.md or plan-note.md for completeness
2. **Validate Format**: Ensure plan is in supported format
3. **Check Dependencies**: Verify dependency order is logical
4. **Test First**: Use `--dry-run` mode to validate before actual execution
5. **Backup**: Commit any pending changes before starting

### During Execution

1. **Monitor Progress**: Check execution-events.md for real-time updates
2. **Handle Failures**: Review error details and decide whether to continue
3. **Check Commits**: Verify auto-commits are correct if enabled
4. **Track Context**: Prior task results are available to subsequent tasks

### After Execution

1. **Review Results**: Check execution.md summary and statistics
2. **Verify Changes**: Inspect modified files match expected changes
3. **Handle Failures**: Address any failed tasks
4. **Update History**: Check git log for conventional commits if enabled
5. **Plan Next Steps**: Use completion artifacts for future work

---

## When to Use This Workflow

### Use unified-execute-with-file when:
- Ready to execute a complete plan from planning workflow
- Need reliable sequential task execution with tracking
- Want automatic git commits for audit trail
- Executing plans from brainstorm, analysis, or collaborative-plan workflows
- Need to validate plan before full execution (--dry-run)

### Use direct CLI execution when:
- Single task that doesn't need full plan structure
- Quick implementation without tracking overhead
- Small changes that don't need git history

### Consider alternatives when:
- Still planning/exploring → use `workflow:brainstorm-with-file` or `workflow:analyze-with-file`
- Need complex task planning → use `workflow:collaborative-plan-with-file`
- Debugging or troubleshooting → use `workflow:debug-with-file`

---

## Command Examples

### Standard Execution

```bash
PLAN=".workflow/.planning/CPLAN-auth-2025-01-27/plan-note.md"
```

Execute the plan with standard options.

### With Auto-Commit

```bash
PLAN=".workflow/.planning/CPLAN-auth-2025-01-27/plan-note.md" \
  --auto-commit
```

Execute and automatically commit changes after each task.

### Dry-Run Mode

```bash
PLAN=".workflow/.planning/CPLAN-auth-2025-01-27/plan-note.md" \
  --dry-run
```

Simulate execution without making changes.

### Auto-Detect Plan

```bash
# No PLAN specified - auto-detects from .workflow/ directories
```

---

**Now execute unified-execute-with-file for**: $PLAN
