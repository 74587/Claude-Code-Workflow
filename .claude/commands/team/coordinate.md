---
name: coordinate
description: Team coordinator - 需求澄清、MVP路线图、创建持久化agent team、跨阶段协调plan/execute/test/review
argument-hint: "[--team-name=NAME] \"task description\""
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Task(*), AskUserQuestion(*), TodoWrite(*), Read(*), Bash(*), Glob(*), Grep(*)
group: team
---

# Team Coordinate Command (/team:coordinate)

纯调度协调器。需求澄清 → 创建 Team → 创建任务链 → 协调消息 → 持久循环。具体工作逻辑由各 teammate 调用自己的 skill 完成。

## 消息总线

所有 teammate 在 SendMessage 的**同时**必须调用 `mcp__ccw-tools__team_msg` 记录消息，实现持久化和用户可观测：

```javascript
// 记录消息（每个 teammate 发 SendMessage 前调用）
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "planner", to: "coordinator", type: "plan_ready", summary: "Plan就绪: 3个task", ref: ".workflow/.team-plan/auth-team/plan.json" })

// Coordinator 查看全部消息
mcp__ccw-tools__team_msg({ operation: "list", team: teamName })

// 按角色过滤
mcp__ccw-tools__team_msg({ operation: "list", team: teamName, from: "tester", last: 5 })

// 查看团队状态
mcp__ccw-tools__team_msg({ operation: "status", team: teamName })

// 读取特定消息
mcp__ccw-tools__team_msg({ operation: "read", team: teamName, id: "MSG-003" })
```

**日志位置**: `.workflow/.team-msg/{team-name}/messages.jsonl`
**消息类型**: `plan_ready | plan_approved | plan_revision | task_unblocked | impl_complete | impl_progress | test_result | review_result | fix_required | error | shutdown`

### CLI 回退

当 `mcp__ccw-tools__team_msg` MCP 不可用时，使用 `ccw team` CLI 作为等效回退：

```javascript
// 回退: 将 MCP 调用替换为 Bash CLI（参数一一对应）
// log
Bash(`ccw team log --team "${teamName}" --from "coordinator" --to "planner" --type "plan_approved" --summary "Plan已批准" --json`)
// list
Bash(`ccw team list --team "${teamName}" --last 10 --json`)
// list (带过滤)
Bash(`ccw team list --team "${teamName}" --from "tester" --last 5 --json`)
// status
Bash(`ccw team status --team "${teamName}" --json`)
// read
Bash(`ccw team read --team "${teamName}" --id "MSG-003" --json`)
```

**参数映射**: `team_msg(params)` → `ccw team <operation> --team <team> [--from/--to/--type/--summary/--ref/--data/--id/--last] [--json]`

## Usage

```bash
/team:coordinate "实现用户认证模块"
/team:coordinate --team-name=auth-team "实现JWT刷新令牌"
```

## Pipeline

```
需求 → [PLAN: planner] → coordinator 审批 → [IMPL: executor] → [TEST + REVIEW: tester] → 汇报 → 等待新需求/关闭
```

## Execution

### Phase 1: 需求澄清

解析 `$ARGUMENTS` 获取 `--team-name` 和任务描述。使用 AskUserQuestion 收集：
- MVP 范围（最小可行 / 功能完整 / 全面实现）
- 关键约束（向后兼容 / 遵循模式 / 测试覆盖 / 性能敏感）

简单任务可跳过澄清。

### Phase 2: 创建 Team + Spawn 3 Teammates

```javascript
TeamCreate({ team_name: teamName })
```

**Spawn 时只传角色和需求，工作细节由 skill 定义**：

```javascript
// Planner
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "planner",
  mode: "plan",
  prompt: `你是 team "${teamName}" 的 PLANNER。

当你收到 PLAN 任务时，调用 Skill(skill="team:plan") 执行规划工作。

当前需求: ${taskDescription}
约束: ${constraints}
复杂度: ${complexity}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录：
mcp__ccw-tools__team_msg({ operation: "log", team: "${teamName}", from: "planner", to: "coordinator", type: "<type>", summary: "<摘要>", ref: "<文件路径>" })

工作流程:
1. TaskList → 找到分配给你的 PLAN-* 任务
2. Skill(skill="team:plan") 执行探索和规划
3. team_msg log + SendMessage 将 plan 摘要发给 coordinator
4. 等待 coordinator 审批或修改反馈
5. 审批通过 → TaskUpdate completed → 检查下一个 PLAN 任务`
})

// Executor
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "executor",
  prompt: `你是 team "${teamName}" 的 EXECUTOR。

当你收到 IMPL 任务时，调用 Skill(skill="team:execute") 执行代码实现。

