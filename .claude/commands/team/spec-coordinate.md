---
name: spec-coordinate
description: Team spec coordinator - 规格文档工作流编排、讨论轮次管理、跨阶段共识推进
argument-hint: "[--team-name=NAME] \"spec topic description\""
allowed-tools: TeamCreate(*), TeamDelete(*), SendMessage(*), TaskCreate(*), TaskUpdate(*), TaskList(*), TaskGet(*), Task(*), AskUserQuestion(*), TodoWrite(*), Read(*), Bash(*), Glob(*), Grep(*)
group: team
---

# Team Spec Coordinate Command (/team:spec-coordinate)

规格文档团队协调器。需求发现 → 研究分析 → 讨论共识 → 文档撰写 → 质量审查 → 最终交付。每个阶段之间穿插结构化讨论轮次，确保多角度审视和团队共识。

## 消息总线

所有 teammate 在 SendMessage 的**同时**必须调用 `mcp__ccw-tools__team_msg` 记录消息：

```javascript
// 记录消息（每个 teammate 发 SendMessage 前调用）
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-analyst", to: "coordinator", type: "research_ready", summary: "研究完成: 5个探索维度", ref: ".workflow/.spec-team/session/discovery-context.json" })

// 查看全部消息
mcp__ccw-tools__team_msg({ operation: "list", team: teamName })

// 按角色过滤
mcp__ccw-tools__team_msg({ operation: "list", team: teamName, from: "spec-discuss", last: 5 })

// 查看团队状态
mcp__ccw-tools__team_msg({ operation: "status", team: teamName })
```

**日志位置**: `.workflow/.team-msg/{team-name}/messages.jsonl`
**消息类型**: `research_ready | research_progress | draft_ready | draft_revision | quality_result | discussion_ready | discussion_blocked | fix_required | error | shutdown`

### CLI 回退

当 `mcp__ccw-tools__team_msg` MCP 不可用时，使用 `ccw team` CLI 作为等效回退：

```javascript
// 回退: 将 MCP 调用替换为 Bash CLI（参数一一对应）
// log
Bash(`ccw team log --team "${teamName}" --from "coordinator" --to "spec-analyst" --type "plan_approved" --summary "研究结果已确认" --json`)
// list
Bash(`ccw team list --team "${teamName}" --last 10 --json`)
// list (带过滤)
Bash(`ccw team list --team "${teamName}" --from "spec-discuss" --last 5 --json`)
// status
Bash(`ccw team status --team "${teamName}" --json`)
// read
Bash(`ccw team read --team "${teamName}" --id "MSG-003" --json`)
```

**参数映射**: `team_msg(params)` → `ccw team <operation> --team <team> [--from/--to/--type/--summary/--ref/--data/--id/--last] [--json]`

## Pipeline

```
Topic → [RESEARCH: spec-analyst] → [DISCUSS-001: 范围讨论]
      → [DRAFT-001: Product Brief] → [DISCUSS-002: 多视角评审]
      → [DRAFT-002: Requirements/PRD] → [DISCUSS-003: 需求完整性讨论]
      → [DRAFT-003: Architecture] → [DISCUSS-004: 技术可行性讨论]
      → [DRAFT-004: Epics & Stories] → [DISCUSS-005: 执行就绪讨论]
      → [QUALITY-001: Readiness Check] → [DISCUSS-006: 最终签收]
      → 交付 → 等待新需求/关闭
```

## 讨论轮次设计

每个讨论轮次由 spec-discuss 角色执行，包含以下维度：

| 讨论轮次 | 发生时机 | 讨论焦点 | 输入制品 |
|----------|----------|----------|----------|
| DISCUSS-001 | 研究完成后 | 范围确认、方向调整、风险预判 | discovery-context.json |
| DISCUSS-002 | Product Brief 后 | 产品定位、用户画像、竞品分析 | product-brief.md |
| DISCUSS-003 | PRD 后 | 需求完整性、优先级、可测试性 | requirements/_index.md |
| DISCUSS-004 | Architecture 后 | 技术选型、可扩展性、安全性 | architecture/_index.md |
| DISCUSS-005 | Epics 后 | 执行顺序、MVP范围、估算合理性 | epics/_index.md |
| DISCUSS-006 | Quality Check 后 | 最终交付确认、遗留问题、下一步 | readiness-report.md |

