# Skill Router Template

Template for the generated SKILL.md with role-based routing (v3 style).

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand generated SKILL.md structure |
| Phase 3 | Apply with team-specific content |

## Style Rules

Generated output follows v3 conventions:

| Rule | Description |
|------|-------------|
| No pseudocode | Flow uses text + decision tables + flow symbols |
| Code blocks = tool calls only | Only Task(), TaskCreate(), Bash(), Read() etc. |
| `<placeholder>` in output | Not `${variable}` or `{{handlebars}}` in generated content |
| Decision tables | All branching logic uses `| Condition | Action |` tables |
| Cadence Control | Beat diagram + checkpoint definitions |
| Compact Protection | Phase Reference with Compact column |

> **Note**: The template itself uses `{{handlebars}}` for variable substitution during Phase 3 generation. The **generated output** must not contain `{{handlebars}}` or JS pseudocode.

---

## Template

```markdown
---
name: team-{{team_name}}
description: Unified team skill for {{team_name}}. All roles invoke this skill with --role arg for role-specific execution. Triggers on "team {{team_name}}".
allowed-tools: {{all_roles_tools_union}}
---

# Team {{team_display_name}}

Unified team skill: {{team_purpose}}. All team members invoke with `--role=xxx` to route to role-specific execution.

## Architecture

\`\`\`
{{architecture_diagram}}
\`\`\`

## Role Router

### Input Parsing

Parse `$ARGUMENTS` to extract `--role`. If absent -> Orchestration Mode (auto route to coordinator).

### Role Registry

| Role | File | Task Prefix | Type | Compact |
|------|------|-------------|------|---------|
{{#each roles}}
| {{this.name}} | [roles/{{this.name}}/role.md](roles/{{this.name}}/role.md) | {{this.task_prefix}}-* | {{this.type}} | Compress after must re-read |
{{/each}}

> **COMPACT PROTECTION**: Role files are execution documents, not reference material. When context compression occurs and role instructions are reduced to summaries, **you MUST immediately `Read` the corresponding role.md to reload before continuing execution**. Do not execute any Phase based on summaries.

### Dispatch

1. Extract `--role` from arguments
2. If no `--role` -> route to coordinator (Orchestration Mode)
3. Look up role in registry -> Read the role file -> Execute its phases

### Orchestration Mode

When invoked without `--role`, coordinator auto-starts. User just provides task description.

**Invocation**: `Skill(skill="team-{{team_name}}", args="<task-description>")`

**Lifecycle**:
\`\`\`
User provides task description
  -> coordinator Phase 1-3: Requirement clarification -> TeamCreate -> Create task chain
  -> coordinator Phase 4: spawn first batch workers (background) -> STOP
  -> Worker executes -> SendMessage callback -> coordinator advances next step
  -> Loop until pipeline complete -> Phase 5 report
\`\`\`

**User Commands** (wake paused coordinator):

| Command | Action |
|---------|--------|
| `check` / `status` | Output execution status graph, no advancement |
| `resume` / `continue` | Check worker states, advance next step |

---

## Shared Infrastructure

The following templates apply to all worker roles. Each role.md only needs to write **Phase 2-4** role-specific logic.

### Worker Phase 1: Task Discovery (shared by all workers)

Every worker executes the same task discovery flow on startup:

1. Call `TaskList()` to get all tasks
2. Filter: subject matches this role's prefix + owner is this role + status is pending + blockedBy is empty
3. No tasks -> idle wait
4. Has tasks -> `TaskGet` for details -> `TaskUpdate` mark in_progress

**Resume Artifact Check** (prevent duplicate output after resume):
- Check whether this task's output artifact already exists
- Artifact complete -> skip to Phase 5 report completion
- Artifact incomplete or missing -> normal Phase 2-4 execution

### Worker Phase 5: Report (shared by all workers)

Standard reporting flow after task completion:

1. **Message Bus**: Call `mcp__ccw-tools__team_msg` to log message
   - Parameters: operation="log", team=<team-name>, from=<role>, to="coordinator", type=<message-type>, summary="[<role>] <summary>", ref=<artifact-path>
   - **CLI fallback**: When MCP unavailable -> `ccw team log --team <team> --from <role> --to coordinator --type <type> --summary "[<role>] ..." --json`
2. **SendMessage**: Send result to coordinator (content and summary both prefixed with `[<role>]`)
3. **TaskUpdate**: Mark task completed
4. **Loop**: Return to Phase 1 to check next task

### Wisdom Accumulation (all roles)

Cross-task knowledge accumulation. Coordinator creates `wisdom/` directory at session initialization.

**Directory**:
\`\`\`
<session-folder>/wisdom/
+-- learnings.md      # Patterns and insights
+-- decisions.md      # Architecture and design decisions
+-- conventions.md    # Codebase conventions
+-- issues.md         # Known risks and issues
\`\`\`

**Worker Load** (Phase 2): Extract `Session: <path>` from task description, read wisdom directory files.
**Worker Contribute** (Phase 4/5): Write this task's discoveries to corresponding wisdom files.

### Role Isolation Rules

| Allowed | Forbidden |
|---------|-----------|
| Process tasks with own prefix | Process tasks with other role prefixes |
| SendMessage to coordinator | Communicate directly with other workers |
| Use tools declared in Toolbox | Create tasks for other roles |
| Delegate to commands/ files | Modify resources outside own responsibility |

Coordinator additional restrictions: Do not write/modify code directly, do not call implementation subagents, do not execute analysis/test/review directly.

---

## Pipeline Definitions

### Pipeline Diagram

\`\`\`
{{pipeline_diagram}}
\`\`\`

### Cadence Control

**Beat model**: Event-driven, each beat = coordinator wake -> process -> spawn -> STOP.

\`\`\`
Beat Cycle (single beat)
========================================================
  Event                   Coordinator              Workers
--------------------------------------------------------
  callback/resume --> +- handleCallback -+
                      |  mark completed   |
                      |  check pipeline   |
                      +- handleSpawnNext -+
                      |  find ready tasks |
                      |  spawn workers ---+--> [Worker A] Phase 1-5
                      |  (parallel OK)  --+--> [Worker B] Phase 1-5
                      +- STOP (idle) -----+         |
                                                     |
  callback <-----------------------------------------+
  (next beat)              SendMessage + TaskUpdate(completed)
========================================================
\`\`\`

{{cadence_beat_view}}

**Checkpoints**:

{{checkpoint_table}}

**Stall Detection** (coordinator `handleCheck` executes):

| Check | Condition | Resolution |
|-------|-----------|------------|
| Worker no response | in_progress task no callback | Report waiting task list, suggest user `resume` |
| Pipeline deadlock | no ready + no running + has pending | Check blockedBy dependency chain, report blocking point |
{{#if has_gc_loop}}
| GC loop exceeded | iteration > max_rounds | Terminate loop, output latest report |
{{/if}}

### Task Metadata Registry

| Task ID | Role | Phase | Dependencies | Description |
|---------|------|-------|-------------|-------------|
{{#each task_metadata}}
| {{this.task_id}} | {{this.role}} | {{this.phase}} | {{this.dependencies}} | {{this.description}} |
{{/each}}

## Coordinator Spawn Template

When coordinator spawns workers, use background mode (Spawn-and-Stop):

\`\`\`
Task({
  subagent_type: "general-purpose",
  description: "Spawn <role> worker",
  team_name: <team-name>,
  name: "<role>",
  run_in_background: true,
  prompt: `You are team "<team-name>" <ROLE>.

