# Phase 2: Lite Execute

## Overview

Flexible task execution phase supporting three input modes: in-memory plan (from planning phases), direct prompt description, or file content. Handles execution orchestration, progress tracking, and optional code review.

**Core capabilities:**
- Multi-mode input (in-memory plan, prompt description, or file path)
- Execution orchestration (Agent or Codex) with full context
- Live progress tracking via TodoWrite at execution call level
- Optional code review with selected tool (Gemini, Agent, or custom)
- Context continuity across multiple executions
- Intelligent format detection (Enhanced Task JSON vs plain text)

## Parameters

- `--in-memory`: Use plan from memory (called by planning phases)
- `<input>`: Task description string, or path to file (required)

## Input Modes

### Mode 1: In-Memory Plan

**Trigger**: Called by planning phase after confirmation with `--in-memory` flag

**Input Source**: `executionContext` global variable set by planning phase

**Content**: Complete execution context (see Data Structures section)

**Behavior**:
- Skip execution method selection (already set by planning phase)
- Directly proceed to execution with full context
- All planning artifacts available (exploration, clarifications, plan)

### Mode 2: Prompt Description

**Trigger**: User calls with task description string

**Input**: Simple task description (e.g., "Add unit tests for auth module")

**Behavior**:
- Store prompt as `originalUserInput`
- Execute `git rev-parse --show-toplevel` to determine `projectRoot`
- Create simple execution plan from prompt
- ASK_USER: Select execution method (Agent/Codex/Auto)
- ASK_USER: Select code review tool (Skip/Gemini/Agent/Other)
- Proceed to execution with `originalUserInput` included

**User Interaction**:

```
Route by mode:
├─ --yes mode → Auto-confirm with defaults:
│   ├─ Execution method: Auto
│   └─ Code review: Skip
│
└─ Interactive mode → ASK_USER with 2 questions:
    ├─ Execution method: Agent (@code-developer) / Codex (codex CLI) / Auto (complexity-based)
    └─ Code review: Skip / Gemini Review / Codex Review (git-aware) / Agent Review
```

### Mode 3: File Content

**Trigger**: User calls with file path

**Input**: Path to file containing task description or plan.json

**Format Detection**:

```
1. Execute git rev-parse --show-toplevel to determine projectRoot
2. Read file content
3. Attempt JSON parsing
   ├─ Valid JSON with summary + approach + tasks fields → plan.json format
   │   ├─ Use parsed data as planObject
   │   └─ Set originalUserInput = summary
   └─ Not valid JSON or missing required fields → plain text format
       └─ Set originalUserInput = file content (same as Mode 2)
3. User selects execution method + code review (same as Mode 2)
```

## Execution Process

```
Input Parsing:
   └─ Decision (mode detection):
      ├─ --in-memory flag → Mode 1: Load executionContext → Skip user selection
      ├─ Existing file path (path exists) → Mode 3: Read file → Detect format
      │   ├─ Valid plan.json → Use planObject → User selects method + review
      │   └─ Not plan.json → Treat as prompt → User selects method + review
      └─ Otherwise → Mode 2: Prompt description → User selects method + review

Execution:
   ├─ Step 1: Initialize result tracking (previousExecutionResults = [])
   ├─ Step 2: Task grouping & batch creation
   │   ├─ Extract explicit depends_on (no file/keyword inference)
   │   ├─ Group: independent tasks → single parallel batch (maximize utilization)
   │   ├─ Group: dependent tasks → sequential phases (respect dependencies)
   │   └─ Create TodoWrite list for batches
   ├─ Step 3: Launch execution
   │   ├─ Phase 1: All independent tasks (single batch, concurrent)
   │   └─ Phase 2+: Dependent tasks by dependency order
   ├─ Step 4: Track progress (TodoWrite updates per batch)
   └─ Step 5: Code review (if codeReviewTool ≠ "Skip")

Output:
   └─ Execution complete with results in previousExecutionResults[]
```

## Detailed Execution Steps

### Step 1: Initialize Execution Tracking

**Operations**:
- Initialize `previousExecutionResults` array for context continuity
- **In-Memory Mode**: Echo execution strategy from planning phase for transparency
  - Display: Method, Review tool, Task count, Complexity, Executor assignments (if present)

### Step 2: Task Grouping & Batch Creation

**Dependency Analysis**: Use **explicit** `depends_on` from plan.json only — no inference from file paths or keywords.

