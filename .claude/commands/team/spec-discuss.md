---
name: spec-discuss
description: Team spec discuss - 结构化团队讨论、多视角批判、共识构建、分歧调解
argument-hint: ""
allowed-tools: SendMessage(*), TaskUpdate(*), TaskList(*), TaskGet(*), TodoWrite(*), Read(*), Write(*), Bash(*), Glob(*), Grep(*), Task(*)
group: team
---

# Team Spec Discuss Command (/team:spec-discuss)

## Overview

Team spec-discuss role command. Operates as a teammate within a Spec Team, responsible for facilitating structured team discussions between specification phases. This is the **key differentiator** of the spec team workflow — ensuring multi-perspective critique, consensus building, and quality feedback before each phase transition.

**Core capabilities:**
- Task discovery from shared team task list (DISCUSS-* tasks)
- Multi-perspective analysis: Product, Technical, Quality, Risk viewpoints
- Structured discussion facilitation with critique + suggestion format
- Consensus synthesis with action items and decision records
- Conflict identification and escalation when consensus cannot be reached
- CLI-assisted deep critique (parallel multi-model analysis)

## Role Definition

**Name**: `spec-discuss`
**Responsibility**: Load Artifact → Multi-Perspective Critique → Synthesize Consensus → Report
**Communication**: SendMessage to coordinator only

## 消息总线

每次 SendMessage **前**，必须调用 `mcp__ccw-tools__team_msg` 记录消息：

```javascript
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-discuss", to: "coordinator", type: "<type>", summary: "<摘要>", ref: "<文件路径>" })
```

### 支持的 Message Types

| Type | 方向 | 触发时机 | 说明 |
|------|------|----------|------|
| `discussion_ready` | spec-discuss → coordinator | 讨论完成，共识达成 | 附带讨论记录路径和决策摘要 |
| `discussion_blocked` | spec-discuss → coordinator | 讨论无法达成共识 | 附带分歧点和可选方案，需 coordinator 介入 |
| `impl_progress` | spec-discuss → coordinator | 长讨论进展更新 | 多视角分析进度 |
| `error` | spec-discuss → coordinator | 讨论无法进行 | 输入制品缺失等 |

### 调用示例

```javascript
// 讨论共识达成
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-discuss", to: "coordinator", type: "discussion_ready", summary: "DISCUSS-002: 共识达成, 3个改进建议 + 2个开放问题", ref: ".workflow/.spec-team/session/discussions/discuss-002-brief.md" })

// 讨论阻塞
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-discuss", to: "coordinator", type: "discussion_blocked", summary: "DISCUSS-004: 技术选型分歧 - 微服务 vs 单体, 需用户决策", data: { reason: "技术架构风格无法达成共识", options: [{ label: "微服务", description: "更好扩展性但增加复杂度" }, { label: "单体", description: "简单但限制扩展" }] } })

// 错误上报
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-discuss", to: "coordinator", type: "error", summary: "DISCUSS-001: 找不到 discovery-context.json" })
```

## 讨论维度模型

每个讨论轮次从4个视角进行结构化分析：

| 视角 | 关注点 | 代表角色 |
|------|--------|----------|
| **产品视角** | 市场适配、用户价值、商业可行性、竞品差异 | Product Manager |
| **技术视角** | 可行性、技术债务、性能、安全、可维护性 | Tech Lead |
| **质量视角** | 完整性、可测试性、一致性、标准合规 | QA Lead |
| **风险视角** | 风险识别、依赖分析、假设验证、失败模式 | Risk Analyst |

## 讨论轮次配置

| 轮次 | 制品 | 重点维度 | 讨论深度 |
|------|------|----------|----------|
| DISCUSS-001 | discovery-context | 产品+风险 | 范围确认、方向调整 |
| DISCUSS-002 | product-brief | 产品+技术+质量 | 定位审视、可行性 |
| DISCUSS-003 | requirements | 质量+产品 | 完整性、优先级 |
| DISCUSS-004 | architecture | 技术+风险 | 技术选型、安全性 |
| DISCUSS-005 | epics | 产品+技术+质量 | MVP范围、估算 |
| DISCUSS-006 | readiness-report | 全维度 | 最终签收 |

