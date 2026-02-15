# Skill Router Template

Template for the generated SKILL.md with role-based routing.

## Purpose

| Phase | Usage |
|-------|-------|
| Phase 0 | Read to understand generated SKILL.md structure |
| Phase 3 | Apply with team-specific content |

---

## Template

```markdown
---
name: team-{{team_name}}
description: Unified team skill for {{team_name}} team. All roles invoke this skill with --role arg for role-specific execution. Triggers on "team {{team_name}}".
allowed-tools: {{all_roles_tools_union}}
---

# Team {{team_display_name}}

Unified team skill. All team members invoke this skill with `--role=xxx` to route to role-specific execution.

## Architecture Overview

\`\`\`
┌───────────────────────────────────────────┐
│  Skill(skill="team-{{team_name}}")         │
│  args="--role=xxx"                        │
└───────────────┬───────────────────────────┘
                │ Role Router
    ┌───────────┼───────────┬───────────┐
    ↓           ↓           ↓           ↓
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│coordinator│ │{{role_1}}│ │{{role_2}}│ │{{role_3}}│
│ roles/   │ │ roles/   │ │ roles/   │ │ roles/   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
\`\`\`

## Command Architecture

Each role is organized as a folder with a `role.md` orchestrator and optional `commands/` for delegation:

\`\`\`
roles/
{{#each roles}}
├── {{this.name}}/
│   ├── role.md              # Orchestrator (Phase 1/5 inline, Phase 2-4 delegate)
│   └── commands/            # Optional: extracted command files
│       └── *.md             # Self-contained command modules
{{/each}}
\`\`\`

**Design principle**: role.md keeps Phase 1 (Task Discovery) and Phase 5 (Report) inline. Phases 2-4 either stay inline (simple logic) or delegate to `commands/*.md` via `Read("commands/xxx.md")` when they involve subagent delegation, CLI fan-out, or complex strategies.

**Command files** are self-contained: each includes Strategy, Execution Steps, and Error Handling. Any subagent can `Read()` a command file and execute it independently.

## Role Router

### Input Parsing

Parse `$ARGUMENTS` to extract `--role`:

\`\`\`javascript
const args = "$ARGUMENTS"
const roleMatch = args.match(/--role[=\s]+(\w+)/)

if (!roleMatch) {
  // ERROR: --role is required
  // This skill must be invoked with: Skill(skill="team-{{team_name}}", args="--role=xxx")
  throw new Error("Missing --role argument. Available roles: {{role_list}}")
}

const role = roleMatch[1]
const teamName = "{{team_name}}"
\`\`\`

### Role Dispatch

\`\`\`javascript
const VALID_ROLES = {
{{#each roles}}
  "{{this.name}}": { file: "roles/{{this.name}}/role.md", prefix: "{{this.task_prefix}}" },
{{/each}}
}

if (!VALID_ROLES[role]) {
  throw new Error(\`Unknown role: \${role}. Available: \${Object.keys(VALID_ROLES).join(', ')}\`)
}

// Read and execute role-specific logic
Read(VALID_ROLES[role].file)
// → Execute the 5-phase process defined in that file
\`\`\`

### Available Roles

| Role | Task Prefix | Responsibility | Role File |
|------|-------------|----------------|-----------|
{{#each roles}}
| `{{this.name}}` | {{this.task_prefix}}-* | {{this.responsibility}} | [roles/{{this.name}}/role.md](roles/{{this.name}}/role.md) |
{{/each}}

## Shared Infrastructure

### Role Isolation Rules

**核心原则**: 每个角色仅能执行自己职责范围内的工作。

#### Output Tagging（强制）

所有角色的输出必须带 `[role_name]` 标识前缀：

\`\`\`javascript
// SendMessage — content 和 summary 都必须带标识
SendMessage({
  content: \`## [\\${role}] ...\`,
  summary: \`[\\${role}] ...\`
})

// team_msg — summary 必须带标识
mcp__ccw-tools__team_msg({
  summary: \`[\\${role}] ...\`
})
\`\`\`

#### Coordinator 隔离

| 允许 | 禁止 |
|------|------|
| 需求澄清 (AskUserQuestion) | ❌ 直接编写/修改代码 |
| 创建任务链 (TaskCreate) | ❌ 调用实现类 subagent (code-developer 等) |
| 分发任务给 worker | ❌ 直接执行分析/测试/审查 |
| 监控进度 (消息总线) | ❌ 绕过 worker 自行完成任务 |
| 汇报结果给用户 | ❌ 修改源代码或产物文件 |

#### Worker 隔离

| 允许 | 禁止 |
|------|------|
| 处理自己前缀的任务 | ❌ 处理其他角色前缀的任务 |
| SendMessage 给 coordinator | ❌ 直接与其他 worker 通信 |
| 使用 Toolbox 中声明的工具 | ❌ 为其他角色创建任务 (TaskCreate) |
| 委派给 commands/ 中的命令 | ❌ 修改不属于本职责的资源 |

### Team Configuration

\`\`\`javascript
const TEAM_CONFIG = {
  name: "{{team_name}}",
  sessionDir: ".workflow/.team-plan/{{team_name}}/",
  msgDir: ".workflow/.team-msg/{{team_name}}/",
  roles: {{roles_json}}
}
\`\`\`

### Message Bus (All Roles)

Every SendMessage **before**, must call `mcp__ccw-tools__team_msg` to log:

\`\`\`javascript
mcp__ccw-tools__team_msg({
  operation: "log",
  team: "{{team_name}}",
  from: role,          // current role name
  to: "coordinator",
  type: "<type>",
  summary: "<summary>",
  ref: "<file_path>"   // optional
})
\`\`\`

**Message types by role**:

| Role | Types |
|------|-------|
{{#each roles}}
| {{this.name}} | {{this.message_types_list}} |
{{/each}}

### CLI 回退

当 `mcp__ccw-tools__team_msg` MCP 不可用时：

\`\`\`javascript
Bash(\`ccw team log --team "{{team_name}}" --from "\${role}" --to "coordinator" --type "<type>" --summary "<摘要>" --json\`)
\`\`\`

### Task Lifecycle (All Roles)

\`\`\`javascript
// Standard task lifecycle every role follows
// Phase 1: Discovery
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith(\`\${VALID_ROLES[role].prefix}-\`) &&
  t.owner === role &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)
if (myTasks.length === 0) return // idle
const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })

// Phase 2-4: Role-specific (see roles/{role}.md)

// Phase 5: Report + Loop — 所有输出必须带 [role] 标识
mcp__ccw-tools__team_msg({ operation: "log", team: "{{team_name}}", from: role, to: "coordinator", type: "...", summary: \`[\${role}] ...\` })
SendMessage({ type: "message", recipient: "coordinator", content: \`## [\${role}] ...\`, summary: \`[\${role}] ...\` })
TaskUpdate({ taskId: task.id, status: 'completed' })
// Check for next task → back to Phase 1
\`\`\`

## Pipeline

\`\`\`
{{pipeline_diagram}}
\`\`\`

## Coordinator Spawn Template

When coordinator creates teammates, use this pattern:

\`\`\`javascript
TeamCreate({ team_name: "{{team_name}}" })

{{#each worker_roles}}
// {{this.display_name}}
Task({
  subagent_type: "general-purpose",
  team_name: "{{../team_name}}",
  name: "{{this.name}}",
  prompt: \`你是 team "{{../team_name}}" 的 {{this.name_upper}}.

当你收到 {{this.task_prefix}}-* 任务时，调用 Skill(skill="team-{{../team_name}}", args="--role={{this.name}}") 执行。

当前需求: \${taskDescription}
约束: \${constraints}

## 角色准则（强制）
- 你只能处理 {{this.task_prefix}}-* 前缀的任务，不得执行其他角色的工作
- 所有输出（SendMessage、team_msg）必须带 [{{this.name}}] 标识前缀
- 仅与 coordinator 通信，不得直接联系其他 worker
- 不得使用 TaskCreate 为其他角色创建任务

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录。

工作流程:
1. TaskList → 找到 {{this.task_prefix}}-* 任务
2. Skill(skill="team-{{../team_name}}", args="--role={{this.name}}") 执行
3. team_msg log + SendMessage 结果给 coordinator（带 [{{this.name}}] 标识）
4. TaskUpdate completed → 检查下一个任务\`
})
{{/each}}
\`\`\`

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Unknown --role value | Error with available role list |
| Missing --role arg | Error with usage hint |
| Role file not found | Error with expected path (roles/{name}/role.md) |
| Command file not found | Fall back to inline execution in role.md |
| Task prefix conflict | Log warning, proceed |
```

---

## Variable Reference

| Variable | Source | Description |
|----------|--------|-------------|
| `{{team_name}}` | config.team_name | Team identifier (lowercase) |
| `{{team_display_name}}` | config.team_display_name | Human-readable team name |
| `{{all_roles_tools_union}}` | Union of all roles' allowed-tools | Combined tool list |
| `{{roles}}` | config.roles[] | Array of role definitions |
| `{{role_list}}` | Role names joined by comma | e.g., "coordinator, planner, executor" |
| `{{roles_json}}` | JSON.stringify(roles) | Roles as JSON |
| `{{pipeline_diagram}}` | Generated from task chain | ASCII pipeline |
| `{{worker_roles}}` | config.roles excluding coordinator | Non-coordinator roles |
| `{{role.name}}` | Per-role name | e.g., "planner" |
| `{{role.task_prefix}}` | Per-role task prefix | e.g., "PLAN" |
| `{{role.responsibility}}` | Per-role responsibility | e.g., "Code exploration and planning" |
| `{{role.message_types_list}}` | Per-role message types | e.g., "`plan_ready`, `error`" |
