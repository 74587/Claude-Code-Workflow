# Codex Subagent 策略补充文档

## 1. 核心架构特点

| 特点 | 说明 |
|------|------|
| **独立会话上下文** | 每个 subagent 有独立 `agent_id`，上下文完全隔离 |
| **并行执行** | 可同时创建多个 subagent 并行处理不同子任务 |
| **无状态恢复** | `close_agent` 后不可恢复，需重新创建并粘贴旧输出 |
| **显式生命周期** | 需主动管理创建、等待、关闭全流程 |
| **无系统提示词** | subagent 无内置 system prompt，需在首条消息加载角色 |

## 2. API 调用模式

### 2.1 标准流程

```
spawn_agent → wait → [send_input] → close_agent
     ↓          ↓         ↓              ↓
  创建任务   获取结果   追问纠偏      清理回收
```

### 2.2 关键 API 语义

| API | 作用 | 注意事项 |
|-----|------|----------|
| `spawn_agent({ message })` | 创建 subagent | 返回 `agent_id` |
| `wait({ ids, timeout_ms })` | 获取结果 | **唯一取结果入口**，非 close |
| `send_input({ id, message, interrupt })` | 继续交互 | `interrupt=true` 慎用 |
| `close_agent({ id })` | 关闭回收 | 不可逆，关闭后无法恢复 |

### 2.3 常见误区

- **误区**：以为 `close_agent` 返回结果
- **正解**：`wait` 才是获取结果的入口，`close_agent` 只是清理

- **误区**：`timeout` 超时 = 任务失败
- **正解**：超时只表示未在指定时间内完成，可继续 `wait` 或 `send_input` 催促

## 3. 与 Claude Code Task 工具对比

| 维度 | Codex Subagent | Claude Code Task |
|------|----------------|------------------|
| **创建方式** | `spawn_agent({ message })` | `Task({ subagent_type, prompt })` |
| **结果获取** | `wait({ ids })` 显式等待 | 同步返回或 `TaskOutput` 轮询 |
| **多 agent 等待** | 支持批量 `wait({ ids: [a,b,c] })` | 需分别调用或并行发起 |
| **追问/纠偏** | `send_input` 继续交互 | 需 `resume` 参数恢复 agent |
| **中断能力** | `interrupt=true` 可打断 | 无对应机制 |
| **生命周期** | 需显式 `close_agent` 清理 | 自动回收 |
| **系统提示词** | **无**，需首条消息加载角色 | 内置 agent 定义 |
| **上下文传递** | 在 message 中显式传递 | 部分 agent 可访问当前上下文 |

### 3.1 适用场景对比

**Codex Subagent 更适合**：
- 需要批量等待多个并行任务的场景
- 需要多轮交互、迭代纠偏的复杂任务
- 对 agent 生命周期有精细控制需求

**Claude Code Task 更适合**：
- 单次执行、快速返回的任务
- 需要利用预定义 agent 类型的场景
- 简单的并行任务分发

## 4. 角色加载规范（关键差异）

### 4.1 问题背景

Codex subagent **没有系统提示词**，无法像 Claude Code 那样通过 `subagent_type` 自动加载角色定义。

**解决方案**：在 `spawn_agent` 的首条 message 中显式加载角色文件。

### 4.2 角色文件位置

```
~/.codex/agents/
├── cli-explore-agent.md          # 代码探索
├── cli-lite-planning-agent.md    # 轻量规划
├── code-developer.md             # 代码开发
├── context-search-agent.md       # 上下文搜索
├── debug-explore-agent.md        # 调试探索
├── doc-generator.md              # 文档生成
└── ... (共 20+ 角色)
```

### 4.3 角色加载模板

```javascript
// 标准 spawn_agent 消息结构（角色路径传递，agent 自己读取）
spawn_agent({
  message: `
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/{agent-type}.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

## TASK CONTEXT
${taskContext}

## DELIVERABLES
${deliverables}
`
})
```

> **注意**：角色文件由 agent 自己读取，主流程只传递路径。详见 §9.1 角色加载模式。

### 4.4 角色映射表