## Execution Process

```
Phase 1: Task Discovery
   ├─ TaskList to find unblocked DISCUSS-* tasks
   ├─ TaskGet to read full task details
   └─ TaskUpdate to mark in_progress

Phase 2: Artifact Loading
   ├─ Identify discussion round from task subject (001-006)
   ├─ Load target artifact for discussion
   ├─ Load prior discussion records for continuity
   └─ Determine discussion dimensions from round config

Phase 3: Multi-Perspective Critique
   ├─ Product perspective analysis
   ├─ Technical perspective analysis
   ├─ Quality perspective analysis
   ├─ Risk perspective analysis
   └─ (Parallel CLI execution for depth)

Phase 4: Consensus Synthesis
   ├─ Identify convergent themes (areas of agreement)
   ├─ Identify divergent views (conflicts)
   ├─ Generate action items and recommendations
   ├─ Formulate consensus or escalate divergence
   └─ Write discussion record

Phase 5: Report to Coordinator
   ├─ team_msg log + SendMessage discussion results
   ├─ TaskUpdate completed (if consensus)
   └─ Flag discussion_blocked (if unresolvable conflict)
```

## Implementation

### Phase 1: Task Discovery

```javascript
// Find assigned DISCUSS-* tasks
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('DISCUSS-') &&
  t.owner === 'spec-discuss' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Artifact Loading

```javascript
// Extract session folder and discussion round
const sessionMatch = task.description.match(/Session:\s*(.+)/)
const sessionFolder = sessionMatch ? sessionMatch[1].trim() : ''
const roundMatch = task.subject.match(/DISCUSS-(\d+)/)
const roundNumber = roundMatch ? parseInt(roundMatch[1]) : 0

// Discussion round configuration
const roundConfig = {
  1: { artifact: 'discovery-context.json', type: 'json', outputFile: 'discuss-001-scope.md', perspectives: ['product', 'risk'], label: '范围讨论' },
  2: { artifact: 'product-brief.md', type: 'md', outputFile: 'discuss-002-brief.md', perspectives: ['product', 'technical', 'quality'], label: 'Brief评审' },
  3: { artifact: 'requirements/_index.md', type: 'md', outputFile: 'discuss-003-requirements.md', perspectives: ['quality', 'product'], label: '需求讨论' },
  4: { artifact: 'architecture/_index.md', type: 'md', outputFile: 'discuss-004-architecture.md', perspectives: ['technical', 'risk'], label: '架构讨论' },
  5: { artifact: 'epics/_index.md', type: 'md', outputFile: 'discuss-005-epics.md', perspectives: ['product', 'technical', 'quality'], label: 'Epics讨论' },
  6: { artifact: 'readiness-report.md', type: 'md', outputFile: 'discuss-006-final.md', perspectives: ['product', 'technical', 'quality', 'risk'], label: '最终签收' }
}

const config = roundConfig[roundNumber]
if (!config) {
  mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-discuss", to: "coordinator", type: "error", summary: `未知讨论轮次: DISCUSS-${roundNumber}` })
  return
}

// Load target artifact
let artifact = null
try {
  const raw = Read(`${sessionFolder}/${config.artifact}`)
  artifact = config.type === 'json' ? JSON.parse(raw) : raw
} catch (e) {
  mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-discuss", to: "coordinator", type: "error", summary: `无法加载制品: ${config.artifact}` })
  return
}

// Load prior discussion records for context continuity
const priorDiscussions = []
for (let i = 1; i < roundNumber; i++) {
  const priorConfig = roundConfig[i]
  try { priorDiscussions.push(Read(`${sessionFolder}/discussions/${priorConfig.outputFile}`)) } catch {}
}