```
1. Build task ID → index mapping

2. For each task:
   └─ Resolve depends_on IDs to task indices
       └─ Filter: only valid IDs that reference earlier tasks

3. Group into execution batches:
   ├─ Phase 1: All tasks with NO dependencies → single parallel batch
   │   └─ Mark as processed
   └─ Phase 2+: Iterative dependency resolution
       ├─ Find tasks whose ALL dependencies are satisfied (processed)
       ├─ Group ready tasks as batch (parallel within batch if multiple)
       ├─ Mark as processed
       ├─ Repeat until no tasks remain
       └─ Safety: If no ready tasks found → circular dependency warning → force remaining

4. Assign batch IDs:
   ├─ Parallel batches: P1, P2, P3...
   └─ Sequential batches: S1, S2, S3...

5. Create TodoWrite list with batch indicators:
   ├─ ⚡ for parallel batches (concurrent)
   └─ → for sequential batches (one-by-one)
```

### Step 3: Launch Execution

#### Executor Resolution

Task-level executor assignment takes priority over global execution method:

```
Resolution order (per task):
├─ 1. executorAssignments[task.id] → use assigned executor (gemini/codex/agent)
└─ 2. Fallback to global executionMethod:
    ├─ "Agent" → agent
    ├─ "Codex" → codex
    └─ "Auto" → Low complexity → agent; Medium/High → codex
```

#### Execution Flow

```
1. Separate batches into parallel and sequential groups

2. Phase 1 — Launch all parallel batches concurrently:
   ├─ Update TodoWrite: all parallel → in_progress
   ├─ Execute all parallel batches simultaneously (single message, multiple tool calls)
   ├─ Collect results → append to previousExecutionResults
   └─ Update TodoWrite: all parallel → completed

3. Phase 2+ — Execute sequential batches in order:
   ├─ For each sequential batch:
   │   ├─ Update TodoWrite: current batch → in_progress
   │   ├─ Execute batch
   │   ├─ Collect result → append to previousExecutionResults
   │   └─ Update TodoWrite: current batch → completed
   └─ Continue until all batches completed
```

### Unified Task Prompt Builder

Each task is formatted as a **self-contained checklist**. The executor only needs to know what THIS task requires. Same template for Agent and CLI.

**Prompt Structure** (assembled from batch tasks):

```
## Goal
{originalUserInput}

## Tasks
(For each task in batch, separated by ---)

### {task.title}
**Scope**: {task.scope}  |  **Action**: {task.action}

#### Modification Points
- **{file}** → `{target}`: {change}

#### Why this approach (Medium/High only)
{rationale.chosen_approach}
Key factors: {decision_factors}
Tradeoffs: {tradeoffs}

#### How to do it
{description}
{implementation steps}

#### Code skeleton (High only)
Interfaces: {interfaces}
Functions: {key_functions}
Classes: {classes}

#### Reference
- Pattern: {pattern}
- Files: {files}
- Notes: {examples}

#### Risk mitigations (High only)
- {risk.description} → **{risk.mitigation}**

#### Done when
- [ ] {acceptance criteria}
Success metrics: {verification.success_metrics}

## Context
(Assembled from available sources, reference only)

### Exploration Notes (Refined)
**Read first**: {exploration_log_refined path}
Contains: file index, task-relevant context, code reference, execution notes
**IMPORTANT**: Use to avoid re-exploring already analyzed files

### Previous Work
{previousExecutionResults summaries}

### Clarifications
{clarificationContext entries}

### Data Flow
{planObject.data_flow.diagram}

### Artifacts
Plan: {plan path}

### Project Guidelines
@{projectRoot}/.workflow/project-guidelines.json

Complete each task according to its "Done when" checklist.
```

#### Option A: Agent Execution

**When to use**: `getTaskExecutor(task) === "agent"`, or global `executionMethod = "Agent"`, or `Auto AND complexity = Low`

**Execution Flow**:

```
1. Spawn code-developer agent with prompt:
   ├─ MANDATORY FIRST STEPS:
   │   ├─ Read: ~/.codex/agents/code-developer.md
   │   ├─ Read: {projectRoot}/.workflow/project-tech.json
   │   ├─ Read: {projectRoot}/.workflow/project-guidelines.json
   │   └─ Read: {exploration_log_refined} (execution-relevant context)
   └─ Body: {buildExecutionPrompt(batch)}

2. Wait for completion (timeout: 10 minutes)

3. Close agent after collection

4. Collect result → executionResult structure
```

#### Option B: CLI Execution (Codex)

**When to use**: `getTaskExecutor(task) === "codex"`, or global `executionMethod = "Codex"`, or `Auto AND complexity = Medium/High`

**Execution**:

```bash
ccw cli -p "{buildExecutionPrompt(batch)}" --tool codex --mode write --id {sessionId}-{groupId}
```

**Fixed ID Pattern**: `{sessionId}-{groupId}` (e.g., `implement-auth-2025-12-13-P1`)

**Execution Mode**: Background (`run_in_background=true`) → Stop output → Wait for task hook callback

**Resume on Failure**:

```
If status = failed or timeout:
├─ Display: Fixed ID, lookup command, resume command
├─ Lookup: ccw cli detail {fixedExecutionId}
└─ Resume: ccw cli -p "Continue tasks" --resume {fixedExecutionId} --tool codex --mode write --id {fixedExecutionId}-retry
```

#### Option C: CLI Execution (Gemini)

**When to use**: `getTaskExecutor(task) === "gemini"` (analysis tasks)

```bash
ccw cli -p "{buildExecutionPrompt(batch)}" --tool gemini --mode analysis --id {sessionId}-{groupId}
```

### Step 4: Progress Tracking

Progress tracked at **batch level** (not individual task level).

| Icon | Meaning |
|------|---------|
| ⚡ | Parallel batch (concurrent execution) |
| → | Sequential batch (one-by-one execution) |

### Step 5: Code Review (Optional)

**Skip Condition**: Only run if `codeReviewTool ≠ "Skip"`

**Review Focus**: Verify implementation against plan acceptance criteria and verification requirements.

**Review Criteria**:
- **Acceptance Criteria**: Verify each criterion from plan.tasks[].acceptance
- **Verification Checklist** (Medium/High): Check unit_tests, integration_tests, success_metrics from plan.tasks[].verification
- **Code Quality**: Analyze quality, identify issues, suggest improvements
- **Plan Alignment**: Validate implementation matches planned approach and risk mitigations

**Shared Review Prompt Template**:

```
PURPOSE: Code review for implemented changes against plan acceptance criteria and verification requirements
TASK: • Verify plan acceptance criteria fulfillment • Check verification requirements (unit tests, success metrics) • Analyze code quality • Identify issues • Suggest improvements • Validate plan adherence and risk mitigations
MODE: analysis
CONTEXT: @**/* @{plan.json} [@{exploration.json}] | Memory: Review lite-execute changes against plan requirements including verification checklist
EXPECTED: Quality assessment with:
  - Acceptance criteria verification (all tasks)
  - Verification checklist validation (Medium/High: unit_tests, integration_tests, success_metrics)
  - Issue identification
  - Recommendations
  Explicitly check each acceptance criterion and verification item from plan.json tasks.
CONSTRAINTS: Focus on plan acceptance criteria, verification requirements, and plan adherence | analysis=READ-ONLY
```

**Tool-Specific Execution**:

| Tool | Command | Notes |
|------|---------|-------|
| Agent Review | Direct review by current agent | Read plan.json, apply review criteria, report findings |
| Gemini Review | `ccw cli -p "[review prompt]" --tool gemini --mode analysis` | Recommended |
| Qwen Review | `ccw cli -p "[review prompt]" --tool qwen --mode analysis` | Alternative |
| Codex Review (A) | `ccw cli -p "[review prompt]" --tool codex --mode review` | Complex reviews with focus areas |
| Codex Review (B) | `ccw cli --tool codex --mode review --uncommitted` | Quick review, no custom prompt |

> **IMPORTANT**: `-p` prompt and target flags (`--uncommitted`/`--base`/`--commit`) are **mutually exclusive** for codex review.

**Multi-Round Review**: Generate fixed review ID (`{sessionId}-review`). If issues found, resume with follow-up:

```bash
ccw cli -p "Clarify the security concerns" --resume {reviewId} --tool gemini --mode analysis --id {reviewId}-followup
```

**Implementation Note**: Replace `[review prompt]` placeholder with actual Shared Review Prompt Template content, substituting:
- `@{plan.json}` → `@{executionContext.session.artifacts.plan}`
- `[@{exploration.json}]` → exploration files from artifacts (if exists)

### Step 6: Update Development Index

**Trigger**: After all executions complete (regardless of code review)

**Skip Condition**: Skip if `{projectRoot}/.workflow/project-tech.json` does not exist

**Operations**:

```
1. Read {projectRoot}/.workflow/project-tech.json
   └─ If not found → silent skip

2. Initialize development_index if missing
   └─ Categories: feature, enhancement, bugfix, refactor, docs

3. Detect category from task keywords:
   ├─ fix/bug/error/issue/crash → bugfix
   ├─ refactor/cleanup/reorganize → refactor
   ├─ doc/readme/comment → docs
   ├─ add/new/create/implement → feature
   └─ (default) → enhancement

4. Detect sub_feature from task file paths
   └─ Extract parent directory names, return most frequent

5. Create entry:
   ├─ title: plan summary (max 60 chars)
   ├─ sub_feature: detected from file paths
   ├─ date: current date (YYYY-MM-DD)
   ├─ description: plan approach (max 100 chars)
   ├─ status: "completed" if all results completed, else "partial"
   └─ session_id: from executionContext

6. Append entry to development_index[category]
7. Update statistics.last_updated timestamp
8. Write updated project-tech.json
```

