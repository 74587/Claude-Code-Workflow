---
name: spec-analyst
description: Team spec analyst - 种子分析、代码库探索、上下文收集、多维度研究
argument-hint: ""
allowed-tools: SendMessage(*), TaskUpdate(*), TaskList(*), TaskGet(*), TodoWrite(*), Read(*), Bash(*), Glob(*), Grep(*), Task(*)
group: team
---

# Team Spec Analyst Command (/team:spec-analyst)

## Overview

Team spec-analyst role command. Operates as a teammate within a Spec Team, responsible for discovery, codebase exploration, and multi-dimensional context gathering. Maps to spec-generator Phase 1 (Discovery).

**Core capabilities:**
- Task discovery from shared team task list (RESEARCH-* tasks)
- Seed analysis: problem statement, users, domain, constraints extraction
- Codebase exploration: existing patterns, architecture, tech stack detection
- Multi-dimensional research: 3-5 exploration dimensions with complexity assessment
- Structured context output for downstream discussion and drafting

## Role Definition

**Name**: `spec-analyst`
**Responsibility**: Seed Analysis → Codebase Exploration → Context Packaging → Report
**Communication**: SendMessage to coordinator only

## 消息总线

每次 SendMessage **前**，必须调用 `mcp__ccw-tools__team_msg` 记录消息：

```javascript
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-analyst", to: "coordinator", type: "<type>", summary: "<摘要>", ref: "<文件路径>" })
```

### 支持的 Message Types

| Type | 方向 | 触发时机 | 说明 |
|------|------|----------|------|
| `research_ready` | spec-analyst → coordinator | 研究完成 | 附带 discovery-context.json 路径和维度摘要 |
| `research_progress` | spec-analyst → coordinator | 长时间研究进展 | 阶段性进展更新 |
| `error` | spec-analyst → coordinator | 遇到不可恢复错误 | 代码库访问失败、CLI 超时等 |

### 调用示例

```javascript
// 研究就绪
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-analyst", to: "coordinator", type: "research_ready", summary: "研究完成: 5个探索维度, 检测到React+Node技术栈", ref: ".workflow/.spec-team/session/discovery-context.json" })

// 进展更新
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-analyst", to: "coordinator", type: "research_progress", summary: "种子分析完成, 开始代码库探索 (2/3)" })

// 错误上报
mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-analyst", to: "coordinator", type: "error", summary: "代码库探索失败: 项目根目录无法识别" })
```

### CLI 回退

当 `mcp__ccw-tools__team_msg` MCP 不可用时，使用 `ccw team` CLI 作为等效回退：

```javascript
// 回退: 将 MCP 调用替换为 Bash CLI（参数一一对应）
Bash(`ccw team log --team "${teamName}" --from "spec-analyst" --to "coordinator" --type "research_ready" --summary "研究完成: 5个探索维度" --ref "${sessionFolder}/discovery-context.json" --json`)
```

**参数映射**: `team_msg(params)` → `ccw team log --team <team> --from spec-analyst --to coordinator --type <type> --summary "<text>" [--ref <path>] [--data '<json>'] [--json]`

## Execution Process

```
Phase 1: Task Discovery
   ├─ TaskList to find unblocked RESEARCH-* tasks
   ├─ TaskGet to read full task details
   └─ TaskUpdate to mark in_progress

Phase 2: Seed Analysis
   ├─ Parse topic/idea from task description
   ├─ Extract: problem statement, target users, domain, constraints
   ├─ Identify 3-5 exploration dimensions
   └─ Assess complexity (simple/moderate/complex)

Phase 3: Codebase Exploration (conditional)
   ├─ Detect project presence (package.json, Cargo.toml, etc.)
   ├─ Explore architecture patterns and conventions
   ├─ Map technology stack and dependencies
   └─ Identify integration constraints

Phase 4: Context Packaging
   ├─ Generate spec-config.json (session state)
   ├─ Generate discovery-context.json (research results)
   └─ Validate output completeness

Phase 5: Report to Coordinator
   ├─ team_msg log + SendMessage research summary
   ├─ TaskUpdate completed
   └─ Check for next RESEARCH-* task
```

