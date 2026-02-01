---
name: unified-execute-with-file
description: Universal execution engine for consuming any planning/brainstorm/analysis output with minimal progress tracking, multi-agent coordination, and incremental execution
argument-hint: "[-y|--yes] [-p|--plan <path>[,<path2>]] [--merge-agents] [--auto-commit] [--commit-prefix \"prefix\"] [-m|--mode sequential|parallel] [\"execution context or task name\"]"
allowed-tools: TodoWrite(*), Task(*), AskUserQuestion(*), Read(*), Grep(*), Glob(*), Bash(*), Edit(*), Write(*)
---

## Auto Mode

When `--yes` or `-y`: Auto-confirm execution decisions, use default parallel strategy where possible.

# Unified Execute-With-File Command

## Quick Start

```bash
# Basic usage (auto-detect plan, ask for execution method)
/workflow:unified-execute-with-file

# Execute with specific plan
/workflow:unified-execute-with-file -p .workflow/plans/auth-plan.md

# Merge multiple plans
/workflow:unified-execute-with-file -p plan.json,agents/auth/plan.json

# Collaborative plan execution (auto-discover sub-plans)
/workflow:unified-execute-with-file -p .workflow/.planning/CPLAN-xxx --merge-agents

# With auto-commit (conventional commits)
/workflow:unified-execute-with-file --auto-commit -p plan.json

# Sequential execution (no parallelization)
/workflow:unified-execute-with-file -m sequential -p plan.json

# Auto mode (skip prompts, use Agent for simple tasks, CLI for complex)
/workflow:unified-execute-with-file -y -p plan.json
```

**Execution Methods**:
- **Agent**: Task tool with code-developer (recommended for standard tasks)
- **CLI-Codex**: `ccw cli --tool codex` (complex tasks, git-aware)
- **CLI-Gemini**: `ccw cli --tool gemini` (analysis-heavy tasks)
- **Auto**: Select based on task complexity (default in `-y` mode)

**Context Source**: Plan files (IMPL_PLAN.md, plan.json, synthesis.json, etc.)
**Output Directory**: `.workflow/.execution/{session-id}/`
**Default Mode**: Parallel execution with smart dependency resolution
**Core Innovation**: Unified event log + structured notes + auto-commit

## Output Artifacts

### During Execution

| Artifact | Description |
|----------|-------------|
| `execution.md` | Plan overview, task table, execution timeline |
| `execution-events.md` | ⭐ Unified log (all task executions) - SINGLE SOURCE OF TRUTH |

### Generated Code

Files generated directly to project directories (`src/`, `tests/`, `docs/`, etc.), not into execution folder.

## Overview

Universal execution engine consuming **any** planning output and executing it with multi-agent coordination, dependency management, and progress tracking.

**Core workflow**: Load Plan → Parse Tasks → Execute → Track → Verify

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    UNIFIED EXECUTION WORKFLOW                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Phase 1: Plan Detection & Multi-Plan Merging                           │
│     ├─ Auto-detect or explicit --plan path                              │
│     ├─ Support multiple plans (comma-separated or --merge-agents)       │
│     ├─ Deduplicate tasks (file overlap + 90% title similarity)          │
│     ├─ Assign global IDs: GTASK-{plan-index}-{original-id}              │
│     └─ Remap cross-plan dependencies                                    │
│                                                                          │
│  Phase 2: Session Initialization                                        │
│     ├─ Create .workflow/.execution/{sessionId}/                         │
│     ├─ Generate execution.md (plan overview + task table)               │
│     ├─ Initialize execution-events.md (unified log)                     │
│     ├─ Validate dependency graph (detect cycles)                        │
│     └─ Calculate execution waves (topological sort + conflict check)    │
│                                                                          │
│  Phase 3: Pre-Execution Validation (Agent-Assisted)                     │
│     ├─ Launch validation agent to check feasibility                     │
│     ├─ Verify file existence, agent availability, file conflicts        │
│     ├─ Generate validation report with recommendations                  │
│     └─ Ask user: execution method (Agent/CLI-Codex/CLI-Gemini/Auto)     │
│                                                                          │
│  Phase 4: Wave Execution (Parallel/Sequential)                          │
│     ┌──────────────┬──────────────┬──────────────┐                      │
│     │   Wave 1     │   Wave 2     │   Wave N     │                      │
│     ├──────────────┼──────────────┼──────────────┤                      │
│     │ Task 1-A ──┐ │ Task 2-A     │ Task N-A     │  ← Dependencies OK   │
│     │ Task 1-B   │ │ Task 2-B     │ Task N-B     │  ← No file conflicts │
│     │ Task 1-C ──┘ │              │              │  ← Max 3 parallel    │
│     └──────────────┴──────────────┴──────────────┘                      │
│                                                                          │
│  Phase 5: Per-Task Execution (Agent OR CLI)                             │
│     ├─ Extract relevant notes from previous tasks                       │
│     ├─ Inject notes into execution context                              │
│     ├─ Route to Agent (Task tool) OR CLI (ccw cli command)              │
│     ├─ Generate structured notes for next task                          │
│     ├─ Auto-commit if enabled (conventional commit format)              │
│     └─ Append event to unified log                                      │
│                                                                          │
│  Phase 6: Progress Tracking & Recovery                                  │
│     ├─ execution-events.md: Single source of truth                      │
│     ├─ Each task: read previous events → execute → write event          │
│     ├─ Status indicators: ✅ (completed), ❌ (failed), ⏳ (progress)     │
│     └─ Resume support: --continue flag                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Output Structure