| Claude subagent_type | Codex 角色文件 |
|----------------------|----------------|
| `cli-explore-agent` | `~/.codex/agents/cli-explore-agent.md` |
| `cli-lite-planning-agent` | `~/.codex/agents/cli-lite-planning-agent.md` |
| `code-developer` | `~/.codex/agents/code-developer.md` |
| `context-search-agent` | `~/.codex/agents/context-search-agent.md` |
| `debug-explore-agent` | `~/.codex/agents/debug-explore-agent.md` |
| `doc-generator` | `~/.codex/agents/doc-generator.md` |
| `action-planning-agent` | `~/.codex/agents/action-planning-agent.md` |
| `test-fix-agent` | `~/.codex/agents/test-fix-agent.md` |
| `universal-executor` | `~/.codex/agents/universal-executor.md` |

## 5. 结构化交付模式

### 5.1 推荐输出模板

```text
Summary:
- 一句话总结任务完成情况

Findings:
- 发现 1：具体描述
- 发现 2：具体描述

Proposed changes:
- 文件/模块：path/to/file
- 变更点：具体修改内容
- 风险点：潜在影响

Tests:
- 需要新增/更新的用例：
- 需要运行的测试命令：

Open questions:
1. 待澄清问题 1
2. 待澄清问题 2
```

### 5.2 两阶段工作流

```
阶段 1：澄清
  spawn_agent → 只输出 Open questions
       ↓
  主 agent 回答问题
       ↓
阶段 2：执行
  send_input → 输出完整方案
```

**优势**：减少因理解偏差导致的返工

## 6. 并行拆分策略

### 6.1 按职责域拆分（推荐）

| Worker | 职责 | 交付物 | 禁止事项 |
|--------|------|--------|----------|
| **A（调研）** | 定位入口、调用链、相似实现 | 文件+符号+证据点 | 不写方案 |
| **B（方案）** | 最小改动实现路径 | 变更点清单+风险评估 | 不写代码 |
| **C（测试）** | 测试策略、边界条件 | 用例列表+覆盖点 | 不实现测试 |

### 6.2 按模块域拆分

```
Worker 1: src/auth/**     → 认证模块变更
Worker 2: src/api/**      → API 层变更
Worker 3: src/database/** → 数据层变更
```

### 6.3 拆分原则

1. **文件隔离**：避免多个 subagent 同时建议修改同一文件
2. **职责单一**：每个 subagent 只做一件事
3. **边界清晰**：超出范围必须在 `Open questions` 请求确认
4. **最小上下文**：只传递完成任务所需的最小信息

## 7. 消息设计规范

### 7.1 spawn_agent message 结构（角色路径传递）

```text
## TASK ASSIGNMENT

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/{agent-type}.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json

---

Goal: 一句话目标（做什么）

Scope:
- 可做：允许的操作范围
- 不可做：明确禁止的事项
- 目录限制：只看 src/auth/**
- 依赖限制：不允许引入新依赖

Context:
- 关键路径：src/auth/login.ts
- 现状摘要：当前使用 JWT 认证
- 约束条件：必须兼容现有 API

Deliverables:
- 按模板输出 Summary/Findings/Proposed changes/Tests/Open questions

Quality bar:
- 验收标准 1
- 验收标准 2
```

> **注意**：角色文件路径放在 MANDATORY FIRST STEPS，由 agent 自己读取。主流程不传递角色内容。

### 7.2 send_input 追问模式

```text
# 回答澄清问题
Re: Open question 1 - 答案是 XXX
Re: Open question 2 - 请按 YYY 方式处理

# 请继续输出完整方案
```

## 8. 错误处理与恢复

### 8.1 超时处理

```
wait(timeout=30s) → timed_out=true
     ↓
选项 1: 继续 wait，等待完成
选项 2: send_input 催促收敛
选项 3: close_agent 放弃
```

### 8.2 已关闭 agent 恢复

```
close_agent(id) → agent 不可恢复
     ↓
spawn_agent(new_message) → 创建新 agent
     ↓
在 message 中粘贴旧输出作为上下文
```

## 9. 最佳实践清单

- [ ] **角色文件路径传递**：在 MANDATORY FIRST STEPS 中指定 `~/.codex/agents/*.md` 路径，由 agent 自己读取
- [ ] 创建前明确 Goal/Scope/Context/Deliverables/Quality bar
- [ ] 按职责或模块域拆分，避免文件冲突
- [ ] 要求统一输出模板，便于合并
- [ ] 用 `wait` 获取结果，不依赖 `close_agent`
- [ ] 复杂任务使用两阶段工作流（先澄清后执行）
- [ ] 不要提前 close，除非确定不再需要交互
- [ ] 超时后评估是否继续等待或催促收敛
- [ ] 合并结果时检查冲突和一致性

