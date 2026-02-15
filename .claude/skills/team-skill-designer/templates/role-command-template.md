# Role Command Template

Template for generating command files in `roles/{role-name}/commands/{command}.md`.

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand command file structure |
| Phase 3 | Apply with role-specific content |

---

## Template

```markdown
# Command: {{command_name}}

> {{command_description}}

## When to Use

{{when_to_use_description}}

**Trigger conditions**:
{{#each triggers}}
- {{this}}
{{/each}}

## Strategy

### Delegation Mode

**Mode**: {{delegation_mode}}

{{#if delegation_mode_subagent}}
**Subagent Type**: `{{subagent_type}}`
**Parallel Count**: {{parallel_count}} (1-4)
{{/if}}

{{#if delegation_mode_cli}}
**CLI Tool**: `{{cli_tool}}`
**CLI Mode**: `{{cli_mode}}`
**Parallel Perspectives**: {{cli_perspectives}}
{{/if}}

{{#if delegation_mode_sequential}}
**Agent Type**: `{{agent_type}}`
**Delegation Scope**: {{delegation_scope}}
{{/if}}

### Decision Logic

\`\`\`javascript
{{decision_logic}}
\`\`\`

## Execution Steps

### Step 1: Context Preparation

\`\`\`javascript
{{context_preparation_code}}
\`\`\`

### Step 2: Execute Strategy

\`\`\`javascript
{{execution_code}}
\`\`\`

### Step 3: Result Processing

\`\`\`javascript
{{result_processing_code}}
\`\`\`

## Output Format

\`\`\`
{{output_format}}
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
{{#each error_handlers}}
| {{this.scenario}} | {{this.resolution}} |
{{/each}}
| Agent/CLI failure | Retry once, then fallback to inline execution |
| Timeout (>5 min) | Report partial results, notify coordinator |
```

---

## 7 Pre-built Command Patterns

### 1. explore.md (Multi-angle Exploration)

**Delegation Mode**: Subagent Fan-out
**Source Pattern**: team-lifecycle planner Phase 2
**Maps to**: Orchestration roles

```markdown
# Command: explore

> Multi-angle codebase exploration using parallel cli-explore-agent instances.

## When to Use

- Phase 2 of Orchestration roles
- Task requires understanding existing code patterns
- Multiple exploration angles needed (architecture, patterns, dependencies)

**Trigger conditions**:
- New feature planning
- Codebase unfamiliar to the agent
- Cross-module impact analysis

## Strategy

### Delegation Mode

**Mode**: Subagent Fan-out
**Subagent Type**: `cli-explore-agent`
**Parallel Count**: 2-4 (based on complexity)

### Decision Logic

\`\`\`javascript
const angles = []
if (/architect|structure|design/.test(task.description)) angles.push("architecture")
if (/pattern|convention|style/.test(task.description)) angles.push("patterns")
if (/depend|import|module/.test(task.description)) angles.push("dependencies")
if (/test|spec|coverage/.test(task.description)) angles.push("testing")
if (angles.length === 0) angles.push("general", "patterns")
\`\`\`

## Execution Steps

### Step 1: Context Preparation

\`\`\`javascript
const taskDescription = task.description
const projectRoot = Bash(\`git rev-parse --show-toplevel\`).trim()
\`\`\`

### Step 2: Execute Strategy

\`\`\`javascript
// Launch parallel exploration agents (1 per angle)
for (const angle of angles) {
  Task({
    subagent_type: "cli-explore-agent",
    run_in_background: false,
    description: \`Explore: \${angle}\`,
    prompt: \`Explore the codebase from the perspective of \${angle}.
Focus on: \${taskDescription}
Project root: \${projectRoot}

Report findings as structured markdown with file references.\`
  })
}
\`\`\`

### Step 3: Result Processing

\`\`\`javascript
// Aggregate exploration results
const aggregated = {
  angles_explored: angles,
  key_findings: [],    // merge from all agents
  relevant_files: [],  // deduplicate across agents
  patterns_found: []
}
\`\`\`

## Output Format

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

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Agent returns no results | Retry with broader search scope |
| Agent timeout | Use partial results, note incomplete angles |
| Project root not found | Fall back to current directory |
```

### 2. analyze.md (Multi-perspective Analysis)

**Delegation Mode**: CLI Fan-out
**Source Pattern**: analyze-with-file Phase 2
**Maps to**: Read-only analysis roles