// Ensure discussions directory exists
Bash(`mkdir -p ${sessionFolder}/discussions`)
```

### Phase 3: Multi-Perspective Critique

```javascript
const perspectives = {}
const artifactContent = typeof artifact === 'string' ? artifact : JSON.stringify(artifact, null, 2)

// Progress notification
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-discuss", to: "coordinator", type: "impl_progress", summary: `开始 ${config.label}: ${config.perspectives.length} 个视角分析` })

// --- Product Perspective ---
if (config.perspectives.includes('product')) {
  Bash({
    command: `ccw cli -p "PURPOSE: Critique the following specification artifact from a PRODUCT MANAGER perspective.
TASK:
• Evaluate market fit and user value proposition
• Assess target user alignment and persona coverage
• Check business viability and competitive differentiation
• Identify gaps in user journey coverage
• Rate on scale 1-5 with specific improvement suggestions

ARTIFACT TYPE: ${config.label}
CONTENT: ${artifactContent.substring(0, 8000)}

${priorDiscussions.length > 0 ? `PRIOR DISCUSSION CONTEXT: ${priorDiscussions[priorDiscussions.length - 1]?.substring(0, 2000)}` : ''}

EXPECTED: Structured critique with: strengths[], weaknesses[], suggestions[], open_questions[], rating (1-5)
CONSTRAINTS: Be constructive but rigorous" --tool gemini --mode analysis`,
    run_in_background: true
  })
  // perspectives.product = parseCLIResult(...)
}

// --- Technical Perspective ---
if (config.perspectives.includes('technical')) {
  Bash({
    command: `ccw cli -p "PURPOSE: Critique the following specification artifact from a TECH LEAD perspective.
TASK:
• Evaluate technical feasibility and implementation complexity
• Assess architecture decisions and technology choices
• Check for technical debt risks and scalability concerns
• Identify missing technical requirements or constraints
• Rate on scale 1-5 with specific improvement suggestions

ARTIFACT TYPE: ${config.label}
CONTENT: ${artifactContent.substring(0, 8000)}

EXPECTED: Structured critique with: strengths[], weaknesses[], suggestions[], risks[], rating (1-5)
CONSTRAINTS: Focus on engineering concerns" --tool codex --mode analysis`,
    run_in_background: true
  })
  // perspectives.technical = parseCLIResult(...)
}

// --- Quality Perspective ---
if (config.perspectives.includes('quality')) {
  Bash({
    command: `ccw cli -p "PURPOSE: Critique the following specification artifact from a QA LEAD perspective.
TASK:
• Evaluate completeness of acceptance criteria and testability
• Check consistency of terminology and formatting
• Assess traceability between documents
• Identify ambiguous or untestable requirements
• Rate on scale 1-5 with specific improvement suggestions

ARTIFACT TYPE: ${config.label}
CONTENT: ${artifactContent.substring(0, 8000)}

EXPECTED: Structured critique with: strengths[], weaknesses[], suggestions[], testability_issues[], rating (1-5)
CONSTRAINTS: Focus on quality and verifiability" --tool claude --mode analysis`,
    run_in_background: true
  })
  // perspectives.quality = parseCLIResult(...)
}

// --- Risk Perspective ---
if (config.perspectives.includes('risk')) {
  Bash({
    command: `ccw cli -p "PURPOSE: Critique the following specification artifact from a RISK ANALYST perspective.
TASK:
• Identify project risks and failure modes
• Assess dependency risks and external factors
• Validate assumptions made in the specification
• Check for missing contingency plans
• Rate risk level (Low/Medium/High/Critical) with mitigation suggestions

ARTIFACT TYPE: ${config.label}
CONTENT: ${artifactContent.substring(0, 8000)}

EXPECTED: Structured critique with: risks[{description, likelihood, impact, mitigation}], assumptions_to_validate[], dependencies[], overall_risk_level
CONSTRAINTS: Focus on risk identification" --tool gemini --mode analysis`,
    run_in_background: true
  })
  // perspectives.risk = parseCLIResult(...)
}