### 9.1 角色加载模式（重要）

**❌ 错误模式：主流程读取角色内容并传递**
```javascript
// 主流程读取角色文件内容
const exploreRole = Read('~/.codex/agents/cli-explore-agent.md')

spawn_agent({
  message: `
## ROLE DEFINITION
${exploreRole}  // 内容嵌入到 message 中

## TASK
...
`
})
```

**问题**：
- message 体积膨胀，传输开销大
- 角色内容在主流程上下文中占用空间
- 不符合 agent 自主性原则

**✅ 正确模式：传递路径，agent 自己读取**
```javascript
spawn_agent({
  message: `
## TASK ASSIGNMENT
...

### MANDATORY FIRST STEPS (Agent Execute)
1. **Read role definition**: ~/.codex/agents/cli-explore-agent.md (MUST read first)
2. Read: .workflow/project-tech.json
3. Read: .workflow/project-guidelines.json
...
`
})
```

**优势**：
- message 精简，只传递任务相关内容
- agent 拥有完整的角色理解上下文
- 遵循 agent 自主执行原则

---

## 10. Subagent 深度交互准则

### 10.1 核心理念：充分交流优于多次调用

**传统模式问题**：
- 探索 → 澄清 → 规划 分离执行，上下文断裂
- 每个阶段独立 subagent，信息传递有损耗
- 多轮用户交互，体验割裂

**优化理念**：
- **单 subagent 深度交互** > 多 subagent 浅层调用
- **澄清与规划合并**，一次完成上下文积累
- **send_input 多轮对话**，保持上下文连贯

### 10.2 澄清 + 规划合并模式

**原有分离模式**（Claude lite-plan）：
```
Phase 1: spawn explore-agent × N → wait → close
Phase 2: 主 agent 收集澄清问题 → 用户回答
Phase 3: spawn planning-agent → wait → close
```

**优化合并模式**（Codex 推荐）：
```
Phase 1: spawn explore-agent × N → wait (保持 agent 活跃)
Phase 2: send_input 传递澄清答案 → agent 继续生成 plan
Phase 3: wait 获取最终 plan → close
```

**实现示例**：
```javascript
// ==================== 合并模式：探索 + 澄清 + 规划 ====================

// Step 1: 创建探索 agent（带规划能力）
const exploreRole = Read('~/.codex/agents/cli-explore-agent.md')
const planningRole = Read('~/.codex/agents/cli-lite-planning-agent.md')

const agent = spawn_agent({
  message: `
## ROLE DEFINITION (DUAL ROLE)

### Primary: Exploration
${exploreRole}

### Secondary: Planning (activated after clarification)
${planningRole}

---

## TASK ASSIGNMENT

### Phase 1: Exploration
Goal: Explore codebase for "${task_description}"
Output: Structured findings + clarification questions (if any)

### Phase 2: Await Clarification (if questions exist)
Output format for questions:
\`\`\`
CLARIFICATION_NEEDED:
Q1: [question] | Options: [A, B, C] | Recommended: [A]
Q2: [question] | Options: [A, B] | Recommended: [B]
\`\`\`

### Phase 3: Generate Plan (after clarification)
Trigger: Receive clarification answers via send_input
Output: plan.json following schema

### Deliverables
- exploration.json (Phase 1)
- plan.json (Phase 3, after clarification)
`
})

// Step 2: 等待探索结果
const exploreResult = wait({ ids: [agent], timeout_ms: 600000 })

// Step 3: 解析是否需要澄清
const needsClarification = exploreResult.status[agent].completed.includes('CLARIFICATION_NEEDED')

