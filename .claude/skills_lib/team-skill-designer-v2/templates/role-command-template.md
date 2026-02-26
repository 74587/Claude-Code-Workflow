# Role Command Template

Template for generating command files in `roles/<role-name>/commands/<command>.md` (v3 style).

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand command file structure |
| Phase 3 | Apply with role-specific content |

## Style Rules

Generated output follows v3 conventions:

| Rule | Description |
|------|-------------|
| No JS pseudocode | All logic uses text + decision tables + flow symbols |
| Code blocks = tool calls only | Only Task(), Bash(), Read(), Grep() etc. |
| `<placeholder>` in output | Not `${variable}` in generated content |
| Decision tables | Strategy selection, error routing all use tables |
| Self-contained | Each command executable independently |

> **Note**: The template itself uses `{{handlebars}}` for variable substitution during Phase 3 generation. The **generated output** must not contain `{{handlebars}}` or JS pseudocode.

---

## Template

```markdown
# Command: {{command_name}}

## Purpose

{{command_description}}

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
{{#each context_inputs}}
| {{this.name}} | {{this.source}} | {{this.required}} |
{{/each}}

## Phase 3: Core Work

{{core_work_content}}

## Phase 4: Validation

{{validation_content}}

## Error Handling

| Scenario | Resolution |
|----------|------------|
{{#each error_handlers}}
| {{this.scenario}} | {{this.resolution}} |
{{/each}}
```

---

## 7 Pre-built Command Patterns

Each pattern below provides the complete v3-style structure. During Phase 3 generation, select the matching pattern and customize with team-specific content.

### 1. explore.md (Multi-angle Exploration)

**Maps to**: Orchestration roles, Phase 2
**Delegation**: Subagent Fan-out

```markdown
# Command: explore

## Purpose

Multi-angle codebase exploration using parallel exploration agents. Discovers patterns, dependencies, and architecture before planning.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Task description | TaskGet result | Yes |
| Project root | `git rev-parse --show-toplevel` | Yes |
| Existing explorations | <session-folder>/explorations/ | No |
| Wisdom | <session-folder>/wisdom/ | No |

## Phase 3: Core Work

### Angle Selection

Determine exploration angles from task description:

| Signal in Description | Angle |
|-----------------------|-------|
| architect, structure, design | architecture |
| pattern, convention, style | patterns |
| depend, import, module | dependencies |
| test, spec, coverage | testing |
| No signals matched | general + patterns (default) |

### Execution Strategy

| Angle Count | Strategy |
|-------------|----------|
| 1 angle | Single agent exploration |
| 2-4 angles | Parallel agents, one per angle |

**Per-angle agent spawn**:

\`\`\`
Task({
  subagent_type: "cli-explore-agent",
  run_in_background: false,
  description: "Explore: <angle>",
  prompt: "Explore the codebase from the perspective of <angle>.
Focus on: <task-description>
Project root: <project-root>

Report findings as structured markdown with file references."
})
\`\`\`

### Result Aggregation

After all agents complete:

1. Merge key findings across all angles (deduplicate)
2. Collect relevant file paths (deduplicate)
3. Extract discovered patterns
4. Write aggregated results to `<session-folder>/explorations/<task-id>.md`

### Output Format

\`\`\`
## Exploration Results

### Angles Explored: [list]

### Key Findings
- [finding with file:line reference]

### Relevant Files
- [file path with relevance note]

### Patterns Found
- [pattern name: description]
\`\`\`

## Phase 4: Validation

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| All angles covered | Compare planned vs completed | All planned angles explored |
| Findings non-empty | Check result count | At least 1 finding per angle |
| File references valid | Verify referenced files exist | >= 80% files exist |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Agent returns no results | Retry with broader search scope |
| Agent timeout | Use partial results, note incomplete angles |
| Project root not found | Fall back to current directory |
| Exploration cache exists | Load cached, skip re-exploration |
```

### 2. analyze.md (Multi-perspective Analysis)

**Maps to**: Read-only analysis roles, Phase 3
**Delegation**: CLI Fan-out

