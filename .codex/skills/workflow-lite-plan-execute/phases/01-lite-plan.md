# Phase 1: Lite Plan

## Overview

Intelligent lightweight planning command with dynamic workflow adaptation based on task complexity. Focuses on planning phases (exploration, clarification, planning, confirmation) and delegates execution to Phase 2: Lite Execute (phases/02-lite-execute.md).

**Core capabilities:**
- Intelligent task analysis with automatic exploration detection
- Dynamic code exploration (cli-explore-agent) when codebase understanding needed
- Interactive clarification after exploration to gather missing information
- Adaptive planning: Low complexity → Direct Claude; Medium/High → cli-lite-planning-agent
- Two-step confirmation: plan display → multi-dimensional input collection
- Execution handoff with complete context to lite-execute

## Parameters

| Parameter | Description |
|-----------|-------------|
| `-y`, `--yes` | Skip all confirmations (auto mode) |
| `-e`, `--explore` | Force code exploration phase (overrides auto-detection) |
| `<task-description>` | Task description or path to .md file (required) |

## Output Artifacts

| Artifact | Description |
|----------|-------------|
| `exploration-{angle}.json` | Per-angle exploration results (1-4 files based on complexity) |
| `explorations-manifest.json` | Index of all exploration files |
| `exploration-notes.md` | Full exploration log (consumed by Plan phase, 6 sections) |
| `exploration-notes-refined.md` | Refined exploration log (consumed by Execute phase, task-relevant only) |
| `planning-context.md` | Evidence paths + synthesized understanding |
| `plan.json` | Structured implementation plan (plan-json-schema.json) |

**Output Directory**: `.workflow/.lite-plan/{task-slug}-{YYYY-MM-DD}/`

**Agent Usage**:
- Low complexity → Direct Claude planning (no agent)
- Medium/High complexity → `cli-lite-planning-agent` generates `plan.json`

**Schema Reference**: `~/.ccw/workflows/cli-templates/schemas/plan-json-schema.json`

## Auto Mode Defaults

When `--yes` or `-y` flag is used:
- **Clarification Questions**: Skipped (no clarification phase)
- **Plan Confirmation**: Auto-selected "Allow"
- **Execution Method**: Auto-selected "Auto"
- **Code Review**: Auto-selected "Skip"

**Flag Parsing**:
```javascript
const autoYes = $ARGUMENTS.includes('--yes') || $ARGUMENTS.includes('-y')
const forceExplore = $ARGUMENTS.includes('--explore') || $ARGUMENTS.includes('-e')
```

## Execution Process

```
Phase 1: Task Analysis & Exploration
   ├─ Parse input (description or .md file)
   ├─ Intelligent complexity assessment (Low/Medium/High)
   ├─ Exploration decision (auto-detect or --explore flag)
   ├─ Context protection: If file reading ≥50k chars → force cli-explore-agent
   └─ Decision:
      ├─ needsExploration=true → Launch parallel cli-explore-agents (1-4 based on complexity)
      └─ needsExploration=false → Skip to Phase 2/3

Phase 2: Clarification (optional, multi-round)
   ├─ Aggregate clarification_needs from all exploration angles
   ├─ Deduplicate similar questions
   └─ Decision:
      ├─ Has clarifications → ASK_USER (max 4 questions per round, multiple rounds allowed)
      └─ No clarifications → Skip to Phase 3

Phase 3: Planning (NO CODE EXECUTION - planning only)
   └─ Decision (based on Phase 1 complexity):
      ├─ Low → Load schema: cat ~/.ccw/workflows/cli-templates/schemas/plan-json-schema.json → Direct Claude planning (following schema) → plan.json
      └─ Medium/High → cli-lite-planning-agent → plan.json (agent internally executes quality check)

Phase 4: Confirmation & Selection
   ├─ Display plan summary (tasks, complexity, estimated time)
   └─ ASK_USER:
      ├─ Confirm: Allow / Modify / Cancel
      ├─ Execution: Agent / Codex / Auto
      └─ Review: Gemini / Agent / Skip

Phase 5: Execute
   ├─ Build executionContext (plan + explorations + clarifications + selections)
   └─ → Hand off to Phase 2: Lite Execute (phases/02-lite-execute.md) --in-memory
```

## Implementation

### Phase 1: Intelligent Multi-Angle Exploration

#### Session Setup (MANDATORY)

Generate session ID and create session folder:

- **Session ID format**: `{task-slug}-{YYYY-MM-DD}`
  - `task-slug`: lowercase task description, non-alphanumeric replaced with `-`, max 40 chars
  - Date: UTC+8 (China Standard Time), format `2025-11-29`
  - Example: `implement-jwt-refresh-2025-11-29`
