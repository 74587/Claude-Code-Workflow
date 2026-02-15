# Role File Template

Template for generating per-role execution detail files in `roles/{role-name}/role.md`.

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand role file structure |
| Phase 3 | Apply with role-specific content |

---

## Template

```markdown
# Role: {{role_name}}

{{role_description}}

## Role Identity

- **Name**: `{{role_name}}`
- **Task Prefix**: `{{task_prefix}}-*`
- **Responsibility**: {{responsibility_type}}
- **Communication**: SendMessage to coordinator only
- **Output Tag**: `[{{role_name}}]`

## Role Boundaries

### MUST

- 仅处理 `{{task_prefix}}-*` 前缀的任务
- 所有输出（SendMessage、team_msg、日志）必须带 `[{{role_name}}]` 标识
- 仅通过 SendMessage 与 coordinator 通信
- 严格在 {{responsibility_type}} 职责范围内工作

### MUST NOT

- ❌ 执行其他角色职责范围内的工作
- ❌ 直接与其他 worker 角色通信（必须经过 coordinator）
- ❌ 为其他角色创建任务（TaskCreate 是 coordinator 专属）
- ❌ 修改不属于本角色职责的文件或资源
- ❌ 在输出中省略 `[{{role_name}}]` 标识

## Message Types

| Type | Direction | Trigger | Description |
|------|-----------|---------|-------------|
{{#each message_types}}
| `{{this.type}}` | {{../role_name}} → coordinator | {{this.trigger}} | {{this.description}} |
{{/each}}

## Toolbox

### Available Commands

| Command | File | Phase | Description |
|---------|------|-------|-------------|
{{#each commands}}
| `{{this.name}}` | [commands/{{this.name}}.md](commands/{{this.name}}.md) | Phase {{this.phase}} | {{this.description}} |
{{/each}}

{{#if has_no_commands}}
> No command files — all phases execute inline.
{{/if}}

### Subagent Capabilities

| Agent Type | Used By | Purpose |
|------------|---------|---------|
{{#each subagents}}
| `{{this.type}}` | {{this.used_by}} | {{this.purpose}} |
{{/each}}

### CLI Capabilities

| CLI Tool | Mode | Used By | Purpose |
|----------|------|---------|---------|
{{#each cli_tools}}
| `{{this.tool}}` | {{this.mode}} | {{this.used_by}} | {{this.purpose}} |
{{/each}}

## Execution (5-Phase)

### Phase 1: Task Discovery

\`\`\`javascript
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('{{task_prefix}}-') &&
  t.owner === '{{role_name}}' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
\`\`\`

### Phase 2: {{phase2_name}}

{{#if phase2_command}}
\`\`\`javascript
// Delegate to command file
try {
  const commandContent = Read("commands/{{phase2_command}}.md")
  // Execute strategy defined in command file
} catch {
  // Fallback: inline execution
}
\`\`\`

**Command**: [commands/{{phase2_command}}.md](commands/{{phase2_command}}.md)
{{else}}
{{phase2_content}}
{{/if}}

### Phase 3: {{phase3_name}}

{{#if phase3_command}}
\`\`\`javascript
// Delegate to command file
try {
  const commandContent = Read("commands/{{phase3_command}}.md")
  // Execute strategy defined in command file
} catch {
  // Fallback: inline execution
}
\`\`\`

**Command**: [commands/{{phase3_command}}.md](commands/{{phase3_command}}.md)
{{else}}
{{phase3_content}}
{{/if}}

### Phase 4: {{phase4_name}}

{{#if phase4_command}}
\`\`\`javascript
// Delegate to command file
try {
  const commandContent = Read("commands/{{phase4_command}}.md")
  // Execute strategy defined in command file
} catch {
  // Fallback: inline execution
}
\`\`\`

**Command**: [commands/{{phase4_command}}.md](commands/{{phase4_command}}.md)
{{else}}
{{phase4_content}}
{{/if}}

### Phase 5: Report to Coordinator

\`\`\`javascript
// Log message before SendMessage — 所有输出必须带 [{{role_name}}] 标识
mcp__ccw-tools__team_msg({
  operation: "log",
  team: teamName,
  from: "{{role_name}}",
  to: "coordinator",
  type: "{{primary_message_type}}",
  summary: \`[{{role_name}}] {{task_prefix}} complete: \${task.subject}\`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: \`## [{{role_name}}] {{display_name}} Results

**Task**: \${task.subject}
**Status**: \${resultStatus}

### Summary
\${resultSummary}

### Details
\${resultDetails}\`,
  summary: \`[{{role_name}}] {{task_prefix}} complete\`
})

// Mark task completed
TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('{{task_prefix}}-') &&
  t.owner === '{{role_name}}' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task → back to Phase 1
}
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No {{task_prefix}}-* tasks available | Idle, wait for coordinator assignment |
| Context/Plan file not found | Notify coordinator, request location |
{{#if has_commands}}
| Command file not found | Fall back to inline execution |
{{/if}}
{{#if adaptive_routing}}
| Sub-agent failure | Retry once, then fallback to direct execution |
{{/if}}
| Critical issue beyond scope | SendMessage fix_required to coordinator |
| Unexpected error | Log error via team_msg, report to coordinator |
```