## Primary Directive
All your work must be executed through Skill to load role definition:
Skill(skill="team-{{team_name}}", args="--role=<role>")

Current requirement: <task-description>
Session: <session-folder>

## Role Guidelines
- Only process <PREFIX>-* tasks, do not execute other role work
- All output prefixed with [<role>] identifier
- Only communicate with coordinator
- Do not use TaskCreate for other roles
- Call mcp__ccw-tools__team_msg before every SendMessage

## Workflow
1. Call Skill -> load role definition and execution logic
2. Follow role.md 5-Phase flow
3. team_msg + SendMessage results to coordinator
4. TaskUpdate completed -> check next task`
})
\`\`\`

{{#if has_parallel_spawn}}
### Parallel Spawn (N agents for same role)

> When pipeline has parallel tasks assigned to the same role, spawn N distinct agents with unique names. A single agent can only process tasks serially.

**Parallel detection**:

| Condition | Action |
|-----------|--------|
| N parallel tasks for same role prefix | Spawn N agents named `<role>-1`, `<role>-2` ... |
| Single task for role | Standard spawn (single agent) |

**Parallel spawn template**:

\`\`\`
Task({
  subagent_type: "general-purpose",
  description: "Spawn <role>-<N> worker",
  team_name: <team-name>,
  name: "<role>-<N>",
  run_in_background: true,
  prompt: `You are team "<team-name>" <ROLE> (<role>-<N>).