## Execution

### Phase 1: 需求解析

解析 `$ARGUMENTS` 获取 `--team-name` 和规格主题。使用 AskUserQuestion 收集：
- 规格范围（MVP / 完整 / 企业级）
- 重点领域（产品定义 / 技术架构 / 全面规格）
- 讨论深度（快速共识 / 深度讨论 / 全面辩论）

简单主题可跳过澄清。

### Phase 2: 创建 Team + Spawn 4 Teammates

```javascript
TeamCreate({ team_name: teamName })

// Session setup
const topicSlug = topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').substring(0, 40)
const dateStr = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().substring(0, 10)
const sessionFolder = `.workflow/.spec-team/${topicSlug}-${dateStr}`
Bash(`mkdir -p ${sessionFolder}`)
```

**Spawn 时只传角色和需求，工作细节由 skill 定义**：

```javascript
// Spec Analyst (研究分析)
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "spec-analyst",
  prompt: `你是 team "${teamName}" 的 SPEC ANALYST。

当你收到 RESEARCH-* 任务时，调用 Skill(skill="team:spec-analyst") 执行研究分析。

当前主题: ${topicDescription}
约束: ${constraints}
Session: ${sessionFolder}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录：
mcp__ccw-tools__team_msg({ operation: "log", team: "${teamName}", from: "spec-analyst", to: "coordinator", type: "<type>", summary: "<摘要>", ref: "<文件路径>" })

工作流程:
1. TaskList → 找到分配给你的 RESEARCH-* 任务
2. Skill(skill="team:spec-analyst") 执行发现和研究
3. team_msg log + SendMessage 将研究结果发给 coordinator
4. TaskUpdate completed → 检查下一个 RESEARCH 任务`
})

// Spec Writer (文档撰写)
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "spec-writer",
  prompt: `你是 team "${teamName}" 的 SPEC WRITER。

当你收到 DRAFT-* 任务时，调用 Skill(skill="team:spec-writer") 执行文档撰写。

当前主题: ${topicDescription}
约束: ${constraints}
Session: ${sessionFolder}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录：
mcp__ccw-tools__team_msg({ operation: "log", team: "${teamName}", from: "spec-writer", to: "coordinator", type: "<type>", summary: "<摘要>", ref: "<文件路径>" })

工作流程:
1. TaskList → 找到未阻塞的 DRAFT-* 任务
2. Skill(skill="team:spec-writer") 执行文档生成
3. team_msg log + SendMessage 报告文档就绪
4. TaskUpdate completed → 检查下一个 DRAFT 任务`
})

// Spec Reviewer (质量审查)
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "spec-reviewer",
  prompt: `你是 team "${teamName}" 的 SPEC REVIEWER。

当你收到 QUALITY-* 任务时，调用 Skill(skill="team:spec-reviewer") 执行质量审查。

当前主题: ${topicDescription}
约束: ${constraints}
Session: ${sessionFolder}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录：
mcp__ccw-tools__team_msg({ operation: "log", team: "${teamName}", from: "spec-reviewer", to: "coordinator", type: "<type>", summary: "<摘要>" })

工作流程:
1. TaskList → 找到未阻塞的 QUALITY-* 任务
2. Skill(skill="team:spec-reviewer") 执行质量验证
3. team_msg log + SendMessage 报告审查结果
4. TaskUpdate completed → 检查下一个 QUALITY 任务`
})

// Spec Discuss (讨论促进者)
Task({
  subagent_type: "general-purpose",
  team_name: teamName,
  name: "spec-discuss",
  prompt: `你是 team "${teamName}" 的 SPEC DISCUSS FACILITATOR。