// Wait for all parallel CLI analyses to complete
```

### Phase 4: Consensus Synthesis

```javascript
// Analyze all perspectives for convergence and divergence
const synthesis = {
  convergent_themes: [],   // Areas where all perspectives agree
  divergent_views: [],     // Areas of conflict
  action_items: [],        // Concrete improvements to make
  open_questions: [],      // Unresolved questions for user/team
  decisions: [],           // Decisions made during discussion
  risk_flags: [],          // Risks identified
  overall_sentiment: '',   // positive/neutral/concerns/critical
  consensus_reached: true  // false if major unresolvable conflicts
}

// Extract convergent themes (items mentioned positively by 2+ perspectives)
// Extract divergent views (items where perspectives conflict)
// Generate action items from suggestions

// Check for unresolvable conflicts
const criticalDivergences = synthesis.divergent_views.filter(d => d.severity === 'high')
if (criticalDivergences.length > 0) {
  synthesis.consensus_reached = false
}

// Determine overall sentiment
const avgRating = Object.values(perspectives)
  .map(p => p?.rating || 3)
  .reduce((a, b) => a + b, 0) / config.perspectives.length

synthesis.overall_sentiment = avgRating >= 4 ? 'positive'
  : avgRating >= 3 ? 'neutral'
  : avgRating >= 2 ? 'concerns'
  : 'critical'

// Generate discussion record
const discussionRecord = `# 讨论记录: ${config.label} (DISCUSS-${String(roundNumber).padStart(3, '0')})

**讨论对象**: ${config.artifact}
**参与视角**: ${config.perspectives.join(', ')}
**讨论时间**: ${new Date().toISOString()}
**共识状态**: ${synthesis.consensus_reached ? '已达成共识' : '存在分歧，需coordinator介入'}
**总体评价**: ${synthesis.overall_sentiment}

## 多视角评审结果

${config.perspectives.map(p => {
  const pData = perspectives[p]
  return `### ${p === 'product' ? '产品视角 (Product Manager)' :
    p === 'technical' ? '技术视角 (Tech Lead)' :
    p === 'quality' ? '质量视角 (QA Lead)' :
    '风险视角 (Risk Analyst)'}

**评分**: ${pData?.rating || 'N/A'}/5

**优点**:
${(pData?.strengths || []).map(s => '- ' + s).join('\n') || '- (待分析)'}

**不足**:
${(pData?.weaknesses || []).map(w => '- ' + w).join('\n') || '- (待分析)'}

**建议**:
${(pData?.suggestions || []).map(s => '- ' + s).join('\n') || '- (待分析)'}
`}).join('\n')}

## 共识分析

### 一致认同的优点
${synthesis.convergent_themes.map(t => '- ' + t).join('\n') || '- (待合成)'}

### 存在的分歧
${synthesis.divergent_views.map(d => `- **${d.topic}**: ${d.description}`).join('\n') || '- 无重大分歧'}

### 风险标记
${synthesis.risk_flags.map(r => `- [${r.level}] ${r.description}`).join('\n') || '- 无重大风险'}

## 行动项

${synthesis.action_items.map((item, i) => `${i+1}. ${item}`).join('\n') || '无需修改'}

## 开放问题

${synthesis.open_questions.map((q, i) => `${i+1}. ${q}`).join('\n') || '无开放问题'}

## 决策记录

${synthesis.decisions.map((d, i) => `${i+1}. **${d.topic}**: ${d.decision} (理由: ${d.rationale})`).join('\n') || '无新决策'}

## 对下一阶段的建议

${roundNumber < 6 ? `下一阶段应关注: ${synthesis.action_items.slice(0, 3).join('; ') || '按原计划推进'}` : '所有阶段已完成，建议进入执行。'}
`

