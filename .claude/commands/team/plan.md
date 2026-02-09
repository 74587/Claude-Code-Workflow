---
name: plan
description: Team planner - 多角度代码探索、结构化实现规划、提交coordinator审批
argument-hint: ""
allowed-tools: SendMessage(*), TaskUpdate(*), TaskList(*), TaskGet(*), TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*), Grep(*), Task(*)
group: team
---

# Team Plan Command (/team:plan)

## Overview

Team planner role command. Operates as a teammate within an Agent Team, responsible for multi-angle code exploration and structured implementation planning. Submits plans to the coordinator for approval.

**Core capabilities:**
- Task discovery from shared team task list
- Multi-angle codebase exploration (architecture/security/performance/bugfix/feature)
- Complexity-adaptive planning (Low → direct, Medium/High → agent-assisted)
- Structured plan.json generation following schema
- Plan submission and revision cycle with coordinator

## Role Definition

**Name**: `planner`
**Responsibility**: Code exploration → Implementation planning → Coordinator approval
**Communication**: SendMessage to coordinator only

## 消息总线

每次 SendMessage **前**，必须调用 `mcp__ccw-tools__team_msg` 记录消息：

```javascript
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "planner", to: "coordinator", type: "<type>", summary: "<摘要>", ref: "<文件路径>" })
```

### 支持的 Message Types

| Type | 方向 | 触发时机 | 说明 |
|------|------|----------|------|
| `plan_ready` | planner → coordinator | Plan 生成完成 | 附带 plan.json 路径和任务数摘要 |
| `plan_revision` | planner → coordinator | Plan 修订后重新提交 | 说明修改内容 |
| `impl_progress` | planner → coordinator | 探索阶段进展更新 | 可选，长时间探索时使用 |
| `error` | planner → coordinator | 遇到不可恢复错误 | 探索失败、schema缺失等 |

### 调用示例

```javascript
// Plan 就绪
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "planner", to: "coordinator", type: "plan_ready", summary: "Plan就绪: 3个task, Medium复杂度", ref: ".workflow/.team-plan/auth-impl-2026-02-09/plan.json" })

// Plan 修订
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "planner", to: "coordinator", type: "plan_revision", summary: "已按反馈拆分task-2为两个子任务" })

// 错误上报
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "planner", to: "coordinator", type: "error", summary: "plan-json-schema.json 未找到, 使用默认结构" })
```

## Execution Process

```
Phase 1: Task Discovery
   ├─ Read team config to identify coordinator
   ├─ TaskList to find PLAN-* tasks assigned to me
   ├─ TaskGet to read full task details
   └─ TaskUpdate to mark in_progress

Phase 2: Multi-Angle Exploration
   ├─ Complexity assessment (Low/Medium/High)
   ├─ Angle selection based on task type
   ├─ Semantic search via mcp__ace-tool__search_context
   ├─ Pattern search via Grep/Glob
   ├─ Complex tasks: cli-explore-agent sub-agents
   └─ Write exploration results to session folder

Phase 3: Plan Generation
   ├─ Read plan-json-schema.json for structure reference
   ├─ Low complexity → Direct Claude planning
   ├─ Medium/High → cli-lite-planning-agent
   └─ Output: plan.json

Phase 4: Submit for Approval
   ├─ SendMessage plan summary to coordinator
   ├─ Wait for approve/revision feedback
   └─ If revision → update plan → resubmit

Phase 5: Idle & Next Task
   ├─ Mark current task completed
   ├─ TaskList to check for new PLAN tasks
   └─ No tasks → idle (wait for coordinator assignment)
```

## Implementation

### Phase 1: Task Discovery

```javascript
// Read team config
const teamConfig = JSON.parse(Read(`~/.claude/teams/${teamName}/config.json`))

// Find my assigned PLAN tasks
const tasks = TaskList()
const myPlanTasks = tasks.filter(t =>
  t.subject.startsWith('PLAN-') &&
  t.owner === 'planner' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myPlanTasks.length === 0) {
  // No tasks available, idle
  return
}

// Pick first available task (lowest ID)
const task = TaskGet({ taskId: myPlanTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Multi-Angle Exploration

```javascript
// Session setup
const taskSlug = task.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const dateStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().substring(0, 10)
const sessionFolder = `.workflow/.team-plan/${taskSlug}-${dateStr}`
Bash(`mkdir -p ${sessionFolder}`)

