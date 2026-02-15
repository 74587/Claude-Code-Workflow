# Phase 1: Requirements Collection (Task-Driven Inference)

Analyze task requirements, infer appropriate roles, and generate team configuration.

## Objective

- Determine team name and display name
- **Analyze task description → infer needed roles** (coordinator always included)
- For each role: name, responsibility, task prefix, capabilities
- Build pipeline from inferred roles
- Generate team-config.json

## Input

- User request (`$ARGUMENTS` or interactive input)
- Specification: `specs/team-design-patterns.md` (read in Phase 0)

## Execution Steps

### Step 1: Team Name + Task Description

```javascript
const teamInfo = await AskUserQuestion({
  questions: [
    {
      question: "团队名称是什么？（小写，用作 skill 文件夹名：.claude/skills/team-{name}/）",
      header: "Team Name",
      multiSelect: false,
      options: [
        { label: "自定义", description: "输入自定义团队名称" },
        { label: "dev", description: "通用开发团队" },
        { label: "spec", description: "规格文档团队" },
        { label: "security", description: "安全审计团队" }
      ]
    },
    {
      question: "这个团队的核心任务是什么？（描述目标场景，系统将自动推断所需角色）",
      header: "Task Desc",
      multiSelect: false,
      options: [
        { label: "自定义", description: "输入具体任务描述，如：实现新功能并确保质量" },
        { label: "全栈开发", description: "需求分析 → 规划 → 编码 → 测试 → 审查" },
        { label: "代码审查与重构", description: "代码分析 → 问题发现 → 重构实施 → 验证" },
        { label: "文档编写", description: "调研 → 讨论 → 撰写 → 审校" }
      ]
    }
  ]
})
```

### Step 2: Role Inference (Task-Driven)

```javascript
// Coordinator 始终存在
const roles = [{
  name: "coordinator",
  responsibility_type: "Orchestration",
  task_prefix: null,  // coordinator creates tasks, doesn't receive them
  description: "Pipeline orchestration, team lifecycle, cross-stage coordination"
}]

// 角色需求分析矩阵 — 根据任务描述中的意图信号推断角色
const taskDesc = teamInfo["Task Desc"]

const ROLE_SIGNALS = {
  planner: {
    signals: /规划|计划|设计|架构|plan|design|architect|分析需求|探索|explore/i,
    role: { name: "planner", responsibility_type: "Orchestration", task_prefix: "PLAN", description: "Code exploration and implementation planning" }
  },
  executor: {
    signals: /实现|开发|编码|编写|创建|构建|implement|develop|build|code|create|重构|refactor|迁移|migrate/i,
    role: { name: "executor", responsibility_type: "Code generation", task_prefix: "IMPL", description: "Code implementation following approved plan" }
  },
  tester: {
    signals: /测试|验证|质量|test|verify|validate|QA|回归|regression|修复|fix|bug/i,
    role: { name: "tester", responsibility_type: "Validation", task_prefix: "TEST", description: "Test execution and fix cycles" }
  },
  reviewer: {
    signals: /审查|审核|review|audit|检查|inspect|代码质量|code quality/i,
    role: { name: "reviewer", responsibility_type: "Read-only analysis", task_prefix: "REVIEW", description: "Multi-dimensional code review" }
  },
  analyst: {
    signals: /调研|研究|分析|research|analyze|探索|investigate|诊断|diagnose/i,
    role: { name: "analyst", responsibility_type: "Orchestration", task_prefix: "RESEARCH", description: "Codebase exploration and context collection" }
  },
  writer: {
    signals: /文档|撰写|编写文档|document|write doc|生成报告|report/i,
    role: { name: "writer", responsibility_type: "Code generation", task_prefix: "DRAFT", description: "Document drafting following templates" }
  },
  debugger: {
    signals: /debug|调试|排查|定位问题|根因|root cause|故障|troubleshoot/i,
    role: { name: "debugger", responsibility_type: "Orchestration", task_prefix: "DEBUG", description: "Bug diagnosis and root cause analysis" }
  },
  security: {
    signals: /安全|漏洞|security|vulnerability|渗透|penetration|OWASP|合规|compliance/i,
    role: { name: "security", responsibility_type: "Read-only analysis", task_prefix: "SEC", description: "Security analysis and vulnerability assessment" }
  }
}

// 推断角色：匹配信号 + 隐含角色补全
const inferredRoles = []
for (const [key, entry] of Object.entries(ROLE_SIGNALS)) {
  if (entry.signals.test(taskDesc)) {
    inferredRoles.push(entry.role)
  }
}

// 隐含角色补全规则：
// - 有 executor 必有 planner（编码前需要规划）
// - 有 executor 必有 tester（编码后需要验证）
// - 有 debugger 必有 tester（调试需要验证修复）
// - 有 writer 必有 reviewer（文档需要审校）
const hasRole = name => inferredRoles.some(r => r.name === name)
if (hasRole('executor') && !hasRole('planner')) {
  inferredRoles.unshift(ROLE_SIGNALS.planner.role)
}
if (hasRole('executor') && !hasRole('tester')) {
  inferredRoles.push(ROLE_SIGNALS.tester.role)
}
if (hasRole('debugger') && !hasRole('tester')) {
  inferredRoles.push(ROLE_SIGNALS.tester.role)
}
if (hasRole('writer') && !hasRole('reviewer')) {
  inferredRoles.push(ROLE_SIGNALS.reviewer.role)
}

// 最少保证 2 个 worker 角色
if (inferredRoles.length < 2) {
  // 回退：标准 plan → implement → test → review
  inferredRoles.length = 0
  inferredRoles.push(
    ROLE_SIGNALS.planner.role,
    ROLE_SIGNALS.executor.role,
    ROLE_SIGNALS.tester.role,
    ROLE_SIGNALS.reviewer.role
  )
}

// 去重 + 加入总角色列表
const seen = new Set()
for (const role of inferredRoles) {
  if (!seen.has(role.name)) {
    seen.add(role.name)
    roles.push(role)
  }
}

// 推断 pipeline 类型标签（用于后续 Step 5）
const pipelineType = inferredRoles.some(r => r.name === 'writer') ? 'Document'
  : inferredRoles.some(r => r.name === 'debugger') ? 'Debug'
  : 'Standard'
```