```markdown
# Command: analyze

> Multi-perspective code analysis using parallel ccw cli calls.

## When to Use

- Phase 3 of Read-only analysis roles
- Multiple analysis dimensions needed (security, performance, quality)
- Deep analysis beyond inline capability

**Trigger conditions**:
- Code review with specific focus areas
- Security/performance audit
- Architecture assessment

## Strategy

### Delegation Mode

**Mode**: CLI Fan-out
**CLI Tool**: `gemini` (primary), `codex` (secondary)
**CLI Mode**: `analysis`
**Parallel Perspectives**: 2-4

### Decision Logic

\`\`\`javascript
const perspectives = []
if (/security|auth|inject|xss/.test(task.description)) perspectives.push("security")
if (/performance|speed|optimize|memory/.test(task.description)) perspectives.push("performance")
if (/quality|clean|maintain|debt/.test(task.description)) perspectives.push("code-quality")
if (/architect|pattern|structure/.test(task.description)) perspectives.push("architecture")
if (perspectives.length === 0) perspectives.push("code-quality", "architecture")
\`\`\`

## Execution Steps

### Step 1: Context Preparation

\`\`\`javascript
const targetFiles = Bash(\`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached\`)
  .split('\\n').filter(Boolean)
const fileContext = targetFiles.map(f => \`@\${f}\`).join(' ')
\`\`\`

### Step 2: Execute Strategy

\`\`\`javascript
for (const perspective of perspectives) {
  Bash(\`ccw cli -p "PURPOSE: Analyze code from \${perspective} perspective
TASK: Review changes in: \${targetFiles.join(', ')}
MODE: analysis
CONTEXT: \${fileContext}
EXPECTED: Findings with severity, file:line references, remediation
CONSTRAINTS: Focus on \${perspective}" --tool gemini --mode analysis\`, { run_in_background: true })
}
// Wait for all CLI results
\`\`\`

### Step 3: Result Processing

\`\`\`javascript
// Aggregate findings across all perspectives
const findings = { critical: [], high: [], medium: [], low: [] }
// Merge, deduplicate, prioritize
\`\`\`

## Output Format

\`\`\`
## Analysis Results

### Perspectives Analyzed: [list]

### Findings by Severity
#### Critical
- [finding with file:line]
#### High
- [finding]
...
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| CLI tool unavailable | Fall back to secondary tool (codex) |
| CLI returns empty | Retry with broader scope |
| Too many findings | Prioritize critical/high, summarize medium/low |
```

### 3. implement.md (Code Implementation)

**Delegation Mode**: Sequential Delegation
**Source Pattern**: team-lifecycle executor Phase 3
**Maps to**: Code generation roles

```markdown
# Command: implement

> Code implementation via code-developer subagent delegation with batch routing.

## When to Use

- Phase 3 of Code generation roles
- Implementation involves >2 files or complex logic
- Plan tasks available with file specifications

**Trigger conditions**:
- Plan approved and tasks defined
- Multi-file implementation needed
- Complex logic requiring specialized agent

## Strategy

### Delegation Mode

**Mode**: Sequential Delegation (with batch routing)
**Agent Type**: `code-developer`
**Delegation Scope**: Per-batch (group related tasks)

### Decision Logic

\`\`\`javascript
const taskCount = planTasks.length
if (taskCount <= 2) {
  // Direct: inline Edit/Write
  mode = "direct"
} else if (taskCount <= 5) {
  // Single agent: one code-developer for all
  mode = "single-agent"
} else {
  // Batch: group by module, one agent per batch
  mode = "batch-agent"
}
\`\`\`

## Execution Steps

### Step 1: Context Preparation

\`\`\`javascript
const plan = JSON.parse(Read(planPath))
const planTasks = plan.task_ids.map(id =>
  JSON.parse(Read(\`\${planDir}/.task/\${id}.json\`))
)
\`\`\`

### Step 2: Execute Strategy

\`\`\`javascript
if (mode === "direct") {
  for (const pt of planTasks) {
    for (const f of (pt.files || [])) {
      Read(f.path)
      Edit({ file_path: f.path, old_string: "...", new_string: "..." })
    }
  }
} else {
  const batches = mode === "batch-agent"
    ? groupByModule(planTasks)
    : [planTasks]

  for (const batch of batches) {
    Task({
      subagent_type: "code-developer",
      run_in_background: false,
      description: \`Implement \${batch.length} tasks\`,
      prompt: \`## Goal\\n\${plan.summary}\\n\\n## Tasks\\n\${
        batch.map(t => \`### \${t.title}\\n\${t.description}\`).join('\\n\\n')
      }\\n\\nComplete each task according to its convergence criteria.\`
    })
  }
}
\`\`\`

### Step 3: Result Processing

\`\`\`javascript
const changedFiles = Bash(\`git diff --name-only\`).split('\\n').filter(Boolean)
const syntaxClean = !Bash(\`tsc --noEmit 2>&1 || true\`).includes('error TS')
\`\`\`

## Output Format

\`\`\`
## Implementation Results

### Changed Files: [count]
- [file path]

### Syntax Check: PASS/FAIL
### Tasks Completed: [count]/[total]
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Plan file not found | Notify coordinator, request plan path |
| Agent fails on task | Retry once, then mark task as blocked |
| Syntax errors after impl | Attempt auto-fix, report if unresolved |
```