## Implementation

### Phase 1: Task Discovery

```javascript
// Find assigned RESEARCH-* tasks
const tasks = TaskList()
const myTasks = tasks.filter(t =>
  t.subject.startsWith('RESEARCH-') &&
  t.owner === 'spec-analyst' &&
  t.status === 'pending' &&
  t.blockedBy.length === 0
)

if (myTasks.length === 0) return // idle

const task = TaskGet({ taskId: myTasks[0].id })
TaskUpdate({ taskId: task.id, status: 'in_progress' })
```

### Phase 2: Seed Analysis

```javascript
// Extract session folder from task description
const sessionMatch = task.description.match(/Session:\s*(.+)/)
const sessionFolder = sessionMatch ? sessionMatch[1].trim() : '.workflow/.spec-team/default'

// Parse topic from task description
const topicLines = task.description.split('\n').filter(l => !l.startsWith('Session:') && !l.startsWith('输出:') && l.trim())
const topic = topicLines[0] || task.subject.replace('RESEARCH-001: ', '')

// Use Gemini CLI for seed analysis
Bash({
  command: `ccw cli -p "PURPOSE: Analyze the following topic/idea and extract structured seed information for specification generation.
TASK:
• Extract problem statement (what problem does this solve)
• Identify target users and their pain points
• Determine domain and industry context
• List constraints and assumptions
• Identify 3-5 exploration dimensions for deeper research
• Assess complexity (simple/moderate/complex)

TOPIC: ${topic}