Write(`${sessionFolder}/discussions/${config.outputFile}`, discussionRecord)
```

### Phase 5: Report to Coordinator

```javascript
if (synthesis.consensus_reached) {
  // Consensus reached
  mcp__ccw-tools__team_msg({
    operation: "log", team: teamName,
    from: "spec-discuss", to: "coordinator",
    type: "discussion_ready",
    summary: `${config.label}讨论完成: ${synthesis.action_items.length}个行动项, ${synthesis.open_questions.length}个开放问题, 总体${synthesis.overall_sentiment}`,
    ref: `${sessionFolder}/discussions/${config.outputFile}`
  })

  SendMessage({
    type: "message",
    recipient: "coordinator",
    content: `## 讨论结果: ${config.label}

**Task**: ${task.subject}
**共识**: 已达成
**总体评价**: ${synthesis.overall_sentiment}
**参与视角**: ${config.perspectives.join(', ')}

### 关键发现
**一致优点**: ${synthesis.convergent_themes.length}项
**分歧点**: ${synthesis.divergent_views.length}项
**风险标记**: ${synthesis.risk_flags.length}项

### 行动项 (${synthesis.action_items.length})
${synthesis.action_items.map((item, i) => `${i+1}. ${item}`).join('\n') || '无'}

### 开放问题 (${synthesis.open_questions.length})
${synthesis.open_questions.map((q, i) => `${i+1}. ${q}`).join('\n') || '无'}

### 讨论记录
${sessionFolder}/discussions/${config.outputFile}

共识已达成，可推进至下一阶段。`,
    summary: `${config.label}共识达成: ${synthesis.action_items.length}行动项`
  })

  TaskUpdate({ taskId: task.id, status: 'completed' })
} else {
  // Consensus blocked - escalate to coordinator
  mcp__ccw-tools__team_msg({
    operation: "log", team: teamName,
    from: "spec-discuss", to: "coordinator",
    type: "discussion_blocked",
    summary: `${config.label}讨论阻塞: ${criticalDivergences.length}个关键分歧需决策`,
    data: {
      reason: criticalDivergences.map(d => d.description).join('; '),
      options: criticalDivergences.map(d => ({
        label: d.topic,
        description: d.options?.join(' vs ') || d.description
      }))
    }
  })

  SendMessage({
    type: "message",
    recipient: "coordinator",
    content: `## 讨论阻塞: ${config.label}

**Task**: ${task.subject}
**状态**: 无法达成共识，需要 coordinator 介入

### 关键分歧
${criticalDivergences.map((d, i) => `${i+1}. **${d.topic}**: ${d.description}
   - 选项A: ${d.optionA || ''}
   - 选项B: ${d.optionB || ''}`).join('\n\n')}

### 已达成共识的部分
${synthesis.convergent_themes.map(t => `- ${t}`).join('\n') || '- 无'}

### 建议
请通过 AskUserQuestion 收集用户对分歧点的决策，然后将决策写入讨论记录以继续推进。

### 讨论记录（部分）
${sessionFolder}/discussions/${config.outputFile}`,
    summary: `${config.label}阻塞: ${criticalDivergences.length}分歧`
  })

  // Keep task in_progress, wait for coordinator resolution
}

// Check for next DISCUSS task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('DISCUSS-') &&
  t.owner === 'spec-discuss' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (nextTasks.length > 0) {
  // Continue with next task -> back to Phase 1
}
```

## Error Handling

| Scenario | Resolution |
|----------|------------|
| No DISCUSS-* tasks available | Idle, wait for coordinator assignment |
| Target artifact not found | Notify coordinator, request prerequisite completion |
| CLI perspective analysis failure | Fallback to direct Claude analysis for that perspective |
| All CLI analyses fail | Generate basic discussion from direct reading |
| Consensus timeout (all perspectives diverge) | Escalate as discussion_blocked |
| Prior discussion records missing | Continue without continuity context |
| Session folder not found | Notify coordinator, request session path |
| Unexpected error | Log error via team_msg, report to coordinator |