```markdown
# Command: analyze

## Purpose

Multi-perspective code analysis using parallel CLI calls. Each perspective produces severity-ranked findings with file:line references.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Target files | `git diff --name-only HEAD~1` or `--cached` | Yes |
| Plan file | <session-folder>/plan/plan.json | No |
| Wisdom | <session-folder>/wisdom/ | No |

**File discovery**:

\`\`\`
Bash("git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached")
\`\`\`

## Phase 3: Core Work

### Perspective Selection

Determine analysis perspectives from task description:

| Signal in Description | Perspective |
|-----------------------|-------------|
| security, auth, inject, xss | security |
| performance, speed, optimize, memory | performance |
| quality, clean, maintain, debt | code-quality |
| architect, pattern, structure | architecture |
| No signals matched | code-quality + architecture (default) |

### Execution Strategy

| Perspective Count | Strategy |
|-------------------|----------|
| 1 perspective | Single CLI call |
| 2-4 perspectives | Parallel CLI calls, one per perspective |

**Per-perspective CLI call**:

\`\`\`
Bash("ccw cli -p \"PURPOSE: Analyze code from <perspective> perspective
TASK: Review changes in: <file-list>
MODE: analysis
CONTEXT: @<file-patterns>
EXPECTED: Findings with severity, file:line references, remediation
CONSTRAINTS: Focus on <perspective>\" --tool gemini --mode analysis", { run_in_background: true })
\`\`\`

### Finding Aggregation

After all perspectives complete:

1. Parse findings from each CLI response
2. Classify by severity: Critical / High / Medium / Low
3. Deduplicate across perspectives
4. Sort by severity then by file location

### Output Format

\`\`\`
## Analysis Results

### Perspectives Analyzed: [list]

### Findings by Severity
#### Critical
- [finding with file:line]
#### High
- [finding]
#### Medium
- [finding]
#### Low
- [finding]
\`\`\`

## Phase 4: Validation

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| All perspectives covered | Compare planned vs completed | All perspectives analyzed |
| Findings have file refs | Check file:line format | >= 90% findings have references |
| No duplicate findings | Dedup check | No identical findings |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| CLI tool unavailable | Fall back to secondary tool |
| CLI returns empty | Retry with broader scope |
| Too many findings | Prioritize critical/high, summarize medium/low |
| Target files empty | Report no changes to analyze |
```

### 3. implement.md (Code Implementation)

**Maps to**: Code generation roles, Phase 3
**Delegation**: Sequential Delegation

```markdown
# Command: implement

## Purpose

Code implementation via subagent delegation with batch routing. Reads plan tasks and executes code changes, grouping by module for efficiency.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Plan file | <session-folder>/plan/plan.json | Yes |
| Task files | <session-folder>/plan/.task/<task-id>.json | Yes |
| Wisdom conventions | <session-folder>/wisdom/conventions.md | No |

**Loading steps**:

1. Extract plan path from task description
2. Read plan.json -> get task list
3. Read each task file for detailed specs
4. Load coding conventions from wisdom

## Phase 3: Core Work

### Strategy Selection

| Task Count | Strategy | Description |
|------------|----------|-------------|
| <= 2 | Direct | Inline Edit/Write by this role |
| 3-5 | Single agent | One code-developer subagent for all tasks |
| > 5 | Batch agent | Group by module, one agent per batch |

### Direct Strategy (1-2 tasks)

For each task, for each file in task spec:
1. Read existing file (if modifying)
2. Apply changes via Edit or Write
3. Verify file saved

### Agent Strategy (3+ tasks)

**Single agent spawn**:

\`\`\`
Task({
  subagent_type: "code-developer",
  run_in_background: false,
  description: "Implement <N> tasks",
  prompt: "## Goal
<plan-summary>

## Tasks
<task-list-with-descriptions>

Complete each task according to its convergence criteria."
})
\`\`\`

**Batch agent** (> 5 tasks): Group tasks by module/directory, spawn one agent per batch using the template above.

### Output Tracking

After implementation:
1. Get list of changed files: `Bash("git diff --name-only")`
2. Count completed vs total tasks
3. Record changed file paths for validation phase

## Phase 4: Validation

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Syntax clean | Language-specific check (tsc, python -c, etc.) | No syntax errors |
| All files created | Verify plan-specified files exist | All files present |
| Import resolution | Check for broken imports | All imports resolve |

**Auto-fix on failure** (max 2 attempts):

| Attempt | Action |
|---------|--------|
| 1 | Parse error, apply targeted fix |
| 2 | Delegate fix to code-developer subagent |
| Failed | Report remaining issues to coordinator |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Plan file not found | Notify coordinator, request plan path |
| Agent fails on task | Retry once, then mark task as blocked |
| Syntax errors after impl | Attempt auto-fix, report if unresolved |
| File conflict | Check git status, resolve or report |
```

### 4. validate.md (Test-Fix Cycle)

**Maps to**: Validation roles, Phase 3
**Delegation**: Sequential Delegation