当你收到 DISCUSS-* 任务时，调用 Skill(skill="team:spec-discuss") 执行结构化团队讨论。

当前主题: ${topicDescription}
约束: ${constraints}
Session: ${sessionFolder}
讨论深度: ${discussionDepth}

## 消息总线（必须）
每次 SendMessage 前，先调用 mcp__ccw-tools__team_msg 记录：
mcp__ccw-tools__team_msg({ operation: "log", team: "${teamName}", from: "spec-discuss", to: "coordinator", type: "<type>", summary: "<摘要>", ref: "<文件路径>" })

工作流程:
1. TaskList → 找到未阻塞的 DISCUSS-* 任务
2. Skill(skill="team:spec-discuss") 执行结构化讨论
3. team_msg log + SendMessage 报告讨论共识
4. TaskUpdate completed → 检查下一个 DISCUSS 任务`
})
```

### Phase 3: 创建完整任务链

```javascript
// ===== RESEARCH Phase =====
TaskCreate({ subject: "RESEARCH-001: 主题发现与上下文研究", description: `${topicDescription}\n\nSession: ${sessionFolder}\n输出: ${sessionFolder}/spec-config.json + discovery-context.json`, activeForm: "研究中" })
TaskUpdate({ taskId: researchId, owner: "spec-analyst" })

// ===== DISCUSS Round 1: 范围讨论 =====
TaskCreate({ subject: "DISCUSS-001: 研究结果讨论 - 范围确认与方向调整", description: `讨论 RESEARCH-001 的发现结果\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/discovery-context.json\n输出: ${sessionFolder}/discussions/discuss-001-scope.md\n\n讨论维度: 范围确认、方向调整、风险预判、探索缺口`, activeForm: "讨论范围中" })
TaskUpdate({ taskId: discuss1Id, owner: "spec-discuss", addBlockedBy: [researchId] })

// ===== DRAFT Phase 1: Product Brief =====
TaskCreate({ subject: "DRAFT-001: 撰写 Product Brief", description: `基于研究和讨论共识撰写产品简报\n\nSession: ${sessionFolder}\n输入: discovery-context.json + discuss-001-scope.md\n输出: ${sessionFolder}/product-brief.md\n\n使用多视角分析: 产品/技术/用户`, activeForm: "撰写 Brief 中" })
TaskUpdate({ taskId: draft1Id, owner: "spec-writer", addBlockedBy: [discuss1Id] })

// ===== DISCUSS Round 2: Brief 评审 =====
TaskCreate({ subject: "DISCUSS-002: Product Brief 多视角评审", description: `评审 Product Brief 文档\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/product-brief.md\n输出: ${sessionFolder}/discussions/discuss-002-brief.md\n\n讨论维度: 产品定位、目标用户、成功指标、竞品差异`, activeForm: "评审 Brief 中" })
TaskUpdate({ taskId: discuss2Id, owner: "spec-discuss", addBlockedBy: [draft1Id] })

// ===== DRAFT Phase 2: Requirements/PRD =====
TaskCreate({ subject: "DRAFT-002: 撰写 Requirements/PRD", description: `基于 Brief 和讨论反馈撰写需求文档\n\nSession: ${sessionFolder}\n输入: product-brief.md + discuss-002-brief.md\n输出: ${sessionFolder}/requirements/\n\n包含: 功能需求(REQ-*) + 非功能需求(NFR-*) + MoSCoW 优先级`, activeForm: "撰写 PRD 中" })
TaskUpdate({ taskId: draft2Id, owner: "spec-writer", addBlockedBy: [discuss2Id] })

// ===== DISCUSS Round 3: 需求完整性 =====
TaskCreate({ subject: "DISCUSS-003: 需求完整性与优先级讨论", description: `讨论 PRD 需求完整性\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/requirements/_index.md\n输出: ${sessionFolder}/discussions/discuss-003-requirements.md\n\n讨论维度: 需求遗漏、MoSCoW合理性、验收标准可测性、非功能需求充分性`, activeForm: "讨论需求中" })
TaskUpdate({ taskId: discuss3Id, owner: "spec-discuss", addBlockedBy: [draft2Id] })

// ===== DRAFT Phase 3: Architecture =====
TaskCreate({ subject: "DRAFT-003: 撰写 Architecture Document", description: `基于需求和讨论反馈撰写架构文档\n\nSession: ${sessionFolder}\n输入: requirements/ + discuss-003-requirements.md\n输出: ${sessionFolder}/architecture/\n\n包含: 架构风格 + 组件图 + 技术选型 + ADR-* + 数据模型`, activeForm: "撰写架构中" })
TaskUpdate({ taskId: draft3Id, owner: "spec-writer", addBlockedBy: [discuss3Id] })

// ===== DISCUSS Round 4: 技术可行性 =====
TaskCreate({ subject: "DISCUSS-004: 架构决策与技术可行性讨论", description: `讨论架构设计合理性\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/architecture/_index.md\n输出: ${sessionFolder}/discussions/discuss-004-architecture.md\n\n讨论维度: 技术选型风险、可扩展性、安全架构、ADR替代方案`, activeForm: "讨论架构中" })
TaskUpdate({ taskId: discuss4Id, owner: "spec-discuss", addBlockedBy: [draft3Id] })

// ===== DRAFT Phase 4: Epics & Stories =====
TaskCreate({ subject: "DRAFT-004: 撰写 Epics & Stories", description: `基于架构和讨论反馈撰写史诗和用户故事\n\nSession: ${sessionFolder}\n输入: architecture/ + discuss-004-architecture.md\n输出: ${sessionFolder}/epics/\n\n包含: EPIC-* + STORY-* + 依赖图 + MVP定义 + 执行顺序`, activeForm: "撰写 Epics 中" })
TaskUpdate({ taskId: draft4Id, owner: "spec-writer", addBlockedBy: [discuss4Id] })

// ===== DISCUSS Round 5: 执行就绪 =====
TaskCreate({ subject: "DISCUSS-005: 执行计划与MVP范围讨论", description: `讨论执行计划就绪性\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/epics/_index.md\n输出: ${sessionFolder}/discussions/discuss-005-epics.md\n\n讨论维度: Epic粒度、故事估算、MVP范围、执行顺序、依赖风险`, activeForm: "讨论执行计划中" })
TaskUpdate({ taskId: discuss5Id, owner: "spec-discuss", addBlockedBy: [draft4Id] })

// ===== QUALITY: Readiness Check =====
TaskCreate({ subject: "QUALITY-001: 规格就绪度检查", description: `全文档交叉验证和质量评分\n\nSession: ${sessionFolder}\n输入: 全部文档\n输出: ${sessionFolder}/readiness-report.md + spec-summary.md\n\n评分维度: 完整性(25%) + 一致性(25%) + 可追溯性(25%) + 深度(25%)`, activeForm: "质量检查中" })
TaskUpdate({ taskId: qualityId, owner: "spec-reviewer", addBlockedBy: [discuss5Id] })

// ===== DISCUSS Round 6: 最终签收 =====
TaskCreate({ subject: "DISCUSS-006: 最终签收与交付确认", description: `最终讨论和签收\n\nSession: ${sessionFolder}\n输入: ${sessionFolder}/readiness-report.md\n输出: ${sessionFolder}/discussions/discuss-006-final.md\n\n讨论维度: 质量报告审查、遗留问题处理、交付确认、下一步建议`, activeForm: "最终签收讨论中" })
TaskUpdate({ taskId: discuss6Id, owner: "spec-discuss", addBlockedBy: [qualityId] })
```