### Step 3: Role Confirmation (Interactive)

```javascript
// 展示推断结果，让用户确认或调整
const workerRoles = roles.filter(r => r.name !== 'coordinator')
const rolesSummary = workerRoles
  .map(r => `${r.name} (${r.responsibility_type}, ${r.task_prefix})`)
  .join('\n')

const confirmation = await AskUserQuestion({
  questions: [
    {
      question: `根据任务描述，推断出以下角色：\n${rolesSummary}\n\n是否需要调整？`,
      header: "Confirm",
      multiSelect: false,
      options: [
        { label: "确认使用 (Recommended)", description: "使用推断的角色组合" },
        { label: "添加角色", description: "在推断结果基础上添加角色" },
        { label: "移除角色", description: "移除某些不需要的角色" },
        { label: "重新描述", description: "重新输入任务描述，重新推断" }
      ]
    }
  ]
})

if (confirmation["Confirm"].includes("添加角色")) {
  const newRole = await AskUserQuestion({
    questions: [
      {
        question: "新角色名称？（小写）",
        header: "Role Name",
        multiSelect: false,
        options: [
          { label: "自定义", description: "输入自定义角色名" },
          { label: "deployer", description: "部署和发布管理" },
          { label: "documenter", description: "文档生成" },
          { label: "monitor", description: "监控和告警" }
        ]
      },
      {
        question: "角色职责类型？",
        header: "Type",
        multiSelect: false,
        options: [
          { label: "Read-only analysis", description: "分析/审查/报告（不修改文件）" },
          { label: "Code generation", description: "写/改代码文件" },
          { label: "Orchestration", description: "协调子任务和 agent" },
          { label: "Validation", description: "测试/验证/审计" }
        ]
      }
    ]
  })
  // Add to roles array
}
```

### Step 4: Capability Selection (Per Role)

