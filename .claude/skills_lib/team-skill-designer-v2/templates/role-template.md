# Role File Template

Template for generating per-role execution detail files in `roles/<role-name>/role.md` (v3 style).

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand role file structure |
| Phase 3 | Apply with role-specific content |

## Style Rules

Generated output follows v3 conventions:

| Rule | Description |
|------|-------------|
| Phase 1/5 shared | Reference "See SKILL.md Shared Infrastructure" instead of inline code |
| No JS pseudocode | Message Bus, Task Lifecycle all use text + tool call templates |
| Decision tables | All branching logic uses `| Condition | Action |` tables |
| Code blocks = tool calls only | Only actual executable calls (Read(), TaskList(), SendMessage(), etc.) |
| `<placeholder>` in output | Not `${variable}` in generated content |
| Phase 2-4 only | Role files define Phase 2-4 role-specific logic |

> **Note**: The template itself uses `{{handlebars}}` for variable substitution during Phase 3 generation. The **generated output** must not contain `{{handlebars}}` or JS pseudocode.

---

## Template

### Worker Role Template

```markdown
# {{display_name}} Role

{{role_description}}

## Identity

- **Name**: `{{role_name}}` | **Tag**: `[{{role_name}}]`
- **Task Prefix**: `{{task_prefix}}-*`
- **Responsibility**: {{responsibility_type}}

## Boundaries

### MUST
- Only process `{{task_prefix}}-*` prefixed tasks
- All output (SendMessage, team_msg, logs) must carry `[{{role_name}}]` identifier
- Only communicate with coordinator via SendMessage
- Work strictly within {{responsibility_type}} responsibility scope
{{#each must_rules}}
- {{this}}
{{/each}}

### MUST NOT
- Execute work outside this role's responsibility scope
- Communicate directly with other worker roles (must go through coordinator)
- Create tasks for other roles (TaskCreate is coordinator-exclusive)
- Modify files or resources outside this role's responsibility
- Omit `[{{role_name}}]` identifier in any output
{{#each must_not_rules}}
- {{this}}
{{/each}}

---

## Toolbox

### Available Commands

| Command | File | Phase | Description |
|---------|------|-------|-------------|
{{#each commands}}
| `{{this.name}}` | [commands/{{this.name}}.md](commands/{{this.name}}.md) | Phase {{this.phase}} | {{this.description}} |
{{/each}}

{{#if has_no_commands}}
> No command files -- all phases execute inline.
{{/if}}

### Tool Capabilities

| Tool | Type | Used By | Purpose |
|------|------|---------|---------|
{{#each tool_capabilities}}
| `{{this.tool}}` | {{this.type}} | {{this.used_by}} | {{this.purpose}} |
{{/each}}

---

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
{{#each message_types}}
| `{{this.type}}` | {{this.direction}} | {{this.trigger}} | {{this.description}} |
{{/each}}

## Message Bus

Before every SendMessage, log via `mcp__ccw-tools__team_msg`:

\`\`\`
mcp__ccw-tools__team_msg({
  operation: "log",
  team: <team-name>,
  from: "{{role_name}}",
  to: "coordinator",
  type: <message-type>,
  summary: "[{{role_name}}] <task-prefix> complete: <task-subject>",
  ref: <artifact-path>
})
\`\`\`

**CLI fallback** (when MCP unavailable):

\`\`\`
Bash("ccw team log --team <team-name> --from {{role_name}} --to coordinator --type <message-type> --summary \"[{{role_name}}] <task-prefix> complete\" --ref <artifact-path> --json")
\`\`\`

---

## Execution (5-Phase)

### Phase 1: Task Discovery

> See SKILL.md Shared Infrastructure -> Worker Phase 1: Task Discovery

Standard task discovery flow: TaskList -> filter by prefix `{{task_prefix}}-*` + owner match + pending + unblocked -> TaskGet -> TaskUpdate in_progress.

For parallel instances, parse `--agent-name` from arguments for owner matching. Falls back to `{{role_name}}` for single-instance roles.

### Phase 2: {{phase2_name}}

{{phase2_content}}

### Phase 3: {{phase3_name}}

{{phase3_content}}

### Phase 4: {{phase4_name}}

{{phase4_content}}

### Phase 5: Report to Coordinator

> See SKILL.md Shared Infrastructure -> Worker Phase 5: Report

Standard report flow: team_msg log -> SendMessage with `[{{role_name}}]` prefix -> TaskUpdate completed -> Loop to Phase 1 for next task.

---

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No {{task_prefix}}-* tasks available | Idle, wait for coordinator assignment |
| Context/Plan file not found | Notify coordinator, request location |
{{#if has_commands}}
| Command file not found | Fall back to inline execution |
{{/if}}
{{#each additional_error_handlers}}
| {{this.scenario}} | {{this.resolution}} |
{{/each}}
| Critical issue beyond scope | SendMessage fix_required to coordinator |
| Unexpected error | Log error via team_msg, report to coordinator |
```