```markdown
# Command: validate

## Purpose

Iterative test-fix cycle with max iteration control. Runs tests, identifies failures, delegates fixes, and re-validates until passing or max iterations reached.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Test command | Auto-detect from project config | Yes |
| Changed files | `git diff --name-only` | Yes |
| Plan file | <session-folder>/plan/plan.json | No |

**Test command detection**:

| Detection Signal | Test Command |
|-----------------|--------------|
| package.json has "test" script | `npm test` |
| pytest.ini or conftest.py exists | `pytest` |
| Makefile has "test" target | `make test` |
| go.mod exists | `go test ./...` |
| No signal detected | Notify coordinator |

## Phase 3: Core Work

### Test-Fix Cycle

| Step | Action | Exit Condition |
|------|--------|----------------|
| 1. Run tests | `Bash("<test-command> 2>&1 || true")` | - |
| 2. Parse results | Extract pass/fail counts | - |
| 3. Check pass rate | Compare against threshold | Pass rate >= 95% -> exit SUCCESS |
| 4. Extract failures | Parse failing test names and errors | - |
| 5. Delegate fix | Spawn code-developer subagent | - |
| 6. Increment counter | iteration++ | iteration >= 5 -> exit MAX_REACHED |
| 7. Loop | Go to Step 1 | - |

**Fix delegation**:

\`\`\`
Task({
  subagent_type: "code-developer",
  run_in_background: false,
  description: "Fix test failures (iteration <N>)",
  prompt: "Test failures:
<test-output>

Fix the failing tests. Changed files: <file-list>"
})
\`\`\`

### Outcome Routing

| Outcome | Action |
|---------|--------|
| SUCCESS (pass rate >= 95%) | Proceed to Phase 4 |
| MAX_REACHED (5 iterations) | Report failures, mark for manual intervention |
| ENV_ERROR (test env broken) | Report environment issue to coordinator |

## Phase 4: Validation

| Metric | Source | Threshold |
|--------|--------|-----------|
| Pass rate | Final test run | >= 95% |
| Iterations used | Counter | Report count |
| Remaining failures | Last test output | List details |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No test command found | Notify coordinator |
| Max iterations exceeded | Report failures, suggest manual intervention |
| Test environment broken | Report environment issue |
| Flaky tests detected | Re-run once to confirm, exclude if consistently flaky |
```

### 5. review.md (Multi-dimensional Review)

**Maps to**: Read-only analysis roles (reviewer type), Phase 3
**Delegation**: CLI Fan-out

```markdown
# Command: review

## Purpose

Multi-dimensional code review producing a verdict (BLOCK/CONDITIONAL/APPROVE) with categorized findings across quality, security, architecture, and requirements dimensions.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Plan file | <session-folder>/plan/plan.json | Yes |
| Git diff | `git diff HEAD~1` or `git diff --cached` | Yes |
| Modified files | From git diff --name-only | Yes |
| Test results | Tester output (if available) | No |
| Wisdom | <session-folder>/wisdom/ | No |

## Phase 3: Core Work

### Dimension Overview

| Dimension | Focus | What to Detect |
|-----------|-------|----------------|
| Quality | Code correctness, type safety, clean code | Empty catch, ts-ignore, any type, console.log |
| Security | Vulnerability patterns, secret exposure | Hardcoded secrets, SQL injection, eval, XSS |
| Architecture | Module structure, coupling, file size | Circular deps, deep imports, large files |
| Requirements | Acceptance criteria coverage | Unmet criteria, missing error handling, missing tests |

### Per-Dimension Detection

For each dimension, scan modified files using pattern detection:

**Example: Quality scan for console statements**:

\`\`\`
Grep(pattern="console\\.(log|debug|info)", path="<file-path>", output_mode="content", "-n"=true)
\`\`\`

**Example: Architecture scan for deep imports**:

\`\`\`
Grep(pattern="from\\s+['\"](\\.\\./){3,}", path="<file-path>", output_mode="content", "-n"=true)
\`\`\`

### Requirements Verification

1. Read plan file -> extract acceptance criteria section
2. For each criterion -> extract keywords (4+ char meaningful words)
3. Search modified files for keyword matches
4. Score coverage:

| Match Rate | Status |
|------------|--------|
| >= 70% | Met |
| 40-69% | Partial |
| < 40% | Unmet |

### Verdict Routing

| Verdict | Criteria | Action |
|---------|----------|--------|
| BLOCK | Any critical-severity issues found | Must fix before merge |
| CONDITIONAL | High or medium issues, no critical | Should address, can merge with tracking |
| APPROVE | Only low issues or none | Ready to merge |

### Report Format

\`\`\`
# Code Review Report

**Verdict**: <BLOCK|CONDITIONAL|APPROVE>

## Blocking Issues (if BLOCK)
- **<type>** (<file>:<line>): <message>

## Review Dimensions

### Quality Issues
**CRITICAL** (<count>)
- <message> (<file>:<line>)

### Security Issues
(same format per severity)

### Architecture Issues
(same format per severity)

### Requirements Issues
(same format per severity)

## Recommendations
1. <actionable recommendation>
\`\`\`

## Phase 4: Validation

| Field | Description |
|-------|-------------|
| Total issues | Sum across all dimensions and severities |
| Critical count | Must be 0 for APPROVE |
| Blocking issues | Listed explicitly in report header |
| Dimensions covered | Must be 4/4 |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Plan file not found | Skip requirements dimension, note in report |
| Git diff empty | Report no changes to review |
| File read fails | Skip file, note in report |
| No modified files | Report empty review |
| Codex unavailable | Skip codex review dimension, report 3-dimension review |
```