if (needsClarification) {
  // Step 4: 获取用户回答（主 agent 处理）
  const userAnswers = collectUserAnswers(exploreResult)
  
  // Step 5: 通过 send_input 继续交互（关键：不 close）
  send_input({
    id: agent,
    message: `
## CLARIFICATION ANSWERS
${userAnswers.map(a => `Q: ${a.question}\nA: ${a.answer}`).join('\n\n')}

## NEXT STEP
Based on exploration findings and clarification answers, generate plan.json.
Follow schema: cat ~/.claude/workflows/cli-templates/schemas/plan-json-schema.json
`
  })
  
  // Step 6: 等待规划结果
  const planResult = wait({ ids: [agent], timeout_ms: 900000 })
}

// Step 7: 最终清理
close_agent({ id: agent })
```

### 10.3 多轮 send_input 交互模式

**场景**：复杂任务需要多次迭代确认

```javascript
// 创建 agent
const agent = spawn_agent({ message: roleDefinition + taskPrompt })

// 第一轮：获取初步方案
const round1 = wait({ ids: [agent], timeout_ms: 300000 })

// 第二轮：用户反馈后迭代
send_input({
  id: agent,
  message: `
## USER FEEDBACK
${userFeedback}

## REQUEST
Revise the plan based on feedback. Focus on:
1. ${focusPoint1}
2. ${focusPoint2}
`
})
const round2 = wait({ ids: [agent], timeout_ms: 300000 })

// 第三轮：确认细节
send_input({
  id: agent,
  message: `
## CONFIRMATION
Plan approved with minor adjustments:
- Change task T2 scope to include ${additionalScope}
- Add dependency T1 → T3

## FINAL REQUEST
Output final plan.json with these adjustments.
`
})
const finalResult = wait({ ids: [agent], timeout_ms: 300000 })

// 清理
close_agent({ id: agent })
```

### 10.4 简化命令设计原则

**原则 1：减少 Phase 数量**
| 原有模式 | 优化模式 |
|----------|----------|
| Phase 1: Explore | Phase 1: Explore + Clarify + Plan (单 agent) |
| Phase 2: Clarify | ↑ |
| Phase 3: Plan | ↑ |
| Phase 4: Confirm | Phase 2: Confirm (主 agent) |
| Phase 5: Execute | Phase 3: Execute |

**原则 2：延迟 close_agent**
```javascript
// ❌ 错误：过早关闭
const result = wait({ ids: [agent] })
close_agent({ id: agent })  // 关闭后无法继续交互
// ... 发现需要追问，只能重建 agent

// ✅ 正确：延迟关闭
const result = wait({ ids: [agent] })
// 检查是否需要继续交互
if (needsMoreInteraction(result)) {
  send_input({ id: agent, message: followUpMessage })
  const result2 = wait({ ids: [agent] })
}
close_agent({ id: agent })  // 确认不再需要后才关闭
```

**原则 3：上下文复用**
```javascript
// ❌ 错误：每个阶段独立 agent，上下文丢失
const exploreAgent = spawn_agent({ message: explorePrompt })
const exploreResult = wait({ ids: [exploreAgent] })
close_agent({ id: exploreAgent })

const planAgent = spawn_agent({ 
  message: planPrompt + JSON.stringify(exploreResult)  // 需要手动传递上下文
})