---

### Coordinator Role Template

The coordinator role is special and always generated. Its template differs from worker roles:

```markdown
# Coordinator Role

Orchestrate the {{team_display_name}} workflow: team creation, task dispatching, progress monitoring, session state.

## Identity

- **Name**: `coordinator` | **Tag**: `[coordinator]`
- **Responsibility**: Parse requirements -> Create team -> Dispatch tasks -> Monitor progress -> Report results

## Boundaries

### MUST
- Parse user requirements and clarify ambiguous inputs via AskUserQuestion
- Create team and spawn worker subagents in background
- Dispatch tasks with proper dependency chains (see SKILL.md Task Metadata Registry)
- Monitor progress via worker callbacks and route messages
- Maintain session state persistence
{{#each coordinator_must_rules}}
- {{this}}
{{/each}}

### MUST NOT
- Execute {{team_purpose}} work directly (delegate to workers)
- Modify task outputs (workers own their deliverables)
- Call implementation subagents directly
- Skip dependency validation when creating task chains
{{#each coordinator_must_not_rules}}
- {{this}}
{{/each}}

> **Core principle**: coordinator is the orchestrator, not the executor. All actual work must be delegated to worker roles via TaskCreate.

---

## Entry Router

When coordinator is invoked, first detect the invocation type:

| Detection | Condition | Handler |
|-----------|-----------|---------|
| Worker callback | Message contains `[role-name]` tag from a known worker role | -> handleCallback: auto-advance pipeline |
| Status check | Arguments contain "check" or "status" | -> handleCheck: output execution graph, no advancement |
| Manual resume | Arguments contain "resume" or "continue" | -> handleResume: check worker states, advance pipeline |
| New session | None of the above | -> Phase 0 (Session Resume Check) |

For callback/check/resume: load `commands/monitor.md` and execute the appropriate handler, then STOP.

---

## Phase 0: Session Resume Check

**Objective**: Detect and resume interrupted sessions before creating new ones.

**Workflow**:
1. Scan session directory for sessions with status "active" or "paused"
2. No sessions found -> proceed to Phase 1
3. Single session found -> resume it (-> Session Reconciliation)
4. Multiple sessions -> AskUserQuestion for user selection

**Session Reconciliation**:
1. Audit TaskList -> get real status of all tasks
2. Reconcile: session state <-> TaskList status (bidirectional sync)
3. Reset any in_progress tasks -> pending (they were interrupted)
4. Determine remaining pipeline from reconciled state
5. Rebuild team if disbanded (TeamCreate + spawn needed workers only)
6. Create missing tasks with correct blockedBy dependencies
7. Verify dependency chain integrity
8. Update session file with reconciled state
9. Kick first executable task's worker -> Phase 4

---

## Phase 1: Requirement Clarification

**Objective**: Parse user input and gather execution parameters.

**Workflow**:

1. **Parse arguments** for explicit settings: mode, scope, focus areas
2. **Ask for missing parameters** via AskUserQuestion:

{{phase1_questions}}

3. **Store requirements**: mode, scope, focus, constraints

**Success**: All parameters captured, mode finalized.

---

## Phase 2: Create Team + Initialize Session

**Objective**: Initialize team, session file, and wisdom directory.

**Workflow**:
1. Generate session ID
2. Create session folder
3. Call TeamCreate with team name
4. Initialize wisdom directory (learnings.md, decisions.md, conventions.md, issues.md)
5. Write session file with: session_id, mode, scope, status="active"
6. Spawn worker roles (see SKILL.md Coordinator Spawn Template)

**Success**: Team created, session file written, wisdom initialized, workers spawned.

---

## Phase 3: Create Task Chain

**Objective**: Dispatch tasks based on mode with proper dependencies.

{{#if has_dispatch_command}}
Delegate to `commands/dispatch.md` which creates the full task chain:
1. Reads SKILL.md Task Metadata Registry for task definitions
2. Creates tasks via TaskCreate with correct blockedBy
3. Assigns owner based on role mapping
4. Includes `Session: <session-folder>` in every task description
{{else}}
{{phase3_dispatch_content}}
{{/if}}

---

## Phase 4: Spawn-and-Stop

**Objective**: Spawn first batch of ready workers in background, then STOP.

**Design**: Spawn-and-Stop + Callback pattern.
- Spawn workers with `Task(run_in_background: true)` -> immediately return
- Worker completes -> SendMessage callback -> auto-advance
- User can use "check" / "resume" to manually advance
- Coordinator does one operation per invocation, then STOPS

**Workflow**:
{{#if has_monitor_command}}
1. Load `commands/monitor.md`
{{/if}}
2. Find tasks with: status=pending, blockedBy all resolved, owner assigned
3. For each ready task -> spawn worker (see SKILL.md Spawn Template)
4. Output status summary
5. STOP

**Pipeline advancement** driven by three wake sources:
- Worker callback (automatic) -> Entry Router -> handleCallback
- User "check" -> handleCheck (status only)
- User "resume" -> handleResume (advance)

---

## Phase 5: Report + Next Steps

**Objective**: Completion report and follow-up options.

**Workflow**:
1. Load session state -> count completed tasks, duration
2. List deliverables with output paths
3. Update session status -> "completed"
4. Offer next steps to user

---

## Error Handling

| Error | Resolution |
|-------|------------|
| Task timeout | Log, mark failed, ask user to retry or skip |
| Worker crash | Respawn worker, reassign task |
| Dependency cycle | Detect, report to user, halt |
| Invalid mode | Reject with error, ask to clarify |
| Session corruption | Attempt recovery, fallback to manual reconciliation |
{{#each coordinator_error_handlers}}
| {{this.error}} | {{this.resolution}} |
{{/each}}
```