### Phase 4: 协调主循环

接收 teammate 消息，根据内容做调度决策。**每次做出决策前先 `team_msg list` 查看最近消息，每次做出决策后 `team_msg log` 记录**：

| 收到消息 | 操作 |
|----------|------|
| Analyst: 研究就绪 | 读取 discovery-context.json → team_msg log → 解锁 DISCUSS-001 |
| Discuss: 讨论共识达成 | 读取 discussion.md → 判断是否需要修订 → 解锁下一个 DRAFT 任务 |
| Discuss: 讨论阻塞 | 介入讨论 → AskUserQuestion 获取用户决策 → 手动推进 |
| Writer: 文档就绪 | 读取文档摘要 → team_msg log → 解锁对应 DISCUSS 任务 |
| Writer: 文档修订 | 更新依赖 → 解锁相关讨论任务 |
| Reviewer: 质量通过 (≥80%) | team_msg log → 解锁 DISCUSS-006 |
| Reviewer: 质量需审查 (60-79%) | team_msg log + 通知 writer 改进建议 |
| Reviewer: 质量失败 (<60%) | 创建 DRAFT-fix 任务 → 分配 writer |
| 所有任务 completed | → Phase 5 |

**讨论阻塞处理**：
```javascript
// 当 DISCUSS 任务报告阻塞（无法达成共识）
// Coordinator 介入
if (msgType === 'discussion_blocked') {
  const blockReason = msg.data.reason
  const options = msg.data.options

  // 上报用户做出决策
  AskUserQuestion({
    questions: [{
      question: `讨论 ${msg.ref} 遇到分歧: ${blockReason}\n请选择方向:`,
      header: "Decision",
      multiSelect: false,
      options: options.map(opt => ({ label: opt.label, description: opt.description }))
    }]
  })

  // 将用户决策写入讨论记录
  // 解锁后续任务
}
```

