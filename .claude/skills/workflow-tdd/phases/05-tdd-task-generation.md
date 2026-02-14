# Phase 5: TDD Task Generation

Generate TDD tasks with Red-Green-Refactor cycles via action-planning-agent.

## Objective

- Generate IMPL_PLAN.md, task JSONs, and TODO_LIST.md with TDD structure
- Each task contains internal Red-Green-Refactor cycle
- Include Phase 0 user configuration (execution method, CLI tool preference)

## Execution

### Step 5.1: Execute TDD Task Generation

```javascript
Skill(skill="workflow:tools:task-generate-tdd", args="--session [sessionId]")
```

**Note**: Phase 0 now includes:
- Supplementary materials collection (file paths or inline content)
- Execution method preference (Agent/Hybrid/CLI)
- CLI tool preference (Codex/Gemini/Qwen/Auto)
- These preferences are passed to agent for task generation

**CLI Tool Selection**: CLI tool usage is determined semantically from user's task description. Include "use Codex/Gemini/Qwen" in your request for CLI execution.

### Step 5.2: Parse Output

Extract: feature count, task count, CLI execution IDs assigned

### Step 5.3: Validate Outputs

- `plan.json` exists (structured plan overview with `_metadata.plan_type: "tdd"`)
- `IMPL_PLAN.md` exists (unified plan with TDD Implementation Tasks section)
- `IMPL-*.json` files exist (one per feature, or container + subtasks for complex features)
- `TODO_LIST.md` exists with internal TDD phase indicators
- Each IMPL task includes:
  - `meta.tdd_workflow: true`
  - `cli_execution.id: {session_id}-{task_id}`
  - `cli_execution: { "strategy": "new|resume|fork|merge_fork", ... }`
  - `implementation` with exactly 3 steps (red/green/refactor)
  - Green phase includes test-fix-cycle configuration
  - `focus_paths`: absolute or clear relative paths (enhanced with exploration critical_files)
  - `pre_analysis`: includes exploration integration_points analysis
- `IMPL_PLAN.md` contains `workflow_type: "tdd"` in frontmatter
- User configuration applied:
  - If executionMethod == "cli" or "hybrid": command field added to steps
  - CLI tool preference reflected in execution guidance
- Task count ≤18 (compliance with hard limit)

### Red Flag Detection (Non-Blocking Warnings)

- Task count >18: `⚠️ Task count exceeds hard limit - request re-scope`
- Missing cli_execution.id: `⚠️ Task lacks CLI execution ID for resume support`
- Missing test-fix-cycle: `⚠️ Green phase lacks auto-revert configuration`
- Generic task names: `⚠️ Vague task names suggest unclear TDD cycles`
- Missing focus_paths: `⚠️ Task lacks clear file scope for implementation`

**Action**: Log warnings to `.workflow/active/[sessionId]/.process/tdd-warnings.log` (non-blocking)

### TodoWrite Update (Phase 5 Skill executed - tasks attached)

```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Phase 2: Context Gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Phase 3: Test Coverage Analysis", "status": "completed", "activeForm": "Executing test coverage analysis"},
  {"content": "Phase 5: TDD Task Generation", "status": "in_progress", "activeForm": "Executing TDD task generation"},
  {"content": "  → Discovery - analyze TDD requirements", "status": "in_progress", "activeForm": "Analyzing TDD requirements"},
  {"content": "  → Planning - design Red-Green-Refactor cycles", "status": "pending", "activeForm": "Designing TDD cycles"},
  {"content": "  → Output - generate IMPL tasks with internal TDD phases", "status": "pending", "activeForm": "Generating TDD tasks"},
  {"content": "Phase 6: TDD Structure Validation", "status": "pending", "activeForm": "Validating TDD structure"}
]
```

**Note**: Skill execute **attaches** task-generate-tdd's 3 tasks. Orchestrator **executes** these tasks. Each generated IMPL task will contain internal Red-Green-Refactor cycle.

**Next Action**: Tasks attached → **Execute Phase 5.1-5.3** sequentially

### TodoWrite Update (Phase 5 completed - tasks collapsed)

```json
[
  {"content": "Phase 1: Session Discovery", "status": "completed", "activeForm": "Executing session discovery"},
  {"content": "Phase 2: Context Gathering", "status": "completed", "activeForm": "Executing context gathering"},
  {"content": "Phase 3: Test Coverage Analysis", "status": "completed", "activeForm": "Executing test coverage analysis"},
  {"content": "Phase 5: TDD Task Generation", "status": "completed", "activeForm": "Executing TDD task generation"},
  {"content": "Phase 6: TDD Structure Validation", "status": "in_progress", "activeForm": "Validating TDD structure"}
]
```

**Note**: Phase 5 tasks completed and collapsed to summary. Each generated IMPL task contains complete Red-Green-Refactor cycle internally.

## Output

- **File**: `plan.json` (structured plan overview)
- **File**: `IMPL_PLAN.md` (unified plan with TDD Implementation Tasks section)
- **File**: `IMPL-*.json` (task JSONs with internal TDD cycles)
- **File**: `TODO_LIST.md` (task list with TDD phase indicators)
- **File**: `.process/tdd-warnings.log` (non-blocking warnings)
- **TodoWrite**: Mark Phase 5 completed, Phase 6 in_progress

## Next Phase

Return to orchestrator, then auto-continue to [Phase 6: TDD Structure Validation](06-tdd-structure-validation.md).