- **Session Folder**: `.workflow/.lite-plan/{session-id}/`
- Create folder via `mkdir -p` and verify existence

#### Exploration Decision

Exploration is needed when **ANY** of these conditions are met:

- `--explore` / `-e` flag is set
- Task mentions specific files
- Task requires codebase context understanding
- Task needs architecture understanding
- Task modifies existing code

If none apply → skip to Phase 2 (Clarification) or Phase 3 (Planning).

**⚠️ Context Protection**: If file reading would exceed ≥50k chars → force exploration (delegate to cli-explore-agent).

#### Complexity Assessment

Analyze task complexity based on four dimensions:

| Dimension | Low | Medium | High |
|-----------|-----|--------|------|
| **Scope** | Single file, isolated | Multiple files, some dependencies | Cross-module, architectural |
| **Depth** | Surface change | Moderate structural impact | Architectural impact |
| **Risk** | Minimal | Moderate | High risk of breaking |
| **Dependencies** | None | Some interconnection | Highly interconnected |

#### Exploration Angle Selection

Angles are assigned based on task type keyword matching, then sliced by complexity:

| Task Type | Keywords | Angle Presets (priority order) |
|-----------|----------|-------------------------------|
| Architecture | refactor, architect, restructure, modular | architecture, dependencies, modularity, integration-points |
| Security | security, auth, permission, access | security, auth-patterns, dataflow, validation |
| Performance | performance, slow, optimi, cache | performance, bottlenecks, caching, data-access |
| Bugfix | fix, bug, error, issue, broken | error-handling, dataflow, state-management, edge-cases |
| Feature (default) | — | patterns, integration-points, testing, dependencies |

**Angle count by complexity**: Low → 1, Medium → 3, High → 4

**Planning strategy**: Low → "Direct Claude Planning", Medium/High → "cli-lite-planning-agent"

Display exploration plan summary (complexity, selected angles, planning strategy) before launching agents.

#### Launch Parallel Explorations

**⚠️ CRITICAL — SYNCHRONOUS EXECUTION**: Exploration results are REQUIRED before planning. Use `spawn_agent` + `wait` pattern.

**Orchestration Flow**:

```
1. Spawn agents
   └─ For each selected angle → create cli-explore-agent with Agent Prompt (below)

2. Batch wait
   └─ Wait for ALL agents (timeout: 10 minutes)

3. Handle timeout
   └─ If partial timeout → log warning, continue with completed results

4. Collect results
   └─ For each completed agent → store exploration data keyed by angle

5. Close agents
   └─ Close ALL exploration agents after collection
```

**Agent Prompt Template** (per angle):

```
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

## Task Objective
Execute **{angle}** exploration for task planning context. Analyze codebase from this specific angle to discover relevant structure, patterns, and constraints.

## Output Location

**Session Folder**: {sessionFolder}
**Output File**: {sessionFolder}/exploration-{angle}.json

## Assigned Context
- **Exploration Angle**: {angle}
- **Task Description**: {task_description}
- **Exploration Index**: {index} of {total}

## MANDATORY STEPS (Execute by Agent)
**You (cli-explore-agent) MUST execute these steps in order:**
1. Run: ccw tool exec get_modules_by_depth '{}' (project structure)
2. Run: rg -l "{keyword_from_task}" --type ts (locate relevant files)
3. Execute: cat ~/.ccw/workflows/cli-templates/schemas/explore-json-schema.json (get output schema reference)
4. Read: .workflow/project-tech.json (technology stack and architecture context)
5. Read: .workflow/project-guidelines.json (user-defined constraints and conventions)

## Exploration Strategy ({angle} focus)

**Step 1: Structural Scan** (Bash)
- get_modules_by_depth.sh → identify modules related to {angle}
- find/rg → locate files relevant to {angle} aspect
- Analyze imports/dependencies from {angle} perspective

**Step 2: Semantic Analysis** (Gemini CLI)
- How does existing code handle {angle} concerns?
- What patterns are used for {angle}?
- Where would new code integrate from {angle} viewpoint?

**Step 3: Write Output**
- Consolidate {angle} findings into JSON
- Identify {angle}-specific clarification needs

## Expected Output

**Schema Reference**: Schema obtained in MANDATORY FIRST STEPS step 3, follow schema exactly

**Required Fields** (all {angle} focused):
- project_structure: Modules/architecture relevant to {angle}
- relevant_files: Files affected from {angle} perspective
  **IMPORTANT**: Use object format with relevance scores for synthesis:
  `[{path: "src/file.ts", relevance: 0.85, rationale: "Core {angle} logic"}]`
  Scores: 0.7+ high priority, 0.5-0.7 medium, <0.5 low
- patterns: {angle}-related patterns to follow
- dependencies: Dependencies relevant to {angle}
- integration_points: Where to integrate from {angle} viewpoint (include file:line locations)
- constraints: {angle}-specific limitations/conventions
- clarification_needs: {angle}-related ambiguities (options array + recommended index)
- _metadata.exploration_angle: "{angle}"

## Success Criteria
- [ ] Schema obtained via cat explore-json-schema.json
- [ ] get_modules_by_depth.sh executed
- [ ] At least 3 relevant files identified with {angle} rationale
- [ ] Patterns are actionable (code examples, not generic advice)
- [ ] Integration points include file:line locations
- [ ] Constraints are project-specific to {angle}
- [ ] JSON output follows schema exactly
- [ ] clarification_needs includes options + recommended

## Execution
**Write**: `{sessionFolder}/exploration-{angle}.json`
**Return**: 2-3 sentence summary of {angle} findings
```