MODE: analysis
CONTEXT: @**/*
EXPECTED: JSON output with fields: problem_statement, target_users[], domain, constraints[], exploration_dimensions[], complexity_assessment
CONSTRAINTS: Output as valid JSON" --tool gemini --mode analysis --rule analysis-analyze-technical-document`,
  run_in_background: true
})
// Wait for CLI result

// Parse Gemini analysis result
const seedAnalysis = parseCLIResult(geminiOutput)
```

### Phase 3: Codebase Exploration (conditional)

```javascript
// Check if there's an existing codebase to explore
const hasProject = Bash(`test -f package.json || test -f Cargo.toml || test -f pyproject.toml || test -f go.mod; echo $?`)

if (hasProject === '0') {
  // Progress update
  mcp__ccw-tools__team_msg({ operation: "log", team: teamName, from: "spec-analyst", to: "coordinator", type: "research_progress", summary: "种子分析完成, 开始代码库探索" })

  // Explore codebase using ACE search
  const archSearch = mcp__ace-tool__search_context({
    project_root_path: projectRoot,
    query: `Architecture patterns, main modules, entry points for: ${topic}`
  })

  // Detect tech stack
  const techStack = {
    languages: [],
    frameworks: [],
    databases: [],
    infrastructure: []
  }

  // Scan package files for dependencies
  const pkgJson = Read('package.json') // if exists
  // Parse and categorize dependencies

  // Explore existing patterns
  const patterns = mcp__ace-tool__search_context({
    project_root_path: projectRoot,
    query: `Similar features, existing conventions, coding patterns related to: ${topic}`
  })

  // Integration constraints
  const integrationPoints = mcp__ace-tool__search_context({
    project_root_path: projectRoot,
    query: `API endpoints, service boundaries, module interfaces that ${topic} would integrate with`
  })

  var codebaseContext = {
    tech_stack: techStack,
    architecture_patterns: archSearch,
    existing_conventions: patterns,
    integration_points: integrationPoints,
    constraints_from_codebase: []
  }
} else {
  var codebaseContext = null
}
```

### Phase 4: Context Packaging

```javascript
// Generate spec-config.json
const specConfig = {
  session_id: `SPEC-${topicSlug}-${dateStr}`,
  topic: topic,
  status: "research_complete",
  complexity: seedAnalysis.complexity_assessment || "moderate",
  phases_completed: ["discovery"],
  created_at: new Date().toISOString(),
  session_folder: sessionFolder,
  discussion_depth: task.description.match(/讨论深度:\s*(.+)/)?.[1] || "standard"
}
Write(`${sessionFolder}/spec-config.json`, JSON.stringify(specConfig, null, 2))

// Generate discovery-context.json
const discoveryContext = {
  session_id: specConfig.session_id,
  phase: 1,
  document_type: "discovery-context",
  status: "complete",
  generated_at: new Date().toISOString(),
  seed_analysis: {
    problem_statement: seedAnalysis.problem_statement,
    target_users: seedAnalysis.target_users,
    domain: seedAnalysis.domain,
    constraints: seedAnalysis.constraints,
    exploration_dimensions: seedAnalysis.exploration_dimensions,
    complexity: seedAnalysis.complexity_assessment
  },
  codebase_context: codebaseContext,
  recommendations: {
    focus_areas: seedAnalysis.exploration_dimensions?.slice(0, 3) || [],
    risks: [],
    open_questions: []
  }
}
Write(`${sessionFolder}/discovery-context.json`, JSON.stringify(discoveryContext, null, 2))
```

### Phase 5: Report to Coordinator

```javascript
const dimensionCount = discoveryContext.seed_analysis.exploration_dimensions?.length || 0
const hasCodebase = codebaseContext !== null

// Log before SendMessage
mcp__ccw-tools__team_msg({
  operation: "log", team: teamName,
  from: "spec-analyst", to: "coordinator",
  type: "research_ready",
  summary: `研究完成: ${dimensionCount}个探索维度, ${hasCodebase ? '有' : '无'}代码库上下文, 复杂度=${specConfig.complexity}`,
  ref: `${sessionFolder}/discovery-context.json`
})

SendMessage({
  type: "message",
  recipient: "coordinator",
  content: `## 研究分析结果

**Task**: ${task.subject}
**复杂度**: ${specConfig.complexity}
**代码库**: ${hasCodebase ? '已检测到现有项目' : '全新项目（无现有代码）'}

### 问题陈述
${discoveryContext.seed_analysis.problem_statement}

### 目标用户
${(discoveryContext.seed_analysis.target_users || []).map(u => `- ${u}`).join('\n')}

### 探索维度
${(discoveryContext.seed_analysis.exploration_dimensions || []).map((d, i) => `${i+1}. ${d}`).join('\n')}

### 约束条件
${(discoveryContext.seed_analysis.constraints || []).map(c => `- ${c}`).join('\n')}

${hasCodebase ? `### 代码库上下文
- 技术栈: ${JSON.stringify(codebaseContext.tech_stack)}
- 集成点: ${codebaseContext.integration_points?.length || 0}个` : ''}

### 输出位置
- Config: ${sessionFolder}/spec-config.json
- Context: ${sessionFolder}/discovery-context.json

研究已就绪，可进入讨论轮次 DISCUSS-001。`,
  summary: `研究就绪: ${dimensionCount}维度, ${specConfig.complexity}`
})

// Mark task completed
TaskUpdate({ taskId: task.id, status: 'completed' })

// Check for next RESEARCH task
const nextTasks = TaskList().filter(t =>
  t.subject.startsWith('RESEARCH-') &&
  t.owner === 'spec-analyst' &&
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
| No RESEARCH-* tasks available | Idle, wait for coordinator assignment |
| Gemini CLI analysis failure | Fallback to direct Claude analysis without CLI |
| Codebase detection failed | Continue as new project (no codebase context) |
| Session folder cannot be created | Notify coordinator, request alternative path |
| Topic too vague for analysis | Report to coordinator with clarification questions |
| Unexpected error | Log error via team_msg, report to coordinator |