```
.workflow/.execution/{EXEC-slug-YYYY-MM-DD}/
├── execution.md              # Plan overview + task table + timeline
└── execution-events.md       # ⭐ Unified log (all task executions) - SINGLE SOURCE OF TRUTH

# Generated files (direct to project):
src/*, tests/*, docs/*
```

**Key Concept**: execution-events.md serves as both human-readable log AND machine-parseable state store. No redundancy, one unified source.

## Implementation

### Session Initialization

**Objective**: Parse plan paths, create session directory, build unified task graph.

**Prerequisites**: None (entry point)

**Workflow Steps**:

1. **Parse Command Flags**
   - Extract plan paths from `--plan` or `-p` argument
   - Detect `--merge-agents` flag for collaborative plan auto-discovery
   - Detect `--auto-commit` and `--commit-prefix` for git integration
   - Detect `--mode` for execution strategy (parallel/sequential)
   - Detect `-y` or `--yes` for auto-confirmation mode

2. **Resolve Plan Paths**

   | Input Format | Resolution Strategy |
   |--------------|---------------------|
   | Comma-separated | Split by comma: `plan1.json,plan2.json` |
   | `--merge-agents` | Auto-discover: `plan-note.md` + `agents/**/plan.json` |
   | Single path | Direct use |
   | No path | Auto-detect from `.workflow/` (IMPL_PLAN.md or task JSONs) |

3. **Build Unified Graph**
   - Parse all plans via format-agnostic `parsePlan()`
   - Assign global IDs: `GTASK-{plan-index}-{original-id}`
   - Deduplicate tasks (file overlap + 90% title similarity)
   - Remap dependencies (handle merged tasks + cross-plan refs)
   - Validate (detect cycles), topological sort
   - Return: `{ tasks, executionOrder, planSources, metadata }`

4. **Create Session Directory**
   - Generate session ID: `EXEC-{slug}-{date}-{random}`
   - Create `.workflow/.execution/{sessionId}/`
   - Initialize `execution.md` with plan sources and merge statistics
   - Initialize `execution-events.md` (empty, will be appended)

**Success Criteria**:
- [ ] All plans parsed successfully
- [ ] No circular dependencies in task graph
- [ ] Session directory created with execution.md template
- [ ] Execution order calculated (topological sort)

**Completion**: Log session ID and ready for validation phase

---

### Pre-Execution Validation (Agent-Assisted)

**Objective**: Use validation agent to check execution feasibility, then ask user about execution method.

**Prerequisites**: Session initialized, unified graph built

**Workflow Steps**:

1. **Launch Validation Agent**

   ```javascript
   Task(
     subagent_type="cli-explore-agent",
     run_in_background=false,
     description="Validate execution plan feasibility",
     prompt=`
## Validation Mission

Analyze the following execution plan and generate a validation report.

### Plan Summary
- Total Tasks: ${unifiedGraph.tasks.length}
- Plan Sources: ${unifiedGraph.planSources.map(p => p.path).join(', ')}
- Execution Mode: ${executionMode}

### Tasks to Validate
${unifiedGraph.tasks.slice(0, 10).map(t => `- ${t.id}: ${t.title} (files: ${t.files_to_modify?.join(', ')})`).join('\n')}