#### Auto-discover & Manifest Generation

After explorations complete:

1. **Discover** — Find all `exploration-*.json` files in session folder
2. **Read metadata** — Extract `_metadata.exploration_angle` and `_metadata.exploration_index` from each file
3. **Build manifest** — Create `explorations-manifest.json` containing:
   - `session_id`, `task_description`, `timestamp`, `complexity`, `exploration_count`
   - `explorations[]`: array of `{ angle, file, path, index }` per exploration
4. **Write** — Save manifest to `{sessionFolder}/explorations-manifest.json`
5. **Display** — Summary of generated files and explored angles

**Output**:
- `{sessionFolder}/exploration-{angle1}.json`
- `{sessionFolder}/exploration-{angle2}.json`
- ... (1-4 files based on complexity)
- `{sessionFolder}/explorations-manifest.json`

#### Generate Exploration Notes

Auto-generated after exploration completes.

**Steps**:

1. **Load** all exploration JSON files via manifest
2. **Extract core files** — Filter `relevant_files` with relevance ≥ 0.7, sort by relevance descending, deduplicate by path
3. **Build exploration notes** — 6-part Markdown document (structure below)
4. **Write** to `{sessionFolder}/exploration-notes.md`

**Exploration Notes Structure** (`exploration-notes.md`):

```markdown
# Exploration Notes: {task_description}

**Generated**: {timestamp}  |  **Complexity**: {complexity}
**Exploration Angles**: {angles}

---

## Part 1: Multi-Angle Exploration Summary
Per angle: Key Files (priority sorted), Code Patterns, Integration Points, Dependencies, Constraints

## Part 2: File Deep-Dive Summary
Top 10 core files: read content, find cross-references via rg, format structural details

## Part 3: Architecture Reasoning Chains
Synthesized from exploration findings and task description

## Part 4: Potential Risks and Mitigations
Derived from explorations and core file analysis

## Part 5: Clarification Questions Summary
Aggregated from all exploration angles

## Part 6: Execution Recommendations Checklist
Generated from task description, explorations, and core files

---

## Appendix: Key Code Location Index

| Component | File Path | Key Lines | Purpose |
```

**Output**: `{sessionFolder}/exploration-notes.md` (full version, consumed by Plan phase)

---

### Phase 2: Clarification (Optional, Multi-Round)

**Skip Conditions**: No exploration performed OR `clarification_needs` empty across all explorations

**⚠️ CRITICAL**: ASK_USER limits max 4 questions per call. **MUST execute multiple rounds** to exhaust all clarification needs — do NOT stop at round 1.

**Flow**:

```
1. Load manifest + all exploration files

2. Aggregate clarification_needs
   └─ For each exploration → collect needs, tag each with source_angle

3. Deduplicate
   └─ Intelligent merge: identify similar intent across angles
      → combine options, consolidate context
      → produce unique-intent questions only

4. Route by mode:
   ├─ --yes mode → Skip all clarifications, log count, proceed to Phase 3
   └─ Interactive mode → Multi-round clarification:
      ├─ Batch size: 4 questions per round
      ├─ Per round: display "Round N/M", present via ASK_USER
      │   └─ Each question: [source_angle] question + context
      │      Options with recommended marked ★
      ├─ Store responses in clarificationContext after each round
      └─ Repeat until all questions exhausted
```

**Output**: `clarificationContext` (in-memory, keyed by question)

---

### Phase 3: Planning