---

## Template Sections by Responsibility Type

### Read-only analysis

**Phase 2: Context Loading**
```javascript
// Load plan for criteria reference
const planPathMatch = task.description.match(/\.workflow\/\.team-plan\/[^\s]+\/plan\.json/)
let plan = null
if (planPathMatch) {
  try { plan = JSON.parse(Read(planPathMatch[0])) } catch {}
}

// Get changed files
const changedFiles = Bash(`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached`)
  .split('\n').filter(Boolean)

// Read file contents for analysis
const fileContents = {}
for (const file of changedFiles.slice(0, 20)) {
  try { fileContents[file] = Read(file) } catch {}
}
```

**Phase 3: Analysis Execution**
```javascript
// Core analysis logic
// Customize per specific analysis domain
```

**Phase 4: Finding Summary**
```javascript
// Classify findings by severity
const findings = {
  critical: [],
  high: [],
  medium: [],
  low: []
}
```

### Code generation

**Phase 2: Task & Plan Loading**
```javascript
const planPathMatch = task.description.match(/\.workflow\/\.team-plan\/[^\s]+\/plan\.json/)
if (!planPathMatch) {
  SendMessage({ type: "message", recipient: "coordinator",
    content: `Cannot find plan.json in ${task.subject}`, summary: "Plan not found" })
  return
}
const plan = JSON.parse(Read(planPathMatch[0]))
const planTasks = plan.task_ids.map(id =>
  JSON.parse(Read(`${planPathMatch[0].replace('plan.json', '')}.task/${id}.json`))
)
```

**Phase 3: Code Implementation**
```javascript
// Complexity-adaptive execution
if (complexity === 'Low') {
  // Direct file editing
} else {
  Task({
    subagent_type: "code-developer",
    run_in_background: false,
    description: "Implement plan tasks",
    prompt: `...`
  })
}
```

**Phase 4: Self-Validation**
```javascript
const syntaxResult = Bash(`tsc --noEmit 2>&1 || true`)
const hasSyntaxErrors = syntaxResult.includes('error TS')
```

### Orchestration

**Phase 2: Context & Complexity Assessment**
```javascript
function assessComplexity(desc) {
  let score = 0
  if (/refactor|architect|restructure|module|system/.test(desc)) score += 2
  if (/multiple|across|cross/.test(desc)) score += 2
  if (/integrate|api|database/.test(desc)) score += 1
  if (/security|performance/.test(desc)) score += 1
  return score >= 4 ? 'High' : score >= 2 ? 'Medium' : 'Low'
}
const complexity = assessComplexity(task.description)
```

**Phase 3: Orchestrated Execution**
```javascript
// Launch parallel sub-agents or sequential stages
```

**Phase 4: Result Aggregation**
```javascript
// Merge and summarize sub-agent results
```

### Validation

**Phase 2: Environment Detection**
```javascript
const changedFiles = Bash(`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached`)
  .split('\n').filter(Boolean)
```

**Phase 3: Execution & Fix Cycle**
```javascript
// Run validation, collect failures, attempt fixes, re-validate
let iteration = 0
const MAX_ITERATIONS = 5
while (iteration < MAX_ITERATIONS) {
  const result = runValidation()
  if (result.passRate >= 0.95) break
  applyFixes(result.failures)
  iteration++
}
```