当前需求: ${taskDescription}
约束: ${constraints}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录：
mcp__ccw-tools__team_msg({ operation: "log", team: "${teamName}", from: "executor", to: "coordinator", type: "<type>", summary: "<摘要>" })

工作流程:
1. TaskList → 找到未阻塞的 IMPL-* 任务
2. Skill(skill="team:execute") 执行实现
3. team_msg log + SendMessage 报告完成状态和变更文件
4. TaskUpdate completed → 检查下一个 IMPL 任务`
})

// Tester (同时处理 TEST 和 REVIEW)
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "tester",
  prompt: `你是 team "${teamName}" 的 TESTER，同时负责测试和审查。

- 收到 TEST-* 任务 → 调用 Skill(skill="team:test") 执行测试修复循环
- 收到 REVIEW-* 任务 → 调用 Skill(skill="team:review") 执行代码审查

当前需求: ${taskDescription}
约束: ${constraints}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录：
mcp__ccw-tools__team_msg({ operation: "log", team: "${teamName}", from: "tester", to: "coordinator", type: "<type>", summary: "<摘要>" })

工作流程:
1. TaskList → 找到未阻塞的 TEST-* 或 REVIEW-* 任务
2. 根据任务类型调用对应 Skill
3. team_msg log + SendMessage 报告结果给 coordinator
4. TaskUpdate completed → 检查下一个任务`
})
```

### Phase 3: 创建任务链

```javascript
// PLAN-001 → IMPL-001 → TEST-001 + REVIEW-001
TaskCreate({ subject: "PLAN-001: 探索和规划实现", description: `${taskDescription}\n\n写入: .workflow/.team-plan/${teamName}/`, activeForm: "规划中" })
TaskUpdate({ taskId: planId, owner: "planner" })

TaskCreate({ subject: "IMPL-001: 实现已批准的计划", description: `${taskDescription}\n\nPlan: .workflow/.team-plan/${teamName}/plan.json`, activeForm: "实现中" })
TaskUpdate({ taskId: implId, owner: "executor", addBlockedBy: [planId] })

TaskCreate({ subject: "TEST-001: 测试修复循环", description: `${taskDescription}`, activeForm: "测试中" })
TaskUpdate({ taskId: testId, owner: "tester", addBlockedBy: [implId] })

TaskCreate({ subject: "REVIEW-001: 代码审查与需求验证", description: `${taskDescription}\n\nPlan: .workflow/.team-plan/${teamName}/plan.json`, activeForm: "审查中" })
TaskUpdate({ taskId: reviewId, owner: "tester", addBlockedBy: [implId] })
```

### Phase 4: 协调主循环

接收 teammate 消息，根据内容做调度决策。**每次做出决策前先 `team_msg list` 查看最近消息，每次做出决策后 `team_msg log` 记录**：

| 收到消息 | 操作 |
|----------|------|
| Planner: plan 就绪 | 读取 plan → 审批/修改 → team_msg log(plan_approved/plan_revision) → TaskUpdate + SendMessage |
| Executor: 实现完成 | team_msg log(task_unblocked) → TaskUpdate IMPL completed → SendMessage 通知 tester |
| Tester: 测试结果 >= 95% | team_msg log(test_result) → TaskUpdate TEST completed |
| Tester: 测试结果 < 95% 且迭代 > 5 | team_msg log(error) → 上报用户 |
| Tester: 审查无 critical | team_msg log(review_result) → TaskUpdate REVIEW completed |
| Tester: 审查发现 critical | team_msg log(fix_required) → TaskCreate IMPL-fix → 分配 executor |
| 所有任务 completed | → Phase 5 |

**用户可随时查看团队状态**：
```bash
# 用户在任意时刻调用查看
mcp__ccw-tools__team_msg({ operation: "status", team: teamName })
mcp__ccw-tools__team_msg({ operation: "list", team: teamName, last: 10 })
```

### Phase 5: 汇报 + 持久循环

汇总变更文件、测试通过率、审查结果报告用户。

```javascript
AskUserQuestion({
  questions: [{
    question: "当前需求已完成。下一步：",
    header: "Next",
    multiSelect: false,
    options: [
      { label: "新需求", description: "提交新需求给当前团队" },
      { label: "关闭团队", description: "关闭所有 teammate 并清理" }
    ]
  }]
})
// 新需求 → 回到 Phase 1（复用 team，新建 PLAN/IMPL/TEST/REVIEW 任务）
// 关闭 → shutdown_request 给每个 teammate → TeamDelete()
```

## 错误处理

| 场景 | 处理 |
|------|------|
| Teammate 无响应 | 发追踪消息，2次无响应 → 重新 spawn |
| Plan 被拒 3+ 次 | Coordinator 自行规划 |
| 测试卡在 <80% 超 5 次迭代 | 上报用户 |
| Review 发现 critical | 创建 IMPL-fix 任务给 executor |