**IMPORTANT**: Phase 3 is **planning only** — NO code execution. All execution happens in Phase 5 via lite-execute.

#### Executor Assignment Rules

Applied after plan generation. Priority (high → low):

1. **User explicit** — If task description specifies tool (e.g., "用 gemini 分析...") → use that executor
2. **Default** → agent

Result: `executorAssignments` map — `{ taskId: { executor: 'gemini'|'codex'|'agent', reason: string } }`

#### Low Complexity — Direct Planning by Claude

1. **Read schema** — `cat ~/.ccw/workflows/cli-templates/schemas/plan-json-schema.json`
2. **Read ALL exploration files** (⚠️ MANDATORY) — Load manifest, read each exploration JSON, review findings
3. **Generate plan** following schema — Claude directly generates plan incorporating exploration insights

**plan.json structure** (Low complexity):
```javascript
{
  summary: "...",
  approach: "...",
  tasks: [...],  // Each: { id, title, scope, ..., depends_on, execution_group, complexity }
  estimated_time: "...",
  recommended_execution: "Agent",
  complexity: "Low",
  _metadata: { timestamp, source: "direct-planning", planning_mode: "direct" }
}
```

4. **Write** `{sessionFolder}/plan.json`
5. **Continue** to Phase 4 (Confirmation) — DO NOT execute code here

#### Medium/High Complexity — Invoke cli-lite-planning-agent

**Orchestration**:

```
1. Spawn planning agent → with Agent Prompt (below)
2. Wait for completion → timeout: 15 minutes
3. Close agent → after completion
```

**Agent Prompt Template**:

```
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-lite-planning-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Generate implementation plan and write plan.json.

## Output Location

**Session Folder**: {sessionFolder}
**Output Files**:
- {sessionFolder}/planning-context.md (evidence + understanding)
- {sessionFolder}/plan.json (implementation plan)
- {sessionFolder}/exploration-notes-refined.md (refined exploration notes for Execute phase)

## Output Schema Reference
Execute: cat ~/.ccw/workflows/cli-templates/schemas/plan-json-schema.json (get schema reference before generating plan)

## Project Context (MANDATORY - Read Both Files)
1. Read: .workflow/project-tech.json (technology stack, architecture, key components)
2. Read: .workflow/project-guidelines.json (user-defined constraints and conventions)

**CRITICAL**: All generated tasks MUST comply with constraints in project-guidelines.json

## Task Description
{task_description}

## Multi-Angle Exploration Context

{For each exploration:
### Exploration: {angle} ({file})
Path: {path}

Read this file for detailed {angle} analysis.
}

Total explorations: {count}
Angles covered: {angles}

Manifest: {sessionFolder}/explorations-manifest.json

## User Clarifications
{clarificationContext or "None"}

## Complexity Level
{complexity}

## Requirements
Generate plan.json following the schema obtained above. Key constraints:
- tasks: 2-7 structured tasks (**group by feature/module, NOT by file**)
- _metadata.exploration_angles: {angles}

## Task Grouping Rules
1. **Group by feature**: All changes for one feature = one task (even if 3-5 files)
2. **Group by context**: Tasks with similar context or related functional changes can be grouped together
3. **Minimize agent count**: Simple, unrelated tasks can also be grouped to reduce agent execution overhead
4. **Avoid file-per-task**: Do NOT create separate tasks for each file
5. **Substantial tasks**: Each task should represent 15-60 minutes of work
6. **True dependencies only**: Only use depends_on when Task B cannot start without Task A's output
7. **Prefer parallel**: Most tasks should be independent (no depends_on)

## Execution
1. Read schema file (cat command above)
2. Execute CLI planning using Gemini (Qwen fallback)
3. Read ALL exploration files for comprehensive context
4. Synthesize findings and generate plan following schema
5. **Write**: `{sessionFolder}/planning-context.md` (evidence paths + understanding)
6. **Write**: `{sessionFolder}/plan.json`
7. Execute Phase 5 (Plan Quality Check) and Phase 6 (Refine Exploration Notes) per agent role definition
8. **Write**: `{sessionFolder}/exploration-notes-refined.md` (Phase 6 output)
9. Return brief completion summary
```

**Output**: `{sessionFolder}/plan.json` + `{sessionFolder}/exploration-notes-refined.md`

> **Note**: `exploration-notes-refined.md` is generated by cli-lite-planning-agent (Phase 6) as part of its execution flow. See `~/.codex/agents/cli-lite-planning-agent.md` Phase 6 for structure and generation logic.

---

### Phase 4: Task Confirmation & Execution Selection

#### Step 4.1: Display Plan