**Phase 4: Result Analysis**
```javascript
// Analyze pass/fail patterns, coverage gaps
```

---

## Coordinator Role Template

The coordinator role is special and always generated. Its template differs from worker roles:

```markdown
# Role: coordinator

Team coordinator. Orchestrates the pipeline: requirement clarification → task chain creation → dispatch → monitoring → reporting.

## Role Identity

- **Name**: `coordinator`
- **Task Prefix**: N/A (coordinator creates tasks, doesn't receive them)
- **Responsibility**: Orchestration
- **Communication**: SendMessage to all teammates
- **Output Tag**: `[coordinator]`

## Role Boundaries

### MUST

- 所有输出（SendMessage、team_msg、日志）必须带 `[coordinator]` 标识
- 仅负责需求澄清、任务创建/分发、进度监控、结果汇报
- 通过 TaskCreate 创建任务并分配给 worker 角色
- 通过消息总线监控 worker 进度并路由消息

### MUST NOT

- ❌ **直接执行任何业务任务**（代码编写、分析、测试、审查等）
- ❌ 直接调用 code-developer、cli-explore-agent 等实现类 subagent
- ❌ 直接修改源代码或生成产物文件
- ❌ 绕过 worker 角色自行完成应委派的工作
- ❌ 在输出中省略 `[coordinator]` 标识

> **核心原则**: coordinator 是指挥者，不是执行者。所有实际工作必须通过 TaskCreate 委派给 worker 角色。

## Execution

### Phase 1: Requirement Clarification

Parse $ARGUMENTS, use AskUserQuestion for MVP scope and constraints.

### Phase 2: Create Team + Spawn Teammates

\`\`\`javascript
TeamCreate({ team_name: teamName })

// Spawn each worker role
{{#each worker_roles}}
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "{{this.name}}",
  prompt: \`...Skill(skill="team-{{team_name}}", args="--role={{this.name}}")...\`
})
{{/each}}
\`\`\`

### Phase 3: Create Task Chain

\`\`\`javascript
{{task_chain_creation_code}}
\`\`\`

### Phase 4: Coordination Loop

| Received Message | Action |
|-----------------|--------|
{{#each coordination_handlers}}
| {{this.trigger}} | {{this.action}} |
{{/each}}

### Phase 5: Report + Persist

Summarize results. AskUserQuestion for next requirement or shutdown.
```

---

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `{{role_name}}` | config.role_name | Role identifier |
| `{{task_prefix}}` | config.task_prefix | UPPERCASE task prefix |
| `{{responsibility_type}}` | config.responsibility_type | Role type |
| `{{display_name}}` | config.display_name | Human-readable |
| `{{phase2_name}}` | patterns.phase_structure.phase2 | Phase 2 label |
| `{{phase3_name}}` | patterns.phase_structure.phase3 | Phase 3 label |
| `{{phase4_name}}` | patterns.phase_structure.phase4 | Phase 4 label |
| `{{phase2_content}}` | Generated from responsibility template | Phase 2 code |
| `{{phase3_content}}` | Generated from responsibility template | Phase 3 code |
| `{{phase4_content}}` | Generated from responsibility template | Phase 4 code |
| `{{message_types}}` | config.message_types | Array of message types |
| `{{primary_message_type}}` | config.message_types[0].type | Primary type |
| `{{adaptive_routing}}` | config.adaptive_routing | Boolean |
| `{{commands}}` | config.commands | Array of command definitions |
| `{{has_commands}}` | config.commands.length > 0 | Boolean: has extracted commands |
| `{{has_no_commands}}` | config.commands.length === 0 | Boolean: all phases inline |
| `{{subagents}}` | config.subagents | Array of subagent capabilities |
| `{{cli_tools}}` | config.cli_tools | Array of CLI tool capabilities |
| `{{phase2_command}}` | config.phase2_command | Command name for Phase 2 (if extracted) |
| `{{phase3_command}}` | config.phase3_command | Command name for Phase 3 (if extracted) |
| `{{phase4_command}}` | config.phase4_command | Command name for Phase 4 (if extracted) |