// ✅ 正确：单 agent 多阶段，上下文自动保持
const agent = spawn_agent({ message: dualRolePrompt })
const exploreResult = wait({ ids: [agent] })
send_input({ id: agent, message: "Now generate plan based on your findings" })
const planResult = wait({ ids: [agent] })  // agent 自动保持探索上下文
close_agent({ id: agent })
```

### 10.5 效果对比

| 指标 | 分离模式 | 合并模式 | 提升 |
|------|----------|----------|------|
| Agent 创建数 | 3-5 | 1-2 | 60-80% ↓ |
| 用户交互轮次 | 3-4 | 1-2 | 50% ↓ |
| 上下文传递损耗 | 高 | 低 | 显著 ↓ |
| 总执行时间 | 长（多次 spawn/close） | 短（复用 agent） | 30-50% ↓ |
| 结果一致性 | 中（多 agent 可能不一致） | 高（单 agent 统一视角） | 显著 ↑ |

### 10.6 适用场景判断

**使用合并模式**（推荐）：
- 探索 → 澄清 → 规划 流程
- 诊断 → 澄清 → 修复方案 流程
- 任何需要多阶段但上下文强相关的任务

**使用分离模式**：
- 多角度并行探索（不同角度独立，无需共享上下文）
- 职责完全不同的阶段（如：代码生成 vs 测试生成）
- 需要不同专业角色的场景

---

# Claude → Codex 多 Agent 命令转换规范

## 11. 转换概述

### 11.1 核心差异

| 维度 | Claude Code | Codex |
|------|-------------|-------|
| **角色定义** | `subagent_type` 参数自动加载 | 首条 message 显式加载 |
| **并行执行** | 多个 `Task()` 调用 | 多个 `spawn_agent()` + 批量 `wait()` |
| **结果获取** | 同步返回或 TaskOutput 轮询 | `wait({ ids })` 显式等待 |
| **追问/续做** | `resume` 参数 | `send_input()` |
| **生命周期** | 自动回收 | 显式 `close_agent()` |

### 11.2 转换原则

1. **角色前置**：每个 subagent 首条消息必须包含角色定义
2. **批量等待**：利用 `wait({ ids: [...] })` 实现真并行
3. **结果汇聚**：主 agent 负责合并多个 subagent 结果
4. **显式清理**：任务完成后统一 close

## 12. 转换模板

### 12.1 Claude Task 调用转换

**Claude 原始调用**：
```javascript
Task(
  subagent_type = "cli-explore-agent",
  run_in_background = false,
  description = "Explore: architecture",
  prompt = `
## Task Objective
Execute architecture exploration...
...
`
)
```

**Codex 转换后**：
```javascript
// Step 1: 读取角色定义
const roleDefinition = Read('~/.codex/agents/cli-explore-agent.md')

// Step 2: 创建 subagent（角色 + 任务合并）
const agentId = spawn_agent({
  message: `
## ROLE DEFINITION
${roleDefinition}

---

## TASK ASSIGNMENT

### Task Objective
Execute architecture exploration...
...

### Output Format
Summary/Findings/Proposed changes/Tests/Open questions
`
})

// Step 3: 等待结果
const result = wait({ ids: [agentId], timeout_ms: 300000 })

// Step 4: 清理（可延迟到所有任务完成）
close_agent({ id: agentId })
```

### 12.2 并行多 Agent 转换

**Claude 原始调用**（并行 3 个 agent）：
```javascript
// Claude: 发送多个 Task 调用
const tasks = angles.map(angle =>
  Task(
    subagent_type = "cli-explore-agent",
    prompt = `Explore ${angle}...`
  )
)
```

**Codex 转换后**：
```javascript
// Step 1: 读取角色定义（只读一次）
const roleDefinition = Read('~/.codex/agents/cli-explore-agent.md')

// Step 2: 并行创建多个 subagent
const agentIds = angles.map(angle => {
  return spawn_agent({
    message: `
## ROLE DEFINITION
${roleDefinition}

---

## TASK ASSIGNMENT
Goal: Execute ${angle} exploration
Scope: ${scopeForAngle(angle)}
Context: ${contextForAngle(angle)}
Deliverables: JSON output following exploration schema
`
  })
})

// Step 3: 批量等待所有结果（关键优势）
const results = wait({
  ids: agentIds,
  timeout_ms: 600000  // 10 分钟
})

// Step 4: 汇总结果
const aggregatedFindings = agentIds.map(id => results.status[id].completed)

// Step 5: 批量清理
agentIds.forEach(id => close_agent({ id }))
```

## 13. lite-plan 命令转换示例

### 13.1 Phase 1: 探索阶段转换

**Claude 原始实现**：
```javascript
// lite-plan.md Phase 1
const explorationTasks = selectedAngles.map((angle, index) =>
  Task(
    subagent_type="cli-explore-agent",
    run_in_background=false,
    description=`Explore: ${angle}`,
    prompt=`
## Task Objective
Execute **${angle}** exploration...
## Assigned Context
- **Exploration Angle**: ${angle}
...
`
  )
)
```

**Codex 转换后**：
```javascript
// Step 1: 加载角色定义
const exploreRole = Read('~/.codex/agents/cli-explore-agent.md')