Read `{sessionFolder}/plan.json` and display summary:

- **Summary**: plan.summary
- **Approach**: plan.approach
- **Tasks**: numbered list with title and file
- **Complexity**: plan.complexity
- **Estimated Time**: plan.estimated_time
- **Recommended**: plan.recommended_execution

#### Step 4.2: Collect Confirmation

**Route by mode**:

```
├─ --yes mode → Auto-confirm with defaults:
│   ├─ Confirmation: "Allow"
│   ├─ Execution: "Auto"
│   └─ Review: "Skip"
│
└─ Interactive mode → ASK_USER with 3 questions:
```

**Interactive Questions**:

| Question | Options | Default |
|----------|---------|---------|
| Confirm plan? ({N} tasks, {complexity}) | Allow (proceed as-is), Modify (adjust before execution), Cancel (abort workflow) | Allow |
| Execution method | Agent (@code-developer), Codex (codex CLI), Auto (Low→Agent, else→Codex) | Auto |
| Code review after execution? | Gemini Review, Codex Review (git-aware), Agent Review, Skip | Skip |

**Output**: `userSelection` — `{ confirmation, executionMethod, codeReviewTool }`

---

### Phase 5: Handoff to Execution

**CRITICAL**: lite-plan NEVER executes code directly. ALL execution MUST go through lite-execute.

#### Step 5.1: Build executionContext

Assemble the complete execution context from all planning phase outputs:

```javascript
{
  planObject: plan,                                    // From plan.json
  explorationsContext: { [angle]: explorationData },   // From exploration JSONs
  explorationAngles: ["angle1", "angle2", ...],        // From manifest
  explorationManifest: manifest,                       // Full manifest object
  clarificationContext: { [question]: answer } | null,
  userSelection: { confirmation, executionMethod, codeReviewTool },
  executionMethod: userSelection.executionMethod,      // Global default; may be overridden by executorAssignments
  codeReviewTool: userSelection.codeReviewTool,
  originalUserInput: task_description,

  // Task-level executor assignments (priority over global executionMethod)
  executorAssignments: { [taskId]: { executor, reason } },

  session: {
    id: sessionId,
    folder: sessionFolder,
    artifacts: {
      explorations: [{ angle, path }],                          // Per-angle exploration paths
      explorations_manifest: "{sessionFolder}/explorations-manifest.json",
      exploration_log: "{sessionFolder}/exploration-notes.md",            // Full version (Plan consumption)
      exploration_log_refined: "{sessionFolder}/exploration-notes-refined.md",  // Refined version (Execute consumption)
      plan: "{sessionFolder}/plan.json"
    }
  }
}
```

#### Step 5.2: Execute

→ Hand off to Phase 2: Lite Execute (`phases/02-lite-execute.md`) with `--in-memory` flag

## Session Folder Structure

```
.workflow/.lite-plan/{task-slug}-{YYYY-MM-DD}/
├── exploration-{angle1}.json           # Exploration angle 1
├── exploration-{angle2}.json           # Exploration angle 2
├── exploration-{angle3}.json           # Exploration angle 3 (if applicable)
├── exploration-{angle4}.json           # Exploration angle 4 (if applicable)
├── explorations-manifest.json          # Exploration index
├── exploration-notes.md                # Full exploration notes (Plan phase consumption)
├── exploration-notes-refined.md        # Refined exploration notes (Execute phase consumption)
└── plan.json                           # Implementation plan
```

**Example**:
```
.workflow/.lite-plan/implement-jwt-refresh-2025-11-25-14-30-25/
├── exploration-architecture.json
├── exploration-auth-patterns.json
├── exploration-security.json
├── explorations-manifest.json
└── plan.json
```

## Error Handling

| Error | Resolution |
|-------|------------|
| Exploration agent failure | Skip exploration, continue with task description only |
| Planning agent failure | Fallback to direct planning by Claude |
| Clarification timeout | Use exploration findings as-is |
| Confirmation timeout | Save context, display resume instructions |
| Modify loop > 3 times | Suggest breaking task or using full planning workflow (workflow-plan-execute/SKILL.md) |

---

## Post-Phase Update

After Phase 1 (Lite Plan) completes:
- **Output Created**: `executionContext` with plan.json, explorations, clarifications, user selections
- **Session Artifacts**: All files in `.workflow/.lite-plan/{session-id}/`
- **Next Action**: Auto-continue to [Phase 2: Lite Execute](02-lite-execute.md) with --in-memory
- **TodoWrite**: Mark "Lite Plan - Planning" as completed, start "Execution (Phase 2)"