```javascript
// For each worker role, determine capabilities
for (const role of roles.filter(r => r.name !== 'coordinator')) {
  // Infer capabilities from responsibility type
  const baseTools = ["SendMessage(*)", "TaskUpdate(*)", "TaskList(*)", "TaskGet(*)", "TodoWrite(*)", "Read(*)", "Bash(*)", "Glob(*)", "Grep(*)"]

  if (role.responsibility_type === "Code generation") {
    role.allowed_tools = [...baseTools, "Write(*)", "Edit(*)", "Task(*)"]
    role.adaptive_routing = true
  } else if (role.responsibility_type === "Orchestration") {
    role.allowed_tools = [...baseTools, "Write(*)", "Task(*)"]
    role.adaptive_routing = true
  } else if (role.responsibility_type === "Validation") {
    role.allowed_tools = [...baseTools, "Write(*)", "Edit(*)", "Task(*)"]
    role.adaptive_routing = false
  } else {
    // Read-only analysis
    role.allowed_tools = [...baseTools, "Task(*)"]
    role.adaptive_routing = false
  }

  // Infer message types
  const roleMsgTypes = {
    "Read-only analysis": [
      { type: `${role.name}_result`, trigger: "Analysis complete" },
      { type: "error", trigger: "Blocking error" }
    ],
    "Code generation": [
      { type: `${role.name}_complete`, trigger: "Generation complete" },
      { type: `${role.name}_progress`, trigger: "Batch progress" },
      { type: "error", trigger: "Blocking error" }
    ],
    "Orchestration": [
      { type: `${role.name}_ready`, trigger: "Results ready" },
      { type: `${role.name}_progress`, trigger: "Progress update" },
      { type: "error", trigger: "Blocking error" }
    ],
    "Validation": [
      { type: `${role.name}_result`, trigger: "Validation complete" },
      { type: "fix_required", trigger: "Critical issues found" },
      { type: "error", trigger: "Blocking error" }
    ]
  }
  role.message_types = roleMsgTypes[role.responsibility_type] || []
}

// Coordinator special config
roles[0].allowed_tools = [
  "TeamCreate(*)", "TeamDelete(*)", "SendMessage(*)",
  "TaskCreate(*)", "TaskUpdate(*)", "TaskList(*)", "TaskGet(*)",
  "Task(*)", "AskUserQuestion(*)", "TodoWrite(*)",
  "Read(*)", "Bash(*)", "Glob(*)", "Grep(*)"
]
roles[0].message_types = [
  { type: "plan_approved", trigger: "Plan approved" },
  { type: "plan_revision", trigger: "Revision requested" },
  { type: "task_unblocked", trigger: "Task unblocked" },
  { type: "shutdown", trigger: "Team shutdown" },
  { type: "error", trigger: "Coordination error" }
]
```

### Step 4b: Toolbox Inference (Per Role)

```javascript
// Infer commands, subagents, and CLI tools based on responsibility type
const toolboxMap = {
  "Read-only analysis": {
    commands: ["review", "analyze"],
    subagents: [],
    cli_tools: [
      { tool: "gemini", mode: "analysis", purpose: "Multi-perspective code analysis" },
      { tool: "codex", mode: "review", purpose: "Git-aware code review" }
    ],
    phase_commands: { phase2: null, phase3: "analyze", phase4: null }
  },
  "Code generation": {
    commands: ["implement", "validate"],
    subagents: [
      { type: "code-developer", purpose: "Complex implementation delegation" }
    ],
    cli_tools: [],
    phase_commands: { phase2: null, phase3: "implement", phase4: "validate" }
  },
  "Orchestration": {
    commands: ["explore", "plan"],
    subagents: [
      { type: "cli-explore-agent", purpose: "Multi-angle codebase exploration" },
      { type: "cli-lite-planning-agent", purpose: "Structured planning" }
    ],
    cli_tools: [
      { tool: "gemini", mode: "analysis", purpose: "Architecture analysis" }
    ],
    phase_commands: { phase2: "explore", phase3: null, phase4: null }
  },
  "Validation": {
    commands: ["validate"],
    subagents: [
      { type: "code-developer", purpose: "Test-fix iteration" }
    ],
    cli_tools: [],
    phase_commands: { phase2: null, phase3: "validate", phase4: null }
  }
}

for (const role of roles.filter(r => r.name !== 'coordinator')) {
  const toolbox = toolboxMap[role.responsibility_type] || { commands: [], subagents: [], cli_tools: [], phase_commands: {} }
  role.commands = toolbox.commands
  role.subagents = toolbox.subagents
  role.cli_tools = toolbox.cli_tools
  role.phase_commands = toolbox.phase_commands
}

// Coordinator always gets dispatch + monitor
roles[0].commands = ["dispatch", "monitor"]
roles[0].subagents = []
roles[0].cli_tools = []
roles[0].phase_commands = { phase2: null, phase3: "dispatch", phase4: "monitor" }
```