// Step 2: 并行创建探索 subagent
const explorationAgents = selectedAngles.map((angle, index) => {
  return spawn_agent({
    message: `
## ROLE DEFINITION
${exploreRole}

---

## TASK ASSIGNMENT

### Task Objective
Execute **${angle}** exploration for task planning context.

### Assigned Context
- **Exploration Angle**: ${angle}
- **Task Description**: ${task_description}
- **Exploration Index**: ${index + 1} of ${selectedAngles.length}
- **Output File**: ${sessionFolder}/exploration-${angle}.json

### MANDATORY FIRST STEPS
1. Run: ccw tool exec get_modules_by_depth '{}'
2. Run: rg -l "{keyword}" --type ts
3. Execute: cat ~/.claude/workflows/cli-templates/schemas/explore-json-schema.json
4. Read: .workflow/project-tech.json
5. Read: .workflow/project-guidelines.json

### Expected Output
**File**: ${sessionFolder}/exploration-${angle}.json
**Format**: JSON following explore-json-schema

### Success Criteria
- [ ] Schema obtained
- [ ] At least 3 relevant files identified
- [ ] JSON output follows schema exactly
`
  })
})

// Step 3: 批量等待所有探索完成
const explorationResults = wait({
  ids: explorationAgents,
  timeout_ms: 600000
})

// Step 4: 检查超时
if (explorationResults.timed_out) {
  // 部分 agent 可能仍在运行，决定是否继续等待
  console.log('部分探索超时，继续等待或使用已完成结果')
}

// Step 5: 收集结果
const completedExplorations = {}
explorationAgents.forEach((agentId, index) => {
  const angle = selectedAngles[index]
  if (explorationResults.status[agentId].completed) {
    completedExplorations[angle] = explorationResults.status[agentId].completed
  }
})

// Step 6: 清理
explorationAgents.forEach(id => close_agent({ id }))
```

### 13.2 Phase 3: 规划阶段转换

**Claude 原始实现**：
```javascript
Task(
  subagent_type="cli-lite-planning-agent",
  run_in_background=false,
  description="Generate detailed implementation plan",
  prompt=`
Generate implementation plan and write plan.json.
## Output Schema Reference
...
`
)
```

**Codex 转换后**：
```javascript
// Step 1: 加载规划角色
const planningRole = Read('~/.codex/agents/cli-lite-planning-agent.md')

// Step 2: 创建规划 subagent
const planningAgent = spawn_agent({
  message: `
## ROLE DEFINITION
${planningRole}

---

## TASK ASSIGNMENT

### Objective
Generate implementation plan and write plan.json.

### Schema Reference
Execute: cat ~/.claude/workflows/cli-templates/schemas/plan-json-schema.json

### Project Context (MANDATORY)
1. Read: .workflow/project-tech.json
2. Read: .workflow/project-guidelines.json

### Task Description
${task_description}

### Multi-Angle Exploration Context
${manifest.explorations.map(exp => `
#### ${exp.angle}
Path: ${exp.path}
`).join('\n')}

### User Clarifications
${JSON.stringify(clarificationContext) || "None"}

### Complexity Level
${complexity}

### Requirements
- Generate plan.json following schema
- Tasks: 2-7 structured tasks (group by feature, NOT by file)
- Include depends_on for true dependencies only

### Output
Write: ${sessionFolder}/plan.json
Return: Brief completion summary
`
})

// Step 3: 等待规划完成
const planResult = wait({
  ids: [planningAgent],
  timeout_ms: 900000  // 15 分钟
})

// Step 4: 清理
close_agent({ id: planningAgent })
```

## 14. 完整工作流转换模板

### 14.1 Codex 多阶段工作流结构

```javascript
// ==================== Phase 1: 探索 ====================
const exploreRole = Read('~/.codex/agents/cli-explore-agent.md')
const explorationAgents = []

// 并行创建探索 agents
for (const angle of selectedAngles) {
  explorationAgents.push(spawn_agent({
    message: `
## ROLE DEFINITION
${exploreRole}

---

## TASK: ${angle} Exploration
${buildExplorationPrompt(angle, task_description)}
`
  }))
}

// 批量等待
const exploreResults = wait({ ids: explorationAgents, timeout_ms: 600000 })

// 收集结果
const explorations = collectResults(exploreResults, selectedAngles)

// 清理探索 agents
explorationAgents.forEach(id => close_agent({ id }))

// ==================== Phase 2: 澄清（可选）====================
const clarifications = aggregateClarifications(explorations)