### 6. dispatch.md (Task Distribution)

**Maps to**: Coordinator role, Phase 3
**Delegation**: Direct (coordinator acts directly)

```markdown
# Command: dispatch

## Purpose

Task chain creation with dependency management. Creates all pipeline tasks with correct blockedBy relationships and role-based ownership.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Pipeline definition | SKILL.md Pipeline Definitions | Yes |
| Task metadata | SKILL.md Task Metadata Registry | Yes |
| Session folder | From Phase 2 initialization | Yes |
| Mode | From Phase 1 requirements | Yes |

## Phase 3: Core Work

### Pipeline Selection

Select pipeline based on mode:

| Mode | Pipeline | Task Count |
|------|----------|------------|
{{#each pipeline_modes}}
| {{this.mode}} | {{this.pipeline}} | {{this.task_count}} |
{{/each}}

### Task Creation Flow

For each task in the selected pipeline (in dependency order):

1. **Create task**:

\`\`\`
TaskCreate({
  subject: "<TASK-ID>: <description>",
  description: "<detailed-description>\n\nSession: <session-folder>",
  activeForm: "<TASK-ID> in progress"
})
\`\`\`

2. **Set owner and dependencies**:

\`\`\`
TaskUpdate({
  taskId: <new-task-id>,
  owner: "<role-name>",
  addBlockedBy: [<dependency-task-ids>]
})
\`\`\`

3. Record created task ID for downstream dependency references

### Dependency Mapping

Follow SKILL.md Task Metadata Registry for:
- Task ID naming convention
- Role assignment (owner field)
- Dependencies (blockedBy relationships)
- Task description with session folder reference

### Parallel Task Handling

| Condition | Action |
|-----------|--------|
| Tasks share same blockedBy and no mutual dependency | Create both, they run in parallel |
| N parallel tasks for same role | Use instance-specific owner: `<role>-1`, `<role>-2` |

## Phase 4: Validation

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| All tasks created | Compare pipeline spec vs TaskList | Count matches |
| Dependencies correct | Verify blockedBy for each task | All deps point to valid tasks |
| Owners assigned | Check owner field | Every task has valid role owner |
| No orphan tasks | Verify all tasks reachable from pipeline start | No disconnected tasks |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Task creation fails | Retry, then report to user |
| Dependency cycle detected | Flatten dependencies, warn |
| Role not spawned yet | Queue task, spawn role first |
| Task prefix conflict | Log warning, proceed |
```

### 7. monitor.md (Message-Driven Coordination)

**Maps to**: Coordinator role, Phase 4
**Delegation**: Message-Driven (no polling)