### 4. validate.md (Test-Fix Cycle)

**Delegation Mode**: Sequential Delegation
**Source Pattern**: team-lifecycle tester
**Maps to**: Validation roles

```markdown
# Command: validate

> Iterative test-fix cycle with max iteration control.

## When to Use

- Phase 3 of Validation roles
- After implementation, before review
- Automated test suite available

## Strategy

### Delegation Mode

**Mode**: Sequential Delegation
**Agent Type**: `code-developer` (for fix iterations)
**Max Iterations**: 5

## Execution Steps

### Step 1: Context Preparation

\`\`\`javascript
const testCommand = detectTestCommand() // npm test, pytest, etc.
const changedFiles = Bash(\`git diff --name-only\`).split('\\n').filter(Boolean)
\`\`\`

### Step 2: Execute Strategy

\`\`\`javascript
let iteration = 0
const MAX_ITERATIONS = 5
let lastResult = null

while (iteration < MAX_ITERATIONS) {
  lastResult = Bash(\`\${testCommand} 2>&1 || true\`)
  const passed = !lastResult.includes('FAIL') && !lastResult.includes('Error')

  if (passed) break

  // Delegate fix to code-developer
  Task({
    subagent_type: "code-developer",
    run_in_background: false,
    description: \`Fix test failures (iteration \${iteration + 1})\`,
    prompt: \`Test failures:\\n\${lastResult}\\n\\nFix the failing tests. Changed files: \${changedFiles.join(', ')}\`
  })

  iteration++
}
\`\`\`

### Step 3: Result Processing

\`\`\`javascript
const result = {
  iterations: iteration,
  passed: iteration < MAX_ITERATIONS,
  lastOutput: lastResult
}
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No test command found | Notify coordinator |
| Max iterations exceeded | Report failures, suggest manual intervention |
| Test environment broken | Report environment issue |
```

### 5. review.md (Multi-dimensional Review)

**Delegation Mode**: CLI Fan-out
**Source Pattern**: team-lifecycle reviewer
**Maps to**: Read-only analysis roles

```markdown
# Command: review

> 4-dimensional code review with optional codex review integration.

## When to Use

- Phase 3 of Read-only analysis roles (reviewer type)
- After implementation and testing
- Quality gate before delivery

## Strategy

### Delegation Mode

**Mode**: CLI Fan-out
**CLI Tool**: `gemini` + optional `codex` (review mode)
**Dimensions**: correctness, completeness, maintainability, requirement-fit

## Execution Steps

### Step 2: Execute Strategy

\`\`\`javascript
// Dimension 1-3: Parallel CLI analysis
const dimensions = ["correctness", "completeness", "maintainability"]
for (const dim of dimensions) {
  Bash(\`ccw cli -p "PURPOSE: Review code for \${dim}
TASK: Evaluate changes against \${dim} criteria
MODE: analysis
CONTEXT: @\${changedFiles.join(' @')}
EXPECTED: Findings with severity and file:line references" --tool gemini --mode analysis\`, { run_in_background: true })
}

// Dimension 4: Optional codex review
Bash(\`ccw cli --tool codex --mode review --uncommitted\`, { run_in_background: true })
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Codex unavailable | Skip dimension 4, report 3-dimension review |
| No changed files | Review full scope of plan files |
```

### 6. dispatch.md (Task Distribution)

**Delegation Mode**: N/A (Coordinator-only)
**Source Pattern**: auto-parallel + CP-3
**Maps to**: Coordinator role