### Phase 5: 汇报 + 持久循环

汇总所有文档、讨论轮次结果、质量评分报告用户。

```javascript
AskUserQuestion({
  questions: [{
    question: "规格文档已完成。下一步：",
    header: "Next",
    multiSelect: false,
    options: [
      { label: "交付执行", description: "将规格交给 lite-plan/req-plan/plan 执行" },
      { label: "新主题", description: "为新主题生成规格（复用团队）" },
      { label: "关闭团队", description: "关闭所有 teammate 并清理" }
    ]
  }]
})
// 交付执行 → 提示可用的执行 workflow
// 新主题 → 回到 Phase 1（复用 team，新建全套任务链）
// 关闭 → shutdown 给每个 teammate → TeamDelete()
```

## Session 文件结构

```
.workflow/.spec-team/{topic-slug}-{YYYY-MM-DD}/
├── spec-config.json              # Session state
├── discovery-context.json        # Research context (Phase 1)
├── product-brief.md              # Product Brief (Phase 2)
├── requirements/                 # PRD (Phase 3)
│   ├── _index.md
│   ├── REQ-001-*.md
│   └── NFR-*-*.md
├── architecture/                 # Architecture (Phase 4)
│   ├── _index.md
│   └── ADR-001-*.md
├── epics/                        # Epics & Stories (Phase 5)
│   ├── _index.md
│   └── EPIC-001-*.md
├── readiness-report.md           # Quality validation (Phase 6)
├── spec-summary.md               # Executive summary
└── discussions/                  # 讨论记录
    ├── discuss-001-scope.md
    ├── discuss-002-brief.md
    ├── discuss-003-requirements.md
    ├── discuss-004-architecture.md
    ├── discuss-005-epics.md
    └── discuss-006-final.md
```

## 错误处理

| 场景 | 处理 |
|------|------|
| Teammate 无响应 | 发追踪消息，2次无响应 → 重新 spawn |
| 讨论无法共识 | Coordinator 介入 → AskUserQuestion |
| 文档质量 <60% | 创建 DRAFT-fix 任务给 writer |
| Writer 修订 3+ 次 | 上报用户，建议调整范围 |
| Research 无法完成 | 降级为简化模式，跳过深度分析 |