```markdown
# Command: monitor

## Purpose

Message-driven coordination. Team members (spawned in Phase 2) execute tasks autonomously and report via SendMessage. Coordinator receives messages and routes next actions.

## Phase 2: Context Loading

| Input | Source | Required |
|-------|--------|----------|
| Pipeline state | TaskList() | Yes |
| Session file | <session-folder>/team-session.json | Yes |
| Team config | Team member list | Yes |

## Phase 3: Core Work

### Design Principles

| Principle | Description |
|-----------|-------------|
| No re-spawning | Team members already spawned in Phase 2 -- do NOT spawn again here |
| No polling loops | No `while` + `sleep` + status check (wastes API turns) |
| Event-driven | Worker SendMessage is the trigger signal |
| One beat per wake | Coordinator processes one event then STOPs |

### Entry Handlers

When coordinator wakes, route based on Entry Router detection:

| Handler | Trigger | Actions |
|---------|---------|---------|
| handleCallback | Worker `[role-name]` message received | 1. Log received message 2. Check task status 3. Route to next action |
| handleCheck | User says "check"/"status" | 1. Load TaskList 2. Output status graph 3. STOP (no advancement) |
| handleResume | User says "resume"/"continue" | 1. Load TaskList 2. Find ready tasks 3. Spawn/notify workers 4. STOP |

### handleCallback Flow

1. Identify sender role from message tag `[role-name]`
2. Log received message via team_msg
3. Load TaskList for current state
4. Route based on message content:

| Message Content | Action |
|-----------------|--------|
| Contains "fix_required" or "error" | Assess severity -> escalate to user if critical |
| Normal completion | Check pipeline progress (see below) |

5. Check pipeline progress:

| State | Condition | Action |
|-------|-----------|--------|
| All done | completed count >= total pipeline tasks | -> Phase 5 |
| Tasks unblocked | pending tasks with empty blockedBy | Notify/spawn workers for unblocked tasks |
| Checkpoint | Pipeline at spec->impl transition | Pause, ask user to `resume` |
| Stalled | No ready + no running + has pending | Report blocking point |

6. Output status summary -> STOP

### handleCheck Flow (Status Only)

1. Load all tasks via TaskList
2. Build status overview:

\`\`\`
Pipeline Status:
  Completed: <N>/<total>
  In Progress: <list>
  Pending: <list>
  Blocked: <list with blockedBy details>
\`\`\`

3. STOP (no pipeline advancement)

### handleResume Flow

1. Load TaskList
2. Find tasks with: status=pending, blockedBy all resolved
3. For each ready task:

| Condition | Action |
|-----------|--------|
| Worker already spawned and idle | SendMessage to worker: "Task <subject> unblocked, please proceed" |
| Worker not spawned | Spawn worker using SKILL.md Spawn Template |

4. Output status summary -> STOP

### Status Graph Format

\`\`\`
Pipeline Progress: <completed>/<total>

  [DONE] TASK-001 (role) - description
  [DONE] TASK-002 (role) - description
  [>>  ] TASK-003 (role) - description    <- in_progress
  [    ] TASK-004 (role) - description    <- blocked by TASK-003
  ...
\`\`\`

## Phase 4: Validation

| Check | Method | Pass Criteria |
|-------|--------|---------------|
| Message routed | Verify handler executed | Handler completed without error |
| State consistent | TaskList reflects actions taken | Tasks updated correctly |
| No orphan workers | All spawned workers have assigned tasks | No idle workers without tasks |

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Teammate reports error | Assess severity -> retry SendMessage or escalate to user |
| Task stuck (no callback) | Send follow-up to teammate, 2x -> suggest respawn |
| Critical issue beyond scope | AskUserQuestion: retry/skip/terminate |
| Session file corrupted | Rebuild state from TaskList |
```

---

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `{{command_name}}` | Command identifier | e.g., "explore", "analyze" |
| `{{command_description}}` | One-line description | What this command does |
| `{{context_inputs}}` | Array of {name, source, required} | Context loading table rows |
| `{{core_work_content}}` | Generated from pattern | Phase 3 content |
| `{{validation_content}}` | Generated from pattern | Phase 4 content |
| `{{error_handlers}}` | Array of {scenario, resolution} | Error handling table rows |
| `{{pipeline_modes}}` | config.pipeline_modes | Array of {mode, pipeline, task_count} for dispatch |

## Self-Containment Rules

1. **No cross-command references**: Each command.md must be executable independently
2. **Include all context inputs**: List all required context (files, configs) in Phase 2
3. **Complete error handling**: Every command handles its own failures
4. **Explicit output format**: Define what the command produces
5. **Strategy in decision tables**: All routing logic in tables, not code

## Key Differences from v1

| Aspect | v1 (old) | v2 (this template) |
|--------|----------|---------------------|
| Strategy logic | JS `if/else` + regex matching | Decision tables |
| Execution steps | JS code blocks (pseudocode) | Step lists + actual tool call templates |
| Result processing | JS object construction | Text aggregation description |
| Output format | Embedded in JS template literals | Standalone markdown format block |
| Error handling | JS try/catch with fallbacks | Decision table with clear routing |
| Context prep | JS variable assignments | Phase 2 table + loading steps |
| Monitor design | JS while loop + polling | Event-driven handlers + STOP pattern |