```markdown
# Command: dispatch

> Task chain creation with dependency management for coordinator.

## When to Use

- Phase 3 of Coordinator role
- After requirement clarification
- When creating and assigning tasks to teammates

## Strategy

### Delegation Mode

**Mode**: Direct (no delegation - coordinator acts directly)

## Execution Steps

### Step 1: Context Preparation

\`\`\`javascript
const config = TEAM_CONFIG
const pipeline = config.pipeline
\`\`\`

### Step 2: Execute Strategy

\`\`\`javascript
const taskIds = {}

for (const stage of pipeline.stages) {
  const blockedByIds = stage.blockedBy.map(dep => taskIds[dep]).filter(Boolean)

  TaskCreate({
    subject: \`\${stage.name}-001: \${stage.role} work\`,
    description: taskDescription,
    activeForm: \`\${stage.name} 进行中\`
  })

  // Record task ID
  taskIds[stage.name] = newTaskId

  // Set owner and dependencies
  TaskUpdate({
    taskId: newTaskId,
    owner: stage.role,
    addBlockedBy: blockedByIds
  })
}
\`\`\`

### Step 3: Result Processing

\`\`\`javascript
// Verify task chain created correctly
const allTasks = TaskList()
const chainValid = pipeline.stages.every(s => taskIds[s.name])
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Task creation fails | Retry, then report to user |
| Dependency cycle detected | Flatten dependencies, warn |
| Role not spawned yet | Queue task, spawn role first |
```

### 7. monitor.md (Progress Monitoring)

**Delegation Mode**: N/A (Coordinator-only)
**Source Pattern**: coordinate.md Phase 4
**Maps to**: Coordinator role

```markdown
# Command: monitor

> Message bus polling and coordination loop for coordinator.

## When to Use

- Phase 4 of Coordinator role
- After task dispatch
- Continuous monitoring until all tasks complete

## Strategy

### Delegation Mode

**Mode**: Direct (coordinator polls and routes)

## Execution Steps

### Step 1: Context Preparation

\`\`\`javascript
const routingTable = {}
for (const role of config.worker_roles) {
  const resultType = role.message_types.find(mt =>
    !mt.type.includes('error') && !mt.type.includes('progress')
  )
  routingTable[resultType?.type || \`\${role.name}_complete\`] = {
    role: role.name,
    action: "Mark task completed, check downstream dependencies"
  }
}
routingTable["error"] = { role: "*", action: "Assess severity, retry or escalate" }
routingTable["fix_required"] = { role: "*", action: "Create fix task for executor" }
\`\`\`

### Step 2: Execute Strategy

\`\`\`javascript
// Coordination loop
let allComplete = false
while (!allComplete) {
  // Poll message bus
  const messages = mcp__ccw-tools__team_msg({
    operation: "list",
    team: teamName,
    last: 10
  })

  // Route each message
  for (const msg of messages) {
    const handler = routingTable[msg.type]
    if (handler) {
      // Execute handler action
    }
  }

  // Check completion
  const tasks = TaskList()
  allComplete = tasks.filter(t =>
    t.owner !== 'coordinator' && t.status !== 'completed'
  ).length === 0
}
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Message bus unavailable | Fall back to TaskList polling |
| Teammate unresponsive | Send follow-up, 2x → respawn |
| Deadlock detected | Identify cycle, break with manual unblock |
```

---

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `{{command_name}}` | Command identifier | e.g., "explore", "analyze" |
| `{{command_description}}` | One-line description | What this command does |
| `{{delegation_mode}}` | Mode selection | "Subagent Fan-out", "CLI Fan-out", "Sequential Delegation", "Direct" |
| `{{when_to_use_description}}` | Usage context | When to invoke this command |
| `{{triggers}}` | Trigger conditions | List of conditions |
| `{{decision_logic}}` | Strategy selection code | JavaScript decision code |
| `{{context_preparation_code}}` | Context setup | JavaScript setup code |
| `{{execution_code}}` | Core execution | JavaScript execution code |
| `{{result_processing_code}}` | Result aggregation | JavaScript result code |
| `{{output_format}}` | Expected output structure | Markdown format spec |
| `{{error_handlers}}` | Error handling entries | Array of {scenario, resolution} |

## Self-Containment Rules

1. **No cross-command references**: Each command.md must be executable independently
2. **Include all imports**: List all required context (files, configs) in Step 1
3. **Complete error handling**: Every command handles its own failures
4. **Explicit output format**: Define what the command produces
5. **Strategy declaration**: State delegation mode and decision logic upfront