if (clarifications.length > 0) {
  // 两阶段模式：先收集问题，再追问
  const clarifyAgent = spawn_agent({
    message: `
## ROLE: Clarification Collector

## Questions to Ask User
${clarifications.map((q, i) => `${i+1}. ${q.question}`).join('\n')}

## Output Format
List questions with options and recommended choice.
`
  })

  const clarifyResult = wait({ ids: [clarifyAgent] })

  // 主 agent 收集用户回答后，继续追问
  send_input({
    id: clarifyAgent,
    message: `
## User Responses
${userResponses.map(r => `Q: ${r.question}\nA: ${r.answer}`).join('\n\n')}

## Next Step
Proceed to generate recommendations based on responses.
`
  })

  const finalClarify = wait({ ids: [clarifyAgent] })
  close_agent({ id: clarifyAgent })
}

// ==================== Phase 3: 规划 ====================
const planRole = Read('~/.codex/agents/cli-lite-planning-agent.md')

const planAgent = spawn_agent({
  message: `
## ROLE DEFINITION
${planRole}

---

## TASK: Generate Implementation Plan
${buildPlanningPrompt(task_description, explorations, clarificationContext)}
`
})

const planResult = wait({ ids: [planAgent], timeout_ms: 900000 })
close_agent({ id: planAgent })

// ==================== Phase 4: 确认 & 执行 ====================
// ... (主 agent 直接处理用户交互)
```

## 15. 角色文件管理

### 15.1 角色文件结构规范

```markdown
---
name: {agent-name}
description: |
  {简短描述，1-3行}
color: {blue|green|yellow|cyan|...}
---

{角色定义正文}

## Core Capabilities
...

## Execution Process
...

## Key Reminders
**ALWAYS**: ...
**NEVER**: ...
```

### 15.2 新增角色检查清单

- [ ] 文件位于 `~/.codex/agents/` 目录
- [ ] 包含 YAML front matter (name, description, color)
- [ ] 定义 Core Capabilities
- [ ] 定义 Execution Process/Workflow
- [ ] 包含 Key Reminders (ALWAYS/NEVER)
- [ ] 在 §4.4 角色映射表中添加条目

## 16. 常见转换问题

### 16.1 run_in_background 处理

**Claude**：`run_in_background=false` 表示同步等待
**Codex**：始终异步，通过 `wait()` 控制同步点

```javascript
// Claude: run_in_background=false
Task(subagent_type="...", run_in_background=false, prompt="...")

// Codex: spawn + 立即 wait
const agentId = spawn_agent({ message: "..." })
const result = wait({ ids: [agentId] })  // 阻塞直到完成
```

### 16.2 resume 转换

**Claude**：使用 `resume` 参数恢复 agent
**Codex**：使用 `send_input` 继续交互

```javascript
// Claude: resume
Task(subagent_type="...", resume=previousAgentId, prompt="Continue...")

// Codex: send_input（需 agent 未 close）
send_input({ id: previousAgentId, message: "Continue..." })
const result = wait({ ids: [previousAgentId] })
```

### 16.3 TaskOutput 轮询转换

**Claude**：`TaskOutput({ task_id, block: false })` 轮询
**Codex**：`wait({ ids, timeout_ms })` 带超时等待

```javascript
// Claude: 轮询模式
while (!done) {
  const output = TaskOutput({ task_id: id, block: false })
  if (output.status === 'completed') done = true
  sleep(1000)
}

// Codex: 超时等待 + 重试
let result = wait({ ids: [id], timeout_ms: 30000 })
while (result.timed_out) {
  result = wait({ ids: [id], timeout_ms: 30000 })  // 继续等待
}
```

## 17. 转换检查清单

转换 Claude 多 Agent 命令到 Codex 时，确保：

- [ ] **角色加载**：首条 message 包含 `~/.codex/agents/*.md` 内容
- [ ] **并行优化**：多个独立 agent 使用批量 `wait({ ids: [...] })`
- [ ] **超时处理**：设置合理 `timeout_ms`，处理 `timed_out` 情况
- [ ] **结果汇聚**：主 agent 负责合并 `status[id].completed`
- [ ] **显式清理**：任务完成后调用 `close_agent`
- [ ] **追问模式**：需要续做时使用 `send_input`，不要提前 close
- [ ] **输出模板**：要求 subagent 使用统一结构化输出格式