---

## Phase 2-4 Content by Responsibility Type

The following sections provide Phase 2-4 content templates based on `responsibility_type`. During Phase 3 generation, select the matching section and fill into `{{phase2_content}}`, `{{phase3_content}}`, `{{phase4_content}}`.

### Read-only Analysis

**Phase 2: Context Loading**

```
| Input | Source | Required |
|-------|--------|----------|
| Plan file | <session-folder>/plan/plan.json | Yes |
| Git diff | `git diff HEAD~1` or `git diff --cached` | Yes |
| Modified files | From git diff --name-only | Yes |
| Wisdom | <session-folder>/wisdom/ | No |

**Loading steps**:

1. Extract session path from task description
2. Read plan file for criteria reference
3. Get changed files list

\`\`\`
Bash("git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached")
\`\`\`

4. Read file contents for analysis (limit to 20 files)
5. Load wisdom files if available
```

**Phase 3: Analysis Execution**

```
Delegate to `commands/<analysis-command>.md` if available, otherwise execute inline.

Analysis strategy selection:

| Condition | Strategy |
|-----------|----------|
| Single dimension analysis | Direct inline scan |
| Multi-dimension analysis | Per-dimension sequential scan |
| Deep analysis needed | CLI Fan-out to external tool |

For each dimension, scan modified files for patterns. Record findings with severity levels.
```

**Phase 4: Finding Summary**

```
Classify findings by severity:

| Severity | Criteria |
|----------|----------|
| Critical | Must fix before merge |
| High | Should fix, may merge with tracking |
| Medium | Recommended improvement |
| Low | Informational, optional |

Generate structured report with file:line references and remediation suggestions.
```

### Code Generation

**Phase 2: Task & Plan Loading**

```
**Loading steps**:

1. Extract session path from task description
2. Read plan file -> extract task list and acceptance criteria
3. Read individual task files from `.task/` directory
4. Load wisdom files for conventions and patterns

Fail-safe: If plan file not found -> SendMessage to coordinator requesting location.
```

**Phase 3: Code Implementation**

```
Implementation strategy selection:

| Task Count | Complexity | Strategy |
|------------|------------|----------|
| <= 2 tasks | Low | Direct: inline Edit/Write |
| 3-5 tasks | Medium | Single agent: one code-developer for all |
| > 5 tasks | High | Batch agent: group by module, one agent per batch |

{{#if phase3_command}}
Delegate to `commands/{{phase3_command}}.md`.
{{else}}
Execute inline based on strategy selection above.
{{/if}}
```

**Phase 4: Self-Validation**

```
Validation checks:

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Syntax | `Bash("tsc --noEmit 2>&1 || true")` or equivalent | No errors |
| File existence | Verify all planned files exist | All files present |
| Import resolution | Check no broken imports | All imports resolve |

If validation fails -> attempt auto-fix (max 2 attempts) -> report remaining issues.
```

### Orchestration