### Validation Checks
1. **File Existence**: Verify files_to_modify exist or will be created
2. **Dependency Resolution**: Check all depends_on targets exist
3. **File Conflicts**: Identify same-file modifications in parallel waves
4. **Complexity Assessment**: Estimate task complexity (Low/Medium/High)
5. **Risk Analysis**: Identify potential issues or blockers

### Output Format
Generate validation-report.json in ${sessionFolder}:
{
  "status": "pass" | "warn" | "fail",
  "file_checks": { "missing": [], "will_create": [] },
  "dependency_issues": [],
  "file_conflicts": [{ "file": "", "tasks": [], "wave": 0 }],
  "complexity_assessment": { "low": 0, "medium": 0, "high": 0 },
  "risks": [{ "severity": "critical|high|medium|low", "description": "" }],
  "recommendations": []
}
`
   )
   ```

2. **Process Validation Result**
   - Read `{sessionFolder}/validation-report.json`
   - Display summary: status, conflicts count, risks count
   - If `status === "fail"`: Show blockers, ask to abort/continue
   - If `status === "warn"`: Show warnings, ask to proceed/fix

3. **Select Execution Method** (unless `--yes` flag)

   | Method | Description | When to Use |
   |--------|-------------|-------------|
   | Agent | `Task(subagent_type="code-developer")` | Standard implementation |
   | CLI-Codex | `ccw cli --tool codex --mode write` | Complex tasks, git-aware |
   | CLI-Gemini | `ccw cli --tool gemini --mode write` | Analysis-heavy tasks |
   | Auto | Auto-select by complexity | Default for `--yes` mode |

   **User Interaction** (unless `--yes`):
   ```javascript
   if (autoYes) {
     executionMethod = "Auto"
     console.log(`[--yes] Auto-selecting execution method: Auto`)
   } else {
     const selection = AskUserQuestion({
       questions: [{
         question: `选择执行方式 (${unifiedGraph.tasks.length} tasks, complexity: ${avgComplexity}):`,
         header: "Execution",
         multiSelect: false,
         options: [
           { label: "Agent (Recommended)", description: "@code-developer - 标准实现" },
           { label: "CLI-Codex", description: "ccw cli --tool codex - 复杂任务" },
           { label: "CLI-Gemini", description: "ccw cli --tool gemini - 分析型任务" },
           { label: "Auto", description: "按复杂度自动选择" }
         ]
       }]
     })
     executionMethod = selection.execution
   }
   ```

4. **Confirm Execution** (unless `--yes` flag)

   Options:
   - "开始执行" → Proceed with selected method
   - "更换方式" → Re-select execution method
   - "查看详情" → View full validation report
   - "取消" → Exit without execution

**Success Criteria**:
- [ ] Validation agent completed successfully
- [ ] No critical blockers (or user chose to continue)
- [ ] Execution method selected
- [ ] User confirmed (or auto-mode enabled)

**Variables Set**:
- `validationReport`: Parsed validation-report.json
- `executionMethod`: "Agent" | "CLI-Codex" | "CLI-Gemini" | "Auto"

---

### Wave Execution

**Objective**: Execute tasks in waves, respecting dependencies and file conflicts.

**Prerequisites**: Validation completed, user confirmed

**Workflow Steps**:

1. **Calculate Execution Waves**

   **Constraints**:
   - Tasks with dependencies must wait for completion
   - Same file modifications → Sequential (no parallel)
   - Max 3 parallel tasks per wave (resource limit)

   **Algorithm**:
   - Find available tasks (dependencies satisfied, not completed)
   - Check file conflicts (task.files_to_modify)
   - Group non-conflicting tasks (up to 3 per wave)
   - Mark completed, repeat

2. **Execute Each Wave**
   - Launch tasks in parallel via `executeTask()`
   - Wait for wave completion via `Promise.allSettled()`
   - Process results (mark completed/failed)
   - Update execution.md timeline
   - Append events to execution-events.md

3. **Handle Failures**

   | Failure Type | Action |
   |--------------|--------|
   | Task timeout | Ask: retry/skip/abort |
   | Dependency failed | Auto-skip dependent tasks |
   | Max retries reached | Ask: retry/skip/abort (unless auto-mode) |

**Success Criteria**:
- [ ] All waves executed
- [ ] Results captured in execution-events.md
- [ ] Failed tasks handled appropriately

---

### Task Execution

**Objective**: Execute individual task with context awareness, structured notes, and optional auto-commit.

**Prerequisites**: Task selected from available wave

**Workflow Steps**:

1. **Extract Relevant Notes**
   - Read all notes from execution-events.md
   - Filter by file overlap (notes.related_files ∩ task.files_to_modify)
   - Always include Critical severity notes
   - Sort by severity (Critical → High → Medium → Low)

2. **Build Execution Context**

   ```javascript
   const executionContext = `
   ⚠️ Execution Notes from Previous Tasks
   ${relevantNotes}  // Categorized notes with severity

   Current Task: ${task.id}
   - Original ID: ${task.original_id}
   - Source Plan: ${task.source_plan}
   - Modified Files: ${task.files_to_modify}

   Previous Agent Executions (for reference)
   ${previousEvents}  // All previous task results
   `
   ```

3. **Route to Executor** (based on `executionMethod`)

   **Option A: Agent Execution**

   When: `executionMethod === "Agent"` or `Auto + Low Complexity`

   Execute task via Task tool with code-developer agent:

   ```javascript
   Task({
     subagent_type: "code-developer",  // or other agent types
     run_in_background: false,
     description: task.title,
     prompt: buildAgentPrompt(executionContext, task)
   })

   // buildAgentPrompt generates:
   // - Execution context with notes
   // - Task details (title, description)
   // - Files to modify
   // - Dependencies
   // - Expected output
   ```

   Agent Type Selection:

   | Agent Type | Use Case |
   |------------|----------|
   | code-developer | Code implementation |
   | tdd-developer | Code with tests |
   | test-fix-agent | Test execution and fixing |
   | cli-execution-agent | CLI-based tasks |
   | debug-explore-agent | Bug diagnosis |
   | universal-executor | Generic tasks |

   ---

   **Option B: CLI Execution**

   When: `executionMethod === "CLI-Codex"/"CLI-Gemini"` or `Auto + Medium/High Complexity`

   Execute task via CLI in background mode:

   ```javascript
   // Build CLI prompt from execution context
   const cliPrompt = buildCliPrompt(task, executionContext)
   // Generates: PURPOSE, TASK, MODE, CONTEXT, EXPECTED, CONSTRAINTS

   // Select tool based on execution method
   const tool = executionMethod === "CLI-Gemini" ? "gemini" : "codex"

   // Generate fixed execution ID for resume capability
   const fixedId = `${sessionId}-${task.id}`

   // Execute in background
   Bash({
     command: `ccw cli -p "${cliPrompt}" --tool ${tool} --mode write --id ${fixedId}`,
     run_in_background: true,
     description: `Execute task ${task.id} via CLI`
   })

   // STOP HERE - CLI executes in background, task hook will notify on completion
   ```

   Resume on Failure:

   ```javascript
   if (cliResult.status === 'failed' || cliResult.status === 'timeout') {
     console.log(`Task ${task.id} incomplete. Resume with fixed ID: ${fixedId}`)
     // Resume command: ccw cli -p "Continue" --resume ${fixedId} --id ${fixedId}-retry
   }
   ```

4. **Generate Structured Notes**

   **Pattern Detection** (auto-generate notes):
   - `localStorage|sessionStorage` → WARNING (High): XSS防护提醒
   - `package.json` modified → DEPENDENCY (Medium): npm install提醒
   - `api.*change|breaking` → API_CHANGE (Critical): 兼容性检查

5. **Auto-Commit** (if `--auto-commit` enabled)
   - Get changed files via `git status --porcelain`
   - Filter to task.files_to_modify
   - Stage files: `git add`
   - Generate conventional commit message: `type(scope): subject`
   - Commit: `git commit -m`

6. **Append to Event Log**

   **Event Format**:
   ```markdown
   ## Task ${task.id} - COMPLETED ✅

   **Timestamp**: ${time}
   **Duration**: ${ms}
   **Agent**: ${agent}

   ### Execution Summary
   ${summary}

   ### Generated Artifacts
   - `src/auth.ts` (2.3KB)

   ### Git Commit (if --auto-commit)
   **Files Committed**: ${files.length}
   **Commit Message**: feat(auth): implement user login

   ### 注意事项 (Execution Notes)
   **Category**: WARNING
   **Severity**: High
   **Related Files**: src/auth.ts
   **Message**: 使用了localStorage，注意XSS防护

   ---
   ```

**Success Criteria**:
- [ ] Task executed successfully
- [ ] Notes generated for next agent
- [ ] Event appended to execution-events.md
- [ ] Auto-commit completed (if enabled)

---

### Completion

**Objective**: Summarize execution results and offer follow-up actions.

**Prerequisites**: All waves completed

**Workflow Steps**:

1. **Collect Statistics**
   - Total tasks: `normalizedTasks.length`
   - Completed: `tasks.filter(t => t.status === 'completed').length`
   - Failed: `tasks.filter(t => t.status === 'failed').length`
   - Skipped: `tasks.filter(t => t.status === 'skipped').length`
   - Success rate: `(completed / total * 100).toFixed(1)`

2. **Update execution.md**
   - Append "Execution Completed" section
   - Include statistics table
   - Link to execution-events.md for details

3. **Display Summary**
   - Show session ID and folder
   - Display statistics
   - List failed tasks (if any)

4. **Offer Follow-Up Actions** (unless `--yes`)

   Options:
   - "查看详情" → View full execution log
   - "调试失败项" → Debug failed tasks
   - "优化执行" → Analyze execution improvements
   - "完成" → No further action

**Success Criteria**:
- [ ] Statistics collected and displayed
- [ ] execution.md updated with final status
- [ ] User informed of completion

---

## Helper Functions

### Multi-Plan Support

**discoverCollaborativePlans(basePath)**:
- Search for `plan-note.md` or `plan.json` in base path
- Glob `agents/*/plan.json` for sub-plans
- Return: Array of plan paths

**buildUnifiedGraph(planPaths)**:
- Parse each plan, assign global IDs
- Deduplicate tasks (file overlap + 90% title similarity via Levenshtein)
- Remap dependencies (merged tasks + cross-plan refs)
- Validate (detect cycles), topological sort
- Return: `{ tasks, executionOrder, planSources, metadata }`

**Deduplication Logic**:
- Same files + 90%+ title similarity → Merge
- Merge metadata: `source_plans`, `merged_from`

---

### Structured Notes

**Note Categories**: `WARNING`, `DECISION`, `API_CHANGE`, `FILE_CONFLICT`, `DEPENDENCY`, `PATTERN`

**Note Severity**: `Critical`, `High`, `Medium`, `Low`

**extractNotesFromEvents(eventLogPath)**:
- Parse structured note blocks from execution-events.md
- Pattern: `**Category**: ... **Severity**: ... **Related Files**: ... **Message**: ...`
- Return: Array of note objects

**filterRelevantNotes(notes, task)**:
- Include: File overlap with task.files_to_modify
- Always include: Critical severity notes
- Sort: By severity (Critical first)

**generateNotesForNextAgent(result, task)**:
- Pattern detection for common issues
- Auto-generate structured notes
- Return: Markdown-formatted notes

---

### Git Auto-Commit

**inferCommitType(task)**:
- Check action/title for keywords: fix, refactor, test, doc
- Default: `feat`

**extractScope(task)**:
- Check files_to_modify for patterns: frontend/, backend/, components/, api/, auth/
- Return: scope or null

**generateCommitMessage(task)**:
- Format: `type(scope): subject`
- Footer: `Task-ID: ${task.id}\nPlan: ${plan}`

**autoCommitTaskChanges(task)**:
- Get changed files, filter to task.files_to_modify
- Stage, commit with conventional message
- Return: `{ files, message }` or null

---

### Plan Format Parsers

**parsePlan(content, filePath)**:
- Route to appropriate parser based on filename pattern
- Support: IMPL_PLAN.md, plan.json, synthesis.json, conclusions.json

**parsePlanJson(content)**:
- Handle plan-json-schema (lite-plan, collaborative-plan, sub-plans)
- Map fields: `modification_points → files_to_modify`, `acceptance → expected_output`
- Infer: agent_type, task.type
- Build: prompt from task details

---

### Validation & Execution Method

**validateExecutionPlan(unifiedGraph, sessionFolder)**:
- Launch validation agent (cli-explore-agent)
- Check file existence, dependencies, file conflicts
- Generate validation-report.json with status/risks/recommendations
- Return: `{ status: "pass"|"warn"|"fail", report: {...} }`

**selectExecutionMethod(validationReport, autoYes)**:
- If `autoYes === true`: Return "Auto"
- Otherwise: AskUserQuestion with options (Agent/CLI-Codex/CLI-Gemini/Auto)
- Return: Selected execution method

**resolveExecutor(task, executionMethod, complexity)**:
- If `executionMethod === "Agent"`: Return "agent"
- If `executionMethod === "CLI-Codex"`: Return "cli-codex"
- If `executionMethod === "CLI-Gemini"`: Return "cli-gemini"
- If `executionMethod === "Auto"`:
  - Low complexity → "agent"
  - Medium/High complexity → "cli-codex"