// Complexity assessment
function assessComplexity(desc) {
  let score = 0
  if (/refactor|architect|restructure|模块|系统/.test(desc)) score += 2
  if (/multiple|多个|across|跨/.test(desc)) score += 2
  if (/integrate|集成|api|database/.test(desc)) score += 1
  if (/security|安全|performance|性能/.test(desc)) score += 1
  return score >= 4 ? 'High' : score >= 2 ? 'Medium' : 'Low'
}

const complexity = assessComplexity(task.description)

// Angle selection
const ANGLE_PRESETS = {
  architecture: ['architecture', 'dependencies', 'modularity', 'integration-points'],
  security: ['security', 'auth-patterns', 'dataflow', 'validation'],
  performance: ['performance', 'bottlenecks', 'caching', 'data-access'],
  bugfix: ['error-handling', 'dataflow', 'state-management', 'edge-cases'],
  feature: ['patterns', 'integration-points', 'testing', 'dependencies']
}

function selectAngles(desc, count) {
  const text = desc.toLowerCase()
  let preset = 'feature'
  if (/refactor|architect|restructure|modular/.test(text)) preset = 'architecture'
  else if (/security|auth|permission|access/.test(text)) preset = 'security'
  else if (/performance|slow|optimi|cache/.test(text)) preset = 'performance'
  else if (/fix|bug|error|issue|broken/.test(text)) preset = 'bugfix'
  return ANGLE_PRESETS[preset].slice(0, count)
}

const angleCount = complexity === 'High' ? 4 : (complexity === 'Medium' ? 3 : 1)
const selectedAngles = selectAngles(task.description, angleCount)

// Execute exploration
// Low complexity: direct search with mcp__ace-tool__search_context + Grep/Glob
// Medium/High: launch cli-explore-agent sub-agents in parallel

if (complexity === 'Low') {
  // Direct exploration
  const results = mcp__ace-tool__search_context({
    project_root_path: projectRoot,
    query: task.description
  })
  // Write single exploration file
  Write(`${sessionFolder}/exploration-${selectedAngles[0]}.json`, JSON.stringify({
    project_structure: "...",
    relevant_files: [],
    patterns: [],
    dependencies: [],
    integration_points: [],
    constraints: [],
    clarification_needs: [],
    _metadata: { exploration_angle: selectedAngles[0] }
  }, null, 2))
} else {
  // Launch parallel cli-explore-agent for each angle
  selectedAngles.forEach((angle, index) => {
    Task({
      subagent_type: "cli-explore-agent",
      run_in_background: false,
      description: `Explore: ${angle}`,
      prompt: `
## Task Objective
Execute **${angle}** exploration for task planning context.

## Output Location
**Session Folder**: ${sessionFolder}
**Output File**: ${sessionFolder}/exploration-${angle}.json

## Assigned Context
- **Exploration Angle**: ${angle}
- **Task Description**: ${task.description}
- **Exploration Index**: ${index + 1} of ${selectedAngles.length}

## MANDATORY FIRST STEPS
1. Run: rg -l "{relevant_keyword}" --type ts (locate relevant files)
2. Execute: cat ~/.ccw/workflows/cli-templates/schemas/explore-json-schema.json (get output schema)
3. Read: .workflow/project-tech.json (if exists - technology stack)

## Expected Output
Write JSON to: ${sessionFolder}/exploration-${angle}.json
Follow explore-json-schema.json structure with ${angle}-focused findings.
`
    })
  })
}