**Phase 2: Context & Complexity Assessment**

```
Complexity assessment:

| Signal | Weight | Keywords |
|--------|--------|----------|
| Structural change | +2 | refactor, architect, restructure, module, system |
| Cross-cutting | +2 | multiple, across, cross |
| Integration | +1 | integrate, api, database |
| Non-functional | +1 | security, performance |

| Score | Complexity | Approach |
|-------|------------|----------|
| >= 4 | High | Multi-stage with sub-orchestration |
| 2-3 | Medium | Standard pipeline |
| 0-1 | Low | Simplified flow |
```

**Phase 3: Orchestrated Execution**

```
Launch execution based on complexity:

| Complexity | Execution Pattern |
|------------|-------------------|
| High | Parallel sub-agents + synchronization barriers |
| Medium | Sequential stages with dependency tracking |
| Low | Direct delegation to single worker |
```

**Phase 4: Result Aggregation**

```
Merge and summarize sub-agent results:

1. Collect all sub-agent outputs
2. Deduplicate findings across agents
3. Prioritize by severity/importance
4. Generate consolidated summary
```

### Validation

**Phase 2: Environment Detection**

```
**Detection steps**:

1. Get changed files from git diff
2. Detect test framework from project files

| Detection | Method |
|-----------|--------|
| Changed files | `Bash("git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached")` |
| Test command | Check package.json scripts, pytest.ini, Makefile |
| Coverage tool | Check for nyc, coverage.py, jest --coverage config |
```

**Phase 3: Execution & Fix Cycle**

```
Iterative test-fix cycle:

| Step | Action |
|------|--------|
| 1 | Run test command |
| 2 | Parse results -> check pass rate |
| 3 | Pass rate >= 95% -> exit loop (success) |
| 4 | Extract failing test details |
| 5 | Delegate fix to code-developer subagent |
| 6 | Increment iteration counter |
| 7 | iteration >= MAX (5) -> exit loop (report failures) |
| 8 | Go to Step 1 |
```

**Phase 4: Result Analysis**

```
Analyze test outcomes:

| Metric | Source | Threshold |
|--------|--------|-----------|
| Pass rate | Test output parser | >= 95% |
| Coverage | Coverage tool output | >= 80% |
| Flaky tests | Compare runs | 0 flaky |

Generate test report with: pass/fail counts, coverage data, failure details, fix attempts made.
```

---

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `{{role_name}}` | config.role_name | Role identifier |
| `{{display_name}}` | config.display_name | Human-readable role name |
| `{{task_prefix}}` | config.task_prefix | UPPERCASE task prefix |
| `{{responsibility_type}}` | config.responsibility_type | Role type (read-only analysis, code generation, orchestration, validation) |
| `{{role_description}}` | config.role_description | One-line role description |
| `{{phase2_name}}` | patterns.phase_structure.phase2 | Phase 2 label |
| `{{phase3_name}}` | patterns.phase_structure.phase3 | Phase 3 label |
| `{{phase4_name}}` | patterns.phase_structure.phase4 | Phase 4 label |
| `{{phase2_content}}` | Generated from responsibility template | Phase 2 text content |
| `{{phase3_content}}` | Generated from responsibility template | Phase 3 text content |
| `{{phase4_content}}` | Generated from responsibility template | Phase 4 text content |
| `{{message_types}}` | config.message_types | Array of message type definitions |
| `{{commands}}` | config.commands | Array of command definitions |
| `{{has_commands}}` | config.commands.length > 0 | Boolean: has extracted commands |
| `{{has_no_commands}}` | config.commands.length === 0 | Boolean: all phases inline |
| `{{tool_capabilities}}` | config.tool_capabilities | Array of tool/subagent/CLI capabilities |
| `{{must_rules}}` | config.must_rules | Additional MUST rules |
| `{{must_not_rules}}` | config.must_not_rules | Additional MUST NOT rules |
| `{{additional_error_handlers}}` | config.additional_error_handlers | Array of {scenario, resolution} |

## Key Differences from v1

| Aspect | v1 (old) | v2 (this template) |
|--------|----------|---------------------|
| Phase 1/5 | Inline JS code | Reference SKILL.md Shared Infrastructure |
| Message Bus | JS function call pseudocode | Text description + actual tool call template |
| Task Lifecycle | JS filter/map code | Step list description |
| Phase 2-4 | JS code per responsibility_type | Text + decision tables per responsibility_type |
| Command delegation | JS try/catch block | Text "Delegate to commands/xxx.md" |
| Coordinator template | JS spawn loops | Text phases with decision tables |