## Best Practices

**Input Modes**: In-memory (planning phase), prompt (standalone), file (JSON/text)
**Task Grouping**: Based on explicit depends_on only; independent tasks run in single parallel batch
**Execution**: All independent tasks launch concurrently via single Claude message with multiple tool calls

## Error Handling

| Error | Cause | Resolution |
|-------|-------|------------|
| Missing executionContext | --in-memory without context | Error: "No execution context found. Only available when called by planning phase." |
| File not found | File path doesn't exist | Error: "File not found: {path}. Check file path." |
| Empty file | File exists but no content | Error: "File is empty: {path}. Provide task description." |
| Invalid Enhanced Task JSON | JSON missing required fields | Warning: "Missing required fields. Treating as plain text." |
| Malformed JSON | JSON parsing fails | Treat as plain text (expected for non-JSON files) |
| Execution failure | Agent/Codex crashes | Display error, use fixed ID `{sessionId}-{groupId}` for resume |
| Execution timeout | CLI exceeded timeout | Use fixed ID for resume with extended timeout |
| Codex unavailable | Codex not installed | Show installation instructions, offer Agent execution |
| Fixed ID not found | Custom ID lookup failed | Check `ccw cli history`, verify date directories |

## Data Structures

### executionContext (Input - Mode 1)

Passed from planning phase via global variable:

```javascript
{
  projectRoot: string,                   // 项目根目录绝对路径 (git rev-parse --show-toplevel || pwd)
  planObject: {
    summary: string,
    approach: string,
    tasks: [...],
    estimated_time: string,
    recommended_execution: string,
    complexity: string
  },
  explorationsContext: {...} | null,       // Multi-angle explorations
  explorationAngles: string[],             // List of exploration angles
  explorationManifest: {...} | null,       // Exploration manifest
  clarificationContext: {...} | null,
  executionMethod: "Agent" | "Codex" | "Auto",  // Global default
  codeReviewTool: "Skip" | "Gemini Review" | "Agent Review" | string,
  originalUserInput: string,

  // Task-level executor assignments (priority over executionMethod)
  executorAssignments: {
    [taskId]: { executor: "gemini" | "codex" | "agent", reason: string }
  },

  // Session artifacts location (saved by planning phase)
  session: {
    id: string,                        // Session identifier: {taskSlug}-{shortTimestamp}
    folder: string,                    // Session folder path: {projectRoot}/.workflow/.lite-plan/{session-id}
    artifacts: {
      explorations: [{angle, path}],   // exploration-{angle}.json paths
      explorations_manifest: string,   // explorations-manifest.json path
      exploration_log: string,         // exploration-notes.md (full version, Plan consumption)
      exploration_log_refined: string, // exploration-notes-refined.md (refined version, Execute consumption)
      plan: string                     // plan.json path (always present)
    }
  }
}
```

**Artifact Usage**:
- **exploration_log**: Full exploration notes, for Plan phase reference, contains 6 sections
- **exploration_log_refined**: Refined exploration notes, for Execute phase consumption, task-relevant content only
- Pass artifact paths to CLI tools and agents for enhanced context
- See execution options above for usage examples

### executionResult (Output)

Collected after each execution call completes:

```javascript
{
  executionId: string,                 // e.g., "[Agent-1]", "[Codex-1]"
  status: "completed" | "partial" | "failed",
  tasksSummary: string,                // Brief description of tasks handled
  completionSummary: string,           // What was completed
  keyOutputs: string,                  // Files created/modified, key changes
  notes: string,                       // Important context for next execution
  fixedCliId: string | null            // Fixed CLI execution ID (e.g., "implement-auth-2025-12-13-P1")
}
```

Appended to `previousExecutionResults` array for context continuity in multi-execution scenarios.

## Post-Completion Expansion

After completion, ask user whether to expand as issue (test/enhance/refactor/doc). Selected items create new issues accordingly.

**Fixed ID Pattern**: `{sessionId}-{groupId}` enables predictable lookup without auto-generated timestamps.

**Resume Usage**: If `status` is "partial" or "failed", use `fixedCliId` to resume:

```bash
# Lookup previous execution
ccw cli detail {fixedCliId}

# Resume with new fixed ID for retry
ccw cli -p "Continue from where we left off" --resume {fixedCliId} --tool codex --mode write --id {fixedCliId}-retry
```

---

## Post-Phase Update

After Phase 2 (Lite Execute) completes:
- **Output Created**: Executed tasks, optional code review results, updated development index
- **Execution Results**: `previousExecutionResults[]` with status per batch
- **Next Action**: Workflow complete. Optionally expand to issue (test/enhance/refactor/doc)
- **TodoWrite**: Mark all execution batches as completed