- Return: Executor type

---

### Agent Selection

**selectBestAgent(task)**:

| Task Type | Agent |
|-----------|-------|
| code (with tests) | tdd-developer |
| code | code-developer |
| test | test-fix-agent |
| doc | doc-generator |
| analysis | cli-execution-agent |
| debug | debug-explore-agent |
| default | universal-executor |

---

### Parallelization

**calculateParallel(tasks)**:

Group into waves with constraints:
- Same file modifications → Sequential
- Dependencies → Wait for completion
- Max 3 parallel tasks per wave

Algorithm: Find available → Check conflicts → Group → Repeat

---

## Error Handling & Recovery

| Situation | Action |
|-----------|--------|
| Task timeout | Mark timeout, ask: retry/skip/abort |
| Missing dependency | Auto-skip dependent tasks, log warning |
| File conflict | Detect before execution, ask resolution |
| Output mismatch | Validate vs expected_output, flag review |
| Agent unavailable | Fallback to universal-executor |
| Execution interrupted | Resume with `--continue` flag |

**Retry Logic**:
- Auto-retry up to `max_retries` (default: 2) in auto-yes mode
- Interactive mode: Ask user after max retries

**Dependency Handling**:
- Failed task → Auto-skip all dependent tasks
- Log warning with skipped task IDs

---

## Session Resume

```bash
/workflow:unified-execute-with-file --continue                      # Resume last
/workflow:unified-execute-with-file --continue EXEC-xxx-2025-01-27  # Resume specific
```

**Resume Process**:
1. Load execution.md and execution-events.md
2. Parse events to identify completed/failed/skipped tasks (via status indicators)
3. Recalculate remaining dependencies
4. Resume from first incomplete task
5. Append "Resumed from [sessionId]" note to events

---

## Configuration

| Flag | Default | Description |
|------|---------|-------------|
| `-p, --plan <path>` | Auto-detect | Plan file(s), comma-separated for multiple |
| `--merge-agents` | false | Auto-discover collaborative plan sub-plans |
| `--auto-commit` | false | Commit after each successful task |
| `--commit-prefix` | null | Custom commit message prefix |
| `-m, --mode` | parallel | Execution strategy: sequential or parallel |
| `-y, --yes` | false | Auto-confirm all decisions |

---

## Best Practices

1. **Clear Plan Structure**: Well-structured plans → better execution
2. **Review Validation Report**: Check validation-report.json for risks before proceeding
3. **Choose Right Execution Method**:
   - **Agent**: Standard tasks, straightforward implementation
   - **CLI-Codex**: Complex tasks, requires git-aware context
   - **CLI-Gemini**: Analysis-heavy or exploratory tasks
   - **Auto**: Let system decide based on complexity
4. **Use Auto-Commit**: Enable `--auto-commit` for automatic progress tracking
5. **Resolve Conflicts Early**: Address file conflicts before execution
6. **Monitor Events Log**: Check execution-events.md for detailed progress
7. **Resume on Failure**: Use `--continue` to resume interrupted executions (Agent) or fixed ID (CLI)
8. **Multi-Plan Merging**: Leverage `--merge-agents` for collaborative plan execution

---

## Advanced Features

### Multi-Plan Merging

**Use Cases**:
- Collaborative planning output (plan-note.md + agents/**/plan.json)
- Multiple feature plans to execute together
- Incremental plan additions

**Edge Cases**:
- Same title, different files → Keep both
- Same files, different title → Merge if 90%+ similarity
- Same task in multiple plans → Merge once

### Structured Execution Notes

**Categories & Severity**:
- `WARNING` (High): Security risks, potential issues
- `DECISION` (Medium): Architectural choices
- `API_CHANGE` (Critical): Breaking changes
- `FILE_CONFLICT` (High): Multi-task file modifications
- `DEPENDENCY` (Medium): Package/module changes
- `PATTERN` (Low): Coding patterns established

**Note Filtering**:
- File overlap: Show notes affecting task.files_to_modify
- Always show: Critical severity (regardless of files)

### Auto-Commit

**Conventional Commit Format**:
- Structure: `type(scope): subject`
- Types: feat, fix, refactor, test, docs
- Scope: Inferred from file paths (frontend, backend, ui, api, auth)
- Footer: Task-ID, Plan source

**Safety**:
- Never commit on task failure
- Never skip hooks (no --no-verify)
- Use heredoc for commit messages (avoid shell injection)