Your agent name is "<role>-<N>", use this name for task discovery owner matching.

## Primary Directive
Skill(skill="team-{{team_name}}", args="--role=<role> --agent-name=<role>-<N>")

## Role Guidelines
- Only process tasks where owner === "<role>-<N>" with <PREFIX>-* prefix
- All output prefixed with [<role>] identifier

## Workflow
1. TaskList -> find tasks where owner === "<role>-<N>" with <PREFIX>-* prefix
2. Skill -> execute role definition
3. team_msg + SendMessage results to coordinator
4. TaskUpdate completed -> check next task`
})
\`\`\`

**Dispatch must match agent names**: In dispatch, parallel tasks use instance-specific owner: `<role>-<N>`. In role.md, task discovery uses --agent-name for owner matching.
{{/if}}

## Session Directory

\`\`\`
{{session_directory_tree}}
\`\`\`

{{#if has_session_resume}}
## Session Resume

Coordinator supports `--resume` / `--continue` for interrupted sessions:

1. Scan session directory for sessions with status "active" or "paused"
2. Multiple matches -> AskUserQuestion for selection
3. Audit TaskList -> reconcile session state <-> task status
4. Reset in_progress -> pending (interrupted tasks)
5. Rebuild team and spawn needed workers only
6. Create missing tasks with correct blockedBy
7. Kick first executable task -> Phase 4 coordination loop
{{/if}}

{{#if shared_resources}}
## Shared Resources

| Resource | Path | Usage |
|----------|------|-------|
{{#each shared_resources}}
| {{this.name}} | [{{this.path}}]({{this.path}}) | {{this.usage}} |
{{/each}}
{{/if}}

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown --role value | Error with available role list |
| Missing --role arg | Orchestration Mode -> auto route to coordinator |
| Role file not found | Error with expected path (roles/<name>/role.md) |
| Command file not found | Fallback to inline execution in role.md |
{{#each additional_error_handlers}}
| {{this.scenario}} | {{this.resolution}} |
{{/each}}
```

---

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `{{team_name}}` | config.team_name | Team identifier (lowercase) |
| `{{team_display_name}}` | config.team_display_name | Human-readable team name |
| `{{team_purpose}}` | config.team_purpose | One-line team purpose |
| `{{all_roles_tools_union}}` | Union of all roles' allowed-tools | Combined tool list |
| `{{roles}}` | config.roles[] | Array of role definitions |
| `{{architecture_diagram}}` | Generated from role structure | ASCII architecture diagram |
| `{{pipeline_diagram}}` | Generated from task chain | ASCII pipeline diagram |
| `{{cadence_beat_view}}` | Generated from pipeline | Pipeline beat view diagram |
| `{{checkpoint_table}}` | Generated from pipeline | Checkpoint trigger/location/behavior table |
| `{{task_metadata}}` | Generated from pipeline | Task metadata registry entries |
| `{{session_directory_tree}}` | Generated from session structure | Session directory tree |
| `{{has_parallel_spawn}}` | config.has_parallel_spawn | Boolean: pipeline has parallel same-role tasks |
| `{{has_session_resume}}` | config.has_session_resume | Boolean: supports session resume |
| `{{has_gc_loop}}` | config.has_gc_loop | Boolean: has guard-and-correct loops |
| `{{shared_resources}}` | config.shared_resources | Array of shared resource definitions |
| `{{additional_error_handlers}}` | config.additional_error_handlers | Array of {scenario, resolution} |

## Key Differences from v1

| Aspect | v1 (old) | v2 (this template) |
|--------|----------|---------------------|
| Role lookup | `VALID_ROLES` JS object | Role Registry decision table with markdown links |
| Routing | JS regex + if/else | Text dispatch flow (3 steps) |
| Spawn template | JS code with `${variable}` | Text template with `<placeholder>` |
| Infrastructure | Inline JS per role | Shared Infrastructure section (Phase 1/5 templates) |
| Pipeline | ASCII only | Cadence Control + beat view + checkpoints |
| Compact safety | None | Compact Protection with re-read mandate |
| Orchestration Mode | JS if/else block | Decision table + lifecycle flow diagram |