### Step 5: Pipeline Definition (Dynamic)

```javascript
// 从推断的角色动态构建 pipeline
// 排序权重：分析/探索类 < 规划类 < 实现类 < 验证/审查类
const PHASE_ORDER = {
  analyst: 1, debugger: 1, security: 1,
  planner: 2,
  executor: 3, writer: 3,
  tester: 4, reviewer: 4
}

function buildPipeline(roles) {
  const workers = roles
    .filter(r => r.name !== 'coordinator')
    .sort((a, b) => (PHASE_ORDER[a.name] || 3) - (PHASE_ORDER[b.name] || 3))

  // 按阶段分组
  const phaseGroups = {}
  for (const r of workers) {
    const order = PHASE_ORDER[r.name] || 3
    if (!phaseGroups[order]) phaseGroups[order] = []
    phaseGroups[order].push(r)
  }

  // 构建依赖链：每个阶段依赖前一阶段的所有角色
  const stages = []
  const sortedPhases = Object.keys(phaseGroups).map(Number).sort((a, b) => a - b)
  let prevPrefixes = []

  for (const phase of sortedPhases) {
    const group = phaseGroups[phase]
    for (const r of group) {
      stages.push({
        name: r.task_prefix,
        role: r.name,
        blockedBy: [...prevPrefixes]
      })
    }
    prevPrefixes = group.map(r => r.task_prefix)
  }

  // 生成 pipeline 图
  const diagramParts = sortedPhases.map(phase => {
    const group = phaseGroups[phase]
    if (group.length === 1) return `[${group[0].task_prefix}: ${group[0].name}]`
    return `[${group.map(r => `${r.task_prefix}`).join(' + ')}: ${group.map(r => r.name).join('/')}]`
  })
  const diagram = `需求 → ${diagramParts.join(' → ')} → 汇报`

  return { stages, diagram }
}

const pipeline = buildPipeline(roles)
```

### Step 6: Generate Configuration

```javascript
const teamName = teamInfo["Team Name"] === "自定义"
  ? teamInfo["Team Name_other"]
  : teamInfo["Team Name"]

const config = {
  team_name: teamName,
  team_display_name: teamName.charAt(0).toUpperCase() + teamName.slice(1),
  skill_name: `team-${teamName}`,
  skill_path: `.claude/skills/team-${teamName}/`,
  pipeline_type: pipelineType,
  pipeline: pipeline,
  roles: roles.map(r => ({
    ...r,
    display_name: `${teamName} ${r.name}`,
    name_upper: r.name.toUpperCase()
  })),
  worker_roles: roles.filter(r => r.name !== 'coordinator').map(r => ({
    ...r,
    display_name: `${teamName} ${r.name}`,
    name_upper: r.name.toUpperCase()
  })),
  all_roles_tools_union: [...new Set(roles.flatMap(r => r.allowed_tools))].join(', '),
  role_list: roles.map(r => r.name).join(', ')
}

Write(`${workDir}/team-config.json`, JSON.stringify(config, null, 2))
```

## Output

- **File**: `team-config.json`
- **Format**: JSON
- **Location**: `{workDir}/team-config.json`

## Quality Checklist

- [ ] Team name is lowercase, valid as folder/skill name
- [ ] Coordinator is always included
- [ ] At least 2 worker roles defined
- [ ] Task prefixes are UPPERCASE and unique across roles
- [ ] Pipeline stages reference valid roles
- [ ] All roles have message types defined
- [ ] Allowed tools include minimum set per role

## Next Phase

-> [Phase 2: Pattern Analysis](02-pattern-analysis.md)