// Build explorations manifest
const explorationManifest = {
  session_id: `${taskSlug}-${dateStr}`,
  task_description: task.description,
  complexity: complexity,
  exploration_count: selectedAngles.length,
  explorations: selectedAngles.map(angle => ({
    angle: angle,
    file: `exploration-${angle}.json`,
    path: `${sessionFolder}/exploration-${angle}.json`
  }))
}
Write(`${sessionFolder}/explorations-manifest.json`, JSON.stringify(explorationManifest, null, 2))
```

### Phase 3: Plan Generation

```javascript
// Read schema reference
const schema = Bash(`cat ~/.ccw/workflows/cli-templates/schemas/plan-json-schema.json`)

if (complexity === 'Low') {
  // Direct Claude planning
  // Read all exploration files
  explorationManifest.explorations.forEach(exp => {
    const data = Read(exp.path)
    // Incorporate findings into plan
  })

  // Generate plan following schema
  const plan = {
    summary: "...",
    approach: "...",
    tasks: [/* structured tasks with dependencies, modification points, acceptance criteria */],
    estimated_time: "...",
    recommended_execution: "Agent",
    complexity: "Low",
    _metadata: {
      timestamp: new Date().toISOString(),
      source: "team-planner",
      planning_mode: "direct"
    }
  }
  Write(`${sessionFolder}/plan.json`, JSON.stringify(plan, null, 2))
} else {
  // Use cli-lite-planning-agent for Medium/High
  Task({
    subagent_type: "cli-lite-planning-agent",
    run_in_background: false,
    description: "Generate detailed implementation plan",
    prompt: `
Generate implementation plan and write plan.json.

## Output Location
**Session Folder**: ${sessionFolder}
**Output Files**:
- ${sessionFolder}/planning-context.md
- ${sessionFolder}/plan.json

## Output Schema Reference
Execute: cat ~/.ccw/workflows/cli-templates/schemas/plan-json-schema.json

## Task Description
${task.description}

## Multi-Angle Exploration Context
${explorationManifest.explorations.map(exp => `### Exploration: ${exp.angle}
Path: ${exp.path}`).join('\n\n')}

## Complexity Level
${complexity}

## Requirements
Generate plan.json following schema. Key constraints:
- tasks: 2-7 structured tasks (group by feature/module, NOT by file)
- Each task: id, title, scope, modification_points, implementation, acceptance, depends_on
- Prefer parallel tasks (minimize depends_on)
`
  })
}
```

### Phase 4: Submit for Approval

```javascript
// Read generated plan
const plan = JSON.parse(Read(`${sessionFolder}/plan.json`))

// Send plan summary to coordinator
SendMessage({
  type: "message",
  recipient: "coordinator",  // team lead
  content: `## Plan Ready for Review

**Task**: ${task.subject}
**Complexity**: ${complexity}
**Tasks**: ${plan.tasks.length}

### Task Summary
${plan.tasks.map((t, i) => `${i+1}. ${t.title} (${t.scope || 'N/A'})`).join('\n')}

### Approach
${plan.approach}

### Plan Location
${sessionFolder}/plan.json

Please review and approve or request revisions.`,
  summary: `Plan ready: ${plan.tasks.length} tasks`
})

// Wait for coordinator response
// If approved → mark task completed
// If revision requested → update plan based on feedback → resubmit
```

### Phase 5: After Approval

```javascript
// Mark PLAN task as completed
TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for more PLAN tasks
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('PLAN-') &&
  t.owner === 'planner' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next PLAN task → back to Phase 1
} else {
  // No more tasks, idle
  // Will be woken by coordinator message for new assignments
}
```

## Session Files

```
.workflow/.team-plan/{task-slug}-{YYYY-MM-DD}/
├── exploration-{angle1}.json      # Per-angle exploration results
├── exploration-{angle2}.json
├── explorations-manifest.json     # Exploration index
├── planning-context.md            # Evidence + understanding (Medium/High)
└── plan.json                      # Implementation plan
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| Exploration agent failure | Skip exploration, plan from task description only |
| Planning agent failure | Fallback to direct Claude planning |
| Plan rejected 3+ times | Notify coordinator, suggest alternative approach |
| No PLAN tasks available | Idle, wait for coordinator assignment |
| Schema file not found | Use basic plan structure without schema validation |
